/**
 * Game Center Core v7.2 - Phase 2: Engagement & Polish
 * Compatible con gamecenter_v6_promos — NO modificar stateKey
 */

const CONFIG = {
    stateKey: 'gamecenter_v6_promos',
    initialCoins: 0,
    dailyReward: 20,
    wallpapersPath: 'wallpapers/'
};

// =====================================================
// ECONOMÍA — Editar aquí para eventos especiales
// =====================================================
const ECONOMY = {
    isSaleActive: false,      // true = descuento global activo
    saleMultiplier: 0.8,      // 0.8 = 20% de descuento
    saleLabel: '20% OFF',     // Badge de oferta
    cashbackRate: 0.1         // 10% de cashback en cada compra
};
window.ECONOMY = ECONOMY;

// =====================================================
// TEMAS
// =====================================================
const THEMES = {
    violet: { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:   { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:   { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:   { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' }
};
window.THEMES = THEMES;

// =====================================================
// CÓDIGOS SECRETOS
// =====================================================
const PROMO_CODES = {
    'GOUL50': 50, 'AMRO50': 50, 'GOVE50': 50, 'FU50': 50,
    'GO50': 50, 'GOBR50': 50, 'CH50': 50, 'ASYA50': 50,
    'MINA50': 50, 'SA50': 50, 'TRFU50': 50, 'VEZA50': 50,
    'JADO50': 50, 'JADOUNO50': 50, 'JADODOS50': 50, 'JADOTRES50': 50,
    'HAMI50': 50, 'MA50': 50, 'XI50': 50, 'LADEHI50': 50,
    'HIGO50': 50, 'KAWA50': 50, 'SACAME': 60, 'SAMUEL1000': 1000,
    'FEB14': 500, 'SOFYEK300': 300, 'ERRORRC': 200
};

// =====================================================
// ESTADO — defaultState incluye todos los campos v7+
// =====================================================
const defaultState = {
    coins: CONFIG.initialCoins,
    progress: { maze: [], wordsearch: [], secretWordsFound: [] },
    inventory: {},
    redeemedCodes: [],
    history: [],
    userAvatar: null,
    lastDaily: null,
    theme: 'violet'   // ← v7.2
};

let store = { ...defaultState };

try {
    const raw = localStorage.getItem(CONFIG.stateKey);
    if (raw) store = { ...defaultState, ...JSON.parse(raw) };
} catch (e) {
    console.error('GameCenter: Error al cargar estado', e);
    store = { ...defaultState };
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
        const p = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        elements.forEach(el => el.textContent = Math.round(start + range * eased));
        if (p < 1) requestAnimationFrame(step);
        else _displayedCoins = end;
    };
    requestAnimationFrame(step);
}

// =====================================================
// API PÚBLICA
// =====================================================
window.GameCenter = {

    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) return { paid: false, coins: store.coins };
        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        saveState();
        return { paid: true, coins: store.coins };
    },

    buyItem: (itemData) => {
        const bought = store.inventory[itemData.id] || 0;
        if (bought >= itemData.stock) return { success: false, reason: 'stock' };

        const finalPrice = ECONOMY.isSaleActive
            ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
            : itemData.price;

        if (store.coins < finalPrice) return { success: false, reason: 'coins' };

        const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);

        store.coins -= finalPrice;
        store.coins += cashback;
        store.inventory[itemData.id] = bought + 1;

        store.history.push({
            itemId: itemData.id,
            name: itemData.name,
            price: finalPrice,
            originalPrice: itemData.price,
            cashback,
            file: itemData.file || null,
            date: new Date().toISOString()
        });

        saveState();
        return { success: true, finalPrice, cashback };
    },

    redeemPromoCode: (inputCode) => {
        const code = inputCode.trim().toUpperCase();
        const reward = PROMO_CODES[code];
        if (!reward) return { success: false, message: 'Código inválido' };
        if (store.redeemedCodes.includes(code)) return { success: false, message: 'Ya canjeaste este código' };
        store.coins += reward;
        store.redeemedCodes.push(code);
        store.history.push({ itemId: 'promo_code', name: `Código: ${code}`, date: new Date().toISOString() });
        saveState();
        return { success: true, reward, message: `¡+${reward} Monedas!` };
    },

    getDownloadUrl: (itemId, fileName) => {
        if (!fileName) return null;
        return (store.inventory[itemId] || 0) > 0 ? CONFIG.wallpapersPath + fileName : null;
    },

    claimDaily: () => {
        const today = new Date().toISOString().split('T')[0];
        if (store.lastDaily === today) return { success: false, message: 'Ya reclamaste tu bono hoy. ¡Vuelve mañana!' };
        store.coins += CONFIG.dailyReward;
        store.lastDaily = today;
        saveState();
        return { success: true, reward: CONFIG.dailyReward, message: `¡+${CONFIG.dailyReward} monedas de bono diario!` };
    },

    canClaimDaily: () => store.lastDaily !== new Date().toISOString().split('T')[0],

    exportSave: () => {
        try { return btoa(unescape(encodeURIComponent(JSON.stringify(store)))); }
        catch { return null; }
    },

    importSave: (code) => {
        try {
            const data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
            if (typeof data.coins !== 'number') throw new Error('invalid');
            store = { ...defaultState, ...data };
            saveState();
            return { success: true };
        } catch { return { success: false, message: 'Código inválido o corrupto.' }; }
    },

    setAvatar: (dataUrl) => { store.userAvatar = dataUrl; saveState(); applyAvatar(); },
    getAvatar: () => store.userAvatar,

    setTheme: (key) => {
        if (!THEMES[key]) return;
        store.theme = key;
        saveState();
        applyTheme(key);
    },
    getTheme: () => store.theme || 'violet',

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance: () => store.coins,
    getInventory: () => ({ ...store.inventory })
};

// =====================================================
// FUNCIONES INTERNAS
// =====================================================
function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

function updateUI() {
    const displays = Array.from(document.querySelectorAll('.coin-display'));
    animateValue(displays, _displayedCoins, store.coins);
    applyAvatar();
    updateDailyButton();
}

function applyAvatar() {
    if (!store.userAvatar) return;
    document.querySelectorAll('#user-avatar-display').forEach(el => {
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        const icon = el.querySelector('i');
        if (icon) icon.style.display = 'none';
    });
}

function applyTheme(key) {
    const t = THEMES[key] || THEMES.violet;
    const root = document.documentElement;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-hover', t.accent + 'cc');
    root.style.setProperty('--accent-glow', t.glow);
    // Actualiza botones de tema en la UI
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('theme-btn--active', btn.dataset.theme === key);
    });
}

function updateDailyButton() {
    const btn = document.getElementById('btn-daily');
    if (!btn) return;
    const can = window.GameCenter.canClaimDaily();
    btn.disabled = !can;
    btn.style.opacity = can ? '1' : '0.5';
    btn.style.cursor = can ? 'pointer' : 'not-allowed';
    btn.querySelector('span').textContent = can ? `Bono Diario (+${CONFIG.dailyReward})` : 'Vuelve mañana';
}

// =====================================================
// INIT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema ANTES del primer paint para evitar flash
    applyTheme(store.theme || 'violet');
    _displayedCoins = store.coins;
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

    // Daily bonus
    const dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
            const result = window.GameCenter.claimDaily();
            const msg = document.getElementById('daily-msg');
            if (msg) {
                msg.textContent = result.message;
                msg.style.color = result.success ? '#4ade80' : '#facc15';
                msg.style.opacity = '1';
                setTimeout(() => { msg.style.opacity = '0'; }, 3000);
            }
            updateDailyButton();
        });
    }

    // Theme buttons (funciona en cualquier página)
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => window.GameCenter.setTheme(btn.dataset.theme));
        btn.classList.toggle('theme-btn--active', btn.dataset.theme === (store.theme || 'violet'));
    });
});
