/**
 * snake-renderer.js
 * LA-Snake Classic — Renderer Module
 * Canvas-based rendering with SVG assets.
 * Flat design — zero glassmorphism, solid colors only.
 * Prefix: LAS_
 */

const LAS_Renderer = (() => {

  // ─────────────────────────────────────────────
  // CONSTANTS & PALETTE
  // ─────────────────────────────────────────────

  const LAS_CELL = 20; // px per grid cell

  const LAS_COLORS = {
    bg:           '#0d0d0d',
    grid:         '#151515',
    food:         '#ff3b30',
    foodDark:     '#cc2a20',
    powerupMagnet:'#0a84ff',
    powerupGhost: '#bf5af2',
    powerupBrake: '#ffd60a',
    textPrimary:  '#f5f5f5',
    textDim:      '#888888',
    comboBar:     '#ff9f0a',
    comboBg:      '#1a1a1a',
    borderCombo:  '#ff9f0a',
    particle:     '#ffd60a',
  };

  // Skin palette definitions
  const LAS_SKIN_PALETTES = {
    classic: {
      head:    '#30d158',
      body:    '#25a244',
      tail:    '#1a7a33',
      outline: '#0d3d1a',
    },
    neon: {
      head:    '#00ff88',
      body:    '#00cc66',
      tail:    '#009944',
      outline: '#00ff88', // bright outline for neon effect
    },
    cyber: {
      head:    '#48cae4',
      body:    '#0096c7',
      tail:    '#0077b6',
      outline: '#90e0ef',
    },
    gold: {
      head:    '#ffd60a',
      body:    '#ffb800',
      tail:    '#cc9200',
      outline: '#fff5b4',
    }
  };

  // ─────────────────────────────────────────────
  // SVG ASSET STRINGS
  // ─────────────────────────────────────────────

  const LAS_SVG = {

    // Food — bright red apple silhouette
    food: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <rect x="3" y="5" width="14" height="12" rx="2" fill="#ff3b30"/>
      <rect x="8" y="2" width="2" height="4" rx="1" fill="#25a244"/>
      <rect x="6" y="7" width="8" height="6" rx="1" fill="#ff6259" opacity="0.5"/>
    </svg>`,

    // Power-up Magnet — U shape
    magnet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <path d="M4 4 L4 13 Q4 17 10 17 Q16 17 16 13 L16 4" stroke="#0a84ff" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <rect x="2" y="3" width="4" height="5" rx="1" fill="#0a84ff"/>
      <rect x="14" y="3" width="4" height="5" rx="1" fill="#0a84ff"/>
      <rect x="3" y="3" width="2" height="5" fill="#48a8ff"/>
      <rect x="15" y="3" width="2" height="5" fill="#48a8ff"/>
    </svg>`,

    // Power-up Ghost — cape/cloak shape
    ghost: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <ellipse cx="10" cy="8" rx="6" ry="6" fill="#bf5af2"/>
      <path d="M4 8 L4 17 L6.5 15 L8.5 17 L10 15 L11.5 17 L13.5 15 L16 17 L16 8" fill="#bf5af2"/>
      <circle cx="8" cy="7" r="1.5" fill="#0d0d0d"/>
      <circle cx="12" cy="7" r="1.5" fill="#0d0d0d"/>
    </svg>`,

    // Power-up Brake — clock face
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

    // Snake head facing right — used as base, rotated by renderer
    headRight: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <rect x="2" y="4" width="16" height="12" rx="3" fill="SKIN_HEAD"/>
      <rect x="3" y="5" width="10" height="10" rx="2" fill="SKIN_BODY"/>
      <circle cx="14" cy="7" r="2" fill="#f5f5f5"/>
      <circle cx="14" cy="7" r="1" fill="#0d0d0d"/>
    </svg>`,

    // Gold Edition particle (small diamond)
    particle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">
      <polygon points="4,0 8,4 4,8 0,4" fill="#ffd60a"/>
    </svg>`,

    // Cyber scale tile (body segment overlay)
    cyberTile: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
      <polygon points="10,2 18,6 18,14 10,18 2,14 2,6" fill="none" stroke="SKIN_OUTLINE" stroke-width="1.5"/>
      <line x1="10" y1="2" x2="10" y2="18" stroke="SKIN_OUTLINE" stroke-width="0.8" opacity="0.5"/>
      <line x1="2" y1="10" x2="18" y2="10" stroke="SKIN_OUTLINE" stroke-width="0.8" opacity="0.5"/>
    </svg>`,
  };

  // ─────────────────────────────────────────────
  // SVG → Image Cache
  // ─────────────────────────────────────────────

  const LAS_imgCache = {};

  function LAS_svgToImage(svgStr, size = LAS_CELL) {
    return new Promise((resolve) => {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url  = URL.createObjectURL(blob);
      const img  = new Image(size, size);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function LAS_buildImageCache(skinId) {
    const palette = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;

    const headSvg = LAS_SVG.headRight
      .replace(/SKIN_HEAD/g, palette.head)
      .replace(/SKIN_BODY/g, palette.body);

    const cyberSvg = LAS_SVG.cyberTile
      .replace(/SKIN_OUTLINE/g, palette.outline);

    LAS_imgCache.food    = await LAS_svgToImage(LAS_SVG.food);
    LAS_imgCache.magnet  = await LAS_svgToImage(LAS_SVG.magnet);
    LAS_imgCache.ghost   = await LAS_svgToImage(LAS_SVG.ghost);
    LAS_imgCache.brake   = await LAS_svgToImage(LAS_SVG.brake);
    LAS_imgCache.head    = await LAS_svgToImage(headSvg);
    LAS_imgCache.cyber   = await LAS_svgToImage(cyberSvg);
    LAS_imgCache.particle = await LAS_svgToImage(LAS_SVG.particle, 8);
    LAS_imgCache.skinId  = skinId;
  }

  // ─────────────────────────────────────────────
  // CANVAS SETUP
  // ─────────────────────────────────────────────

  let LAS_canvas = null;
  let LAS_ctx    = null;
  let LAS_cols   = 0;
  let LAS_rows   = 0;

  function LAS_initCanvas(canvasEl, cols, rows) {
    LAS_canvas = canvasEl;
    LAS_ctx    = canvasEl.getContext('2d');
    LAS_cols   = cols;
    LAS_rows   = rows;
    canvasEl.width  = cols * LAS_CELL;
    canvasEl.height = rows * LAS_CELL;
  }

  // ─────────────────────────────────────────────
  // PARTICLE SYSTEM (Gold skin only)
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
      p.x   += p.vx;
      p.y   += p.vy;
      p.life -= p.decay;
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
  // DRAW FUNCTIONS
  // ─────────────────────────────────────────────

  function LAS_drawGrid() {
    LAS_ctx.fillStyle = LAS_COLORS.bg;
    LAS_ctx.fillRect(0, 0, LAS_canvas.width, LAS_canvas.height);

    LAS_ctx.strokeStyle = LAS_COLORS.grid;
    LAS_ctx.lineWidth = 0.5;
    for (let x = 0; x <= LAS_cols; x++) {
      LAS_ctx.beginPath();
      LAS_ctx.moveTo(x * LAS_CELL, 0);
      LAS_ctx.lineTo(x * LAS_CELL, LAS_canvas.height);
      LAS_ctx.stroke();
    }
    for (let y = 0; y <= LAS_rows; y++) {
      LAS_ctx.beginPath();
      LAS_ctx.moveTo(0, y * LAS_CELL);
      LAS_ctx.lineTo(LAS_canvas.width, y * LAS_CELL);
      LAS_ctx.stroke();
    }
  }

  /**
   * Draw the snake body segment
   * @param {object} seg - {x, y}
   * @param {number} index - 0 = head
   * @param {string} skinId
   * @param {string} direction - 'up'|'down'|'left'|'right'
   */
  function LAS_drawSegment(seg, index, skinId, direction, prevSeg, nextSeg) {
    const palette = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;
    const px = seg.x * LAS_CELL;
    const py = seg.y * LAS_CELL;
    const c  = LAS_ctx;

    if (index === 0) {
      // HEAD — draw SVG image rotated to face direction
      const rotMap = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
      const rot = rotMap[direction] || 0;
      c.save();
      c.translate(px + LAS_CELL / 2, py + LAS_CELL / 2);
      c.rotate(rot);
      if (LAS_imgCache.head) {
        c.drawImage(LAS_imgCache.head, -LAS_CELL / 2, -LAS_CELL / 2, LAS_CELL, LAS_CELL);
      } else {
        c.fillStyle = palette.head;
        c.fillRect(-LAS_CELL / 2, -LAS_CELL / 2, LAS_CELL, LAS_CELL);
      }
      c.restore();
      return;
    }

    // BODY SEGMENTS
    const color = index < 3 ? palette.body : palette.tail;

    if (skinId === 'neon') {
      // Neon Pulse: solid segment + bright outline border
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, LAS_CELL - 2, LAS_CELL - 2);
      c.strokeStyle = palette.outline;
      c.lineWidth = 2;
      c.strokeRect(px + 2, py + 2, LAS_CELL - 4, LAS_CELL - 4);

    } else if (skinId === 'cyber') {
      // Cyber Scale: solid base + geometric overlay
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, LAS_CELL - 2, LAS_CELL - 2);
      if (LAS_imgCache.cyber) {
        c.globalAlpha = 0.7;
        c.drawImage(LAS_imgCache.cyber, px, py, LAS_CELL, LAS_CELL);
        c.globalAlpha = 1;
      }

    } else if (skinId === 'gold') {
      // Gold Edition: solid gold
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, LAS_CELL - 2, LAS_CELL - 2);
      // Specular highlight strip
      c.fillStyle = palette.outline;
      c.fillRect(px + 2, py + 2, LAS_CELL - 4, 3);

    } else {
      // Classic Green: simple solid rect
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, LAS_CELL - 2, LAS_CELL - 2);
      c.strokeStyle = palette.outline;
      c.lineWidth = 1;
      c.strokeRect(px + 1.5, py + 1.5, LAS_CELL - 3, LAS_CELL - 3);
    }
  }

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
      // Fallback colored rectangle
      const colorMap = {
        magnet: LAS_COLORS.powerupMagnet,
        ghost:  LAS_COLORS.powerupGhost,
        brake:  LAS_COLORS.powerupBrake
      };
      LAS_ctx.fillStyle = colorMap[item.type] || '#888';
      LAS_ctx.fillRect(item.x * LAS_CELL + 2, item.y * LAS_CELL + 2, LAS_CELL - 4, LAS_CELL - 4);
    }

    // Pulsing outline animation
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    LAS_ctx.strokeStyle = `rgba(255,255,255,${0.3 + pulse * 0.4})`;
    LAS_ctx.lineWidth = 1.5;
    LAS_ctx.strokeRect(item.x * LAS_CELL + 1, item.y * LAS_CELL + 1, LAS_CELL - 2, LAS_CELL - 2);
  }

  /**
   * Main render call for each frame
   * @param {object} state - from LAS_Core.getState()
   * @param {string} skinId
   * @param {boolean} comboBorderActive
   * @param {number} comboBorderColor
   */
  function LAS_render(state, skinId, comboBorderActive) {
    if (!LAS_ctx) return;

    LAS_drawGrid();

    // Combo border glow (solid, no blur — flat design)
    if (comboBorderActive) {
      LAS_ctx.strokeStyle = LAS_COLORS.borderCombo;
      LAS_ctx.lineWidth = 4;
      LAS_ctx.strokeRect(2, 2, LAS_canvas.width - 4, LAS_canvas.height - 4);
    }

    // Draw items
    if (state.food) LAS_drawFood(state.food);
    if (state.powerups) {
      state.powerups.forEach(p => LAS_drawPowerup(p));
    }

    // Draw snake body (tail → head for correct layering)
    const snake = state.snake;
    for (let i = snake.length - 1; i >= 0; i--) {
      LAS_drawSegment(
        snake[i],
        i,
        skinId,
        state.direction,
        snake[i - 1] || null,
        snake[i + 1] || null
      );
    }

    // Gold skin: update & draw particles
    if (skinId === 'gold') {
      LAS_updateParticles();
      LAS_drawParticles();
    }

    // Active power-up indicator bar (top strip)
    if (state.activePowerup) {
      const progress = state.activePowerup.remaining / state.activePowerup.duration;
      const colorMap = {
        magnet: LAS_COLORS.powerupMagnet,
        ghost:  LAS_COLORS.powerupGhost,
        brake:  LAS_COLORS.powerupBrake
      };
      LAS_ctx.fillStyle = colorMap[state.activePowerup.type] || '#888';
      LAS_ctx.fillRect(0, 0, LAS_canvas.width * progress, 4);
    }
  }

  // ─────────────────────────────────────────────
  // OVERLAY SCREENS (on the same canvas)
  // ─────────────────────────────────────────────

  function LAS_drawOverlayBase(alpha = 0.85) {
    LAS_ctx.fillStyle = `rgba(13,13,13,${alpha})`;
    LAS_ctx.fillRect(0, 0, LAS_canvas.width, LAS_canvas.height);
  }

  function LAS_drawText(text, x, y, fontSize = 14, color = LAS_COLORS.textPrimary, align = 'center') {
    LAS_ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    LAS_ctx.fillStyle = color;
    LAS_ctx.textAlign = align;
    LAS_ctx.textBaseline = 'middle';
    LAS_ctx.fillText(text, x, y);
  }

  function LAS_drawPauseScreen() {
    LAS_drawOverlayBase(0.7);
    const cx = LAS_canvas.width / 2;
    const cy = LAS_canvas.height / 2;
    LAS_drawText('PAUSED', cx, cy - 12, 22, LAS_COLORS.textPrimary);
    LAS_drawText('TAP TO RESUME', cx, cy + 16, 11, LAS_COLORS.textDim);
  }

  function LAS_drawGameOverScreen(score, highScore, isNewRecord) {
    LAS_drawOverlayBase(0.88);
    const cx = LAS_canvas.width / 2;
    const cy = LAS_canvas.height / 2;
    LAS_drawText('GAME OVER', cx, cy - 40, 20, '#ff3b30');
    LAS_drawText(`SCORE: ${score}`, cx, cy - 10, 14, LAS_COLORS.textPrimary);
    if (isNewRecord) {
      LAS_drawText('NEW RECORD!', cx, cy + 14, 12, LAS_COLORS.comboBar);
    } else {
      LAS_drawText(`BEST: ${highScore}`, cx, cy + 14, 12, LAS_COLORS.textDim);
    }
    LAS_drawText('TAP TO PLAY AGAIN', cx, cy + 38, 10, LAS_COLORS.textDim);
  }

  function LAS_drawCountdown(n) {
    LAS_drawOverlayBase(0.5);
    const cx = LAS_canvas.width / 2;
    const cy = LAS_canvas.height / 2;
    LAS_drawText(n > 0 ? String(n) : 'GO!', cx, cy, 36, LAS_COLORS.textPrimary);
  }

  // ─────────────────────────────────────────────
  // SKIN PREVIEW (for menu carousel)
  // ─────────────────────────────────────────────

  function LAS_drawSkinPreview(canvasEl, skinId, locked = false) {
    const c = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    const palette = LAS_SKIN_PALETTES[skinId] || LAS_SKIN_PALETTES.classic;

    // Background
    c.fillStyle = locked ? '#1a1a1a' : '#0d0d0d';
    c.fillRect(0, 0, w, h);

    // Draw a mini snake preview (5 segments)
    const cell = 10;
    const startX = w / 2 - 2 * cell;
    const startY = h / 2 - cell / 2;

    for (let i = 4; i >= 0; i--) {
      const color = i === 0 ? palette.head : (i < 2 ? palette.body : palette.tail);
      c.fillStyle = locked ? '#333' : color;
      c.fillRect(startX + i * cell + 1, startY + 1, cell - 2, cell - 2);
    }

    if (locked) {
      c.fillStyle = '#555';
      c.font = 'bold 10px "Courier New"';
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillText('LOCKED', w / 2, h - 4);
    }
  }

  // ─────────────────────────────────────────────
  // TRIGGER GOLD PARTICLES (called by core on direction change)
  // ─────────────────────────────────────────────

  function LAS_triggerTurnParticles(x, y) {
    LAS_spawnParticles(x, y);
  }

  return {
    CELL:              LAS_CELL,
    COLORS:            LAS_COLORS,
    initCanvas:        LAS_initCanvas,
    buildImageCache:   LAS_buildImageCache,
    render:            LAS_render,
    drawPauseScreen:   LAS_drawPauseScreen,
    drawGameOverScreen:LAS_drawGameOverScreen,
    drawCountdown:     LAS_drawCountdown,
    drawSkinPreview:   LAS_drawSkinPreview,
    triggerTurnParticles: LAS_triggerTurnParticles,
    getSkinPalettes:   () => LAS_SKIN_PALETTES,
  };
})();
