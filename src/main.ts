import './style.css';
import * as Blockly from 'blockly';
import { montarEditor } from './blocks/workspace.ts';
import { generarPrograma } from './blocks/generator.ts';
import { calcularEscala, configurarCanvas, dibujarRing, dibujarRobot } from './render/canvas.ts';
import { leerSensores } from './engine/sensors.ts';
import { VM } from './vm/vm.ts';
import { VELOCIDAD_MAX, type LecturaSensores, type Orden, type Robot } from './types.ts';
import { DT, Simulacion } from './engine/world.ts';

/**
 * Punto de entrada. Conecta las dos mitades del proyecto:
 *
 *   bloques -> generador -> VM -> motor -> render
 *
 * En cada cuadro, por cada robot: se leen sus sensores, se decide qué hacer,
 * y la orden resultante se escribe en sus ruedas. El motor hace el resto.
 *
 * Los dos robots se programan con bloques. El azul además puede llevar una
 * estrategia automática fija, y viene así por defecto: es el único rival que
 * no cambia, y sin un rival que no cambia no se puede saber si una diferencia
 * en el combate vino de tus bloques o de los suyos.
 */

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="cabecera">
    <h1>Simulador de Sumo LEGO</h1>
    <p class="subtitulo">Programa tu robot con bloques y mira cómo pelea.</p>
  </header>

  <main class="espacio-trabajo">
    <section class="panel panel-editor">
      <h2 class="titulo-panel">Programa</h2>

      <div class="controles">
        <button type="button" class="boton pestana activa" data-editor="rojo">Rojo</button>
        <button type="button" class="boton pestana" data-editor="azul">Azul</button>

        <span class="separador-controles"></span>

        <span>Azul:</span>
        <button type="button" class="boton fuente activa" data-fuente="automatico">Automático</button>
        <button type="button" class="boton fuente" data-fuente="bloques">Sus bloques</button>
      </div>

      <div id="editor-rojo" class="editor-bloques"></div>
      <div id="editor-azul" class="editor-bloques" hidden></div>
    </section>

    <section class="panel panel-ring">
      <h2 class="titulo-panel">Ring</h2>
      <canvas id="ring" width="600" height="600"></canvas>

      <div class="controles">
        <button id="btn-jugar" type="button" class="boton">Iniciar</button>
        <button id="btn-reiniciar" type="button" class="boton">Reiniciar</button>

        <span class="separador-controles"></span>

        <button type="button" class="boton vel activa" data-velocidad="1">1×</button>
        <button type="button" class="boton vel" data-velocidad="2">2×</button>
        <button type="button" class="boton vel" data-velocidad="5">5×</button>
      </div>

      <p id="avisos" class="avisos"></p>
    </section>
  </main>
`;

// --- Los dos editores -----------------------------------------------------

/**
 * Guardamos las referencias que devuelve `montarEditor()` en vez de usar
 * `obtenerWorkspace()`: esa función guarda UN workspace en una variable del
 * módulo, así que con dos editores devolvería siempre el último montado.
 */
const contenedorRojo = document.querySelector<HTMLDivElement>('#editor-rojo')!;
const contenedorAzul = document.querySelector<HTMLDivElement>('#editor-azul')!;

const editores = {
  rojo: { contenedor: contenedorRojo, workspace: montarEditor(contenedorRojo) },
  azul: { contenedor: contenedorAzul, workspace: montarEditor(contenedorAzul) },
};

type Color = keyof typeof editores;

const pestanas = document.querySelectorAll<HTMLButtonElement>('.pestana');

/**
 * Muestra uno de los dos editores y esconde el otro.
 *
 * El `svgResize` no es opcional: Blockly mide el contenedor al inyectarse, y
 * el editor azul se monta escondido, así que mide 0 y su SVG queda de ese
 * tamaño. Sin volver a medirlo al mostrarlo, la pestaña azul aparece vacía
 * aunque los bloques estén ahí.
 */
function mostrarEditor(cual: Color): void {
  for (const nombre of Object.keys(editores) as Color[]) {
    const visible = nombre === cual;
    editores[nombre].contenedor.hidden = !visible;
    if (visible) Blockly.svgResize(editores[nombre].workspace);
  }

  for (const pestana of pestanas) {
    pestana.classList.toggle('activa', pestana.dataset.editor === cual);
  }
}

for (const pestana of pestanas) {
  pestana.addEventListener('click', () => mostrarEditor(pestana.dataset.editor as Color));
}

// --- El ring --------------------------------------------------------------

const canvasRing = document.querySelector<HTMLCanvasElement>('#ring')!;
const ctxRing = configurarCanvas(canvasRing);
const escalaRing = calcularEscala(canvasRing.width, canvasRing.height);

const robotsPrueba: Robot[] = [
  { id: 'a', x: -20, y: 0, theta: 0, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
  { id: 'b', x: 20, y: 0, theta: Math.PI, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
];

// --- Controles ------------------------------------------------------------

const btnJugar = document.querySelector<HTMLButtonElement>('#btn-jugar')!;
const btnReiniciar = document.querySelector<HTMLButtonElement>('#btn-reiniciar')!;
const botonesVelocidad = document.querySelectorAll<HTMLButtonElement>('.vel');
const botonesFuente = document.querySelectorAll<HTMLButtonElement>('.fuente');
const avisos = document.querySelector<HTMLParagraphElement>('#avisos')!;

// --- Los competidores -----------------------------------------------------

/** De dónde salen las órdenes de un robot. */
type Fuente = 'bloques' | 'automatico';

/**
 * Un robot con su manera de decidir.
 *
 * Antes esto estaba escrito a mano, un bloque de código por color. Con dos
 * robots programables y una fuente que se elige en pantalla, repetir el
 * bloque significaría cuatro combinaciones escritas a mano; con esta
 * estructura el bucle trata a los dos igual y la diferencia vive en un dato.
 */
interface Competidor {
  nombre: string;
  robot: Robot;
  workspace: Blockly.WorkspaceSvg;
  fuente: Fuente;
  /** La VM compilada, o null si este robot va en automático. */
  vm: VM | null;
}

const competidores: Competidor[] = [
  {
    nombre: 'Rojo',
    robot: robotsPrueba[0],
    workspace: editores.rojo.workspace,
    fuente: 'bloques',
    vm: null,
  },
  {
    nombre: 'Azul',
    robot: robotsPrueba[1],
    workspace: editores.azul.workspace,
    fuente: 'automatico',
    vm: null,
  },
];

/**
 * Si los programas ya se compilaron para este combate.
 *
 * Hace falta una bandera aparte y no basta con mirar si `vm` es null: un
 * robot en automático tiene la VM en null legítimamente, así que null no
 * distingue "no compilado todavía" de "no usa VM".
 */
let combatePreparado = false;

/** Recorta una velocidad al máximo real del motor EV3. */
function saturar(v: number): number {
  return Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, v));
}

/**
 * El rival automático.
 *
 * No usa la VM ni lleva estado. Decide solo con lo que percibe en este
 * instante, y por eso cabe en tres líneas: la memoria que la VM necesita
 * (puntero, pila, duraciones) hace falta para ejecutar un PROGRAMA, no para
 * reaccionar.
 */
function estrategiaAutomatica(s: LecturaSensores): Orden {
  // Borde: retrocede girando, para apartarse y reorientarse a la vez.
  if (s.bordeIzquierdo || s.bordeDerecho) return { vL: -18, vR: -24 };

  // Ve al rival dentro del cono: embiste.
  if (s.distanciaFrontal < 40) return { vL: 25, vR: 25 };

  // No ve nada: gira sobre su eje buscando.
  return { vL: 12, vR: -12 };
}

/** Qué ordena un competidor en este cuadro. */
function decidir(c: Competidor, rival: Robot): Orden {
  const sensores = leerSensores(c.robot, rival);

  // El `!c.vm` cubre el caso de un programa en bloques que no compiló nada:
  // mejor que el robot se comporte como el automático a que se quede muerto
  // en el sitio sin explicación.
  if (c.fuente === 'automatico' || !c.vm) return estrategiaAutomatica(sensores);

  return c.vm.step(sensores);
}

/** Compila los programas de quienes van con bloques y crea sus VM. */
function prepararCombate(): void {
  const mensajes: string[] = [];

  for (const c of competidores) {
    if (c.fuente === 'automatico') {
      c.vm = null;
      continue;
    }

    const { programa, advertencias } = generarPrograma(c.workspace);

    // Las advertencias van con el nombre del robot delante: con dos editores,
    // "hay bloques sueltos" sin decir de cuál no sirve de nada.
    for (const aviso of advertencias) mensajes.push(`${c.nombre}: ${aviso}`);

    c.vm = new VM(programa, {
      anchoEje: c.robot.anchoEje,
      velocidadMax: VELOCIDAD_MAX,
      dt: DT,
    });
  }

  avisos.textContent = mensajes.join(' ');
  combatePreparado = true;
}

function sincronizarControles(): void {
  btnJugar.textContent = sim.corriendo ? 'Pausar' : 'Iniciar';
  btnJugar.disabled = sim.terminado;
}

const sim = new Simulacion(
  robotsPrueba,
  () => {
    if (!combatePreparado) return;

    const [rojo, azul] = competidores;

    for (const [c, rival] of [
      [rojo, azul.robot],
      [azul, rojo.robot],
    ] as const) {
      if (!c.robot.vivo) continue;

      const orden = decidir(c, rival);
      // Se satura al máximo del motor: el simulador no debe permitir algo
      // que el robot real no puede hacer. La VM ya recorta lo suyo, pero la
      // estrategia automática no pasa por ella.
      c.robot.vL = saturar(orden.vL);
      c.robot.vR = saturar(orden.vR);
    }
  },
  (robots) => {
    dibujarRing(ctxRing, escalaRing);
    dibujarRobot(ctxRing, robots[0], '#e74c3c', escalaRing);
    dibujarRobot(ctxRing, robots[1], '#3498db', escalaRing);

    const vivos = robots.filter((r) => r.vivo);
    if (vivos.length === 1) {
      ctxRing.fillStyle = '#ffffff';
      ctxRing.font = 'bold 28px system-ui, sans-serif';
      ctxRing.textAlign = 'center';
      ctxRing.fillText(`Gana ${vivos[0].id === 'a' ? 'rojo' : 'azul'}`, canvasRing.width / 2, 40);
    }

    // La simulación puede pausarse sola al terminar el combate, así que el
    // botón se sincroniza en cada cuadro y no solo al hacer clic.
    sincronizarControles();
  },
);

btnJugar.addEventListener('click', () => {
  if (sim.corriendo) {
    sim.pausar();
  } else {
    // Solo se compila al empezar un combate, no al reanudar una pausa:
    // recompilar reiniciaría el puntero de la VM y el robot volvería a la
    // primera instrucción.
    if (!combatePreparado) prepararCombate();
    sim.iniciar();
  }
  sincronizarControles();
});

btnReiniciar.addEventListener('click', () => {
  // El próximo Iniciar recompila, por si cambiaron los bloques.
  combatePreparado = false;
  for (const c of competidores) c.vm = null;

  avisos.textContent = '';
  sim.reiniciar();
  sincronizarControles();
});

for (const boton of botonesFuente) {
  boton.addEventListener('click', () => {
    competidores[1].fuente = boton.dataset.fuente as Fuente;

    // Cambiar de fuente a mitad de combate dejaría al azul ejecutando lo
    // que ya tenía, así que se reinicia: el cambio se nota desde el primer
    // cuadro y no a medias.
    combatePreparado = false;
    for (const c of competidores) c.vm = null;
    sim.reiniciar();

    for (const otro of botonesFuente) otro.classList.toggle('activa', otro === boton);
    sincronizarControles();
  });
}

for (const boton of botonesVelocidad) {
  boton.addEventListener('click', () => {
    sim.velocidad = Number(boton.dataset.velocidad);
    for (const otro of botonesVelocidad) otro.classList.toggle('activa', otro === boton);
  });
}

// Dibuja el estado inicial y deja los botones en su sitio, sin arrancar.
sim.reiniciar();
