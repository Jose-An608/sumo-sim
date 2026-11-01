import { describe, expect, test } from 'vitest';
import * as Blockly from 'blockly';
import './definitions.ts';
import { generarPrograma } from './generator.ts';
import {
  aTexto,
  cargar,
  CLAVE_GUARDADO,
  desdeTexto,
  guardar,
  type Almacen,
} from './persistencia.ts';

/**
 * Tests del guardado (C2).
 *
 * El almacen se inyecta, asi que no hace falta navegador ni localStorage:
 * un Map alcanza. Eso permite ademas probar los casos que en un navegador
 * real son dificiles de provocar, como que escribir lance una excepcion.
 */

/** Un localStorage de mentira. */
function almacenFalso(inicial: Record<string, string> = {}): Almacen {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (c) => datos.get(c) ?? null,
    setItem: (c, v) => void datos.set(c, v),
    removeItem: (c) => void datos.delete(c),
  };
}

/** Un almacen que falla siempre, como el de una pestaña de incognito. */
function almacenRoto(): Almacen {
  return {
    getItem() {
      throw new Error('acceso denegado');
    },
    setItem() {
      throw new Error('cuota excedida');
    },
    removeItem() {
      throw new Error('acceso denegado');
    },
  };
}

/** Arma un programa de ejemplo con un bloque anidado. */
function workspaceConPrograma(): Blockly.Workspace {
  const ws = new Blockly.Workspace();

  const bucle = ws.newBlock('sumo_repetir_siempre');
  const si = ws.newBlock('sumo_si_distancia_menor');
  si.setFieldValue('25', 'UMBRAL');
  const avanzar = ws.newBlock('sumo_avanzar');
  avanzar.setFieldValue('35', 'VELOCIDAD');
  avanzar.setFieldValue('2', 'DURACION');

  bucle.getInput('CUERPO')!.connection!.connect(si.previousConnection!);
  si.getInput('ENTONCES')!.connection!.connect(avanzar.previousConnection!);

  return ws;
}

describe('ida y vuelta', () => {
  test('un programa guardado y cargado compila igual que el original', () => {
    // Esta es la prueba que de verdad importa: no comparamos el JSON, que
    // podria cambiar de forma entre versiones de Blockly, sino el programa
    // compilado, que es lo unico que la VM va a ejecutar.
    const original = workspaceConPrograma();
    const esperado = generarPrograma(original).programa;

    const copia = new Blockly.Workspace();
    expect(desdeTexto(aTexto(original), copia)).toBe(true);

    expect(generarPrograma(copia).programa).toEqual(esperado);
  });

  test('conserva los valores de los campos', () => {
    const original = workspaceConPrograma();
    const copia = new Blockly.Workspace();
    desdeTexto(aTexto(original), copia);

    const programa = generarPrograma(copia).programa;

    expect(programa).toEqual([
      {
        tipo: 'repetirSiempre',
        cuerpo: [
          {
            tipo: 'siDistanciaMenor',
            umbral: 25,
            entonces: [{ tipo: 'avanzar', velocidad: 35, duracionMs: 2000 }],
          },
        ],
      },
    ]);
  });
});

describe('guardar en el navegador', () => {
  test('guarda y recupera el programa', () => {
    const almacen = almacenFalso();
    const original = workspaceConPrograma();

    expect(guardar(original, almacen)).toBe(true);

    const copia = new Blockly.Workspace();
    expect(cargar(copia, almacen)).toBe(true);
    expect(generarPrograma(copia).programa).toEqual(generarPrograma(original).programa);
  });

  test('un almacen vacio no carga nada y no revienta', () => {
    const ws = new Blockly.Workspace();

    expect(cargar(ws, almacenFalso())).toBe(false);
    expect(ws.getTopBlocks(true)).toHaveLength(0);
  });

  test('un guardado con basura se descarta y se empieza en blanco', () => {
    // El caso de alguien que edito el localStorage a mano, o de un programa
    // guardado por una version donde un bloque se llamaba distinto.
    const almacen = almacenFalso({ [CLAVE_GUARDADO]: 'esto no es JSON {{{' });
    const ws = new Blockly.Workspace();

    expect(cargar(ws, almacen)).toBe(false);
    expect(ws.getTopBlocks(true)).toHaveLength(0);
  });

  test('el guardado corrupto se borra, para no reintentarlo en cada carga', () => {
    const almacen = almacenFalso({ [CLAVE_GUARDADO]: 'basura' });
    cargar(new Blockly.Workspace(), almacen);

    expect(almacen.getItem(CLAVE_GUARDADO)).toBeNull();
  });

  test('un almacen que lanza no rompe la pagina', () => {
    // Modo incognito, cuota llena, o el usuario bloqueo el almacenamiento.
    const roto = almacenRoto();

    expect(guardar(workspaceConPrograma(), roto)).toBe(false);
    expect(cargar(new Blockly.Workspace(), roto)).toBe(false);
  });
});
