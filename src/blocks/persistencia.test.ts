import { describe, expect, test } from 'vitest';
import * as Blockly from 'blockly';
import './definitions.ts';
import { generarPrograma } from './generator.ts';
import {
  aTexto,
  cargar,
  claveDe,
  crearAutoguardado,
  desdeTexto,
  guardar,
  PREFIJO_GUARDADO,
  serializar,
  type Almacen,
  type Programador,
} from './persistencia.ts';

/**
 * Tests del guardado (C2).
 *
 * El almacen se inyecta, asi que no hace falta navegador ni localStorage:
 * un Map alcanza. Eso permite ademas probar los casos que en un navegador
 * real son dificiles de provocar, como que escribir lance una excepcion.
 */

/** La clave con la que trabajan los tests que solo usan un editor. */
const CLAVE = claveDe('rojo');

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

describe('la clave de cada editor', () => {
  test('dos editores distintos dan claves distintas', () => {
    expect(claveDe('rojo')).not.toBe(claveDe('azul'));
  });

  test('la clave lleva el prefijo del proyecto', () => {
    // Para no pisar lo que otra pagina del mismo dominio haya guardado.
    expect(claveDe('rojo').startsWith(PREFIJO_GUARDADO)).toBe(true);
  });
});

describe('guardar en el navegador', () => {
  test('guarda y recupera el programa', () => {
    const almacen = almacenFalso();
    const original = workspaceConPrograma();

    expect(guardar(original, almacen, CLAVE)).toBe(true);

    const copia = new Blockly.Workspace();
    expect(cargar(copia, almacen, CLAVE)).toBe(true);
    expect(generarPrograma(copia).programa).toEqual(generarPrograma(original).programa);
  });

  test('los dos editores no se pisan en el mismo almacen', () => {
    // El motivo de que la clave sea un parametro: con una sola constante,
    // guardar el azul borraba el programa del rojo.
    const almacen = almacenFalso();

    const rojo = workspaceConPrograma();
    const azul = new Blockly.Workspace();
    azul.newBlock('sumo_detener');

    guardar(rojo, almacen, claveDe('rojo'));
    guardar(azul, almacen, claveDe('azul'));

    const copiaRojo = new Blockly.Workspace();
    const copiaAzul = new Blockly.Workspace();
    expect(cargar(copiaRojo, almacen, claveDe('rojo'))).toBe(true);
    expect(cargar(copiaAzul, almacen, claveDe('azul'))).toBe(true);

    expect(generarPrograma(copiaRojo).programa).toEqual(generarPrograma(rojo).programa);
    expect(generarPrograma(copiaAzul).programa).toEqual(generarPrograma(azul).programa);

    // Y de paso: que los dos programas sean distintos de verdad, porque si
    // fueran iguales el test pasaria incluso con la constante unica.
    expect(generarPrograma(copiaAzul).programa).not.toEqual(generarPrograma(rojo).programa);
  });

  test('un almacen vacio no carga nada y no revienta', () => {
    const ws = new Blockly.Workspace();

    expect(cargar(ws, almacenFalso(), CLAVE)).toBe(false);
    expect(ws.getTopBlocks(true)).toHaveLength(0);
  });

  test('un guardado con basura se descarta y se empieza en blanco', () => {
    // El caso de alguien que edito el localStorage a mano, o de un programa
    // guardado por una version donde un bloque se llamaba distinto.
    const almacen = almacenFalso({ [CLAVE]: 'esto no es JSON {{{' });
    const ws = new Blockly.Workspace();

    expect(cargar(ws, almacen, CLAVE)).toBe(false);
    expect(ws.getTopBlocks(true)).toHaveLength(0);
  });

  test('el guardado corrupto se borra, para no reintentarlo en cada carga', () => {
    const almacen = almacenFalso({ [CLAVE]: 'basura' });
    cargar(new Blockly.Workspace(), almacen, CLAVE);

    expect(almacen.getItem(CLAVE)).toBeNull();
  });

  test('borrar el guardado de un editor no toca el del otro', () => {
    // Importa porque el descarte del corrupto usa removeItem: si borrara de
    // mas, abrir la pagina con el rojo roto te dejaria sin el azul.
    const almacen = almacenFalso({ [claveDe('rojo')]: 'basura' });
    guardar(workspaceConPrograma(), almacen, claveDe('azul'));

    cargar(new Blockly.Workspace(), almacen, claveDe('rojo'));

    expect(almacen.getItem(claveDe('azul'))).not.toBeNull();
  });

  test('un almacen que lanza no rompe la pagina', () => {
    // Modo incognito, cuota llena, o el usuario bloqueo el almacenamiento.
    const roto = almacenRoto();

    expect(guardar(workspaceConPrograma(), roto, CLAVE)).toBe(false);
    expect(cargar(new Blockly.Workspace(), roto, CLAVE)).toBe(false);
  });
});

/**
 * Un reloj de mentira: en vez de esperar de verdad, el test avanza el
 * tiempo a mano. Asi la prueba es instantanea y no depende de la maquina.
 */
function relojFalso(): Programador & { avanzar(ms: number): void } {
  let ahora = 0;
  let siguienteId = 1;
  const pendientes = new Map<number, { cuando: number; fn: () => void }>();

  return {
    setTimeout(fn, ms) {
      const id = siguienteId++;
      pendientes.set(id, { cuando: ahora + ms, fn });
      return id;
    },
    clearTimeout(id) {
      pendientes.delete(id as number);
    },
    avanzar(ms) {
      ahora += ms;
      for (const [id, p] of [...pendientes]) {
        if (p.cuando <= ahora) {
          pendientes.delete(id);
          p.fn();
        }
      }
    },
  };
}

describe('autoguardado', () => {
  test('no guarda en el acto: espera a que pase el retardo', () => {
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    auto.pedir();
    expect(veces).toBe(0);

    reloj.avanzar(499);
    expect(veces).toBe(0);

    reloj.avanzar(1);
    expect(veces).toBe(1);
  });

  test('muchos cambios seguidos se guardan una sola vez', () => {
    // Arrastrar un bloque dispara un evento por cada movimiento del raton.
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    for (let i = 0; i < 50; i++) {
      auto.pedir();
      reloj.avanzar(10);
    }
    reloj.avanzar(500);

    expect(veces).toBe(1);
  });

  test('cada cambio reinicia la espera', () => {
    // Si no, un cambio constante guardaria cada 500 ms en vez de al parar.
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    auto.pedir();
    reloj.avanzar(400);
    auto.pedir();
    reloj.avanzar(400); // 800 ms desde el primero, 400 desde el ultimo
    expect(veces).toBe(0);

    reloj.avanzar(100);
    expect(veces).toBe(1);
  });

  test('dos tandas separadas guardan dos veces', () => {
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    auto.pedir();
    reloj.avanzar(500);
    auto.pedir();
    reloj.avanzar(500);

    expect(veces).toBe(2);
  });

  test('vaciar guarda ya lo pendiente y no lo repite despues', () => {
    // Para cuando el usuario cierra la pestaña antes de que venza la espera.
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    auto.pedir();
    auto.vaciar();
    expect(veces).toBe(1);

    reloj.avanzar(1000);
    expect(veces).toBe(1);
  });

  test('vaciar sin nada pendiente no guarda', () => {
    const reloj = relojFalso();
    let veces = 0;
    const auto = crearAutoguardado(() => veces++, 500, reloj);

    auto.vaciar();

    expect(veces).toBe(0);
  });
});

describe('abrir un archivo que no sirve', () => {
  // Abrir el archivo equivocado no puede costarle al usuario el programa
  // que tenia en el editor: un error se avisa, pero no se paga con datos.

  test('un JSON valido que no es un programa no borra lo que habia', () => {
    const ws = workspaceConPrograma();
    const antes = generarPrograma(ws).programa;

    const ajeno = JSON.stringify({
      blocks: { languageVersion: 0, blocks: [{ type: 'bloque_que_no_existe', x: 0, y: 0 }] },
    });

    expect(desdeTexto(ajeno, ws)).toBe(false);
    expect(generarPrograma(ws).programa).toEqual(antes);
  });

  test('un JSON que ni siquiera es un objeto tampoco lo borra', () => {
    const ws = workspaceConPrograma();
    const antes = generarPrograma(ws).programa;

    expect(desdeTexto('null', ws)).toBe(false);
    expect(desdeTexto('42', ws)).toBe(false);
    expect(generarPrograma(ws).programa).toEqual(antes);
  });

  test('un texto que no es JSON no toca el editor', () => {
    const ws = workspaceConPrograma();
    const antes = generarPrograma(ws).programa;

    expect(desdeTexto('esto no es JSON {{{', ws)).toBe(false);
    expect(generarPrograma(ws).programa).toEqual(antes);
  });
});

describe('lo que no es un programa de bloques', () => {
  // José abrio el package.json del proyecto con "Abrir": Blockly no lanzo
  // nada, vacio el editor, y el autoguardado guardo el vacio encima. Blockly
  // IGNORA en silencio las claves que no conoce, asi que "no lanza" no
  // quiere decir "era un programa". Hay que mirar las claves.

  /** El texto se rechaza y el programa que habia queda como estaba. */
  function seRechazaSinTocar(valor: unknown): void {
    const ws = workspaceConPrograma();
    const antes = generarPrograma(ws).programa;

    expect(desdeTexto(JSON.stringify(valor), ws)).toBe(false);
    expect(generarPrograma(ws).programa).toEqual(antes);
  }

  test('el contenido de un package.json no es un programa', () => {
    seRechazaSinTocar({
      name: 'sumo-sim',
      version: '0.0.0',
      scripts: { test: 'vitest run' },
    });
  });

  test('un arreglo vacio no es un programa', () => {
    // En JavaScript un arreglo es un objeto: `typeof [] === 'object'`.
    seRechazaSinTocar([]);
  });

  test('un arreglo con cosas dentro tampoco', () => {
    seRechazaSinTocar([{ blocks: { blocks: [] } }]);
  });

  test('una clave de programa mezclada con otra ajena se rechaza', () => {
    // Un archivo de verdad solo tiene claves que Blockly conoce. Una de mas
    // dice que alguien lo toco a mano o que viene de otra herramienta.
    const programa = serializar(workspaceConPrograma());

    seRechazaSinTocar({ ...programa, name: 'sumo-sim' });
  });

  test('un editor vacio guardado se puede volver a cargar', () => {
    // El contrapeso de los tests de arriba: un editor sin bloques se guarda
    // como `{}`, y `{}` no puede contar como archivo ajeno, o el usuario no
    // podria recuperar un editor que dejo en blanco a proposito.
    const almacen = almacenFalso();
    guardar(new Blockly.Workspace(), almacen, CLAVE);

    const ws = workspaceConPrograma();

    expect(cargar(ws, almacen, CLAVE)).toBe(true);
    expect(ws.getTopBlocks(false)).toHaveLength(0);
  });

  test('un programa de verdad sigue cargando', () => {
    const original = workspaceConPrograma();
    const copia = new Blockly.Workspace();

    expect(desdeTexto(aTexto(original), copia)).toBe(true);
    expect(generarPrograma(copia).programa).toEqual(generarPrograma(original).programa);
  });
});
