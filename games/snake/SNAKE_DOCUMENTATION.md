# Snake — Documentación Técnica
### LA-Snake Classic | Love Arcade Game Suite

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Módulo 1 — snake-core.js](#3-módulo-1--snake-corejs)
4. [Módulo 2 — snake-renderer.js](#4-módulo-2--snake-rendererjs)
5. [Módulo 3 — snake-audio.js](#5-módulo-3--snake-audiojs)
6. [Módulo 4 — snake-economy.js](#6-módulo-4--snake-economyjs)
7. [Mecánicas de Juego](#7-mecánicas-de-juego)
8. [Sistema de Skins](#8-sistema-de-skins)
9. [Integración Love Arcade](#9-integración-love-arcade)
10. [Diseño y UX](#10-diseño-y-ux)
11. [Restricciones Técnicas](#11-restricciones-técnicas)
12. [Guía de Despliegue](#12-guía-de-despliegue)
13. [Changelog](#13-changelog)

---

## 1. Visión General

**Snake** es un juego clásico tipo Snake con mecánicas de combo y power-ups de utilidad, diseñado para el ecosistema **Love Arcade**. El nombre visible para el jugador es simplemente "Snake".

| Atributo          | Valor                                 |
|-------------------|---------------------------------------|
| Nombre del juego  | Snake                                 |
| Game ID           | `snake`                               |
| Versión           | 1.0.0                                 |
| Plataforma        | Web (Mobile First, ≤ 375px)           |
| Estética          | Flat Design — cero glassmorphism      |
| Renderer          | Canvas API nativo                     |
| Assets            | SVGs inline (strings)                 |
| Audio             | Web Audio API (sin archivos .mp3)     |
| Almacenamiento    | localStorage con prefijo `LAS_`       |
| Dependencias      | Ninguna (vanilla JS)                  |

---

## 2. Arquitectura del Sistema

El proyecto se divide en **4 módulos independientes** más un archivo HTML principal que actúa como orquestador.

```
snake.html           ← Orquestador principal (UI + wiring)
├── snake-core.js    ← Motor de juego y lógica
├── snake-renderer.js← Renderizado SVG/Canvas
├── snake-audio.js   ← Síntesis de audio (Web Audio API)
└── snake-economy.js ← Economía, combos, skins, GameCenter
```

### Diagrama de dependencias

```
snake.html
    │
    ├─ LAS_Audio    (snake-audio.js)    — sin dependencias
    ├─ LAS_Economy  (snake-economy.js)  — sin dependencias
    ├─ LAS_Renderer (snake-renderer.js) — sin dependencias
    └─ LAS_Core     (snake-core.js)     — sin dependencias
         │
         └── [Callbacks] → Orquestador → [Llama a todos los módulos]
```

Todos los módulos se exponen como **IIFEs** (Immediately Invoked Function Expressions) con namespacing propio y prefijo `LAS_` en todas las variables internas.

---

## 3. Módulo 1 — snake-core.js

Responsable del motor lógico del juego.

### 3.1 Máquina de Estados

```
START → COUNTDOWN → PLAYING ⇄ PAUSED
                  ↓
               GAMEOVER → (START | PLAYING)
```

| Estado       | Descripción                                         |
|--------------|-----------------------------------------------------|
| `START`      | Pantalla inicial, sin lógica activa                 |
| `COUNTDOWN`  | Cuenta regresiva 3-2-1-GO antes de empezar          |
| `PLAYING`    | Juego en curso con rAF activo                       |
| `PAUSED`     | Loop detenido, se mantiene el estado del juego      |
| `GAMEOVER`   | Serpiente muerta, sesión finalizada                 |

### 3.2 Motor de Movimiento

El movimiento se controla mediante `requestAnimationFrame` con un sistema de **tick controlado por tiempo**:

```javascript
// Velocidad normal:  140ms por tick
// Velocidad freno:   280ms por tick (power-up Brake activo)

if (timestamp - LAS_lastTick >= speedMs) {
    LAS_lastTick = timestamp;
    LAS_tick();
}
```

Esto garantiza **velocidad constante independientemente del FPS** del dispositivo.

### 3.3 Sistema de Input

**4 zonas táctiles** sin botones visibles. El canvas se divide en 4 triángulos desde el centro:

```
         ┌───────┐
         │   ▲   │
         │  UP   │
    ┌────┤───────├────┐
    │ ◄  │   +   │  ► │
    │LEFT│CENTER │RIGHT│
    └────┤───────├────┘
         │  DOWN │
         │   ▼   │
         └───────┘
```

- **Swipe**: Detectado por delta X/Y en touchstart/touchend. Umbral mínimo: 5px.
- **Tap por zona**: Si el delta es menor a 5px, se calcula la zona según posición del tap relativa al centro del canvas.
- **Teclado (desktop)**: Flechas, WASD. Pausa con `P` o `Escape`.

### 3.4 Detección de Colisiones

| Tipo               | Comportamiento                                  |
|--------------------|-------------------------------------------------|
| Cabeza vs Borde    | Muerte inmediata                                |
| Cabeza vs Cuerpo   | Muerte (salvo que Ghost esté activo)            |
| Cabeza vs Comida   | Come, crece, nuevo spawn                        |
| Cabeza vs Power-up | Activa efecto, crece                            |

### 3.5 API Pública (LAS_Core)

```javascript
LAS_Core.init(cols, rows)          // Inicializa con dimensiones de grid
LAS_Core.startGame()               // Inicia cuenta regresiva → juego
LAS_Core.pause()                   // Pausa el loop
LAS_Core.resume()                  // Reanuda el loop
LAS_Core.togglePause()             // Alterna pausa/reanudar
LAS_Core.getState()                // Snapshot del estado actual
LAS_Core.bindTouchInput(canvas)    // Asigna eventos táctiles
LAS_Core.queueDirection(dir)       // Encola dirección ('up'|'down'|'left'|'right')

// Callbacks
LAS_Core.onEat(fn)                 // fn(isPowerup: bool)
LAS_Core.onDeath(fn)               // fn()
LAS_Core.onStateChange(fn)         // fn(newState: string)
LAS_Core.onTurn(fn)                // fn(x, y) — para partículas de piel Gold
LAS_Core.onFrame(fn)               // fn() — llamado cada frame renderizado
```

---

## 4. Módulo 2 — snake-renderer.js

Responsable de todo el renderizado visual en Canvas.

### 4.1 Pipeline de Renderizado

```
LAS_render(state, skinId, comboBorder)
    │
    ├── LAS_drawGrid()              ← Fondo + líneas de grid
    ├── [Combo border solid]        ← Outline 4px si combo activo
    ├── LAS_drawFood(food)          ← SVG imagen
    ├── LAS_drawPowerup(item)       ← SVG imagen + outline pulsante
    ├── LAS_drawSegment() × N       ← Desde cola → cabeza
    ├── [Partículas Gold]           ← Solo skin Gold, en giros
    └── [Barra power-up activo]     ← Strip de 4px en borde superior
```

### 4.2 Sistema de Skins (drawPlayer)

Cada skin modifica el renderizado de los segmentos:

| Skin ID   | Renderizado                                                  |
|-----------|--------------------------------------------------------------|
| `classic` | Rectángulo sólido verde + outline oscuro                     |
| `neon`    | Rectángulo sólido + outline brillante de 2px                 |
| `cyber`   | Base sólida + overlay SVG geométrico hexagonal               |
| `gold`    | Sólido dorado + franja especular + partículas SVG en giros   |

La función de selección es `LAS_Renderer.buildImageCache(skinId)` que pre-renderiza todos los SVGs como imágenes y los guarda en caché.

### 4.3 Assets SVG

Los SVGs se almacenan como **strings inline** en el objeto `LAS_SVG`:

| Key          | Descripción                          | Colores                 |
|--------------|--------------------------------------|-------------------------|
| `food`       | Silueta de manzana roja              | `#ff3b30`, `#25a244`    |
| `magnet`     | Forma de U (imán)                    | `#0a84ff`               |
| `ghost`      | Figura fantasma / capa               | `#bf5af2`               |
| `brake`      | Reloj con manecillas                 | `#ffd60a`, `#1a1a00`    |
| `headRight`  | Cabeza de serpiente (rotada por dir) | Variable por skin        |
| `cyberTile`  | Patrón hexagonal para segmentos      | Variable por skin        |
| `particle`   | Diamante pequeño 8x8px               | `#ffd60a`               |

### 4.4 Pantallas de Overlay

```javascript
LAS_Renderer.drawPauseScreen()
LAS_Renderer.drawGameOverScreen(score, highScore, isNewRecord)
LAS_Renderer.drawCountdown(n)         // n = 3, 2, 1, 0 (GO!)
LAS_Renderer.drawSkinPreview(canvas, skinId, locked)
```

### 4.5 Sistema de Partículas (Gold Edition)

Las partículas se generan en `LAS_spawnParticles(x, y)` cuando la serpiente gira:
- 4 partículas por giro
- Velocidad aleatoria en 4 direcciones ± spread
- Vida: decrece por `decay` por frame (entre 0.04 y 0.07)
- Se renderizan con `globalAlpha = life` para fade out natural

---

## 5. Módulo 3 — snake-audio.js

Síntesis de audio sin archivos externos usando la **Web Audio API**.

### 5.1 Contexto de Audio

El `AudioContext` se crea con `LAS_Audio.init()` que debe llamarse desde un gesto del usuario (requisito de navegadores modernos). El orquestador llama `LAS_Audio.init()` en el primer toque/clic detectado.

```
AudioContext
    └── MasterGain (0.4) ← control de volumen global
            ├── Oscillator (eat, powerup, start, click)
            └── BufferSource (noise — death)
```

### 5.2 Efectos de Sonido

| Función             | Descripción                                   | Tipo      |
|---------------------|-----------------------------------------------|-----------|
| `LAS_Audio.sfxEat()`     | Tono ascendente 300→600 Hz, 120ms       | square    |
| `LAS_Audio.sfxPowerup()` | Arpegio 400→500→700→1000 Hz, 4×55ms    | sawtooth  |
| `LAS_Audio.sfxDeath()`   | Ruido blanco descendente + tono grave   | noise+saw |
| `LAS_Audio.sfxCombo(n)`  | Acorde marcado, sube con multiplicador  | square    |
| `LAS_Audio.sfxClick()`   | Click UI breve 440→480 Hz              | square    |
| `LAS_Audio.sfxStart()`   | Jingle de 4 notas (C4-E4-G4-C5)        | square    |

### 5.3 Gestión de Estado

```javascript
LAS_Audio.init()          // Crea AudioContext (requiere gesto)
LAS_Audio.toggleMute()    // Alterna mute/unmute → devuelve bool
LAS_Audio.isMuted()       // Devuelve estado actual
```

---

## 6. Módulo 4 — snake-economy.js

Ver también: **SNAKE_ECONOMY_DOCS.md** para documentación económica completa.

### 6.1 Prefijo de Almacenamiento

Todas las claves de `localStorage` usan el prefijo `LAS_`:

| Clave localStorage    | Tipo         | Descripción                     |
|-----------------------|--------------|---------------------------------|
| `LAS_highScore`       | `number`     | Puntuación más alta histórica   |
| `LAS_unlockedSkins`   | `string[]`   | IDs de skins desbloqueadas      |
| `LAS_selectedSkin`    | `string`     | Skin seleccionada actualmente   |

### 6.2 Integración GameCenter

La recompensa se entrega **únicamente al finalizar la partida**, nunca durante el juego:

```javascript
// En LAS_endSession(finalScore, snakeLength):
window.GameCenter.completeLevel(
    'snake',      // gameId
    'session',    // levelId
    rewardAmount  // Math.max(1, Math.floor(finalScore / 10))
);
```

---

## 7. Mecánicas de Juego

### 7.1 Flujo de Partida

```
Menú Principal
    └── [Tap PLAY]
            └── Cuenta regresiva (3-2-1-GO)
                    └── PLAYING
                            ├── Come comida → crece + puntos + combo
                            ├── Toca power-up → efecto activo 5s
                            └── Colisión fatal → GAMEOVER
                                        └── Muestra stats + recompensa
                                                └── [Play Again | Menú]
```

### 7.2 Power-ups

Los power-ups aparecen en el grid cada 8 comidas. Solo puede haber 1 activo a la vez en el grid. Si no se recoge en 10 segundos, desaparece.

| Power-up | SVG   | Efecto                                        | Duración |
|----------|-------|-----------------------------------------------|----------|
| Imán     | U     | Atrae comida en radio de 3 celdas (nudge/tick) | 5s       |
| Fantasma | Capa  | Inmunidad a colisiones con el propio cuerpo   | 5s       |
| Freno    | Reloj | Reduce velocidad a la mitad (140ms → 280ms/tick) | 5s    |

### 7.3 Velocidad

| Condición         | Intervalo por tick |
|-------------------|--------------------|
| Normal            | 140ms              |
| Brake activo      | 280ms              |

---

## 8. Sistema de Skins

### 8.1 Tabla de Desbloqueo

| Puntuación mínima | Skin ID   | Nombre         | Descripción visual                         |
|-------------------|-----------|----------------|--------------------------------------------|
| 0                 | `classic` | Classic Green  | Cuadrado verde sólido + outline oscuro      |
| 500               | `neon`    | Neon Pulse     | Sólido + bordes de luz sólida brillante     |
| 1500              | `cyber`   | Cyber Scale    | Geométrico hexagonal sobre base sólida      |
| 3000              | `gold`    | Gold Edition   | Dorado sólido + partículas SVG en giros     |

### 8.2 Lógica de Desbloqueo

1. Al comer, se actualiza el high score si corresponde.
2. Se compara el high score histórico (no el score de la sesión actual) contra los umbrales.
3. Si se supera un umbral nuevo, la skin se agrega al array `LAS_unlockedSkins` en localStorage.
4. Se dispara `LAS_Economy.onSkinUnlock(skinId)` que muestra el toast de desbloqueo.

### 8.3 Selector de Skins (Carrusel)

- Solo permite seleccionar skins donde `currentHighScore >= skin.unlockScore`.
- Las skins bloqueadas se muestran con indicador de puntuación requerida.
- La selección persiste en `localStorage` bajo `LAS_selectedSkin`.

---

## 9. Integración Love Arcade

### 9.1 Navbar

El header del juego respeta la altura de la Navbar de Love Arcade (48px). Si la aplicación host inyecta su propia navbar, el header del juego debe desactivarse o coexistir con ella.

### 9.2 GameCenter API

El juego espera que `window.GameCenter` sea inyectado por el host antes de cargar el script. Si no existe, se usa un stub que solo hace `console.log`:

```javascript
// Stub de desarrollo (incluido en snake.html)
if (!window.GameCenter) {
    window.GameCenter = {
        completeLevel: function(gameId, levelId, reward) {
            console.log(`[GameCenter] completeLevel(${gameId}, ${levelId}, ${reward})`);
        }
    };
}
```

### 9.3 Sequence de Recompensa

```
GAMEOVER
    → LAS_Economy.endSession(score, length)
        → calcular rewardAmount = max(1, floor(score / 10))
        → window.GameCenter.completeLevel('snake', 'session', rewardAmount)
        → mostrar UI de game over con coins ganadas
```

---

## 10. Diseño y UX

### 10.1 Principios de Diseño

- **Flat Design estricto**: Sin `backdrop-filter`, sin `box-shadow` difusa, sin transparencias sobre blur.
- **Alto contraste**: Fondo `#0d0d0d`, elementos a `#f5f5f5`, acentos en colores saturados.
- **Tipografía monoespaciada**: `Courier New` / `Lucida Console` en toda la UI — refuerza la estética retro.
- **Sin emojis**: Toda iconografía es SVG vectorial.

### 10.2 Paleta de Colores

| Variable CSS         | Hex        | Uso                           |
|----------------------|------------|-------------------------------|
| `--LAS_bg`           | `#0d0d0d`  | Fondo principal               |
| `--LAS_surface`      | `#141414`  | Superficies elevadas          |
| `--LAS_accent`       | `#30d158`  | Acción primaria, skin Classic |
| `--LAS_accent2`      | `#ff9f0a`  | Combo bar, highlights         |
| `--LAS_danger`       | `#ff3b30`  | Comida, Game Over             |
| `--LAS_info`         | `#0a84ff`  | Power-up Magnet               |
| `--LAS_purple`       | `#bf5af2`  | Power-up Ghost                |
| `--LAS_gold`         | `#ffd60a`  | Power-up Brake, skin Gold     |

### 10.3 Feedback Visual de Combo

Cuando el multiplicador sube a ≥ 2, el borde exterior del canvas cambia de color (outline sólido CSS, sin blur):

| Multiplicador | Color outline      |
|---------------|--------------------|
| x2 – x4       | `#ff9f0a` (naranja)|
| x5 – x7       | `#ff6b00` (naranja intenso) |
| x8            | `#ff3b30` (rojo)   |

---

## 11. Restricciones Técnicas

| Restricción                           | Estado    | Implementación                               |
|---------------------------------------|-----------|----------------------------------------------|
| Sin glassmorphism                     | Cumplida  | Cero `backdrop-filter`, colores sólidos      |
| Sin emojis                            | Cumplida  | Solo SVG strings + texto ASCII               |
| Sin librerías pesadas                 | Cumplida  | Vanilla JS, Canvas API nativo                |
| Diseño responsivo ≤ 375px             | Cumplida  | `max-width: 430px`, grid calculado dinámico  |
| Prefijo `LAS_` en variables           | Cumplida  | Todas las vars JS y localStorage usan `LAS_` |
| Integración `window.GameCenter`       | Cumplida  | Con stub de desarrollo                       |
| Audio sin archivos .mp3               | Cumplida  | Web Audio API oscillators + BufferSource     |
| Recompensa solo al terminar sesión    | Cumplida  | Solo en `LAS_endSession()`                   |

---

## 12. Guía de Despliegue

### 12.1 Estructura de Archivos

```
/
├── snake.html          ← Punto de entrada (carga los 4 módulos)
├── snake-core.js       ← Módulo 1: Lógica
├── snake-renderer.js   ← Módulo 2: Visuales
├── snake-audio.js      ← Módulo 3: Audio
└── snake-economy.js    ← Módulo 4: Economía
```

### 12.2 Requisitos

- Servidor HTTP cualquiera (no requiere HTTPS salvo para AudioContext en algunos navegadores)
- Navegadores modernos con soporte Canvas API + Web Audio API
- No requiere build step, transpilación ni bundler

### 12.3 Integración en Love Arcade

1. Inyectar `window.GameCenter` **antes** de cargar `snake.html`.
2. Si el host tiene navbar propia, establecer la altura del header con variable CSS o eliminar `#LAS_header`.
3. El juego respeta `max-width: 430px` para coexistir con layouts de contenedor.

### 12.4 Personalización

Para ajustar la velocidad base, editar en `snake-core.js`:
```javascript
const LAS_BASE_SPEED_MS = 140; // ms — reducir para más velocidad
```

Para ajustar la frecuencia de power-ups:
```javascript
const LAS_POWERUP_SPAWN_INTERVAL = 8; // cada N comidas
```

---

## 13. Changelog

### v1.0.0 — Entrega inicial
- Motor de movimiento grid-based con rAF y control de FPS
- Máquina de estados: START / COUNTDOWN / PLAYING / PAUSED / GAMEOVER
- Sistema de 4 zonas táctiles (sin botones visibles)
- Tres power-ups: Imán, Fantasma, Freno
- Sistema de combo con ventana de 3 segundos y multiplicador x1–x8
- Cuatro skins desbloqueables por puntuación
- Síntesis de audio completa (Web Audio API)
- Integración `window.GameCenter.completeLevel`
- Persistencia en localStorage con prefijo `LAS_`
- Diseño Flat 100% — sin glassmorphism, sin emojis

---

*Documentación generada para LA-Snake Classic v1.0.0 — Love Arcade Game Suite*
