import * as Blockly from 'blockly';

/**
 * B1.2 — Definiciones de los bloques del sumo.
 *
 * Aqui solo se describe COMO SE VE y COMO ENCAJA cada bloque. La traduccion
 * a `Instruccion[]` vive en generator.ts (B1.3). Mantenerlos separados
 * permite cambiar la apariencia de un bloque sin tocar el compilador.
 *
 * Dos decisiones que condicionan el generador:
 *
 * 1. Usamos CAMPOS (`field_number`, `field_dropdown`), no entradas de valor.
 *    El contrato define `velocidad: number`, un numero literal, no una
 *    expresion. Con entradas de valor el usuario podria encajar un bloque
 *    `3 + 4` y el generador no tendria como representarlo en `Instruccion`.
 *    Con campos, construir un programa invalido es imposible.
 *
 * 2. La velocidad va en cm/s, no en porcentaje. `Orden` define vL y vR en
 *    cm/s; si el bloque hablara en porcentaje alguien tendria que inventar
 *    la conversion, y esa regla no esta en el contrato.
 *
 * Los nombres de campo en MAYUSCULAS (VELOCIDAD, GRADOS) son la convencion
 * de Blockly y son la clave con la que el generador los lee:
 * `bloque.getFieldValue('VELOCIDAD')`.
 */

/** Color de cada categoria. Blockly usa el matiz HSV (0-360). */
export const COLOR = {
  movimiento: 210, // azul
  sensores: 40, // naranja
  control: 120, // verde
} as const;

Blockly.defineBlocksWithJsonArray([
  // ---------------------------------------------------------------- avanzar
  {
    type: 'sumo_avanzar',
    message0: 'avanzar a %1 cm/s durante %2 s',
    args0: [
      {
        type: 'field_number',
        name: 'VELOCIDAD',
        value: 20,
        min: -50,
        max: 50,
      },
      {
        type: 'field_number',
        name: 'DURACION',
        value: 1,
        min: 0,
        max: 60,
        precision: 0.1,
      },
    ],
    // previousStatement y nextStatement convierten al bloque en una
    // SENTENCIA: se apila arriba y abajo de otras, como una linea de
    // programa. Sin esto el bloque flotaria suelto sin poder encadenarse.
    previousStatement: null,
    nextStatement: null,
    colour: COLOR.movimiento,
    tooltip:
      'Mueve las dos ruedas a la misma velocidad durante el tiempo indicado. ' +
      'Velocidad negativa = retrocede.',
  },

  // ------------------------------------------------------------------ girar
  {
    type: 'sumo_girar',
    message0: 'girar %1 grados a %2 cm/s',
    args0: [
      {
        type: 'field_number',
        name: 'GRADOS',
        value: 90,
        min: -360,
        max: 360,
      },
      {
        type: 'field_number',
        name: 'VELOCIDAD',
        value: 15,
        min: 1,
        max: 50,
      },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLOR.movimiento,
    tooltip:
      'Gira sobre su propio eje: una rueda adelante y la otra atras. ' +
      'Positivo = horario. El tiempo que tarda lo calcula el motor.',
  },

  // ---------------------------------------------------------------- detener
  {
    type: 'sumo_detener',
    message0: 'detener',
    previousStatement: null,
    nextStatement: null,
    colour: COLOR.movimiento,
    tooltip: 'Pone las dos ruedas a 0 cm/s.',
  },

  // ------------------------------------------------- si distancia menor que
  {
    type: 'sumo_si_distancia_menor',
    message0: 'si la distancia al rival es menor que %1 cm',
    args0: [
      {
        type: 'field_number',
        name: 'UMBRAL',
        value: 15,
        min: 1,
        // Topado en 77 cm: es el diametro del ring (RING.radio = 38.5).
        // Dos robots dentro del ring nunca pueden estar mas lejos que eso,
        // asi que permitir mas solo deja pedir una condicion imposible.
        max: 77,
      },
    ],
    // message1 es una segunda linea del bloque. `input_statement` es el
    // hueco en forma de C donde entran otros bloques: no es un valor, es
    // otra secuencia de programa. Se corresponde con `entonces: Instruccion[]`
    // del contrato.
    message1: 'entonces %1',
    args1: [{ type: 'input_statement', name: 'ENTONCES' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOR.sensores,
    tooltip:
      'El ultrasonido solo ve dentro de un cono al frente. Si el rival esta ' +
      'al costado, devuelve Infinity y esta condicion es falsa.',
  },

  // ------------------------------------------------------- si detecta borde
  {
    type: 'sumo_si_borde',
    message0: 'si detecta borde %1',
    args0: [
      {
        type: 'field_dropdown',
        name: 'LADO',
        // [etiqueta visible, valor guardado]. Los valores son EXACTAMENTE
        // los literales del contrato ('izq' | 'der' | 'cualquiera'), para
        // que el generador los pase tal cual sin traducir nada.
        options: [
          ['por cualquier lado', 'cualquiera'],
          ['por la izquierda', 'izq'],
          ['por la derecha', 'der'],
        ],
      },
    ],
    message1: 'entonces %1',
    args1: [{ type: 'input_statement', name: 'ENTONCES' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOR.sensores,
    tooltip:
      'El sensor de color detecta la franja blanca del borde del ring. ' +
      'Es la condicion que evita que el robot se salga solo.',
  },

  // --------------------------------------------------------- repetir siempre
  {
    type: 'sumo_repetir_siempre',
    message0: 'repetir siempre',
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'CUERPO' }],
    previousStatement: null,
    // OJO: `nextStatement` esta OMITIDO a proposito, no puesto en null.
    // En Blockly, `"nextStatement": null` SI crea el conector (null = acepta
    // cualquier tipo). Omitir la clave es lo que lo elimina.
    //
    // Sin conector inferior, es imposible apilar bloques despues de un bucle
    // infinito. Si se pudiera, esos bloques nunca se ejecutarian: seria
    // codigo muerto que la propia interfaz invita a escribir.
    colour: COLOR.control,
    tooltip:
      'Repite su contenido sin fin. Es el esqueleto de toda estrategia de ' +
      'sumo: mirar, decidir y actuar, una y otra vez.',
  },
]);
