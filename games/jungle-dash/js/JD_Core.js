/**
 * JD_Core.js — Jungle Dash | Módulo Principal
 * Gestiona el Game Loop (requestAnimationFrame), los estados (START/PLAYING/GAMEOVER),
 * el input táctil y de teclado, y la integración con la API de Love Arcade.
 *
 * ⚠️ Todas las variables usan prefijo JD_ — regla de namespacing obligatoria.
 *
 * v1.2.0 — Soporte Fullscreen API + orientation lock delegado al glue script.
 *           El botón de mute se gestiona desde #jd-mute-container (fuera del HUD).
 *
 * v1.3.0 — Sistema de recompensas optimizado:
 *   · Multiplicador de score dinámico (1.0× / 1.5× / 2.0×) según tramos de puntuación.
 *   · Nueva fórmula de puntuación: JD_score += (delta * 0.1) * JD_currentMultiplier.
 *   · Economía de monedas dual: pasiva (score / 40) + activa (Super Monedas × 25).
 *   · Detección de recogida de Super Monedas con checkItemCollection().
 */

// ── Estados del juego ─────────────────────────────────────────────────────────
const JD_STATES = Object.freeze({ START: 'START', PLAYING: 'PLAYING', GAMEOVER: 'GAMEOVER' });

// ── Estado global de partida ──────────────────────────────────────────────────
let JD_currentState      = JD_STATES.START;
let JD_score             = 0;
let JD_highScore         = parseInt(localStorage.getItem('JD_highscore') || '0', 10);
let JD_coinsEarned       = 0;
let JD_gameSpeed         = 4.0;   // px/frame virtuales (escala con el tiempo)
let JD_animFrameId       = null;
let JD_lastTimestamp     = 0;
let JD_firstInteract     = false; // Control de política de Autoplay de navegadores

// ── Multiplicador de puntuación dinámico (v1.3.0) ────────────────────────────
// Aumenta según tramos de puntuación para premiar la longevidad.
//   0 – 1 000 pts  → 1.0×
//   1 001 – 3 000  → 1.5×
//   3 001 +        → 2.0×
let JD_currentMultiplier = 1.0;

// ── Namespace JD_Core (expuesto para acceso entre módulos) ────────────────────
const JD_Core = {

    get score()      { return JD_score;           },
    get state()      { return JD_currentState;    },
    get highScore()  { return JD_highScore;        },
    get multiplier() { return JD_currentMultiplier; },

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
        JD_currentState      = JD_STATES.PLAYING;
        JD_score             = 0;
        JD_coinsEarned       = 0;
        JD_gameSpeed         = 4.0;
        JD_currentMultiplier = 1.0;

        JD_Physics.reset();
        JD_Entities.reset(JD_Renderer.VIRT_W, JD_Renderer.GROUND_Y);

        // El audio se inicializa en la primera interacción real.
        // El glue script (v2.0.0) puede llamar a startGame() antes de que
        // JD_firstInteract se haya marcado en JD_Core, así que se fuerza la
        // marca aquí y se inicializa el audio si aún no lo estaba.
        JD_firstInteract = true;
        JD_Audio.init();
        JD_Audio.playBGM();

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

        // ── Conversión de monedas (v1.3.0) ────────────────────────────────────
        // Fuente pasiva:  1 moneda por cada 30 puntos acumulados.
        // Fuente activa:  30 monedas por cada Super Moneda recogida durante la partida.
        // Meta de diseño: ~256 monedas en 5 000 puntos (166 pasivas + 90 de 3 super monedas).
        const JD_passiveCoins = Math.floor(JD_score / 30);
        const JD_activeCoins  = JD_Entities.superCoinsCollected * 30;
        JD_coinsEarned        = JD_passiveCoins + JD_activeCoins;

        console.log(
            `[JD] Partida terminada. Puntos: ${Math.floor(JD_score)}. ` +
            `Monedas pasivas: ${JD_passiveCoins}. ` +
            `Super Monedas recogidas: ${JD_Entities.superCoinsCollected} (+${JD_activeCoins} monedas). ` +
            `Total: ${JD_coinsEarned}.`
        );

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
            console.log('[JD] Sin monedas (< 40 puntos). No se reporta al GameCenter.');
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

        // ── Multiplicador dinámico según tramo de puntuación (v1.3.0) ─────────
        if (JD_score <= 1000) {
            JD_currentMultiplier = 1.0;
        } else if (JD_score <= 3000) {
            JD_currentMultiplier = 1.5;
        } else {
            JD_currentMultiplier = 2.0;
        }

        // ── Incremento de puntuación con multiplicador ────────────────────────
        JD_score += (delta * 0.1) * JD_currentMultiplier;

        // ── Escalado progresivo de velocidad ─────────────────────────────────
        //    Cada 500 puntos: +0.5 velocidad; techo en 13
        JD_gameSpeed = Math.min(4.0 + Math.floor(JD_score / 500) * 0.55, 13.0);

        // ── Parallax ──────────────────────────────────────────────────────────
        JD_Renderer.advanceParallax(delta, JD_gameSpeed);

        // ── Física del jugador ────────────────────────────────────────────────
        JD_Physics.update(delta, JD_Entities.player, JD_Renderer.GROUND_Y);

        // ── Actualizar entidades ──────────────────────────────────────────────
        JD_Entities.update(delta, JD_score, JD_gameSpeed);

        // ── Recogida de Super Monedas (v1.3.0) ────────────────────────────────
        // checkItemCollection usa JD_ITEM_HITBOX_FACTOR = 1.30 para magnetismo.
        const JD_scIdx = JD_Physics.checkItemCollection(
            JD_Entities.player,
            JD_Entities.superCoins
        );
        if (JD_scIdx !== -1) {
            JD_Entities.collectSuperCoin(JD_scIdx);
            JD_Audio.playSuperCoin();
            console.log(`[JD] Super Moneda recogida (#${JD_Entities.superCoinsCollected}).`);
        }

        // ── Detección de colisión con obstáculos ──────────────────────────────
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
    // NOTA v2.0.0 (glue script): El glue registra dos listeners en FASE DE CAPTURA:
    //   · pointerdown (passive): desbloquea el AudioContext. Sin stopPropagation.
    //   · click (capture): dispara requestFullscreen, luego llama a startGame() y
    //     llama a e.stopPropagation() para que el canvas NO reciba ese primer click.
    //     Una vez consumido, el listener se auto-elimina.
    //
    // Para taps posteriores (salto en vuelo, reinicio tras game over) el listener
    // del glue ya no existe, y los eventos click/touchstart/touchend del canvas
    // llegan aquí con normalidad a través de _onActionStart().
    //
    // El bloque !JD_firstInteract a continuación actúa como PLAN B para
    // interacciones que no pasan por el canvas (p. ej. teclado), asegurando que
    // JD_Audio.init() se invoque aunque el glue no haya procesado un pointerdown.
    _onActionStart() {
        // Desbloquear AudioContext si no se hizo aún (por si el primer tap llegó
        // por un camino distinto al canvas, p.ej. teclado sin pasar por el glue).
        if (!JD_firstInteract) {
            JD_firstInteract = true;
            JD_Audio.init();
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
    // ⚠️  DELEGADO en v1.2.0 — La gestión de fullscreen y orientation.lock
    // ha sido trasladada íntegramente al glue script de index.html (v2.0.0).
    // El glue usa un modelo de DOS FASES: pointerdown para audio y click para
    // fullscreen, encadenando orientation.lock dentro del .then() de la promesa.
    // _requestFullscreen ya no se llama desde ningún lugar del módulo.
    // Se conserva el stub para compatibilidad con cualquier referencia externa.
    _requestFullscreen() {
        console.info('[JD] _requestFullscreen() delegado — gestionado por el glue script (v2.0.0).');
    },

    // ── Helpers de overlay — delegados al glue script v2.0.0 ─────────────────
    // El overlay "Gira tu dispositivo" lo gestiona el glue script (resize listener).
    _checkRotateOverlay()    {},
    _showRotateOverlay()     {},
    _hideRotateOverlay()     {},
    _onOrientationChange()   {},
    _rotateListenerActive: false,

    // ── Botón de mute ─────────────────────────────────────────────────────────
    // El botón reside en #jd-mute-container (fuera del HUD superior) para evitar
    // activaciones accidentales durante el juego. Su visibilidad según el estado
    // se gestiona desde el glue script v2.0.0 a través de la clase CSS .jd-hidden.
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
