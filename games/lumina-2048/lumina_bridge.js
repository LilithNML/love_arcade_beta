/**
 * lumina_bridge.js — Integración Love Arcade · Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 5 / 5: Punto de contacto con app.js.
 * Única vía de comunicación con el sistema de monedas: completeLevel().
 * Implementa degradación elegante (modo standalone sin app.js).
 */

'use strict';

const lumina_GAME_ID    = 'lumina_2048';
let   lumina_keepGoing  = false; // true = el usuario eligió continuar tras 2048

// ─── API Pública de Recompensas ───────────────────────────────────────────────

/**
 * Reporta monedas al sistema Love Arcade.
 * Valida tipos e invoca window.GameCenter.completeLevel().
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
        console.warn('[LUMINA] Modo standalone activo — monedas no acumuladas.');
    }
}

// ─── Hitos Concretos ──────────────────────────────────────────────────────────

/**
 * Recompensa al alcanzar 2048 (victoria).
 * Fórmula: máx(10, floor(score / 50))
 */
function lumina_rewardWin() {
    const coins = Math.max(10, Math.floor(lumina_score / 50));
    lumina_reportReward('win_2048', coins);
}

/**
 * Recompensa por fusionar una o más fichas de energía (⚡).
 * @param {number} count - Cantidad de fichas de energía fusionadas en el movimiento
 */
function lumina_rewardEnergyMerge(count) {
    const coins = count * 5; // 5 monedas por ficha de energía
    lumina_reportReward('energy_merge', coins);
}

/**
 * Recompensa al romper el récord personal.
 * Llamar desde el motor principal cuando lumina_score > lumina_bestScore (antes de actualizar).
 */
function lumina_rewardNewRecord() {
    const coins = Math.max(5, Math.floor(lumina_bestScore / 200));
    lumina_reportReward('new_record', coins);
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

console.log('[LUMINA] Bridge module v1.0 loaded.');
