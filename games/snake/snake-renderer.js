/**
 * snake-renderer.js
 * LA-Snake Classic — Renderer Module v1.2
 *
 * CHANGES v1.2:
 *   - HiDPI support: window.devicePixelRatio scaling on canvas context
 *   - Snake segments: 1.5px solid stroke, color 20% darker than fill
 *   - Removed all Courier New references — system sans-serif Bold
 *   - Locked skin previews use CSS filter:grayscale(100%) + opacity:0.4
 *   - No glassmorphism / blur effects anywhere
 *
 * Prefix: LAS_
 */

const LAS_Renderer = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS & PALETTE
  // ─────────────────────────────────────────────

  const LAS_CELL = 20; // logical px per grid cell

  // System sans-serif font stack — no monospace
  const LAS_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif';

  const LAS_COLORS = {
    bg:            '#0d0d0d',
    grid:          '#151515',
    food:          '#ff3b30',
    powerupMagnet: '#0a84ff',
    powerupGhost:  '#bf5af2',
    powerupBrake:  '#ffd60a',
    textPrimary:   '#f5f5f5',
    textDim:       '#888888',
    comboBar:      '#ff9f0a',
    comboBg:       '#1a1a1a',
    borderCombo:   '#ff9f0a',
    particle:      '#ffd60a',
  };

  // Skin palette — fill + explicit 20%-darker stroke
  const LAS_SKIN_PALETTES = {
    classic: {
      head:   '#30d158', body:   '#25a244', tail:   '#1a7a33',
      stroke: '#1a6e2e', // 20% darker than body
    },
    neon: {
      head:   '#00ff88', body:   '#00cc66', tail:   '#009944',
      stroke: '#00ff88', // bright for neon "light border" effect
    },
    cyber: {
      head:   '#48cae4', body:   '#0096c7', tail:   '#0077b6',
      stroke: '#005f8f',
    },
    gold: {
      head:   '#ffd60a', body:   '#ffb800', tail:   '#cc9200',
      stroke: '#a37500',
    }
  };

  // ─────────────────────────────────────────────
  // UTILITY: darken hex color by percentage
  // ─────────────────────────────────────────────

  function LAS_darkenHex(hex, pct) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.floor(((n >> 16) & 0xff) * (1 - pct)));
    const g = Math.max(0, Math.floor(((n >>  8) & 0xff) * (1 - pct)));
    const b = Math.max(0, Math.floor(( n        & 0xff) * (1 - pct)));
    return `rgb(${r},${g},${b})`;
  }

  // ─────────────────────────────────────────────
  // SVG ASSET STRINGS
  // ─────────────────────────────────────────────

  const LAS_SVG = {
    food: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <rect x="3" y="5" width="14" height="12" rx="2" fill="#ff3b30"/>
      <rect x="8" y="2" width="2" height="4" rx="1" fill="#25a244"/>
      <rect x="6" y="7" width="8" height="6" rx="1" fill="#ff6259" opacity="0.5"/>
    </svg>`,

    magnet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <path d="M4 4 L4 13 Q4 17 10 17 Q16 17 16 13 L16 4" stroke="#0a84ff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <rect x="2" y="3" width="4" height="5" rx="1" fill="#0a84ff"/>
      <rect x="14" y="3" width="4" height="5" rx="1" fill="#0a84ff"/>
      <rect x="3" y="3" width="2" height="5" fill="#48a8ff"/>
      <rect x="15" y="3" width="2" height="5" fill="#48a8ff"/>
    </svg>`,

    ghost: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <ellipse cx="10" cy="8" rx="6" ry="6" fill="#bf5af2"/>
      <path d="M4 8 L4 17 L6.5 15 L8.5 17 L10 15 L11.5 17 L13.5 15 L16 17 L16 8" fill="#bf5af2"/>
      <circle cx="8" cy="7" r="1.5" fill="#0d0d0d"/>
      <circle cx="12" cy="7" r="1.5" fill="#0d0d0d"/>
    </svg>`,

    brake: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" fill="#ffd60a"/>
      <circle cx="10" cy="10" r="7" fill="#1a1a00"/>
      <circle cx="10" cy="10" r="1.5" fill="#ffd60a"/>
      <line x1="10" y1="10" x2="10" y2="4" stroke="#ffd60a" stroke-width="2" stroke-linecap="round"/>
      <line x1="10" y1="10" x2="14" y2="12" stroke="#ffd60a" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="10" cy="3" r="1" fill="#ffd60a"/>
      <circle cx="10" cy="17" r="1" fill="#ffd60a"/>
      <circle cx="3" cy="10" r="1" fill="#ffd60a"/>
      <circle cx="17" cy="10" r="1" fill="#ffd60a"/>
    </svg>`,

    headRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <rect x="2" y="4" width="16" height="12" rx="3" fill="SKIN_HEAD"/>
      <rect x="3" y="5" width="10" height="10" rx="2" fill="SKIN_BODY"/>
      <circle cx="14" cy="7" r="2" fill="#f5f5f5"/>
      <circle cx="14" cy="7" r="1" fill="#0d0d0d"/>
    </svg>`,

    particle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">
      <polygon points="4,0 8,4 4,8 0,4" fill="#ffd60a"/>
    </svg>`,

    cyberTile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <polygon points="10,2 18,6 18,14 10,18 2,14 2,6" fill="none" stroke="SKIN_OUTLINE" stroke-width="1.5"/>
      <line x1="10" y1="2" x2="10" y2="18" stroke="SKIN_OUTLINE" stroke-width="0.8" opacity="0.5"/>
      <line x1="2" y1="10" x2="18" y2="10" stroke="SKIN_OUTLINE" stroke-width="0.8" opacity="0.5"/>
    </svg>`,
  };

  // ─────────────────────────────────────────────
  // SVG → Image cache
  // ─────────────────────────────────────────────

  const LAS_imgCache = {};

  function LAS_svgToImage(svgStr, size = LAS_CELL) {
    return new Promise((resolve) => {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image(size, size);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function LAS_buildImageCache(skinId) {
    const p = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;

    const headSvg  = LAS_SVG.headRight.replace(/SKIN_HEAD/g, p.head).replace(/SKIN_BODY/g, p.body);
    const cyberSvg = LAS_SVG.cyberTile.replace(/SKIN_OUTLINE/g, p.stroke);

    LAS_imgCache.food     = await LAS_svgToImage(LAS_SVG.food);
    LAS_imgCache.magnet   = await LAS_svgToImage(LAS_SVG.magnet);
    LAS_imgCache.ghost    = await LAS_svgToImage(LAS_SVG.ghost);
    LAS_imgCache.brake    = await LAS_svgToImage(LAS_SVG.brake);
    LAS_imgCache.head     = await LAS_svgToImage(headSvg);
    LAS_imgCache.cyber    = await LAS_svgToImage(cyberSvg);
    LAS_imgCache.particle = await LAS_svgToImage(LAS_SVG.particle, 8);
    LAS_imgCache.skinId   = skinId;
  }

  // ─────────────────────────────────────────────
  // CANVAS SETUP — HiDPI
  // ─────────────────────────────────────────────

  let LAS_canvas  = null;
  let LAS_ctx     = null;
  let LAS_cols    = 0;
  let LAS_rows    = 0;
  let LAS_dpr     = 1; // device pixel ratio

  function LAS_initCanvas(canvasEl, cols, rows) {
    LAS_canvas = canvasEl;
    LAS_ctx    = canvasEl.getContext('2d');
    LAS_cols   = cols;
    LAS_rows   = rows;

    // ── HiDPI scaling ──
    LAS_dpr = window.devicePixelRatio || 1;
    const logicalW = cols * LAS_CELL;
    const logicalH = rows * LAS_CELL;

    // Physical pixels
    canvasEl.width  = logicalW * LAS_dpr;
    canvasEl.height = logicalH * LAS_dpr;

    // CSS display size stays logical
    canvasEl.style.width  = logicalW + 'px';
    canvasEl.style.height = logicalH + 'px';

    // Scale context so all draw calls use logical coordinates
    LAS_ctx.scale(LAS_dpr, LAS_dpr);
  }

  // ─────────────────────────────────────────────
  // PARTICLE SYSTEM (Gold skin)
  // ─────────────────────────────────────────────

  const LAS_particles = [];

  function LAS_spawnParticles(x, y) {
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
      LAS_particles.push({
        x: x * LAS_CELL + LAS_CELL / 2,
        y: y * LAS_CELL + LAS_CELL / 2,
        vx: Math.cos(angle) * (1.5 + Math.random() * 2),
        vy: Math.sin(angle) * (1.5 + Math.random() * 2),
        life: 1.0,
        decay: 0.04 + Math.random() * 0.03
      });
    }
  }

  function LAS_updateParticles() {
    for (let i = LAS_particles.length - 1; i >= 0; i--) {
      const p = LAS_particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      if (p.life <= 0) LAS_particles.splice(i, 1);
    }
  }

  function LAS_drawParticles() {
    if (!LAS_imgCache.particle) return;
    LAS_particles.forEach(p => {
      LAS_ctx.globalAlpha = p.life;
      LAS_ctx.drawImage(LAS_imgCache.particle, p.x - 4, p.y - 4, 8, 8);
    });
    LAS_ctx.globalAlpha = 1;
  }

  // ─────────────────────────────────────────────
  // DRAW: GRID
  // ─────────────────────────────────────────────

  function LAS_drawGrid() {
    LAS_ctx.fillStyle = LAS_COLORS.bg;
    LAS_ctx.fillRect(0, 0, LAS_cols * LAS_CELL, LAS_rows * LAS_CELL);
    LAS_ctx.strokeStyle = LAS_COLORS.grid;
    LAS_ctx.lineWidth   = 0.5;
    for (let x = 0; x <= LAS_cols; x++) {
      LAS_ctx.beginPath();
      LAS_ctx.moveTo(x * LAS_CELL, 0);
      LAS_ctx.lineTo(x * LAS_CELL, LAS_rows * LAS_CELL);
      LAS_ctx.stroke();
    }
    for (let y = 0; y <= LAS_rows; y++) {
      LAS_ctx.beginPath();
      LAS_ctx.moveTo(0, y * LAS_CELL);
      LAS_ctx.lineTo(LAS_cols * LAS_CELL, y * LAS_CELL);
      LAS_ctx.stroke();
    }
  }

  // ─────────────────────────────────────────────
  // DRAW: SNAKE SEGMENT
  //   Every segment gets:
  //     - Solid fill by skin palette
  //     - 1.5px stroke using a color 20% darker than fill (flat design)
  // ─────────────────────────────────────────────

  function LAS_drawSegment(seg, index, skinId, direction) {
    const p  = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;
    const px = seg.x * LAS_CELL;
    const py = seg.y * LAS_CELL;
    const c  = LAS_ctx;
    const inset = 1;

    if (index === 0) {
      // HEAD: SVG rotated to face direction
      const rotMap = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
      const rot = rotMap[direction] || 0;
      c.save();
      c.translate(px + LAS_CELL / 2, py + LAS_CELL / 2);
      c.rotate(rot);
      if (LAS_imgCache.head) {
        c.drawImage(LAS_imgCache.head, -LAS_CELL / 2, -LAS_CELL / 2, LAS_CELL, LAS_CELL);
      } else {
        c.fillStyle = p.head;
        c.fillRect(-LAS_CELL / 2, -LAS_CELL / 2, LAS_CELL, LAS_CELL);
      }
      c.restore();
      return;
    }

    const fill   = index < 3 ? p.body : p.tail;
    const stroke = p.stroke || LAS_darkenHex(fill, 0.20);
    const rx = px + inset;
    const ry = py + inset;
    const rw = LAS_CELL - inset * 2;
    const rh = LAS_CELL - inset * 2;

    if (skinId === 'neon') {
      c.fillStyle = fill;
      c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = stroke; // bright outline
      c.lineWidth = 1.5;
      c.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);

    } else if (skinId === 'cyber') {
      c.fillStyle = fill;
      c.fillRect(rx, ry, rw, rh);
      // Geometric overlay
      if (LAS_imgCache.cyber) {
        c.globalAlpha = 0.7;
        c.drawImage(LAS_imgCache.cyber, px, py, LAS_CELL, LAS_CELL);
        c.globalAlpha = 1;
      }
      // 1.5px stroke on top
      c.strokeStyle = stroke;
      c.lineWidth = 1.5;
      c.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);

    } else if (skinId === 'gold') {
      c.fillStyle = fill;
      c.fillRect(rx, ry, rw, rh);
      // Specular highlight strip
      c.fillStyle = 'rgba(255,255,200,0.25)';
      c.fillRect(rx + 1, ry + 1, rw - 2, 3);
      // 1.5px stroke
      c.strokeStyle = stroke;
      c.lineWidth = 1.5;
      c.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);

    } else {
      // Classic — solid fill + 1.5px darker stroke
      c.fillStyle = fill;
      c.fillRect(rx, ry, rw, rh);
      c.strokeStyle = stroke;
      c.lineWidth = 1.5;
      c.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
    }
  }

  // ─────────────────────────────────────────────
  // DRAW: FOOD & POWER-UPS
  // ─────────────────────────────────────────────

  function LAS_drawFood(food) {
    if (LAS_imgCache.food) {
      LAS_ctx.drawImage(LAS_imgCache.food, food.x * LAS_CELL, food.y * LAS_CELL, LAS_CELL, LAS_CELL);
    } else {
      LAS_ctx.fillStyle = LAS_COLORS.food;
      LAS_ctx.fillRect(food.x * LAS_CELL + 2, food.y * LAS_CELL + 2, LAS_CELL - 4, LAS_CELL - 4);
    }
  }

  function LAS_drawPowerup(item) {
    const imgMap = { magnet: 'magnet', ghost: 'ghost', brake: 'brake' };
    const imgKey = imgMap[item.type];
    if (imgKey && LAS_imgCache[imgKey]) {
      LAS_ctx.drawImage(LAS_imgCache[imgKey], item.x * LAS_CELL, item.y * LAS_CELL, LAS_CELL, LAS_CELL);
    } else {
      const colorMap = { magnet: LAS_COLORS.powerupMagnet, ghost: LAS_COLORS.powerupGhost, brake: LAS_COLORS.powerupBrake };
      LAS_ctx.fillStyle = colorMap[item.type] || '#888';
      LAS_ctx.fillRect(item.x * LAS_CELL + 2, item.y * LAS_CELL + 2, LAS_CELL - 4, LAS_CELL - 4);
    }
    // Pulsing solid outline (no blur)
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    LAS_ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.4})`;
    LAS_ctx.lineWidth   = 1.5;
    LAS_ctx.strokeRect(item.x * LAS_CELL + 1, item.y * LAS_CELL + 1, LAS_CELL - 2, LAS_CELL - 2);
  }

  // ─────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────

  function LAS_render(state, skinId, comboBorderActive) {
    if (!LAS_ctx) return;

    LAS_drawGrid();

    // Combo border — solid 4px outline, no blur
    if (comboBorderActive) {
      LAS_ctx.strokeStyle = LAS_COLORS.borderCombo;
      LAS_ctx.lineWidth   = 4;
      LAS_ctx.strokeRect(2, 2, LAS_cols * LAS_CELL - 4, LAS_rows * LAS_CELL - 4);
    }

    if (state.food) LAS_drawFood(state.food);
    if (state.powerups) state.powerups.forEach(p => LAS_drawPowerup(p));

    // Draw tail → head for correct layering
    for (let i = state.snake.length - 1; i >= 0; i--) {
      LAS_drawSegment(state.snake[i], i, skinId, state.direction);
    }

    if (skinId === 'gold') {
      LAS_updateParticles();
      LAS_drawParticles();
    }

    // Active power-up progress strip (top edge)
    if (state.activePowerup) {
      const progress = state.activePowerup.remaining / state.activePowerup.duration;
      const colorMap = { magnet: LAS_COLORS.powerupMagnet, ghost: LAS_COLORS.powerupGhost, brake: LAS_COLORS.powerupBrake };
      LAS_ctx.fillStyle = colorMap[state.activePowerup.type] || '#888';
      LAS_ctx.fillRect(0, 0, LAS_cols * LAS_CELL * progress, 4);
    }
  }

  // ─────────────────────────────────────────────
  // OVERLAY TEXT — uses system sans-serif
  // ─────────────────────────────────────────────

  function LAS_drawOverlayBase(alpha = 0.85) {
    LAS_ctx.fillStyle = `rgba(13,13,13,${alpha})`;
    LAS_ctx.fillRect(0, 0, LAS_cols * LAS_CELL, LAS_rows * LAS_CELL);
  }

  function LAS_drawText(text, x, y, fontSize = 14, color = LAS_COLORS.textPrimary, align = 'center') {
    LAS_ctx.font         = `700 ${fontSize}px ${LAS_FONT_STACK}`;
    LAS_ctx.fillStyle    = color;
    LAS_ctx.textAlign    = align;
    LAS_ctx.textBaseline = 'middle';
    LAS_ctx.fillText(text, x, y);
  }

  function LAS_drawPauseScreen() {
    const cx = LAS_cols * LAS_CELL / 2;
    const cy = LAS_rows * LAS_CELL / 2;
    LAS_drawOverlayBase(0.7);
    LAS_drawText('PAUSED',       cx, cy - 12, 22, LAS_COLORS.textPrimary);
    LAS_drawText('TAP TO RESUME',cx, cy + 16, 11, LAS_COLORS.textDim);
  }

  function LAS_drawGameOverScreen(score, highScore, isNewRecord) {
    const cx = LAS_cols * LAS_CELL / 2;
    const cy = LAS_rows * LAS_CELL / 2;
    LAS_drawOverlayBase(0.88);
    LAS_drawText('GAME OVER',       cx, cy - 40, 20, '#ff3b30');
    LAS_drawText(`SCORE: ${score}`,  cx, cy - 10, 14, LAS_COLORS.textPrimary);
    if (isNewRecord) {
      LAS_drawText('NEW RECORD!',    cx, cy + 14, 12, LAS_COLORS.comboBar);
    } else {
      LAS_drawText(`BEST: ${highScore}`, cx, cy + 14, 12, LAS_COLORS.textDim);
    }
    LAS_drawText('TAP TO PLAY AGAIN', cx, cy + 38, 10, LAS_COLORS.textDim);
  }

  function LAS_drawCountdown(n) {
    const cx = LAS_cols * LAS_CELL / 2;
    const cy = LAS_rows * LAS_CELL / 2;
    LAS_drawOverlayBase(0.5);
    LAS_drawText(n > 0 ? String(n) : 'GO!', cx, cy, 40, LAS_COLORS.textPrimary);
  }

  // ─────────────────────────────────────────────
  // SKIN PREVIEW (for menu selector)
  //   Locked: CSS filter grayscale(100%) + opacity on the canvas element
  //   Called from UI — sets canvas style after drawing
  // ─────────────────────────────────────────────

  function LAS_drawSkinPreview(canvasEl, skinId, locked = false) {
    const c = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    const p = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;

    c.clearRect(0, 0, w, h);
    c.fillStyle = '#0d0d0d';
    c.fillRect(0, 0, w, h);

    const cell  = 10;
    const total = 5;
    const startX = Math.floor((w - total * cell) / 2);
    const startY = Math.floor((h - cell) / 2);

    for (let i = total - 1; i >= 0; i--) {
      const fill   = i === 0 ? p.head : (i < 2 ? p.body : p.tail);
      const stroke = p.stroke || LAS_darkenHex(fill, 0.20);

      c.fillStyle = fill;
      c.fillRect(startX + i * cell + 1, startY + 1, cell - 2, cell - 2);
      c.strokeStyle = stroke;
      c.lineWidth   = 1;
      c.strokeRect(startX + i * cell + 1.5, startY + 1.5, cell - 3, cell - 3);
    }

    // Apply locked style via CSS filter on the element — no blur
    if (locked) {
      canvasEl.style.filter  = 'grayscale(100%)';
      canvasEl.style.opacity = '0.4';
    } else {
      canvasEl.style.filter  = '';
      canvasEl.style.opacity = '1';
    }
  }

  // ─────────────────────────────────────────────
  // GOLD PARTICLES — exposed for core callback
  // ─────────────────────────────────────────────

  function LAS_triggerTurnParticles(x, y) {
    LAS_spawnParticles(x, y);
  }

  return {
    CELL:                 LAS_CELL,
    COLORS:               LAS_COLORS,
    initCanvas:           LAS_initCanvas,
    buildImageCache:      LAS_buildImageCache,
    render:               LAS_render,
    drawPauseScreen:      LAS_drawPauseScreen,
    drawGameOverScreen:   LAS_drawGameOverScreen,
    drawCountdown:        LAS_drawCountdown,
    drawSkinPreview:      LAS_drawSkinPreview,
    triggerTurnParticles: LAS_triggerTurnParticles,
    getSkinPalettes:      () => LAS_SKIN_PALETTES,
  };
})();
