/**
 * main.js — Ollin Smash v2.0
 *
 * Entry point and game orchestrator.
 *
 * Responsibilities:
 *  - Owns the requestAnimationFrame game loop
 *  - Runs the update() tick: physics, collisions, effect timers
 *  - Runs the draw() tick: canvas rendering pipeline
 *  - Manages the game state machine transitions
 *  - Handles input translation (client coords → canvas coords → paddle movement)
 *  - Reports earnings to window.GameCenter (Love Arcade integration)
 *  - Exposes window.OllinSmashGame public API
 *
 * Module loading order guarantee:
 *  <script type="module" src="./js/main.js"> is deferred by default,
 *  meaning it runs AFTER the synchronous ../../js/app.js classic script.
 *  Therefore window.GameCenter is always set (if present) when boot() runs.
 */

import { CFG }                          from './config.js';
import { state, paddle, fx,
         resetState, resetEffects,
         refreshMult }                  from './state.js';
import { aabb, toCanvasX }              from './core/physics.js';
import * as particles                   from './core/particles.js';
import { initAudio, sfx }               from './audio/audio-engine.js';
import { genBricks, drawBricks }        from './components/bricks.js';
import { mkBall, drawBall, drawTrail }  from './components/ball.js';
import { drawPaddle, drawGrecan }       from './components/paddle.js';
import { activatePU,
         updateDrops,
         drawDrops }                    from './components/powerups.js';
import * as ui                          from './ui/interface.js';

// ── Canvas ────────────────────────────────────────────────────────────────────

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('os-canvas'));
const ctx    = canvas.getContext('2d');

// ── Game Loop ─────────────────────────────────────────────────────────────────

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Advance one simulation frame.
 * Returns immediately unless state.phase === 'PLAYING'.
 */
function update() {
  if (state.phase !== 'PLAYING') return;

  tickEffects();
  moveBalls();
  updateDrops(state.wave);
  particles.update();

  // Wave clear check
  if (state.bricks.every(b => !b.alive)) {
    nextWave();
    return;
  }

  // All balls lost — deduct life or trigger game over
  if (state.balls.length === 0) {
    state.lives--;
    ui.updateLives(state.lives);
    if (state.lives <= 0) {
      doGameOver();
      return;
    }
    launch();
  }

  ui.updateHUD(state.score, Math.floor(state.score / CFG.coinsDiv), state.mult);
  ui.updatePills(fx);
}

// ── Effect Timers ─────────────────────────────────────────────────────────────

/**
 * Count down all active timed effects and revert them on expiry.
 */
function tickEffects() {
  if (fx.long.on && --fx.long.t <= 0) {
    fx.long.on = false;
    paddle.w   = CFG.paddleInitW;
  }

  if (fx.fire.on && --fx.fire.t <= 0) {
    fx.fire.on = false;
    for (const b of state.balls) b.fire = false;
  }

  if (fx.slow.on && --fx.slow.t <= 0) {
    fx.slow.on = false;
    // Restore speed magnitude, preserve direction
    const target = CFG.ballBaseSpeed * (1 + (state.wave - 1) * CFG.waveMult);
    for (const b of state.balls) {
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > 0) {
        b.vx = (b.vx / spd) * target;
        b.vy = (b.vy / spd) * target;
      }
    }
  }
}

// ── Ball Physics ──────────────────────────────────────────────────────────────

/**
 * Move all balls, handle wall/paddle/brick collisions.
 */
function moveBalls() {
  const dead = [];

  for (const ball of state.balls) {

    // ── Magnet hold ──────────────────────────────────────────────────────────
    if (fx.magnet.held && fx.magnet.heldBall === ball) {
      ball.x = paddle.x;
      ball.y = paddle.y - paddle.h / 2 - ball.r;
      continue;
    }

    // ── Trail ────────────────────────────────────────────────────────────────
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 9) ball.trail.shift();

    // ── Move ─────────────────────────────────────────────────────────────────
    ball.x += ball.vx;
    ball.y += ball.vy;

    // ── Wall reflections ─────────────────────────────────────────────────────
    if (ball.x - ball.r < 0) {
      ball.x  = ball.r;
      ball.vx = Math.abs(ball.vx);
      sfx.bounce();
    }
    if (ball.x + ball.r > CFG.W) {
      ball.x  = CFG.W - ball.r;
      ball.vx = -Math.abs(ball.vx);
      sfx.bounce();
    }
    if (ball.y - ball.r < 0) {
      ball.y  = ball.r;
      ball.vy = Math.abs(ball.vy);
      sfx.bounce();
    }

    // ── Paddle collision ─────────────────────────────────────────────────────
    const paddleRect = {
      x: paddle.x - paddle.w / 2,
      y: paddle.y - paddle.h / 2,
      w: paddle.w,
      h: paddle.h,
    };

    if (aabb(ball, paddleRect) && ball.vy > 0) {
      // Reset combo every time the ball touches the paddle
      state.combo = 0;
      refreshMult();

      if (fx.magnet.on && fx.magnet.shots > 0) {
        fx.magnet.held     = true;
        fx.magnet.heldBall = ball;
        ball.vx = 0;
        ball.vy = 0;
      } else {
        // Angle redirect based on horizontal impact position
        const hit   = (ball.x - paddleRect.x) / paddle.w;   // 0 = left, 1 = right
        const angle = -Math.PI / 2 + (hit - 0.5) * Math.PI * 0.78;
        const spd   = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(angle) * spd;
        ball.vy = Math.sin(angle) * spd;
        ball.y  = paddle.y - paddle.h / 2 - ball.r - 1;
        sfx.bounce();
      }
    }

    // ── Brick collisions ─────────────────────────────────────────────────────
    for (const bk of state.bricks) {
      if (!bk.alive) continue;

      const side = aabb(ball, bk);
      if (!side) continue;

      bk.hp--;
      bk.flash = 9;   // frames of white flash

      if (bk.hp <= 0) {
        bk.alive = false;
        state.score += 10 * state.mult;
        state.combo++;
        refreshMult();

        particles.emit(bk.x + bk.w / 2, bk.y + bk.h / 2, bk.color, 9);
        sfx.brick();

        if (state.mult > 1) {
          particles.addFloat(bk.x + bk.w / 2, bk.y, `COMBO x${state.mult}`);
          sfx.combo(state.mult);
        }

        // Spawn drop if brick had a power-up assigned
        if (bk.pu) {
          state.drops.push({
            x: bk.x + bk.w / 2,
            y: bk.y + bk.h / 2,
            type: bk.pu,
            w: 22, h: 22,
          });
        }
      }

      // Reflect unless fire mode is active (fire passes through bricks)
      if (!ball.fire) {
        if (side === 'left' || side === 'right') ball.vx = -ball.vx;
        else                                     ball.vy = -ball.vy;
        break;   // one collision per frame
      }
    }

    // ── Out of bounds (bottom) ───────────────────────────────────────────────
    if (ball.y - ball.r > CFG.H) dead.push(ball);
  }

  // Remove dead balls
  for (const db of dead) {
    if (fx.magnet.heldBall === db) {
      fx.magnet.held     = false;
      fx.magnet.heldBall = null;
    }
    const idx = state.balls.indexOf(db);
    if (idx !== -1) state.balls.splice(idx, 1);
  }

  // Tick brick flash timers
  for (const bk of state.bricks) {
    if (bk.flash > 0) bk.flash--;
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────

/**
 * Render one frame. Always runs regardless of game phase so the
 * background animation plays in menus and on the game-over screen.
 */
function draw() {
  const W = CFG.W;
  const H = CFG.H;

  // Smooth background speed — lerps toward average ball speed
  if (state.balls.length > 0) {
    const avgSpd = state.balls.reduce((a, b) => a + Math.hypot(b.vx, b.vy), 0)
                   / state.balls.length;
    state.bgVelocity += (avgSpd - state.bgVelocity) * 0.04;
  }
  const itv = Math.min(state.bgVelocity / 10, 1);

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, `rgb(${7  + itv * 28},0,${15 + itv * 40})`);
  bg.addColorStop(1, `rgb(${3  + itv * 12},0,${8  + itv * 22})`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Aztec grid (reacts to ball velocity)
  ctx.lineWidth   = 0.5;
  ctx.strokeStyle = `rgba(124,58,237,${0.045 + itv * 0.045})`;
  for (let x = 0; x < W; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.strokeStyle = `rgba(220,38,38,${0.03 + itv * 0.03})`;
  for (let y = 0; y < H; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Grecan borders
  drawGrecan(ctx, 0, 70,     W);
  drawGrecan(ctx, 0, H - 20, W, true);

  // ── Game content (skip in MENU / GAMEOVER) ────────────────────────────────
  if (state.phase === 'PLAYING' || state.phase === 'PAUSED') {
    drawBricks(ctx, state.bricks);
    drawDrops(ctx);
    particles.drawParticles(ctx);
    for (const b of state.balls) drawTrail(ctx, b);
    drawPaddle(ctx, paddle, fx);
    for (const b of state.balls) drawBall(ctx, b);
    particles.drawFloats(ctx);
  }
}

// ── Game Flow ─────────────────────────────────────────────────────────────────

/**
 * Spawn a ball from the centre of the paddle at a slightly random angle.
 */
function launch() {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.55;
  state.balls.push(
    mkBall(
      paddle.x,
      paddle.y - paddle.h / 2 - CFG.ballR,
      angle,
      state.wave,
      fx.fire.on,
      fx.slow.on,
    )
  );
}

/**
 * Advance to the next wave without resetting score or lives.
 */
function nextWave() {
  state.wave++;
  resetEffects();

  state.bricks = genBricks(state.wave);
  state.drops  = [];
  state.balls  = [];
  launch();

  ui.showWaveFlash(state.wave);
  ui.updateWaveLabel(state.wave);
}

/**
 * Terminate the session, persist the high score, report to Love Arcade.
 */
function doGameOver() {
  state.phase = 'GAMEOVER';
  sfx.lose();
  _reportCoins();

  const prevHs = parseInt(localStorage.getItem('OS_highscore') || '0', 10);
  if (state.score > prevHs) {
    localStorage.setItem('OS_highscore', String(state.score));
  }

  ui.showGameOver(state.score, state.wave, Math.floor(state.score / CFG.coinsDiv));
}

/**
 * Full reset and start.
 */
function startGame() {
  resetState();
  particles.reset();

  state.bricks = genBricks(state.wave);

  ui.showPlaying();
  ui.updateLives(state.lives);
  ui.updateWaveLabel(state.wave);

  // Short delay so the overlay transition completes before the ball launches
  setTimeout(() => {
    launch();
    particles.addFloat(CFG.W / 2, CFG.H / 2, 'OLEADA 1');
  }, 300);
}

/**
 * @param {boolean} paused
 */
function setPaused(paused) {
  state.phase = paused ? 'PAUSED' : 'PLAYING';
  ui.setPaused(paused);
}

function goToMenu() {
  state.phase = 'MENU';
  const hs = ui.refreshHighscore();
  ui.showMenu(hs, typeof window.GameCenter === 'undefined');
}

// ── Love Arcade Integration ───────────────────────────────────────────────────

/**
 * Report earned coins to the platform's GameCenter.
 * Called once per game session, at Game Over.
 *
 * The levelId encodes the wave reached and the session timestamp in base-36,
 * guaranteeing uniqueness and satisfying the idempotency requirement.
 */
function _reportCoins() {
  const coins = Math.floor(state.score / CFG.coinsDiv);
  if (coins <= 0) return;

  const levelId = `wave_${state.wave}_${state.sessionId}`;

  if (typeof window.GameCenter !== 'undefined') {
    window.GameCenter.completeLevel(CFG.gameId, levelId, coins);
    console.log(`[OllinSmash] Reportadas ${coins} monedas al GameCenter. (${levelId})`);
  } else {
    console.warn('[OllinSmash] Modo standalone activo — monedas no acumuladas.');
  }
}

// ── Input Handlers ────────────────────────────────────────────────────────────

function _onMove(clientX) {
  if (state.phase !== 'PLAYING') return;
  const rect  = canvas.getBoundingClientRect();
  const cx    = toCanvasX(clientX, rect, CFG.W);
  paddle.x    = Math.max(paddle.w / 2, Math.min(CFG.W - paddle.w / 2, cx));
  if (fx.magnet.held && fx.magnet.heldBall) {
    fx.magnet.heldBall.x = paddle.x;
  }
}

function _onTap() {
  if (state.phase !== 'PLAYING')         return;
  if (!fx.magnet.held || !fx.magnet.heldBall) return;

  const ball  = fx.magnet.heldBall;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;
  const spd   = CFG.ballBaseSpeed * (1 + (state.wave - 1) * CFG.waveMult);
  ball.vx = Math.cos(angle) * spd;
  ball.vy = Math.sin(angle) * spd;
  fx.magnet.heldBall = null;
  fx.magnet.held     = false;
  fx.magnet.shots--;
  if (fx.magnet.shots <= 0) fx.magnet.on = false;
}

/**
 * Toggle pause (called by button, keyboard, and two-finger double tap).
 */
function _onPause() {
  if      (state.phase === 'PLAYING') setPaused(true);
  else if (state.phase === 'PAUSED')  setPaused(false);
}

/**
 * Only pause — never resume (called by automatic triggers: tab hide, blur).
 */
function _onPauseOnly() {
  if (state.phase === 'PLAYING') setPaused(true);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

/**
 * Initialise the game after the DOM is ready.
 * ES modules are deferred by the browser, so this runs after DOMContentLoaded.
 */
function boot() {
  const isStandalone = typeof window.GameCenter === 'undefined';
  const hs           = parseInt(localStorage.getItem('OS_highscore') || '0', 10);

  ui.showMenu(hs, isStandalone);

  // Inject callbacks — avoids circular imports between main ↔ interface
  ui.bindButtons({
    onStart:  () => { initAudio(); startGame(); },
    onRetry:  () => { initAudio(); startGame(); },
    onResume: () => setPaused(false),
    onMenu:   goToMenu,
    onPause:  _onPause,
  });

  ui.bindInput({
    onMove:       _onMove,
    onTap:        _onTap,
    onPause:      _onPause,
    onPauseOnly:  _onPauseOnly,
  });

  ui.bindKeyboard(
    () => { if (state.phase === 'PLAYING') paddle.x = Math.max(paddle.w / 2,         paddle.x - 18); },
    () => { if (state.phase === 'PLAYING') paddle.x = Math.min(CFG.W - paddle.w / 2, paddle.x + 18); }
  );

  requestAnimationFrame(loop);
}

boot();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read-only interface for Love Arcade analytics and external testing.
 * Exposes game phase and score without granting write access to internals.
 */
window.OllinSmashGame = Object.freeze({
  getScore: () => state.score,
  getWave:  () => state.wave,
  getState: () => state.phase,
});
