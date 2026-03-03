/**
 * spa-router.js — Love Arcade v9.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Router de navegación para la arquitectura Single Page Application.
 *
 * RESPONSABILIDADES:
 *  - Interceptar los clics en [data-view] de la navbar y la bottom-nav.
 *  - Alternar la clase .hidden entre #view-home y #view-shop.
 *  - Actualizar el estado visual activo en ambas navbars.
 *  - Llamar a window.GameCenter.syncUI() para sincronizar saldo en todos los
 *    indicadores (Navbar + HUD) inmediatamente tras la transición.
 *  - Re-inicializar Lucide en la vista entrante.
 *  - Restaurar el scroll a 0,0 con comportamiento instantáneo (sin animación)
 *    para evitar desorientación visual en móvil.
 *  - Manejar data-anchor para deep-links dentro de la vista Inicio (#games, #faq).
 *
 * RESTRICCIONES DE RENDIMIENTO:
 *  - Cero reflows: la transición usa únicamente .hidden (display:none) sin
 *    animar propiedades que generen layout (top, height, margin, etc.).
 *  - El router NO hace fetch ni accede a APIs externas.
 *  - Event listeners registrados una sola vez (DOMContentLoaded).
 */

(function () {
    'use strict';

    // ── Constantes ────────────────────────────────────────────────────────────

    const VIEWS = ['home', 'shop'];

    /**
     * Mapa de ids de vista → elementos del DOM.
     * Se construye en DOMContentLoaded para garantizar que el DOM está listo.
     * @type {Object.<string, HTMLElement>}
     */
    let viewEls = {};

    /** Vista activa en este momento. @type {string} */
    let currentView = 'home';

    // ── API pública ───────────────────────────────────────────────────────────

    /**
     * Navega a una vista por su id.
     * @param {'home'|'shop'} viewId
     * @param {string|null}   [anchor]  ID del elemento al que hacer scroll dentro
     *                                  de la vista (sin el #). Opcional.
     */
    function navigateTo(viewId, anchor) {
        if (!viewEls[viewId]) return;

        // Mostrar/ocultar vistas
        VIEWS.forEach(id => {
            viewEls[id].classList.toggle('hidden', id !== viewId);
        });

        currentView = viewId;

        // Sincronizar estado activo en ambas navbars
        _syncNavHighlight(viewId);

        // Actualizar todos los .coin-display y el HUD de forma animada
        window.GameCenter?.syncUI?.();

        // Re-inicializar iconos Lucide en la vista entrante (por contenido dinámico)
        if (window.lucide) lucide.createIcons();

        // Scroll instantáneo al inicio (o al anchor indicado)
        if (anchor) {
            // Pequeño delay para que la vista sea visible antes del scroll
            requestAnimationFrame(() => {
                const target = document.getElementById(anchor);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        // Callbacks de vista específicos
        if (viewId === 'home') {
            window.HomeView?.refresh?.();
        }
        if (viewId === 'shop') {
            window.ShopView?.onEnter?.();
        }
    }

    /** Devuelve la vista activa actual. @returns {string} */
    function getCurrentView() {
        return currentView;
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    /**
     * Actualiza las clases .active en los nodos de nav para reflejar la vista activa.
     * Solo opera sobre elementos con [data-view]; los hrefs de anchor (#games) no
     * se marcan como activos de la misma forma.
     *
     * @param {string} viewId
     */
    function _syncNavHighlight(viewId) {
        // Top navbar links
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            // El link es "activo" si su data-view coincide Y no tiene un anchor específico
            const isActive = link.dataset.view === viewId && !link.dataset.anchor;
            link.classList.toggle('active', isActive);
        });

        // Bottom nav items
        document.querySelectorAll('.b-nav-item[data-view]').forEach(item => {
            const isActive = item.dataset.view === viewId && !item.dataset.anchor;
            item.classList.toggle('active', isActive);
        });
    }

    /**
     * Registra un listener de clic en un elemento de navegación.
     * @param {Element} el
     */
    function _bindNavItem(el) {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = el.dataset.view;
            const anchor = el.dataset.anchor || null;

            // Si ya estamos en la misma vista sin anchor, solo hacer scroll al top
            if (viewId === currentView && !anchor) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            navigateTo(viewId, anchor);
        });
    }

    // ── Inicialización ────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {

        // Construir mapa de vistas
        VIEWS.forEach(id => {
            const el = document.getElementById(`view-${id}`);
            if (el) viewEls[id] = el;
        });

        // Registrar listeners en todos los elementos de navegación con data-view
        document.querySelectorAll('[data-view]').forEach(el => {
            if (viewEls[el.dataset.view]) {
                _bindNavItem(el);
            }
        });

        // Estado inicial de highlight
        _syncNavHighlight('home');
    });

    // ── Exposición global ─────────────────────────────────────────────────────

    window.SpaRouter = { navigateTo, getCurrentView };

})();
