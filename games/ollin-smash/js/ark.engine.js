/**
 * ark.engine.js — Arkanoid · Love Arcade  v3.0.0
 * Module B: Physics, collision, game state, event bus.
 *
 * PUBLIC API:
 *   startLevel(levelIndex)   — 0-based, unbounded (infinite mode)
 *   tick(dt)
 *   launchBall()
 *   movePaddle(dx)
 *   setPaddleX(x)
 *   pause() / resume()
 *   on(event, handler) / off(event, handler)
 *   getState() → snapshot
 *
 * EVENTS EMITTED:
 *   stateChange    {}
 *   brickDestroyed { brick, score }
 *   powerUp        { type }
 *   lifeLost       { lives }
 *   lifeGained     { lives }
 *   shieldBroke    {}
 *   levelComplete  { levelIndex, score }
 *   gameOver       { score }
 *
 * NO DOM access. NO window/document references.
 *
 * ── Sub-stepping ─────────────────────────────────────────────────
 * dt > 1/60 → 2 sub-steps of dt/2  (handles 30fps throttling)
 * dt ≤ 1/60 → 1 sub-step
 * At MAX_SPEED 540 and subDt ≤ 1/60: max travel = 9px per sub-step,
 * less than PADDLE_H (12px) and BRICK_H (18px) — no tunneling.
 *
 * ── FIRE power-up ────────────────────────────────────────────────
 * Ball gains `fire = true`. While active the ball passes through
 * bricks, dealing 1hp of damage per frame of contact without
 * deflecting. Indestructible bricks still deflect even in fire mode.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import {
  ARK_CONFIG,
  ARK_BRICK_COLORS,
  ARK_PW_KEYS,
  ARK_PW_WEIGHTS,
  ARK_clamp,
  ARK_rng,
  ARK_pickWeighted,
  generateLevel,
} from './ark.config.js';

const C = ARK_CONFIG;
const SUB_DT_THRESHOLD = C.SUB_DT_THRESHOLD;

// ─────────────────────────────────────────────────────────────────
// § PARTICLE POOL — zero allocation during gameplay
// ─────────────────────────────────────────────────────────────────
const _pool = Array.from({ length: C.PARTICLE_POOL }, () => ({
  alive: false, x: 0, y: 0, vx: 0, vy: 0,
  life: 0, decay: 0, size: 0, color: '#fff',
}));
let _cursor = 0;

function _alloc() {
  const len = _pool.length;
  for (let i = 0; i < len; i++) {
    const idx = (_cursor + i) % len;
    if (!_pool[idx].alive) { _cursor = (idx + 1) % len; return _pool[idx]; }
  }
  const p = _pool[_cursor]; _cursor = (_cursor + 1) % len; return p;
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
// § STATE
// ─────────────────────────────────────────────────────────────────
let S = {};

// ─────────────────────────────────────────────────────────────────
// § GEOMETRY
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
  for (let gy = 0; gy < grid.length; gy++)
    for (let gx = 0; gx < grid[gy].length; gx++) {
      const type = grid[gy][gx];
      if (type === 0) continue;
      bricks.push({ gx, gy, type, hp: type === 3 ? Infinity : type, dead: false });
    }
  return bricks;
}

function _countDestructible(bricks) {
  return bricks.filter(b => b.hp !== Infinity && !b.dead).length;
}

// ─────────────────────────────────────────────────────────────────
// § FACTORIES
// ─────────────────────────────────────────────────────────────────
function _makeBall(x, y, speed, angleRad, fire = false) {
  return {
    x, y,
    vx: Math.sin(angleRad) * speed,
    vy: -Math.cos(angleRad) * speed,
    speed, fire,
    trail: [], stuck: false,
    // Set of brick ids already damaged this frame (fire mode dedup)
    fireDmg: new Set(),
  };
}

function _makePowerUp(x, y) {
  return { x, y, type: ARK_pickWeighted(ARK_PW_KEYS, ARK_PW_WEIGHTS), vy: C.PW_FALL_SPEED, alive: true };
}

// ─────────────────────────────────────────────────────────────────
// § EFFECTS
// ─────────────────────────────────────────────────────────────────
function _spawnParticles(px, py, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = ARK_rng(60, 200);
    const p = _alloc();
    p.alive = true; p.x = px; p.y = py;
    p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd - 40;
    p.life = 1; p.decay = ARK_rng(1.2, 2.8);
    p.size = ARK_rng(2, 5); p.color = color;
  }
}

function _spawnFireParticles(px, py, count) {
  const colors = ['#ff6600', '#ff3300', '#ffaa00', '#ffff00'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = ARK_rng(40, 160);
    const p = _alloc();
    p.alive = true; p.x = px; p.y = py;
    p.vx = Math.cos(a) * spd; p.vy = Math.sin(a) * spd - 60;
    p.life = 1; p.decay = ARK_rng(1.5, 3.5);
    p.size = ARK_rng(2, 6);
    p.color = colors[Math.floor(Math.random() * colors.length)];
  }
}

function _spawnShockwave(x, y) {
  S.shockwaves.push({ x, y, r: 10, life: 1 });
}

// ─────────────────────────────────────────────────────────────────
// § COLLISION HELPERS
// ─────────────────────────────────────────────────────────────────
function _circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = ARK_clamp(cx, rx, rx + rw);
  const ny = ARK_clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function _resolveBrick(ball, b) {
  const rect = _brickRect(b);
  const cx   = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx   = ball.x - cx, dy = ball.y - cy;
  const ovX  = (rect.w / 2 + C.BALL_RADIUS) - Math.abs(dx);
  const ovY  = (rect.h / 2 + C.BALL_RADIUS) - Math.abs(dy);
  if (ovX < ovY) { ball.vx = Math.sign(dx) * Math.abs(ball.vx || ball.speed); ball.x += Math.sign(dx) * (ovX + 0.5); }
  else           { ball.vy = Math.sign(dy) * Math.abs(ball.vy || ball.speed); ball.y += Math.sign(dy) * (ovY + 0.5); }
}

function _resolvePaddle(ball) {
  const pw = S.paddleW;
  const px = S.paddleX - pw / 2;
  const py = C.PADDLE_Y - C.PADDLE_H / 2;
  if (!_circleRect(ball.x, ball.y, C.BALL_RADIUS, px, py, pw, C.PADDLE_H)) return false;
  if (ball.vy < 0) return false;
  const hitPos = (ball.x - S.paddleX) / (pw / 2);
  const angle  = hitPos * (Math.PI / 3);
  ball.vx = Math.sin(angle) * ball.speed;
  ball.vy = -Math.cos(angle) * ball.speed;
  ball.y  = py - C.BALL_RADIUS - 1;
  S.combo = 0;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// § POWER-UP EFFECTS
// ─────────────────────────────────────────────────────────────────
function _applyPU(type) {
  switch (type) {
    case 'EXPAND':
      S.paddleW     = Math.min(C.PADDLE_W * 1.65, C.LW * 0.7);
      S.expandTimer = C.PW_DURATION;
      break;
    case 'MULTI': {
      const src = S.balls.find(b => !b.stuck) || S.balls[0];
      if (!src) break;
      const a0 = Math.atan2(src.vx, -src.vy);
      S.balls.push(_makeBall(src.x, src.y, src.speed, a0 + Math.PI / 5, src.fire));
      S.balls.push(_makeBall(src.x, src.y, src.speed, a0 - Math.PI / 5, src.fire));
      break;
    }
    case 'SLOW':
      S.slowTimer = C.PW_SLOW_DURATION;
      S.balls.forEach(b => {
        const slow = b.speed * 0.58, len = Math.hypot(b.vx, b.vy);
        if (len > 0) { b.vx = (b.vx / len) * slow; b.vy = (b.vy / len) * slow; }
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
    case 'FIRE':
      // Grant fire mode to all current balls
      S.balls.forEach(b => { b.fire = true; });
      S.fireTimer = C.PW_FIRE_DURATION;
      break;
  }
}

function _respawn() {
  const b = _makeBall(S.paddleX, C.PADDLE_Y - C.PADDLE_H, S.ballSpeed, 0);
  b.stuck = true;
  S.balls = [b];
  S.paddleW     = C.PADDLE_W;
  S.expandTimer = 0;
  S.slowTimer   = 0;
  // Fire does NOT reset on respawn — it's timer-based
}

// ─────────────────────────────────────────────────────────────────
// § PHYSICS STEP
// ─────────────────────────────────────────────────────────────────
function _step(subDt, recordTrail) {
  const dead = new Set();
  const r    = C.BALL_RADIUS;

  for (let bi = 0; bi < S.balls.length; bi++) {
    const ball = S.balls[bi];
    if (ball.stuck) {
      ball.x = S.paddleX;
      ball.y = C.PADDLE_Y - C.PADDLE_H - r;
      continue;
    }

    if (recordTrail) {
      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > C.BALL_TRAIL_LEN) ball.trail.shift();
    }

    // Clear per-frame fire damage set
    if (ball.fire) ball.fireDmg.clear();

    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    // ── Walls ─────────────────────────────────────────────────
    if (ball.x - r < 0)    { ball.x = r;        ball.vx =  Math.abs(ball.vx); S.screenShake = Math.min(S.screenShake + 3, 8); }
    if (ball.x + r > C.LW) { ball.x = C.LW - r; ball.vx = -Math.abs(ball.vx); S.screenShake = Math.min(S.screenShake + 3, 8); }
    if (ball.y - r < 0)    { ball.y = r;         ball.vy =  Math.abs(ball.vy); S.screenShake = Math.min(S.screenShake + 3, 8); }

    // ── Bottom ────────────────────────────────────────────────
    if (ball.y - r > C.LH) { dead.add(bi); continue; }

    // ── Paddle ────────────────────────────────────────────────
    _resolvePaddle(ball);

    // ── Bricks ────────────────────────────────────────────────
    let normalHit = false;  // only one deflection per sub-step for normal ball

    for (const brick of S.bricks) {
      if (brick.dead || brick.hp <= 0) continue;
      const rect = _brickRect(brick);
      if (!_circleRect(ball.x, ball.y, r, rect.x, rect.y, rect.w, rect.h)) continue;

      const isIndestr = brick.hp === Infinity;

      if (ball.fire && !isIndestr) {
        // FIRE MODE: pass through, damage without deflection
        // One damage tick per brick per sub-step frame (fireDmg dedup)
        const bKey = `${brick.gx}_${brick.gy}`;
        if (!ball.fireDmg.has(bKey)) {
          ball.fireDmg.add(bKey);
          brick.hp--;
          S.score += C.SCORE_BRICK_FIRE;
          const color = ARK_BRICK_COLORS[brick.gy % ARK_BRICK_COLORS.length];
          _spawnFireParticles(rect.x + rect.w / 2, rect.y + rect.h / 2, 6);
          S.screenShake = Math.min(S.screenShake + 5, 15);
          if (brick.hp <= 0) {
            brick.dead = true;
            if (Math.random() < C.PW_CHANCE)
              S.powerUps.push(_makePowerUp(rect.x + rect.w / 2, rect.y + rect.h / 2));
            _emit('brickDestroyed', { brick, score: S.score });
            if (_countDestructible(S.bricks) === 0)
              setTimeout(() => _emit('levelComplete', { levelIndex: S.levelIndex, score: S.score }), 320);
          }
        }
      } else {
        // NORMAL or INDESTRUCTIBLE: deflect and damage
        if (!normalHit) { _resolveBrick(ball, brick); normalHit = true; }

        if (!isIndestr) {
          brick.hp--;
          S.combo++;
          const base = brick.type === 2 ? C.SCORE_BRICK_2 : C.SCORE_BRICK_1;
          S.score   += Math.round(base * (1 + Math.min(S.combo - 1, 8) * C.SCORE_COMBO_MULT));
          const color = ARK_BRICK_COLORS[brick.gy % ARK_BRICK_COLORS.length];
          _spawnParticles(rect.x + rect.w / 2, rect.y + rect.h / 2, color, brick.hp <= 0 ? 14 : 6);
          S.screenShake = Math.min(S.screenShake + 5, 15);
          if (brick.hp <= 0) {
            brick.dead = true;
            if (Math.random() < C.PW_CHANCE)
              S.powerUps.push(_makePowerUp(rect.x + rect.w / 2, rect.y + rect.h / 2));
            _emit('brickDestroyed', { brick, score: S.score });
            if (_countDestructible(S.bricks) === 0)
              setTimeout(() => _emit('levelComplete', { levelIndex: S.levelIndex, score: S.score }), 320);
          }
        }
      }
    }
  }
  return dead;
}

// ─────────────────────────────────────────────────────────────────
// § TICK
// ─────────────────────────────────────────────────────────────────
export function tick(dt) {
  if (!S || S.paused) return;

  S.screenShake = Math.max(0, S.screenShake - dt * 60);

  // ── Timers ─────────────────────────────────────────────────
  if (S.expandTimer > 0) { S.expandTimer -= dt * 1000; if (S.expandTimer <= 0) { S.paddleW = C.PADDLE_W; S.expandTimer = 0; } }
  if (S.slowTimer   > 0) {
    S.slowTimer -= dt * 1000;
    if (S.slowTimer <= 0) {
      S.slowTimer = 0;
      S.balls.forEach(b => {
        const len = Math.hypot(b.vx, b.vy);
        if (len > 0) { b.vx = (b.vx / len) * S.ballSpeed; b.vy = (b.vy / len) * S.ballSpeed; b.speed = S.ballSpeed; }
      });
    }
  }
  if (S.shieldTimer > 0) { S.shieldTimer -= dt * 1000; if (S.shieldTimer <= 0) { S.shield = false; S.shieldTimer = 0; } }
  if (S.fireTimer   > 0) {
    S.fireTimer -= dt * 1000;
    if (S.fireTimer <= 0) { S.fireTimer = 0; S.balls.forEach(b => { b.fire = false; }); }
  }

  // ── Shockwaves ──────────────────────────────────────────────
  for (const sw of S.shockwaves) { sw.life -= dt / C.SHOCKWAVE_DURATION; sw.r = C.SHOCKWAVE_MAX_R * (1 - sw.life); }
  S.shockwaves = S.shockwaves.filter(sw => sw.life > 0);

  // ── Particles ───────────────────────────────────────────────
  for (const p of _pool) {
    if (!p.alive) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; p.life -= p.decay * dt;
    if (p.life <= 0) p.alive = false;
  }

  // ── Power-ups falling ───────────────────────────────────────
  const pHW = C.PW_W / 2, pHH = C.PW_H / 2, padPY = C.PADDLE_Y - C.PADDLE_H / 2;
  for (const pw of S.powerUps) {
    if (!pw.alive) continue;
    pw.y += pw.vy * dt;
    const padPX = S.paddleX - S.paddleW / 2;
    if (pw.y + pHH > padPY && pw.y - pHH < padPY + C.PADDLE_H && pw.x + pHW > padPX && pw.x - pHW < padPX + S.paddleW) {
      _applyPU(pw.type); pw.alive = false; _emit('powerUp', { type: pw.type });
    }
    if (pw.y - pHH > C.LH) pw.alive = false;
  }

  // ── Ball physics with sub-stepping ─────────────────────────
  const subSteps = dt > SUB_DT_THRESHOLD ? 2 : 1;
  const subDt    = dt / subSteps;
  let allDead    = new Set();
  for (let step = 0; step < subSteps; step++) {
    const dead = _step(subDt, step === 0);
    for (const idx of dead) allDead.add(idx);
  }

  // Remove dead bricks
  S.bricks = S.bricks.filter(b => !b.dead);

  // Remove dead balls (descending to keep indices stable)
  [...allDead].sort((a, b) => b - a).forEach(i => S.balls.splice(i, 1));

  // ── No balls left ───────────────────────────────────────────
  if (S.balls.length === 0) {
    if (S.shield) {
      S.shield = false; S.shieldTimer = 0;
      _spawnShockwave(C.LW / 2, C.LH - 10);
      _respawn();
      _emit('shieldBroke', {});
    } else {
      S.lives--; S.combo = 0; S.screenShake = 12;
      if (S.lives <= 0) _emit('gameOver', { score: S.score });
      else { _respawn(); _emit('lifeLost', { lives: S.lives }); }
    }
  }

  _emit('stateChange', null);
}

// ─────────────────────────────────────────────────────────────────
// § PUBLIC API
// ─────────────────────────────────────────────────────────────────
export function startLevel(levelIndex) {
  const levelData = generateLevel(levelIndex);
  const speed     = ARK_clamp(
    C.BALL_BASE_SPEED + levelIndex * C.BALL_SPEED_LEVEL,
    C.BALL_BASE_SPEED,
    C.BALL_MAX_SPEED
  );

  for (const p of _pool) p.alive = false;
  _cursor = 0;

  S = {
    levelIndex, levelData,
    bricks:    _buildBricks(levelData.grid),
    balls:     [], powerUps: [], shockwaves: [],
    paused:    false,
    paddleX:   C.LW / 2,
    paddleW:   C.PADDLE_W,
    lives:     C.TOTAL_LIVES,
    score:     0, combo: 0,
    ballSpeed: speed,
    shield: false, shieldTimer: 0,
    expandTimer: 0, slowTimer: 0, fireTimer: 0,
    screenShake: 0,
    totalDestructible: 0,
  };
  S.totalDestructible = _countDestructible(S.bricks);

  const init = _makeBall(S.paddleX, C.PADDLE_Y - C.PADDLE_H, speed, 0);
  init.stuck = true;
  S.balls.push(init);
}

export function launchBall() {
  const s = S.balls.find(b => b.stuck);
  if (!s) return;
  const angle = ARK_rng(-0.3, 0.3);
  s.vx = Math.sin(angle) * S.ballSpeed;
  s.vy = -Math.cos(angle) * S.ballSpeed;
  s.speed = S.ballSpeed;
  s.stuck = false;
}

export function movePaddle(dx) {
  const hw = S.paddleW / 2;
  S.paddleX = ARK_clamp(S.paddleX + dx, hw, C.LW - hw);
}

export function setPaddleX(x) {
  const hw = S.paddleW / 2;
  S.paddleX = ARK_clamp(x, hw, C.LW - hw);
}

export function pause()  { if (S) S.paused = true;  }
export function resume() { if (S) S.paused = false; }

export function getState() {
  return {
    levelIndex: S.levelIndex, levelData: S.levelData,
    bricks: S.bricks, balls: S.balls,
    powerUps: S.powerUps, shockwaves: S.shockwaves,
    particles: _pool,
    paddleX: S.paddleX, paddleW: S.paddleW,
    lives: S.lives, score: S.score, combo: S.combo,
    paused: S.paused,
    shield: S.shield, shieldTimer: S.shieldTimer,
    expandTimer: S.expandTimer, slowTimer: S.slowTimer, fireTimer: S.fireTimer,
    screenShake: S.screenShake,
    totalDestructible: S.totalDestructible,
  };
}

export const ARK_Engine = {
  startLevel, tick, launchBall,
  movePaddle, setPaddleX,
  pause, resume, on, off, getState,
};
