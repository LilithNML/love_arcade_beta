/**
 * ark.config.js — Arkanoid · Love Arcade  v3.0.0
 * Module A: Configuration, procedural level generator, power-up
 * registry, pure math utilities.
 *
 * No side-effects. No DOM access. No imports.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// § GLOBAL CONFIG
// ─────────────────────────────────────────────────────────────────
export const ARK_CONFIG = Object.freeze({
  GAME_ID:          'ollin_smash',
  COINS_DIVISOR:    100,          // 100 internal pts = 1 Love Arcade coin

  TOTAL_LIVES:      3,

  // Logical (virtual) canvas — UI scales to real viewport
  LW:               400,
  LH:               640,

  // Ball
  BALL_RADIUS:      7,
  BALL_BASE_SPEED:  290,          // px/sec at level 1
  BALL_SPEED_LEVEL: 18,           // added speed per level (slowed from 25 for longer runs)
  BALL_MAX_SPEED:   540,          // cap — reached at roughly level 14
  BALL_TRAIL_LEN:   14,

  // Sub-stepping (physics stability)
  // 1/60 threshold → 2 passes at 30fps; 1 pass at 60fps
  SUB_DT_THRESHOLD: 1 / 60,

  // Paddle
  PADDLE_W:         92,
  PADDLE_H:         12,
  PADDLE_Y:         575,
  PADDLE_SPEED:     580,

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
  PW_DURATION:      10000,        // ms — base duration for timed power-ups (EXPAND, SHIELD)
  PW_SHIELD_MULT:   1.5,
  PW_FIRE_DURATION: 8000,         // ms — FIRE power-up (increased from 6000 for better feel)
  PW_SLOW_DURATION: 10000,        // ms — SLOW power-up (separate, longer duration)

  // Scoring
  SCORE_BRICK_1:    10,
  SCORE_BRICK_2:    25,
  SCORE_BRICK_FIRE: 8,            // per-brick score in fire mode (slightly less — spray effect)
  SCORE_COMBO_MULT: 0.5,
  SCORE_LEVEL_BONUS:500,
  SCORE_LIFE_BONUS: 300,

  // Particles — capped at 20 for low-end GPU performance
  PARTICLE_POOL:    20,

  // Shockwave (shield-break)
  SHOCKWAVE_DURATION: 0.55,
  SHOCKWAVE_MAX_R:    90,

  // Infinite level system
  LEVELS_PER_WORLD: 10,

  // localStorage keys — ALL prefixed ARK_
  LS_HIGHSCORE:     'ARK_highscore',
  LS_SESSIONS:      'ARK_reportedSessions',
  LS_BEST_LEVEL:    'ARK_bestLevel',
});

// ─────────────────────────────────────────────────────────────────
// § BRICK COLORS — neon row palette
// ─────────────────────────────────────────────────────────────────
export const ARK_BRICK_COLORS = [
  '#ff2d5f',  // row 0 — crimson
  '#ff6b00',  // row 1 — orange
  '#ffd700',  // row 2 — gold
  '#00e676',  // row 3 — green
  '#00e5ff',  // row 4 — cyan
  '#bb86fc',  // row 5 — violet
  '#ff4081',  // row 6 — pink
  '#40c4ff',  // row 7 — sky
  '#69ff47',  // row 8 — lime
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
  FIRE:    { label: '🔥', color: '#ff6600', bg: '#330d00', desc: 'Bola de fuego' },
});
export const ARK_PW_KEYS    = Object.keys(ARK_PW_TYPES);
export const ARK_PW_WEIGHTS = [28, 18, 20, 10, 18, 6];  // FIRE is rare

// ─────────────────────────────────────────────────────────────────
// § WORLD NAME TABLE
// Every LEVELS_PER_WORLD levels = new world.
// ─────────────────────────────────────────────────────────────────
const _WORLD_NAMES = [
  'CYBER GRID',   // world 1  (levels  1–10)
  'NEON STORM',   // world 2  (levels 11–20)
  'DARK MATTER',  // world 3  (levels 21–30)
  'PLASMA CORE',  // world 4  (levels 31–40)
  'VOID NEXUS',   // world 5  (levels 41–50)
  'QUANTUM FLUX', // world 6  (levels 51–60)
  'BINARY ABYSS', // world 7  (levels 61–70)
  'PHOTON WAVE',  // world 8  (levels 71–80)
  'SINGULARITY',  // world 9  (levels 81–90)
  'DEEP VOID',    // world 10 (levels 91–100)
];

function _worldName(worldIndex) {
  if (worldIndex < _WORLD_NAMES.length) return _WORLD_NAMES[worldIndex];
  return `SECTOR ${worldIndex + 1}`;
}

// ─────────────────────────────────────────────────────────────────
// § PROCEDURAL LEVEL GENERATOR
// ─────────────────────────────────────────────────────────────────
//
// Brick codes:
//   0 — empty
//   1 — normal   (1 hp,  10 pts)
//   2 — hard     (2 hp,  25 pts)
//   3 — steel    (∞ hp,   0 pts — indestructible, deflects ball)
//
// Difficulty parameters scale with levelIndex (0-based):
//   rows       → increases from 3 up to 9 (max at level ~18)
//   hardP      → probability a non-empty cell becomes type 2
//   indestrP   → probability a non-empty cell becomes type 3
//   density    → fraction of cells that are filled
//
// Pattern cycle (10 patterns → repeats every world):
//   0 FILLED      – dense rows with slight random dropout
//   1 CHECKERBOARD– alternating cells
//   2 DIAMOND     – rhombus centered on the grid
//   3 ZIGZAG      – diagonal stripe bands
//   4 V-SHAPE     – inverted V pointing down
//   5 CROSS       – plus-sign layout
//   6 WAVES       – sinusoidal density gradient
//   7 COLUMNS     – alternating vertical bands
//   8 ARCH        – top-heavy arch structure
//   9 FORTRESS    – boss level: indestructible outer ring + mixed interior
// ─────────────────────────────────────────────────────────────────

/** Resolve cell type based on position and difficulty probabilities. */
function _brickType(row, rows, hardP, indestrP) {
  // Top rows skew harder (harder to reach → more rewarding)
  const rowBias = 1 - row / rows;       // 1.0 at top, 0.0 at bottom
  const adjIndestr = indestrP * (0.5 + rowBias * 0.5);
  const adjHard    = hardP    * (0.4 + rowBias * 0.6);

  const r = Math.random();
  if (r < adjIndestr)               return 3;
  if (r < adjIndestr + adjHard)     return 2;
  return 1;
}

/** Generate a blank rows×cols grid filled with 0. */
function _emptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

/** Fill a single cell using density + brick type probabilities. */
function _fill(grid, r, c, rows, density, hardP, indestrP) {
  if (Math.random() < density) {
    grid[r][c] = _brickType(r, rows, hardP, indestrP);
  }
}

// ── Pattern implementations ────────────────────────────────────
function _patternFilled(rows, cols, density, hardP, indestrP) {
  const g = _emptyGrid(rows, cols);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      _fill(g, r, c, rows, density, hardP, indestrP);
  return g;
}

function _patternCheckerboard(rows, cols, density, hardP, indestrP) {
  const g = _emptyGrid(rows, cols);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if ((r + c) % 2 === 0)
        _fill(g, r, c, rows, density, hardP, indestrP);
  return g;
}

function _patternDiamond(rows, cols, density, hardP, indestrP) {
  const g   = _emptyGrid(rows, cols);
  const cx  = (cols - 1) / 2;
  const cy  = (rows - 1) / 2;
  const max = Math.min(cx, cy) + 0.5;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const dist = Math.abs(c - cx) / cx + Math.abs(r - cy) / cy;
      if (dist <= 1.05)
        _fill(g, r, c, rows, density, hardP, indestrP);
    }
  return g;
}

function _patternZigzag(rows, cols, density, hardP, indestrP) {
  const g = _emptyGrid(rows, cols);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (((r + c) % 4) < 2)
        _fill(g, r, c, rows, density, hardP, indestrP);
  return g;
}

function _patternVShape(rows, cols, density, hardP, indestrP) {
  const g    = _emptyGrid(rows, cols);
  const half = cols / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      // V arm: distance from center increases with depth
      const armDist = Math.abs(c - half + 0.5);
      const vLimit  = (r / (rows - 1)) * half * 1.1;
      if (armDist <= vLimit + 0.6)
        _fill(g, r, c, rows, density, hardP, indestrP);
    }
  return g;
}

function _patternCross(rows, cols, density, hardP, indestrP) {
  const g    = _emptyGrid(rows, cols);
  const midR = Math.floor(rows / 2);
  const midC = Math.floor(cols / 2);
  const arm  = Math.min(2, Math.floor(rows / 4));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const inV = Math.abs(c - midC) <= arm;
      const inH = Math.abs(r - midR) <= arm;
      if (inV || inH)
        _fill(g, r, c, rows, density, hardP, indestrP);
    }
  return g;
}

function _patternWaves(rows, cols, density, hardP, indestrP) {
  const g = _emptyGrid(rows, cols);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      // Wave crests alternate row by row
      const wave = Math.sin((c / cols) * Math.PI * 2 + r * 0.8);
      const waveDensity = density * (0.5 + 0.5 * (wave + 1) / 2);
      if (Math.random() < waveDensity)
        g[r][c] = _brickType(r, rows, hardP, indestrP);
    }
  return g;
}

function _patternColumns(rows, cols, density, hardP, indestrP) {
  const g = _emptyGrid(rows, cols);
  const bw = 2; // band width
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (Math.floor(c / bw) % 2 === 0)
        _fill(g, r, c, rows, density, hardP, indestrP);
  return g;
}

function _patternArch(rows, cols, density, hardP, indestrP) {
  const g  = _emptyGrid(rows, cols);
  const cx = (cols - 1) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      // Arch: top rows full, curves inward toward center bottom
      const curveFactor = ((c - cx) / cx) ** 2; // 0 at center, 1 at edges
      const archStart   = Math.floor(curveFactor * rows * 0.7);
      if (r >= archStart)
        _fill(g, r, c, rows, density, hardP, indestrP);
    }
  return g;
}

function _patternFortress(rows, cols, indestrP, hardP) {
  // Boss level — forced maximum structure
  const g = _emptyGrid(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isOuter = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
      const isInner = r > 1 && r < rows - 2 && c > 1 && c < cols - 2;
      if (isOuter) {
        g[r][c] = 3; // indestructible ring
      } else if (isInner) {
        g[r][c] = _brickType(r, rows, hardP, Math.min(indestrP * 1.5, 0.4));
      } else {
        g[r][c] = 2; // hard middle layer
      }
    }
  }
  return g;
}

// ── Pattern dispatcher ────────────────────────────────────────
const _PATTERNS = [
  'FILLED',
  'CHECKERBOARD',
  'DIAMOND',
  'ZIGZAG',
  'V-SHAPE',
  'CROSS',
  'WAVES',
  'COLUMNS',
  'ARCH',
  'FORTRESS',
];

function _buildGrid(patternIndex, rows, cols, density, hardP, indestrP) {
  const p = _PATTERNS[patternIndex % _PATTERNS.length];
  switch (p) {
    case 'FILLED':       return _patternFilled      (rows, cols, density, hardP, indestrP);
    case 'CHECKERBOARD': return _patternCheckerboard(rows, cols, density, hardP, indestrP);
    case 'DIAMOND':      return _patternDiamond     (rows, cols, density, hardP, indestrP);
    case 'ZIGZAG':       return _patternZigzag      (rows, cols, density, hardP, indestrP);
    case 'V-SHAPE':      return _patternVShape      (rows, cols, density, hardP, indestrP);
    case 'CROSS':        return _patternCross       (rows, cols, density, hardP, indestrP);
    case 'WAVES':        return _patternWaves       (rows, cols, density, hardP, indestrP);
    case 'COLUMNS':      return _patternColumns     (rows, cols, density, hardP, indestrP);
    case 'ARCH':         return _patternArch        (rows, cols, density, hardP, indestrP);
    case 'FORTRESS':     return _patternFortress    (rows, cols, indestrP, hardP);
    default:             return _patternFilled      (rows, cols, density, hardP, indestrP);
  }
}

// ── Public generator ──────────────────────────────────────────

/**
 * Procedurally generate a level given its 0-based index.
 * Difficulty, row count, brick types, and pattern all scale with n.
 *
 * @param   {number} n  0-based level index (unbounded)
 * @returns {{ name: string, grid: number[][], worldIndex: number, levelInWorld: number }}
 */
export function generateLevel(n) {
  const C         = ARK_CONFIG;
  const cols      = C.BRICK_COLS;
  const lpw       = C.LEVELS_PER_WORLD;
  const worldIdx  = Math.floor(n / lpw);
  const levelPos  = n % lpw;                     // 0-9 within the world
  const isBoss    = levelPos === lpw - 1;        // last level in world = boss

  // Difficulty curves (all clamped)
  const rows     = Math.min(9, 3 + Math.floor(n / 3));
  const density  = Math.min(1.0, 0.58 + n * 0.024);
  const hardP    = Math.min(0.65, n * 0.045);
  const indestrP = Math.min(0.30, Math.max(0, (n - 5) * 0.022));

  // Pattern: boss always uses FORTRESS (index 9), others cycle 0-8
  const patternIdx = isBoss ? 9 : levelPos % 9;

  const grid = _buildGrid(patternIdx, rows, cols, density, hardP, indestrP);

  // Ensure at least a few destructible bricks exist (failsafe)
  let destructible = grid.flat().filter(v => v > 0 && v < 3).length;
  if (destructible < 4) {
    for (let r = rows - 1; r >= 0 && destructible < 4; r--) {
      for (let c = 0; c < cols && destructible < 4; c++) {
        if (grid[r][c] === 0) { grid[r][c] = 1; destructible++; }
      }
    }
  }

  const worldName = _worldName(worldIdx);
  const lvlLabel  = levelPos + 1;
  const name      = isBoss
    ? `${worldName} — JEFE`
    : `${worldName} ${lvlLabel}`;

  return {
    name,
    grid,
    worldIndex:   worldIdx,
    levelInWorld: levelPos,
    isBoss,
    patternName:  _PATTERNS[patternIdx % _PATTERNS.length],
  };
}

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
 * @param {number[]} weights
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
 * Hex color → "R,G,B" string for rgba() composition.
 * @param {string} hex  e.g. '#ff2d5f'
 */
export function ARK_hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
