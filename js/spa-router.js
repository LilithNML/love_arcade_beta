/**
 * spa-router.js — Love Arcade v9.1
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
 *  - Restaurar el scroll a 0,0 con comportamiento instantáneo (sin animación).
 *  - Manejar data-anchor para deep-links dentro de la vista Inicio (#games, #faq).
 *  - [v9.1] Integrar la History API: botón Atrás vuelve a vista anterior sin recargar.
 *
 * HISTORY API (v9.1):
 *  - navigateTo() llama a history.pushState({ viewId, anchor }) en cada
 *    transición, registrando la entrada en el historial del navegador.
 *  - window.addEventListener('popstate') escucha Atrás/Adelante y llama a
 *    _applyView() SIN un nuevo pushState, evitando entradas duplicadas.
 *  - En DOMContentLoaded se usa history.replaceState para el estado inicial
 *    (evita que el primer "Atrás" genere una entrada huérfana).
 *
 * RESTRICCIONES DE RENDIMIENTO:
 *  - Cero reflows: la transición usa únicamente .hidden (display:none).
 *  - El router NO hace fetch ni accede a APIs externas.
 *  - Event listeners registrados una sola vez (DOMContentLoaded).
 */

(function () {
    'use strict';

    const VIEWS = ['home', 'shop'];

    /** @type {Object.<string, HTMLElement>} */
    let viewEls = {};

    /** @type {string} */
    let currentView = 'home';

    // ── Núcleo de transición (sin History API) ────────────────────────────────

    /**
     * Aplica la transición visual a una vista SIN registrar en el historial.
     * Ruta interna: usada tanto por navigateTo() como por el handler popstate.
     *
     * @param {'home'|'shop'} viewId
     * @param {string|null}   [anchor]
     */
    function _applyView(viewId, anchor) {
        if (!viewEls[viewId]) return;

        VIEWS.forEach(id => {
            viewEls[id].classList.toggle('hidden', id !== viewId);
        });

        currentView = viewId;

        _syncNavHighlight(viewId);
        window.GameCenter?.syncUI?.();
        if (window.lucide) lucide.createIcons();

        if (anchor) {
            requestAnimationFrame(() => {
                const target = document.getElementById(anchor);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }

        if (viewId === 'home') window.HomeView?.refresh?.();
        if (viewId === 'shop') window.ShopView?.onEnter?.();
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /**
     * Navega a una vista por su id y registra la entrada en el historial.
     *
     * @param {'home'|'shop'} viewId
     * @param {string|null}   [anchor]   ID del elemento al que hacer scroll (sin #).
     * @param {boolean}       [replace]  Si true, usa replaceState (para estado inicial).
     */
    function navigateTo(viewId, anchor, replace) {
        const state = { viewId, anchor: anchor || null };

        if (replace) {
            history.replaceState(state, '');
        } else if (viewId !== currentView) {
            // Solo pushState si realmente cambiamos de vista; evita duplicados
            // al pulsar repetidamente el mismo enlace de nav.
            history.pushState(state, '');
        }

        _applyView(viewId, anchor);
    }

    /** @returns {string} id de la vista activa. */
    function getCurrentView() {
        return currentView;
    }

    // ── Helpers privados ──────────────────────────────────────────────────────

    function _syncNavHighlight(viewId) {
        document.querySelectorAll('.nav-link[data-view]').forEach(link => {
            link.classList.toggle('active', link.dataset.view === viewId && !link.dataset.anchor);
        });
        document.querySelectorAll('.b-nav-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewId && !item.dataset.anchor);
        });
    }

    function _bindNavItem(el) {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = el.dataset.view;
            const anchor = el.dataset.anchor || null;

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

        // Registrar listeners de navegación
        document.querySelectorAll('[data-view]').forEach(el => {
            if (viewEls[el.dataset.view]) _bindNavItem(el);
        });

        _syncNavHighlight('home');

        // ── History API: estado inicial ───────────────────────────────────────
        // replaceState (no pushState) para que la entrada inicial quede en el
        // historial sin crear un salto extra hacia "atrás".
        navigateTo('home', null, /* replace= */ true);

        // ── Popstate: botón Atrás / Adelante ─────────────────────────────────
        // El navegador restaura el state y dispara 'popstate'. Usamos _applyView
        // directamente para NO generar una nueva entrada (evita bucle infinito).
        window.addEventListener('popstate', (e) => {
            const state  = e.state;
            const viewId = VIEWS.includes(state?.viewId) ? state.viewId : 'home';
            const anchor = state?.anchor || null;
            _applyView(viewId, anchor);
        });
    });

    // ── Exposición global ─────────────────────────────────────────────────────

    window.SpaRouter = { navigateTo, getCurrentView };

})();
