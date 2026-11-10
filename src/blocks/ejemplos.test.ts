import { describe, expect, test } from 'vitest';
import * as Blockly from 'blockly';
import './definitions.ts';
import { generarPrograma } from './generator.ts';
import { VM } from '../vm/vm.ts';
import { leerSensores } from '../engine/sensors.ts';
import { aplicarCinematica, detectarSalidas, resolverColisiones } from '../engine/physics.ts';
import { DT } from '../engine/world.ts';
import { VELOCIDAD_MAX, type LecturaSensores, type Orden, type Robot } from '../types.ts';
import { cargarEjemplo, EJEMPLOS } from './ejemplos.ts';

/**
 * Tests de las estrategias de ejemplo (C3).
 *
 * Un ejemplo que "deberia" funcionar y no funciona es peor que no tener
 * ejemplo, asi que cada uno se comprueba en tres capas:
 *
 *   1. Estructura: se carga, compila sin advertencias y da un solo bucle.
 *   2. Sensores -> ordenes, SIN fisica: se le da a la VM una lectura
 *      inventada y se miran las ordenes. Es determinista.
 *   3. Un combate real contra un rival quieto, con la fisica de verdad.
 */

const CONFIG = { anchoEje: 12, velocidadMax: VELOCIDAD_MAX, dt: DT };

const NADA: LecturaSensores = {
  distanciaFrontal: Infinity,
  bordeIzquierdo: false,
  bordeDerecho: false,
};

const IDS = EJEMPLOS.map((e) => e.id);

/** Carga un ejemplo en un workspace nuevo y lo compila. */
function compilar(id: string) {
  const ws = new Blockly.Workspace();
  expect(cargarEjemplo(id, ws)).toBe(true);
  return generarPrograma(ws);
}

/** Las ordenes de los primeros `cuadros` cuadros, con la misma lectura siempre. */
function ordenes(id: string, sensores: LecturaSensores, cuadros: number): Orden[] {
  const vm = new VM(compilar(id).programa, CONFIG);
  return Array.from({ length: cuadros }, () => vm.step(sensores));
}

const avanzaDeFrente = (o: Orden) => o.vL > 0 && o.vR > 0;
const retrocede = (o: Orden) => o.vL < 0 && o.vR < 0;
const cargaAFondo = (o: Orden) => o.vL === VELOCIDAD_MAX && o.vR === VELOCIDAD_MAX;

describe('el catalogo', () => {
  test('hay tres ejemplos, con ids distintos y con texto para mostrar', () => {
    expect(EJEMPLOS).toHaveLength(3);
    expect(new Set(IDS).size).toBe(3);

    for (const ejemplo of EJEMPLOS) {
      expect(ejemplo.nombre.trim()).not.toBe('');
      expect(ejemplo.descripcion.trim()).not.toBe('');
    }
  });

  test.each(IDS)('%s se carga sin advertencias y compila a un solo bucle', (id) => {
    const { programa, advertencias } = compilar(id);

    // Sin advertencias = sin bloques sueltos. Un ejemplo con un bloque
    // olvidado por ahi le ensenaria al usuario un mal habito.
    expect(advertencias).toEqual([]);
    expect(programa).toHaveLength(1);
    expect(programa[0].tipo).toBe('repetirSiempre');
  });

  test('cargar un ejemplo reemplaza lo que habia en el editor', () => {
    const ws = new Blockly.Workspace();
    ws.newBlock('sumo_detener');
    ws.newBlock('sumo_detener');

    expect(cargarEjemplo(IDS[0], ws)).toBe(true);

    const raices = ws.getTopBlocks(false);
    expect(raices).toHaveLength(1);
    expect(raices[0].type).toBe('sumo_repetir_siempre');
  });

  test('un id que no existe devuelve false y no toca el editor', () => {
    const ws = new Blockly.Workspace();
    ws.newBlock('sumo_detener');

    expect(cargarEjemplo('no-existe', ws)).toBe(false);

    const raices = ws.getTopBlocks(false);
    expect(raices).toHaveLength(1);
    expect(raices[0].type).toBe('sumo_detener');
  });
});

describe('que hace cada uno con lo que percibe', () => {
  test.each(IDS)('%s no avanza de frente si no ve nada', (id) => {
    // Solo barre: gira en el sitio buscando. Avanzar a ciegas es justo lo
    // que lo sacaria del ring solo.
    const dadas = ordenes(id, NADA, 120);

    expect(dadas.some(avanzaDeFrente)).toBe(false);
    expect(dadas.some((o) => o.vL !== 0 || o.vR !== 0)).toBe(true);
  });

  test.each(IDS)('%s carga a fondo cuando ve al rival cerca', (id) => {
    const dadas = ordenes(id, { ...NADA, distanciaFrontal: 20 }, 120);

    expect(dadas.some(cargaAFondo)).toBe(true);
  });

  test.each(['guardian-borde', 'buscador-paciente'])(
    '%s retrocede al ver el borde',
    (id) => {
      const dadas = ordenes(id, { ...NADA, bordeIzquierdo: true }, 60);

      expect(dadas.some(retrocede)).toBe(true);
    },
  );

  test('el embestidor NO mira el borde: es su punto debil, a proposito', () => {
    // Si algun dia este test falla porque el embestidor retrocede, no es un
    // arreglo: se perdio la diferencia entre los tres ejemplos.
    const dadas = ordenes('embestidor', { ...NADA, bordeIzquierdo: true }, 60);

    expect(dadas.some(retrocede)).toBe(false);
  });

  test('el buscador barre mas despacio que el embestidor', () => {
    const rapidez = (id: string) =>
      Math.max(...ordenes(id, NADA, 120).map((o) => Math.abs(o.vL)));

    expect(rapidez('buscador-paciente')).toBeLessThan(rapidez('embestidor'));
  });
});

describe('un combate real contra un rival quieto', () => {
  function crearRobot(parcial: Partial<Robot>): Robot {
    return {
      id: 'x',
      x: 0, y: 0, theta: 0,
      vL: 0, vR: 0,
      anchoEje: 12, radio: 9, masa: 1.1,
      vivo: true,
      ...parcial,
    };
  }

  const saturar = (v: number) => Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, v));

  /** El bucle de main.ts, con el rival sin programa: sus ruedas quedan en 0. */
  function combatir(id: string, robot: Robot, rival: Robot, cuadros: number): void {
    const vm = new VM(compilar(id).programa, CONFIG);

    for (let i = 0; i < cuadros; i++) {
      if (robot.vivo) {
        const orden = vm.step(leerSensores(robot, rival));
        robot.vL = saturar(orden.vL);
        robot.vR = saturar(orden.vR);
      }

      aplicarCinematica(robot, DT);
      resolverColisiones([robot, rival]);
      detectarSalidas([robot, rival]);
    }
  }

  test.each(IDS)('%s saca del ring a un rival quieto que tiene enfrente', (id) => {
    const robot = crearRobot({ id: 'rojo', x: -20, theta: 0 });
    const rival = crearRobot({ id: 'azul', x: 20, theta: Math.PI });

    combatir(id, robot, rival, 360); // 6 segundos

    expect(rival.vivo).toBe(false);
    expect(robot.vivo).toBe(true);
  });
});
