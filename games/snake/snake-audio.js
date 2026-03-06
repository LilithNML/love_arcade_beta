/**
 * snake-audio.js
 * LA-Snake Classic — Audio Module
 * Web Audio API synthesizer (no external files)
 * Prefix: LAS_
 */

const LAS_Audio = (() => {
  let LAS_audioCtx = null;
  let LAS_audioUnlocked = false;
  let LAS_masterGain = null;
  let LAS_muted = false;

  /**
   * Initialize audio context on first user interaction.
   * Browsers require a user gesture before creating AudioContext.
   */
  function LAS_initAudio() {
    if (LAS_audioCtx) return;
    try {
      LAS_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      LAS_masterGain = LAS_audioCtx.createGain();
      LAS_masterGain.gain.setValueAtTime(0.4, LAS_audioCtx.currentTime);
      LAS_masterGain.connect(LAS_audioCtx.destination);
      LAS_audioUnlocked = true;
    } catch (e) {
      console.warn('[LAS_Audio] Web Audio API not available:', e);
    }
  }

  function LAS_resumeCtx() {
    if (LAS_audioCtx && LAS_audioCtx.state === 'suspended') {
      LAS_audioCtx.resume();
    }
  }

  /**
   * Creates a simple oscillator envelope
   * @param {string} type - OscillatorType
   * @param {number} freq - Start frequency Hz
   * @param {number} freqEnd - End frequency Hz
   * @param {number} duration - Duration in seconds
   * @param {number} gainPeak - Peak gain (0–1)
   */
  function LAS_playTone(type, freq, freqEnd, duration, gainPeak = 0.3) {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now = LAS_audioCtx.currentTime;
    const osc = LAS_audioCtx.createOscillator();
    const gainNode = LAS_audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gainNode);
    gainNode.connect(LAS_masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * White noise burst for death sound
   */
  function LAS_playNoise(duration, freqCutoff = 1200) {
    if (!LAS_audioCtx || LAS_muted) return;
    LAS_resumeCtx();

    const now = LAS_audioCtx.currentTime;
    const bufferSize = LAS_audioCtx.sampleRate * duration;
    const buffer = LAS_audioCtx.createBuffer(1, bufferSize, LAS_audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = LAS_audioCtx.createBufferSource();
    source.buffer = buffer;

    const filter = LAS_audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freqCutoff, now);
    filter.frequency.linearRampToValueAtTime(80, now + duration);

    const gainNode = LAS_audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(LAS_masterGain);

    source.start(now);
    source.stop(now + duration);
  }

  // ─────────────────────────────────────────────
  // PUBLIC SOUND EFFECTS
  // ─────────────────────────────────────────────

  /**
   * Eat food — short ascending tone
   */
  function LAS_sfxEat() {
    LAS_playTone('square', 300, 600, 0.12, 0.25);
  }

  /**
   * Eat power-up — rapid ascending arpeggio
   */
  function LAS_sfxPowerup() {
    const notes = [400, 500, 700, 1000];
    notes.forEach((freq, i) => {
      setTimeout(() => {
        LAS_playTone('sawtooth', freq, freq * 1.2, 0.08, 0.2);
      }, i * 55);
    });
  }

  /**
   * Death — descending white noise burst
   */
  function LAS_sfxDeath() {
    LAS_playNoise(0.8, 1800);
    setTimeout(() => LAS_playTone('sawtooth', 250, 60, 0.4, 0.2), 100);
  }

  /**
   * Combo milestone — punchy accent
   */
  function LAS_sfxCombo(multiplier) {
    const base = 200 + multiplier * 80;
    LAS_playTone('square', base, base * 1.5, 0.15, 0.3);
    setTimeout(() => LAS_playTone('square', base * 1.5, base * 2, 0.1, 0.2), 100);
  }

  /**
   * Menu navigation click
   */
  function LAS_sfxClick() {
    LAS_playTone('square', 440, 480, 0.06, 0.15);
  }

  /**
   * Game start jingle
   */
  function LAS_sfxStart() {
    const melody = [262, 330, 392, 523];
    melody.forEach((freq, i) => {
      setTimeout(() => LAS_playTone('square', freq, freq, 0.1, 0.25), i * 80);
    });
  }

  /**
   * Toggle mute state
   */
  function LAS_toggleMute() {
    LAS_muted = !LAS_muted;
    if (LAS_masterGain) {
      LAS_masterGain.gain.setValueAtTime(
        LAS_muted ? 0 : 0.4,
        LAS_audioCtx.currentTime
      );
    }
    return LAS_muted;
  }

  function LAS_isMuted() {
    return LAS_muted;
  }

  return {
    init: LAS_initAudio,
    sfxEat: LAS_sfxEat,
    sfxPowerup: LAS_sfxPowerup,
    sfxDeath: LAS_sfxDeath,
    sfxCombo: LAS_sfxCombo,
    sfxClick: LAS_sfxClick,
    sfxStart: LAS_sfxStart,
    toggleMute: LAS_toggleMute,
    isMuted: LAS_isMuted
  };
})();
