/**
 * lumina_render.js — Capa Visual · 2048
 * Love Arcade · Game Center Core v7.5 Compatible
 *
 * Módulo 2 / 5: Manipulación del DOM, animaciones CSS y partículas.
 * Usa variables CSS --tile-x / --tile-y para posicionar fichas.
 * Gestiona el canvas de partículas con requestAnimationFrame.
 *
 * CHANGELOG v2.1 — Accesibilidad y Optimización Gama Baja
 * ─────────────────────────────────────────────────────────
 * [A11Y] Ficha 2 — corrección de contraste: bg elevado de #1D2444 →
 *        #232B52 (+~2 puntos de luminosidad) y texto de #4A607E →
 *        #7090BC. El ratio texto/bg pasa de ~2.4:1 a ~4.3:1, superando
 *        el umbral WCAG AA para texto grande/bold (3:1). La ficha ya no
 *        se "pierde" en tableros con brillo de pantalla reducido.
 *
 * [PERF] lumina_syncTileEl: las cuatro operaciones classList
 *        (remove + hasta 3×add) se sustituyen por una única asignación
 *        de className. Cada operación classList dispara una validación
 *        interna del DOMTokenList; agruparlas en una sola escritura de
 *        string reduce el número de recálculos de estilo por movimiento
 *        de 4 a 1, especialmente relevante en gama baja donde el
 *        recálculo de estilos puede bloquear el hilo principal.
 *
 * [PERF] lumina_updateComboMeter — caché de valor: la función guarda
 *        el último lumina_comboMeter escrito al DOM. Si el valor no ha
 *        cambiado entre llamadas (movimientos sin fusión), retorna
 *        inmediatamente sin tocar el estilo. Evita escrituras inline
 *        redundantes que forzarían un estilo-recalc parcial.
 *
 * [PERF] lumina_updateComboMeter — color adaptativo por calidad: en
 *        gama baja el gradiente hsl() se sustituye por el color acento
 *        sólido de plataforma. En gama media/alta se mantiene el
 *        gradiente HSL dinámico. Esto elimina el coste de construcción
 *        de la cadena hsl() y la resolución CSS del gradiente en cada
 *        movimiento para los dispositivos más limitados.
 *
 * [PERF] lumina_resizeParticleCanvas — debounce de 150 ms: el evento
 *        `resize` puede dispararse decenas de veces por segundo durante
 *        un cambio de orientación. Sin debounce, cada disparo
 *        reasigna width/height del canvas, lo que invalida el contexto
 *        2D y fuerza un ciclo completo de borrado + reinicio. Con
 *        debounce, solo se ejecuta la última llamada de cada ráfaga.
 *        El listener se registra con { passive: true } para que el
 *        navegador no espere a que el handler termine antes de componer
 *        el siguiente frame de layout.
 *
 * CHANGELOG v2.0 — Rediseño Solid Modernism
 * ──────────────────────────────────────────
 * [REDESIGN] Paleta sólida; azules/violetas → naranjas/ámbar.
 * [REDESIGN] Eliminado box-shadow/textShadow de color en fichas.
 * [REDESIGN] Parallax giroscópico eliminado por completo.
 * [REDESIGN] Page Visibility API simplificada (sin parallax).
 *
 * CHANGELOG v1.3 — Optimización de Rendimiento (retenido)
 * ─────────────────────────────────────────────────────────
 * [PERF] Idle State del loop de partículas.
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

// ─── Paleta de Fichas — v2.1 ──────────────────────────────────────────────────
//
// Jerarquía visual en dos ejes:
//   · Saturación: valores bajos = azules oscuros, casi fundidos con el fondo.
//   · Luminosidad: crece con el valor hasta los naranjas/ámbar vibrantes.
//
// Regla: SOLO la ficha 2048 tiene gradiente (brief §3).
// Todas las demás son colores hexadecimales completamente sólidos.
//
// v2.1 — Corrección de contraste (ficha 2):
//   · bg: #1D2444 → #232B52  (+~2 pts luminosidad)
//   · text: #4A607E → #7090BC  (ratio texto/bg: 2.4:1 → 4.3:1)
//   Cumple WCAG AA para texto grande/bold (umbral: 3:1).
//
const lumina_TILE_PALETTE = {
    2:    { bg: '#232B52', text: '#7090BC' },   // v2.1: contraste corregido
    4:    { bg: '#1C3068', text: '#7EB4E8' },   // azul marino
    8:    { bg: '#1350A8', text: '#A8CCFF' },   // azul medio
    16:   { bg: '#1860C8', text: '#C8E2FF' },   // azul brillante
    32:   { bg: '#3040E0', text: '#D4DCFF' },   // azul-índigo
    64:   { bg: '#7C3AED', text: '#EDE0FF' },   // violeta
    128:  { bg: '#9C27B0', text: '#F4D8FF' },   // violeta oscuro
    256:  { bg: '#B82810', text: '#FFD0C0' },   // rojo-naranja
    512:  { bg: '#E84808', text: '#FFE8D8' },   // naranja vibrante
    1024: { bg: '#D97706', text: '#FFF8E0' },   // ámbar
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

/**
 * v2.1: Último valor del combo meter escrito al DOM.
 * lumina_updateComboMeter() retorna inmediatamente si el valor no cambió.
 */
let lumina_lastComboMeter = -1;

/**
 * v2.1: Timer ID del debounce del evento `resize`.
 * Garantiza que solo se ejecute la última llamada de cada ráfaga de resize.
 */
let lumina_resizeTimer = null;

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
 * v1.3: Actualiza el historial de frame-times y reduce maxParticles si
 * el promedio de los últimos 8 supera 18 ms (< 55 FPS).
 * @param {number} now - Timestamp del frame actual
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

// ─── v1.3/v2.0: Page Visibility API ──────────────────────────────────────────

/**
 * Pausa o reanuda el loop de partículas y el AudioContext cuando la pestaña
 * se oculta o vuelve a ser visible.
 * v2.0: Eliminadas las referencias al parallax (ya no existe).
 */
function lumina_onVisibilityChange() {
    if (document.hidden) {
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
        if (typeof lumina_suspendAudio === 'function') lumina_suspendAudio();
        console.log('[2048] 👁️ Pestaña oculta — loop rAF cancelado, audio suspendido.');
    } else {
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
        /*
         * v2.1: { passive: true } indica al navegador que el handler
         * nunca llama preventDefault(), liberándolo para componer el
         * siguiente frame sin esperar a que el handler termine.
         */
        window.addEventListener('resize', lumina_resizeParticleCanvas, { passive: true });
    }

    lumina_detectQuality();
    document.addEventListener('visibilitychange', lumina_onVisibilityChange);
}

/**
 * Ajusta las dimensiones del canvas al tamaño actual de la ventana.
 * v2.1: Debounce de 150 ms — el evento `resize` puede dispararse
 * decenas de veces por segundo durante un cambio de orientación;
 * reasignar width/height en cada disparo invalida el contexto 2D
 * e impone un reinicio completo del canvas. El debounce garantiza
 * que solo se ejecute la última llamada de cada ráfaga.
 */
function lumina_resizeParticleCanvas() {
    if (!lumina_particleCanvas) return;
    clearTimeout(lumina_resizeTimer);
    lumina_resizeTimer = setTimeout(() => {
        lumina_resizeTimer = null;
        lumina_particleCanvas.width  = window.innerWidth;
        lumina_particleCanvas.height = window.innerHeight;
    }, 150);
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
            lumina_tileValueCache.delete(id);
        }
    }
}

/**
 * Sincroniza o crea el elemento DOM de una ficha.
 *
 * v2.1 — Optimización de className:
 *   Las cuatro operaciones classList (remove + hasta 3×add) se sustituyen
 *   por una única asignación de `el.className`. Cada llamada a classList
 *   dispara internamente una validación del DOMTokenList y puede forzar
 *   un micro-recálculo de estilo. Agrupar todo en una sola escritura de
 *   string reduce el número de recálculos de 4 a 1 por ficha por frame.
 *   En un movimiento típico con 4–8 fichas afectadas, esto supone
 *   16–32 operaciones menos por movimiento.
 *
 * v1.3 — Caché de value retenido:
 *   Los estilos de color/fondo solo se recalculan cuando tile.value
 *   cambia (en la práctica, solo en merges que generan un tile nuevo
 *   con ID distinto). Las fichas que no se fusionaron en el movimiento
 *   actual no tocan el DOM en el bloque de estilos.
 */
function lumina_syncTileEl(tile, row, col) {
    let el = lumina_tileEls.get(tile.id);
    const pal    = lumina_getTilePalette(tile.value);
    const digits = String(tile.value).length;

    if (!el) {
        el = document.createElement('div');
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
            el.innerHTML        = `<span class="lumina-e-icon">⚡</span><span class="lumina-e-label">ENERGY</span>`;
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

    /*
     * v2.1: Asignación única de className.
     * Antes: classList.remove(A, B, C) + hasta 3×classList.add() = 4 ops.
     * Ahora: una sola escritura de string = 1 op, 1 recálculo de estilo.
     */
    let cls = 'lumina-tile';
    if (tile.isEnergy) cls += ' lumina-tile--energy';
    if (tile.isNew)    cls += ' lumina-tile--new';
    if (tile.isMerged) cls += ' lumina-tile--merged';
    el.className = cls;
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
 * Actualiza el ancho y color de la barra de combo.
 *
 * v2.1 — Dos optimizaciones:
 *
 * 1. Caché de valor: si lumina_comboMeter no cambió desde la última
 *    llamada, retorna inmediatamente. Evita escrituras DOM redundantes
 *    en movimientos sin fusión (donde el combo se resetea a 0 y la
 *    función se llama igualmente desde lumina_input.js).
 *
 * 2. Color adaptativo por calidad:
 *    · Gama baja: se usa el acento sólido de plataforma, sin gradiente
 *      ni construcción de cadena hsl(). Cero coste de interpolación CSS.
 *    · Gama media/alta: gradiente HSL dinámico que interpola de violeta
 *      a ámbar según el porcentaje del combo.
 *    La transición CSS de `background` fue eliminada en index.html v2.1
 *    (era CPU-bound, no compositor-only).
 */
function lumina_updateComboMeter() {
    if (!lumina_comboBarEl) return;

    // v2.1: Caché — salir si nada cambió
    if (lumina_comboMeter === lumina_lastComboMeter) return;
    lumina_lastComboMeter = lumina_comboMeter;

    lumina_comboBarEl.style.width = lumina_comboMeter + '%';

    if (lumina_qualityLevel === 'low') {
        // Gama baja: color sólido — sin gradiente, sin hsl(), sin interpolación CSS
        lumina_comboBarEl.style.background = 'var(--lumina-platform-accent)';
    } else {
        // Gama media/alta: gradiente dinámico de violeta a ámbar
        const hue = Math.round(260 - lumina_comboMeter * 2.2);
        lumina_comboBarEl.style.background =
            `linear-gradient(90deg, hsl(${hue},85%,58%), hsl(${hue - 50},90%,62%))`;
    }
}

function lumina_triggerComboFlash() {
    if (!lumina_comboContainerEl) return;
    lumina_comboContainerEl.classList.remove('lumina-combo--flash');
    void lumina_comboContainerEl.offsetWidth;
    lumina_comboContainerEl.classList.add('lumina-combo--flash');
}

// ─── Sistema de Partículas ────────────────────────────────────────────────────

/**
 * Emite partículas para fusiones ≥ 128.
 * v1.3: Respeta lumina_maxParticles (LOD). No-op si maxParticles = 0.
 */
function lumina_spawnParticles(col, row, value) {
    if (!lumina_particleCanvas || !lumina_boardEl || value < 128) return;
    if (lumina_maxParticles <= 0) return;

    const pal           = lumina_getTilePalette(value);
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
        // Idle State: loop detenido, GPU = 0% para este canvas
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
    lumina_lastComboMeter = -1; // v2.1: resetear caché de combo al limpiar tablero
}

console.log('[2048] Render module v2.1 loaded.');
