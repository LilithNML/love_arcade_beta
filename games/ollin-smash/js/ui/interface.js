/**
 * ui/interface.js — Ollin Smash v2.0
 *
 * Owns every interaction with the DOM: reading element references,
 * updating text content, toggling CSS classes, and binding event listeners.
 *
 * Design rules:
 *  - This module NEVER imports from main.js (prevents circular dependency).
 *  - Game callbacks are injected via bindButtons() and bindInput().
 *  - No canvas drawing happens here — visual state on canvas is main.js's job.
 *  - All getElementById calls are deferred to function bodies (not top-level)
 *    because this module loads as an ES module (DOMContentLoaded guaranteed).
 */

// ── HUD Updates ───────────────────────────────────────────────────────────────

/**
 * Refresh the three HUD counters and the combo badge.
 *
 * @param {number} score  - Current raw score
 * @param {number} coins  - Estimated coins (score / coinsDiv, pre-floored)
 * @param {number} mult   - Active multiplier (1 | 2 | 4 | 8)
 */
export function updateHUD(score, coins, mult) {
  document.getElementById('os-h-score').textContent = score.toLocaleString();
  document.getElementById('os-h-coins').textContent = coins;

  const badge = document.getElementById('os-mult-badge');
  badge.textContent = mult > 1 ? `x${mult} COMBO` : '';
}

/**
 * Re-render the lives indicator dots.
 * Filled dots = remaining lives; empty dots = lost lives.
 *
 * @param {number} lives - Current life count (0–3)
 */
export function updateLives(lives) {
  const container = document.getElementById('os-h-lives');
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'os-life-dot' + (i >= lives ? ' empty' : '');
    container.appendChild(dot);
  }
}

/**
 * Sync the power-up pill visibility and countdown labels with current fx state.
 *
 * @param {{ long, fire, slow, magnet }} fx - Active effects reference
 */
export function updatePills(fx) {
  _pill('os-pill-long',   fx.long.on,   Math.ceil(fx.long.t / 60) + 's');
  _pill('os-pill-fire',   fx.fire.on,   Math.ceil(fx.fire.t / 60) + 's');
  _pill('os-pill-slow',   fx.slow.on,   Math.ceil(fx.slow.t / 60) + 's');
  _pill('os-pill-magnet', fx.magnet.on, String(fx.magnet.shots));
}

/**
 * @param {string}  id    - Element ID
 * @param {boolean} on    - Whether to show the pill
 * @param {string}  label - Text for the countdown span
 */
function _pill(id, on, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on', on);
  const span = el.querySelector('span');
  if (span) span.textContent = label;
}

/**
 * Update the persistent wave label at the bottom of the play area.
 * @param {number} wave
 */
export function updateWaveLabel(wave) {
  const el = document.getElementById('os-wave-lbl');
  if (el) el.textContent = `OLEADA ${wave}`;
}

// ── Screen Transitions ────────────────────────────────────────────────────────

/**
 * Briefly show a full-screen wave number announcement, then fade it out.
 * @param {number} wave
 */
export function showWaveFlash(wave) {
  const el = document.getElementById('os-wave-flash');
  if (!el) return;
  el.textContent = `OLEADA ${wave}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 900);
}

/**
 * Transition into the playing state: hide all overlays, show HUD.
 */
export function showPlaying() {
  document.getElementById('os-menu')    .classList.add('hidden');
  document.getElementById('os-gameover').classList.add('hidden');
  document.getElementById('os-paused')  .classList.add('hidden');
  document.getElementById('os-hud')     .classList.add('active');
  document.getElementById('os-pu-bar')  .classList.add('active');
}

/**
 * Toggle the pause overlay.
 * @param {boolean} paused
 */
export function setPaused(paused) {
  document.getElementById('os-paused').classList.toggle('hidden', !paused);
}

/**
 * Show the Game Over screen with final stats.
 *
 * @param {number} score
 * @param {number} wave
 * @param {number} coins
 */
export function showGameOver(score, wave, coins) {
  document.getElementById('os-go-score').textContent = score.toLocaleString();
  document.getElementById('os-go-wave') .textContent = wave;
  document.getElementById('os-go-coins').textContent = coins;

  document.getElementById('os-gameover').classList.remove('hidden');
  document.getElementById('os-hud')     .classList.remove('active');
  document.getElementById('os-pu-bar')  .classList.remove('active');
}

/**
 * Show the main menu and optionally display the standalone mode notice.
 *
 * @param {number}  highscore    - All-time best score to display
 * @param {boolean} isStandalone - True when window.GameCenter is absent
 */
export function showMenu(highscore, isStandalone) {
  document.getElementById('os-gameover').classList.add('hidden');
  document.getElementById('os-hud')     .classList.remove('active');
  document.getElementById('os-pu-bar')  .classList.remove('active');
  document.getElementById('os-menu')    .classList.remove('hidden');
  document.getElementById('os-hs')      .textContent = highscore.toLocaleString();

  if (isStandalone) {
    document.getElementById('os-notice-menu').classList.add('visible');
  }
}

/**
 * Refresh the high-score display from localStorage and return the value.
 * Used when navigating back to the menu after a game.
 *
 * @returns {number}
 */
export function refreshHighscore() {
  const hs = parseInt(localStorage.getItem('OS_highscore') || '0', 10);
  const el  = document.getElementById('os-hs');
  if (el) el.textContent = hs.toLocaleString();
  return hs;
}

// ── Event Binding ─────────────────────────────────────────────────────────────

/**
 * Attach click listeners to all menu/overlay buttons.
 * Callbacks are injected by main.js to avoid circular imports.
 *
 * @param {{ onStart, onRetry, onResume, onMenu }} callbacks
 */
export function bindButtons({ onStart, onRetry, onResume, onMenu }) {
  document.getElementById('os-btn-start') .addEventListener('click', onStart);
  document.getElementById('os-btn-retry') .addEventListener('click', onRetry);
  document.getElementById('os-btn-resume').addEventListener('click', onResume);
  document.getElementById('os-btn-menu')  .addEventListener('click', onMenu);
}

/**
 * Attach pointer/touch events to the wrapper element for paddle control.
 *
 * @param {{ onMove: function(number), onTap: function(), onPause: function() }} cbs
 */
export function bindInput({ onMove, onTap, onPause }) {
  const wrapper = document.getElementById('os-wrapper');

  // Mouse
  wrapper.addEventListener('mousemove', e => onMove(e.clientX));

  // Touch (passive: false so we can call preventDefault and block page scroll)
  wrapper.addEventListener('touchmove', e => {
    e.preventDefault();
    onMove(e.touches[0].clientX);
  }, { passive: false });

  // Click / tap
  wrapper.addEventListener('click', () => onTap());
  wrapper.addEventListener('touchend', e => {
    if (e.changedTouches.length) onTap();
  }, { passive: false });

  // Keyboard: Space/Esc for pause
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'Escape') onPause();
  });
}

/**
 * Attach keyboard arrow / WASD handlers for fine paddle movement.
 * Separated from bindInput so main.js can pass paddle-aware lambdas.
 *
 * @param {function} onLeft  - Move paddle left
 * @param {function} onRight - Move paddle right
 */
export function bindKeyboard(onLeft, onRight) {
  document.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft'  || e.code === 'KeyA') onLeft();
    if (e.code === 'ArrowRight' || e.code === 'KeyD') onRight();
  });
}
