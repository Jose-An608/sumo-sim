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

  // Velocidad angular. Ojo con el signo: la forma que aparece en los libros
  // es (vR - vL), pero esa asume el eje Y hacia ARRIBA. Nuestro eje Y apunta
  // hacia abajo (convención del canvas), y en ese marco los ángulos medidos
  // de +X hacia +Y giran al revés, así que la misma rotación física lleva el
  // signo cambiado. (vL - vR) es la fórmula correcta para este sistema.
  const w = (r.vL - r.vR) / r.anchoEje;

  // Primero la orientación, después el desplazamiento en esa dirección.
  r.theta += w * dt;
  r.x += v * Math.cos(r.theta) * dt;
  r.y += v * Math.sin(r.theta) * dt;
}