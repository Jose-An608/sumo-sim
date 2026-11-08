import './style.css';
import * as Blockly from 'blockly';
import { montarEditor } from './blocks/workspace.ts';
import { generarPrograma } from './blocks/generator.ts';
import {
  aTexto,
  cargar,
  claveDe,
  crearAutoguardado,
  desdeTexto,
  guardar,
  type Almacen,
  type Autoguardado,
} from './blocks/persistencia.ts';
import { calcularEscala, configurarCanvas, dibujarRing, dibujarRobot } from './render/canvas.ts';
import { leerSensores } from './engine/sensors.ts';
import { VM } from './vm/vm.ts';
import { VELOCIDAD_MAX, type LecturaSensores, type Orden, type Robot } from './types.ts';
import { DT, Simulacion } from './engine/world.ts';
import { Marcador, type Ganador } from './engine/marcador.ts';

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

        <span class="separador-controles"></span>

        <button id="btn-descargar" type="button" class="boton">Descargar</button>
        <button id="btn-abrir" type="button" class="boton">Abrir</button>
        <input id="archivo" type="file" accept=".json,application/json" hidden />
      </div>

      <div id="editor-rojo" class="editor-bloques"></div>
      <div id="editor-azul" class="editor-bloques" hidden></div>
    </section>

    <section class="panel panel-ring">
      <h2 class="titulo-panel">Ring</h2>

      <p id="marcador" class="marcador" aria-live="polite"></p>

      <canvas id="ring" width="600" height="600"></canvas>

      <div class="controles">
        <button id="btn-jugar" type="button" class="boton">Iniciar</button>
        <button id="btn-revancha" type="button" class="boton" disabled>Revancha</button>
        <button id="btn-reiniciar" type="button" class="boton">Reiniciar</button>
        <button id="btn-marcador-cero" type="button" class="boton">Marcador a cero</button>

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
 * Cada llamada a `montarEditor()` crea un editor independiente y devuelve su
 * workspace; aquí guardamos las dos referencias.
 */
const contenedorRojo = document.querySelector<HTMLDivElement>('#editor-rojo')!;
const contenedorAzul = document.querySelector<HTMLDivElement>('#editor-azul')!;

const editores = {
  rojo: { contenedor: contenedorRojo, workspace: montarEditor(contenedorRojo) },
  azul: { contenedor: contenedorAzul, workspace: montarEditor(contenedorAzul) },
};

type Color = keyof typeof editores;

/** El editor que se está viendo. Descargar y Abrir actúan sobre este. */
let activo: Color = 'rojo';

// --- Guardado automático --------------------------------------------------

/**
 * `localStorage` se pide dentro de cada método y no al declarar el objeto:
 * en algunos navegadores, solo ACCEDER a la propiedad ya lanza si el usuario
 * bloqueó el almacenamiento. Aquí dentro lo atrapan `guardar` y `cargar`.
 */
const almacen: Almacen = {
  getItem: (c) => window.localStorage.getItem(c),
  setItem: (c, v) => window.localStorage.setItem(c, v),
  removeItem: (c) => window.localStorage.removeItem(c),
};

const ESPERA_AUTOGUARDADO_MS = 500;

const autoguardados = {} as Record<Color, Autoguardado>;

for (const color of Object.keys(editores) as Color[]) {
  const { workspace } = editores[color];
  const clave = claveDe(color);

  // Se carga ANTES de escuchar cambios: así lo que se acaba de recuperar no
  // se vuelve a guardar como si el usuario lo hubiera tocado.
  cargar(workspace, almacen, clave);

  const auto = crearAutoguardado(() => guardar(workspace, almacen, clave), ESPERA_AUTOGUARDADO_MS);
  autoguardados[color] = auto;

  workspace.addChangeListener((evento) => {
    // Mover el scroll, seleccionar un bloque o abrir el toolbox son eventos
    // de interfaz: no cambian el programa, no hay nada que guardar.
    if (!evento.isUiEvent) auto.pedir();
  });
}

/**
 * Si el usuario cierra la pestaña dentro de la espera, el último cambio
 * seguiría pendiente y se perdería. `vaciar` lo guarda en el acto.
 * `visibilitychange` cubre el móvil, donde `pagehide` no siempre se dispara.
 */
function guardarPendientes(): void {
  for (const auto of Object.values(autoguardados)) auto.vaciar();
}

window.addEventListener('pagehide', guardarPendientes);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') guardarPendientes();
});

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
  activo = cual;

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
const btnRevancha = document.querySelector<HTMLButtonElement>('#btn-revancha')!;
const btnMarcadorCero = document.querySelector<HTMLButtonElement>('#btn-marcador-cero')!;
const elMarcador = document.querySelector<HTMLParagraphElement>('#marcador')!;
const botonesVelocidad = document.querySelectorAll<HTMLButtonElement>('.vel');
const botonesFuente = document.querySelectorAll<HTMLButtonElement>('.fuente');
const avisos = document.querySelector<HTMLParagraphElement>('#avisos')!;

// --- Descargar y abrir un programa ----------------------------------------

const btnDescargar = document.querySelector<HTMLButtonElement>('#btn-descargar')!;
const btnAbrir = document.querySelector<HTMLButtonElement>('#btn-abrir')!;
const entradaArchivo = document.querySelector<HTMLInputElement>('#archivo')!;

btnDescargar.addEventListener('click', () => {
  const texto = aTexto(editores[activo].workspace);
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `sumo-sim-${activo}.json`;
  enlace.click();

  // Se libera después del clic y no en el mismo instante, para no cortar
  // una descarga que el navegador todavía no empezó.
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

btnAbrir.addEventListener('click', () => entradaArchivo.click());

entradaArchivo.addEventListener('change', async () => {
  const archivo = entradaArchivo.files?.[0];

  // Se vacía para que elegir el MISMO archivo dos veces seguidas vuelva a
  // disparar el evento; si no, el navegador lo toma por "sin cambios".
  entradaArchivo.value = '';
  if (!archivo) return;

  // El editor se fija ahora: `await` espera, y el usuario puede cambiar de
  // pestaña mientras tanto. El archivo va a donde estaba al elegirlo.
  const color = activo;
  const texto = await archivo.text();

  if (desdeTexto(texto, editores[color].workspace)) {
    avisos.textContent = '';
    autoguardados[color].pedir();
  } else {
    avisos.textContent = `${archivo.name} no es un programa válido. No se cambió nada.`;
  }
});

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

  // La revancha solo tiene sentido con la ronda terminada: mientras se
  // pelea, "empezar otra" dejaría la actual a medias y sin contar.
  btnRevancha.disabled = !sim.terminado;
}

// --- El marcador ----------------------------------------------------------

/**
 * Cuenta de la sesión. Vive aquí y no en `Simulacion` a propósito: el
 * simulador sabe pelear una ronda, no cuántas se han jugado.
 *
 * Reiniciar el combate NO lo toca. Solo se pone a cero con su propio botón,
 * para poder probar una estrategia varias veces seguidas y ver cuántas gana.
 */
const marcador = new Marcador();

function mostrarMarcador(): void {
  elMarcador.textContent =
    `Rojo ${marcador.rojo} · Azul ${marcador.azul} · Empates ${marcador.empates}`;
}

/**
 * Traduce el robot que quedó en pie al color que lleva el marcador.
 *
 * Se compara por referencia con el robot del competidor y no por `id`: los
 * ids ('a', 'b') son un detalle de los robots de prueba, y el color de quien
 * ganó no debería depender de cómo se llamen.
 */
function ganadorAColor(robot: Robot | null): Ganador {
  if (!robot) return null;
  return robot === competidores[0].robot ? 'rojo' : 'azul';
}

/** Devuelve el combate al principio. No toca el marcador. */
function reiniciarCombate(): void {
  // El próximo Iniciar recompila, por si cambiaron los bloques.
  combatePreparado = false;
  for (const c of competidores) c.vm = null;

  avisos.textContent = '';
  sim.reiniciar();
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
    if (vivos.length <= 1) {
      // Con cero robots en pie es un empate: salieron los dos en el mismo
      // cuadro. Antes ese caso no mostraba nada.
      const texto = vivos.length === 1 ? `Gana ${vivos[0].id === 'a' ? 'rojo' : 'azul'}` : 'Empate';

      ctxRing.fillStyle = '#ffffff';
      ctxRing.font = 'bold 28px system-ui, sans-serif';
      ctxRing.textAlign = 'center';
      ctxRing.fillText(texto, canvasRing.width / 2, 40);
    }

    // La simulación puede pausarse sola al terminar el combate, así que el
    // botón se sincroniza en cada cuadro y no solo al hacer clic.
    sincronizarControles();
  },
  (ganador) => {
    // Una vez por ronda: el motor lo garantiza, así que aquí se anota sin
    // más y no hace falta ninguna bandera de "ya conté esta".
    marcador.registrar(ganadorAColor(ganador));
    mostrarMarcador();
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
  reiniciarCombate();
  sincronizarControles();
});

btnRevancha.addEventListener('click', () => {
  // Reiniciar y arrancar en un solo clic. Se recompila siempre: la revancha
  // es el momento natural de haber cambiado un bloque.
  reiniciarCombate();
  prepararCombate();
  sim.iniciar();
  sincronizarControles();
});

btnMarcadorCero.addEventListener('click', () => {
  marcador.reiniciar();
  mostrarMarcador();
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
mostrarMarcador();
sim.reiniciar();
