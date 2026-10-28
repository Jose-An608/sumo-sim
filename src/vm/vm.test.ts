import { describe, expect, test } from 'vitest';
import { VM } from './vm.ts';
import type { ConfiguracionVM } from './vm.ts';
import type { Instruccion, Orden } from '../types.ts';

/**
 * Tests de la maquina virtual (B2.4, issue #29).
 *
 * Lo valioso: la VM se prueba SIN simulador. Le pasamos lecturas de
 * sensores inventadas y comprobamos que ordenes devuelve. No hay canvas,
 * ni fisica, ni bucle de animacion. Esa es la recompensa de haber definido
 * el contrato el primer dia.
 */

/** Configuracion de prueba: los valores reales del robot del equipo. */
const CONFIG: ConfiguracionVM = {
  anchoEje: 12,
  velocidadMax: 50,
  dt: 1 / 60,
};

/** Lecturas de sensores con el rival invisible y ningun borde cerca. */
function sensoresVacios() {
  return {
    distanciaFrontal: Infinity,
    bordeIzquierdo: false,
    bordeDerecho: false,
  };
}

/** Ejecuta n cuadros y devuelve todas las ordenes, en orden. */
function correr(vm: VM, n: number): Orden[] {
  const ordenes: Orden[] = [];
  for (let i = 0; i < n; i++) ordenes.push(vm.step(sensoresVacios()));
  return ordenes;
}

describe('VM', () => {
  test('un programa vacio deja los motores quietos', () => {
    const vm = new VM([], CONFIG);

    const orden = vm.step(sensoresVacios());

    expect(orden).toEqual({ vL: 0, vR: 0 });
  });
});

describe('instrucciones con duracion', () => {
  test('detener deja los motores quietos y pasa a la siguiente', () => {
    const vm = new VM(
      [{ tipo: 'detener' }, { tipo: 'avanzar', velocidad: 20, duracionMs: 1000 }],
      CONFIG,
    );

    const [primera, segunda] = correr(vm, 2);

    expect(primera).toEqual({ vL: 0, vR: 0 });
    expect(segunda).toEqual({ vL: 20, vR: 20 });
  });

  test('avanzar devuelve la misma orden durante todos sus cuadros', () => {
    // 2 segundos a 60 cuadros por segundo = 120 cuadros.
    const vm = new VM([{ tipo: 'avanzar', velocidad: 30, duracionMs: 2000 }], CONFIG);

    const ordenes = correr(vm, 120);

    expect(ordenes).toHaveLength(120);
    for (const orden of ordenes) {
      expect(orden).toEqual({ vL: 30, vR: 30 });
    }
  });

  test('avanzar pasa a la siguiente instruccion al cumplirse su tiempo', () => {
    const vm = new VM(
      [
        { tipo: 'avanzar', velocidad: 30, duracionMs: 2000 },
        { tipo: 'detener' },
      ],
      CONFIG,
    );

    const ordenes = correr(vm, 121);

    // El cuadro 120 todavia es del avanzar; el 121 ya es del detener.
    expect(ordenes[119]).toEqual({ vL: 30, vR: 30 });
    expect(ordenes[120]).toEqual({ vL: 0, vR: 0 });
  });

  test('avanzar con velocidad negativa retrocede', () => {
    const vm = new VM([{ tipo: 'avanzar', velocidad: -15, duracionMs: 500 }], CONFIG);

    expect(vm.step(sensoresVacios())).toEqual({ vL: -15, vR: -15 });
  });

  test('girar horario pone la rueda izquierda adelante y la derecha atras', () => {
    // Convencion de types.ts: vL > vR hace que el robot gire a su derecha,
    // y en pantalla eso se ve horario. Grados positivos = horario.
    const vm = new VM([{ tipo: 'girar', grados: 90, velocidad: 15 }], CONFIG);

    expect(vm.step(sensoresVacios())).toEqual({ vL: 15, vR: -15 });
  });

  test('girar antihorario invierte las ruedas', () => {
    const vm = new VM([{ tipo: 'girar', grados: -90, velocidad: 15 }], CONFIG);

    expect(vm.step(sensoresVacios())).toEqual({ vL: -15, vR: 15 });
  });

  test('girar dura lo que dice la cinematica, no un tiempo inventado', () => {
    // w = 2 * velocidad / anchoEje = 2*15/12 = 2.5 rad/s
    // t = (90 grados en radianes) / w = 1.5708 / 2.5 = 0.6283 s = 628.3 ms
    // cuadros = round(628.3 / 16.667) = 38
    const vm = new VM(
      [{ tipo: 'girar', grados: 90, velocidad: 15 }, { tipo: 'detener' }],
      CONFIG,
    );

    const ordenes = correr(vm, 39);

    expect(ordenes[37]).toEqual({ vL: 15, vR: -15 });
    expect(ordenes[38]).toEqual({ vL: 0, vR: 0 });
  });
});

describe('condicionales', () => {
  const AVANZAR: Instruccion = { tipo: 'avanzar', velocidad: 40, duracionMs: 1000 };

  test('entra al cuerpo cuando el rival esta mas cerca que el umbral', () => {
    const vm = new VM(
      [{ tipo: 'siDistanciaMenor', umbral: 20, entonces: [AVANZAR] }],
      CONFIG,
    );

    const orden = vm.step({ ...sensoresVacios(), distanciaFrontal: 15 });

    expect(orden).toEqual({ vL: 40, vR: 40 });
  });

  test('salta el cuerpo cuando el rival esta mas lejos que el umbral', () => {
    const vm = new VM(
      [{ tipo: 'siDistanciaMenor', umbral: 20, entonces: [AVANZAR] }],
      CONFIG,
    );

    const orden = vm.step({ ...sensoresVacios(), distanciaFrontal: 50 });

    expect(orden).toEqual({ vL: 0, vR: 0 });
  });

  test('si detecta borde responde al lado indicado', () => {
    const programa = (): Instruccion[] => [
      { tipo: 'siBorde', lado: 'izq', entonces: [AVANZAR] },
    ];

    const soloIzquierdo = new VM(programa(), CONFIG);
    expect(
      soloIzquierdo.step({ ...sensoresVacios(), bordeIzquierdo: true }),
    ).toEqual({ vL: 40, vR: 40 });

    const soloDerecho = new VM(programa(), CONFIG);
    expect(
      soloDerecho.step({ ...sensoresVacios(), bordeDerecho: true }),
    ).toEqual({ vL: 0, vR: 0 });
  });

  test('el lado cualquiera responde a los dos sensores', () => {
    const programa = (): Instruccion[] => [
      { tipo: 'siBorde', lado: 'cualquiera', entonces: [AVANZAR] },
    ];

    const porIzquierda = new VM(programa(), CONFIG);
    expect(
      porIzquierda.step({ ...sensoresVacios(), bordeIzquierdo: true }),
    ).toEqual({ vL: 40, vR: 40 });

    const porDerecha = new VM(programa(), CONFIG);
    expect(
      porDerecha.step({ ...sensoresVacios(), bordeDerecho: true }),
    ).toEqual({ vL: 40, vR: 40 });
  });

  test('al terminar el cuerpo del si, sigue con lo que viene despues', () => {
    const vm = new VM(
      [
        { tipo: 'siDistanciaMenor', umbral: 20, entonces: [{ tipo: 'detener' }] },
        { tipo: 'avanzar', velocidad: 25, duracionMs: 1000 },
      ],
      CONFIG,
    );

    const cerca = { ...sensoresVacios(), distanciaFrontal: 10 };
    const [dentroDelSi, despuesDelSi] = [vm.step(cerca), vm.step(cerca)];

    expect(dentroDelSi).toEqual({ vL: 0, vR: 0 });
    expect(despuesDelSi).toEqual({ vL: 25, vR: 25 });
  });
});

describe('bucles', () => {
  test('repetir siempre vuelve al principio al terminar su cuerpo', () => {
    // Dos instrucciones de 1 cuadro cada una: el patron debe repetirse.
    const vm = new VM(
      [
        {
          tipo: 'repetirSiempre',
          cuerpo: [
            { tipo: 'avanzar', velocidad: 10, duracionMs: 16 },
            { tipo: 'detener' },
          ],
        },
      ],
      CONFIG,
    );

    const ordenes = correr(vm, 6);

    expect(ordenes.map((o) => o.vL)).toEqual([10, 0, 10, 0, 10, 0]);
  });

  test('un si dentro de un repetir siempre funciona', () => {
    const vm = new VM(
      [
        {
          tipo: 'repetirSiempre',
          cuerpo: [
            {
              tipo: 'siBorde',
              lado: 'cualquiera',
              entonces: [{ tipo: 'girar', grados: 180, velocidad: 15 }],
            },
            { tipo: 'avanzar', velocidad: 20, duracionMs: 16 },
          ],
        },
      ],
      CONFIG,
    );

    // Sin borde: el si no entra y avanza.
    expect(vm.step(sensoresVacios())).toEqual({ vL: 20, vR: 20 });

    // Con borde: el si entra y gira.
    expect(
      vm.step({ ...sensoresVacios(), bordeIzquierdo: true }),
    ).toEqual({ vL: 15, vR: -15 });
  });

  test('las instrucciones de control no gastan cuadros', () => {
    // Si entrar en un repetir o en un si consumiera un cuadro, el robot
    // se detendria la mitad del tiempo y avanzaria a tirones.
    const vm = new VM(
      [
        {
          tipo: 'repetirSiempre',
          cuerpo: [
            {
              tipo: 'siDistanciaMenor',
              umbral: 100,
              entonces: [{ tipo: 'avanzar', velocidad: 35, duracionMs: 1000 }],
            },
          ],
        },
      ],
      CONFIG,
    );

    const cerca = { ...sensoresVacios(), distanciaFrontal: 10 };

    // El primer cuadro ya debe mover: dos niveles de control resueltos sin
    // gastar ninguno.
    expect(vm.step(cerca)).toEqual({ vL: 35, vR: 35 });
  });

  test('un repetir siempre vacio no cuelga la simulacion', () => {
    const vm = new VM([{ tipo: 'repetirSiempre', cuerpo: [] }], CONFIG);

    expect(vm.step(sensoresVacios())).toEqual({ vL: 0, vR: 0 });
  });
});
