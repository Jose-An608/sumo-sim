import type { ConfiguracionRobot, Instruccion } from '../types.ts';

/**
 * C4 — Exportar el programa como pseudocodigo EV3.
 *
 * Convierte el programa compilado (`Instruccion[]`) en texto que se puede
 * copiar y armar en el robot LEGO real. Es el puente entre el simulador y el
 * robot fisico.
 *
 * El texto habla el idioma del ROBOT, no el del simulador:
 *
 *   - Las velocidades del simulador estan en cm/s (maximo 50). El bloque
 *     Move Tank del EV3 recibe potencia en %. Se convierte con
 *     `velocidad / velocidadMax * 100`.
 *   - Un giro en el simulador se pide en grados. En el robot no hay "girar 90":
 *     hay ruedas en sentidos opuestos durante cierto tiempo. Ese tiempo sale
 *     de la misma formula que usa la VM, para que el texto diga lo mismo que
 *     el simulador hace.
 *
 * Es una funcion pura: no lee el DOM ni Blockly, recibe datos y devuelve
 * texto. Por eso se prueba con programas escritos a mano.
 */

const SANGRIA = '  ';

/**
 * Pasa un programa a pseudocodigo, una instruccion por linea.
 *
 * Recibe la configuracion del robot porque sin ella no se puede convertir:
 * cm/s a % necesita la velocidad maxima, y grados a segundos necesita el
 * ancho entre ruedas.
 */
export function aPseudocodigoEV3(programa: Instruccion[], config: ConfiguracionRobot): string {
  return lineasDePila(programa, config, 0).join('\n');
}

function lineasDePila(pila: Instruccion[], config: ConfiguracionRobot, nivel: number): string[] {
  return pila.flatMap((instruccion) => lineasDe(instruccion, config, nivel));
}

function lineasDe(instruccion: Instruccion, config: ConfiguracionRobot, nivel: number): string[] {
  const sangria = SANGRIA.repeat(nivel);

  switch (instruccion.tipo) {
    case 'detener':
      return [`${sangria}Detener los motores`];

    case 'avanzar': {
      const { velocidad, duracionMs } = instruccion;
      return [`${sangria}Mover tanque: ${ruedas(velocidad, velocidad, duracionMs, config)}`];
    }

    case 'girar':
      return [`${sangria}${textoGiro(instruccion.grados, instruccion.velocidad, config)}`];

    case 'siDistanciaMenor':
      return [
        `${sangria}si el sensor ultrasónico mide menos de ${instruccion.umbral} cm`,
        ...lineasDePila(instruccion.entonces, config, nivel + 1),
      ];

    case 'siBorde':
      return [
        `${sangria}si ${sensorDeBorde(instruccion.lado)} ve borde`,
        ...lineasDePila(instruccion.entonces, config, nivel + 1),
      ];

    case 'repetirSiempre':
      return [`${sangria}repetir siempre`, ...lineasDePila(instruccion.cuerpo, config, nivel + 1)];
  }
}

/** Recorta una velocidad al maximo del motor, como hace la VM. */
function limitar(v: number, config: ConfiguracionRobot): number {
  return Math.max(-config.velocidadMax, Math.min(config.velocidadMax, v));
}

/** cm/s a potencia en %, ya recortada al maximo del motor. */
function potencia(v: number, config: ConfiguracionRobot): number {
  return Math.round((limitar(v, config) / config.velocidadMax) * 100);
}

/** Milisegundos a segundos con dos decimales, sin ceros de sobra: 2, 0.5, 0.38. */
function segundos(ms: number): string {
  return `${Number((ms / 1000).toFixed(2))} s`;
}

/** La parte comun de Move Tank: potencia de cada rueda y duracion. */
function ruedas(izq: number, der: number, ms: number, config: ConfiguracionRobot): string {
  return `izquierda ${potencia(izq, config)}%, derecha ${potencia(der, config)}% durante ${segundos(ms)}`;
}

/**
 * Cuanto dura un giro, en ms.
 *
 * Es la misma formula que `duracionGiroMs` en la VM:
 *   w = 2 * |velocidad| / anchoEje        t = angulo en radianes / w
 *
 * La velocidad se recorta ANTES de calcular. Si se usara la pedida, un giro
 * de 90 grados a 200 cm/s con maximo 50 saldria mucho mas corto de lo que el
 * motor puede hacer: el robot giraria de menos.
 */
function duracionGiroMs(grados: number, velocidad: number, config: ConfiguracionRobot): number {
  const w = (2 * Math.abs(limitar(velocidad, config))) / config.anchoEje;
  if (w === 0) return 0;
  return ((Math.abs(grados) * (Math.PI / 180)) / w) * 1000;
}

/**
 * Un giro: ruedas en sentidos opuestos durante el tiempo que haga falta.
 *
 * Mismo criterio que la VM: grados positivos son horario, y horario es la
 * rueda izquierda hacia delante y la derecha hacia atras.
 */
function textoGiro(grados: number, velocidad: number, config: ConfiguracionRobot): string {
  const horario = grados >= 0;
  const izq = horario ? velocidad : -velocidad;
  const der = -izq;

  // El sentido que se dice sale de las ruedas, no solo del signo de los
  // grados: con velocidad negativa las ruedas giran al reves, y el texto no
  // puede decir "derecha" mientras los numeros mandan el robot a la izquierda.
  // Con velocidad cero no hay sentido: se usa el de los grados.
  const izqReal = limitar(izq, config);
  const derReal = limitar(der, config);
  const haciaLaDerecha = izqReal === derReal ? horario : izqReal > derReal;
  const sentido = haciaLaDerecha ? 'a la derecha' : 'a la izquierda';

  const ms = duracionGiroMs(grados, velocidad, config);

  return `Girar ${Math.abs(grados)}° ${sentido}: mover tanque ${ruedas(izq, der, ms, config)}`;
}

function sensorDeBorde(lado: 'izq' | 'der' | 'cualquiera'): string {
  switch (lado) {
    case 'izq':
      return 'el sensor de color izquierdo';
    case 'der':
      return 'el sensor de color derecho';
    case 'cualquiera':
      return 'algún sensor de color';
  }
}
