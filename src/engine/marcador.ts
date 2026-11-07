/**
 * Quién ganó una ronda: uno de los dos robots, o nadie.
 *
 * `null` significa empate, y pasa de verdad: si los dos robots salen del
 * ring en el mismo cuadro, `detectarSalidas` los mata a los dos y no queda
 * ganador. Se representa con `null` y no con un tercer texto como 'empate'
 * para que el tipo diga lo que es: la ausencia de ganador.
 */
export type Ganador = 'rojo' | 'azul' | null;

/**
 * El marcador de la sesión.
 *
 * Solo cuenta. No sabe de robots, ni de canvas, ni de cuándo termina una
 * ronda: alguien se lo dice con `registrar()`. Esa ignorancia es a propósito,
 * porque es lo que permite probarlo sin armar una simulación.
 */
export class Marcador {
  rojo = 0;
  azul = 0;
  empates = 0;

  /** Cuántas rondas se han jugado, contando los empates. */
  get rondas(): number {
    return this.rojo + this.azul + this.empates;
  }

  /** Anota el resultado de una ronda terminada. */
  registrar(ganador: Ganador): void {
    if (ganador === 'rojo') this.rojo++;
    else if (ganador === 'azul') this.azul++;
    else this.empates++;
  }

  /** Vuelve todo a cero. */
  reiniciar(): void {
    this.rojo = 0;
    this.azul = 0;
    this.empates = 0;
  }
}
