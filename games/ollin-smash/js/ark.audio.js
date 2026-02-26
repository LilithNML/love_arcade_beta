/**
 * ark.audio.js — Ollin Smash · Love Arcade
 * Module E: Procedural audio via Web Audio API.
 *
 * No <audio> elements — zero latency (<50ms target).
 * All sounds are synthesised on-the-fly.
 *
 * Public API:
 *   ARK_Audio.init()
 *   ARK_Audio.play(event)   — 'paddle_hit' | 'brick_hit' | 'powerup_collect' | 'game_over'
 *   ARK_Audio.setMuted(bool)
 *   ARK_Audio.isMuted()
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// § CONTEXT (lazy — must be created after a user gesture)
// ─────────────────────────────────────────────────────────────────
let _ctx   = null;
let _muted = false;

function _getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[ARK Audio] Web Audio API unavailable:', e);
      return null;
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ─────────────────────────────────────────────────────────────────
// § HELPERS
// ─────────────────────────────────────────────────────────────────
function _masterGain(ac, volume = 0.4) {
  const g = ac.createGain();
  g.gain.setValueAtTime(volume, ac.currentTime);
  g.connect(ac.destination);
  return g;
}

function _envelope(gainNode, ac, attack = 0.004, decay = 0.12, sustain = 0, release = 0.08) {
  const t = ac.currentTime;
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(1, t + attack);
  gainNode.gain.linearRampToValueAtTime(sustain, t + attack + decay);
  if (sustain > 0) gainNode.gain.linearRampToValueAtTime(0, t + attack + decay + release);
}

// ─────────────────────────────────────────────────────────────────
// § SYNTHESISERS
// ─────────────────────────────────────────────────────────────────

/** paddle_hit — Sinusoidal pluck: 440 Hz → 200 Hz */
function _playPaddleHit(ac) {
  const master = _masterGain(ac, 0.35);
  const osc    = ac.createOscillator();
  const env    = ac.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.1);

  _envelope(env, ac, 0.003, 0.09, 0, 0.04);
  osc.connect(env);
  env.connect(master);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.22);
}

/** brick_hit — Filtered white-noise burst (explosion corta) */
function _playBrickHit(ac) {
  const master     = _masterGain(ac, 0.28);
  const bufferSize = Math.floor(ac.sampleRate * 0.1);
  const buffer     = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data       = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise  = ac.createBufferSource();
  noise.buffer = buffer;

  const filter        = ac.createBiquadFilter();
  filter.type         = 'lowpass';
  filter.frequency.setValueAtTime(4000, ac.currentTime);
  filter.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.08);

  const env = ac.createGain();
  _envelope(env, ac, 0.002, 0.08, 0, 0.03);

  noise.connect(filter);
  filter.connect(env);
  env.connect(master);
  noise.start(ac.currentTime);
  noise.stop(ac.currentTime + 0.13);
}

/** powerup_collect — Arpegio ascendente de 3 notas */
function _playPowerupCollect(ac) {
  const master = _masterGain(ac, 0.30);
  const freqs  = [523.25, 659.25, 783.99]; // C5 – E5 – G5
  freqs.forEach((freq, i) => {
    const osc = ac.createOscillator();
    const env = ac.createGain();
    const t   = ac.currentTime + i * 0.09;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.01);
    env.gain.linearRampToValueAtTime(0, t + 0.14);

    osc.connect(env);
    env.connect(master);
    osc.start(t);
    osc.stop(t + 0.18);
  });
}

/**
 * game_over — Filtro low-pass se cierra + caída de tono (pitch drop).
 * Crea una nota grave que decae mientras un filtro se va cerrando.
 */
function _playGameOver(ac) {
  const master = _masterGain(ac, 0.4);

  // Deep drone
  const osc    = ac.createOscillator();
  osc.type     = 'sawtooth';
  osc.frequency.setValueAtTime(110, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 1.4);

  // Closing low-pass filter
  const lp      = ac.createBiquadFilter();
  lp.type       = 'lowpass';
  lp.frequency.setValueAtTime(1200, ac.currentTime);
  lp.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 1.2);

  const env = ac.createGain();
  env.gain.setValueAtTime(0.9, ac.currentTime);
  env.gain.linearRampToValueAtTime(0, ac.currentTime + 1.6);

  osc.connect(lp);
  lp.connect(env);
  env.connect(master);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 1.7);
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

/**
 * Initialise the audio context (call once after a user gesture).
 * Calling play() will also lazy-init if needed.
 */
function init() {
  _getCtx();
  console.log('[ARK Audio] Initialised — Web Audio API');
}

/**
 * Play a named sound event.
 * @param {'paddle_hit'|'brick_hit'|'powerup_collect'|'game_over'} event
 */
function play(event) {
  if (_muted) return;
  const ac = _getCtx();
  if (!ac) return;
  const fn = _SOUNDS[event];
  if (!fn) { console.warn('[ARK Audio] Unknown event:', event); return; }
  try {
    const t0 = performance.now();
    fn(ac);
    const latency = performance.now() - t0;
    if (latency > 50) console.warn(`[ARK Audio] Latency warning: ${latency.toFixed(1)}ms for "${event}"`);
  } catch (err) {
    console.error('[ARK Audio] Play error:', err);
  }
}

/** Toggle mute */
function setMuted(bool) { _muted = !!bool; }
function isMuted()      { return _muted; }

export const ARK_Audio = { init, play, setMuted, isMuted };
