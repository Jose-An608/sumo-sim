import type * as Blockly from 'blockly';
import { desdeTexto } from './persistencia.ts';

/**
 * C3 — Estrategias de ejemplo.
 *
 * Cada ejemplo es un programa de bloques en el mismo formato JSON que usa
 * Blockly para guardar. Se cargan con `desdeTexto`, el mismo camino que usa
 * "Abrir": asi un ejemplo pasa por las mismas comprobaciones que un archivo
 * del usuario, y no hay una segunda forma de cargar que mantener.
 */

export interface Ejemplo {
  id: string;
  nombre: string;
  descripcion: string;
  /** El programa, en el formato de serializacion de Blockly. */
  programa: object;
}

// --- Ayudas para escribir el JSON sin repetir llaves ----------------------

interface Nodo {
  type: string;
  fields?: Record<string, string | number>;
  inputs?: Record<string, { block: object }>;
  next?: { block: object };
}

/** Un bloque con campos, sin nada anidado. */
function bloque(type: string, fields: Record<string, string | number> = {}): Nodo {
  return { type, fields };
}

/** Une los bloques uno tras otro: cada uno es el `next` del anterior. */
function secuencia(...bloques: Nodo[]): Nodo {
  const [primero, ...resto] = bloques;
  if (resto.length === 0) return primero;
  return { ...primero, next: { block: secuencia(...resto) } };
}

/** Un `si` con su cuerpo dentro del hueco ENTONCES. */
function si(type: string, fields: Record<string, string | number>, entonces: Nodo): Nodo {
  return { type, fields, inputs: { ENTONCES: { block: entonces } } };
}

/** El bucle principal: todos los ejemplos son un `repetir siempre`. */
function bucle(...cuerpo: Nodo[]): object {
  return {
    blocks: {
      languageVersion: 0,
      blocks: [{ type: 'sumo_repetir_siempre', inputs: { CUERPO: { block: secuencia(...cuerpo) } } }],
    },
  };
}

// --- Piezas comunes --------------------------------------------------------

/**
 * Distancia (cm) a la que consideramos que el rival esta "cerca".
 *
 * El ultrasonido mide de CENTRO a CENTRO (sensors.ts), no hasta la
 * superficie: dos robots pegados ya marcan 18 cm, y al arrancar enfrentados
 * marcan unos 40. Con un umbral de 30 los ejemplos no veian al rival y se
 * quedaban girando; lo descubrio el test de combate. El ring mide 77 cm, asi
 * que 50 cubre casi todo lo que puede estar delante.
 */
const CERCA = 50;

/**
 * Embestir: a tope de motor, en tramos cortos para volver a mirar.
 *
 * OJO: no hay "si no". El giro de busqueda que viene despues en el bucle se
 * ejecuta tambien tras embestir. Si ese giro supera el cono del ultrasonido
 * (+-15 grados), el robot pierde al rival en pleno empuje. Por eso los giros
 * de los ejemplos son chicos o muy rapidos.
 */
const embestir = (): Nodo => si('sumo_si_distancia_menor', { UMBRAL: CERCA }, bloque('sumo_avanzar', { VELOCIDAD: 50, DURACION: 0.2 }));

/** Al ver el borde, retroceder antes de seguir. */
const retroceder = (): Nodo => si('sumo_si_borde', { LADO: 'cualquiera' }, bloque('sumo_avanzar', { VELOCIDAD: -20, DURACION: 0.5 }));

export const EJEMPLOS: Ejemplo[] = [
  {
    id: 'guardian-borde',
    nombre: 'Guardián del borde',
    descripcion:
      'Lo primero que mira es el borde: si lo ve, retrocede. Después embiste si el rival está cerca; si no, gira en el sitio buscándolo. Seguro, no el más rápido.',
    programa: bucle(retroceder(), embestir(), bloque('sumo_girar', { GRADOS: 12, VELOCIDAD: 15 })),
  },
  {
    id: 'embestidor',
    nombre: 'Embestidor',
    descripcion:
      'Gira rápido hasta ver al rival y entonces carga a todo motor. No mira el borde: es su punto débil y la razón de que pueda perder solo.',
    programa: bucle(embestir(), bloque('sumo_girar', { GRADOS: 25, VELOCIDAD: 30 })),
  },
  {
    id: 'buscador-paciente',
    nombre: 'Buscador paciente',
    descripcion:
      'Barre despacio, así no se pasa de largo del rival, y cuida el borde. Tarda más en encontrarlo pero casi nunca se sale.',
    programa: bucle(embestir(), retroceder(), bloque('sumo_girar', { GRADOS: 10, VELOCIDAD: 8 })),
  },
];

/**
 * Reemplaza el contenido del editor con un ejemplo.
 *
 * @returns true si se cargó; false si el id no existe (el editor queda intacto).
 */
export function cargarEjemplo(id: string, workspace: Blockly.Workspace): boolean {
  const ejemplo = EJEMPLOS.find((e) => e.id === id);
  if (!ejemplo) return false;
  return desdeTexto(JSON.stringify(ejemplo.programa), workspace);
}
