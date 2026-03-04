/**
 * lumina_audio.js — Motor de Audio Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 4 / 5: Web Audio API — síntesis procedural.
 * No usa archivos .mp3 estáticos.
 * Escala pentatónica para garantizar armonía en todos los tonos.
 * Reverb espacial sintético en la pantalla de victoria.
 */

'use strict';

let lumina_audioCtx     = null;
let lumina_audioEnabled = true;

// Escala pentatónica mayor en Hz (C4 → A5), siempre armónica
const lumina_PENTA = [
    261.63, 293.66, 329.63, 392.00, 440.00,  // C4 D4 E4 G4 A4
    523.25, 587.33, 659.25, 783.99, 880.00,  // C5 D5 E5 G5 A5
    1046.50, 1174.66,                         // C6 D6
];

// ─── Inicialización ───────────────────────────────────────────────────────────

function lumina_initAudio() {
    // Web Audio solo puede iniciarse tras un gesto del usuario (política del navegador)
    const resume = () => {
        if (!lumina_audioCtx) {
            try {
                lumina_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('[LUMINA] Web Audio API no disponible:', e);
                lumina_audioEnabled = false;
            }
        } else if (lumina_audioCtx.state === 'suspended') {
            lumina_audioCtx.resume();
        }
    };
    document.addEventListener('keydown',  resume, { once: true });
    document.addEventListener('touchend', resume, { once: true });
    document.addEventListener('pointerdown', resume, { once: true });
    console.log('[LUMINA] Audio module v1.0 loaded (esperando interacción del usuario).');
}

function lumina_audioReady() {
    return lumina_audioEnabled && lumina_audioCtx && lumina_audioCtx.state !== 'closed';
}

// ─── Utilidad: nodos rápidos ──────────────────────────────────────────────────

function lumina_makeGain(value) {
    const g = lumina_audioCtx.createGain();
    g.gain.value = value;
    g.connect(lumina_audioCtx.destination);
    return g;
}

function lumina_makeOsc(type, freq, destination) {
    const o = lumina_audioCtx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(destination);
    return o;
}

// ─── Sonido de Desplazamiento ─────────────────────────────────────────────────

/** Clic seco y breve: frecuencia alta, duración muy corta. */
function lumina_playMoveSound() {
    if (!lumina_audioReady()) return;
    try {
        const now  = lumina_audioCtx.currentTime;
        const gain = lumina_audioCtx.createGain();
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        gain.connect(lumina_audioCtx.destination);

        const osc = lumina_makeOsc('square', 900, gain);
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.07);
    } catch (_) {}
}

// ─── Sonido de Fusión ─────────────────────────────────────────────────────────

/**
 * Tono expansivo: sub-bass + campana en escala pentatónica.
 * Cuanto mayor el valor de la ficha, más alto y brillante el tono.
 * @param {number} value - Valor de la ficha resultante de la fusión
 */
function lumina_playMergeSound(value) {
    if (!lumina_audioReady()) return;
    try {
        const now   = lumina_audioCtx.currentTime;
        const level = Math.max(0, Math.log2(value) - 1);      // 2→0, 4→1, 8→2 …
        const idx   = level % lumina_PENTA.length;
        const oct   = Math.floor(level / lumina_PENTA.length) + 1;
        const freq  = lumina_PENTA[idx] * oct;

        // Sub-bass hit
        const subGain = lumina_audioCtx.createGain();
        subGain.gain.setValueAtTime(0.14, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        subGain.connect(lumina_audioCtx.destination);
        const subOsc = lumina_makeOsc('sine', freq * 0.5, subGain);
        subOsc.start(now); subOsc.stop(now + 0.4);

        // Campana (bell)
        const bellGain = lumina_audioCtx.createGain();
        bellGain.gain.setValueAtTime(0.10, now);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        bellGain.connect(lumina_audioCtx.destination);
        const bellOsc = lumina_makeOsc('sine', freq, bellGain);
        bellOsc.start(now); bellOsc.stop(now + 1.0);

        // Shimmer (quinta justa encima para los valores altos)
        if (value >= 256) {
            const shimGain = lumina_audioCtx.createGain();
            shimGain.gain.setValueAtTime(0.05, now);
            shimGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            shimGain.connect(lumina_audioCtx.destination);
            const shimOsc = lumina_makeOsc('sine', freq * 1.5, shimGain);
            shimOsc.start(now); shimOsc.stop(now + 0.75);
        }
    } catch (_) {}
}

// ─── Sonido de Combo ──────────────────────────────────────────────────────────

function lumina_playComboSound() {
    if (!lumina_audioReady()) return;
    try {
        // Arpeggio ascendente de 4 notas pentatónicas
        [0, 2, 4, 7].forEach((step, i) => {
            const t = lumina_audioCtx.currentTime + i * 0.075;
            const g = lumina_audioCtx.createGain();
            g.gain.setValueAtTime(0.09, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            g.connect(lumina_audioCtx.destination);
            const o = lumina_makeOsc('sine', lumina_PENTA[step % lumina_PENTA.length], g);
            o.start(t); o.stop(t + 0.25);
        });
    } catch (_) {}
}

// ─── Sonido de Victoria ───────────────────────────────────────────────────────

/**
 * Arpeggio triunfal con reverb espacial generado por convolución sintética.
 * El reverb es un impulso de ruido decreciente (~3 s).
 */
function lumina_playWinSound() {
    if (!lumina_audioReady()) return;
    try {
        // Crear impulso de reverb
        const convolver = lumina_audioCtx.createConvolver();
        const sampleRate = lumina_audioCtx.sampleRate;
        const impLen = sampleRate * 2.5;
        const impulse = lumina_audioCtx.createBuffer(2, impLen, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < impLen; i++)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impLen, 2.5);
        }
        convolver.buffer = impulse;

        const masterGain = lumina_audioCtx.createGain();
        masterGain.gain.value = 0.25;
        convolver.connect(masterGain);
        masterGain.connect(lumina_audioCtx.destination);

        // Arpeggio (5 notas)
        const notes = [0, 2, 4, 7, 9];
        notes.forEach((step, i) => {
            const t = lumina_audioCtx.currentTime + i * 0.18;
            const locGain = lumina_audioCtx.createGain();
            locGain.gain.setValueAtTime(0.18, t);
            locGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
            locGain.connect(convolver);

            const freq = lumina_PENTA[step % lumina_PENTA.length] * 2;
            const o = lumina_makeOsc('sine', freq, locGain);
            o.start(t); o.stop(t + 2.0);
        });
    } catch (_) {}
}

console.log('[LUMINA] Audio module v1.0 loaded.');
