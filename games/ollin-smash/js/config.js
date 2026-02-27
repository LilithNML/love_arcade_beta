/**
 * config.js — Ollin Smash v2.0
 *
 * Single source of truth for every numeric constant, dimension and
 * color value used across the game. Changing a value here propagates
 * automatically to all modules that import CFG.
 *
 * Rules:
 *  - No logic, no side-effects — pure data.
 *  - Object is frozen at module level to prevent accidental mutation.
 *  - All dimensions are in logical canvas pixels (390 × 700 grid).
 */

export const CFG = Object.freeze({
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Identifier sent to window.GameCenter.completeLevel() */
  gameId: 'ollin_smash',

  // ── Canvas ─────────────────────────────────────────────────────────────────
  /** Logical canvas width in pixels */
  W: 390,
  /** Logical canvas height in pixels */
  H: 700,

  // ── Paddle ─────────────────────────────────────────────────────────────────
  paddleH:     12,
  paddleInitW: 72,
  /** Vertical centre of the paddle in canvas-space */
  paddleY:     648,

  // ── Ball ───────────────────────────────────────────────────────────────────
  ballR:        7,
  /** Base speed (px/frame) at wave 1 */
  ballBaseSpeed: 5.0,
  /** Speed multiplier added per wave: speed = base × (1 + (wave-1) × waveMult) */
  waveMult:     0.07,

  // ── Bricks ─────────────────────────────────────────────────────────────────
  brickCols:    6,
  brickW:       52,
  brickH:       18,
  brickGapX:    9,
  brickGapY:    7,
  /** Y position of the top edge of the first brick row */
  brickTopY:    82,
  /** Starting number of rows on wave 1 */
  brickRowBase: 5,
  /** Hard-brick spawn probability for wave > 3 */
  hardBrickProb: 0.18,

  // ── Power-ups ──────────────────────────────────────────────────────────────
  puFallSpeed:  2.6,

  // ── Economy ────────────────────────────────────────────────────────────────
  /** score ÷ coinsDiv = Love Arcade coins awarded */
  coinsDiv: 10,

  // ── Colors ─────────────────────────────────────────────────────────────────
  /**
   * Named color tokens used by canvas drawing routines.
   * These intentionally mirror the CSS custom properties in styles.css.
   */
  C: Object.freeze({
    crimson: '#DC2626',
    violet:  '#7C3AED',
    gold:    '#FACC15',
    cyan:    '#06B6D4',
    green:   '#22C55E',
    pink:    '#EC4899',
  }),
});
