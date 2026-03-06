/**
 * snake-audio.js
 * LA-Snake Classic — Audio Module v1.2
 *
 * CHANGES v1.2:
 *   - sfxTurn(): square-wave metallic click 0.05s — fires on valid swipe
 *   - sfxInvalidTurn(): low dull thud — fires on 180-degree block
 *
 * Prefix: LAS_
 */

const LAS_Audio = (() => {
  let LAS_audioCtx   = null;
  let LAS_masterGain = null;
  let LAS_muted      = false;

  // ─────────────────────────────────────────────
  // CONTEXT MANAGEMENT
  // ─────────────────────────────────────────────

  function LAS_initAudio() {
    if (LAS_audioCtx) return;
    try {
      LAS_audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
      LAS_masterGain = LAS_audioCtx.createGain();
      LAS_masterGain.gain.setValueAtTime(0.4, LAS_audioCtx.currentTime);
      LAS_masterGain.connect(LAS_audioCtx.destination);
    } catch (e) {
      console.warn('[LAS_Audio] Web Audio API not available:', e);
    }
  }

  function LAS_resumeCtx() {
    if (LAS_audioCtx && LAS_audioCtx.state === 'suspended') {
      LAS_audioCtx.resume();
    }
  }

  // ─────────────────────────────────────────────
  // PRIMITIVES
  // ─────────────────────────────────────────────

  /**
   * Single oscillator with linear frequency sweep and exponential gain envelope.
   */
  function LAS_playTone(type, freq, freqEnd, duration, gainPeak = 0.3) {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now  = LAS_audioCtx.currentTime;
    const osc  = LAS_audioCtx.createOscillator();
    const gain = LAS_audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(LAS_masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * White noise burst for death sound.
   */
  function LAS_playNoise(duration, freqStart = 1800) {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now        = LAS_audioCtx.currentTime;
    const bufferSize = LAS_audioCtx.sampleRate * duration;
    const buffer     = LAS_audioCtx.createBuffer(1, bufferSize, LAS_audioCtx.sampleRate);
    const data       = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const src    = LAS_audioCtx.createBufferSource();
    src.buffer   = buffer;

    const filter = LAS_audioCtx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.linearRampToValueAtTime(80, now + duration);

    const gain = LAS_audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(LAS_masterGain);
    src.start(now);
    src.stop(now + duration);
  }

  // ─────────────────────────────────────────────
  // PUBLIC SOUND EFFECTS
  // ─────────────────────────────────────────────

  /** Eat food — short ascending tone */
  function LAS_sfxEat() {
    LAS_playTone('square', 300, 600, 0.12, 0.25);
  }

  /** Eat power-up — rapid ascending arpeggio */
  function LAS_sfxPowerup() {
    [400, 500, 700, 1000].forEach((freq, i) => {
      setTimeout(() => LAS_playTone('sawtooth', freq, freq * 1.2, 0.08, 0.2), i * 55);
    });
  }

  /** Death — descending white noise + low tone */
  function LAS_sfxDeath() {
    LAS_playNoise(0.8, 1800);
    setTimeout(() => LAS_playTone('sawtooth', 250, 60, 0.4, 0.2), 100);
  }

  /** Combo milestone — punchy double accent */
  function LAS_sfxCombo(multiplier) {
    const base = 200 + multiplier * 80;
    LAS_playTone('square', base, base * 1.5, 0.15, 0.3);
    setTimeout(() => LAS_playTone('square', base * 1.5, base * 2, 0.1, 0.2), 100);
  }

  /** UI navigation click */
  function LAS_sfxClick() {
    LAS_playTone('square', 440, 480, 0.06, 0.15);
  }

  /** Game start jingle — C4 E4 G4 C5 */
  function LAS_sfxStart() {
    [262, 330, 392, 523].forEach((freq, i) => {
      setTimeout(() => LAS_playTone('square', freq, freq, 0.1, 0.25), i * 80);
    });
  }

  /**
   * v1.2 — Turn confirmation: metallic square click, 0.05s.
   * Fired every time a valid swipe is registered.
   * Very short envelope to feel snappy, not intrusive.
   */
  function LAS_sfxTurn() {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now  = LAS_audioCtx.currentTime;
    const osc  = LAS_audioCtx.createOscillator();
    const gain = LAS_audioCtx.createGain();

    osc.type = 'square';
    // Metallic: brief high-pitch click that drops fast
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(LAS_masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * v1.2 — Invalid direction (180-degree block): low dull thud.
   * Communicates that the move was rejected without being jarring.
   */
  function LAS_sfxInvalidTurn() {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now  = LAS_audioCtx.currentTime;
    const osc  = LAS_audioCtx.createOscillator();
    const gain = LAS_audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(55, now + 0.08);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(LAS_masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Toggle mute globally */
  function LAS_toggleMute() {
    LAS_muted = !LAS_muted;
    if (LAS_masterGain) {
      LAS_masterGain.gain.setValueAtTime(LAS_muted ? 0 : 0.4, LAS_audioCtx.currentTime);
    }
    return LAS_muted;
  }

  function LAS_isMuted() { return LAS_muted; }

  return {
    init:           LAS_initAudio,
    sfxEat:         LAS_sfxEat,
    sfxPowerup:     LAS_sfxPowerup,
    sfxDeath:       LAS_sfxDeath,
    sfxCombo:       LAS_sfxCombo,
    sfxClick:       LAS_sfxClick,
    sfxStart:       LAS_sfxStart,
    sfxTurn:        LAS_sfxTurn,
    sfxInvalidTurn: LAS_sfxInvalidTurn,
    toggleMute:     LAS_toggleMute,
    isMuted:        LAS_isMuted,
  };
})();
