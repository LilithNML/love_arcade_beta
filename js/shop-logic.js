/**
 * shop-logic.js — Love Arcade v9.4
 * ─────────────────────────────────────────────────────────────────────────────
 * Contiene toda la lógica de la vista Tienda, extraída del script inline de
 * shop.html como parte de la migración a arquitectura SPA.
 *
 * NOVEDADES v9.4 (sincronización de versión con app.js):
 *  - Eliminado will-change estático en tarjetas del catálogo y biblioteca.
 *    El GPU-layer management ahora vive exclusivamente en CSS (hover :hover).
 *  - handleExport() refactorizado para usar window.MailHelper.copyToClipboard()
 *    en lugar de reimplementar el patrón navigator.clipboard + execCommand.
 *  - _noCtxHandler movido a variable de cierre del módulo (ya no muta el DOM).
 *  - btn-reset-filters escuchado vía JS en DOMContentLoaded (elimina onclick inline).
 *  - lucide.createIcons() siempre scoped con { nodes: [...] } en renders parciales.
 *
 * NOVEDADES v9.1:
 *  - loadCatalog(): función encapsulada con manejo de errores y reintento.
 *    Si fetch falla, muestra #shop-error-state con botón #btn-retry-shop.
 *  - El listener de .theme-btn fue eliminado de shop-logic.js (corrección
 *    aplicada en la limpieza SPA). El único registro vive en app.js vía
 *    setTheme(), que actualiza store, CSS vars, clase en <body> y el estado
 *    visual de todos los .theme-btn desde un único lugar.
 *  - El listener de #btn-moon-blessing vive exclusivamente aquí; el duplicado
 *    en app.js fue eliminado (corrección SPA) para evitar el cobro doble.
 *
 * DEPENDENCIAS (deben estar cargadas ANTES en el DOM):
 *  - js/app.js          → window.GameCenter, window.ECONOMY, window.debounce, window.MailHelper
 *  - lucide             → window.lucide
 *  - canvas-confetti    → window.confetti
 *
 * OPTIMIZACIONES DE RENDIMIENTO:
 *  - fetch('data/shop.json') se ejecuta UNA SOLA VEZ en DOMContentLoaded y
 *    precarga el catálogo completo en memoria (variable allItems).
 *  - La búsqueda usa window.debounce() para evitar sobrecargar el hilo principal.
 *  - Los toasts usan .remove() tras su animación de salida (limpieza del DOM).
 *  - El confetti solo se dispara cuando la pestaña está activa (document.hidden check).
 *  - will-change en tarjetas: gestionado en CSS vía :hover, no en JS. Esto evita
 *    promover N capas GPU simultáneas cuando el catálogo está estático.
 *  - lucide.createIcons() siempre se invoca con { nodes: [container] } en renders
 *    parciales para evitar el scan del DOM completo.
 *
 * NOTAS SPA:
 *  - Todos los event listeners se registran una sola vez en DOMContentLoaded.
 *  - window.ShopView.onEnter() es llamado por spa-router.js al entrar a la vista
 *    de Tienda, permitiendo refrescar estado sin re-inicializar todo.
 *  - resetFilters() es global (window) para compatibilidad con el onclick inline
 *    del botón "Ver todo el catálogo" en el HTML.
 */

// ── Estado del catálogo (módulo privado) ──────────────────────────────────────
let allItems     = [];
let activeFilter = 'Todos';
let searchQuery  = '';

// ── Handler de contextmenu para el mockup stage ──────────────────────────────
// Guardado como variable de módulo (no como propiedad del nodo DOM) para evitar
// la mutación de propiedades no-estándar en elementos del DOM y para poder
// hacer removeEventListener correctamente al cerrar el modal.
let _stageCtxHandler = null;

// ── Último elemento con foco antes de abrir un modal ─────────────────────────
// Se guarda en openXxxModal() y se restaura en _closeXxxModal() para que los
// usuarios de teclado no pierdan su posición en el flujo de la interfaz (WCAG 2.4.3).
let _lastFocusedElement = null;

// ── Utilidad de iconos ─────────────────────────────────────────────────────────
/**
 * Inicializa o refresca los iconos Lucide dentro de un contenedor específico.
 *
 * REGLA DE RENDIMIENTO: Nunca llamar lucide.createIcons() sin scope en renders
 * parciales. Un scan global del DOM completo en cada pulsación de teclado del
 * buscador o en cada toggle de wishlist duplica el trabajo en la SPA porque
 * ambas vistas (home + shop) están cargadas simultáneamente.
 *
 * USO CORRECTO:
 *   refreshIcons(container)  → escanea solo el subárbol del contenedor
 *   refreshIcons()           → scan global — SOLO en init inicial del DOM
 *
 * @param {HTMLElement|null} [container]  Nodo raíz del scan. null = global (solo init).
 */
function refreshIcons(container) {
    if (!window.lucide) return;
    if (container) {
        lucide.createIcons({ nodes: [container] });
    } else {
        lucide.createIcons();
    }
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
let _modalResolve = null;

function openConfirmModal({ title, bodyHTML, confirmText = 'Confirmar' }) {
    document.getElementById('modal-title').textContent   = title;
    document.getElementById('modal-body').innerHTML      = bodyHTML;
    document.getElementById('modal-confirm').textContent = confirmText;
    document.getElementById('modal-error').textContent   = '';
    // Guardar el elemento con foco activo para restaurarlo al cerrar (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    const overlay = document.getElementById('confirm-modal');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => document.getElementById('modal-confirm').focus());
    return new Promise(resolve => { _modalResolve = resolve; });
}

function _closeModal(value) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
    // Restaurar foco al elemento que abrió el modal para no desorientar al usuario
    // de teclado (WCAG 2.4.3 — Focus Order).
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// ── Wallpaper Preview Modal — Preview 2.0 (Dynamic Mockup) ───────────────────
//
// Replaces the static <img> preview with a 3-layer mockup frame:
//   Layer 1 (Art)        — CSS background-image (blocks "Save image as…")
//   Layer 2 (Protection) — pointer-events:none noise overlay
//   Layer 3 (UI)         — live clock + OS chrome (status bar / taskbar)
//
// Frame type is selected from item.tags:
//   "Mobile" → 9:20 portrait phone with status bar + 4×4 app grid
//   "PC"     → 16:9 landscape desktop with taskbar
//   (none)   → neutral 4:3 with watermark badge

let _mockupClockInterval = null;   // Cleared on modal close to prevent leaks
let _pendingHiResImg     = null;   // Tracks in-flight Image() load; cancelled on close

/**
 * Returns the current time as "HH:MM" using the device locale.
 * @returns {string}
 */
function _getMockupTimeString() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Updates every .mockup-clock-text / .mockup-pc-clock element in the active mockup.
 * Called once on open, then every 30 s via interval.
 */
function updateMockupTime() {
    const t = _getMockupTimeString();
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock').forEach(el => {
        el.textContent = t;
    });
}

/**
 * Inline SVG icons for the mockup status bar, taskbar, and app grid.
 * All paths are pure geometry — no external requests, no Lucide dependency.
 */
const MOCKUP_SVG = {
    // ── Status bar / taskbar ──────────────────────────────────────────────────
    signal: `<svg width="12" height="11" viewBox="0 0 12 11" fill="currentColor" aria-hidden="true">
        <rect x="0" y="7" width="2.2" height="4" rx="0.6"/>
        <rect x="3.3" y="5" width="2.2" height="6" rx="0.6"/>
        <rect x="6.6" y="2.5" width="2.2" height="8.5" rx="0.6"/>
        <rect x="9.8" y="0" width="2.2" height="11" rx="0.6" opacity="0.32"/>
    </svg>`,

    wifi: `<svg width="12" height="10" viewBox="0 0 12 10" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="9" r="1.15"/>
        <path d="M3.2 6.4a3.95 3.95 0 0 1 5.6 0l-.95.95a2.6 2.6 0 0 0-3.7 0z"/>
        <path d="M1 4.2a6.4 6.4 0 0 1 10 0l-.95.95a5.05 5.05 0 0 0-8.1 0z"/>
    </svg>`,

    battery: `<svg width="20" height="10" viewBox="0 0 20 10" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="16" height="9" rx="2.2" stroke="currentColor" stroke-width="1"/>
        <rect x="17" y="3" width="2.5" height="4" rx="1" fill="currentColor"/>
        <rect x="2" y="2" width="11" height="6" rx="1.2" fill="currentColor"/>
    </svg>`,

    arcadeLogo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="2" y="6" width="20" height="14" rx="3"/>
        <path d="M7 12h4M9 10v4"/>
        <circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"/>
        <circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none" opacity="0.6"/>
        <path d="M8 3l1.5 3M16 3l-1.5 3"/>
    </svg>`,

    // Windows 11 Start button — four coloured squares arranged in a 2×2 grid
    winStart: `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1"  y="1"  width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="8.5" y="1"  width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="1"  y="8.5" width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
        <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.2" fill="rgba(255,255,255,0.92)"/>
    </svg>`,

    // ── App grid / desktop icons ──────────────────────────────────────────────
    // bg      → solid colour (reference only, no longer used in HTML)
    // bgAlpha → semi-transparent version: accent colour at 35% opacity +
    //           a white tint layer so the wallpaper always shows through.
    //           Value: rgba(R,G,B, 0.38) keeps the hue readable without
    //           blocking the image behind it.
    appIcons: [
        // 0 — Music
        { bg: '#1c0608', bgAlpha: 'rgba(252,60,68,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 15V5l8-2v10"/>
            <circle cx="4.5" cy="15" r="1.5" fill="white" stroke="none"/>
            <circle cx="12.5" cy="13" r="1.5" fill="white" stroke="none"/>
          </svg>` },
        // 1 — Camera
        { bg: '#1c1c1e', bgAlpha: 'rgba(80,80,90,0.40)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <path d="M2 6.5C2 5.7 2.7 5 3.5 5H5l1-2h6l1 2h1.5C15.3 5 16 5.7 16 6.5v7c0 .8-.7 1.5-1.5 1.5h-11C2.7 15 2 14.3 2 13.5z"/>
            <circle cx="9" cy="10" r="2.5"/>
          </svg>` },
        // 2 — Messages
        { bg: '#0a1f0e', bgAlpha: 'rgba(48,209,88,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 11.5c0 .8-.7 1.5-1.5 1.5H5.5L2 16V4.5C2 3.7 2.7 3 3.5 3h10C14.3 3 15 3.7 15 4.5z"/>
          </svg>` },
        // 3 — Phone
        { bg: '#0a1f0e', bgAlpha: 'rgba(48,209,88,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 3h3l1.5 3-1.8 1.1A9 9 0 0 0 10.9 11.3L12 9.5l3 1.5v3c0 .8-.7 1-1 1C6.8 15 3 10.2 3 4c0-.3.2-1 1-1z"/>
          </svg>` },
        // 4 — Mail
        { bg: '#02101f', bgAlpha: 'rgba(10,132,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="14" height="10" rx="1.5"/>
            <path d="M2 6l7 5 7-5"/>
          </svg>` },
        // 5 — Maps
        { bg: '#1f1200', bgAlpha: 'rgba(255,159,10,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 2C6.8 2 5 3.8 5 6c0 3.5 4 8 4 8s4-4.5 4-8c0-2.2-1.8-4-4-4z"/>
            <circle cx="9" cy="6" r="1.3" fill="white" stroke="none"/>
          </svg>` },
        // 6 — Photos
        { bg: '#1f0008', bgAlpha: 'rgba(255,55,95,0.32)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2" y="3" width="14" height="12" rx="2"/>
            <circle cx="6.5" cy="7.5" r="1.5"/>
            <path d="M2 12l4-3.5 3 3 2.5-2 4.5 4"/>
          </svg>` },
        // 7 — Settings
        { bg: '#111113', bgAlpha: 'rgba(99,99,102,0.42)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="9" r="2.3"/>
            <path d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M4 4l1 1M13 13l1 1M4 14l1-1M13 5l1-1"/>
          </svg>` },
        // 8 — Calendar
        { bg: '#1f0200', bgAlpha: 'rgba(255,59,48,0.32)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2.5" y="3.5" width="13" height="12" rx="2"/>
            <path d="M2.5 7.5h13"/>
            <path d="M6 2v3M12 2v3"/>
            <rect x="6" y="10" width="2" height="2" rx="0.4" fill="white" stroke="none"/>
          </svg>` },
        // 9 — Clock
        { bg: '#1c1c1e', bgAlpha: 'rgba(80,80,90,0.40)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <circle cx="9" cy="9" r="6.5"/>
            <path d="M9 5.5v4l2.5 2.5"/>
          </svg>` },
        // 10 — Calculator
        { bg: '#0d0d0e', bgAlpha: 'rgba(44,44,46,0.50)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="3" y="2.5" width="12" height="13" rx="2"/>
            <rect x="5" y="4.5" width="8" height="3" rx="0.8" fill="white" fill-opacity="0.3" stroke="none"/>
            <circle cx="6" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="9" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="12" cy="11" r="0.8" fill="white" stroke="none"/>
            <circle cx="6" cy="13.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="9" cy="13.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="12" cy="13.5" r="0.8" fill="white" stroke="none"/>
          </svg>` },
        // 11 — Notes
        { bg: '#1f1800', bgAlpha: 'rgba(255,214,10,0.30)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="3" y="2" width="12" height="14" rx="2"/>
            <path d="M6 6h6M6 9h6M6 12h4"/>
          </svg>` },
        // 12 — Podcast
        { bg: '#0e0519', bgAlpha: 'rgba(181,107,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <circle cx="9" cy="7" r="3"/>
            <path d="M5 11a5.4 5.4 0 0 0 8 0"/>
            <path d="M3 13.5a8 8 0 0 0 12 0"/>
            <line x1="9" y1="10" x2="9" y2="16"/>
          </svg>` },
        // 13 — Game
        { bg: '#041208', bgAlpha: 'rgba(48,209,88,0.28)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5.5" width="14" height="9" rx="3"/>
            <path d="M6 8.5v3M4.5 10h3"/>
            <circle cx="11.5" cy="9.5" r="0.8" fill="white" stroke="none"/>
            <circle cx="13.5" cy="11.5" r="0.8" fill="white" stroke="none"/>
          </svg>` },
        // 14 — Wallet
        { bg: '#1f1200', bgAlpha: 'rgba(255,159,10,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
            <rect x="2" y="5" width="14" height="10" rx="2"/>
            <path d="M2 8h14"/>
            <circle cx="13" cy="12" r="1.2" fill="white" stroke="none"/>
          </svg>` },
        // 15 — Store
        { bg: '#001830', bgAlpha: 'rgba(10,132,255,0.35)',
          svg: `<svg viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7h12l-1 7H4z"/>
            <path d="M1 4h16"/>
            <path d="M7 14v-4h4v4"/>
          </svg>` },
    ],

    // Labels shown under each desktop icon in the PC mockup
    appLabels: [
        'Music', 'Camera', 'Messages', 'Phone', 'Mail',
        'Maps', 'Photos', 'Settings', 'Calendar', 'Clock',
        'Calculator', 'Notes', 'Podcasts', 'Games', 'Wallet', 'Store',
    ],
};

/**
 * Builds the 3-layer mockup HTML string for a given item.
 * @param {object} item  — shop item with .image and .tags[]
 * @returns {string}     — innerHTML for #mockup-slot
 */
function _buildMockupHTML(item) {
    const tags  = Array.isArray(item.tags) ? item.tags : [];
    const isMob = tags.includes('Mobile');
    const isPc  = tags.includes('PC');

    // ── Art URL: full wallpaper, NOT the thumbnail ────────────────────────────
    // item.image  → assets/product-thumbs/…_thumbs.webp  (small cropped preview)
    // item.file   → rouge_the_bat_a94a3cca.webp            (full resolution)
    // wallpapers/ prefix matches CONFIG.wallpapersPath in app.js
    const wallpaperPath = (window.CONFIG?.wallpapersPath ?? 'wallpapers/') + item.file;
    const imgUrl = wallpaperPath.replace(/'/g, "\\'");

    const now = _getMockupTimeString();

    // ── Frame class ───────────────────────────────────────────────────────────
    const frameClass = isMob ? 'mockup-mobile' : isPc ? 'mockup-pc' : 'mockup-fallback';

    // ── Layer 3 UI ────────────────────────────────────────────────────────────
    let uiHTML = '';

    if (isMob) {
        // 4×4 grid — all 16 named app icons.
        // Backgrounds are semi-transparent so the wallpaper bleeds through.
        const iconCells = MOCKUP_SVG.appIcons.map(app => `
            <div class="mockup-app-icon" style="background:${app.bgAlpha};">
                ${app.svg}
            </div>`).join('');

        uiHTML = `
            <div class="mockup-statusbar">
                <span class="mockup-clock-text">${now}</span>
                <div class="mockup-statusbar-icons">
                    ${MOCKUP_SVG.signal}
                    ${MOCKUP_SVG.wifi}
                    ${MOCKUP_SVG.battery}
                </div>
            </div>
            <div class="mockup-app-area">
                <div class="mockup-app-grid">${iconCells}</div>
            </div>
            <div class="mockup-home-indicator"></div>`;

    } else if (isPc) {
        // Left column: 6 small desktop shortcuts, Windows-style.
        // Only 6 icons in a single column hugging the left edge.
        // The wallpaper dominates the frame; OS feel from chrome, not coverage.
        const desktopIcons = MOCKUP_SVG.appIcons.slice(0, 6).map((app, i) => `
            <div class="mockup-desktop-icon">
                <div class="mockup-desktop-icon-img" style="background:${app.bgAlpha};">
                    ${app.svg}
                </div>
                <span class="mockup-desktop-label">${MOCKUP_SVG.appLabels[i]}</span>
            </div>`).join('');

        // Taskbar centre: 6 pinned app icons (icons 6-11)
        const pinnedApps = MOCKUP_SVG.appIcons.slice(6, 12).map(app => `
            <div class="mockup-taskbar-pinned" style="background:${app.bgAlpha};">
                ${app.svg}
            </div>`).join('');

        uiHTML = `
            <div class="mockup-desktop-area">
                <div class="mockup-desktop-shortcuts">${desktopIcons}</div>
            </div>
            <div class="mockup-taskbar">
                <div class="mockup-taskbar-left">
                    <div class="mockup-taskbar-start">
                        ${MOCKUP_SVG.winStart}
                    </div>
                    <div class="mockup-taskbar-search">
                        <svg viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.3" stroke-linecap="round"><circle cx="5" cy="5" r="3"/><line x1="7.5" y1="7.5" x2="10" y2="10"/></svg>
                    </div>
                </div>
                <div class="mockup-taskbar-centre">
                    ${pinnedApps}
                </div>
                <div class="mockup-taskbar-right">
                    ${MOCKUP_SVG.wifi}
                    ${MOCKUP_SVG.battery}
                    <span class="mockup-pc-clock">${now}</span>
                </div>
            </div>`;

    } else {
        uiHTML = `
            <div class="mockup-fallback-watermark">
                ${MOCKUP_SVG.arcadeLogo}
            </div>`;
    }

    return `
        <div class="mockup-container ${frameClass}">
            <div class="mockup-layer-art" aria-hidden="true"></div>
            <div class="mockup-layer-protection" aria-hidden="true"></div>
            <div class="mockup-layer-ui">
                ${uiHTML}
            </div>
        </div>`;
}

/**
 * Opens the preview modal with the dynamic mockup for the given item.
 * Handles clock updates, context-menu blocking, and action buttons.
 *
 * Accepts either the full item object (from renderShop event listeners)
 * or a numeric item ID (from dynamically generated onclick="" strings).
 * When an ID is passed, the item is resolved from allItems[].
 *
 * @param {object|number|string} itemOrId  Full item object OR item ID (any type).
 */
function openPreviewModal(itemOrId) {
    // ── Resolve item ──────────────────────────────────────────────────────────
    // Number() safely converts strings like "5" → 5; leaves NaN for non-numeric.
    // We treat non-object input as an ID regardless of JS type, so there is no
    // silent failure from strict === comparison between String("5") and Number(5).
    let item;
    if (itemOrId !== null && typeof itemOrId === 'object') {
        item = itemOrId;                                   // Already a full object
    } else {
        const numId = Number(itemOrId);                    // "5" → 5, 5 → 5
        item = allItems.find(i => i.id === numId);
    }

    if (!item) {
        console.warn('[Preview 2.0] openPreviewModal: item not found for', itemOrId,
            '| allItems loaded:', allItems.length);
        return;
    }

    const modal     = document.getElementById('preview-modal');
    const slot      = document.getElementById('mockup-slot');
    const nameEl    = document.getElementById('preview-name');
    const actionsEl = document.getElementById('preview-actions');
    const eco       = window.ECONOMY;

    // Null-guard: modal must exist in the DOM (index.html #preview-mockup-stage)
    if (!modal || !slot) {
        console.error('[Preview 2.0] Required DOM elements not found: #preview-modal or #mockup-slot');
        return;
    }

    // ── Inject mockup structure (art layer starts empty) ──────────────────────
    slot.innerHTML     = _buildMockupHTML(item);
    nameEl.textContent = item.name;

    // ── Double-layer progressive image load ───────────────────────────────────
    //
    // Phase 1 (instant): thumbnail already in browser cache from the catalog grid.
    //   → shown immediately as blurred/scaled "ghost" to eliminate blank flash.
    // Phase 2 (async):   full-resolution wallpaper loads in a background Image().
    //   → swapped in with a 200ms opacity cross-fade once fully decoded.
    //
    const wallpaperPath = (window.CONFIG?.wallpapersPath ?? 'wallpapers/') + item.file;
    const artEl         = slot.querySelector('.mockup-layer-art');

    // Phase 1 — thumbnail as blurred placeholder
    artEl.style.backgroundImage = `url('${item.image}')`;
    artEl.classList.add('mockup-bg-loading');

    // Cancel any stale load from a previous modal open
    if (_pendingHiResImg) { _pendingHiResImg.onload = _pendingHiResImg.onerror = null; _pendingHiResImg = null; }

    // Phase 2 — high-res load in background
    const hiRes    = new Image();
    _pendingHiResImg = hiRes;
    hiRes.onload = () => {
        if (_pendingHiResImg !== hiRes) return;    // Stale: modal was closed/re-opened
        artEl.style.backgroundImage = `url('${wallpaperPath}')`;
        artEl.classList.remove('mockup-bg-loading');
        artEl.classList.add('mockup-bg-ready');
        _pendingHiResImg = null;
    };
    hiRes.onerror = () => {
        // Wallpaper file missing — keep thumbnail, remove loading state gracefully
        if (_pendingHiResImg !== hiRes) return;
        artEl.classList.remove('mockup-bg-loading');
        artEl.classList.add('mockup-bg-ready');
        _pendingHiResImg = null;
    };
    hiRes.src = wallpaperPath;

    // ── will-change: active only while modal is open ──────────────────────────
    // Applying will-change globally wastes GPU memory on composited layers that
    // are never animated. We add it now and remove it in closePreviewModal().
    modal.style.willChange = 'opacity, transform';

    // ── Anti-extraction: contextmenu hardening ────────────────────────────────
    // Guardado en variable de módulo (no en propiedad DOM) para poder hacer
    // removeEventListener correctamente en closePreviewModal().
    const stage = document.getElementById('preview-mockup-stage');
    if (!_stageCtxHandler) {
        _stageCtxHandler = (e) => { e.preventDefault(); };
    }
    // Eliminar listener previo antes de añadir, por si el modal se abrió sin cerrar
    stage.removeEventListener('contextmenu', _stageCtxHandler);
    stage.addEventListener('contextmenu', _stageCtxHandler);

    slot.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

    // ── Live clock: update immediately, then every 30 s ───────────────────────
    if (_mockupClockInterval) clearInterval(_mockupClockInterval);
    updateMockupTime();
    _mockupClockInterval = setInterval(updateMockupTime, 30_000);

    // ── Action buttons ────────────────────────────────────────────────────────
    const isOwned    = GameCenter.getBoughtCount(item.id) > 0;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

    if (isOwned) {
        const url = GameCenter.getDownloadUrl(item.id, item.file);
        actionsEl.innerHTML = url
            ? `<a href="${url}" download class="btn-primary vault-btn" style="flex:1; justify-content:center;">
                   <i data-lucide="download" size="14"></i> Descargar
               </a>`
            : `<button class="btn-primary" style="flex:1; justify-content:center; opacity:0.5;" disabled>
                   <i data-lucide="check" size="14"></i> Obtenido
               </button>`;
        actionsEl.innerHTML +=
            `<button class="btn-ghost" style="flex:1; justify-content:center;" id="preview-close-btn">Volver</button>`;
    } else {
        actionsEl.innerHTML =
            `<button class="btn-ghost" style="flex:1; justify-content:center;" id="preview-close-btn">Volver</button>
             <button class="btn-primary preview-buy-btn" style="flex:2; justify-content:center;"
                     data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                 <i data-lucide="star" size="13" fill="#fbbf24" stroke="none"></i>
                 Canjear · ${finalPrice}
             </button>`;
    }

    modal.classList.remove('hidden');
    // Guardar foco y moverlo al botón de cierre del modal (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    requestAnimationFrame(() => {
        document.getElementById('preview-close-btn')?.focus()
            ?? document.getElementById('preview-close')?.focus();
    });
    refreshIcons(actionsEl);

    actionsEl.querySelector('.preview-buy-btn')?.addEventListener('click', async () => {
        closePreviewModal();
        const parsed = JSON.parse(
            actionsEl.querySelector('.preview-buy-btn').dataset.item.replace(/&#39;/g, "'")
        );
        await initiatePurchase(parsed, null);
    });

    document.getElementById('preview-close-btn')?.addEventListener('click', () => {
        closePreviewModal();
    });
}

/**
 * Closes the preview modal and performs full resource cleanup:
 *  - Cancels any in-flight high-res image load (prevents stale onload callbacks)
 *  - Clears background-image on the art layer → frees GPU texture buffer
 *  - Removes will-change from the modal element → releases compositor layer
 *  - Clears the clock interval
 *  - Removes the contextmenu blocker from the stage
 *
 * Public — no arguments needed (resolves DOM refs internally).
 * Also accepts optional explicit refs for internal callers (unchanged API).
 *
 * @param {HTMLElement} [modal]  Defaults to #preview-modal.
 * @param {HTMLElement} [stage]  Defaults to #preview-mockup-stage.
 */
function closePreviewModal(modal, stage) {
    const m    = modal || document.getElementById('preview-modal');
    const s    = stage || document.getElementById('preview-mockup-stage');
    const slot = document.getElementById('mockup-slot');

    // ── Cancel in-flight HiRes load ───────────────────────────────────────────
    if (_pendingHiResImg) {
        _pendingHiResImg.onload = _pendingHiResImg.onerror = null;
        _pendingHiResImg = null;
    }

    // ── GPU memory flush: clear art layer background-image ────────────────────
    // Setting to 'none' immediately releases the decoded texture from the GPU
    // buffer, which is critical on <2GB RAM devices where large images stay
    // resident as long as they are referenced in the DOM.
    const artEl = slot?.querySelector('.mockup-layer-art');
    if (artEl) {
        artEl.style.backgroundImage = 'none';
        artEl.classList.remove('mockup-bg-loading', 'mockup-bg-ready');
    }

    // ── Remove slot contextmenu blocker ───────────────────────────────────────
    if (slot) slot.oncontextmenu = null;

    // ── will-change cleanup ───────────────────────────────────────────────────
    // Removing will-change after the modal is hidden tells the browser it can
    // discard the promoted compositor layer, freeing GPU memory.
    if (m) { m.style.willChange = 'auto'; m.classList.add('hidden'); }

    // ── Clock interval ────────────────────────────────────────────────────────
    if (_mockupClockInterval) { clearInterval(_mockupClockInterval); _mockupClockInterval = null; }

    // ── Stage contextmenu listener ────────────────────────────────────────────
    if (s && _stageCtxHandler) {
        s.removeEventListener('contextmenu', _stageCtxHandler);
    }

    // ── Restaurar foco al elemento que abrió la vista previa (WCAG 2.4.3) ────
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

// Private alias kept for internal callers that pass explicit refs (unchanged API)
const _closePreviewModal = closePreviewModal;

// ── Global exposure ───────────────────────────────────────────────────────────
// Required for:
//   (a) onclick="openPreviewModal(...)" in dynamically generated HTML strings
//   (b) onclick="closePreviewModal()" in modal action buttons
//   (c) any game module or external script calling the preview API
window.openPreviewModal  = openPreviewModal;
window.closePreviewModal = closePreviewModal;

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.shop-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tab)
    );
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${tab}`);
    panel.classList.remove('hidden');

    if (tab === 'settings') {
        renderHistory();
        renderMoonBlessingStatus();
        renderStreakCalendar();
    }
    // Scope al panel activo: evita re-escanear vistas ocultas de la SPA.
    refreshIcons(panel);
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function filterItems() {
    if (!allItems.length) return;

    const filtered = allItems.filter(item => {
        let matchesFilter;
        if      (activeFilter === 'Todos')       matchesFilter = true;
        else if (activeFilter === 'Wishlist')    matchesFilter = GameCenter.isWishlisted(item.id);
        else if (activeFilter === 'NoObtenidos') matchesFilter = GameCenter.getBoughtCount(item.id) === 0;
        else                                     matchesFilter = Array.isArray(item.tags) && item.tags.includes(activeFilter);

        const matchesSearch = !searchQuery
            || item.name.toLowerCase().includes(searchQuery)
            || (item.desc || '').toLowerCase().includes(searchQuery)
            || (Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(searchQuery)));

        return matchesFilter && matchesSearch;
    });

    const wishlisted = filtered.filter(item =>  GameCenter.isWishlisted(item.id));
    const others     = filtered.filter(item => !GameCenter.isWishlisted(item.id));
    renderShop([...wishlisted, ...others]);

    const countEl = document.getElementById('search-results-count');
    const emptyEl = document.getElementById('filter-empty');
    const gridEl  = document.getElementById('shop-container');
    const sorted  = [...wishlisted, ...others];

    if (sorted.length === 0) {
        gridEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        countEl.classList.add('hidden');
    } else {
        gridEl.classList.remove('hidden');
        emptyEl.classList.add('hidden');
        const isFiltered = activeFilter !== 'Todos' || searchQuery;
        countEl.textContent = isFiltered ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''}` : '';
        countEl.classList.toggle('hidden', !isFiltered);
    }
    updateWishlistCost();
}

function resetFilters() {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-filter="Todos"]').classList.add('active');
    activeFilter = 'Todos';
    searchQuery  = '';
    const searchInput = document.getElementById('search-input');
    const clearBtn    = document.getElementById('search-clear');
    if (searchInput) searchInput.value = '';
    if (clearBtn)    clearBtn.classList.add('hidden');
    filterItems();
}
// Exponer globalmente (compatible con onclick="resetFilters()" en el HTML)
window.resetFilters = resetFilters;

// ── Wishlist Cost ─────────────────────────────────────────────────────────────
function updateWishlistCost() {
    const banner = document.getElementById('wishlist-cost-banner');
    const textEl = document.getElementById('wishlist-cost-text');
    if (!banner || !textEl || !allItems.length) return;

    const unowned = allItems.filter(item =>
        GameCenter.isWishlisted(item.id) && GameCenter.getBoughtCount(item.id) === 0
    );
    if (unowned.length === 0) { banner.classList.add('hidden'); return; }

    const eco   = window.ECONOMY;
    const total = unowned.reduce((sum, item) => {
        const price = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;
        return sum + price;
    }, 0);

    const balance = GameCenter.getBalance();
    const needed  = Math.max(0, total - balance);
    const count   = unowned.length;
    const plural  = count !== 1 ? 's' : '';

    textEl.innerHTML = needed > 0
        ? `Necesitas <strong>${needed} ⭐</strong> más para toda tu lista (<strong>${count}</strong> ítem${plural})`
        : `¡Tienes saldo para toda tu lista! (<strong>${count}</strong> ítem${plural})`;

    banner.classList.remove('hidden');
    if (window.lucide) lucide.createIcons({ nodes: [banner] });
}

// ── Render: Streak Calendar ───────────────────────────────────────────────────
function renderStreakCalendar() {
    const cal = document.getElementById('settings-streak-calendar');
    if (!cal) return;
    const info    = window.GameCenter?.getStreakInfo?.();
    const streak  = info?.streak || 0;
    const days    = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
    const rewards = [20, 25, 30, 35, 40, 50, 60];

    cal.innerHTML = days.map((day, i) => {
        let cls = 'streak-cal-dot';
        if      (i < streak)  cls += ' claimed';
        else if (i === streak) cls += ' today';
        return `<div class="streak-cal-day">
            <span class="streak-cal-label">${day}</span>
            <div class="${cls}" title="${rewards[i]} monedas">
                ${i < streak ? '<i data-lucide="check" size="10"></i>' : rewards[i]}
            </div>
        </div>`;
    }).join('');

    if (window.lucide) lucide.createIcons({ nodes: [cal] });
}

// ── Render: Catálogo ──────────────────────────────────────────────────────────
function renderShop(items) {
    const container = document.getElementById('shop-container');
    container.innerHTML = '';
    if (!items.length) return;

    items.forEach(item => {
        const bought     = GameCenter.getBoughtCount(item.id);
        const isOwned    = bought > 0;
        const isWished   = GameCenter.isWishlisted(item.id);
        const eco        = window.ECONOMY;
        const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

        const priceHTML = eco.isSaleActive && !isOwned
            ? `<div class="shop-price">
                   <span class="price-original">${item.price}</span>
                   <i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i>
                   <span class="price-sale">${finalPrice}</span>
               </div>`
            : `<div class="shop-price">
                   <i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i>
                   ${isOwned ? '<span style="color:var(--success);">Obtenido</span>' : item.price}
               </div>`;

        let actionHTML;
        if (isOwned) {
            const url = GameCenter.getDownloadUrl(item.id, item.file);
            actionHTML = url
                ? `<a href="${url}" download class="btn-primary vault-btn"
                       style="width:100%; justify-content:center; font-size:0.78rem; padding:7px;">
                       <i data-lucide="download" size="13"></i> Descargar
                   </a>`
                : `<button class="btn-primary"
                       style="width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;"
                       disabled>
                       <i data-lucide="check" size="13"></i> Obtenido
                   </button>`;
        } else {
            actionHTML =
                `<div style="display:flex; gap:5px; width:100%;">
                    <button class="btn-ghost shop-preview-btn"
                            style="flex-shrink:0; padding:7px 9px;"
                            data-id="${item.id}" title="Vista previa">
                        <i data-lucide="eye" size="13"></i>
                    </button>
                    <button class="btn-primary shop-buy-btn"
                            style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;"
                            data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                        <i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i> ${finalPrice}
                    </button>
                </div>`;
        }

        const card = document.createElement('article');
        card.className = 'glass-panel shop-card';
        // will-change en tarjetas: gestionado en CSS vía .shop-card:hover { will-change: transform }
        // NO se aplica aquí en JS para evitar promover N capas GPU mientras el catálogo está en reposo.
        card.innerHTML =
            `${!isOwned
                ? `<button class="wishlist-btn ${isWished ? 'wishlist-btn--active' : ''}"
                           data-id="${item.id}"
                           title="${isWished ? 'Quitar de lista' : 'Agregar a lista de deseos'}">
                       <i data-lucide="heart" size="12"></i>
                   </button>`
                : ''}
            <img src="${item.image}" alt="${item.name}" class="shop-img" loading="lazy">
            ${isOwned ? '<div class="owned-badge"><i data-lucide="check-circle-2" size="10"></i> Tuyo</div>' : ''}
            ${eco.isSaleActive && !isOwned
                ? '<div class="sale-card-badge"><i data-lucide="zap" size="9" fill="currentColor" stroke="none"></i> OFERTA</div>'
                : ''}
            <div style="width:100%;">
                <h3 class="card-name">${item.name}</h3>
                ${priceHTML}
                ${actionHTML}
            </div>`;

        container.appendChild(card);
    });

    // Wishlist listeners
    container.querySelectorAll('.wishlist-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const id    = parseInt(btn.dataset.id, 10);
            const isNow = GameCenter.toggleWishlist(id);
            btn.classList.toggle('wishlist-btn--active', isNow);
            btn.title = isNow ? 'Quitar de lista' : 'Agregar a lista de deseos';
            btn.innerHTML = '<i data-lucide="heart" size="12"></i>';
            if (window.lucide) lucide.createIcons({ nodes: [btn] });
            updateWishlistCost();
        });
    });

    // Preview listeners
    container.querySelectorAll('.shop-preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = allItems.find(i => i.id === parseInt(btn.dataset.id, 10));
            if (item) openPreviewModal(item);
        });
    });

    // Buy listeners
    container.querySelectorAll('.shop-buy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                const item = JSON.parse(btn.dataset.item.replace(/&#39;/g, "'"));
                await initiatePurchase(item, btn);
            } catch (e) { console.error('Error parsing item', e); }
        });
    });

    // Scope al container del catálogo.
    // @perf ADVERTENCIA: renderShop destruye y reconstruye el DOM completo en cada
    // llamada (cada keystroke del buscador, cada cambio de filtro, cada compra).
    // NO añadir lógica costosa dentro del forEach de items sin considerar este ciclo.
    refreshIcons(container);
}

// ── Render: Biblioteca ────────────────────────────────────────────────────────
function renderLibrary(items) {
    const container = document.getElementById('library-container');
    const inventory = GameCenter.getInventory();
    const owned     = items.filter(item => inventory[item.id] > 0);

    if (owned.length === 0) {
        container.innerHTML =
            `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-low);">
                <i data-lucide="archive" size="40" style="opacity:0.25; display:block; margin:0 auto 12px;"></i>
                <p style="font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--text-med);">Tu biblioteca está vacía</p>
                <p style="font-size:0.8rem; margin-top:6px;">Canjea wallpapers en el Catálogo.</p>
            </div>`;
        refreshIcons(container); // scope al contenedor vacío
        return;
    }

    container.innerHTML = '';
    owned.forEach(item => {
        const url  = GameCenter.getDownloadUrl(item.id, item.file);
        const card = document.createElement('article');
        card.className     = 'glass-panel shop-card';
        // will-change gestionado por CSS (:hover), no en JS (ver renderShop)

        const actionsHTML = url
            ? `<div style="display:flex; gap:5px; width:100%; margin-top:8px;">
                   <a href="${url}" download
                      class="btn-primary vault-btn"
                      style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;">
                       <i data-lucide="download" size="13"></i> Descargar
                   </a>
                   <button class="btn-mail library-mail-btn"
                           data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'
                           data-url="${url}"
                           aria-label="Enviar enlace de descarga por correo para ${item.name.replace(/"/g, '&quot;')}"
                           title="Enviar por correo">
                       <i data-lucide="send" size="13"></i>
                   </button>
               </div>`
            : `<button class="btn-primary"
                       style="margin-top:8px; width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;"
                       disabled>
                   <i data-lucide="check" size="13"></i> Sin archivo
               </button>`;

        card.innerHTML =
            `<img src="${item.image}" alt="${item.name}" class="shop-img" loading="lazy">
            <div class="owned-badge"><i data-lucide="check-circle-2" size="10"></i> Tuyo</div>
            <div style="width:100%;">
                <h3 class="card-name">${item.name}</h3>
                ${actionsHTML}
            </div>`;

        container.appendChild(card);
    });

    container.querySelectorAll('.library-mail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            try {
                const item        = JSON.parse(btn.dataset.item.replace(/&#39;/g, "'"));
                const relativeUrl = btn.dataset.url;
                const absoluteUrl = new URL(relativeUrl, window.location.href).href;
                openEmailModal(item, absoluteUrl);
            } catch (e) { console.error('MailBtn error', e); }
        });
    });

    refreshIcons(container); // scope a la biblioteca renderizada
}

// ── Render: Historial ─────────────────────────────────────────────────────────
function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    const history = GameCenter.getHistory();

    if (!history.length) {
        container.innerHTML =
            '<p style="color:var(--text-low); font-size:0.8rem; text-align:center; padding:16px 0;">Sin transacciones aún.</p>';
        return;
    }

    container.innerHTML = history.slice(0, 50).map(entry => {
        if (entry.tipo) {
            const isIn  = entry.tipo === 'ingreso';
            const fecha = new Date(entry.fecha).toLocaleString('es-MX', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            return `<div class="history-entry">
                <span class="history-icon ${isIn ? 'history-icon--in' : 'history-icon--out'}">${isIn ? '+' : '-'}</span>
                <div class="history-detail">
                    <span class="history-motivo">${entry.motivo}</span>
                    <span class="history-fecha">${fecha}</span>
                </div>
                <span class="history-amount ${isIn ? 'history-amount--in' : 'history-amount--out'}">
                    ${isIn ? '+' : '-'}${entry.cantidad}
                </span>
            </div>`;
        } else {
            // Formato legado v7.2 (anterior a la migración SPA). Las entradas antiguas
            // usaban { date, itemId, name, price } en lugar de { fecha, tipo, cantidad, motivo }.
            // Este branch permanece activo para stores que no han pasado por migrateState()
            // todavía (primera carga desde v7.2 sin haber exportado e importado).
            // Puede retirarse cuando se confirme que ningún usuario activo tiene stores pre-v7.5.
            const fecha  = entry.date
                ? new Date(entry.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                : '—';
            const isCode = entry.itemId === 'promo_code';
            return `<div class="history-entry">
                <span class="history-icon ${isCode ? 'history-icon--in' : 'history-icon--out'}">${isCode ? '+' : '-'}</span>
                <div class="history-detail">
                    <span class="history-motivo">${entry.name || 'Transacción'}</span>
                    <span class="history-fecha">${fecha}</span>
                </div>
                <span class="history-amount ${isCode ? 'history-amount--in' : 'history-amount--out'}">
                    ${isCode ? `+${entry.price || '?'}` : `-${entry.price || '?'}`}
                </span>
            </div>`;
        }
    }).join('');
}

// ── Compra ────────────────────────────────────────────────────────────────────
async function initiatePurchase(item, btn) {
    const eco        = window.ECONOMY;
    const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;
    const cashback   = Math.floor(finalPrice * eco.cashbackRate);
    const netCost    = finalPrice - cashback;

    const bodyHTML =
        `<div class="modal-product-row">
            <span class="modal-label">Wallpaper</span>
            <span class="modal-value" style="color:var(--text-high); font-size:0.85rem;">${item.name}</span>
        </div>
        ${eco.isSaleActive
            ? `<div class="modal-product-row">
                   <span class="modal-label">Precio original</span>
                   <span class="modal-strikethrough">${item.price} ⭐</span>
               </div>
               <div class="modal-product-row">
                   <span class="modal-label">Con oferta</span>
                   <span class="modal-value--sale">${finalPrice} ⭐</span>
               </div>`
            : `<div class="modal-product-row">
                   <span class="modal-label">Precio</span>
                   <span class="modal-value">${item.price} ⭐</span>
               </div>`}
        ${cashback > 0
            ? `<div class="modal-product-row">
                   <span class="modal-label">Cashback</span>
                   <span class="modal-value--cashback">+${cashback} ⭐</span>
               </div>`
            : ''}
        <div class="modal-product-row modal-product-row--total">
            <span class="modal-label" style="font-weight:700;">Costo neto</span>
            <span class="modal-value--total">${netCost} ⭐</span>
        </div>`;

    const confirmed = await openConfirmModal({
        title:       '¿Canjear wallpaper?',
        bodyHTML,
        confirmText: `Canjear · ${finalPrice} ⭐`
    });
    if (!confirmed) return;

    const result = GameCenter.buyItem(item);
    if (result.success) {
        filterItems();
        renderLibrary(allItems);
        document.querySelectorAll('.coin-display').forEach(el => el.textContent = GameCenter.getBalance());
        fireConfetti();
        const cbNote = result.cashback > 0 ? ` <strong>+${result.cashback} cashback</strong> devueltas.` : '';
        showToast(`"${item.name}" desbloqueado.${cbNote} Ve a <strong>Mis Tesoros</strong>.`, 'success');
        updateWishlistCost();
    } else {
        if (result.reason === 'coins') {
            if (btn) shakeElement(btn);
            showToast('No tienes suficientes monedas.', 'error');
        }
    }
}

/**
 * Aplica la animación de "shake" a un elemento sin forzar un layout reflow síncrono.
 *
 * El patrón clásico `void el.offsetWidth` fuerza al navegador a calcular el layout
 * completo del documento para obtener offsetWidth, lo cual es la operación de
 * layout más costosa. El doble requestAnimationFrame evita ese coste: el primer RAF
 * espera a que el browser haya procesado la eliminación de la clase en el frame
 * actual; el segundo RAF aplica la clase de nuevo en el siguiente frame, logrando
 * el reset de animación sin tocar el árbol de layout.
 *
 * @param {HTMLElement} el  Elemento al que aplicar la animación.
 */
function shakeElement(el) {
    el.classList.remove('anim-shake');
    // Doble RAF: reinicia la animación CSS sin forzar layout reflow (reemplaza void el.offsetWidth).
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.classList.add('anim-shake');
            el.addEventListener('animationend', () => el.classList.remove('anim-shake'), { once: true });
        });
    });
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function fireConfetti() {
    // No disparar si la pestaña está inactiva (performance)
    if (document.hidden) return;
    // Verificar que estamos en la vista de Tienda
    if (window.SpaRouter?.getCurrentView?.() !== 'shop') return;

    const colors = ['#9b59ff', '#ff59b4', '#fbbf24', '#22d07a', '#00d4ff'];
    confetti({ particleCount: 55, angle: 60,  spread: 65, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 55, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors });
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(html, type = 'success') {
    const toast     = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = html;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        // .remove() tras la animación → limpieza del DOM (no solo ocultado)
        setTimeout(() => toast.remove(), 400);
    }, 4500);
}

// ── Código Promo ──────────────────────────────────────────────────────────────
async function handleRedeem() {
    const input  = document.getElementById('promo-input');
    const msg    = document.getElementById('promo-msg');
    const btn    = document.getElementById('btn-redeem');
    const code   = input.value.trim();
    if (!code) return;

    btn.disabled = true;
    const result = await window.GameCenter.redeemPromoCode(code);
    btn.disabled = false;

    if (result.success) {
        showMsg(msg, result.message, 'var(--success)');
        input.value = '';
        input.style.borderColor = '';
        document.querySelectorAll('.coin-display').forEach(el => el.textContent = GameCenter.getBalance());
        if (!document.hidden) {
            confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 }, colors: ['#fbbf24','#9b59ff','#22d07a'] });
        }
    } else {
        showMsg(msg, result.message, 'var(--error)');
        input.style.borderColor = 'var(--error)';
        shakeElement(btn);
    }
}

// ── Sincronización ────────────────────────────────────────────────────────────
async function handleExport() {
    const msg = document.getElementById('export-msg');
    const btn = document.getElementById('btn-export');
    btn.disabled = true;
    showMsg(msg, 'Generando código con checksum…', 'var(--text-low)');

    const code = await GameCenter.exportSave();
    btn.disabled = false;

    if (!code) { showMsg(msg, 'Error al generar el código.', 'var(--error)'); return; }

    // Usar la utilidad centralizada de portapapeles para evitar duplicar
    // el patrón navigator.clipboard + fallback execCommand (ya existe en MailHelper).
    const clipboardOk = await window.MailHelper.copyToClipboard(code);

    try {
        const blob = new Blob([code], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `love-arcade-backup-${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (_) {}

    showMsg(msg, clipboardOk
        ? '✓ Código copiado al portapapeles y archivo .txt descargado.'
        : '✓ Archivo .txt descargado.', 'var(--success)');
}

async function handleImport() {
    const code = document.getElementById('import-input').value.trim();
    const msg  = document.getElementById('import-msg');
    const btn  = document.getElementById('btn-import');

    if (!code) { showMsg(msg, 'Carga un archivo o pega un código.', 'var(--error)'); return; }

    const confirmed = await openConfirmModal({
        title:    'Importar partida',
        bodyHTML:
            `<div class="modal-warning">
                Esto <strong>reemplazará tu progreso actual</strong> (monedas, wallpapers, racha y ajustes).<br><br>
                Esta acción no se puede deshacer.
            </div>`,
        confirmText: 'Sí, importar'
    });
    if (!confirmed) return;

    btn.disabled = true;
    showMsg(msg, 'Verificando integridad…', 'var(--text-low)');

    const result = await GameCenter.importSave(code);
    btn.disabled = false;

    if (result.success) {
        showMsg(msg, '✓ Importado correctamente. Recargando…', 'var(--success)');
        setTimeout(() => location.reload(), 1200);
    } else {
        showMsg(msg, result.message || 'Código inválido o corrupto.', 'var(--error)');
    }
}

// ── Moon Blessing Status ──────────────────────────────────────────────────────
function renderMoonBlessingStatus() {
    const status   = GameCenter.getMoonBlessingStatus();
    const statusEl = document.getElementById('moon-blessing-status');
    if (!statusEl) return;
    if (status.active) {
        statusEl.textContent = `Activa · expira ${status.expiresAt}`;
        statusEl.className   = 'eco-badge eco-badge--moon';
    } else {
        statusEl.textContent = 'Inactiva';
        statusEl.className   = 'eco-badge';
    }
}

// ── Sale Banner + Economy Info ────────────────────────────────────────────────
function initSaleBanner() {
    const eco    = window.ECONOMY;
    const banner = document.getElementById('sale-banner');
    if (!banner) return;
    if (eco.isSaleActive) {
        banner.classList.remove('hidden');
        const pct     = Math.round((1 - eco.saleMultiplier) * 100);
        const badgeEl = document.getElementById('sale-badge-pct');
        document.getElementById('sale-label-text').textContent = `¡${eco.saleLabel}!`;
        document.getElementById('sale-desc-text').textContent  =
            `${pct}% de descuento + ${Math.round(eco.cashbackRate * 100)}% de cashback en toda la tienda.`;
        if (badgeEl) badgeEl.textContent = `${pct}%`;
    }
    // Scope al banner; el ícono de rayo (zap) solo vive dentro de este nodo.
    refreshIcons(banner);
}

function initEconomyInfo() {
    const eco    = window.ECONOMY;
    const saleEl = document.getElementById('eco-sale-status');
    const cbEl   = document.getElementById('eco-cashback');
    if (!saleEl || !cbEl) return;
    const pct = Math.round((1 - eco.saleMultiplier) * 100);
    saleEl.textContent = eco.isSaleActive ? `${pct}% OFF activo` : 'Sin oferta activa';
    saleEl.className   = 'eco-badge' + (eco.isSaleActive ? ' eco-badge--sale' : '');
    cbEl.textContent   = `${Math.round(eco.cashbackRate * 100)}% en cada compra`;
    cbEl.className     = 'eco-badge eco-badge--green';
}

// ── Util ──────────────────────────────────────────────────────────────────────
function showMsg(el, text, color) {
    if (!el) return;
    el.innerHTML     = text;
    el.style.color   = color;
    el.style.opacity = '1';
}

// ── Email Modal ───────────────────────────────────────────────────────────────
let _emailItem        = null;
let _emailAbsoluteUrl = '';

function openEmailModal(item, absoluteUrl) {
    _emailItem        = item;
    _emailAbsoluteUrl = absoluteUrl;

    const thumbEl = document.getElementById('email-modal-thumb');
    const nameEl  = document.getElementById('email-modal-item-name');
    if (thumbEl) { thumbEl.src = item.image; thumbEl.alt = item.name; }
    if (nameEl)  { nameEl.textContent = item.name; }

    const inputEl = document.getElementById('email-modal-input');
    if (inputEl) {
        inputEl.value = window.MailHelper.getLastMailRecipient();
        _setEmailError(false);
    }

    const fallbackEl = document.getElementById('email-fallback');
    if (fallbackEl) fallbackEl.classList.remove('visible');

    const modal = document.getElementById('email-modal');
    modal.classList.remove('hidden');
    // Guardar foco activo para restaurarlo al cerrar el modal (WCAG 2.4.3).
    _lastFocusedElement = document.activeElement;
    refreshIcons(modal);
    requestAnimationFrame(() => { if (inputEl) inputEl.focus(); });
}

function _closeEmailModal() {
    document.getElementById('email-modal').classList.add('hidden');
    _emailItem        = null;
    _emailAbsoluteUrl = '';
    // Restaurar foco al botón de envío que abrió el modal (WCAG 2.4.3).
    _lastFocusedElement?.focus();
    _lastFocusedElement = null;
}

function _setEmailError(show, msg = 'Introduce un correo electrónico válido.') {
    const errorEl   = document.getElementById('email-modal-error');
    const errorText = document.getElementById('email-modal-error-text');
    const inputEl   = document.getElementById('email-modal-input');
    if (!errorEl || !inputEl) return;
    if (show) {
        if (errorText) errorText.textContent = msg;
        errorEl.classList.add('visible');
        inputEl.classList.add('email-input--error');
        inputEl.setAttribute('aria-invalid', 'true');
    } else {
        errorEl.classList.remove('visible');
        inputEl.classList.remove('email-input--error');
        inputEl.setAttribute('aria-invalid', 'false');
    }
}

async function _handleEmailConfirm() {
    if (!_emailItem || !_emailAbsoluteUrl) return;

    const inputEl    = document.getElementById('email-modal-input');
    const saveCb     = document.getElementById('email-save-checkbox');
    const fallbackEl = document.getElementById('email-fallback');
    const fallUrlEl  = document.getElementById('email-fallback-url');

    const email = (inputEl?.value || '').trim();

    if (!window.MailHelper.isValidEmail(email)) {
        _setEmailError(true);
        inputEl?.focus();
        return;
    }
    _setEmailError(false);

    const { uri, tooLong } = window.MailHelper.buildMailtoLink(_emailItem, _emailAbsoluteUrl, email);

    if (tooLong) {
        if (fallbackEl) fallbackEl.classList.add('visible');
        if (fallUrlEl)  fallUrlEl.textContent = _emailAbsoluteUrl;
        if (window.lucide) lucide.createIcons({ nodes: [fallbackEl] });

        const copyBtn = document.getElementById('email-copy-btn');
        if (copyBtn) {
            const freshBtn = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(freshBtn, copyBtn);
            document.getElementById('email-copy-btn').addEventListener('click', async () => {
                const ok  = await window.MailHelper.copyToClipboard(_emailAbsoluteUrl);
                const lbl = document.getElementById('email-copy-label');
                if (lbl) lbl.textContent = ok ? '✓ Enlace copiado' : 'No se pudo copiar';
                setTimeout(() => { if (lbl) lbl.textContent = 'Copiar enlace de descarga'; }, 2500);
            });
        }
        if (saveCb?.checked) window.MailHelper.saveLastMailRecipient(email);
        return;
    }

    if (saveCb?.checked) window.MailHelper.saveLastMailRecipient(email);
    window.location.href = uri;
    setTimeout(_closeEmailModal, 300);
}

// ── ShopView API pública (usada por spa-router.js) ────────────────────────────
window.ShopView = {
    /**
     * Llamado por spa-router.js cada vez que se entra a la vista de Tienda.
     * Refresca el estado de economía y los badges de luna sin re-renderizar
     * el catálogo completo (que ya está en memoria).
     */
    onEnter() {
        initEconomyInfo();
        renderMoonBlessingStatus();
        // Actualizar saldo en el badge de coin-display de la navbar
        document.querySelectorAll('.coin-display').forEach(el => {
            el.textContent = window.GameCenter?.getBalance?.() ?? 0;
        });
        // Re-aplicar filtros activos: si el usuario vuelve a la Tienda después de
        // navegar al Home, el catálogo se refiltra con el estado previo de activeFilter
        // y searchQuery en lugar de resetear a "Todos". Esto preserva el contexto
        // de navegación y evita la frustración de perder un filtro aplicado.
        if (allItems.length) filterItems();

        // Scope a la vista de la tienda. El sale banner, tabs y pills tienen
        // iconos dinámicos que pueden necesitar re-inicialización al volver a la vista.
        const shopView = document.getElementById('view-shop');
        if (shopView) refreshIcons(shopView);
    }
};

// ── Carga del catálogo con manejo de errores y reintento ─────────────────────

/**
 * Descarga shop.json y renderiza el catálogo.
 * Si la petición falla (red, 404, 500), oculta el grid y muestra
 * #shop-error-state con un botón de reintento que vuelve a llamar a esta función.
 *
 * Puede llamarse múltiples veces de forma segura (retry pattern):
 * cada invocación resetea el estado de error y muestra el indicador de carga.
 */
function loadCatalog() {
    const gridEl    = document.getElementById('shop-container');
    const errorEl   = document.getElementById('shop-error-state');
    const retryBtn  = document.getElementById('btn-retry-shop');
    const emptyEl   = document.getElementById('filter-empty');

    // Mostrar estado de carga; ocultar error previo y grid
    if (gridEl)  { gridEl.classList.add('hidden'); gridEl.innerHTML = ''; }
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    // Mostrar spinner en el grid mientras carga
    if (gridEl) {
        gridEl.classList.remove('hidden');
        gridEl.innerHTML =
            '<p style="color:var(--text-low); grid-column:1/-1; text-align:center; padding:40px 0;">' +
            '<i data-lucide="loader" size="24" style="display:block; margin:0 auto 10px; opacity:0.4;"></i>' +
            'Cargando catálogo…</p>';
        if (window.lucide) lucide.createIcons({ nodes: [gridEl] });
    }

    fetch('data/shop.json')
        .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(items => {
            allItems = items;
            if (gridEl) gridEl.innerHTML = '';
            filterItems();
            renderLibrary(items);
            updateWishlistCost();

            // Asegurar que el error state está oculto si se cargó correctamente
            if (errorEl) errorEl.classList.add('hidden');
        })
        .catch(err => {
            console.error('[ShopLogic] Error cargando shop.json:', err);

            // Ocultar grid y mostrar error state
            if (gridEl)  gridEl.classList.add('hidden');
            if (emptyEl) emptyEl.classList.add('hidden');
            if (errorEl) {
                errorEl.classList.remove('hidden');
                if (window.lucide) lucide.createIcons({ nodes: [errorEl] });
            }

            // Botón de reintento — registrar listener solo una vez usando dataset
            if (retryBtn && !retryBtn.dataset.bound) {
                retryBtn.dataset.bound = 'true';
                retryBtn.addEventListener('click', () => {
                    delete retryBtn.dataset.bound; // Permitir re-bind tras retry
                    loadCatalog();
                });
            }
        });
}

// ── DOMContentLoaded — Registro de event listeners (una sola vez) ─────────────
document.addEventListener('DOMContentLoaded', () => {

    // Inicializar banner y economía al cargar
    initSaleBanner();
    initEconomyInfo();
    renderMoonBlessingStatus();
    renderStreakCalendar();

    // Confirm modal
    document.getElementById('modal-cancel').addEventListener('click',  () => _closeModal(false));
    document.getElementById('modal-confirm').addEventListener('click', () => _closeModal(true));
    document.getElementById('confirm-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeModal(false);
    });

    // Preview modal (Preview 2.0)
    // The static #preview-close button (X in corner) and backdrop click both
    // call the public closePreviewModal() so DOM refs are resolved inside the function.
    document.getElementById('preview-close').addEventListener('click', () => closePreviewModal());
    document.getElementById('preview-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) closePreviewModal();
    });

    // Email modal
    document.getElementById('email-modal-cancel').addEventListener('click', _closeEmailModal);
    document.getElementById('email-modal').addEventListener('click', e => {
        if (e.target === e.currentTarget) _closeEmailModal();
    });
    document.getElementById('email-modal-confirm').addEventListener('click', _handleEmailConfirm);
    document.getElementById('email-modal-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') _handleEmailConfirm();
    });
    document.getElementById('email-modal-input').addEventListener('input', () => {
        _setEmailError(false);
    });

    // Escape global cierra todos los modales
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.getElementById('confirm-modal').classList.add('hidden');
            closePreviewModal();
            _closeEmailModal();
        }
    });

    // Toggle código promo
    document.getElementById('btn-promo-toggle').addEventListener('click', () => {
        const toggleBtn = document.getElementById('btn-promo-toggle');
        const section   = document.getElementById('promo-section');
        const expanded  = toggleBtn.getAttribute('aria-expanded') === 'true';
        toggleBtn.setAttribute('aria-expanded', String(!expanded));
        section.setAttribute('aria-hidden',    String(expanded));
        section.classList.toggle('promo-section--collapsed', expanded);
        section.classList.toggle('promo-section--open', !expanded);
        if (!expanded) setTimeout(() => document.getElementById('promo-input').focus(), 50);
        if (window.lucide) lucide.createIcons({ nodes: [toggleBtn] });
    });

    // ── Cargar catálogo UNA SOLA VEZ (con manejo de errores y reintento) ────────
    loadCatalog();

    // Promo code
    document.getElementById('btn-redeem').addEventListener('click', handleRedeem);
    document.getElementById('promo-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') handleRedeem();
    });

    // Tabs
    document.querySelectorAll('.shop-tab').forEach(btn =>
        btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );

    // Search con debounce
    const searchInput  = document.getElementById('search-input');
    const clearBtn     = document.getElementById('search-clear');
    const debouncedFilter = window.debounce(() => {
        searchQuery = searchInput.value.trim().toLowerCase();
        filterItems();
    }, 300);

    searchInput.addEventListener('input', () => {
        clearBtn.classList.toggle('hidden', !searchInput.value);
        debouncedFilter();
    });
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery       = '';
        clearBtn.classList.add('hidden');
        filterItems();
        searchInput.focus();
    });

    // Botón "Ver todo el catálogo" en el estado vacío de filtros
    // Reemplaza el onclick inline del HTML para respetar CSP y separación de responsabilidades.
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => resetFilters());

    // Filter pills
    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeFilter = pill.dataset.filter;
            filterItems();
        });
    });

    // Sync
    document.getElementById('btn-export')?.addEventListener('click', handleExport);
    document.getElementById('btn-import')?.addEventListener('click', handleImport);

    document.getElementById('import-file')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const nameEl = document.getElementById('import-file-name');
        if (nameEl) nameEl.textContent = file.name;
        const reader = new FileReader();
        reader.onload  = evt => {
            const ta = document.getElementById('import-input');
            if (ta) ta.value = evt.target.result.trim();
            showMsg(document.getElementById('import-msg'),
                `Archivo "${file.name}" cargado. Haz clic en Importar.`, 'var(--text-med)');
        };
        reader.onerror = () =>
            showMsg(document.getElementById('import-msg'), 'Error al leer.', 'var(--error)');
        reader.readAsText(file);
    });

    // Moon Blessing button
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
            if (msg) {
                msg.style.opacity = '1';
                setTimeout(() => { msg.style.opacity = '0'; }, 3500);
            }
            renderMoonBlessingStatus();
        });
    }

    // NOTA: El listener de .theme-btn fue eliminado de shop-logic.js (SPA Migration).
    // El tema es una configuración global; su único handler vive en app.js,
    // donde setTheme() actualiza el store, los CSS vars, la clase theme-{key}
    // en <body> y el estado visual de todos los .theme-btn desde un único lugar.

    // Scan global ÚNICO al final del init: todos los iconos del HTML estático
    // (navbars, botones de ajustes, FAQs) se inicializan aquí. A partir de este
    // punto, todos los refreshIcons() en renders dinámicos usan scope explícito.
    refreshIcons();
});
