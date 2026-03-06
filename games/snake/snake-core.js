/**
 * snake-core.js
 * LA-Snake Classic — Core Engine Module
 * Grid-based movement, state machine, input, collisions, power-up logic.
 * Prefix: LAS_
 */

const LAS_Core = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────

  const LAS_STATES = {
    START:    'START',
    COUNTDOWN:'COUNTDOWN',
    PLAYING:  'PLAYING',
    PAUSED:   'PAUSED',
    GAMEOVER: 'GAMEOVER'
  };

  const LAS_BASE_SPEED_MS   = 140; // ms per tick at normal speed
  const LAS_BRAKE_SPEED_MS  = 280; // ms per tick when brake active
  const LAS_GHOST_DURATION  = 5000; // ms
  const LAS_POWERUP_DURATION= 5000; // ms
  const LAS_MAGNET_RADIUS   = 3;    // cells
  const LAS_POWERUP_SPAWN_INTERVAL = 8; // every N food eaten
  const LAS_POWERUP_TYPES   = ['magnet', 'ghost', 'brake'];

  const LAS_DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y:  1 },
    left:  { x: -1, y:  0 },
    right: { x: 1,  y:  0 }
  };

  const LAS_OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  let LAS_state        = LAS_STATES.START;
  let LAS_snake        = [];
  let LAS_direction    = 'right';
  let LAS_nextDirection= 'right';
  let LAS_food         = null;
  let LAS_powerups     = [];      // items on grid
  let LAS_activePowerup= null;    // { type, remaining, duration }
  let LAS_foodEatenCount = 0;
  let LAS_cols         = 20;
  let LAS_rows         = 20;
  let LAS_lastTick     = 0;
  let LAS_rafId        = null;
  let LAS_countdownVal = 3;
  let LAS_countdownTimer = null;
  let LAS_prevDirection = 'right'; // for gold particle spawn

  // Callbacks
  let LAS_onEat         = null;   // (isPowerup)
  let LAS_onDeath       = null;   // ()
  let LAS_onStateChange = null;   // (newState)
  let LAS_onTurn        = null;   // (x, y) for particles
  let LAS_onFrame       = null;   // () called every rendered frame

  // ─────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────

  function LAS_init(cols, rows) {
    LAS_cols = cols;
    LAS_rows = rows;
    LAS_setState(LAS_STATES.START);
  }

  function LAS_resetGame() {
    const startX = Math.floor(LAS_cols / 2);
    const startY = Math.floor(LAS_rows / 2);

    LAS_snake = [
      { x: startX,     y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
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
    if (LAS_onFrame) LAS_onFrame(); // render countdown
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
  // GAME LOOP (requestAnimationFrame + FPS control)
  // ─────────────────────────────────────────────

  function LAS_gameLoop(timestamp) {
    if (LAS_state !== LAS_STATES.PLAYING) return;

    const speedMs = LAS_activePowerup?.type === 'brake'
      ? LAS_BRAKE_SPEED_MS
      : LAS_BASE_SPEED_MS;

    if (timestamp - LAS_lastTick >= speedMs) {
      LAS_lastTick = timestamp;
      LAS_tick();
    }

    if (LAS_onFrame) LAS_onFrame();
    LAS_rafId = requestAnimationFrame(LAS_gameLoop);
  }

  // ─────────────────────────────────────────────
  // TICK — One step of the game
  // ─────────────────────────────────────────────

  function LAS_tick() {
    // Commit queued direction
    LAS_direction = LAS_nextDirection;

    const head   = LAS_snake[0];
    const dir    = LAS_DIRS[LAS_direction];
    const newHead= { x: head.x + dir.x, y: head.y + dir.y };

    // ── Border collision ──
    if (newHead.x < 0 || newHead.x >= LAS_cols || newHead.y < 0 || newHead.y >= LAS_rows) {
      LAS_triggerGameOver();
      return;
    }

    // ── Self collision (skip if ghost active) ──
    const isGhost = LAS_activePowerup?.type === 'ghost';
    if (!isGhost) {
      for (let i = 1; i < LAS_snake.length - 1; i++) {
        if (LAS_snake[i].x === newHead.x && LAS_snake[i].y === newHead.y) {
          LAS_triggerGameOver();
          return;
        }
      }
    }

    // ── Magnet: pull food closer ──
    if (LAS_activePowerup?.type === 'magnet' && LAS_food) {
      LAS_applyMagnet(newHead);
    }

    // ── Advance snake ──
    LAS_snake.unshift(newHead);

    // ── Gold particle on turn ──
    if (LAS_direction !== LAS_prevDirection) {
      if (LAS_onTurn) LAS_onTurn(newHead.x, newHead.y);
      LAS_prevDirection = LAS_direction;
    }

    // ── Check food collision ──
    let ate = false;
    if (LAS_food && newHead.x === LAS_food.x && newHead.y === LAS_food.y) {
      ate = true;
      LAS_food = null;
      LAS_foodEatenCount++;
      if (LAS_onEat) LAS_onEat(false);
      LAS_spawnFood();

      // Maybe spawn a power-up
      if (LAS_foodEatenCount % LAS_POWERUP_SPAWN_INTERVAL === 0) {
        LAS_spawnPowerup();
      }
    }

    // ── Check power-up collision ──
    const puIdx = LAS_powerups.findIndex(p => p.x === newHead.x && p.y === newHead.y);
    if (puIdx !== -1) {
      const pu = LAS_powerups.splice(puIdx, 1)[0];
      LAS_activatePowerup(pu.type);
      ate = true; // grow on power-up too
      if (LAS_onEat) LAS_onEat(true);
    }

    // ── Pop tail unless ate ──
    if (!ate) {
      LAS_snake.pop();
    }

    // ── Update active power-up remaining ──
    if (LAS_activePowerup) {
      LAS_activePowerup.remaining -= LAS_activePowerup.type === 'brake'
        ? LAS_BRAKE_SPEED_MS
        : LAS_BASE_SPEED_MS;
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
    if (LAS_activePowerup) {
      clearTimeout(LAS_activePowerup._timer);
    }
    const timer = setTimeout(() => {
      LAS_activePowerup = null;
    }, LAS_POWERUP_DURATION);

    LAS_activePowerup = {
      type,
      duration:  LAS_POWERUP_DURATION,
      remaining: LAS_POWERUP_DURATION,
      _timer:    timer
    };
  }

  /**
   * Magnet: moves food one cell closer to head
   */
  function LAS_applyMagnet(head) {
    if (!LAS_food) return;
    const dx = LAS_food.x - head.x;
    const dy = LAS_food.y - head.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= LAS_MAGNET_RADIUS) {
      // Nudge food one step toward head
      const mx = dx !== 0 ? (dx > 0 ? -1 : 1) : 0;
      const my = dy !== 0 && dx === 0 ? (dy > 0 ? -1 : 1) : 0;
      const nx = LAS_food.x + mx;
      const ny = LAS_food.y + my;
      // Don't put food inside snake
      const blocked = LAS_snake.some(s => s.x === nx && s.y === ny);
      if (!blocked) {
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

    let attempts = 0;
    while (attempts < 200) {
      const x = Math.floor(Math.random() * LAS_cols);
      const y = Math.floor(Math.random() * LAS_rows);
      if (!occupied.has(`${x},${y}`)) return { x, y };
      attempts++;
    }
    return null;
  }

  function LAS_spawnFood() {
    const cell = LAS_getEmptyCell();
    if (cell) LAS_food = cell;
  }

  function LAS_spawnPowerup() {
    // Max 1 powerup on grid at a time
    if (LAS_powerups.length >= 1) return;
    const cell = LAS_getEmptyCell();
    if (!cell) return;
    const type = LAS_POWERUP_TYPES[Math.floor(Math.random() * LAS_POWERUP_TYPES.length)];
    LAS_powerups.push({ ...cell, type });

    // Power-up despawns after 10 seconds if not eaten
    setTimeout(() => {
      LAS_powerups = LAS_powerups.filter(p => !(p.x === cell.x && p.y === cell.y));
    }, 10000);
  }

  // ─────────────────────────────────────────────
  // INPUT — 4-Zone Touch System
  // ─────────────────────────────────────────────

  /**
   * Resolves swipe direction from a touch delta.
   * Also handles tap-based zone detection.
   * @param {number} dx - horizontal delta
   * @param {number} dy - vertical delta
   */
  function LAS_resolveSwipe(dx, dy) {
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return null; // not a swipe
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
  }

  /**
   * Resolves a tap zone (canvas-relative x,y) into a direction.
   * Canvas divided into 4 triangular zones from center.
   */
  function LAS_resolveTapZone(tapX, tapY, canvasW, canvasH) {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const dx = tapX - cx;
    const dy = tapY - cy;
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
  }

  function LAS_queueDirection(dir) {
    if (!dir) return;
    // Prevent 180-degree reversal
    if (LAS_OPPOSITE[dir] === LAS_direction) return;
    LAS_nextDirection = dir;
  }

  // ─────────────────────────────────────────────
  // TOUCH EVENT BINDER (attach to canvas element)
  // ─────────────────────────────────────────────

  let LAS_touchStartX = 0;
  let LAS_touchStartY = 0;

  function LAS_bindTouchInput(canvasEl) {
    canvasEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      LAS_touchStartX = e.touches[0].clientX;
      LAS_touchStartY = e.touches[0].clientY;

      // First touch: init audio
      if (typeof LAS_Audio !== 'undefined') LAS_Audio.init();
    }, { passive: false });

    canvasEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const dx = endX - LAS_touchStartX;
      const dy = endY - LAS_touchStartY;

      if (LAS_state === LAS_STATES.PAUSED || LAS_state === LAS_STATES.START) {
        return; // handled by UI layer
      }

      if (LAS_state === LAS_STATES.GAMEOVER) {
        return; // handled by UI layer
      }

      const swipeDir = LAS_resolveSwipe(dx, dy);
      if (swipeDir) {
        LAS_queueDirection(swipeDir);
      } else {
        // Tap: zone-based
        const rect = canvasEl.getBoundingClientRect();
        const tapX = endX - rect.left;
        const tapY = endY - rect.top;
        const zone = LAS_resolveTapZone(tapX, tapY, canvasEl.width, canvasEl.height);
        LAS_queueDirection(zone);
      }
    }, { passive: false });

    // Keyboard (desktop fallback)
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
      if (e.key === 'p' || e.key === 'Escape') {
        LAS_togglePause();
      }
    });
  }

  // ─────────────────────────────────────────────
  // STATE SNAPSHOT (for renderer)
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
    STATES:      LAS_STATES,
    init:        LAS_init,
    startGame:   LAS_startGame,
    pause:       LAS_pause,
    resume:      LAS_resume,
    togglePause: LAS_togglePause,
    getState:    LAS_getState,
    bindTouchInput: LAS_bindTouchInput,
    queueDirection: LAS_queueDirection,

    // Callbacks
    onEat:         (fn) => { LAS_onEat         = fn; },
    onDeath:       (fn) => { LAS_onDeath        = fn; },
    onStateChange: (fn) => { LAS_onStateChange  = fn; },
    onTurn:        (fn) => { LAS_onTurn         = fn; },
    onFrame:       (fn) => { LAS_onFrame        = fn; },
  };
})();
