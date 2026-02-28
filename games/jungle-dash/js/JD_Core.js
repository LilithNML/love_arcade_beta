/**
 * JD_Core.js — Jungle Dash | Módulo Principal
 * Gestiona el Game Loop (requestAnimationFrame), los estados (START/PLAYING/GAMEOVER),
 * el input táctil y de teclado, y la integración con la API de Love Arcade.
 *
 * ⚠️ Todas las variables usan prefijo JD_ — regla de namespacing obligatoria.
 *
 * v1.1.0 — Añade soporte Fullscreen API + orientation lock en primera interacción.
 *           El botón de mute se gestiona desde #jd-mute-container (fuera del HUD).
 */

// ── Estados del juego ─────────────────────────────────────────────────────────
const JD_STATES = Object.freeze({ START: 'START', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER' });

// ── Estado global de partida ──────────────────────────────────────────────────
let JD_currentState  = JD_STATES.START;
let JD_score         = 0;
let JD_highScore     = parseInt(localStorage.getItem('JD_highscore') || '0', 10);
let JD_coinsEarned   = 0;
let JD_gameSpeed     = 4.0;   // px/frame virtuales (escala con el tiempo)
let JD_animFrameId   = null;
let JD_lastTimestamp = 0;
let JD_firstInteract = false; // Control de política de Autoplay de navegadores

// ── Namespace JD_Core (expuesto para acceso entre módulos) ────────────────────
const JD_Core = {

    get score()    { return JD_score;    },
    get state()    { return JD_currentState; },
    get highScore(){ return JD_highScore; },

    // ── Inicialización del sistema ────────────────────────────────────────────
    init() {
        JD_Audio.loadSavedMute();

        JD_Renderer.init();
        JD_Physics.init();
        JD_Entities.init(JD_Renderer.VIRT_W, JD_Renderer.GROUND_Y);

        JD_Core._setupInput();
        JD_Core._setupMuteBtn();

        // Iniciar loop
        JD_animFrameId = requestAnimationFrame(JD_Core._loop);
        console.log('[JD] Jungle Dash inicializado. Estado: START');
    },

    // ── Arrancar una nueva partida ────────────────────────────────────────────
    startGame() {
        JD_currentState = JD_STATES.PLAYING;
        JD_score        = 0;
        JD_coinsEarned  = 0;
        JD_gameSpeed    = 4.0;

        JD_Physics.reset();
        JD_Entities.reset(JD_Renderer.VIRT_W, JD_Renderer.GROUND_Y);

        // El audio sólo puede iniciarse tras la primera interacción
        if (JD_firstInteract) {
            JD_Audio.init();
            JD_Audio.playBGM();
        }

        console.log('[JD] Partida iniciada.');
    },

    // ── Terminar partida (colisión detectada) ─────────────────────────────────
    gameOver() {
        if (JD_currentState !== JD_STATES.PLAYING) return;
        JD_currentState = JD_STATES.GAMEOVER;

        JD_Audio.playCollision();
        JD_Audio.stopBGM();

        // Guardar récord local
        if (JD_score > JD_highScore) {
            JD_highScore = JD_score;
            localStorage.setItem('JD_highscore', Math.floor(JD_highScore));
        }

        // ── Conversión de monedas: Math.floor(puntos / 500) ───────────────────
        JD_coinsEarned = Math.floor(JD_score / 500);
        console.log(`[JD] Partida terminada. Puntos: ${Math.floor(JD_score)}. Monedas: ${JD_coinsEarned}.`);

        // ── Integración con Love Arcade GameCenter ────────────────────────────
        if (JD_coinsEarned > 0) {
            if (typeof window.GameCenter !== 'undefined') {
                const JD_sessionId = 'jd_session_' + Date.now();
                window.GameCenter.completeLevel('jungle-dash', JD_sessionId, JD_coinsEarned);
                console.log(`[JD] Reportadas ${JD_coinsEarned} monedas al GameCenter.`);
            } else {
                console.warn('[JD] Modo standalone — GameCenter no disponible. Monedas no acumuladas.');
            }
        } else {
            console.log('[JD] Sin monedas (< 500 puntos). No se reporta al GameCenter.');
        }
    },

    // ── Loop principal ────────────────────────────────────────────────────────
    _loop(timestamp) {
        // Delta normalizado: 1 = frame a 60fps; máx. 3 para evitar tunneling
        const JD_delta = Math.min((timestamp - JD_lastTimestamp) / 16.667, 3);
        JD_lastTimestamp = timestamp;

        // Actualizar lógica
        if (JD_currentState === JD_STATES.PLAYING) {
            JD_Core._update(JD_delta);
        }

        // Renderizar
        JD_Renderer.render(JD_currentState, JD_score, JD_highScore, JD_coinsEarned);

        JD_animFrameId = requestAnimationFrame(JD_Core._loop);
    },

    // ── Actualización de lógica de juego ─────────────────────────────────────
    _update(delta) {

        // ── Incremento de puntuación ─────────────────────────────────────────
        //    +1 punto base por tick a 60fps, sin multiplicador de velocidad
        JD_score += delta * 0.85;

        // ── Escalado progresivo de velocidad ─────────────────────────────────
        //    Cada 500 puntos: +0.5 velocidad; techo en 13
        JD_gameSpeed = Math.min(4.0 + Math.floor(JD_score / 500) * 0.55, 13.0);

        // ── Parallax ──────────────────────────────────────────────────────────
        JD_Renderer.advanceParallax(delta, JD_gameSpeed);

        // ── Física del jugador ────────────────────────────────────────────────
        JD_Physics.update(delta, JD_Entities.player, JD_Renderer.GROUND_Y);

        // ── Actualizar entidades ──────────────────────────────────────────────
        JD_Entities.update(delta, JD_score, JD_gameSpeed);

        // ── Detección de colisión ─────────────────────────────────────────────
        if (JD_Physics.checkCollision(JD_Entities.player, JD_Entities.obstacles)) {
            JD_Core.gameOver();
        }
    },

    // ── Input: teclado y táctil ───────────────────────────────────────────────
    _setupInput() {
        // ── Teclado ───────────────────────────────────────────────────────────
        document.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
            e.preventDefault();
            JD_Core._onActionStart();
        });
        document.addEventListener('keyup', (e) => {
            if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
            JD_Physics.releaseJump();
        });

        // ── Táctil (mobile-first) ─────────────────────────────────────────────
        const JD_cv = document.getElementById('JD_canvas');

        JD_cv.addEventListener('touchstart', (e) => {
            e.preventDefault();
            JD_Core._onActionStart();
        }, { passive: false });

        JD_cv.addEventListener('touchend', (e) => {
            e.preventDefault();
            JD_Physics.releaseJump();
        }, { passive: false });

        // ── Click (escritorio + tap en game over) ─────────────────────────────
        JD_cv.addEventListener('click', () => {
            JD_Core._onActionStart();
        });
    },

    // ── Acción unificada de inicio/salto ──────────────────────────────────────
    _onActionStart() {
        // ── Primera interacción ───────────────────────────────────────────────
        // Los navegadores exigen un gesto de usuario para desbloquear tanto el
        // AudioContext como la Fullscreen API. Ambas se activan aquí de forma
        // simultánea para no requerir un segundo gesto.
        if (!JD_firstInteract) {
            JD_firstInteract = true;
            JD_Audio.init();
            JD_Core._requestFullscreen(); // Fullscreen + orientation lock
        }

        if (JD_currentState === JD_STATES.START) {
            JD_Core.startGame();
        } else if (JD_currentState === JD_STATES.PLAYING) {
            JD_Physics.startJump();
        } else if (JD_currentState === JD_STATES.GAMEOVER) {
            JD_Core.startGame();
        }
    },

    // ── Fullscreen + orientation lock ─────────────────────────────────────────
    // Se aplica sobre #jd-container (no el canvas) para que el HUD HTML
    // permanezca visible en modo pantalla completa.
    // Compatibilidad: prefijo webkit para Safari en macOS/iPadOS.
    //
    // Nuevo comportamiento (v1.2.0):
    //   1. Se intenta requestFullscreen + orientation.lock('landscape').
    //   2. Si orientation.lock tiene éxito → el navegador rota el dispositivo;
    //      el overlay permanece oculto.
    //   3. Si orientation.lock falla (iOS Safari, Firefox escritorio, etc.) →
    //      se activa el overlay "Gira tu dispositivo" solo si el dispositivo
    //      sigue en portrait en ese momento.
    //   4. Un listener de 'resize' oculta el overlay automáticamente cuando
    //      el usuario gira el dispositivo de forma manual.
    // El canvas NO se oculta con CSS, por lo que la pantalla START es visible
    // en cualquier orientación antes de la primera interacción.
    _requestFullscreen() {
        const JD_el = document.getElementById('jd-container');
        if (!JD_el) return;

        const JD_rfs = JD_el.requestFullscreen
                    || JD_el.webkitRequestFullscreen
                    || JD_el.mozRequestFullScreen
                    || JD_el.msRequestFullscreen;

        if (!JD_rfs) {
            console.info('[JD] Fullscreen API no disponible en este navegador.');
            // Sin fullscreen API tampoco hay orientation.lock → activar overlay si portrait
            JD_Core._checkRotateOverlay();
            return;
        }

        JD_rfs.call(JD_el)
            .then(() => {
                console.log('[JD] Fullscreen activado.');
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    screen.orientation.lock('landscape')
                        .then(() => {
                            console.log('[JD] Orientación fijada en landscape.');
                            // El navegador ha rotado — overlay innecesario
                            JD_Core._hideRotateOverlay();
                        })
                        .catch((JD_err) => {
                            // iOS/Safari web: NotSupportedError — comportamiento esperado.
                            console.info('[JD] orientation.lock no soportado:', JD_err.message);
                            JD_Core._checkRotateOverlay();
                        });
                } else {
                    // Navegador sin orientation.lock
                    JD_Core._checkRotateOverlay();
                }
            })
            .catch((JD_err) => {
                // Fullscreen rechazado (iframe sin permiso, denegación del usuario…)
                console.info('[JD] Fullscreen rechazado:', JD_err.message);
                JD_Core._checkRotateOverlay();
            });
    },

    // ── Overlay "Gira tu dispositivo" — gestión JS ────────────────────────────
    // Muestra el overlay solo si el dispositivo está en portrait después de
    // que orientation.lock haya fallado. Registra un listener de resize para
    // ocultarlo automáticamente cuando el usuario gire el dispositivo.
    _checkRotateOverlay() {
        if (window.innerWidth < window.innerHeight) {
            JD_Core._showRotateOverlay();
        }
        // Registrar solo una vez
        if (!JD_Core._rotateListenerActive) {
            JD_Core._rotateListenerActive = true;
            window.addEventListener('resize', JD_Core._onOrientationChange);
        }
    },

    _showRotateOverlay() {
        const JD_ov = document.getElementById('jd-rotate-overlay');
        if (JD_ov) JD_ov.style.display = 'flex';
    },

    _hideRotateOverlay() {
        const JD_ov = document.getElementById('jd-rotate-overlay');
        if (JD_ov) JD_ov.style.display = 'none';
    },

    // Callback de resize: oculta/muestra el overlay según la orientación actual
    _onOrientationChange() {
        if (window.innerWidth >= window.innerHeight) {
            JD_Core._hideRotateOverlay();
        } else {
            JD_Core._showRotateOverlay();
        }
    },

    // Flag interno: evita añadir el listener de resize más de una vez
    _rotateListenerActive: false,

    // ── Botón de mute ─────────────────────────────────────────────────────────
    // El botón ahora reside en #jd-mute-container (fuera del HUD superior)
    // para evitar activaciones accidentales durante el juego.
    // Su visibilidad según el estado del juego se gestiona desde el glue
    // script de index.html a través de la clase CSS .jd-hidden.
    _setupMuteBtn() {
        const JD_muteBtn = document.getElementById('jd-mute-btn');
        if (!JD_muteBtn) return;

        const JD_iconOn  = JD_muteBtn.querySelector('.jd-sound-on');
        const JD_iconOff = JD_muteBtn.querySelector('.jd-sound-off');

        function JD_updateMuteIcon(muted) {
            if (JD_iconOn)  JD_iconOn.style.display  = muted ? 'none'  : 'block';
            if (JD_iconOff) JD_iconOff.style.display = muted ? 'block' : 'none';
        }

        // Estado inicial leído desde JD_Audio
        JD_updateMuteIcon(JD_Audio.isMuted);

        JD_muteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que el click llegue al canvas
            const JD_muted = JD_Audio.toggleMute();
            JD_updateMuteIcon(JD_muted);
        });
    }
};

// ── Arrancar cuando el DOM esté listo ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    JD_Core.init();
});
