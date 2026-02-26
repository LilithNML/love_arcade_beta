/**
 * ark.integration.js — Arkanoid · Love Arcade
 * Module C: External API communication.
 *
 * Responsibilities:
 *  - Convert internal points → Love Arcade coins
 *  - Call window.GameCenter.completeLevel() defensively
 *  - Idempotent session cache with 24h TTL in localStorage
 *  - Graceful degradation in standalone mode
 *
 * Public API:
 *   reportReward(levelId, internalPoints) → coinsEarned (int)
 *   getHighscore() → number
 *   saveHighscore(score)
 */

'use strict';

import { ARK_CONFIG } from './ark.config.js';

const C = ARK_CONFIG;

// ─────────────────────────────────────────────────────────────────
// § SESSION CACHE — idempotency
// Stores { sessionId: timestampMs } in ARK_reportedSessions.
// Entries older than 24h are evicted on load.
// ─────────────────────────────────────────────────────────────────
const _TTL_MS = 86_400_000; // 24 hours

function _loadSessions() {
  try {
    const raw = localStorage.getItem(C.LS_SESSIONS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now    = Date.now();
    const clean  = {};
    for (const [k, ts] of Object.entries(parsed)) {
      if (now - ts < _TTL_MS) clean[k] = ts;
    }
    return clean;
  } catch {
    return {};
  }
}

function _saveSessions(sessions) {
  try {
    localStorage.setItem(C.LS_SESSIONS, JSON.stringify(sessions));
  } catch (err) {
    console.warn('[ARK] Could not persist session cache:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// § PUBLIC API
// ─────────────────────────────────────────────────────────────────

/**
 * Convert internal score to coins and report to GameCenter.
 *
 * @param {string} levelId    - Logical level identifier for the event
 * @param {number} internalPoints - Raw internal game score
 * @returns {number} coinsEarned
 */
export function reportReward(levelId, internalPoints) {
  const coins = Math.floor(Math.max(0, internalPoints) / C.COINS_DIVISOR);

  if (coins <= 0) {
    console.warn('[ARK] Computed reward is 0 coins — skipping report.');
    return 0;
  }

  // Dynamic sessionId — each victory is unique (Date.now() suffix)
  const sessionId = `ark_${C.GAME_ID}_${levelId}_${Date.now()}`;

  // Idempotency guard
  const sessions = _loadSessions();
  if (sessions[sessionId]) {
    console.warn('[ARK] Duplicate session detected, skipping:', sessionId);
    return 0;
  }
  sessions[sessionId] = Date.now();
  _saveSessions(sessions);

  // ── Report to GameCenter (defensive — spec §9.1) ────────────
  if (typeof window.GameCenter !== 'undefined') {
    try {
      // Validate types per spec §5.2: gameId(String), levelId(String), coins(Int)
      window.GameCenter.completeLevel(
        String(C.GAME_ID),
        String(sessionId),
        Math.floor(coins)   // guarantee integer
      );
      console.log(`[ARK] ✓ Reported ${coins} coins | session: ${sessionId}`);
    } catch (err) {
      console.error('[ARK] Error reporting to GameCenter:', err);
    }
  } else {
    console.warn('[ARK] Standalone mode — GameCenter unavailable. Coins not accumulated.');
  }

  return coins;
}

/**
 * Read all-time highscore from localStorage.
 * @returns {number}
 */
export function getHighscore() {
  return parseInt(localStorage.getItem(C.LS_HIGHSCORE) || '0', 10);
}

/**
 * Persist a new highscore only if it beats the current record.
 * @param {number} score
 * @returns {boolean} true if new record
 */
export function saveHighscore(score) {
  const current = getHighscore();
  if (score > current) {
    localStorage.setItem(C.LS_HIGHSCORE, String(score));
    return true;
  }
  return false;
}

// Grouped export
export const ARK_Integration = { reportReward, getHighscore, saveHighscore };
