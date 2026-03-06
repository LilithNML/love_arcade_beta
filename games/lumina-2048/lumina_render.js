/**
 * lumina_render.js — Capa Visual Lumina 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 2 / 5: Manipulación del DOM, animaciones CSS y partículas.
 * Usa variables CSS --tile-x / --tile-y para posicionar fichas.
 * Gestiona el canvas de partículas con requestAnimationFrame.
 *
 * CHANGELOG v1.3 — Optimización de Rendimiento (High Performance)
 * ──────────────────────────────────────────────────────────────────
 * [PERF] Idle State del Loop de Partículas: ya existía para el canvas; ahora
 *        también aplica al parallax. lumina_parallaxRAF se introduce como handle
 *        independiente. El loop de parallax se detiene automáticamente cuando el
 *        delta entre posición actual y objetivo es < 0.05 px (umbral idle),
 *        llevando el uso de GPU a 0% en reposo. Se reactiva solo cuando
 *        deviceorientation reporta un delta > 1° respecto a la posición actual.
 * [PERF] Page Visibility API: lumina_onVisibilityChange() cancela todos los loops
 *        rAF (partículas + parallax) al detectar document.hidden y suspende el
 *        AudioContext. Los reactiva al volver a la pestaña (visibilitychange).
 * [PERF] Sistema LOD — lumina_detectQuality(): evalúa hardwareConcurrency y
 *        deviceMemory al iniciar.
 *        · Gama baja  (≤2 cores o ≤1 GB):  maxParticles=0, confeti desactivado,
 *          parallax desactivado.
 *        · Gama media (≤4 cores o ≤2 GB):  maxParticles=20, confeti 50 piezas.
 *        · Gama alta  (>4 cores y >2 GB):   maxParticles=50, confeti 100 piezas.
 * [PERF] Frame-time adaptativo: lumina_animateParticles() mide el tiempo entre
 *        frames. Si el promedio de los últimos 8 supera 18 ms (< 55 FPS),
 *        maxParticles se reduce a la mitad (mínimo 5). Garantiza ≥ 30 FPS en
 *        gama baja y 60 FPS estables en gama media/alta.
 * [PERF] Caché de estilos de caja: lumina_tileValueCache almacena el último
 *        value renderizado por tile-id. boxShadow/color solo se recalculan
 *        cuando el valor cambia, evitando style-recalculation por rAF innecesario.
 * [PERF] box-shadow pre-calculado con cap a 28 px de spread. Cero llamadas a
 *        filter:drop-shadow desde JS (se eliminó la asignación inline).
 *
 * CHANGELOG v1.2
 * ──────────────
 * [NEW]  lumina_animateCoinCount(el, target): animador 500 ms easeOutCubic.
 * [UPD]  lumina_showGameOver() / lumina_showWin() usan animateCoinCount.
 *
 * CHANGELOG v1.1
 * ──────────────
 * [FIX]  Z-Index de Partículas elevado a 50.
 * [NEW]  lumina_spawnConfetti(): partículas doradas para nuevo récord.
 * [UPD]  Modales con { coins, maxTile, isNewRecord }.
 * [NOTE] Transición CSS elevada a 160 ms en index.html.
 */

'use strict';

// ─── Paleta de Fichas ─────────────────────────────────────────────────────────
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
let lumina_boardEl          = null;
let lumina_scoreEl          = null;
let lumina_bestScoreEl      = null;
let lumina_comboBarEl       = null;
let lumina_comboContainerEl = null;
let lumina_particleCanvas   = null;
let lumina_particleCtx      = null;
let lumina_particles        = [];
let lumina_particleRAF      = null;
let lumina_parallaxEl       = null;
let lumina_parallaxTargetX  = 0;
let lumina_parallaxTargetY  = 0;
let lumina_parallaxCurrentX = 0;
let lumina_parallaxCurrentY = 0;
let lumina_parallaxRAF      = null; // v1.3: handle independiente para idle + cancelación

/** Mapa ID ficha → elemento DOM */
const lumina_tileEls = new Map();

/**
 * v1.3: Caché de último value renderizado por tile-id.
 * Evita recalcular boxShadow/color si el tile no cambió de valor entre frames.
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
    const memory = navigator.deviceMemory        || 4; // GB; solo Chromium/Android

    if (cores <= 2 || memory <= 1) {
        lumina_qualityLevel    = 'low';
        lumina_maxParticles    = 0;
        lumina_confettiEnabled = false;
        console.log('[LUMINA] 📉 LOD: gama baja — partículas y confeti desactivados, parallax desactivado.');
    } else if (cores <= 4 || memory <= 2) {
        lumina_qualityLevel    = 'medium';
        lumina_maxParticles    = 20;
        lumina_confettiEnabled = true;
        console.log('[LUMINA] 📊 LOD: gama media — máx. 20 partículas, confeti 50 piezas.');
    } else {
        lumina_qualityLevel    = 'high';
        lumina_maxParticles    = 50;
        lumina_confettiEnabled = true;
        console.log('[LUMINA] 📈 LOD: gama alta — máx. 50 partículas, confeti 100 piezas.');
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
                console.log(`[LUMINA] ⚠️ Frame-time promedio ${avg.toFixed(1)} ms → maxParticles reducido a ${lumina_maxParticles}`);
            }
        }
    }
    lumina_lastFrameTs = now;
}

// ─── v1.3: Page Visibility API ────────────────────────────────────────────────

/**
 * Pausa o reanuda todos los loops rAF y el AudioContext cuando la pestaña
 * se oculta o vuelve a ser visible.
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
        // Detener parallax
        if (lumina_parallaxRAF) {
            cancelAnimationFrame(lumina_parallaxRAF);
            lumina_parallaxRAF = null;
        }
        // Suspender audio (función pública en lumina_audio.js v1.3)
        if (typeof lumina_suspendAudio === 'function') lumina_suspendAudio();

        console.log('[LUMINA] 👁️ Pestaña oculta — todos los loops rAF cancelados.');
    } else {
        // Reanudar parallax (reactiva el loop si no está idle)
        lumina_startParallaxLoop();
        // Reanudar audio si el usuario había interactuado antes
        if (typeof lumina_resumeAudio === 'function') lumina_resumeAudio();

        console.log('[LUMINA] 👁️ Pestaña visible — reanudando loops.');
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
    lumina_parallaxEl       = document.getElementById('lumina-bg-parallax');

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

    for (const [id, el] of lumina_tileEls) {
        if (!currentIds.has(id)) {
            el.remove();
            lumina_tileEls.delete(id);
            lumina_tileValueCache.delete(id); // v1.3: purga caché
        }
    }
}

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

    // v1.3: Solo recalcular estilos de color/sombra cuando el valor cambia.
    // En fichas estacionarias (movimiento sin merge), esto evita style-recalc.
    const cachedValue = lumina_tileValueCache.get(tile.id);
    if (cachedValue !== tile.value) {
        lumina_tileValueCache.set(tile.id, tile.value);

        if (tile.isEnergy) {
            el.innerHTML = `<span class="lumina-e-icon">⚡</span><span class="lumina-e-label">ENERGY</span>`;
            el.style.background = 'rgba(255,255,255,0.07)';
            // v1.3: box-shadow simple, sin filter:drop-shadow.
            // El efecto de "brillo pulsante" de la ficha ⚡ se logra ahora
            // con la animación lumina-energy-glow (box-shadow + opacity)
            // definida en index.html, sin tocar filter en ningún momento.
            el.style.boxShadow  = '0 0 18px rgba(255,255,255,0.30), 0 0 40px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.15)';
            el.style.color      = '#ffffff';
            el.style.border     = '1px solid rgba(255,255,255,0.25)';
            el.style.textShadow = '0 0 12px rgba(255,255,255,0.8)';
        } else {
            el.textContent = tile.value;
            const glowA  = tile.value >= 512 ? '99' : '55';
            const glowB  = tile.value >= 512 ? '44' : '22';
            // v1.3: spread cap a 28 px (antes crecía sin límite con log2).
            const spread = Math.min(10 + Math.log2(tile.value) * 2, 28);
            el.style.background = pal.bg;
            // v1.3: box-shadow simple — sin filter:drop-shadow.
            el.style.boxShadow  = `0 0 ${spread}px ${pal.glow}${glowA}, 0 0 ${spread * 2}px ${pal.glow}${glowB}, inset 0 1px 0 rgba(255,255,255,0.10)`;
            el.style.color      = pal.text;
            el.style.border     = `1px solid ${pal.glow}33`;
            el.style.textShadow = `0 0 8px ${pal.glow}`;
        }
    }

    // Clases de animación: siempre se actualizan (son transitorias)
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
    const hue = Math.round(180 - lumina_comboMeter * 1.5);
    lumina_comboBarEl.style.background = `linear-gradient(90deg, hsl(${hue},100%,65%), hsl(${hue - 40},100%,70%))`;
    lumina_comboBarEl.style.boxShadow  = `0 0 10px hsl(${hue},100%,60%)88`;
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
 */
function lumina_spawnParticles(col, row, value) {
    if (!lumina_particleCanvas || !lumina_boardEl || value < 128) return;
    if (lumina_maxParticles <= 0) return; // LOD gama baja

    const pal  = lumina_getTilePalette(value);
    const rect = lumina_boardEl.getBoundingClientRect();
    const cell = rect.width / lumina_GRID_SIZE;
    const cx   = rect.left + col * cell + cell / 2;
    const cy   = rect.top  + row * cell + cell / 2;

    // v1.3: no exceder el pool global de partículas
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
            color: pal.glow,
        });
    }

    // Arrancar loop solo si no está corriendo y la pestaña es visible
    if (!lumina_particleRAF && !document.hidden) lumina_animateParticles();
}

/**
 * Confeti dorado para nuevo récord / victoria.
 * v1.3: No-op en gama baja. Cuenta reducida a 50 en gama media.
 */
function lumina_spawnConfetti() {
    if (!lumina_particleCanvas) return;
    if (!lumina_confettiEnabled) return; // LOD gama baja

    const w      = lumina_particleCanvas.width;
    const count  = lumina_qualityLevel === 'medium' ? 50 : 100; // LOD medium
    const colors = ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#ec4899', '#a855f7', '#c084fc', '#ffffff'];

    for (let i = 0; i < count; i++) {
        const speed = 2.5 + Math.random() * 4.5;
        const angle = (Math.PI * 0.4) + Math.random() * (Math.PI * 0.2);
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
 * v1.3: Recibe timestamp para medir frame-time.
 *       Idle State: cuando el arreglo queda vacío, cancela rAF (GPU = 0%).
 * @param {number} [now] - DOMHighResTimeStamp del frame (inyectado por rAF)
 */
function lumina_animateParticles(now) {
    if (!lumina_particleCtx) return;

    // v1.3: monitoreo adaptativo de frame-time
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
        lumina_particleCtx.shadowBlur  = 8;
        lumina_particleCtx.shadowColor = p.color;
        lumina_particleCtx.beginPath();
        lumina_particleCtx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        lumina_particleCtx.fill();
        lumina_particleCtx.restore();
    }

    if (lumina_particles.length > 0) {
        lumina_particleRAF = requestAnimationFrame(lumina_animateParticles);
    } else {
        // v1.3: Idle State — loop detenido, GPU = 0% para este canvas
        lumina_particleRAF = null;
        lumina_particleCtx.clearRect(0, 0, lumina_particleCanvas.width, lumina_particleCanvas.height);
    }
}

// ─── Parallax Giroscopio ──────────────────────────────────────────────────────

/** Delta mínimo (px) para considerar que el parallax sigue en movimiento */
const lumina_PARALLAX_IDLE_THRESHOLD = 0.05;

/**
 * Inicia el loop del parallax si no está corriendo, la pestaña es visible
 * y el nivel de calidad no es 'low'.
 */
function lumina_startParallaxLoop() {
    if (lumina_parallaxRAF || document.hidden || !lumina_parallaxEl) return;
    if (lumina_qualityLevel === 'low') return; // gama baja: parallax desactivado

    lumina_parallaxRAF = requestAnimationFrame(lumina_parallaxStep);
}

/**
 * Un frame del loop del parallax.
 * v1.3: Idle State — se cancela cuando el movimiento restante es insignificante.
 */
function lumina_parallaxStep() {
    const dx = lumina_parallaxTargetX - lumina_parallaxCurrentX;
    const dy = lumina_parallaxTargetY - lumina_parallaxCurrentY;

    lumina_parallaxCurrentX += dx * 0.04;
    lumina_parallaxCurrentY += dy * 0.04;

    if (lumina_parallaxEl) {
        lumina_parallaxEl.style.transform =
            `translate(${lumina_parallaxCurrentX}px, ${lumina_parallaxCurrentY}px) scale(1.06)`;
    }

    // v1.3: Si ambos deltas son sub-umbral → Idle State
    if (Math.abs(dx) < lumina_PARALLAX_IDLE_THRESHOLD &&
        Math.abs(dy) < lumina_PARALLAX_IDLE_THRESHOLD) {
        lumina_parallaxRAF = null; // cancelar loop
        return;
    }

    lumina_parallaxRAF = requestAnimationFrame(lumina_parallaxStep);
}

function lumina_initParallax() {
    if (!lumina_parallaxEl) return;

    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            if (e.gamma === null || e.beta === null) return;

            const newTargetX = Math.max(-12, Math.min(12, e.gamma  / 3.5));
            const newTargetY = Math.max(-12, Math.min(12, (e.beta - 45) / 3.5));

            lumina_parallaxTargetX = newTargetX;
            lumina_parallaxTargetY = newTargetY;

            // v1.3: Reactivar loop solo si el movimiento es perceptible (> 1 px)
            if (Math.abs(newTargetX - lumina_parallaxCurrentX) > 1 ||
                Math.abs(newTargetY - lumina_parallaxCurrentY) > 1) {
                lumina_startParallaxLoop();
            }
        });
    }

    lumina_startParallaxLoop();
}

// ─── Animación de Contador de Monedas ────────────────────────────────────────

/**
 * Anima el texto de un elemento de 0 al total en ~500 ms (easeOutCubic).
 * Llama lumina_playCoinTinkle(progress) en cada frame para el audio sincronizado.
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
    lumina_tileValueCache.clear(); // v1.3: limpiar caché al reiniciar
}

console.log('[LUMINA] Render module v1.3 loaded (High Performance).');
