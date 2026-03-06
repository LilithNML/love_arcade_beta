/**
 * snake-economy.js
 * LA-Snake Classic — Economy Module v1.2
 *
 * CHANGES v1.2:
 *   - LAS_GAME_ID: 'snake' → 'la_snake_classic'  (required by app.js v9.4)
 *   - levelId:    'session' → 'standard_mode'     (required by app.js v9.4)
 *   - Reward formula: Math.floor(sessionScore * comboMultiplier)
 *     (comboMultiplier captured at game-over moment before reset)
 *   - Math.floor() + Math.max(1, ...) guarantees integer > 0
 *   - try/catch around completeLevel + existence check
 *   - 100ms delay applied at call site (see snake.html orchestrator)
 *   - Snapshot of comboMultiplier taken in endSession() before reset
 *
 * Prefix: LAS_
 */

const LAS_Economy = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────

  const LAS_GAME_ID        = 'la_snake_classic'; // Corrected ID for app.js v9.4
  const LAS_LEVEL_ID       = 'standard_mode';    // Corrected level ID for app.js v9.4
  const LAS_STORAGE_PREFIX = 'LAS_';

  const LAS_SKIN_DEFINITIONS = [
    { id: 'classic', name: 'Classic Green', unlockScore: 0,    description: 'The original.' },
    { id: 'neon',    name: 'Neon Pulse',    unlockScore: 500,  description: 'Solid neon light borders.' },
    { id: 'cyber',   name: 'Cyber Scale',   unlockScore: 1500, description: 'Geometric scale pattern.' },
    { id: 'gold',    name: 'Gold Edition',  unlockScore: 3000, description: 'Solid gold with turn particles.' }
  ];

  const LAS_COMBO_WINDOW_MS    = 3000;
  const LAS_MAX_MULTIPLIER     = 8;
  const LAS_BASE_POINT_FOOD    = 10;
  const LAS_BASE_POINT_POWERUP = 25;

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  let LAS_comboMultiplier  = 1;
  let LAS_comboTimer       = null;
  let LAS_lastEatTimestamp = 0;
  let LAS_sessionScore     = 0;

  let LAS_onComboChange = null;
  let LAS_onScoreChange = null;
  let LAS_onSkinUnlock  = null;

  // ─────────────────────────────────────────────
  // PERSISTENCE
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
      return true;
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

  function LAS_onItemEaten(isPowerup = false) {
    const now     = Date.now();
    const elapsed = now - LAS_lastEatTimestamp;

    if (LAS_lastEatTimestamp > 0 && elapsed <= LAS_COMBO_WINDOW_MS) {
      LAS_comboMultiplier = Math.min(LAS_comboMultiplier + 1, LAS_MAX_MULTIPLIER);
    } else {
      LAS_comboMultiplier = 1;
    }

    LAS_lastEatTimestamp = now;

    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
    LAS_comboTimer = setTimeout(() => {
      LAS_comboMultiplier  = 1;
      LAS_lastEatTimestamp = 0;
      if (LAS_onComboChange) LAS_onComboChange(1);
    }, LAS_COMBO_WINDOW_MS);

    if (LAS_onComboChange) LAS_onComboChange(LAS_comboMultiplier);

    const base   = isPowerup ? LAS_BASE_POINT_POWERUP : LAS_BASE_POINT_FOOD;
    const points = base * LAS_comboMultiplier;

    LAS_sessionScore += points;
    if (LAS_onScoreChange) LAS_onScoreChange(LAS_sessionScore);

    LAS_checkSkinUnlocks(LAS_sessionScore);
    return points;
  }

  function LAS_checkSkinUnlocks(score) {
    LAS_SKIN_DEFINITIONS.forEach(skin => {
      if (score >= skin.unlockScore) LAS_unlockSkin(skin.id);
    });
  }

  // ─────────────────────────────────────────────
  // SESSION MANAGEMENT
  // ─────────────────────────────────────────────

  function LAS_startSession() {
    LAS_sessionScore     = 0;
    LAS_comboMultiplier  = 1;
    LAS_lastEatTimestamp = 0;
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
  }

  /**
   * Closes the session and submits reward to GameCenter.
   *
   * Reward formula (v1.2):
   *   finalReward = Math.max(1, Math.floor(sessionScore * comboMultiplierAtDeath))
   *
   * The comboMultiplier is captured BEFORE the reset so a high-combo
   * game-over is reflected in the reward.
   *
   * IMPORTANT: The caller (orchestrator) must add a 100ms delay
   * before calling endSession() to ensure app.js DOM is ready.
   *
   * @param {number} finalScore
   * @param {number} snakeLength
   */
  function LAS_endSession(finalScore, snakeLength) {
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);

    // Capture multiplier before reset
    const multiplierAtDeath = LAS_comboMultiplier;
    LAS_comboMultiplier  = 1;
    LAS_lastEatTimestamp = 0;

    const isNewRecord = LAS_saveHighScore(finalScore);

    // ── Reward calculation ──
    // Integer enforced via Math.floor(); minimum 1 coin per session.
    const rawReward    = finalScore * multiplierAtDeath;
    const rewardAmount = Math.max(1, Math.floor(rawReward));

    // ── GameCenter submission ──
    // Guarded by existence check + type check + try/catch.
    if (window.GameCenter &&
        typeof window.GameCenter.completeLevel === 'function') {
      try {
        window.GameCenter.completeLevel(
          LAS_GAME_ID,    // 'la_snake_classic'
          LAS_LEVEL_ID,   // 'standard_mode'
          rewardAmount    // integer > 0
        );
      } catch (err) {
        console.warn('[LAS_Economy] GameCenter.completeLevel failed:', err);
      }
    }

    // Final skin unlock check against persisted high score
    LAS_checkSkinUnlocks(LAS_getHighScore());

    return {
      finalScore,
      rewardAmount,
      multiplierAtDeath,
      isNewRecord,
      allTimeHigh: LAS_getHighScore()
    };
  }

  // ─────────────────────────────────────────────
  // COMBO BAR DATA (for HUD renderer)
  // ─────────────────────────────────────────────

  function LAS_getComboBarData() {
    const now          = Date.now();
    const elapsed      = now - LAS_lastEatTimestamp;
    const timeRemaining= Math.max(0, LAS_COMBO_WINDOW_MS - elapsed);
    const timePercent  = LAS_lastEatTimestamp > 0
      ? (timeRemaining / LAS_COMBO_WINDOW_MS) * 100 : 0;
    const multiplierPercent = ((LAS_comboMultiplier - 1) / (LAS_MAX_MULTIPLIER - 1)) * 100;

    return {
      multiplier: LAS_comboMultiplier,
      multiplierPercent,
      timePercent,
      isActive: LAS_comboMultiplier > 1
    };
  }

  // ─────────────────────────────────────────────
  // SKIN HELPERS
  // ─────────────────────────────────────────────

  function LAS_getSkinDefinitions() { return LAS_SKIN_DEFINITIONS; }

  function LAS_isSkinUnlocked(skinId) {
    return LAS_getUnlockedSkins().includes(skinId);
  }

  function LAS_isSkinAvailable(skinId) {
    const skin = LAS_SKIN_DEFINITIONS.find(s => s.id === skinId);
    if (!skin) return false;
    return LAS_getHighScore() >= skin.unlockScore;
  }

  // ─────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────

  return {
    // Session
    startSession:       LAS_startSession,
    endSession:         LAS_endSession,

    // Scoring
    onItemEaten:        LAS_onItemEaten,
    getSessionScore:    () => LAS_sessionScore,

    // Combo
    getComboMultiplier: () => LAS_comboMultiplier,
    getComboBarData:    LAS_getComboBarData,

    // Skins
    getSkinDefinitions: LAS_getSkinDefinitions,
    getUnlockedSkins:   LAS_getUnlockedSkins,
    isSkinUnlocked:     LAS_isSkinUnlocked,
    isSkinAvailable:    LAS_isSkinAvailable,
    getSelectedSkin:    LAS_getSelectedSkin,
    setSelectedSkin:    LAS_setSelectedSkin,

    // Persistence
    getHighScore:       LAS_getHighScore,

    // Callbacks
    onComboChange:      (fn) => { LAS_onComboChange = fn; },
    onScoreChange:      (fn) => { LAS_onScoreChange = fn; },
    onSkinUnlock:       (fn) => { LAS_onSkinUnlock  = fn; },

    // Constants exposed for testing
    COMBO_WINDOW_MS:    LAS_COMBO_WINDOW_MS,
    MAX_MULTIPLIER:     LAS_MAX_MULTIPLIER,
    GAME_ID:            LAS_GAME_ID,
    LEVEL_ID:           LAS_LEVEL_ID,
  };
})();
