/**
 * ark.ui.js — Arkanoid · Love Arcade  v3.1.0
 * Module D: Rendering, input, screen management, RAF loop.
 *
 * ── FREEZE FIX ───────────────────────────────────────────────────
 * Root cause: _onLevelComplete set _phase = 'LEVEL_COMPLETE', which
 * broke the RAF condition (_phase === 'PLAYING' || 'READY'), halting
 * tick() forever. The HTML overlay waited for a button no one tapped.
 *
 * Fix: the HTML ARK_screen-levelcomplete is REMOVED.
 * Level transitions happen entirely on canvas while the engine keeps
 * running:
 *   1. _phase stays 'PLAYING'. tick() continues uninterrupted.
 *   2. A canvas banner is drawn for TRANSITION_MS (2 s).
 *   3. setTimeout auto-calls startLevel(next) → _phase = 'READY'.
 *   4. Ball appears on paddle. Player taps / presses SPACE to launch.
 *
 * ── GAME OVER ────────────────────────────────────────────────────
 * Simplified: shows only coins earned + level reached.
 * No scores, records, or "best level" clutter.
 *
 * ── TOUCH FIX (v3.0) ────────────────────────────────────────────
 * • pointerdown on all buttons (no synthetic-click dependency)
 * • e.preventDefault() only in PLAYING / READY phases
 * • touch-action: manipulation on .ark-btn (CSS)
 */

'use strict';

import {
  ARK_CONFIG,
  ARK_BRICK_COLORS,
  ARK_PW_TYPES,
  ARK_hexToRgb,
} from './ark.config.js';

import { ARK_Engine } from './ark.engine.js';
import { ARK_Integration } from './ark.integration.js';

const C = ARK_CONFIG;

// ms the between-level banner stays visible before new bricks load
const TRANSITION_MS = 2000;

// ─────────────────────────────────────────────────────────────────
// § CANVAS / VIEWPORT
// ─────────────────────────────────────────────────────────────────
let canvas, ctx;
let _scale   = 1;
let _offsetX = 0;
let _offsetY = 0;

// ─────────────────────────────────────────────────────────────────
// § GAME PHASE  IDLE | READY | PLAYING | PAUSED | GAME_OVER
// ─────────────────────────────────────────────────────────────────
let _phase        = 'IDLE';
let _currentLevel = 0;
let _totalCoins   = 0;

// ── Level transition overlay state ──────────────────────────────
let _txActive    = false;   // true while banner is showing
let _txUntil     = 0;       // performance.now() when banner ends
let _txCoins     = 0;       // coins earned in completed level
let _txIsBoss    = false;
let _txTimer     = null;    // setTimeout handle

// ─────────────────────────────────────────────────────────────────
// § DOUBLE-INIT GUARDS
// ─────────────────────────────────────────────────────────────────
let _initialized = false;
let _rafId       = null;
let _lastTime    = 0;

// ─────────────────────────────────────────────────────────────────
// § INPUT
// ─────────────────────────────────────────────────────────────────
const _keys = {};
let _touchLogicalX = null;

// ─────────────────────────────────────────────────────────────────
// § ACCESSIBILITY
// ─────────────────────────────────────────────────────────────────
let _ariaStatus = null;
function _announce(msg) { if (_ariaStatus) _ariaStatus.textContent = msg; }

// ─────────────────────────────────────────────────────────────────
// § CANVAS SIZING
// ─────────────────────────────────────────────────────────────────
function _resize() {
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  _scale    = Math.min(vw / C.LW, vh / C.LH);
  const cw  = Math.floor(C.LW * _scale);
  const ch  = Math.floor(C.LH * _scale);
  _offsetX  = Math.floor((vw - cw) / 2);
  _offsetY  = Math.floor((vh - ch) / 2);
  canvas.width  = cw * dpr;
  canvas.height = ch * dpr;
  canvas.style.cssText = `display:block;position:fixed;left:${_offsetX}px;top:${_offsetY}px;width:${cw}px;height:${ch}px;cursor:none;image-rendering:pixelated;`;
  ctx.setTransform(dpr * _scale, 0, 0, dpr * _scale, 0, 0);
}

function _toLogicalX(clientX) { return (clientX - _offsetX) / _scale; }

// ─────────────────────────────────────────────────────────────────
// § SCREEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────
const _elCache = {};
function _el(id) { return (_elCache[id] = _elCache[id] || document.getElementById(id)); }

function showScreen(id) {
  document.querySelectorAll('.ark-screen').forEach(s => s.classList.remove('ark-visible'));
  const sc = _el(id); if (sc) sc.classList.add('ark-visible');
}
function hideAllScreens() {
  document.querySelectorAll('.ark-screen').forEach(s => s.classList.remove('ark-visible'));
}
function _hubVisible(v) {
  const el = _el('ARK_hub-link'); if (!el) return;
  el.style.opacity = v ? '0.7' : '0';
  el.style.pointerEvents = v ? 'all' : 'none';
}

// ─────────────────────────────────────────────────────────────────
// § RENDERING HELPERS
// ─────────────────────────────────────────────────────────────────
function _glow(color, r) { ctx.shadowColor = color; ctx.shadowBlur = r; }
function _noGlow()        { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

function _roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — BACKGROUND
// ─────────────────────────────────────────────────────────────────
function _drawBg() {
  ctx.fillStyle = '#06010f'; ctx.fillRect(0, 0, C.LW, C.LH);
  ctx.strokeStyle = 'rgba(100,50,180,0.06)'; ctx.lineWidth = 0.5;
  for (let x = 0; x < C.LW; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.LH); ctx.stroke(); }
  for (let y = 0; y < C.LH; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.LW, y); ctx.stroke(); }
  const vig = ctx.createRadialGradient(C.LW/2, C.LH/2, C.LH*0.2, C.LW/2, C.LH/2, C.LH*0.8);
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig; ctx.fillRect(0, 0, C.LW, C.LH);
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — HUD  (shows coins, not internal score)
// ─────────────────────────────────────────────────────────────────
function _drawHUD(state) {
  ctx.fillStyle = 'rgba(6,1,20,0.85)'; ctx.fillRect(0, 0, C.LW, 56);
  ctx.strokeStyle = 'rgba(255,31,143,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(C.LW, 56); ctx.stroke();

  const ld = state.levelData;
  ctx.font = '600 8px "Share Tech Mono",monospace'; ctx.fillStyle = 'rgba(187,134,252,0.7)'; ctx.textAlign = 'left';
  ctx.fillText(`NV.${state.levelIndex + 1}${ld?.isBoss ? ' ⚡JEFE' : ''} · ${ld?.name || ''}`, 12, 14);

  // Centre: total coins (the currency players care about)
  _glow('#ffe600', 12);
  ctx.font = '900 20px "Orbitron",sans-serif'; ctx.fillStyle = '#ffe600'; ctx.textAlign = 'center';
  ctx.fillText(`${_totalCoins} 🪙`, C.LW / 2, 38);
  _noGlow();

  // Lives (right)
  ctx.textAlign = 'right'; ctx.font = '14px sans-serif';
  for (let i = 0; i < (state.lives || 0); i++) { _glow('#ff1f8f', 8); ctx.fillStyle = '#ff1f8f'; ctx.fillText('♥', C.LW - 12 - i * 20, 38); }
  _noGlow();

  // Combo (left, second line)
  if (state.combo > 1) {
    ctx.font = '700 9px "Orbitron",sans-serif';
    ctx.fillStyle = `rgba(0,232,255,${Math.min(1, state.combo / 8)})`;
    ctx.textAlign = 'left'; ctx.fillText(`×${state.combo} COMBO`, 12, 38);
  }

  // Power-up badges
  const nt = performance.now() * 0.005;
  let bx = 12;
  if (state.shield) {
    ctx.font = '700 9px "Orbitron",sans-serif';
    ctx.fillStyle = `rgba(255,230,0,${0.6 + 0.4 * Math.sin(nt)})`;
    ctx.textAlign = 'left'; ctx.fillText('🛡', bx, 50); bx += 18;
  }
  if (state.fireTimer > 0) {
    ctx.font = '700 9px "Orbitron",sans-serif';
    ctx.fillStyle = `rgba(255,102,0,${0.6 + 0.4 * Math.abs(Math.sin(nt * 2))})`;
    ctx.textAlign = 'left'; ctx.fillText('🔥', bx, 50); bx += 18;
    ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#ff6600';
    ctx.fillText(`${(state.fireTimer / 1000).toFixed(1)}s`, bx, 50); bx += 28;
  }
  let tx = C.LW - 12; ctx.textAlign = 'right';
  if (state.expandTimer > 0) { ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#00cc66'; ctx.fillText(`E:${(state.expandTimer/1000).toFixed(1)}s`, tx, 50); tx -= 48; }
  if (state.slowTimer   > 0) { ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#4488ff'; ctx.fillText(`S:${(state.slowTimer/1000).toFixed(1)}s`, tx, 50); }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — LEVEL TRANSITION BANNER
// Drawn on top of the live game (engine keeps ticking underneath).
// Shows for TRANSITION_MS then disappears as new bricks load.
// ─────────────────────────────────────────────────────────────────
function _drawTransitionBanner() {
  const now      = performance.now();
  const elapsed  = now - (_txUntil - TRANSITION_MS);
  const t        = Math.min(1, elapsed / TRANSITION_MS);  // 0 → 1

  // Alpha: fade-in first 15%, full for middle, fade-out last 15%
  const alpha = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
  if (alpha <= 0.01) return;

  const cx    = C.LW / 2;
  const cy    = C.LH / 2;
  const bw    = 300, bh = 140;
  const accent = _txIsBoss ? '#ff6600' : '#00e8ff';

  // Card background
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle   = 'rgba(6,1,20,0.96)';
  _roundRect(cx - bw/2, cy - bh/2, bw, bh, 14);
  ctx.fill();
  ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  _roundRect(cx - bw/2, cy - bh/2, bw, bh, 14);
  ctx.stroke();

  ctx.globalAlpha = alpha;

  // Title
  _glow(accent, 16);
  ctx.font = '900 12px "Orbitron",sans-serif'; ctx.fillStyle = accent; ctx.textAlign = 'center';
  ctx.fillText(_txIsBoss ? '⚡ JEFE DERROTADO' : '✓ NIVEL COMPLETADO', cx, cy - 38);
  _noGlow();

  // Level number
  ctx.font = '700 26px "Orbitron",sans-serif'; ctx.fillStyle = '#ffffff';
  ctx.fillText(`NIVEL ${_currentLevel + 1}`, cx, cy - 4);

  // Coins earned
  _glow('#ffe600', 10);
  ctx.font = '700 15px "Share Tech Mono",monospace'; ctx.fillStyle = '#ffe600';
  ctx.fillText(`+${_txCoins} 🪙`, cx, cy + 28);
  _noGlow();

  // Loading bar (progress toward next level)
  const barW = 220, barH = 6;
  const barX = cx - barW / 2, barY = cy + 50;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  _roundRect(barX, barY, barW, barH, 3); ctx.fill();
  _glow(accent, 6);
  ctx.fillStyle = accent;
  _roundRect(barX, barY, barW * t, barH, 3); ctx.fill();
  _noGlow();

  ctx.globalAlpha = 1;
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
      ctx.fillStyle = g; _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(rx+3,ry+3); ctx.lineTo(rx+C.BRICK_W-3,ry+C.BRICK_H-3);
      ctx.moveTo(rx+C.BRICK_W-3,ry+3); ctx.lineTo(rx+3,ry+C.BRICK_H-3); ctx.stroke();
    } else {
      const rgb = ARK_hexToRgb(color);
      const g   = ctx.createLinearGradient(rx, ry, rx, ry + C.BRICK_H);
      if (b.hp === 2) { g.addColorStop(0,`rgba(${rgb},0.9)`); g.addColorStop(1,`rgba(${rgb},0.5)`); _glow(color, 6); }
      else            { g.addColorStop(0,`rgba(${rgb},0.95)`); g.addColorStop(1,`rgba(${rgb},0.6)`); _glow(color, 10); }
      ctx.fillStyle = g; _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3); ctx.fill();
      if (b.hp === 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(rx+2, ry+C.BRICK_H/2); ctx.lineTo(rx+C.BRICK_W-2, ry+C.BRICK_H/2); ctx.stroke();
      }
    }
    _noGlow();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.8;
    _roundRect(rx, ry, C.BRICK_W, C.BRICK_H, 3); ctx.stroke();
  }
  _noGlow();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — PADDLE
// ─────────────────────────────────────────────────────────────────
function _drawPaddle(state) {
  const pw = state.paddleW, px = state.paddleX - pw/2, py = C.PADDLE_Y - C.PADDLE_H/2;
  const onFire = state.fireTimer > 0;
  const color  = onFire ? '#ff6600' : (state.expandTimer > 0 ? '#00cc66' : '#00e8ff');
  const rgb    = onFire ? '255,102,0' : (state.expandTimer > 0 ? '0,204,102' : '0,232,255');
  const g = ctx.createLinearGradient(px, py, px, py + C.PADDLE_H);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(0.5, `rgba(${rgb},0.8)`); g.addColorStop(1, `rgba(${rgb},0.4)`);
  _glow(color, onFire ? 22 : 18);
  ctx.fillStyle = g; _roundRect(px, py, pw, C.PADDLE_H, 5); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; _roundRect(px, py, pw, C.PADDLE_H, 5); ctx.stroke();
  _noGlow();
  if (state.shield) {
    const sw = pw * (state.shieldTimer / (C.PW_DURATION * C.PW_SHIELD_MULT));
    _glow('#ffe600', 10);
    ctx.strokeStyle = `rgba(255,230,0,${0.6 + 0.4 * Math.sin(performance.now() * 0.005)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px+(pw-sw)/2, py+C.PADDLE_H+4); ctx.lineTo(px+(pw+sw)/2, py+C.PADDLE_H+4); ctx.stroke();
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
      const p = 0.7 + 0.3 * Math.sin(performance.now() * 0.008);
      _glow('#ff1f8f', 16 * p);
      ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.font = '700 8px "Share Tech Mono"'; ctx.fillStyle = `rgba(255,255,255,${p*0.6})`; ctx.textAlign = 'center';
      ctx.fillText('TAP / SPACE', ball.x, ball.y - 18); _noGlow(); continue;
    }
    for (let ti = 0; ti < ball.trail.length; ti++) {
      const t = ball.trail[ti], prog = ti / ball.trail.length;
      ctx.beginPath(); ctx.arc(t.x, t.y, r * prog * 0.8, 0, Math.PI*2);
      ctx.fillStyle = ball.fire ? `rgba(255,102,0,${prog*0.6})` : `rgba(255,31,143,${prog*0.5})`; ctx.fill();
    }
    _glow(ball.fire ? '#ff6600' : '#ff88cc', 18);
    const bg = ctx.createRadialGradient(ball.x-2, ball.y-2, 0, ball.x, ball.y, r);
    if (ball.fire) { bg.addColorStop(0,'#fff'); bg.addColorStop(0.4,'#ffcc00'); bg.addColorStop(1,'#ff3300'); }
    else           { bg.addColorStop(0,'#fff'); bg.addColorStop(0.5,'#ffccee'); bg.addColorStop(1,'#ff1f8f'); }
    ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI*2); ctx.fillStyle = bg; ctx.fill(); _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — PARTICLES
// ─────────────────────────────────────────────────────────────────
function _drawParticles(pool) {
  for (const p of pool) {
    if (!p.alive) continue;
    ctx.globalAlpha = Math.max(0, p.life);
    _glow(p.color, p.size * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; _noGlow();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — POWER-UPS
// ─────────────────────────────────────────────────────────────────
function _drawPowerUps(powerUps) {
  for (const pw of powerUps) {
    if (!pw.alive) continue;
    const def = ARK_PW_TYPES[pw.type]; if (!def) continue;
    const x = pw.x - C.PW_W/2, y = pw.y - C.PW_H/2;
    _glow(def.color, 12); ctx.fillStyle = def.bg; _roundRect(x, y, C.PW_W, C.PW_H, 4); ctx.fill();
    ctx.strokeStyle = def.color; ctx.lineWidth = 1.5; _roundRect(x, y, C.PW_W, C.PW_H, 4); ctx.stroke();
    ctx.fillStyle = def.color; ctx.font = '700 9px "Orbitron"'; ctx.textAlign = 'center';
    ctx.fillText(def.label, pw.x, pw.y + 3.5); _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — SHOCKWAVES
// ─────────────────────────────────────────────────────────────────
function _drawShockwaves(sw) {
  for (const s of sw) {
    if (s.life <= 0) continue;
    const a = s.life * s.life;
    _glow(`rgba(255,230,0,${a})`, 14*a);
    ctx.strokeStyle = `rgba(255,230,0,${a*0.9})`; ctx.lineWidth = 3*a+1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,200,${a*0.08})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r*0.85, 0, Math.PI*2); ctx.fill();
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § MAIN RENDER
// ─────────────────────────────────────────────────────────────────
function _render(state) {
  _drawBg();
  if (_phase === 'IDLE') return;

  if (state.screenShake > 0) {
    ctx.save();
    ctx.translate((Math.random()-.5)*state.screenShake*1.2, (Math.random()-.5)*state.screenShake*1.2);
  }
  _drawBricks(state.bricks);
  _drawParticles(state.particles);
  _drawShockwaves(state.shockwaves);
  _drawPowerUps(state.powerUps);
  _drawPaddle(state);
  _drawBalls(state.balls);
  if (state.screenShake > 0) ctx.restore();
  _drawHUD(state);

  // Canvas banner overlay — drawn last so it sits on top of everything
  if (_txActive) _drawTransitionBanner();
}

// ─────────────────────────────────────────────────────────────────
// § RAF LOOP
// ─────────────────────────────────────────────────────────────────
function _frame(ts) {
  _rafId    = requestAnimationFrame(_frame);
  const dt  = Math.min((ts - _lastTime) / 1000, 0.05);
  _lastTime = ts;

  if (_phase === 'PLAYING' || _phase === 'READY') {
    if (_keys['ArrowLeft']  || _keys['a'] || _keys['A']) ARK_Engine.movePaddle(-C.PADDLE_SPEED * dt);
    if (_keys['ArrowRight'] || _keys['d'] || _keys['D']) ARK_Engine.movePaddle( C.PADDLE_SPEED * dt);
    ARK_Engine.tick(dt);
  }

  // Hide banner once its timer has elapsed
  if (_txActive && performance.now() >= _txUntil) _txActive = false;

  _render(ARK_Engine.getState());
}

// ─────────────────────────────────────────────────────────────────
// § GAME PHASE TRANSITIONS
// ─────────────────────────────────────────────────────────────────
function _startGame(levelIndex) {
  // Cancel any pending auto-advance from a previous run
  if (_txTimer !== null) { clearTimeout(_txTimer); _txTimer = null; }
  _txActive = false;

  _currentLevel = levelIndex || 0;
  _totalCoins   = 0;

  ARK_Engine.startLevel(_currentLevel);
  hideAllScreens();
  _phase = 'READY';
  _hubVisible(false);
  _announce(`Nivel ${_currentLevel + 1}`);
}

function _pauseGame() {
  if (_phase !== 'PLAYING') return;
  _phase = 'PAUSED'; ARK_Engine.pause();
  const s = ARK_Engine.getState();
  _el('ARK_pause-info').textContent = `Nivel ${s.levelIndex + 1}  ·  ${_totalCoins} 🪙`;
  showScreen('ARK_screen-pause'); _announce('Pausa');
}

function _resumeGame() {
  hideAllScreens(); _phase = 'PLAYING'; ARK_Engine.resume(); _announce('Continuando');
}

// ─────────────────────────────────────────────────────────────────
// § LEVEL COMPLETE  — THE KEY FIX
//
// Phase stays 'PLAYING'. Engine keeps ticking (ball bounces freely
// on empty board — looks intentional, fills the gap nicely).
// Canvas banner appears for TRANSITION_MS.
// setTimeout fires → startLevel(next) → _phase = 'READY'.
// ─────────────────────────────────────────────────────────────────
function _onLevelComplete(data) {
  // Guard: ignore if a transition is already running (double-fire safety)
  if (_txActive && performance.now() < _txUntil) return;

  // Report coins
  const s    = ARK_Engine.getState();
  const pts  = data.score + C.SCORE_LEVEL_BONUS + s.lives * C.SCORE_LIFE_BONUS;
  const coins = ARK_Integration.reportReward(`level_${_currentLevel + 1}`, pts);
  _totalCoins += coins;

  // Save best level
  try {
    const best = parseInt(localStorage.getItem(C.LS_BEST_LEVEL) || '0', 10);
    if (_currentLevel + 1 > best) localStorage.setItem(C.LS_BEST_LEVEL, String(_currentLevel + 1));
  } catch {}

  // Show canvas banner
  _txCoins   = coins;
  _txIsBoss  = !!s.levelData?.isBoss;
  _txUntil   = performance.now() + TRANSITION_MS;
  _txActive  = true;

  _announce(`Nivel ${_currentLevel + 1} completado. +${coins} monedas. Cargando nivel ${_currentLevel + 2}.`);

  // Auto-advance: phase remains 'PLAYING' until the timer fires
  _txTimer = setTimeout(() => {
    _txTimer = null;
    _currentLevel++;
    ARK_Engine.startLevel(_currentLevel);
    _phase = 'READY';   // ball placed on paddle — tap/SPACE to launch
    _announce(`Nivel ${_currentLevel + 1}`);
  }, TRANSITION_MS);
}

// ─────────────────────────────────────────────────────────────────
// § GAME OVER — coins only, clean layout
// ─────────────────────────────────────────────────────────────────
function _onGameOver() {
  if (_txTimer !== null) { clearTimeout(_txTimer); _txTimer = null; }
  _txActive = false;
  _phase    = 'GAME_OVER';

  _el('ARK_go-coins').textContent = `${_totalCoins} 🪙`;
  _el('ARK_go-level').textContent = `Nivel ${_currentLevel + 1}`;

  showScreen('ARK_screen-gameover');
  _hubVisible(true);
  _announce(`Game Over. ${_totalCoins} monedas ganadas.`);
}

// ─────────────────────────────────────────────────────────────────
// § ENGINE EVENTS
// ─────────────────────────────────────────────────────────────────
function _wireEngineEvents() {
  ARK_Engine.on('levelComplete', _onLevelComplete);
  ARK_Engine.on('gameOver',      _onGameOver);
}

// ─────────────────────────────────────────────────────────────────
// § INPUT WIRING
// ─────────────────────────────────────────────────────────────────
function _setupInput() {
  window.addEventListener('keydown', (e) => {
    _keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'Enter') && _phase === 'READY') { ARK_Engine.launchBall(); _phase = 'PLAYING'; }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (_phase === 'PLAYING') _pauseGame(); else if (_phase === 'PAUSED') _resumeGame();
    }
    if (['ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { _keys[e.key] = false; });

  // Touch: preventDefault only during active gameplay to avoid
  // blocking button taps on overlay screens (GAME_OVER, PAUSED, etc.)
  canvas.addEventListener('touchstart', (e) => {
    const active = _phase === 'PLAYING' || _phase === 'READY';
    if (active) e.preventDefault();
    const touch = e.touches[0];
    _touchLogicalX = _toLogicalX(touch.clientX);
    if (_phase === 'READY') { ARK_Engine.launchBall(); _phase = 'PLAYING'; }
    else if (_phase === 'PLAYING') {
      if ((touch.clientY - _offsetY) / _scale < 56) _pauseGame();
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (_phase === 'PLAYING' || _phase === 'READY') {
      e.preventDefault();
      _touchLogicalX = _toLogicalX(e.touches[0].clientX);
      ARK_Engine.setPaddleX(_touchLogicalX);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (_phase === 'PLAYING' || _phase === 'READY') e.preventDefault();
    _touchLogicalX = null;
  }, { passive: false });

  canvas.addEventListener('mousemove', (e) => {
    if (_phase === 'PLAYING' || _phase === 'READY') ARK_Engine.setPaddleX(_toLogicalX(e.clientX));
  });
  canvas.addEventListener('click', () => {
    if (_phase === 'READY') { ARK_Engine.launchBall(); _phase = 'PLAYING'; }
  });
}

// ─────────────────────────────────────────────────────────────────
// § BUTTON WIRING  (pointerdown — works for mouse and touch)
// ─────────────────────────────────────────────────────────────────
function _wireButtons() {
  function _btn(id, fn) {
    const el = _el(id); if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); fn(); });
  }
  _btn('ARK_btn-start',      () => _startGame(0));
  _btn('ARK_btn-resume',     _resumeGame);
  _btn('ARK_btn-quit-pause', () => { window.location.href = '../../index.html'; });
  _btn('ARK_btn-restart',    () => _startGame(0));
}

// ─────────────────────────────────────────────────────────────────
// § INIT
// ─────────────────────────────────────────────────────────────────
export function init() {
  canvas      = document.getElementById('ARK_canvas');
  ctx         = canvas.getContext('2d');
  _ariaStatus = document.getElementById('ARK_aria-status');
  _resize();

  if (!_initialized) {
    _initialized = true;
    const rh = typeof window.debounce === 'function' ? window.debounce(_resize, 80) : _resize;
    window.addEventListener('resize', rh);
    window.addEventListener('orientationchange', () => setTimeout(_resize, 100));
    _wireEngineEvents();
    _setupInput();
    _wireButtons();
  }

  showScreen('ARK_screen-start');
  _phase = 'IDLE';
  ARK_Engine.startLevel(0);

  if (_rafId !== null) cancelAnimationFrame(_rafId);
  _lastTime = performance.now();
  _rafId    = requestAnimationFrame(_frame);
  console.log('[ARK] Arkanoid v3.1.0 — Love Arcade');
}

export const ARK_UI = { init, showScreen, hideAllScreens };
