/**
 * Game Center Core v9.3 — Zero-Flicker Initiative
 * Compatible con gamecenter_v6_promos — migración silenciosa incluida.
 *
 * NOVEDADES v9.3 (Zero-Flicker Initiative):
 *  - Script crítico inline en <head> de index.html: lee el tema del
 *    localStorage y sobreescribe los CSS custom properties en :root ANTES
 *    del primer paint, eliminando el "salto violeta" al 100%.
 *  - INIT síncrono: applyTheme(), init de saldo, updateDailyButton(),
 *    updateMoonBlessingUI() y applyAvatar() se ejecutan síncronamente al
 *    final de <body> (fuera de DOMContentLoaded). Dado que app.js está al
 *    final del body, el DOM ya existe pero el navegador aún no ha pintado,
 *    por lo que todos los valores correctos se escriben antes del primer frame.
 *  - revealUI(): añade .is-ready y .coin-badge--visible en el siguiente RAF,
 *    garantizando que los contenedores de datos críticos sólo se revelan
 *    después de que sus valores reales han sido escritos.
 *  - styles.css: .hud-avatar-wrap comienza con opacity:0 y transiciona a 1
 *    cuando recibe .is-ready, evitando el destello del avatar por defecto.
 *
 * NOVEDADES v9.2 (Font FOIT/FOUT, Coin Init & Treasury Grid):
 *  - DOMContentLoaded: escribe el saldo inicial de forma SÍNCRONA y formateada
 *    en los .coin-display ANTES de cualquier animación, eliminando el "salto"
 *    de número crudo → formato "k".
 *  - Tras el pintado inicial, añade .coin-badge--visible (opacity: 0→1 en 150ms)
 *    para que el badge nunca muestre el "0" del HTML ni valores sin formatear.
 *
 * NOVEDADES v9.1 (History API, Retry UI & Theme Fix):
 *  - applyTheme(): ahora escribe la clase `theme-{key}` en <body> y elimina
 *    todas las clases de tema previas antes de añadir la nueva.
 *    El atributo data-theme se mantiene para retrocompatibilidad con CSS.
 *  - Listener de .theme-btn eliminado de DOMContentLoaded de app.js para
 *    evitar doble-registro con shop-logic.js. La fuente de verdad es app.js
 *    vía setTheme(); los listeners se registran una sola vez en shop-logic.js.
 *
 * NOVEDADES v9.0 (SPA Migration):
 *  - Arquitectura SPA: index.html unificado con #view-home y #view-shop.
 *  - shop.html eliminado; toda su lógica migrada a js/shop-logic.js.
 *  - Nuevo módulo js/spa-router.js intercepta navegación sin recargas.
 *  - getState(): expone lectura segura del store para módulos externos.
 *  - syncUI(): fuerza sincronización completa del saldo sin esperar a saveState().
 *  - Worker path actualizado a 'js/sync-worker.js' (estructura js/).
 *
 * NOVEDADES v8.1 (Daily Claim Security):
 *  - getNetworkTime(): sincronización con worldtimeapi.org; fallback a Date.now() con estado "Unverified"
 *  - Bloqueo si discrepancia reloj local/red > 5 minutos ("Reloj desincronizado")
 *  - Cambio de lógica 24 h → Día Natural (reset a las 00:00:00); elimina "desplazamiento de horario"
 *  - Fórmula de racha basada en días calendario: diff=1 streak++, diff>1 reset, diff=0 ya reclamado
 *  - Prevención de race conditions: btn-daily se desactiva síncronamente antes de cualquier Promise
 *  - Feedback visual "Procesando..." mientras la petición está en vuelo
 *  - Sanitización de saltos negativos: currentTime < lastClaimTime → mensaje informativo, racha intacta
 *  - Recompensas críticas (Bendición Lunar) bloqueadas si el tiempo es "Unverified"
 */

// =====================================================
// CONFIGURACIÓN GLOBAL
// =====================================================
const CONFIG = {
    stateKey:      'gamecenter_v6_promos', // ← NO modificar jamás
    initialCoins:  0,
    dailyReward:   20,     // Monedas base del día 1 (se escala con racha)
    dailyStreakCap: 60,    // Máximo de monedas por bono diario
    dailyStreakStep: 5,    // Incremento por día de racha
    wallpapersPath: 'wallpapers/'
};

// Salt para checksums de sincronización — mantener secreto
const SYNC_SALT = 'love_arcade_v75_integrity_2026';

// =====================================================
// ECONOMÍA — Editar aquí para eventos especiales
// =====================================================
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.8,
    saleLabel:      '20% OFF',
    cashbackRate:   0.1
};
window.ECONOMY = ECONOMY;

// =====================================================
// TEMAS
// =====================================================
const THEMES = {
    violet:  { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:    { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:    { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:    { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' },
    crimson: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)',   name: 'Carmesí Arcade' }
};
window.THEMES = THEMES;

// =====================================================
// CÓDIGOS PROMOCIONALES — SHA-256 (no texto plano)
// Generados con: echo -n "CODIGO" | sha256sum
// Para agregar nuevos códigos ver DOCUMENTACION.md §10
// =====================================================
const PROMO_CODES_HASHED = {
    'bf321fd2057fa13f1fd86a8cfb8520c8faa2e8a0195b3662e2138e56f94a8df2': 50,   // GOUL50
    'b4d84aca1d5ff57b732b692a5fc42339415ff2219b9294e5f544350dde4d7e92':  50,   // AMRO50
    '4558eb9beb0e77957ba21fec46409b091c420ac4c1865270b616aa7a6ca76f25': 50,   // GOVE50
    '72b39c0a7c2fe8a8db1742ef42a3a4bf61905339e9812ececa071bcdedbd3ab2':  50,   // FU50
    '72cf61b005e730b6eeac4c97936244d27b2a545f5d26e6471c02758850689904': 50,   // GO50
    'e6453c805f71d9e7bbdfabf1e5b5ad5dd7486809e10ef268e18232008c2de0cf': 50,   // GOBR50
    'ab96dc80db7dba63748b998b3eedca466199d6b8a36f2674b6e5aa39b3404b14': 50,   // CH50
    '02dcc8750da36c2511a2d6d7567256edb41447b11550f4968137906d73fa0ced':  50,   // ASYA50
    '92bdd5dffca1bfee9dde72af852074ab33dba616f3db3b349e97c3c8aa958e83': 50,   // MINA50
    '0c313dd65a464d2e751661069b01bd9a67c9545fd859d5bc04bbeb88599c3866':  50,   // SA50
    '37c74d7abd7b237ca719072ff715ba8d44ae8c8275e9d0dfc70cedc9b3c04064': 50,   // TRFU50
    '8db94e555d11f110460ee972a26103f22033273838f652301f6a29f8a5f36503':  50,   // VEZA50
    'f75a0e6945982ff704460a5e367f4b9d7479cf3fa6762df752db800330ab86ae':  50,   // JADO50
    '0512cff95aa6330ed89bd4822b4964548ad8ccc5b4df75e392fcadadf49fffa8': 50,   // JADOUNO50
    'ac7b6ff2fd99186477f83a02008658d7f4de1c80a614818be882c09084f719a7': 50,   // JADODOS50
    '03a757ee862ded77b45430ef1c34f256ca1744dd6d3a946b0a704088cf93823c':  50,   // JADOTRES50
    '379dcec413be95bf9a79240ff0772acbe90cdb0bfdd63d9bdfb97b21b8363595': 50,   // HAMI50
    '5bc5dd8321afdd53f535526494fb3c1314635a25c9c8ce42878d53df07f8146d':  50,   // MA50
    'c5395455063acab1d8670cac6b5b514a039af0e66df88a53deee2a49879354ba': 50,   // XI50
    '0cd1cd7704a567e4e84e312b345fedf75023dced7b0bf3578d5b4eb6f41810cc': 50,   // LADEHI50
    '888b5b43925b50cb86c2393e4a8c50a2337708af889b70f2be4e6eb9d98cfff7': 50,   // HIGO50
    '190d2b7ebff147a6aa8097b55ec51cb55a96a405a47c4c89290c47b5be51d25f': 50,   // KAWA50
    '88feae97920cf17c921668702199e84ddde033d886bdde984b491401d0f3294d':  60,   // SACAME
    '76d06ecc24894e3d3fc52716754fc8728b0335659698f1b8c8b5bfcac70de42f':  1000, // SAMUEL1000
    '79de29d219b29ccb8b267df61dbe7bd2d3810fa964ef84d2fba4289cdf16d26d':  500,  // FEB14
    '724dd40fbeb9e3d50651a4300aa21a85361a15d864a08b6b66c3e83d084a1c70':  300,  // SOFYEK300
    '07d2dde1b4c1fe43644c8da03617b0baa8f3ebfaffcaa36c39ee6037b956a70f':  200   // ERRORRC
};

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Calcula el SHA-256 de un texto y devuelve el hash en hexadecimal.
 * Usa la API nativa crypto.subtle — disponible en todos los navegadores modernos.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256(text) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Crea una versión con debounce de una función.
 * Útil para controlar la frecuencia de operaciones costosas (buscador, resize).
 * @param {Function} fn    Función a debounce-ar.
 * @param {number}   delay Espera en ms antes de ejecutar (por defecto 300ms).
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
window.debounce = debounce; // Disponible globalmente para shop.html

// =====================================================
// TIEMPO DE RED — Fuente de verdad externa para el bono diario
// =====================================================

/**
 * Consulta una API pública de tiempo para obtener una marca temporal verificada.
 * Si la red no está disponible, retorna Date.now() con verified = false.
 * Si la discrepancia entre el reloj de red y el local supera CLOCK_SKEW_LIMIT,
 * retorna desynced = true y el botón de reclamo quedará bloqueado.
 *
 * @returns {Promise<{ time: number, verified: boolean, desynced: boolean }>}
 */
const CLOCK_SKEW_LIMIT = 5 * 60 * 1000; // 5 minutos en ms

async function getNetworkTime() {
    const localTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 5000); // 5 s timeout
        const res = await fetch('https://worldtimeapi.org/api/ip', {
            cache:  'no-store',
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data        = await res.json();
        const networkTime = new Date(data.datetime).getTime();
        const skew        = Math.abs(networkTime - Date.now());

        if (skew > CLOCK_SKEW_LIMIT) {
            return { time: networkTime, verified: true, desynced: true };
        }
        return { time: networkTime, verified: true, desynced: false };
    } catch (_) {
        // Red no disponible o timeout — usar reloj local, marcar como no verificado
        return { time: localTime, verified: false, desynced: false };
    }
}

// =====================================================
// WEB WORKER — Sincronización en hilo separado
// =====================================================
let _syncWorker = null;

function getSyncWorker() {
    if (_syncWorker) return _syncWorker;
    try {
        _syncWorker = new Worker('js/sync-worker.js');
        _syncWorker.onerror = () => { _syncWorker = null; };
    } catch (e) {
        _syncWorker = null;
    }
    return _syncWorker;
}

function workerTask(payload) {
    return new Promise((resolve, reject) => {
        const worker = getSyncWorker();
        if (!worker) { reject(new Error('Worker no disponible')); return; }
        const id = `${Date.now()}-${Math.random()}`;
        const handler = (e) => {
            if (e.data.id !== id) return;
            worker.removeEventListener('message', handler);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ ...payload, id });
    });
}

// =====================================================
// MIGRACIÓN SILENCIOSA
// Garantiza retrocompatibilidad con stores de versiones anteriores.
// Nunca sobrescribe datos existentes; solo rellena campos faltantes.
// =====================================================
function migrateState(loadedStore) {
    const defaults = {
        coins:          CONFIG.initialCoins,
        progress:       { maze: [], wordsearch: [], secretWordsFound: [] },
        inventory:      {},
        redeemedCodes:  [],   // Legado (texto plano): se conserva por historial
        redeemedHashes: [],   // v7.5: hashes SHA-256 de códigos canjeados
        history:        [],
        userAvatar:     null,
        theme:          'violet',
        wishlist:       [],
        daily:          { lastClaim: 0, streak: 0 },
        buffs:          { moonBlessingExpiry: 0 }
    };

    const merged = { ...defaults, ...loadedStore };

    // Migración: lastDaily (string fecha) → daily.lastClaim (timestamp)
    if (merged.lastDaily && merged.daily.lastClaim === 0) {
        const lastDate = new Date(merged.lastDaily);
        if (!isNaN(lastDate.getTime())) {
            merged.daily = { lastClaim: lastDate.getTime(), streak: 1 };
        }
    }
    delete merged.lastDaily; // Eliminar campo legado

    // Asegurar sub-objetos faltantes
    if (!merged.daily   || typeof merged.daily !== 'object')  merged.daily = defaults.daily;
    if (!merged.buffs   || typeof merged.buffs !== 'object')  merged.buffs = defaults.buffs;
    if (!Array.isArray(merged.wishlist))        merged.wishlist = [];
    if (!Array.isArray(merged.redeemedHashes))  merged.redeemedHashes = [];
    if (!Array.isArray(merged.history))         merged.history = [];

    return merged;
}

// =====================================================
// STORE — Carga y fusión con migración automática
// =====================================================
let store = migrateState({});

try {
    const raw = localStorage.getItem(CONFIG.stateKey);
    if (raw) store = migrateState(JSON.parse(raw));
} catch (e) {
    console.error('GameCenter: Error al cargar estado', e);
    store = migrateState({});
}

// =====================================================
// ANIMACIÓN DE CONTADOR (requestAnimationFrame)
// =====================================================
let _displayedCoins = store.coins;

function animateValue(elements, start, end, duration = 650) {
    if (!elements || !elements.length) return;
    if (start === end) { elements.forEach(el => el.textContent = end); return; }
    const range = end - start;
    const t0 = performance.now();
    const step = (now) => {
        const p     = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
        elements.forEach(el => el.textContent = Math.round(start + range * eased));
        if (p < 1) requestAnimationFrame(step);
        else _displayedCoins = end;
    };
    requestAnimationFrame(step);
}

// =====================================================
// HISTORIAL DE TRANSACCIONES
// =====================================================
/**
 * Registra una transacción en store.history con formato estructurado.
 * @param {'ingreso'|'gasto'} tipo
 * @param {number}             cantidad
 * @param {string}             motivo
 */
function logTransaction(tipo, cantidad, motivo) {
    if (!Array.isArray(store.history)) store.history = [];
    store.history.push({ tipo, cantidad, motivo, fecha: Date.now() });
    // Limitar a las últimas 150 entradas para no inflar el localStorage
    if (store.history.length > 150) {
        store.history = store.history.slice(-150);
    }
}

// =====================================================
// API PÚBLICA — window.GameCenter
// =====================================================
window.GameCenter = {

    // ── JUEGOS ──────────────────────────────────────────────────────────────

    /**
     * Registra un nivel completado y otorga la recompensa indicada.
     * Es idempotente: si el levelId ya fue registrado, no vuelve a pagar.
     */
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) {
            return { paid: false, coins: store.coins };
        }
        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        logTransaction('ingreso', rewardAmount, `Nivel ${levelId} completado · ${gameId}`);
        saveState();
        return { paid: true, coins: store.coins };
    },

    // ── TIENDA ───────────────────────────────────────────────────────────────

    buyItem: (itemData) => {
        const bought = store.inventory[itemData.id] || 0;
        if (bought > 0) return { success: false, reason: 'owned' };

        const finalPrice = ECONOMY.isSaleActive
            ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
            : itemData.price;

        if (store.coins < finalPrice) return { success: false, reason: 'coins' };

        const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);

        store.coins -= finalPrice;
        store.coins += cashback;
        store.inventory[itemData.id] = bought + 1;

        logTransaction('gasto',   finalPrice, `Compra: ${itemData.name}`);
        if (cashback > 0) {
            logTransaction('ingreso', cashback, `Cashback: ${itemData.name}`);
        }

        saveState();
        return { success: true, finalPrice, cashback };
    },

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance:     ()   => store.coins,
    getInventory:   ()   => ({ ...store.inventory }),

    getDownloadUrl: (itemId, fileName) => {
        if (!fileName) return null;
        return (store.inventory[itemId] || 0) > 0
            ? CONFIG.wallpapersPath + fileName
            : null;
    },

    // ── WISHLIST ─────────────────────────────────────────────────────────────

    /**
     * Alterna el estado de favorito de un ítem.
     * @returns {boolean} true si quedó en wishlist, false si fue removido.
     */
    toggleWishlist: (itemId) => {
        if (!Array.isArray(store.wishlist)) store.wishlist = [];
        const idx = store.wishlist.indexOf(itemId);
        if (idx > -1) store.wishlist.splice(idx, 1);
        else          store.wishlist.push(itemId);
        saveState();
        return store.wishlist.includes(itemId);
    },

    isWishlisted: (itemId) =>
        Array.isArray(store.wishlist) && store.wishlist.includes(itemId),

    // ── HISTORIAL ────────────────────────────────────────────────────────────

    /**
     * Devuelve el historial de transacciones en orden cronológico inverso
     * (la más reciente primero).
     */
    getHistory: () => [...(store.history || [])].reverse(),

    // ── CÓDIGOS PROMO (async — SHA-256) ──────────────────────────────────────

    /**
     * Canjea un código promocional.
     * El código se hashea en el cliente antes de compararlo; el texto plano
     * nunca se almacena ni se compara directamente, protegiendo los códigos
     * de una lectura trivial en DevTools.
     * @returns {Promise<{success: boolean, reward?: number, message: string}>}
     */
    redeemPromoCode: async (inputCode) => {
        const code = inputCode.trim().toUpperCase();
        const hash = await sha256(code);

        const reward = PROMO_CODES_HASHED[hash];
        if (!reward) return { success: false, message: 'Código inválido' };

        if (store.redeemedHashes.includes(hash)) {
            return { success: false, message: 'Ya canjeaste este código' };
        }

        store.coins += reward;
        store.redeemedHashes.push(hash);
        // Mantener compatibilidad con panel de historial antiguo
        store.redeemedCodes.push(code);
        logTransaction('ingreso', reward, `Código canjeado`);
        saveState();
        return { success: true, reward, message: `¡+${reward} Monedas!` };
    },

    // ── BONO DIARIO CON RACHA ────────────────────────────────────────────────

    /**
     * Reclama el bono diario. Función async — consulta una API de tiempo externa
     * como fuente de verdad antes de evaluar el reclamo.
     *
     * Lógica de días calendario (v8.1):
     *   diff_días == 0 → ya reclamado hoy.
     *   diff_días == 1 → racha continúa (streak + 1).
     *   diff_días  > 1 → racha se reinicia (streak = 1).
     *
     * Seguridad adicional:
     *   - currentTime < lastClaimTime → salto negativo detectado; bloquear sin tocar racha.
     *   - Discrepancia reloj local/red > 5 min → "Reloj desincronizado"; bloquear reclamo.
     *   - API no disponible → usar Date.now() con verified = false; bloquear Bendición Lunar.
     *
     * @returns {Promise<{success: boolean, reward?: number, baseReward?: number,
     *                    moonBonus?: number, streak?: number, verified: boolean, message: string}>}
     */
    claimDaily: async () => {
        const { time: now, verified, desynced } = await getNetworkTime();
        const { lastClaim, streak } = store.daily;

        // ── 1. Salto negativo (manipulación de reloj detectada a posteriori) ──
        if (lastClaim > 0 && now < lastClaim) {
            return {
                success:  false,
                verified,
                message:  'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'
            };
        }

        // ── 2. Reloj desincronizado con la red ──
        if (desynced) {
            return {
                success:  false,
                verified,
                message:  'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.'
            };
        }

        // ── 3. Cálculo de días calendario (normalizar a medianoche) ──
        const nowMidnight  = new Date(now).setHours(0, 0, 0, 0);
        const lastMidnight = lastClaim > 0
            ? new Date(lastClaim).setHours(0, 0, 0, 0)
            : null;

        // Si nunca se ha reclamado (lastClaim === 0), tratarlo como diff = 1
        const diffDays = lastMidnight !== null
            ? Math.round((nowMidnight - lastMidnight) / 86_400_000)
            : 1;

        if (diffDays === 0) {
            return {
                success:  false,
                verified,
                message:  '¡Ya reclamaste tu bono hoy! Vuelve mañana.'
            };
        }

        // ── 4. Calcular nueva racha ──
        const newStreak = diffDays === 1 ? streak + 1 : 1;

        const baseReward = Math.min(
            CONFIG.dailyReward + (newStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );

        // ── 5. Bendición Lunar (bloqueada si el tiempo no está verificado) ──
        const moonActive = store.buffs.moonBlessingExpiry > now;
        // Si la API no está disponible (verified = false), no se otorga el bonus lunar
        // para evitar que se abuse en modo offline.
        const moonBonus  = (moonActive && verified) ? 90 : 0;
        const totalReward = baseReward + moonBonus;

        // ── 6. Aplicar y persistir ──
        store.coins += totalReward;
        store.daily  = { lastClaim: now, streak: newStreak };

        logTransaction(
            'ingreso',
            totalReward,
            `Bono diario · racha ${newStreak}` +
            (moonBonus ? ' + Bendición Lunar' : '') +
            (!verified ? ' (tiempo sin verificar)' : '')
        );

        saveState();
        updateMoonBlessingUI();

        const unverifiedNote = !verified ? ' (red no disponible)' : '';
        return {
            success:    true,
            reward:     totalReward,
            baseReward,
            moonBonus,
            streak:     newStreak,
            verified,
            message:    `¡+${totalReward} monedas! Racha: ${newStreak} día${newStreak !== 1 ? 's' : ''}${unverifiedNote}`
        };
    },

    /**
     * Comprueba si el usuario puede reclamar el bono diario.
     * Usa el reloj local para la UI (sin coste de red); la validación real
     * con tiempo de red ocurre dentro de claimDaily().
     * Lógica: el bono está disponible si hoy (medianoche) > último reclamo (medianoche).
     *
     * @returns {boolean}
     */
    canClaimDaily: () => {
        const { lastClaim } = store.daily;
        if (lastClaim === 0) return true;
        const nowMidnight  = new Date().setHours(0, 0, 0, 0);
        const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
        return (nowMidnight - lastMidnight) >= 86_400_000; // al menos 1 día de diferencia
    },

    /**
     * Devuelve información sobre el estado de la racha actual.
     * Usa días calendario (medianoche) para consistencia con claimDaily().
     */
    getStreakInfo: () => {
        const { lastClaim, streak } = store.daily;
        const nowMidnight  = new Date().setHours(0, 0, 0, 0);
        const lastMidnight = lastClaim > 0
            ? new Date(lastClaim).setHours(0, 0, 0, 0)
            : null;
        const diffDays   = lastMidnight !== null
            ? Math.round((nowMidnight - lastMidnight) / 86_400_000)
            : 1;
        const nextStreak = diffDays === 1 ? streak + 1 : 1;
        const nextReward = Math.min(
            CONFIG.dailyReward + (nextStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );
        return {
            streak,
            nextReward,
            canClaim: diffDays >= 1
        };
    },

    // ── BENDICIÓN LUNAR ──────────────────────────────────────────────────────

    /**
     * Activa (o extiende) la Bendición Lunar. Costo: 100 monedas.
     * Efecto: +90 monedas extra por cada reclamo diario.
     * Vigencia: 7 días. Si ya está activa, extiende desde el vencimiento actual.
     */
    buyMoonBlessing: () => {
        const COST = 100;
        const DURATION = 7 * 86_400_000; // 7 días en ms

        if (store.coins < COST) return { success: false, reason: 'coins' };

        const now = Date.now();
        const isActive = store.buffs.moonBlessingExpiry > now;
        store.coins -= COST;
        store.buffs.moonBlessingExpiry = (isActive
            ? store.buffs.moonBlessingExpiry
            : now
        ) + DURATION;

        logTransaction('gasto', COST, 'Bendición Lunar activada (7 días)');
        saveState();
        updateMoonBlessingUI();

        const expiresAt = new Date(store.buffs.moonBlessingExpiry).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });

        return { success: true, expiresAt };
    },

    getMoonBlessingStatus: () => {
        const now    = Date.now();
        const expiry = store.buffs.moonBlessingExpiry;
        const active = expiry > now;
        return {
            active,
            expiresAt: active
                ? new Date(expiry).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric'
                  })
                : null,
            remainingMs: active ? expiry - now : 0
        };
    },

    // ── SINCRONIZACIÓN (async — Worker + Checksum) ───────────────────────────

    /**
     * Genera un código de exportación con checksum de integridad.
     * La operación pesada se delega al Web Worker cuando está disponible.
     */
    exportSave: async () => {
        try {
            const result = await workerTask({ action: 'export', store, salt: SYNC_SALT });
            return result;
        } catch (_) {
            // Fallback síncrono si el worker no está disponible
        }
        // Fallback: operación en hilo principal
        const json     = JSON.stringify(store);
        const checksum = await sha256(json + SYNC_SALT);
        const payload  = JSON.stringify({ data: store, checksum });
        try { return btoa(unescape(encodeURIComponent(payload))); }
        catch { return null; }
    },

    /**
     * Importa un código de partida validando su checksum antes de aplicarlo.
     * Si el checksum no coincide, la importación es rechazada para prevenir
     * manipulación manual del saldo.
     */
    importSave: async (code) => {
        try {
            let data;
            try {
                const result = await workerTask({ action: 'import', code, salt: SYNC_SALT });
                if (!result.valid) {
                    return {
                        success: false,
                        message: 'El código fue modificado manualmente. Importación rechazada por integridad.'
                    };
                }
                data = result.data;
            } catch (_) {
                // Fallback sin worker
                const json    = decodeURIComponent(escape(atob(code.trim())));
                const payload = JSON.parse(json);
                if (payload.checksum && payload.data) {
                    const expected = await sha256(JSON.stringify(payload.data) + SYNC_SALT);
                    if (payload.checksum !== expected) {
                        return {
                            success: false,
                            message: 'El código fue modificado manualmente. Importación rechazada.'
                        };
                    }
                    data = payload.data;
                } else {
                    // Formato legado v7.2
                    data = payload;
                }
            }

            if (typeof data.coins !== 'number') throw new Error('invalid');
            store = migrateState(data);
            saveState();
            return { success: true };
        } catch {
            return { success: false, message: 'Código inválido o corrupto.' };
        }
    },

    // ── AVATAR ───────────────────────────────────────────────────────────────

    setAvatar: (dataUrl) => { store.userAvatar = dataUrl; saveState(); applyAvatar(); },
    getAvatar: ()        => store.userAvatar,

    // Alias público para compatibilidad con shop.html
    activateMoonBlessing: function() { return this.buyMoonBlessing(); },

    // ── TEMA ─────────────────────────────────────────────────────────────────

    setTheme: (key) => {
        if (!THEMES[key]) return;
        store.theme = key;
        saveState();
        applyTheme(key);
    },
    getTheme: () => store.theme || 'violet',

    // ── SPA / MÓDULOS EXTERNOS ────────────────────────────────────────────────

    /**
     * Devuelve una lectura segura (sin referencia) del estado público del store.
     * Usado por shop-logic.js (renderStreakCalendar) y spa-router.js.
     * No expone el objeto store completo para evitar mutaciones externas.
     * @returns {{ coins: number, streak: number, theme: string, moonBlessingExpiry: number }}
     */
    getState: () => ({
        coins:               store.coins,
        streak:              store.daily?.streak || 0,
        theme:               store.theme || 'violet',
        moonBlessingExpiry:  store.buffs?.moonBlessingExpiry || 0
    }),

    /**
     * Fuerza una sincronización visual completa del saldo en todos los
     * indicadores de la UI (Navbar .coin-display + HUD .coin-display).
     * Llamado por spa-router.js al navegar entre vistas para garantizar
     * que el saldo sea siempre correcto al entrar a cualquier vista.
     * Resetea _displayedCoins para que animateValue arranque desde el valor
     * correcto en vez del último valor animado.
     */
    syncUI: () => {
        _displayedCoins = store.coins;
        updateUI();
    }
};

// =====================================================
// MAIL HELPER — Utilidades mailto: (sin backend)
// =====================================================

/** Clave de localStorage exclusiva para el último correo utilizado.
 *  Separada del store del juego para no contaminar exportaciones/checksums. */
const MAIL_RECIPIENT_KEY = 'love_arcade_last_recipient';

/** Umbral de caracteres a partir del cual el mailto: puede truncarse
 *  en algunos clientes de correo (RFC 2368 / límite práctico). */
const MAILTO_MAX_LENGTH = 1800;

/**
 * Regex de validación de correo electrónico (sintáctica básica, FR3).
 * No pretende cubrir toda la RFC 5322; cubre el 99 % de los casos reales.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida si la cadena tiene forma de correo electrónico válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return EMAIL_REGEX.test(email.trim());
}

/**
 * Persiste el último correo utilizado en localStorage (FR6 / guardado explícito
 * tras acción del usuario de confirmar el envío).
 * @param {string} email
 */
function saveLastMailRecipient(email) {
    try { localStorage.setItem(MAIL_RECIPIENT_KEY, email.trim()); }
    catch (_) { /* localStorage lleno — ignorar silenciosamente */ }
}

/**
 * Recupera el último correo guardado para pre-rellenar el campo (FR spec).
 * @returns {string}  Correo guardado, o cadena vacía si no hay ninguno.
 */
function getLastMailRecipient() {
    try { return localStorage.getItem(MAIL_RECIPIENT_KEY) || ''; }
    catch (_) { return ''; }
}

/**
 * Construye un URI mailto: con los campos To, Subject y Body codificados.
 * Todos los valores se pasan por encodeURIComponent para evitar inyecciones (FR4).
 *
 * @param {{ name: string, tags?: string[] }} item    Metadatos del wallpaper.
 * @param {string} absoluteUrl  URL absoluta de descarga (construida en la UI).
 * @param {string} email        Correo destino ya validado.
 * @returns {{ uri: string, tooLong: boolean }}
 */
function buildMailtoLink(item, absoluteUrl, email) {
    const tipo = Array.isArray(item.tags) && item.tags.includes('Mobile')
        ? 'Wallpaper Mobile'
        : 'Wallpaper PC';

    const subject = encodeURIComponent(`Tu ${tipo} de Love Arcade: ${item.name}`);

    const bodyRaw =
        `¡Hola!\n\n` +
        `Aquí está tu wallpaper de Love Arcade: "${item.name}".\n\n` +
        `Enlace de descarga:\n${absoluteUrl}\n\n` +
        `Instrucciones:\n` +
        `Abre este enlace en tu PC o dispositivo para descargar el archivo.\n` +
        `Si el enlace no funciona directamente, cópialo y pégalo en tu navegador.\n\n` +
        `— Love Arcade`;

    const body = encodeURIComponent(bodyRaw);
    const uri  = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;

    return { uri, tooLong: uri.length > MAILTO_MAX_LENGTH };
}

/**
 * Intenta copiar un texto al portapapeles.
 * Usa la Clipboard API moderna con fallback a execCommand.
 * @param {string} text
 * @returns {Promise<boolean>}  true si tuvo éxito.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (_2) {
            return false;
        }
    }
}

/** API pública del módulo de correo. */
window.MailHelper = {
    isValidEmail,
    saveLastMailRecipient,
    getLastMailRecipient,
    buildMailtoLink,
    copyToClipboard
};

// =====================================================
// FUNCIONES INTERNAS
// =====================================================

function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

/**
 * Formatea un número de monedas para la Navbar.
 * < 10 000 → número completo (ej: 9 500 → "9500")
 * ≥ 10 000 → formato "k" con un decimal si aplica (ej: 25 500 → "25.5k", 20 000 → "20k")
 * El Player Hub siempre recibe el número exacto; esta función es solo para .navbar .coin-display.
 * @param {number} n
 * @returns {string}
 */
function formatCoinsNavbar(n) {
    if (n < 10_000) return String(n);
    const k = n / 1000;
    // Usar un decimal solo si el resultado no es entero
    return (Number.isInteger(k) ? k : Math.floor(k * 10) / 10) + 'k';
}

function updateUI() {
    // Separar elementos: navbar (formato abreviado) vs. el resto (número exacto)
    const navbarDisplays = Array.from(
        document.querySelectorAll('.navbar .coin-display')
    );
    const otherDisplays = Array.from(
        document.querySelectorAll('.coin-display:not(.navbar .coin-display)')
    );

    if (_displayedCoins === store.coins) {
        // Sin delta: escribir valores formateados directamente, sin animación.
        // Evita sobrescribir el valor formateado que ya pintó el init silencioso.
        navbarDisplays.forEach(el => { el.textContent = formatCoinsNavbar(store.coins); });
        otherDisplays.forEach(el  => { el.textContent = store.coins; });
    } else {
        // Con delta: animar con número exacto y formatear navbar al terminar
        animateValue([...navbarDisplays, ...otherDisplays], _displayedCoins, store.coins);

        // Sobrescribir la navbar con el valor formateado al terminar la animación
        // (animateValue dura ~650 ms; con 700 ms de margen evitamos parpadeos)
        if (navbarDisplays.length) {
            setTimeout(() => {
                navbarDisplays.forEach(el => {
                    el.textContent = formatCoinsNavbar(store.coins);
                });
            }, 700);
        }
    }

    applyAvatar();
    updateDailyButton();
    updateMoonBlessingUI();
}

/** Exponer formatCoinsNavbar para uso en shop.html si fuera necesario. */
window.formatCoinsNavbar = formatCoinsNavbar;

function applyAvatar() {
    if (!store.userAvatar) return;
    // Selecciona el avatar de la navbar (#user-avatar-display) y el HUD (.hud-avatar)
    document.querySelectorAll('#user-avatar-display, #hud-avatar-display, .hud-avatar').forEach(el => {
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        const icon = el.querySelector('i, svg');
        if (icon) icon.style.display = 'none';
    });
}

function applyTheme(key) {
    const t    = THEMES[key] || THEMES.violet;
    const root = document.documentElement;

    // ── CSS custom properties (retrocompatibilidad con juegos) ────────────────
    root.style.setProperty('--accent',       t.accent);
    root.style.setProperty('--accent-hover', t.accent + 'cc');
    root.style.setProperty('--accent-glow',  t.glow);
    root.style.setProperty('--accent-dim',    t.accent + '99');
    root.style.setProperty('--accent-soft',   t.glow.replace(/[\d.]+\)$/, '0.12)'));
    root.style.setProperty('--accent-border', t.glow.replace(/[\d.]+\)$/, '0.38)'));

    // ── Clase en <body>: eliminar todas las anteriores y añadir la nueva ──────
    // Este es el mecanismo principal para que CSS pueda usar
    // body.theme-violet .selector { ... } sin variables dinámicas.
    const bodyClasses = document.body.classList;
    Object.keys(THEMES).forEach(k => bodyClasses.remove(`theme-${k}`));
    bodyClasses.add(`theme-${key}`);

    // ── data-theme en <html> (retrocompatibilidad con atributo CSS selector) ──
    document.documentElement.setAttribute('data-theme', key);

    // ── Actualizar estado visual de los botones de tema ───────────────────────
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('theme-btn--active', btn.dataset.theme === key);
    });
}

function updateDailyButton() {
    const btn = document.getElementById('btn-daily');
    if (!btn) return;

    const can  = window.GameCenter.canClaimDaily();
    const info = window.GameCenter.getStreakInfo();

    btn.disabled      = !can;
    btn.style.opacity = can ? '1' : '0.5';
    btn.style.cursor  = can ? 'pointer' : 'not-allowed';

    // HUD button: tiene elementos hijos específicos (#hud-reward-amount)
    const rewardEl = document.getElementById('hud-reward-amount');
    if (rewardEl) {
        // Solo actualizar la cifra; la etiqueta "BONO DIARIO" se queda fija
        if (!can) {
            rewardEl.textContent = `×${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const total = info.nextReward + (moonStatus.active ? 90 : 0);
            rewardEl.textContent = `+${total}`;
        }
        return; // HUD manejado: salir para no tocar el span genérico
    }

    // Botón clásico (por si se usa en otra vista)
    const span = btn.querySelector('span');
    if (span) {
        if (!can) {
            span.textContent = `Vuelve mañana · Racha: ${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const moonNote   = moonStatus.active ? ' +Luna' : '';
            span.textContent = `Bono Diario (+${info.nextReward}${moonNote})`;
        }
    }
}

function updateMoonBlessingUI() {
    const status   = window.GameCenter.getMoonBlessingStatus();
    const moonBadges = document.querySelectorAll('.moon-blessing-badge');

    moonBadges.forEach(badge => {
        badge.classList.toggle('hidden', !status.active);
        if (status.active) {
            badge.title = `Bendición Lunar activa hasta ${status.expiresAt}`;
        }
    });

    // Botón de compra en tienda
    const moonBtn = document.getElementById('btn-moon-blessing');
    if (moonBtn) {
        const statusEl = document.getElementById('moon-blessing-status');
        if (status.active) {
            moonBtn.textContent = 'Extender Bendición (+7 días)';
            if (statusEl) statusEl.textContent = `Activa hasta ${status.expiresAt}`;
        } else {
            moonBtn.textContent = 'Activar Bendición Lunar (100 monedas)';
            if (statusEl) statusEl.textContent = 'Inactiva';
        }
    }
}

// =====================================================
// REVEAL UI — v9.3 Zero-Flicker
// =====================================================
/**
 * Añade la clase .is-ready a los contenedores de datos críticos,
 * disparando su transición de opacidad (0 → 1) en el siguiente frame.
 * Se llama DESPUÉS de escribir los valores correctos en el DOM para que
 * el usuario nunca vea el estado "vacío" o con datos por defecto del HTML.
 */
function revealUI() {
    requestAnimationFrame(() => {
        // coin-badge: usa su propia clase para compatibilidad con v9.2
        document.querySelectorAll('.coin-badge').forEach(el => {
            el.classList.add('coin-badge--visible');
        });
        // hud-avatar-wrap: se revela solo cuando el avatar (o el placeholder)
        // ya está correctamente pintado
        document.querySelectorAll('.hud-avatar-wrap').forEach(el => {
            el.classList.add('is-ready');
        });
        // player-hud: se revela completo una vez que botón diario, countdown
        // y barras de racha están en su estado correcto en el DOM oculto.
        // Esto evita:
        //  - El fade del botón disabled (transition:all disparada por CSS)
        //  - El layout-shift del countdown (display:none → block mueve .hud-streak)
        document.querySelectorAll('.player-hud').forEach(el => {
            el.classList.add('is-ready');
        });
    });
}
// Expuesta globalmente para que el inline script de index.html pueda llamarla
// DESPUÉS de que updateStreakBar() y updateCountdownDisplay() hayan corrido.
window.revealUI = revealUI;

// =====================================================
// INIT SÍNCRONO — v9.3 Zero-Flicker Initiative
// ─────────────────────────────────────────────────────────────────────────────
// app.js está posicionado al FINAL de <body>. En ese punto el navegador ya
// ha parseado todo el HTML y los elementos del DOM existen, pero NO ha
// realizado el primer layout/paint todavía (las scripts síncronas bloquean el
// render). Esto nos permite escribir datos reales en el DOM ANTES de que el
// usuario vea cualquier píxel, eliminando los tres tipos de parpadeo:
//
//   1. Theme Flash     → applyTheme() antes del primer paint
//   2. Coin Jitter     → escribe saldo formateado antes del primer paint
//   3. State Sync Gap  → updateDailyButton() y updateMoonBlessingUI() inmediatos
// =====================================================

// 1. TEMA — elimina el "salto violeta" para cualquier usuario con otro tema.
//    El script crítico del <head> ya habrá ajustado los CSS vars; applyTheme()
//    añade la clase theme-{key} al <body> y actualiza los botones de ajustes.
applyTheme(store.theme || 'violet');

// 2. SALDO — escribe el valor formateado síncronamente.
//    El .coin-badge tiene opacity:0 por CSS; nunca pintará el "0" del HTML.
_displayedCoins = store.coins;
document.querySelectorAll('.navbar .coin-display').forEach(el => {
    el.textContent = formatCoinsNavbar(store.coins);
});
document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => {
    el.textContent = store.coins;
});

// 3. BOTÓN DIARIO Y LUNA — corrige el estado (activo/desactivado, texto de
//    recompensa) antes del primer paint, eliminando el "salto de estado".
updateDailyButton();
updateMoonBlessingUI();

// 4. AVATAR — aplica la imagen guardada síncronamente (si existe).
applyAvatar();

// NOTA: revealUI() se llama desde el inline script de index.html, DESPUÉS de
// que updateStreakBar() y updateCountdownDisplay() también hayan corrido.
// Esto garantiza que .player-hud se revela con TODOS sus estados correctos
// (botón, countdown, barras de racha y avatar) en un solo RAF.

// =====================================================
// EVENT LISTENERS — DOMContentLoaded
// Los listeners no afectan al primer paint; se registran aquí por claridad.
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Re-sincronizar UI por si algún sub-módulo modificó el DOM
    updateUI();
    if (window.lucide) lucide.createIcons();

    // Avatar upload
    const avatarInput = document.getElementById('avatar-upload');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                window.GameCenter.setAvatar(evt.target.result);
                if (window.lucide) lucide.createIcons();
            };
            reader.readAsDataURL(file);
        });
    }

    // Bono diario — el botón se desactiva SÍNCRONAMENTE antes de cualquier operación
    // asíncrona para prevenir el "double-tap bug" (race condition por clics rápidos).
    const dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', async () => {
            // ── Paso 1: desactivar de inmediato (síncrono) ──
            dailyBtn.disabled      = true;
            dailyBtn.style.opacity = '0.5';
            dailyBtn.style.cursor  = 'not-allowed';

            // Feedback visual "Procesando…" en el elemento de texto del botón
            const rewardEl = document.getElementById('hud-reward-amount');
            const span     = dailyBtn.querySelector('span');

            if (rewardEl)  rewardEl.textContent = '...';
            else if (span) span.textContent     = 'Procesando...';

            // ── Paso 2: ejecutar la lógica asíncrona ──
            const result = await window.GameCenter.claimDaily();

            // ── Paso 3: mostrar mensaje y actualizar UI ──
            const msg = document.getElementById('daily-msg');
            if (msg) {
                msg.textContent   = result.message;
                msg.style.color   = result.success ? '#4ade80' : '#facc15';
                msg.style.opacity = '1';
                setTimeout(() => { msg.style.opacity = '0'; }, 3500);
            }

            // updateDailyButton() recalcula el estado correcto del botón
            // (puede habilitarlo si el reclamo falló por error recuperable,
            //  o dejarlo desactivado con el contador si fue exitoso).
            updateDailyButton();
        });
    }

    // Botón Bendición Lunar
    const moonBtn = document.getElementById('btn-moon-blessing');
    if (moonBtn) {
        moonBtn.addEventListener('click', () => {
            const result = window.GameCenter.buyMoonBlessing();
            const msg    = document.getElementById('moon-blessing-msg');
            if (result.success) {
                if (msg) { msg.textContent = `✓ Activa hasta ${result.expiresAt}`; msg.style.color = '#c084fc'; }
            } else {
                if (msg) { msg.textContent = '✗ Monedas insuficientes (necesitas 100)'; msg.style.color = '#ff4757'; }
            }
            if (msg) { msg.style.opacity = '1'; setTimeout(() => { msg.style.opacity = '0'; }, 3500); }
        });
    }
});
