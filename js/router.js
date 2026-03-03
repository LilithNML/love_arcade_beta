/**
 * router.js — Love Arcade SPA Router v9.0
 *
 * Arquitectura Single-Page Application con hash routing.
 *
 * RUTAS:
 *   #/       → Vista Inicio (Dashboard)
 *   #/shop   → Vista Tienda
 *
 * CICLO DE VIDA DE VISTAS:
 *   template()  → Devuelve el HTML a inyectar en #view-container.
 *   init()      → Se llama tras inyectar el HTML. Adjunta listeners y carga datos.
 *   teardown()  → Se llama antes de desmontar la vista. Limpia timers y listeners globales.
 *
 * ESCALABILIDAD:
 *   Para añadir una nueva sección (ej: Minijuegos):
 *   1. Crear el objeto { template, init, teardown }.
 *   2. Registrarlo en AppRouter._views con su ruta (ej: '/minigames').
 *   3. Añadir el enlace de navegación en index.html con data-spa-route="/minigames".
 */

// ─────────────────────────────────────────────────────────────────────────────
// CLASE ROUTER
// ─────────────────────────────────────────────────────────────────────────────

class Router {
    constructor(views) {
        this._views   = views;
        this._current = null;
        this._currentRoute = null;

        // Escuchar cambios de hash del navegador (botones Atrás/Adelante incluidos)
        window.addEventListener('hashchange', () => this._onHashChange());
    }

    /** Navega programáticamente a una ruta (ej: '/shop'). */
    navigate(route) {
        location.hash = '#' + route;
    }

    /** Devuelve la ruta activa actual. */
    currentRoute() {
        return this._currentRoute;
    }

    _onHashChange() {
        const hash = location.hash;
        // Solo interceptar rutas SPA (#/...). Ignorar anclas de scroll (#games, #faq, etc.)
        if (!hash || !hash.startsWith('#/')) return;
        const route = hash.slice(1); // '#/shop' → '/shop'
        this._mount(route);
    }

    _mount(route) {
        const view = this._views[route] || this._views['/'];
        if (!view) return;

        const container = document.getElementById('view-container');

        // ── 1. Transición de salida ────────────────────────────────────────────
        container.classList.remove('view-enter');
        container.classList.add('view-exit');

        setTimeout(() => {
            // ── 2. Desmontar vista anterior ────────────────────────────────────
            if (this._current?.teardown) this._current.teardown();
            this._current      = view;
            this._currentRoute = route;

            // ── 3. Inyectar nueva vista ────────────────────────────────────────
            container.innerHTML = view.template();
            container.classList.remove('view-exit');

            // ── 4. Transición de entrada ───────────────────────────────────────
            requestAnimationFrame(() => {
                container.classList.add('view-enter');
            });

            // ── 5. Actualizar estado activo en la navegación ───────────────────
            this._syncNav(route);

            // ── 6. Re-renderizar iconos Lucide ────────────────────────────────
            if (window.lucide) lucide.createIcons();

            // ── 7. Inicializar la vista ────────────────────────────────────────
            if (view.init) view.init();

            // ── 8. Scroll to top ──────────────────────────────────────────────
            window.scrollTo({ top: 0, behavior: 'instant' });

        }, 180); // Esperar a que termine la transición de salida
    }

    _syncNav(route) {
        document.querySelectorAll('[data-spa-route]').forEach(el => {
            el.classList.toggle('active', el.dataset.spaRoute === route);
        });
    }

    /** Inicia el router leyendo la URL actual. */
    start() {
        const hash = location.hash;
        if (hash.startsWith('#/')) {
            this._mount(hash.slice(1));
        } else {
            // Hash vacío o ancla de scroll → mostrar home
            this._mount('/');
        }
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// VISTA: INICIO (Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

const HomeView = {

    _countdownInterval: null,

    template() {
        return /* html */`
<main class="container">

    <!-- ══════════════════════════════════════
         PLAYER HUD
         ══════════════════════════════════════ -->
    <div class="player-hud">

        <div class="hud-top">
            <div class="hud-avatar-wrap">
                <label for="avatar-upload-hud">
                    <div class="hud-avatar" id="hud-avatar-display" style="background-image: url('assets/default_avatar.png');">
                        <i data-lucide="user" size="24"></i>
                    </div>
                </label>
                <div class="hud-avatar-ring"></div>
                <input type="file" id="avatar-upload-hud" hidden accept="image/*">
            </div>
            <div class="hud-info">
                <p class="hud-greeting">Bienvenido de vuelta</p>
                <p class="hud-name">Lilith</p>
                <p class="hud-status">
                    <span class="hud-status-dot"></span>
                    <span>En línea · Love Arcade</span>
                </p>
            </div>
        </div>

        <div class="hud-balance-row">
            <div class="hud-balance">
                <span class="hud-balance-label">Monedas</span>
                <div class="hud-balance-amount">
                    <i data-lucide="star" size="18" fill="#fbbf24" stroke="none"></i>
                    <span class="coin-display">0</span>
                </div>
            </div>
            <button id="btn-daily" class="hud-daily-btn">
                <i data-lucide="gift" size="20"></i>
                <span class="hud-daily-reward" id="hud-reward-amount">+20</span>
                <span class="hud-daily-label">BONO DIARIO</span>
            </button>
        </div>

        <div id="daily-countdown" class="hud-countdown hidden">
            Próximo bono en: <span id="countdown-display">--:--:--</span>
        </div>
        <p id="daily-msg" class="daily-msg"></p>

        <div class="hud-streak">
            <span class="streak-label"><i data-lucide="flame" size="11"></i> Racha</span>
            <div class="streak-days" id="streak-days">
                <div class="streak-day"></div>
                <div class="streak-day"></div>
                <div class="streak-day"></div>
                <div class="streak-day"></div>
                <div class="streak-day"></div>
                <div class="streak-day"></div>
                <div class="streak-day"></div>
            </div>
            <span class="streak-count" id="streak-count">×1</span>
        </div>
    </div>

    <!-- ══════════════════════════════════════
         GAME CARDS
         ══════════════════════════════════════ -->
    <div style="margin-bottom: 20px;">
        <h2 class="section-title" style="margin-bottom: 4px;">¿Qué vamos a jugar?</h2>
        <p class="section-subtitle">Gana monedas en cada partida</p>
    </div>

    <section id="games" class="games-grid">

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/jungle_dash_cover_art.webp');">
                <div class="card-badge badge-new">NUEVO</div>
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +100–150</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Jungle Dash</h3>
                <p class="card-desc">Controla a un jaguar en la selva y salta para esquivar obstáculos. ¿Cuánto puedes resistir?</p>
                <a href="games/jungle-dash" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/ollin_smash_cover_art.webp');">
                <div class="card-badge badge-new">NUEVO</div>
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +100–300</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Ollin Smash</h3>
                <p class="card-desc">Destruye todos los bloques antes de que la pelota caiga.</p>
                <a href="games/ollin-smash" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/space_shooter_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +10–50</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Vortex</h3>
                <p class="card-desc">Elimina todas las naves enemigas en este frenético shooter espacial.</p>
                <a href="games/Shooter" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/wordhunt_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +10–30</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Word Hunt</h3>
                <p class="card-desc">Encuentra todas las palabras ocultas en el tablero.</p>
                <a href="games/SopaDeLetras" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/pixeldrop_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +5–40</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Pixel Drop</h3>
                <p class="card-desc">El clásico de bloques reimaginado con giro pixelado.</p>
                <a href="games/pixel_drop.html" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/maze_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +10–35</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Laberinto</h3>
                <p class="card-desc">Encuentra el camino correcto a través de la oscuridad.</p>
                <a href="games/maze.html" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/rompecabezas_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +15–45</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Rompecabezas</h3>
                <p class="card-desc">Une las piezas para completar la imagen y ganar monedas.</p>
                <a href="games/rompecabezas" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

        <article class="game-card">
            <div class="card-cover" style="background-image: url('assets/cover/dodger_cover_art.webp');">
                <div class="card-reward"><i data-lucide="star" size="10" fill="#fbbf24" stroke="none"></i> +5–60</div>
            </div>
            <div class="card-info">
                <h3 class="card-title">Dodger</h3>
                <p class="card-desc">Sobrevive el mayor tiempo posible a la lluvia de asteroides.</p>
                <a href="games/Dodger" class="btn-primary w-full" style="justify-content:center;">
                    <i data-lucide="play" size="15"></i> Jugar Ahora
                </a>
            </div>
        </article>

    </section>

    <!-- ══════════════════════════════════════
         FAQ
         ══════════════════════════════════════ -->
    <section id="faq" style="margin-top: 72px;">
        <div class="section-header">
            <div>
                <h2 class="section-title">Preguntas Frecuentes</h2>
                <p class="section-subtitle">Todo lo que necesitas saber</p>
            </div>
        </div>
        <div class="faq-grid">

            <details class="glass-panel">
                <summary>¿Cómo gano monedas?</summary>
                <div class="faq-content">
                    Ganas monedas completando niveles en los juegos, canjeando códigos promocionales en la tienda, y reclamando el Bono Diario. La recompensa diaria escala con tu racha: empieza en 20 monedas y aumenta 5 por cada día consecutivo, hasta un máximo de 60. Activa la Bendición Lunar para sumar 90 monedas extra por reclamo.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Cómo descargo mis wallpapers?</summary>
                <div class="faq-content">
                    Al canjear un item en la Tienda, el botón cambia a "Descargar" de forma instantánea. También puedes ir a la pestaña "Mis Tesoros" para ver y descargar todos tus wallpapers en cualquier momento, sin límite de veces.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Qué es el cashback?</summary>
                <div class="faq-content">
                    Al comprar cualquier wallpaper, recibes automáticamente un porcentaje del precio pagado de vuelta a tu saldo. Lo verás reflejado en el toast de confirmación. Durante las ofertas especiales, el descuento y el cashback se combinan.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Qué es la Bendición Lunar?</summary>
                <div class="faq-content">
                    La Bendición Lunar es un buff temporal que puedes activar desde la Tienda → Ajustes por 100 monedas. Mientras esté activa (7 días reales), cada vez que reclames el bono diario recibirás 90 monedas adicionales. El icono 🌙 aparece junto a tu saldo cuando está activo.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Cómo busco wallpapers específicos?</summary>
                <div class="faq-content">
                    En la Tienda encontrarás una barra de búsqueda con debounce y filtros por categoría. Puedes filtrar por Todos, PC, Mobile, o tu Lista de Deseos. Los filtros se combinan con la búsqueda de texto en tiempo real.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Cómo cambio el tema de color?</summary>
                <div class="faq-content">
                    Ve a Tienda → pestaña "Ajustes". Encontrarás el selector de tema con 5 opciones: Violeta, Rosa Neón, Cyan Arcade, Dorado y Carmesí Arcade. El color se aplica instantáneamente a toda la plataforma.
                </div>
            </details>

            <details class="glass-panel">
                <summary>¿Qué pasa si cambio de dispositivo?</summary>
                <div class="faq-content">
                    Usa "Sincronizar" en la Tienda. Exporta tu partida (genera un código con checksum de integridad), pégalo en el otro dispositivo usando "Importar". Tu progreso completo —monedas, wallpapers, racha, tema y buff lunar— se transfiere al instante.
                </div>
            </details>

        </div>
    </section>

</main>`;
    },

    init() {
        this._syncAvatarToHUD();
        this._updateStreakBar();
        this._updateCountdown();
    },

    teardown() {
        if (this._countdownInterval) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
    },

    // ── Privados ──────────────────────────────────────────────────────────────

    _syncAvatarToHUD() {
        const savedAvatar = window.GameCenter?.getAvatar?.();
        if (savedAvatar) {
            const hud = document.getElementById('hud-avatar-display');
            if (hud) {
                hud.style.backgroundImage = `url('${savedAvatar}')`;
                const icon = hud.querySelector('i, svg');
                if (icon) icon.style.display = 'none';
            }
        }
    },

    _updateStreakBar() {
        const info = window.GameCenter?.getStreakInfo?.();
        if (!info) return;
        const streak = info.streak || 0;
        const days   = document.querySelectorAll('#streak-days .streak-day');
        days.forEach((d, i) => {
            d.classList.remove('active', 'today');
            if (i < streak)               d.classList.add('active');
            else if (i === streak && streak < 7) d.classList.add('today');
        });
        const countEl = document.getElementById('streak-count');
        if (countEl) countEl.textContent = `×${streak}`;

        const rewardEl = document.getElementById('hud-reward-amount');
        if (rewardEl && window.GameCenter?.canClaimDaily?.()) {
            const moonStatus = window.GameCenter.getMoonBlessingStatus?.();
            const total = info.nextReward + (moonStatus?.active ? 90 : 0);
            rewardEl.textContent = `+${total}`;
        }
    },

    _updateCountdown() {
        const canClaim    = window.GameCenter?.canClaimDaily?.();
        const countdownEl = document.getElementById('daily-countdown');
        const dailyBtn    = document.getElementById('btn-daily');
        if (!countdownEl) return;

        if (canClaim) {
            countdownEl.classList.add('hidden');
            if (dailyBtn) {
                dailyBtn.disabled      = false;
                dailyBtn.style.opacity = '1';
                dailyBtn.style.cursor  = 'pointer';
            }
            return;
        }

        countdownEl.classList.remove('hidden');
        if (dailyBtn) {
            dailyBtn.disabled      = true;
            dailyBtn.style.opacity = '0.5';
            dailyBtn.style.cursor  = 'not-allowed';
        }

        const tick = () => {
            const displayEl = document.getElementById('countdown-display');
            if (!displayEl) { clearInterval(this._countdownInterval); return; }

            const now      = new Date();
            const tomorrow = new Date(now);
            tomorrow.setHours(24, 0, 0, 0);
            let diff = Math.max(0, tomorrow - now);

            const hh = String(Math.floor(diff / 3_600_000)).padStart(2, '0');
            diff %= 3_600_000;
            const mm = String(Math.floor(diff / 60_000)).padStart(2, '0');
            diff %= 60_000;
            const ss = String(Math.floor(diff / 1_000)).padStart(2, '0');
            displayEl.textContent = `${hh}:${mm}:${ss}`;

            if (window.GameCenter?.canClaimDaily?.()) {
                const cd = document.getElementById('daily-countdown');
                const db = document.getElementById('btn-daily');
                if (cd) cd.classList.add('hidden');
                if (db) { db.disabled = false; db.style.opacity = '1'; db.style.cursor = 'pointer'; }
                clearInterval(this._countdownInterval);
                this._countdownInterval = null;
            }
        };

        tick();
        if (!this._countdownInterval) {
            this._countdownInterval = setInterval(tick, 1000);
        }
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// VISTA: TIENDA
// ─────────────────────────────────────────────────────────────────────────────

const ShopView = {

    // Estado local de la vista
    _allItems:     [],
    _activeFilter: 'Todos',
    _searchQuery:  '',
    _modalResolve: null,
    _emailItem:    null,
    _emailUrl:     '',
    _docKeydown:   null,

    template() {
        return /* html */`
<main class="container">

    <!-- ─────────────────────────────────
         SALE BANNER
         ───────────────────────────────── -->
    <div id="sale-banner" class="sale-banner hidden">
        <div class="sale-banner__ticket">
            <div class="sale-banner__notch-left"></div>
            <div class="sale-banner__notch-right"></div>
            <div class="sale-banner__icon">
                <i data-lucide="zap" size="20" fill="currentColor" stroke="none"></i>
            </div>
            <div class="sale-banner__content">
                <p class="sale-banner__title" id="sale-label-text">¡OFERTA ESPECIAL!</p>
                <p class="sale-banner__desc" id="sale-desc-text">Descuento activo en toda la tienda.</p>
            </div>
            <div class="sale-banner__badge" id="sale-badge-pct">20%</div>
        </div>
    </div>

    <!-- ─────────────────────────────────
         CÓDIGO PROMO
         ───────────────────────────────── -->
    <div class="promo-toggle-wrap">
        <button id="btn-promo-toggle" class="btn-ghost promo-toggle-btn" aria-expanded="false" aria-controls="promo-section">
            <i data-lucide="ticket-percent" size="14"></i>
            <span>¿Tienes un código promocional?</span>
            <i data-lucide="chevron-down" size="13" class="promo-chevron"></i>
        </button>
        <section id="promo-section" class="glass-panel promo-section promo-section--collapsed" aria-hidden="true">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <div class="promo-icon-wrap">
                    <i data-lucide="ticket-percent" color="white" size="18"></i>
                </div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800; letter-spacing:-0.2px;">Canjear código</h3>
                    <p style="margin:0; font-size:0.75rem; color:var(--text-low);">Introduce tu cupón para recibir monedas instantáneas</p>
                </div>
            </div>
            <div class="promo-input-group">
                <input type="text" id="promo-input" placeholder="Ej: AMOR2024" class="promo-input">
                <button id="btn-redeem" class="btn-primary">
                    <span>Canjear</span>
                    <i data-lucide="sparkles" size="14"></i>
                </button>
            </div>
            <p id="promo-msg" class="feedback-msg"></p>
        </section>
    </div>

    <!-- ─────────────────────────────────
         TABS
         ───────────────────────────────── -->
    <div class="shop-tabs">
        <button class="shop-tab active" data-tab="catalog">
            <i data-lucide="layout-grid" size="13"></i> Catálogo
        </button>
        <button class="shop-tab" data-tab="library">
            <i data-lucide="archive" size="13"></i> Mis Tesoros
        </button>
        <button class="shop-tab" data-tab="sync">
            <i data-lucide="refresh-cw" size="13"></i> Sincronizar
        </button>
        <button class="shop-tab" data-tab="settings">
            <i data-lucide="settings-2" size="13"></i> Ajustes
        </button>
    </div>

    <!-- TAB: CATÁLOGO -->
    <section id="tab-catalog" class="tab-panel">
        <div class="shop-toolbar">
            <div class="search-wrap">
                <i data-lucide="search" size="14" class="search-icon"></i>
                <input type="text" id="search-input" class="search-input" placeholder="Buscar wallpaper…" autocomplete="off">
                <button id="search-clear" class="search-clear hidden" aria-label="Limpiar">
                    <i data-lucide="x" size="12"></i>
                </button>
            </div>
            <div class="filter-pills" id="filter-pills">
                <button class="pill active" data-filter="Todos">Todos</button>
                <button class="pill" data-filter="NoObtenidos">
                    <i data-lucide="sparkles" size="10"></i> Nuevos
                </button>
                <button class="pill" data-filter="PC">
                    <i data-lucide="monitor" size="10"></i> PC
                </button>
                <button class="pill" data-filter="Mobile">
                    <i data-lucide="smartphone" size="10"></i> Mobile
                </button>
                <button class="pill pill--wishlist" data-filter="Wishlist">
                    <i data-lucide="heart" size="10"></i> Lista de deseos
                </button>
            </div>
        </div>
        <div id="wishlist-cost-banner" class="wishlist-cost-banner hidden">
            <i data-lucide="heart" size="12" fill="currentColor" style="color:#ff4f7a; flex-shrink:0;"></i>
            <span id="wishlist-cost-text"></span>
        </div>
        <p id="search-results-count" class="search-count hidden"></p>
        <div id="shop-container" class="shop-grid"></div>
        <div id="filter-empty" class="filter-empty hidden">
            <i data-lucide="search-x" size="40"></i>
            <p>Sin resultados para tu búsqueda.</p>
            <button class="btn-ghost" id="btn-reset-filters">Ver todo el catálogo</button>
        </div>
    </section>

    <!-- TAB: MIS TESOROS -->
    <section id="tab-library" class="tab-panel hidden">
        <div class="section-header" style="margin-bottom:16px;">
            <div>
                <h2 class="section-title">Mis Tesoros</h2>
                <p class="section-subtitle">Todos tus wallpapers desbloqueados</p>
            </div>
        </div>
        <div id="library-container" class="shop-grid">
            <p style="color:var(--text-low); grid-column:1/-1; text-align:center; padding:40px 0;">Cargando tu biblioteca…</p>
        </div>
    </section>

    <!-- TAB: SINCRONIZAR -->
    <section id="tab-sync" class="tab-panel hidden">
        <div class="section-header" style="margin-bottom:16px;">
            <div>
                <h2 class="section-title">Sincronizar Partida</h2>
                <p class="section-subtitle">Transfiere tu progreso entre dispositivos</p>
            </div>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; background:var(--accent-soft); border:1px solid var(--accent-border); font-size:0.72rem; font-weight:700; color:var(--accent);">
                <i data-lucide="shield-check" size="12"></i> Checksum SHA-256
            </div>
            <div style="display:flex; align-items:center; gap:6px; padding:6px 12px; border-radius:20px; background:var(--success-soft); border:1px solid rgba(34,208,122,0.3); font-size:0.72rem; font-weight:700; color:var(--success);">
                <i data-lucide="lock" size="12"></i> Anti-edición
            </div>
        </div>
        <div class="memory-card">
            <div class="memory-card__header">
                <div class="memory-card__chip memory-card__chip--export">
                    <i data-lucide="upload-cloud" color="white" size="18"></i>
                </div>
                <div>
                    <h3 class="memory-card__title">Exportar partida</h3>
                    <p class="memory-card__sub">Genera un código de seguridad y descarga respaldo .txt</p>
                </div>
            </div>
            <button id="btn-export" class="btn-primary" style="position:relative; z-index:1;">
                <i data-lucide="download-cloud" size="15"></i>
                <span>Exportar y descargar</span>
            </button>
            <p id="export-msg" class="feedback-msg"></p>
        </div>
        <div class="memory-card" style="border-color:rgba(34,208,122,0.25);">
            <div class="memory-card__header">
                <div class="memory-card__chip memory-card__chip--import">
                    <i data-lucide="download-cloud" color="white" size="18"></i>
                </div>
                <div>
                    <h3 class="memory-card__title">Importar partida</h3>
                    <p class="memory-card__sub">Carga tu respaldo .txt o pega el código manualmente</p>
                </div>
            </div>
            <label for="import-file" class="btn-ghost file-label" style="position:relative; z-index:1;">
                <i data-lucide="file-up" size="14"></i> Cargar archivo .txt
            </label>
            <input type="file" id="import-file" accept=".txt" hidden>
            <span id="import-file-name" class="file-name-display">Ningún archivo seleccionado</span>
            <div class="sync-separator" style="position:relative; z-index:1;">o pega el código manualmente</div>
            <textarea id="import-input" class="sync-textarea" placeholder="Pega tu código aquí…" style="position:relative; z-index:1;"></textarea>
            <button id="btn-import" class="btn-primary" style="margin-top:10px; width:100%; justify-content:center; position:relative; z-index:1; background:linear-gradient(135deg,#22d07a,#16a85e); color:#041a0a;">
                <i data-lucide="check-circle" size="15"></i>
                <span>Importar progreso</span>
            </button>
            <p id="import-msg" class="feedback-msg"></p>
        </div>
    </section>

    <!-- TAB: AJUSTES -->
    <section id="tab-settings" class="tab-panel hidden">
        <div class="section-header" style="margin-bottom:16px;">
            <div>
                <h2 class="section-title">Ajustes</h2>
                <p class="section-subtitle">Personaliza tu experiencia</p>
            </div>
        </div>

        <!-- Tema de color -->
        <div class="glass-panel settings-card" style="margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:1.1rem;">
                <div class="promo-icon-wrap">
                    <i data-lucide="palette" color="white" size="18"></i>
                </div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800;">Tema de color</h3>
                    <p style="margin:0; font-size:0.72rem; color:var(--text-low);">Elige el acento visual de toda la plataforma</p>
                </div>
            </div>
            <div class="theme-grid">
                <button class="theme-btn" data-theme="violet"><span class="theme-swatch" style="background:#9b59ff;"></span><span class="theme-name">Violeta</span><i data-lucide="check" size="12" class="theme-check"></i></button>
                <button class="theme-btn" data-theme="pink"><span class="theme-swatch" style="background:#ff59b4;"></span><span class="theme-name">Rosa Neón</span><i data-lucide="check" size="12" class="theme-check"></i></button>
                <button class="theme-btn" data-theme="cyan"><span class="theme-swatch" style="background:#00d4ff;"></span><span class="theme-name">Cyan Arcade</span><i data-lucide="check" size="12" class="theme-check"></i></button>
                <button class="theme-btn" data-theme="gold"><span class="theme-swatch" style="background:#f59e0b;"></span><span class="theme-name">Dorado</span><i data-lucide="check" size="12" class="theme-check"></i></button>
                <button class="theme-btn" data-theme="crimson"><span class="theme-swatch" style="background:#e11d48;"></span><span class="theme-name">Carmesí</span><i data-lucide="check" size="12" class="theme-check"></i></button>
            </div>
        </div>

        <!-- Bendición Lunar -->
        <div class="glass-panel settings-card" style="margin-bottom:1rem; border-color:rgba(192,132,252,0.2);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <div class="promo-icon-wrap moon-icon-wrap"><i data-lucide="moon" color="white" size="18"></i></div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800;">Bendición Lunar</h3>
                    <p style="margin:0; font-size:0.72rem; color:var(--text-low);">+90 monedas extra en cada bono diario durante 7 días</p>
                </div>
            </div>
            <div class="economy-info" style="margin-bottom:14px;">
                <div class="economy-row">
                    <span style="font-size:0.85rem; color:var(--text-med);">Estado</span>
                    <span id="moon-blessing-status" class="eco-badge">Cargando…</span>
                </div>
                <div class="economy-row">
                    <span style="font-size:0.85rem; color:var(--text-med);">Costo</span>
                    <span class="eco-badge eco-badge--gold">100 monedas</span>
                </div>
                <div class="economy-row">
                    <span style="font-size:0.85rem; color:var(--text-med);">Efecto</span>
                    <span class="eco-badge eco-badge--moon">+90 por día</span>
                </div>
            </div>
            <button id="btn-moon-blessing" class="btn-primary moon-btn" style="width:100%; justify-content:center;">
                <i data-lucide="moon" size="14"></i>
                <span>Activar Bendición Lunar (100 monedas)</span>
            </button>
            <p id="moon-blessing-msg" class="feedback-msg"></p>
        </div>

        <!-- Racha semanal -->
        <div class="glass-panel settings-card" style="margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <div class="promo-icon-wrap" style="background:linear-gradient(135deg,#f59e0b,#ef4444);">
                    <i data-lucide="flame" color="white" size="18"></i>
                </div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800;">Racha Diaria</h3>
                    <p style="margin:0; font-size:0.72rem; color:var(--text-low);">Vuelve cada día para aumentar tu recompensa</p>
                </div>
            </div>
            <div class="streak-calendar" id="settings-streak-calendar"></div>
            <p style="font-size:0.72rem; color:var(--text-low); margin-top:10px; text-align:center;">Cada día de racha aumenta +5 monedas (máx. 60)</p>
        </div>

        <!-- Estado de la economía -->
        <div class="glass-panel settings-card" style="margin-bottom:1rem;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <div class="promo-icon-wrap" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);">
                    <i data-lucide="trending-up" color="#120900" size="18"></i>
                </div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800;">Estado de la economía</h3>
                    <p style="margin:0; font-size:0.72rem; color:var(--text-low);">Descuentos y cashback activos</p>
                </div>
            </div>
            <div class="economy-info">
                <div class="economy-row">
                    <span style="font-size:0.85rem; color:var(--text-med);">Descuento global</span>
                    <span id="eco-sale-status" class="eco-badge">—</span>
                </div>
                <div class="economy-row">
                    <span style="font-size:0.85rem; color:var(--text-med);">Cashback por compra</span>
                    <span id="eco-cashback" class="eco-badge eco-badge--green">—</span>
                </div>
            </div>
        </div>

        <!-- Historial de transacciones -->
        <div class="glass-panel settings-card">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
                <div class="promo-icon-wrap" style="background:rgba(148,163,184,0.2);">
                    <i data-lucide="scroll-text" color="white" size="18"></i>
                </div>
                <div>
                    <h3 style="margin:0; font-family:var(--font-display); font-size:0.95rem; font-weight:800;">Historial de transacciones</h3>
                    <p style="margin:0; font-size:0.72rem; color:var(--text-low);">Últimos movimientos de tu saldo</p>
                </div>
            </div>
            <div id="history-list" class="history-list">
                <p style="color:var(--text-low); font-size:0.8rem; text-align:center; padding:20px 0;">Cargando…</p>
            </div>
        </div>
    </section>

</main>

<!-- ── WALLPAPER PREVIEW MODAL ── -->
<div id="preview-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-label="Vista previa de wallpaper">
    <div class="modal-box" style="max-width:500px; padding:0; overflow:hidden; background:#070710;">
        <div id="preview-img-wrap" style="width:100%; aspect-ratio:16/9; position:relative; overflow:hidden; background:var(--bg-surface);">
            <img id="preview-img" src="" alt="" style="width:100%; height:100%; object-fit:cover;">
            <button id="preview-close" aria-label="Cerrar" style="position:absolute; top:10px; right:10px; background:rgba(7,7,13,0.8); border:1px solid rgba(255,255,255,0.15); color:white; border-radius:50%; width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer; backdrop-filter:blur(8px); transition:0.2s;">
                <i data-lucide="x" size="16"></i>
            </button>
        </div>
        <div style="padding:18px 20px;">
            <h3 id="preview-name" style="font-family:var(--font-display); font-size:1.05rem; font-weight:900; margin-bottom:6px;"></h3>
            <div id="preview-actions" style="display:flex; gap:8px; margin-top:14px;"></div>
        </div>
    </div>
</div>

<!-- ── CONFIRM MODAL ── -->
<div id="confirm-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-box">
        <h3 id="modal-title" class="modal-title"></h3>
        <div id="modal-body" class="modal-body"></div>
        <p id="modal-error" class="modal-error"></p>
        <div class="modal-actions">
            <button id="modal-cancel" class="btn-ghost">Cancelar</button>
            <button id="modal-confirm" class="btn-primary">Confirmar</button>
        </div>
    </div>
</div>

<!-- ── EMAIL MODAL ── -->
<div id="email-modal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
    <div class="modal-box" style="max-width:420px;">
        <div class="email-modal-header" id="email-modal-header" aria-hidden="true">
            <img id="email-modal-thumb" src="" alt="" class="email-modal-thumb">
            <div>
                <p class="email-modal-item-name" id="email-modal-item-name"></p>
                <p class="email-modal-item-sub">Enviar enlace de descarga</p>
            </div>
        </div>
        <h3 id="email-modal-title" class="modal-title" style="margin-bottom:14px;">Enviar por correo</h3>
        <div class="email-input-wrap">
            <i data-lucide="mail" size="15" class="email-input-icon"></i>
            <input id="email-modal-input" type="email" class="email-input" placeholder="tu@correo.com" autocomplete="email" inputmode="email" aria-label="Correo electrónico destino" aria-describedby="email-modal-error">
        </div>
        <p id="email-modal-error" class="email-error-msg" role="alert" aria-live="polite">
            <i data-lucide="alert-circle" size="12"></i>
            <span id="email-modal-error-text">Introduce un correo válido.</span>
        </p>
        <div class="email-save-row">
            <input type="checkbox" id="email-save-checkbox" checked>
            <label for="email-save-checkbox">Recordar este correo para la próxima vez</label>
        </div>
        <div id="email-fallback" class="email-fallback" role="region" aria-label="Alternativa de copia">
            <p class="email-fallback-title"><i data-lucide="alert-triangle" size="13"></i> Enlace demasiado largo para correo</p>
            <p class="email-fallback-desc">Copia el enlace directamente y pégalo en tu mensaje:</p>
            <code id="email-fallback-url" class="email-fallback-url"></code>
            <button id="email-copy-btn" class="btn-primary" style="width:100%; justify-content:center; font-size:0.82rem;">
                <i data-lucide="copy" size="14"></i>
                <span id="email-copy-label">Copiar enlace de descarga</span>
            </button>
        </div>
        <div class="email-tip" role="note">
            <i data-lucide="info" size="13"></i>
            <span>Se abrirá tu cliente de correo con el mensaje pre-rellenado. El archivo no se adjunta; solo se incluye el enlace de descarga.</span>
        </div>
        <div class="modal-actions" style="margin-top:18px;">
            <button id="email-modal-cancel" class="btn-ghost" style="flex:1; justify-content:center;">Cancelar</button>
            <button id="email-modal-confirm" class="btn-primary" style="flex:2; justify-content:center;">
                <i data-lucide="send" size="14"></i> Abrir correo
            </button>
        </div>
    </div>
</div>`;
    },

    init() {
        const sv = this; // referencia estable para closures

        // Resetear estado de la vista en cada montaje
        sv._allItems     = [];
        sv._activeFilter = 'Todos';
        sv._searchQuery  = '';
        sv._modalResolve = null;
        sv._emailItem    = null;
        sv._emailUrl     = '';

        sv._initSaleBanner();
        sv._initEconomyInfo();
        sv._renderMoonBlessingStatus();
        sv._renderStreakCalendar();

        // ── Modales ────────────────────────────────────────────────────────────
        document.getElementById('modal-cancel')?.addEventListener('click',  () => sv._closeModal(false));
        document.getElementById('modal-confirm')?.addEventListener('click', () => sv._closeModal(true));
        document.getElementById('confirm-modal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) sv._closeModal(false);
        });
        document.getElementById('preview-close')?.addEventListener('click', () => {
            document.getElementById('preview-modal')?.classList.add('hidden');
        });
        document.getElementById('preview-modal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) document.getElementById('preview-modal')?.classList.add('hidden');
        });
        document.getElementById('email-modal-cancel')?.addEventListener('click', () => sv._closeEmailModal());
        document.getElementById('email-modal')?.addEventListener('click', e => {
            if (e.target === e.currentTarget) sv._closeEmailModal();
        });
        document.getElementById('email-modal-confirm')?.addEventListener('click', () => sv._handleEmailConfirm());
        document.getElementById('email-modal-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') sv._handleEmailConfirm();
        });
        document.getElementById('email-modal-input')?.addEventListener('input', () => sv._setEmailError(false));

        // ── Promo toggle ───────────────────────────────────────────────────────
        document.getElementById('btn-promo-toggle')?.addEventListener('click', () => {
            const toggleBtn = document.getElementById('btn-promo-toggle');
            const section   = document.getElementById('promo-section');
            const expanded  = toggleBtn.getAttribute('aria-expanded') === 'true';
            toggleBtn.setAttribute('aria-expanded', String(!expanded));
            section.setAttribute('aria-hidden', String(expanded));
            section.classList.toggle('promo-section--collapsed', expanded);
            section.classList.toggle('promo-section--open', !expanded);
            if (!expanded) setTimeout(() => document.getElementById('promo-input')?.focus(), 50);
            if (window.lucide) lucide.createIcons({ nodes: [toggleBtn] });
        });

        // ── Carga del catálogo ─────────────────────────────────────────────────
        fetch('data/shop.json')
            .then(r => r.json())
            .then(items => {
                sv._allItems = items;
                sv._filterItems();
                sv._renderLibrary(items);
                sv._updateWishlistCost();
            })
            .catch(() => {
                const el = document.getElementById('shop-container');
                if (el) el.innerHTML = '<p style="color:var(--error); grid-column:1/-1; text-align:center; padding:40px 0;">Error al cargar el catálogo.</p>';
            });

        // ── Canjear código ─────────────────────────────────────────────────────
        document.getElementById('btn-redeem')?.addEventListener('click', () => sv._handleRedeem());
        document.getElementById('promo-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') sv._handleRedeem();
        });

        // ── Tabs ───────────────────────────────────────────────────────────────
        document.querySelectorAll('.shop-tab').forEach(btn =>
            btn.addEventListener('click', () => sv._switchTab(btn.dataset.tab))
        );

        // ── Búsqueda ───────────────────────────────────────────────────────────
        const searchInput = document.getElementById('search-input');
        const clearBtn    = document.getElementById('search-clear');
        const debouncedFilter = window.debounce ? window.debounce(() => {
            sv._searchQuery = searchInput?.value.trim().toLowerCase() || '';
            sv._filterItems();
        }, 300) : () => {
            sv._searchQuery = searchInput?.value.trim().toLowerCase() || '';
            sv._filterItems();
        };

        searchInput?.addEventListener('input', () => {
            clearBtn?.classList.toggle('hidden', !searchInput.value);
            debouncedFilter();
        });
        clearBtn?.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            sv._searchQuery = '';
            clearBtn.classList.add('hidden');
            sv._filterItems();
            searchInput?.focus();
        });

        // ── Filtros ────────────────────────────────────────────────────────────
        document.querySelectorAll('.pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                sv._activeFilter = pill.dataset.filter;
                sv._filterItems();
            });
        });

        // ── Reset filtros (botón "ver todo el catálogo") ───────────────────────
        document.getElementById('btn-reset-filters')?.addEventListener('click', () => sv._resetFilters());

        // ── Sync ───────────────────────────────────────────────────────────────
        document.getElementById('btn-export')?.addEventListener('click', () => sv._handleExport());
        document.getElementById('btn-import')?.addEventListener('click', () => sv._handleImport());
        document.getElementById('import-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const nameEl = document.getElementById('import-file-name');
            if (nameEl) nameEl.textContent = file.name;
            const reader = new FileReader();
            reader.onload = evt => {
                const ta = document.getElementById('import-input');
                if (ta) ta.value = evt.target.result.trim();
                sv._showMsg(document.getElementById('import-msg'),
                    `Archivo "${file.name}" cargado. Haz clic en Importar.`, 'var(--text-med)');
            };
            reader.onerror = () => sv._showMsg(document.getElementById('import-msg'), 'Error al leer.', 'var(--error)');
            reader.readAsText(file);
        });

        // ── Keydown global (Escape cierra modales) ─────────────────────────────
        sv._docKeydown = (e) => {
            if (e.key === 'Escape') {
                document.getElementById('confirm-modal')?.classList.add('hidden');
                document.getElementById('preview-modal')?.classList.add('hidden');
                sv._closeEmailModal();
            }
        };
        document.addEventListener('keydown', sv._docKeydown);

        if (window.lucide) lucide.createIcons();
    },

    teardown() {
        if (this._docKeydown) {
            document.removeEventListener('keydown', this._docKeydown);
            this._docKeydown = null;
        }
        // Resolver el modal si quedó abierto
        if (this._modalResolve) { this._modalResolve(false); this._modalResolve = null; }
    },

    // ── TABS ──────────────────────────────────────────────────────────────────

    _switchTab(tab) {
        document.querySelectorAll('.shop-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.tab === tab)
        );
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
        document.getElementById(`tab-${tab}`)?.classList.remove('hidden');

        if (tab === 'settings') {
            this._renderHistory();
            this._renderMoonBlessingStatus();
            this._renderStreakCalendar();
        }
        if (window.lucide) lucide.createIcons();
    },

    // ── FILTROS ───────────────────────────────────────────────────────────────

    _filterItems() {
        if (!this._allItems.length) return;
        const sv = this;

        const filtered = this._allItems.filter(item => {
            let matchesFilter;
            if (sv._activeFilter === 'Todos') {
                matchesFilter = true;
            } else if (sv._activeFilter === 'Wishlist') {
                matchesFilter = GameCenter.isWishlisted(item.id);
            } else if (sv._activeFilter === 'NoObtenidos') {
                matchesFilter = GameCenter.getBoughtCount(item.id) === 0;
            } else {
                matchesFilter = Array.isArray(item.tags) && item.tags.includes(sv._activeFilter);
            }
            const matchesSearch = !sv._searchQuery ||
                item.name.toLowerCase().includes(sv._searchQuery) ||
                (Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(sv._searchQuery)));
            return matchesFilter && matchesSearch;
        });

        const wishlisted = filtered.filter(item => GameCenter.isWishlisted(item.id));
        const others     = filtered.filter(item => !GameCenter.isWishlisted(item.id));
        const sorted     = [...wishlisted, ...others];

        this._renderShop(sorted);

        const countEl = document.getElementById('search-results-count');
        const emptyEl = document.getElementById('filter-empty');
        const gridEl  = document.getElementById('shop-container');

        if (sorted.length === 0) {
            gridEl?.classList.add('hidden');
            emptyEl?.classList.remove('hidden');
            countEl?.classList.add('hidden');
        } else {
            gridEl?.classList.remove('hidden');
            emptyEl?.classList.add('hidden');
            const isFiltered = sv._activeFilter !== 'Todos' || sv._searchQuery;
            if (countEl) {
                countEl.textContent = isFiltered ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''}` : '';
                countEl.classList.toggle('hidden', !isFiltered);
            }
        }
        this._updateWishlistCost();
    },

    _resetFilters() {
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-filter="Todos"]')?.classList.add('active');
        this._activeFilter = 'Todos';
        this._searchQuery  = '';
        const si = document.getElementById('search-input');
        const sc = document.getElementById('search-clear');
        if (si) si.value = '';
        if (sc) sc.classList.add('hidden');
        this._filterItems();
    },

    // ── WISHLIST COST ─────────────────────────────────────────────────────────

    _updateWishlistCost() {
        const banner = document.getElementById('wishlist-cost-banner');
        const textEl = document.getElementById('wishlist-cost-text');
        if (!banner || !textEl || !this._allItems.length) return;

        const unowned = this._allItems.filter(item =>
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
    },

    // ── RENDER STREAK CALENDAR ────────────────────────────────────────────────

    _renderStreakCalendar() {
        const cal = document.getElementById('settings-streak-calendar');
        if (!cal) return;
        const info    = window.GameCenter?.getStreakInfo?.();
        const streak  = info?.streak || 0;
        const days    = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
        const rewards = [20, 25, 30, 35, 40, 50, 60];

        cal.innerHTML = days.map((day, i) => {
            let cls = 'streak-cal-dot';
            if (i < streak) cls += ' claimed';
            else if (i === streak) cls += ' today';
            return `<div class="streak-cal-day">
                <span class="streak-cal-label">${day}</span>
                <div class="${cls}" title="${rewards[i]} monedas">
                    ${i < streak ? '<i data-lucide="check" size="10"></i>' : rewards[i]}
                </div>
            </div>`;
        }).join('');

        if (window.lucide) lucide.createIcons({ nodes: [cal] });
    },

    // ── RENDER CATÁLOGO ───────────────────────────────────────────────────────

    _renderShop(items) {
        const sv        = this;
        const container = document.getElementById('shop-container');
        if (!container) return;
        container.innerHTML = '';
        if (!items.length) return;

        items.forEach(item => {
            const isOwned    = GameCenter.getBoughtCount(item.id) > 0;
            const isWished   = GameCenter.isWishlisted(item.id);
            const eco        = window.ECONOMY;
            const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

            const priceHTML = eco.isSaleActive && !isOwned
                ? `<div class="shop-price"><span class="price-original">${item.price}</span><i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i><span class="price-sale">${finalPrice}</span></div>`
                : `<div class="shop-price"><i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i>${isOwned ? '<span style="color:var(--success);">Obtenido</span>' : item.price}</div>`;

            let actionHTML;
            if (isOwned) {
                const url = GameCenter.getDownloadUrl(item.id, item.file);
                actionHTML = url
                    ? `<a href="${url}" download class="btn-primary vault-btn" style="width:100%; justify-content:center; font-size:0.78rem; padding:7px;"><i data-lucide="download" size="13"></i> Descargar</a>`
                    : `<button class="btn-primary" style="width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;" disabled><i data-lucide="check" size="13"></i> Obtenido</button>`;
            } else {
                actionHTML = `<div style="display:flex; gap:5px; width:100%;">
                    <button class="btn-ghost shop-preview-btn" style="flex-shrink:0; padding:7px 9px;" data-id="${item.id}" title="Vista previa"><i data-lucide="eye" size="13"></i></button>
                    <button class="btn-primary shop-buy-btn" style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                        <i data-lucide="star" size="11" fill="#fbbf24" stroke="none"></i> ${finalPrice}
                    </button>
                </div>`;
            }

            const card = document.createElement('article');
            card.className = 'glass-panel shop-card';
            card.innerHTML = `
                ${!isOwned ? `<button class="wishlist-btn ${isWished ? 'wishlist-btn--active' : ''}" data-id="${item.id}" title="${isWished ? 'Quitar de lista' : 'Agregar a lista de deseos'}"><i data-lucide="heart" size="12"></i></button>` : ''}
                <img src="${item.image}" alt="${item.name}" class="shop-img">
                ${isOwned ? '<div class="owned-badge"><i data-lucide="check-circle-2" size="10"></i> Tuyo</div>' : ''}
                ${eco.isSaleActive && !isOwned ? '<div class="sale-card-badge"><i data-lucide="zap" size="9" fill="currentColor" stroke="none"></i> OFERTA</div>' : ''}
                <div style="width:100%;"><h3 class="card-name">${item.name}</h3>${priceHTML}${actionHTML}</div>`;
            container.appendChild(card);
        });

        container.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const id    = parseInt(btn.dataset.id, 10);
                const isNow = GameCenter.toggleWishlist(id);
                btn.classList.toggle('wishlist-btn--active', isNow);
                btn.title     = isNow ? 'Quitar de lista' : 'Agregar a lista de deseos';
                btn.innerHTML = '<i data-lucide="heart" size="12"></i>';
                if (window.lucide) lucide.createIcons({ nodes: [btn] });
                sv._updateWishlistCost();
            });
        });

        container.querySelectorAll('.shop-preview-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id   = parseInt(btn.dataset.id, 10);
                const item = sv._allItems.find(i => i.id === id);
                if (item) sv._openPreviewModal(item);
            });
        });

        container.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                try {
                    const item = JSON.parse(btn.dataset.item.replace(/&#39;/g, "'"));
                    await sv._initiatePurchase(item, btn);
                } catch (e) { console.error('Error parsing item', e); }
            });
        });

        if (window.lucide) lucide.createIcons();
    },

    // ── RENDER BIBLIOTECA ─────────────────────────────────────────────────────

    _renderLibrary(items) {
        const sv        = this;
        const container = document.getElementById('library-container');
        if (!container) return;
        const inventory = GameCenter.getInventory();
        const owned     = items.filter(item => inventory[item.id] > 0);

        if (owned.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:var(--text-low);"><i data-lucide="archive" size="40" style="opacity:0.25; display:block; margin:0 auto 12px;"></i><p style="font-family:var(--font-display); font-size:1rem; font-weight:700; color:var(--text-med);">Tu biblioteca está vacía</p><p style="font-size:0.8rem; margin-top:6px;">Canjea wallpapers en el Catálogo.</p></div>`;
            if (window.lucide) lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        owned.forEach(item => {
            const url  = GameCenter.getDownloadUrl(item.id, item.file);
            const card = document.createElement('article');
            card.className = 'glass-panel shop-card';

            const actionsHTML = url
                ? `<div style="display:flex; gap:5px; width:100%; margin-top:8px;">
                       <a href="${url}" download class="btn-primary vault-btn" style="flex:1; justify-content:center; font-size:0.78rem; padding:7px;"><i data-lucide="download" size="13"></i> Descargar</a>
                       <button class="btn-mail library-mail-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' data-url="${url}" aria-label="Enviar por correo: ${item.name.replace(/"/g, '&quot;')}" title="Enviar por correo"><i data-lucide="send" size="13"></i></button>
                   </div>`
                : `<button class="btn-primary" style="margin-top:8px; width:100%; justify-content:center; opacity:0.5; font-size:0.78rem; padding:7px;" disabled><i data-lucide="check" size="13"></i> Sin archivo</button>`;

            card.innerHTML = `<img src="${item.image}" alt="${item.name}" class="shop-img"><div class="owned-badge"><i data-lucide="check-circle-2" size="10"></i> Tuyo</div><div style="width:100%;"><h3 class="card-name">${item.name}</h3>${actionsHTML}</div>`;
            container.appendChild(card);
        });

        container.querySelectorAll('.library-mail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                try {
                    const item        = JSON.parse(btn.dataset.item.replace(/&#39;/g, "'"));
                    const relativeUrl = btn.dataset.url;
                    const absoluteUrl = new URL(relativeUrl, window.location.href).href;
                    sv._openEmailModal(item, absoluteUrl);
                } catch (e) { console.error('MailBtn error', e); }
            });
        });
        if (window.lucide) lucide.createIcons();
    },

    // ── RENDER HISTORIAL ──────────────────────────────────────────────────────

    _renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;
        const history = GameCenter.getHistory();

        if (!history.length) {
            container.innerHTML = '<p style="color:var(--text-low); font-size:0.8rem; text-align:center; padding:16px 0;">Sin transacciones aún.</p>';
            return;
        }

        container.innerHTML = history.slice(0, 50).map(entry => {
            if (entry.tipo) {
                const isIn  = entry.tipo === 'ingreso';
                const fecha = new Date(entry.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                return `<div class="history-entry"><span class="history-icon ${isIn ? 'history-icon--in' : 'history-icon--out'}">${isIn ? '+' : '-'}</span><div class="history-detail"><span class="history-motivo">${entry.motivo}</span><span class="history-fecha">${fecha}</span></div><span class="history-amount ${isIn ? 'history-amount--in' : 'history-amount--out'}">${isIn ? '+' : '-'}${entry.cantidad}</span></div>`;
            } else {
                const fecha  = entry.date ? new Date(entry.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
                const isCode = entry.itemId === 'promo_code';
                return `<div class="history-entry"><span class="history-icon ${isCode ? 'history-icon--in' : 'history-icon--out'}">${isCode ? '+' : '-'}</span><div class="history-detail"><span class="history-motivo">${entry.name || 'Transacción'}</span><span class="history-fecha">${fecha}</span></div><span class="history-amount ${isCode ? 'history-amount--in' : 'history-amount--out'}">${isCode ? `+${entry.price || '?'}` : `-${entry.price || '?'}`}</span></div>`;
            }
        }).join('');
    },

    // ── COMPRA ────────────────────────────────────────────────────────────────

    async _initiatePurchase(item, btn) {
        const sv         = this;
        const eco        = window.ECONOMY;
        const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;
        const cashback   = Math.floor(finalPrice * eco.cashbackRate);
        const netCost    = finalPrice - cashback;

        const bodyHTML = `
            <div class="modal-product-row"><span class="modal-label">Wallpaper</span><span class="modal-value" style="color:var(--text-high); font-size:0.85rem;">${item.name}</span></div>
            ${eco.isSaleActive ? `<div class="modal-product-row"><span class="modal-label">Precio original</span><span class="modal-strikethrough">${item.price} ⭐</span></div><div class="modal-product-row"><span class="modal-label">Con oferta</span><span class="modal-value--sale">${finalPrice} ⭐</span></div>` : `<div class="modal-product-row"><span class="modal-label">Precio</span><span class="modal-value">${item.price} ⭐</span></div>`}
            ${cashback > 0 ? `<div class="modal-product-row"><span class="modal-label">Cashback</span><span class="modal-value--cashback">+${cashback} ⭐</span></div>` : ''}
            <div class="modal-product-row modal-product-row--total"><span class="modal-label" style="font-weight:700;">Costo neto</span><span class="modal-value--total">${netCost} ⭐</span></div>`;

        const confirmed = await sv._openConfirmModal({ title: '¿Canjear wallpaper?', bodyHTML, confirmText: `Canjear · ${finalPrice} ⭐` });
        if (!confirmed) return;

        const result = GameCenter.buyItem(item);
        if (result.success) {
            sv._filterItems();
            sv._renderLibrary(sv._allItems);
            document.querySelectorAll('.coin-display').forEach(el => el.textContent = GameCenter.getBalance());
            sv._fireConfetti();
            const cbNote = result.cashback > 0 ? ` <strong>+${result.cashback} cashback</strong> devueltas.` : '';
            sv._showToast(`"${item.name}" desbloqueado.${cbNote} Ve a <strong>Mis Tesoros</strong>.`, 'success');
            sv._updateWishlistCost();
        } else {
            if (result.reason === 'coins') {
                if (btn) sv._shakeElement(btn);
                sv._showToast('No tienes suficientes monedas.', 'error');
            }
        }
    },

    // ── PREVIEW MODAL ─────────────────────────────────────────────────────────

    _openPreviewModal(item) {
        const sv      = this;
        const modal   = document.getElementById('preview-modal');
        const img     = document.getElementById('preview-img');
        const nameEl  = document.getElementById('preview-name');
        const actEl   = document.getElementById('preview-actions');
        const eco     = window.ECONOMY;
        if (!modal) return;

        img.src = item.image; img.alt = item.name;
        nameEl.textContent = item.name;

        const isOwned    = GameCenter.getBoughtCount(item.id) > 0;
        const finalPrice = eco.isSaleActive ? Math.floor(item.price * eco.saleMultiplier) : item.price;

        if (isOwned) {
            const url = GameCenter.getDownloadUrl(item.id, item.file);
            actEl.innerHTML = url
                ? `<a href="${url}" download class="btn-primary vault-btn" style="flex:1; justify-content:center;"><i data-lucide="download" size="14"></i> Descargar</a>`
                : `<button class="btn-primary" style="flex:1; justify-content:center; opacity:0.5;" disabled><i data-lucide="check" size="14"></i> Obtenido</button>`;
        } else {
            actEl.innerHTML = `
                <button class="btn-ghost" style="flex:1; justify-content:center;" id="preview-close-btn">Volver</button>
                <button class="btn-primary preview-buy-btn" style="flex:2; justify-content:center;" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                    <i data-lucide="star" size="13" fill="#fbbf24" stroke="none"></i> Canjear · ${finalPrice}
                </button>`;
        }

        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ nodes: [actEl] });

        actEl.querySelector('.preview-buy-btn')?.addEventListener('click', async () => {
            modal.classList.add('hidden');
            const parsed = JSON.parse(actEl.querySelector('.preview-buy-btn').dataset.item.replace(/&#39;/g, "'"));
            await sv._initiatePurchase(parsed, null);
        });
        document.getElementById('preview-close-btn')?.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    },

    // ── CONFIRM MODAL ─────────────────────────────────────────────────────────

    _openConfirmModal({ title, bodyHTML, confirmText = 'Confirmar' }) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML   = bodyHTML;
        document.getElementById('modal-confirm').textContent = confirmText;
        document.getElementById('modal-error').textContent   = '';
        const overlay = document.getElementById('confirm-modal');
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => document.getElementById('modal-confirm')?.focus());
        return new Promise(resolve => { this._modalResolve = resolve; });
    },

    _closeModal(value) {
        document.getElementById('confirm-modal')?.classList.add('hidden');
        if (this._modalResolve) { this._modalResolve(value); this._modalResolve = null; }
    },

    // ── EMAIL MODAL ───────────────────────────────────────────────────────────

    _openEmailModal(item, absoluteUrl) {
        this._emailItem = item;
        this._emailUrl  = absoluteUrl;
        const thumbEl  = document.getElementById('email-modal-thumb');
        const nameEl   = document.getElementById('email-modal-item-name');
        const inputEl  = document.getElementById('email-modal-input');
        if (thumbEl)  { thumbEl.src = item.image; thumbEl.alt = item.name; }
        if (nameEl)   { nameEl.textContent = item.name; }
        if (inputEl)  { inputEl.value = window.MailHelper?.getLastMailRecipient?.() || ''; }
        this._setEmailError(false);
        const fallbackEl = document.getElementById('email-fallback');
        if (fallbackEl) fallbackEl.classList.remove('visible');
        const modal = document.getElementById('email-modal');
        modal.classList.remove('hidden');
        if (window.lucide) lucide.createIcons({ nodes: [modal] });
        requestAnimationFrame(() => document.getElementById('email-modal-input')?.focus());
    },

    _closeEmailModal() {
        document.getElementById('email-modal')?.classList.add('hidden');
        this._emailItem = null;
        this._emailUrl  = '';
    },

    _setEmailError(show, msg = 'Introduce un correo electrónico válido.') {
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
    },

    async _handleEmailConfirm() {
        if (!this._emailItem || !this._emailUrl) return;
        const inputEl    = document.getElementById('email-modal-input');
        const saveCb     = document.getElementById('email-save-checkbox');
        const fallbackEl = document.getElementById('email-fallback');
        const fallUrlEl  = document.getElementById('email-fallback-url');
        const email      = (inputEl?.value || '').trim();

        if (!window.MailHelper?.isValidEmail?.(email)) {
            this._setEmailError(true);
            inputEl?.focus();
            return;
        }
        this._setEmailError(false);

        const { uri, tooLong } = window.MailHelper.buildMailtoLink(this._emailItem, this._emailUrl, email);

        if (tooLong) {
            if (fallbackEl) fallbackEl.classList.add('visible');
            if (fallUrlEl)  fallUrlEl.textContent = this._emailUrl;
            if (window.lucide) lucide.createIcons({ nodes: [fallbackEl] });
            const copyBtn = document.getElementById('email-copy-btn');
            if (copyBtn) {
                const freshBtn = copyBtn.cloneNode(true);
                copyBtn.parentNode.replaceChild(freshBtn, copyBtn);
                const sv = this;
                document.getElementById('email-copy-btn').addEventListener('click', async () => {
                    const ok  = await window.MailHelper?.copyToClipboard?.(sv._emailUrl);
                    const lbl = document.getElementById('email-copy-label');
                    if (lbl) lbl.textContent = ok ? '✓ Enlace copiado' : 'No se pudo copiar';
                    setTimeout(() => { if (lbl) lbl.textContent = 'Copiar enlace de descarga'; }, 2500);
                });
            }
            if (saveCb?.checked) window.MailHelper?.saveLastMailRecipient?.(email);
            return;
        }

        if (saveCb?.checked) window.MailHelper?.saveLastMailRecipient?.(email);
        window.location.href = uri;
        setTimeout(() => this._closeEmailModal(), 300);
    },

    // ── PROMO CODE ────────────────────────────────────────────────────────────

    async _handleRedeem() {
        const sv    = this;
        const input = document.getElementById('promo-input');
        const msg   = document.getElementById('promo-msg');
        const btn   = document.getElementById('btn-redeem');
        const code  = input?.value.trim();
        if (!code) return;

        btn.disabled = true;
        const result = await window.GameCenter.redeemPromoCode(code);
        btn.disabled = false;

        if (result.success) {
            sv._showMsg(msg, result.message, 'var(--success)');
            if (input) { input.value = ''; input.style.borderColor = ''; }
            document.querySelectorAll('.coin-display').forEach(el => el.textContent = GameCenter.getBalance());
            confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 }, colors: ['#fbbf24','#9b59ff','#22d07a'] });
        } else {
            sv._showMsg(msg, result.message, 'var(--error)');
            if (input) input.style.borderColor = 'var(--error)';
            sv._shakeElement(btn);
        }
    },

    // ── SYNC ──────────────────────────────────────────────────────────────────

    async _handleExport() {
        const sv  = this;
        const msg = document.getElementById('export-msg');
        const btn = document.getElementById('btn-export');
        btn.disabled = true;
        sv._showMsg(msg, 'Generando código con checksum…', 'var(--text-low)');

        const code = await GameCenter.exportSave();
        btn.disabled = false;
        if (!code) { sv._showMsg(msg, 'Error al generar el código.', 'var(--error)'); return; }

        let clipboardOk = false;
        try {
            await navigator.clipboard.writeText(code);
            clipboardOk = true;
        } catch (_) {
            try {
                const ta = document.createElement('textarea');
                ta.value = code;
                Object.assign(ta.style, { position:'fixed', opacity:'0', top:'0', left:'0' });
                document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                document.body.removeChild(ta); clipboardOk = true;
            } catch (_2) {}
        }

        try {
            const blob = new Blob([code], { type: 'text/plain' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = `love-arcade-backup-${new Date().toISOString().slice(0,10)}.txt`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (_) {}

        sv._showMsg(msg, clipboardOk ? '✓ Código copiado al portapapeles y archivo .txt descargado.' : '✓ Archivo .txt descargado.', 'var(--success)');
    },

    async _handleImport() {
        const sv   = this;
        const code = document.getElementById('import-input')?.value.trim();
        const msg  = document.getElementById('import-msg');
        const btn  = document.getElementById('btn-import');
        if (!code) { sv._showMsg(msg, 'Carga un archivo o pega un código.', 'var(--error)'); return; }

        const confirmed = await sv._openConfirmModal({
            title: 'Importar partida',
            bodyHTML: `<div class="modal-warning">Esto <strong>reemplazará tu progreso actual</strong> (monedas, wallpapers, racha y ajustes).<br><br>Esta acción no se puede deshacer.</div>`,
            confirmText: 'Sí, importar'
        });
        if (!confirmed) return;

        btn.disabled = true;
        sv._showMsg(msg, 'Verificando integridad…', 'var(--text-low)');
        const result = await GameCenter.importSave(code);
        btn.disabled = false;

        if (result.success) {
            sv._showMsg(msg, '✓ Importado correctamente. Recargando…', 'var(--success)');
            setTimeout(() => location.reload(), 1200);
        } else {
            sv._showMsg(msg, result.message || 'Código inválido o corrupto.', 'var(--error)');
        }
    },

    // ── MOON BLESSING STATUS ──────────────────────────────────────────────────

    _renderMoonBlessingStatus() {
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
    },

    // ── SALE BANNER + ECONOMY ─────────────────────────────────────────────────

    _initSaleBanner() {
        const eco    = window.ECONOMY;
        const banner = document.getElementById('sale-banner');
        if (!banner) return;
        if (eco.isSaleActive) {
            banner.classList.remove('hidden');
            const pct = Math.round((1 - eco.saleMultiplier) * 100);
            document.getElementById('sale-label-text').textContent = `¡${eco.saleLabel}!`;
            document.getElementById('sale-desc-text').textContent  = `${pct}% de descuento + ${Math.round(eco.cashbackRate * 100)}% de cashback en toda la tienda.`;
            const badgeEl = document.getElementById('sale-badge-pct');
            if (badgeEl) badgeEl.textContent = `${pct}%`;
        }
        if (window.lucide) lucide.createIcons();
    },

    _initEconomyInfo() {
        const eco   = window.ECONOMY;
        const saleEl = document.getElementById('eco-sale-status');
        const cbEl   = document.getElementById('eco-cashback');
        if (!saleEl || !cbEl) return;
        const pct = Math.round((1 - eco.saleMultiplier) * 100);
        saleEl.textContent = eco.isSaleActive ? `${pct}% OFF activo` : 'Sin oferta activa';
        saleEl.className   = 'eco-badge' + (eco.isSaleActive ? ' eco-badge--sale' : '');
        cbEl.textContent   = `${Math.round(eco.cashbackRate * 100)}% en cada compra`;
        cbEl.className     = 'eco-badge eco-badge--green';
    },

    // ── UTILITARIOS ───────────────────────────────────────────────────────────

    _showMsg(el, text, color) {
        if (!el) return;
        el.innerHTML     = text;
        el.style.color   = color;
        el.style.opacity = '1';
    },

    _showToast(html, type = 'success') {
        const toast     = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = html;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));
        setTimeout(() => {
            toast.classList.remove('toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 4500);
    },

    _fireConfetti() {
        const colors = ['#9b59ff','#ff59b4','#fbbf24','#22d07a','#00d4ff'];
        confetti({ particleCount: 55, angle: 60,  spread: 65, origin: { x: 0, y: 0.7 }, colors });
        confetti({ particleCount: 55, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, colors });
    },

    _shakeElement(el) {
        el.classList.remove('anim-shake');
        void el.offsetWidth;
        el.classList.add('anim-shake');
        el.addEventListener('animationend', () => el.classList.remove('anim-shake'), { once: true });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// REGISTRO DE VISTAS
// Para añadir una nueva sección, crear el objeto de vista y registrarlo aquí.
// ─────────────────────────────────────────────────────────────────────────────

const AppRouter = new Router({
    '/':     HomeView,
    '/shop': ShopView,
    // '/minigames': MinigamesView,  // ← Ejemplo de extensión futura
});

window.AppRouter = AppRouter; // Expuesto para navegación programática desde juegos


// ─────────────────────────────────────────────────────────────────────────────
// LISTENERS GLOBALES DEL SHELL
// Manejan elementos que SIEMPRE están en el DOM (navbar, bottom-nav)
// y links de anclaje que navegan a home antes de hacer scroll.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
    // ── Brand logo navega a home ───────────────────────────────────────────────
    if (e.target.closest('#nav-brand-link')) {
        e.preventDefault();
        AppRouter.navigate('/');
        return;
    }

    // ── Links de anclaje (Juegos, Ayuda) desde vistas que no son home ─────────
    const scrollLink = e.target.closest('.js-scroll-home');
    if (scrollLink) {
        const isOnHome = AppRouter.currentRoute() === '/';
        if (!isOnHome) {
            e.preventDefault();
            const target = scrollLink.getAttribute('href'); // ej: "#games"
            AppRouter.navigate('/');
            // Esperar a que home se monte y luego hacer scroll
            setTimeout(() => {
                const el = document.querySelector(target);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 350);
        }
        // Si ya está en home, el comportamiento nativo del anchor scroll funciona.
        return;
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// ARRANQUE
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    AppRouter.start();
});
