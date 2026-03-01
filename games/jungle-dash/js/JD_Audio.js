/**
 * JD_Audio.js — Jungle Dash | Módulo de Audio
 * Usa Web Audio API. El BGM se inicia sólo tras la primera interacción del usuario.
 * Primero intenta cargar JD_bgm_jungle.mp3; si falla, genera audio procedural.
 *
 * v1.3.0 — Añadidos SFX: playCoin() y playSuperCoin() con pitch diferencial
 *           para reforzar el feedback positivo de la economía de recompensas.
 */

const JD_Audio = (() => {

    // ── Estado privado ──────────────────────────────────────────────────────
    let JD_audioCtx       = null;
    let JD_bgmSource      = null;
    let JD_bgmBuffer      = null;
    let JD_gainNode       = null;
    let JD_muted          = false;
    let JD_bgmLoaded      = false;
    let JD_bgmInterval    = null;   // Para BGM procedural
    let JD_usingProcedural = false;

    // ── Inicialización del contexto (lazy, tras interacción) ────────────────
    function JD_initCtx() {
        if (JD_audioCtx) return;
        try {
            JD_audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            JD_gainNode = JD_audioCtx.createGain();
            JD_gainNode.gain.value = JD_muted ? 0 : 0.5;
            JD_gainNode.connect(JD_audioCtx.destination);
            console.log('[JD] AudioContext inicializado.');
        } catch (e) {
            console.warn('[JD] Web Audio API no disponible:', e.message);
        }
    }

    // ── Carga del BGM desde archivo ─────────────────────────────────────────
    async function JD_loadBGM() {
        if (!JD_audioCtx) return;
        const JD_timeout = 5000; // 5s para cargar el asset
        const JD_paths   = ['./assets/audio/JD_bgm_jungle.mp3', './assets/audio/JD_bgm_jungle.ogg'];
        let JD_loaded    = false;

        for (const JD_path of JD_paths) {
            try {
                const JD_controller = new AbortController();
                const JD_timer      = setTimeout(() => JD_controller.abort(), JD_timeout);
                const JD_resp       = await fetch(JD_path, { signal: JD_controller.signal });
                clearTimeout(JD_timer);

                if (!JD_resp.ok) continue;
                const JD_arrayBuf = await JD_resp.arrayBuffer();
                JD_bgmBuffer = await JD_audioCtx.decodeAudioData(JD_arrayBuf);
                JD_bgmLoaded = true;
                JD_loaded    = true;
                console.log('[JD] BGM cargado desde', JD_path);
                break;
            } catch (_) { /* probar el siguiente */ }
        }

        if (!JD_loaded) {
            console.warn('[JD] Assets de audio no encontrados — usando BGM procedural.');
            JD_usingProcedural = true;
        }
    }

    // ── Tono procedural (loop de selva sintético) ──────────────────────────
    function JD_playProceduralBGM() {
        if (!JD_audioCtx || JD_bgmInterval) return;

        const JD_notes = [130.81, 164.81, 196.00, 220.00, 246.94, 196.00, 164.81, 130.81];
        let JD_noteIdx = 0;

        function JD_playNote() {
            if (!JD_audioCtx || JD_muted) return;

            // Nota melódica suave (flauta/selva)
            const JD_osc  = JD_audioCtx.createOscillator();
            const JD_gain = JD_audioCtx.createGain();

            JD_osc.type            = 'sine';
            JD_osc.frequency.value = JD_notes[JD_noteIdx % JD_notes.length];

            JD_gain.gain.setValueAtTime(0, JD_audioCtx.currentTime);
            JD_gain.gain.linearRampToValueAtTime(0.12, JD_audioCtx.currentTime + 0.08);
            JD_gain.gain.exponentialRampToValueAtTime(0.001, JD_audioCtx.currentTime + 0.5);

            JD_osc.connect(JD_gain);
            JD_gain.connect(JD_gainNode);

            JD_osc.start();
            JD_osc.stop(JD_audioCtx.currentTime + 0.55);

            // Ruido de ambiente (viento/selva)
            if (JD_noteIdx % 4 === 0) {
                JD_playAmbience();
            }

            JD_noteIdx++;
        }

        JD_bgmInterval = setInterval(JD_playNote, 520);
        JD_playNote();
    }

    function JD_playAmbience() {
        if (!JD_audioCtx) return;
        const JD_bufSize = JD_audioCtx.sampleRate * 0.3;
        const JD_buf     = JD_audioCtx.createBuffer(1, JD_bufSize, JD_audioCtx.sampleRate);
        const JD_data    = JD_buf.getChannelData(0);
        for (let i = 0; i < JD_bufSize; i++) JD_data[i] = (Math.random() * 2 - 1) * 0.04;

        const JD_src    = JD_audioCtx.createBufferSource();
        const JD_filter = JD_audioCtx.createBiquadFilter();
        const JD_gain   = JD_audioCtx.createGain();

        JD_filter.type            = 'bandpass';
        JD_filter.frequency.value = 800;
        JD_filter.Q.value         = 0.5;
        JD_gain.gain.value        = 0.08;

        JD_src.buffer = JD_buf;
        JD_src.connect(JD_filter);
        JD_filter.connect(JD_gain);
        JD_gain.connect(JD_gainNode);
        JD_src.start();
    }

    // ── Helper interno: genera un SFX de moneda con pitch configurable ──────
    // @param {number} freqStart  - frecuencia inicial del oscilador (Hz)
    // @param {number} freqEnd    - frecuencia final tras la rampa (Hz)
    // @param {number} gainPeak   - volumen pico
    // @param {number} duration   - duración total del SFX en segundos
    function JD_playCoinSFX(freqStart, freqEnd, gainPeak, duration) {
        if (!JD_audioCtx || JD_muted) return;

        const JD_osc  = JD_audioCtx.createOscillator();
        const JD_gain = JD_audioCtx.createGain();

        JD_osc.type = 'triangle';
        JD_osc.frequency.setValueAtTime(freqStart, JD_audioCtx.currentTime);
        JD_osc.frequency.exponentialRampToValueAtTime(freqEnd, JD_audioCtx.currentTime + duration * 0.5);

        JD_gain.gain.setValueAtTime(gainPeak, JD_audioCtx.currentTime);
        JD_gain.gain.exponentialRampToValueAtTime(0.001, JD_audioCtx.currentTime + duration);

        JD_osc.connect(JD_gain);
        JD_gain.connect(JD_gainNode);
        JD_osc.start();
        JD_osc.stop(JD_audioCtx.currentTime + duration);
    }

    // ── API pública ─────────────────────────────────────────────────────────
    return {

        init() {
            JD_initCtx();
            JD_loadBGM();
        },

        async playBGM() {
            JD_initCtx();
            if (!JD_audioCtx) return;

            // Reanudar contexto suspendido (política de autoplay)
            if (JD_audioCtx.state === 'suspended') {
                await JD_audioCtx.resume();
            }

            this.stopBGM();

            if (JD_bgmLoaded && JD_bgmBuffer) {
                JD_bgmSource              = JD_audioCtx.createBufferSource();
                JD_bgmSource.buffer       = JD_bgmBuffer;
                JD_bgmSource.loop         = true;
                JD_bgmSource.connect(JD_gainNode);
                JD_bgmSource.start();
            } else if (JD_usingProcedural) {
                JD_playProceduralBGM();
            } else {
                // Aún cargando — esperamos e intentamos después
                setTimeout(() => { this.playBGM(); }, 1000);
            }
        },

        stopBGM() {
            if (JD_bgmSource) {
                try { JD_bgmSource.stop(); } catch (_) {}
                JD_bgmSource = null;
            }
            if (JD_bgmInterval) {
                clearInterval(JD_bgmInterval);
                JD_bgmInterval = null;
            }
        },

        playJump() {
            if (!JD_audioCtx || JD_muted) return;
            const JD_osc  = JD_audioCtx.createOscillator();
            const JD_gain = JD_audioCtx.createGain();

            JD_osc.type = 'square';
            JD_osc.frequency.setValueAtTime(300, JD_audioCtx.currentTime);
            JD_osc.frequency.exponentialRampToValueAtTime(600, JD_audioCtx.currentTime + 0.1);

            JD_gain.gain.setValueAtTime(0.18, JD_audioCtx.currentTime);
            JD_gain.gain.exponentialRampToValueAtTime(0.001, JD_audioCtx.currentTime + 0.15);

            JD_osc.connect(JD_gain);
            JD_gain.connect(JD_gainNode);
            JD_osc.start();
            JD_osc.stop(JD_audioCtx.currentTime + 0.15);
        },

        playCollision() {
            if (!JD_audioCtx) return;
            // Ruido de impacto + tono descendente
            const JD_bufSize = JD_audioCtx.sampleRate * 0.3;
            const JD_buf     = JD_audioCtx.createBuffer(1, JD_bufSize, JD_audioCtx.sampleRate);
            const JD_data    = JD_buf.getChannelData(0);
            for (let i = 0; i < JD_bufSize; i++) JD_data[i] = (Math.random() * 2 - 1);

            const JD_src    = JD_audioCtx.createBufferSource();
            const JD_gain   = JD_audioCtx.createGain();
            const JD_filter = JD_audioCtx.createBiquadFilter();

            JD_filter.type            = 'lowpass';
            JD_filter.frequency.value = 400;
            JD_gain.gain.setValueAtTime(0.5, JD_audioCtx.currentTime);
            JD_gain.gain.exponentialRampToValueAtTime(0.001, JD_audioCtx.currentTime + 0.3);

            JD_src.buffer = JD_buf;
            JD_src.connect(JD_filter);
            JD_filter.connect(JD_gain);
            JD_gain.connect(JD_gainNode);
            JD_src.start();
        },

        // ── SFX: Moneda normal ─────────────────────────────────────────────
        // Tono ascendente corto (triangle 520 Hz → 880 Hz, 0.18s).
        playCoin() {
            JD_playCoinSFX(520, 880, 0.15, 0.18);
        },

        // ── SFX: Super Moneda ──────────────────────────────────────────────
        // Pitch más agudo y duración más larga que la moneda normal para
        // reforzar positivamente la recogida del ítem de mayor valor.
        // Tono: 900 Hz → 1600 Hz con una segunda nota de remate a 2000 Hz.
        playSuperCoin() {
            if (!JD_audioCtx || JD_muted) return;

            // Primera nota (ascenso rápido)
            JD_playCoinSFX(900, 1600, 0.20, 0.14);

            // Segunda nota de remate (trino agudo, ligeramente retardada)
            setTimeout(() => {
                JD_playCoinSFX(1600, 2000, 0.18, 0.18);
            }, 100);
        },

        toggleMute() {
            JD_muted = !JD_muted;
            if (JD_gainNode) {
                JD_gainNode.gain.setTargetAtTime(JD_muted ? 0 : 0.5, JD_audioCtx.currentTime, 0.05);
            }
            localStorage.setItem('JD_muted', JD_muted ? '1' : '0');
            return JD_muted;
        },

        get isMuted() { return JD_muted; },

        loadSavedMute() {
            JD_muted = localStorage.getItem('JD_muted') === '1';
        }
    };
})();
