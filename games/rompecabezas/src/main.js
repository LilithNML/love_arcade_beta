/**
 * main.js
 * Punto de entrada principal del juego.
 * Orquesta la lógica entre el Motor (PuzzleEngine), UI, Almacenamiento y Economía.
 *
 * Actualizado v5.0 — Tactical Soul:
 * - GameState centraliza isPaused / timeLeft / timerId.
 * - img.decode() garantiza que la GPU termine de decodificar antes de inicializar
 *   PuzzleEngine — fix definitivo para el "glitch blanco" en assets > 9 MP.
 * - togglePause() es el único punto de entrada para pausar/reanudar.
 * - Auto-pausa en visibilitychange (pestaña oculta) y window blur (cambio de app).
 * - Living Grid: parallax vía mouse (factor 0.05) y DeviceOrientation (giroscopio).
 * - Twinkle micro-dots: canvas de puntos 1px en intersecciones de rejilla,
 *   ~5% parpadea cada 3-5 s.
 * - Canvas corner micro-data: POS_X/POS_Y en tiempo real.
 */

import { LevelManager } from './core/LevelManager.js';
import { UI }            from './ui/UIController.js';
import { Storage }       from './systems/Storage.js';
import { PuzzleEngine }  from './core/PuzzleEngine.js';
import { AudioSynth }    from './systems/AudioSynth.js';
import { Economy }       from './systems/Economy.js';

const levelManager = new LevelManager();
let activeGame     = null;
let currentLevelId = null;
let startTime      = 0;

/* ─── Centralized Game State ────────────────────────────────────────────────
   Single source of truth for pause and timer.
   The setInterval keeps running; isPaused freezes the countdown in-place
   without destroying and recreating the interval.
   ─────────────────────────────────────────────────────────────────────────── */
const GameState = {
    isPaused: false,
    isInGame: false,
    timeLeft: 0,
    timerId:  null
};

/* =========================================================================
   INIT
   ========================================================================= */
async function init() {
    console.log('[Main] Iniciando Rompecabezas Arcade...');

    await levelManager.loadLevels();
    Storage.validateUnlockedLevels(levelManager.levels);

    UI.initGlobalInteractions();

    initGridParallax();
    initTwinkleDots();
    setupAutoPause();
    setupNavigation();
    setupSettings();

    UI.showScreen('menu');
}

/* =========================================================================
   LIVING GRID — Parallax
   ========================================================================= */

/**
 * Moves the #grid-layer opposite to mouse/gyro with factor 0.05 (5 px max).
 */
function initGridParallax() {
    const grid = document.getElementById('grid-layer');
    if (!grid) return;

    const FACTOR = 5; // max pixel shift

    document.addEventListener('mousemove', (e) => {
        const xRatio = (e.clientX / window.innerWidth  - 0.5) * 2;
        const yRatio = (e.clientY / window.innerHeight - 0.5) * 2;
        grid.style.transform =
            `translate3d(${-xRatio * FACTOR}px, ${-yRatio * FACTOR}px, 0)`;
    }, { passive: true });

    window.addEventListener('deviceorientation', (e) => {
        if (e.gamma === null || e.beta === null) return;
        const xRatio = Math.max(-1, Math.min(1, e.gamma / 45));
        const yRatio = Math.max(-1, Math.min(1, (e.beta - 40) / 40));
        grid.style.transform =
            `translate3d(${-xRatio * FACTOR}px, ${-yRatio * FACTOR}px, 0)`;
    }, { passive: true });
}

/* =========================================================================
   LIVING GRID — Twinkle micro-dots
   ========================================================================= */

/**
 * Draws 1px dots at each 40px grid intersection.
 * Every 3–5 s, ~5% of dots twinkle: fade up to full opacity then back.
 */
function initTwinkleDots() {
    const canvas = document.getElementById('twinkle-canvas');
    if (!canvas) return;

    const ctx  = canvas.getContext('2d');
    const GRID = 40;
    let dots   = [];

    function buildDots() {
        dots = [];
        const cols = Math.ceil(canvas.width  / GRID) + 1;
        const rows = Math.ceil(canvas.height / GRID) + 1;
        for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) {
                dots.push({ x: c * GRID, y: r * GRID, twinkle: 0 });
            }
        }
    }

    function resize() {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        buildDots();
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    // Schedule random twinkle bursts every 3–5 s
    (function scheduleTwinkle() {
        setTimeout(() => {
            const count = Math.max(1, Math.floor(dots.length * 0.05));
            for (let i = 0; i < count; i++) {
                dots[Math.floor(Math.random() * dots.length)].twinkle = 1.0;
            }
            scheduleTwinkle();
        }, 3000 + Math.random() * 2000);
    })();

    let lastTs = 0;

    function render(ts) {
        const dt = Math.min((ts - lastTs) / 1000, 0.1);
        lastTs = ts;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (const d of dots) {
            let alpha = 0.18;

            if (d.twinkle > 0) {
                d.twinkle = Math.max(0, d.twinkle - dt / 0.8);
                const t = 1 - d.twinkle; // 0 → 1 as twinkle decays
                // Triangle wave: ramp up first half, down second half
                alpha = t < 0.5
                    ? 0.18 + (t / 0.5) * 0.82
                    : 1.0  - ((t - 0.5) / 0.5) * 0.82;
            }

            ctx.globalAlpha = alpha;
            ctx.fillStyle   = '#3B82F6';
            ctx.fillRect(d.x - 0.5, d.y - 0.5, 1, 1);
        }

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

/* =========================================================================
   LEVEL LOADING — img.decode() fix for > 9 MP assets
   ========================================================================= */

/**
 * Starts a level. Uses await img.decode() so the GPU has fully decoded the
 * image before PuzzleEngine is created, eliminating the white-flash glitch.
 */
async function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;

    currentLevelId     = levelId;
    GameState.isInGame = false;
    GameState.isPaused = false;

    const allLevels  = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if (lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    if (activeGame) { activeGame.destroy(); activeGame = null; }
    clearInterval(GameState.timerId);

    UI.showScreen('game');

    const bg = document.getElementById('dynamic-bg');
    if (bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    // Hide canvas immediately — avoids flash of previous level
    const puzzleCanvas = document.getElementById('puzzle-canvas');
    if (puzzleCanvas) puzzleCanvas.style.opacity = '0';

    const loader = document.getElementById('game-loader');
    if (loader) loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = levelConfig.image;

    try {
        // Wait for the GPU to fully decode all pixels before rendering
        await img.decode();
    } catch (err) {
        console.error('[Main] Error decodificando imagen pesada:', err);
        if (loader) loader.classList.add('hidden');
        alert('Error cargando la imagen del nivel. Verifica tu conexión.');
        UI.showScreen('levels');
        return;
    }

    if (loader) loader.classList.add('hidden');
    startTime = Date.now();

    activeGame = new PuzzleEngine(puzzleCanvas, { image: img, pieces: levelConfig.pieces }, {
        onSound: (t) => AudioSynth.play(t),
        onWin:   () => handleVictory(levelConfig),
        onStateChange: () => saveProgress(levelId),
        onSnap: () => {
            if (navigator.vibrate) navigator.vibrate([30, 20, 10]);
        }
    });

    if (loadSaved) {
        const savedState = Storage.get(`save_${levelId}`);
        if (savedState) activeGame.importState(savedState);
    }

    // Reveal canvas on the very next frame — PuzzleEngine has rendered frame 0
    requestAnimationFrame(() => {
        if (puzzleCanvas) puzzleCanvas.style.opacity = '1';
    });

    GameState.isInGame = true;

    if (levelConfig.timeLimit && levelConfig.timeLimit > 0) {
        startTimer(levelConfig);
    } else {
        const timerDisplay = document.getElementById('hud-timer');
        if (timerDisplay) {
            timerDisplay.textContent = '∞';
            timerDisplay.classList.remove('low-time', 'timer-gold', 'timer-silver', 'timer-bronze');
        }
    }

    setupGameControls();
    updateCanvasCornerData(levelConfig);
}

/* ─── Canvas micro-data corner labels ─────────────────────────────────────── */
function updateCanvasCornerData(levelConfig) {
    const tlEl = document.getElementById('canvas-pos-tl');
    const brEl = document.getElementById('canvas-pos-br');

    if (tlEl) tlEl.textContent = 'POS_X: 000 // POS_Y: 000';
    if (brEl) {
        const p = String(levelConfig.pieces).padStart(2, '0');
        brEl.textContent = `RES: ${levelConfig.pieces}P // PCE: ${p}`;
    }

    const canvas = document.getElementById('puzzle-canvas');
    if (!canvas || !tlEl) return;

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = String(Math.round(e.clientX - rect.left)).padStart(3, '0');
        const y = String(Math.round(e.clientY - rect.top)).padStart(3, '0');
        tlEl.textContent = `POS_X: ${x} // POS_Y: ${y}`;
    }, { passive: true });
}

/* =========================================================================
   VICTORY
   ========================================================================= */
function handleVictory(levelConfig) {
    clearInterval(GameState.timerId);
    GameState.isInGame = false;

    const durationSeconds = (Date.now() - startTime) / 1000;
    const pieces          = levelConfig.pieces;

    let stars = 1;
    if (durationSeconds <= pieces * 5)  stars = 3;
    else if (durationSeconds <= pieces * 10) stars = 2;

    Storage.saveStars(levelConfig.id, stars);
    Storage.set(`save_${levelConfig.id}`, null);

    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);

    Economy.payout(levelConfig.id, levelConfig.rewardCoins);

    if (navigator.vibrate) navigator.vibrate([100, 50, 80, 50, 200]);

    const timeStr = document.getElementById('hud-timer').textContent;

    UI.showVictoryModal(levelConfig.rewardCoins, timeStr, stars,
        () => { if (nextLvlId) startGame(nextLvlId); },
        () => { if (activeGame) activeGame.destroy(); UI.showScreen('menu'); }
    );
}

/* =========================================================================
   PAUSE SYSTEM
   ========================================================================= */

/**
 * Single entry-point for pause / resume.
 * The setInterval continues running — isPaused is checked inside each tick.
 */
function togglePause(shouldPause) {
    if (!GameState.isInGame) return;

    GameState.isPaused = shouldPause;

    if (shouldPause) {
        document.getElementById('modal-pause').classList.remove('hidden');
        console.log('[Main] Pausado — cronómetro congelado.');
    } else {
        document.getElementById('modal-pause').classList.add('hidden');
        console.log('[Main] Reanudado — cronómetro activo.');
    }
}

/**
 * Registers automatic pause triggers.
 * 1. Page Visibility API — tab hidden / phone call / screen off.
 * 2. Window blur — user switches to another app or window.
 */
function setupAutoPause() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) togglePause(true);
    });

    window.addEventListener('blur', () => {
        togglePause(true);
    });
}

/* =========================================================================
   TIMER — respects GameState.isPaused
   ========================================================================= */
function startTimer(levelConfig) {
    GameState.timeLeft = levelConfig.timeLimit;
    if (GameState.timerId) clearInterval(GameState.timerId);

    const display       = document.getElementById('hud-timer');
    if (!display) return;

    const threeStarTime = levelConfig.pieces * 5;
    const twoStarTime   = levelConfig.pieces * 10;
    const totalTime     = levelConfig.timeLimit;

    display.className = 'timer-display value';
    updateTimerDisplay(GameState.timeLeft);

    const updateColor = () => {
        const elapsed = totalTime - GameState.timeLeft;
        display.classList.remove('timer-gold', 'timer-silver', 'timer-bronze', 'low-time');
        if      (elapsed <= threeStarTime) display.classList.add('timer-gold');
        else if (elapsed <= twoStarTime)   display.classList.add('timer-silver');
        else                               display.classList.add('timer-bronze');
        if (GameState.timeLeft <= 10) display.classList.add('low-time');
    };

    updateColor();

    GameState.timerId = setInterval(() => {
        // ── KEY FIX: skip this tick entirely when paused ──────────────
        if (GameState.isPaused) return;

        GameState.timeLeft--;
        updateTimerDisplay(GameState.timeLeft);
        updateColor();

        if (GameState.timeLeft <= 0) {
            clearInterval(GameState.timerId);
            GameState.isInGame = false;
            if (activeGame) activeGame.destroy();
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

/* =========================================================================
   NAVIGATION & CONTROLS
   ========================================================================= */
function setupGameControls() {
    const btnPreview    = document.getElementById('btn-preview');
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);

    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP   = () => activeGame && activeGame.togglePreview(false);
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    const btnMagnet    = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        if (!window.GameCenter) {
            if (confirm('Modo Pruebas: ¿Usar Imán gratis?')) {
                const placed = activeGame.autoPlacePiece();
                if (!placed) alert('¡No quedan piezas sueltas!');
            }
            return;
        }
        const balance = window.GameCenter.getBalance ? window.GameCenter.getBalance() : 0;
        const COST    = 10;
        if (balance < COST) { alert(`Saldo insuficiente.\nCosto: ${COST}\nTienes: ${balance} 💰`); return; }
        if (confirm(`¿Usar Imán por ${COST} monedas?`)) {
            const result = window.GameCenter.buyItem({ id: 'magnet', price: COST });
            if (result?.success) {
                const placed = activeGame.autoPlacePiece();
                if (!placed) alert('¡El rompecabezas ya está resuelto!');
            } else {
                alert('Error en la transacción.');
            }
        }
    };
}

function setupNavigation() {
    document.getElementById('btn-play').onclick     = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-levels').onclick   = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');

    // Pause button routes through togglePause()
    document.getElementById('btn-pause').onclick = () => togglePause(true);

    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if (activeGame) { activeGame.destroy(); activeGame = null; clearInterval(GameState.timerId); }
        GameState.isInGame = false;
        UI.showScreen(t);
    });

    // Resume button routes through togglePause()
    document.getElementById('btn-resume').onclick = () => togglePause(false);

    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if (activeGame) activeGame.destroy();
        clearInterval(GameState.timerId);
        GameState.isInGame = false;
        if (currentLevelId) saveProgress(currentLevelId);
        UI.showScreen('menu');
    };

    document.getElementById('btn-retry').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        startGame(currentLevelId, false);
    };
    document.getElementById('btn-quit-fail').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        UI.showScreen('menu');
    };
}

function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    UI.renderLevelsGrid(levels, (id) => {
        if (Storage.get(`save_${id}`)) {
            const modal  = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo  = document.getElementById('btn-no-resume');
            const newYes = btnYes.cloneNode(true);
            const newNo  = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);
            newYes.onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            newNo.onclick  = () => { modal.classList.add('hidden'); Storage.set(`save_${id}`, null); startGame(id, false); };
        } else {
            startGame(id, false);
        }
    });
}

/* =========================================================================
   UTILITIES
   ========================================================================= */
function updateTimerDisplay(s) {
    const m  = Math.floor(s / 60).toString().padStart(2, '0');
    const sc = (s % 60).toString().padStart(2, '0');
    const el = document.getElementById('hud-timer');
    if (el) el.textContent = `${m}:${sc}`;
}

function saveProgress(lid) {
    if (activeGame) Storage.set(`save_${lid}`, activeGame.exportState());
}

function setupSettings() {
    const chk = document.getElementById('setting-sound');
    if (chk) chk.addEventListener('change', () => {
        const s = Storage.get('settings') || {};
        s.sound = chk.checked;
        Storage.set('settings', s);
        if (AudioSynth) AudioSynth.enabled = chk.checked;
    });

    const btnReset = document.getElementById('btn-reset-progress');
    if (btnReset) {
        btnReset.onclick = () => {
            if (confirm('⚠ ¿ESTÁS SEGURO?\nEsto borrará todas tus monedas, estrellas y progreso.')) {
                localStorage.clear();
                location.reload();
            }
        };
    }
}

/* ─── Resize ──────────────────────────────────────────────────────────────── */
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { if (activeGame) activeGame.handleResize(); }, 100);
}, { passive: true });

/* ─── Service Worker — unregister any previously installed instance ───────── */
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
}

/* ─── Boot ────────────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', init);
