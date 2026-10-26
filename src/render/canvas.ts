import { RING } from '../types';

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