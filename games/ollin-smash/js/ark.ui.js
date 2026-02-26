/**
 * ark.ui.js — Arkanoid · Love Arcade  v3.0.0
 * Module D: Rendering, input, screen management, RAF loop.
 *
 * ── Touch bug fix ─────────────────────────────────────────────────
 * Root cause: body { touch-action: none } + unconditional
 * e.preventDefault() in the canvas touchstart handler suppresses
 * the browser's synthetic "click" event generation for ALL HTML
 * elements, including the overlay screen buttons (iOS Safari).
 *
 * Fix (two parts):
 *  1. Canvas touchstart only calls e.preventDefault() when the
 *     game is in an active phase (READY or PLAYING). In terminal
 *     phases (GAME_OVER, WIN, IDLE, PAUSED) the event is not
 *     prevented, so the browser can process taps on screen buttons.
 *  2. All button event listeners use `pointerdown` instead of
 *     `click`. `pointerdown` fires natively for both mouse presses
 *     and touch taps without requiring synthetic click generation.
 *     CSS adds `touch-action: manipulation` on .ark-btn to ensure
 *     immediate pointer events without scroll-delay.
 *
 * ── Double-init safety ────────────────────────────────────────────
 *  • _initialized flag — all addEventListener wiring runs once.
 *  • cancelAnimationFrame(_rafId) — kills stale loop before restart.
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

// ─────────────────────────────────────────────────────────────────
// § CANVAS / VIEWPORT
// ─────────────────────────────────────────────────────────────────
let canvas, ctx;
let _scale   = 1;
let _offsetX = 0;
let _offsetY = 0;

// ─────────────────────────────────────────────────────────────────
// § GAME PHASE
// ─────────────────────────────────────────────────────────────────
let _phase        = 'IDLE';
let _currentLevel = 0;
let _totalScore   = 0;
let _totalCoins   = 0;

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
  el.style.opacity = v ? '0.7' : '0'; el.style.pointerEvents = v ? 'all' : 'none';
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
// § DRAW — HUD
// ─────────────────────────────────────────────────────────────────
function _drawHUD(state) {
  ctx.fillStyle = 'rgba(6,1,20,0.85)'; ctx.fillRect(0, 0, C.LW, 56);
  ctx.strokeStyle = 'rgba(255,31,143,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 56); ctx.lineTo(C.LW, 56); ctx.stroke();

  // World / level label
  const ld  = state.levelData;
  const lvl = state.levelIndex + 1;
  const worldLabel = ld ? ld.name : `NIVEL ${lvl}`;
  ctx.font = '600 8px "Share Tech Mono",monospace'; ctx.fillStyle = 'rgba(187,134,252,0.7)'; ctx.textAlign = 'left';
  ctx.fillText(`NV.${lvl}${ld?.isBoss ? ' ⚡JEFE' : ''} · ${worldLabel}`, 12, 14);

  // Score
  _glow('#ffe600', 12); ctx.font = '900 22px "Orbitron",sans-serif'; ctx.fillStyle = '#ffe600'; ctx.textAlign = 'center';
  ctx.fillText(String(state.score || 0).padStart(7, '0'), C.LW / 2, 38); _noGlow();

  // Lives
  ctx.textAlign = 'right'; ctx.font = '14px sans-serif';
  for (let i = 0; i < (state.lives || 0); i++) { _glow('#ff1f8f', 8); ctx.fillStyle = '#ff1f8f'; ctx.fillText('♥', C.LW - 12 - i * 20, 38); }
  _noGlow();

  // Combo
  if (state.combo > 1) {
    ctx.font = '700 9px "Orbitron",sans-serif';
    ctx.fillStyle = `rgba(0,232,255,${Math.min(1, state.combo / 8)})`;
    ctx.textAlign = 'left'; ctx.fillText(`×${state.combo} COMBO`, 12, 38);
  }

  // Status badges (bottom of HUD, left)
  let bx = 12;
  const nt = performance.now() * 0.005;
  if (state.shield) {
    const p = 0.6 + 0.4 * Math.sin(nt);
    ctx.font = '700 9px "Orbitron",sans-serif'; ctx.fillStyle = `rgba(255,230,0,${p})`; ctx.textAlign = 'left';
    ctx.fillText('🛡', bx, 50); bx += 18;
  }
  if (state.fireTimer > 0) {
    const p = 0.6 + 0.4 * Math.abs(Math.sin(nt * 2));
    ctx.font = '700 9px "Orbitron",sans-serif'; ctx.fillStyle = `rgba(255,102,0,${p})`; ctx.textAlign = 'left';
    ctx.fillText('🔥', bx, 50); bx += 18;
    ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#ff6600';
    ctx.fillText(`${(state.fireTimer / 1000).toFixed(1)}s`, bx, 50); bx += 28;
  }

  // Timer badges (right)
  let tx = C.LW - 12; ctx.textAlign = 'right';
  if (state.expandTimer > 0) { ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#00cc66'; ctx.fillText(`E:${(state.expandTimer/1000).toFixed(1)}s`, tx, 50); tx -= 48; }
  if (state.slowTimer   > 0) { ctx.font = '700 7px "Share Tech Mono"'; ctx.fillStyle = '#4488ff'; ctx.fillText(`S:${(state.slowTimer/1000).toFixed(1)}s`, tx, 50); }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — BRICKS
// ─────────────────────────────────────────────────────────────────
function _drawBricks(bricks) {
  for (const b of bricks) {
    if (b.dead || b.hp <= 0) continue;
    const rx = b.gx * (C.BRICK_W + C.BRICK_GAP) + C.BRICK_START_X;
    const ry = b.gy * (C.BRICK_H + C.BRICK_GAP) + C.BRICK_START_Y;
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
  const pw  = state.paddleW;
  const px  = state.paddleX - pw / 2;
  const py  = C.PADDLE_Y - C.PADDLE_H / 2;
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
    const pct = state.shieldTimer / (C.PW_DURATION * C.PW_SHIELD_MULT);
    const p   = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
    _glow('#ffe600', 10); ctx.strokeStyle = `rgba(255,230,0,${p})`; ctx.lineWidth = 2.5;
    const sw = pw * pct;
    ctx.beginPath(); ctx.moveTo(px+(pw-sw)/2, py+C.PADDLE_H+4); ctx.lineTo(px+(pw+sw)/2, py+C.PADDLE_H+4); ctx.stroke(); _noGlow();
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
      _glow('#ff1f8f', 16 * p); ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
      ctx.font='700 8px "Share Tech Mono"'; ctx.fillStyle=`rgba(255,255,255,${p*0.6})`; ctx.textAlign='center';
      ctx.fillText('TAP / SPACE', ball.x, ball.y - 18); _noGlow(); continue;
    }
    // Trail
    for (let ti = 0; ti < ball.trail.length; ti++) {
      const t = ball.trail[ti]; const prog = ti / ball.trail.length;
      ctx.beginPath(); ctx.arc(t.x, t.y, r * prog * 0.8, 0, Math.PI*2);
      ctx.fillStyle = ball.fire ? `rgba(255,102,0,${prog * 0.6})` : `rgba(255,31,143,${prog * 0.5})`; ctx.fill();
    }
    // Ball body
    const gc = ball.fire ? '#ff6600' : '#ff88cc';
    _glow(gc, 18);
    const bg = ctx.createRadialGradient(ball.x-2, ball.y-2, 0, ball.x, ball.y, r);
    if (ball.fire) { bg.addColorStop(0,'#fff'); bg.addColorStop(0.4,'#ffcc00'); bg.addColorStop(1,'#ff3300'); }
    else           { bg.addColorStop(0,'#fff'); bg.addColorStop(0.5,'#ffccee'); bg.addColorStop(1,'#ff1f8f'); }
    ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI*2); ctx.fillStyle=bg; ctx.fill(); _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — PARTICLES
// ─────────────────────────────────────────────────────────────────
function _drawParticles(pool) {
  for (const p of pool) {
    if (!p.alive) continue;
    const a = Math.max(0, p.life); ctx.globalAlpha = a;
    _glow(p.color, p.size * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; _noGlow();
}

// ─────────────────────────────────────────────────────────────────
// § DRAW — POWER-UPS
// ─────────────────────────────────────────────────────────────────
function _drawPowerUps(powerUps) {
  for (const pw of powerUps) {
    if (!pw.alive) continue;
    const def = ARK_PW_TYPES[pw.type];
    if (!def) continue;
    const x = pw.x - C.PW_W / 2, y = pw.y - C.PW_H / 2;
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
    _glow(`rgba(255,230,0,${a})`, 14 * a); ctx.strokeStyle=`rgba(255,230,0,${a*0.9})`; ctx.lineWidth = 3*a+1;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle=`rgba(255,255,200,${a*0.08})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r*0.85, 0, Math.PI*2); ctx.fill();
    _noGlow();
  }
}

// ─────────────────────────────────────────────────────────────────
// § MAIN RENDER
// ─────────────────────────────────────────────────────────────────
function _render(state) {
  _drawBg();
  if (_phase === 'IDLE') return;
  if (state.screenShake > 0) { ctx.save(); ctx.translate((Math.random()-.5)*state.screenShake*1.2, (Math.random()-.5)*state.screenShake*1.2); }
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
  _rafId = requestAnimationFrame(_frame);
  const dt = Math.min((ts - _lastTime) / 1000, 0.05);
  _lastTime = ts;
  if (_phase === 'PLAYING' || _phase === 'READY') {
    if (_keys['ArrowLeft']  || _keys['a'] || _keys['A']) ARK_Engine.movePaddle(-C.PADDLE_SPEED * dt);
    if (_keys['ArrowRight'] || _keys['d'] || _keys['D']) ARK_Engine.movePaddle( C.PADDLE_SPEED * dt);
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
  _hubVisible(false);
  const ld = ARK_Engine.getState().levelData;
  _announce(`Nivel ${_currentLevel + 1}: ${ld?.name || ''}`);
}

function _pauseGame() {
  if (_phase !== 'PLAYING') return;
  _phase = 'PAUSED'; ARK_Engine.pause();
  const s = ARK_Engine.getState();
  _el('ARK_pause-info').textContent = `Nivel ${s.levelIndex + 1} · ${s.score} puntos`;
  showScreen('ARK_screen-pause'); _announce('Pausa');
}

function _resumeGame() { hideAllScreens(); _phase = 'PLAYING'; ARK_Engine.resume(); _announce('Continuando'); }

function _onLevelComplete(data) {
  _phase = 'LEVEL_COMPLETE';
  const s          = ARK_Engine.getState();
  const lifeBonus  = s.lives * C.SCORE_LIFE_BONUS;
  const finalScore = data.score + C.SCORE_LEVEL_BONUS + lifeBonus;
  _totalScore     += finalScore;
  const coins      = ARK_Integration.reportReward(`level_${_currentLevel + 1}`, finalScore);
  _totalCoins     += coins;

  // Save best level reached
  const bestLevel = ARK_Integration.getBestLevel ? ARK_Integration.getBestLevel() : 0;
  if (_currentLevel + 1 > bestLevel)
    try { localStorage.setItem(C.LS_BEST_LEVEL, String(_currentLevel + 1)); } catch {}

  const ld = s.levelData;
  _el('ARK_lc-level').textContent = `${ld?.isBoss ? '⚡ JEFE DERROTADO — ' : ''}NIVEL ${_currentLevel + 1} COMPLETADO`;
  _el('ARK_lc-score').textContent = finalScore.toLocaleString();
  _el('ARK_lc-coins').textContent = `+${coins} 🪙 LOVE ARCADE`;
  _el('ARK_lc-next-info').textContent = `SIGUIENTE: NIVEL ${_currentLevel + 2}`;
  showScreen('ARK_screen-levelcomplete');
  _announce(`¡Nivel ${_currentLevel + 1} completado! +${coins} monedas.`);
}

function _onGameOver(data) {
  _phase = 'GAME_OVER'; _totalScore += data.score;
  const isNew = ARK_Integration.saveHighscore(_totalScore);
  const best  = parseInt(localStorage.getItem(C.LS_BEST_LEVEL) || '0', 10);
  _el('ARK_go-score').textContent   = _totalScore.toLocaleString();
  _el('ARK_go-level').textContent   = `Llegaste al nivel ${_currentLevel + 1}`;
  _el('ARK_go-record').textContent  = isNew ? '🏆 ¡NUEVO RÉCORD!' : `Récord: ${ARK_Integration.getHighscore().toLocaleString()}`;
  _el('ARK_go-best').textContent    = best > 0 ? `Mejor nivel: ${best}` : '';
  showScreen('ARK_screen-gameover'); _hubVisible(true);
  _announce('Game Over');
}

function _onWin() {
  // In infinite mode "WIN" only fires if triggered manually — not used
  _phase = 'WIN';
  _el('ARK_win-score').textContent = _totalScore.toLocaleString();
  _el('ARK_win-coins').textContent = `Total: ${_totalCoins} 🪙`;
  showScreen('ARK_screen-win'); _hubVisible(true);
  _announce('¡Récord impresionante!');
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

  // ── Touch on canvas ─────────────────────────────────────────
  // FIX: e.preventDefault() is only called in active phases.
  // In GAME_OVER / WIN / IDLE / PAUSED phases the event is NOT
  // prevented, allowing the browser to deliver pointer events to
  // the overlay screen buttons sitting above the canvas.
  canvas.addEventListener('touchstart', (e) => {
    const activePhase = _phase === 'PLAYING' || _phase === 'READY';
    if (activePhase) e.preventDefault();

    const touch = e.touches[0];
    _touchLogicalX = _toLogicalX(touch.clientX);

    if (_phase === 'READY') { ARK_Engine.launchBall(); _phase = 'PLAYING'; }
    else if (_phase === 'PLAYING') {
      const logY = (touch.clientY - _offsetY) / _scale;
      if (logY < 56) _pauseGame();
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
// § BUTTON WIRING
// FIX: Using `pointerdown` instead of `click`.
// `pointerdown` fires immediately for both mouse and touch without
// requiring the browser to synthesize a click event — which is
// blocked by touch-action:none on the body during game phases.
// ─────────────────────────────────────────────────────────────────
function _wireButtons() {
  function _btn(id, handler) {
    const el = _el(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); handler(); });
  }

  _btn('ARK_btn-start', () => { _totalScore = 0; _totalCoins = 0; _startGame(0); });
  _btn('ARK_btn-resume', _resumeGame);
  _btn('ARK_btn-quit-pause', () => { window.location.href = '../../index.html'; });
  _btn('ARK_btn-next', () => { _startGame(_currentLevel + 1); });
  _btn('ARK_btn-restart', () => { _totalScore = 0; _totalCoins = 0; _startGame(0); });
  _btn('ARK_btn-play-again', () => { _totalScore = 0; _totalCoins = 0; _startGame(0); });
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

  console.log('[ARK] Arkanoid v3.0.0 — Love Arcade · Infinite mode');
}

export const ARK_UI = { init, showScreen, hideAllScreens };
