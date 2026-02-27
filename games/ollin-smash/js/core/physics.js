/**
 * core/physics.js — Ollin Smash v2.0
 *
 * Pure functions: zero side-effects, no imports of mutable state.
 * Safe to unit-test in isolation.
 *
 * Collision model: AABB (Axis-Aligned Bounding Box).
 * The ball is treated as a circle but checked against rectangular bounds,
 * which is sufficient for the game's speed range and brick density.
 */

/**
 * Detect whether a circular ball overlaps an axis-aligned rectangle.
 * Returns the side of first contact, or null if there is no overlap.
 *
 * The "minimum overlap" heuristic picks the axis with the smallest
 * penetration depth, which correctly identifies corner contacts as
 * either horizontal or vertical without extra corner logic.
 *
 * @param {{ x: number, y: number, r: number }} ball
 * @param {{ x: number, y: number, w: number, h: number }} rect  - rect.x/y = top-left corner
 * @returns {'top' | 'bottom' | 'left' | 'right' | null}
 */
export function aabb(ball, rect) {
  const { x, y, r } = ball;

  // Broad phase: bounding-box rejection
  if (x + r < rect.x || x - r > rect.x + rect.w) return null;
  if (y + r < rect.y || y - r > rect.y + rect.h) return null;

  // Penetration depths on each side
  const overlapLeft   = x + r - rect.x;
  const overlapRight  = rect.x + rect.w - (x - r);
  const overlapTop    = y + r - rect.y;
  const overlapBottom = rect.y + rect.h - (y - r);

  const min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

  if (min === overlapLeft)   return 'left';
  if (min === overlapRight)  return 'right';
  if (min === overlapTop)    return 'top';
  return 'bottom';
}

/**
 * Linear interpolation.
 *
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Factor in [0, 1]
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Convert a viewport clientX coordinate to canvas-space X.
 * Accounts for CSS scaling of the canvas element.
 *
 * @param {number}  clientX  - Mouse/touch X in viewport pixels
 * @param {DOMRect} rect     - Canvas bounding client rect
 * @param {number}  canvasW  - Logical canvas width (CFG.W)
 * @returns {number}         - X in canvas pixels
 */
export function toCanvasX(clientX, rect, canvasW) {
  return (clientX - rect.left) * (canvasW / rect.width);
}

/**
 * Compute the launch speed for a ball on a given wave,
 * accounting for the slow power-up.
 *
 * @param {number}  baseSpeed  - CFG.ballBaseSpeed
 * @param {number}  waveMult   - CFG.waveMult
 * @param {number}  wave       - Current wave index (1-based)
 * @param {boolean} slowActive - Whether PU_SLOW is currently active
 * @returns {number}
 */
export function ballSpeed(baseSpeed, waveMult, wave, slowActive = false) {
  const spd = baseSpeed * (1 + (wave - 1) * waveMult);
  return slowActive ? spd * 0.7 : spd;
}
