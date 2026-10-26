import * as Blockly from 'blockly';

/**
 * B1.1 — Integración de Blockly.
 *
 * Esta capa solo se encarga de montar el editor de bloques y devolver el
 * workspace. No sabe nada del simulador: no conoce el motor, ni la física,
 * ni el canvas. Esa separación es la que permite probar el generador
 * (B1.3) sin levantar la simulación completa.
 *
 * El toolbox de abajo es TEMPORAL: es la paleta por defecto de Blockly,
 * suficiente para cumplir el criterio de aceptación de B1.1 ("aparece el
 * área de bloques con la paleta por defecto"). En B1.2 se reemplaza por las
 * tres categorías del sumo: Movimiento, Sensores y Control.
 */

const TOOLBOX_PROVISIONAL = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Lógica',
      colour: '210',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_boolean' },
      ],
    },
    {
      kind: 'category',
      name: 'Bucles',
      colour: '120',
      contents: [
        { kind: 'block', type: 'controls_repeat_ext' },
        { kind: 'block', type: 'controls_whileUntil' },
      ],
    },
    {
      kind: 'category',
      name: 'Matemática',
      colour: '230',
      contents: [
        { kind: 'block', type: 'math_number' },
        { kind: 'block', type: 'math_arithmetic' },
      ],
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
    toolbox: TOOLBOX_PROVISIONAL,
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
