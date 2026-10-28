import type { Robot } from '../types';
import { aplicarCinematica } from './physics';

/** Paso de tiempo fijo: 60 cuadros por segundo. */
export const DT = 1 / 60;

/**
 * Bucle de simulación. Llama a `alActualizar` una vez por cuadro con un
 * paso de tiempo FIJO, y luego a `alDibujar`.
 *
 * El paso fijo es lo que hace la simulación determinista: el mismo programa
 * produce el mismo combate en cualquier computadora, rápida o lenta.
 */
export class Simulacion {
  private robots: Robot[];
  private alActualizar: (robots: Robot[], dt: number) => void;
  private alDibujar: (robots: Robot[]) => void;
  private idFrame: number | null = null;

  constructor(
    robots: Robot[],
    alActualizar: (robots: Robot[], dt: number) => void,
    alDibujar: (robots: Robot[]) => void,
  ) {
    this.robots = robots;
    this.alActualizar = alActualizar;
    this.alDibujar = alDibujar;
  }

  get corriendo(): boolean {
    return this.idFrame !== null;
  }

  iniciar(): void {
    if (this.corriendo) return;
    const paso = () => {
      this.alActualizar(this.robots, DT);
      for (const r of this.robots) aplicarCinematica(r, DT);
      this.alDibujar(this.robots);
      this.idFrame = requestAnimationFrame(paso);
    };
    this.idFrame = requestAnimationFrame(paso);
  }

  pausar(): void {
    if (this.idFrame !== null) {
      cancelAnimationFrame(this.idFrame);
      this.idFrame = null;
    }
  }
}