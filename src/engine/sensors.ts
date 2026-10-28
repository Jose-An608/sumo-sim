import { RING, type LecturaSensores, type Robot } from '../types';

/** Medio ángulo del cono del ultrasonido, en radianes (±15°). */
const MEDIO_CONO = (15 * Math.PI) / 180;

/** Separación de cada sensor de color respecto al eje central, en cm. */
const SEPARACION_SENSORES = 4;

/** Qué tan adelante del centro van montados los sensores de color, en cm. */
const ADELANTO_SENSORES = 7;

/** Normaliza un ángulo al rango (-pi, pi]. */
function normalizar(angulo: number): number {
  return Math.atan2(Math.sin(angulo), Math.cos(angulo));
}

/** ¿El punto dado cae sobre la franja blanca del borde? */
function esBorde(x: number, y: number): boolean {
  return Math.hypot(x, y) >= RING.radio - RING.grosorBorde;
}

/**
 * Lee los tres sensores del robot: el ultrasonido frontal y los dos
 * sensores de color que miran al suelo.
 *
 * Es TODO lo que el robot percibe del mundo. No conoce su posición, ni la
 * del rival, ni si va ganando. Esa información limitada es lo que hace
 * interesante programar estrategias de sumo.
 */
export function leerSensores(yo: Robot, rival: Robot): LecturaSensores {
  // --- Ultrasonido ---
  let distanciaFrontal = Infinity;

  if (rival.vivo) {
    const dx = rival.x - yo.x;
    const dy = rival.y - yo.y;
    const anguloAlRival = Math.atan2(dy, dx);
    const desvio = Math.abs(normalizar(anguloAlRival - yo.theta));

    if (desvio <= MEDIO_CONO) {
      distanciaFrontal = Math.hypot(dx, dy);
    }
  }

  // --- Sensores de color ---
  // Montados adelante del centro, uno a cada lado del eje.
  const cos = Math.cos(yo.theta);
  const sin = Math.sin(yo.theta);

  const izqX = yo.x + ADELANTO_SENSORES * cos - SEPARACION_SENSORES * -sin;
  const izqY = yo.y + ADELANTO_SENSORES * sin - SEPARACION_SENSORES * cos;
  const derX = yo.x + ADELANTO_SENSORES * cos + SEPARACION_SENSORES * -sin;
  const derY = yo.y + ADELANTO_SENSORES * sin + SEPARACION_SENSORES * cos;

  return {
    distanciaFrontal,
    bordeIzquierdo: esBorde(izqX, izqY),
    bordeDerecho: esBorde(derX, derY),
  };
}