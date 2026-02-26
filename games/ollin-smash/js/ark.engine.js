/**
 * ark.engine.js — Arkanoid · Love Arcade
 * Module B: Physics, collision detection, game state and event bus.
 *
 * CONTRACTS (public API):
 *   startLevel(levelIndex)
 *   tick(dt)
 *   launchBall()
 *   movePaddle(dx)
 *   setPaddleX(x)
 *   pause() / resume()
 *   on(event, handler) / off(event, handler)
 *   getState() → serializable snapshot
 *
 * Engine emits:
 *   'stateChange'     {}  (UI calls getState() if it needs details)
 *   'brickDestroyed'  { brick, score }
 *   'powerUp'         { type }
 *   'lifeLost'        { lives }
 *   'lifeGained'      { lives }
 *   'shieldBroke'     {}
 *   'levelComplete'   { levelIndex, score }
 *   'gameOver'        { score }
 *
 * NO DOM access. NO window references. Pure game logic.
 *
 * ── Sub-stepping ─────────────────────────────────────────────────
 * The tick loop uses a threshold-based 2-step strategy:
 *
 *   if (dt > SUB_DT_THRESHOLD)  →  2 passes of dt/2
 *   else                        →  1 pass  of dt
 *
 * SUB_DT_THRESHOLD = 1/60 ≈ 0.01667 s
 *
 * At 60fps  → dt ≈ 0.0167 → 1 sub-step  (no overhead)
 * At 30fps  → dt ≈ 0.0333 → 2 sub-steps (each 0.0167, max ball
 *             travel = 520 × 0.0167 ≈ 8.7px, well below BALL_RADIUS=7)
 * At ≥30fps the ball can never skip a surface, satisfying the DoD.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import {
  ARK_CONFIG,
  ARK_LEVELS,
  ARK_BRICK_COLORS,
  ARK_PW_KEYS,
  ARK_PW_WEIGHTS,
  ARK_clamp,
  ARK_rng,
  ARK_pickWeighted,
} from './ark.config.js';

// ─────────────────────────────────────────────────────────────────
// § CONSTANTS (module-private)
// ─────────────────────────────────────────────────────────────────
const C = ARK_CONFIG;

/**
 * dt threshold above which the physics step is split in two.
 * At exactly 60fps → dt ≈ 0.01667 (equals threshold → 1 step).
 * Any lower framerate → 2 steps.
 */
const SUB_DT_THRESHOLD = 1 / 60; // ~0.01667 s

// ─────────────────────────────────────────────────────────────────
// § PARTICLE OBJECT POOL
// Pre-allocated fixed-size pool: zero heap allocation during gameplay.
// _allocParticle() walks forward from a cursor and returns the first
// dead slot; if the pool is exhausted it evicts the oldest entry.
// ─────────────────────────────────────────────────────────────────
const _particlePool = Array.from({ length: C.PARTICLE_POOL }, () => ({
  alive: false,
  x: 0, y: 0, vx: 0, vy: 0,
  life: 0, decay: 0, size: 0, color: '#fff',
}));
let _poolCursor = 0;

function _allocParticle() {
  const len = _particlePool.length;
  for (let i = 0; i < len; i++) {
    const idx = (_poolCursor + i) % len;
    if (!_particlePool[idx].alive) {
      _poolCursor = (idx + 1) % len;
      return _particlePool[idx];
    }
  }
  // Pool exhausted — evict oldest (cursor position)
  const p = _particlePool[_poolCursor];
  _poolCursor = (_poolCursor + 1) % len;
  return p;
}

// ─────────────────────────────────────────────────────────────────
// § EVENT BUS
// ─────────────────────────────────────────────────────────────────
const _handlers = {};

function _emit(evt, data) {
  const list = _handlers[evt];
  if (!list) return;
  for (let i = 0; i < list.length; i++) list[i](data);
}

export function on(evt, fn) {
  if (!_handlers[evt]) _handlers[evt] = [];
  _handlers[evt].push(fn);
}

export function off(evt, fn) {
  if (!_handlers[evt]) return;
  _handlers[evt] = _handlers[evt].filter(h => h !== fn);
}

// ─────────────────────────────────────────────────────────────────
// § GAME STATE (private)
// ─────────────────────────────────────────────────────────────────
let S = {};

// ─────────────────────────────────────────────────────────────────
// § GEOMETRY HELPERS
// ─────────────────────────────────────────────────────────────────

function _brickRect(b) {
  return {
    x: b.gx * (C.BRICK_W + C.BRICK_GAP) + C.BRICK_START_X,
    y: b.gy * (C.BRICK_H + C.BRICK_GAP) + C.BRICK_START_Y,
    w: C.BRICK_W,
    h: C.BRICK_H,
  };
}

function _buildBricks(grid) {
  const bricks = [];
  for (let gy = 0; gy < grid.length; gy++) {
    for (let gx = 0; gx < grid[gy].length; gx++) {
      const type = grid[gy][gx];
      if (type === 0) continue;
      bricks.push({ gx, gy, type, hp: type === 3 ? Infinity : type, dead: false });
    }
  }
  return bricks;
}

function _countDestructible(bricks) {
  return bricks.filter(b => b.hp !== Infinity && !b.dead).length;
}

// ─────────────────────────────────────────────────────────────────
// § OBJECT FACTORIES
// ─────────────────────────────────────────────────────────────────

function _createBall(x, y, speed, angleRad) {
  return {
    x, y,
    vx:    Math.sin(angleRad) * speed,
    vy:    -Math.cos(angleRad) * speed,
    speed,
    trail: [],
    stuck: false,
  };
}

function _createPowerUp(x, y) {
  const type = ARK_pickWeighted(ARK_PW_KEYS, ARK_PW_WEIGHTS);
  return { x, y, type, vy: C.PW_FALL_SPEED, alive: true };
}

// ─────────────────────────────────────────────────────────────────
// § EFFECT SPAWNERS
// ─────────────────────────────────────────────────────────────────

function _spawnParticles(px, py, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = ARK_rng(60, 200);
    const p     = _allocParticle();
    p.alive = true;
    p.x     = px;
    p.y     = py;
    p.vx    = Math.cos(angle) * spd;
    p.vy    = Math.sin(angle) * spd - 40;
    p.life  = 1;
    p.decay = ARK_rng(1.2, 2.8);
    p.size  = ARK_rng(2, 5);
    p.color = color;
  }
}

function _spawnShockwave(x, y) {
  S.shockwaves.push({ x, y, r: 10, life: 1 });
}

// ─────────────────────────────────────────────────────────────────
// § COLLISION DETECTION
// ─────────────────────────────────────────────────────────────────

/** Circle vs AABB broad + narrow phase. */
function _circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nearX = ARK_clamp(cx, rx, rx + rw);
  const nearY = ARK_clamp(cy, ry, ry + rh);
  const dx    = cx - nearX;
  const dy    = cy - nearY;
  return dx * dx + dy * dy < r * r;
}

/**
 * Resolve circle vs AABB collision using axis-overlap method.
 * Reflects on the axis with the smaller overlap, then depenetrates.
 */
function _resolveBallBrick(ball, b) {
  const rect     = _brickRect(b);
  const cx       = rect.x + rect.w / 2;
  const cy       = rect.y + rect.h / 2;
  const dx       = ball.x - cx;
  const dy       = ball.y - cy;
  const overlapX = (rect.w / 2 + C.BALL_RADIUS) - Math.abs(dx);
  const overlapY = (rect.h / 2 + C.BALL_RADIUS) - Math.abs(dy);

  if (overlapX < overlapY) {
    ball.vx  = Math.sign(dx) * Math.abs(ball.vx || ball.speed);
    ball.x  += Math.sign(dx) * (overlapX + 0.5);
  } else {
    ball.vy  = Math.sign(dy) * Math.abs(ball.vy || ball.speed);
    ball.y  += Math.sign(dy) * (overlapY + 0.5);
  }
}

/**
 * Resolve ball vs paddle.
 * Angle is proportional to hit position (–1..+1 → –60°..+60°).
 * Returns true if a collision was resolved.
 */
function _resolveBallPaddle(ball) {
  const pw  = S.paddleW;
  const px  = S.paddleX - pw / 2;
  const py  = C.PADDLE_Y - C.PADDLE_H / 2;

  if (!_circleRect(ball.x, ball.y, C.BALL_RADIUS, px, py, pw, C.PADDLE_H)) return false;
  if (ball.vy < 0) return false;    // ball is already moving upward — skip

  const hitPos = (ball.x - S.paddleX) / (pw / 2); // –1..+1
  const angle  = hitPos * (Math.PI / 3);            // max ±60°
  ball.vx      = Math.sin(angle) * ball.speed;
  ball.vy      = -Math.cos(angle) * ball.speed;
  ball.y       = py - C.BALL_RADIUS - 1;            // depenetrate upward
  S.combo      = 0;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// § POWER-UP EFFECTS
// ─────────────────────────────────────────────────────────────────

function _applyPowerUp(type) {
  switch (type) {
    case 'EXPAND':
      S.paddleW     = Math.min(C.PADDLE_W * 1.65, C.LW * 0.7);
      S.expandTimer = C.PW_DURATION;
      break;

    case 'MULTI': {
      const src = S.balls.find(b => !b.stuck) || S.balls[0];
      if (!src) break;
      const a0 = Math.atan2(src.vx, -src.vy);
      S.balls.push(_createBall(src.x, src.y, src.speed, a0 + Math.PI / 5));
      S.balls.push(_createBall(src.x, src.y, src.speed, a0 - Math.PI / 5));
      break;
    }

    case 'SLOW':
      S.slowTimer = C.PW_DURATION;
      S.balls.forEach(b => {
        const slowSpd = b.speed * 0.58;
        const len     = Math.hypot(b.vx, b.vy);
        if (len > 0) { b.vx = (b.vx / len) * slowSpd; b.vy = (b.vy / len) * slowSpd; }
      });
      break;

    case 'LIFE':
      S.lives = Math.min(S.lives + 1, 7);
      _emit('lifeGained', { lives: S.lives });
      break;

    case 'SHIELD':
      S.shield      = true;
      S.shieldTimer = C.PW_DURATION * C.PW_SHIELD_MULT;
      break;
  }
}

// ─────────────────────────────────────────────────────────────────
// § RESPAWN
// ─────────────────────────────────────────────────────────────────

function _respawnBall() {
  const ball     = _createBall(S.paddleX, C.PADDLE_Y - C.PADDLE_H, S.ballSpeed, 0);
  ball.stuck     = true;
  S.balls        = [ball];    // single ball after life loss
  // Cancel speed-affecting power-ups
  S.paddleW      = C.PADDLE_W;
  S.expandTimer  = 0;
  S.slowTimer    = 0;
}

// ─────────────────────────────────────────────────────────────────
// § PHYSICS STEP
// Extracted from tick() so it can be called identically for each
// sub-step without duplicating code.
// ─────────────────────────────────────────────────────────────────

/**
 * Advance all ball positions by subDt and resolve collisions.
 * Returns a Set of ball indices that exited the bottom boundary.
 * @param {number} subDt
 * @param {boolean} updateTrail  — only true for the first sub-step
 * @returns {Set<number>}
 */
function _physicsStep(subDt, updateTrail) {
  const deadIndices = new Set();
  const r           = C.BALL_RADIUS;

  for (let bi = 0; bi < S.balls.length; bi++) {
    const ball = S.balls[bi];

    // Stuck balls follow the paddle — no physics
    if (ball.stuck) {
      ball.x = S.paddleX;
      ball.y = C.PADDLE_Y - C.PADDLE_H - r;
      continue;
    }

    // Trail: one point per frame (first sub-step only)
    if (updateTrail) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > C.BALL_TRAIL_LEN) ball.trail.shift();
    }

    // Integrate position
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    // ── Wall collisions ────────────────────────────────────────────
    if (ball.x - r < 0)      { ball.x = r;        ball.vx =  Math.abs(ball.vx); }
    if (ball.x + r > C.LW)   { ball.x = C.LW - r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - r < 0)      { ball.y = r;         ball.vy =  Math.abs(ball.vy); }

    // ── Bottom boundary — mark as dead ────────────────────────────
    if (ball.y - r > C.LH) {
      deadIndices.add(bi);
      continue;
    }

    // ── Paddle ────────────────────────────────────────────────────
    _resolveBallPaddle(ball);

    // ── Bricks — at most one resolved per sub-step ────────────────
    // Resolving only one collision per step avoids double-reflections
    // when two bricks are adjacent and both overlap the ball.
    let hitThisStep = false;
    for (const brick of S.bricks) {
      if (brick.dead || brick.hp <= 0) continue;
      const rect = _brickRect(brick);
      if (!_circleRect(ball.x, ball.y, r, rect.x, rect.y, rect.w, rect.h)) continue;

      // Reflect once
      if (!hitThisStep) {
        _resolveBallBrick(ball, brick);
        hitThisStep = true;
      }

      // Damage the brick (indestructible bricks deflect but take no damage)
      if (brick.hp !== Infinity) {
        brick.hp--;
        S.combo++;
        const base  = brick.type === 2 ? C.SCORE_BRICK_2 : C.SCORE_BRICK_1;
        const mult  = 1 + Math.min(S.combo - 1, 8) * C.SCORE_COMBO_MULT;
        S.score    += Math.round(base * mult);
        const color = ARK_BRICK_COLORS[brick.gy % ARK_BRICK_COLORS.length];

        _spawnParticles(
          rect.x + rect.w / 2,
          rect.y + rect.h / 2,
          color,
          brick.hp <= 0 ? 14 : 6
        );

        if (brick.hp <= 0) {
          brick.dead = true;
          if (Math.random() < C.PW_CHANCE) {
            S.powerUps.push(_createPowerUp(rect.x + rect.w / 2, rect.y + rect.h / 2));
          }
          _emit('brickDestroyed', { brick, score: S.score });

          // Level complete check (deferred so last brick destruction renders)
          if (_countDestructible(S.bricks) === 0) {
            setTimeout(() => _emit('levelComplete', { levelIndex: S.levelIndex, score: S.score }), 320);
          }
        }
      }
    }
  }

  return deadIndices;
}

// ─────────────────────────────────────────────────────────────────
// § TICK  (public)
// ─────────────────────────────────────────────────────────────────

export function tick(dt) {
  if (S.paused) return;

  // ── Screen shake decay ──────────────────────────────────────────
  S.screenShake = Math.max(0, S.screenShake - dt * 60);

  // ── Power-up timers ─────────────────────────────────────────────
  if (S.expandTimer > 0) {
    S.expandTimer -= dt * 1000;
    if (S.expandTimer <= 0) { S.paddleW = C.PADDLE_W; S.expandTimer = 0; }
  }
  if (S.slowTimer > 0) {
    S.slowTimer -= dt * 1000;
    if (S.slowTimer <= 0) {
      S.slowTimer = 0;
      // Restore nominal ball speed
      S.balls.forEach(b => {
        const len = Math.hypot(b.vx, b.vy);
        if (len > 0) {
          b.vx   = (b.vx / len) * S.ballSpeed;
          b.vy   = (b.vy / len) * S.ballSpeed;
          b.speed = S.ballSpeed;
        }
      });
    }
  }
  if (S.shieldTimer > 0) {
    S.shieldTimer -= dt * 1000;
    if (S.shieldTimer <= 0) { S.shield = false; S.shieldTimer = 0; }
  }

  // ── Shockwave animation ─────────────────────────────────────────
  for (const sw of S.shockwaves) {
    sw.life -= dt / C.SHOCKWAVE_DURATION;
    sw.r     = C.SHOCKWAVE_MAX_R * (1 - sw.life);
  }
  S.shockwaves = S.shockwaves.filter(sw => sw.life > 0);

  // ── Particle pool update ────────────────────────────────────────
  // Particles are non-critical for game logic so they update once
  // with full dt (visual quality is not affected by sub-stepping).
  for (const p of _particlePool) {
    if (!p.alive) continue;
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 200 * dt;   // gravity
    p.life -= p.decay * dt;
    if (p.life <= 0) p.alive = false;
  }

  // ── Falling power-ups ───────────────────────────────────────────
  const pHalfW = C.PW_W / 2;
  const pHalfH = C.PW_H / 2;
  const padPY  = C.PADDLE_Y - C.PADDLE_H / 2;
  for (const pw of S.powerUps) {
    if (!pw.alive) continue;
    pw.y += pw.vy * dt;
    const padPX = S.paddleX - S.paddleW / 2;
    if (pw.y + pHalfH > padPY &&
        pw.y - pHalfH < padPY + C.PADDLE_H &&
        pw.x + pHalfW > padPX &&
        pw.x - pHalfW < padPX + S.paddleW) {
      _applyPowerUp(pw.type);
      pw.alive = false;
      _emit('powerUp', { type: pw.type });
    }
    if (pw.y - pHalfH > C.LH) pw.alive = false;
  }

  // ── Ball physics — threshold sub-stepping ───────────────────────
  //
  // Decision rule (per tech lead spec):
  //   dt > SUB_DT_THRESHOLD  →  2 sub-steps of (dt / 2)
  //   dt ≤ SUB_DT_THRESHOLD  →  1 sub-step  of  dt
  //
  // At BALL_MAX_SPEED=520 and subDt≤1/60≈0.0167:
  //   max travel per sub-step = 520 × 0.0167 ≈ 8.7 px
  //   BALL_RADIUS = 7 px  → ball can never skip past a surface
  //   (PADDLE_H = 12 px, min brick height = 18 px)
  // ────────────────────────────────────────────────────────────────
  const subSteps = dt > SUB_DT_THRESHOLD ? 2 : 1;
  const subDt    = dt / subSteps;

  let allDeadIndices = new Set();

  for (let step = 0; step < subSteps; step++) {
    const dead = _physicsStep(subDt, step === 0);  // trail only on step 0
    for (const idx of dead) allDeadIndices.add(idx);
  }

  // Remove dead bricks (after all sub-steps, all balls processed)
  S.bricks = S.bricks.filter(b => !b.dead);

  // ── Remove dead balls (descending order to keep indices stable) ─
  const sortedDead = [...allDeadIndices].sort((a, b) => b - a);
  for (const idx of sortedDead) S.balls.splice(idx, 1);

  // ── No balls remaining ──────────────────────────────────────────
  if (S.balls.length === 0) {
    if (S.shield) {
      S.shield      = false;
      S.shieldTimer = 0;
      _spawnShockwave(C.LW / 2, C.LH - 10);
      _respawnBall();
      _emit('shieldBroke', {});
    } else {
      S.lives--;
      S.combo       = 0;
      S.screenShake = 12;
      if (S.lives <= 0) {
        _emit('gameOver', { score: S.score });
      } else {
        _respawnBall();
        _emit('lifeLost', { lives: S.lives });
      }
    }
  }

  _emit('stateChange', null);
}

// ─────────────────────────────────────────────────────────────────
// § PUBLIC API
// ─────────────────────────────────────────────────────────────────

export function startLevel(levelIndex) {
  const levelData = ARK_LEVELS[levelIndex];
  const speed     = ARK_clamp(
    C.BALL_BASE_SPEED + levelIndex * C.BALL_SPEED_LEVEL,
    C.BALL_BASE_SPEED,
    C.BALL_MAX_SPEED
  );

  // Reset particle pool (all slots freed — no stale particles across levels)
  for (const p of _particlePool) p.alive = false;
  _poolCursor = 0;

  S = {
    levelIndex,
    levelData,
    bricks:            _buildBricks(levelData.grid),
    balls:             [],
    powerUps:          [],
    shockwaves:        [],
    paused:            false,
    paddleX:           C.LW / 2,
    paddleW:           C.PADDLE_W,
    lives:             C.TOTAL_LIVES,
    score:             0,
    combo:             0,
    ballSpeed:         speed,
    shield:            false,
    shieldTimer:       0,
    expandTimer:       0,
    slowTimer:         0,
    screenShake:       0,
    totalDestructible: 0,
  };
  S.totalDestructible = _countDestructible(S.bricks);

  // Place initial ball stuck to paddle
  const initBall = _createBall(S.paddleX, C.PADDLE_Y - C.PADDLE_H, speed, 0);
  initBall.stuck = true;
  S.balls.push(initBall);
}

export function launchBall() {
  const stuck = S.balls.find(b => b.stuck);
  if (!stuck) return;
  const angle    = ARK_rng(-0.3, 0.3);
  stuck.vx       = Math.sin(angle) * S.ballSpeed;
  stuck.vy       = -Math.cos(angle) * S.ballSpeed;
  stuck.speed    = S.ballSpeed;
  stuck.stuck    = false;
}

export function movePaddle(dx) {
  const hw  = S.paddleW / 2;
  S.paddleX = ARK_clamp(S.paddleX + dx, hw, C.LW - hw);
}

export function setPaddleX(x) {
  const hw  = S.paddleW / 2;
  S.paddleX = ARK_clamp(x, hw, C.LW - hw);
}

export function pause()  { if (S) S.paused = true;  }
export function resume() { if (S) S.paused = false; }

/**
 * Returns a live reference snapshot of game state.
 * Particles are the pool reference (renderer checks .alive per entry).
 * Callers must NOT mutate returned objects.
 */
export function getState() {
  return {
    levelIndex:        S.levelIndex,
    levelData:         S.levelData,
    bricks:            S.bricks,
    balls:             S.balls,
    powerUps:          S.powerUps,
    shockwaves:        S.shockwaves,
    particles:         _particlePool,
    paddleX:           S.paddleX,
    paddleW:           S.paddleW,
    lives:             S.lives,
    score:             S.score,
    combo:             S.combo,
    paused:            S.paused,
    shield:            S.shield,
    shieldTimer:       S.shieldTimer,
    expandTimer:       S.expandTimer,
    slowTimer:         S.slowTimer,
    screenShake:       S.screenShake,
    totalDestructible: S.totalDestructible,
  };
}

// Grouped export for consumers that prefer a single named import
export const ARK_Engine = {
  startLevel, tick, launchBall,
  movePaddle, setPaddleX,
  pause, resume,
  on, off, getState,
};
