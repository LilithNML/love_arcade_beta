/**
 * UIController.js
 * Encargado de la manipulación del DOM, transiciones de pantalla y renderizado de listas.
 *
 * Actualizado v4.0 — Tactical Soul:
 * - initGlobalInteractions(): release bounce corregido a 0.96 → 1.04 → 1.0 (era 1.02).
 * - renderLevelsGrid(): stagger delay actualizado a 0.04s × índice (era 0.03s).
 * - Sin otros cambios de lógica — todas las correcciones son de motion design.
 */

import { Storage } from '../systems/Storage.js';

export const UI = {

    screens: {
        menu:     document.getElementById('screen-menu'),
        levels:   document.getElementById('screen-levels'),
        game:     document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Initialises global touch/mouse interactions.
     * Call once at app startup.
     *
     * Release bounce: 0.96 (press) → 1.04 (overshoot) → 1.0 (settle) in 200 ms.
     * Driven entirely by the Web Animations API (only transform — GPU composited).
     */
    initGlobalInteractions() {
        const selector = '.btn, .btn-icon, .btn-circle';

        const onRelease = (e) => {
            const el = e.target.closest(selector);
            if (!el) return;

            el.animate(
                [
                    { transform: 'scale3d(0.96, 0.96, 1)', easing: 'ease-out' },
                    { transform: 'scale3d(1.04, 1.04, 1)' },  // overshoot: 1.04 (was 1.02)
                    { transform: 'scale3d(1.00, 1.00, 1)' }
                ],
                { duration: 200, fill: 'none' }
            );
        };

        document.addEventListener('mouseup',  onRelease);
        document.addEventListener('touchend', onRelease, { passive: true });
    },

    /**
     * Switches the active screen with a slide transition.
     * Forces a CSS animation replay on nav buttons via reflow.
     */
    showScreen(targetIdOrName) {
        let targetScreen = document.getElementById(targetIdOrName);
        if (!targetScreen && UI.screens[targetIdOrName]) {
            targetScreen = UI.screens[targetIdOrName];
        }
        if (!targetScreen) {
            console.warn(`[UI] Pantalla no encontrada: ${targetIdOrName}`);
            return;
        }

        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            screen.style.pointerEvents = 'none';
        });

        targetScreen.classList.add('active');
        targetScreen.style.pointerEvents = 'all';
        window.scrollTo(0, 0);

        // Force-replay stagger animations on nav buttons each time the
        // menu is shown (void reflow trick to restart CSS animations).
        const navBtns = targetScreen.querySelectorAll('.main-nav .btn');
        navBtns.forEach(btn => {
            btn.style.animation = 'none';
            void btn.offsetHeight;
            btn.style.animation = '';
        });
    },

    /**
     * Renders the level grid with staggered card entry animation.
     * Each card enters 0.04 s after the previous (updated from 0.03 s).
     */
    renderLevelsGrid(levelsWithStatus, onLevelSelect) {
        const container = document.getElementById('levels-container');
        if (!container) return;

        container.innerHTML = '';

        levelsWithStatus.forEach((level, index) => {
            const card = document.createElement('div');

            const isUnlocked  = Storage.isUnlocked(level.id);
            const starsCount  = Storage.getStars(level.id);

            let statusClass = isUnlocked ? '' : 'locked';
            if (starsCount > 0) statusClass += ' completed';

            card.className = `level-card skeleton ${statusClass}`;

            // Stagger: each card enters 0.04 s after the previous
            card.style.animationDelay = `${index * 0.04}s`;

            // --- IMAGE (THUMBNAIL) ---
            const img = new Image();
            img.src     = level.thumbnail || level.image;
            img.loading = 'lazy';
            img.alt     = `Nivel ${level.index + 1}`;
            img.style.opacity    = '0';
            img.style.transition = 'opacity 0.3s ease';

            img.onload = () => {
                card.classList.remove('skeleton');
                img.style.opacity = '1';
                img.classList.add('loaded');
            };

            img.onerror = () => {
                if (level.thumbnail && img.src.includes('thumb')) {
                    img.src = level.image;
                } else {
                    card.classList.remove('skeleton');
                }
            };

            // --- OVERLAY ---
            const overlay = document.createElement('div');
            overlay.className = 'level-overlay';

            if (!isUnlocked) {
                overlay.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="1" ry="1"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
            } else if (starsCount > 0) {
                let stars = '';
                for (let i = 0; i < 3; i++) stars += i < starsCount ? '★' : '☆';
                overlay.innerHTML = `<div class="stars-display" style="color:#fbbf24; font-size:1.3rem;">${stars}</div>`;
            } else {
                const levelNum = level.id.split('_')[1] || (level.index + 1);
                overlay.innerHTML = `<span style="font-family:'Rajdhani',sans-serif; font-weight:700; letter-spacing:2px;">${levelNum}</span>`;
            }

            card.appendChild(img);
            card.appendChild(overlay);

            if (isUnlocked) {
                card.onclick = () => onLevelSelect(level.id);
            }

            container.appendChild(card);
        });
    },

    /**
     * Updates HUD elements during gameplay.
     */
    updateHUD(levelId, timeStr) {
        const lvlEl  = document.getElementById('hud-level');
        const timeEl = document.getElementById('hud-timer');
        if (lvlEl) {
            const num = levelId.replace('lvl_', '');
            lvlEl.textContent = `LVL ${num}`;
        }
        if (timeEl) timeEl.textContent = timeStr;
    },

    /**
     * Shows the victory modal with animated star display.
     */
    showVictoryModal(coins, timeStr, stars, onNext, onMenu) {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        const coinsEl = document.getElementById('victory-coins');
        const timeEl  = document.getElementById('victory-time');
        if (coinsEl) coinsEl.textContent = coins;
        if (timeEl)  timeEl.textContent  = timeStr;

        let starsContainer = document.getElementById('victory-stars');
        if (!starsContainer) {
            starsContainer = document.createElement('div');
            starsContainer.id = 'victory-stars';
            starsContainer.style.cssText = 'font-size:3rem; color:#fbbf24; text-align:center; margin:15px 0;';
            if (timeEl?.parentNode) {
                timeEl.parentNode.parentNode.insertBefore(starsContainer, timeEl.parentNode.nextSibling);
            }
        }

        let starsHTML = '';
        for (let i = 0; i < 3; i++) {
            starsHTML += i < stars
                ? '<span>★</span>'
                : '<span style="opacity:0.2">★</span>';
        }
        starsContainer.innerHTML = starsHTML;

        modal.classList.remove('hidden');

        // Clone buttons to remove stale listeners
        const btnNext = document.getElementById('btn-next-level');
        const btnMenu = document.getElementById('btn-victory-menu');
        if (btnNext && btnMenu) {
            const newNext = btnNext.cloneNode(true);
            const newMenu = btnMenu.cloneNode(true);
            btnNext.parentNode.replaceChild(newNext, btnNext);
            btnMenu.parentNode.replaceChild(newMenu, btnMenu);
            newNext.onclick = () => { modal.classList.add('hidden'); onNext(); };
            newMenu.onclick = () => { modal.classList.add('hidden'); onMenu(); };
        }
    }
};
