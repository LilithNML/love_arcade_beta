/**
 * JD_Entities.js — Jungle Dash | Módulo de Entidades
 * Clases para el jugador (JD_Player) y fábricas de obstáculos/decoración.
 * Gestiona la carga de sprites con fallback procedural al 100%.
 */

// ── Dimensiones de sprites (según especificaciones) ─────────────────────────
const JD_SPRITE_DEFS = {
    jaguar_run:  { src: './assets/sprites/JD_jaguar_run.webp',  w: 384, h: 64, frames: 6 },
    jaguar_jump: { src: './assets/sprites/JD_jaguar_jump.webp', w: 64,  h: 64, frames: 1 },
    obs_plant:   { src: './assets/sprites/JD_obs_plant.png',    w: 48,  h: 80 },
    obs_log:     { src: './assets/sprites/JD_obs_log.png',      w: 64,  h: 32 },
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

    let JD_player         = null;
    let JD_obstacles      = [];
    let JD_decorations    = [];
    let JD_sprites        = {};          // sprites cargados
    let JD_spriteLoadTime = 0;

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
    function JD_spawnObstacle(JD_score) {
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

        get player()      { return JD_player;      },
        get obstacles()   { return JD_obstacles;   },
        get decorations() { return JD_decorations; },

        init(canvasW, groundY) {
            JD_canvasW = canvasW;
            JD_groundY = groundY;
            JD_player  = new JD_Player(groundY);
            JD_loadSprites();
        },

        reset(canvasW, groundY) {
            JD_canvasW = canvasW;
            JD_groundY = groundY;
            JD_obstacles    = [];
            JD_decorations  = [];
            JD_lastSpawnTime = performance.now();
            JD_lastDecoTime  = performance.now();

            if (JD_player) {
                JD_player.reset(groundY);
                JD_player.JD_imgRun  = JD_sprites['jaguar_run']  || null;
                JD_player.JD_imgJump = JD_sprites['jaguar_jump'] || null;
            }
        },

        update(delta, JD_score, JD_gameSpeed) {
            const JD_now = performance.now();

            // Avanzar animación del jugador
            JD_player.JD_advanceAnimation(delta);

            // Mover obstáculos y decoraciones
            JD_obstacles   = JD_obstacles.filter(o => o.x + o.w > -20);
            JD_decorations = JD_decorations.filter(d => d.x + d.w > -30);

            JD_obstacles.forEach(o => { o.x -= JD_gameSpeed * delta; });
            JD_decorations.forEach(d => { d.x -= JD_gameSpeed * 0.6 * delta; });

            // Spawn de obstáculos
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
