/**
 * lumina_audio.js — Motor de Audio Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 4 / 5: Web Audio API — síntesis procedural.
 * No usa archivos .mp3 estáticos.
 * Escala pentatónica para garantizar armonía en todos los tonos.
 * Reverb espacial sintético en la pantalla de victoria.
 *
 * CHANGELOG v1.3 — Optimización de Energía
 * ─────────────────────────────────────────
 * [PERF] Gestión de energía del AudioContext: lumina_audioCtx se suspende
 *        automáticamente tras 30 segundos de inactividad total (sin movimientos
 *        ni interacciones). Esto libera los ciclos de CPU que la Web Audio API
 *        consume incluso en estado silencioso.
 *        · lumina_scheduleAudioSuspend(): reinicia el temporizador en cada
 *          sonido reproducido o interacción detectada.
 *        · lumina_suspendAudio(): suspende el contexto de forma inmediata.
 *          Llamado también desde lumina_render.js al ocultarse la pestaña
 *          (Page Visibility API).
 *        · lumina_resumeAudio(): ya existía; ahora también cancela el timer
 *          de suspensión al reanudarse.
 * [PERF] lumina_resumeAudio() ahora cancela el timer de inactividad al ser
 *        llamado desde lumina_input.js en cada touchstart, garantizando que el
 *        AudioContext no se suspenda mientras el jugador está activo.
 *
 * CHANGELOG v1.2
 * ──────────────
 * [NEW]  lumina_playCoinTinkle(progress): tintineo metálico acelerado para la
 *        animación del contador de monedas en el modal de fin de partida.
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Audio Latency en Android: AudioContext reanudado en touchstart.
 * [NEW]  lumina_resumeAudio(): función pública para reanudar desde otros módulos.
 */

'use strict';

let lumina_audioCtx     = null;
let lumina_audioEnabled = true;

/** Timer ID del temporizador de suspensión por inactividad (v1.3). */
let lumina_audioSuspendTimer = null;

/** Tiempo de inactividad antes de suspender el AudioContext (ms). */
const lumina_AUDIO_IDLE_TIMEOUT = 30_000; // 30 segundos

// Escala pentatónica mayor en Hz (C4 → A5 → C6 D6)
const lumina_PENTA = [
    261.63, 293.66, 329.63, 392.00, 440.00,
    523.25, 587.33, 659.25, 783.99, 880.00,
    1046.50, 1174.66,
];

// ─── Inicialización ───────────────────────────────────────────────────────────

function lumina_initAudio() {
    const createOrResume = () => {
        if (!lumina_audioCtx) {
            try {
                lumina_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('[LUMINA] Web Audio API no disponible:', e);
                lumina_audioEnabled = false;
            }
        } else if (lumina_audioCtx.state === 'suspended') {
            lumina_audioCtx.resume().catch(() => {});
        }
        // v1.3: Cancelar timer de inactividad al interactuar
        lumina_cancelSuspendTimer();
    };

    // CORRECCIÓN v1.1: touchstart para Android (menor latencia que touchend).
    document.addEventListener('keydown',     createOrResume, { once: true });
    document.addEventListener('touchstart',  createOrResume, { once: true });
    document.addEventListener('pointerdown', createOrResume, { once: true });

    console.log('[LUMINA] Audio module v1.3 loaded (esperando interacción del usuario).');
}

// ─── Gestión de Energía (v1.3) ────────────────────────────────────────────────

/**
 * Programa la suspensión del AudioContext tras lumina_AUDIO_IDLE_TIMEOUT ms
 * de inactividad. Llamar al final de cada función que produce audio.
 * Si ya había un timer pendiente, lo reinicia.
 */
function lumina_scheduleAudioSuspend() {
    lumina_cancelSuspendTimer();
    lumina_audioSuspendTimer = setTimeout(() => {
        lumina_suspendAudio();
        console.log('[LUMINA] 💤 AudioContext suspendido por inactividad (30 s).');
    }, lumina_AUDIO_IDLE_TIMEOUT);
}

/** Cancela el timer de suspensión sin suspender el contexto. */
function lumina_cancelSuspendTimer() {
    if (lumina_audioSuspendTimer !== null) {
        clearTimeout(lumina_audioSuspendTimer);
        lumina_audioSuspendTimer = null;
    }
}

/**
 * Suspende el AudioContext de forma inmediata.
 * Llamado por:
 *   · El timer de inactividad (30 s sin sonidos).
 *   · lumina_render.js → lumina_onVisibilityChange() al ocultar la pestaña.
 */
function lumina_suspendAudio() {
    lumina_cancelSuspendTimer();
    if (lumina_audioCtx && lumina_audioCtx.state === 'running') {
        lumina_audioCtx.suspend().catch(() => {});
    }
}

/**
 * Reanuda el AudioContext si está suspendido.
 * Llamado desde lumina_input.js en cada touchstart y desde
 * lumina_render.js al volver a la pestaña.
 * v1.3: También cancela el timer de inactividad para no suspender mientras
 *       el jugador está activo.
 */
function lumina_resumeAudio() {
    lumina_cancelSuspendTimer(); // v1.3: reiniciar reloj de inactividad
    if (lumina_audioCtx && lumina_audioCtx.state === 'suspended') {
        lumina_audioCtx.resume().catch(() => {});
    }
}

function lumina_audioReady() {
    return lumina_audioEnabled && lumina_audioCtx && lumina_audioCtx.state !== 'closed';
}

// ─── Utilidades: nodos rápidos ────────────────────────────────────────────────

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

        lumina_scheduleAudioSuspend(); // v1.3
    } catch (_) {}
}

// ─── Sonido de Fusión ─────────────────────────────────────────────────────────

function lumina_playMergeSound(value) {
    if (!lumina_audioReady()) return;
    try {
        const now   = lumina_audioCtx.currentTime;
        const level = Math.max(0, Math.log2(value) - 1);
        const idx   = level % lumina_PENTA.length;
        const oct   = Math.floor(level / lumina_PENTA.length) + 1;
        const freq  = lumina_PENTA[idx] * oct;

        const subGain = lumina_audioCtx.createGain();
        subGain.gain.setValueAtTime(0.14, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        subGain.connect(lumina_audioCtx.destination);
        const subOsc = lumina_makeOsc('sine', freq * 0.5, subGain);
        subOsc.start(now); subOsc.stop(now + 0.4);

        const bellGain = lumina_audioCtx.createGain();
        bellGain.gain.setValueAtTime(0.10, now);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        bellGain.connect(lumina_audioCtx.destination);
        const bellOsc = lumina_makeOsc('sine', freq, bellGain);
        bellOsc.start(now); bellOsc.stop(now + 1.0);

        if (value >= 256) {
            const shimGain = lumina_audioCtx.createGain();
            shimGain.gain.setValueAtTime(0.05, now);
            shimGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
            shimGain.connect(lumina_audioCtx.destination);
            const shimOsc = lumina_makeOsc('sine', freq * 1.5, shimGain);
            shimOsc.start(now); shimOsc.stop(now + 0.75);
        }

        lumina_scheduleAudioSuspend(); // v1.3
    } catch (_) {}
}

// ─── Sonido de Combo ──────────────────────────────────────────────────────────

function lumina_playComboSound() {
    if (!lumina_audioReady()) return;
    try {
        [0, 2, 4, 7].forEach((step, i) => {
            const t = lumina_audioCtx.currentTime + i * 0.075;
            const g = lumina_audioCtx.createGain();
            g.gain.setValueAtTime(0.09, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
            g.connect(lumina_audioCtx.destination);
            const o = lumina_makeOsc('sine', lumina_PENTA[step % lumina_PENTA.length], g);
            o.start(t); o.stop(t + 0.25);
        });
        lumina_scheduleAudioSuspend(); // v1.3
    } catch (_) {}
}

// ─── Sonido de Victoria ───────────────────────────────────────────────────────

function lumina_playWinSound() {
    if (!lumina_audioReady()) return;
    try {
        const convolver  = lumina_audioCtx.createConvolver();
        const sampleRate = lumina_audioCtx.sampleRate;
        const impLen     = sampleRate * 2.5;
        const impulse    = lumina_audioCtx.createBuffer(2, impLen, sampleRate);
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

        // v1.3: Programar suspensión después de que termine el reverb (~2.5 s)
        lumina_scheduleAudioSuspend();
    } catch (_) {}
}

// ─── Sonido de Tintineo de Monedas ────────────────────────────────────────────

/**
 * Tintineo metálico breve para la animación del contador de monedas.
 * Frecuencia y volumen escalan con progress (0→1).
 *
 * @param {number} progress - Fracción de avance de la animación (0.0 → 1.0)
 */
function lumina_playCoinTinkle(progress) {
    if (!lumina_audioReady()) return;
    try {
        const now      = lumina_audioCtx.currentTime;
        const baseFreq = 880 + progress * 1320;
        const gainVal  = 0.04 + progress * 0.05;
        const duration = 0.06 - progress * 0.03;

        const gain = lumina_audioCtx.createGain();
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        gain.connect(lumina_audioCtx.destination);

        const osc = lumina_audioCtx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + duration * 0.3);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + duration + 0.01);

        if (progress > 0.5) {
            const shimGain = lumina_audioCtx.createGain();
            shimGain.gain.setValueAtTime(gainVal * 0.4, now);
            shimGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            shimGain.connect(lumina_audioCtx.destination);
            const shimOsc = lumina_audioCtx.createOscillator();
            shimOsc.type = 'sine';
            shimOsc.frequency.value = baseFreq * 1.5;
            shimOsc.connect(shimGain);
            shimOsc.start(now);
            shimOsc.stop(now + duration + 0.01);
        }

        // v1.3: reiniciar timer de inactividad (el tintineo es actividad)
        lumina_scheduleAudioSuspend();
    } catch (_) {}
}

console.log('[LUMINA] Audio module v1.3 loaded (energy management enabled).');
