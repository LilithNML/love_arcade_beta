/**
 * audio/audio-engine.js — Ollin Smash v2.0
 *
 * Synthesizes all game audio in real time via the Web Audio API.
 * No external audio files are loaded; every sound is generated procedurally.
 *
 * Design notes:
 *  - AudioContext is lazy-initialized on first user gesture (browser policy).
 *  - initAudio() must be called from a button click / touch handler before
 *    any sfx will produce sound.
 *  - All tone() calls are fire-and-forget; they schedule their own stop.
 *  - The sfx object is a named catalogue of game-specific sound compositions.
 */

/** @type {AudioContext|null} */
let actx = null;

/**
 * Return (or lazily create) the shared AudioContext.
 * Returns null if the API is unavailable.
 *
 * @returns {AudioContext|null}
 */
function getCtx() {
  if (!actx) {
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      return null;
    }
  }
  return actx;
}

/**
 * Initialise (or resume) the AudioContext.
 * Must be called from a user-interaction handler (click/touch).
 * Safe to call multiple times.
 */
export function initAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Schedule a single synthesized tone.
 *
 * @param {number} freq   - Fundamental frequency in Hz
 * @param {OscillatorType} type - 'sine' | 'triangle' | 'sawtooth' | 'square'
 * @param {number} dur    - Duration in seconds
 * @param {number} [gain=0.25] - Peak gain amplitude (0–1)
 * @param {number} [detune=0]  - Detuning in cents
 */
export function tone(freq, type, dur, gain = 0.25, detune = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.connect(env);
  env.connect(ctx.destination);

  osc.type            = type;
  osc.frequency.value = freq;
  osc.detune.value    = detune;

  env.gain.setValueAtTime(gain, ctx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  osc.start();
  osc.stop(ctx.currentTime + dur);
}

/**
 * Named SFX catalogue.
 * Each entry is a zero-argument function that fires the appropriate tones.
 *
 *  bounce  — metallic "clink" on paddle/wall contact
 *  brick   — ceramic fracture with random pitch variation (±100 cents)
 *  powerup — ascending glissando synth sweep
 *  combo   — pitched confirmation tone scaled to multiplier level
 *  lose    — minor descending triad with tail
 */
export const sfx = {

  bounce() {
    tone(750 + Math.random() * 250, 'triangle', 0.06, 0.18);
  },

  brick() {
    const detune = (Math.random() - 0.5) * 200;
    tone(320, 'sawtooth', 0.10, 0.14, detune);
    tone(640, 'triangle', 0.07, 0.09, detune);
  },

  powerup() {
    [400, 600, 850, 1050].forEach((f, i) =>
      setTimeout(() => tone(f, 'sine', 0.10, 0.18), i * 55)
    );
  },

  /**
   * @param {number} mult - Multiplier value (2 | 4 | 8)
   */
  combo(mult) {
    const freq = { 2: 880, 4: 1100, 8: 1350 }[mult];
    if (freq) tone(freq, 'sine', 0.18, 0.22);
  },

  lose() {
    [220, 196, 165].forEach((f, i) =>
      setTimeout(() => {
        tone(f,       'sawtooth', 1.5, 0.20);
        tone(f * 1.5, 'sawtooth', 1.5, 0.08);
      }, i * 180)
    );
  },
};
