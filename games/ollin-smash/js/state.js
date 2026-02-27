/**
 * state.js — Ollin Smash v2.0
 *
 * Exports three mutable objects that represent the complete runtime state
 * of a game session. All other modules import these references and mutate
 * their properties directly — never reassigning the exported bindings.
 *
 * Pattern:
 *   import { state, paddle, fx } from '../state.js';
 *   state.score += 10;       // OK  — mutating a property
 *   state = {};              // BAD — ES module bindings are read-only
 *
 * Helper functions (resetState, resetEffects, refreshMult) live here
 * because they operate exclusively on these objects and have no rendering
 * or audio dependencies.
 */

import { CFG } from './config.js';

// ── Core game counters & arrays ───────────────────────────────────────────────

/**
 * @typedef {Object} GameState
 * @property {string}  phase      - 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
 * @property {number}  score      - Accumulated points this session
 * @property {number}  lives      - Remaining lives (0 = game over)
 * @property {number}  wave       - Current wave index (1-based)
 * @property {number}  combo      - Consecutive bricks hit without paddle contact
 * @property {number}  mult       - Current score multiplier (1 | 2 | 4 | 8)
 * @property {string}  sessionId  - Unique ID for idempotent GameCenter reporting
 * @property {Array}   balls      - Live ball descriptors
 * @property {Array}   bricks     - All brick descriptors for the current wave
 * @property {Array}   drops      - In-flight power-up drop items
 * @property {number}  bgVelocity - Smoothed ball speed driving background reactivity
 */
export const state = {
  phase:       'MENU',
  score:       0,
  lives:       3,
  wave:        1,
  combo:       0,
  mult:        1,
  sessionId:   '',
  balls:       [],
  bricks:      [],
  drops:       [],
  bgVelocity:  0,
};

// ── Paddle ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Paddle
 * @property {number} x  - Centre X
 * @property {number} y  - Centre Y
 * @property {number} w  - Full width (may be modified by PU_LONG)
 * @property {number} h  - Height (constant)
 */
export const paddle = {
  x: CFG.W / 2,
  y: CFG.paddleY,
  w: CFG.paddleInitW,
  h: CFG.paddleH,
};

// ── Active Effects ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} FxState
 * @property {{ on: boolean, t: number }}                                long
 * @property {{ on: boolean, t: number }}                                fire
 * @property {{ on: boolean, t: number }}                                slow
 * @property {{ on: boolean, shots: number, held: boolean, heldBall: ?Object }} magnet
 */
export const fx = {
  long:   { on: false, t: 0 },
  fire:   { on: false, t: 0 },
  slow:   { on: false, t: 0 },
  magnet: { on: false, shots: 0, held: false, heldBall: null },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Full reset — called when starting a brand-new game.
 * Clears all counters, arrays and effects.
 */
export function resetState() {
  state.phase      = 'PLAYING';
  state.score      = 0;
  state.lives      = 3;
  state.wave       = 1;
  state.combo      = 0;
  state.mult       = 1;
  state.sessionId  = Date.now().toString(36);
  state.balls      = [];
  state.bricks     = [];
  state.drops      = [];
  state.bgVelocity = 0;

  paddle.x = CFG.W / 2;
  paddle.w = CFG.paddleInitW;

  _clearFx();
}

/**
 * Partial reset — called between waves.
 * Preserves score, lives, wave, sessionId.
 * Clears active effects so the new wave starts clean.
 */
export function resetEffects() {
  paddle.w = CFG.paddleInitW;
  _clearFx();
}

function _clearFx() {
  fx.long.on   = false; fx.long.t  = 0;
  fx.fire.on   = false; fx.fire.t  = 0;
  fx.slow.on   = false; fx.slow.t  = 0;
  fx.magnet.on    = false;
  fx.magnet.shots = 0;
  fx.magnet.held  = false;
  fx.magnet.heldBall = null;
}

/**
 * Recompute the score multiplier from the current combo count.
 * Call this after every combo change.
 */
export function refreshMult() {
  if      (state.combo >= 20) state.mult = 8;
  else if (state.combo >= 10) state.mult = 4;
  else if (state.combo >= 5)  state.mult = 2;
  else                        state.mult = 1;
}
