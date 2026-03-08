/**
 * PuzzleEngine.js v15.0 - Tactical HUD & Precision Geometry
 *
 * Nuevas funcionalidades respecto a v14.0:
 *
 * FONDO REACTIVO:
 * - gridCanvas (offscreen) para líneas de cuadrícula estáticas.
 *   No carga el loop del puzzle — se dibuja una sola vez por resize.
 * - Puntos de anclaje (micro-dots) en intersecciones con parpadeo aleatorio.
 * - Efecto Parallax: la rejilla se desplaza un 5% opuesto al puntero/giro.
 *   Driven by pointermove + DeviceOrientation. Lerp suavizado (0.08).
 *
 * SNAP & EFECTOS:
 * - Edge Pulse: al encajar una pieza, un anillo se expande desde el centro
 *   hasta los bordes de la pantalla (radio máx = diagonal) en 700ms.
 * - Flash perimetral esmeralda (150ms) se mantiene del v14.
 *
 * HÁPTICA (patrones específicos):
 * - 10ms al levantar una pieza (touchstart / pickup).
 * - [30, 20, 10] doble pulse al encajar (onSnap callback).
 * - Heavy pulse al completar el nivel (onWin callback en main.js).
 *
 * RENDIMIENTO:
 * - shadowBlur = 0 siempre.
 * - Loop se detiene si no hay nada activo (edgePulses/snapFlashes añadidos
 *   a la condición de parada).
 * - Idle blink: cada 5s activa el loop durante 60 frames para animar dots.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};

        // --- BUFFERS ---
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d', { alpha: true });

        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d', { alpha: false });

        // [v15] Offscreen grid canvas (static lines, rebuilt only on resize)
        this.gridCanvas = document.createElement('canvas');
        this.gridCtx = this.gridCanvas.getContext('2d');
        this.gridCanvasW = 0;
        this.gridCanvasH = 0;
        this.gridPad = 0;

        this.needsStaticUpdate = true;

        // State
        this.pieces = [];
        this.lockedPieces = [];
        this.loosePieces = [];
        this.particles = [];

        // [v15] Visual effects
        this.snapFlashes = [];   // perimeter glow on snap (150ms)
        this.edgePulses  = [];   // radial pulse to screen edges (700ms)

        // [v15] Parallax state
        this.parallaxX = 0;
        this.parallaxY = 0;
        this.targetParallaxX = 0;
        this.targetParallaxY = 0;

        // [v15] Micro-dot blink data (generated once on init)
        this.blinkDots = [];

        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;

        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.verticalEdges   = [];
        this.horizontalEdges = [];

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);

        // [v16] Mobile portrait flag — set by resizeCanvas, read by shufflePieces
        this.isMobilePortrait = false;

        this.isLoopRunning = false;
        this._idleWakeCount = 0; // frames to keep loop alive for idle blink

        // [v14/v15] shadowBlur = 0 always
        this.shadowBlur    = 0;
        this.particleLimit = this.gridSize >= 8 ? 20 : 50;

        // Binds
        this.handleStart    = this.handleStart.bind(this);
        this.handleMove     = this.handleMove.bind(this);
        this.handleEnd      = this.handleEnd.bind(this);
        this.handleResize   = this.handleResize.bind(this);
        this._onOrientation = this._onOrientation.bind(this);

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.buildGridCanvas();
        this.generateBlinkDots();
        this.generateSharedTopology();
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        this.wakeUp();

        // Idle blink: wake loop every 5s for ~1s of dot animation
        this._idleTimer = setInterval(() => {
            if (!this.isLoopRunning) {
                this._idleWakeCount = 70;
                this.wakeUp();
            }
        }, 5000);
    }

    /* ---- LOOP ---- */
    wakeUp() {
        if (!this.isLoopRunning) {
            this.isLoopRunning = true;
            this.animate();
        }
    }

    animate() {
        if (this._idleWakeCount > 0) this._idleWakeCount--;

        const canStop =
            !this.isDragging &&
            this.particles.length   === 0 &&
            this.snapFlashes.length === 0 &&
            this.edgePulses.length  === 0 &&
            this._idleWakeCount     <= 0  &&
            !this.needsStaticUpdate &&
            !this.showPreview;

        if (canStop) {
            this.isLoopRunning = false;
            return;
        }

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    /* ---- RESIZE ---- */
    handleResize() {
        this.resizeCanvas();
        this.buildGridCanvas();
        this.generateBlinkDots();
        this.createPiecesPathsOnly();
        this.shufflePieces(true);
        this.needsStaticUpdate = true;
        this.wakeUp();
    }

    resizeCanvas() {
        const parent   = this.canvas.parentElement;
        const w        = parent.clientWidth;
        const h        = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        this.canvas.width  = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width  = '100%';
        this.canvas.style.height = '100%';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);

        this.staticCanvas.width  = this.canvas.width;
        this.staticCanvas.height = this.canvas.height;
        this.staticCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.staticCtx.scale(this.dpr, this.dpr);

        this.logicalWidth  = w;
        this.logicalHeight = h;

        // [v16] Mobile portrait: board fills nearly full width, anchored to top.
        // Piece spawn area is the strip below the board.
        const isMobilePortrait = w < h && w < 520;
        this.isMobilePortrait  = isMobilePortrait;

        let cssW, cssH;

        if (isMobilePortrait) {
            // 97% of screen width; cap at 68% of height so pieces always have room below
            cssW = w * 0.97;
            cssH = cssW / imgRatio;
            const maxH = h * 0.68;
            if (cssH > maxH) { cssH = maxH; cssW = cssH * imgRatio; }

            this.boardWidth  = cssW;
            this.boardHeight = cssH;
            this.boardX      = Math.round((w - cssW) / 2);
            this.boardY      = 8; // tight top margin
        } else {
            // Original desktop / tablet / landscape layout
            cssW = w; cssH = w / imgRatio;
            if (cssH > h) { cssH = h; cssW = cssH * imgRatio; }
            cssW *= 0.65; cssH *= 0.65;

            this.boardWidth  = cssW;
            this.boardHeight = cssH;
            this.boardX      = Math.round((w - cssW) / 2);
            this.boardY      = Math.round((h - cssH) / 2);
        }

        this.pieceWidth  = this.boardWidth  / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        this.tabSize     = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;

        this.sourceCanvas.width  = Math.ceil(this.boardWidth  * this.dpr);
        this.sourceCanvas.height = Math.ceil(this.boardHeight * this.dpr);
        this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        this.sourceCtx.drawImage(this.img, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);

        this.needsStaticUpdate = true;
    }

    /* ---- OFFSCREEN GRID CANVAS (spec: drawn independently) ---- */
    buildGridCanvas() {
        const ext          = 0.12; // 12% padding each side absorbs parallax
        const lw           = this.logicalWidth;
        const lh           = this.logicalHeight;
        this.gridPad       = Math.max(lw, lh) * ext;
        this.gridCanvasW   = Math.ceil(lw + this.gridPad * 2);
        this.gridCanvasH   = Math.ceil(lh + this.gridPad * 2);

        this.gridCanvas.width  = this.gridCanvasW * this.dpr;
        this.gridCanvas.height = this.gridCanvasH * this.dpr;

        const ctx = this.gridCtx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.gridCanvasW, this.gridCanvasH);

        const cell = 40; // fixed background grid cell size (px)

        // Subtle grid lines
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.055)';
        ctx.lineWidth   = 1;

        for (let x = 0; x < this.gridCanvasW; x += cell) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, this.gridCanvasH);
            ctx.stroke();
        }
        for (let y = 0; y < this.gridCanvasH; y += cell) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(this.gridCanvasW, y + 0.5);
            ctx.stroke();
        }
    }

    /* ---- MICRO-DOTS (random subset of grid intersections, blink in render) ---- */
    generateBlinkDots() {
        this.blinkDots = [];
        const cell = 40;
        const pad  = this.gridPad;

        for (let x = 0; x <= this.gridCanvasW; x += cell) {
            for (let y = 0; y <= this.gridCanvasH; y += cell) {
                if (Math.random() < 0.22) {
                    this.blinkDots.push({
                        x,          // coordinate inside gridCanvas space
                        y,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.25 + Math.random() * 1.1
                    });
                }
            }
        }
    }

    /* ---- PARALLAX UPDATE (called on pointer/orientation events) ---- */
    _updateParallaxTarget(px, py) {
        // Pointer or orientation offset → opposite direction, max 5% of screen
        const cx = this.logicalWidth  / 2;
        const cy = this.logicalHeight / 2;
        this.targetParallaxX = -((px - cx) / cx) * this.logicalWidth  * 0.05;
        this.targetParallaxY = -((py - cy) / cy) * this.logicalHeight * 0.05;
        if (!this.isLoopRunning) this.wakeUp();
    }

    _onOrientation(e) {
        // gamma: left/right (-90…90), beta: front/back (-180…180)
        const px = this.logicalWidth  * (0.5 + (e.gamma || 0) / 90  * 0.5);
        const py = this.logicalHeight * (0.5 + (e.beta  || 0) / 180 * 0.5);
        this._updateParallaxTarget(px, py);
    }

    /* ---- RENDER ---- */
    render() {
        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        // Lerp parallax toward target (GPU-smooth, only transform)
        this.parallaxX += (this.targetParallaxX - this.parallaxX) * 0.08;
        this.parallaxY += (this.targetParallaxY - this.parallaxY) * 0.08;

        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // 1. Background grid with parallax
        this._renderGridLayer();

        // 2. Static layer (board + locked pieces)
        this.ctx.drawImage(this.staticCanvas, 0, 0, this.logicalWidth, this.logicalHeight);

        // 3. Preview
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.28;
            this.ctx.drawImage(
                this.sourceCanvas, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height,
                this.boardX, this.boardY, this.boardWidth, this.boardHeight
            );
            this.ctx.restore();
        }

        // 4. Loose pieces (not selected)
        for (let i = 0; i < this.loosePieces.length; i++) {
            const p = this.loosePieces[i];
            if (p !== this.selectedPiece) this.renderPieceToContext(this.ctx, p, false);
        }

        // 5. Ghost + selected piece
        if (this.selectedPiece) {
            const p    = this.selectedPiece;
            const dist = Math.hypot(p.currentX - p.correctX, p.currentY - p.correctY);
            if (dist < this.pieceWidth * 0.4) {
                this.ctx.save();
                this.ctx.translate(p.correctX, p.correctY);
                this.ctx.fillStyle   = 'rgba(255,255,255,0.2)';
                this.ctx.fill(p.path);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                this.ctx.lineWidth   = 1.5;
                this.ctx.stroke(p.path);
                this.ctx.restore();
            }
            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        // 6. Particles
        this.updateParticles();

        // 7. [v15] Snap perimeter flash (150ms, esmeralda)
        this._updateSnapFlashes();

        // 8. [v15] Edge pulse (700ms, radial to screen corners)
        this._updateEdgePulses();
    }

    /* ---- GRID LAYER with parallax + blinking micro-dots ---- */
    _renderGridLayer() {
        const dx = -this.gridPad + this.parallaxX;
        const dy = -this.gridPad + this.parallaxY;

        // Composite offscreen grid canvas with parallax offset
        this.ctx.drawImage(
            this.gridCanvas,
            0, 0, this.gridCanvasW * this.dpr, this.gridCanvasH * this.dpr,
            dx, dy, this.gridCanvasW, this.gridCanvasH
        );

        // Blinking micro-dots at grid intersections
        const now = performance.now() / 1000;
        const pad = this.gridPad;

        for (let i = 0; i < this.blinkDots.length; i++) {
            const d     = this.blinkDots[i];
            const alpha = 0.12 + 0.10 * Math.sin(now * d.speed + d.phase);
            const sx    = Math.round(d.x + dx);
            const sy    = Math.round(d.y + dy);
            if (sx < 0 || sx > this.logicalWidth || sy < 0 || sy > this.logicalHeight) continue;
            this.ctx.fillStyle = `rgba(59,130,246,${alpha.toFixed(2)})`;
            this.ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }
    }

    updateStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        const bx = Math.round(this.boardX);
        const by = Math.round(this.boardY);
        const bw = Math.round(this.boardWidth);
        const bh = Math.round(this.boardHeight);

        // Board background (dark solid)
        ctx.fillStyle = '#0A1118';
        ctx.fillRect(bx, by, bw, bh);

        // Board inner grid (piece boundaries reference)
        ctx.save();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth   = 1;
        for (let col = 0; col <= this.gridSize; col++) {
            const x = Math.round(bx + col * this.pieceWidth);
            ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
        }
        for (let row = 0; row <= this.gridSize; row++) {
            const y = Math.round(by + row * this.pieceHeight);
            ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke();
        }
        ctx.restore();

        // Board border — accent blue, 1px
        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth   = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Locked pieces
        for (let i = 0; i < this.lockedPieces.length; i++) {
            this.renderPieceToContext(ctx, this.lockedPieces[i], false, true);
        }
    }

    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        // [v15] Scale 1.05x when lifted; no shadow (shadowBlur = 0 always)
        if (!isStaticRender && !p.isLocked && isSelected) {
            ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
            ctx.scale(1.05, 1.05);
            ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
        }

        ctx.clip(p.path);

        const margin = Math.min(Math.max(this.pieceWidth, this.pieceHeight), this.tabSize * 3);
        const overlapFix    = isStaticRender ? 0.6 : 0;
        const scaleToSource = this.dpr;

        const srcPieceW_SC  = this.sourceCanvas.width  / this.gridSize;
        const srcPieceH_SC  = this.sourceCanvas.height / this.gridSize;
        const srcOriginX_SC = p.gridX * srcPieceW_SC;
        const srcOriginY_SC = p.gridY * srcPieceH_SC;

        ctx.drawImage(
            this.sourceCanvas,
            srcOriginX_SC - (margin * scaleToSource),
            srcOriginY_SC - (margin * scaleToSource),
            srcPieceW_SC  + (margin * 2 * scaleToSource),
            srcPieceH_SC  + (margin * 2 * scaleToSource),
            -margin - overlapFix,
            -margin - overlapFix,
            this.pieceWidth  + (margin * 2) + (overlapFix * 2),
            this.pieceHeight + (margin * 2) + (overlapFix * 2)
        );
        ctx.restore();

        // Piece edge stroke
        if (!isStaticRender && !p.isLocked) {
            ctx.save();
            ctx.translate(drawX, drawY);

            if (isSelected) {
                // [v15] White 2px stroke while dragging (precision outline)
                ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth   = 2;
                ctx.stroke(p.path);
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth   = 1;
                ctx.stroke(p.path);
            }

            ctx.restore();
        }
    }

    /* ---- [v15] SNAP PERIMETER FLASH (150ms esmeralda) ---- */
    _updateSnapFlashes() {
        if (this.snapFlashes.length === 0) return;
        const now = performance.now();
        for (let i = this.snapFlashes.length - 1; i >= 0; i--) {
            const f = this.snapFlashes[i];
            if (!f.startTime) f.startTime = now;
            const t = (now - f.startTime) / 150;
            if (t >= 1) { this.snapFlashes.splice(i, 1); continue; }
            const p = f.piece;
            this.ctx.save();
            this.ctx.translate(Math.round(p.currentX), Math.round(p.currentY));
            this.ctx.strokeStyle = `rgba(16,185,129,${1 - t})`;
            this.ctx.lineWidth   = 4 - t * 2;
            this.ctx.stroke(p.path);
            this.ctx.restore();
        }
    }

    /* ---- [v15] EDGE PULSE (snapped piece → screen edges, 700ms) ---- */
    _spawnEdgePulse(x, y) {
        const maxR = Math.hypot(this.logicalWidth, this.logicalHeight);
        // Two concentric rings with slight delay for depth
        this.edgePulses.push({ x, y, maxR, startTime: null, delay: 0,   color: '16,185,129' });
        this.edgePulses.push({ x, y, maxR, startTime: null, delay: 80,  color: '59,130,246' });
    }

    _updateEdgePulses() {
        if (this.edgePulses.length === 0) return;
        const now = performance.now();
        for (let i = this.edgePulses.length - 1; i >= 0; i--) {
            const ep = this.edgePulses[i];
            if (!ep.startTime) ep.startTime = now;
            const elapsed = now - ep.startTime - ep.delay;
            if (elapsed < 0) continue;
            const t = elapsed / 700;
            if (t >= 1) { this.edgePulses.splice(i, 1); continue; }
            // Ease-out quad: fast start, gentle finish
            const eased = 1 - Math.pow(1 - t, 2);
            const r     = ep.maxR * eased;
            const a     = (1 - t) * 0.35;
            const lw    = Math.max(0.5, 2.5 - t * 2);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(ep.x, ep.y, r, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${ep.color},${a.toFixed(2)})`;
            this.ctx.lineWidth   = lw;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    /* ---- PIECE MANAGEMENT ---- */
    updatePieceCaches() {
        this.lockedPieces = this.pieces.filter(p => p.isLocked);
        this.loosePieces  = this.pieces.filter(p => !p.isLocked);
    }

    createPieces() {
        this.pieces = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape  = this.shapes[y][x];
                const jitter = {
                    top:    this.horizontalEdges[y][x],
                    bottom: this.horizontalEdges[y + 1][x],
                    left:   this.verticalEdges[y][x],
                    right:  this.verticalEdges[y][x + 1]
                };
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);
                this.pieces.push({
                    id: `${x}-${y}`, gridX: x, gridY: y,
                    correctX: this.boardX + x * this.pieceWidth,
                    correctY: this.boardY + y * this.pieceHeight,
                    currentX: 0, currentY: 0, isLocked: false,
                    shape, jitter, path
                });
            }
        }
        this.updatePieceCaches();
    }

    createPiecesPathsOnly() {
        for (const p of this.pieces) {
            p.path     = this.createPath(this.pieceWidth, this.pieceHeight, p.shape, p.jitter);
            p.correctX = this.boardX + p.gridX * this.pieceWidth;
            p.correctY = this.boardY + p.gridY * this.pieceHeight;
            if (p.isLocked) { p.currentX = p.correctX; p.currentY = p.correctY; }
        }
    }

    /* ---- SHUFFLE — Zonas Caóticas + Collision Avoidance (v13.3) ---- */
    shufflePieces(repositionOnly = false) {
        this.updatePieceCaches();
        const loose = this.loosePieces;

        if (!repositionOnly) {
            for (let i = loose.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [loose[i], loose[j]] = [loose[j], loose[i]];
            }
        }

        const topSafe    = 80;
        const bottomSafe = 20; // buttons are now in HUD — no bottom clearance needed

        let zones;
        if (this.isMobilePortrait) {
            // On mobile portrait the board fills ~97% width, so pieces live below it
            const belowY = this.boardY + this.boardHeight + 10;
            const belowH = this.logicalHeight - belowY - bottomSafe;
            zones = [{ x: 4, y: belowY, w: this.logicalWidth - 8, h: Math.max(0, belowH) }];
        } else {
            zones = [
                { x: 10, y: topSafe, w: Math.max(0, this.boardX - 20), h: this.logicalHeight - topSafe - bottomSafe },
                { x: this.boardX + this.boardWidth + 10, y: topSafe, w: Math.max(0, this.logicalWidth - (this.boardX + this.boardWidth) - 20), h: this.logicalHeight - topSafe - bottomSafe },
                { x: 10, y: this.boardY + this.boardHeight + 10, w: this.logicalWidth - 20, h: Math.max(0, this.logicalHeight - (this.boardY + this.boardHeight) - bottomSafe) }
            ];
        }

        const validZones = zones.filter(z => z.w > this.pieceWidth && z.h > this.pieceHeight);
        if (validZones.length === 0) {
            // Last-resort fallback: scatter anywhere except the very top bar
            validZones.push({ x: 4, y: this.boardY + this.boardHeight + 4, w: this.logicalWidth - 8, h: Math.max(this.pieceHeight * 2, this.logicalHeight - (this.boardY + this.boardHeight) - 8) });
        }

        const placed = [];
        for (const p of loose) {
            if (!repositionOnly) p.isLocked = false;
            if (p.isLocked) continue;

            let ok = false, tries = 0;
            while (!ok && tries < 50) {
                tries++;
                const z  = validZones[Math.floor(Math.random() * validZones.length)];
                const cx = z.x + Math.random() * (z.w - this.pieceWidth);
                const cy = z.y + Math.random() * (z.h - this.pieceHeight);
                const collision = placed.some(pos => Math.hypot(pos.x - cx, pos.y - cy) < this.pieceWidth * 0.7);
                if (!collision) { p.currentX = cx; p.currentY = cy; placed.push({ x: cx, y: cy }); ok = true; }
            }
            if (!ok) { p.currentX = Math.random() * (this.logicalWidth - this.pieceWidth); p.currentY = Math.random() * (this.logicalHeight - this.pieceHeight); }
            this.clampPosition(p);
        }

        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.wakeUp();
    }

    /* ---- CLAMPING ---- */
    // [v16] Repulsion logic removed entirely — buttons are now in the HUD, not on the canvas.
    clampPosition(p) {
        p.currentX = Math.max(0, Math.min(p.currentX, this.logicalWidth  - this.pieceWidth));
        p.currentY = Math.max(0, Math.min(p.currentY, this.logicalHeight - this.pieceHeight));
    }

    /* ---- TOPOLOGY ---- */
    generateSharedTopology() {
        const js = this.gridSize > 6 ? 0.08 : 0.15;
        this.shapes = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;
                if (y > 0) top = -this.shapes[y - 1][x].bottom;
                if (y < this.gridSize - 1) bottom = Math.random() > 0.5 ? 1 : -1;
                if (x > 0) left = -row[x - 1].right;
                if (x < this.gridSize - 1) right = Math.random() > 0.5 ? 1 : -1;
                row.push({ top, right, bottom, left });
            }
            this.shapes.push(row);
        }
        this.verticalEdges = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x <= this.gridSize; x++) row.push((x === 0 || x === this.gridSize) ? 0 : (Math.random() - 0.5) * js);
            this.verticalEdges.push(row);
        }
        this.horizontalEdges = [];
        for (let y = 0; y <= this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) row.push((y === 0 || y === this.gridSize) ? 0 : (Math.random() - 0.5) * js);
            this.horizontalEdges.push(row);
        }
    }

    createPath(w, h, shape, jitter) {
        const path = new Path2D();
        const t    = this.tabSize;
        path.moveTo(0, 0);
        shape.top    !== 0 ? this.lineToTab(path, 0, 0, w, 0, shape.top    * t, jitter.top    * t) : path.lineTo(w, 0);
        shape.right  !== 0 ? this.lineToTab(path, w, 0, w, h, shape.right  * t, jitter.right  * t) : path.lineTo(w, h);
        shape.bottom !== 0 ? this.lineToTab(path, w, h, 0, h, shape.bottom * t, jitter.bottom * t) : path.lineTo(0, h);
        shape.left   !== 0 ? this.lineToTab(path, 0, h, 0, 0, shape.left   * t, jitter.left   * t) : path.lineTo(0, 0);
        path.closePath();
        return path;
    }

    lineToTab(path, x1, y1, x2, y2, amp, shift) {
        const w = x2 - x1, h = y2 - y1;
        const cx = x1 + w * 0.5 + (w === 0 ? shift : 0);
        const cy = y1 + h * 0.5 + (h === 0 ? shift : 0);
        const perpX = -h / Math.abs(h || 1), perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35, yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65, yB = y1 + h * 0.65;
        path.lineTo(xA, yA);
        path.bezierCurveTo(xA + perpX*amp*0.2, yA + perpY*amp*0.2, cx - w*0.1 + perpX*amp, cy - h*0.1 + perpY*amp, cx + perpX*amp, cy + perpY*amp);
        path.bezierCurveTo(cx + w*0.1 + perpX*amp, cy + h*0.1 + perpY*amp, xB + perpX*amp*0.2, yB + perpY*amp*0.2, xB, yB);
        path.lineTo(x2, y2);
    }

    /* ---- INPUT HANDLING ---- */
    getPointerPos(e) {
        const rect    = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    handleStart(e) {
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        this._updateParallaxTarget(x, y);

        for (let i = this.loosePieces.length - 1; i >= 0; i--) {
            const p = this.loosePieces[i];
            const m = this.tabSize * 2.0;
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth  + m &&
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                this.selectedPiece = p;
                this.isDragging    = true;
                this.dragOffsetX   = x - p.currentX;
                this.dragOffsetY   = y - p.currentY;
                this.wakeUp();
                this.callbacks.onSound && this.callbacks.onSound('click');
                // [v15] 10ms haptic on pickup
                if (navigator.vibrate) navigator.vibrate(10);
                this.loosePieces.splice(i, 1);
                this.loosePieces.push(p);
                return;
            }
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        this.selectedPiece.currentX = x - this.dragOffsetX;
        this.selectedPiece.currentY = y - this.dragOffsetY;
        this.clampPosition(this.selectedPiece);
        // Update parallax target as piece moves
        this._updateParallaxTarget(x, y);
    }

    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;

        const dist = Math.hypot(
            this.selectedPiece.currentX - this.selectedPiece.correctX,
            this.selectedPiece.currentY - this.selectedPiece.correctY
        );

        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.needsStaticUpdate = true;
            this.updatePieceCaches();

            // [v15] Snap effects
            this.snapFlashes.push({ piece: this.selectedPiece, startTime: null });
            this._spawnEdgePulse(
                this.selectedPiece.currentX + this.pieceWidth  / 2,
                this.selectedPiece.currentY + this.pieceHeight / 2
            );
            this.wakeUp();

            this.callbacks.onSound && this.callbacks.onSound('snap');
            // [v15] Double haptic [30, 20, 10] via callback (main.js)
            this.callbacks.onSnap && this.callbacks.onSnap();

            this.spawnParticles(
                this.selectedPiece.currentX + this.pieceWidth  / 2,
                this.selectedPiece.currentY + this.pieceHeight / 2,
                'ripple'
            );

            if (this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            if (this.callbacks.onStateChange) this.callbacks.onStateChange();
        }

        this.isDragging    = false;
        this.selectedPiece = null;
    }

    checkVictory() {
        if (this.loosePieces.length === 0) {
            if (this.gridSize < 8) this.spawnParticles(this.logicalWidth / 2, this.logicalHeight / 2, 'confetti');
            if (this.callbacks.onSound) this.callbacks.onSound('win');
            // Victory: spawn a final massive edge pulse from screen center
            this._spawnEdgePulse(this.logicalWidth / 2, this.logicalHeight / 2);
            if (this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500);
            this.canvas.removeEventListener('mousedown', this.handleStart);
            this.canvas.removeEventListener('touchstart', this.handleStart);
        }
    }

    /* ---- PARTICLES ---- */
    spawnParticles(x, y, type) {
        if (type === 'ripple') {
            this.particles.push({ type: 'ripple', x, y, radius: 10, alpha: 1.0, color: '#ffffff', lineWidth: 4, speed: 3 });
            this.particles.push({ type: 'ripple', x, y, radius: 5,  alpha: 1.0, color: '#fbbf24', lineWidth: 2, speed: 1.5 });
        } else {
            if (this.particles.length > this.particleLimit) return;
            const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
            for (let i = 0; i < 30; i++) {
                this.particles.push({ type: 'confetti', x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color: colors[i % colors.length], size: Math.random()*4+2 });
            }
        }
    }

    updateParticles() {
        if (this.particles.length === 0) return;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.type === 'ripple') {
                p.radius += p.speed; p.alpha -= 0.04; p.lineWidth *= 0.95;
                if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = p.color; this.ctx.lineWidth = p.lineWidth; this.ctx.globalAlpha = p.alpha;
                this.ctx.stroke();
                this.ctx.restore();
            } else {
                p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    /* ---- STATE ---- */
    exportState() { return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked })); }

    importState(s) {
        if (!s) return;
        s.forEach(sp => { const p = this.pieces.find(x => x.id === sp.id); if (p) { p.currentX = sp.cx; p.currentY = sp.cy; p.isLocked = sp.locked; } });
        this.updatePieceCaches(); this.needsStaticUpdate = true; this.wakeUp();
    }

    togglePreview(a) { this.showPreview = a; this.wakeUp(); }

    autoPlacePiece() {
        if (this.loosePieces.length === 0) return false;
        const p = this.loosePieces[Math.floor(Math.random() * this.loosePieces.length)];
        this.spawnParticles(p.correctX + this.pieceWidth / 2, p.correctY + this.pieceHeight / 2, 'ripple');
        p.currentX = p.correctX; p.currentY = p.correctY; p.isLocked = true;
        // Flash + edge pulse for magnet too
        this.snapFlashes.push({ piece: p, startTime: null });
        this._spawnEdgePulse(p.correctX + this.pieceWidth / 2, p.correctY + this.pieceHeight / 2);
        this.updatePieceCaches(); this.needsStaticUpdate = true;
        if (this.callbacks.onSound) this.callbacks.onSound('snap');
        this.checkVictory(); this.wakeUp();
        return true;
    }

    /* ---- EVENT LISTENERS ---- */
    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);

        // [v15] Device orientation parallax (iOS 13+ needs permission; try silently)
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', this._onOrientation, { passive: true });
        }

        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.handleResize());
            this._resizeObserver.observe(this.canvas.parentElement);
        }
    }

    destroy() {
        this.isLoopRunning = false;
        clearInterval(this._idleTimer);
        this.canvas.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
        window.removeEventListener('deviceorientation', this._onOrientation);
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
