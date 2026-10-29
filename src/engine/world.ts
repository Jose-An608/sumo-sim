import type { Robot } from '../types';
import { aplicarCinematica, resolverColisiones, detectarSalidas } from './physics';

/** Paso de tiempo fijo: 60 cuadros por segundo. */
export const DT = 1 / 60;

/**
 * Tiempo máximo que se acumula entre cuadros, en segundos.
 *
 * Si la pestaña pasa a segundo plano, el navegador deja de llamar a
 * `requestAnimationFrame`. Al volver, el salto de tiempo sería enorme y el
 * `while` intentaría ejecutar miles de pasos de golpe, colgando la página.
 * Con el tope, la simulación pierde ese tiempo en vez de congelarse.
 */
const MAX_ACUMULADO = 0.25;

/**
 * Bucle de simulación con paso de tiempo FIJO.
 *
 * El paso fijo es lo que hace la simulación determinista: el mismo programa
 * produce el mismo combate en cualquier computadora. Pero `requestAnimationFrame`
 * dispara al ritmo del monitor, así que un paso por cuadro haría que en una
 * pantalla de 120 Hz el combate transcurriera al doble de velocidad real.
 *
 * Por eso se acumula el tiempo transcurrido y se ejecutan los pasos que
 * correspondan. `dt` sigue siendo fijo; lo que varía es CUÁNTOS pasos se
 * dan por cuadro. De paso, eso hace casi gratis el multiplicador de
 * velocidad: basta con acumular más rápido.
 */
export class Simulacion {
  private robots: Robot[];
  private estadoInicial: Robot[];
  private alActualizar: (robots: Robot[], dt: number) => void;
  private alDibujar: (robots: Robot[]) => void;
  private idFrame: number | null = null;

  private acumulado = 0;
  private ultimoTiempo = 0;

  /** Multiplicador de velocidad: 1, 2 o 5. */
  velocidad = 1;

  constructor(
    robots: Robot[],
    alActualizar: (robots: Robot[], dt: number) => void,
    alDibujar: (robots: Robot[]) => void,
  ) {
    this.robots = robots;
    this.alActualizar = alActualizar;
    this.alDibujar = alDibujar;

    // Copia superficial de cada robot para poder reiniciar. `Robot` es plano
    // (solo números y booleanos), así que el spread basta.
    this.estadoInicial = robots.map((r) => ({ ...r }));
  }

  get corriendo(): boolean {
    return this.idFrame !== null;
  }

  get terminado(): boolean {
    return this.robots.filter((r) => r.vivo).length <= 1;
  }

  iniciar(): void {
    if (this.corriendo || this.terminado) return;

    // Al reanudar hay que reiniciar el reloj: si no, el tiempo que estuvo
    // pausado contaría como tiempo de simulación.
    this.ultimoTiempo = performance.now();

    const paso = (ahora: number) => {
      this.acumulado += ((ahora - this.ultimoTiempo) / 1000) * this.velocidad;
      this.ultimoTiempo = ahora;

      if (this.acumulado > MAX_ACUMULADO) this.acumulado = MAX_ACUMULADO;

      while (this.acumulado >= DT) {
        this.alActualizar(this.robots, DT);

        // Primero mover, después corregir: la cinemática puede meter a un
        // robot dentro del otro, y las colisiones deshacen esa penetración
        // antes de que se dibuje nada.
        for (const r of this.robots) aplicarCinematica(r, DT);
        resolverColisiones(this.robots);
        detectarSalidas(this.robots);

        this.acumulado -= DT;

        // El combate puede terminar a mitad de la tanda de pasos, así que
        // la comprobación va DENTRO del while.
        if (this.terminado) {
          this.alDibujar(this.robots);
          this.pausar();
          return;
        }
      }

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

  /** Devuelve los robots a su posición inicial y deja todo listo para empezar. */
  reiniciar(): void {
    this.pausar();

    // Se copian los valores DENTRO de los objetos existentes, no se
    // reemplaza el arreglo: `main.ts` guarda referencias a esos mismos
    // robots y se quedaría apuntando a los viejos.
    for (let i = 0; i < this.robots.length; i++) {
      Object.assign(this.robots[i], this.estadoInicial[i]);
    }

    this.acumulado = 0;
    this.alDibujar(this.robots);
  }
}