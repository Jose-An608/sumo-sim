import { describe, it, expect } from 'vitest';
import { aplicarCinematica, resolverColisiones, detectarSalidas } from './physics';
import { RING, type Robot } from '../types';

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

  it('no mueve a un robot muerto aunque tenga velocidad', () => {
    const r = crearRobot({ vL: 50, vR: 50, vivo: false });
    aplicarCinematica(r, 0.1);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
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

describe('empuje en colisiones', () => {
  it('desplaza al robot detenido cuando otro lo embiste', () => {
    const quieto = crearRobot({ id: 'quieto', x: 10, y: 0 });
    const embiste = crearRobot({ id: 'embiste', x: -5, y: 0, vL: 30, vR: 30 });
    resolverColisiones([embiste, quieto]);
    // Con separación simétrica quedaría en 11.5; el empuje debe moverlo más.
    expect(quieto.x).toBeGreaterThan(11.5);
  });

  it('el más pesado gana terreno al más ligero', () => {
    const pesado = crearRobot({ id: 'pesado', x: -5, y: 0, masa: 3, vL: 30, vR: 30 });
    const ligero = crearRobot({ id: 'ligero', x: 10, y: 0, masa: 1, vL: -30, vR: -30 });
    resolverColisiones([pesado, ligero]);
    // El punto de contacto se corre hacia el lado del ligero
    const centro = (pesado.x + ligero.x) / 2;
    expect(centro).toBeGreaterThan(2.5);
  });

  it('no empuja si ninguno avanza contra el otro', () => {
    const a = crearRobot({ id: 'a', x: -5, y: 0 });
    const b = crearRobot({ id: 'b', x: 5, y: 0 });
    resolverColisiones([a, b]);
    expect(a.x).toBeCloseTo(-9);
    expect(b.x).toBeCloseTo(9);
  });

  it('el empujado no se adelanta al que empuja', () => {
    const a = crearRobot({ id: 'a', x: -9, vL: 20, vR: 20 });
    const b = crearRobot({ id: 'b', x: 9, theta: Math.PI });

    for (let i = 0; i < 60; i++) {
      aplicarCinematica(a, 1 / 60);
      aplicarCinematica(b, 1 / 60);
      resolverColisiones([a, b]);
    }

    expect(b.x - a.x).toBeCloseTo(a.radio + b.radio);
  });
});

describe('detectarSalidas', () => {
  it('deja vivo al robot que está dentro del ring', () => {
    const r = crearRobot({ x: 0, y: 0 });
    detectarSalidas([r]);
    expect(r.vivo).toBe(true);
  });

  it('mata al robot cuyo centro sale del radio', () => {
    const r = crearRobot({ x: RING.radio + 1, y: 0 });
    detectarSalidas([r]);
    expect(r.vivo).toBe(false);
  });

  it('deja vivo al robot que toca el borde sin pasarlo', () => {
    const r = crearRobot({ x: RING.radio - 1, y: 0 });
    detectarSalidas([r]);
    expect(r.vivo).toBe(true);
  });

  it('detiene los motores del robot que sale', () => {
    const r = crearRobot({ x: RING.radio + 1, y: 0, vL: 20, vR: 20 });
    detectarSalidas([r]);
    expect(r.vL).toBe(0);
    expect(r.vR).toBe(0);
  });

  it('detecta la salida en cualquier dirección', () => {
    const r = crearRobot({ x: 0, y: RING.radio + 1 });
    detectarSalidas([r]);
    expect(r.vivo).toBe(false);
  });
});