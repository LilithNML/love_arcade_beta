/**
 * JD_Entities.js — Jungle Dash | Módulo de Entidades
 * Clases para el jugador (JD_Player), obstáculos, Super Monedas y decoración.
 * Gestiona la carga de sprites con fallback procedural al 100%.
 *
 * v1.3.0 — Nueva entidad JD_SuperCoin:
 *   · Aparece con probabilidad 5 % en lugar de un obstáculo, tras los 1 000 pts.
 *   · Efecto de flotación senoidal (y = baseY + sin(t)) para distinción visual.
 *   · Sprite: assets/sprites/JD_item_supercoin.webp (fallback procedural dorado).
 *   · Valor: 25 monedas por recogida. Meta: 3 por ciclo de 5 000 pts.
 *   · Contador JD_superCoinsCollected expuesto para JD_Core.
 */

// ── Dimensiones de sprites (según especificaciones) ─────────────────────────
const JD_SPRITE_DEFS = {
    jaguar_run:   { src: './assets/sprites/JD_jaguar_run.webp',      w: 384, h: 64, frames: 6 },
    jaguar_jump:  { src: './assets/sprites/JD_jaguar_jump.webp',     w: 64,  h: 64, frames: 1 },
    obs_plant:    { src: './assets/sprites/JD_obs_plant.png',        w: 48,  h: 80 },
    obs_log:      { src: './assets/sprites/JD_obs_log.png',          w: 64,  h: 32 },
    item_supercoin: { src: './assets/sprites/JD_item_supercoin.webp', w: 32,  h: 32 },
};

// ── Clase: Jugador ────────────────────────────────────────────────────────────
class JD_Player {
    constructor(groundY) {
        this.w            = 64;
        this.h            = 64;
        this.x            = 120;
        this.y            = groundY - this.h;
        this.groundY      = groundY;

        // Animación de correr
        this.JD_frameIndex  = 0;
        this.JD_frameTimer  = 0;
        this.JD_frameSpeed  = 6;      // frames de animación (ticks)
        this.JD_totalFrames = 6;

        // Imágenes
        this.JD_imgRun  = null;
        this.JD_imgJump = null;
    }

    // Avanzar frame de animación
    JD_advanceAnimation(delta) {
        this.JD_frameTimer += delta;
        if (this.JD_frameTimer >= this.JD_frameSpeed) {
            this.JD_frameTimer = 0;
            this.JD_frameIndex = (this.JD_frameIndex + 1) % this.JD_totalFrames;
        }
    }

    reset(groundY) {
        this.groundY = groundY;
        this.y       = groundY - this.h;
        this.JD_frameIndex = 0;
        this.JD_frameTimer = 0;
    }
}

// ── Clase: Obstáculo ──────────────────────────────────────────────────────────
class JD_Obstacle {
    constructor(type, canvasW, groundY) {
        this.type = type; // 'plant' | 'log'

        if (type === 'plant') {
            this.w = 48;
            this.h = 80;
            this.y = groundY - this.h;
        } else { // log
            this.w = 64;
            this.h = 32;
            this.y = groundY - this.h;
        }

        // Aparece justo fuera del borde derecho
        this.x = canvasW + 20;

        this.JD_img = null;
    }
}

// ── Clase: Super Moneda ───────────────────────────────────────────────────────
// Ítem de recompensa flotante con animación senoidal.
// Valor: 25 monedas Love Arcade.
class JD_SuperCoin {
    constructor(canvasW, groundY) {
        this.w       = 32;
        this.h       = 32;

        // Posición base en el aire (zona cómoda para saltar)
        this.baseY   = groundY - 90;
        this.x       = canvasW + 20;
        this.y       = this.baseY;

        // Acumulador de tiempo para el seno (en ms)
        this.JD_t    = Math.random() * Math.PI * 2; // fase aleatoria inicial
        this.JD_img  = null;

        // Identificador de tipo para la lógica de colisión
        this.type    = 'supercoin';
    }

    // Actualizar posición senoidal.
    // @param {number} delta - factor de tiempo normalizado (1 = 60fps)
    JD_updateFloat(delta) {
        // Velocidad angular: ~1.8 rad/s a 60fps → período visual ≈ 3.5 s
        this.JD_t += delta * 0.03;
        // Amplitud de ±12 px sobre la posición base
        this.y = this.baseY + Math.sin(this.JD_t) * 12;
    }
}

// ── Clase: Elemento decorativo (no colisiona) ─────────────────────────────────
class JD_Decoration {
    constructor(canvasW, groundY) {
        this.x   = canvasW + Math.random() * 200;
        this.y   = groundY - 20 - Math.random() * 60;
        this.w   = 16 + Math.random() * 24;
        this.h   = 20 + Math.random() * 40;
        this.type = Math.random() > 0.5 ? 'bush' : 'flower';
    }
}

// ── Namespace JD_Entities ─────────────────────────────────────────────────────
const JD_Entities = (() => {

    let JD_player              = null;
    let JD_obstacles           = [];
    let JD_superCoins          = [];   // ítems de Super Moneda activos en pantalla
    let JD_decorations         = [];
    let JD_sprites             = {};   // sprites cargados
    let JD_spriteLoadTime      = 0;
    let JD_superCoinsCollected = 0;    // contador de Super Monedas recogidas en la partida

    // Configuración de generación
    const JD_BASE_SPAWN_INTERVAL = 2200; // ms entre obstáculos (base)
    const JD_MIN_SPAWN_INTERVAL  = 800;  // mínimo
    let JD_lastSpawnTime         = 0;
    let JD_lastDecoTime          = 0;
    let JD_canvasW               = 800;
    let JD_groundY               = 380;

    // ── Carga de sprites con timeout de 5s ────────────────────────────────────
    async function JD_loadSprites() {
        JD_spriteLoadTime = performance.now();
        const JD_keys     = Object.keys(JD_SPRITE_DEFS);

        const JD_promises = JD_keys.map(JD_key => {
            return new Promise(resolve => {
                const JD_def = JD_SPRITE_DEFS[JD_key];
                const JD_img = new Image();

                const JD_timer = setTimeout(() => {
                    console.warn(`[JD] Timeout cargando ${JD_def.src} — usando fallback.`);
                    resolve(null);
                }, 5000);

                JD_img.onload = () => {
                    clearTimeout(JD_timer);
                    JD_sprites[JD_key] = JD_img;
                    resolve(JD_img);
                };
                JD_img.onerror = () => {
                    clearTimeout(JD_timer);
                    console.warn(`[JD] No se pudo cargar ${JD_def.src} — usando fallback.`);
                    resolve(null);
                };
                JD_img.src = JD_def.src;
            });
        });

        await Promise.all(JD_promises);

        // Asignar sprites al jugador
        if (JD_player) {
            JD_player.JD_imgRun  = JD_sprites['jaguar_run']  || null;
            JD_player.JD_imgJump = JD_sprites['jaguar_jump'] || null;
        }
    }

    // ── Spawn de obstáculo aleatorio ──────────────────────────────────────────
    // Con probabilidad 5 % (y score > 1 000), spawna una Super Moneda en lugar
    // de un obstáculo normal.
    function JD_spawnObstacle(JD_score) {

        // ── Intento de spawn de Super Moneda (5 % tras 1 000 pts) ────────────
        if (JD_score > 1000 && Math.random() < 0.05) {
            const JD_sc     = new JD_SuperCoin(JD_canvasW, JD_groundY);
            JD_sc.JD_img    = JD_sprites['item_supercoin'] || null;
            JD_superCoins.push(JD_sc);
            console.log('[JD] Super Moneda spawnada.');
            return; // No spawna obstáculo en este ciclo
        }

        // ── Spawn de obstáculo normal ─────────────────────────────────────────
        const JD_type = Math.random() < 0.55 ? 'plant' : 'log';
        const JD_obs  = new JD_Obstacle(JD_type, JD_canvasW, JD_groundY);

        // Asignar sprite si disponible
        JD_obs.JD_img = JD_type === 'plant'
            ? (JD_sprites['obs_plant'] || null)
            : (JD_sprites['obs_log']   || null);

        // A veces dos obstáculos juntos (doble trampa, score > 1500)
        if (JD_score > 1500 && Math.random() < 0.25) {
            const JD_obs2  = new JD_Obstacle(JD_type === 'plant' ? 'log' : 'plant', JD_canvasW, JD_groundY);
            JD_obs2.x      = JD_obs.x + JD_obs.w + 20 + Math.random() * 40;
            JD_obs2.JD_img = JD_obs2.type === 'plant'
                ? (JD_sprites['obs_plant'] || null)
                : (JD_sprites['obs_log']   || null);
            JD_obstacles.push(JD_obs2);
        }

        JD_obstacles.push(JD_obs);
    }

    // ── Intervalo de spawn adaptativo a la puntuación ─────────────────────────
    function JD_getSpawnInterval(JD_score) {
        const JD_reduction = Math.floor(JD_score / 500) * 100;
        return Math.max(JD_MIN_SPAWN_INTERVAL, JD_BASE_SPAWN_INTERVAL - JD_reduction);
    }

    return {

        get player()              { return JD_player;              },
        get obstacles()           { return JD_obstacles;           },
        get superCoins()          { return JD_superCoins;          },
        get decorations()         { return JD_decorations;         },
        get superCoinsCollected() { return JD_superCoinsCollected; },

        init(canvasW, groundY) {
            JD_canvasW = canvasW;
            JD_groundY = groundY;
            JD_player  = new JD_Player(groundY);
            JD_loadSprites();
        },

        reset(canvasW, groundY) {
            JD_canvasW             = canvasW;
            JD_groundY             = groundY;
            JD_obstacles           = [];
            JD_superCoins          = [];
            JD_decorations         = [];
            JD_superCoinsCollected = 0;
            JD_lastSpawnTime       = performance.now();
            JD_lastDecoTime        = performance.now();

            if (JD_player) {
                JD_player.reset(groundY);
                JD_player.JD_imgRun  = JD_sprites['jaguar_run']  || null;
                JD_player.JD_imgJump = JD_sprites['jaguar_jump'] || null;
            }
        },

        // ── Registrar recogida de una Super Moneda ────────────────────────────
        // Llamado por JD_Core al detectar colisión con ítem. Retira el ítem del
        // array y actualiza el contador de recogidas.
        collectSuperCoin(index) {
            if (index < 0 || index >= JD_superCoins.length) return;
            JD_superCoins.splice(index, 1);
            JD_superCoinsCollected++;
        },

        update(delta, JD_score, JD_gameSpeed) {
            const JD_now = performance.now();

            // Avanzar animación del jugador
            JD_player.JD_advanceAnimation(delta);

            // Mover y filtrar obstáculos
            JD_obstacles   = JD_obstacles.filter(o => o.x + o.w > -20);
            JD_obstacles.forEach(o => { o.x -= JD_gameSpeed * delta; });

            // Mover, animar y filtrar Super Monedas
            JD_superCoins = JD_superCoins.filter(sc => sc.x + sc.w > -20);
            JD_superCoins.forEach(sc => {
                sc.x -= JD_gameSpeed * delta;
                sc.JD_updateFloat(delta);
            });

            // Mover y filtrar decoraciones
            JD_decorations = JD_decorations.filter(d => d.x + d.w > -30);
            JD_decorations.forEach(d => { d.x -= JD_gameSpeed * 0.6 * delta; });

            // Spawn de obstáculos / Super Monedas
            const JD_interval = JD_getSpawnInterval(JD_score);
            if (JD_now - JD_lastSpawnTime > JD_interval) {
                JD_spawnObstacle(JD_score);
                JD_lastSpawnTime = JD_now;
            }

            // Spawn de decoraciones
            if (JD_now - JD_lastDecoTime > 900 + Math.random() * 600) {
                JD_decorations.push(new JD_Decoration(JD_canvasW, JD_groundY));
                JD_lastDecoTime = JD_now;
            }
        },

        // Exponer para resize del canvas
        setCanvas(canvasW, groundY) {
            JD_canvasW = canvasW;
            JD_groundY = groundY;
            if (JD_player) JD_player.groundY = groundY;
        }
    };
})();
