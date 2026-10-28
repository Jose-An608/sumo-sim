import type { Robot } from '../types';

/**
 * Avanza la simulación de un robot un paso de tiempo.
 *
 * Modelo de cinemática diferencial: un robot de dos ruedas no tiene volante.
 * Gira porque una rueda va más rápido que la otra, describiendo un arco.
 *
 * @param r  robot a mover (se modifica en el sitio)
 * @param dt paso de tiempo en segundos
 */
export function aplicarCinematica(r: Robot, dt: number): void {
  // Velocidad lineal del centro del robot: el promedio de las dos ruedas.
  const v = (r.vL + r.vR) / 2;

  // Velocidad angular: la diferencia entre ruedas, repartida sobre el eje.
  const w = (r.vR - r.vL) / r.anchoEje;

  // Primero la orientación, después el desplazamiento en esa dirección.
  r.theta += w * dt;
  r.x += v * Math.cos(r.theta) * dt;
  r.y += v * Math.sin(r.theta) * dt;
}