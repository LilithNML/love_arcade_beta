/**
 * ark.audio.js — Ollin Smash · Love Arcade  v2.0.0
 * Module E: Procedural audio via Web Audio API.
 *
 * Design goals:
 *  - Zero <audio> elements — target <50ms latency
 *  - FM-layered synthesis for juicy, physical sounds
 *  - Pentatonic arpeggios that always sound musical
 *
 * Public API:
 *   ARK_Audio.init()
 *   ARK_Audio.play(event)
 *     events: 'paddle_hit' | 'brick_hit' | 'powerup_collect' | 'game_over'
 *   ARK_Audio.setMuted(bool)
 *   ARK_Audio.isMuted()
 */

'use strict';

let _ctx   = null;
let _muted = false;

// ─────────────────────────────────────────────────────────────────
// § CONTEXT — lazy, auto-resume on suspend
// ─────────────────────────────────────────────────────────────────
function _getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[ARK Audio] Web Audio unavailable:', e);
      return null;
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ─────────────────────────────────────────────────────────────────
// § UTILITY
// ─────────────────────────────────────────────────────────────────
function _masterGain(ac, vol = 0.38) {
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.connect(ac.destination);
  return g;
}

/** Fast linear attack / exponential decay envelope on a GainNode */
function _adEnv(gainNode, ac, { attack = 0.004, decay = 0.14, peakVol = 1.0 } = {}) {
  const t = ac.currentTime;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(peakVol, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Create one-shot noise buffer */
function _noiseBuffer(ac, durationSec = 0.1) {
  const len    = Math.floor(ac.sampleRate * durationSec);
  const buf    = ac.createBuffer(1, len, ac.sampleRate);
  const data   = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// ─────────────────────────────────────────────────────────────────
// § SYNTHESISERS
// ─────────────────────────────────────────────────────────────────

/**
 * paddle_hit — Triangle wave with pitch-slide UP (snappy, satisfying).
 * Layered with a very short noise transient for physical feel.
 */
function _playPaddleHit(ac) {
  const master = _masterGain(ac, 0.40);
  const t      = ac.currentTime;

  // ── Tonal layer: triangle 180 → 380 Hz (pitch slides up) ──
  const osc  = ac.createOscillator();
  const oEnv = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(380, t + 0.06);
  _adEnv(oEnv, ac, { attack: 0.003, decay: 0.11, peakVol: 0.9 });
  osc.connect(oEnv); oEnv.connect(master);
  osc.start(t); osc.stop(t + 0.18);

  // ── Noise transient (very brief click) ──────────────────────
  const noise  = ac.createBufferSource();
  noise.buffer = _noiseBuffer(ac, 0.025);
  const nFilt  = ac.createBiquadFilter();
  nFilt.type   = 'bandpass'; nFilt.frequency.value = 2200; nFilt.Q.value = 1.4;
  const nEnv   = ac.createGain();
  _adEnv(nEnv, ac, { attack: 0.001, decay: 0.02, peakVol: 0.25 });
  noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(master);
  noise.start(t); noise.stop(t + 0.03);
}

/**
 * brick_hit — White noise burst (fast 0.05s decay) + brief sine "pop"
 * Simulates physical destruction convincingly.
 */
function _playBrickHit(ac) {
  const master = _masterGain(ac, 0.30);
  const t      = ac.currentTime;

  // ── White noise burst (physical crunch) ─────────────────────
  const noise  = ac.createBufferSource();
  noise.buffer = _noiseBuffer(ac, 0.07);
  const filt   = ac.createBiquadFilter();
  filt.type    = 'lowpass';
  filt.frequency.setValueAtTime(5000, t);
  filt.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  const nEnv   = ac.createGain();
  _adEnv(nEnv, ac, { attack: 0.001, decay: 0.05, peakVol: 1.0 });
  noise.connect(filt); filt.connect(nEnv); nEnv.connect(master);
  noise.start(t); noise.stop(t + 0.10);

  // ── Sine pop for body ────────────────────────────────────────
  const osc  = ac.createOscillator();
  const oEnv = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);
  _adEnv(oEnv, ac, { attack: 0.001, decay: 0.06, peakVol: 0.5 });
  osc.connect(oEnv); oEnv.connect(master);
  osc.start(t); osc.stop(t + 0.09);
}

/**
 * powerup_collect — 3-note ascending arpeggio on the pentatonic major scale.
 * Notes always sound harmonious regardless of starting pitch.
 * Pentatonic C5: C5(523) – E5(659) – G5(784) – A5(880) – C6(1047)
 */
function _playPowerupCollect(ac) {
  const master = _masterGain(ac, 0.32);
  const t      = ac.currentTime;
  const penta  = [523.25, 659.25, 783.99]; // C5 – E5 – G5

  penta.forEach((freq, i) => {
    const delay = i * 0.085;
    // Main tone (triangle for warmth)
    const osc  = ac.createOscillator();
    const env  = ac.createGain();
    osc.type   = 'triangle';
    osc.frequency.setValueAtTime(freq, t + delay);
    env.gain.setValueAtTime(0,   t + delay);
    env.gain.linearRampToValueAtTime(0.85,  t + delay + 0.010);
    env.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.20);
    osc.connect(env); env.connect(master);
    osc.start(t + delay); osc.stop(t + delay + 0.24);

    // Shimmer overtone (sawtooth half-volume, octave up)
    const osc2  = ac.createOscillator();
    const env2  = ac.createGain();
    osc2.type   = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 2, t + delay);
    env2.gain.setValueAtTime(0,   t + delay);
    env2.gain.linearRampToValueAtTime(0.18,  t + delay + 0.008);
    env2.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.10);
    osc2.connect(env2); env2.connect(master);
    osc2.start(t + delay); osc2.stop(t + delay + 0.14);
  });
}

/**
 * game_over — Low sawtooth drone with closing low-pass filter (pitch drop),
 * plus a descending minor-third interval for emotional finality.
 */
function _playGameOver(ac) {
  const master = _masterGain(ac, 0.38);
  const t      = ac.currentTime;

  // ── Descending chord (minor 3rd) ────────────────────────────
  [220, 185].forEach((freq, i) => {
    const osc  = ac.createOscillator();
    const lp   = ac.createBiquadFilter();
    const env  = ac.createGain();
    osc.type   = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t + i * 0.04);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.35, t + 1.6);
    lp.type    = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(55, t + 1.3);
    lp.Q.value = 1.5;
    env.gain.setValueAtTime(0.7, t + i * 0.04);
    env.gain.linearRampToValueAtTime(0, t + 1.8);
    osc.connect(lp); lp.connect(env); env.connect(master);
    osc.start(t + i * 0.04); osc.stop(t + 2.0);
  });

  // ── Noise rumble underpinning ────────────────────────────────
  const noise  = ac.createBufferSource();
  noise.buffer = _noiseBuffer(ac, 0.6);
  const nFilt  = ac.createBiquadFilter();
  nFilt.type   = 'lowpass'; nFilt.frequency.value = 180;
  const nEnv   = ac.createGain();
  nEnv.gain.setValueAtTime(0.25, t);
  nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  noise.connect(nFilt); nFilt.connect(nEnv); nEnv.connect(master);
  noise.start(t); noise.stop(t + 0.65);
}

// ─────────────────────────────────────────────────────────────────
// § PUBLIC API
// ─────────────────────────────────────────────────────────────────
const _SOUNDS = {
  paddle_hit:      _playPaddleHit,
  brick_hit:       _playBrickHit,
  powerup_collect: _playPowerupCollect,
  game_over:       _playGameOver,
};

export function init() {
  _getCtx();
  console.log('[ARK Audio] v2.0 — Web Audio procedural synthesis ready');
}

export function play(event) {
  if (_muted) return;
  const ac = _getCtx();
  if (!ac) return;
  const fn = _SOUNDS[event];
  if (!fn) { console.warn('[ARK Audio] Unknown event:', event); return; }
  try {
    const t0 = performance.now();
    fn(ac);
    const ms = performance.now() - t0;
    if (ms > 50) console.warn(`[ARK Audio] ⚠ Latency ${ms.toFixed(1)}ms for "${event}"`);
  } catch (err) {
    console.error('[ARK Audio] Error:', err);
  }
}

export function setMuted(bool) { _muted = !!bool; }
export function isMuted()      { return _muted; }

export const ARK_Audio = { init, play, setMuted, isMuted };
