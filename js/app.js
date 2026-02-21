/**
 * Game Center Core v7 - Plataforma de Recompensas
 * Compatible con datos de gamecenter_v6_promos
 */

const CONFIG = {
    stateKey: 'gamecenter_v6_promos',
    initialCoins: 0,
    dailyReward: 20,
    wallpapersPath: 'wallpapers/'
};

// --- LISTA DE CÓDIGOS SECRETOS ---
const PROMO_CODES = {
    'GOUL50': 50,
    'AMRO50': 50,
    'GOVE50': 50,
    'FU50': 50,
    'GO50': 50,
    'GOBR50': 50,
    'CH50': 50,
    'ASYA50': 50,
    'MINA50': 50,
    'SA50': 50,
    'TRFU50': 50,
    'VEZA50': 50,
    'JADO50': 50,
    'JADOUNO50': 50,
    'JADODOS50': 50,
    'JADOTRES50': 50,
    'HAMI50': 50,
    'MA50': 50,
    'XI50': 50,
    'LADEHI50': 50,
    'HIGO50': 50,
    'KAWA50': 50,
    'SACAME': 60,
    'SAMUEL1000': 1000,
    'FEB14': 500,
    'SOFYEK300': 300,
    'ERRORRC': 200
};

const defaultState = {
    coins: CONFIG.initialCoins,
    progress: { maze: [], wordsearch: [], secretWordsFound: [] },
    inventory: {},
    redeemedCodes: [],
    history: [],
    userAvatar: null,
    lastDaily: null
};

let store = { ...defaultState };

// --- Carga de estado (compatible con v6) ---
try {
    const data = localStorage.getItem(CONFIG.stateKey);
    if (data) {
        store = { ...defaultState, ...JSON.parse(data) };
    }
} catch (e) {
    console.error("Error cargando GameCenter:", e);
    store = { ...defaultState };
}

// --- API PÚBLICA ---
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
        if (store.coins < itemData.price) return { success: false, reason: 'coins' };
        store.coins -= itemData.price;
        store.inventory[itemData.id] = bought + 1;
        store.history.push({
            itemId: itemData.id,
            name: itemData.name,
            price: itemData.price,
            file: itemData.file || null,
            date: new Date().toISOString()
        });
        saveState();
        return { success: true };
    },

    redeemPromoCode: (inputCode) => {
        const code = inputCode.trim().toUpperCase();
        const reward = PROMO_CODES[code];
        if (!reward) return { success: false, message: "Código inválido" };
        if (store.redeemedCodes.includes(code)) return { success: false, message: "Ya canjeaste este código" };
        store.coins += reward;
        store.redeemedCodes.push(code);
        store.history.push({
            itemId: 'promo_code',
            name: `Código: ${code}`,
            code: 'CANJEADO',
            date: new Date().toISOString()
        });
        saveState();
        return { success: true, reward, message: `¡+${reward} Monedas!` };
    },

    // --- La Bóveda: URL de descarga validada por inventario ---
    getDownloadUrl: (itemId, fileName) => {
        if (!fileName) return null;
        const count = store.inventory[itemId] || 0;
        if (count <= 0) return null;
        return CONFIG.wallpapersPath + fileName;
    },

    // --- Bono Diario ---
    claimDaily: () => {
        const today = new Date().toISOString().split('T')[0];
        if (store.lastDaily === today) {
            return { success: false, message: 'Ya reclamaste tu bono hoy. ¡Vuelve mañana!' };
        }
        store.coins += CONFIG.dailyReward;
        store.lastDaily = today;
        saveState();
        return { success: true, reward: CONFIG.dailyReward, message: `¡+${CONFIG.dailyReward} monedas de bono diario!` };
    },

    canClaimDaily: () => {
        const today = new Date().toISOString().split('T')[0];
        return store.lastDaily !== today;
    },

    // --- Sincronización: Exportar partida ---
    exportSave: () => {
        try {
            return btoa(unescape(encodeURIComponent(JSON.stringify(store))));
        } catch (e) {
            return null;
        }
    },

    // --- Sincronización: Importar partida ---
    importSave: (code) => {
        try {
            const raw = decodeURIComponent(escape(atob(code.trim())));
            const data = JSON.parse(raw);
            // Validación mínima
            if (typeof data.coins !== 'number') throw new Error('invalid');
            store = { ...defaultState, ...data };
            saveState();
            return { success: true };
        } catch (e) {
            return { success: false, message: 'Código inválido o corrupto.' };
        }
    },

    // --- Avatar ---
    setAvatar: (dataUrl) => {
        store.userAvatar = dataUrl;
        saveState();
        applyAvatar();
    },

    getAvatar: () => store.userAvatar,

    // --- Helpers ---
    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance: () => store.coins,
    getInventory: () => ({ ...store.inventory })
};

// --- Guardar y actualizar UI ---
function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

function updateUI() {
    document.querySelectorAll('.coin-display').forEach(el => el.textContent = store.coins);
    applyAvatar();
    updateDailyButton();
}

function applyAvatar() {
    if (!store.userAvatar) return;
    document.querySelectorAll('#user-avatar-display').forEach(el => {
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        // Ocultar icono por defecto si hay avatar
        const icon = el.querySelector('i');
        if (icon) icon.style.display = 'none';
    });
}

function updateDailyButton() {
    const btn = document.getElementById('btn-daily');
    if (!btn) return;
    const canClaim = window.GameCenter.canClaimDaily();
    btn.disabled = !canClaim;
    btn.style.opacity = canClaim ? '1' : '0.5';
    btn.style.cursor = canClaim ? 'pointer' : 'not-allowed';
    btn.querySelector('span').textContent = canClaim ? `Bono Diario (+${CONFIG.dailyReward})` : 'Vuelve mañana';
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    if (window.lucide) lucide.createIcons();

    // Avatar upload handler (funciona en cualquier página que tenga el input)
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

    // Daily button handler
    const dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
            const result = window.GameCenter.claimDaily();
            const msg = document.getElementById('daily-msg');
            if (msg) {
                msg.textContent = result.message;
                msg.style.color = result.success ? '#4ade80' : '#facc15';
                msg.style.opacity = '1';
                setTimeout(() => msg.style.opacity = '0', 3000);
            }
            updateDailyButton();
        });
    }
});
