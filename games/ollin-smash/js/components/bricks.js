/**
 * components/bricks.js — Ollin Smash v2.0
 *
 * Responsible for:
 *  - Procedural generation of brick grids (genBricks)
 *  - Canvas rendering of the brick field (drawBricks)
 *
 * No mutable state is kept here. genBricks() returns a fresh array each
 * call; the caller (main.js) stores it in state.bricks.
 */

import { CFG } from '../config.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Brick fill colors cycled by (row + col + wave) to produce a diagonal band pattern */
const BRICK_COLORS = [
  CFG.C.crimson,
  CFG.C.violet,
  '#9333EA',   // purple-600
  '#BE185D',   // pink-700
  '#0891B2',   // cyan-600
  '#047857',   // emerald-700
];

/** Power-up type identifiers. Must match the keys in powerups.js DROP_DRAW. */
const PU_TYPES = ['multi', 'long', 'fire', 'slow', 'magnet'];

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Generate a full grid of brick descriptors for the given wave.
 *
 * Scaling rules:
 *  - Row count increases by 1 per wave up to a cap of brickRowBase + 7.
 *  - Hard bricks (hp: 2) appear randomly for wave > 3 at probability hardBrickProb.
 *  - Power-up count = min(wave, 3); positions are chosen without replacement.
 *
 * @param   {number} wave - Current wave index (1-based)
 * @returns {Array}       - Array of brick descriptor objects
 */
export function genBricks(wave) {
  const rows   = CFG.brickRowBase + Math.min(wave - 1, 7);
  const cols   = CFG.brickCols;
  const totalW = cols * CFG.brickW + (cols - 1) * CFG.brickGapX;
  const startX = (CFG.W - totalW) / 2;

  // Pick unique indices for power-up bricks
  const puCount = Math.min(wave, 3);
  const puSet   = new Set();
  while (puSet.size < puCount) {
    puSet.add(Math.floor(Math.random() * rows * cols));
  }

  const bricks = [];
  let   idx    = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const hard = wave > 3 && Math.random() < CFG.hardBrickProb;

      bricks.push({
        x:     startX + c * (CFG.brickW + CFG.brickGapX),
        y:     CFG.brickTopY + r * (CFG.brickH + CFG.brickGapY),
        w:     CFG.brickW,
        h:     CFG.brickH,
        hp:    hard ? 2 : 1,
        maxHp: hard ? 2 : 1,
        color: BRICK_COLORS[(r + c + wave) % BRICK_COLORS.length],
        pu:    puSet.has(idx)
               ? PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)]
               : null,
        alive: true,
        /** flash > 0 for the frames immediately after a hit (visual feedback) */
        flash: 0,
      });
      idx++;
    }
  }

  return bricks;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Draw the entire brick field onto ctx.
 * Skips destroyed bricks (alive === false).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} bricks - state.bricks
 */
export function drawBricks(ctx, bricks) {
  for (const bk of bricks) {
    if (!bk.alive) continue;

    const flashT = bk.flash / 9;   // normalised 0–1
    ctx.save();

    // Glow intensifies on hit
    ctx.shadowColor = bk.color;
    ctx.shadowBlur  = 8 + flashT * 15;

    // Fill: white flash on hit, then tinted color
    ctx.fillStyle = flashT > 0
      ? `rgba(255,255,255,${0.25 + flashT * 0.65})`
      : bk.color + Math.round((flashT > 0 ? 0.5 + flashT * 0.5 : 0.82) * 255)
                       .toString(16).padStart(2, '0');
    ctx.fillRect(bk.x, bk.y, bk.w, bk.h);

    // Outline
    ctx.strokeStyle = bk.color;
    ctx.lineWidth   = 1;
    ctx.shadowBlur  = 0;
    ctx.strokeRect(bk.x, bk.y, bk.w, bk.h);

    // Hard-brick indicator: two vertical bars on the right edge
    if (bk.maxHp > 1 && bk.hp === bk.maxHp) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bk.x + bk.w - 9,  bk.y + 2, 3, bk.h - 4);
      ctx.fillRect(bk.x + bk.w - 14, bk.y + 2, 3, bk.h - 4);
    }

    // Power-up indicator: glowing centre dot
    if (bk.pu) {
      ctx.fillStyle   = CFG.C.gold;
      ctx.shadowColor = CFG.C.gold;
      ctx.shadowBlur  = 5;
      ctx.beginPath();
      ctx.arc(bk.x + bk.w / 2, bk.y + bk.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
