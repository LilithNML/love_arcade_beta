/**
 * lumina_core.js — Motor de Juego Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 1 / 5: Lógica pura de la matriz 4×4.
 * Independiente del DOM. Sin efectos secundarios visuales.
 * Toda variable global lleva el prefijo lumina_ (normativa de namespace).
 *
 * CHANGELOG v1.2
 * ──────────────
 * [FIX] Cap de fichas de energía: si ya hay 2 o más fichas ⚡ simultáneas en el
 *       tablero, la siguiente ficha que spawnee es forzosamente normal (2 o 4),
 *       ignorando el 6% de probabilidad. Previene situaciones de bloqueo prematuro
 *       en tableros casi llenos donde el jugador no puede fusionar la energía rápido.
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX] Mapa de rotaciones corregido: left/right estaban intercambiados, causando
 *       que las fichas se movieran en dirección opuesta a la esperada (parecían
 *       "teletransportarse" o aparecer en lugares aleatorios). La rotación CW ×1
 *       lleva la columna 0 (izquierda) al tope → left=1; CW ×3 lleva la columna 3
 *       (derecha) al tope → right=3.
 * [FIX] Ghost Moves: la variable `moved` se renombra a `hasMoved` para mayor
 *       claridad; lumina_addRandomTile() y lumina_checkGameOver() solo se invocan
 *       cuando hasMoved=true, eliminando spawns fantasma.
 */

'use strict';

// ─── Constantes ───────────────────────────────────────────────────────────────
const lumina_GRID_SIZE        = 4;
const lumina_ENERGY_CHANCE    = 0.06;   // 6 % de probabilidad por tile nuevo
const lumina_ENERGY_CAP       = 2;      // máx. fichas ⚡ simultáneas (v1.2: cap anti-bloqueo)
const lumina_COMBO_THRESHOLD  = 5;      // movimientos con fusión seguidos para activar combo
const lumina_LS_PREFIX        = 'LUMINA_'; // prefijo de namespace para localStorage

// ─── Estado del Juego ─────────────────────────────────────────────────────────
let lumina_grid          = [];   // Matriz 4×4 de objetos-ficha | null
let lumina_score         = 0;
let lumina_bestScore     = 0;
let lumina_gameOver      = false;
let lumina_gameWon       = false;
let lumina_comboStreak   = 0;    // Movimientos consecutivos con al menos 1 fusión
let lumina_comboMeter    = 0;    // 0–100: porcentaje visual del medidor
let lumina_tileCounter   = 0;   // Contador de IDs únicos

// ─── Creación de Fichas ───────────────────────────────────────────────────────

/** Crea un objeto-ficha nuevo con ID único. */
function lumina_createTile(value, isEnergy = false) {
    return {
        value,
        id:       'lt_' + (++lumina_tileCounter),
        isEnergy: isEnergy,
        isNew:    true,
        isMerged: false,
    };
}

// ─── Inicialización ───────────────────────────────────────────────────────────

function lumina_initGame() {
    lumina_grid        = Array.from({ length: lumina_GRID_SIZE }, () => Array(lumina_GRID_SIZE).fill(null));
    lumina_score       = 0;
    lumina_gameOver    = false;
    lumina_gameWon     = false;
    lumina_comboStreak = 0;
    lumina_comboMeter  = 0;
    lumina_tileCounter = 0;
    lumina_bestScore   = lumina_loadBestScore();
    lumina_addRandomTile();
    lumina_addRandomTile();
}

/** Añade una ficha aleatoria en una celda vacía. */
function lumina_addRandomTile() {
    const empty = [];
    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++)
            if (!lumina_grid[r][c]) empty.push([r, c]);
    if (!empty.length) return null;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];

    // Cap v1.2: si ya hay lumina_ENERGY_CAP o más fichas ⚡ en el tablero,
    // forzar ficha normal para evitar bloqueos en tableros casi llenos.
    let energyCount = 0;
    lumina_forEachTile(t => { if (t && t.isEnergy) energyCount++; });
    const isEnergy = energyCount < lumina_ENERGY_CAP && Math.random() < lumina_ENERGY_CHANCE;

    const value    = Math.random() < 0.9 ? 2 : 4;
    lumina_grid[r][c] = lumina_createTile(value, isEnergy);
    return { r, c };
}

// ─── Movimiento ───────────────────────────────────────────────────────────────

/**
 * Procesa un movimiento en la dirección dada.
 * @param {'up'|'down'|'left'|'right'} direction
 * @returns {{ moved, merges, maxMergeValue, energyMerges, comboTriggered }}
 *
 * La técnica de rotación unifica toda la lógica en "mover hacia arriba" (fila 0).
 * Rotación CW: ng[c][n-1-r] = grid[r][c]
 *   ×1 → la columna izquierda (col 0) pasa a ser la fila 0 → sirve para LEFT
 *   ×2 → la fila inferior (row 3) pasa a ser la fila 0      → sirve para DOWN
 *   ×3 → la columna derecha (col 3) pasa a ser la fila 0    → sirve para RIGHT
 */
function lumina_move(direction) {
    // Limpiar flags de animación del frame anterior
    lumina_forEachTile(t => { if (t) { t.isNew = false; t.isMerged = false; } });

    // CORRECCIÓN v1.1: left y right tenían los valores intercambiados.
    const rotations = { up: 0, left: 1, down: 2, right: 3 };
    const times = rotations[direction];
    lumina_rotateGrid(times);

    let hasMoved     = false;
    let merges       = [];
    let energyMerges = 0;

    for (let col = 0; col < lumina_GRID_SIZE; col++) {
        const res = lumina_processColumn(col);
        if (res.colMoved) hasMoved = true;
        merges.push(...res.colMerges);
        energyMerges += res.colEnergyMerges;
    }

    lumina_rotateGrid((4 - times) % 4);

    const maxMergeValue = merges.length ? Math.max(...merges.map(m => m.value)) : 0;

    // Actualizar Combo Meter
    let comboTriggered = false;
    if (merges.length > 0) {
        lumina_comboStreak++;
        lumina_comboMeter = Math.min(100, (lumina_comboStreak / lumina_COMBO_THRESHOLD) * 100);
    } else {
        lumina_comboStreak = 0;
        lumina_comboMeter  = 0;
    }

    if (lumina_comboMeter >= 100) {
        comboTriggered     = true;
        lumina_comboMeter  = 0;
        lumina_comboStreak = 0;
        lumina_triggerComboEffect();
    }

    // Spawn y verificaciones solo si hubo movimiento efectivo (anti-ghost-move)
    if (hasMoved) {
        lumina_addRandomTile();
        lumina_checkGameOver();
        lumina_saveBestScore();
    }

    return { moved: hasMoved, merges, maxMergeValue, energyMerges, comboTriggered };
}

/**
 * Compacta y fusiona hacia arriba la columna dada (fila 0 = destino).
 * Recorre las fichas de arriba hacia abajo, empujándolas hacia el tope.
 */
function lumina_processColumn(col) {
    // Recoger tiles no-nulos en orden (de arriba a abajo)
    const tiles = [];
    for (let row = 0; row < lumina_GRID_SIZE; row++) {
        if (lumina_grid[row][col]) tiles.push(lumina_grid[row][col]);
    }

    if (!tiles.length) return { colMoved: false, colMerges: [], colEnergyMerges: 0 };

    const result        = [];
    const colMerges     = [];
    let colEnergyMerges = 0;
    let i = 0;

    while (i < tiles.length) {
        const curr = tiles[i];
        const next = tiles[i + 1];

        if (next && curr.value === next.value) {
            // ── Fusión ──
            const newValue      = curr.value * 2;
            const isEnergyMerge = curr.isEnergy || next.isEnergy;
            const mergedTile    = lumina_createTile(newValue, false);
            mergedTile.isMerged = true;
            result.push(mergedTile);
            lumina_score += newValue;
            colMerges.push({ value: newValue, isEnergy: isEnergyMerge });
            if (isEnergyMerge) colEnergyMerges++;
            i += 2;
        } else {
            result.push(curr);
            i++;
        }
    }

    // Rellenar con null hasta 4
    while (result.length < lumina_GRID_SIZE) result.push(null);

    // Detectar movimiento comparando IDs (merge ⟹ nuevo ID ⟹ siempre moved)
    let colMoved = false;
    for (let row = 0; row < lumina_GRID_SIZE; row++) {
        const oldTile = lumina_grid[row][col];
        const newTile = result[row];
        if ((oldTile?.id || null) !== (newTile?.id || null)) colMoved = true;
        lumina_grid[row][col] = newTile;
    }

    return { colMoved, colMerges, colEnergyMerges };
}

// ─── Rotación de Grilla ───────────────────────────────────────────────────────

/** Rota la grilla `times` veces en sentido horario. */
function lumina_rotateGrid(times) {
    for (let t = 0; t < times; t++) {
        const n = lumina_GRID_SIZE;
        const ng = Array.from({ length: n }, () => Array(n).fill(null));
        for (let r = 0; r < n; r++)
            for (let c = 0; c < n; c++)
                ng[c][n - 1 - r] = lumina_grid[r][c];
        lumina_grid = ng;
    }
}

// ─── Efecto Combo ─────────────────────────────────────────────────────────────

/**
 * Fusiona pares de fichas con valor 2 y 4 automáticamente.
 * Activado cuando el Combo Meter llega a 100 %.
 */
function lumina_triggerComboEffect() {
    const twos  = [];
    const fours = [];
    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++) {
            const t = lumina_grid[r][c];
            if (!t) continue;
            if (t.value === 2) twos.push([r, c]);
            else if (t.value === 4) fours.push([r, c]);
        }
    lumina_comboPairs(twos, 4);
    lumina_comboPairs(fours, 8);
}

function lumina_comboPairs(positions, newValue) {
    for (let i = 0; i + 1 < positions.length; i += 2) {
        const [r1, c1] = positions[i];
        const [r2, c2] = positions[i + 1];
        const t = lumina_createTile(newValue);
        t.isMerged = true;
        lumina_grid[r1][c1] = t;
        lumina_grid[r2][c2] = null;
        lumina_score += newValue;
    }
}

// ─── Estado del Juego ─────────────────────────────────────────────────────────

function lumina_checkGameOver() {
    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++)
            if (!lumina_grid[r][c]) return; // Hay celdas vacías

    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++) {
            const v = lumina_grid[r][c]?.value;
            if (c + 1 < lumina_GRID_SIZE && lumina_grid[r][c + 1]?.value === v) return;
            if (r + 1 < lumina_GRID_SIZE && lumina_grid[r + 1][c]?.value === v) return;
        }

    lumina_gameOver = true;
}

function lumina_checkWin() {
    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++)
            if (lumina_grid[r][c]?.value >= 2048) return true;
    return false;
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function lumina_forEachTile(fn) {
    for (let r = 0; r < lumina_GRID_SIZE; r++)
        for (let c = 0; c < lumina_GRID_SIZE; c++)
            fn(lumina_grid[r][c], r, c);
}

function lumina_getMaxTileValue() {
    let max = 0;
    lumina_forEachTile(t => { if (t && t.value > max) max = t.value; });
    return max;
}

// ─── Persistencia (localStorage) ─────────────────────────────────────────────

function lumina_saveBestScore() {
    if (lumina_score > lumina_bestScore) {
        lumina_bestScore = lumina_score;
        try { localStorage.setItem(lumina_LS_PREFIX + 'bestScore', lumina_bestScore); } catch (_) {}
    }
}

function lumina_loadBestScore() {
    try { return parseInt(localStorage.getItem(lumina_LS_PREFIX + 'bestScore') || '0', 10); } catch (_) { return 0; }
}

function lumina_saveGameState() {
    try {
        localStorage.setItem(lumina_LS_PREFIX + 'gameState', JSON.stringify({
            grid: lumina_grid,
            score: lumina_score,
            comboStreak: lumina_comboStreak,
            comboMeter: lumina_comboMeter,
            tileCounter: lumina_tileCounter,
        }));
    } catch (_) {}
}

function lumina_loadGameState() {
    try {
        const raw = localStorage.getItem(lumina_LS_PREFIX + 'gameState');
        if (!raw) return false;
        const s = JSON.parse(raw);
        lumina_grid        = s.grid;
        lumina_score       = s.score;
        lumina_comboStreak = s.comboStreak || 0;
        lumina_comboMeter  = s.comboMeter  || 0;
        lumina_tileCounter = s.tileCounter || 0;
        return true;
    } catch (_) { return false; }
}

function lumina_clearGameState() {
    try { localStorage.removeItem(lumina_LS_PREFIX + 'gameState'); } catch (_) {}
}

console.log('[LUMINA] Core module v1.2 loaded.');
