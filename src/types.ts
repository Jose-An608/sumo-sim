/**
 * CONTRATO DEL SIMULADOR
 *
 * Frontera entre el motor de simulación (José) y el lenguaje
 * de bloques (Chura). Ningún otro archivo es compartido.
 *
 * - No se modifica sin acuerdo de los dos.
 * - Distancias en centímetros, ángulos en radianes.
 *
 * SISTEMA DE COORDENADAS Y GIROS
 * - Eje X hacia la derecha, eje Y hacia abajo (como el canvas).
 * - theta = 0 significa que el robot mira hacia +X.
 * - theta creciente = horario en pantalla.
 * - La IZQUIERDA del robot es -Y, la DERECHA es +Y.
 * - vL > vR hace que el robot gire a su derecha, y en pantalla
 *   se ve horario. Pantalla, física e intuición coinciden.
 * - La velocidad angular es w = (vL - vR) / anchoEje. La forma de los
 *   libros, (vR - vL), asume el eje Y hacia arriba; en este marco el
 *   signo se invierte.
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

/**
 * Datos fijos del robot que el programa necesita conocer.
 *
 * No son lecturas: son constantes fisicas que no cambian durante el combate.
 * Por eso no viven en `LecturaSensores` —que modela lo que el robot percibe
 * en cada frame— sino que se le pasan a la VM al construirla, una sola vez.
 *
 * Coincide con como se programa un EV3 real: el ancho entre ruedas esta
 * escrito como constante en el codigo, nadie lo mide en tiempo de ejecucion.
 *
 * Lo necesita la VM para ejecutar `girar`: con los grados pedidos no alcanza,
 * hace falta saber cuanto tiempo mantener las ruedas en sentidos opuestos.
 *
 *   velocidad angular:  w = 2 * velocidad / anchoEje
 *   duracion del giro:  t = (grados en radianes) / w
 */
export interface ConfiguracionRobot {
  anchoEje: number;      // distancia entre ruedas, cm
  velocidadMax: number;  // cm/s; la VM recorta las ordenes a este limite
}

/** Dimensiones del ring de competencia (medidas reales). */
export const RING = {
  radio: 38.5,        // cm (ring de 77 cm de diámetro)
  grosorBorde: 2.5,   // cm de franja blanca
} as const;