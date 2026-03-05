/**
 * lumina_input.js — Gestión de Entrada Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 3 / 5: Keyboard + TouchEvents.
 * Previene el scroll involuntario del navegador durante el juego.
 * Soporta flick rápido con umbral reducido y swipes lentos.
 *
 * CHANGELOG v1.2
 * ──────────────
 * [FIX]  Error crítico de persistencia: el estado guardado (localStorage) se
 *        eliminaba SOLO al iniciar una nueva partida, no al perder. Esto hacía
 *        que al volver al juego tras una derrota se restaurara el tablero bloqueado.
 *        Solución: lumina_clearGameState() se llama en el momento exacto en que
 *        lumina_gameOver o lumina_gameWon se activan, antes del setTimeout del modal.
 *        Así el "archivo de guardado" nunca sobrevive a una partida terminada.
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Audio Latency en Android: lumina_resumeAudio() se llama explícitamente
 *        en cada touchstart para garantizar que el AudioContext esté activo antes
 *        de que el usuario levante el dedo.
 * [FIX]  Ghost Moves: el spawn de nueva ficha ya está protegido en lumina_core.js
 *        con el booleano hasMoved; aquí se refuerza no ejecutando ninguna lógica
 *        de recompensa si result.moved === false.
 * [UPD]  Integración con nuevo sistema de recompensas (lumina_bridge.js v1.1):
 *        - lumina_accumulateEnergyMerge() reemplaza a lumina_rewardEnergyMerge()
 *        - lumina_notifyMaxTile() notifica al bridge cuando se alcanza la ficha 512
 *        - lumina_reportFinalSession() se llama UNA SOLA VEZ en GameOver y Win
 * [UPD]  lumina_showGameOver() y lumina_showWin() reciben el objeto sessionData
 *        para poblar el nuevo modal de resumen de ingresos.
 */

'use strict';

let lumina_inputEnabled  = true;
let lumina_touchStartX   = 0;
let lumina_touchStartY   = 0;
let lumina_touchStartT   = 0;
const lumina_SWIPE_MIN   = 25;   // px mínimos para detectar un swipe
const lumina_FLICK_TIME  = 200;  // ms máximo para un "flick" rápido

function lumina_initInput() {
    // ── Teclado ──
    window.addEventListener('keydown', lumina_onKey);

    // ── Área táctil: el board + un área envolvente ──
    const area = document.getElementById('lumina-game-area') || document.body;
    area.addEventListener('touchstart', lumina_onTouchStart, { passive: false });
    area.addEventListener('touchmove',  lumina_onTouchMove,  { passive: false });
    area.addEventListener('touchend',   lumina_onTouchEnd,   { passive: false });

    console.log('[LUMINA] Input module v1.1 loaded.');
}

// ─── Teclado ──────────────────────────────────────────────────────────────────

function lumina_onKey(e) {
    if (!lumina_inputEnabled) return;
    const MAP = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right',
    };
    const dir = MAP[e.key];
    if (dir) {
        e.preventDefault();
        lumina_handleMove(dir);
    }
}

// ─── Touch ────────────────────────────────────────────────────────────────────

function lumina_onTouchStart(e) {
    const t = e.touches[0];
    lumina_touchStartX = t.clientX;
    lumina_touchStartY = t.clientY;
    lumina_touchStartT = performance.now();

    // CORRECCIÓN v1.1: Reanudar AudioContext explícitamente en touchstart.
    // En Android, el contexto puede quedar en 'suspended' y causar latencia
    // si solo se reanuda en touchend. Llamar resume() aquí lo activa a tiempo.
    lumina_resumeAudio();
}

function lumina_onTouchMove(e) {
    // Prevenir scroll mientras el usuario está dentro del área de juego
    if (e.target.closest('#lumina-board') || e.target.closest('#lumina-game-area')) {
        e.preventDefault();
    }
}

function lumina_onTouchEnd(e) {
    if (!lumina_inputEnabled) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - lumina_touchStartX;
    const dy = t.clientY - lumina_touchStartY;
    const dt = performance.now() - lumina_touchStartT;

    // Umbral dinámico: flicks rápidos aceptan desplazamientos menores
    const threshold = dt < lumina_FLICK_TIME
        ? lumina_SWIPE_MIN * 0.5
        : lumina_SWIPE_MIN;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < threshold && absDy < threshold) return;

    const dir = absDx > absDy
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down'  : 'up');

    e.preventDefault();
    lumina_handleMove(dir);
}

// ─── Controlador Central de Movimiento ───────────────────────────────────────

function lumina_handleMove(direction) {
    if (!lumina_inputEnabled) return;
    if (lumina_gameOver)      return;
    // Si ya ganó, solo se mueve si está en modo "keep going"
    if (lumina_gameWon && !lumina_keepGoing) return;

    lumina_inputEnabled = false; // Bloquear input durante la animación CSS (160 ms)

    const prevScore = lumina_score;
    const result    = lumina_move(direction);

    if (result.moved) {
        // ── Audio ──
        if (result.merges.length > 0) {
            lumina_playMergeSound(result.maxMergeValue);
            lumina_doHaptic(result.maxMergeValue >= 2048 ? 50 : 10);
        } else {
            lumina_playMoveSound();
        }

        // ── Partículas para fusiones de alto valor ──
        if (result.maxMergeValue >= 128) {
            lumina_forEachTile((tile, r, c) => {
                if (tile?.isMerged && tile.value === result.maxMergeValue)
                    lumina_spawnParticles(c, r, tile.value);
            });
        }

        // ── Acumulación de monedas por fichas de energía (sin reportar) ──
        // CAMBIO v1.1: reemplaza lumina_rewardEnergyMerge() por acumulación local.
        if (result.energyMerges > 0) {
            lumina_accumulateEnergyMerge(result.energyMerges);
        }

        // ── Notificar hito de ficha máxima al bridge (para multiplicador ×1.5) ──
        const currentMax = lumina_getMaxTileValue();
        if (currentMax >= 512) {
            lumina_notifyMaxTile(currentMax);
        }

        // ── Combo ──
        lumina_updateComboMeter();
        if (result.comboTriggered) {
            lumina_triggerComboFlash();
            lumina_playComboSound();
            lumina_renderGrid(); // Re-render del efecto combo inmediato
        }

        // ── Render principal ──
        lumina_renderGrid();
        lumina_updateScoreDisplay(prevScore);
        lumina_saveGameState();

        // ── Condiciones de victoria/derrota ──
        // CAMBIO v1.1: reportFinalSession() se llama UNA SOLA VEZ aquí.
        // FIX v1.2: lumina_clearGameState() se llama INMEDIATAMENTE al detectar
        // fin de partida, antes del setTimeout, para que el guardado desaparezca
        // en el instante exacto en que la partida muere (nunca sobrevive al cierre).
        if (!lumina_gameWon && lumina_checkWin()) {
            lumina_gameWon   = true;
            lumina_keepGoing = false;
            lumina_clearGameState(); // ← FIX v1.2: eliminar guardado al ganar
            setTimeout(() => {
                const sessionData = lumina_reportFinalSession();
                lumina_showWin(sessionData);
                lumina_playWinSound();
                lumina_doHaptic(50);
            }, 400);

        } else if (lumina_gameOver) {
            lumina_clearGameState(); // ← FIX v1.2: eliminar guardado al perder
            setTimeout(() => {
                const sessionData = lumina_reportFinalSession();
                lumina_showGameOver(sessionData);
            }, 300);
        }
    }

    setTimeout(() => { lumina_inputEnabled = true; }, 160);
}

// ─── Feedback Háptico ─────────────────────────────────────────────────────────

function lumina_doHaptic(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
}

console.log('[LUMINA] Input module v1.2 loaded.');
