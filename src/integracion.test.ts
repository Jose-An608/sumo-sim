import { describe, expect, test } from 'vitest';
import * as Blockly from 'blockly';
import './blocks/definitions.ts';
import { generarPrograma } from './blocks/generator.ts';
import { VM } from './vm/vm.ts';
import { leerSensores } from './engine/sensors.ts';
import { aplicarCinematica, resolverColisiones, detectarSalidas } from './engine/physics.ts';
import { DT } from './engine/world.ts';
import { RING, VELOCIDAD_MAX, type Robot } from './types.ts';

/**
 * Tests de integracion: la cadena completa, de punta a punta.
 *
 *   bloques -> generador -> VM -> sensores -> motor -> colisiones
 *
 * Cada mitad del proyecto tiene sus propios tests, pero hasta ahora nada
 * comprobaba que las dos encajen. Este archivo arma bloques de verdad,
 * los compila, ejecuta el programa en la VM y mueve el robot con la fisica
 * real, igual que hace main.ts en cada cuadro. Sin navegador ni canvas.
 */

function crearRobot(parcial: Partial<Robot> = {}): Robot {
  return {
    id: 'rojo',
    x: 0, y: 0, theta: 0,
    vL: 0, vR: 0,
    anchoEje: 12, radio: 9, masa: 1.1,
    vivo: true,
    ...parcial,
  };
}

/**
 * Un rival inerte, para aislar al robot bajo prueba.
 *
 * Va con `vivo: false` a proposito: asi el ultrasonido devuelve siempre
 * Infinity, las colisiones lo ignoran y la salida del ring no lo toca. Lo
 * unico que se mide es el comportamiento del programa de bloques.
 */
function rivalInerte(): Robot {
  return crearRobot({ id: 'inerte', x: 1000, y: 1000, vivo: false });
}

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

function anidar(contenedor: Blockly.Block, hueco: string, hijo: Blockly.Block): void {
  contenedor.getInput(hueco)!.connection!.connect(hijo.previousConnection!);
}

function encadenar(bloque: Blockly.Block, siguiente: Blockly.Block): void {
  bloque.nextConnection!.connect(siguiente.previousConnection!);
}

/** Recorta al maximo del motor, igual que hace main.ts. */
function saturar(v: number): number {
  return Math.max(-VELOCIDAD_MAX, Math.min(VELOCIDAD_MAX, v));
}

/**
 * Ejecuta un combate completo, replicando el bucle de main.ts:
 * leer sensores -> vm.step() -> escribir ruedas -> mover -> chocar -> salir.
 */
function combatir(workspace: Blockly.Workspace, robot: Robot, cuadros: number): void {
  const { programa } = generarPrograma(workspace);
  const vm = new VM(programa, {
    anchoEje: robot.anchoEje,
    velocidadMax: VELOCIDAD_MAX,
    dt: DT,
  });
  const rival = rivalInerte();

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

describe('de los bloques al movimiento', () => {
  test('un bloque avanzar mueve al robot la distancia pedida', () => {
    const ws = new Blockly.Workspace();
    crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 25, DURACION: 1 });

    const robot = crearRobot();
    combatir(ws, robot, 60); // 1 segundo

    expect(robot.x).toBeCloseTo(25, 1);
    expect(robot.y).toBeCloseTo(0, 1);
  });

  test('un bloque girar con grados positivos gira en horario', () => {
    // Esta es la convencion que acordamos y que atraviesa TODO el sistema:
    // el bloque dice "positivo = horario", el generador lo pasa tal cual, la
    // VM lo traduce a vL adelante y vR atras, y la cinematica lo convierte
    // en theta creciente. Si alguien rompe un eslabon, este test lo atrapa.
    const ws = new Blockly.Workspace();
    crearBloque(ws, 'sumo_girar', { GRADOS: 90, VELOCIDAD: 15 });

    const robot = crearRobot();
    combatir(ws, robot, 38);

    expect(robot.theta).toBeGreaterThan(0);
    expect(robot.theta).toBeCloseTo(Math.PI / 2, 1);
  });

  test('un lienzo vacio deja al robot quieto', () => {
    const robot = crearRobot();
    combatir(new Blockly.Workspace(), robot, 60);

    expect(robot.x).toBe(0);
    expect(robot.y).toBe(0);
  });
});

describe('el robot reacciona a lo que percibe', () => {
  /** Un programa que avanza sin mirar nada. */
  function programaSuicida(): Blockly.Workspace {
    const ws = new Blockly.Workspace();
    const bucle = crearBloque(ws, 'sumo_repetir_siempre');
    anidar(bucle, 'CUERPO', crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 25, DURACION: 0.2 }));
    return ws;
  }

  /** El mismo programa, pero retrocediendo al detectar el borde. */
  function programaPrudente(): Blockly.Workspace {
    const ws = new Blockly.Workspace();
    const bucle = crearBloque(ws, 'sumo_repetir_siempre');

    const si = crearBloque(ws, 'sumo_si_borde', { LADO: 'cualquiera' });
    anidar(si, 'ENTONCES', crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: -20, DURACION: 0.5 }));

    anidar(bucle, 'CUERPO', si);
    encadenar(si, crearBloque(ws, 'sumo_avanzar', { VELOCIDAD: 25, DURACION: 0.2 }));

    return ws;
  }

  test('sin mirar el borde, el robot se sale del ring y pierde', () => {
    const robot = crearRobot();
    combatir(programaSuicida(), robot, 300); // 5 segundos

    expect(robot.vivo).toBe(false);
  });

  test('mirando el borde, el robot sobrevive', () => {
    // Mismo bucle, misma velocidad, mismos 5 segundos. Lo unico que cambia
    // es que consulta el sensor de color. Si la cadena sensores -> VM ->
    // motor se rompe en cualquier punto, este robot muere igual que el otro.
    const robot = crearRobot();
    combatir(programaPrudente(), robot, 300);

    expect(robot.vivo).toBe(true);
    expect(Math.hypot(robot.x, robot.y)).toBeLessThan(RING.radio);
  });
});
