/**
 * JD_Physics.js — Jungle Dash | Módulo de Física
 * Gestiona gravedad, vectores de salto proporcional y detección AABB al 80%.
 */

const JD_Physics = (() => {

    // ── Constantes físicas (coordenadas virtuales 800×450) ──────────────────
    const JD_GRAVITY        = 0.55;  // px/frame² (aceleración de caída)
    const JD_JUMP_INIT_VEL  = -8.5;  // velocidad inicial de salto
    const JD_JUMP_BOOST_VEL = -0.42; // boost adicional por frame mientras se mantiene presionado
    const JD_MAX_BOOST_MS   = 380;   // ms máximos de boost (da aprox 150px de salto)
    const JD_MAX_FALL_VEL   = 14;    // velocidad máxima de caída
    const JD_HITBOX_FACTOR  = 0.80;  // cajas de colisión al 80% del sprite

    // ── Estado privado ──────────────────────────────────────────────────────
    let JD_vy            = 0;
    let JD_onGround      = true;
    let JD_jumpPressed   = false;
    let JD_jumpStartTime = 0;

    // ── Utilidad: obtener caja AABB reducida ────────────────────────────────
    function JD_getHitbox(entity) {
        const JD_shrinkX = entity.w * (1 - JD_HITBOX_FACTOR) * 0.5;
        const JD_shrinkY = entity.h * (1 - JD_HITBOX_FACTOR) * 0.5;
        return {
            x: entity.x + JD_shrinkX,
            y: entity.y + JD_shrinkY,
            w: entity.w * JD_HITBOX_FACTOR,
            h: entity.h * JD_HITBOX_FACTOR,
        };
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
        // Devuelve true si hay colisión, false si no.
        checkCollision(player, obstacles) {
            const JD_pBox = JD_getHitbox(player);

            for (let i = 0; i < obstacles.length; i++) {
                const JD_obs  = obstacles[i];
                const JD_oBox = JD_getHitbox(JD_obs);

                // Separación en algún eje → sin colisión
                if (
                    JD_pBox.x + JD_pBox.w < JD_oBox.x ||
                    JD_pBox.x > JD_oBox.x + JD_oBox.w ||
                    JD_pBox.y + JD_pBox.h < JD_oBox.y ||
                    JD_pBox.y > JD_oBox.y + JD_oBox.h
                ) continue;

                return true; // Colisión detectada
            }
            return false;
        },

        get onGround() { return JD_onGround; }
    };
})();
