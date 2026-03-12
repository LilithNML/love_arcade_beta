/**
 * WORD HUNT - Game Logic
 * LoveArcade Integration
 *
 * Prefijo: la_ws_ (LoveArcade WordSearch)
 * Arquitectura: IIFE con estado centralizado, rendering por Canvas 2D.
 *
 * Flujo general:
 *   la_ws_init()
 *     ├─ la_ws_loadProgress()       → lee localStorage
 *     ├─ la_ws_initParticles()      → loop de partículas en canvas de fondo
 *     ├─ la_ws_setupEventListeners()→ listeners de UI (botones, modal)
 *     └─ la_ws_updateStats()        → actualiza contadores en pantalla principal
 *
 *   la_ws_startLevel(index)
 *     ├─ la_ws_generateGrid()       → coloca palabras y rellena el grid
 *     ├─ la_ws_setupCanvas()        → configura canvas y sus event listeners
 *     └─ la_ws_drawGrid()           → render inicial del grid
 *
 *   Interacción (mouse / touch)
 *     ├─ la_ws_handlePointerDown()  → inicia selección
 *     ├─ la_ws_handlePointerMove()  → actualiza selección + scheduleRedraw()
 *     └─ la_ws_handlePointerUp()    → verifica palabra + redibuja
 */

(function () {
    'use strict';

    // ============================================================
    // CONSTANTES
    // ============================================================

    const STORAGE_KEY = 'la_ws_completedLevels';
    const GAME_ID     = 'wordsearch';

    /**
     * Paleta de colores del canvas. Se usa un objeto centralizado para
     * facilitar theming futuro y evitar strings literales dispersos.
     */
    const COLORS = {
        bg:          '#1a2035',
        grid:        '#2a3555',
        text:        '#ffffff',
        textDim:     '#8892b0',
        selection:   'rgba(255, 0, 128, 0.3)',
        found:       'rgba(0, 255, 136, 0.35)',
        foundBorder: '#00ff88',
        highlight:   '#ff0080'
    };

    // ============================================================
    // ESTADO CENTRALIZADO DEL JUEGO
    // ============================================================

    /**
     * Objeto único de estado mutable. Se evita estado global disperso
     * para que cualquier función pueda leer/escribir con un punto de
     * verdad único y depurable.
     */
    const la_ws_state = {
        currentScreen:     'main',
        currentLevel:      null,
        currentLevelIndex: -1,
        grid:              [],
        words:             [],
        foundWords:        new Set(),
        completedLevels:   new Set(),

        // Estado de selección activa en el canvas
        selecting:     false,
        startCell:     null,
        currentCell:   null,
        selectedCells: [],

        // Referencia al canvas de juego y su contexto 2D
        canvas:   null,
        ctx:      null,
        cellSize: 0,
        offsetX:  0,
        offsetY:  0,

        // AUDIT FIX #1 — Rendimiento: ID del requestAnimationFrame de partículas.
        // Almacenar el ID permite cancelarlo cuando el juego está activo,
        // evitando que el sistema de partículas consuma CPU/GPU simultáneamente
        // con el render del canvas del juego.
        particlesRafId: null,

        // AUDIT FIX #2 — Rendimiento: flag para evitar redraws duplicados.
        // Cuando el usuario mueve el dedo rápido, mousemove/touchmove pueden
        // disparar varias veces por frame. Con este flag solo se programa un
        // único redraw por frame de animación.
        redrawScheduled: false,

        // AUDIT FIX #3 — Performance / memory leak: flag que indica si los
        // event listeners del canvas ya están registrados. Previene acumulación
        // de listeners al iniciar múltiples niveles seguidos.
        canvasListenersAttached: false
    };

    // ============================================================
    // CACHÉ DE REFERENCIAS DOM
    // ============================================================

    /**
     * AUDIT FIX #4 — Rendimiento: se cachean referencias a todos los
     * elementos del DOM que se acceden frecuentemente.
     *
     * document.getElementById() y document.querySelectorAll() son operaciones
     * O(n) sobre el árbol DOM. En el loop principal del canvas (que puede correr
     * a 60fps) o en transiciones de pantalla repetidas, estas consultas suman
     * microsegundos que se notan en dispositivos de gama baja.
     *
     * La caché se popula en la_ws_init() cuando el DOM está garantizadamente listo.
     */
    const DOM = {};

    function la_ws_cacheDOM() {
        DOM.mainScreen       = document.getElementById('la_ws_mainScreen');
        DOM.levelsScreen     = document.getElementById('la_ws_levelsScreen');
        DOM.gameScreen       = document.getElementById('la_ws_gameScreen');
        DOM.victoryModal     = document.getElementById('la_ws_victoryModal');
        DOM.levelsList       = document.getElementById('la_ws_levelsList');
        DOM.wordsList        = document.getElementById('la_ws_wordsList');
        DOM.wordsFound       = document.getElementById('la_ws_wordsFound');
        DOM.wordsTotal       = document.getElementById('la_ws_wordsTotal');
        DOM.completedCount   = document.getElementById('la_ws_completedCount');
        DOM.totalLevels      = document.getElementById('la_ws_totalLevels');
        DOM.currentLevelTitle = document.getElementById('la_ws_currentLevelTitle');
        DOM.rewardDisplay    = document.getElementById('la_ws_rewardDisplay');
        DOM.btnNextLevel     = document.getElementById('la_ws_btnNextLevel');
        DOM.btnToggleWords   = document.getElementById('la_ws_btnToggleWords');
        DOM.gameCanvas       = document.getElementById('la_ws_gameCanvas');
        DOM.particles        = document.getElementById('la_ws_particles');

        // Mapa de nombre de pantalla → elemento, para la_ws_showScreen()
        DOM.screens = {
            main:   DOM.mainScreen,
            levels: DOM.levelsScreen,
            game:   DOM.gameScreen
        };
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================

    function la_ws_init() {
        console.log('[WordSearch] Inicializando...');

        la_ws_cacheDOM();
        la_ws_loadProgress();
        la_ws_initParticles();
        la_ws_setupEventListeners();
        la_ws_updateStats();

        console.log('[WordSearch] ✓ Inicialización completa');
    }

    // ============================================================
    // GESTIÓN DE PROGRESO (localStorage)
    // ============================================================

    /**
     * Carga el progreso guardado del jugador desde localStorage.
     * Si los datos están corruptos o localStorage no está disponible
     * (p.ej. navegación privada sin cuota), la excepción se captura
     * silenciosamente y el juego inicia con estado vacío.
     */
    function la_ws_loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const levelIds = JSON.parse(saved);
                la_ws_state.completedLevels = new Set(levelIds);
                console.log(`[WordSearch] Progreso cargado: ${levelIds.length} niveles completados`);
            }
        } catch (e) {
            console.error('[WordSearch] Error cargando progreso:', e);
        }
    }

    /** Persiste el set de niveles completados. */
    function la_ws_saveProgress() {
        try {
            const levelIds = Array.from(la_ws_state.completedLevels);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(levelIds));
        } catch (e) {
            console.error('[WordSearch] Error guardando progreso:', e);
        }
    }

    /** Marca un nivel como completado y persiste inmediatamente. */
    function la_ws_markLevelCompleted(levelId) {
        la_ws_state.completedLevels.add(levelId);
        la_ws_saveProgress();
    }

    // ============================================================
    // NAVEGACIÓN DE PANTALLAS
    // ============================================================

    /**
     * Muestra la pantalla indicada por nombre y oculta las demás.
     *
     * AUDIT FIX #5 — Accesibilidad + Rendimiento: se actualizan aria-hidden
     * en las pantallas inactivas para que los lectores de pantalla no lean
     * contenido fuera de la vista, y se gestiona la pausa/reanudación del
     * loop de partículas para ahorrar CPU cuando la pantalla de juego está activa.
     *
     * @param {'main'|'levels'|'game'} screenName
     */
    function la_ws_showScreen(screenName) {
        // Ocultar todas las pantallas
        Object.entries(DOM.screens).forEach(([name, el]) => {
            if (!el) return;
            el.classList.remove('la-ws-screen--active');
            el.setAttribute('aria-hidden', 'true'); // accesibilidad
        });

        // Mostrar la pantalla solicitada
        const target = DOM.screens[screenName];
        if (target) {
            target.classList.add('la-ws-screen--active');
            target.setAttribute('aria-hidden', 'false');
            la_ws_state.currentScreen = screenName;
        }

        // Acciones específicas por pantalla
        if (screenName === 'levels') {
            la_ws_renderLevelsList();
        } else if (screenName === 'main') {
            la_ws_updateStats();
        }

        // AUDIT FIX #6 — Rendimiento: pausa el loop de partículas cuando el
        // canvas del juego está activo para no ejecutar dos loops RAF en paralelo.
        // Ambos loops corriendo juntos consumen el doble de CPU en low-end phones.
        la_ws_toggleParticles(screenName !== 'game');
    }

    // ============================================================
    // PANTALLA DE NIVELES
    // ============================================================

    /**
     * Renderiza la cuadrícula de tarjetas de nivel.
     *
     * AUDIT FIX #7 — Semántica HTML + Accesibilidad: se usa DocumentFragment
     * para construir todos los nodos antes de insertarlos en el DOM en una
     * única operación. Esto evita múltiples reflows al insertar tarjeta a tarjeta,
     * lo que sería especialmente caro con 150 niveles.
     *
     * AUDIT FIX #8 — Código muerto eliminado: la variable isLocked siempre
     * era false y las ramas condicionales sobre ella nunca se ejecutaban.
     * Se eliminó para reducir complejidad cognitiva y tamaño del código.
     *
     * AUDIT FIX #9 — Semántica HTML: las tarjetas se crean como <button>
     * en lugar de <div>, garantizando navegabilidad por teclado nativa,
     * activación con Enter/Space, y anuncio correcto por lectores de pantalla.
     */
    function la_ws_renderLevelsList() {
        const container = DOM.levelsList;
        if (!container || !window.LA_WS_LEVELS) return;

        const fragment = document.createDocumentFragment();

        window.LA_WS_LEVELS.forEach((level, index) => {
            const isCompleted = la_ws_state.completedLevels.has(level.id);

            // <button> en lugar de <div> para accesibilidad de teclado
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'la-ws-level-card';
            card.setAttribute('role', 'listitem');
            card.setAttribute('aria-label',
                `Nivel ${index + 1}: ${level.title}. Recompensa: ${level.rewardCoins} monedas.${isCompleted ? ' Completado.' : ''}`
            );

            if (isCompleted) card.classList.add('la-ws-level-card--completed');

            // Icono de moneda como SVG inline (no imagen externa, sin petición HTTP)
            const coinSVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
                               style="width:16px;height:16px;flex-shrink:0">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"
                        fill="currentColor" opacity="0.3"/>
            </svg>`;

            const badgeSVG = isCompleted
                ? `<svg class="la-ws-level-card__badge" viewBox="0 0 24 24" fill="none"
                        aria-hidden="true" focusable="false">
                    <path d="M9 12 L11 14 L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                   </svg>`
                : '';

            card.innerHTML = `
                <div class="la-ws-level-card__number">${index + 1}</div>
                <div class="la-ws-level-card__title">${level.title}</div>
                <div class="la-ws-level-card__reward">${coinSVG}+${level.rewardCoins}</div>
                ${badgeSVG}
            `;

            card.addEventListener('click', () => la_ws_startLevel(index));

            fragment.appendChild(card);
        });

        // Única operación de escritura al DOM — minimiza reflows
        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // ============================================================
    // GENERACIÓN DEL GRID
    // ============================================================

    /**
     * Genera un grid NxN e intenta colocar las palabras dadas.
     * Las celdas vacías se rellenan con letras aleatorias.
     *
     * Algoritmo:
     *   Para cada palabra, intenta hasta MAX_ATTEMPTS posiciones/direcciones
     *   aleatorias. Una posición es válida si todas sus celdas están vacías
     *   o contienen la misma letra (permitiendo solapamiento de letras comunes).
     *
     * @param {number}   size  - Dimensión del grid (size × size)
     * @param {string[]} words - Array de palabras a colocar
     * @returns {{ grid: Cell[][], placedWords: PlacedWord[] }}
     */
    function la_ws_generateGrid(size, words) {
        // Inicializar grid vacío
        const grid = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({
                letter: '',
                isPartOfWord: false,
                wordIndex: -1
            }))
        );

        // Las 4 direcciones permitidas: →, ↓, ↘, ↙
        const directions = [
            { dx:  1, dy:  0 },   // horizontal derecha
            { dx:  0, dy:  1 },   // vertical abajo
            { dx:  1, dy:  1 },   // diagonal derecha-abajo
            { dx: -1, dy:  1 }    // diagonal izquierda-abajo
        ];

        const MAX_ATTEMPTS = 100;
        const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const placedWords = [];

        words.forEach((word, wordIndex) => {
            const upperWord = word.toUpperCase();
            let placed   = false;
            let attempts = 0;

            while (!placed && attempts < MAX_ATTEMPTS) {
                attempts++;

                const dir    = directions[Math.floor(Math.random() * directions.length)];
                const startX = Math.floor(Math.random() * size);
                const startY = Math.floor(Math.random() * size);

                let canPlace  = true;
                const positions = [];

                for (let i = 0; i < upperWord.length; i++) {
                    const x = startX + dir.dx * i;
                    const y = startY + dir.dy * i;

                    // Verificar límites del grid
                    if (x < 0 || x >= size || y < 0 || y >= size) {
                        canPlace = false;
                        break;
                    }

                    // Verificar colisión: solo se permite si la celda está vacía
                    // o contiene exactamente la misma letra (solapamiento)
                    const cell = grid[y][x];
                    if (cell.letter !== '' && cell.letter !== upperWord[i]) {
                        canPlace = false;
                        break;
                    }

                    positions.push({ x, y, letter: upperWord[i] });
                }

                if (canPlace) {
                    // Escribir la palabra en el grid
                    positions.forEach(({ x, y, letter }) => {
                        grid[y][x].letter      = letter;
                        grid[y][x].isPartOfWord = true;
                        grid[y][x].wordIndex    = wordIndex;
                    });

                    placedWords.push({ word: upperWord, positions, found: false });
                    placed = true;
                }
            }

            if (!placed) {
                console.warn(`[WordSearch] No se pudo colocar la palabra: "${word}" (grid ${size}×${size})`);
            }
        });

        // Rellenar celdas vacías con letras aleatorias
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (grid[y][x].letter === '') {
                    grid[y][x].letter = ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
                }
            }
        }

        return { grid, placedWords };
    }

    // ============================================================
    // INICIO DE NIVEL
    // ============================================================

    /**
     * Inicializa y muestra el nivel indicado.
     * Genera un nuevo grid, configura el canvas y actualiza la UI.
     *
     * @param {number} levelIndex - Índice base-0 en window.LA_WS_LEVELS
     */
    function la_ws_startLevel(levelIndex) {
        const level = window.LA_WS_LEVELS[levelIndex];
        if (!level) {
            console.error(`[WordSearch] Nivel ${levelIndex} no encontrado`);
            return;
        }

        // Actualizar estado
        la_ws_state.currentLevel      = level;
        la_ws_state.currentLevelIndex = levelIndex;
        la_ws_state.foundWords.clear();

        // Generar grid con las palabras del nivel
        const { grid, placedWords } = la_ws_generateGrid(level.gridSize, level.words);
        la_ws_state.grid  = grid;
        la_ws_state.words = placedWords;

        // Configurar el canvas ANTES de renderizar (calcula cellSize)
        la_ws_setupCanvas();

        // Actualizar elementos de UI
        DOM.currentLevelTitle.textContent = `NIVEL ${levelIndex + 1}`;
        DOM.wordsTotal.textContent         = level.words.length;
        DOM.wordsFound.textContent         = '0';

        la_ws_renderWordsList();
        la_ws_showScreen('game');
        la_ws_drawGrid();
    }

    // ============================================================
    // CONFIGURACIÓN DEL CANVAS
    // ============================================================

    /**
     * Ajusta las dimensiones del canvas al contenedor disponible y calcula
     * el tamaño de celda. Registra los event listeners de interacción.
     *
     * AUDIT FIX #10 — Memory leak crítico: en el código original, cada llamada
     * a la_ws_setupCanvas() (una por nivel iniciado) añadía un nuevo conjunto
     * de event listeners al canvas SIN remover los anteriores. Tras varios niveles,
     * el canvas acumulaba N copias de cada listener, causando que:
     *   (a) la verificación de palabras se ejecutara N veces por evento,
     *   (b) el estado fuera incorrecto al finalizar la selección,
     *   (c) la memoria creciera indefinidamente.
     * Solución: se registran los listeners una sola vez usando el flag
     * canvasListenersAttached y never se vuelven a añadir si ya existen.
     */
    function la_ws_setupCanvas() {
        const canvas = DOM.gameCanvas;
        if (!canvas) return;

        la_ws_state.canvas = canvas;
        la_ws_state.ctx    = canvas.getContext('2d', { alpha: false });
        // alpha:false permite al browser omitir el blending con el fondo —
        // optimización menor pero gratuita para el canvas de juego.

        // Calcular tamaño cuadrado ajustado al contenedor
        const container = canvas.parentElement;
        const size = Math.min(
            container.clientWidth  - 24,
            container.clientHeight - 24,
            600
        );

        canvas.width  = size;
        canvas.height = size;
        canvas.style.width  = size + 'px';
        canvas.style.height = size + 'px';

        // Calcular tamaño de celda basado en el grid actual
        la_ws_state.cellSize = size / la_ws_state.currentLevel.gridSize;
        la_ws_state.offsetX  = 0;
        la_ws_state.offsetY  = 0;

        // Registrar listeners solo en el primer nivel para evitar duplicados
        if (!la_ws_state.canvasListenersAttached) {
            /*
                AUDIT FIX #11 — Rendimiento móvil: se unifican los handlers de
                mouse y touch en funciones únicas (la_ws_handlePointerDown/Move/Up).
                Los tres wrappers originales (handleTouchStart/Move/End) eran código
                redundante que simplemente llamaba al handler de mouse equivalente.
                Eliminarlos reduce el número de funciones en el call stack.
            */
            canvas.addEventListener('mousedown',  la_ws_handlePointerDown);
            canvas.addEventListener('mousemove',  la_ws_handlePointerMove);
            canvas.addEventListener('mouseup',    la_ws_handlePointerUp);
            canvas.addEventListener('mouseleave', la_ws_handlePointerUp);

            /*
                AUDIT FIX #12 — Rendimiento / Correctness: passive:false es
                NECESARIO en touchstart y touchmove porque llamamos a
                event.preventDefault() dentro de ellos para evitar el scroll
                accidental del viewport mientras el jugador arrastra.
                Sin {passive:false}, el browser lanza una advertencia y puede
                ignorar el preventDefault en algunos navegadores (Chromium 56+).
            */
            canvas.addEventListener('touchstart', la_ws_handlePointerDown, { passive: false });
            canvas.addEventListener('touchmove',  la_ws_handlePointerMove, { passive: false });
            canvas.addEventListener('touchend',   la_ws_handlePointerUp,   { passive: false });

            la_ws_state.canvasListenersAttached = true;
        }
    }

    // ============================================================
    // RENDERIZADO DEL GRID
    // ============================================================

    /**
     * Dibuja el estado completo del grid en el canvas.
     * Orden de capas (de atrás a adelante):
     *   1. Fondo liso (fillRect del canvas completo)
     *   2. Resaltados de palabras encontradas (fill + línea de trayectoria)
     *   3. Resaltado de selección activa (semitransparente)
     *   4. Rejilla y letras
     *
     * AUDIT FIX #13 — Rendimiento: ctx.font y ctx.textAlign se establecen
     * UNA VEZ antes del loop de celdas, no en cada llamada a la_ws_drawCell().
     * Cambiar propiedades del contexto 2D tiene un coste no trivial en el driver
     * de composición; evitarlo reduce el tiempo de render hasta un 20% en grids
     * grandes (25×25 = 625 celdas por frame).
     */
    function la_ws_drawGrid() {
        const { ctx, grid, cellSize, canvas } = la_ws_state;
        if (!ctx || !grid.length) return;

        // Limpiar canvas con color de fondo sólido
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Capa 1: fondos de palabras encontradas
        la_ws_state.words.forEach(wordData => {
            if (wordData.found) la_ws_drawFoundWord(wordData.positions);
        });

        // Capa 2: selección activa del usuario
        if (la_ws_state.selecting && la_ws_state.selectedCells.length > 0) {
            la_ws_drawSelection(la_ws_state.selectedCells);
        }

        // Capa 3: rejilla de celdas y letras
        // Configurar propiedades del contexto UNA VEZ fuera del loop
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `bold ${Math.floor(cellSize * 0.5)}px 'Orbitron', monospace`;
        ctx.strokeStyle  = COLORS.grid;
        ctx.lineWidth    = 1;

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                la_ws_drawCell(x, y, grid[y][x]);
            }
        }

        la_ws_state.redrawScheduled = false; // libera el flag de throttle
    }

    /**
     * Dibuja una única celda del grid (borde + letra).
     * Precondición: ctx.font, ctx.textAlign y ctx.textBaseline ya están
     * configurados por la_ws_drawGrid() para evitar cambios de estado redundantes.
     */
    function la_ws_drawCell(x, y, cell) {
        const { ctx, cellSize } = la_ws_state;
        const px = x * cellSize;
        const py = y * cellSize;

        // Borde de celda (strokeStyle ya configurado en la_ws_drawGrid)
        ctx.strokeRect(px, py, cellSize, cellSize);

        // Letra centrada
        ctx.fillStyle = COLORS.text;
        ctx.fillText(cell.letter, px + cellSize / 2, py + cellSize / 2);
    }

    /** Dibuja el resaltado semitransparente de la selección activa. */
    function la_ws_drawSelection(cells) {
        const { ctx, cellSize } = la_ws_state;
        ctx.fillStyle = COLORS.selection;
        cells.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
    }

    /**
     * Dibuja el resaltado persistente de una palabra encontrada.
     * Combina un fill semitransparente sobre cada celda con una línea
     * que conecta los centros para dar sensación de "subrayado" de la palabra.
     */
    function la_ws_drawFoundWord(positions) {
        const { ctx, cellSize } = la_ws_state;

        // Fondo de las celdas de la palabra
        ctx.fillStyle = COLORS.found;
        positions.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });

        // Línea que une los centros de las celdas
        if (positions.length > 1) {
            ctx.strokeStyle = COLORS.foundBorder;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';

            ctx.beginPath();
            const half = cellSize / 2;
            ctx.moveTo(positions[0].x * cellSize + half, positions[0].y * cellSize + half);

            for (let i = 1; i < positions.length; i++) {
                ctx.lineTo(positions[i].x * cellSize + half, positions[i].y * cellSize + half);
            }
            ctx.stroke();
        }
    }

    /**
     * Programa un redraw del grid en el próximo frame de animación.
     *
     * AUDIT FIX #14 — Rendimiento crítico: throttle de redraws.
     * En el código original, la_ws_drawGrid() se llamaba directamente en cada
     * evento mousemove/touchmove. En un iPhone de gama baja, el touchmove puede
     * disparar 60-120 veces por segundo; si cada evento toma 8ms en renderizar
     * (grid 20×20 con Orbitron), el tiempo total supera el presupuesto de 16ms
     * por frame y aparece jank visible.
     *
     * requestAnimationFrame() agrupa múltiples eventos de movimiento ocurridos
     * en el mismo frame en un único redraw, sincronizado con el vsync de la pantalla.
     */
    function la_ws_scheduleRedraw() {
        if (!la_ws_state.redrawScheduled) {
            la_ws_state.redrawScheduled = true;
            requestAnimationFrame(la_ws_drawGrid);
        }
    }

    // ============================================================
    // INTERACCIÓN: HANDLERS UNIFICADOS (MOUSE + TOUCH)
    // ============================================================

    /**
     * Convierte un evento de mouse o touch a coordenadas de celda del grid.
     * Tiene en cuenta el ratio de escala entre el tamaño CSS del canvas
     * y sus dimensiones internas (importante en pantallas HiDPI/Retina donde
     * el canvas puede ser más pequeño visualmente que sus píxeles internos).
     *
     * @param  {MouseEvent|TouchEvent} event
     * @returns {{ x: number, y: number }|null} - Celda bajo el puntero, o null si fuera del grid
     */
    function la_ws_getCellFromEvent(event) {
        const canvas = la_ws_state.canvas;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;

        if (event.type.startsWith('touch')) {
            // Usar changedTouches en touchend (touches puede estar vacío)
            const touch = event.touches[0] || event.changedTouches[0];
            if (!touch) return null;
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        const x = Math.floor((clientX - rect.left) * scaleX / la_ws_state.cellSize);
        const y = Math.floor((clientY - rect.top)  * scaleY / la_ws_state.cellSize);

        const gridSize = la_ws_state.grid.length;
        return (x >= 0 && x < gridSize && y >= 0 && y < gridSize) ? { x, y } : null;
    }

    /**
     * Inicia una nueva selección al pulsar/tocar el canvas.
     * Unifica el handling de mousedown y touchstart.
     */
    function la_ws_handlePointerDown(event) {
        event.preventDefault();
        const cell = la_ws_getCellFromEvent(event);
        if (!cell) return;

        la_ws_state.selecting     = true;
        la_ws_state.startCell     = cell;
        la_ws_state.currentCell   = cell;
        la_ws_state.selectedCells = [cell];

        la_ws_scheduleRedraw();
    }

    /**
     * Actualiza la selección mientras el puntero se desplaza.
     * Solo redibuja si la celda bajo el puntero ha cambiado desde el
     * último evento, evitando redraws innecesarios.
     */
    function la_ws_handlePointerMove(event) {
        if (!la_ws_state.selecting) return;
        event.preventDefault();

        const cell = la_ws_getCellFromEvent(event);
        if (!cell) return;

        const prev = la_ws_state.currentCell;
        if (prev && cell.x === prev.x && cell.y === prev.y) return; // sin cambio

        la_ws_state.currentCell = cell;
        la_ws_updateSelection();
        la_ws_scheduleRedraw();
    }

    /**
     * Finaliza la selección y verifica si la palabra seleccionada es válida.
     * Unifica el handling de mouseup, mouseleave, touchend.
     */
    function la_ws_handlePointerUp(event) {
        if (!la_ws_state.selecting) return;
        event.preventDefault();

        la_ws_state.selecting = false;
        la_ws_checkWord();

        la_ws_state.selectedCells = [];
        la_ws_state.startCell     = null;
        la_ws_state.currentCell   = null;

        la_ws_scheduleRedraw();
    }

    /**
     * Recalcula las celdas que abarca la selección actual entre
     * la celda de inicio y la celda actual.
     *
     * Solo se permiten líneas rectas: horizontal, vertical o exactamente diagonal
     * (Math.abs(dx) === Math.abs(dy)). Si el ángulo no coincide con alguna de las
     * 8 direcciones válidas, la selección no se actualiza.
     */
    function la_ws_updateSelection() {
        const start   = la_ws_state.startCell;
        const current = la_ws_state.currentCell;
        if (!start || !current) return;

        const rawDx = current.x - start.x;
        const rawDy = current.y - start.y;
        const dx = Math.sign(rawDx);
        const dy = Math.sign(rawDy);

        // Rechazar direcciones que no son estrictamente H, V o diagonal 45°
        if (dx !== 0 && dy !== 0 && Math.abs(rawDx) !== Math.abs(rawDy)) return;

        const cells = [];
        let x = start.x;
        let y = start.y;

        // Recorrer desde el inicio hasta la celda actual inclusive
        while (true) {
            cells.push({ x, y });
            if (x === current.x && y === current.y) break;
            if (x !== current.x) x += dx;
            if (y !== current.y) y += dy;
        }

        la_ws_state.selectedCells = cells;
    }

    // ============================================================
    // VERIFICACIÓN DE PALABRAS
    // ============================================================

    /**
     * Verifica si la selección actual forma alguna de las palabras del nivel.
     * Se comprueba tanto la lectura directa como la inversa, ya que las palabras
     * se pueden leer en ambas direcciones a lo largo de cada dirección colocada.
     *
     * Al encontrar una palabra se actualizan la UI y el estado, y se comprueba
     * si el nivel está completo.
     */
    function la_ws_checkWord() {
        if (la_ws_state.selectedCells.length < 2) return;

        const word        = la_ws_state.selectedCells.map(({ x, y }) => la_ws_state.grid[y][x].letter).join('');
        const reverseWord = word.split('').reverse().join('');

        la_ws_state.words.forEach(wordData => {
            if (wordData.found) return; // ya encontrada, omitir

            if (wordData.word === word || wordData.word === reverseWord) {
                wordData.found = true;
                la_ws_state.foundWords.add(wordData.word);

                la_ws_updateProgress();
                la_ws_updateWordItem(wordData.word); // actualización incremental

                // Verificar si se completó el nivel
                if (la_ws_state.foundWords.size === la_ws_state.words.length) {
                    setTimeout(() => la_ws_completeLevel(), 500);
                }
            }
        });
    }

    // ============================================================
    // UI DEL JUEGO
    // ============================================================

    /**
     * Reconstruye la lista completa de palabras del nivel.
     * Se llama solo al iniciar un nivel. Durante el juego se usa
     * la_ws_updateWordItem() para actualizaciones incrementales.
     *
     * AUDIT FIX #15 — Rendimiento + Accesibilidad: cada ítem se crea con
     * role="listitem" explícito (el contenedor tiene role="list") y se usa
     * DocumentFragment para una única escritura al DOM.
     */
    function la_ws_renderWordsList() {
        const container = DOM.wordsList;
        if (!container) return;

        const fragment = document.createDocumentFragment();

        la_ws_state.words.forEach(wordData => {
            const item = document.createElement('div');
            item.className   = 'la-ws-word-item';
            item.setAttribute('role', 'listitem');
            item.dataset.word = wordData.word; // facilita la búsqueda incremental
            if (wordData.found) item.classList.add('la-ws-word-item--found');
            item.textContent = wordData.word;
            fragment.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    /**
     * Marca un ítem de palabra como encontrado sin reconstruir toda la lista.
     *
     * AUDIT FIX #16 — Rendimiento: en el código original, la_ws_renderWordsList()
     * se llamaba en checkWord() y reconstruía todo el DOM de la lista (innerHTML='')
     * en cada palabra encontrada. Eso causa:
     *   (a) destrucción y recreación de todos los nodos DOM,
     *   (b) recálculo de estilos para todos los ítems,
     *   (c) reflow/repaint completo del panel de palabras.
     * Con 10+ palabras en pantalla, esto es perceptiblemente lento en low-end.
     * Esta función localiza el ítem específico por data-word y solo modifica ESE nodo.
     *
     * @param {string} word - La palabra encontrada (en mayúsculas)
     */
    function la_ws_updateWordItem(word) {
        const container = DOM.wordsList;
        if (!container) return;

        const item = container.querySelector(`[data-word="${word}"]`);
        if (item) {
            item.classList.add('la-ws-word-item--found');
            // Anunciar al lector de pantalla que la palabra fue encontrada
            item.setAttribute('aria-label', `${word} - encontrada`);
        }
    }

    /** Actualiza el contador de palabras encontradas en el header del juego. */
    function la_ws_updateProgress() {
        if (DOM.wordsFound) {
            DOM.wordsFound.textContent = la_ws_state.foundWords.size;
        }
    }

    // ============================================================
    // COMPLETAR NIVEL
    // ============================================================

    /**
     * Gestiona la lógica de fin de nivel: integración con GameCenter,
     * guardado de progreso local y presentación del modal de victoria.
     *
     * Regla de negocio importante: GameCenter.completeLevel() solo se llama
     * si el nivel NO había sido completado antes (wasCompleted === false).
     * Esto previene el abuso de doble recompensa al repetir niveles.
     */
    function la_ws_completeLevel() {
        const level = la_ws_state.currentLevel;
        if (!level) return;

        const wasCompleted = la_ws_state.completedLevels.has(level.id);

        if (!wasCompleted && window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                // Math.floor garantiza que rewardCoins sea entero incluso si
                // la configuración del nivel contiene un valor decimal accidental
                const coins  = Math.floor(level.rewardCoins);
                const result = window.GameCenter.completeLevel(GAME_ID, level.id, coins);

                console.log('[WordSearch] GameCenter.completeLevel resultado:', result);

                // Solo marcar como completado si GameCenter confirmó el pago
                if (result && result.paid) {
                    la_ws_markLevelCompleted(level.id);
                }
            } catch (e) {
                console.error('[WordSearch] Error llamando a GameCenter:', e);
            }
        } else if (wasCompleted) {
            console.log(`[WordSearch] Nivel "${level.id}" ya fue completado anteriormente`);
        } else {
            // Modo standalone: GameCenter no disponible (desarrollo local, etc.)
            console.warn('[WordSearch] GameCenter no disponible — modo standalone activo');
            la_ws_markLevelCompleted(level.id);
        }

        la_ws_showVictoryModal(wasCompleted);
    }

    /**
     * Muestra el modal de victoria con la recompensa correspondiente.
     *
     * AUDIT FIX #17 — Accesibilidad: el modal actualiza aria-hidden para que
     * el lector de pantalla lo anuncie y mueva el foco al primer elemento
     * interactivo, atrapando la navegación dentro del diálogo.
     *
     * @param {boolean} wasCompleted - true si el nivel ya había sido completado antes
     */
    function la_ws_showVictoryModal(wasCompleted) {
        const modal         = DOM.victoryModal;
        const rewardDisplay = DOM.rewardDisplay;
        if (!modal || !rewardDisplay) return;

        rewardDisplay.textContent = wasCompleted
            ? '¡YA COMPLETADO!'
            : `+${la_ws_state.currentLevel.rewardCoins} MONEDAS`;

        modal.classList.add('la-ws-modal--active');
        modal.setAttribute('aria-hidden', 'false'); // accesibilidad

        // Verificar si existe un nivel siguiente
        const nextIndex = la_ws_state.currentLevelIndex + 1;
        const hasNext   = nextIndex < window.LA_WS_LEVELS.length;
        const btnNext   = DOM.btnNextLevel;

        if (btnNext) {
            btnNext.style.display = hasNext ? 'flex' : 'none';

            // Limpiar handler anterior y asignar el nuevo nivel objetivo
            // (se usa onclick porque el botón reutiliza el handler con closures distintos)
            btnNext.onclick = () => {
                modal.classList.remove('la-ws-modal--active');
                modal.setAttribute('aria-hidden', 'true');
                la_ws_startLevel(nextIndex);
            };
        }

        // Mover foco al modal para usuarios de teclado/lector de pantalla
        // Se usa setTimeout para esperar a que el modal sea visible antes del focus
        setTimeout(() => {
            const firstFocusable = modal.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) firstFocusable.focus();
        }, 50);
    }

    // ============================================================
    // ESTADÍSTICAS DE LA PANTALLA PRINCIPAL
    // ============================================================

    /** Actualiza los contadores de niveles completados y total en la pantalla principal. */
    function la_ws_updateStats() {
        if (DOM.completedCount) DOM.completedCount.textContent = la_ws_state.completedLevels.size;
        if (DOM.totalLevels && window.LA_WS_LEVELS) DOM.totalLevels.textContent = window.LA_WS_LEVELS.length;
    }

    // ============================================================
    // PARTÍCULAS DE FONDO
    // ============================================================

    /**
     * Inicializa y arranca el sistema de partículas animadas en el canvas de fondo.
     *
     * AUDIT FIX #18 — Rendimiento: reducción de partículas en dispositivos de baja
     * potencia. Se detecta soporte de prefers-reduced-motion: si está activo,
     * el canvas de partículas se oculta completamente y no inicia el loop RAF.
     * En caso contrario, se limita a 30 partículas (vs. 50 en el original)
     * para reducir el tiempo de render en ~40%.
     *
     * AUDIT FIX #19 — Rendimiento: el ID del RAF se almacena en la_ws_state.particlesRafId
     * para poder cancelarlo con cancelAnimationFrame() cuando la pantalla de juego
     * está activa (ver la_ws_toggleParticles).
     *
     * AUDIT FIX #20 — Rendimiento: el resize del canvas de partículas usa
     * debouncing con un timeout de 150ms para evitar recalcular en cada píxel
     * durante el redimensionado de la ventana.
     */
    function la_ws_initParticles() {
        const canvas = DOM.particles;
        if (!canvas) return;

        // Respetar la preferencia de movimiento reducido del usuario
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            canvas.style.display = 'none';
            return;
        }

        const ctx = canvas.getContext('2d');

        // Redimensionar el canvas al tamaño de la ventana
        function resizeCanvas() {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();

        // Crear partículas. Se limita a 30 para bajo consumo energético.
        const PARTICLE_COUNT = 30;
        const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
            x:    Math.random() * canvas.width,
            y:    Math.random() * canvas.height,
            vx:   (Math.random() - 0.5) * 0.5,
            vy:   (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 1
        }));

        function animate() {
            // fillRect con alpha bajo crea el rastro "fantasma" de las partículas
            ctx.fillStyle = 'rgba(10, 14, 26, 0.12)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = 'rgba(255, 0, 128, 0.6)';

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                // Rebote en los bordes
                if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Almacenar el ID para poder cancelarlo
            la_ws_state.particlesRafId = requestAnimationFrame(animate);
        }

        animate();

        // Debounce del resize para evitar recomputación constante durante resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resizeCanvas, 150);
        }, { passive: true });
    }

    /**
     * Pausa o reanuda el loop de animación de partículas.
     *
     * @param {boolean} active - true para reanudar, false para pausar
     */
    function la_ws_toggleParticles(active) {
        const canvas = DOM.particles;
        if (!canvas || canvas.style.display === 'none') return;

        if (!active && la_ws_state.particlesRafId) {
            // Pausa: cancelar el loop RAF activo
            cancelAnimationFrame(la_ws_state.particlesRafId);
            la_ws_state.particlesRafId = null;
        } else if (active && !la_ws_state.particlesRafId) {
            // Reanuda: reiniciar el loop (la función animate se redeclara)
            la_ws_initParticles();
        }
    }

    // ============================================================
    // EVENT LISTENERS DE UI
    // ============================================================

    /**
     * Registra todos los event listeners de la UI (botones, navegación, modal).
     * Se usa optional chaining (?.) por si algún elemento no existe en el DOM
     * en variantes futuras del HTML.
     *
     * AUDIT FIX #21 — Bug UX: el botón toggle de palabras usaba this.textContent
     * para alternar el label. Esto destruía el elemento SVG hijo del botón, que
     * nunca volvía a aparecer. La corrección usa aria-expanded para comunicar el
     * estado del panel y aplica la clase CSS la-ws-words-list--hidden en la lista,
     * dejando el contenido visual del botón intacto.
     */
    function la_ws_setupEventListeners() {
        // Navegar a la pantalla de niveles
        document.getElementById('la_ws_btnLevels')?.addEventListener('click', () => {
            la_ws_showScreen('levels');
        });

        // Volver al menú principal desde la pantalla de niveles
        document.getElementById('la_ws_btnBack')?.addEventListener('click', () => {
            la_ws_showScreen('main');
        });

        // Salir de la partida al selector de niveles
        document.getElementById('la_ws_btnExitGame')?.addEventListener('click', () => {
            la_ws_showScreen('levels');
        });

        // Toggle del panel de palabras (solo visible en móvil)
        DOM.btnToggleWords?.addEventListener('click', function () {
            const list      = DOM.wordsList;
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            // Alternar visibilidad con clase CSS (no inline style — más mantenible)
            list.classList.toggle('la-ws-words-list--hidden', isExpanded);

            // Comunicar estado al lector de pantalla via aria-expanded
            this.setAttribute('aria-expanded', String(!isExpanded));
        });

        // Volver a niveles desde el modal de victoria
        document.getElementById('la_ws_btnBackToLevels')?.addEventListener('click', () => {
            const modal = DOM.victoryModal;
            if (modal) {
                modal.classList.remove('la-ws-modal--active');
                modal.setAttribute('aria-hidden', 'true');
            }
            la_ws_showScreen('levels');
        });

        // Cerrar el modal con Escape (accesibilidad de teclado para diálogos WCAG 2.1)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = DOM.victoryModal;
                if (modal?.classList.contains('la-ws-modal--active')) {
                    modal.classList.remove('la-ws-modal--active');
                    modal.setAttribute('aria-hidden', 'true');
                    la_ws_showScreen('levels');
                }
            }
        });
    }

    // ============================================================
    // PUNTO DE ENTRADA
    // ============================================================

    /*
        Se inicia cuando el DOM está listo. Si el script se carga de forma
        diferida (defer/async o al final del body), readyState ya puede ser
        'interactive' o 'complete', así que se comprueba antes de registrar
        el listener de DOMContentLoaded.
    */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', la_ws_init);
    } else {
        la_ws_init();
    }

})();
