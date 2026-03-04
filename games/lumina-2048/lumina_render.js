/**
 * lumina_render.js — Capa Visual Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 2 / 5: Manipulación del DOM, animaciones CSS y partículas.
 * Usa variables CSS --tile-x / --tile-y para posicionar fichas.
 * Gestiona el canvas de partículas con requestAnimationFrame.
 */

'use strict';

// ─── Paleta de Fichas ─────────────────────────────────────────────────────────
// Frío (2–16) → Cálido (32–256) → Regio (512–2048+)
const lumina_TILE_PALETTE = {
    2:    { bg: 'rgba(0,245,255,0.10)',   glow: '#00f5ff', text: '#cffafe' },
    4:    { bg: 'rgba(20,230,210,0.13)',  glow: '#14e6d2', text: '#ccfbf1' },
    8:    { bg: 'rgba(0,200,170,0.16)',   glow: '#00c8aa', text: '#99f6e4' },
    16:   { bg: 'rgba(0,170,130,0.20)',   glow: '#00aa82', text: '#6ee7b7' },
    32:   { bg: 'rgba(245,185,11,0.16)',  glow: '#f5b90b', text: '#fde68a' },
    64:   { bg: 'rgba(249,115,22,0.20)',  glow: '#f97316', text: '#fed7aa' },
    128:  { bg: 'rgba(239,68,68,0.20)',   glow: '#ef4444', text: '#fecaca' },
    256:  { bg: 'rgba(220,38,38,0.26)',   glow: '#dc2626', text: '#fca5a5' },
    512:  { bg: 'rgba(124,58,237,0.22)',  glow: '#7c3aed', text: '#ddd6fe' },
    1024: { bg: 'rgba(168,85,247,0.26)',  glow: '#a855f7', text: '#e9d5ff' },
    2048: { bg: 'rgba(236,72,153,0.30)',  glow: '#ec4899', text: '#ffffff' },
};

function lumina_getTilePalette(value) {
    const keys = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    for (let i = keys.length - 1; i >= 0; i--)
        if (value >= keys[i]) return lumina_TILE_PALETTE[keys[i]];
    return lumina_TILE_PALETTE[2];
}

// ─── Estado del Renderer ──────────────────────────────────────────────────────
let lumina_boardEl         = null;
let lumina_scoreEl         = null;
let lumina_bestScoreEl     = null;
let lumina_comboBarEl      = null;
let lumina_comboContainerEl = null;
let lumina_particleCanvas  = null;
let lumina_particleCtx     = null;
let lumina_particles       = [];
let lumina_particleRAF     = null;
let lumina_parallaxEl      = null;
let lumina_parallaxTargetX = 0;
let lumina_parallaxTargetY = 0;
let lumina_parallaxCurrentX = 0;
let lumina_parallaxCurrentY = 0;

/** Mapa ID ficha → elemento DOM */
const lumina_tileEls = new Map();

// ─── Inicialización ───────────────────────────────────────────────────────────

function lumina_initRenderer() {
    lumina_boardEl          = document.getElementById('lumina-board');
    lumina_scoreEl          = document.getElementById('lumina-score');
    lumina_bestScoreEl      = document.getElementById('lumina-best');
    lumina_comboBarEl       = document.getElementById('lumina-combo-bar');
    lumina_comboContainerEl = document.getElementById('lumina-combo-container');
    lumina_particleCanvas   = document.getElementById('lumina-particles');
    lumina_parallaxEl       = document.getElementById('lumina-bg-parallax');

    // Crear celdas de fondo de la grilla
    if (lumina_boardEl) {
        for (let i = 0; i < lumina_GRID_SIZE * lumina_GRID_SIZE; i++) {
            const cell = document.createElement('div');
            cell.className = 'lumina-cell';
            lumina_boardEl.appendChild(cell);
        }
    }

    if (lumina_particleCanvas) {
        lumina_particleCtx = lumina_particleCanvas.getContext('2d');
        lumina_resizeParticleCanvas();
        window.addEventListener('resize', lumina_resizeParticleCanvas);
    }

    lumina_initParallax();
}

function lumina_resizeParticleCanvas() {
    if (!lumina_particleCanvas) return;
    lumina_particleCanvas.width  = window.innerWidth;
    lumina_particleCanvas.height = window.innerHeight;
}

// ─── Render del Tablero ───────────────────────────────────────────────────────

function lumina_renderGrid() {
    if (!lumina_boardEl) return;

    const currentIds = new Set();
    for (let r = 0; r < lumina_GRID_SIZE; r++) {
        for (let c = 0; c < lumina_GRID_SIZE; c++) {
            const tile = lumina_grid[r][c];
            if (!tile) continue;
            currentIds.add(tile.id);
            lumina_syncTileEl(tile, r, c);
        }
    }

    // Eliminar fichas que ya no existen
    for (const [id, el] of lumina_tileEls) {
        if (!currentIds.has(id)) {
            el.remove();
            lumina_tileEls.delete(id);
        }
    }
}

function lumina_syncTileEl(tile, row, col) {
    let el = lumina_tileEls.get(tile.id);
    const pal = lumina_getTilePalette(tile.value);
    const digits = String(tile.value).length;

    if (!el) {
        el = document.createElement('div');
        el.className = 'lumina-tile';
        lumina_boardEl.appendChild(el);
        lumina_tileEls.set(tile.id, el);
    }

    // Posición via CSS custom properties
    el.style.setProperty('--tile-x', col);
    el.style.setProperty('--tile-y', row);
    el.dataset.digits = digits > 4 ? '5' : digits;

    if (tile.isEnergy) {
        el.innerHTML = `<span class="lumina-e-icon">⚡</span><span class="lumina-e-label">ENERGY</span>`;
        el.style.background = 'rgba(255,255,255,0.07)';
        el.style.boxShadow  = '0 0 18px rgba(255,255,255,0.25), 0 0 40px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.15)';
        el.style.color      = '#ffffff';
        el.style.border     = '1px solid rgba(255,255,255,0.25)';
        el.style.textShadow = '0 0 12px rgba(255,255,255,0.8)';
    } else {
        el.textContent = tile.value;
        const glowA    = tile.value >= 512 ? '99' : '55';
        const glowB    = tile.value >= 512 ? '44' : '22';
        const spread   = 10 + Math.log2(tile.value) * 2;
        el.style.background = pal.bg;
        el.style.boxShadow  = `0 0 ${spread}px ${pal.glow}${glowA}, 0 0 ${spread * 2}px ${pal.glow}${glowB}, inset 0 1px 0 rgba(255,255,255,0.10)`;
        el.style.color      = pal.text;
        el.style.border     = `1px solid ${pal.glow}33`;
        el.style.textShadow = `0 0 8px ${pal.glow}`;
    }

    // Clases de animación
    el.classList.remove('lumina-tile--new', 'lumina-tile--merged', 'lumina-tile--energy');
    if (tile.isEnergy) el.classList.add('lumina-tile--energy');
    if (tile.isNew)    el.classList.add('lumina-tile--new');
    if (tile.isMerged) el.classList.add('lumina-tile--merged');
}

// ─── Score ────────────────────────────────────────────────────────────────────

function lumina_updateScoreDisplay(prevScore) {
    if (lumina_scoreEl)     lumina_scoreEl.textContent     = lumina_score.toLocaleString();
    if (lumina_bestScoreEl) lumina_bestScoreEl.textContent = lumina_bestScore.toLocaleString();
    const diff = lumina_score - (prevScore || 0);
    if (diff > 0) lumina_showScorePop(diff);
}

function lumina_showScorePop(diff) {
    const container = document.getElementById('lumina-score-wrap');
    if (!container) return;
    const pop = document.createElement('div');
    pop.className = 'lumina-score-pop';
    pop.textContent = '+' + diff.toLocaleString();
    container.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
}

// ─── Combo Meter ──────────────────────────────────────────────────────────────

function lumina_updateComboMeter() {
    if (!lumina_comboBarEl) return;
    lumina_comboBarEl.style.width = lumina_comboMeter + '%';
    // Colores: cian → magenta conforme se llena
    const hue = Math.round(180 - lumina_comboMeter * 1.5);
    lumina_comboBarEl.style.background = `linear-gradient(90deg, hsl(${hue},100%,65%), hsl(${hue - 40},100%,70%))`;
    lumina_comboBarEl.style.boxShadow  = `0 0 10px hsl(${hue},100%,60%)88`;
}

function lumina_triggerComboFlash() {
    if (!lumina_comboContainerEl) return;
    lumina_comboContainerEl.classList.remove('lumina-combo--flash');
    void lumina_comboContainerEl.offsetWidth; // reflow para re-trigger
    lumina_comboContainerEl.classList.add('lumina-combo--flash');
}

// ─── Sistema de Partículas ────────────────────────────────────────────────────

/**
 * Emite partículas de luz en la posición de una ficha del tablero.
 * Solo activo para fusiones de 128 en adelante.
 * @param {number} col - columna (0-3)
 * @param {number} row - fila (0-3)
 * @param {number} value - valor de la ficha fusionada
 */
function lumina_spawnParticles(col, row, value) {
    if (!lumina_particleCanvas || !lumina_boardEl || value < 128) return;

    const pal  = lumina_getTilePalette(value);
    const rect = lumina_boardEl.getBoundingClientRect();
    const cell = rect.width / lumina_GRID_SIZE;
    const cx   = rect.left + col * cell + cell / 2;
    const cy   = rect.top  + row * cell + cell / 2;

    const count = Math.min(10 + Math.log2(value) * 2, 50);
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i / count) + Math.random() * 0.6;
        const speed = 1.5 + Math.random() * 3.5;
        lumina_particles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            life: 1,
            decay: 0.018 + Math.random() * 0.022,
            size: 2 + Math.random() * 3,
            color: pal.glow,
        });
    }

    if (!lumina_particleRAF) lumina_animateParticles();
}

function lumina_animateParticles() {
    if (!lumina_particleCtx) return;
    lumina_particleCtx.clearRect(0, 0, lumina_particleCanvas.width, lumina_particleCanvas.height);

    lumina_particles = lumina_particles.filter(p => p.life > 0.02);

    for (const p of lumina_particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.09;     // gravedad suave
        p.life -= p.decay;

        lumina_particleCtx.save();
        lumina_particleCtx.globalAlpha  = Math.max(0, p.life);
        lumina_particleCtx.fillStyle    = p.color;
        lumina_particleCtx.shadowBlur   = 8;
        lumina_particleCtx.shadowColor  = p.color;
        lumina_particleCtx.beginPath();
        lumina_particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        lumina_particleCtx.fill();
        lumina_particleCtx.restore();
    }

    if (lumina_particles.length > 0) {
        lumina_particleRAF = requestAnimationFrame(lumina_animateParticles);
    } else {
        lumina_particleRAF = null;
    }
}

// ─── Parallax Giroscopio ──────────────────────────────────────────────────────

function lumina_initParallax() {
    if (!lumina_parallaxEl) return;

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            if (e.gamma !== null && e.beta !== null) {
                lumina_parallaxTargetX = Math.max(-12, Math.min(12, e.gamma  / 3.5));
                lumina_parallaxTargetY = Math.max(-12, Math.min(12, (e.beta - 45) / 3.5));
            }
        });
    }

    (function lumina_parallaxLoop() {
        lumina_parallaxCurrentX += (lumina_parallaxTargetX - lumina_parallaxCurrentX) * 0.04;
        lumina_parallaxCurrentY += (lumina_parallaxTargetY - lumina_parallaxCurrentY) * 0.04;
        if (lumina_parallaxEl) {
            lumina_parallaxEl.style.transform =
                `translate(${lumina_parallaxCurrentX}px, ${lumina_parallaxCurrentY}px) scale(1.06)`;
        }
        requestAnimationFrame(lumina_parallaxLoop);
    })();
}

// ─── Modales ──────────────────────────────────────────────────────────────────

function lumina_showGameOver() {
    const modal = document.getElementById('lumina-modal-gameover');
    const el    = document.getElementById('lumina-final-score');
    if (el)    el.textContent = lumina_score.toLocaleString();
    if (modal) modal.classList.add('lumina-modal--visible');
}

function lumina_showWin() {
    const modal = document.getElementById('lumina-modal-win');
    const el    = document.getElementById('lumina-win-score');
    if (el)    el.textContent = lumina_score.toLocaleString();
    if (modal) modal.classList.add('lumina-modal--visible');
}

function lumina_hideModals() {
    document.querySelectorAll('.lumina-modal').forEach(m => m.classList.remove('lumina-modal--visible'));
}

/** Elimina todos los elementos-ficha del DOM. */
function lumina_clearBoard() {
    lumina_tileEls.forEach(el => el.remove());
    lumina_tileEls.clear();
}

console.log('[LUMINA] Render module v1.0 loaded.');
