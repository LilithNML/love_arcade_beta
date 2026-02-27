/**
 * core/particles.js — Ollin Smash v2.0
 *
 * Manages two visual effect queues:
 *   1. Particle Pool  — square sparks emitted on brick destruction
 *   2. Float Queue    — rising text labels (combo announcements, PU names)
 *
 * Both are internal module state; consumers interact only through the
 * exported functions, never directly with the arrays.
 *
 * Performance contract:
 *   - Fixed pool of POOL_SIZE objects. No allocation occurs during gameplay.
 *   - If the pool is saturated (all active), emit() silently drops new sparks.
 *   - update() and draw() are O(POOL_SIZE + floatQueue.length) each frame.
 */

import { CFG } from '../config.js';

// ── Particle Pool ─────────────────────────────────────────────────────────────

const POOL_SIZE = 220;

/** @type {Array<{active,x,y,vx,vy,life,max,size,color,alpha}>} */
const pool = Array.from({ length: POOL_SIZE }, () => ({
  active: false,
  x: 0, y: 0,
  vx: 0, vy: 0,
  life: 0, max: 0,
  size: 0,
  color: '#fff',
  alpha: 1,
}));

// ── Float Queue ───────────────────────────────────────────────────────────────

/** @type {Array<{x,y,txt,col,life,vy}>} */
const floatQueue = [];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Emit n burst particles from (x, y).
 *
 * @param {number} x
 * @param {number} y
 * @param {string} color  - CSS color string
 * @param {number} [n=10] - Number of particles to spawn
 */
export function emit(x, y, color, n = 10) {
  let spawned = 0;
  for (const p of pool) {
    if (p.active || spawned >= n) continue;
    p.active = true;
    p.x      = x;
    p.y      = y;
    p.color  = color;

    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.5;
    p.vx     = Math.cos(angle) * speed;
    p.vy     = Math.sin(angle) * speed;
    p.max    = p.life = 28 + Math.random() * 30;
    p.size   = 2 + Math.random() * 3.5;
    p.alpha  = 1;
    spawned++;
  }
}

/**
 * Enqueue a floating text message that rises and fades out.
 *
 * @param {number} x
 * @param {number} y
 * @param {string} txt
 * @param {string} [col] - CSS color; defaults to CFG.C.gold
 */
export function addFloat(x, y, txt, col = CFG.C.gold) {
  floatQueue.push({ x, y, txt, col, life: 55, vy: -1.1 });
}

/**
 * Advance all active particles and float messages by one frame.
 * Call once per game loop tick.
 */
export function update() {
  // Particles
  for (const p of pool) {
    if (!p.active) continue;
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.12;                 // soft gravity
    p.alpha = --p.life / p.max;
    if (p.life <= 0) p.active = false;
  }

  // Float texts
  for (let i = floatQueue.length - 1; i >= 0; i--) {
    const f = floatQueue[i];
    f.y   += f.vy;
    f.life--;
    if (f.life <= 0) floatQueue.splice(i, 1);
  }
}

/**
 * Deactivate all particles and clear the float queue.
 * Call on game start / restart.
 */
export function reset() {
  for (const p of pool)  p.active = false;
  floatQueue.length = 0;
}

// ── Draw ──────────────────────────────────────────────────────────────────────

/**
 * Render all active particles onto ctx.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawParticles(ctx) {
  ctx.save();
  for (const p of pool) {
    if (!p.active) continue;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 4;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

/**
 * Render all active float texts onto ctx.
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawFloats(ctx) {
  for (const f of floatQueue) {
    const alpha = Math.min(1, f.life / 18);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = f.col;
    ctx.shadowColor = f.col;
    ctx.shadowBlur  = 12;
    ctx.font        = 'bold 11px "Share Tech Mono",monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(f.txt, f.x, f.y);
    ctx.restore();
  }
}
