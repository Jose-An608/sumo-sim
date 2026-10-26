import * as Blockly from 'blockly';
import { COLOR } from './definitions.ts';

/**
 * B1.1 / B1.2 — Montaje del editor de bloques.
 *
 * Esta capa solo se encarga de montar el editor de bloques y devolver el
 * workspace. No sabe nada del simulador: no conoce el motor, ni la física,
 * ni el canvas. Esa separación es la que permite probar el generador
 * (B1.3) sin levantar la simulación completa.
 *
 * El toolbox ya no usa la paleta por defecto de Blockly: ahora lista los
 * bloques del sumo definidos en definitions.ts (B1.2).
 */

const TOOLBOX_SUMO = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Movimiento',
      colour: String(COLOR.movimiento),
      contents: [
        { kind: 'block', type: 'sumo_avanzar' },
        { kind: 'block', type: 'sumo_girar' },
        { kind: 'block', type: 'sumo_detener' },
      ],
    },
    {
      kind: 'category',
      name: 'Sensores',
      colour: String(COLOR.sensores),
      contents: [
        { kind: 'block', type: 'sumo_si_distancia_menor' },
        { kind: 'block', type: 'sumo_si_borde' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      colour: String(COLOR.control),
      contents: [{ kind: 'block', type: 'sumo_repetir_siempre' }],
    },
  ],
};

/** Workspace activo. Lo guardamos para que el generador (B1.3) pueda leerlo. */
let workspace: Blockly.WorkspaceSvg | null = null;

/**
 * Monta el editor de bloques dentro del contenedor indicado.
 *
 * @param contenedor div donde vive el editor. Blockly lo llena por completo,
 *                   así que debe tener alto definido por CSS o no se ve nada.
 */
export function montarEditor(contenedor: HTMLElement): Blockly.WorkspaceSvg {
  workspace = Blockly.inject(contenedor, {
    toolbox: TOOLBOX_SUMO,
    grid: { spacing: 20, length: 3, colour: '#2a2f3a', snap: true },
    zoom: { controls: true, wheel: true, startScale: 0.9 },
    trashcan: true,
    move: { scrollbars: true, drag: true, wheel: true },
  });

  // Blockly mide el contenedor al inyectarse. Si la ventana cambia de tamaño
  // hay que avisarle o el SVG queda del tamaño viejo y los bloques se cortan.
  window.addEventListener('resize', () => {
    if (workspace) Blockly.svgResize(workspace);
  });

  return workspace;
}

/**
 * Devuelve el workspace montado.
 * Lanza error si todavía no se montó, porque trabajar con `null` silencioso
 * esconde el bug hasta mucho después.
 */
export function obtenerWorkspace(): Blockly.WorkspaceSvg {
  if (!workspace) {
    throw new Error('El editor de bloques no está montado. Llama a montarEditor() primero.');
  }
  return workspace;
}
