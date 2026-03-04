# Documentación Técnica — Rompecabezas Arcade
**Proyecto:** Rompecabezas Arcade (Neural Puzzle)  
**Plataforma:** Love Arcade  
**Versión del motor:** `PuzzleEngine v15.0` · `main.js v4.0` · `UIController v3.0`  
**Última revisión:** Marzo 2026

---

## Índice

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Arquitectura y Flujo de la Aplicación](#3-arquitectura-y-flujo-de-la-aplicación)
4. [Módulos del Sistema](#4-módulos-del-sistema)
   - 4.1 [main.js — Orquestador](#41-mainjs--orquestador)
   - 4.2 [PuzzleEngine.js — Motor de Juego](#42-puzzleenginejs--motor-de-juego)
   - 4.3 [LevelManager.js — Gestor de Niveles](#43-levelmanagerjs--gestor-de-niveles)
   - 4.4 [UIController.js — Controlador de Interfaz](#44-uicontrollerjs--controlador-de-interfaz)
   - 4.5 [Storage.js — Almacenamiento](#45-storagejs--almacenamiento)
   - 4.6 [Economy.js — Sistema de Economía](#46-economyjs--sistema-de-economía)
   - 4.7 [AudioSynth.js — Síntesis de Audio](#47-audiosynthjs--síntesis-de-audio)
5. [Datos de Configuración — levels.json](#5-datos-de-configuración--levelsjson)
6. [Pantallas y Navegación](#6-pantallas-y-navegación)
7. [Sistema de Progresión del Jugador](#7-sistema-de-progresión-del-jugador)
8. [Motor Visual — PuzzleEngine en Detalle](#8-motor-visual--puzzleengine-en-detalle)
9. [Sistema Háptico](#9-sistema-háptico)
10. [Sistema de Audio Procedural](#10-sistema-de-audio-procedural)
11. [Características PWA](#11-características-pwa)
12. [Guía de Mantenimiento y Expansión](#12-guía-de-mantenimiento-y-expansión)

---

## 1. Visión General

**Rompecabezas Arcade** es un juego de puzzles de arrastrar y soltar, construido con JavaScript vanilla y Canvas API, diseñado para correr como Progressive Web App (PWA) dentro del ecosistema **Love Arcade**. El jugador arrastra piezas de una imagen fragmentada hasta reconstruirla dentro de un tablero, compitiendo contra un temporizador para obtener la máxima calificación en estrellas.

### Características principales

- **35 niveles** organizados en tres tramos de dificultad (Básico, Intermedio, Experto).
- Motor de renderizado en canvas con soporte para mouse y pantalla táctil.
- Sistema de recompensas en monedas integrado con el núcleo de **Love Arcade** via `window.GameCenter`.
- Efectos visuales avanzados: rejilla reactiva con parallax, pulsos radiales, destellos de encaje y partículas.
- Retroalimentación háptica por vibración (`navigator.vibrate`) para pickup, snap y victoria.
- Audio procedural sintetizado con la Web Audio API (sin archivos de sonido externos).
- Persistencia de progreso en `localStorage` con sistema de versionado de esquema.
- Soporte offline via Service Worker.

---

## 2. Estructura del Proyecto

```
/
├── index.html                  # Shell HTML de la aplicación
├── manifest.json               # Manifiesto PWA
├── service-worker.js           # Service Worker para soporte offline
├── assets/
│   ├── Nivel1.webp … Nivel35.webp      # Imágenes de nivel
│   ├── thumbnails/
│   │   └── Nivel1_thumb.webp … Nivel35_thumb.webp
│   └── icons/
│       └── icon-192.png        # Ícono PWA
├── public/
│   └── levels.json             # Configuración de todos los niveles
└── src/
    ├── main.js                 # Punto de entrada y orquestador
    ├── style.css               # Estilos globales (Tactical HUD palette)
    ├── core/
    │   ├── PuzzleEngine.js     # Motor de renderizado y lógica de piezas
    │   └── LevelManager.js     # Carga y estado de niveles
    ├── ui/
    │   └── UIController.js     # Gestión de pantallas y DOM
    └── systems/
        ├── Storage.js          # Persistencia en localStorage
        ├── Economy.js          # Integración con GameCenter (monedas)
        └── AudioSynth.js       # Síntesis de efectos de sonido
```

---

## 3. Arquitectura y Flujo de la Aplicación

El juego sigue un patrón de **orquestador centralizado**: `main.js` importa e instancia todos los módulos y los conecta mediante callbacks, sin que los módulos se conozcan entre sí directamente.

### Diagrama de dependencias

```
main.js
 ├── LevelManager   → [lee] levels.json
 ├── UI             → [manipula] DOM / pantallas
 ├── Storage        → [lee/escribe] localStorage
 ├── PuzzleEngine   → [renderiza] <canvas>
 │     └── callbacks: onSound, onWin, onSnap, onStateChange
 ├── AudioSynth     → [genera] Web Audio API
 └── Economy        → [notifica] window.GameCenter
```

### Secuencia de arranque

```
DOMContentLoaded
  └─ init()
       ├─ LevelManager.loadLevels()         // fetch ./public/levels.json
       ├─ Storage.validateUnlockedLevels()  // repara desbloqueados huérfanos
       ├─ UI.initGlobalInteractions()       // botones: release bounce
       ├─ setupNavigation()                 // bind de todos los botones de nav
       ├─ setupSettings()                   // ajustes de sonido y reset
       └─ UI.showScreen('menu')             // muestra pantalla inicial
```

### Secuencia de un nivel completo

```
Jugador presiona tarjeta de nivel
  └─ startGame(levelId)
       ├─ levelManager.getLevelById()
       ├─ UI.showScreen('game')
       ├─ new Image() → img.onload
       │    ├─ new PuzzleEngine(canvas, config, callbacks)
       │    ├─ startTimer(levelConfig)
       │    └─ setupGameControls()
       │
       ├─ [Juego activo — player arrastra piezas]
       │    ├─ PuzzleEngine.onSnap  → AudioSynth.play('snap') + navigator.vibrate([30,20,10])
       │    └─ PuzzleEngine.onStateChange → Storage.set(`save_${id}`, state)
       │
       └─ PuzzleEngine.onWin → handleVictory(levelConfig)
            ├─ calcular estrellas (pieces × 5 / × 10)
            ├─ Storage.saveStars()
            ├─ Storage.unlockLevel(nextId)
            ├─ Economy.payout(levelId, rewardCoins)
            ├─ navigator.vibrate([100,50,80,50,200])
            └─ UI.showVictoryModal()
```

---

## 4. Módulos del Sistema

### 4.1 `main.js` — Orquestador

**Ruta:** `src/main.js`  
**Versión:** v4.0 — Tactical HUD & Precision Geometry

Es el único módulo con acceso global al estado de la sesión de juego. Declara y gestiona las siguientes variables de estado:

| Variable        | Tipo              | Descripción                                      |
|-----------------|-------------------|--------------------------------------------------|
| `levelManager`  | `LevelManager`    | Instancia global del gestor de niveles           |
| `activeGame`    | `PuzzleEngine`    | Instancia activa del motor (null si no hay juego)|
| `gameTimer`     | `number`          | ID del intervalo del temporizador                |
| `currentLevelId`| `string`          | ID del nivel en juego (ej: `"lvl_5"`)           |
| `startTime`     | `number`          | Timestamp `Date.now()` al arrancar el nivel      |

#### Funciones principales

**`init()`** — Arranque asíncrono de la app. Llamada en `DOMContentLoaded`.

**`startGame(levelId, loadSaved)`** — Inicia o restaura un nivel. Carga la imagen, instancia `PuzzleEngine` y arranca el temporizador. Si `loadSaved` es `true`, importa el estado guardado desde `Storage`.

**`handleVictory(levelConfig)`** — Ejecutada por el callback `onWin` de `PuzzleEngine` (con 1500ms de retardo para que se vean las animaciones de victoria). Calcula estrellas, guarda progreso, desbloquea el siguiente nivel, llama a `Economy.payout()` y muestra el modal de victoria.

**`startTimer(levelConfig)`** — Inicia el contador regresivo desde `levelConfig.timeLimit`. Cada segundo actualiza el display del HUD y aplica el color correspondiente al tramo de tiempo (oro/plata/bronce). Al llegar a cero destruye el motor y muestra el modal de Game Over. Aplica la clase `low-time` cuando quedan ≤ 10 segundos.

**`setupGameControls()`** — Registra los botones de control en la pantalla de juego:
- **Vista Previa** (`btn-preview`): muestra la imagen completa semitransparente mientras se mantiene pulsado.
- **Imán** (`btn-magnet`): coloca automáticamente una pieza aleatoria en su posición correcta. Costo: 10 monedas (deducidas via `window.GameCenter.buyItem`). En modo standalone (desarrollo), solicita confirmación sin costo.

**`saveProgress(lid)`** — Serializa el estado actual del motor via `activeGame.exportState()` y lo persiste con `Storage.set()`.

---

### 4.2 `PuzzleEngine.js` — Motor de Juego

**Ruta:** `src/core/PuzzleEngine.js`  
**Versión:** v15.0 — Tactical HUD & Precision Geometry

Es el módulo más extenso. Gestiona todo lo que ocurre dentro del `<canvas>`: generación de piezas, shuffle, física de arrastre, detección de snap, efectos visuales y el loop de animación.

#### Constructor

```js
new PuzzleEngine(canvasElement, config, callbacks)
```

| Parámetro       | Descripción                                                       |
|-----------------|-------------------------------------------------------------------|
| `canvasElement` | El elemento `<canvas id="puzzle-canvas">` del DOM                |
| `config.image`  | Objeto `Image` ya cargado con la imagen del nivel                 |
| `config.pieces` | Número de piezas (debe ser cuadrado perfecto: 16 o 25)            |
| `callbacks`     | Objeto con `onSound`, `onWin`, `onSnap`, `onStateChange`          |

#### Buffers de Canvas

El motor usa **cuatro superficies de dibujo** distintas para optimizar rendimiento:

| Buffer          | Propósito                                                         |
|-----------------|-------------------------------------------------------------------|
| `canvas`        | Canvas principal visible. Reescrito en cada frame del loop.       |
| `staticCanvas`  | Capa estática: tablero y piezas encajadas. Solo se actualiza al producirse un snap. |
| `sourceCanvas`  | Copia escalada de la imagen original a resolución del tablero.    |
| `gridCanvas`    | Rejilla de fondo (líneas azules, offscreen). Se reconstruye solo en resize. |

#### Loop de animación — sistema de pausa inteligente

El loop usa `requestAnimationFrame` pero se **detiene automáticamente** cuando no hay nada que animar, reduciendo el consumo de batería en dispositivos móviles:

```
canStop = true si:
  - no hay drag activo
  - no hay partículas
  - no hay snapFlashes
  - no hay edgePulses
  - no hay needsStaticUpdate
  - no hay preview activo
  - _idleWakeCount ≤ 0
```

Un `setInterval` de 5 segundos reactiva el loop durante ~70 frames para animar el parpadeo de los micro-puntos de la rejilla.

#### Generación de topología de piezas

El método `generateSharedTopology()` crea la geometría de bordes **una sola vez** al inicializar, asegurando que las piezas encajen entre sí con precisión perfecta:

1. Para cada celda se asigna una dirección de lengüeta (`+1` = hacia afuera, `-1` = entrante) de forma aleatoria.
2. La dirección del borde compartido entre dos piezas adyacentes es siempre opuesta (si A tiene `+1` en su borde derecho, B tiene `-1` en su borde izquierdo).
3. Los bordes exteriores del tablero siempre tienen valor `0` (rectos).
4. Se añade un `jitter` aleatorio a cada borde (±15% del tamaño del tab) para que ninguna pieza sea idéntica.

Las piezas se dibujan usando `Path2D` con curvas `bezierCurveTo`, lo que permite tanto el clipping de la imagen como la detección de colisiones.

#### Detección de snap

Al soltar una pieza, se calcula la distancia euclidiana entre su posición actual y su posición correcta. Si la distancia es menor al 30% del ancho de pieza (`pieceWidth * 0.3`), la pieza se encaja automáticamente. El umbral de detección de toque al levantar es más generoso (`tabSize * 2.0`) para compensar la imprecisión del dedo.

#### Shuffle y zonas de distribución

El método `shufflePieces()` distribuye las piezas sueltas en **tres zonas seguras** que evitan solapar el tablero y los controles del HUD:

- Zona izquierda (entre borde de pantalla y tablero)
- Zona derecha (entre tablero y borde de pantalla)
- Zona inferior (debajo del tablero)

Si el espacio disponible es insuficiente (pantallas muy pequeñas), las piezas se distribuyen en toda la pantalla con un mecanismo de collision-avoidance de hasta 50 intentos por pieza.

#### API pública

| Método                  | Descripción                                                        |
|-------------------------|--------------------------------------------------------------------|
| `exportState()`         | Retorna array `[{id, cx, cy, locked}]` para persistir en Storage  |
| `importState(state)`    | Restaura posiciones y estado de bloqueo desde un estado guardado  |
| `togglePreview(bool)`   | Activa/desactiva la superposición semitransparente de la imagen    |
| `autoPlacePiece()`      | Encaja aleatoriamente una pieza suelta (power-up Imán)            |
| `handleResize()`        | Recalcula dimensiones y redistribuye piezas sin perder progreso   |
| `destroy()`             | Limpia todos los event listeners y detiene el loop                |

---

### 4.3 `LevelManager.js` — Gestor de Niveles

**Ruta:** `src/core/LevelManager.js`

Responsable de cargar `levels.json` y combinar la configuración estática de cada nivel con el estado de progreso dinámico del jugador.

#### Métodos

**`loadLevels()`** — Fetch asíncrono de `./public/levels.json`. Agrega el campo `index` numérico a cada nivel para facilitar cálculos de posición relativa.

**`getAllLevelsWithStatus()`** — Combina cada nivel con su estado actual consultando `Storage.isUnlocked()` y `Storage.getStars()`. Retorna objetos con:

```js
{
  ...nivel,            // todos los campos de levels.json
  status: 'locked' | 'unlocked' | 'completed',
  stars:  0 | 1 | 2 | 3,
  thumbnail: string    // fallback a image si thumbnail no existe
}
```

**`getLevelById(id)`** — Búsqueda directa por ID para cargar la configuración de un nivel.

**`getNextLevelId(currentId)`** — Retorna el ID del siguiente nivel en el array o `null` si es el último (nivel 35).

---

### 4.4 `UIController.js` — Controlador de Interfaz

**Ruta:** `src/ui/UIController.js`  
**Versión:** v3.0

Gestiona exclusivamente el DOM: transiciones entre pantallas, renderizado de la grilla de niveles y modales.

#### `initGlobalInteractions()`

Registra una delegación de eventos en `document` para aplicar la animación **release bounce** a todos los botones (`.btn`, `.btn-icon`, `.btn-circle`) usando la Web Animations API:

```
Secuencia de transform: scale3d(0.96) → scale3d(1.02) → scale3d(1.00)
Duración: 200ms  |  Solo transform (GPU-composited, sin layout thrashing)
```

#### `showScreen(name)`

Cambia la pantalla activa usando clases CSS (`opacity` + `translate3d`). Fuerza el replay de las animaciones de stagger en los botones de navegación del menú mediante un reflow intencional (`void el.offsetHeight`).

#### `renderLevelsGrid(levels, onLevelSelect)`

Genera dinámicamente las tarjetas de nivel con carga lazy de thumbnails y estados visuales:

| Estado     | Visual en tarjeta                           |
|------------|---------------------------------------------|
| `locked`   | Ícono de candado SVG                        |
| `unlocked` | Número de nivel (código del ID)             |
| `completed`| Estrellas doradas (★ llenas / ☆ vacías)    |

Cada tarjeta aplica `animationDelay: index × 30ms` para el efecto de entrada escalonado (stagger). Si la thumbnail falla, hace fallback automático a la imagen principal.

#### `showVictoryModal(coins, timeStr, stars, onNext, onMenu)`

Muestra el modal de victoria con las estrellas obtenidas renderizadas dinámicamente. Clona los botones de acción para eliminar listeners huérfanos de partidas anteriores.

---

### 4.5 `Storage.js` — Almacenamiento

**Ruta:** `src/systems/Storage.js`  
**Versión:** v2.0 — Secure & Versioned

Capa de abstracción sobre `localStorage` con validación de integridad y soporte para migraciones futuras de esquema.

#### Mecanismo de versionado

Cada valor se guarda con un envelope de metadata:

```js
{
  ver:       1,             // SCHEMA_VERSION
  timestamp: 1700000000000, // Date.now() al guardar
  data:      <valor real>
}
```

Si al leer un valor su `ver` no coincide con la versión actual, se descarta y se retorna el `defaultValue`. Las claves se prefijan con `puz_arcade_` para no colisionar con otras apps del dominio.

#### Claves utilizadas

| Clave (sin prefijo)  | Tipo     | Contenido                                           |
|----------------------|----------|-----------------------------------------------------|
| `progress`           | `object` | `{ "lvl_1": 3, "lvl_2": 2, … }` (estrellas por nivel) |
| `unlocked`           | `array`  | `["lvl_1", "lvl_2", …]` (IDs desbloqueados)        |
| `save_{levelId}`     | `array`  | Estado serializado de `PuzzleEngine.exportState()`  |
| `settings`           | `object` | `{ sound: true/false }`                             |

#### `validateUnlockedLevels(allLevels)`

Función de reparación ejecutada al arrancar. Recorre todos los niveles en orden y, si un nivel tiene estrellas guardadas pero el siguiente no está en la lista de desbloqueados (caso de usuarios que jugaron antes de una actualización del juego), lo desbloquea automáticamente.

---

### 4.6 `Economy.js` — Sistema de Economía

**Ruta:** `src/systems/Economy.js`

Implementa el **Contrato de Integración** con el sistema universal de monedas de Love Arcade.

#### `payout(levelId, rewardCoins)`

Flujo de ejecución:

1. **Validación de tipos:** verifica que `rewardCoins` sea entero positivo (`Number.isInteger` + `> 0`) y que `levelId` sea string. Si alguna validación falla, registra un error y aborta sin lanzar excepción.
2. **Detección de entorno:** comprueba `window.GameCenter` y que el método `completeLevel` exista y sea función.
3. **Ejecución del contrato:** llama `window.GameCenter.completeLevel(GAME_ID, levelId, rewardCoins)` donde `GAME_ID = 'rompecabezas'`.
4. **Fallback standalone:** si `window.GameCenter` no existe (entorno de desarrollo), registra un `console.warn` y continúa la partida normalmente. El juego **nunca rompe** por ausencia de `GameCenter`.

---

### 4.7 `AudioSynth.js` — Síntesis de Audio

**Ruta:** `src/systems/AudioSynth.js`

Genera todos los efectos de sonido del juego de forma procedural mediante la Web Audio API, sin necesidad de archivos de audio externos. Se exporta como singleton: `export const AudioSynth = new AudioSynthesizer()`.

#### Arquitectura del grafo de audio

```
Osciladores/Filtros
        ↓
  GainNode (envelope ADSR)
        ↓
  DynamicsCompressor  (threshold: -24dB, ratio: 6:1)
        ↓
  MasterGain (0.7)
        ↓
  AudioContext.destination
```

#### Efectos disponibles

Invocados via `AudioSynth.play(type)`:

| Tipo      | Método        | Descripción técnica                                                     |
|-----------|---------------|-------------------------------------------------------------------------|
| `'click'` | `uiClick()`   | Transiente triangle a 1200Hz + cuerpo sine a 500Hz                     |
| `'snap'`  | `pieceSnap()` | Golpe square a 220Hz con lowpass 1200Hz + click triangle a 900Hz       |
| `'win'`   | `winChord()`  | Acorde C-E-G (523/659/784Hz) con entrada escalonada + brillo en 1568Hz |

#### Síntesis de tonos — método `tone(params)`

Motor base que crea y conecta automáticamente un oscilador con envelope exponencial:

- **Attack:** rampa exponencial de `0.0001` al volumen objetivo en `attack` segundos.
- **Release:** rampa exponencial de vuelta a `0.0001` en `decay` segundos.
- El oscilador se detiene automáticamente `50ms` después del fin del decay.
- Soporta filtros opcionales `lowpass` y `highpass` insertados entre el oscilador y el gain.

El contexto de audio se reanuda automáticamente (`ctx.resume()`) en el primer evento de interacción del usuario, respetando la política de autoplay del navegador.

---

## 5. Datos de Configuración — `levels.json`

**Ruta:** `public/levels.json`

Array de 35 objetos de nivel. El primer nivel (`lvl_1`) está desbloqueado por defecto; cada nivel completado desbloquea el siguiente.

### Estructura de objeto

```json
{
  "id":          "lvl_N",
  "image":       "./assets/NivelN.webp",
  "thumbnail":   "./assets/thumbnails/NivelN_thumb.webp",
  "pieces":      16,
  "rewardCoins": 150,
  "description": "Texto descriptivo",
  "timeLimit":   350
}
```

### Distribución de niveles

| Tramo       | Niveles | Piezas         | Recompensa      | Grid   |
|-------------|---------|----------------|-----------------|--------|
| Básico      | 1–10    | 16 (fijas)     | 150 → 180 🪙   | 4 × 4  |
| Intermedio  | 11–25   | 16 y 25 (alt.) | 181 → 230 🪙   | 4×4 / 5×5 |
| Experto     | 26–35   | 25 (fijas)     | 231 → 270 🪙   | 5 × 5  |

> Para la especificación completa de criterios de aceptación de este archivo, consultar el documento **`criterios-aceptacion-levels.md`**.

---

## 6. Pantallas y Navegación

La aplicación tiene cuatro pantallas gestionadas por `UIController.showScreen()`. Las transiciones son por opacidad + `translate3d(16px → 0)` a 250ms.

### Pantalla: Menú (`screen-menu`)

Pantalla de inicio con el logo de Love Arcade y cuatro acciones: **JUGAR**, **NIVELES**, **AJUSTES** y **SALIR** (que redirige al índice de Love Arcade).

### Pantalla: Niveles (`screen-levels`)

Cuadrícula de tarjetas con carga lazy de thumbnails. Mostrar esta pantalla llama siempre a `refreshLevelsScreen()` para refrescar el estado de progreso. Si el nivel seleccionado tiene una partida guardada, aparece el **modal de Reanudación** ofreciendo continuar o reiniciar.

### Pantalla: Juego (`screen-game`)

Contiene el HUD superior, el `<canvas>` principal y los controles flotantes:

**HUD:**

| Elemento      | ID             | Contenido                                    |
|---------------|----------------|----------------------------------------------|
| Número de nivel | `hud-level`  | `LVL N` (posición ordinal en el array)       |
| Temporizador  | `hud-timer`    | `MM:SS` o `∞` si no hay límite              |

**Colores del temporizador según tramo:**

| Clase CSS       | Condición                                   |
|-----------------|---------------------------------------------|
| `timer-gold`    | Tiempo transcurrido ≤ `pieces × 5`s        |
| `timer-silver`  | Tiempo transcurrido ≤ `pieces × 10`s       |
| `timer-bronze`  | Resto del tiempo                            |
| `low-time`      | Tiempo restante ≤ 10 segundos (animación extra) |

**Controles flotantes:**

- 👁 **Vista Previa** — Muestra la imagen objetivo al 28% de opacidad mientras se mantiene pulsado.
- 🧲 **Imán** — Power-up de pago (10 🪙). Coloca una pieza aleatoria automáticamente.

### Pantalla: Ajustes (`screen-settings`)

- **Sonido FX:** toggle que activa/desactiva `AudioSynth.enabled` y persiste en `Storage`.
- **Resetear Progreso:** limpia todo el `localStorage` y recarga la app.

### Modales

| ID                 | Título             | Cuándo aparece                              |
|--------------------|--------------------|---------------------------------------------|
| `modal-resume`     | PARTIDA GUARDADA   | Al seleccionar nivel con `save_` en Storage |
| `modal-pause`      | PAUSA              | Al pulsar el botón de pausa del HUD         |
| `modal-gameover`   | TIEMPO AGOTADO     | Al llegar el temporizador a 0               |
| `modal-victory`    | ¡MISIÓN CUMPLIDA!  | Al completar el rompecabezas                |

---

## 7. Sistema de Progresión del Jugador

### Desbloqueo de niveles

El nivel `lvl_1` siempre está desbloqueado. Cada vez que se completa un nivel (independientemente de las estrellas), se llama a `Storage.unlockLevel(nextLvlId)`. El progreso se valida al arrancar la app para reparar posibles inconsistencias.

### Cálculo de estrellas

Calculado en `handleVictory()` usando el tiempo transcurrido (`Date.now() - startTime`):

| Estrellas | Condición                              | Ejemplo (16 piezas) | Ejemplo (25 piezas) |
|-----------|----------------------------------------|---------------------|---------------------|
| ⭐⭐⭐     | `duration ≤ pieces × 5s`              | ≤ 80 segundos       | ≤ 125 segundos      |
| ⭐⭐       | `duration ≤ pieces × 10s`             | ≤ 160 segundos      | ≤ 250 segundos      |
| ⭐         | Cualquier otro caso (nivel completado) | > 160 segundos      | > 250 segundos      |

Solo se actualiza la puntuación si mejora la anterior (`Storage.saveStars` retorna `true` solo en nuevo récord).

### Guardado automático de partidas

Cada vez que una pieza es movida o encajada, `onStateChange` serializa el estado completo del tablero y lo guarda en `Storage` bajo la clave `save_{levelId}`. Al completar el nivel, esta clave se limpia (`Storage.set('save_{id}', null)`).

---

## 8. Motor Visual — PuzzleEngine en Detalle

### Orden de render por frame

Cada llamada a `render()` dibuja las capas en este orden sobre el canvas principal:

1. **Rejilla de fondo con parallax** — composita el `gridCanvas` offscreen con desplazamiento proporcional a la posición del puntero o la orientación del dispositivo (±5% del tamaño de pantalla).
2. **Micro-puntos parpadeantes** — puntos de 2×2px en intersecciones de la rejilla con opacidad sinusoidal individual.
3. **Capa estática** — copia el `staticCanvas` (tablero + piezas encajadas), que no se recalcula salvo al producirse un snap.
4. **Vista previa** — imagen completa semitransparente (28% de opacidad) si está activa.
5. **Piezas sueltas no seleccionadas** — renderizadas en su posición actual.
6. **Ghost de snap** — cuando la pieza arrastrada está a menos del 40% de distancia de su destino, aparece un contorno fantasma en blanco semitransparente.
7. **Pieza seleccionada** — escalada al 105% con contorno blanco de 2px.
8. **Partículas** — ripples y confetti animados.
9. **Snap flashes** — destello perimetral esmeralda en la pieza recién encajada (150ms).
10. **Edge pulses** — dos anillos concéntricos (esmeralda + azul) expandiéndose desde el snap hasta los bordes de pantalla (700ms, ease-out cuadrático).

### Sistema de parallax

La rejilla de fondo reacciona a dos inputs:

- **`pointermove`** — el vector desde el centro de pantalla hasta el puntero determina el desplazamiento opuesto.
- **`deviceorientation`** — los ángulos `gamma` (izquierda/derecha) y `beta` (adelante/atrás) del giroscopio se mapean a coordenadas de pantalla.

El desplazamiento se interpola con `lerp` de factor 0.08 por frame, produciendo un movimiento suave sin tirones.

---

## 9. Sistema Háptico

El motor usa `navigator.vibrate()` con patrones específicos según el evento. El API es tolerante a fallo: si el navegador no soporta vibración, la llamada simplemente no hace nada.

| Evento            | Patrón de vibración   | Sensación             |
|-------------------|-----------------------|-----------------------|
| Levantar pieza    | `10`                  | Pulso suave de pickup |
| Encajar pieza     | `[30, 20, 10]`        | Doble pulso (snap)    |
| Victoria          | `[100, 50, 80, 50, 200]` | Celebración intensa |

---

## 10. Sistema de Audio Procedural

Todos los sonidos son sintetizados en tiempo real. No hay archivos `.mp3` ni `.ogg`. El grafo de audio incluye compresión dinámica para evitar clipping en dispositivos con altavoces de baja fidelidad.

| Evento            | Sonido                | Notas técnicas                              |
|-------------------|-----------------------|---------------------------------------------|
| Tocar pieza       | `click` — 2 osciladores | Transiente triangle + cuerpo sine          |
| Encajar pieza     | `snap` — 2 osciladores  | Square con lowpass + triangle agudo        |
| Completar nivel   | `win` — acorde C-E-G  | 4 tonos con entrada escalonada (0.12s cada uno) |

El audio puede desactivarse desde Ajustes. El estado se persiste en `Storage` bajo la clave `settings.sound`.

---

## 11. Características PWA

El juego está configurado como Progressive Web App con soporte para instalación en dispositivos móviles y funcionalidad offline básica.

### Manifiesto (`manifest.json`)

Declarado en `index.html`. Define el nombre de la app, ícono (`icon-192.png`), color de tema (`#05070A`) y modo de visualización standalone.

### Service Worker (`service-worker.js`)

Registrado en `main.js`. El juego precachea los activos necesarios para funcionar offline. Si el registro falla, el juego continúa funcionando en modo conectado sin interrupciones.

### Meta tags para iOS

El `index.html` incluye las meta tags de Apple para comportamiento fullscreen:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

El viewport está configurado con `user-scalable=no` y `viewport-fit=cover` para ocupar toda la pantalla incluyendo el notch en iPhone.

---

## 12. Guía de Mantenimiento y Expansión

### Agregar un nivel nuevo (lvl_36 en adelante)

1. Añadir la imagen del nivel: `assets/Nivel36.webp`
2. Añadir la miniatura: `assets/thumbnails/Nivel36_thumb.webp`
3. Agregar el objeto al final del array en `public/levels.json`:

```json
{
  "id": "lvl_36",
  "image": "./assets/Nivel36.webp",
  "thumbnail": "./assets/thumbnails/Nivel36_thumb.webp",
  "pieces": 25,
  "rewardCoins": 270,
  "description": "Descripción del nivel",
  "timeLimit": 350
}
```

4. Verificar que `rewardCoins` no supere 270 y sea entero positivo.
5. Verificar que el JSON resultante sea válido antes del commit.

### Modificar el cálculo de estrellas

El umbral de estrellas está hardcodeado en dos lugares en `main.js`. Ambos deben actualizarse de forma sincronizada:

- `handleVictory()` — líneas `if (durationSeconds <= pieces * 5)` / `pieces * 10`
- `startTimer()` — líneas `const threeStarTime = levelConfig.pieces * 5` / `* 10`

### Agregar un nuevo tipo de poder (power-up)

1. Añadir el botón en `index.html` dentro de `.game-controls`.
2. Registrar el handler en `setupGameControls()` en `main.js`.
3. Implementar la lógica en `PuzzleEngine.js` como método público.
4. Llamar a `window.GameCenter.buyItem({ id: 'nuevo_item', price: N })` para la transacción.

### Cambiar el rango de recompensas

Si se decide expandir el rango de monedas más allá de 270, es necesario coordinar el cambio con el equipo de **Love Arcade** ya que el tope es un parámetro del contrato de `Economy.js` con el sistema `GameCenter`.

### Diagnóstico de errores comunes

| Síntoma                                    | Causa probable                             | Solución                                          |
|--------------------------------------------|--------------------------------------------|----------------------------------------------------|
| El nivel no carga (pantalla de carga infinita) | Ruta de imagen inválida en `levels.json` | Verificar que el archivo `.webp` existe en `assets/` |
| Las piezas no generan cuadrícula correcta  | `pieces` no tiene raíz cuadrada perfecta   | Usar 16 o 25                                       |
| No se depositan monedas al completar       | `rewardCoins` no es entero positivo        | Revisar el valor en `levels.json`; el error aparece en consola |
| Un nivel desbloqueado no aparece disponible | Inconsistencia en `localStorage`          | `Storage.validateUnlockedLevels()` se ejecuta al arrancar; se puede forzar recargando la app |
| Error crítico al cargar `levels.json`      | El Service Worker tiene una versión cacheada desactualizada | Incrementar la versión del SW o limpiar caché del navegador |
| El audio no suena en iOS                   | Política de autoplay del navegador         | El `AudioContext` se reanuda en el primer toque; normal en iOS |
