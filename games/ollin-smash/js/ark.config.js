/**
 * ark.config.js — Arkanoid · Love Arcade
 * Module A: Configuration, level data, power-up registry, pure math utilities.
 * No side-effects. No DOM access. No imports.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// § GLOBAL CONFIG
// (ARK_ prefix: required by Love Arcade namespacing spec §4)
// ─────────────────────────────────────────────────────────────────
export const ARK_CONFIG = Object.freeze({
  GAME_ID:          'arkanoid',
  COINS_DIVISOR:    100,          // 100 internal pts = 1 Love Arcade coin

  // Lives
  TOTAL_LIVES:      3,

  // Logical (virtual) canvas — UI module scales to real viewport
  LW:               400,
  LH:               640,

  // Ball
  BALL_RADIUS:      7,
  BALL_BASE_SPEED:  290,          // px/sec at level 1
  BALL_SPEED_LEVEL: 25,           // added speed per level
  BALL_MAX_SPEED:   520,
  BALL_TRAIL_LEN:   14,
  // CCD sub-stepping: ball must never travel more than this fraction of
  // its radius per sub-step. Lower = safer but more CPU.
  BALL_CCD_FRACTION: 0.5,
  BALL_CCD_MAX_STEPS: 6,

  // Paddle
  PADDLE_W:         92,
  PADDLE_H:         12,
  PADDLE_Y:         575,          // Y center of paddle
  PADDLE_SPEED:     580,          // px/sec (keyboard)

  // Bricks
  BRICK_COLS:       10,
  BRICK_W:          34,
  BRICK_H:          18,
  BRICK_GAP:        3,
  BRICK_START_X:    13,
  BRICK_START_Y:    64,

  // Power-ups
  PW_FALL_SPEED:    110,
  PW_W:             22,
  PW_H:             22,
  PW_CHANCE:        0.22,
  PW_DURATION:      8000,         // ms for timed power-ups
  PW_SHIELD_MULT:   1.5,          // shield lasts longer

  // Scoring
  SCORE_BRICK_1:    10,
  SCORE_BRICK_2:    25,
  SCORE_COMBO_MULT: 0.5,          // +50% per consecutive hit
  SCORE_LEVEL_BONUS: 500,
  SCORE_LIFE_BONUS: 300,

  // Particles (fixed pool — no dynamic allocation after init)
  PARTICLE_POOL:    220,

  // Shockwave (shield break effect)
  SHOCKWAVE_DURATION: 0.55,       // seconds
  SHOCKWAVE_MAX_R:    90,

  // localStorage keys — ALL prefixed ARK_
  LS_HIGHSCORE:     'ARK_highscore',
  LS_SESSIONS:      'ARK_reportedSessions',
});


// ─────────────────────────────────────────────────────────────────
// § LEVEL DATA
// Brick codes: 0=empty, 1=normal(1hp), 2=hard(2hp), 3=indestructible
// ─────────────────────────────────────────────────────────────────
export const ARK_LEVELS = [
  {
    name: 'PRIMER CONTACTO',
    grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'ZONA DURA',
    grid: [
      [2,1,1,2,1,1,2,1,1,2],
      [1,2,1,1,1,1,1,1,2,1],
      [1,1,2,1,2,2,1,2,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'LA FORTALEZA',
    grid: [
      [3,1,1,1,1,1,1,1,1,3],
      [1,3,2,1,2,2,1,2,3,1],
      [1,2,3,2,1,1,2,3,2,1],
      [1,1,2,3,2,2,3,2,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'DIAMANTE',
    grid: [
      [0,0,0,0,2,2,0,0,0,0],
      [0,0,0,2,1,1,2,0,0,0],
      [0,0,2,1,2,2,1,2,0,0],
      [0,2,1,2,1,1,2,1,2,0],
      [2,1,1,1,2,2,1,1,1,2],
      [1,2,1,2,1,1,2,1,2,1],
      [0,1,1,1,1,1,1,1,1,0],
    ],
  },
  {
    name: 'EL FINAL',
    grid: [
      [3,2,1,2,3,3,2,1,2,3],
      [2,3,2,1,2,2,1,2,3,2],
      [1,2,3,2,1,1,2,3,2,1],
      [2,1,2,3,2,2,3,2,1,2],
      [1,2,1,2,3,3,2,1,2,1],
      [2,1,2,1,1,1,1,2,1,2],
      [1,1,1,1,1,1,1,1,1,1],
    ],
  },
];

// Row palette — neon spectrum top-to-bottom
export const ARK_BRICK_COLORS = [
  '#ff2d5f',
  '#ff6b00',
  '#ffd700',
  '#00e676',
  '#00e5ff',
  '#bb86fc',
  '#ff4081',
];


// ─────────────────────────────────────────────────────────────────
// § POWER-UP REGISTRY
// ─────────────────────────────────────────────────────────────────
export const ARK_PW_TYPES = Object.freeze({
  EXPAND:  { label: 'E',  color: '#00cc66', bg: '#003311', desc: 'Paleta ancha'  },
  MULTI:   { label: 'M',  color: '#00e8ff', bg: '#001e33', desc: 'Multi-bola'    },
  SLOW:    { label: 'S',  color: '#4488ff', bg: '#001133', desc: 'Cámara lenta'  },
  LIFE:    { label: '♥',  color: '#ff1f8f', bg: '#330011', desc: 'Vida extra'    },
  SHIELD:  { label: '🛡', color: '#ffe600', bg: '#332200', desc: 'Escudo'        },
});
export const ARK_PW_KEYS    = Object.keys(ARK_PW_TYPES);
export const ARK_PW_WEIGHTS = [30, 18, 22, 10, 20];


// ─────────────────────────────────────────────────────────────────
// § PURE MATH / UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/** Linear interpolation */
export function ARK_lerp(a, b, t) { return a + (b - a) * t; }

/** Numeric clamp */
export function ARK_clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

/** Uniform random in [min, max) */
export function ARK_rng(min, max) { return min + Math.random() * (max - min); }

/** Random element from array */
export function ARK_pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Weighted random pick.
 * @param {string[]} keys
 * @param {number[]} weights - same length as keys
 * @returns {string}
 */
export function ARK_pickWeighted(keys, weights) {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < keys.length; i++) {
    r -= weights[i];
    if (r <= 0) return keys[i];
  }
  return keys[keys.length - 1];
}

/**
 * Hex color → "R,G,B" string (for rgba() composition).
 * @param {string} hex e.g. '#ff2d5f'
 * @returns {string}
 */
export function ARK_hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
