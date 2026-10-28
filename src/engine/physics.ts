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

/**
 * Separa a los robots que se estén solapando.
 *
 * Modelo círculo-círculo: hay colisión cuando la distancia entre centros es
 * menor que la suma de radios. La penetración se reparte por igual entre
 * ambos, empujándolos a lo largo de la línea que une sus centros.
 *
 * Los robots que ya salieron del ring (`vivo: false`) no participan.
 */
export function resolverColisiones(robots: Robot[]): void {
  for (let i = 0; i < robots.length; i++) {
    for (let j = i + 1; j < robots.length; j++) {
      const a = robots[i];
      const b = robots[j];

      if (!a.vivo || !b.vivo) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distancia = Math.hypot(dx, dy);
      const minima = a.radio + b.radio;

      if (distancia >= minima) continue;

      // Si están exactamente superpuestos no hay dirección definida:
      // los separamos en X para evitar dividir por cero.
      const nx = distancia === 0 ? 1 : dx / distancia;
      const ny = distancia === 0 ? 0 : dy / distancia;

      const mitad = (minima - distancia) / 2;

      a.x -= nx * mitad;
      a.y -= ny * mitad;
      b.x += nx * mitad;
      b.y += ny * mitad;
    }
  }
}