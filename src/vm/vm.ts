import type { ConfiguracionRobot, Instruccion, LecturaSensores, Orden } from '../types.ts';

/**
 * B2.1 — La maquina virtual.
 *
 * Ejecuta un programa compilado UNA INSTRUCCION POR CUADRO y recuerda
 * donde se quedo. Es lo mismo que hace un procesador real con su contador
 * de programa.
 *
 * La VM no sabe dibujar, no sabe de fisica y no sabe donde esta el robot
 * en el ring. Solo recibe numeros (las lecturas de los sensores) y
 * devuelve numeros (las velocidades de las ruedas). Esa separacion es la
 * que permite probarla entera sin levantar el simulador.
 */

/**
 * Lo que la VM necesita saber del robot y de la simulacion.
 *
 * Todo esto es CONSTANTE durante el combate, por eso entra una sola vez
 * en el constructor y no en cada llamada a step().
 */
export interface ConfiguracionVM extends ConfiguracionRobot {
  /** Paso de tiempo de la simulacion, en segundos. */
  dt: number;
}

/** Los motores quietos. Es lo que se devuelve cuando no hay nada que hacer. */
const DETENER: Orden = { vL: 0, vR: 0 };

/**
 * Cuantas instrucciones de control se resuelven como maximo en un mismo
 * cuadro antes de rendirse.
 *
 * Hace falta porque un `repetir siempre` con el cuerpo VACIO se reentraria
 * sin fin dentro de una sola llamada a step() y colgaria la pestaña. Y ese
 * no es un caso raro: es el estado normal de un programa recien armado,
 * mientras el usuario todavia no le puso nada dentro al bucle.
 */
const LIMITE_CONTROL = 1000;

/** Instrucciones que no mueven motores: solo deciden que se ejecuta. */
type InstruccionControl = Extract<
  Instruccion,
  { tipo: 'siDistanciaMenor' | 'siBorde' | 'repetirSiempre' }
>;

function esControl(instruccion: Instruccion): instruccion is InstruccionControl {
  return (
    instruccion.tipo === 'siDistanciaMenor' ||
    instruccion.tipo === 'siBorde' ||
    instruccion.tipo === 'repetirSiempre'
  );
}

/**
 * Un nivel de ejecucion: una lista de instrucciones y por cual vamos.
 *
 * Hace falta una PILA de estos porque los bloques se anidan. Cuando la VM
 * entra en un `si`, apila el cuerpo del `si` como un contexto nuevo; al
 * terminarlo, lo desapila y sigue donde habia quedado en el de afuera.
 * Sin pila, la VM se perderia en el primer anidamiento.
 */
interface Contexto {
  instrucciones: Instruccion[];
  puntero: number;
  /** Cuadros que lleva ejecutandose la instruccion actual. */
  cuadros: number;
}

/** Lo que una instruccion ordena y cuantos cuadros ocupa. */
interface Ejecucion {
  orden: Orden;
  /** Cuadros que dura. Al llegar a este numero, el puntero avanza. */
  cuadros: number;
}

export class VM {
  private pila: Contexto[];
  private config: ConfiguracionVM;

  constructor(programa: Instruccion[], config: ConfiguracionVM) {
    this.pila = [{ instrucciones: programa, puntero: 0, cuadros: 0 }];
    this.config = config;
  }

  /**
   * Ejecuta un cuadro.
   *
   * @param sensores lo que el robot percibe EN ESTE INSTANTE
   * @returns las velocidades de rueda para ESTE INSTANTE
   */
  step(sensores: LecturaSensores): Orden {
    // Las instrucciones de CONTROL no gastan cuadro: se resuelven aqui
    // mismo y seguimos bajando hasta encontrar una que mueva los motores.
    //
    // Si cada `si` y cada `repetir` consumiera un cuadro, el programa
    // tipico de sumo (un bucle con un condicional dentro) dejaria los
    // motores quietos la mitad del tiempo y el robot avanzaria a tirones.
    for (let vuelta = 0; vuelta < LIMITE_CONTROL; vuelta++) {
      const instruccion = this.instruccionActual();

      // Programa vacio o terminado: el robot se queda quieto.
      //
      // Devolvemos DETENER y no null ni una excepcion a proposito: si
      // devolviera null, cada llamador tendria que acordarse de
      // comprobarlo, y el dia que alguien lo olvide el robot se va solo.
      if (!instruccion) return DETENER;

      if (esControl(instruccion)) {
        this.resolverControl(instruccion, sensores);
        continue;
      }

      const { orden, cuadros } = this.ejecutar(instruccion);

      // Una instruccion con duracion NO bloquea: devuelve la misma orden
      // en cada cuadro y solo al completar su tiempo cede el turno a la
      // siguiente. Es la diferencia entre un programa que "se ejecuta" y
      // uno que "transcurre".
      const contexto = this.pila[this.pila.length - 1];
      contexto.cuadros++;

      if (contexto.cuadros >= cuadros) {
        contexto.puntero++;
        contexto.cuadros = 0;
      }

      return this.limitarOrden(orden);
    }

    // Se agoto el limite: el programa da vueltas sin mover nada.
    return DETENER;
  }

  /**
   * Resuelve una instruccion de control: decide que se ejecuta despues.
   *
   * No devuelve ninguna orden porque no mueve motores. Lo unico que hace
   * es mover el puntero y, cuando corresponde, apilar un contexto nuevo.
   */
  private resolverControl(
    instruccion: InstruccionControl,
    sensores: LecturaSensores,
  ): void {
    const contexto = this.pila[this.pila.length - 1];

    if (instruccion.tipo === 'repetirSiempre') {
      // OJO: aqui NO avanzamos el puntero, y esa es toda la magia del
      // bucle. Al terminar el cuerpo, su contexto se desapila y volvemos a
      // caer sobre este mismo `repetirSiempre`, que vuelve a apilarlo.
      // Repetir es, literalmente, no haber avanzado nunca.
      this.pila.push({ instrucciones: instruccion.cuerpo, puntero: 0, cuadros: 0 });
      return;
    }

    const cumple =
      instruccion.tipo === 'siDistanciaMenor'
        ? sensores.distanciaFrontal < instruccion.umbral
        : this.hayBorde(instruccion.lado, sensores);

    // El puntero avanza SIEMPRE, se cumpla o no la condicion: el `si` ya
    // quedo resuelto. Si no avanzara, al terminar el cuerpo volveriamos a
    // evaluarlo y seria un bucle en vez de un condicional.
    contexto.puntero++;
    contexto.cuadros = 0;

    if (cumple) {
      this.pila.push({ instrucciones: instruccion.entonces, puntero: 0, cuadros: 0 });
    }
  }

  /** Evalua la condicion de borde segun el lado pedido. */
  private hayBorde(lado: 'izq' | 'der' | 'cualquiera', sensores: LecturaSensores): boolean {
    if (lado === 'izq') return sensores.bordeIzquierdo;
    if (lado === 'der') return sensores.bordeDerecho;
    return sensores.bordeIzquierdo || sensores.bordeDerecho;
  }

  /** Traduce una instruccion a la orden de este cuadro y su duracion. */
  private ejecutar(instruccion: Instruccion): Ejecucion {
    switch (instruccion.tipo) {
      case 'detener':
        return { orden: DETENER, cuadros: 1 };

      case 'avanzar':
        return {
          orden: { vL: instruccion.velocidad, vR: instruccion.velocidad },
          cuadros: this.aCuadros(instruccion.duracionMs),
        };

      case 'girar': {
        // Convencion de types.ts: vL > vR gira a la derecha y se ve
        // horario en pantalla. Grados positivos = horario.
        const v = instruccion.velocidad;
        const horario = instruccion.grados >= 0;
        const orden = horario ? { vL: v, vR: -v } : { vL: -v, vR: v };

        return { orden, cuadros: this.aCuadros(this.duracionGiroMs(instruccion.grados, v)) };
      }

      default:
        throw new Error(`Instruccion sin implementar: ${instruccion.tipo}`);
    }
  }

  /**
   * Cuanto tarda un giro, segun la cinematica del robot.
   *
   * Con las ruedas en sentidos opuestos a velocidad v, la velocidad
   * angular es w = 2v / anchoEje, y el giro dura (angulo / w).
   *
   * Aqui es donde la VM necesita `anchoEje`: con los grados pedidos no
   * alcanza, porque cuanto tarda depende de la geometria del robot.
   */
  /**
   * Recorta una orden al maximo real del motor.
   *
   * Va en un solo punto, a la salida de step(), para que ningun caso del
   * switch pueda olvidarse. El simulador no debe permitir algo que el robot
   * real no puede hacer: si dejaramos pasar 200 cm/s, una estrategia se
   * veria ganadora aqui y fallaria en el EV3.
   */
  private limitarOrden(orden: Orden): Orden {
    return { vL: this.limitar(orden.vL), vR: this.limitar(orden.vR) };
  }

  /** Recorta una velocidad al rango que el motor puede dar. */
  private limitar(v: number): number {
    const max = this.config.velocidadMax;
    return Math.max(-max, Math.min(max, v));
  }

  private duracionGiroMs(grados: number, velocidad: number): number {
    // OJO: aqui tambien hay que recortar, no solo en la salida.
    //
    // Si la duracion se calculara con la velocidad PEDIDA y el giro se
    // ejecutara con la RECORTADA, el robot giraria de menos. Pedir 90
    // grados a 200 cm/s con un maximo de 50 daria 3 cuadros de duracion
    // pero solo 24 grados de giro real, en vez de los 90 pedidos.
    const w = (2 * Math.abs(this.limitar(velocidad))) / this.config.anchoEje;
    if (w === 0) return 0;

    const radianes = Math.abs(grados) * (Math.PI / 180);
    return (radianes / w) * 1000;
  }

  /**
   * Convierte milisegundos a cuadros enteros.
   *
   * Contamos cuadros y no milisegundos acumulados a proposito: sumar
   * `dt * 1000` en cada paso arrastra error de coma flotante y una
   * instruccion de 2000 ms terminaria un cuadro antes o despues segun el
   * caso. Con cuadros enteros el conteo es exacto siempre.
   *
   * El minimo es 1: una instruccion ocupa al menos un cuadro, para que el
   * programa no pueda quedarse girando en vacio dentro del mismo step().
   */
  private aCuadros(ms: number): number {
    const msPorCuadro = this.config.dt * 1000;
    return Math.max(1, Math.round(ms / msPorCuadro));
  }

  /**
   * Devuelve la instruccion que toca ejecutar, o null si ya no queda
   * ninguna.
   *
   * Va desapilando los contextos que se quedaron sin instrucciones: eso es
   * "terminar un si y volver a donde estabamos".
   */
  private instruccionActual(): Instruccion | null {
    while (this.pila.length > 0) {
      const contexto = this.pila[this.pila.length - 1];

      if (contexto.puntero < contexto.instrucciones.length) {
        return contexto.instrucciones[contexto.puntero];
      }

      this.pila.pop();
    }

    return null;
  }
}
