/**
 * snake-economy.js
 * LA-Snake Classic — Economy Module
 * Handles combos, skin unlocks, and GameCenter integration.
 * Prefix: LAS_
 */

const LAS_Economy = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────

  const LAS_GAME_ID = 'snake';
  const LAS_STORAGE_PREFIX = 'LAS_';

  const LAS_SKIN_DEFINITIONS = [
    { id: 'classic',    name: 'Classic Green', unlockScore: 0,    description: 'The original.' },
    { id: 'neon',       name: 'Neon Pulse',    unlockScore: 500,  description: 'Solid neon light borders.' },
    { id: 'cyber',      name: 'Cyber Scale',   unlockScore: 1500, description: 'Geometric scale pattern.' },
    { id: 'gold',       name: 'Gold Edition',  unlockScore: 3000, description: 'Solid gold with turn particles.' }
  ];

  const LAS_COMBO_WINDOW_MS    = 3000; // 3 seconds between eats to sustain combo
  const LAS_MAX_MULTIPLIER     = 8;
  const LAS_BASE_POINT_FOOD    = 10;
  const LAS_BASE_POINT_POWERUP = 25;

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  let LAS_comboMultiplier   = 1;
  let LAS_comboTimer        = null;
  let LAS_lastEatTimestamp  = 0;
  let LAS_sessionScore      = 0;
  let LAS_sessionHighScore  = 0;
  let LAS_onComboChange     = null; // callback(multiplier)
  let LAS_onScoreChange     = null; // callback(score)
  let LAS_onSkinUnlock      = null; // callback(skinId)

  // ─────────────────────────────────────────────
  // PERSISTENCE (localStorage with LAS_ prefix)
  // ─────────────────────────────────────────────

  function LAS_storeSet(key, value) {
    try {
      localStorage.setItem(LAS_STORAGE_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('[LAS_Economy] localStorage write failed:', e);
    }
  }

  function LAS_storeGet(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LAS_STORAGE_PREFIX + key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function LAS_getHighScore() {
    return LAS_storeGet('highScore', 0);
  }

  function LAS_saveHighScore(score) {
    const current = LAS_getHighScore();
    if (score > current) {
      LAS_storeSet('highScore', score);
      return true; // new record
    }
    return false;
  }

  function LAS_getUnlockedSkins() {
    return LAS_storeGet('unlockedSkins', ['classic']);
  }

  function LAS_unlockSkin(skinId) {
    const skins = LAS_getUnlockedSkins();
    if (!skins.includes(skinId)) {
      skins.push(skinId);
      LAS_storeSet('unlockedSkins', skins);
      if (LAS_onSkinUnlock) LAS_onSkinUnlock(skinId);
      return true;
    }
    return false;
  }

  function LAS_getSelectedSkin() {
    return LAS_storeGet('selectedSkin', 'classic');
  }

  function LAS_setSelectedSkin(skinId) {
    LAS_storeSet('selectedSkin', skinId);
  }

  // ─────────────────────────────────────────────
  // COMBO SYSTEM
  // ─────────────────────────────────────────────

  /**
   * Call when the snake eats any item.
   * Returns the points awarded with the multiplier applied.
   * @param {boolean} isPowerup
   */
  function LAS_onItemEaten(isPowerup = false) {
    const now = Date.now();
    const elapsed = now - LAS_lastEatTimestamp;

    if (LAS_lastEatTimestamp > 0 && elapsed <= LAS_COMBO_WINDOW_MS) {
      // Sustain or increase combo
      LAS_comboMultiplier = Math.min(LAS_comboMultiplier + 1, LAS_MAX_MULTIPLIER);
    } else {
      // Reset combo
      LAS_comboMultiplier = 1;
    }

    LAS_lastEatTimestamp = now;

    // Restart combo decay timer
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
    LAS_comboTimer = setTimeout(() => {
      LAS_comboMultiplier = 1;
      LAS_lastEatTimestamp = 0;
      if (LAS_onComboChange) LAS_onComboChange(1);
    }, LAS_COMBO_WINDOW_MS);

    if (LAS_onComboChange) LAS_onComboChange(LAS_comboMultiplier);

    // Calculate points
    const base = isPowerup ? LAS_BASE_POINT_POWERUP : LAS_BASE_POINT_FOOD;
    const points = base * LAS_comboMultiplier;

    LAS_sessionScore += points;
    if (LAS_onScoreChange) LAS_onScoreChange(LAS_sessionScore);

    // Check skin unlocks after score update
    LAS_checkSkinUnlocks(LAS_sessionScore);

    return points;
  }

  /**
   * Check if any skins should be unlocked based on current score.
   */
  function LAS_checkSkinUnlocks(score) {
    LAS_SKIN_DEFINITIONS.forEach(skin => {
      if (score >= skin.unlockScore) {
        LAS_unlockSkin(skin.id);
      }
    });
  }

  // ─────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────

  function LAS_startSession() {
    LAS_sessionScore    = 0;
    LAS_comboMultiplier = 1;
    LAS_lastEatTimestamp = 0;
    LAS_sessionHighScore = LAS_getHighScore();
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
  }

  /**
   * Call on game over.
   * Submits score to GameCenter at end of session.
   * Reward is NOT given during play — only on game end.
   * @param {number} finalScore
   * @param {number} snakeLength
   */
  function LAS_endSession(finalScore, snakeLength) {
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
    LAS_comboMultiplier = 1;

    const isNewRecord = LAS_saveHighScore(finalScore);

    // Calculate reward (1 coin per 10 points, minimum 1)
    const rewardAmount = Math.max(1, Math.floor(finalScore / 10));

    // Submit to GameCenter if available
    if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
      try {
        window.GameCenter.completeLevel(LAS_GAME_ID, 'session', rewardAmount);
      } catch (e) {
        console.warn('[LAS_Economy] GameCenter.completeLevel failed:', e);
      }
    }

    // Final unlock check against all-time high score
    const allTimeHigh = LAS_getHighScore();
    LAS_checkSkinUnlocks(allTimeHigh);

    return {
      finalScore,
      rewardAmount,
      isNewRecord,
      allTimeHigh: LAS_getHighScore()
    };
  }

  // ─────────────────────────────────────────────
  // COMBO BAR RENDERING HELPER
  // ─────────────────────────────────────────────

  /**
   * Returns combo bar fill percentage (0–100).
   * Also returns time-remaining percentage within window.
   */
  function LAS_getComboBarData() {
    const now = Date.now();
    const elapsed = now - LAS_lastEatTimestamp;
    const timeRemaining = Math.max(0, LAS_COMBO_WINDOW_MS - elapsed);
    const timePercent = LAS_lastEatTimestamp > 0
      ? (timeRemaining / LAS_COMBO_WINDOW_MS) * 100
      : 0;

    const multiplierPercent = ((LAS_comboMultiplier - 1) / (LAS_MAX_MULTIPLIER - 1)) * 100;

    return {
      multiplier: LAS_comboMultiplier,
      multiplierPercent,
      timePercent,
      isActive: LAS_comboMultiplier > 1
    };
  }

  // ─────────────────────────────────────────────
  // SKIN QUERY HELPERS
  // ─────────────────────────────────────────────

  function LAS_getSkinDefinitions() {
    return LAS_SKIN_DEFINITIONS;
  }

  function LAS_isSkinUnlocked(skinId) {
    return LAS_getUnlockedSkins().includes(skinId);
  }

  function LAS_isSkinAvailable(skinId) {
    const skin = LAS_SKIN_DEFINITIONS.find(s => s.id === skinId);
    if (!skin) return false;
    const highScore = LAS_getHighScore();
    return highScore >= skin.unlockScore;
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  return {
    // Session
    startSession:        LAS_startSession,
    endSession:          LAS_endSession,

    // Scoring
    onItemEaten:         LAS_onItemEaten,
    getSessionScore:     () => LAS_sessionScore,

    // Combo
    getComboMultiplier:  () => LAS_comboMultiplier,
    getComboBarData:     LAS_getComboBarData,

    // Skins
    getSkinDefinitions:  LAS_getSkinDefinitions,
    getUnlockedSkins:    LAS_getUnlockedSkins,
    isSkinUnlocked:      LAS_isSkinUnlocked,
    isSkinAvailable:     LAS_isSkinAvailable,
    getSelectedSkin:     LAS_getSelectedSkin,
    setSelectedSkin:     LAS_setSelectedSkin,

    // Persistence
    getHighScore:        LAS_getHighScore,

    // Callbacks
    onComboChange:       (fn) => { LAS_onComboChange = fn; },
    onScoreChange:       (fn) => { LAS_onScoreChange = fn; },
    onSkinUnlock:        (fn) => { LAS_onSkinUnlock  = fn; },

    // Constants (for renderer reference)
    COMBO_WINDOW_MS:     LAS_COMBO_WINDOW_MS,
    MAX_MULTIPLIER:      LAS_MAX_MULTIPLIER
  };
})();
