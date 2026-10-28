import { describe, it, expect } from 'vitest';
import { leerSensores } from './sensors';
import { RING, type Robot } from '../types';

function crearRobot(parcial: Partial<Robot> = {}): Robot {
  return {
    id: 'test',
    x: 0, y: 0, theta: 0,
    vL: 0, vR: 0,
    anchoEje: 12, radio: 9, masa: 1.1,
    vivo: true,
    ...parcial,
  };
}

describe('ultrasonido', () => {
  it('detecta al rival que está justo al frente', () => {
    const yo = crearRobot({ x: 0, y: 0, theta: 0 });
    const rival = crearRobot({ x: 20, y: 0 });
    expect(leerSensores(yo, rival).distanciaFrontal).toBeCloseTo(20);
  });

  it('no ve al rival que está detrás', () => {
    const yo = crearRobot({ x: 0, y: 0, theta: 0 });
    const rival = crearRobot({ x: -20, y: 0 });
    expect(leerSensores(yo, rival).distanciaFrontal).toBe(Infinity);
  });

  it('no ve al rival que está al costado', () => {
    const yo = crearRobot({ x: 0, y: 0, theta: 0 });
    const rival = crearRobot({ x: 0, y: 20 });
    expect(leerSensores(yo, rival).distanciaFrontal).toBe(Infinity);
  });

  it('ve al rival cuando el robot gira hacia él', () => {
    const yo = crearRobot({ x: 0, y: 0, theta: Math.PI / 2 });
    const rival = crearRobot({ x: 0, y: 20 });
    expect(leerSensores(yo, rival).distanciaFrontal).toBeCloseTo(20);
  });

  it('devuelve Infinity si el rival ya salió del ring', () => {
    const yo = crearRobot({ x: 0, y: 0, theta: 0 });
    const rival = crearRobot({ x: 20, y: 0, vivo: false });
    expect(leerSensores(yo, rival).distanciaFrontal).toBe(Infinity);
  });
});

describe('sensores de color', () => {
  it('no detecta borde en el centro del ring', () => {
    const lectura = leerSensores(crearRobot(), crearRobot({ x: 30 }));
    expect(lectura.bordeIzquierdo).toBe(false);
    expect(lectura.bordeDerecho).toBe(false);
  });

  it('detecta borde con los dos sensores al llegar de frente al límite', () => {
    const yo = crearRobot({ x: RING.radio - 1, y: 0, theta: 0 });
    const lectura = leerSensores(yo, crearRobot({ x: -30 }));
    expect(lectura.bordeIzquierdo).toBe(true);
    expect(lectura.bordeDerecho).toBe(true);
  });

  it('hay posiciones donde un solo sensor detecta el borde', () => {
    const rivalLejos = crearRobot({ x: -30 });
    let huboDiferencia = false;

    for (let angulo = 0; angulo < Math.PI * 2; angulo += 0.2) {
      for (let r = 25; r < RING.radio; r += 0.5) {
        for (let theta = 0; theta < Math.PI * 2; theta += 0.2) {
          const yo = crearRobot({
            x: r * Math.cos(angulo),
            y: r * Math.sin(angulo),
            theta,
          });
          const lectura = leerSensores(yo, rivalLejos);
          if (lectura.bordeIzquierdo !== lectura.bordeDerecho) {
            huboDiferencia = true;
          }
        }
      }
    }

    expect(huboDiferencia).toBe(true);
  });
});