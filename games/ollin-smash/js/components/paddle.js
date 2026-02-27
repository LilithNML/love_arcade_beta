/**
 * components/paddle.js — Ollin Smash v2.0
 *
 * Pure rendering functions for the paddle and the decorative grecan borders.
 * No mutable module state.
 *
 * The grecan (stepped fret pattern) is a mesoamerican architectural motif
 * found in Mitla and Teotihuacán. Here it serves as the top and bottom
 * borders of the playing field, reinforcing the Neo-Mexica aesthetic.
 */

import { CFG } from '../config.js';

// ── Grecan Border ─────────────────────────────────────────────────────────────

/**
 * Draw a continuous grecan (stepped fret) border across the full canvas width.
 *
 * Each repeating unit is 4×step wide and consists of two right-angle turns
 * forming a partial square. The pattern tiles seamlessly.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number}  x     - Starting X
 * @param {number}  y     - Baseline Y
 * @param {number}  w     - Total width to cover
 * @param {boolean} [flip=false] - If true, steps extend upward (bottom border)
 */
export function drawGrecan(ctx, x, y, w, flip = false) {
  const STEP = 14;
  const dir  = flip ? -1 : 1;

  ctx.save();
  ctx.strokeStyle = 'rgba(220,38,38,0.22)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);

  let cx = x;
  while (cx < x + w) {
    ctx.lineTo(cx + STEP,     y);
    ctx.lineTo(cx + STEP,     y + dir * 5);
    ctx.lineTo(cx + STEP * 2, y + dir * 5);
    ctx.lineTo(cx + STEP * 2, y + dir * 10);
    ctx.lineTo(cx + STEP * 3, y + dir * 10);
    ctx.lineTo(cx + STEP * 3, y + dir * 5);
    ctx.lineTo(cx + STEP * 4, y + dir * 5);
    ctx.lineTo(cx + STEP * 4, y);
    cx += STEP * 4;
  }

  ctx.stroke();
  ctx.restore();
}

// ── Paddle ────────────────────────────────────────────────────────────────────

/**
 * Draw the paddle with:
 *  - Themed linear gradient fill (violet / crimson / cyan) based on active FX
 *  - Specular highlight strip
 *  - Colored outline with glow
 *  - Seven aztec tick marks (Olmec-inspired decorative notches)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, w: number, h: number }} paddle
 * @param {{ fire: {on:boolean}, magnet: {on:boolean} }}   fx
 */
export function drawPaddle(ctx, paddle, fx) {
  const { x, y, w, h } = paddle;
  const halfW = w / 2;
  const halfH = h / 2;

  // Pick accent color based on active effect
  const col = fx.fire.on   ? CFG.C.crimson
            : fx.magnet.on ? CFG.C.cyan
            : CFG.C.violet;

  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur  = 22;

  // Gradient fill
  const g = ctx.createLinearGradient(x - halfW, y - halfH, x + halfW, y + halfH);
  if (fx.fire.on) {
    g.addColorStop(0, '#DC2626');
    g.addColorStop(1, '#7F1D1D');
  } else if (fx.magnet.on) {
    g.addColorStop(0, '#0E7490');
    g.addColorStop(1, '#164E63');
  } else {
    g.addColorStop(0, '#7C3AED');
    g.addColorStop(1, '#4C1D95');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x - halfW, y - halfH, w, h);

  // Specular highlight — top 3px strip
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(x - halfW + 2, y - halfH + 1, w - 4, 3);

  // Outline
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1;
  ctx.shadowBlur  = 0;
  ctx.strokeRect(x - halfW, y - halfH, w, h);

  // Aztec tick marks (evenly spaced vertical bars)
  const MARKS   = 7;
  const spacing = w / (MARKS + 1);
  ctx.fillStyle = 'rgba(250,204,21,0.55)';
  for (let i = 1; i <= MARKS; i++) {
    ctx.fillRect(x - halfW + spacing * i - 1, y - halfH, 2, 5);
  }

  ctx.restore();
}
