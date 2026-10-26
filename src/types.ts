/**
 * CONTRATO DEL SIMULADOR
 *
 * Frontera entre el motor de simulación (José) y el lenguaje
 * de bloques (Chura). Ningún otro archivo es compartido.
 *
 * - No se modifica sin acuerdo de los dos.
 * - Distancias en centímetros, ángulos en radianes.
 * - Eje X hacia la derecha, eje Y hacia abajo (como el canvas).
 * - theta = 0 significa que el robot mira hacia +X.
 */

/** Estado completo de un robot en un instante dado. */
export interface Robot {
  id: string;
  x: number;         // cm desde el centro del ring
  y: number;         // cm desde el centro del ring
  theta: number;     // orientación en radianes
  vL: number;        // velocidad de la rueda izquierda, cm/s
  vR: number;        // velocidad de la rueda derecha, cm/s
  anchoEje: number;  // distancia entre ruedas, cm
  radio: number;     // radio de colisión, cm
  masa: number;      // kg (define quién empuja a quién)
  vivo: boolean;     // false cuando sale del ring
}

/** Lo único que un robot percibe del mundo en un instante. */
export interface LecturaSensores {
  distanciaFrontal: number;  // cm hasta el rival; Infinity si no lo ve
  bordeIzquierdo: boolean;   // true si el sensor izquierdo ve blanco
  bordeDerecho: boolean;     // true si el sensor derecho ve blanco
}

/** Lo único que un programa puede ordenarle al robot en un frame. */
export interface Orden {
  vL: number;  // cm/s
  vR: number;  // cm/s
}

/** Una instrucción compilada desde los bloques visuales. */
export type Instruccion =
  | { tipo: 'avanzar'; velocidad: number; duracionMs: number }
  | { tipo: 'girar'; grados: number; velocidad: number }
  | { tipo: 'detener' }
  | { tipo: 'siDistanciaMenor'; umbral: number; entonces: Instruccion[] }
  | { tipo: 'siBorde'; lado: 'izq' | 'der' | 'cualquiera'; entonces: Instruccion[] }
  | { tipo: 'repetirSiempre'; cuerpo: Instruccion[] };

/** Dimensiones del ring de competencia (medidas reales). */
export const RING = {
  radio: 38.5,        // cm (ring de 77 cm de diámetro)
  grosorBorde: 2.5,   // cm de franja blanca
} as const;