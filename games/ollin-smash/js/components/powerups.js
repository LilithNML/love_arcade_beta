/**
 * components/powerups.js — Ollin Smash v2.0
 *
 * Three responsibilities:
 *  1. Activation — apply the effect of a collected power-up (activatePU)
 *  2. Physics     — advance in-flight drops and detect paddle collection (updateDrops)
 *  3. Rendering   — draw all active drops with themed icons (drawDrops)
 *
 * Drop icon renderers (DROP_DRAW) are small inline canvas drawings that
 * intentionally mirror the SVG icons in the HTML HUD pills — same shapes,
 * but drawn via Canvas 2D API to keep assets at zero bytes.
 *
 * Imports state, paddle and fx directly from state.js.
 * This is safe because those are object references; mutating their
 * properties from here does not break the ES module binding contract.
 */

import { CFG }              from '../config.js';
import { state, paddle, fx } from '../state.js';
import { sfx }              from '../audio/audio-engine.js';
import { addFloat }         from '../core/particles.js';

// ── Drop Icon Renderers ───────────────────────────────────────────────────────

/**
 * Map of power-up type → canvas icon painter.
 * Each function receives (ctx, centreX, centreY) and is called
 * inside a save/restore block that has already set the outer box.
 *
 * @type {Object.<string, function(CanvasRenderingContext2D, number, number): void>}
 */
const DROP_DRAW = {

  /** PU_MULTI — three circles in a row */
  multi(ctx, x, y) {
    ctx.fillStyle   = CFG.C.gold;
    ctx.shadowColor = CFG.C.gold;
    ctx.shadowBlur  = 6;
    for (const ox of [-7, 0, 7]) {
      ctx.beginPath();
      ctx.arc(x + ox, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  /** PU_LONG — double-headed horizontal arrow */
  long(ctx, x, y) {
    ctx.strokeStyle = CFG.C.gold;
    ctx.lineWidth   = 2;
    ctx.shadowColor = CFG.C.gold;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y);
    ctx.moveTo(x - 6, y - 4); ctx.lineTo(x - 9, y); ctx.lineTo(x - 6, y + 4);
    ctx.moveTo(x + 6, y - 4); ctx.lineTo(x + 9, y); ctx.lineTo(x + 6, y + 4);
    ctx.stroke();
  },

  /** PU_FIRE — stylized flame using cubic bézier */
  fire(ctx, x, y) {
    ctx.strokeStyle = CFG.C.crimson;
    ctx.lineWidth   = 1.6;
    ctx.shadowColor = CFG.C.crimson;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.bezierCurveTo(x - 7, y + 1, x - 3, y - 4, x, y - 9);
    ctx.bezierCurveTo(x + 3, y - 4, x + 7, y + 1, x, y + 8);
    ctx.stroke();
  },

  /** PU_SLOW — hourglass shape */
  slow(ctx, x, y) {
    ctx.strokeStyle = CFG.C.violet;
    ctx.lineWidth   = 1.5;
    ctx.shadowColor = CFG.C.violet;
    ctx.shadowBlur  = 6;
    ctx.strokeRect(x - 6, y - 9, 12, 18);
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 8); ctx.lineTo(x + 5, y - 8);
    ctx.moveTo(x - 5, y + 8); ctx.lineTo(x + 5, y + 8);
    ctx.moveTo(x - 4, y - 8); ctx.lineTo(x, y - 1); ctx.lineTo(x + 4, y - 8);
    ctx.moveTo(x - 4, y + 8); ctx.lineTo(x, y + 1); ctx.lineTo(x + 4, y + 8);
    ctx.stroke();
  },

  /** PU_MAGNET — U-shaped magnet with legs */
  magnet(ctx, x, y) {
    ctx.strokeStyle = CFG.C.cyan;
    ctx.lineWidth   = 2;
    ctx.shadowColor = CFG.C.cyan;
    ctx.shadowBlur  = 7;
    ctx.beginPath();
    ctx.arc(x, y + 3, 6, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 3); ctx.lineTo(x - 6, y - 8);
    ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 6, y - 8);
    ctx.stroke();
  },
};

// ── Activation ────────────────────────────────────────────────────────────────

/**
 * Apply the effect of a collected power-up.
 * Mutates state.balls, paddle and fx as required by the power-up type.
 *
 * @param {string} type  - Power-up identifier ('multi'|'long'|'fire'|'slow'|'magnet')
 * @param {number} wave  - Current wave (used to compute speeds for spawned balls)
 */
export function activatePU(type, wave) {
  sfx.powerup();

  switch (type) {

    case 'multi': {
      // Clone each existing ball into two additional trajectories ±0.42 rad
      const src = [...state.balls];
      for (const b of src) {
        const spd = Math.hypot(b.vx, b.vy);
        for (const delta of [0.42, -0.42]) {
          const angle = Math.atan2(b.vy, b.vx) + delta;
          state.balls.push({
            x: b.x, y: b.y,
            vx:    Math.cos(angle) * spd,
            vy:    Math.sin(angle) * spd,
            r:     CFG.ballR,
            trail: [],
            fire:  b.fire,
          });
        }
      }
      addFloat(CFG.W / 2, CFG.H / 2 - 20, 'FRAGMENTACION');
      break;
    }

    case 'long':
      fx.long.on = true;
      fx.long.t  = 20 * 60;                         // 20 seconds @ 60 fps
      paddle.w   = CFG.paddleInitW * 1.4;
      addFloat(CFG.W / 2, CFG.H / 2 - 20, 'EXPANSION OLLIN');
      break;

    case 'fire':
      fx.fire.on = true;
      fx.fire.t  = 30 * 60;
      for (const b of state.balls) b.fire = true;
      addFloat(CFG.W / 2, CFG.H / 2 - 20, 'ALIENTO DE QUETZALCOATL', CFG.C.crimson);
      break;

    case 'slow':
      fx.slow.on = true;
      fx.slow.t  = 15 * 60;
      for (const b of state.balls) { b.vx *= 0.7; b.vy *= 0.7; }
      addFloat(CFG.W / 2, CFG.H / 2 - 20, 'TIEMPO DE OBSIDIANA', CFG.C.violet);
      break;

    case 'magnet':
      fx.magnet.on    = true;
      fx.magnet.shots = 5;
      addFloat(CFG.W / 2, CFG.H / 2 - 20, 'ATRACCION TLALOC', CFG.C.cyan);
      break;

    default:
      console.warn(`[OllinSmash] activatePU: unknown type "${type}"`);
  }
}

// ── Drop Physics ──────────────────────────────────────────────────────────────

/**
 * Advance all in-flight power-up drops by one frame and check for
 * paddle collection. Collected or off-screen drops are spliced out.
 *
 * @param {number} wave - Forwarded to activatePU for ball speed computation
 */
export function updateDrops(wave) {
  const pLeft  = paddle.x - paddle.w / 2;
  const pRight = paddle.x + paddle.w / 2;
  const pTop   = paddle.y - paddle.h / 2;
  const pBot   = paddle.y + paddle.h / 2;

  for (let i = state.drops.length - 1; i >= 0; i--) {
    const d = state.drops[i];
    d.y += CFG.puFallSpeed;

    const collected =
      d.y + d.h / 2 >= pTop &&
      d.y - d.h / 2 <= pBot &&
      d.x           >= pLeft &&
      d.x           <= pRight;

    if (collected) {
      activatePU(d.type, wave);
      state.drops.splice(i, 1);
      continue;
    }

    if (d.y > CFG.H + 20) {
      state.drops.splice(i, 1);
    }
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

/**
 * Draw all in-flight drop items.
 * Each drop is rendered as a small box with a themed outline and
 * an inline icon from DROP_DRAW.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawDrops(ctx) {
  for (const d of state.drops) {
    const col = d.type === 'fire'   ? CFG.C.crimson
              : d.type === 'magnet' ? CFG.C.cyan
              : d.type === 'slow'   ? CFG.C.violet
              : CFG.C.gold;

    ctx.save();
    ctx.fillStyle   = 'rgba(3,0,7,0.82)';
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 10;

    ctx.fillRect  (d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
    ctx.strokeRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);

    ctx.shadowBlur = 0;
    DROP_DRAW[d.type]?.(ctx, d.x, d.y);
    ctx.restore();
  }
}
