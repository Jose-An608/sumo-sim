import './style.css';
import { montarEditor, obtenerWorkspace } from './blocks/workspace.ts';
import { generarPrograma } from './blocks/generator.ts';
import { calcularEscala, configurarCanvas, dibujarRing, dibujarRobot } from './render/canvas.ts';
import { leerSensores } from './engine/sensors.ts';
import { VM } from './vm/vm.ts';
import type { LecturaSensores, Orden, Robot } from './types.ts';
import { DT, Simulacion } from './engine/world.ts';

/**
 * Punto de entrada. Conecta las dos mitades del proyecto:
 *
 *   bloques -> generador -> VM -> motor -> render
 *
 * En cada cuadro, por cada robot: se leen sus sensores, se le pasan a su VM,
 * y la orden que devuelve se escribe en sus ruedas. El motor hace el resto.
 */

const VELOCIDAD_MAX = 50; // cm/s — motor grande EV3 con rueda de 5.6 cm

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <header class="cabecera">
    <h1>Simulador de Sumo LEGO</h1>
    <p class="subtitulo">Programa tu robot con bloques y mira cómo pelea.</p>
  </header>

  <main class="espacio-trabajo">
    <section class="panel panel-editor">
      <h2 class="titulo-panel">Programa</h2>
      <div id="editor-bloques"></div>
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

const contenedorEditor = document.querySelector<HTMLDivElement>('#editor-bloques')!;
montarEditor(contenedorEditor);

const canvasRing = document.querySelector<HTMLCanvasElement>('#ring')!;
const ctxRing = configurarCanvas(canvasRing);
const escalaRing = calcularEscala(canvasRing.width, canvasRing.height);

const robotsPrueba: Robot[] = [
  { id: 'a', x: -20, y: 0, theta: 0, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
  { id: 'b', x: 20, y: 0, theta: Math.PI, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
];

// --- Controles (A2.4) ---

const btnJugar = document.querySelector<HTMLButtonElement>('#btn-jugar')!;
const btnReiniciar = document.querySelector<HTMLButtonElement>('#btn-reiniciar')!;
const botonesVelocidad = document.querySelectorAll<HTMLButtonElement>('.vel');
const avisos = document.querySelector<HTMLParagraphElement>('#avisos')!;

/**
 * La VM del robot ROJO, el que se programa con bloques. `null` significa
 * que todavía no se compiló: el programa se compila al pulsar Iniciar y no
 * al cargar, para que el usuario pueda cambiar los bloques y volver a probar.
 *
 * El AZUL no tiene VM: lleva una estrategia fija escrita en código (abajo).
 * Así, cuando cambias los bloques, lo único que cambia en el combate es el
 * rojo — y puedes saber si lo que ves vino de tu programa o del rival.
 */
let vmRojo: VM | null = null;

/** Recorta una velocidad al máximo real del motor EV3. */
function saturar(v: number): number {
  return Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, v));
}

/**
 * El rival automático: el robot AZUL.
 *
 * No usa la VM ni lleva estado. Decide solo con lo que percibe en este
 * instante, y por eso cabe en tres líneas: la memoria que la VM necesita
 * (puntero, pila, duraciones) hace falta para ejecutar un PROGRAMA, no para
 * reaccionar.
 *
 * Es el sparring: siempre se comporta igual, así que cualquier diferencia
 * en el combate viene de los bloques del rojo.
 */
function estrategiaAutomatica(s: LecturaSensores): Orden {
  // Borde: retrocede girando, para apartarse y reorientarse a la vez.
  if (s.bordeIzquierdo || s.bordeDerecho) return { vL: -18, vR: -24 };

  // Ve al rival dentro del cono: embiste.
  if (s.distanciaFrontal < 40) return { vL: 25, vR: 25 };

  // No ve nada: gira sobre su eje buscando.
  return { vL: 12, vR: -12 };
}

/** Compila los bloques del editor y crea la VM del robot rojo. */
function prepararCombate(): void {
  const { programa, advertencias } = generarPrograma(obtenerWorkspace());

  avisos.textContent = advertencias.join(' ');

  const rojo = robotsPrueba[0];
  vmRojo = new VM(programa, {
    anchoEje: rojo.anchoEje,
    velocidadMax: VELOCIDAD_MAX,
    dt: DT,
  });
}

function sincronizarControles(): void {
  btnJugar.textContent = sim.corriendo ? 'Pausar' : 'Iniciar';
  btnJugar.disabled = sim.terminado;
}

const sim = new Simulacion(
  robotsPrueba,
  (robots) => {
    if (!vmRojo) return;

    const [rojo, azul] = robots;

    // Rojo: lo que diga el programa de bloques.
    if (rojo.vivo) {
      const orden = vmRojo.step(leerSensores(rojo, azul));
      // Se satura al máximo del motor: el simulador no debe permitir algo
      // que el robot real no puede hacer.
      rojo.vL = saturar(orden.vL);
      rojo.vR = saturar(orden.vR);
    }

    // Azul: el rival automático, siempre igual.
    if (azul.vivo) {
      const orden = estrategiaAutomatica(leerSensores(azul, rojo));
      azul.vL = saturar(orden.vL);
      azul.vR = saturar(orden.vR);
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
    if (!vmRojo) prepararCombate();
    sim.iniciar();
  }
  sincronizarControles();
});

btnReiniciar.addEventListener('click', () => {
  vmRojo = null; // El próximo Iniciar recompila, por si cambiaron los bloques.
  avisos.textContent = '';
  sim.reiniciar();
  sincronizarControles();
});

for (const boton of botonesVelocidad) {
  boton.addEventListener('click', () => {
    sim.velocidad = Number(boton.dataset.velocidad);
    for (const otro of botonesVelocidad) otro.classList.toggle('activa', otro === boton);
  });
}

// Dibuja el estado inicial y deja los botones en su sitio, sin arrancar.
sim.reiniciar();
