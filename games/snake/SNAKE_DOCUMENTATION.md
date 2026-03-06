# Snake — Documentación Técnica
### LA-Snake Classic v1.2 | Love Arcade Game Suite

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Changelog v1.2](#2-changelog-v12)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Módulo 1 — snake-core.js](#4-módulo-1--snake-corejs)
5. [Módulo 2 — snake-renderer.js](#5-módulo-2--snake-rendererjs)
6. [Módulo 3 — snake-audio.js](#6-módulo-3--snake-audiojs)
7. [Módulo 4 — snake-economy.js](#7-módulo-4--snake-economyjs)
8. [Mecánicas de Juego](#8-mecánicas-de-juego)
9. [Sistema de Skins](#9-sistema-de-skins)
10. [Integración Love Arcade](#10-integración-love-arcade)
11. [Diseño y UX](#11-diseño-y-ux)
12. [Restricciones Técnicas](#12-restricciones-técnicas)
13. [Guía de Despliegue](#13-guía-de-despliegue)

---

## 1. Visión General

**Snake** es un juego clásico tipo Snake con mecánicas de combo y power-ups de utilidad, diseñado para el ecosistema **Love Arcade**. El nombre visible para el jugador es "Snake".

| Atributo          | Valor                                 |
|-------------------|---------------------------------------|
| Nombre del juego  | Snake                                 |
| Game ID           | `la_snake_classic`                    |
| Level ID          | `standard_mode`                       |
| Versión           | 1.2.0                                 |
| Plataforma        | Web (Mobile First, ≤ 375px)           |
| Estética          | Flat Design — cero glassmorphism      |
| Renderer          | Canvas API nativo con HiDPI scaling   |
| Assets            | SVGs inline (strings)                 |
| Audio             | Web Audio API (sin archivos .mp3)     |
| Almacenamiento    | localStorage con prefijo `LAS_`       |
| Dependencias      | Ninguna (vanilla JS)                  |

---

## 2. Changelog v1.2

### snake-core.js
- **Sistema de input migrado a Swipe global** con umbral de **20px** de desplazamiento mínimo para disparar un giro. Elimina la lógica anterior de 4 zonas táctiles.
- **`touchmove` con `e.preventDefault()`** bloqueando scroll nativo del navegador durante toda la duración del toque.
- **`touchcancel`** handler añadido para limpiar estado en interrupciones de gestos.
- **`navigator.vibrate(10)`** — Feedback háptico de 10ms en cada giro válido registrado (silencia errores si la API no está disponible).
- **`onInvalidDirection` callback** — Se dispara cuando el jugador intenta girar 180 grados sobre sí mismo. Usado por el audio para `sfxInvalidTurn`.

### snake-renderer.js
- **Soporte HiDPI completo** — `window.devicePixelRatio` detectado en `initCanvas`. El canvas físico se escala por el DPR; el contexto se escala inversamente con `ctx.scale(dpr, dpr)`. Los draw calls siguen usando coordenadas lógicas.
- **Stroke 1.5px en todos los segmentos** — Cada segmento del cuerpo recibe un `strokeRect` de 1.5px de ancho con el color de la skin 20% más oscuro que el relleno (función `LAS_darkenHex`).
- **Eliminado Courier New** — Toda tipografía en canvas usa `-apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif`.
- **Skins bloqueadas** — El canvas de preview usa `CSS filter: grayscale(100%)` + `opacity: 0.4` en el elemento DOM. Sin blur/glassmorphism.

### snake-audio.js
- **`sfxTurn()`** — Click metálico de onda cuadrada 0.05s (1200 Hz → 400 Hz con envolvente rápida). Confirma cada giro válido al jugador.
- **`sfxInvalidTurn()`** — Golpe grave sordo de onda sinusoidal 0.12s (90 Hz → 55 Hz). Comunica rechazo del movimiento sin ser intrusivo.

### snake-economy.js
- **`LAS_GAME_ID`**: `'snake'` → `'la_snake_classic'` (requisito de app.js v9.4).
- **`LAS_LEVEL_ID`**: `'session'` → `'standard_mode'` (requisito de app.js v9.4).
- **Fórmula de recompensa**: `Math.max(1, Math.floor(sessionScore × comboMultiplierAtDeath))`.
- El multiplicador se **captura antes del reset** en `endSession()`.
- **`Math.floor()`** + **`Math.max(1, ...)`** garantizan entero positivo > 0.
- `completeLevel` envuelto en `try/catch` con verificación de existencia.

### snake.html (Orquestador)
- **Selector de skins con flechas SVG** — Reemplaza el carrusel de scroll. Flechas `‹` y `›` navegan por las skins; botón "SELECT" solo activo si `highScore >= skin.unlockScore`.
- **Botón mute con iconografía SVG** — Rutas SVG que cambian entre speaker y speaker-muted. Sin emojis.
- **100ms delay antes de `endSession()`** — Garantiza que el DOM de app.js v9.4 esté listo para recibir la transacción.
- **Fuente sans-serif en toda la UI** — Variable CSS `--LAS_font` con stack de sistema.

---

## 3. Arquitectura del Sistema

```
snake.html           ← Orquestador (UI + wiring)
├── snake-core.js    ← Motor de juego y lógica
├── snake-renderer.js← Renderizado SVG/Canvas + HiDPI
├── snake-audio.js   ← Síntesis Web Audio API
└── snake-economy.js ← Economía, combos, skins, GameCenter
```

Todos los módulos son **IIFEs** sin dependencias externas. El orquestador los conecta mediante callbacks.

---

## 4. Módulo 1 — snake-core.js

### 4.1 Máquina de Estados

```
START → COUNTDOWN → PLAYING ⇄ PAUSED
                  ↓
               GAMEOVER → (START | PLAYING)
```

### 4.2 Motor de Movimiento

`requestAnimationFrame` con control de tick por tiempo:

```javascript
const speedMs = activePowerup?.type === 'brake' ? 280 : 140;
if (timestamp - lastTick >= speedMs) {
    lastTick = timestamp;
    tick();
}
```

Velocidad constante independiente del FPS del dispositivo.

### 4.3 Sistema de Input — Swipe Global (v1.2)

**Flujo de eventos:**
```
touchstart  → registra origen (clientX/Y) + e.preventDefault()
touchmove   → e.preventDefault()  ← bloquea scroll del navegador
touchend    → calcula delta, llama resolveSwipe()
touchcancel → limpia LAS_touchActive
```

**Resolución de dirección:**
```javascript
// Solo dispara si max(|dx|, |dy|) >= 20px
// El eje dominante gana
resolveSwipe(dx, dy) → 'up' | 'down' | 'left' | 'right' | null
```

**Validación en queueDirection:**
- **180°**: Rechazado → `onInvalidDirection()` callback
- **Igual a nextDirection**: No-op silencioso
- **Válido**: Encola → `navigator.vibrate(10)`

**Teclado (desktop):** Flechas / WASD. `P` o `Escape` pausa.

### 4.4 Callbacks Públicos

```javascript
LAS_Core.onEat(fn)                // fn(isPowerup: bool)
LAS_Core.onDeath(fn)              // fn()
LAS_Core.onStateChange(fn)        // fn(newState: string)
LAS_Core.onTurn(fn)               // fn(x, y) — cada giro ejecutado
LAS_Core.onFrame(fn)              // fn() — cada frame
LAS_Core.onInvalidDirection(fn)   // fn() — rechazo de 180° (v1.2)
```

---

## 5. Módulo 2 — snake-renderer.js

### 5.1 HiDPI Scaling (v1.2)

```javascript
function LAS_initCanvas(canvasEl, cols, rows) {
    const dpr = window.devicePixelRatio || 1;
    // Física: canvas real más grande
    canvasEl.width  = logicalW * dpr;
    canvasEl.height = logicalH * dpr;
    // CSS: tamaño visual igual al lógico
    canvasEl.style.width  = logicalW + 'px';
    canvasEl.style.height = logicalH + 'px';
    // Contexto: escalar para que draw calls usen px lógicos
    ctx.scale(dpr, dpr);
}
```

En un iPhone Retina (DPR=3): canvas físico 3× más grande → sin pixelado.

### 5.2 Stroke en Segmentos (v1.2)

Todos los segmentos del cuerpo usan:
```javascript
// Fill con color de skin
ctx.fillRect(rx, ry, rw, rh);
// Stroke 1.5px, color 20% más oscuro
ctx.strokeStyle = skin.stroke;
ctx.lineWidth   = 1.5;
ctx.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
```

El `+ 0.75` alinea el stroke al pixel para evitar subpixel rendering borroso.

### 5.3 Tipografía Canvas

```javascript
const LAS_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif';
ctx.font = `700 ${fontSize}px ${LAS_FONT_STACK}`;
```

### 5.4 Locked Skin Preview

```javascript
// CSS filter en el elemento canvas, no efectos de Canvas API
if (locked) {
    canvasEl.style.filter  = 'grayscale(100%)';
    canvasEl.style.opacity = '0.4';
}
```

---

## 6. Módulo 3 — snake-audio.js

### 6.1 Efectos de Sonido (Completo v1.2)

| Función              | Evento              | Descripción                                    |
|----------------------|---------------------|------------------------------------------------|
| `sfxEat()`           | Comida              | 300→600 Hz, 0.12s, onda cuadrada               |
| `sfxPowerup()`       | Power-up            | Arpegio 400→500→700→1000 Hz, sawtooth          |
| `sfxDeath()`         | Muerte              | Ruido blanco + tono grave descendente           |
| `sfxCombo(n)`        | Combo sube          | Acorde doble que escala con multiplicador       |
| `sfxClick()`         | UI                  | 440→480 Hz breve                               |
| `sfxStart()`         | Inicio de partida   | Jingle C4-E4-G4-C5                             |
| `sfxTurn()` (v1.2)   | Giro válido         | 1200→400 Hz, 0.05s, click metálico square      |
| `sfxInvalidTurn()` (v1.2) | Giro rechazado | 90→55 Hz, 0.12s, golpe sordo sinusoidal        |

### 6.2 Lazy Init

El `AudioContext` solo se crea tras el primer gesto del usuario (requisito de navegadores). El orquestador llama `LAS_Audio.init()` en `touchstart` y en el primer clic de botón.

---

## 7. Módulo 4 — snake-economy.js

Ver también: **SNAKE_ECONOMY_DOCS.md** para documentación económica detallada.

### 7.1 IDs Corregidos (v1.2)

```javascript
const LAS_GAME_ID  = 'la_snake_classic'; // app.js v9.4 rechaza 'snake'
const LAS_LEVEL_ID = 'standard_mode';    // app.js v9.4 rechaza 'session'
```

### 7.2 Fórmula de Recompensa (v1.2)

```javascript
const multiplierAtDeath = LAS_comboMultiplier; // capturar ANTES del reset
const rewardAmount = Math.max(1, Math.floor(finalScore * multiplierAtDeath));
```

### 7.3 Llamada GameCenter (v1.2)

```javascript
// 100ms delay en el orquestador garantiza DOM de app.js listo
if (window.GameCenter &&
    typeof window.GameCenter.completeLevel === 'function') {
    try {
        window.GameCenter.completeLevel(
            'la_snake_classic',
            'standard_mode',
            rewardAmount  // integer >= 1
        );
    } catch (err) {
        console.warn('[LAS_Economy] GameCenter.completeLevel failed:', err);
    }
}
```

---

## 8. Mecánicas de Juego

### 8.1 Power-ups

| Power-up | Asset SVG | Efecto                                     | Duración |
|----------|-----------|--------------------------------------------|----------|
| Imán     | U-shape   | Atrae comida en radio de 3 celdas (nudge)  | 5s       |
| Fantasma | Capa      | Inmunidad a auto-colisión                  | 5s       |
| Freno    | Reloj     | 140ms/tick → 280ms/tick                    | 5s       |

Aparecen cada 8 comidas. Máximo 1 en grid. Desaparecen solos a los 10s si no se recogen.

### 8.2 Velocidad

| Condición         | Intervalo |
|-------------------|-----------|
| Normal            | 140ms     |
| Brake activo      | 280ms     |

---

## 9. Sistema de Skins

| Score mínimo | Skin ID   | Nombre         | Visual                                    |
|--------------|-----------|----------------|-------------------------------------------|
| 0            | `classic` | Classic Green  | Verde sólido + stroke oscuro 1.5px        |
| 500          | `neon`    | Neon Pulse     | Verde brillante + outline neon 1.5px      |
| 1500         | `cyber`   | Cyber Scale    | Azul + overlay geométrico + stroke 1.5px  |
| 3000         | `gold`    | Gold Edition   | Dorado + partículas SVG en giros          |

### 9.1 Selector de Skins (v1.2)

Reemplaza el carrusel de scroll por un **selector con flechas SVG** `‹/›`:
- Navega por las 4 skins en bucle.
- El botón SELECT está **desactivado** (`disabled`) si `highScore < skin.unlockScore`.
- Skins bloqueadas muestran el score requerido y preview en escala de grises.
- Dots de paginación muestran la posición actual.

---

## 10. Integración Love Arcade

### 10.1 Secuencia de Recompensa

```
Muerte de serpiente
    │
    ▼ sfxDeath() + renderizado de overlay final
    │
    ▼ [100ms delay — DOM de app.js v9.4 listo]
    │
    ▼ LAS_Economy.endSession(score, length)
        ├── Captura comboMultiplier
        ├── Resetea combo
        ├── Guarda high score
        ├── Calcula rewardAmount = max(1, floor(score × multiplier))
        └── window.GameCenter.completeLevel('la_snake_classic', 'standard_mode', reward)
    │
    ▼ [700ms — tiempo para leer overlay]
    │
    ▼ Muestra pantalla Game Over con stats y reward
```

### 10.2 Stub de Desarrollo

```javascript
if (!window.GameCenter) {
    window.GameCenter = {
        completeLevel: (gameId, levelId, reward) => {
            console.log(`[GameCenter] ${gameId} / ${levelId} / ${reward}`);
        }
    };
}
```

---

## 11. Diseño y UX

### 11.1 Tipografía (v1.2)

| Contexto     | Fuente                                          |
|--------------|-------------------------------------------------|
| UI (CSS)     | `--LAS_font: -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif` |
| Canvas       | `700 {n}px -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif` |

Courier New eliminado completamente. No hay fuentes monoespaciadas en ningún contexto.

### 11.2 Principios de Diseño

- **Flat Design estricto**: Sin `backdrop-filter`, sin `box-shadow` difusa.
- **Solid colors only**: Borders sólidos, fills opacos.
- **Sin emojis**: Mute button usa rutas SVG que se alternan programáticamente.
- **Alto contraste**: Stroke 1.5px + 20% oscuro en todos los segmentos para legibilidad OLED.

---

## 12. Restricciones Técnicas

| Restricción                          | Estado   | Implementación                                          |
|--------------------------------------|----------|---------------------------------------------------------|
| Sin glassmorphism                    | Cumplida | Cero `backdrop-filter`, colores sólidos                 |
| Sin emojis                           | Cumplida | Mute: SVG paths alternables; todos los iconos son SVG   |
| Sin librerías pesadas                | Cumplida | Vanilla JS, Canvas API nativo                           |
| Diseño responsivo ≤ 375px            | Cumplida | `max-width: 430px`, grid dinámico                       |
| Prefijo `LAS_` en variables          | Cumplida | Todas las vars JS y claves localStorage                 |
| `window.GameCenter` + stub           | Cumplida | Existencia + tipo verificados, try/catch                |
| Game ID correcto (`la_snake_classic`)| Cumplida | v1.2 — corregido                                        |
| Level ID correcto (`standard_mode`)  | Cumplida | v1.2 — corregido                                        |
| Audio sin .mp3                       | Cumplida | Web Audio API oscillators + BufferSource                |
| Recompensa solo al terminar sesión   | Cumplida | Solo en `LAS_endSession()` con 100ms delay              |
| Input swipe 20px threshold           | Cumplida | v1.2 — `LAS_SWIPE_THRESHOLD = 20`                       |
| HiDPI / Retina                       | Cumplida | v1.2 — `devicePixelRatio` scaling                       |
| Font sans-serif (sin Courier New)    | Cumplida | v1.2 — `-apple-system` stack en CSS y Canvas            |

---

## 13. Guía de Despliegue

### 13.1 Estructura de Archivos

```
/
├── snake.html           ← Punto de entrada
├── snake-core.js        ← Módulo 1: Lógica v1.2
├── snake-renderer.js    ← Módulo 2: Visuales v1.2
├── snake-audio.js       ← Módulo 3: Audio v1.2
└── snake-economy.js     ← Módulo 4: Economía v1.2
```

### 13.2 Ajustes de Configuración

```javascript
// snake-core.js
const LAS_BASE_SPEED_MS          = 140;  // ms/tick — reducir para más velocidad
const LAS_SWIPE_THRESHOLD        = 20;   // px — umbral de swipe
const LAS_POWERUP_SPAWN_INTERVAL = 8;    // comidas entre power-ups

// snake-economy.js
const LAS_COMBO_WINDOW_MS = 3000;  // ventana de combo en ms
const LAS_MAX_MULTIPLIER  = 8;     // techo del multiplicador
```

### 13.3 Integración en Love Arcade

1. Inyectar `window.GameCenter` **antes** de cargar `snake.html`.
2. Asegurar que `GameCenter.completeLevel` acepte `('la_snake_classic', 'standard_mode', integer)`.
3. Si el host inyecta su navbar, ajustar o eliminar `#LAS_header`.

---

*Documentación generada para LA-Snake Classic v1.2.0 — Love Arcade Game Suite*
