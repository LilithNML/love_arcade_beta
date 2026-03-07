# Snake — Documentación Técnica
### LA-Snake Classic v1.3 | Love Arcade Game Suite

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Changelog v1.3](#2-changelog-v13)
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

**Snake** es un juego clásico tipo Snake con mecánicas de combo y power-ups de utilidad, diseñado para el ecosistema **Love Arcade**.

| Atributo          | Valor                                   |
|-------------------|-----------------------------------------|
| Nombre del juego  | Snake                                   |
| Game ID           | `la_snake_classic`                      |
| Level ID          | Único por sesión — `session_{ts}_{hex}` |
| Versión           | 1.3.0                                   |
| Plataforma        | Web (Mobile First, ≤ 375px)             |
| Estética          | Flat Design — cero glassmorphism        |
| Renderer          | Canvas API nativo con HiDPI scaling     |
| Audio             | Web Audio API (sin archivos .mp3)       |
| Almacenamiento    | localStorage con prefijo `LAS_`         |
| Dependencias      | Ninguna (vanilla JS)                    |

---

## 2. Changelog v1.3

### Corrección crítica de integración — recompensas Love Arcade

**Bug A — `app.js` no cargado:**
`snake.html` no incluía `<script src="../../js/app.js">`. Esto causaba que `window.GameCenter` fuera siempre el stub de consola, nunca el sistema real. Las monedas nunca se acreditaban.

**Fix:** `<script src="../../js/app.js">` añadido como primera etiqueta script en el body, antes de todos los módulos del juego.

**Bug B — Idempotencia de `completeLevel()`:**
`app.js` registra cada `levelId` pagado en `store.progress[gameId]` y silencia repeticiones. El `levelId` estático `'standard_mode'` causaba que solo la primera sesión de vida del usuario recibiera monedas.

**Fix:** `LAS_sessionId` generado en `startSession()` como `session_{timestamp}_{hex4}`. Cada partida produce un ID único nunca visto por app.js.

Ver **SNAKE_ECONOMY_DOCS.md §3** para el análisis detallado de ambos bugs.

### Cambios v1.2 (referencia)
- Sistema de swipe global con umbral 20px
- HiDPI / Retina scaling en canvas
- Stroke 1.5px en segmentos
- Fuente sans-serif (eliminado Courier New)
- `sfxTurn()` y `sfxInvalidTurn()` en snake-audio.js
- Selector de skins con flechas SVG

---

## 3. Arquitectura del Sistema

```
snake.html           ← Orquestador (UI + wiring)
├── ../../js/app.js  ← Love Arcade GameCenter (cargado primero)
├── snake-core.js    ← Motor de juego y lógica
├── snake-renderer.js← Renderizado Canvas + HiDPI
├── snake-audio.js   ← Síntesis Web Audio API
└── snake-economy.js ← Economía, combos, skins, GameCenter
```

Todos los módulos son IIFEs sin dependencias externas. El orquestador los conecta mediante callbacks.

**Orden de carga obligatorio:**
`app.js` → módulos snake → script orquestador inline

---

## 4. Módulo 1 — snake-core.js

### 4.1 Máquina de Estados

```
START → COUNTDOWN → PLAYING ⇄ PAUSED
                  ↓
               GAMEOVER
```

### 4.2 Sistema de Input — Swipe Global (v1.2)

**Flujo de eventos:**

```
touchstart  → registra origen + e.preventDefault()
touchmove   → e.preventDefault() (bloquea scroll nativo)
touchend    → calcula delta, llama resolveSwipe()
touchcancel → limpia LAS_touchActive
```

**Resolución:**
- Delta < 20px en ambos ejes: ignorado (sin giro accidental)
- Eje dominante gana
- 180°: rechazado → `onInvalidDirection()` → `sfxInvalidTurn()`
- Válido: encola dirección → `navigator.vibrate(10)` (háptico)

**Teclado (desktop):** Flechas / WASD. `P` o `Escape` pausa.

### 4.3 Callbacks Públicos

```javascript
LAS_Core.onEat(fn)                // fn(isPowerup: bool)
LAS_Core.onDeath(fn)              // fn()
LAS_Core.onStateChange(fn)        // fn(newState: string)
LAS_Core.onTurn(fn)               // fn(x, y) — cada giro ejecutado
LAS_Core.onFrame(fn)              // fn() — cada frame
LAS_Core.onInvalidDirection(fn)   // fn() — rechazo de 180°
```

---

## 5. Módulo 2 — snake-renderer.js

### 5.1 HiDPI Scaling (v1.2)

```javascript
const dpr = window.devicePixelRatio || 1;
canvasEl.width  = logicalW * dpr;   // físico
canvasEl.height = logicalH * dpr;
canvasEl.style.width  = logicalW + 'px';  // CSS = lógico
canvasEl.style.height = logicalH + 'px';
ctx.scale(dpr, dpr);  // draw calls en coords lógicas
```

En iPhone Retina (DPR=3): canvas físico 3× más grande, cero pixelado.

### 5.2 Stroke en Segmentos (v1.2)

```javascript
// Fill sólido + 1.5px stroke 20% más oscuro
ctx.fillRect(rx, ry, rw, rh);
ctx.strokeStyle = skin.stroke;       // LAS_darkenHex(fill, 0.20)
ctx.lineWidth   = 1.5;
ctx.strokeRect(rx + 0.75, ry + 0.75, rw - 1.5, rh - 1.5);
```

### 5.3 Tipografía Canvas

```javascript
const LAS_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif';
```

---

## 6. Módulo 3 — snake-audio.js

| Función              | Evento                | Descripción                             |
|----------------------|-----------------------|-----------------------------------------|
| `sfxEat()`           | Comer comida          | 300→600 Hz, 0.12s, square               |
| `sfxPowerup()`       | Comer power-up        | Arpegio ascendente, sawtooth            |
| `sfxDeath()`         | Muerte                | Ruido blanco + tono grave               |
| `sfxCombo(n)`        | Combo sube            | Acorde doble escalado con multiplicador |
| `sfxClick()`         | Botones UI            | 440→480 Hz breve                        |
| `sfxStart()`         | Inicio de partida     | Jingle C4-E4-G4-C5                      |
| `sfxTurn()`          | Giro válido           | 1200→400 Hz, 0.05s, click metálico      |
| `sfxInvalidTurn()`   | Giro rechazado (180°) | 90→55 Hz, 0.12s, golpe sordo sinusoidal |

---

## 7. Módulo 4 — snake-economy.js

Ver también: **SNAKE_ECONOMY_DOCS.md** para documentación económica completa, incluyendo el diagnóstico de bugs v1.3.

### 7.1 IDs de integración

```javascript
const LAS_GAME_ID = 'la_snake_classic';  // estable — identifica el juego en app.js
// levelId → LAS_sessionId               // único por sesión — generado en startSession()
```

### 7.2 Generación de Session ID

```javascript
function LAS_generateSessionId() {
    const ts   = Date.now();
    const rand = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `session_${ts}_${rand}`;  // "session_1719432800123_a7f3"
}
// Llamado en startSession() → nuevo ID antes de cada partida
```

### 7.3 Llamada GameCenter (producción)

```javascript
window.GameCenter.completeLevel(
    'la_snake_classic',  // gameId — estable
    LAS_sessionId,       // levelId — único por sesión
    rewardAmount         // integer >= 1
);
```

---

## 8. Mecánicas de Juego

### 8.1 Power-ups

| Power-up | Efecto                                    | Duración |
|----------|-------------------------------------------|----------|
| Imán     | Atrae comida en radio de 3 celdas (nudge) | 5s       |
| Fantasma | Inmunidad a auto-colisión                 | 5s       |
| Freno    | 140ms/tick → 280ms/tick                   | 5s       |

Aparecen cada 8 comidas. Máximo 1 en grid. Desaparecen a los 10s si no se recogen.

### 8.2 Velocidad

| Condición     | Intervalo |
|---------------|-----------|
| Normal        | 140ms     |
| Brake activo  | 280ms     |

---

## 9. Sistema de Skins

| Score mínimo | Skin ID   | Visual                                   |
|--------------|-----------|------------------------------------------|
| 0            | `classic` | Verde sólido + stroke oscuro 1.5px       |
| 500          | `neon`    | Verde brillante + outline neon 1.5px     |
| 1500         | `cyber`   | Azul + overlay geométrico SVG            |
| 3000         | `gold`    | Dorado + partículas SVG en cada giro     |

Selector con flechas SVG `‹/›`. Botón SELECT desactivado si `highScore < skin.unlockScore`. Skins bloqueadas: `filter: grayscale(100%)` + `opacity: 0.4` en el canvas de preview.

---

## 10. Integración Love Arcade

### 10.1 Secuencia completa (v1.3)

```
[Jugador muere]
      │
      ▼ sfxDeath() + overlay de canvas
      │
      ▼ [100ms] — DOM de app.js estable
      │
      ▼ LAS_Economy.endSession()
          ├── Captura combo
          ├── Calcula rewardAmount = max(1, floor(score × combo))
          └── GameCenter.completeLevel('la_snake_classic', sessionId, reward)
                                                          ↑ único ← fix v1.3
      │
      ▼ [700ms] — pausa para leer overlay
      │
      ▼ Pantalla Game Over (stats + reward)
```

### 10.2 Orden de carga en snake.html

```html
<!-- 1. Love Arcade core — define window.GameCenter real -->
<script src="../../js/app.js"></script>

<!-- 2. Módulos del juego -->
<script src="snake-audio.js"></script>
<script src="snake-economy.js"></script>
<script src="snake-renderer.js"></script>
<script src="snake-core.js"></script>

<!-- 3. Orquestador + stub de desarrollo -->
<script>
  if (!window.GameCenter) { /* stub solo en standalone */ }
</script>
```

---

## 11. Diseño y UX

### 11.1 Tipografía

Toda la UI usa `--LAS_font: -apple-system, BlinkMacSystemFont, "Roboto", "Segoe UI", sans-serif`. Courier New eliminado completamente.

### 11.2 Principios de Diseño

- Flat Design estricto: sin `backdrop-filter`, sin sombras difusas.
- Todos los iconos son SVG (sin emojis).
- Alto contraste OLED: stroke 1.5px en todos los segmentos.
- Touch-first: swipe 20px threshold, sin zonas invisibles de tap.

---

## 12. Restricciones Técnicas

| Restricción                               | Estado   | Implementación                                  |
|-------------------------------------------|----------|-------------------------------------------------|
| Sin glassmorphism                         | Cumplida | Cero `backdrop-filter`, colores sólidos         |
| Sin emojis                                | Cumplida | Todos los iconos como SVG                       |
| Sin librerías externas                    | Cumplida | Vanilla JS, Canvas API nativo                   |
| Responsive ≤ 375px                        | Cumplida | `max-width: 430px`, grid dinámico               |
| Prefijo `LAS_` en variables               | Cumplida | Todas las vars JS y claves localStorage         |
| `app.js` cargado antes de los módulos     | Cumplida | v1.3 — primera etiqueta script                  |
| Game ID: `la_snake_classic`               | Cumplida | v1.2 — corregido                                |
| Level ID único por sesión                 | Cumplida | v1.3 — `session_{ts}_{hex4}`                    |
| `completeLevel` con guard + try/catch     | Cumplida | verificación de existencia + tipo               |
| Reward solo al terminar sesión            | Cumplida | Solo en `endSession()` con 100ms delay          |
| HiDPI / Retina                            | Cumplida | `devicePixelRatio` scaling en `initCanvas()`    |
| Fuente sans-serif (sin Courier New)       | Cumplida | `-apple-system` stack en CSS y Canvas           |
| Input swipe 20px threshold                | Cumplida | `LAS_SWIPE_THRESHOLD = 20`                      |
| `LAS_` no colisiona con claves de app.js  | Cumplida | app.js usa `gamecenter_v6_promos`               |

---

## 13. Guía de Despliegue

### 13.1 Estructura de Archivos

```
games/snake/
├── snake.html           ← Punto de entrada
├── snake-core.js        ← Módulo 1: Lógica
├── snake-renderer.js    ← Módulo 2: Visuales
├── snake-audio.js       ← Módulo 3: Audio
└── snake-economy.js     ← Módulo 4: Economía
```

La ruta `../../js/app.js` asume que los archivos del juego están en `games/snake/` dentro de la estructura de Love Arcade. Ajustar si la ruta difiere.

### 13.2 Parámetros de Configuración

```javascript
// snake-core.js
const LAS_BASE_SPEED_MS          = 140;   // ms/tick
const LAS_SWIPE_THRESHOLD        = 20;    // px
const LAS_POWERUP_SPAWN_INTERVAL = 8;     // comidas entre power-ups

// snake-economy.js
const LAS_COMBO_WINDOW_MS = 3000;  // ventana de combo
const LAS_MAX_MULTIPLIER  = 8;     // techo multiplicador
```

### 13.3 Integración Love Arcade

1. Verificar que `../../js/app.js` existe y es app.js v9.4+.
2. Confirmar que `GameCenter.completeLevel` acepta `(string, string, number)`.
3. El juego no requiere ningún cambio en `index.html` ni en `app.js`.

---

*Documentación generada para LA-Snake Classic v1.3.0 — Love Arcade Game Suite*
