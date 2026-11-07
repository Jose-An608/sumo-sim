import { describe, expect, test } from 'vitest';
import { Marcador } from './marcador.ts';

/**
 * Tests del marcador (#39).
 *
 * El marcador solo cuenta: no sabe de robots, ni de canvas, ni del DOM. Por
 * eso estos tests no necesitan armar nada: crean un marcador y le dicen
 * quién ganó.
 *
 * Una ronda puede terminar de tres maneras: gana el rojo, gana el azul, o
 * se salen los dos a la vez. Los tres casos tienen que quedar cubiertos, y
 * el empate es el que se olvida.
 */

describe('marcador', () => {
  test('empieza en cero', () => {
    const m = new Marcador();

    expect(m.rojo).toBe(0);
    expect(m.azul).toBe(0);
    expect(m.empates).toBe(0);
  });

  test('una victoria suma un punto a quien ganó', () => {
    const m = new Marcador();

    m.registrar('rojo');

    expect(m.rojo).toBe(1);
  });

  test('la victoria de uno no toca al otro', () => {
    const m = new Marcador();

    m.registrar('azul');
    m.registrar('azul');

    expect(m.azul).toBe(2);
    expect(m.rojo).toBe(0);
  });

  test('un empate no suma a nadie y se cuenta aparte', () => {
    // Pasa cuando los dos robots salen del ring en el mismo cuadro: no hay
    // ganador, y no sería justo regalarle el punto a ninguno.
    const m = new Marcador();

    m.registrar(null);

    expect(m.rojo).toBe(0);
    expect(m.azul).toBe(0);
    expect(m.empates).toBe(1);
  });

  test('las rondas son la suma de victorias y empates', () => {
    const m = new Marcador();

    m.registrar('rojo');
    m.registrar('azul');
    m.registrar('rojo');
    m.registrar(null);

    expect(m.rondas).toBe(4);
  });

  test('reiniciar lo deja todo en cero', () => {
    const m = new Marcador();
    m.registrar('rojo');
    m.registrar('azul');
    m.registrar(null);

    m.reiniciar();

    expect(m.rojo).toBe(0);
    expect(m.azul).toBe(0);
    expect(m.empates).toBe(0);
    expect(m.rondas).toBe(0);
  });
});
