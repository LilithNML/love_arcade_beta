/**
 * main.js
 * Punto de entrada principal del juego.
 * Orquesta la lógica entre el Motor (PuzzleEngine), UI, Almacenamiento y Economía.
 *
 * Actualizado v4.0 — Tactical HUD & Precision Geometry:
 * - UI.initGlobalInteractions() registrado en init() para la animación de
 *   release bounce en todos los botones.
 * - Patrón háptico de snap actualizado: [30, 20, 10] (doble pulso).
 * - Patrón háptico de victoria: heavy pulse [100, 50, 80, 50, 200].
 * - 10ms de pickup se maneja directamente en PuzzleEngine.handleStart().
 */

import { LevelManager } from './core/LevelManager.js';
import { UI }            from './ui/UIController.js';
import { Storage }       from './systems/Storage.js';
import { PuzzleEngine }  from './core/PuzzleEngine.js';
import { AudioSynth }    from './systems/AudioSynth.js';
import { Economy }       from './systems/Economy.js';

const levelManager = new LevelManager();
let activeGame      = null;
let gameTimer       = null;
let currentLevelId  = null;
let startTime       = 0;

/**
 * Inicialización de la aplicación
 */
async function init() {
    console.log('[Main] Iniciando Rompecabezas Arcade...');

    await levelManager.loadLevels();

    // Desbloquear niveles que deberían estar desbloqueados por progreso previo
    Storage.validateUnlockedLevels(levelManager.levels);

    // [v15] Registrar animaciones de release bounce en todos los botones
    UI.initGlobalInteractions();

    setupNavigation();
    setupSettings();

    UI.showScreen('menu');
}

/**
 * Inicia un nivel específico.
 */
function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;

    currentLevelId = levelId;

    const allLevels  = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if (lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    if (activeGame) { activeGame.destroy(); activeGame = null; }
    clearInterval(gameTimer);

    UI.showScreen('game');

    const bg = document.getElementById('dynamic-bg');
    if (bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    const loader = document.getElementById('game-loader');
    if (loader) loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = levelConfig.image;

    img.onload = () => {
        if (loader) loader.classList.add('hidden');
        startTime = Date.now();

        const canvas = document.getElementById('puzzle-canvas');

        activeGame = new PuzzleEngine(canvas, { image: img, pieces: levelConfig.pieces }, {
            onSound: (t) => AudioSynth.play(t),
            onWin:   () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId),

            // [v15] Doble pulso háptico al encajar: 30ms → pausa 20ms → 10ms
            onSnap: () => {
                if (navigator.vibrate) navigator.vibrate([30, 20, 10]);
            }
        });

        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

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
    };

    img.onerror = () => {
        if (loader) loader.classList.add('hidden');
        alert('Error cargando la imagen del nivel. Verifica tu conexión.');
        UI.showScreen('levels');
    };
}

/**
 * Lógica de victoria, cálculo de estrellas y recompensas.
 */
function handleVictory(levelConfig) {
    clearInterval(gameTimer);

    const endTime         = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const pieces          = levelConfig.pieces;

    let stars = 1;
    if (durationSeconds <= pieces * 5)  stars = 3;
    else if (durationSeconds <= pieces * 10) stars = 2;

    Storage.saveStars(levelConfig.id, stars);
    Storage.set(`save_${levelConfig.id}`, null);

    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);

    Economy.payout(levelConfig.id, levelConfig.rewardCoins);

    // [v15] Heavy haptic pulse on victory
    if (navigator.vibrate) navigator.vibrate([100, 50, 80, 50, 200]);

    const timeStr = document.getElementById('hud-timer').textContent;

    UI.showVictoryModal(levelConfig.rewardCoins, timeStr, stars,
        () => { if (nextLvlId) startGame(nextLvlId); },
        () => { if (activeGame) activeGame.destroy(); UI.showScreen('menu'); }
    );
}

/* --- CONTROLES Y UTILIDADES --- */

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

    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    };

    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if (activeGame) { activeGame.destroy(); activeGame = null; clearInterval(gameTimer); }
        UI.showScreen(t);
    });

    document.getElementById('btn-resume').onclick = () =>
        document.getElementById('modal-pause').classList.add('hidden');

    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if (activeGame) activeGame.destroy();
        clearInterval(gameTimer);
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

function startTimer(levelConfig) {
    let timeLeft        = levelConfig.timeLimit;
    const display       = document.getElementById('hud-timer');
    if (!display) return;

    const threeStarTime = levelConfig.pieces * 5;
    const twoStarTime   = levelConfig.pieces * 10;
    const totalTime     = levelConfig.timeLimit;

    display.className = 'timer-display value';
    updateTimerDisplay(timeLeft);

    const updateColor = () => {
        const elapsed = totalTime - timeLeft;
        display.classList.remove('timer-gold', 'timer-silver', 'timer-bronze', 'low-time');
        if      (elapsed <= threeStarTime) display.classList.add('timer-gold');
        else if (elapsed <= twoStarTime)   display.classList.add('timer-silver');
        else                               display.classList.add('timer-bronze');
        if (timeLeft <= 10) display.classList.add('low-time');
    };

    updateColor();

    gameTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        updateColor();
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            if (activeGame) activeGame.destroy();
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

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

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { if (activeGame) activeGame.handleResize(); }, 100);
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('Service Worker registrado'))
        .catch((err) => console.log('Fallo en SW:', err));
}

window.addEventListener('DOMContentLoaded', init);
