import { RING, type Robot } from '../types';

/** Escala: cuántos píxeles mide un centímetro en pantalla. */
let escala = 1;

/** Configura el canvas y calcula la escala para que el ring quepa. */
export function configurarCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto 2D del canvas');

  const lado = Math.min(canvas.width, canvas.height);
  escala = (lado * 0.9) / (RING.radio * 2);

  return ctx;
}

/** Convierte centímetros del mundo a píxeles de pantalla. */
export function cmAPx(cm: number): number {
  return cm * escala;
}

/** Dibuja el ring: disco negro con franja blanca en el borde. */
export function dibujarRing(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(cx, cy, cmAPx(RING.radio), 0, Math.PI * 2);
  ctx.fillStyle = '#f5f5f5';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, cmAPx(RING.radio - RING.grosorBorde), 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
}


/** Dibuja un robot como rectángulo rotado, con una marca en el frente. */
export function dibujarRobot(ctx: CanvasRenderingContext2D, robot: Robot, color: string): void {
  const cx = ctx.canvas.width / 2;
  const cy = ctx.canvas.height / 2;

  // Pasamos del sistema del mundo (cm, origen al centro) al del canvas (px)
  const px = cx + cmAPx(robot.x);
  const py = cy + cmAPx(robot.y);

  const largo = cmAPx(robot.radio * 2);
  const ancho = cmAPx(robot.anchoEje);

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(robot.theta);

  // Cuerpo: centrado en el origen ya trasladado
  ctx.fillStyle = robot.vivo ? color : '#555';
  ctx.fillRect(-largo / 2, -ancho / 2, largo, ancho);

  // Marca del frente: franja clara en el borde delantero
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(largo / 2 - cmAPx(1.5), -ancho / 2, cmAPx(1.5), ancho);

  ctx.restore();
}