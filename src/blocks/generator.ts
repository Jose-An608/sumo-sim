import type * as Blockly from 'blockly';
import type { Instruccion } from '../types.ts';

/**
 * B1.3 — El generador (compilador de bloques a instrucciones).
 *
 * Recorre el workspace de Blockly y produce un `Instruccion[]` segun el
 * contrato de types.ts.
 *
 * POR QUE NO GENERAMOS JAVASCRIPT: Blockly trae generadores que producen
 * codigo JS y la tentacion es ejecutarlo con eval(). No lo hacemos por dos
 * razones. La primera es de seguridad. La segunda, mas importante: un
 * programa en JS se ejecuta de corrido, asi que el robot haria todo su
 * combate en un instante. Necesitamos una estructura de datos que la VM
 * pueda ejecutar paso a paso, pausar e inspeccionar.
 *
 * LA RECURSION TIENE DOS EJES, y confundirlos es el error clasico:
 *
 *   - "el siguiente" (getNextBlock): el bloque apilado DEBAJO, en la misma
 *     secuencia. Son hermanos.
 *   - "el anidado" (getInputTargetBlock): los bloques DENTRO de un `si` o un
 *     `repetir`. Son hijos.
 *
 * Por eso hay dos funciones que se llaman entre si: `compilarPila` avanza
 * por la cadena de hermanos, `compilarBloque` traduce uno solo y, cuando es
 * contenedor, vuelve a llamar a `compilarPila` con su contenido. Cada una
 * tiene una sola responsabilidad y la recursion queda en un punto unico.
 */

export interface ResultadoCompilacion {
  /** El programa listo para la VM. */
  programa: Instruccion[];
  /**
   * Avisos para mostrarle al usuario. No son errores: el programa es
   * valido, pero hay algo que conviene que sepa (por ejemplo, bloques
   * sueltos que no se van a ejecutar).
   */
  advertencias: string[];
}

/**
 * Compila el workspace completo.
 *
 * En Blockly nada obliga a tener un solo programa: puede haber una pila
 * principal y, al costado, bloques olvidados sin conectar. Tomamos la
 * primera pila como el programa y AVISAMOS del resto, en vez de ejecutarlos
 * a escondidas o descartarlos en silencio.
 */
export function generarPrograma(workspace: Blockly.Workspace): ResultadoCompilacion {
  const advertencias: string[] = [];

  // `true` los ordena por posicion en pantalla, de arriba a abajo, para que
  // el resultado no dependa del orden en que se crearon los bloques.
  const pilas = workspace.getTopBlocks(true);

  if (pilas.length === 0) {
    return { programa: [], advertencias: ['El programa esta vacio.'] };
  }

  const sueltas = pilas.length - 1;
  if (sueltas > 0) {
    advertencias.push(
      `Hay ${sueltas} grupo(s) de bloques sueltos que no se van a ejecutar. ` +
        'Conectalos al programa principal o borralos.',
    );
  }

  return { programa: compilarPila(pilas[0]), advertencias };
}

/** Recorre una cadena de bloques hermanos y los traduce en orden. */
function compilarPila(bloque: Blockly.Block | null): Instruccion[] {
  const instrucciones: Instruccion[] = [];

  let actual = bloque;
  while (actual) {
    instrucciones.push(compilarBloque(actual));
    actual = actual.getNextBlock();
  }

  return instrucciones;
}

/** Traduce UN bloque a una instruccion. */
function compilarBloque(bloque: Blockly.Block): Instruccion {
  switch (bloque.type) {
    case 'sumo_avanzar':
      return {
        tipo: 'avanzar',
        velocidad: numero(bloque, 'VELOCIDAD'),
        // El bloque habla en segundos porque es lo natural para el usuario;
        // el contrato habla en milisegundos. La conversion vive aqui.
        duracionMs: numero(bloque, 'DURACION') * 1000,
      };

    case 'sumo_girar':
      // Sin duracion a proposito: el contrato define
      // { grados, velocidad }. Cuanto tarda el giro lo deduce la VM a
      // partir del anchoEje, porque depende de la geometria del robot.
      return {
        tipo: 'girar',
        grados: numero(bloque, 'GRADOS'),
        velocidad: numero(bloque, 'VELOCIDAD'),
      };

    case 'sumo_detener':
      return { tipo: 'detener' };

    // --- Contenedores: aqui aparece la recursion -----------------------
    //
    // `compilarBloque` vuelve a llamar a `compilarPila` con el contenido
    // del hueco. Esa llamada es la que convierte el programa plano en un
    // arbol, y la que hace que un `si` dentro de un `repetir` funcione sin
    // ningun codigo especial: cada nivel se resuelve igual que el anterior.

    case 'sumo_si_distancia_menor':
      return {
        tipo: 'siDistanciaMenor',
        umbral: numero(bloque, 'UMBRAL'),
        entonces: compilarContenido(bloque, 'ENTONCES'),
      };

    case 'sumo_si_borde':
      return {
        tipo: 'siBorde',
        // El dropdown ya guarda los literales del contrato, asi que no hay
        // nada que traducir: se pasa tal cual.
        lado: bloque.getFieldValue('LADO') as 'izq' | 'der' | 'cualquiera',
        entonces: compilarContenido(bloque, 'ENTONCES'),
      };

    case 'sumo_repetir_siempre':
      return {
        tipo: 'repetirSiempre',
        cuerpo: compilarContenido(bloque, 'CUERPO'),
      };

    default:
      throw new Error(`Bloque sin compilar: ${bloque.type}`);
  }
}

/**
 * Compila lo que hay DENTRO de un hueco (el input de sentencia).
 *
 * `getInputTargetBlock` devuelve solo el PRIMER bloque anidado; los demas
 * cuelgan de el como hermanos. Por eso el resultado se pasa a
 * `compilarPila`, que recorre la cadena completa.
 *
 * Si el hueco esta vacio devuelve null, y `compilarPila` responde con una
 * lista vacia. Un contenedor sin contenido es valido: es lo que pasa en
 * cuanto el usuario arrastra el bloque y todavia no le puso nada dentro.
 */
function compilarContenido(bloque: Blockly.Block, hueco: string): Instruccion[] {
  return compilarPila(bloque.getInputTargetBlock(hueco));
}

/** Lee un campo numerico. Blockly devuelve los campos como texto. */
function numero(bloque: Blockly.Block, campo: string): number {
  return Number(bloque.getFieldValue(campo));
}
