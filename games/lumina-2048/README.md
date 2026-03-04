# Lumina 2048 — Documentación Técnica

> **Versión:** `1.0.0` · **Plataforma:** Love Arcade · **Core compatible:** Game Center Core v7.5+
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

## Mecánicas de Juego

### 2048 Estándar
Fusionar fichas del mismo valor moviéndolas con flechas del teclado o swipe táctil. El objetivo es alcanzar la ficha de **2048**.

### Combo Meter (exclusivo)
Cada movimiento que produzca al menos una fusión incrementa el streak. Al completar **5 movimientos consecutivos** con fusión, el Combo Meter llega al 100 % y se dispara el efecto automático: **todos los pares de fichas con valor 2 y 4 se fusionan instantáneamente**.

### Fichas de Energía (⚡)
Con un **6 %** de probabilidad, cada nuevo tile generado es una Ficha de Energía. Se comporta como una ficha de valor 2 pero visualmente distinta (⚡). Al fusionarse con otra ficha del mismo valor, se llama a `window.GameCenter.completeLevel()` otorgando **5 monedas por ficha de energía** involucrada.

---

## Arquitectura de Módulos

### `lumina_core.js`
- Matriz 4×4 en `lumina_grid` (objetos-ficha con `id`, `value`, `isEnergy`, `isNew`, `isMerged`)
- `lumina_move(direction)` aplica rotación de grilla para unificar la lógica "mover hacia arriba"
- Detección de fin de partida y victoria
- Persistencia en `localStorage` bajo prefijo `LUMINA_` (aislamiento de namespace)

### `lumina_render.js`
- Tiles posicionados con `--tile-x` / `--tile-y` (CSS custom properties)
- Transición `cubic-bezier(0.25, 0.1, 0.05, 1)` para movimiento orgánico
- Sistema de partículas en `<canvas>` con `requestAnimationFrame` (solo fichas ≥ 128)
- Efecto parallax giroscópico via `DeviceOrientationEvent`

### `lumina_input.js`
- `TouchEvent` con detección de flick rápido (< 200 ms) para umbrales reducidos
- Prevención de scroll involuntario del navegador dentro del área de juego
- Lock de input durante las 160 ms de animación CSS para evitar moves dobles

### `lumina_audio.js`
- Escala pentatónica mayor (C4→D6) garantiza que todos los tonos sean armónicos
- `lumina_playMoveSound()` → clic seco de alta frecuencia (square wave)
- `lumina_playMergeSound(value)` → sub-bass + campana, tono sube con el valor
- `lumina_playWinSound()` → arpeggio triunfal con reverb de convolución sintético
- AudioContext iniciado solo tras primer gesto del usuario (política del navegador)

### `lumina_bridge.js`
- Única interfaz con `window.GameCenter` (solo `completeLevel`)
- Modo standalone: todas las llamadas a GameCenter están envueltas en `typeof` check
- `lumina_syncTheme()` lee el store de la plataforma en modo solo-lectura

---

## Economía de Monedas

| Hito | Cálculo | Ejemplo |
|---|---|---|
| Victoria (2048) | `max(10, floor(score / 50))` | Score 15 000 → 300 monedas |
| Ficha de Energía fusionada | `5 por ficha` | 2 fichas → 10 monedas |

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

### Aislamiento y Namespacing
- [x] Todas las variables/funciones globales llevan prefijo `lumina_`
- [x] Todas las claves de `localStorage` llevan prefijo `LUMINA_`
- [x] No se declara ni sobrescribe ningún global reservado del núcleo (`CONFIG`, `ECONOMY`, `THEMES`, `window.GameCenter`, etc.)

### Integración con la Economía
- [x] Recompensas calculadas internamente y convertidas a entero con `Math.floor`
- [x] Solo se invoca `window.GameCenter.completeLevel(gameId, levelId, coins)`
- [x] `rewardAmount` siempre `> 0` antes de la llamada
- [x] `levelId` único por sesión usando `Date.now()`

### Modo Standalone y Robustez
- [x] Funciona sin `app.js` (modo standalone con logs de advertencia)
- [x] Al ganar, el contador de monedas de la Navbar de Love Arcade incrementa
- [x] Zero-Flicker: tema leído de `localStorage` antes del primer paint

---

*Lumina 2048 · Love Arcade · Game Center Core v7.5 · 2026*
