/**
 * components/ball.js — Ollin Smash v2.0
 *
 * Pure creation and rendering functions for ball objects.
 * No mutable module state; all data lives in state.balls (main.js).
 *
 * Ball descriptor shape:
 *   { x, y, vx, vy, r, trail: [{x,y}], fire: boolean }
 */

import { CFG } from '../config.js';

// ── Creation ──────────────────────────────────────────────────────────────────

/**
 * Create a new ball descriptor.
 *
 * Speed is calculated from the wave index and whether PU_SLOW is active.
 * This makes mkBall the single place that encodes ball speed logic.
 *
 * @param {number}  x          - Spawn X (canvas pixels)
 * @param {number}  y          - Spawn Y (canvas pixels)
 * @param {number}  angle      - Launch direction in radians
 * @param {number}  wave       - Current wave (affects speed)
 * @param {boolean} [fire]     - Whether PU_FIRE is active (ball inherits state)
 * @param {boolean} [slow]     - Whether PU_SLOW is active (speed reduced 30%)
 * @returns {{ x,y,vx,vy,r,trail,fire }}
 */
export function mkBall(x, y, angle, wave, fire = false, slow = false) {
  let spd = CFG.ballBaseSpeed * (1 + (wave - 1) * CFG.waveMult);
  if (slow) spd *= 0.7;
  return {
    x, y,
    vx:    Math.cos(angle) * spd,
    vy:    Math.sin(angle) * spd,
    r:     CFG.ballR,
    trail: [],
    fire,
  };
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Draw a ball with radial gradient fill and colored glow.
 *
 * Fire mode: crimson palette.
 * Normal mode: gold palette.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} ball
 */
export function drawBall(ctx, ball) {
  const col = ball.fire ? CFG.C.crimson : CFG.C.gold;

  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur  = ball.fire ? 22 : 14;

  // Radial gradient: bright highlight off-center → saturated rim
  const g = ctx.createRadialGradient(
    ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 1,
    ball.x, ball.y, ball.r
  );
  g.addColorStop(0,   'rgba(255,255,255,0.92)');
  g.addColorStop(0.4, col);
  g.addColorStop(1,   col + '80');

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the motion trail behind a ball.
 * Older trail segments are smaller and more transparent.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} ball
 */
export function drawTrail(ctx, ball) {
  const n = ball.trail.length;
  for (let i = 0; i < n; i++) {
    const t    = ball.trail[i];
    const prog = i / n;                 // 0 = oldest, 1 = newest
    const col  = ball.fire
      ? `rgba(220,38,38,${prog * 0.28})`
      : `rgba(250,204,21,${prog * 0.25})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(t.x, t.y, ball.r * prog * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}
