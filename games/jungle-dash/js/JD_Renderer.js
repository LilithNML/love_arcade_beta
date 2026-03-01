/**
 * JD_Renderer.js — Jungle Dash | Motor de Renderizado
 * Canvas 2D responsivo 16:9. Parallax de 4 capas. Transiciones de bioma.
 * Fallback procedural completo si los assets no cargan.
 *
 * v1.3.0 — Renderizado de Super Monedas (JD_drawSuperCoins):
 *   Sprite: JD_item_supercoin.webp. Fallback: círculo dorado con halo y estrella
 *   central para distinguirla visualmente de la moneda normal.
 */

const JD_Renderer = (() => {

    // ── Variables de canvas ───────────────────────────────────────────────────
    let JD_canvas      = null;
    let JD_ctx         = null;

    // ── Sistema de coordenadas virtuales ─────────────────────────────────────
    const JD_VIRT_W    = 800;
    const JD_VIRT_H    = 450;
    const JD_GROUND_Y  = 375;   // línea de suelo virtual

    let JD_scaleX      = 1;
    let JD_scaleY      = 1;
    let JD_offsetX     = 0;
    let JD_offsetY     = 0;

    // ── Parallax: offsets de cada capa ────────────────────────────────────────
    //   Layer 0 = Cielo      (más lento, factor 0.08)
    //   Layer 1 = Ruinas     (factor 0.25)
    //   Layer 2 = Selva Media(factor 0.55)
    //   Layer 3 = Suelo base (factor 1.0)
    const JD_LAYER_SPEED = [0.08, 0.25, 0.55, 1.0];
    const JD_layerOffset = [0, 0, 0, 0];

    // Imágenes de fondo (cargadas con fallback)
    const JD_bgImages  = [null, null, null, null];
    const JD_bgPaths   = [
        './assets/sprites/JD_bg_layer0.webp',
        './assets/sprites/JD_bg_layer1.webp',
        './assets/sprites/JD_bg_layer2.webp',
        './assets/sprites/JD_bg_layer3.webp',
    ];

    // ── Biomas ────────────────────────────────────────────────────────────────
    const JD_BIOMES = [
        {   // Selva Densa (0 – 1999)
            sky:       ['#0d2b1a', '#1a5c35'],
            mid:       '#0f3d22',
            ground:    '#1a3a0a',
            accent:    '#2e8b57',
            treeColor: '#1a5c2a',
            fogColor:  'rgba(20, 80, 40, 0.18)',
            label:     'Selva Densa'
        },
        {   // Cueva Ancestral (2000 – 3999)
            sky:       ['#0a0a1a', '#1c1040'],
            mid:       '#150d30',
            ground:    '#1a0d30',
            accent:    '#7b2d8b',
            treeColor: '#2d1a50',
            fogColor:  'rgba(80, 20, 120, 0.22)',
            label:     'Cueva Ancestral'
        },
        {   // Riberas (4000+)
            sky:       ['#072a3d', '#0e5272'],
            mid:       '#0a3d5c',
            ground:    '#0a2a40',
            accent:    '#00a8cc',
            treeColor: '#0a4a6b',
            fogColor:  'rgba(0, 150, 200, 0.18)',
            label:     'Riberas'
        }
    ];

    function JD_getBiome(score) {
        if (score < 2000) return 0;
        if (score < 4000) return 1;
        return 2;
    }

    // Interpolación de color hex entre dos biomas
    function JD_lerpColor(a, b, t) {
        const JD_ah = parseInt(a.slice(1), 16);
        const JD_bh = parseInt(b.slice(1), 16);
        const JD_r  = Math.round(((JD_ah >> 16) & 0xff) * (1-t) + ((JD_bh >> 16) & 0xff) * t);
        const JD_g  = Math.round(((JD_ah >> 8)  & 0xff) * (1-t) + ((JD_bh >> 8)  & 0xff) * t);
        const JD_bl2= Math.round(( JD_ah        & 0xff) * (1-t) + ( JD_bh        & 0xff) * t);
        return `#${JD_r.toString(16).padStart(2,'0')}${JD_g.toString(16).padStart(2,'0')}${JD_bl2.toString(16).padStart(2,'0')}`;
    }

    function JD_getBlendedBiome(score) {
        const JD_idx      = JD_getBiome(score);
        const JD_next     = Math.min(JD_idx + 1, JD_BIOMES.length - 1);
        const JD_boundary = JD_idx * 2000;
        const JD_range    = 400; // zona de transición de 400 pts
        const JD_elapsed  = score - JD_boundary;
        const JD_t        = JD_idx < JD_BIOMES.length - 1
            ? Math.min(1, Math.max(0, (JD_elapsed - (2000 - JD_range)) / JD_range))
            : 0;

        if (JD_t === 0) return JD_BIOMES[JD_idx];

        // Mezclar propiedades
        const JD_A = JD_BIOMES[JD_idx];
        const JD_B = JD_BIOMES[JD_next];
        return {
            sky:       [JD_lerpColor(JD_A.sky[0], JD_B.sky[0], JD_t), JD_lerpColor(JD_A.sky[1], JD_B.sky[1], JD_t)],
            mid:       JD_lerpColor(JD_A.mid,       JD_B.mid,       JD_t),
            ground:    JD_lerpColor(JD_A.ground,    JD_B.ground,    JD_t),
            accent:    JD_lerpColor(JD_A.accent,    JD_B.accent,    JD_t),
            treeColor: JD_lerpColor(JD_A.treeColor, JD_B.treeColor, JD_t),
            fogColor:  JD_A.fogColor,
            label:     JD_A.label
        };
    }

    // ── Carga de imágenes de fondo ────────────────────────────────────────────
    function JD_loadBgImages() {
        JD_bgPaths.forEach((JD_path, i) => {
            const JD_img = new Image();
            const JD_timer = setTimeout(() => {
                console.warn(`[JD] Timeout bg layer ${i} — modo fallback procedural activo.`);
            }, 5000);
            JD_img.onload  = () => { clearTimeout(JD_timer); JD_bgImages[i] = JD_img; };
            JD_img.onerror = () => { clearTimeout(JD_timer); };
            JD_img.src = JD_path;
        });
    }

    // ── Ajuste del canvas al viewport (letterbox 16:9) ───────────────────────
    function JD_resize() {
        const JD_vw = window.innerWidth;
        const JD_vh = window.innerHeight;
        const JD_ratio = JD_VIRT_W / JD_VIRT_H;

        let JD_cw, JD_ch;
        if (JD_vw / JD_vh > JD_ratio) {
            JD_ch = JD_vh;
            JD_cw = JD_vh * JD_ratio;
        } else {
            JD_cw = JD_vw;
            JD_ch = JD_vw / JD_ratio;
        }

        JD_canvas.width  = JD_VIRT_W;
        JD_canvas.height = JD_VIRT_H;
        JD_canvas.style.width  = JD_cw + 'px';
        JD_canvas.style.height = JD_ch + 'px';
        JD_canvas.style.left   = ((JD_vw - JD_cw) / 2) + 'px';
        JD_canvas.style.top    = ((JD_vh - JD_ch) / 2) + 'px';

        JD_scaleX  = JD_cw / JD_VIRT_W;
        JD_scaleY  = JD_ch / JD_VIRT_H;
        JD_offsetX = (JD_vw - JD_cw) / 2;
        JD_offsetY = (JD_vh - JD_ch) / 2;
    }

    // ── Renderizado de capa parallax procedural ───────────────────────────────
    function JD_drawParallaxLayer(layer, biome, offset) {
        const JD_c  = JD_ctx;
        const JD_w  = JD_VIRT_W;
        const JD_h  = JD_VIRT_H;

        if (JD_bgImages[layer]) {
            // Dibujar imagen real con parallax
            const JD_imgW = JD_w;
            const JD_x1   = -(offset % JD_imgW);
            const JD_x2   = JD_x1 + JD_imgW;
            JD_c.drawImage(JD_bgImages[layer], JD_x1, 0, JD_imgW, JD_h);
            JD_c.drawImage(JD_bgImages[layer], JD_x2, 0, JD_imgW, JD_h);
            return;
        }

        // ── Fallback procedural por capa ──────────────────────────────────────
        if (layer === 0) {
            // Cielo: gradiente
            const JD_grad = JD_c.createLinearGradient(0, 0, 0, JD_h * 0.7);
            JD_grad.addColorStop(0, biome.sky[0]);
            JD_grad.addColorStop(1, biome.sky[1]);
            JD_c.fillStyle = JD_grad;
            JD_c.fillRect(0, 0, JD_w, JD_h);

            // Estrellas / luciérnagas
            JD_c.fillStyle = 'rgba(255, 255, 200, 0.7)';
            const JD_stars = [
                {x:80,y:30},{x:200,y:55},{x:350,y:20},{x:500,y:45},
                {x:650,y:25},{x:720,y:60},{x:140,y:70},{x:430,y:80}
            ];
            JD_stars.forEach(s => {
                const JD_sx = ((s.x - (offset * 0.05) % JD_w) + JD_w) % JD_w;
                JD_c.beginPath();
                JD_c.arc(JD_sx, s.y, 1.5, 0, Math.PI * 2);
                JD_c.fill();
            });
        }

        else if (layer === 1) {
            // Ruinas / árboles lejanos
            const JD_segW = 120;
            const JD_cols = Math.ceil(JD_w / JD_segW) + 2;
            for (let i = 0; i < JD_cols; i++) {
                const JD_x = ((i * JD_segW - offset * 0.25) % (JD_cols * JD_segW) + (JD_cols * JD_segW)) % (JD_cols * JD_segW);
                const JD_seed = (i * 17 + 3) % 10;

                // Silueta de árbol lejano
                JD_c.fillStyle = JD_lerpColor(biome.treeColor, '#000000', 0.4);
                const JD_tw = 20 + JD_seed * 3;
                const JD_th = 80 + JD_seed * 12;
                const JD_ty = JD_GROUND_Y - JD_th;
                JD_c.fillRect(JD_x + JD_segW * 0.4, JD_ty + JD_th * 0.5, 8, JD_th * 0.5);
                JD_c.beginPath();
                JD_c.arc(JD_x + JD_segW * 0.4 + 4, JD_ty + JD_th * 0.5, JD_tw, 0, Math.PI * 2);
                JD_c.fill();

                // Ruina (arco de piedra) para bioma cueva
                if (getBiomeIdx() === 1) {
                    JD_c.fillStyle = 'rgba(60,40,80,0.6)';
                    JD_c.fillRect(JD_x + 10, JD_GROUND_Y - 70, 15, 70);
                    JD_c.fillRect(JD_x + 60, JD_GROUND_Y - 70, 15, 70);
                    JD_c.fillRect(JD_x + 10, JD_GROUND_Y - 80, 65, 18);
                }
            }
        }

        else if (layer === 2) {
            // Selva media: vegetación densa
            const JD_segW2 = 90;
            const JD_cols2 = Math.ceil(JD_w / JD_segW2) + 2;
            for (let i = 0; i < JD_cols2; i++) {
                const JD_x = ((i * JD_segW2 - offset * 0.55) % (JD_cols2 * JD_segW2) + (JD_cols2 * JD_segW2)) % (JD_cols2 * JD_segW2);
                const JD_seed = (i * 13 + 7) % 8;

                JD_c.fillStyle = biome.treeColor;
                const JD_cw2  = 30 + JD_seed * 5;
                const JD_cy   = JD_GROUND_Y - 60 - JD_seed * 10;
                JD_c.beginPath();
                JD_c.arc(JD_x + JD_segW2 * 0.5, JD_cy, JD_cw2, 0, Math.PI * 2);
                JD_c.fill();
                JD_c.fillRect(JD_x + JD_segW2 * 0.5 - 5, JD_cy, 10, JD_GROUND_Y - JD_cy);
            }

            // Niebla de capa media
            const JD_fogGrad = JD_c.createLinearGradient(0, JD_GROUND_Y - 100, 0, JD_GROUND_Y);
            JD_fogGrad.addColorStop(0, 'transparent');
            JD_fogGrad.addColorStop(1, biome.fogColor);
            JD_c.fillStyle = JD_fogGrad;
            JD_c.fillRect(0, JD_GROUND_Y - 100, JD_w, 100);
        }

        else if (layer === 3) {
            // Suelo: franja sólida con textura
            JD_c.fillStyle = biome.ground;
            JD_c.fillRect(0, JD_GROUND_Y, JD_w, JD_h - JD_GROUND_Y);

            // Línea base del suelo (4px de grosor, como especifica el brief)
            JD_c.fillStyle = biome.accent;
            JD_c.fillRect(0, JD_GROUND_Y, JD_w, 4);

            // Textura de hierba/suelo
            JD_c.fillStyle = 'rgba(0,0,0,0.3)';
            for (let gx = (-(offset * 1.0) % 60 + 60) % 60; gx < JD_w; gx += 60) {
                JD_c.fillRect(gx, JD_GROUND_Y + 4, 2, 8);
            }
        }
    }

    function getBiomeIdx() {
        // Helper para obtener índice de bioma global (accede a JD_Core internamente)
        if (typeof JD_Core !== 'undefined') return JD_getBiome(JD_Core.score);
        return 0;
    }

    // ── Dibujado del jugador ──────────────────────────────────────────────────
    function JD_drawPlayer(player, isJumping) {
        const JD_c = JD_ctx;

        if (player.JD_imgRun && player.JD_imgJump) {
            // Sprite real
            if (isJumping && player.JD_imgJump) {
                JD_c.drawImage(player.JD_imgJump, player.x, player.y, player.w, player.h);
            } else if (player.JD_imgRun) {
                const JD_fw = 64; // ancho de cada frame (384/6)
                JD_c.drawImage(
                    player.JD_imgRun,
                    player.JD_frameIndex * JD_fw, 0, JD_fw, 64,
                    player.x, player.y, player.w, player.h
                );
            }
        } else {
            // Fallback: rectángulo rgba(255, 200, 0, 1) — especificado en el brief
            JD_c.fillStyle = 'rgba(255, 200, 0, 1)';
            JD_c.fillRect(player.x, player.y, player.w, player.h);

            // Orejas del jaguar
            JD_c.fillStyle = 'rgba(220, 160, 0, 1)';
            JD_c.fillRect(player.x + 6,  player.y - 10, 12, 12);
            JD_c.fillRect(player.x + 46, player.y - 10, 12, 12);

            // Cola
            JD_c.strokeStyle = 'rgba(220, 160, 0, 1)';
            JD_c.lineWidth   = 4;
            JD_c.beginPath();
            JD_c.moveTo(player.x, player.y + 40);
            JD_c.quadraticCurveTo(player.x - 20, player.y + 20, player.x - 10, player.y + 10);
            JD_c.stroke();

            // Manchas (animadas)
            JD_c.fillStyle = 'rgba(160, 100, 0, 0.6)';
            JD_c.beginPath();
            JD_c.arc(player.x + 25, player.y + 20, 6, 0, Math.PI * 2);
            JD_c.fill();
            JD_c.beginPath();
            JD_c.arc(player.x + 42, player.y + 35, 5, 0, Math.PI * 2);
            JD_c.fill();

            // Ojos
            JD_c.fillStyle = '#222';
            JD_c.beginPath();
            JD_c.arc(player.x + 50, player.y + 14, 4, 0, Math.PI * 2);
            JD_c.fill();
            JD_c.fillStyle = '#00ff80';
            JD_c.beginPath();
            JD_c.arc(player.x + 51, player.y + 13, 2, 0, Math.PI * 2);
            JD_c.fill();
        }
    }

    // ── Dibujado de obstáculos ────────────────────────────────────────────────
    function JD_drawObstacles(obstacles, biome) {
        const JD_c = JD_ctx;

        obstacles.forEach(obs => {
            if (obs.JD_img) {
                JD_c.drawImage(obs.JD_img, obs.x, obs.y, obs.w, obs.h);
            } else {
                // Fallback: triángulos rgba(200, 50, 50, 1) — especificado en el brief
                JD_c.fillStyle = 'rgba(200, 50, 50, 1)';

                if (obs.type === 'plant') {
                    // Triángulo apuntando hacia arriba (planta carnívora)
                    JD_c.beginPath();
                    JD_c.moveTo(obs.x + obs.w / 2, obs.y);
                    JD_c.lineTo(obs.x + obs.w,     obs.y + obs.h);
                    JD_c.lineTo(obs.x,              obs.y + obs.h);
                    JD_c.closePath();
                    JD_c.fill();

                    // Dentículos
                    JD_c.fillStyle = biome.accent;
                    for (let d = 0; d < 3; d++) {
                        JD_c.beginPath();
                        JD_c.moveTo(obs.x + 8  + d * 12, obs.y + 10);
                        JD_c.lineTo(obs.x + 14 + d * 12, obs.y + 22);
                        JD_c.lineTo(obs.x + 2  + d * 12, obs.y + 22);
                        JD_c.closePath();
                        JD_c.fill();
                    }
                } else {
                    // Log: triángulo horizontal
                    JD_c.beginPath();
                    JD_c.moveTo(obs.x,              obs.y + obs.h / 2);
                    JD_c.lineTo(obs.x + obs.w,      obs.y);
                    JD_c.lineTo(obs.x + obs.w,      obs.y + obs.h);
                    JD_c.closePath();
                    JD_c.fill();

                    // Anillos del tronco
                    JD_c.strokeStyle = 'rgba(140, 30, 30, 0.7)';
                    JD_c.lineWidth   = 2;
                    JD_c.beginPath();
                    JD_c.arc(obs.x + obs.w - 10, obs.y + obs.h / 2, 8, 0, Math.PI * 2);
                    JD_c.stroke();
                }
            }
        });
    }

    // ── Dibujado de decoraciones ──────────────────────────────────────────────
    function JD_drawDecorations(decorations, biome) {
        const JD_c = JD_ctx;

        decorations.forEach(dec => {
            JD_c.fillStyle = dec.type === 'bush'
                ? JD_lerpColor(biome.treeColor, '#00aa44', 0.3)
                : JD_lerpColor(biome.accent, '#ffffff', 0.4);

            JD_c.beginPath();
            JD_c.arc(dec.x + dec.w / 2, dec.y + dec.h / 2, dec.w / 2, 0, Math.PI * 2);
            JD_c.fill();
        });
    }

    // ── Dibujado de Super Monedas ─────────────────────────────────────────────
    // Si el sprite JD_item_supercoin.webp está disponible se dibuja directamente.
    // Fallback procedural: círculo dorado con halo exterior y estrella de 4 puntas
    // central para diferenciarlo inequívocamente de la moneda normal.
    function JD_drawSuperCoins(superCoins) {
        const JD_c = JD_ctx;

        superCoins.forEach(sc => {
            if (sc.JD_img) {
                JD_c.drawImage(sc.JD_img, sc.x, sc.y, sc.w, sc.h);
            } else {
                const JD_cx = sc.x + sc.w / 2;
                const JD_cy = sc.y + sc.h / 2;
                const JD_r  = sc.w / 2;

                // Halo exterior pulsante (usa la posición senoidal ya calculada)
                const JD_haloGrad = JD_c.createRadialGradient(JD_cx, JD_cy, JD_r * 0.6, JD_cx, JD_cy, JD_r * 1.6);
                JD_haloGrad.addColorStop(0, 'rgba(255, 220, 50, 0.5)');
                JD_haloGrad.addColorStop(1, 'rgba(255, 180, 0, 0)');
                JD_c.beginPath();
                JD_c.arc(JD_cx, JD_cy, JD_r * 1.6, 0, Math.PI * 2);
                JD_c.fillStyle = JD_haloGrad;
                JD_c.fill();

                // Cuerpo dorado
                const JD_bodyGrad = JD_c.createRadialGradient(JD_cx - JD_r * 0.3, JD_cy - JD_r * 0.3, JD_r * 0.1, JD_cx, JD_cy, JD_r);
                JD_bodyGrad.addColorStop(0, '#fff176');
                JD_bodyGrad.addColorStop(0.5, '#ffd600');
                JD_bodyGrad.addColorStop(1, '#e65100');
                JD_c.beginPath();
                JD_c.arc(JD_cx, JD_cy, JD_r, 0, Math.PI * 2);
                JD_c.fillStyle = JD_bodyGrad;
                JD_c.fill();

                // Estrella de 4 puntas (símbolo ★ simplificado)
                JD_c.fillStyle = 'rgba(255, 255, 255, 0.85)';
                JD_c.beginPath();
                const JD_sp = JD_r * 0.42; // radio mayor de la estrella
                const JD_si = JD_r * 0.16; // radio menor (interior)
                for (let k = 0; k < 8; k++) {
                    const JD_ang = (k * Math.PI) / 4 - Math.PI / 2;
                    const JD_rr  = k % 2 === 0 ? JD_sp : JD_si;
                    if (k === 0) JD_c.moveTo(JD_cx + JD_rr * Math.cos(JD_ang), JD_cy + JD_rr * Math.sin(JD_ang));
                    else         JD_c.lineTo(JD_cx + JD_rr * Math.cos(JD_ang), JD_cy + JD_rr * Math.sin(JD_ang));
                }
                JD_c.closePath();
                JD_c.fill();
            }
        });
    }

    // ── HUD sobre el canvas ───────────────────────────────────────────────────
    function JD_drawHUD(score, state) {
        if (state !== 'PLAYING') return;
        const JD_c = JD_ctx;

        // Puntuación
        JD_c.fillStyle    = 'rgba(0,0,0,0.45)';
        JD_c.fillRect(JD_VIRT_W - 180, 14, 166, 36);
        JD_c.strokeStyle  = 'rgba(255,255,255,0.15)';
        JD_c.lineWidth    = 1;
        JD_c.strokeRect(JD_VIRT_W - 180, 14, 166, 36);

        JD_c.fillStyle    = '#fff';
        JD_c.font         = 'bold 22px monospace';
        JD_c.textAlign    = 'right';
        JD_c.fillText(Math.floor(score).toString().padStart(6, '0'), JD_VIRT_W - 20, 40);
        JD_c.textAlign    = 'left';
    }

    // ── Pantalla de inicio ────────────────────────────────────────────────────
    function JD_drawStartScreen() {
        const JD_c = JD_ctx;

        JD_c.fillStyle = 'rgba(0, 0, 0, 0.65)';
        JD_c.fillRect(0, 0, JD_VIRT_W, JD_VIRT_H);

        // Panel central
        JD_c.fillStyle = 'rgba(10, 30, 15, 0.92)';
        JD_c.beginPath();
        JD_c.roundRect(JD_VIRT_W/2 - 180, JD_VIRT_H/2 - 110, 360, 220, 18);
        JD_c.fill();
        JD_c.strokeStyle = '#2e8b57';
        JD_c.lineWidth   = 2;
        JD_c.stroke();

        JD_c.fillStyle = '#7fff7a';
        JD_c.font      = 'bold 38px sans-serif';
        JD_c.textAlign = 'center';
        JD_c.fillText('JUNGLE DASH', JD_VIRT_W / 2, JD_VIRT_H / 2 - 50);

        JD_c.fillStyle = 'rgba(255,255,255,0.85)';
        JD_c.font      = '18px sans-serif';
        JD_c.fillText('Pulsa ESPACIO o toca la pantalla', JD_VIRT_W / 2, JD_VIRT_H / 2);
        JD_c.fillText('para comenzar a correr', JD_VIRT_W / 2, JD_VIRT_H / 2 + 26);

        JD_c.fillStyle = 'rgba(150,255,150,0.7)';
        JD_c.font      = '14px sans-serif';
        JD_c.fillText('Mantén pulsado para saltar más alto (máx. 150 px)', JD_VIRT_W / 2, JD_VIRT_H / 2 + 60);

        JD_c.textAlign = 'left';
    }

    // ── Pantalla de Game Over ─────────────────────────────────────────────────
    function JD_drawGameOver(score, highScore, coins) {
        const JD_c = JD_ctx;

        JD_c.fillStyle = 'rgba(0,0,0,0.7)';
        JD_c.fillRect(0, 0, JD_VIRT_W, JD_VIRT_H);

        // Panel
        JD_c.fillStyle = 'rgba(20, 5, 5, 0.92)';
        JD_c.beginPath();
        JD_c.roundRect(JD_VIRT_W/2 - 200, JD_VIRT_H/2 - 130, 400, 270, 20);
        JD_c.fill();
        JD_c.strokeStyle = '#c83232';
        JD_c.lineWidth   = 2;
        JD_c.stroke();

        JD_c.textAlign = 'center';

        JD_c.fillStyle = '#ff6b6b';
        JD_c.font      = 'bold 40px sans-serif';
        JD_c.fillText('GAME OVER', JD_VIRT_W / 2, JD_VIRT_H / 2 - 76);

        JD_c.fillStyle = '#fff';
        JD_c.font      = '20px monospace';
        JD_c.fillText(`Puntos: ${Math.floor(score)}`, JD_VIRT_W / 2, JD_VIRT_H / 2 - 38);

        JD_c.fillStyle = '#ffd700';
        JD_c.font      = '18px monospace';
        JD_c.fillText(`Récord: ${Math.floor(highScore)}`, JD_VIRT_W / 2, JD_VIRT_H / 2 - 8);

        JD_c.fillStyle = '#7dff91';
        JD_c.font      = 'bold 22px sans-serif';
        JD_c.fillText(`🪙 +${coins} monedas Love Arcade`, JD_VIRT_W / 2, JD_VIRT_H / 2 + 28);

        // Botón reiniciar (visual)
        JD_c.fillStyle = '#2e8b57';
        JD_c.beginPath();
        JD_c.roundRect(JD_VIRT_W/2 - 90, JD_VIRT_H/2 + 58, 180, 46, 12);
        JD_c.fill();
        JD_c.fillStyle = '#fff';
        JD_c.font      = 'bold 20px sans-serif';
        JD_c.fillText('REINICIAR', JD_VIRT_W / 2, JD_VIRT_H / 2 + 86);

        JD_c.textAlign = 'left';
    }

    // ── Namespace público ─────────────────────────────────────────────────────
    return {

        get VIRT_W()   { return JD_VIRT_W;  },
        get VIRT_H()   { return JD_VIRT_H;  },
        get GROUND_Y() { return JD_GROUND_Y; },
        get canvas()   { return JD_canvas;  },
        get scaleX()   { return JD_scaleX;  },
        get scaleY()   { return JD_scaleY;  },
        get offsetX()  { return JD_offsetX; },
        get offsetY()  { return JD_offsetY; },

        init() {
            JD_canvas = document.getElementById('JD_canvas');
            JD_ctx    = JD_canvas.getContext('2d');
            JD_resize();
            JD_loadBgImages();
            const JD_dResize = typeof window.debounce === 'function'
                ? window.debounce(JD_resize, 200)
                : JD_resize;
            window.addEventListener('resize', JD_dResize);
            console.log('[JD] Renderer inicializado.');
        },

        // Renderizado principal por frame
        render(state, score, highScore, coins) {
            if (!JD_ctx) return;
            const JD_c   = JD_ctx;
            const JD_biome = JD_getBlendedBiome(score);

            JD_c.clearRect(0, 0, JD_VIRT_W, JD_VIRT_H);

            // 4 capas de parallax
            for (let i = 0; i < 4; i++) {
                JD_drawParallaxLayer(i, JD_biome, JD_layerOffset[i]);
            }

            // Entidades (solo en PLAYING y GAMEOVER)
            if (state !== 'START') {
                const JD_player = JD_Entities.player;
                const JD_isJumping = !JD_Physics.onGround;

                JD_drawDecorations(JD_Entities.decorations, JD_biome);
                JD_drawObstacles(JD_Entities.obstacles, JD_biome);
                JD_drawSuperCoins(JD_Entities.superCoins);
                JD_drawPlayer(JD_player, JD_isJumping);
            }

            // HUD — renderizado exclusivamente por el DOM (#jd-session-info).
            // JD_drawHUD se mantiene como referencia pero NO se llama para
            // evitar el doble renderizado y el texto borroso en pantallas Retina.
            // JD_drawHUD(score, state);

            // Pantallas de estado
            if (state === 'START')    JD_drawStartScreen();
            if (state === 'GAMEOVER') JD_drawGameOver(score, highScore, coins);
        },

        // Actualizar offsets de parallax (llamado por JD_Core cada frame)
        advanceParallax(delta, gameSpeed) {
            for (let i = 0; i < 4; i++) {
                JD_layerOffset[i] += JD_LAYER_SPEED[i] * gameSpeed * delta;
                // Wrapping infinito
                if (JD_layerOffset[i] > JD_VIRT_W * 2) JD_layerOffset[i] -= JD_VIRT_W;
            }
        }
    };
})();
