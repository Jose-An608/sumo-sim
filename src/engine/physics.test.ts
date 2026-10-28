import { describe, it, expect } from 'vitest';
import { aplicarCinematica, resolverColisiones } from './physics';
import type { Robot } from '../types';

/** Crea un robot en el origen, mirando hacia +X, con valores por defecto. */
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

describe('aplicarCinematica', () => {
  it('no mueve al robot si las dos ruedas están detenidas', () => {
    const r = crearRobot();
    aplicarCinematica(r, 0.1);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.theta).toBe(0);
  });

  it('avanza recto sin girar cuando las dos ruedas van igual', () => {
    const r = crearRobot({ vL: 10, vR: 10 });
    aplicarCinematica(r, 0.1);
    expect(r.theta).toBe(0);
    expect(r.x).toBeCloseTo(1);
    expect(r.y).toBeCloseTo(0);
  });

  it('retrocede cuando las dos ruedas van en negativo', () => {
    const r = crearRobot({ vL: -10, vR: -10 });
    aplicarCinematica(r, 0.1);
    expect(r.x).toBeCloseTo(-1);
  });

  it('gira sobre su propio eje sin desplazarse cuando las ruedas se oponen', () => {
    const r = crearRobot({ vL: -6, vR: 6 });
    aplicarCinematica(r, 0.1);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(0);
    expect(r.theta).toBeCloseTo(-0.1);
  });

  it('gira a su izquierda (antihorario en pantalla) cuando la rueda derecha va más rápido', () => {
    const r = crearRobot({ vL: 0, vR: 12 });
    aplicarCinematica(r, 0.1);
    expect(r.theta).toBeLessThan(0);
  });

  it('gira a su derecha (horario en pantalla) cuando la rueda izquierda va más rápido', () => {
    const r = crearRobot({ vL: 12, vR: 0 });
    aplicarCinematica(r, 0.1);
    expect(r.theta).toBeGreaterThan(0);
  });

  it('avanza en la dirección a la que mira, no siempre en +X', () => {
    const r = crearRobot({ theta: Math.PI / 2, vL: 10, vR: 10 });
    aplicarCinematica(r, 0.1);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(1);
  });
});

describe('resolverColisiones', () => {
  it('no toca a robots que están separados', () => {
    const a = crearRobot({ id: 'a', x: -30, y: 0 });
    const b = crearRobot({ id: 'b', x: 30, y: 0 });
    resolverColisiones([a, b]);
    expect(a.x).toBe(-30);
    expect(b.x).toBe(30);
  });

  it('separa a dos robots que se solapan', () => {
    const a = crearRobot({ id: 'a', x: -5, y: 0 });
    const b = crearRobot({ id: 'b', x: 5, y: 0 });
    resolverColisiones([a, b]);
    const distancia = Math.hypot(b.x - a.x, b.y - a.y);
    expect(distancia).toBeCloseTo(a.radio + b.radio);
  });

  it('reparte el solapamiento entre los dos', () => {
    const a = crearRobot({ id: 'a', x: -5, y: 0 });
    const b = crearRobot({ id: 'b', x: 5, y: 0 });
    resolverColisiones([a, b]);
    expect(a.x).toBeCloseTo(-9);
    expect(b.x).toBeCloseTo(9);
  });

  it('empuja en la dirección que une los centros', () => {
    const a = crearRobot({ id: 'a', x: 0, y: -5 });
    const b = crearRobot({ id: 'b', x: 0, y: 5 });
    resolverColisiones([a, b]);
    expect(a.x).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(0);
    expect(a.y).toBeCloseTo(-9);
    expect(b.y).toBeCloseTo(9);
  });

  it('ignora a los robots muertos', () => {
    const a = crearRobot({ id: 'a', x: -5, y: 0, vivo: false });
    const b = crearRobot({ id: 'b', x: 5, y: 0 });
    resolverColisiones([a, b]);
    expect(a.x).toBe(-5);
    expect(b.x).toBe(5);
  });
});