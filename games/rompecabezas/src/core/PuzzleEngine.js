/**
 * PuzzleEngine.js v14.0 - Precision Tech Visual Overhaul
 *
 * Cambios respecto a v13.4:
 * - shadowBlur = 0 siempre (elimina sombras difusas, mejora GPU móvil).
 * - Fondo del tablero: rejilla de referencia espacial (líneas 1px #1E293B).
 * - Pieza seleccionada: escala 1.05x + trazo blanco 2px (sin sombra).
 * - Efecto Snap: destello perimetral en #10B981 de 150ms al encajar.
 * - Se mantiene toda la lógica de gameplay de v13.4 sin cambios.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        // alpha: false mejora rendimiento (el compositor ignora lo de atrás)
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        // --- BUFFERS (Rendimiento) ---
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d', { alpha: true });
        
        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d', { alpha: false });

        this.needsStaticUpdate = true;

        // Estado
        this.pieces = [];
        this.lockedPieces = []; 
        this.loosePieces = [];  
        
        this.particles = []; 
        // [Precision Tech] Destellos de encaje (snap flash #10B981, 150ms)
        this.snapFlashes = [];

        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;
        
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        this.verticalEdges = []; 
        this.horizontalEdges = []; 
        
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        // --- LOOP CONTROL (Battery Saver) ---
        this.isLoopRunning = false;

        // [Precision Tech] shadowBlur = 0 siempre. 
        // Las sombras difusas se eliminan por completo para máximo rendimiento GPU.
        this.shadowBlur = 0;
        this.particleLimit = this.gridSize >= 8 ? 20 : 50;

        // Binds
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas(); 
        this.generateSharedTopology();
        this.createPieces(); 
        this.shufflePieces(); 
        this.addEventListeners();
        
        this.wakeUp();
    }

    /* --- GESTIÓN DE LOOP INTELIGENTE --- */
    wakeUp() {
        if (!this.isLoopRunning) {
            this.isLoopRunning = true;
            this.animate();
        }
    }

    animate() {
        // El loop se detiene cuando no hay nada que animar.
        // snapFlashes se añade como condición para mantener activo el destello de encaje.
        if (!this.isDragging && 
            this.particles.length === 0 &&
            this.snapFlashes.length === 0 &&
            !this.needsStaticUpdate && 
            !this.showPreview) {
            
            this.isLoopRunning = false;
            return; // STOP LOOP
        }

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    /* --- SETUP & RESIZE --- */
    handleResize() {
        this.resizeCanvas();
        this.createPiecesPathsOnly(); 
        this.shufflePieces(true); 
        this.needsStaticUpdate = true; 
        this.wakeUp(); 
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        let cssW = w;
        let cssH = w / imgRatio;

        if (cssH > h) {
            cssH = h;
            cssW = cssH * imgRatio;
        }

        const workAreaScale = 0.65; 
        cssW *= workAreaScale;
        cssH *= workAreaScale;

        // 1. Configurar Main Canvas
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);

        // 2. Configurar Static Canvas
        this.staticCanvas.width = this.canvas.width; 
        this.staticCanvas.height = this.canvas.height;
        
        this.staticCtx.setTransform(1, 0, 0, 1, 0, 0); 
        this.staticCtx.scale(this.dpr, this.dpr);

        // Métricas Lógicas
        this.boardWidth = cssW;
        this.boardHeight = cssH;
        this.boardX = Math.round((w - cssW) / 2);
        this.boardY = Math.round((h - cssH) / 2);

        this.pieceWidth = this.boardWidth / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
        this.logicalWidth = w;
        this.logicalHeight = h;

        // 3. Configurar Source Canvas
        this.sourceCanvas.width = Math.ceil(this.boardWidth * this.dpr);
        this.sourceCanvas.height = Math.ceil(this.boardHeight * this.dpr);
        
        this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        this.sourceCtx.drawImage(this.img, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        
        this.needsStaticUpdate = true;
    }

    /* --- UX: ZONA DE SEGURIDAD --- */
    isInRestrictedArea(x, y) {
        const safeMarginRight = 90; 
        const safeMarginBottom = 160; 
        return (x > this.logicalWidth - safeMarginRight) && 
               (y > this.logicalHeight - safeMarginBottom);
    }

    clampPosition(p) {
        let x = Math.max(0, Math.min(p.currentX, this.logicalWidth - this.pieceWidth));
        let y = Math.max(0, Math.min(p.currentY, this.logicalHeight - this.pieceHeight));

        const distToCorrect = Math.hypot(x - p.correctX, y - p.correctY);
        const isTryingToSnap = distToCorrect < this.pieceWidth * 0.8;

        if (!isTryingToSnap && this.isInRestrictedArea(x + this.pieceWidth/2, y + this.pieceHeight/2)) {
            y = this.logicalHeight - 170 - this.pieceHeight;
        }

        p.currentX = x;
        p.currentY = y;
    }

    /* --- RENDER --- */
    render() {
        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        
        // 1. Fondo Estático (tablero + piezas bloqueadas)
        this.ctx.drawImage(this.staticCanvas, 0, 0, this.logicalWidth, this.logicalHeight);

        // 2. Vista Previa
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(
                this.sourceCanvas, 0, 0,
                this.sourceCanvas.width, this.sourceCanvas.height,
                this.boardX, this.boardY,
                this.boardWidth, this.boardHeight
            );
            this.ctx.restore();
        }

        // 3. Piezas Sueltas (excepto la seleccionada)
        for (let i = 0; i < this.loosePieces.length; i++) {
            const p = this.loosePieces[i];
            if (p !== this.selectedPiece) this.renderPieceToContext(this.ctx, p, false);
        }

        // 4. Pieza Seleccionada & SNAP ASSIST (Ghost)
        if (this.selectedPiece) {
            const p = this.selectedPiece;
            const dist = Math.hypot(p.currentX - p.correctX, p.currentY - p.correctY);
            const snapThreshold = this.pieceWidth * 0.4; 

            if (dist < snapThreshold) {
                this.ctx.save();
                this.ctx.translate(p.correctX, p.correctY);
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
                this.ctx.fill(p.path); 
                this.ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke(p.path);
                this.ctx.restore();
            }

            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        // 5. Partículas
        this.updateParticles();

        // 6. [Precision Tech] Destellos de snap (borde esmeralda, 150ms)
        this.updateSnapFlashes();
    }

    updateStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        const bx = Math.round(this.boardX);
        const by = Math.round(this.boardY);
        const bw = Math.round(this.boardWidth);
        const bh = Math.round(this.boardHeight);

        // [Precision Tech] Fondo del tablero: sólido oscuro
        ctx.fillStyle = "#0D1520";
        ctx.fillRect(bx, by, bw, bh);

        // [Precision Tech] Rejilla de referencia espacial (1px, #1E293B)
        // Proporciona referencia visual de posición sin profundidad por capas.
        ctx.save();
        ctx.strokeStyle = "#1E293B";
        ctx.lineWidth = 1;
        // Líneas verticales
        for (let col = 0; col <= this.gridSize; col++) {
            const x = Math.round(this.boardX + col * this.pieceWidth);
            ctx.beginPath();
            ctx.moveTo(x, by);
            ctx.lineTo(x, by + bh);
            ctx.stroke();
        }
        // Líneas horizontales
        for (let row = 0; row <= this.gridSize; row++) {
            const y = Math.round(this.boardY + row * this.pieceHeight);
            ctx.beginPath();
            ctx.moveTo(bx, y);
            ctx.lineTo(bx + bw, y);
            ctx.stroke();
        }
        ctx.restore();

        // Borde exterior del tablero: azul eléctrico, 1px
        ctx.strokeStyle = "#3B82F6";
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Piezas bloqueadas en capa estática
        for (let i = 0; i < this.lockedPieces.length; i++) {
            this.renderPieceToContext(ctx, this.lockedPieces[i], false, true);
        }
    }

    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        // [Precision Tech] Sin sombras difusas (shadowBlur = 0 siempre).
        // La pieza seleccionada se levanta con escala 1.05x.
        if (!isStaticRender && !p.isLocked && isSelected) {
            ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
            ctx.scale(1.05, 1.05);
            ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
        }

        ctx.clip(p.path);

        const margin = Math.min(
            Math.max(this.pieceWidth, this.pieceHeight),
            this.tabSize * 3
        );
        
        let overlapFix = isStaticRender ? 0.6 : 0; 
        const scaleToSource = this.dpr; 

        const srcPieceW_SC = (this.sourceCanvas.width / this.gridSize);
        const srcPieceH_SC = (this.sourceCanvas.height / this.gridSize);
        const srcOriginX_SC = p.gridX * srcPieceW_SC;
        const srcOriginY_SC = p.gridY * srcPieceH_SC;
        
        const srcX = srcOriginX_SC - (margin * scaleToSource);
        const srcY = srcOriginY_SC - (margin * scaleToSource);
        const srcW = srcPieceW_SC + (margin * 2 * scaleToSource);
        const srcH = srcPieceH_SC + (margin * 2 * scaleToSource);

        const dstX = -margin - overlapFix;
        const dstY = -margin - overlapFix;
        const dstW = this.pieceWidth + (margin * 2) + (overlapFix * 2);
        const dstH = this.pieceHeight + (margin * 2) + (overlapFix * 2);

        ctx.drawImage(this.sourceCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
        ctx.restore();

        // Trazos de borde (sin sombras)
        if (!isStaticRender && !p.isLocked) {
            ctx.save();
            ctx.translate(drawX, drawY);

            if (isSelected) {
                // [Precision Tech] Pieza levantada: escala 1.05 + trazo blanco 2px
                ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke(p.path);
            } else {
                // Pieza suelta normal: trazo sutil
                ctx.strokeStyle = "rgba(255,255,255,0.22)";
                ctx.lineWidth = 1;
                ctx.stroke(p.path);
            }

            ctx.restore();
        }
    }

    /**
     * [Precision Tech] Actualiza y renderiza los destellos de snap.
     * Cada destello dura 150ms y emite un trazo perimetral en #10B981
     * que se desvanece desde opacidad 1 → 0.
     */
    updateSnapFlashes() {
        if (this.snapFlashes.length === 0) return;
        const now = performance.now();

        for (let i = this.snapFlashes.length - 1; i >= 0; i--) {
            const flash = this.snapFlashes[i];

            // Inicializar tiempo de inicio en el primer frame
            if (!flash.startTime) flash.startTime = now;

            const elapsed = now - flash.startTime;
            const t = elapsed / 150; // Normalizado 0→1 en 150ms

            if (t >= 1) {
                this.snapFlashes.splice(i, 1);
                continue;
            }

            const alpha  = 1 - t;
            const width  = 4 - t * 2; // 4px → 2px mientras se desvanece
            const p      = flash.piece;

            this.ctx.save();
            this.ctx.translate(Math.round(p.currentX), Math.round(p.currentY));
            this.ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
            this.ctx.lineWidth = width;
            this.ctx.stroke(p.path);
            this.ctx.restore();
        }
    }

    updatePieceCaches() {
        this.lockedPieces = this.pieces.filter(p => p.isLocked);
        this.loosePieces = this.pieces.filter(p => !p.isLocked);
    }

    createPieces() {
        this.pieces = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                const jitter = {
                    top:    this.horizontalEdges[y][x],
                    bottom: this.horizontalEdges[y + 1][x],
                    left:   this.verticalEdges[y][x],
                    right:  this.verticalEdges[y][x + 1]
                };
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);
                this.pieces.push({
                    id: `${x}-${y}`, gridX: x, gridY: y,
                    correctX: this.boardX + (x * this.pieceWidth),
                    correctY: this.boardY + (y * this.pieceHeight),
                    currentX: 0, currentY: 0, isLocked: false,
                    shape, jitter, path
                });
            }
        }
        this.updatePieceCaches();
    }

    createPiecesPathsOnly() {
        for (let p of this.pieces) {
            p.path = this.createPath(this.pieceWidth, this.pieceHeight, p.shape, p.jitter);
            p.correctX = this.boardX + (p.gridX * this.pieceWidth);
            p.correctY = this.boardY + (p.gridY * this.pieceHeight);
            if (p.isLocked) {
                p.currentX = p.correctX;
                p.currentY = p.correctY;
            }
        }
    }

    /**
     * SHUFFLE (v13.3) — Zonas Caóticas + Collision Avoidance
     */
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
        const bottomSafe = 160;

        const zones = [
            { 
                x: 10, 
                y: topSafe, 
                w: Math.max(0, this.boardX - 20), 
                h: this.logicalHeight - topSafe - bottomSafe 
            },
            { 
                x: this.boardX + this.boardWidth + 10, 
                y: topSafe, 
                w: Math.max(0, this.logicalWidth - (this.boardX + this.boardWidth) - 20), 
                h: this.logicalHeight - topSafe - bottomSafe 
            },
            { 
                x: 10, 
                y: this.boardY + this.boardHeight + 10, 
                w: this.logicalWidth - 20, 
                h: Math.max(0, this.logicalHeight - (this.boardY + this.boardHeight) - bottomSafe) 
            }
        ];

        const validZones = zones.filter(z => z.w > this.pieceWidth && z.h > this.pieceHeight);
        
        if (validZones.length === 0) {
            validZones.push({
                x: 10, y: topSafe, 
                w: this.logicalWidth - 20, 
                h: this.logicalHeight - topSafe - bottomSafe
            });
        }

        const placedPositions = [];

        for (const p of loose) {
            if (!repositionOnly) p.isLocked = false;
            if (p.isLocked) continue;

            let placedOK = false;
            let tries    = 0;
            const maxTries = 50; 

            while (!placedOK && tries < maxTries) {
                tries++;
                const z  = validZones[Math.floor(Math.random() * validZones.length)];
                const cx = z.x + Math.random() * (z.w - this.pieceWidth);
                const cy = z.y + Math.random() * (z.h - this.pieceHeight);

                let collision = false;
                for (const pos of placedPositions) {
                    const dist = Math.hypot(pos.x - cx, pos.y - cy);
                    if (dist < this.pieceWidth * 0.7) { collision = true; break; }
                }

                if (!collision) {
                    p.currentX = cx;
                    p.currentY = cy;
                    placedPositions.push({ x: cx, y: cy });
                    placedOK = true;
                }
            }

            if (!placedOK) {
                p.currentX = Math.random() * (this.logicalWidth - this.pieceWidth);
                p.currentY = Math.random() * (this.logicalHeight - this.pieceHeight);
            }

            this.clampPosition(p);
        }
        
        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.wakeUp();
    }

    generateSharedTopology() {
        const jitterStrength = this.gridSize > 6 ? 0.08 : 0.15;
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
            for (let x = 0; x <= this.gridSize; x++) {
                row.push((x === 0 || x === this.gridSize) ? 0 : (Math.random() - 0.5) * jitterStrength);
            }
            this.verticalEdges.push(row);
        }
        this.horizontalEdges = [];
        for (let y = 0; y <= this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                row.push((y === 0 || y === this.gridSize) ? 0 : (Math.random() - 0.5) * jitterStrength);
            }
            this.horizontalEdges.push(row);
        }
    }

    createPath(w, h, shape, jitter) {
        const path = new Path2D();
        const t = this.tabSize; 
        path.moveTo(0, 0);
        shape.top    !== 0 ? this.lineToTab(path, 0, 0, w, 0, shape.top    * t, jitter.top    * t) : path.lineTo(w, 0);
        shape.right  !== 0 ? this.lineToTab(path, w, 0, w, h, shape.right  * t, jitter.right  * t) : path.lineTo(w, h);
        shape.bottom !== 0 ? this.lineToTab(path, w, h, 0, h, shape.bottom * t, jitter.bottom * t) : path.lineTo(0, h);
        shape.left   !== 0 ? this.lineToTab(path, 0, h, 0, 0, shape.left   * t, jitter.left   * t) : path.lineTo(0, 0);
        path.closePath();
        return path;
    }
    
    lineToTab(path, x1, y1, x2, y2, amp, shift) {
        const w = x2 - x1; const h = y2 - y1;
        const cx = x1 + w * 0.5 + (w === 0 ? shift : 0);
        const cy = y1 + h * 0.5 + (h === 0 ? shift : 0);
        const perpX = -h / Math.abs(h || 1); const perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35; const yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65; const yB = y1 + h * 0.65;
        path.lineTo(xA, yA);
        path.bezierCurveTo(
            xA + (perpX * amp * 0.2), yA + (perpY * amp * 0.2),
            cx - (w * 0.1) + (perpX * amp), cy - (h * 0.1) + (perpY * amp),
            cx + (perpX * amp), cy + (perpY * amp)
        );
        path.bezierCurveTo(
            cx + (w * 0.1) + (perpX * amp), cy + (h * 0.1) + (perpY * amp),
            xB + (perpX * amp * 0.2), yB + (perpY * amp * 0.2),
            xB, yB
        );
        path.lineTo(x2, y2);
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    handleStart(e) {
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        
        for (let i = this.loosePieces.length - 1; i >= 0; i--) {
            const p = this.loosePieces[i]; 
            const m = this.tabSize * 2.0; 
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth  + m && 
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                
                this.selectedPiece = p; 
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX; 
                this.dragOffsetY = y - p.currentY;
                
                this.wakeUp();
                this.callbacks.onSound && this.callbacks.onSound('click');
                
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
            
            // [Precision Tech] Destello esmeralda en el borde de la pieza encajada
            this.snapFlashes.push({ piece: this.selectedPiece, startTime: null });
            this.wakeUp(); // Asegurar que el loop está activo para el flash

            this.callbacks.onSound && this.callbacks.onSound('snap');
            this.callbacks.onSnap  && this.callbacks.onSnap();
            
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
        
        this.isDragging = false;
        this.selectedPiece = null;
    }
    
    checkVictory() { 
        if (this.loosePieces.length === 0) { 
            if (this.gridSize < 8) {
                this.spawnParticles(this.logicalWidth / 2, this.logicalHeight / 2, 'confetti'); 
            }
            if (this.callbacks.onSound) this.callbacks.onSound('win'); 
            if (this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500); 
            this.canvas.removeEventListener('mousedown', this.handleStart); 
            this.canvas.removeEventListener('touchstart', this.handleStart); 
        } 
    }

    spawnParticles(x, y, type) {
        if (type === 'ripple') {
            this.particles.push({ type: 'ripple', x, y, radius: 10, alpha: 1.0, color: '#ffffff', lineWidth: 4, speed: 3 });
            this.particles.push({ type: 'ripple', x, y, radius: 5,  alpha: 1.0, color: '#fbbf24', lineWidth: 2, speed: 1.5 });
        } else {
            if (this.particles.length > this.particleLimit) return;
            const count  = 30;
            const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    type: 'confetti', x, y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1.0,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    size: Math.random() * 4 + 2
                });
            }
        }
    }

    updateParticles() {
        if (this.particles.length === 0) return;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            if (p.type === 'ripple') {
                p.radius    += p.speed;
                p.alpha     -= 0.04;
                p.lineWidth *= 0.95;
                if (p.alpha <= 0) {
                    this.particles.splice(i, 1);
                } else {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    this.ctx.strokeStyle   = p.color;
                    this.ctx.lineWidth     = p.lineWidth;
                    this.ctx.globalAlpha   = p.alpha;
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            } else {
                p.x   += p.vx;
                p.y   += p.vy;
                p.vy  += 0.2;
                p.life -= 0.03;
                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                } else {
                    this.ctx.globalAlpha = p.life;
                    this.ctx.fillStyle   = p.color;
                    this.ctx.fillRect(p.x, p.y, p.size, p.size);
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    exportState() {
        return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked }));
    }
    
    importState(s) { 
        if (!s) return; 
        s.forEach(sp => {
            const p = this.pieces.find(x => x.id === sp.id);
            if (p) { p.currentX = sp.cx; p.currentY = sp.cy; p.isLocked = sp.locked; }
        }); 
        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.wakeUp();
    }
    
    togglePreview(a) {
        this.showPreview = a;
        this.wakeUp();
    }
    
    autoPlacePiece() { 
        if (this.loosePieces.length === 0) return false; 
        const p = this.loosePieces[Math.floor(Math.random() * this.loosePieces.length)];
        this.spawnParticles(p.correctX + this.pieceWidth / 2, p.correctY + this.pieceHeight / 2, 'ripple');
        p.currentX  = p.correctX;
        p.currentY  = p.correctY;
        p.isLocked  = true;
        // [Precision Tech] Flash de snap también para el imán
        this.snapFlashes.push({ piece: p, startTime: null });
        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        if (this.callbacks.onSound) this.callbacks.onSound('snap'); 
        this.checkVictory();
        this.wakeUp();
        return true; 
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
        
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.handleResize());
            this._resizeObserver.observe(this.canvas.parentElement);
        }
    }
    
    destroy() {
        this.isLoopRunning = false; 
        this.canvas.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
