import './style.css';
import { montarEditor } from './blocks/workspace.ts';
import { calcularEscala, configurarCanvas, dibujarRing, dibujarRobot } from './render/canvas.ts';
import type { Robot } from './types.ts';
import { Simulacion } from './engine/world.ts';

/**
 * Punto de entrada. Arma el layout, monta el editor de bloques y conecta
 * los controles con la simulación.
 *
 * OJO: este archivo es territorio COMPARTIDO. Según el plan se integra de
 * verdad el viernes 6 (main.ts conecta sensores → vm.step() → motor → render).
 * Hasta entonces, cada uno toca lo mínimo indispensable y avisa en el PR.
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
    </section>
  </main>
`;

const contenedorEditor = document.querySelector<HTMLDivElement>('#editor-bloques')!;
montarEditor(contenedorEditor);

// Render del ring (A1.1)
const canvasRing = document.querySelector<HTMLCanvasElement>('#ring')!;
const ctxRing = configurarCanvas(canvasRing);
const escalaRing = calcularEscala(canvasRing.width, canvasRing.height);

const robotsPrueba: Robot[] = [
  { id: 'a', x: -20, y: 0, theta: 0, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
  { id: 'b', x: 20, y: 0, theta: Math.PI, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
];

const sim = new Simulacion(
  robotsPrueba,
  (robots) => {
    // Velocidades de prueba: el rojo embiste, el azul está quieto.
    // Esto lo reemplaza la VM en la integración del viernes 6.
    robots[0].vL = 20;
    robots[0].vR = 20;
    robots[1].vL = 0;
    robots[1].vR = 0;
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
      ctxRing.fillText(
        `Gana ${vivos[0].id === 'a' ? 'rojo' : 'azul'}`,
        canvasRing.width / 2,
        40,
      );
    }

    // La simulación puede pausarse sola al terminar el combate, así que el
    // botón se sincroniza en cada cuadro en vez de solo al hacer clic.
    sincronizarControles();
  },
);

// --- Controles (A2.4) ---

const btnJugar = document.querySelector<HTMLButtonElement>('#btn-jugar')!;
const btnReiniciar = document.querySelector<HTMLButtonElement>('#btn-reiniciar')!;
const botonesVelocidad = document.querySelectorAll<HTMLButtonElement>('.vel');

function sincronizarControles(): void {
  btnJugar.textContent = sim.corriendo ? 'Pausar' : 'Iniciar';
  btnJugar.disabled = sim.terminado;
}

btnJugar.addEventListener('click', () => {
  if (sim.corriendo) sim.pausar();
  else sim.iniciar();
  sincronizarControles();
});

btnReiniciar.addEventListener('click', () => {
  sim.reiniciar();
  sincronizarControles();
});

for (const boton of botonesVelocidad) {
  boton.addEventListener('click', () => {
    sim.velocidad = Number(boton.dataset.velocidad);
    for (const otro of botonesVelocidad) {
      otro.classList.toggle('activa', otro === boton);
    }
  });
}

// Dibuja el estado inicial y deja los botones en su sitio, sin arrancar.
sim.reiniciar();