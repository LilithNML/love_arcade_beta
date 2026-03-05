# Lumina 2048 — Documentación Técnica

> **Versión:** `1.2.0` · **Plataforma:** Love Arcade · **Core compatible:** Game Center Core v7.5+
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

## Changelog v1.2

### Error Crítico: Persistencia de Estado tras Derrota

**Síntoma:** Al perder una partida y volver al juego (sin "New Game"), el tablero restauraba la
partida terminada con el puntaje final. Recargar la pestaña mantenía el bug.

**Causa:** El juego guardaba el estado en cada movimiento pero nunca lo borraba al perder.
`lumina_loadGameState()` encontraba el guardado y lo restauraba, sin saber que era una partida muerta.

**Solución (`lumina_input.js`):** `lumina_clearGameState()` se llama **inmediatamente** al
detectar `lumina_gameOver` o `lumina_gameWon`, antes del `setTimeout` que muestra el modal.
El "archivo de guardado" se elimina en el instante exacto en que la partida termina.

```js
// ANTES (v1.1) — el estado se borraba solo al presionar "New Game"
} else if (lumina_gameOver) {
    setTimeout(() => { ... lumina_showGameOver(sessionData); }, 300);
}

// DESPUÉS (v1.2) — se borra en el momento de la derrota
} else if (lumina_gameOver) {
    lumina_clearGameState(); // ← aquí, antes del timeout
    setTimeout(() => { ... lumina_showGameOver(sessionData); }, 300);
}
```

---

### Balance de Economía — Fórmula de Estabilidad

**Objetivo de calibración:** desempeño promedio de **3 000 puntos → ~160 monedas**.

#### `lumina_bridge.js` — Tres cambios de balance

| Bono | v1.1 | v1.2 | Razón del cambio |
|---|---|---|---|
| **Fusión ⚡** | 10 monedas/ficha | **4 monedas/ficha** | ~10-12 fusiones a 3 000 pts → 40-48 monedas. Con 10 era inflacionario. |
| **Persistencia** | `floor(score/150)` | **`floor(score/25)`** | Progresión lineal y satisfactoria. A 3 000 pts → 120 monedas exactas. |
| **Hito 512** | Multiplicador ×1.5 global | **+20 monedas (one-time)** | Predecible, no distorsiona la economía. |
| **Hito 1024** | — | **+50 monedas (one-time)** | Recompensa el esfuerzo extra sin inflación. |
| **Hito 2048** | — | **+100 monedas (one-time)** | Premio justo por la victoria. |

**Cálculo de referencia a 3 000 puntos:**
```
120 (persistencia: 3000 ÷ 25) + 40 (energía: 10 fusiones × 4) = 160 monedas ✓
```

Los bonos de hito se rastrean en `lumina_sessionMilestonesAwarded` (Set), garantizando
que se otorguen **una sola vez por sesión** incluso si el jugador continúa tras el 2048.

---

### UX: Gratificación Visual en el Modal

**`lumina_render.js` — Animador de monedas:**
El contador de monedas en el modal ya no se asigna directamente. `lumina_animateCoinCount(el, target)`
lo anima de **0 al total en 500 ms** usando easing `easeOutCubic` (desacelera al final
para que el número "aterrice" suavemente). Llama `lumina_playCoinTinkle()` en cada frame.

**`lumina_audio.js` — Tintineo acelerado:**
`lumina_playCoinTinkle(progress)` reproduce un tono metálico breve cuya frecuencia y
cadencia escalan con el progreso de la animación (880 Hz → 2 200 Hz, intervalo 40 ms → 12 ms).
El resultado: 160 monedas se sienten como un botín masivo aunque el número en sí sea moderado.

---

### `lumina_core.js` — Cap Anti-bloqueo de Fichas de Energía

**Problema:** Con tablero casi lleno, la probabilidad del 6% podía spawnear múltiples
fichas ⚡ seguidas que el jugador no podía fusionar, causando bloqueos prematuros.

**Solución:** Se añadió `lumina_ENERGY_CAP = 2`. Si hay **2 o más fichas ⚡ simultáneas**
en el tablero, la siguiente que spawnee es forzosamente normal (2 o 4), ignorando el 6%.
La probabilidad base del 6% no cambia; solo se activa el tope cuando es necesario.

```js
let energyCount = 0;
lumina_forEachTile(t => { if (t && t.isEnergy) energyCount++; });
const isEnergy = energyCount < lumina_ENERGY_CAP && Math.random() < lumina_ENERGY_CHANCE;
```

---

## Changelog v1.1

### Correcciones Críticas de Jugabilidad

#### `lumina_core.js` — Mapa de Rotaciones
El mapa de rotaciones tenía `left` y `right` intercambiados. Corregido:
```js
const rotations = { up: 0, left: 1, down: 2, right: 3 };
```

#### `lumina_audio.js` — Latencia en Android
El `AudioContext` se reanuda en `touchstart` (antes `touchend`). Se añadió `lumina_resumeAudio()`.

#### `lumina_input.js` — Ghost Moves
`lumina_resumeAudio()` en cada `touchstart`. Spawn protegido por `hasMoved` en el core.

#### `index.html` — Z-Index de Partículas / Transición CSS
Canvas `#lumina-particles` elevado a `z-index: 50`. Transición de fichas: 120 ms → **160 ms**.

---

### Rediseño del Sistema de Recompensas (v1.1)

#### `lumina_bridge.js`
`window.GameCenter.completeLevel()` ya no se llama durante el gameplay. Todas las recompensas
se acumulan localmente y se reportan en un único evento al final de partida.

#### Flujo de Llamadas (válido para v1.1 y v1.2)

```
gameplay
  ├─ lumina_accumulateEnergyMerge(n)  ← por fusión ⚡ (sin reportar)
  └─ lumina_notifyMaxTile(value)      ← acumula bonos de hito one-time (v1.2)

GameOver / Win
  └─ lumina_reportFinalSession()
       ├─ persistenceCoins = floor(score / 25)         (v1.2)
       ├─ totalCoins = persistenceCoins + sessionCoins
       └─ lumina_reportReward() → GameCenter.completeLevel() [1 sola vez]
```

---

## Mecánicas de Juego

### 2048 Estándar
Fusionar fichas del mismo valor moviéndolas con flechas del teclado o swipe táctil. El objetivo es alcanzar la ficha de **2048**.

### Combo Meter (exclusivo)
Cada movimiento que produzca al menos una fusión incrementa el streak. Al completar **5 movimientos consecutivos** con fusión, el Combo Meter llega al 100 % y se dispara el efecto automático: todos los pares de fichas con valor 2 y 4 se fusionan instantáneamente.

### Fichas de Energía (⚡)
Con un **6 %** de probabilidad (máx. 2 simultáneas en tablero), cada nuevo tile generado es una Ficha de Energía. Al fusionarse, acumula **4 monedas** (v1.2) en el contador de sesión.

---

## Arquitectura de Módulos

### `lumina_core.js`
- Matriz 4×4 en `lumina_grid` (objetos-ficha con `id`, `value`, `isEnergy`, `isNew`, `isMerged`)
- `lumina_move(direction)` aplica rotación de grilla para unificar la lógica "mover hacia arriba"
- Rotación CW: `{ up:0, left:1, down:2, right:3 }` (v1.1 corregido)
- **v1.2:** Cap `lumina_ENERGY_CAP = 2` en `lumina_addRandomTile()` para prevenir bloqueos
- Detección de fin de partida y victoria
- Persistencia en `localStorage` bajo prefijo `LUMINA_`

### `lumina_render.js`
- Tiles posicionados con `--tile-x` / `--tile-y` (CSS custom properties)
- Transición `cubic-bezier(0.25, 0.1, 0.05, 1)` de **160 ms** para movimiento fluido
- `lumina_spawnParticles()` para fusiones ≥ 128 (canvas z-index: 50)
- `lumina_spawnConfetti()` para nuevo récord y victoria
- **v1.2:** `lumina_animateCoinCount(el, target)` — animador 500 ms con easing y audio sincronizado
- `lumina_showGameOver(sessionData)` / `lumina_showWin(sessionData)` con contador animado

### `lumina_input.js`
- `lumina_resumeAudio()` llamado en cada `touchstart` (fix Android)
- Conexión con bridge: `lumina_accumulateEnergyMerge()` y `lumina_notifyMaxTile()`
- **v1.2:** `lumina_clearGameState()` llamado **inmediatamente** al detectar fin de partida

### `lumina_audio.js`
- AudioContext reanudado en `touchstart`
- `lumina_resumeAudio()` función pública
- Escala pentatónica mayor (C4→D6)
- **v1.2:** `lumina_playCoinTinkle(progress)` — tintineo metálico acelerado para la animación de monedas

### `lumina_bridge.js`
- **Cero reportes durante el gameplay** — única llamada a `completeLevel()` al cierre
- **v1.2:** `lumina_COINS_PER_ENERGY = 4` (antes 10)
- **v1.2:** `lumina_POINTS_PER_COIN = 25` (antes 150)
- **v1.2:** `lumina_MILESTONE_BONUSES` reemplaza el multiplicador ×1.5:
  `[{ 512, +20 }, { 1024, +50 }, { 2048, +100 }]`
- `lumina_sessionMilestonesAwarded` (Set) garantiza bonos one-time
- `lumina_resetSession()` llamado al inicio de cada partida

---

## Economía de Monedas (v1.2)

| Fuente | Cálculo | Cuándo se suma |
|---|---|---|
| Persistencia | `floor(score / 25)` | Al cerrar la sesión |
| Fusión ⚡ | `4 × fichas_energía_fusionadas` | Acumulado, reportado al cierre |
| Hito 512 | +20 (one-time) | Al alcanzar ficha 512 por primera vez |
| Hito 1024 | +50 (one-time) | Al alcanzar ficha 1024 por primera vez |
| Hito 2048 | +100 (one-time) | Al alcanzar ficha 2048 por primera vez |

**Calibración:** 3 000 pts → ~160 monedas (120 persistencia + 40 energía)

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
- [x] Mapa de rotaciones left/right corregido
- [x] Transición CSS ≥ 150 ms (160 ms)
- [x] Ghost Moves eliminados
- [x] Audio reanudado en `touchstart`

### Jugabilidad Mejorada (v1.2)
- [x] Cap de fichas de energía (máx. 2 simultáneas) — previene bloqueos prematuros

### Sistema de Recompensas (v1.2)
- [x] Cero llamadas a `completeLevel()` durante el gameplay
- [x] Bono de Persistencia: `floor(score / 25)` — 120 monedas a 3 000 pts
- [x] Bono de Fusión ⚡: 4 monedas por ficha
- [x] Bonos de Hito fijos: +20 (512), +50 (1024), +100 (2048) — one-time por sesión
- [x] Reporte único al cierre (`GameOver` o `Win`)

### Modal de Fin de Partida (v1.2)
- [x] Contador de monedas animado 0 → total en 500 ms (easeOutCubic)
- [x] Tintineo acelerado sincronizado con la animación (`lumina_playCoinTinkle`)
- [x] Muestra Puntuación Final, Monedas Ganadas, Hito Máximo
- [x] Badge "¡Nuevo Récord Personal!" con efecto pulsante
- [x] Confeti dorado en victoria y nuevo récord

### Fix de Persistencia (v1.2)
- [x] `lumina_clearGameState()` llamado al detectar `gameOver` o `gameWon`
- [x] El guardado se elimina en el instante exacto de la derrota/victoria
- [x] Recargar pestaña tras perder siempre inicia partida nueva limpia

### Aislamiento y Namespacing
- [x] Todas las variables/funciones globales llevan prefijo `lumina_`
- [x] Todas las claves de `localStorage` llevan prefijo `LUMINA_`
- [x] No se declara ni sobrescribe ningún global reservado del núcleo

### Modo Standalone y Robustez
- [x] Funciona sin `app.js` (modo standalone con logs de advertencia)
- [x] Al ganar, el contador de monedas de la Navbar de Love Arcade incrementa
- [x] Zero-Flicker: tema leído de `localStorage` antes del primer paint

---

*Lumina 2048 · Love Arcade · Game Center Core v7.5 · 2026 · v1.2.0*
