/**
 * ark.ui.js — Arkanoid · Love Arcade
 * Module D: Rendering, input, screen management, RAF loop.
 *
 * Responsibilities:
 *  - Canvas scaling (HiDPI-aware, resize + orientationchange)
 *  - requestAnimationFrame loop (guarded against double-init)
 *  - Keyboard, mouse and touch input → Engine commands
 *  - DOM screen transitions (start, pause, level-complete, gameover, win)
 *  - aria-live announcements for accessibility
 *
 * ── Double-init safety ────────────────────────────────────────────
 * init() is safe to call multiple times (e.g. ARK_UI.init() from the
 * browser console, or a restart flow that re-calls init).
 *
 * Two independent guards protect against side-effects:
 *
 *  1. _initialized (boolean flag)
 *     Wraps all addEventListener calls (resize, orientationchange,
 *     keydown, keyup, touch*, mousemove, click, and all button
 *     onclick handlers). Event listeners are wired exactly ONCE
 *     for the lifetime of the page, regardless of how many times
 *     init() is called. Without this guard, each extra init() would
 *     add a duplicate listener: engine events would fire twice
 *     (causing double coin reporting), keys would trigger twice,
 *     and buttons would start two games simultaneously.
 *
 *  2. _rafId (number | null)
 *     Before starting the requestAnimationFrame loop, any running
 *     loop is cancelled with cancelAnimationFrame(_rafId). Without
 *     this guard, a second init() would spawn a parallel _frame()
 *     callback, doubling the effective tick rate and game speed.
 *
 * DoD verification:
 *   Open DevTools console and run:
 *     ARK_UI.init(); ARK_UI.init(); ARK_UI.init();
 *   → Game speed is unchanged (single RAF loop active).
 *   → Pressing Space launches exactly one ball.
 *   → No duplicate coin reports in the log.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

import {
  ARK_CONFIG,
  ARK_LEVELS,
  ARK_BRICK_COLORS,
  ARK_PW_TYPES,
  ARK_hexToRgb,
} from './ark.config.js';

import { ARK_Engine } from './ark.engine.js';
import { ARK_Integration } from './ark.integration.js';

const C = ARK_CONFIG;

// ─────────────────────────────────────────────────────────────────
// § CANVAS / VIEWPORT STATE
// ─────────────────────────────────────────────────────────────────
let canvas, ctx;
let _scale   = 1;
let _offsetX = 0;
let _offsetY = 0;

// ─────────────────────────────────────────────────────────────────
// § GAME PHASE
// IDLE | READY | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER | WIN
// ─────────────────────────────────────────────────────────────────
let _phase        = 'IDLE';
let _currentLevel = 0;
let _totalScore   = 0;
let _totalCoins   = 0;

// ─────────────────────────────────────────────────────────────────
// § DOUBLE-INIT GUARDS
// See module JSDoc for full explanation.
// ─────────────────────────────────────────────────────────────────

/**
 * Tracks whether addEventListener wiring has already been performed.
 * Set to true after the first successful init() call.
 * Prevents duplicate listeners on subsequent init() invocations.
 */
let _initialized = false;

/**
 * ID of the active requestAnimationFrame callback.
 * null when no loop is running.
 * Cancelled with cancelAnimationFrame before starting a new loop.
 */
let _rafId    = null;
let _lastTime = 0;

// ─────────────────────────────────────────────────────────────────
// § INPUT STATE
// ─────────────────────────────────────────────────────────────────
const _keys = {};

// Logical X from most recent touch contact point.
// Recomputed on every touchmove using current _scale/_offsetX,
// so it is never stale after a resize or orientation change.
let _touchLogicalX = null;

// ─────────────────────────────────────────────────────────────────
// § ACCESSIBILITY — aria-live region
// ─────────────────────────────────────────────────────────────────
let _ariaStatus = null;
function _announce(msg) {
  if (_ariaStatus) _ariaStatus.textContent = msg;
}

// ─────────────────────────────────────────────────────────────────
// § CANVAS SIZING
// Re-reads viewport dimensions at call time. Safe from any handler
// without capturing stale closures.
// ─────────────────────────────────────────────────────────────────
function _resize() {
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  _scale   = Math.min(vw / C.LW, vh / C.LH);
  const cw = Math.floor(C.LW * _scale);
  const ch = Math.floor(C.LH * _scale);

  _offsetX = Math.floor((vw - cw) / 2);
  _offsetY = Math.floor((vh - ch) / 2);

  canvas.width  = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.cssText = `
    display: block;
    position: fixed;
    left: ${_offsetX}px;
    top:  ${_offsetY}px;
    width:  ${cw}px;
    height: ${ch}px;
    cursor: none;
    image-rendering: pixelated;
  `;
  ctx.setTransform(dpr * _scale, 0, 0, dpr * _scale, 0, 0);
}

/**
 * Convert a clientX pixel to logical canvas coordinates.
 * Always reads current _scale and _offsetX — no stale captures.
 */
function _toLogicalX(clientX) {
  return (clientX - _offsetX) / _scale;
}

// ─────────────────────────────────────────────────────────────────
// § SCREEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────
const _screenCache = {};
function _getEl(id) {
  return (_screenCache[id] = _screenCache[id] || document.getElementById(id));
}

function showScreen(id) {
  document.querySelectorAll('.ark-screen')
    .forEach(s => s.classList.remove('ark-visible'));
  const sc = _getEl(id);
  if (sc) sc.classList.add('ark-visible');
}

function hideAllScreens() {
  document.querySelectorAll('.ark-screen')
    .forEach(s => s.classList.remove('ark-visible'));
}

function _setHubLinkVisible(visible) {
  const el = _getEl('ARK_hub-link');
  if (!el) return;
  el.style.opacity       = visible ? '0.7' : '0';
  el.style.pointerEvents = visible ? 'all'  : 'none';
}

// ─────────────────────────────────────────────────────────────────
// § RENDERING HELPERS
// ─────────────────────────────────────────────────────────────────
function _glow(color, r)  { ctx.shadowColor = color; ctx.shadowBlur = r; }
function _noGlow()         { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

function _roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — BACKGROUND
// ─────────────────────────────────────────────────────────────────
function _drawBackground() {
  ctx.fillStyle = '#06010f';
  ctx.fillRect(0, 0, C.LW, C.LH);

  ctx.strokeStyle = 'rgba(100,50,180,0.06)';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < C.LW; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.LH); ctx.stroke();
  }
  for (let y = 0; y < C.LH; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.LW, y); ctx.stroke();
  }

  const vig = ctx.createRadialGradient(C.LW/2, C.LH/2, C.LH*0.2, C.LW/2, C.LH/2, C.LH*0.8);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, C.LW, C.LH);
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — HUD
// ─────────────────────────────────────────────────────────────────
function _drawHUD(state) {
  ctx.fillStyle = 'rgba(6,1,20,0.85)';
  ctx.fillRect(0, 0, C.LW, 56);
  ctx.strokeStyle = 'rgba(255,31,143,0.3)';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(C.LW, 56); ctx.stroke();

  ctx.font      = '600 8px "Share Tech Mono", monospace';
  ctx.fillStyle = 'rgba(187,134,252,0.7)';
  ctx.textAlign = 'left';
  ctx.fillText(`NIVEL ${(state.levelIndex||0)+1}/5 · ${state.levelData?.name||''}`, 12, 14);

  ctx.font      = '900 22px "Orbitron", sans-serif';
  _glow('#ffe600', 12);
  ctx.fillStyle = '#ffe600';
  ctx.textAlign = 'center';
  ctx.fillText(String(state.score||0).padStart(7, '0'), C.LW / 2, 38);
  _noGlow();

  ctx.textAlign = 'right';
  ctx.font      = '14px sans-serif';
  for (let i = 0; i < (state.lives||0); i++) {
    _glow('#ff1f8f', 8);
    ctx.fillStyle = '#ff1f8f';
    ctx.fillText('♥', C.LW - 12 - i * 20, 38);
  }
  _noGlow();

  if (state.combo > 1) {
    ctx.font      = '700 9px "Orbitron", sans-serif';
    ctx.fillStyle = `rgba(0,232,255,${Math.min(1, state.combo / 8)})`;
    ctx.textAlign = 'left';
    ctx.fillText(`×${state.combo} COMBO`, 12, 38);
  }

  if (state.shield) {
    const pulse   = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
    ctx.font      = '700 9px "Orbitron", sans-serif';
    ctx.fillStyle = `rgba(255,230,0,${pulse})`;
    ctx.textAlign = 'left';
    ctx.fillText('🛡 SHIELD', 12, 50);
  }

  let tx = C.LW - 12;
  ctx.textAlign = 'right';
  if (state.expandTimer > 0) {
    ctx.font      = '700 7px "Share Tech Mono"';
    ctx.fillStyle = '#00cc66';
    ctx.fillText(`E:${(state.expandTimer/1000).toFixed(1)}s`, tx, 50);
    tx -= 48;
  }
  if (state.slowTimer > 0) {
    ctx.font      = '700 7px "Share Tech Mono"';
    ctx.fillStyle = '#4488ff';
    ctx.fillText(`S:${(state.slowTimer/1000).toFixed(1)}s`, tx, 50);
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — BRICKS
// ─────────────────────────────────────────────────────────────────
function _drawBricks(bricks) {
  for (const b of bricks) {
    if (b.dead || b.hp <= 0) continue;
    const rx    = b.gx * (C.BRICK_W + C.BRICK_GAP) + C.BRICK_START_X;
    const ry    = b.gy * (C.BRICK_H + C.BRICK_GAP) + C.BRICK_START_Y;
    const color = ARK_BRICK_COLORS[b.gy % ARK_BRICK_COLORS.length];

    if (b.hp === Infinity) {
      const g = ctx.createLinearGradient(rx, ry, rx, ry + C.BRICK_H);
      g.addColorStop(0, '#666'); g.addColorStop(0.5, '#999'); g.addColorStop(1, '#444');
      ctx.fillStyle = g;
      _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(rx+3, ry+3); ctx.lineTo(rx+C.BRICK_W-3, ry+C.BRICK_H-3);
      ctx.moveTo(rx+C.BRICK_W-3, ry+3); ctx.lineTo(rx+3, ry+C.BRICK_H-3);
      ctx.stroke();
    } else {
      const rgb = ARK_hexToRgb(color);
      const g   = ctx.createLinearGradient(rx, ry, rx, ry + C.BRICK_H);
      if (b.hp === 2) {
        g.addColorStop(0, `rgba(${rgb},0.9)`);
        g.addColorStop(1, `rgba(${rgb},0.5)`);
        _glow(color, 6);
      } else {
        g.addColorStop(0, `rgba(${rgb},0.95)`);
        g.addColorStop(1, `rgba(${rgb},0.6)`);
        _glow(color, 10);
      }
      ctx.fillStyle = g;
      _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3);
      ctx.fill();
      if (b.hp === 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(rx+2, ry + C.BRICK_H/2);
        ctx.lineTo(rx + C.BRICK_W-2, ry + C.BRICK_H/2);
        ctx.stroke();
      }
    }
    _noGlow();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth   = 0.8;
    _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3);
    ctx.stroke();
  }
  _noGlow();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — PADDLE
// ─────────────────────────────────────────────────────────────────
function _drawPaddle(state) {
  const pw    = state.paddleW;
  const px    = state.paddleX - pw / 2;
  const py    = C.PADDLE_Y - C.PADDLE_H / 2;
  const isExp = state.expandTimer > 0;
  const color = isExp ? '#00cc66' : '#00e8ff';
  const rgb   = isExp ? '0,204,102' : '0,232,255';

  const g = ctx.createLinearGradient(px, py, px, py + C.PADDLE_H);
  g.addColorStop(0,   `rgba(${rgb},1)`);
  g.addColorStop(0.5, `rgba(${rgb},0.8)`);
  g.addColorStop(1,   `rgba(${rgb},0.4)`);

  _glow(color, 18);
  ctx.fillStyle = g;
  _roundRect(px, py, pw, C.PADDLE_H, 5);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  _roundRect(px, py, pw, C.PADDLE_H, 5);
  ctx.stroke();
  _noGlow();

  if (state.shield) {
    const pct   = state.shieldTimer / (C.PW_DURATION * C.PW_SHIELD_MULT);
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
    _glow('#ffe600', 10);
    ctx.strokeStyle = `rgba(255,230,0,${pulse})`;
    ctx.lineWidth   = 2.5;
    const sw = pw * pct;
    ctx.beginPath();
    ctx.moveTo(px + (pw-sw)/2, py + C.PADDLE_H + 4);
    ctx.lineTo(px + (pw+sw)/2, py + C.PADDLE_H + 4);
    ctx.stroke();
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — BALLS
// ─────────────────────────────────────────────────────────────────
function _drawBalls(balls) {
  const r = C.BALL_RADIUS;
  for (const ball of balls) {
    if (ball.stuck) {
      const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.008);
      _glow('#ff1f8f', 16 * pulse);
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.font      = '700 8px "Share Tech Mono"';
      ctx.fillStyle = `rgba(255,255,255,${pulse * 0.6})`;
      ctx.textAlign = 'center';
      ctx.fillText('TAP / SPACE', ball.x, ball.y - 18);
      _noGlow();
      continue;
    }
    for (let ti = 0; ti < ball.trail.length; ti++) {
      const t    = ball.trail[ti];
      const prog = ti / ball.trail.length;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r * prog * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,31,143,${prog * 0.5})`;
      ctx.fill();
    }
    _glow('#ff88cc', 16);
    const bg = ctx.createRadialGradient(ball.x-2, ball.y-2, 0, ball.x, ball.y, r);
    bg.addColorStop(0,   '#fff');
    bg.addColorStop(0.5, '#ffccee');
    bg.addColorStop(1,   '#ff1f8f');
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — PARTICLES (pool reference)
// ─────────────────────────────────────────────────────────────────
function _drawParticles(pool) {
  for (const p of pool) {
    if (!p.alive) continue;
    const a = Math.max(0, p.life);
    ctx.globalAlpha = a;
    _glow(p.color, p.size * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  _noGlow();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — POWER-UPS
// ─────────────────────────────────────────────────────────────────
function _drawPowerUps(powerUps) {
  for (const pw of powerUps) {
    if (!pw.alive) continue;
    const def = ARK_PW_TYPES[pw.type];
    const x   = pw.x - C.PW_W / 2;
    const y   = pw.y - C.PW_H / 2;
    _glow(def.color, 12);
    ctx.fillStyle = def.bg;
    _roundRect(x, y, C.PW_W, C.PW_H, 4);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth   = 1.5;
    _roundRect(x, y, C.PW_W, C.PW_H, 4);
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.font      = '700 9px "Orbitron"';
    ctx.textAlign = 'center';
    ctx.fillText(def.label, pw.x, pw.y + 3.5);
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — SHOCKWAVES (shield-break effect)
// ─────────────────────────────────────────────────────────────────
function _drawShockwaves(shockwaves) {
  for (const sw of shockwaves) {
    if (sw.life <= 0) continue;
    const alpha = sw.life * sw.life;
    _glow(`rgba(255,230,0,${alpha})`, 14 * alpha);
    ctx.strokeStyle = `rgba(255,230,0,${alpha * 0.9})`;
    ctx.lineWidth   = 3 * alpha + 1;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,200,${alpha * 0.08})`;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § MAIN RENDER
// ─────────────────────────────────────────────────────────────────
function _render(state) {
  _drawBackground();
  if (_phase === 'IDLE') return;

  if (state.screenShake > 0) {
    ctx.save();
    ctx.translate(
      (Math.random() - 0.5) * state.screenShake * 1.2,
      (Math.random() - 0.5) * state.screenShake * 1.2
    );
  }
  _drawBricks(state.bricks);
  _drawParticles(state.particles);
  _drawShockwaves(state.shockwaves);
  _drawPowerUps(state.powerUps);
  _drawPaddle(state);
  _drawBalls(state.balls);
  if (state.screenShake > 0) ctx.restore();

  _drawHUD(state);
}

// ─────────────────────────────────────────────────────────────────
// § RAF LOOP
// ─────────────────────────────────────────────────────────────────
function _frame(ts) {
  // Re-register immediately so the handle is always current
  _rafId = requestAnimationFrame(_frame);

  const dt = Math.min((ts - _lastTime) / 1000, 0.05); // cap at 50ms
  _lastTime = ts;

  if (_phase === 'PLAYING' || _phase === 'READY') {
    if (_keys['ArrowLeft']  || _keys['a'] || _keys['A'])
      ARK_Engine.movePaddle(-C.PADDLE_SPEED * dt);
    if (_keys['ArrowRight'] || _keys['d'] || _keys['D'])
      ARK_Engine.movePaddle( C.PADDLE_SPEED * dt);

    ARK_Engine.tick(dt);
  }

  _render(ARK_Engine.getState());
}

// ─────────────────────────────────────────────────────────────────
// § GAME PHASE TRANSITIONS
// ─────────────────────────────────────────────────────────────────
function _startGame(levelIndex) {
  _currentLevel = levelIndex || 0;
  ARK_Engine.startLevel(_currentLevel);
  hideAllScreens();
  _phase = 'READY';
  _setHubLinkVisible(false);
  _announce(`Nivel ${_currentLevel + 1}: ${ARK_LEVELS[_currentLevel].name}`);
}

function _pauseGame() {
  if (_phase !== 'PLAYING') return;
  _phase = 'PAUSED';
  ARK_Engine.pause();
  const s = ARK_Engine.getState();
  _getEl('ARK_pause-info').textContent =
    `Nivel ${(s.levelIndex||0)+1} · ${s.score||0} puntos`;
  showScreen('ARK_screen-pause');
  _announce('Pausa');
}

function _resumeGame() {
  hideAllScreens();
  _phase = 'PLAYING';
  ARK_Engine.resume();
  _announce('Continuando');
}

function _onLevelComplete(data) {
  _phase = 'LEVEL_COMPLETE';
  const s          = ARK_Engine.getState();
  const lifeBonus  = s.lives * C.SCORE_LIFE_BONUS;
  const finalScore = data.score + C.SCORE_LEVEL_BONUS + lifeBonus;
  _totalScore     += finalScore;

  const coinsEarned = ARK_Integration.reportReward(
    `level_complete_${_currentLevel + 1}`,
    finalScore
  );
  _totalCoins += coinsEarned;

  _getEl('ARK_lc-level').textContent = `NIVEL ${_currentLevel + 1} COMPLETADO`;
  _getEl('ARK_lc-score').textContent = finalScore.toLocaleString();
  _getEl('ARK_lc-coins').textContent = `+${coinsEarned} 🪙 LOVE ARCADE`;
  showScreen('ARK_screen-levelcomplete');
  _announce(`¡Nivel ${_currentLevel + 1} completado! Ganaste ${coinsEarned} monedas.`);
}

function _onGameOver(data) {
  _phase       = 'GAME_OVER';
  _totalScore += data.score;
  const isNew  = ARK_Integration.saveHighscore(_totalScore);
  _getEl('ARK_go-score').textContent  = _totalScore.toLocaleString();
  _getEl('ARK_go-record').textContent = isNew
    ? '🏆 ¡NUEVO RÉCORD!'
    : `Récord: ${ARK_Integration.getHighscore().toLocaleString()}`;
  showScreen('ARK_screen-gameover');
  _setHubLinkVisible(true);
  _announce('Game Over');
}

function _onWin() {
  _phase = 'WIN';
  _getEl('ARK_win-score').textContent = _totalScore.toLocaleString();
  _getEl('ARK_win-coins').textContent = `Total: ${_totalCoins} 🪙`;
  showScreen('ARK_screen-win');
  _setHubLinkVisible(true);
  _announce('¡Juego completado! Todos los mundos conquistados.');
}

// ─────────────────────────────────────────────────────────────────
// § ENGINE EVENT WIRING
// Called once inside the _initialized guard in init().
// ─────────────────────────────────────────────────────────────────
function _wireEngineEvents() {
  ARK_Engine.on('levelComplete', _onLevelComplete);
  ARK_Engine.on('gameOver',      _onGameOver);
}

// ─────────────────────────────────────────────────────────────────
// § INPUT WIRING
// Called once inside the _initialized guard in init().
// ─────────────────────────────────────────────────────────────────
function _setupInput() {
  window.addEventListener('keydown', (e) => {
    _keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'Enter') && _phase === 'READY') {
      ARK_Engine.launchBall();
      _phase = 'PLAYING';
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (_phase === 'PLAYING') _pauseGame();
      else if (_phase === 'PAUSED') _resumeGame();
    }
    if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { _keys[e.key] = false; });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch    = e.touches[0];
    _touchLogicalX = _toLogicalX(touch.clientX);  // always fresh

    if (_phase === 'READY') {
      ARK_Engine.launchBall();
      _phase = 'PLAYING';
    } else if (_phase === 'PLAYING') {
      const logY = (touch.clientY - _offsetY) / _scale;
      if (logY < 56) _pauseGame();
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch    = e.touches[0];
    _touchLogicalX = _toLogicalX(touch.clientX);
    if (_phase === 'PLAYING' || _phase === 'READY') {
      ARK_Engine.setPaddleX(_touchLogicalX);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    _touchLogicalX = null;
  }, { passive: false });

  canvas.addEventListener('mousemove', (e) => {
    if (_phase === 'PLAYING' || _phase === 'READY') {
      ARK_Engine.setPaddleX(_toLogicalX(e.clientX));
    }
  });
  canvas.addEventListener('click', () => {
    if (_phase === 'READY') {
      ARK_Engine.launchBall();
      _phase = 'PLAYING';
    }
  });
}

// ─────────────────────────────────────────────────────────────────
// § BUTTON WIRING
// Called once inside the _initialized guard in init().
// ─────────────────────────────────────────────────────────────────
function _wireButtons() {
  _getEl('ARK_btn-start').addEventListener('click', () => {
    _totalScore = 0; _totalCoins = 0; _startGame(0);
  });
  _getEl('ARK_btn-resume').addEventListener('click', _resumeGame);
  _getEl('ARK_btn-quit-pause').addEventListener('click', () => {
    window.location.href = '../../index.html';
  });
  _getEl('ARK_btn-next').addEventListener('click', () => {
    const next = _currentLevel + 1;
    if (next >= ARK_LEVELS.length) { hideAllScreens(); _onWin(); }
    else _startGame(next);
  });
  _getEl('ARK_btn-restart').addEventListener('click', () => {
    _totalScore = 0; _totalCoins = 0; _startGame(0);
  });
  _getEl('ARK_btn-play-again').addEventListener('click', () => {
    _totalScore = 0; _totalCoins = 0; _startGame(0);
  });
}

// ─────────────────────────────────────────────────────────────────
// § INIT — exported entry point
//
// Safe to call multiple times. Two guards prevent side-effects:
//
//  • _initialized — ensures addEventListener wiring runs only once.
//    Without it, every extra init() adds duplicate listeners.
//
//  • cancelAnimationFrame(_rafId) — cancels any running loop before
//    starting a new one. Without it, multiple loops would run in
//    parallel, multiplying game speed by the number of init() calls.
//
// After calling init() N times from the console, only one _frame()
// callback should be active (verifiable in DevTools > Performance
// > Timings or by checking there is only a single RAF pending).
// ─────────────────────────────────────────────────────────────────
export function init() {
  canvas      = document.getElementById('ARK_canvas');
  ctx         = canvas.getContext('2d');
  _ariaStatus = document.getElementById('ARK_aria-status');

  // Always re-run resize to handle orientation/window changes between inits
  _resize();

  // ── Wire events once ─────────────────────────────────────────
  if (!_initialized) {
    _initialized = true;

    // Resize / orientation — debounced via Love Arcade platform util (§8.1)
    const resizeHandler = typeof window.debounce === 'function'
      ? window.debounce(_resize, 80)
      : _resize;
    window.addEventListener('resize', resizeHandler);
    // orientationchange fires before innerWidth updates on iOS
    window.addEventListener('orientationchange', () => setTimeout(_resize, 100));

    _wireEngineEvents();   // engine → UI event bridge
    _setupInput();         // keyboard, touch, mouse
    _wireButtons();        // DOM button onclick handlers
  }

  // ── Reset game state for a clean run ────────────────────────
  showScreen('ARK_screen-start');
  _phase = 'IDLE';
  ARK_Engine.startLevel(0);  // pre-load level 0 for background render

  // ── RAF loop — cancel stale loop, then start fresh ───────────
  // This is the second guard: even if _initialized prevented duplicate
  // listeners, a previous init() may have started a RAF loop that is
  // still running. Cancel it before issuing a new requestAnimationFrame.
  if (_rafId !== null) cancelAnimationFrame(_rafId);
  _lastTime = performance.now();
  _rafId    = requestAnimationFrame(_frame);

  console.log('[ARK] UI initialised · Arkanoid v2.1.0 — Love Arcade');
}

// Grouped export for index.html entry point
export const ARK_UI = { init, showScreen, hideAllScreens };
