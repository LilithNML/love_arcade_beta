/**
 * JD_Physics.js — Jungle Dash | Módulo de Física
 * Gestiona gravedad, vectores de salto proporcional y detección AABB.
 *
 * v1.3.0 — Hitbox diferencial: JD_HITBOX_FACTOR (0.80) para obstáculos y
 *           JD_ITEM_HITBOX_FACTOR (1.30) para recompensas (monedas/ítems).
 *           El factor expandido crea un efecto de "succión magnética" que
 *           elimina la frustración del "casi lo agarro".
 */

const JD_Physics = (() => {

    // ── Constantes físicas (coordenadas virtuales 800×450) ──────────────────
    const JD_GRAVITY        = 0.55;  // px/frame² (aceleración de caída)
    const JD_JUMP_INIT_VEL  = -8.5;  // velocidad inicial de salto
    const JD_JUMP_BOOST_VEL = -0.42; // boost adicional por frame mientras se mantiene presionado
    const JD_MAX_BOOST_MS   = 380;   // ms máximos de boost (da aprox 150px de salto)
    const JD_MAX_FALL_VEL   = 14;    // velocidad máxima de caída

    // ── Factores de hitbox ──────────────────────────────────────────────────
    // Los obstáculos usan un factor reductor (80 %) para dar margen visual al jugador.
    // Los ítems de recompensa usan un factor expansor (130 %) para crear magnetismo:
    // el jugador recoge el ítem antes de tocarlo físicamente, eliminando la
    // frustración del "casi lo agarro".
    const JD_HITBOX_FACTOR      = 0.80; // Obstáculos: caja al 80 % del sprite
    const JD_ITEM_HITBOX_FACTOR = 1.30; // Ítems/monedas: caja al 130 % del sprite

    // ── Estado privado ──────────────────────────────────────────────────────
    let JD_vy            = 0;
    let JD_onGround      = true;
    let JD_jumpPressed   = false;
    let JD_jumpStartTime = 0;

    // ── Utilidad: obtener caja AABB con factor configurable ─────────────────
    // @param {object}  entity    - entidad con {x, y, w, h}
    // @param {number}  factor    - factor de escala de la hitbox (< 1 reduce, > 1 expande)
    function JD_getHitboxWithFactor(entity, factor) {
        const JD_shrinkX = entity.w * (1 - factor) * 0.5;
        const JD_shrinkY = entity.h * (1 - factor) * 0.5;
        return {
            x: entity.x + JD_shrinkX,
            y: entity.y + JD_shrinkY,
            w: entity.w * factor,
            h: entity.h * factor,
        };
    }

    // ── AABB: intersección entre dos cajas ───────────────────────────────────
    function JD_aabbOverlap(a, b) {
        return !(
            a.x + a.w < b.x ||
            a.x > b.x + b.w ||
            a.y + a.h < b.y ||
            a.y > b.y + b.h
        );
    }

    return {

        // ── Inicialización / reset ───────────────────────────────────────────
        init() {
            this.reset();
        },

        reset() {
            JD_vy          = 0;
            JD_onGround    = true;
            JD_jumpPressed = false;
        },

        // ── Presión del botón de salto ───────────────────────────────────────
        startJump() {
            if (!JD_onGround) return;
            JD_vy          = JD_JUMP_INIT_VEL;
            JD_onGround    = false;
            JD_jumpPressed = true;
            JD_jumpStartTime = performance.now();
            JD_Audio.playJump();
        },

        // ── Liberación del botón de salto ────────────────────────────────────
        releaseJump() {
            JD_jumpPressed = false;
        },

        // ── Actualización de física por frame ────────────────────────────────
        // @param {number}  delta     - factor de tiempo (1 = frame a 60fps)
        // @param {object}  player    - objeto jugador con {x, y, w, h}
        // @param {number}  groundY   - coordenada Y del suelo
        update(delta, player, groundY) {

            // Boost continuo mientras se mantiene pulsado el salto
            if (JD_jumpPressed && !JD_onGround) {
                const JD_elapsed = performance.now() - JD_jumpStartTime;
                if (JD_elapsed < JD_MAX_BOOST_MS) {
                    JD_vy += JD_JUMP_BOOST_VEL * delta;
                }
            }

            // Aplicar gravedad
            JD_vy += JD_GRAVITY * delta;

            // Limitar velocidad de caída
            if (JD_vy > JD_MAX_FALL_VEL) JD_vy = JD_MAX_FALL_VEL;

            // Mover jugador
            player.y += JD_vy * delta;

            // Colisión con el suelo
            const JD_standY = groundY - player.h;
            if (player.y >= JD_standY) {
                player.y    = JD_standY;
                JD_vy       = 0;
                JD_onGround = true;
                JD_jumpPressed = false;
            }
        },

        // ── Detección AABB entre jugador y array de obstáculos ───────────────
        // Usa JD_HITBOX_FACTOR (0.80) — cajas reducidas para mayor fairness.
        // Devuelve true si hay colisión con algún obstáculo.
        checkCollision(player, obstacles) {
            const JD_pBox = JD_getHitboxWithFactor(player, JD_HITBOX_FACTOR);

            for (let i = 0; i < obstacles.length; i++) {
                const JD_oBox = JD_getHitboxWithFactor(obstacles[i], JD_HITBOX_FACTOR);
                if (JD_aabbOverlap(JD_pBox, JD_oBox)) return true;
            }
            return false;
        },

        // ── Detección AABB entre jugador y array de ítems de recompensa ──────
        // Usa JD_ITEM_HITBOX_FACTOR (1.30) — caja expandida para efecto magnético.
        // Devuelve el índice del primer ítem recogido, o -1 si ninguno.
        checkItemCollection(player, items) {
            const JD_pBox = JD_getHitboxWithFactor(player, JD_ITEM_HITBOX_FACTOR);

            for (let i = 0; i < items.length; i++) {
                const JD_iBox = JD_getHitboxWithFactor(items[i], JD_ITEM_HITBOX_FACTOR);
                if (JD_aabbOverlap(JD_pBox, JD_iBox)) return i;
            }
            return -1;
        },

        get onGround() { return JD_onGround; }
    };
})();
