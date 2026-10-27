import { describe, expect, test } from 'vitest';
import * as Blockly from 'blockly';
import './definitions.ts';
import { generarPrograma } from './generator.ts';

/**
 * Tests del generador (B1.4, issue #10).
 *
 * Se escriben ANTES de la implementacion: primero rojo, despues verde.
 *
 * Lo valioso de estos tests es que construyen el programa de bloques por
 * codigo, sin navegador ni arrastrar nada con el mouse. Blockly permite
 * crear un workspace sin DOM, asi que corren rapido y dan siempre el mismo
 * resultado.
 */

/** Crea un workspace vacio, sin interfaz grafica. */
function nuevoWorkspace(): Blockly.Workspace {
  return new Blockly.Workspace();
}

/** Crea un bloque y le pone los campos indicados. */
function crearBloque(
  ws: Blockly.Workspace,
  tipo: string,
  campos: Record<string, string | number> = {},
): Blockly.Block {
  const bloque = ws.newBlock(tipo);
  for (const [nombre, valor] of Object.entries(campos)) {
    bloque.setFieldValue(String(valor), nombre);
  }
  return bloque;
}

/** Mete `hijo` DENTRO de `contenedor`, en el hueco indicado. */
function anidar(contenedor: Blockly.Block, hueco: string, hijo: Blockly.Block): void {
  contenedor.getInput(hueco)!.connection!.connect(hijo.previousConnection!);
}

/** Apila `siguiente` DEBAJO de `bloque`, como hermanos. */
function encadenar(bloque: Blockly.Block, siguiente: Blockly.Block): void {
  bloque.nextConnection!.connect(siguiente.previousConnection!);
}

describe('generarPrograma', () => {
  test('un bloque avanzar produce una instruccion avanzar', () => {
    const ws = nuevoWorkspace();
    crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 20, DURACION: 2 });

    const { programa, advertencias } = generarPrograma(ws);

    expect(programa).toEqual([
      { tipo: 'avanzar', velocidad: 20, duracionMs: 2000 },
    ]);
    expect(advertencias).toEqual([]);
  });

  test('girar lleva grados y velocidad, sin duracion', () => {
    const ws = nuevoWorkspace();
    crearBloque(ws, 'sumo_girar', { GRADOS: 90, VELOCIDAD: 15 });

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([{ tipo: 'girar', grados: 90, velocidad: 15 }]);
  });

  test('detener no lleva parametros', () => {
    const ws = nuevoWorkspace();
    crearBloque(ws, 'sumo_detener');

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([{ tipo: 'detener' }]);
  });

  test('los bloques encadenados salen en el orden en que estan apilados', () => {
    const ws = nuevoWorkspace();
    const primero = crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 20, DURACION: 1 });
    const segundo = crearBloque(ws, 'sumo_girar', { GRADOS: 90, VELOCIDAD: 15 });
    const tercero = crearBloque(ws, 'sumo_detener');

    primero.nextConnection!.connect(segundo.previousConnection!);
    segundo.nextConnection!.connect(tercero.previousConnection!);

    const { programa } = generarPrograma(ws);

    expect(programa.map((i) => i.tipo)).toEqual(['avanzar', 'girar', 'detener']);
  });
});

describe('anidamiento', () => {
  test('un si guarda sus bloques internos en entonces', () => {
    const ws = nuevoWorkspace();
    const si = crearBloque(ws, 'sumo_si_distancia_menor', { UMBRAL: 15 });
    const dentro1 = crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 30, DURACION: 1 });
    const dentro2 = crearBloque(ws, 'sumo_detener');

    anidar(si, 'ENTONCES', dentro1);
    encadenar(dentro1, dentro2);

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([
      {
        tipo: 'siDistanciaMenor',
        umbral: 15,
        entonces: [
          { tipo: 'avanzar', velocidad: 30, duracionMs: 1000 },
          { tipo: 'detener' },
        ],
      },
    ]);
  });

  test('si detecta borde usa los literales del contrato', () => {
    const ws = nuevoWorkspace();
    const si = crearBloque(ws, 'sumo_si_borde', { LADO: 'izq' });
    anidar(si, 'ENTONCES', crearBloque(ws, 'sumo_detener'));

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([
      { tipo: 'siBorde', lado: 'izq', entonces: [{ tipo: 'detener' }] },
    ]);
  });

  test('repetir siempre guarda su contenido en cuerpo', () => {
    const ws = nuevoWorkspace();
    const bucle = crearBloque(ws, 'sumo_repetir_siempre');
    anidar(bucle, 'CUERPO', crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 20, DURACION: 1 }));

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([
      {
        tipo: 'repetirSiempre',
        cuerpo: [{ tipo: 'avanzar', velocidad: 20, duracionMs: 1000 }],
      },
    ]);
  });

  test('un bloque DESPUES de un si NO queda dentro del si', () => {
    // Este es el test que atrapa el bug clasico: confundir "el siguiente"
    // (hermano) con "el anidado" (hijo). Si se mezclan, el `detener` de
    // abajo terminaria dentro del `entonces` y se ejecutaria solo cuando
    // la condicion fuera verdadera.
    const ws = nuevoWorkspace();
    const si = crearBloque(ws, 'sumo_si_distancia_menor', { UMBRAL: 20 });
    anidar(si, 'ENTONCES', crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 30, DURACION: 1 }));
    encadenar(si, crearBloque(ws, 'sumo_detener'));

    const { programa } = generarPrograma(ws);

    expect(programa).toHaveLength(2);
    expect(programa[0].tipo).toBe('siDistanciaMenor');
    expect(programa[1]).toEqual({ tipo: 'detener' });
  });

  test('soporta un si dentro de un repetir siempre', () => {
    const ws = nuevoWorkspace();
    const bucle = crearBloque(ws, 'sumo_repetir_siempre');
    const si = crearBloque(ws, 'sumo_si_borde', { LADO: 'cualquiera' });
    anidar(bucle, 'CUERPO', si);
    anidar(si, 'ENTONCES', crearBloque(ws, 'sumo_girar', { GRADOS: 180, VELOCIDAD: 15 }));

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([
      {
        tipo: 'repetirSiempre',
        cuerpo: [
          {
            tipo: 'siBorde',
            lado: 'cualquiera',
            entonces: [{ tipo: 'girar', grados: 180, velocidad: 15 }],
          },
        ],
      },
    ]);
  });

  test('un contenedor vacio produce una lista vacia, no un error', () => {
    const ws = nuevoWorkspace();
    crearBloque(ws, 'sumo_repetir_siempre');

    const { programa } = generarPrograma(ws);

    expect(programa).toEqual([{ tipo: 'repetirSiempre', cuerpo: [] }]);
  });
});

describe('advertencias', () => {
  test('avisa cuando hay bloques sueltos sin conectar', () => {
    const ws = nuevoWorkspace();
    crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 20, DURACION: 1 });
    crearBloque(ws, 'sumo_detener'); // suelto, sin conectar

    const { programa, advertencias } = generarPrograma(ws);

    expect(programa).toHaveLength(1);
    expect(advertencias).toHaveLength(1);
    expect(advertencias[0]).toContain('sueltos');
  });

  test('avisa cuando el lienzo esta vacio', () => {
    const { programa, advertencias } = generarPrograma(nuevoWorkspace());

    expect(programa).toEqual([]);
    expect(advertencias).toEqual(['El programa esta vacio.']);
  });
});
