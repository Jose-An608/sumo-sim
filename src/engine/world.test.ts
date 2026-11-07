import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Simulacion } from './world.ts';
import type { Robot } from '../types.ts';

/**
 * Tests del aviso de fin de ronda (#39).
 *
 * `Simulacion` vive de `requestAnimationFrame`, que en Node no existe. En vez
 * de levantar un navegador lo reemplazamos por uno falso que solo guarda la
 * función que le piden ejecutar. Así decidimos nosotros CUÁNDO pasa un
 * cuadro: el test llama a `cuadro()` y la simulación avanza, sin relojes ni
 * esperas.
 *
 * El ring tiene 38.5 cm de radio, así que un robot en x = 1000 está fuera y
 * `detectarSalidas` lo mata en el primer paso. Es la manera más corta de
 * terminar un combate sin simular una pelea.
 */

function crearRobot(id: string, x: number): Robot {
  return {
    id,
    x,
    y: 0,
    theta: 0,
    vL: 0,
    vR: 0,
    anchoEje: 12,
    radio: 9,
    masa: 1.1,
    vivo: true,
  };
}

/** El `requestAnimationFrame` falso: guarda lo que le piden ejecutar. */
let pendiente: FrameRequestCallback | null = null;

beforeEach(() => {
  pendiente = null;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pendiente = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pendiente = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Hace pasar un cuadro de unos 100 ms, que son varios pasos de simulación. */
function cuadro(): void {
  const cb = pendiente;
  pendiente = null;
  if (cb) cb(performance.now() + 100);
}

function crearSimulacion(robots: Robot[], alTerminar: (ganador: Robot | null) => void) {
  return new Simulacion(
    robots,
    () => {},
    () => {},
    alTerminar,
  );
}

describe('fin de ronda', () => {
  test('no avisa mientras los dos siguen en el ring', () => {
    const alTerminar = vi.fn();
    const sim = crearSimulacion([crearRobot('a', -20), crearRobot('b', 20)], alTerminar);

    sim.iniciar();
    cuadro();

    expect(alTerminar).not.toHaveBeenCalled();
  });

  test('avisa con el ganador cuando uno sale del ring', () => {
    const alTerminar = vi.fn();
    const rojo = crearRobot('a', 0);
    const sim = crearSimulacion([rojo, crearRobot('b', 1000)], alTerminar);

    sim.iniciar();
    cuadro();

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar).toHaveBeenCalledWith(rojo);
  });

  test('si salen los dos a la vez, avisa sin ganador', () => {
    // El empate es el caso que se olvida: no queda nadie vivo y no hay a
    // quién darle el punto.
    const alTerminar = vi.fn();
    const sim = crearSimulacion([crearRobot('a', 1000), crearRobot('b', -1000)], alTerminar);

    sim.iniciar();
    cuadro();

    expect(alTerminar).toHaveBeenCalledTimes(1);
    expect(alTerminar).toHaveBeenCalledWith(null);
  });

  test('avisa una sola vez por ronda, aunque se intente seguir', () => {
    // Si el aviso se disparara más de una vez, el marcador contaría la misma
    // ronda varias veces. Terminado el combate, `iniciar()` no debe volver
    // a arrancar nada.
    const alTerminar = vi.fn();
    const sim = crearSimulacion([crearRobot('a', 0), crearRobot('b', 1000)], alTerminar);

    sim.iniciar();
    cuadro();
    sim.iniciar();
    cuadro();

    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  test('después de reiniciar, la ronda siguiente avisa de nuevo', () => {
    // Una vez por RONDA, no una vez en total.
    const alTerminar = vi.fn();
    const sim = crearSimulacion([crearRobot('a', 0), crearRobot('b', 1000)], alTerminar);

    sim.iniciar();
    cuadro();
    sim.reiniciar();
    sim.iniciar();
    cuadro();

    expect(alTerminar).toHaveBeenCalledTimes(2);
  });
});
