/**
 * lumina_bridge.js — Integración Love Arcade · Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 5 / 5: Punto de contacto con app.js.
 * Única vía de comunicación con el sistema de monedas: completeLevel().
 * Implementa degradación elegante (modo standalone sin app.js).
 *
 * CHANGELOG v1.2
 * ──────────────
 * [BALANCE] Bono de Energía ⚡: reducido de 10 → 4 monedas por fusión.
 *           Razón: el jugador fusiona ~10-12 fichas de energía a los 3 000 pts,
 *           lo que equivale a ~40-48 monedas. Con 10 monedas la cifra era excesiva.
 * [BALANCE] Bono de Persistencia: ajustado de 1 moneda/150 pts → 1 moneda/25 pts.
 *           A 3 000 puntos el jugador recibe exactamente 120 monedas seguras.
 *           Cálculo de referencia: 120 (pts) + 40 (energía) = 160 monedas totales.
 * [BALANCE] Eliminado el multiplicador global ×1.5 por alcanzar la ficha 512.
 *           Reemplazado por Bonos Fijos de Hito (one-time, acumulados al acumulador):
 *             · Ficha 512  → +20 monedas
 *             · Ficha 1024 → +50 monedas
 *             · Ficha 2048 → +100 monedas
 *           Estos bonos se otorgan UNA SOLA VEZ por sesión y se registran en
 *           lumina_sessionMilestonesAwarded (Set de valores alcanzados).
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Reporte de monedas eliminado durante el gameplay.
 *        window.GameCenter.completeLevel() SOLO se llama en GameOver o Win.
 * [NEW]  Acumulador de sesión lumina_sessionCoins: las fusiones de Fichas de
 *        Energía y los bonos por persistencia se acumulan localmente.
 * [NEW]  lumina_reportFinalSession() consolida y reporta todo al cierre.
 * [NEW]  lumina_resetSession() para limpiar estado entre partidas.
 */

'use strict';

const lumina_GAME_ID   = 'lumina_2048';
let   lumina_keepGoing = false; // true = el usuario eligió continuar tras 2048

// ─── Configuración de Economía (v1.2) ────────────────────────────────────────

/** Monedas por fusión de ficha de energía ⚡ (v1.2: 4, antes 10). */
const lumina_COINS_PER_ENERGY = 4;

/** Puntos necesarios para ganar 1 moneda de persistencia (v1.2: 25, antes 150). */
const lumina_POINTS_PER_COIN  = 25;

/**
 * Bonos fijos de hito (one-time por sesión).
 * Reemplaza el multiplicador ×1.5 de v1.1.
 * Orden ascendente importa: se evalúan de menor a mayor.
 */
const lumina_MILESTONE_BONUSES = [
    { value: 512,  bonus: 20  },
    { value: 1024, bonus: 50  },
    { value: 2048, bonus: 100 },
];

// ─── Estado de Sesión (acumulador) ───────────────────────────────────────────

/** Monedas de energía + hitos acumulados durante la sesión. */
let lumina_sessionCoins = 0;

/**
 * Set de valores de hito ya premiados en esta sesión.
 * Garantiza que cada bono se otorgue una sola vez aunque el jugador continúe.
 * @type {Set<number>}
 */
let lumina_sessionMilestonesAwarded = new Set();

/** Mejor puntuación al inicio de la sesión, para detectar nuevo récord. */
let lumina_sessionStartBest = 0;

// ─── API de Acumulación (llamada durante el gameplay) ─────────────────────────

/**
 * Notifica que se alcanzó un valor de ficha determinado.
 * Aplica los Bonos Fijos de Hito correspondientes (solo la primera vez).
 * @param {number} value - Valor de la ficha alcanzada
 */
function lumina_notifyMaxTile(value) {
    for (const m of lumina_MILESTONE_BONUSES) {
        if (value >= m.value && !lumina_sessionMilestonesAwarded.has(m.value)) {
            lumina_sessionMilestonesAwarded.add(m.value);
            lumina_sessionCoins += m.bonus;
            console.log(`[LUMINA] 🏆 Hito ${m.value} alcanzado — +${m.bonus} monedas (bono fijo, one-time).`);
        }
    }
}

/**
 * Acumula monedas por fusión de Fichas de Energía (⚡).
 * NO reporta a GameCenter; las monedas quedan pendientes hasta el final.
 * @param {number} count - Cantidad de fichas de energía fusionadas en el movimiento
 */
function lumina_accumulateEnergyMerge(count) {
    const earned = count * lumina_COINS_PER_ENERGY; // v1.2: 4 monedas por ficha
    lumina_sessionCoins += earned;
    console.log(`[LUMINA] ⚡ +${earned} monedas por fusión de energía (acumuladas, no reportadas).`);
}

// ─── Reporte Final (llamado en GameOver o Win) ────────────────────────────────

/**
 * Consolida todas las monedas de la sesión y reporta una única vez
 * a window.GameCenter.completeLevel().
 *
 * Fórmula de Estabilidad v1.2:
 *   persistenceCoins = floor(score / 25)          ← 1 moneda cada 25 pts
 *   energyCoins      = lumina_sessionCoins         ← fusiones ⚡ + bonos de hito
 *   total            = persistenceCoins + energyCoins
 *
 * Referencia de calibración (desempeño promedio = 3 000 pts):
 *   120 (persistencia) + 40 (energía, ~10 fusiones) = 160 monedas
 *
 * @returns {{ coins: number, maxTile: number, isNewRecord: boolean }}
 */
function lumina_reportFinalSession() {
    const persistenceCoins = Math.floor(lumina_score / lumina_POINTS_PER_COIN);
    let totalCoins         = persistenceCoins + lumina_sessionCoins;

    // Garantizar mínimo de 1 moneda para cualquier partida
    totalCoins = Math.max(1, totalCoins);

    const maxTile     = lumina_getMaxTileValue();
    const isNewRecord = lumina_score > lumina_sessionStartBest && lumina_score > 0;

    const milestonesLog = [...lumina_sessionMilestonesAwarded].join(', ') || 'ninguno';
    console.log(`[LUMINA] 📊 Resumen de sesión (v1.2):
  Persistencia: ${persistenceCoins} monedas (${lumina_score} pts ÷ ${lumina_POINTS_PER_COIN})
  Energía+Hitos:${lumina_sessionCoins} monedas
  Hitos logrados: ${milestonesLog}
  TOTAL:        ${totalCoins} monedas
  Ficha máx:    ${maxTile}
  Nuevo récord: ${isNewRecord}`);

    lumina_reportReward('session_end', totalCoins);

    return { coins: totalCoins, maxTile, isNewRecord };
}

/**
 * Reinicia el estado de sesión. Llamar al inicio de cada partida nueva.
 */
function lumina_resetSession() {
    lumina_sessionCoins             = 0;
    lumina_sessionMilestonesAwarded = new Set();
    lumina_sessionStartBest         = lumina_bestScore;
    console.log(`[LUMINA] Sesión reiniciada. Récord de referencia: ${lumina_sessionStartBest}`);
}

// ─── Comunicación con GameCenter (uso interno exclusivo) ─────────────────────

/**
 * Reporta monedas al sistema Love Arcade.
 * PRIVADO: solo debe llamarse desde lumina_reportFinalSession().
 * Nunca llamar directamente durante el gameplay.
 *
 * @param {string} reason   - Identificador semántico del hito (usado en levelId)
 * @param {number} rawCoins - Cantidad de monedas (se convierte a entero positivo)
 */
function lumina_reportReward(reason, rawCoins) {
    const coins = Math.floor(Math.max(0, rawCoins));
    if (coins <= 0) {
        console.warn('[LUMINA] Recompensa ignorada: valor cero o negativo.');
        return;
    }

    // levelId único por sesión (evita idempotencia del núcleo)
    const levelId = reason + '_' + Date.now();

    if (typeof window.GameCenter !== 'undefined') {
        try {
            window.GameCenter.completeLevel(lumina_GAME_ID, levelId, coins);
            console.log(`[LUMINA] ✅ ${coins} monedas reportadas → GameCenter (${reason})`);
        } catch (e) {
            console.error('[LUMINA] Error al invocar GameCenter.completeLevel:', e);
        }
    } else {
        console.warn(`[LUMINA] Modo standalone — ${coins} monedas calculadas (no enviadas).`);
    }
}

// ─── Identidad del Usuario ────────────────────────────────────────────────────

/**
 * Lee el nickname y género del usuario desde GameCenter.
 * @returns {{ nickname: string, gender: string } | null}
 */
function lumina_getIdentity() {
    if (typeof window.GameCenter !== 'undefined' && typeof window.GameCenter.getIdentity === 'function') {
        try { return window.GameCenter.getIdentity(); } catch (_) {}
    }
    return null;
}

// ─── Sincronización de Tema ───────────────────────────────────────────────────

/**
 * Lee el tema activo de la plataforma (solo lectura del store, nunca escribe).
 * Aplica el color de acento al CSS custom property --lumina-platform-accent.
 */
function lumina_syncTheme() {
    if (typeof window.THEMES === 'undefined') return;
    try {
        const raw = localStorage.getItem('gamecenter_v6_promos');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const theme  = parsed.theme;
        if (theme && window.THEMES[theme]) {
            const accent = window.THEMES[theme].accent;
            document.documentElement.style.setProperty('--lumina-platform-accent', accent);
            console.log(`[LUMINA] Tema sincronizado: ${theme} (${accent})`);
        }
    } catch (_) {}
}

console.log('[LUMINA] Bridge module v1.2 loaded.');
