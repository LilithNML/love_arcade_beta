/**
 * snake-economy.js
 * LA-Snake Classic — Economy Module v1.3
 *
 * CHANGES v1.3 — GameCenter idempotency fix:
 *   ROOT CAUSE: app.js completeLevel() is idempotent — it tracks every
 *   levelId it has paid inside store.progress[gameId] and silently rejects
 *   any repeat call with the same levelId. Using a static 'standard_mode'
 *   string meant only the FIRST session ever received a reward.
 *
 *   FIX: LAS_sessionId is generated in startSession() using Date.now() and
 *   a random suffix, producing a globally unique string per game session:
 *       "session_1719432800123_a7f3"
 *   Each session is treated as a new unique hito by Love Arcade, so
 *   completeLevel() always transacts successfully.
 *
 *   NOTE on store growth: app.js caps progress arrays at 150 entries
 *   (via logTransaction history cap). Snake sessions accumulate in
 *   store.progress['la_snake_classic'] indefinitely, but each entry is a
 *   short string (~28 chars) so growth is negligible in practice.
 *
 * CHANGES v1.2:
 *   - LAS_GAME_ID: 'snake' → 'la_snake_classic'
 *   - Reward formula: Math.floor(sessionScore × comboMultiplierAtDeath)
 *   - Math.floor() + Math.max(1, …) guarantees integer > 0
 *   - try/catch + existence check around completeLevel
 *   - Combo multiplier captured before reset in endSession()
 *
 * Prefix: LAS_
 */

const LAS_Economy = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS
  // ─────────────────────────────────────────────

  /**
   * Game identifier registered in Love Arcade's app.js.
   * Used as the key in store.progress — must be stable across all sessions.
   */
  const LAS_GAME_ID        = 'la_snake_classic';
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

  /**
   * Unique identifier for the current session.
   * Generated fresh in LAS_startSession() so each game-over produces
   * a distinct levelId for completeLevel() — bypassing its idempotency guard.
   * Format: "session_{timestamp}_{4-char hex random}"
   * Example: "session_1719432800123_a7f3"
   */
  let LAS_sessionId = '';

  let LAS_onComboChange = null;
  let LAS_onScoreChange = null;
  let LAS_onSkinUnlock  = null;

  // ─────────────────────────────────────────────
  // SESSION ID GENERATOR
  // ─────────────────────────────────────────────

  /**
   * Generates a unique session identifier.
   * Combines timestamp (ms) with a random 4-char hex suffix to prevent
   * collisions if two sessions start within the same millisecond.
   * @returns {string}
   */
  function LAS_generateSessionId() {
    const ts     = Date.now();
    const rand   = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `session_${ts}_${rand}`;
  }

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

  /**
   * Initializes a new game session.
   * Generates a fresh unique LAS_sessionId for this session's
   * completeLevel() call — critical for bypassing app.js idempotency.
   */
  function LAS_startSession() {
    LAS_sessionScore     = 0;
    LAS_comboMultiplier  = 1;
    LAS_lastEatTimestamp = 0;
    LAS_sessionId        = LAS_generateSessionId(); // ← unique per session
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);
  }

  /**
   * Closes the session and submits reward to Love Arcade's GameCenter.
   *
   * IDEMPOTENCY: Uses LAS_sessionId (unique per session) as the levelId
   * parameter. This ensures app.js never silently rejects the call because
   * each session has a distinct ID it has never seen before.
   *
   * Reward formula (v1.2+):
   *   rewardAmount = Math.max(1, Math.floor(finalScore × comboAtDeath))
   *
   * IMPORTANT: Caller must apply 100ms delay before this call so the
   * app.js DOM is in a stable state (see snake.html orchestrator).
   *
   * @param {number} finalScore
   * @param {number} snakeLength
   */
  function LAS_endSession(finalScore, snakeLength) {
    if (LAS_comboTimer) clearTimeout(LAS_comboTimer);

    // Capture multiplier BEFORE reset
    const multiplierAtDeath = LAS_comboMultiplier;
    LAS_comboMultiplier  = 1;
    LAS_lastEatTimestamp = 0;

    const isNewRecord = LAS_saveHighScore(finalScore);

    // ── Reward calculation ──
    // score × comboAtDeath ensures high-rhythm sessions are rewarded.
    // Math.floor() enforces integer; Math.max(1, …) guarantees at least 1 coin.
    const rawReward    = finalScore * multiplierAtDeath;
    const rewardAmount = Math.max(1, Math.floor(rawReward));

    // ── GameCenter submission ──
    // levelId = LAS_sessionId — unique string per session, never repeated.
    // This bypasses the store.progress idempotency guard in app.js so that
    // every game-over successfully deposits coins into the player's wallet.
    if (window.GameCenter &&
        typeof window.GameCenter.completeLevel === 'function') {
      try {
        window.GameCenter.completeLevel(
          LAS_GAME_ID,   // 'la_snake_classic'  — stable game key
          LAS_sessionId, // 'session_1719…_a7f3' — unique per session ← FIX
          rewardAmount   // integer >= 1
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
      allTimeHigh: LAS_getHighScore(),
      sessionId:   LAS_sessionId
    };
  }

  // ─────────────────────────────────────────────
  // COMBO BAR DATA (for HUD renderer)
  // ─────────────────────────────────────────────

  function LAS_getComboBarData() {
    const now           = Date.now();
    const elapsed       = now - LAS_lastEatTimestamp;
    const timeRemaining = Math.max(0, LAS_COMBO_WINDOW_MS - elapsed);
    const timePercent   = LAS_lastEatTimestamp > 0
      ? (timeRemaining / LAS_COMBO_WINDOW_MS) * 100 : 0;
    const multiplierPercent = ((LAS_comboMultiplier - 1) / (LAS_MAX_MULTIPLIER - 1)) * 100;

    return {
      multiplier:         LAS_comboMultiplier,
      multiplierPercent,
      timePercent,
      isActive:           LAS_comboMultiplier > 1
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

    // Constants (for reference / testing)
    COMBO_WINDOW_MS:    LAS_COMBO_WINDOW_MS,
    MAX_MULTIPLIER:     LAS_MAX_MULTIPLIER,
    GAME_ID:            LAS_GAME_ID,
  };
})();
