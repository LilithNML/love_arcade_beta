/**
 * WORD HUNT — Game Logic
 * LoveArcade Integration
 * Prefijo: la_ws_
 *
 * CORRECCIONES v2:
 *  - Canvas: orden correcto de capas (highlights ANTES de letras, todo source-over).
 *            El uso de destination-over anterior era incorrecto porque alpha:false
 *            hace el canvas opaco, por lo que destination-over no dibujaba nada.
 *  - Audio:  Ondas triangle/sine a gain 0.06 — no square, no ruidoso.
 *  - Layout: setupCanvas mide el contenedor real despues de que el layout termino.
 *  - Niveles: auto-scroll al primer nivel incompleto + boton Continuar en main.
 */

(function () {
    'use strict';

    const STORAGE_KEY = 'la_ws_completedLevels';
    const GAME_ID     = 'wordsearch';

    /*
     * Paleta del canvas. Alineada con design tokens de styles.css.
     * BUG FIX: COLORS.selection ahora es semitransparente para que las
     * letras se lean sobre el highlight. El trazo (linea) que conecta
     * las celdas sigue siendo solido (#00F5FF) segun el brief.
     */
    const COLORS = {
        bg:            '#14161F',          /* --color-surface */
        grid:          '#252936',          /* --color-border  */
        text:          '#FFFFFF',
        textDim:       '#8892b0',
        selectionFill: 'rgba(0,245,255,0.22)',  /* fill semitransparente */
        selectionLine: '#00F5FF',               /* trazo solido — brief */
        foundFill:     'rgba(0,255,136,0.28)',
        foundLine:     '#00ff88',
        highlight:     '#FF007A'
    };

    // ============================================================
    // ESTADO CENTRALIZADO
    // ============================================================
    const la_ws_state = {
        currentScreen:     'main',
        currentLevel:      null,
        currentLevelIndex: -1,
        grid:              [],
        words:             [],
        foundWords:        new Set(),
        completedLevels:   new Set(),

        selecting:     false,
        startCell:     null,
        currentCell:   null,
        selectedCells: [],

        canvas:   null,
        ctx:      null,
        cellSize: 0,

        particlesRafId:           null,
        redrawScheduled:          false,
        canvasListenersAttached:  false,
        revealAnimActive:         false,
        revealRafId:              null
    };

    // ============================================================
    // CACHE DOM
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
        DOM.btnContinue       = document.getElementById('la_ws_btnContinue');
        DOM.continueBadge     = document.getElementById('la_ws_continueBadge');

        DOM.screens = {
            main:   DOM.mainScreen,
            levels: DOM.levelsScreen,
            game:   DOM.gameScreen
        };
    }

    // ============================================================
    // AUDIO MANAGER — Web Audio API sintetizado (0 KB de archivos)
    //
    // BUG FIX: Reemplaza square waves (muy agresivas) por triangle/sine.
    // Gain reducido a 0.06 (~-24 dB) para no molestar al usuario.
    // El AudioContext se crea lazy (primer gesto) para cumplir autoplay policy.
    // ============================================================
    const AudioManager = (function () {
        let ctx = null;

        function getCtx() {
            if (!ctx) {
                try {
                    ctx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) {
                    return null;
                }
            }
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
            return ctx;
        }

        /*
         * Genera un tono corto con envelope suave.
         * type: 'sine' | 'triangle'  (evitamos square/sawtooth — demasiado agresivas)
         * gain maximo: 0.06 (~-24 dB) para ser discreto
         */
        function tone(type, freq, startOffset, dur) {
            const c = getCtx();
            if (!c) return;
            const t   = c.currentTime + startOffset;
            const osc = c.createOscillator();
            const g   = c.createGain();

            osc.type            = type;
            osc.frequency.value = freq;

            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.06, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

            osc.connect(g);
            g.connect(c.destination);
            osc.start(t);
            osc.stop(t + dur + 0.02);
        }

        /* Clic suave — sine muy corto */
        function playUIClick() {
            tone('sine', 880, 0, 0.06);
        }

        /* Palabra encontrada — arpegio pentatonico ascendente, triangle */
        function playWordFound() {
            // Pentatonica: A4 C#5 E5 A5
            [440, 554, 659, 880].forEach((f, i) => {
                tone('triangle', f, i * 0.07, 0.12);
            });
        }

        /* Nivel completado — acorde suave de 3 notas, sine */
        function playLevelClear() {
            [523, 659, 784].forEach((f, i) => {
                tone('sine', f, i * 0.12, 0.5);
            });
            // Remate
            tone('sine', 1047, 0.45, 0.7);
        }

        return { playUIClick, playWordFound, playLevelClear };
    })();

    // ============================================================
    // INICIALIZACION
    // ============================================================
    function la_ws_init() {
        console.log('[WordSearch] Inicializando...');
        la_ws_cacheDOM();
        la_ws_loadProgress();
        la_ws_initParticles();
        la_ws_setupEventListeners();
        la_ws_updateStats();
        console.log('[WordSearch] Listo');
    }

    // ============================================================
    // PROGRESO
    // ============================================================
    function la_ws_loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                la_ws_state.completedLevels = new Set(JSON.parse(saved));
                console.log(`[WordSearch] ${la_ws_state.completedLevels.size} niveles completados`);
            }
        } catch (e) { console.error('[WordSearch] Error cargando progreso:', e); }
    }

    function la_ws_saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...la_ws_state.completedLevels]));
        } catch (e) { console.error('[WordSearch] Error guardando progreso:', e); }
    }

    function la_ws_markLevelCompleted(id) {
        la_ws_state.completedLevels.add(id);
        la_ws_saveProgress();
    }

    /** Devuelve el indice del primer nivel no completado, o -1 si todos completados. */
    function la_ws_getNextLevelIndex() {
        if (!window.LA_WS_LEVELS) return -1;
        for (let i = 0; i < window.LA_WS_LEVELS.length; i++) {
            if (!la_ws_state.completedLevels.has(window.LA_WS_LEVELS[i].id)) return i;
        }
        return -1;
    }

    // ============================================================
    // NAVEGACION DE PANTALLAS
    // ============================================================
    function la_ws_showScreen(name) {
        const prev = la_ws_state.currentScreen;
        if (la_ws_state.revealAnimActive) la_ws_state.revealAnimActive = false;

        Object.values(DOM.screens).forEach(el => {
            if (!el) return;
            el.classList.remove('la-ws-screen--active', 'la-ws-screen--clip-in');
            el.setAttribute('aria-hidden', 'true');
        });

        const target = DOM.screens[name];
        if (target) {
            target.classList.add('la-ws-screen--active');
            // Clip-path solo en main → levels
            if (prev === 'main' && name === 'levels') {
                target.classList.add('la-ws-screen--clip-in');
                target.addEventListener('animationend', () => {
                    target.classList.remove('la-ws-screen--clip-in');
                }, { once: true });
            }
            target.setAttribute('aria-hidden', 'false');
            la_ws_state.currentScreen = name;
        }

        if (name === 'levels')  la_ws_renderLevelsList();
        if (name === 'main')    la_ws_updateStats();

        la_ws_toggleParticles(name !== 'game');
    }

    // ============================================================
    // PANTALLA DE NIVELES
    // ============================================================

    /*
     * NUEVO: auto-scroll al primer nivel no completado y resaltado --current.
     * Con 150 niveles es muy molesto buscar manualmente el nivel actual.
     */
    function la_ws_renderLevelsList() {
        const container = DOM.levelsList;
        if (!container || !window.LA_WS_LEVELS) return;

        const nextIdx  = la_ws_getNextLevelIndex();
        const fragment = document.createDocumentFragment();

        window.LA_WS_LEVELS.forEach((level, index) => {
            const isCompleted = la_ws_state.completedLevels.has(level.id);
            const isCurrent   = index === nextIdx;

            const card = document.createElement('button');
            card.type  = 'button';
            card.className = 'la-ws-level-card';
            card.setAttribute('role', 'listitem');
            card.setAttribute('aria-label',
                `Nivel ${index + 1}: ${level.title}. +${level.rewardCoins} monedas.${isCompleted ? ' Completado.' : ''}`
            );

            if (isCompleted) card.classList.add('la-ws-level-card--completed');
            if (isCurrent)   card.classList.add('la-ws-level-card--current');

            const coinSVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"
                               style="width:13px;height:13px;flex-shrink:0">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"
                        fill="currentColor" opacity="0.3"/>
            </svg>`;

            const badgeSVG = isCompleted
                ? `<svg class="la-ws-level-card__badge" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

        // Auto-scroll al nivel actual con un breve delay para que el layout este listo
        if (nextIdx > 0) {
            requestAnimationFrame(() => {
                const currentCard = container.querySelector('.la-ws-level-card--current');
                if (currentCard) {
                    currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }

    // ============================================================
    // GENERACION DEL GRID
    // ============================================================
    function la_ws_generateGrid(size, words) {
        const grid = Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({ letter: '', isPartOfWord: false, wordIndex: -1 }))
        );

        const directions = [
            { dx:  1, dy:  0 },
            { dx:  0, dy:  1 },
            { dx:  1, dy:  1 },
            { dx: -1, dy:  1 }
        ];

        const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const placed   = [];

        words.forEach((word, wi) => {
            const up = word.toUpperCase();
            let done = false, tries = 0;

            while (!done && tries < 100) {
                tries++;
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const sx  = Math.floor(Math.random() * size);
                const sy  = Math.floor(Math.random() * size);
                let ok    = true;
                const pos = [];

                for (let i = 0; i < up.length; i++) {
                    const x = sx + dir.dx * i;
                    const y = sy + dir.dy * i;
                    if (x < 0 || x >= size || y < 0 || y >= size) { ok = false; break; }
                    const c = grid[y][x];
                    if (c.letter !== '' && c.letter !== up[i]) { ok = false; break; }
                    pos.push({ x, y, letter: up[i] });
                }

                if (ok) {
                    pos.forEach(({ x, y, letter }) => {
                        grid[y][x].letter = letter;
                        grid[y][x].isPartOfWord = true;
                        grid[y][x].wordIndex = wi;
                    });
                    placed.push({ word: up, positions: pos, found: false });
                    done = true;
                }
            }

            if (!done) console.warn(`[WordSearch] No se pudo colocar: "${word}"`);
        });

        for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++)
                if (!grid[y][x].letter)
                    grid[y][x].letter = ALPHABET[Math.floor(Math.random() * 26)];

        return { grid, placedWords: placed };
    }

    // ============================================================
    // INICIO DE NIVEL
    // ============================================================
    function la_ws_startLevel(idx) {
        const level = window.LA_WS_LEVELS[idx];
        if (!level) { console.error(`[WordSearch] Nivel ${idx} no encontrado`); return; }

        la_ws_state.currentLevel      = level;
        la_ws_state.currentLevelIndex = idx;
        la_ws_state.foundWords.clear();

        const { grid, placedWords } = la_ws_generateGrid(level.gridSize, level.words);
        la_ws_state.grid  = grid;
        la_ws_state.words = placedWords;

        // Primero mostramos la pantalla para que el layout ya tenga dimensiones reales
        la_ws_showScreen('game');

        DOM.currentLevelTitle.textContent = `NIVEL ${idx + 1}`;
        DOM.wordsTotal.textContent        = level.words.length;
        DOM.wordsFound.textContent        = '0';
        if (DOM.progressBarFill) DOM.progressBarFill.style.width = '0%';

        la_ws_renderWordsList();

        // Configurar canvas DESPUES del layout (las dimensiones ya son definitivas)
        requestAnimationFrame(() => {
            la_ws_setupCanvas();
            la_ws_animateGridReveal();
        });
    }

    // ============================================================
    // CONFIGURACION DEL CANVAS
    // ============================================================
    /*
     * BUG FIX: se llama DESPUES de la_ws_showScreen() para que
     * container.clientWidth/Height ya reflejen las dimensiones reales
     * del layout. Antes se llamaba antes de mostrar la pantalla, lo que
     * devolvia 0 o dimensiones incorrectas en muchos moviles.
     */
    function la_ws_setupCanvas() {
        const canvas = DOM.gameCanvas;
        if (!canvas) return;

        la_ws_state.canvas = canvas;
        la_ws_state.ctx    = canvas.getContext('2d', { alpha: false });

        const container = canvas.parentElement; /* .la-ws-game-content */
        const size = Math.min(
            container.clientWidth  - 12,
            container.clientHeight - 12,
            560
        );

        if (size <= 0) {
            console.warn('[WordSearch] Canvas container tiene tamaño 0 — reintentando');
            setTimeout(() => { la_ws_setupCanvas(); la_ws_drawGrid(); }, 100);
            return;
        }

        canvas.width        = size;
        canvas.height       = size;
        canvas.style.width  = size + 'px';
        canvas.style.height = size + 'px';

        la_ws_state.cellSize = size / la_ws_state.currentLevel.gridSize;

        if (!la_ws_state.canvasListenersAttached) {
            canvas.addEventListener('mousedown',  la_ws_handlePointerDown);
            canvas.addEventListener('mousemove',  la_ws_handlePointerMove);
            canvas.addEventListener('mouseup',    la_ws_handlePointerUp);
            canvas.addEventListener('mouseleave', la_ws_handlePointerUp);
            canvas.addEventListener('touchstart', la_ws_handlePointerDown, { passive: false });
            canvas.addEventListener('touchmove',  la_ws_handlePointerMove, { passive: false });
            canvas.addEventListener('touchend',   la_ws_handlePointerUp,   { passive: false });
            la_ws_state.canvasListenersAttached = true;
        }
    }

    // ============================================================
    // ANIMACION DE ENTRADA DEL GRID (scale stagger)
    // ============================================================
    function la_ws_animateGridReveal() {
        const STAGGER   = 2;    /* ms por celda */
        const CELL_DUR  = 150;  /* ms de animacion por celda */
        const gridSize  = la_ws_state.currentLevel.gridSize;
        const totalCells = gridSize * gridSize;
        const totalMs   = totalCells * STAGGER + CELL_DUR;
        const t0        = performance.now();

        la_ws_state.revealAnimActive = true;

        function frame() {
            if (!la_ws_state.revealAnimActive) return;

            const elapsed = performance.now() - t0;
            const { ctx, grid, cellSize, canvas } = la_ws_state;
            if (!ctx || !grid.length) return;

            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                    const cellElapsed = elapsed - (y * gridSize + x) * STAGGER;
                    if (cellElapsed <= 0) continue;

                    const raw   = Math.min(1, cellElapsed / CELL_DUR);
                    /* ease in-out cuadratico */
                    const t     = raw < 0.5 ? 2 * raw * raw : -1 + (4 - 2 * raw) * raw;
                    const scale = 0.8 + 0.2 * t;
                    const px    = x * cellSize;
                    const py    = y * cellSize;
                    const cx    = px + cellSize / 2;
                    const cy    = py + cellSize / 2;

                    ctx.save();
                    ctx.globalAlpha = t;
                    ctx.translate(cx, cy);
                    ctx.scale(scale, scale);
                    ctx.translate(-cx, -cy);

                    ctx.strokeStyle = COLORS.grid;
                    ctx.lineWidth   = 1;
                    ctx.strokeRect(px, py, cellSize, cellSize);

                    ctx.fillStyle    = COLORS.text;
                    ctx.textAlign    = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font         = `700 ${Math.floor(cellSize * 0.48)}px 'Archivo',sans-serif`;
                    ctx.fillText(grid[y][x].letter, cx, cy);

                    ctx.restore();
                }
            }

            ctx.globalAlpha = 1;
            la_ws_state.redrawScheduled = false;

            if (elapsed < totalMs) {
                la_ws_state.revealRafId = requestAnimationFrame(frame);
            } else {
                la_ws_state.revealAnimActive = false;
                la_ws_state.revealRafId      = null;
                la_ws_drawGrid();
            }
        }

        la_ws_state.revealRafId = requestAnimationFrame(frame);
    }

    // ============================================================
    // RENDERIZADO DEL GRID
    //
    // BUG FIX CRITICO — Orden de capas correcto:
    //   1. Fondo solido
    //   2. Highlights (found + selection)  ← ANTES de las letras
    //   3. Bordes y letras                 ← ENCIMA de los highlights
    //
    // El error anterior usaba destination-over para los highlights, lo
    // que no funciona con alpha:false porque el canvas entero es opaco
    // y destination-over dibuja solo donde el destino es transparente.
    // Resultado: la seleccion era invisible.
    // ============================================================
    function la_ws_drawGrid() {
        const { ctx, grid, cellSize, canvas } = la_ws_state;
        if (!ctx || !grid.length) return;

        /* --- CAPA 1: fondo --- */
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        /* --- CAPA 2: highlights (source-over, debajo de letras) --- */
        la_ws_state.words.forEach(w => { if (w.found) la_ws_drawFoundWord(w.positions); });
        if (la_ws_state.selecting && la_ws_state.selectedCells.length > 0) {
            la_ws_drawSelection(la_ws_state.selectedCells);
        }

        /* --- CAPA 3: bordes y letras (encima) --- */
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = `700 ${Math.floor(cellSize * 0.48)}px 'Archivo',sans-serif`;
        ctx.strokeStyle  = COLORS.grid;
        ctx.lineWidth    = 1;

        for (let y = 0; y < grid.length; y++)
            for (let x = 0; x < grid[y].length; x++)
                la_ws_drawCell(x, y, grid[y][x]);

        la_ws_state.redrawScheduled = false;
    }

    function la_ws_drawCell(x, y, cell) {
        const { ctx, cellSize } = la_ws_state;
        const px = x * cellSize, py = y * cellSize;
        ctx.strokeRect(px, py, cellSize, cellSize);
        ctx.fillStyle = COLORS.text;
        ctx.fillText(cell.letter, px + cellSize / 2, py + cellSize / 2);
    }

    /*
     * Seleccion: fill semitransparente + linea solida que conecta centros.
     * El fill semitransparente es necesario para que las letras se lean.
     * El TRAZO (linea) es solido (#00F5FF) segun el brief.
     */
    function la_ws_drawSelection(cells) {
        const { ctx, cellSize } = la_ws_state;

        /* Fill semitransparente */
        ctx.fillStyle = COLORS.selectionFill;
        cells.forEach(({ x, y }) => ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize));

        /* Trazo solido entre centros */
        if (cells.length > 1) {
            ctx.strokeStyle = COLORS.selectionLine;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            const h = cellSize / 2;
            ctx.moveTo(cells[0].x * cellSize + h, cells[0].y * cellSize + h);
            for (let i = 1; i < cells.length; i++)
                ctx.lineTo(cells[i].x * cellSize + h, cells[i].y * cellSize + h);
            ctx.stroke();
        }
    }

    function la_ws_drawFoundWord(positions) {
        const { ctx, cellSize } = la_ws_state;

        ctx.fillStyle = COLORS.foundFill;
        positions.forEach(({ x, y }) => ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize));

        if (positions.length > 1) {
            ctx.strokeStyle = COLORS.foundLine;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.beginPath();
            const h = cellSize / 2;
            ctx.moveTo(positions[0].x * cellSize + h, positions[0].y * cellSize + h);
            for (let i = 1; i < positions.length; i++)
                ctx.lineTo(positions[i].x * cellSize + h, positions[i].y * cellSize + h);
            ctx.stroke();
        }
    }

    function la_ws_scheduleRedraw() {
        if (la_ws_state.revealAnimActive) return;
        if (!la_ws_state.redrawScheduled) {
            la_ws_state.redrawScheduled = true;
            requestAnimationFrame(la_ws_drawGrid);
        }
    }

    // ============================================================
    // INTERACCION: HANDLERS UNIFICADOS MOUSE + TOUCH
    // ============================================================
    function la_ws_getCellFromEvent(event) {
        const canvas = la_ws_state.canvas;
        if (!canvas) return null;
        const rect   = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;

        let cx, cy;
        if (event.type.startsWith('touch')) {
            const t = event.touches[0] || event.changedTouches[0];
            if (!t) return null;
            cx = t.clientX; cy = t.clientY;
        } else {
            cx = event.clientX; cy = event.clientY;
        }

        const x = Math.floor((cx - rect.left) * scaleX / la_ws_state.cellSize);
        const y = Math.floor((cy - rect.top)  * scaleY / la_ws_state.cellSize);
        const s = la_ws_state.grid.length;
        return (x >= 0 && x < s && y >= 0 && y < s) ? { x, y } : null;
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
        la_ws_state.selecting     = false;
        la_ws_checkWord();
        la_ws_state.selectedCells = [];
        la_ws_state.startCell     = null;
        la_ws_state.currentCell   = null;
        la_ws_scheduleRedraw();
    }

    function la_ws_updateSelection() {
        const start = la_ws_state.startCell, cur = la_ws_state.currentCell;
        if (!start || !cur) return;
        const rdx = cur.x - start.x, rdy = cur.y - start.y;
        const dx  = Math.sign(rdx),  dy  = Math.sign(rdy);
        if (dx !== 0 && dy !== 0 && Math.abs(rdx) !== Math.abs(rdy)) return;

        const cells = [];
        let x = start.x, y = start.y;
        while (true) {
            cells.push({ x, y });
            if (x === cur.x && y === cur.y) break;
            if (x !== cur.x) x += dx;
            if (y !== cur.y) y += dy;
        }
        la_ws_state.selectedCells = cells;
    }

    // ============================================================
    // VERIFICACION DE PALABRAS
    // ============================================================
    function la_ws_checkWord() {
        if (la_ws_state.selectedCells.length < 2) return;
        const word = la_ws_state.selectedCells
            .map(({ x, y }) => la_ws_state.grid[y][x].letter).join('');
        const rev  = word.split('').reverse().join('');

        la_ws_state.words.forEach(wd => {
            if (wd.found) return;
            if (wd.word === word || wd.word === rev) {
                wd.found = true;
                la_ws_state.foundWords.add(wd.word);
                AudioManager.playWordFound();
                la_ws_updateProgress();
                la_ws_updateWordItem(wd.word);
                if (la_ws_state.foundWords.size === la_ws_state.words.length)
                    setTimeout(la_ws_completeLevel, 500);
            }
        });
    }

    // ============================================================
    // UI DEL JUEGO
    // ============================================================
    function la_ws_renderWordsList() {
        const container = DOM.wordsList;
        if (!container) return;
        const frag = document.createDocumentFragment();
        la_ws_state.words.forEach(wd => {
            const item = document.createElement('div');
            item.className    = 'la-ws-word-item';
            item.setAttribute('role', 'listitem');
            item.dataset.word  = wd.word;
            if (wd.found) item.classList.add('la-ws-word-item--found');
            item.textContent   = wd.word;
            frag.appendChild(item);
        });
        container.innerHTML = '';
        container.appendChild(frag);
    }

    /*
     * Flash magenta x2 (animacion CSS), luego tachado.
     * Actualizacion incremental: no reconstruye toda la lista.
     */
    function la_ws_updateWordItem(word) {
        const item = DOM.wordsList?.querySelector(`[data-word="${word}"]`);
        if (!item) return;
        item.classList.add('la-ws-word-item--flashing');
        item.addEventListener('animationend', () => {
            item.classList.remove('la-ws-word-item--flashing');
            item.classList.add('la-ws-word-item--found');
            item.setAttribute('aria-label', `${word} - encontrada`);
        }, { once: true });
    }

    function la_ws_updateProgress() {
        const found = la_ws_state.foundWords.size;
        const total = la_ws_state.words.length;
        if (DOM.wordsFound) DOM.wordsFound.textContent = found;
        if (DOM.progressBarFill && total > 0)
            DOM.progressBarFill.style.width = ((found / total) * 100) + '%';
    }

    // ============================================================
    // COMPLETAR NIVEL
    // ============================================================
    function la_ws_completeLevel() {
        const level = la_ws_state.currentLevel;
        if (!level) return;

        AudioManager.playLevelClear();

        const was = la_ws_state.completedLevels.has(level.id);

        if (!was && window.GameCenter?.completeLevel) {
            try {
                const result = window.GameCenter.completeLevel(GAME_ID, level.id, Math.floor(level.rewardCoins));
                console.log('[WordSearch] GameCenter resultado:', result);
                if (result?.paid) la_ws_markLevelCompleted(level.id);
            } catch (e) { console.error('[WordSearch] Error GameCenter:', e); }
        } else if (was) {
            console.log(`[WordSearch] "${level.id}" ya completado`);
        } else {
            console.warn('[WordSearch] GameCenter no disponible — standalone');
            la_ws_markLevelCompleted(level.id);
        }

        la_ws_showVictoryModal(was);
    }

    function la_ws_showVictoryModal(wasCompleted) {
        const modal = DOM.victoryModal;
        if (!modal || !DOM.rewardDisplay) return;

        DOM.rewardDisplay.textContent = wasCompleted
            ? 'YA COMPLETADO'
            : `+${la_ws_state.currentLevel.rewardCoins} MONEDAS`;

        modal.classList.add('la-ws-modal--active');
        modal.setAttribute('aria-hidden', 'false');

        const nextIdx = la_ws_state.currentLevelIndex + 1;
        const hasNext = nextIdx < (window.LA_WS_LEVELS?.length ?? 0);

        if (DOM.btnNextLevel) {
            DOM.btnNextLevel.style.display = hasNext ? 'flex' : 'none';
            DOM.btnNextLevel.onclick = () => {
                AudioManager.playUIClick();
                modal.classList.remove('la-ws-modal--active');
                modal.setAttribute('aria-hidden', 'true');
                la_ws_startLevel(nextIdx);
            };
        }

        setTimeout(() => {
            const first = modal.querySelector('button,[href],[tabindex]:not([tabindex="-1"])');
            first?.focus();
        }, 50);
    }

    // ============================================================
    // ESTADISTICAS + BOTON CONTINUAR
    // ============================================================
    function la_ws_updateStats() {
        if (DOM.completedCount)
            DOM.completedCount.textContent = la_ws_state.completedLevels.size;
        if (DOM.totalLevels && window.LA_WS_LEVELS)
            DOM.totalLevels.textContent = window.LA_WS_LEVELS.length;

        /* Boton CONTINUAR: visible solo si hay niveles incompletos con progreso */
        if (DOM.btnContinue && window.LA_WS_LEVELS) {
            const nextIdx = la_ws_getNextLevelIndex();
            const hasPrev = la_ws_state.completedLevels.size > 0;

            if (nextIdx !== -1 && hasPrev) {
                DOM.btnContinue.style.display = 'flex';
                if (DOM.continueBadge)
                    DOM.continueBadge.textContent = `LVL ${nextIdx + 1}`;
                DOM.btnContinue.dataset.levelIndex = nextIdx;
            } else if (nextIdx === 0) {
                /* Sin progreso previo: ocultar (mostrar solo "TODOS LOS NIVELES") */
                DOM.btnContinue.style.display = 'none';
            } else {
                /* Todos completados */
                DOM.btnContinue.style.display = 'none';
            }
        }
    }

    // ============================================================
    // PARTICULAS DE FONDO
    // ============================================================
    function la_ws_initParticles() {
        const canvas = DOM.particles;
        if (!canvas) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            canvas.style.display = 'none';
            return;
        }

        const ctx = canvas.getContext('2d');
        function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
        resize();

        /* Performance budget: max 15 particulas */
        const pts = Array.from({ length: 15 }, () => ({
            x:    Math.random() * canvas.width,
            y:    Math.random() * canvas.height,
            vx:   (Math.random() - 0.5) * 0.45,
            vy:   (Math.random() - 0.5) * 0.45,
            size: Math.random() * 1.4 + 0.4
        }));

        function animate() {
            ctx.fillStyle = 'rgba(8,9,13,0.12)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0,245,255,0.5)';
            pts.forEach(p => {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            la_ws_state.particlesRafId = requestAnimationFrame(animate);
        }
        animate();

        let timer;
        window.addEventListener('resize', () => {
            clearTimeout(timer);
            timer = setTimeout(resize, 150);
        }, { passive: true });
    }

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
    function la_ws_setupEventListeners() {
        /* Boton CONTINUAR — salta directamente al primer nivel pendiente */
        DOM.btnContinue?.addEventListener('click', () => {
            AudioManager.playUIClick();
            const idx = parseInt(DOM.btnContinue.dataset.levelIndex ?? '-1', 10);
            if (idx >= 0) la_ws_startLevel(idx);
        });

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

        DOM.btnToggleWords?.addEventListener('click', function () {
            const list = DOM.wordsList;
            const expanded = this.getAttribute('aria-expanded') === 'true';
            list.classList.toggle('la-ws-words-list--hidden', expanded);
            this.setAttribute('aria-expanded', String(!expanded));
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

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && DOM.victoryModal?.classList.contains('la-ws-modal--active')) {
                DOM.victoryModal.classList.remove('la-ws-modal--active');
                DOM.victoryModal.setAttribute('aria-hidden', 'true');
                la_ws_showScreen('levels');
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
