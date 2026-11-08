import { describe, expect, test } from 'vitest';
import type { ConfiguracionRobot, Instruccion } from '../types.ts';
import { aPseudocodigoEV3 } from './pseudocodigo.ts';

/**
 * Tests del exportador a pseudocodigo EV3 (C4).
 *
 * La funcion es pura: recibe un programa ya compilado y devuelve texto. No
 * hace falta Blockly ni navegador, y cada caso se escribe a mano con el
 * programa y el texto que se espera.
 *
 * El texto esta en el idioma del ROBOT, no del simulador: potencia en % para
 * Move Tank y giros en segundos, que es lo que se arma en el EV3 real.
 */

/** El robot de los tests: 12 cm entre ruedas y 50 cm/s de maximo. */
const ROBOT: ConfiguracionRobot = { anchoEje: 12, velocidadMax: 50 };

function exportar(programa: Instruccion[], config: ConfiguracionRobot = ROBOT): string {
  return aPseudocodigoEV3(programa, config);
}

describe('instrucciones sueltas', () => {
  test('un programa vacio da texto vacio', () => {
    expect(exportar([])).toBe('');
  });

  test('avanzar convierte cm/s a potencia en % y ms a segundos', () => {
    // 35 cm/s de un maximo de 50 = 70 %.
    expect(exportar([{ tipo: 'avanzar', velocidad: 35, duracionMs: 2000 }])).toBe(
      'Mover tanque: izquierda 70%, derecha 70% durante 2 s',
    );
  });

  test('avanzar con velocidad negativa es retroceder', () => {
    expect(exportar([{ tipo: 'avanzar', velocidad: -18, duracionMs: 500 }])).toBe(
      'Mover tanque: izquierda -36%, derecha -36% durante 0.5 s',
    );
  });

  test('una velocidad mayor al maximo se recorta al 100 %', () => {
    // El robot real no puede dar mas que su motor, y el simulador tampoco.
    expect(exportar([{ tipo: 'avanzar', velocidad: 200, duracionMs: 1000 }])).toBe(
      'Mover tanque: izquierda 100%, derecha 100% durante 1 s',
    );
  });

  test('detener apaga los motores', () => {
    expect(exportar([{ tipo: 'detener' }])).toBe('Detener los motores');
  });
});

describe('girar', () => {
  test('grados positivos giran a la derecha: rueda izquierda adelante', () => {
    // w = 2 * 25 / 12 = 4.17 rad/s;  t = (pi/2) / 4.17 = 0.377 s.
    expect(exportar([{ tipo: 'girar', grados: 90, velocidad: 25 }])).toBe(
      'Girar 90° a la derecha: mover tanque izquierda 50%, derecha -50% durante 0.38 s',
    );
  });

  test('grados negativos giran a la izquierda', () => {
    expect(exportar([{ tipo: 'girar', grados: -90, velocidad: 25 }])).toBe(
      'Girar 90° a la izquierda: mover tanque izquierda -50%, derecha 50% durante 0.38 s',
    );
  });

  test('el doble de grados al doble de velocidad dura lo mismo', () => {
    // Comprobacion cruzada de la formula: t = angulo / w, y w crece con v.
    expect(exportar([{ tipo: 'girar', grados: 180, velocidad: 50 }])).toBe(
      'Girar 180° a la derecha: mover tanque izquierda 100%, derecha -100% durante 0.38 s',
    );
  });

  test('la duracion se calcula con la velocidad RECORTADA, no con la pedida', () => {
    // El mismo error que tuvo la VM: pedir 200 cm/s con maximo 50 giraria
    // con 50, asi que el tiempo tiene que salir de 50. A 50 cm/s, 90 grados
    // duran (pi/2) / (100/12) = 0.19 s.
    expect(exportar([{ tipo: 'girar', grados: 90, velocidad: 200 }])).toBe(
      'Girar 90° a la derecha: mover tanque izquierda 100%, derecha -100% durante 0.19 s',
    );
  });

  test('velocidad cero no divide entre cero', () => {
    expect(exportar([{ tipo: 'girar', grados: 90, velocidad: 0 }])).toBe(
      'Girar 90° a la derecha: mover tanque izquierda 0%, derecha 0% durante 0 s',
    );
  });
});

describe('condicionales y bucles', () => {
  test('si distancia menor lleva su cuerpo con sangria', () => {
    expect(
      exportar([
        {
          tipo: 'siDistanciaMenor',
          umbral: 25,
          entonces: [{ tipo: 'avanzar', velocidad: 35, duracionMs: 2000 }],
        },
      ]),
    ).toBe(
      [
        'si el sensor ultrasónico mide menos de 25 cm',
        '  Mover tanque: izquierda 70%, derecha 70% durante 2 s',
      ].join('\n'),
    );
  });

  test('si borde nombra el sensor segun el lado', () => {
    const para = (lado: 'izq' | 'der' | 'cualquiera') =>
      exportar([{ tipo: 'siBorde', lado, entonces: [{ tipo: 'detener' }] }]).split('\n')[0];

    expect(para('izq')).toBe('si el sensor de color izquierdo ve borde');
    expect(para('der')).toBe('si el sensor de color derecho ve borde');
    expect(para('cualquiera')).toBe('si algún sensor de color ve borde');
  });

  test('un programa completo anida bucle, condicionales y movimientos', () => {
    const programa: Instruccion[] = [
      {
        tipo: 'repetirSiempre',
        cuerpo: [
          {
            tipo: 'siDistanciaMenor',
            umbral: 25,
            entonces: [{ tipo: 'avanzar', velocidad: 35, duracionMs: 2000 }],
          },
          {
            tipo: 'siBorde',
            lado: 'cualquiera',
            entonces: [{ tipo: 'girar', grados: 90, velocidad: 25 }],
          },
        ],
      },
    ];

    expect(exportar(programa)).toBe(
      [
        'repetir siempre',
        '  si el sensor ultrasónico mide menos de 25 cm',
        '    Mover tanque: izquierda 70%, derecha 70% durante 2 s',
        '  si algún sensor de color ve borde',
        '    Girar 90° a la derecha: mover tanque izquierda 50%, derecha -50% durante 0.38 s',
      ].join('\n'),
    );
  });

  test('las instrucciones de una pila salen una por linea, en orden', () => {
    expect(
      exportar([
        { tipo: 'avanzar', velocidad: 25, duracionMs: 1000 },
        { tipo: 'detener' },
      ]),
    ).toBe(['Mover tanque: izquierda 50%, derecha 50% durante 1 s', 'Detener los motores'].join('\n'));
  });
});

describe('el idioma del robot depende de su configuracion', () => {
  test('con otro maximo cambia la potencia en %', () => {
    // 35 cm/s es el 70 % de un motor que da 50, pero solo el 35 % de uno
    // que da 100. Si algun dia se calibra VELOCIDAD_MAX, el texto sigue bien.
    expect(
      exportar([{ tipo: 'avanzar', velocidad: 35, duracionMs: 1000 }], {
        anchoEje: 12,
        velocidadMax: 100,
      }),
    ).toBe('Mover tanque: izquierda 35%, derecha 35% durante 1 s');
  });

  test('con otro ancho de eje cambia la duracion del giro', () => {
    // Ruedas mas separadas: para el mismo angulo hay que girar mas tiempo.
    // w = 2 * 25 / 24 = 2.08 rad/s;  t = (pi/2) / 2.08 = 0.754 s.
    expect(
      exportar([{ tipo: 'girar', grados: 90, velocidad: 25 }], {
        anchoEje: 24,
        velocidadMax: 50,
      }),
    ).toBe('Girar 90° a la derecha: mover tanque izquierda 50%, derecha -50% durante 0.75 s');
  });
});
