/**
 * JD_Core.js — Jungle Dash | Módulo Principal
 * Gestiona el Game Loop (requestAnimationFrame), los estados (START/PLAYING/GAMEOVER),
 * el input táctil y de teclado, y la integración con la API de Love Arcade.
 *
 * ⚠️ Todas las variables usan prefijo JD_ — regla de namespacing obligatoria.
 *
 * v1.2.0 — Lógica "Permitir para Transformar":
 *   · El juego permanece visible en portrait para que el usuario pueda interactuar.
 *   · La primera interacción desencadena requestFullscreen() + orientation.lock().
 *   · El overlay de rotación solo se muestra si orientation.lock() es rechazado.
 *   · El HUD de puntuación migró del canvas al DOM HTML (ver JD_Renderer.js).
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
        JD_score += delta * 0.85;

        // ── Escalado progresivo de velocidad ─────────────────────────────────
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
    // La primera interacción desbloquea simultáneamente el AudioContext y la
    // Fullscreen API, ya que ambas exigen un gesto de usuario explícito.
    // Mantener el juego visible en portrait es lo que hace posible este gesto:
    // sin él, el usuario no puede tocar la pantalla para iniciar el flujo.
    _onActionStart() {
        if (!JD_firstInteract) {
            JD_firstInteract = true;
            JD_Audio.init();
            JD_Core._requestFullscreen(); // fullscreen + orientation lock
        }

        if (JD_currentState === JD_STATES.START) {
            JD_Core.startGame();
        } else if (JD_currentState === JD_STATES.PLAYING) {
            JD_Physics.startJump();
        } else if (JD_currentState === JD_STATES.GAMEOVER) {
            JD_Core.startGame();
        }
    },

    // ── Fullscreen + Orientation Lock ─────────────────────────────────────────
    //
    // Estrategia "Permitir para Transformar":
    //
    //   1. Solicitar fullscreen sobre #jd-container (no el canvas) para que el
    //      HUD HTML siga siendo visible y accesible dentro del fullscreen.
    //   2. Tras activar fullscreen, intentar fijar la orientación en landscape.
    //   3. Solo si orientation.lock() es RECHAZADO (ej. iOS Safari web), mostrar
    //      el overlay visual de rotación como instrucción de fallback al usuario.
    //
    // Este diseño respeta la limitación técnica de los navegadores modernos:
    // ninguna API puede forzar la rotación sin un gesto previo del usuario.
    // Al mantener el juego visible en portrait, el usuario puede tocar, y ese
    // toque desencadena el flujo completo.
    //
    // Compatibilidad: prefijos webkit/moz/ms para cobertura máxima.
    // iOS Safari web: orientation.lock no está soportado → overlay de fallback.
    _requestFullscreen() {
        const JD_el = document.getElementById('jd-container');
        if (!JD_el) return;

        const JD_rfs = JD_el.requestFullscreen
                    || JD_el.webkitRequestFullscreen
                    || JD_el.mozRequestFullScreen
                    || JD_el.msRequestFullscreen;

        if (!JD_rfs) {
            // Fullscreen API no disponible (ej. iframe sin permiso allowfullscreen)
            console.info('[JD] Fullscreen API no disponible — mostrando overlay si es necesario.');
            JD_Core._showRotateOverlayIfPortrait();
            return;
        }

        JD_rfs.call(JD_el)
            .then(() => {
                console.log('[JD] Fullscreen activado.');

                // Intentar fijar orientación en landscape
                if (screen.orientation && typeof screen.orientation.lock === 'function') {
                    screen.orientation.lock('landscape')
                        .then(() => {
                            console.log('[JD] Orientación fijada en landscape.');
                        })
                        .catch((JD_err) => {
                            // Comportamiento esperado en iOS Safari web y algunos Android.
                            // El overlay guía al usuario para que rote manualmente.
                            console.info('[JD] orientation.lock rechazado:', JD_err.message);
                            JD_Core._showRotateOverlayIfPortrait();
                        });
                } else {
                    // API no disponible en este navegador
                    JD_Core._showRotateOverlayIfPortrait();
                }
            })
            .catch((JD_err) => {
                // El usuario denegó el fullscreen o el contexto no lo permite.
                // El juego continúa en modo ventana; mostramos overlay si hace falta.
                console.info('[JD] Fullscreen rechazado:', JD_err.message);
                JD_Core._showRotateOverlayIfPortrait();
            });
    },

    // ── Mostrar overlay de rotación solo si el dispositivo está en portrait ────
    // Evita mostrar el overlay en escritorio o en dispositivos ya en landscape.
    _showRotateOverlayIfPortrait() {
        if (window.innerWidth >= window.innerHeight) return; // ya en landscape
        const JD_overlay = document.getElementById('jd-rotate-overlay');
        if (JD_overlay) {
            JD_overlay.classList.add('jd-visible');
        }
    },

    // ── Botón de mute ─────────────────────────────────────────────────────────
    // Reside en #jd-mute-container (desacoplado del HUD superior).
    // La visibilidad según el estado de juego la gestiona el glue script
    // de index.html a través de la clase CSS .jd-hidden.
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
