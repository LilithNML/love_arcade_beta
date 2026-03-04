/**
 * lumina_bridge.js — Integración Love Arcade · Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 5 / 5: Punto de contacto con app.js.
 * Única vía de comunicación con el sistema de monedas: completeLevel().
 * Implementa degradación elegante (modo standalone sin app.js).
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Reporte de monedas eliminado durante el gameplay.
 *        window.GameCenter.completeLevel() SOLO se llama en GameOver o Win.
 * [NEW]  Acumulador de sesión lumina_sessionCoins: las fusiones de Fichas de
 *        Energía y los bonos por persistencia se acumulan localmente.
 * [NEW]  Bono de Persistencia: +1 moneda por cada 150 puntos (calculado sobre
 *        la puntuación final de la sesión).
 * [NEW]  Bono de Fusión ⚡: incrementado a 10 monedas por ficha de energía
 *        (antes era 5).
 * [NEW]  Multiplicador de Esfuerzo: si el jugador alcanza la ficha 512, se
 *        aplica ×1.5 al total de monedas acumuladas.
 * [NEW]  lumina_reportFinalSession() consolida y reporta todo al cierre.
 * [NEW]  lumina_resetSession() para limpiar estado entre partidas.
 */

'use strict';

const lumina_GAME_ID   = 'lumina_2048';
let   lumina_keepGoing = false; // true = el usuario eligió continuar tras 2048

// ─── Estado de Sesión (acumulador) ───────────────────────────────────────────

/** Monedas de energía acumuladas durante la sesión (no se reportan hasta el final). */
let lumina_sessionCoins       = 0;

/** true si el jugador alcanzó o superó la ficha 512 en esta sesión. */
let lumina_sessionReached512  = false;

/** Mejor puntuación al inicio de la sesión, para detectar nuevo récord. */
let lumina_sessionStartBest   = 0;

// ─── API de Acumulación (llamada durante el gameplay) ─────────────────────────

/**
 * Notifica que se alcanzó un valor de ficha determinado.
 * Activa el flag del Multiplicador de Esfuerzo si el valor ≥ 512.
 * @param {number} value - Valor de la ficha alcanzada
 */
function lumina_notifyMaxTile(value) {
    if (!lumina_sessionReached512 && value >= 512) {
        lumina_sessionReached512 = true;
        console.log('[LUMINA] 🔥 Hito 512 alcanzado — multiplicador ×1.5 activado para esta sesión.');
    }
}

/**
 * Acumula monedas por fusión de Fichas de Energía (⚡).
 * NO reporta a GameCenter; las monedas quedan pendientes hasta el final.
 * @param {number} count - Cantidad de fichas de energía fusionadas en el movimiento
 */
function lumina_accumulateEnergyMerge(count) {
    const earned = count * 10; // 10 monedas por ficha de energía (v1.1: antes 5)
    lumina_sessionCoins += earned;
    console.log(`[LUMINA] ⚡ +${earned} monedas por fusión de energía (acumuladas, no reportadas).`);
}

// ─── Reporte Final (llamado en GameOver o Win) ────────────────────────────────

/**
 * Consolida todas las monedas de la sesión, aplica multiplicadores y reporta
 * una única vez a window.GameCenter.completeLevel().
 *
 * Fórmula:
 *   persistenceCoins = floor(score / 150)         ← Bono de Persistencia
 *   energyCoins      = lumina_sessionCoins         ← Fusiones ⚡ acumuladas
 *   total            = persistenceCoins + energyCoins
 *   si reached512:   total = floor(total × 1.5)   ← Multiplicador de Esfuerzo
 *
 * @returns {{ coins: number, maxTile: number, isNewRecord: boolean }}
 */
function lumina_reportFinalSession() {
    const persistenceCoins = Math.floor(lumina_score / 150);
    let totalCoins         = persistenceCoins + lumina_sessionCoins;

    if (lumina_sessionReached512) {
        totalCoins = Math.floor(totalCoins * 1.5);
        console.log('[LUMINA] ×1.5 aplicado (hito 512 alcanzado).');
    }

    // Garantizar mínimo de 1 moneda para cualquier partida
    totalCoins = Math.max(1, totalCoins);

    const maxTile     = lumina_getMaxTileValue();
    const isNewRecord = lumina_score > lumina_sessionStartBest && lumina_score > 0;

    console.log(`[LUMINA] 📊 Resumen de sesión:
  Persistencia: ${persistenceCoins} monedas (${lumina_score} pts ÷ 150)
  Energía:      ${lumina_sessionCoins} monedas
  Multiplicador:${lumina_sessionReached512 ? ' ×1.5 ✓' : ' no aplicado'}
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
    lumina_sessionCoins      = 0;
    lumina_sessionReached512 = false;
    lumina_sessionStartBest  = lumina_bestScore; // captura el récord actual
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

console.log('[LUMINA] Bridge module v1.1 loaded.');
