import './style.css';
import { montarEditor } from './blocks/workspace.ts';
import { calcularEscala, configurarCanvas, dibujarRing, dibujarRobot } from './render/canvas.ts';
import type { Robot } from './types.ts';

/**
 * Punto de entrada. Por ahora solo arma el layout y monta el editor (B1.1).
 *
 * OJO: este archivo es territorio COMPARTIDO. Según el plan se integra de
 * verdad el viernes 6 (main.ts conecta sensores → vm.step() → motor → render).
 * Hasta entonces, cada uno toca lo mínimo indispensable y avisa en el PR.
 *
 * El <canvas> de abajo está vacío a propósito: es el espacio reservado para
 * el render de José (A1.1). Yo no dibujo nada ahí.
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
      <!-- Zona de José (A1.1 – A1.3). No tocar desde blocks/ ni vm/. -->
      <canvas id="ring" width="600" height="600"></canvas>
    </section>
  </main>
`;

const contenedorEditor = document.querySelector<HTMLDivElement>('#editor-bloques')!;
montarEditor(contenedorEditor);

// Render del ring (A1.1)
const canvasRing = document.querySelector<HTMLCanvasElement>('#ring')!;
const ctxRing = configurarCanvas(canvasRing);
const escalaRing = calcularEscala(canvasRing.width, canvasRing.height);
dibujarRing(ctxRing, escalaRing);

const robotsPrueba: Robot[] = [
  { id: 'a', x: -20, y: 0, theta: 0, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
  { id: 'b', x: 20, y: 0, theta: Math.PI, vL: 0, vR: 0, anchoEje: 12, radio: 9, masa: 1.1, vivo: true },
];

dibujarRobot(ctxRing, robotsPrueba[0], '#e74c3c', escalaRing);
dibujarRobot(ctxRing, robotsPrueba[1], '#3498db', escalaRing);