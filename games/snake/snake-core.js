/**
 * snake-core.js
 * LA-Snake Classic — Core Engine Module v1.2
 *
 * CHANGES v1.2:
 *   - Input migrated to global swipe listener (threshold: 20px)
 *   - touchmove e.preventDefault() blocks native scroll during play
 *   - navigator.vibrate(10) haptic on valid turn registration
 *   - onInvalidDirection callback fires on 180-degree attempt
 *   - touchcancel handler for edge cases
 *
 * Prefix: LAS_
 */

const LAS_Core = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────

  const LAS_STATES = {
    START:     'START',
    COUNTDOWN: 'COUNTDOWN',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    GAMEOVER:  'GAMEOVER'
  };

  const LAS_BASE_SPEED_MS          = 140;
  const LAS_BRAKE_SPEED_MS         = 280;
  const LAS_POWERUP_DURATION       = 5000;
  const LAS_MAGNET_RADIUS          = 3;
  const LAS_POWERUP_SPAWN_INTERVAL = 8;
  const LAS_SWIPE_THRESHOLD        = 20;   // px — minimum to register swipe
  const LAS_POWERUP_TYPES          = ['magnet', 'ghost', 'brake'];

  const LAS_DIRS = {
    up:    { x:  0, y: -1 },
    down:  { x:  0, y:  1 },
    left:  { x: -1, y:  0 },
    right: { x:  1, y:  0 }
  };

  const LAS_OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  let LAS_state             = LAS_STATES.START;
  let LAS_snake             = [];
  let LAS_direction         = 'right';
  let LAS_nextDirection     = 'right';
  let LAS_food              = null;
  let LAS_powerups          = [];
  let LAS_activePowerup     = null;
  let LAS_foodEatenCount    = 0;
  let LAS_cols              = 20;
  let LAS_rows              = 20;
  let LAS_lastTick          = 0;
  let LAS_rafId             = null;
  let LAS_countdownVal      = 3;
  let LAS_countdownTimer    = null;
  let LAS_prevDirection     = 'right';

  // Touch tracking
  let LAS_touchStartX   = 0;
  let LAS_touchStartY   = 0;
  let LAS_touchActive   = false;

  // Callbacks
  let LAS_onEat             = null;
  let LAS_onDeath           = null;
  let LAS_onStateChange     = null;
  let LAS_onTurn            = null;
  let LAS_onFrame           = null;
  let LAS_onInvalidDirection= null;

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  function LAS_init(cols, rows) {
    LAS_cols = cols;
    LAS_rows = rows;
    LAS_setState(LAS_STATES.START);
  }

  function LAS_resetGame() {
    const sx = Math.floor(LAS_cols / 2);
    const sy = Math.floor(LAS_rows / 2);
    LAS_snake = [
      { x: sx,     y: sy },
      { x: sx - 1, y: sy },
      { x: sx - 2, y: sy }
    ];
    LAS_direction     = 'right';
    LAS_nextDirection = 'right';
    LAS_prevDirection = 'right';
    LAS_food          = null;
    LAS_powerups      = [];
    LAS_activePowerup = null;
    LAS_foodEatenCount= 0;
    LAS_lastTick      = 0;
    LAS_spawnFood();
  }

  // ─────────────────────────────────────────────
  // STATE MACHINE
  // ─────────────────────────────────────────────

  function LAS_setState(newState) {
    LAS_state = newState;
    if (LAS_onStateChange) LAS_onStateChange(newState);
  }

  function LAS_startGame() {
    LAS_resetGame();
    LAS_startCountdown();
  }

  function LAS_startCountdown() {
    LAS_countdownVal = 3;
    LAS_setState(LAS_STATES.COUNTDOWN);
    LAS_runCountdown();
  }

  function LAS_runCountdown() {
    if (LAS_onFrame) LAS_onFrame();
    if (LAS_countdownVal > 0) {
      LAS_countdownTimer = setTimeout(() => {
        LAS_countdownVal--;
        LAS_runCountdown();
      }, 800);
    } else {
      LAS_setState(LAS_STATES.PLAYING);
      LAS_lastTick = performance.now();
      LAS_rafId = requestAnimationFrame(LAS_gameLoop);
    }
  }

  function LAS_pause() {
    if (LAS_state !== LAS_STATES.PLAYING) return;
    cancelAnimationFrame(LAS_rafId);
    LAS_setState(LAS_STATES.PAUSED);
    if (LAS_onFrame) LAS_onFrame();
  }

  function LAS_resume() {
    if (LAS_state !== LAS_STATES.PAUSED) return;
    LAS_setState(LAS_STATES.PLAYING);
    LAS_lastTick = performance.now();
    LAS_rafId = requestAnimationFrame(LAS_gameLoop);
  }

  function LAS_togglePause() {
    if (LAS_state === LAS_STATES.PLAYING) LAS_pause();
    else if (LAS_state === LAS_STATES.PAUSED) LAS_resume();
  }

  function LAS_triggerGameOver() {
    cancelAnimationFrame(LAS_rafId);
    if (LAS_activePowerup) {
      clearTimeout(LAS_activePowerup._timer);
      LAS_activePowerup = null;
    }
    LAS_setState(LAS_STATES.GAMEOVER);
    if (LAS_onDeath) LAS_onDeath();
    if (LAS_onFrame) LAS_onFrame();
  }

  // ─────────────────────────────────────────────
  // GAME LOOP
  // ─────────────────────────────────────────────

  function LAS_gameLoop(timestamp) {
    if (LAS_state !== LAS_STATES.PLAYING) return;
    const speedMs = LAS_activePowerup?.type === 'brake' ? LAS_BRAKE_SPEED_MS : LAS_BASE_SPEED_MS;
    if (timestamp - LAS_lastTick >= speedMs) {
      LAS_lastTick = timestamp;
      LAS_tick();
    }
    if (LAS_onFrame) LAS_onFrame();
    LAS_rafId = requestAnimationFrame(LAS_gameLoop);
  }

  // ─────────────────────────────────────────────
  // TICK
  // ─────────────────────────────────────────────

  function LAS_tick() {
    LAS_direction = LAS_nextDirection;
    const head    = LAS_snake[0];
    const dir     = LAS_DIRS[LAS_direction];
    const newHead = { x: head.x + dir.x, y: head.y + dir.y };

    // Border collision
    if (newHead.x < 0 || newHead.x >= LAS_cols ||
        newHead.y < 0 || newHead.y >= LAS_rows) {
      LAS_triggerGameOver();
      return;
    }

    // Self collision (skip if Ghost active)
    if (LAS_activePowerup?.type !== 'ghost') {
      for (let i = 1; i < LAS_snake.length - 1; i++) {
        if (LAS_snake[i].x === newHead.x && LAS_snake[i].y === newHead.y) {
          LAS_triggerGameOver();
          return;
        }
      }
    }

    // Magnet pull
    if (LAS_activePowerup?.type === 'magnet' && LAS_food) {
      LAS_applyMagnet(newHead);
    }

    LAS_snake.unshift(newHead);

    // Gold particles on turn
    if (LAS_direction !== LAS_prevDirection) {
      if (LAS_onTurn) LAS_onTurn(newHead.x, newHead.y);
      LAS_prevDirection = LAS_direction;
    }

    // Food collision
    let ate = false;
    if (LAS_food && newHead.x === LAS_food.x && newHead.y === LAS_food.y) {
      ate = true;
      LAS_food = null;
      LAS_foodEatenCount++;
      if (LAS_onEat) LAS_onEat(false);
      LAS_spawnFood();
      if (LAS_foodEatenCount % LAS_POWERUP_SPAWN_INTERVAL === 0) LAS_spawnPowerup();
    }

    // Power-up collision
    const puIdx = LAS_powerups.findIndex(p => p.x === newHead.x && p.y === newHead.y);
    if (puIdx !== -1) {
      const pu = LAS_powerups.splice(puIdx, 1)[0];
      LAS_activatePowerup(pu.type);
      ate = true;
      if (LAS_onEat) LAS_onEat(true);
    }

    if (!ate) LAS_snake.pop();

    // Tick down power-up timer
    if (LAS_activePowerup) {
      LAS_activePowerup.remaining -= (LAS_activePowerup.type === 'brake'
        ? LAS_BRAKE_SPEED_MS : LAS_BASE_SPEED_MS);
      if (LAS_activePowerup.remaining <= 0) {
        clearTimeout(LAS_activePowerup._timer);
        LAS_activePowerup = null;
      }
    }
  }

  // ─────────────────────────────────────────────
  // POWER-UPS
  // ─────────────────────────────────────────────

  function LAS_activatePowerup(type) {
    if (LAS_activePowerup) clearTimeout(LAS_activePowerup._timer);
    const timer = setTimeout(() => { LAS_activePowerup = null; }, LAS_POWERUP_DURATION);
    LAS_activePowerup = { type, duration: LAS_POWERUP_DURATION, remaining: LAS_POWERUP_DURATION, _timer: timer };
  }

  function LAS_applyMagnet(head) {
    if (!LAS_food) return;
    const dx = LAS_food.x - head.x;
    const dy = LAS_food.y - head.y;
    if (Math.abs(dx) + Math.abs(dy) <= LAS_MAGNET_RADIUS) {
      const mx = dx !== 0 ? (dx > 0 ? -1 : 1) : 0;
      const my = dy !== 0 && dx === 0 ? (dy > 0 ? -1 : 1) : 0;
      const nx = LAS_food.x + mx;
      const ny = LAS_food.y + my;
      if (!LAS_snake.some(s => s.x === nx && s.y === ny)) {
        LAS_food = { x: nx, y: ny };
      }
    }
  }

  // ─────────────────────────────────────────────
  // SPAWNING
  // ─────────────────────────────────────────────

  function LAS_getEmptyCell() {
    const occupied = new Set(LAS_snake.map(s => `${s.x},${s.y}`));
    if (LAS_food) occupied.add(`${LAS_food.x},${LAS_food.y}`);
    LAS_powerups.forEach(p => occupied.add(`${p.x},${p.y}`));
    for (let i = 0; i < 200; i++) {
      const x = Math.floor(Math.random() * LAS_cols);
      const y = Math.floor(Math.random() * LAS_rows);
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
    return null;
  }

  function LAS_spawnFood() {
    const cell = LAS_getEmptyCell();
    if (cell) LAS_food = cell;
  }

  function LAS_spawnPowerup() {
    if (LAS_powerups.length >= 1) return;
    const cell = LAS_getEmptyCell();
    if (!cell) return;
    const type = LAS_POWERUP_TYPES[Math.floor(Math.random() * LAS_POWERUP_TYPES.length)];
    LAS_powerups.push({ ...cell, type });
    setTimeout(() => {
      LAS_powerups = LAS_powerups.filter(p => !(p.x === cell.x && p.y === cell.y));
    }, 10000);
  }

  // ─────────────────────────────────────────────
  // INPUT — Global Swipe Listener
  // ─────────────────────────────────────────────

  /**
   * Resolves swipe direction from pixel deltas.
   * Returns null when both axes are below LAS_SWIPE_THRESHOLD (20px).
   * Dominant axis wins.
   */
  function LAS_resolveSwipe(dx, dy) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax < LAS_SWIPE_THRESHOLD && ay < LAS_SWIPE_THRESHOLD) return null;
    return ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  /**
   * Queues a direction change with validation.
   *   - Fires onInvalidDirection and returns early on 180-degree attempt.
   *   - Triggers haptic feedback (10ms) on valid queue.
   */
  function LAS_queueDirection(dir) {
    if (!dir) return;
    if (LAS_OPPOSITE[dir] === LAS_direction) {
      // 180-degree block — fire error audio callback
      if (LAS_onInvalidDirection) LAS_onInvalidDirection();
      return;
    }
    if (dir === LAS_nextDirection) return; // already queued, no-op
    LAS_nextDirection = dir;

    // Haptic: short 10ms pulse on valid swipe
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(10); } catch (_) { /* silently ignore */ }
    }
  }

  /**
   * Attaches touch and keyboard listeners.
   * Pass the canvas (or its wrapper) as targetEl.
   *
   * Touch strategy:
   *   touchstart  → record origin, preventDefault
   *   touchmove   → preventDefault (blocks scroll)
   *   touchend    → compute swipe delta, call queueDirection
   *   touchcancel → clean up active flag
   */
  function LAS_bindTouchInput(targetEl) {
    targetEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      LAS_touchStartX = e.touches[0].clientX;
      LAS_touchStartY = e.touches[0].clientY;
      LAS_touchActive = true;
      if (typeof LAS_Audio !== 'undefined') LAS_Audio.init();
    }, { passive: false });

    targetEl.addEventListener('touchmove', (e) => {
      // Always prevent scroll while a touch is active on the play area
      e.preventDefault();
    }, { passive: false });

    targetEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!LAS_touchActive) return;
      LAS_touchActive = false;

      if (LAS_state !== LAS_STATES.PLAYING) return;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dir  = LAS_resolveSwipe(endX - LAS_touchStartX, endY - LAS_touchStartY);
      if (dir) LAS_queueDirection(dir);
    }, { passive: false });

    targetEl.addEventListener('touchcancel', () => {
      LAS_touchActive = false;
    }, { passive: true });

    // Keyboard fallback (desktop)
    document.addEventListener('keydown', (e) => {
      const keyMap = {
        ArrowUp: 'up', ArrowDown: 'down',
        ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right'
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        LAS_queueDirection(keyMap[e.key]);
      }
      if (e.key === 'p' || e.key === 'Escape') LAS_togglePause();
    });
  }

  // ─────────────────────────────────────────────
  // STATE SNAPSHOT
  // ─────────────────────────────────────────────

  function LAS_getState() {
    return {
      gameState:    LAS_state,
      snake:        LAS_snake,
      direction:    LAS_direction,
      food:         LAS_food,
      powerups:     LAS_powerups,
      activePowerup:LAS_activePowerup,
      countdown:    LAS_countdownVal,
      length:       LAS_snake.length
    };
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  return {
    STATES:              LAS_STATES,
    init:                LAS_init,
    startGame:           LAS_startGame,
    pause:               LAS_pause,
    resume:              LAS_resume,
    togglePause:         LAS_togglePause,
    getState:            LAS_getState,
    bindTouchInput:      LAS_bindTouchInput,
    queueDirection:      LAS_queueDirection,

    onEat:               (fn) => { LAS_onEat              = fn; },
    onDeath:             (fn) => { LAS_onDeath            = fn; },
    onStateChange:       (fn) => { LAS_onStateChange      = fn; },
    onTurn:              (fn) => { LAS_onTurn             = fn; },
    onFrame:             (fn) => { LAS_onFrame            = fn; },
    onInvalidDirection:  (fn) => { LAS_onInvalidDirection = fn; },
  };
})();
