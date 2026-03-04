# Lumina 2048 — Documentación Técnica

> **Versión:** `1.1.0` · **Plataforma:** Love Arcade · **Core compatible:** Game Center Core v7.5+
> **Ubicación:** `games/lumina-2048/`

---

## Estructura de Archivos

```
games/lumina-2048/
├── index.html          ← Punto de entrada principal
├── lumina_core.js      ← Módulo 1: Motor lógico (independiente del DOM)
├── lumina_render.js    ← Módulo 2: Capa visual, partículas, parallax
├── lumina_input.js     ← Módulo 3: Teclado + TouchEvents (flick/swipe)
├── lumina_audio.js     ← Módulo 4: Síntesis Web Audio API
└── lumina_bridge.js    ← Módulo 5: Integración Love Arcade
```

---

## Changelog v1.1

### Correcciones Críticas de Jugabilidad

#### `lumina_core.js` — Mapa de Rotaciones (bug crítico)
El mapa de rotaciones tenía `left` y `right` **intercambiados**, lo que hacía que las fichas se movieran en dirección opuesta a la esperada y parecieran "teletransportarse".

**Corrección:** La rotación CW ×1 lleva la columna izquierda al tope de la grilla → `left=1`. La rotación CW ×3 lleva la columna derecha → `right=3`.

```js
// ANTES (incorrecto)
const rotations = { up: 0, right: 1, down: 2, left: 3 };
// DESPUÉS (correcto)
const rotations = { up: 0, left: 1, down: 2, right: 3 };
```

#### `index.html` — Transición CSS de Fichas
La transición de las fichas se elevó de 120 ms a **160 ms** (cumple el mínimo de 150 ms del brief). Las fichas animan suavemente la propiedad `left`/`top` desde la posición A a la posición B sin re-crear elementos DOM.

#### `index.html` — Z-Index de Partículas
El canvas `#lumina-particles` fue elevado de `z-index: 20` a `z-index: 50` para garantizar que las partículas de fusión siempre queden por encima de las fichas (incluyendo las nuevas con `z-index: 6`).

#### `lumina_audio.js` — Latencia en Android
El `AudioContext` ahora se reanuda explícitamente en el primer **`touchstart`** (antes solo en `touchend`), eliminando el lag de la Web Audio API en Android. Se añadió `lumina_resumeAudio()` como función pública reutilizable.

#### `lumina_input.js` — Ghost Moves
`lumina_resumeAudio()` se llama en cada `touchstart`. La lógica de spawn ya estaba protegida por el booleano `hasMoved` en el core; al corregir el mapa de rotaciones, el flag ahora refleja correctamente si hubo movimiento real.

---

### Rediseño del Sistema de Recompensas

#### `lumina_bridge.js` — Acumulador de Sesión

**Cambio arquitectónico:** `window.GameCenter.completeLevel()` **ya no se llama durante el gameplay**. Todas las recompensas se acumulan localmente y se reportan en un **único evento** al dispararse Game Over o Victoria.

| Variable | Descripción |
|---|---|
| `lumina_sessionCoins` | Monedas de fusión ⚡ acumuladas en la sesión |
| `lumina_sessionReached512` | Flag del multiplicador de esfuerzo |
| `lumina_sessionStartBest` | Récord de referencia para detectar nuevo récord |

#### Nueva Estructura de Incentivos

| Bono | Cálculo | Ejemplo |
|---|---|---|
| **Persistencia** | `floor(score / 150)` | Score 3 000 → 20 monedas |
| **Fusión ⚡** | `10 por ficha` (antes 5) | 2 fichas → 20 monedas |
| **Multiplicador ×1.5** | Si se alcanza la ficha 512 | 40 monedas × 1.5 → 60 |

#### Flujo de Llamadas

```
gameplay
  ├─ lumina_accumulateEnergyMerge(n)  ← por fusión ⚡ (sin reportar)
  └─ lumina_notifyMaxTile(value)      ← activa flag 512 si aplica

GameOver / Win
  └─ lumina_reportFinalSession()
       ├─ calcula persistenceCoins + sessionCoins
       ├─ aplica ×1.5 si reached512
       └─ llama lumina_reportReward() → GameCenter.completeLevel() [1 sola vez]
```

#### `lumina_render.js` — Nuevo Modal de Resumen

Los modales de Game Over y Victoria ahora muestran:
- **Monedas Ganadas** con icono animado 🪙 (posición prominente, fila completa)
- **Puntuación Final**
- **Hito Máximo Alcanzado** (e.g. "Ficha 512")
- **Badge de Nuevo Récord** si `isNewRecord === true`, con efecto pulsante
- **Confeti dorado** (`lumina_spawnConfetti()`) en victoria o nuevo récord

---

## Mecánicas de Juego

### 2048 Estándar
Fusionar fichas del mismo valor moviéndolas con flechas del teclado o swipe táctil. El objetivo es alcanzar la ficha de **2048**.

### Combo Meter (exclusivo)
Cada movimiento que produzca al menos una fusión incrementa el streak. Al completar **5 movimientos consecutivos** con fusión, el Combo Meter llega al 100 % y se dispara el efecto automático: **todos los pares de fichas con valor 2 y 4 se fusionan instantáneamente**.

### Fichas de Energía (⚡)
Con un **6 %** de probabilidad, cada nuevo tile generado es una Ficha de Energía. Al fusionarse, acumula **10 monedas** en el contador de sesión (reportadas al cierre de partida).

---

## Arquitectura de Módulos

### `lumina_core.js`
- Matriz 4×4 en `lumina_grid` (objetos-ficha con `id`, `value`, `isEnergy`, `isNew`, `isMerged`)
- `lumina_move(direction)` aplica rotación de grilla para unificar la lógica "mover hacia arriba"
- Rotación CW: `{ up:0, left:1, down:2, right:3 }` (v1.1 corregido)
- Detección de fin de partida y victoria
- Persistencia en `localStorage` bajo prefijo `LUMINA_`

### `lumina_render.js`
- Tiles posicionados con `--tile-x` / `--tile-y` (CSS custom properties)
- Transición `cubic-bezier(0.25, 0.1, 0.05, 1)` de **160 ms** para movimiento fluido
- `lumina_spawnParticles()` para fusiones ≥ 128 (canvas z-index: 50)
- `lumina_spawnConfetti()` para nuevo récord y victoria (partículas doradas)
- `lumina_showGameOver(sessionData)` / `lumina_showWin(sessionData)` — modal con resumen

### `lumina_input.js`
- `lumina_resumeAudio()` llamado en cada `touchstart` (fix Android)
- Conexión con nuevo bridge: `lumina_accumulateEnergyMerge()` y `lumina_notifyMaxTile()`
- `lumina_reportFinalSession()` invocado una sola vez al final de partida

### `lumina_audio.js`
- AudioContext reanudado en `touchstart` (v1.1, antes `touchend`)
- `lumina_resumeAudio()` función pública para invocación desde input.js
- Escala pentatónica mayor (C4→D6), todos los tonos son armónicos

### `lumina_bridge.js`
- **Cero reportes durante el gameplay** — única llamada a `completeLevel()` al cierre
- Acumulador `lumina_sessionCoins` para fusiones de energía
- Bono de Persistencia calculado sobre puntuación final (`floor(score / 150)`)
- Multiplicador de Esfuerzo ×1.5 si se alcanza ficha 512
- `lumina_resetSession()` llamado al inicio de cada partida

---

## Economía de Monedas

| Fuente | Cálculo | Cuándo se suma |
|---|---|---|
| Persistencia | `floor(score / 150)` | Al cerrar la sesión |
| Fusión ⚡ | `10 × fichas_energía` | Acumulado, reportado al cierre |
| Mult. Esfuerzo ×1.5 | Aplica si se alcanza ficha 512 | Al calcular el total final |

**Reporte único al GameCenter:** `GameCenter.completeLevel(gameId, levelId, totalCoins)`

---

## Namespacing (normativa v7.5)

| Tipo | Prefijo usado |
|---|---|
| Variables/funciones JS globales | `lumina_` |
| Claves `localStorage` | `LUMINA_` |
| Clases CSS | `.lumina-` |
| ID del juego en GameCenter | `lumina_2048` |

---

## Checklist de Entrega ✅

### Estructura y Navegación
- [x] Proyecto en `games/lumina-2048/` (minúsculas, sin espacios)
- [x] Botón "← Hub" visible → ruta `../../index.html`
- [x] `../../js/app.js` referenciado al final del `<body>`

### Responsividad
- [x] Mobile First: tablero ocupa `90vw` en pantallas ≤ 375 px
- [x] Controles táctiles (swipe + flick) totalmente funcionales
- [x] `touch-action: none` y prevención de scroll durante el juego

### Jugabilidad Corregida (v1.1)
- [x] Mapa de rotaciones left/right corregido — movimiento direccional físicamente correcto
- [x] Transición CSS ≥ 150 ms (160 ms) — animación fluida de posición A → B
- [x] Ghost Moves eliminados — spawn bloqueado si `hasMoved === false`
- [x] Audio reanudado en `touchstart` — cero latencia en Android

### Sistema de Recompensas (v1.1)
- [x] Cero llamadas a `completeLevel()` durante el gameplay
- [x] Acumulador de sesión `lumina_sessionCoins` para fusiones ⚡
- [x] Bono de Persistencia: +1 moneda por cada 150 puntos
- [x] Bono de Fusión ⚡: 10 monedas por ficha (antes 5)
- [x] Multiplicador ×1.5 al alcanzar ficha 512
- [x] Reporte único al cierre (`GameOver` o `Win`)

### Modal de Fin de Partida (v1.1)
- [x] Muestra Puntuación Final
- [x] Muestra Monedas Ganadas con icono animado 🪙
- [x] Muestra Hito más alto alcanzado
- [x] Badge "¡Nuevo Récord Personal!" con efecto pulsante
- [x] Confeti dorado (`lumina_spawnConfetti`) en victoria y nuevo récord

### Aislamiento y Namespacing
- [x] Todas las variables/funciones globales llevan prefijo `lumina_`
- [x] Todas las claves de `localStorage` llevan prefijo `LUMINA_`
- [x] No se declara ni sobrescribe ningún global reservado del núcleo

### Modo Standalone y Robustez
- [x] Funciona sin `app.js` (modo standalone con logs de advertencia)
- [x] Al ganar, el contador de monedas de la Navbar de Love Arcade incrementa
- [x] Zero-Flicker: tema leído de `localStorage` antes del primer paint

---

*Lumina 2048 · Love Arcade · Game Center Core v7.5 · 2026 · v1.1.0*
