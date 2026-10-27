import { RING, type Robot } from '../types';

/** Calcula cuántos píxeles mide un centímetro para que el ring quepa. */
export function calcularEscala(anchoCanvas: number, altoCanvas: number): number {
  const lado = Math.min(anchoCanvas, altoCanvas);
  return (lado * 0.9) / (RING.radio * 2);
}

/** Convierte centímetros del mundo a píxeles de pantalla. */
export function cmAPx(cm: number, escala: number): number {
  return cm * escala;
}

/** Obtiene el contexto 2D del canvas. */
export function configurarCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');
  return ctx;
}

/** Dibuja el ring: disco negro con franja blanca en el borde. */
export function dibujarRing(ctx: CanvasRenderingContext2D, escala: number): void {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(cx, cy, cmAPx(RING.radio, escala), 0, Math.PI * 2);
  ctx.fillStyle = '#f5f5f5';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, cmAPx(RING.radio - RING.grosorBorde, escala), 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
}

/** Dibuja un robot como rectángulo rotado, con una marca en el frente. */
export function dibujarRobot(
  ctx: CanvasRenderingContext2D,
  robot: Robot,
  color: string,
  escala: number,
): void {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;

  // Pasamos del sistema del mundo (cm, origen al centro) al del canvas (px)
  const px = cx + cmAPx(robot.x, escala);
  const py = cy + cmAPx(robot.y, escala);

  const largo = cmAPx(robot.radio * 2, escala);
  const ancho = cmAPx(robot.anchoEje, escala);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(robot.theta);

  // Cuerpo: centrado en el origen ya trasladado
  ctx.fillStyle = robot.vivo ? color : '#555';
  ctx.fillRect(-largo / 2, -ancho / 2, largo, ancho);

  // Marca del frente: franja clara en el borde delantero
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(largo / 2 - cmAPx(1.5, escala), -ancho / 2, cmAPx(1.5, escala), ancho);

  ctx.restore();
}