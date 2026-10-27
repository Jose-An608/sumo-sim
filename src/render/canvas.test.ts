import { describe, it, expect } from 'vitest';
import { calcularEscala, cmAPx } from './canvas';
import { RING } from '../types';

describe('calcularEscala', () => {
  it('hace que el ring ocupe el 90% del canvas', () => {
    const escala = calcularEscala(600, 600);
    const diametroEnPx = RING.radio * 2 * escala;
    expect(diametroEnPx).toBeCloseTo(540);
  });

  it('usa el lado más corto cuando el canvas no es cuadrado', () => {
    expect(calcularEscala(800, 400)).toBe(calcularEscala(400, 400));
  });
});

describe('cmAPx', () => {
  it('convierte centímetros a píxeles con la escala dada', () => {
    expect(cmAPx(10, 2)).toBe(20);
  });

  it('devuelve 0 para 0 cm', () => {
    expect(cmAPx(0, 5)).toBe(0);
  });

  it('mantiene el signo de las distancias negativas', () => {
    expect(cmAPx(-10, 2)).toBe(-20);
  });
});