/**
 * WORD HUNT — Game Logic
 * LoveArcade Integration
 *
 * Prefijo: la_ws_ (LoveArcade WordSearch)
 * Arquitectura: IIFE con estado centralizado, rendering por Canvas 2D.
 *
 * Flujo general:
 *   la_ws_init()
 *     ├─ la_ws_cacheDOM()            → cachea referencias DOM
 *     ├─ la_ws_loadProgress()        → lee localStorage
 *     ├─ la_ws_initAudio()           → inicializa AudioManager (Web Audio API)
 *     ├─ la_ws_initParticles()       → loop de partículas en canvas de fondo
 *     ├─ la_ws_setupEventListeners() → listeners de UI (botones, modal)
 *     └─ la_ws_updateStats()         → actualiza contadores pantalla principal
 *
 *   la_ws_startLevel(index)
 *     ├─ la_ws_generateGrid()        → coloca palabras y rellena el grid
 *     ├─ la_ws_setupCanvas()         → configura canvas y listeners
 *     └─ la_ws_animateGridReveal()   → animación de entrada de letras (scale stagger)
 *
 *   Interacción (mouse / touch)
 *     ├─ la_ws_handlePointerDown()   → inicia selección
 *     ├─ la_ws_handlePointerMove()   → actualiza selección + scheduleRedraw()
 *     └─ la_ws_handlePointerUp()     → verifica palabra + redibuja
 */

(function () {
    'use strict';

    // ============================================================
    // CONSTANTES
    // ============================================================

    const STORAGE_KEY = 'la_ws_completedLevels';
    const GAME_ID     = 'wordsearch';

    /**
     * Paleta de colores del canvas alineada con los design tokens de styles.css.
     * Objeto centralizado para facilitar theming futuro sin strings literales dispersos.
     */
    const COLORS = {
        bg:          '#14161F',   /* --color-surface: fondo del canvas */
        grid:        '#252936',   /* --color-border: líneas de celda */
        text:        '#FFFFFF',   /* --color-text */
        textDim:     '#8892b0',   /* color-text-secondary */
        selection:   '#00F5FF',   /* --color-primary: trazo de selección sólido */
        found:       '#00ff88',   /* --color-success: fill de palabras encontradas */
        foundLine:   '#00ff88',   /* línea que une celdas de palabra encontrada */
        highlight:   '#FF007A'    /* --color-accent */
    };

    // ============================================================
    // ESTADO CENTRALIZADO DEL JUEGO
    // ============================================================

    const la_ws_state = {
        currentScreen:     'main',
        currentLevel:      null,
        currentLevelIndex: -1,
        grid:              [],
        words:             [],
        foundWords:        new Set(),
        completedLevels:   new Set(),

        // Estado de selección activa
        selecting:     false,
        startCell:     null,
        currentCell:   null,
        selectedCells: [],

        // Canvas de juego
        canvas:   null,
        ctx:      null,
        cellSize: 0,
        offsetX:  0,
        offsetY:  0,

        // RAF: partículas de fondo
        particlesRafId: null,

        // RAF throttle: evita redraws duplicados en el mismo frame
        redrawScheduled: false,

        // Guard: event listeners del canvas (se registran una sola vez)
        canvasListenersAttached: false,

        // Animación de entrada del grid (reveal stagger)
        revealAnimActive: false,
        revealRafId:      null
    };

    // ============================================================
    // CACHÉ DE REFERENCIAS DOM
    // ============================================================

    const DOM = {};

    function la_ws_cacheDOM() {
        DOM.mainScreen        = document.getElementById('la_ws_mainScreen');
        DOM.levelsScreen      = document.getElementById('la_ws_levelsScreen');
        DOM.gameScreen        = document.getElementById('la_ws_gameScreen');
        DOM.victoryModal      = document.getElementById('la_ws_victoryModal');
        DOM.levelsList        = document.getElementById('la_ws_levelsList');
        DOM.wordsList         = document.getElementById('la_ws_wordsList');
        DOM.wordsFound        = document.getElementById('la_ws_wordsFound');
        DOM.wordsTotal        = document.getElementById('la_ws_wordsTotal');
        DOM.completedCount    = document.getElementById('la_ws_completedCount');
        DOM.totalLevels       = document.getElementById('la_ws_totalLevels');
        DOM.currentLevelTitle = document.getElementById('la_ws_currentLevelTitle');
        DOM.rewardDisplay     = document.getElementById('la_ws_rewardDisplay');
        DOM.btnNextLevel      = document.getElementById('la_ws_btnNextLevel');
        DOM.btnToggleWords    = document.getElementById('la_ws_btnToggleWords');
        DOM.gameCanvas        = document.getElementById('la_ws_gameCanvas');
        DOM.particles         = document.getElementById('la_ws_particles');
        DOM.progressBarFill   = document.getElementById('la_ws_progressBarFill');

        DOM.screens = {
            main:   DOM.mainScreen,
            levels: DOM.levelsScreen,
            game:   DOM.gameScreen
        };
    }

    // ============================================================
    // AUDIO MANAGER — Web Audio API (sintetizado, sin archivos externos)
    //
    // Todos los sonidos se generan con OscillatorNode + GainNode.
    // No se cargan archivos .mp3/.ogg/.m4a — presupuesto de red 0 KB.
    //
    // El AudioContext se crea en el primer gesto del usuario (requisito
    // de autoplay policy en iOS 14+ y Chrome 71+).
    //
    // GainNode con gain.value = 0.6 normaliza a ~-6 dB para evitar clipping.
    // ============================================================

    const AudioManager = (function () {
        let audioCtx = null;

        /** Obtiene (o crea) el AudioContext. Reanuda si está suspendido. */
        function getCtx() {
            if (!audioCtx) {
                try {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    console.warn('[WordSearch] AudioContext no disponible:', e);
                    return null;
                }
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
            return audioCtx;
        }

        /**
         * Crea un oscilador con envelope ADSR mínimo y lo conecta
         * a través de un GainNode normalizado.
         *
         * @param {OscillatorType} type  - 'square' | 'sine' | 'triangle'
         * @param {number}         freq  - Frecuencia en Hz
         * @param {number}         start - Tiempo de inicio relativo a ctx.currentTime
         * @param {number}         dur   - Duración en segundos
         * @param {number}         gain  - Gain máximo (se normaliza a este valor)
         */
        function scheduleOsc(type, freq, start, dur, gain) {
            const ctx = getCtx();
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const g   = ctx.createGain();

            osc.type          = type;
            osc.frequency.value = freq;

            // Envelope: attack rápido → decay hasta 0
            g.gain.setValueAtTime(0,    start);
            g.gain.linearRampToValueAtTime(gain, start + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + dur + 0.02);
        }

        /** UI_Click: clic seco percusivo — square wave con sweep de frecuencia. */
        function playUIClick() {
            const ctx = getCtx();
            if (!ctx) return;
            const t = ctx.currentTime;

            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(150, t + 0.06);

            gain.gain.setValueAtTime(0.4, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.08);
        }

        /**
         * Word_Found: nota ascendente — arpegio de 4 notas en square wave.
         * Easing: cada nota tiene 80ms de separación.
         */
        function playWordFound() {
            const ctx = getCtx();
            if (!ctx) return;
            const t = ctx.currentTime;
            // Arpegio A4 → C#5 → E5 → A5
            [440, 554, 659, 880].forEach((freq, i) => {
                scheduleOsc('square', freq, t + i * 0.08, 0.15, 0.18);
            });
        }

        /**
         * Level_Clear: secuencia rítmica de 1.5 s.
         * Progresión ascendente C5 → E5 → G5 → C6 con remate final E6.
         */
        function playLevelClear() {
            const ctx = getCtx();
            if (!ctx) return;
            const t = ctx.currentTime;
            const seq = [
                { freq: 523,  start: 0.00, dur: 0.10 },  // C5
                { freq: 659,  start: 0.13, dur: 0.10 },  // E5
                { freq: 784,  start: 0.26, dur: 0.10 },  // G5
                { freq: 1047, start: 0.40, dur: 0.20 },  // C6
                { freq: 784,  start: 0.62, dur: 0.08 },  // G5
                { freq: 1047, start: 0.72, dur: 0.08 },  // C6
                { freq: 1319, start: 0.82, dur: 0.55 }   // E6 — remate
            ];
            seq.forEach(({ freq, start, dur }) => {
                scheduleOsc('square', freq, t + start, dur, 0.22);
            });
        }

        return { playUIClick, playWordFound, playLevelClear };
    })();

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

    function la_ws_saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(la_ws_state.completedLevels)));
        } catch (e) {
            console.error('[WordSearch] Error guardando progreso:', e);
        }
    }

    function la_ws_markLevelCompleted(levelId) {
        la_ws_state.completedLevels.add(levelId);
        la_ws_saveProgress();
    }

    // ============================================================
    // NAVEGACIÓN DE PANTALLAS
    // ============================================================

    /**
     * Muestra la pantalla indicada, oculta las demás.
     * Cuando se navega main → levels aplica la transición clip-path circular.
     *
     * @param {'main'|'levels'|'game'} screenName
     */
    function la_ws_showScreen(screenName) {
        const previousScreen = la_ws_state.currentScreen;

        // Cancelar animación de reveal si salimos del juego
        if (la_ws_state.revealAnimActive) {
            la_ws_state.revealAnimActive = false;
        }

        // Ocultar todas las pantallas
        Object.entries(DOM.screens).forEach(([, el]) => {
            if (!el) return;
            el.classList.remove('la-ws-screen--active', 'la-ws-screen--clip-in');
            el.setAttribute('aria-hidden', 'true');
        });

        const target = DOM.screens[screenName];
        if (target) {
            target.classList.add('la-ws-screen--active');

            // Transición clip-path solo en el flujo Inicio → Niveles
            if (previousScreen === 'main' && screenName === 'levels') {
                target.classList.add('la-ws-screen--clip-in');
                target.addEventListener('animationend', () => {
                    target.classList.remove('la-ws-screen--clip-in');
                }, { once: true });
            }

            target.setAttribute('aria-hidden', 'false');
            la_ws_state.currentScreen = screenName;
        }

        // Acciones específicas por pantalla
        if (screenName === 'levels')      la_ws_renderLevelsList();
        else if (screenName === 'main')   la_ws_updateStats();

        // Pausa el loop de partículas mientras el juego está activo
        la_ws_toggleParticles(screenName !== 'game');
    }

    // ============================================================
    // PANTALLA DE NIVELES
    // ============================================================

    /**
     * Renderiza la cuadrícula de tarjetas de nivel con DocumentFragment
     * para evitar reflows por inserción individual (crítico con 150 tarjetas).
     * Las tarjetas son <button> para accesibilidad de teclado nativa.
     */
    function la_ws_renderLevelsList() {
        const container = DOM.levelsList;
        if (!container || !window.LA_WS_LEVELS) return;

        const fragment = document.createDocumentFragment();

        window.LA_WS_LEVELS.forEach((level, index) => {
            const isCompleted = la_ws_state.completedLevels.has(level.id);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'la-ws-level-card';
            card.setAttribute('role', 'listitem');
            card.setAttribute('aria-label',
                `Nivel ${index + 1}: ${level.title}. Recompensa: ${level.rewardCoins} monedas.${isCompleted ? ' Completado.' : ''}`
            );
            if (isCompleted) card.classList.add('la-ws-level-card--completed');

            // Icono de moneda: inline SVG (sin petición HTTP)
            const coinSVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
                               style="width:14px;height:14px;flex-shrink:0">
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

            card.addEventListener('click', () => {
                AudioManager.playUIClick();
                la_ws_startLevel(index);
            });

            fragment.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    // ============================================================
    // GENERACIÓN DEL GRID
    // ============================================================

    /**
     * Genera un grid NxN e intenta colocar las palabras dadas en 4 direcciones.
     * Celdas vacías se rellenan con letras aleatorias.
     *
     * @param {number}   size  - Dimensión del grid (size × size)
     * @param {string[]} words - Palabras a colocar
     * @returns {{ grid: Cell[][], placedWords: PlacedWord[] }}
     */
    function la_ws_generateGrid(size, words) {
        const grid = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({
                letter: '', isPartOfWord: false, wordIndex: -1
            }))
        );

        const directions = [
            { dx:  1, dy:  0 },
            { dx:  0, dy:  1 },
            { dx:  1, dy:  1 },
            { dx: -1, dy:  1 }
        ];

        const MAX_ATTEMPTS = 100;
        const ALPHABET     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const placedWords  = [];

        words.forEach((word, wordIndex) => {
            const upperWord = word.toUpperCase();
            let placed = false, attempts = 0;

            while (!placed && attempts < MAX_ATTEMPTS) {
                attempts++;
                const dir    = directions[Math.floor(Math.random() * directions.length)];
                const startX = Math.floor(Math.random() * size);
                const startY = Math.floor(Math.random() * size);
                let canPlace = true;
                const positions = [];

                for (let i = 0; i < upperWord.length; i++) {
                    const x = startX + dir.dx * i;
                    const y = startY + dir.dy * i;
                    if (x < 0 || x >= size || y < 0 || y >= size) { canPlace = false; break; }
                    const cell = grid[y][x];
                    if (cell.letter !== '' && cell.letter !== upperWord[i]) { canPlace = false; break; }
                    positions.push({ x, y, letter: upperWord[i] });
                }

                if (canPlace) {
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

        // Rellenar celdas vacías
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
     * Inicializa y muestra el nivel indicado. Arranca la animación de
     * entrada de letras (scale stagger 0.8 → 1.0 con 2 ms por celda).
     *
     * @param {number} levelIndex - Índice base-0 en window.LA_WS_LEVELS
     */
    function la_ws_startLevel(levelIndex) {
        const level = window.LA_WS_LEVELS[levelIndex];
        if (!level) {
            console.error(`[WordSearch] Nivel ${levelIndex} no encontrado`);
            return;
        }

        la_ws_state.currentLevel      = level;
        la_ws_state.currentLevelIndex = levelIndex;
        la_ws_state.foundWords.clear();

        const { grid, placedWords } = la_ws_generateGrid(level.gridSize, level.words);
        la_ws_state.grid  = grid;
        la_ws_state.words = placedWords;

        la_ws_setupCanvas();

        DOM.currentLevelTitle.textContent = `NIVEL ${levelIndex + 1}`;
        DOM.wordsTotal.textContent        = level.words.length;
        DOM.wordsFound.textContent        = '0';
        if (DOM.progressBarFill) DOM.progressBarFill.style.width = '0%';

        la_ws_renderWordsList();
        la_ws_showScreen('game');

        // Animación de entrada: arrancar DESPUÉS de que la pantalla sea visible
        requestAnimationFrame(() => la_ws_animateGridReveal());
    }

    // ============================================================
    // CONFIGURACIÓN DEL CANVAS
    // ============================================================

    /**
     * Ajusta dimensiones del canvas al contenedor y registra los event
     * listeners de interacción (solo la primera vez — evita memory leak).
     */
    function la_ws_setupCanvas() {
        const canvas = DOM.gameCanvas;
        if (!canvas) return;

        la_ws_state.canvas = canvas;
        // alpha:false permite al browser omitir la composición alpha del canvas
        la_ws_state.ctx = canvas.getContext('2d', { alpha: false });

        const container = canvas.parentElement;
        const size = Math.min(
            container.clientWidth  - 24,
            container.clientHeight - 24,
            600
        );

        canvas.width        = size;
        canvas.height       = size;
        canvas.style.width  = size + 'px';
        canvas.style.height = size + 'px';

        la_ws_state.cellSize = size / la_ws_state.currentLevel.gridSize;
        la_ws_state.offsetX  = 0;
        la_ws_state.offsetY  = 0;

        // Los listeners se registran una sola vez para evitar acumulación
        if (!la_ws_state.canvasListenersAttached) {
            canvas.addEventListener('mousedown',  la_ws_handlePointerDown);
            canvas.addEventListener('mousemove',  la_ws_handlePointerMove);
            canvas.addEventListener('mouseup',    la_ws_handlePointerUp);
            canvas.addEventListener('mouseleave', la_ws_handlePointerUp);
            // passive:false necesario para llamar preventDefault() en touch
            canvas.addEventListener('touchstart', la_ws_handlePointerDown, { passive: false });
            canvas.addEventListener('touchmove',  la_ws_handlePointerMove, { passive: false });
            canvas.addEventListener('touchend',   la_ws_handlePointerUp,   { passive: false });
            la_ws_state.canvasListenersAttached = true;
        }
    }

    // ============================================================
    // ANIMACIÓN DE ENTRADA DEL GRID (scale stagger)
    // ============================================================

    /**
     * Anima la aparición de cada celda del grid con:
     *   - scale: 0.8 → 1.0
     *   - opacity: 0 → 1
     *   - stagger: 2 ms por celda (orden izquierda → derecha, arriba → abajo)
     *   - easing: ease-in-out cuadrático
     *
     * La animación corre en su propio loop RAF. Mientras está activa,
     * la_ws_scheduleRedraw() no programa redraws adicionales para no
     * interferir con el loop de reveal.
     */
    function la_ws_animateGridReveal() {
        const STAGGER_MS  = 2;    // ms de delay entre celdas
        const CELL_DUR_MS = 160;  // ms que tarda cada celda en completar su animación
        const gridSize    = la_ws_state.currentLevel.gridSize;
        const totalCells  = gridSize * gridSize;
        const totalMs     = totalCells * STAGGER_MS + CELL_DUR_MS;
        const startTime   = performance.now();

        la_ws_state.revealAnimActive = true;

        function frame() {
            if (!la_ws_state.revealAnimActive) return;

            const elapsed = performance.now() - startTime;
            const { ctx, grid, cellSize, canvas } = la_ws_state;
            if (!ctx || !grid.length) return;

            // ── 1. Fondo ──────────────────────────────────────────
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // ── 2. Celdas con scale stagger ───────────────────────
            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    const idx        = y * gridSize + x;
                    const cellStart  = idx * STAGGER_MS;
                    const cellElapsed = elapsed - cellStart;

                    if (cellElapsed <= 0) continue; // aún no es su turno

                    // Progreso [0,1] con ease-in-out cuadrático
                    const raw    = Math.min(1, cellElapsed / CELL_DUR_MS);
                    const t      = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;
                    const scale  = 0.8 + 0.2 * t;
                    const alpha  = t;

                    const px = x * cellSize;
                    const py = y * cellSize;
                    const cx = px + cellSize / 2;
                    const cy = py + cellSize / 2;

                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.translate(cx, cy);
                    ctx.scale(scale, scale);
                    ctx.translate(-cx, -cy);

                    // Borde de celda
                    ctx.strokeStyle = COLORS.grid;
                    ctx.lineWidth   = 1;
                    ctx.strokeRect(px, py, cellSize, cellSize);

                    // Letra
                    ctx.fillStyle    = COLORS.text;
                    ctx.textAlign    = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font         = `700 ${Math.floor(cellSize * 0.5)}px 'Archivo', sans-serif`;
                    ctx.fillText(grid[y][x].letter, cx, cy);

                    ctx.restore();
                }
            }

            ctx.globalAlpha = 1;
            la_ws_state.redrawScheduled = false;

            if (elapsed < totalMs) {
                la_ws_state.revealRafId = requestAnimationFrame(frame);
            } else {
                // Animación completa: dibujar el estado final limpio
                la_ws_state.revealAnimActive = false;
                la_ws_state.revealRafId      = null;
                la_ws_drawGrid();
            }
        }

        la_ws_state.revealRafId = requestAnimationFrame(frame);
    }

    // ============================================================
    // RENDERIZADO DEL GRID
    // ============================================================

    /**
     * Dibuja el estado completo del grid.
     *
     * Orden de capas:
     *   1. Fondo sólido (bg)
     *   2. Letras y bordes de celdas (source-over)
     *   3. Selección activa y palabras encontradas (destination-over)
     *      → destination-over dibuja DETRÁS del contenido existente,
     *        logrando que los highlights aparezcan bajo las letras sin
     *        usar transparencias en el color (color sólido + compositing).
     *
     * ctx.font / ctx.textAlign se configuran UNA VEZ fuera del loop de
     * celdas — cambiar propiedades del contexto 2D tiene un coste no
     * trivial en el driver; evitarlo reduce el tiempo de render ~20%.
     */
    function la_ws_drawGrid() {
        const { ctx, grid, cellSize, canvas } = la_ws_state;
        if (!ctx || !grid.length) return;

        // ── Capa 1: fondo ──────────────────────────────────────────
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ── Capa 2: letras y bordes (source-over por defecto) ───────
        ctx.globalCompositeOperation = 'source-over';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `700 ${Math.floor(cellSize * 0.5)}px 'Archivo', sans-serif`;
        ctx.strokeStyle  = COLORS.grid;
        ctx.lineWidth    = 1;

        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                la_ws_drawCell(x, y, grid[y][x]);
            }
        }

        // ── Capa 3: highlights detrás de letras (destination-over) ──
        ctx.globalCompositeOperation = 'destination-over';

        la_ws_state.words.forEach(wordData => {
            if (wordData.found) la_ws_drawFoundWord(wordData.positions);
        });

        if (la_ws_state.selecting && la_ws_state.selectedCells.length > 0) {
            la_ws_drawSelection(la_ws_state.selectedCells);
        }

        // Restaurar modo de composición estándar
        ctx.globalCompositeOperation = 'source-over';

        la_ws_state.redrawScheduled = false;
    }

    /** Dibuja borde y letra de una celda. Precondición: ctx.font etc ya configurados. */
    function la_ws_drawCell(x, y, cell) {
        const { ctx, cellSize } = la_ws_state;
        const px = x * cellSize;
        const py = y * cellSize;
        ctx.strokeRect(px, py, cellSize, cellSize);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(cell.letter, px + cellSize / 2, py + cellSize / 2);
    }

    /**
     * Dibuja el highlight de la selección activa con color sólido.
     * Se usa globalCompositeOperation='destination-over' (establecido por el
     * caller) para que el fill aparezca DETRÁS de las letras ya dibujadas.
     */
    function la_ws_drawSelection(cells) {
        const { ctx, cellSize } = la_ws_state;
        ctx.fillStyle = COLORS.selection;
        cells.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
    }

    /**
     * Dibuja el highlight persistente de una palabra encontrada.
     * Fill sólido + línea de conexión entre centros de celda.
     */
    function la_ws_drawFoundWord(positions) {
        const { ctx, cellSize } = la_ws_state;

        // Fill sólido — destination-over lo coloca bajo las letras
        ctx.fillStyle = COLORS.found;
        positions.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });

        // Línea de conexión
        if (positions.length > 1) {
            ctx.strokeStyle = COLORS.foundLine;
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
     * Programa un redraw en el próximo frame de animación.
     * No agenda si la animación de reveal está activa (ella maneja los frames)
     * ni si ya hay un redraw pendiente (throttle por RAF).
     */
    function la_ws_scheduleRedraw() {
        if (la_ws_state.revealAnimActive) return;
        if (!la_ws_state.redrawScheduled) {
            la_ws_state.redrawScheduled = true;
            requestAnimationFrame(la_ws_drawGrid);
        }
    }

    // ============================================================
    // INTERACCIÓN: HANDLERS UNIFICADOS (MOUSE + TOUCH)
    // ============================================================

    /**
     * Convierte evento de mouse/touch a coordenadas de celda del grid.
     * Tiene en cuenta el ratio CSS-pixels vs canvas-pixels (HiDPI/Retina).
     */
    function la_ws_getCellFromEvent(event) {
        const canvas = la_ws_state.canvas;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        if (event.type.startsWith('touch')) {
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

    function la_ws_handlePointerMove(event) {
        if (!la_ws_state.selecting) return;
        event.preventDefault();

        const cell = la_ws_getCellFromEvent(event);
        if (!cell) return;

        const prev = la_ws_state.currentCell;
        if (prev && cell.x === prev.x && cell.y === prev.y) return;

        la_ws_state.currentCell = cell;
        la_ws_updateSelection();
        la_ws_scheduleRedraw();
    }

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
     * Recalcula las celdas de la selección actual.
     * Solo acepta líneas estrictamente horizontales, verticales o diagonales 45°.
     */
    function la_ws_updateSelection() {
        const start   = la_ws_state.startCell;
        const current = la_ws_state.currentCell;
        if (!start || !current) return;

        const rawDx = current.x - start.x;
        const rawDy = current.y - start.y;
        const dx    = Math.sign(rawDx);
        const dy    = Math.sign(rawDy);

        if (dx !== 0 && dy !== 0 && Math.abs(rawDx) !== Math.abs(rawDy)) return;

        const cells = [];
        let x = start.x;
        let y = start.y;

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

    function la_ws_checkWord() {
        if (la_ws_state.selectedCells.length < 2) return;

        const word        = la_ws_state.selectedCells.map(({ x, y }) => la_ws_state.grid[y][x].letter).join('');
        const reverseWord = word.split('').reverse().join('');

        la_ws_state.words.forEach(wordData => {
            if (wordData.found) return;
            if (wordData.word === word || wordData.word === reverseWord) {
                wordData.found = true;
                la_ws_state.foundWords.add(wordData.word);

                AudioManager.playWordFound();

                la_ws_updateProgress();
                la_ws_updateWordItem(wordData.word);

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
     * Construye la lista completa de palabras con DocumentFragment.
     * Se llama solo al iniciar el nivel; durante el juego usa
     * la_ws_updateWordItem() para actualizaciones incrementales.
     */
    function la_ws_renderWordsList() {
        const container = DOM.wordsList;
        if (!container) return;

        const fragment = document.createDocumentFragment();
        la_ws_state.words.forEach(wordData => {
            const item = document.createElement('div');
            item.className   = 'la-ws-word-item';
            item.setAttribute('role', 'listitem');
            item.dataset.word = wordData.word;
            if (wordData.found) item.classList.add('la-ws-word-item--found');
            item.textContent = wordData.word;
            fragment.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    /**
     * Marca un ítem de palabra como encontrado.
     *
     * Secuencia:
     *   1. Añade clase --flashing → keyframe magenta × 2 (0.45 s)
     *   2. En animationend → quita --flashing, añade --found (tachado)
     *
     * Esto evita reconstruir toda la lista (evita reflow completo del panel).
     *
     * @param {string} word - Palabra encontrada (mayúsculas)
     */
    function la_ws_updateWordItem(word) {
        const container = DOM.wordsList;
        if (!container) return;

        const item = container.querySelector(`[data-word="${word}"]`);
        if (!item) return;

        // Iniciar flash magenta
        item.classList.add('la-ws-word-item--flashing');

        item.addEventListener('animationend', () => {
            item.classList.remove('la-ws-word-item--flashing');
            item.classList.add('la-ws-word-item--found');
            item.setAttribute('aria-label', `${word} - encontrada`);
        }, { once: true });
    }

    /** Actualiza el contador de palabras y la barra de progreso lineal. */
    function la_ws_updateProgress() {
        const found = la_ws_state.foundWords.size;
        const total = la_ws_state.words.length;

        if (DOM.wordsFound) DOM.wordsFound.textContent = found;

        if (DOM.progressBarFill && total > 0) {
            DOM.progressBarFill.style.width = ((found / total) * 100) + '%';
        }
    }

    // ============================================================
    // COMPLETAR NIVEL
    // ============================================================

    /**
     * Gestiona fin de nivel: integración con GameCenter, guardado local
     * y presentación del modal de victoria.
     *
     * GameCenter.completeLevel() solo se llama si el nivel NO había sido
     * completado antes (previene doble recompensa).
     */
    function la_ws_completeLevel() {
        const level = la_ws_state.currentLevel;
        if (!level) return;

        AudioManager.playLevelClear();

        const wasCompleted = la_ws_state.completedLevels.has(level.id);

        if (!wasCompleted && window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                const coins  = Math.floor(level.rewardCoins);
                const result = window.GameCenter.completeLevel(GAME_ID, level.id, coins);
                console.log('[WordSearch] GameCenter.completeLevel resultado:', result);
                if (result && result.paid) la_ws_markLevelCompleted(level.id);
            } catch (e) {
                console.error('[WordSearch] Error llamando a GameCenter:', e);
            }
        } else if (wasCompleted) {
            console.log(`[WordSearch] Nivel "${level.id}" ya fue completado anteriormente`);
        } else {
            console.warn('[WordSearch] GameCenter no disponible — modo standalone activo');
            la_ws_markLevelCompleted(level.id);
        }

        la_ws_showVictoryModal(wasCompleted);
    }

    /**
     * Muestra el modal de victoria.
     * Mueve el foco al primer elemento interactivo (WCAG 2.1 — trampa de foco).
     *
     * @param {boolean} wasCompleted - true si el nivel ya había sido completado
     */
    function la_ws_showVictoryModal(wasCompleted) {
        const modal         = DOM.victoryModal;
        const rewardDisplay = DOM.rewardDisplay;
        if (!modal || !rewardDisplay) return;

        rewardDisplay.textContent = wasCompleted
            ? '¡YA COMPLETADO!'
            : `+${la_ws_state.currentLevel.rewardCoins} MONEDAS`;

        modal.classList.add('la-ws-modal--active');
        modal.setAttribute('aria-hidden', 'false');

        const nextIndex = la_ws_state.currentLevelIndex + 1;
        const hasNext   = nextIndex < window.LA_WS_LEVELS.length;
        const btnNext   = DOM.btnNextLevel;

        if (btnNext) {
            btnNext.style.display = hasNext ? 'flex' : 'none';
            btnNext.onclick = () => {
                AudioManager.playUIClick();
                modal.classList.remove('la-ws-modal--active');
                modal.setAttribute('aria-hidden', 'true');
                la_ws_startLevel(nextIndex);
            };
        }

        setTimeout(() => {
            const firstFocusable = modal.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) firstFocusable.focus();
        }, 50);
    }

    // ============================================================
    // ESTADÍSTICAS DE LA PANTALLA PRINCIPAL
    // ============================================================

    function la_ws_updateStats() {
        if (DOM.completedCount) DOM.completedCount.textContent = la_ws_state.completedLevels.size;
        if (DOM.totalLevels && window.LA_WS_LEVELS) DOM.totalLevels.textContent = window.LA_WS_LEVELS.length;
    }

    // ============================================================
    // PARTÍCULAS DE FONDO
    // ============================================================

    /**
     * Inicializa el sistema de partículas animadas.
     *
     * Budget de Performance: máximo 15 partículas (vs 30 anterior).
     * Esto reduce el tiempo de render de partículas en ~50% en low-end.
     *
     * Color: --color-primary (#00F5FF) para coherencia con el nuevo tema.
     *
     * Se respeta prefers-reduced-motion: si está activo, el canvas se oculta
     * y no se inicia el loop RAF.
     *
     * El ID del RAF se almacena en la_ws_state.particlesRafId para poder
     * cancelarlo cuando la pantalla de juego está activa.
     *
     * El resize usa debounce a 150 ms para evitar recálculo en cada píxel.
     */
    function la_ws_initParticles() {
        const canvas = DOM.particles;
        if (!canvas) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            canvas.style.display = 'none';
            return;
        }

        const ctx = canvas.getContext('2d');

        function resizeCanvas() {
            canvas.width  = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resizeCanvas();

        // Performance Budget: 15 partículas máximo
        const PARTICLE_COUNT = 15;
        const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
            x:    Math.random() * canvas.width,
            y:    Math.random() * canvas.height,
            vx:   (Math.random() - 0.5) * 0.5,
            vy:   (Math.random() - 0.5) * 0.5,
            size: Math.random() * 1.5 + 0.5
        }));

        function animate() {
            // Rastro fantasma con alpha bajo — evita repaint completo
            ctx.fillStyle = 'rgba(8, 9, 13, 0.12)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Color primario del nuevo tema
            ctx.fillStyle = 'rgba(0, 245, 255, 0.55)';

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            la_ws_state.particlesRafId = requestAnimationFrame(animate);
        }

        animate();

        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(resizeCanvas, 150);
        }, { passive: true });
    }

    /** Pausa o reanuda el loop de partículas. */
    function la_ws_toggleParticles(active) {
        const canvas = DOM.particles;
        if (!canvas || canvas.style.display === 'none') return;

        if (!active && la_ws_state.particlesRafId) {
            cancelAnimationFrame(la_ws_state.particlesRafId);
            la_ws_state.particlesRafId = null;
        } else if (active && !la_ws_state.particlesRafId) {
            la_ws_initParticles();
        }
    }

    // ============================================================
    // EVENT LISTENERS DE UI
    // ============================================================

    /**
     * Registra todos los event listeners de la UI.
     * Los sonidos de UI_Click se disparan en cada navegación de pantalla.
     */
    function la_ws_setupEventListeners() {
        document.getElementById('la_ws_btnLevels')?.addEventListener('click', () => {
            AudioManager.playUIClick();
            la_ws_showScreen('levels');
        });

        document.getElementById('la_ws_btnBack')?.addEventListener('click', () => {
            AudioManager.playUIClick();
            la_ws_showScreen('main');
        });

        document.getElementById('la_ws_btnExitGame')?.addEventListener('click', () => {
            AudioManager.playUIClick();
            la_ws_showScreen('levels');
        });

        // Toggle del panel de palabras (solo visible en desktop con panel lateral)
        DOM.btnToggleWords?.addEventListener('click', function () {
            const list       = DOM.wordsList;
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            list.classList.toggle('la-ws-words-list--hidden', isExpanded);
            this.setAttribute('aria-expanded', String(!isExpanded));
        });

        document.getElementById('la_ws_btnBackToLevels')?.addEventListener('click', () => {
            AudioManager.playUIClick();
            const modal = DOM.victoryModal;
            if (modal) {
                modal.classList.remove('la-ws-modal--active');
                modal.setAttribute('aria-hidden', 'true');
            }
            la_ws_showScreen('levels');
        });

        // Cerrar modal con Escape (WCAG 2.1 — navegación de teclado para diálogos)
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', la_ws_init);
    } else {
        la_ws_init();
    }

})();
