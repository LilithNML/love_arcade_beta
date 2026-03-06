/**
 * lumina_render.js — Capa Visual · 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 2 / 5: Manipulación del DOM, animaciones CSS y partículas.
 * Usa variables CSS --tile-x / --tile-y para posicionar fichas.
 * Gestiona el canvas de partículas con requestAnimationFrame.
 *
 * CHANGELOG v2.0 — Rediseño Solid Modernism
 * ──────────────────────────────────────────
 * [REDESIGN] lumina_TILE_PALETTE: paleta completamente nueva.
 *            Azules/violetas profundos para valores bajos →
 *            naranjas/ámbar vibrantes para valores altos.
 *            Colores completamente sólidos (sin rgba semitransparentes).
 *            La ficha 2048 es la ÚNICA con gradiente (brief §3).
 *            La energía ⚡ usa azul eléctrico sólido (#0B4D72).
 * [REDESIGN] lumina_syncTileEl: eliminados box-shadow con glow de color,
 *            textShadow de color e inline border de color. El "peso" visual
 *            de cada ficha viene ahora del color sólido y la tipografía 900,
 *            no de efectos de luz. La profundidad la aporta el border-bottom
 *            definido en CSS (flat design sombreado, brief §4).
 * [REDESIGN] Eliminado el parallax completo: lumina_parallaxEl,
 *            lumina_parallaxRAF, lumina_parallaxTargetX/Y,
 *            lumina_parallaxCurrentX/Y, lumina_parallaxStep(),
 *            lumina_startParallaxLoop(), lumina_initParallax() y
 *            lumina_PARALLAX_IDLE_THRESHOLD. El fondo del juego es ahora
 *            un color sólido #0F1115 (brief §2, "Fondo: Dark Mode real").
 * [REDESIGN] lumina_onVisibilityChange: refactorizado para gestionar solo
 *            partículas y AudioContext (sin referencias al parallax).
 * [REDESIGN] lumina_initRenderer: eliminadas referencias a parallax.
 *
 * CHANGELOG v1.3 — Optimización de Rendimiento (retenido)
 * ──────────────────────────────────────────────────────────
 * [PERF] Idle State del Loop de Partículas y parallax.
 * [PERF] Page Visibility API.
 * [PERF] Sistema LOD — lumina_detectQuality().
 * [PERF] Frame-time adaptativo.
 * [PERF] Caché de estilos lumina_tileValueCache.
 *
 * CHANGELOG v1.2
 * ──────────────
 * [NEW]  lumina_animateCoinCount(el, target): animador 500 ms easeOutCubic.
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Z-Index de Partículas elevado a 50.
 * [NEW]  lumina_spawnConfetti().
 */

'use strict';

// ─── Paleta de Fichas — v2.0 Solid Modernism ──────────────────────────────────
//
// Dos ejes de jerarquía visual:
//   · Eje de saturación: valores bajos = azules oscuros (casi fundidos con
//     el fondo); valores altos = naranjas/ámbar vibrantes (máxima atención).
//   · Eje de luminosidad: crece con el valor para reforzar la jerarquía.
//
// Regla: SOLO la ficha 2048 tiene gradiente (brief §3, "solo en hito visual").
// El resto son colores completamente sólidos, sin rgba semitransparente.
//
const lumina_TILE_PALETTE = {
    2:    { bg: '#1D2444', text: '#4A607E' },   // azul muy oscuro, casi invisible
    4:    { bg: '#1C3068', text: '#7EB4E8' },   // azul marino
    8:    { bg: '#1350A8', text: '#A8CCFF' },   // azul medio
    16:   { bg: '#1860C8', text: '#C8E2FF' },   // azul brillante
    32:   { bg: '#3040E0', text: '#D4DCFF' },   // azul-índigo
    64:   { bg: '#7C3AED', text: '#EDE0FF' },   // violeta (acento plataforma)
    128:  { bg: '#9C27B0', text: '#F4D8FF' },   // violeta oscuro
    256:  { bg: '#B82810', text: '#FFD0C0' },   // rojo-naranja oscuro
    512:  { bg: '#E84808', text: '#FFE8D8' },   // naranja vibrante
    1024: { bg: '#D97706', text: '#FFF8E0' },   // ámbar cálido
    2048: { bg: 'linear-gradient(135deg,#F59E0B 0%,#F97316 100%)', text: '#FFFFFF' },
};

function lumina_getTilePalette(value) {
    const keys = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    for (let i = keys.length - 1; i >= 0; i--)
        if (value >= keys[i]) return lumina_TILE_PALETTE[keys[i]];
    return lumina_TILE_PALETTE[2];
}

// ─── Estado del Renderer ──────────────────────────────────────────────────────
let lumina_boardEl          = null;
let lumina_scoreEl          = null;
let lumina_bestScoreEl      = null;
let lumina_comboBarEl       = null;
let lumina_comboContainerEl = null;
let lumina_particleCanvas   = null;
let lumina_particleCtx      = null;
let lumina_particles        = [];
let lumina_particleRAF      = null;

/** Mapa ID ficha → elemento DOM */
const lumina_tileEls = new Map();

/**
 * v1.3: Caché de último value renderizado por tile-id.
 * Evita recalcular estilos de color si el tile no cambió de valor.
 * @type {Map<string, number>}
 */
const lumina_tileValueCache = new Map();

// ─── v1.3: Sistema LOD ────────────────────────────────────────────────────────

/** Nivel de calidad: 'high' | 'medium' | 'low' */
let lumina_qualityLevel    = 'high';
/** Máximo de partículas activas simultáneas (reducible adaptativamente) */
let lumina_maxParticles    = 50;
/** Si false, lumina_spawnConfetti() es no-op */
let lumina_confettiEnabled = true;
/** Historial de frame-times (últimos 8) para el monitor adaptativo */
const lumina_frameTimes    = [];
let   lumina_lastFrameTs   = 0;

/**
 * Evalúa hardware y asigna el nivel de calidad inicial.
 */
function lumina_detectQuality() {
    const cores  = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory        || 4;

    if (cores <= 2 || memory <= 1) {
        lumina_qualityLevel    = 'low';
        lumina_maxParticles    = 0;
        lumina_confettiEnabled = false;
        console.log('[2048] 📉 LOD: gama baja — partículas y confeti desactivados.');
    } else if (cores <= 4 || memory <= 2) {
        lumina_qualityLevel    = 'medium';
        lumina_maxParticles    = 20;
        lumina_confettiEnabled = true;
        console.log('[2048] 📊 LOD: gama media — máx. 20 partículas, confeti 50 piezas.');
    } else {
        lumina_qualityLevel    = 'high';
        lumina_maxParticles    = 50;
        lumina_confettiEnabled = true;
        console.log('[2048] 📈 LOD: gama alta — máx. 50 partículas, confeti 100 piezas.');
    }
}

/**
 * Actualiza el historial de frame-times y reduce maxParticles si el promedio
 * supera 18 ms. Solo actúa cuando hay al menos 8 muestras y maxParticles > 5.
 * @param {number} now - Timestamp del frame actual (performance.now())
 */
function lumina_trackFrameTime(now) {
    if (lumina_lastFrameTs > 0) {
        lumina_frameTimes.push(now - lumina_lastFrameTs);
        if (lumina_frameTimes.length > 8) lumina_frameTimes.shift();

        if (lumina_frameTimes.length === 8 && lumina_maxParticles > 5) {
            const avg = lumina_frameTimes.reduce((a, b) => a + b, 0) / 8;
            if (avg > 18) {
                lumina_maxParticles = Math.max(5, Math.floor(lumina_maxParticles / 2));
                console.log(`[2048] ⚠️ Frame-time ${avg.toFixed(1)} ms → maxParticles → ${lumina_maxParticles}`);
            }
        }
    }
    lumina_lastFrameTs = now;
}

// ─── v1.3: Page Visibility API ────────────────────────────────────────────────

/**
 * Pausa o reanuda el loop de partículas y el AudioContext cuando la pestaña
 * se oculta o vuelve a ser visible.
 *
 * v2.0: Eliminadas las referencias al parallax (ya no existe).
 */
function lumina_onVisibilityChange() {
    if (document.hidden) {
        // Detener partículas
        if (lumina_particleRAF) {
            cancelAnimationFrame(lumina_particleRAF);
            lumina_particleRAF = null;
            if (lumina_particleCtx) {
                lumina_particleCtx.clearRect(
                    0, 0,
                    lumina_particleCanvas.width,
                    lumina_particleCanvas.height
                );
            }
        }
        // Suspender audio (función pública en lumina_audio.js v1.3)
        if (typeof lumina_suspendAudio === 'function') lumina_suspendAudio();

        console.log('[2048] 👁️ Pestaña oculta — loop rAF de partículas cancelado.');
    } else {
        // Reanudar audio si el usuario había interactuado antes
        if (typeof lumina_resumeAudio === 'function') lumina_resumeAudio();
        console.log('[2048] 👁️ Pestaña visible — audio reanudado.');
    }
}

// ─── Inicialización ───────────────────────────────────────────────────────────

function lumina_initRenderer() {
    lumina_boardEl          = document.getElementById('lumina-board');
    lumina_scoreEl          = document.getElementById('lumina-score');
    lumina_bestScoreEl      = document.getElementById('lumina-best');
    lumina_comboBarEl       = document.getElementById('lumina-combo-bar');
    lumina_comboContainerEl = document.getElementById('lumina-combo-container');
    lumina_particleCanvas   = document.getElementById('lumina-particles');

    // Celdas de fondo
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

    // v1.3: Detectar calidad antes de arrancar loops
    lumina_detectQuality();

    // v1.3: Registrar Page Visibility API
    document.addEventListener('visibilitychange', lumina_onVisibilityChange);
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

    for (const [id, el] of lumina_tileEls) {
        if (!currentIds.has(id)) {
            el.remove();
            lumina_tileEls.delete(id);
            lumina_tileValueCache.delete(id); // v1.3: purga caché
        }
    }
}

/**
 * Sincroniza o crea el elemento DOM de una ficha.
 *
 * v2.0: Simplificado radicalmente.
 *   · Sin box-shadow de glow de color.
 *   · Sin textShadow de color.
 *   · Sin inline border de color (el border-bottom de profundidad
 *     es una propiedad CSS estática en index.html, no se toca aquí).
 *   · El color sólido de fondo (pal.bg) y el color de texto (pal.text)
 *     son los únicos valores que se aplican inline.
 *   · Caché v1.3 retenido: los recálculos solo ocurren al cambiar value.
 */
function lumina_syncTileEl(tile, row, col) {
    let el = lumina_tileEls.get(tile.id);
    const pal    = lumina_getTilePalette(tile.value);
    const digits = String(tile.value).length;

    if (!el) {
        el = document.createElement('div');
        el.className = 'lumina-tile';
        lumina_boardEl.appendChild(el);
        lumina_tileEls.set(tile.id, el);
    }

    el.style.setProperty('--tile-x', col);
    el.style.setProperty('--tile-y', row);
    el.dataset.digits = digits > 4 ? '5' : digits;

    // v1.3: Solo recalcular estilos cuando el valor cambia.
    const cachedValue = lumina_tileValueCache.get(tile.id);
    if (cachedValue !== tile.value) {
        lumina_tileValueCache.set(tile.id, tile.value);

        if (tile.isEnergy) {
            // v2.0: Azul eléctrico sólido — distinción por color, no por glow.
            el.innerHTML   = `<span class="lumina-e-icon">⚡</span><span class="lumina-e-label">ENERGY</span>`;
            el.style.background = '#0B4D72';
            el.style.color      = '#BAE6FD';
            el.style.boxShadow  = '';
            el.style.textShadow = '';
        } else {
            el.textContent      = tile.value;
            el.style.background = pal.bg;
            el.style.color      = pal.text;
            el.style.boxShadow  = '';
            el.style.textShadow = '';
        }
    }

    // Clases de animación: transitorias, siempre se actualizan
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

/**
 * v2.0: Barra sólida usando el acento de plataforma.
 * Se interpola entre el acento y un tono cálido en la zona alta del combo.
 * Sin box-shadow.
 */
function lumina_updateComboMeter() {
    if (!lumina_comboBarEl) return;
    lumina_comboBarEl.style.width = lumina_comboMeter + '%';
    // Transición de color: accent → amber a medida que el combo sube
    const hue = Math.round(260 - lumina_comboMeter * 2.2);
    lumina_comboBarEl.style.background =
        `linear-gradient(90deg, hsl(${hue},85%,58%), hsl(${hue - 50},90%,62%))`;
}

function lumina_triggerComboFlash() {
    if (!lumina_comboContainerEl) return;
    lumina_comboContainerEl.classList.remove('lumina-combo--flash');
    void lumina_comboContainerEl.offsetWidth;
    lumina_comboContainerEl.classList.add('lumina-combo--flash');
}

// ─── Sistema de Partículas ────────────────────────────────────────────────────

/**
 * Emite partículas de luz para fusiones ≥ 128.
 * v1.3: Respeta lumina_maxParticles (LOD). No-op si maxParticles = 0.
 *
 * v2.0: El color de las partículas proviene de la paleta sólida del tile,
 * no de un color con glow. Las partículas emiten el color acento del valor.
 */
function lumina_spawnParticles(col, row, value) {
    if (!lumina_particleCanvas || !lumina_boardEl || value < 128) return;
    if (lumina_maxParticles <= 0) return;

    const pal  = lumina_getTilePalette(value);
    // Extraer color de fondo de pal.bg (puede ser un gradiente para 2048)
    const particleColor = pal.bg.startsWith('linear') ? '#F59E0B' : pal.bg;

    const rect = lumina_boardEl.getBoundingClientRect();
    const cell = rect.width / lumina_GRID_SIZE;
    const cx   = rect.left + col * cell + cell / 2;
    const cy   = rect.top  + row * cell + cell / 2;

    const rawCount = Math.min(10 + Math.log2(value) * 2, 50);
    const count    = Math.min(rawCount, lumina_maxParticles - lumina_particles.length);
    if (count <= 0) return;

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
            color: particleColor,
        });
    }

    if (!lumina_particleRAF && !document.hidden) lumina_animateParticles();
}

/**
 * Confeti dorado para nuevo récord / victoria.
 * v1.3: No-op en gama baja. Cuenta reducida a 50 en gama media.
 */
function lumina_spawnConfetti() {
    if (!lumina_particleCanvas) return;
    if (!lumina_confettiEnabled) return;

    const w      = lumina_particleCanvas.width;
    const count  = lumina_qualityLevel === 'medium' ? 50 : 100;
    const colors = ['#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#E84808', '#D97706', '#FFFFFF'];

    for (let i = 0; i < count; i++) {
        const speed = 2.5 + Math.random() * 4.5;
        lumina_particles.push({
            x:     Math.random() * w,
            y:     -8,
            vx:    (Math.random() - 0.5) * speed * 1.8,
            vy:    speed * (0.6 + Math.random() * 0.4),
            life:  1,
            decay: 0.006 + Math.random() * 0.008,
            size:  3 + Math.random() * 4.5,
            color: colors[Math.floor(Math.random() * colors.length)],
        });
    }

    if (!lumina_particleRAF && !document.hidden) lumina_animateParticles();
}

/**
 * Loop de animación de partículas.
 * v1.3: Idle State — se cancela cuando el array queda vacío (GPU = 0%).
 * @param {number} [now] - DOMHighResTimeStamp del frame
 */
function lumina_animateParticles(now) {
    if (!lumina_particleCtx) return;

    if (now) lumina_trackFrameTime(now);

    lumina_particleCtx.clearRect(0, 0, lumina_particleCanvas.width, lumina_particleCanvas.height);
    lumina_particles = lumina_particles.filter(p => p.life > 0.02);

    for (const p of lumina_particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.09;
        p.life -= p.decay;

        lumina_particleCtx.save();
        lumina_particleCtx.globalAlpha = Math.max(0, p.life);
        lumina_particleCtx.fillStyle   = p.color;
        lumina_particleCtx.shadowBlur  = 6;
        lumina_particleCtx.shadowColor = p.color;
        lumina_particleCtx.beginPath();
        lumina_particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        lumina_particleCtx.fill();
        lumina_particleCtx.restore();
    }

    if (lumina_particles.length > 0) {
        lumina_particleRAF = requestAnimationFrame(lumina_animateParticles);
    } else {
        // Idle State — loop detenido
        lumina_particleRAF = null;
        lumina_particleCtx.clearRect(0, 0, lumina_particleCanvas.width, lumina_particleCanvas.height);
    }
}

// ─── Animación de Contador de Monedas ────────────────────────────────────────

/**
 * Anima el texto de un elemento de 0 al total en ~500 ms (easeOutCubic).
 * Llama lumina_playCoinTinkle(progress) en cada frame para audio sincronizado.
 *
 * @param {HTMLElement} el     - Elemento cuyo textContent se animará
 * @param {number}      target - Valor final de monedas
 */
function lumina_animateCoinCount(el, target) {
    if (!el || target <= 0) {
        if (el) el.textContent = (target || 0).toLocaleString();
        return;
    }

    const DURATION   = 500;
    const startTs    = performance.now();
    let lastTinkleTs = startTs;

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function step(now) {
        const elapsed  = now - startTs;
        const raw      = Math.min(elapsed / DURATION, 1);
        const progress = easeOutCubic(raw);
        el.textContent = Math.round(progress * target).toLocaleString();

        const tinkleInterval = 40 - raw * 28;
        if (now - lastTinkleTs >= tinkleInterval) {
            lastTinkleTs = now;
            if (typeof lumina_playCoinTinkle === 'function') lumina_playCoinTinkle(raw);
        }

        if (raw < 1) {
            requestAnimationFrame(step);
        } else {
            el.textContent = target.toLocaleString();
            if (typeof lumina_playCoinTinkle === 'function') lumina_playCoinTinkle(1);
        }
    }

    requestAnimationFrame(step);
}

// ─── Modales ──────────────────────────────────────────────────────────────────

function lumina_showGameOver(sessionData) {
    const modal = document.getElementById('lumina-modal-gameover');
    if (!modal) return;

    const elScore = document.getElementById('lumina-final-score');
    if (elScore) elScore.textContent = lumina_score.toLocaleString();

    const elCoins = document.getElementById('lumina-final-coins');
    if (elCoins && sessionData) lumina_animateCoinCount(elCoins, sessionData.coins || 0);

    const elMilestone = document.getElementById('lumina-final-milestone');
    if (elMilestone && sessionData)
        elMilestone.textContent = `Ficha ${(sessionData.maxTile || 2).toLocaleString()}`;

    const elRecord = document.getElementById('lumina-go-record-badge');
    if (elRecord) elRecord.style.display = sessionData?.isNewRecord ? 'flex' : 'none';
    if (sessionData?.isNewRecord) setTimeout(lumina_spawnConfetti, 200);

    modal.classList.add('lumina-modal--visible');
}

function lumina_showWin(sessionData) {
    const modal = document.getElementById('lumina-modal-win');
    if (!modal) return;

    const elScore = document.getElementById('lumina-win-score');
    if (elScore) elScore.textContent = lumina_score.toLocaleString();

    const elCoins = document.getElementById('lumina-win-coins');
    if (elCoins && sessionData) lumina_animateCoinCount(elCoins, sessionData.coins || 0);

    const elMilestone = document.getElementById('lumina-win-milestone');
    if (elMilestone && sessionData)
        elMilestone.textContent = `Ficha ${(sessionData.maxTile || 2048).toLocaleString()}`;

    const elRecord = document.getElementById('lumina-win-record-badge');
    if (elRecord) elRecord.style.display = sessionData?.isNewRecord ? 'flex' : 'none';

    setTimeout(lumina_spawnConfetti, 200);
    if (sessionData?.isNewRecord) setTimeout(lumina_spawnConfetti, 700);

    modal.classList.add('lumina-modal--visible');
}

function lumina_hideModals() {
    document.querySelectorAll('.lumina-modal').forEach(m => m.classList.remove('lumina-modal--visible'));
}

function lumina_clearBoard() {
    lumina_tileEls.forEach(el => el.remove());
    lumina_tileEls.clear();
    lumina_tileValueCache.clear();
}

console.log('[2048] Render module v2.0 loaded (Solid Modernism).');
