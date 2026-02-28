# Ollin Smash

**Versión:** `2.2.0` · **Motor:** Love Arcade Game Center Core `v7.5` · **Estado:** Producción

> Arkanoid Neo-Mexica / Cyberpunk para la plataforma Love Arcade. Juego de ruptura de bloques generado proceduralmente con estética prehispánica, cinco power-ups con mecánicas únicas, sistema de combo multiplicador, audio sintetizado en tiempo real mediante Web Audio API e integración completa con la economía universal de Love Arcade.
>
> La versión 2.1 introdujo una **arquitectura modular completa basada en ES Modules**, descomponiendo el archivo monolítico original en trece unidades con responsabilidades únicas, sin dependencias circulares y con los módulos de física y audio diseñados para pruebas unitarias en aislamiento. La versión 2.2 añade un **sistema de pausa robusto** con tres disparadores independientes y diferenciación entre pausa voluntaria (toggle) y pausa automática (solo pausa).

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Historial de Versiones](#2-historial-de-versiones)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [Arquitectura de Módulos](#4-arquitectura-de-módulos)
5. [Grafo de Dependencias](#5-grafo-de-dependencias)
6. [Referencia de Módulos](#6-referencia-de-módulos)
7. [State Machine](#7-state-machine)
8. [Identidad Visual y Paleta](#8-identidad-visual-y-paleta)
9. [Motor de Física (Ollin-Engine)](#9-motor-de-física-ollin-engine)
10. [Sistema de Oleadas Procedurales](#10-sistema-de-oleadas-procedurales)
11. [Power-Ups: Catálogo Técnico](#11-power-ups-catálogo-técnico)
12. [Sistema de Combo y Puntuación](#12-sistema-de-combo-y-puntuación)
13. [Motor de Audio](#13-motor-de-audio)
14. [Integración con Love Arcade](#14-integración-con-love-arcade)
15. [Namespacing y Aislamiento](#15-namespacing-y-aislamiento)
16. [Controles e Input](#16-controles-e-input)
17. [Sistema de Pausa](#17-sistema-de-pausa)
18. [Persistencia Local](#18-persistencia-local)
19. [Diseño Responsivo y Mobile-First](#19-diseño-responsivo-y-mobile-first)
20. [Modos de Ejecución y Desarrollo](#20-modos-de-ejecución-y-desarrollo)
21. [API Pública del Juego](#21-api-pública-del-juego)
22. [Checklist de QA](#22-checklist-de-qa)
23. [Glosario](#23-glosario)

---

## 1. Descripción General

**Ollin** significa *movimiento* o *terremoto* en náhuatl, y es también el decimotercer signo del calendario azteca. Este nombre dicta la dirección conceptual del juego: energía en estado puro, destrucción rítmica y patrones geométricos en perpetuo movimiento.

Ollin Smash es un clon espiritual de Arkanoid reinterpretado bajo una estética **Neo-Mexica Arcade**: grecas prehispánicas convertidas en circuitos de neón, paleta cromática basada en los colores ceremoniales del Templo Mayor (carmesí, violeta, oro electrónico) y un sistema de audio enteramente sintetizado que mezcla synthwave con percusiones orgánicas prehispánicas.

El juego opera sobre un **bucle infinito de oleadas generadas proceduralmente**. No tiene pantalla final: la dificultad escala de forma continua hasta que el jugador agota sus vidas.

### Características del motor

- Física de colisiones AABB optimizada para 60 FPS estables en dispositivos móviles
- 5 power-ups con efectos visuales distintos y mecánicas únicas
- Sistema de combo con multiplicador de puntuación x1 / x2 / x4 / x8
- Audio reactivo generado por Web Audio API sin archivos externos
- Fondo dinámico que reacciona a la velocidad de la bola en tiempo real
- Iconografía 100% SVG inline, sin emojis ni imágenes rasterizadas
- Sistema de pausa robusto con tres disparadores independientes
- Modo standalone (sin `app.js`) con aviso visible al jugador
- Integración completa con `window.GameCenter.completeLevel()` de Love Arcade

### Características de la arquitectura (v2.1 / v2.2)

- 13 archivos con responsabilidades únicas y no solapadas
- ES Modules nativos (`import` / `export`) sin bundler requerido en desarrollo
- Cero dependencias circulares entre módulos
- `core/physics.js` y `audio/audio-engine.js` completamente puros y testeables en aislamiento
- Estado de juego centralizado en `state.js` como Single Source of Truth mutable
- Patron de inyeccion de callbacks para evitar acoplamiento UI y logica
- Orden de carga de scripts deterministico y garantizado por el estandar ES Modules

---

## 2. Historial de Versiones

| Version | Descripcion |
|---------|-------------|
| `2.0.0` | Implementacion inicial completa. Un unico archivo `index.html` con HTML, CSS y JS monolitico. |
| `2.1.0` | Modularizacion completa. Descomposicion en 13 archivos bajo arquitectura ES Modules. Sin cambios en gameplay ni comportamiento externo. |
| `2.2.0` | Sistema de pausa robusto. Boton dedicado en el HUD, pausa automatica por perdida de foco (visibilitychange / window blur) y gesto de doble tap con dos dedos. Distincion entre `_onPause` (toggle) y `_onPauseOnly` (solo pausa). Sin cambios en gameplay ni arquitectura de modulos. |

La transicion de 2.1 a 2.2 es **transparente para Love Arcade**. El contrato de integracion (`window.GameCenter.completeLevel`, `window.OllinSmashGame`) no ha cambiado. Solo se añaden mecanismos de entrada y gestion de estado de pausa.

---

## 3. Estructura de Archivos

### Ubicacion dentro de Love Arcade

```
[raiz del repositorio de Love Arcade]
|
+-- index.html                       <- Hub principal (NO modificar)
+-- js/
|   +-- app.js                       <- Motor central v7.5 (NO modificar)
+-- games/
    +-- ollin-smash/                 <- Todo el codigo del juego vive aqui
        |
        +-- index.html               <- Estructura HTML minima
        +-- css/
        |   +-- styles.css           <- Variables, layout, HUD, overlays, botones
        +-- js/
            +-- config.js            <- Constantes inmutables
            +-- state.js             <- Estado mutable compartido
            +-- main.js              <- Entry point y game loop
            +-- core/
            |   +-- physics.js       <- Funciones puras de fisica
            |   +-- particles.js     <- Object Pool y textos flotantes
            +-- audio/
            |   +-- audio-engine.js  <- Sintesis Web Audio API
            +-- components/
            |   +-- ball.js          <- Creacion y renderizado de bolas
            |   +-- bricks.js        <- Generacion procedural y renderizado de ladrillos
            |   +-- paddle.js        <- Renderizado de paddle y grecas
            |   +-- powerups.js      <- Activacion, fisica de drops e iconos
            +-- ui/
                +-- interface.js     <- DOM exclusivamente: HUD, overlays, eventos
```

### Descripcion de cada archivo

| Archivo | Lineas aprox. | Responsabilidad |
|---|---|---|
| `index.html` | 175 | Estructura HTML minima. Incluye el boton `#os-btn-pause` dentro del HUD. |
| `css/styles.css` | 305 | Variables CSS, layout, HUD, overlays, botones, animaciones. Incluye estilos del boton de pausa. |
| `js/config.js` | 65 | Constantes inmutables: dimensiones, velocidades, colores, IDs. |
| `js/state.js` | 125 | Estado mutable compartido. Objetos `state`, `paddle`, `fx`. Helpers de reset. |
| `js/main.js` | 500 | Entry point. Game loop, update, draw, input, integracion Love Arcade, API publica. Incluye `_onPause` y `_onPauseOnly`. |
| `js/core/physics.js` | 75 | Funciones puras: `aabb`, `lerp`, `toCanvasX`, `ballSpeed`. Sin efectos secundarios. |
| `js/core/particles.js` | 140 | Object Pool de 220 particulas y cola de textos flotantes. |
| `js/audio/audio-engine.js` | 100 | Contexto Web Audio API, sintesis de tonos, catalogo de SFX. |
| `js/components/bricks.js` | 115 | Generacion procedural de cuadrículas y renderizado de ladrillos. |
| `js/components/ball.js` | 90 | Creacion de descriptores de bola y renderizado (cuerpo + trail). |
| `js/components/paddle.js` | 110 | Renderizado del paddle y bordes grecan. |
| `js/components/powerups.js` | 230 | Activacion de efectos, fisica de drops en caida, iconos canvas. |
| `js/ui/interface.js` | 240 | DOM exclusivamente: HUD, overlays, event listeners. Incluye gestion del boton de pausa y los tres disparadores automaticos. |

---

## 4. Arquitectura de Modulos

### Principios de diseno

La modularizacion de v2.1 se rige por cuatro principios que determinaron cada decision de division de codigo:

**Responsabilidad unica.** Cada modulo tiene una sola razon para cambiar. `physics.js` solo cambia si cambia el modelo de colisiones. `interface.js` solo cambia si cambia el HTML. Nunca ambos al mismo tiempo.

**Ausencia de ciclos.** Ningun modulo puede importar a `main.js`, ni directa ni transitivamente. Las dependencias forman un grafo aciclico dirigido (DAG) con `config.js` como raiz. Esto garantiza que el orden de inicializacion sea predecible.

**Estado centralizado con mutacion explicita.** Todo el estado mutable reside en `state.js`. Los modulos importan los objetos por referencia y mutan sus propiedades directamente. ES Modules no permiten reasignar un binding importado, pero si mutar propiedades, lo que sirve como salvaguarda natural:

```js
// En cualquier modulo que importe state.js:
import { state } from '../state.js';

state.score += 10;         // Correcto: muta una propiedad
state.balls.length = 0;    // Correcto: vacia el array sin reasignar
// state = {};             // Error en runtime: reasignar binding ES Module
```

**Inversion de dependencia para la UI.** `ui/interface.js` no puede importar `main.js` porque causaria un ciclo. La solucion es inyectar callbacks: `main.js` llama a `bindButtons({ onStart, onRetry, ... })` pasando sus propias funciones como argumentos. La UI no sabe nada de la logica de juego; solo sabe que debe invocar el callback en el momento adecuado.

### El patron de estado compartido

Los tres objetos exportados por `state.js` son referencias mutables que cualquier modulo puede importar y modificar:

```
state.js
 |-- export const state   --> { phase, score, lives, wave, combo, mult,
 |                              sessionId, balls[], bricks[], drops[], bgVelocity }
 |-- export const paddle  --> { x, y, w, h }
 +-- export const fx      --> { long: {on,t}, fire: {on,t}, slow: {on,t},
                                magnet: {on, shots, held, heldBall} }
```

Cualquier modulo que importe cualquiera de estos objetos lee y escribe el mismo dato en memoria. No hay copias, no hay sincronizacion, no hay eventos de cambio: la coherencia esta garantizada porque JavaScript es monohilo.

### Orden de carga garantizado

El mecanismo de carga combina dos tipos de script con comportamientos de ejecucion distintos:

```html
<!-- 1. ES Module: deferred por el estandar, ejecuta DESPUES del parse completo -->
<script type="module" src="./js/main.js"></script>

<!-- 2. Classic script: sincrono, ejecuta DURANTE el parse al encontrar la etiqueta -->
<script src="../../js/app.js"></script>
```

Aunque `main.js` aparece primero en el HTML, `app.js` ejecuta primero porque los modulos ES son implicitamente diferidos. El resultado es que `window.GameCenter` esta disponible cuando `boot()` se ejecuta en `main.js`, sin necesidad de listeners, timeouts ni feature detection asincrona.

---

## 5. Grafo de Dependencias

Las flechas apuntan en la direccion de la dependencia (A apunta a B significa "A importa B").

```
                    +-------------+
                    |  config.js  |  (raiz -- sin imports)
                    +------+------+
         +------------------+-----------------------------+
         |                  |                             |
         v                  v                             v
    +---------+    +---------------+             +----------------+
    | state.js|    |  physics.js   |             | audio-engine   |
    +----+----+    +---------------+             +----------------+
         |          (puro, sin estado)            (sin estado)
         |
+--------+--------------------------------------------+
|        |              |             |               |
v        v              v             v               v
+--------+  +---------+ +--------+ +--------+ +---------------+
|bricks.js| | ball.js | |paddle  | |state.js| | powerups.js   |
+--------+  +---------+ +--------+ +--------+ +-------+-------+
                                                       |
                                                       | importa:
                                                       | state, audio,
                                                       | particles, config
                                                       v
                                                +-------------+
                                                |particles.js |
                                                +-------------+
                                                  (+ config)

+------------------------------------------------------------+
|                         main.js                            |
|  importa: config, state, physics, particles, audio,        |
|           bricks, ball, paddle, powerups, interface        |
+------------------------------------------------------------+

+----------------+
|  interface.js  |  (sin imports del juego -- solo DOM nativo)
+----------------+
```

### Reglas de importacion por modulo

| Modulo | Puede importar | No puede importar |
|---|---|---|
| `config.js` | Nada | Cualquier otro |
| `state.js` | `config` | Cualquier otro |
| `physics.js` | Nada | Cualquier otro |
| `particles.js` | `config` | `state`, `main`, `ui` |
| `audio-engine.js` | Nada | Cualquier otro |
| `components/*` | `config`, `state`, `audio`, `particles` | `main`, `ui` |
| `ui/interface.js` | Nada (DOM puro) | Cualquier otro |
| `main.js` | Todo excepto `main` | Si mismo |

---

## 6. Referencia de Modulos

### `js/config.js`

Exporta un unico objeto `CFG` congelado con todas las constantes del juego. `Object.freeze()` garantiza que ningun modulo pueda mutarlo accidentalmente.

```js
import { CFG } from './config.js';

// Dimensiones del canvas
CFG.W               // 390  -- ancho logico en pixeles
CFG.H               // 700  -- alto logico en pixeles

// Paddle
CFG.paddleH         // 12   -- altura del paddle
CFG.paddleInitW     // 72   -- ancho inicial del paddle
CFG.paddleY         // 648  -- centro vertical del paddle

// Bola
CFG.ballR           // 7    -- radio de la bola
CFG.ballBaseSpeed   // 5.0  -- velocidad base (px/frame) en oleada 1
CFG.waveMult        // 0.07 -- incremento de velocidad por oleada

// Ladrillos
CFG.brickCols       // 6    -- columnas por oleada
CFG.brickW          // 52   -- ancho de cada ladrillo
CFG.brickH          // 18   -- alto de cada ladrillo
CFG.brickGapX       // 9    -- separacion horizontal entre ladrillos
CFG.brickGapY       // 7    -- separacion vertical entre ladrillos
CFG.brickTopY       // 82   -- Y del borde superior de la primera fila
CFG.brickRowBase    // 5    -- filas en oleada 1
CFG.hardBrickProb   // 0.18 -- probabilidad de ladrillo duro (wave > 3)

// Economia
CFG.gameId          // 'ollin_smash'
CFG.coinsDiv        // 10   -- score / coinsDiv = Monedas Love Arcade

// Colores (espejo de las variables CSS --os-*)
CFG.C.crimson       // '#DC2626'
CFG.C.violet        // '#7C3AED'
CFG.C.gold          // '#FACC15'
CFG.C.cyan          // '#06B6D4'
```

---

### `js/state.js`

Exporta tres objetos mutables y cuatro funciones de reset y calculo.

```js
import { state, paddle, fx, resetState, resetEffects, refreshMult } from './state.js';
```

#### Objeto `state`

| Propiedad | Tipo | Descripcion |
|---|---|---|
| `phase` | `string` | Estado de la maquina: `'MENU'`, `'PLAYING'`, `'PAUSED'`, `'GAMEOVER'` |
| `score` | `number` | Puntuacion acumulada en la sesion actual |
| `lives` | `number` | Vidas restantes (0 desencadena Game Over) |
| `wave` | `number` | Oleada actual, base 1 |
| `combo` | `number` | Ladrillos consecutivos destruidos sin tocar el paddle |
| `mult` | `number` | Multiplicador activo: 1, 2, 4 u 8 |
| `sessionId` | `string` | ID unico base-36 generado al inicio de cada partida |
| `balls` | `Array` | Descriptores de bolas activas |
| `bricks` | `Array` | Descriptores de ladrillos de la oleada actual |
| `drops` | `Array` | Power-ups actualmente en caida |
| `bgVelocity` | `number` | Velocidad suavizada para el fondo reactivo (lerp) |

#### Objeto `paddle`

| Propiedad | Tipo | Descripcion |
|---|---|---|
| `x` | `number` | Centro X en pixeles canvas |
| `y` | `number` | Centro Y, constante igual a `CFG.paddleY` |
| `w` | `number` | Ancho actual, modificado por PU_LONG |
| `h` | `number` | Alto, constante igual a `CFG.paddleH` |

#### Objeto `fx`

```js
fx.long.on        // boolean -- PU_LONG activo
fx.long.t         // number  -- frames restantes

fx.fire.on        // boolean -- PU_FIRE activo
fx.fire.t         // number  -- frames restantes

fx.slow.on        // boolean -- PU_SLOW activo
fx.slow.t         // number  -- frames restantes

fx.magnet.on       // boolean        -- PU_MAGNET activo
fx.magnet.shots    // number         -- disparos restantes
fx.magnet.held     // boolean        -- bola retenida actualmente
fx.magnet.heldBall // object | null  -- referencia a la bola retenida
```

#### Funciones exportadas

```js
resetState()
// Reset completo de sesion. Invocado al iniciar una partida nueva.
// Pone phase en 'PLAYING', pone score/lives/wave/combo/mult a sus valores iniciales,
// genera un nuevo sessionId, y limpia balls, bricks, drops, bgVelocity.
// Tambien llama _clearFx() internamente.

resetEffects()
// Reset de efectos activos solamente. Invocado en cada transicion de oleada.
// Restaura paddle.w a CFG.paddleInitW y limpia todos los efectos fx.

refreshMult()
// Recalcula state.mult a partir del valor actual de state.combo.
// Llamar siempre despues de cualquier cambio en state.combo.
```

---

### `js/core/physics.js`

Modulo puro. Cero imports, cero side effects. Todas las funciones son deterministicas y testeables en aislamiento.

```js
import { aabb, lerp, toCanvasX, ballSpeed } from './core/physics.js';
```

#### `aabb(ball, rect)` → `string | null`

Detecta si una bola circular colisiona con un rectangulo alineado a los ejes y devuelve el lado de primer contacto.

```
Parametros:
  ball : { x: number, y: number, r: number }
  rect : { x: number, y: number, w: number, h: number }
         (x,y = esquina superior izquierda)

Retorna: 'top' | 'bottom' | 'left' | 'right' | null
```

El algoritmo calcula la penetracion en los cuatro lados y devuelve el de menor solapamiento. Esto resuelve correctamente los impactos de esquina sin logica adicional y sin necesitar ramas condicionales especiales.

#### `lerp(a, b, t)` → `number`

Interpolacion lineal. Con `t=0` devuelve `a`, con `t=1` devuelve `b`. Usada en `main.js` para suavizar `state.bgVelocity` con factor 0.04 cada frame.

#### `toCanvasX(clientX, rect, canvasW)` → `number`

Convierte una coordenada X de viewport (evento mouse o touch) a coordenadas de canvas logico. Tiene en cuenta el escalado CSS del elemento `<canvas>` mediante `rect.width`.

#### `ballSpeed(baseSpeed, waveMult, wave, slowActive)` → `number`

Calcula la magnitud de velocidad correcta para una bola nueva en funcion de la oleada y si el efecto slow esta activo. Centraliza esta logica para evitar que se duplique en `mkBall` y en la restauracion de velocidad al expirar PU_SLOW.

---

### `js/core/particles.js`

Gestiona dos sistemas visuales independientes: el pool de particulas y la cola de textos flotantes. Los arrays internos son privados al modulo; el acceso externo es exclusivamente a traves de las funciones exportadas.

```js
import * as particles from './core/particles.js';

particles.emit(x, y, color, n)       // Emitir n particulas en (x, y)
particles.addFloat(x, y, txt, col)   // Anadir texto flotante
particles.update()                   // Avanzar un frame (llamar desde update())
particles.reset()                    // Limpiar todo (llamar al inicio de partida)
particles.drawParticles(ctx)         // Renderizar particulas en canvas
particles.drawFloats(ctx)            // Renderizar textos flotantes en canvas
```

El pool tiene tamano fijo de 220 particulas. Si esta lleno al llamar `emit()`, los nuevos sparks se descartan silenciosamente sin lanzar errores. Cada particula tiene gravedad suave (`vy += 0.12` por frame) y se desvanece gradualmente (`alpha = life / max`).

---

### `js/audio/audio-engine.js`

Encapsula el `AudioContext` y expone funciones de sintesis.

```js
import { initAudio, tone, sfx } from './audio/audio-engine.js';
```

#### `initAudio()`

Inicializa o reanuda el `AudioContext`. Debe llamarse desde un evento de interaccion del usuario (click, touchend) para cumplir la politica de autoplay de los navegadores. Es seguro llamarla multiples veces.

#### `tone(freq, type, dur, gain, detune)`

Crea y programa un oscilador de un solo uso. Fire-and-forget: el nodo se descarta automaticamente al terminar.

```
Parametros:
  freq   : Hz (number)
  type   : 'sine' | 'triangle' | 'sawtooth' | 'square'
  dur    : duracion en segundos
  gain   : amplitud pico 0 a 1 (default 0.25)
  detune : cents de afinacion (default 0)
```

#### `sfx` — Catalogo de efectos de sonido

```js
sfx.bounce()       // Rebote en paddle o pared
sfx.brick()        // Ruptura de ladrillo con pitch aleatorio
sfx.powerup()      // Activacion de power-up: glissando ascendente
sfx.combo(mult)    // Confirmacion de combo (mult: 2 | 4 | 8)
sfx.lose()         // Game Over: triada menor descendente
```

---

### `js/components/bricks.js`

```js
import { genBricks, drawBricks } from './components/bricks.js';
```

#### `genBricks(wave)` → `Array`

Genera un array de descriptores de ladrillo para la oleada indicada. Cada descriptor tiene la forma:

```js
{
  x, y,       // Posicion de la esquina superior izquierda
  w, h,       // Dimensiones (constantes de CFG)
  hp, maxHp,  // Puntos de vida (1 = normal, 2 = duro)
  color,      // Color de relleno CSS
  pu,         // Tipo de power-up ('multi'|'long'|'fire'|'slow'|'magnet') o null
  alive,      // true hasta ser destruido
  flash,      // Frames de flash blanco post-impacto (cuenta regresiva desde 9)
}
```

#### `drawBricks(ctx, bricks)`

Renderiza todos los ladrillos con `alive === true`. Aplica glow intensificado durante los frames de `flash`, blanco de impacto en `flash > 0`, dos barras verticales para ladrillos duros, y punto dorado central para ladrillos con power-up.

---

### `js/components/ball.js`

```js
import { mkBall, drawBall, drawTrail } from './components/ball.js';
```

#### `mkBall(x, y, angle, wave, fire, slow)` → `Object`

Crea un descriptor de bola calculando la velocidad correcta internamente a partir de `wave`, `fire` y `slow`. Es el unico punto del codigo que codifica la logica de velocidad de bola.

```js
// Descriptor devuelto:
{ x, y, vx, vy, r, trail: [], fire: boolean }
```

#### `drawBall(ctx, ball)` y `drawTrail(ctx, ball)`

`drawBall` renderiza el cuerpo con gradiente radial y glow (carmesi en modo fuego, dorado en modo normal). `drawTrail` renderiza hasta 9 segmentos de estela con opacidad y tamano decrecientes hacia el pasado.

---

### `js/components/paddle.js`

```js
import { drawPaddle, drawGrecan } from './components/paddle.js';
```

#### `drawPaddle(ctx, paddle, fx)`

Renderiza el paddle con gradiente tematico (violeta por defecto, carmesi con PU_FIRE activo, cian con PU_MAGNET activo), franja especular superior, borde con glow y siete marcas de notch aztecas.

#### `drawGrecan(ctx, x, y, w, flip)`

Dibuja un borde greca continuo de ancho `w`. Con `flip = false` los escalones apuntan hacia abajo (borde superior del campo, Y=70). Con `flip = true` apuntan hacia arriba (borde inferior, Y=680). Cada unidad del patron ocupa 56 px.

---

### `js/components/powerups.js`

```js
import { activatePU, updateDrops, drawDrops } from './components/powerups.js';
```

#### `activatePU(type, wave)`

Aplica el efecto del power-up indicado mutando directamente `state`, `paddle` y `fx`. Llama a `sfx.powerup()` y `addFloat()` para el feedback visual y sonoro.

```
type: 'multi' | 'long' | 'fire' | 'slow' | 'magnet'
```

#### `updateDrops(wave)`

Avanza la posicion Y de todos los drops activos en `state.drops`, detecta colision con el paddle y llama a `activatePU()` si hay recogida. Los drops que salen por el borde inferior se eliminan. Debe llamarse desde `update()` cada frame.

#### `drawDrops(ctx)`

Renderiza cada drop como una caja con borde tematico y un icono dibujado en canvas. Los iconos replican las formas de los SVG inline del HUD para mantener coherencia visual entre el indicador del drop en vuelo y la pildora activa en el HUD.

---

### `js/ui/interface.js`

Modulo de DOM puro. No importa ningun otro modulo del juego. Toda interaccion con el DOM del juego pasa por aqui.

```js
import * as ui from './ui/interface.js';
```

#### Actualizaciones de HUD

```js
ui.updateHUD(score, coins, mult)
// Actualiza contadores de puntos, monedas estimadas y combo badge.

ui.updateLives(lives)
// Reconstruye los puntos indicadores de vida (filled vs empty).

ui.updatePills(fx)
// Sincroniza visibilidad y timers de las pildoras de power-up activas.

ui.updateWaveLabel(wave)
// Actualiza la etiqueta "OLEADA N" en la parte inferior.
```

#### Transiciones de pantalla

```js
ui.showPlaying()
// Oculta todos los overlays, muestra HUD y barra de power-ups.
// Muestra el boton #os-btn-pause (clase .visible) y lo pone en icono de barras (no pausado).

ui.setPaused(boolean)
// Muestra u oculta el overlay de pausa.
// Conmuta la clase .is-paused en #os-btn-pause para alternar entre icono ⏸ e icono ▶.
// Actualiza el aria-label del boton segun el estado.

ui.showGameOver(score, wave, coins)
// Muestra el overlay de Game Over con las estadisticas finales.
// Oculta el boton #os-btn-pause (elimina clase .visible).

ui.showMenu(highscore, isStandalone)
// Muestra el menu principal. Si isStandalone es true, muestra el aviso de modo practica.
// Oculta el boton #os-btn-pause (elimina clase .visible).

ui.showWaveFlash(wave)
// Muestra el texto de transicion de oleada con fade-in/fade-out automatico (900ms).

ui.refreshHighscore()  --> number
// Lee OS_highscore de localStorage, actualiza el DOM y devuelve el valor.
```

#### Binding de eventos

```js
// Botones de overlay -- callbacks inyectados por main.js
// onPause: callback para el boton #os-btn-pause (toggle pausa/reanuda)
ui.bindButtons({ onStart, onRetry, onResume, onMenu, onPause })

// Eventos de puntero, toque y disparadores automaticos de pausa
// onPause:     toggle (pausa si jugando, reanuda si pausado)
// onPauseOnly: solo pausa, nunca reanuda (para triggers automaticos)
ui.bindInput({ onMove, onTap, onPause, onPauseOnly })

// Teclas de movimiento de paddle
ui.bindKeyboard(onLeft, onRight)
```

El patron de inyeccion de callbacks evita que `interface.js` necesite importar `main.js` (lo que crearia una dependencia circular). `main.js` pasa sus propias funciones como parametros; `interface.js` las invoca en el momento adecuado sin conocer su implementacion.

---

## 7. State Machine

El campo `state.phase` controla que codigo se ejecuta en cada frame. Las transiciones son explicitas y ocurren exclusivamente en `main.js`.

```
                 [boot()]
                    |
                    v
              +---------+        [onStart / onRetry]
              |  MENU   |  ------------------------------>  +---------+
              +---------+                                   | PLAYING |
                    ^                          +-----------> +----+----+
                    |                          |  [resume]        |
                    |                  +-------+-------+          | [boton / Espacio / Escape /
                    |                  |    PAUSED     | <--------+  doble tap 2 dedos /
                    |                  +---------------+            tab oculta / blur ventana]
                    |
                    |             +-----------+       [lives <= 0]
                    +-------------|  GAMEOVER | <------------------+
                    [onMenu]      +-----------+
```

| Transicion | Origen | Destino | Disparador |
|---|---|---|---|
| Inicio de partida | `MENU` | `PLAYING` | Clic en INICIAR |
| Pausa voluntaria | `PLAYING` | `PAUSED` | Boton HUD, Espacio, Escape, doble tap 2 dedos |
| Pausa automatica | `PLAYING` | `PAUSED` | Tab oculta (`visibilitychange`) o foco perdido (`window blur`) |
| Reanudacion | `PAUSED` | `PLAYING` | Clic en CONTINUAR o boton HUD o Espacio/Escape |
| Fin de partida | `PLAYING` | `GAMEOVER` | `state.lives <= 0` |
| Reintentar | `GAMEOVER` | `PLAYING` | Clic en REINTENTAR |
| Menu desde Game Over | `GAMEOVER` | `MENU` | Clic en MENU |

**Distincion clave:** los disparadores automaticos (tab/blur) llaman a `_onPauseOnly()`, que solo transiciona `PLAYING → PAUSED` y nunca reanuda. Esto garantiza que el jugador no pueda reanudar sin accion consciente aunque el foco vuelva al navegador. Los disparadores manuales (boton, teclado, gesto) llaman a `_onPause()`, que alterna entre los dos estados.

`update()` retorna en la primera linea si `state.phase !== 'PLAYING'`. `draw()` siempre ejecuta el fondo animado y, si la fase es `PLAYING` o `PAUSED`, renderiza el campo de juego para que el estado de la escena sea visible bajo el overlay de pausa.

---

## 8. Identidad Visual y Paleta

### Variables CSS y tokens JS

Las variables CSS y los tokens de color JS son paralelos e intencionalmente identicos en valor:

| Variable CSS | Token JS | Valor | Uso principal |
|---|---|---|---|
| `--os-crimson` | `CFG.C.crimson` | `#DC2626` | Color primario, bola de fuego, bordes activos |
| `--os-violet` | `CFG.C.violet` | `#7C3AED` | Color secundario, paddle base, pausa |
| `--os-gold` | `CFG.C.gold` | `#FACC15` | Power-ups, combo, HUD monedas |
| `--os-cyan` | `CFG.C.cyan` | `#06B6D4` | Power-up Magnetismo |
| `--os-dark` | — | `#07000F` | Fondo de overlays |
| `--os-darker` | — | `#030007` | Fondo del body |
| `--os-text` | — | `#F0E8FF` | Texto general, tinte frio-violaceo |

### Grecas Prehispanicas

El borde superior (Y=70) y el borde inferior (Y=680) del campo de juego se renderizan con un patron de escalon greca, estilizacion de la greca escalonada presente en Mitla y Teotihuacan. La funcion `drawGrecan` en `components/paddle.js` tila el patron hasta cubrir todo el ancho del canvas. Se pinta con `rgba(220,38,38,0.22)` para integrarse al fondo sin saturar la escena.

### Cuadricula Dinamica

El fondo combina dos capas de cuadricula dibujadas en canvas en cada frame de `draw()`:

- Vertical (tono violeta) — simula campo de fuerza digital
- Horizontal (tono carmesi) — simula circuitos / lineas de tierra

La opacidad de ambas capas reacciona a `state.bgVelocity`, que se suaviza con `lerp` (factor 0.04) hacia la velocidad media de las bolas activas. A mayor velocidad de juego, la cuadricula se intensifica visualmente.

### Tipografia

| Fuente | Uso |
|---|---|
| `Exo 2` (Google Fonts, pesos 300/600/800) | Titulares del menu, UI general, nombre del juego |
| `Share Tech Mono` (Google Fonts) | HUD numerico, etiquetas, badges de combo |

`Share Tech Mono` tiene ancho fijo por caracter, evitando el parpadeo de layout cuando los contadores numericos cambian de valor durante el gameplay.

---

## 9. Motor de Fisica (Ollin-Engine)

### Colisiones AABB (`core/physics.js`)

El motor trata la bola como un circulo pero la colisiona contra bounding boxes rectangulares. Para la velocidad y densidad de Ollin Smash, esto es suficientemente preciso y mas eficiente que la colision circulo-rectangulo exacta.

El algoritmo de `aabb()` calcula la penetracion en los cuatro lados:

```
overlapLeft   = ball.x + r - rect.x
overlapRight  = rect.x + rect.w - (ball.x - r)
overlapTop    = ball.y + r - rect.y
overlapBottom = rect.y + rect.h - (ball.y - r)

lado = argmin(overlapLeft, overlapRight, overlapTop, overlapBottom)
```

El lado con menor penetracion es el que tuvo el primer contacto. Esto resuelve correctamente los impactos de esquina sin ramas condicionales adicionales.

### Reflexion en el Paddle

La reflexion sobre el paddle calcula un angulo de salida proporcional al punto de impacto horizontal, dando al jugador control direccional real:

```js
const hit   = (ball.x - paddleLeft) / paddle.w;   // 0 = borde izq, 1 = borde der
const angle = -Math.PI / 2 + (hit - 0.5) * Math.PI * 0.78;
```

El factor `0.78` produce un arco de rebote de +/-70 grados. Impactar el centro lanza la bola verticalmente; impactar los extremos la desvía al maximo.

### Velocidad de Bola

La velocidad base escala linealmente con la oleada:

```
velocidad = ballBaseSpeed * (1 + (wave - 1) * waveMult)
          = 5.0 * (1 + (wave - 1) * 0.07)
```

Oleada 1: 5.0 px/frame. Oleada 10: 8.15 px/frame. Con PU_SLOW activo se multiplica por 0.7. Al expirar PU_SLOW, la velocidad se restaura normalizando el vector de velocidad actual a la magnitud correcta para la oleada (preserva direccion, restaura magnitud).

### Bolas Multiples

`state.balls` puede contener cualquier numero de bolas simultaneas. Solo cuando `state.balls.length === 0` se descuenta una vida. Perder una bola generada por PU_MULTI no tiene penalizacion.

### Object Pool de Particulas

Pool de 220 objetos pre-allocados en carga. En el bucle caliente, solo se busca el primer objeto inactivo y se reutiliza. No hay `new Object()`, no hay `Array.push()` de objetos nuevos durante el gameplay, no hay presion sobre el Garbage Collector.

---

## 10. Sistema de Oleadas Procedurales

Cada oleada se genera en tiempo de ejecucion por `genBricks(wave)` en `components/bricks.js`. No hay niveles prediseñados.

### Escalado de Parametros

| Propiedad | Formula | Oleada 1 | Oleada 5 | Oleada 10 |
|---|---|---|---|---|
| Filas de ladrillos | `brickRowBase + min(wave - 1, 7)` | 5 | 9 | 12 |
| Ladrillos duros | Prob. 18% si `wave > 3` | 0% | 18% | 18% |
| Power-ups por oleada | `min(wave, 3)` | 1 | 3 | 3 |
| Velocidad base bola | `5.0 * (1 + (wave-1) * 0.07)` | 5.0 | 6.4 | 8.2 |

Los ladrillos duros (`hp: 2`) requieren dos impactos para destruirse. Sus posiciones de power-up se seleccionan con un `Set` para garantizar unicidad dentro de la misma oleada.

### Transicion entre Oleadas

`nextWave()` en `main.js` se invoca cuando `state.bricks.every(b => !b.alive)`:

1. `state.wave++`
2. `resetEffects()` — paddle vuelve a su ancho inicial, todos los efectos cancelados
3. `genBricks(state.wave)` — nueva cuadricula
4. `state.drops = []` — drops en vuelo descartados
5. `state.balls = []` + `launch()` — una bola nueva desde el paddle
6. `ui.showWaveFlash(wave)` y `ui.updateWaveLabel(wave)` — feedback visual

Las monedas no se reportan en la transicion de oleada, solo en el Game Over, garantizando un unico `levelId` por sesion.

---

## 11. Power-Ups: Catalogo Tecnico

Los power-ups son activados por `activatePU(type, wave)` en `components/powerups.js` al detectar colision entre un drop y el paddle en `updateDrops()`.

### PU_MULTI — Fragmentacion

**Icono canvas:** Tres circulos en fila horizontal

**Activacion:** Por cada bola activa en `state.balls`, se generan dos bolas adicionales con angulos +0.42 y -0.42 rad respecto a la direccion original. La velocidad se hereda del modulo de la bola origen (`Math.hypot(vx, vy)`).

**Duracion:** Instantaneo

**Estado de fuego heredado:** Las bolas nuevas tienen `fire: b.fire`, por lo que si PU_FIRE esta activo, todas las bolas generadas tambien atraviesan ladrillos.

### PU_LONG — Expansion Ollin

**Icono canvas:** Flecha doble horizontal con puntas internas

**Activacion:** `paddle.w = CFG.paddleInitW * 1.4` (+40% del ancho original)

**Duracion:** 20 segundos (1200 frames a 60 FPS)

**Expiracion:** `paddle.w = CFG.paddleInitW` exacto, no relativo al valor previo. Activaciones multiples durante el mismo efecto no acumulan el bonus ni reinician el timer.

### PU_FIRE — Aliento de Quetzalcoatl

**Icono canvas:** Llama estilizada con curvas bezier

**Activacion:** `fx.fire.on = true`. Todas las bolas activas reciben `fire: true`. Las nuevas bolas generadas durante el efecto tambien heredan `fire: true`.

**Efecto fisico:** Al detectar colision con un ladrillo, si `ball.fire === true`, se omite el `break` del bucle de colisiones. La bola no rebota: continua en la misma direccion destruyendo todos los ladrillos en su trayectoria sin cambiar de rumbo.

**Duracion:** 30 segundos (1800 frames)

### PU_SLOW — Tiempo de Obsidiana

**Icono canvas:** Reloj de arena

**Activacion:** `b.vx *= 0.7; b.vy *= 0.7` para todas las bolas activas en el momento de la recogida.

**Duracion:** 15 segundos (900 frames)

**Expiracion:** Se recalcula la velocidad objetivo para la oleada actual y se normaliza el vector de cada bola, preservando la direccion y restaurando la magnitud correcta.

### PU_MAGNET — Atraccion Tlaloc

**Icono canvas:** Iman en U con patas

**Activacion:** `fx.magnet.on = true`, `fx.magnet.shots = 5`

**Mecanica:** La siguiente bola que toque el paddle activa `fx.magnet.held = true`. Mientras esta retenida, la bola sigue la posicion X del paddle en cada frame. Un tap o click libera la bola con angulo aleatorio centrado en -pi/2 (+/-0.2 rad). Cada liberacion consume un disparo; al llegar a cero el efecto se desactiva.

**Duracion:** 5 disparos (sin timer)

---

## 12. Sistema de Combo y Puntuacion

### Multiplicador

Crece al destruir ladrillos consecutivos sin que la bola toque el paddle. Se resetea a x1 en cualquier contacto con el paddle.

| Ladrillos consecutivos | Multiplicador |
|---|---|
| 0 a 4 | x1 |
| 5 a 9 | x2 |
| 10 a 19 | x4 |
| 20 o mas | x8 |

`refreshMult()` se llama desde `main.js` despues de cada cambio en `state.combo`.

### Calculo de Puntos

```
puntos_por_ladrillo = 10 * state.mult
```

Los ladrillos duros (`hp: 2`) otorgan puntos unicamente en el segundo impacto, cuando `hp` llega a 0.

### Conversion a Monedas Love Arcade

```
coins = Math.floor(state.score / CFG.coinsDiv)
      = Math.floor(state.score / 10)
```

Esta conversion se aplica una sola vez en `doGameOver()`. El HUD muestra la estimacion en tiempo real (`Math.floor(state.score / 10)`), pero el valor reportado al GameCenter es el calculado en el momento exacto del Game Over.

---

## 13. Motor de Audio

Todo el audio se sintetiza en tiempo real mediante Web Audio API. No existen archivos de audio externos.

### Arquitectura (`audio/audio-engine.js`)

El `AudioContext` se crea lazy en `initAudio()`, que debe llamarse desde un evento de interaccion del usuario. Es seguro llamarla multiples veces; los intentos subsiguientes simplemente reanudan el contexto si estaba suspendido.

La funcion `tone()` crea oscilador + nodo de ganancia, los programa con una envolvente de decaimiento exponencial y los descarta automaticamente. No hay acumulacion de nodos en el grafo de audio entre frames.

### Tabla de SFX

| Evento | Tipo oscilador | Frecuencia | Duracion | Variacion |
|---|---|---|---|---|
| Rebote paddle / pared | `triangle` | 750 a 1000 Hz | 60 ms | Random +/-250 Hz |
| Ruptura de ladrillo | `sawtooth` + `triangle` | 320 / 640 Hz | 100 / 70 ms | Detune aleatorio +/-100 cents |
| Activacion power-up | `sine` x4 | 400, 600, 850, 1050 Hz | 100 ms c/u | Escalera ascendente, 55 ms entre tonos |
| Combo x2 | `sine` | 880 Hz | 180 ms | — |
| Combo x4 | `sine` | 1100 Hz | 180 ms | — |
| Combo x8 | `sine` | 1350 Hz | 180 ms | — |
| Game Over | `sawtooth` x3 | 220, 196, 165 Hz | 1500 ms | Dos osciladores por nota (fundamental + quinta), 180 ms entre notas |

La variacion aleatoria de pitch en la ruptura de ladrillos (`detune = (Math.random() - 0.5) * 200`) simula el comportamiento organico de la ceramica y previene la fatiga auditiva en sesiones largas.

---

## 14. Integracion con Love Arcade

### Reporte de Monedas

El reporte se realiza una unica vez, al producirse el Game Over, desde `main.js → _reportCoins()`:

```js
function _reportCoins() {
  const coins   = Math.floor(state.score / CFG.coinsDiv);
  if (coins <= 0) return;

  const levelId = `wave_${state.wave}_${state.sessionId}`;

  if (typeof window.GameCenter !== 'undefined') {
    window.GameCenter.completeLevel(CFG.gameId, levelId, coins);
    console.log(`[OllinSmash] Reportadas ${coins} monedas. (${levelId})`);
  } else {
    console.warn('[OllinSmash] Modo standalone activo.');
  }
}
```

### Parametros del Payload

| Parametro | Tipo | Ejemplo | Descripcion |
|---|---|---|---|
| `gameId` | String | `'ollin_smash'` | Constante permanente definida en `CFG.gameId` |
| `levelId` | String | `'wave_8_m3d7kz'` | Oleada alcanzada + `state.sessionId` (base-36) |
| `coins` | Int | `340` | `Math.floor(score / CFG.coinsDiv)`, siempre entero positivo |

### Idempotencia

`state.sessionId` se genera al inicio de cada partida con `Date.now().toString(36)`. La combinacion `wave_N_sessionId` es unica por sesion. Si el browser llamara a `completeLevel` dos veces con el mismo `levelId`, el sistema Love Arcade descarta silenciosamente la segunda llamada.

### Disponibilidad de GameCenter garantizada

`app.js` es un script clasico sincrono: ejecuta durante el parse del HTML. `main.js` es un modulo ES diferido: ejecuta despues del parse. Cuando `boot()` corre en `main.js`, `window.GameCenter` ya esta definido si `app.js` se cargo correctamente. Esta garantia es estructural, no depende de listeners ni timeouts.

---

## 15. Namespacing y Aislamiento

### Aislamiento por modulos ES

En v2.1, el aislamiento primario lo proporciona el sistema de modulos ES. Cada modulo tiene su propio scope lexico: las variables declaradas dentro de un modulo no son accesibles desde `window` a menos que sean exportadas explicitamente. Esto reemplaza el rol que cumplia la IIFE en v2.0.

### Unica exportacion global

La unica asignacion a `window` que hace el juego es su API publica, al final de `main.js`:

```js
window.OllinSmashGame = Object.freeze({
  getScore: () => state.score,
  getWave:  () => state.wave,
  getState: () => state.phase,
});
```

`Object.freeze()` previene que codigo externo anadda, modifique o elimine propiedades del objeto.

### Globales reservados del nucleo

| Global reservado | Tratamiento en Ollin Smash |
|---|---|
| `window.GameCenter` | Solo lectura con verificacion `typeof !== 'undefined'` |
| `window.ECONOMY` | No accedido en ningun modulo |
| `window.THEMES` | No accedido en ningun modulo |
| `window.debounce` | No accedido en ningun modulo |
| `window.formatCoinsNavbar` | No accedido en ningun modulo |
| `CONFIG` (sin prefijo) | No declarado en ningun modulo |
| `ECONOMY` (sin prefijo) | No declarado |
| `THEMES` (sin prefijo) | No declarado |

### localStorage

| Clave | Tipo | Contenido | Modulo responsable |
|---|---|---|---|
| `OS_highscore` | String | Puntuacion maxima historica | `main.js` (escritura) / `ui/interface.js` (lectura) |

La clave reservada del sistema (`gamecenter_v6_promos`) no es accedida en ningun modulo.

### CSS

Todos los selectores usan el prefijo `#os-` (IDs) o `.os-` (clases), garantizando que no haya colision con las reglas CSS de Love Arcade ni con otros juegos de la plataforma.

---

## 16. Controles e Input

Los event listeners se registran en `ui/interface.js` mediante `bindInput()` y `bindKeyboard()`. Los callbacks concretos se inyectan desde `main.js → boot()`.

### Mouse (Desktop)

`mousemove` sobre el wrapper convierte la X del cursor a coordenadas de canvas mediante `core/physics.js → toCanvasX()`, que tiene en cuenta el escalado CSS del elemento `<canvas>`.

### Touch (Mobile)

`touchmove` con `{ passive: false }` para poder llamar `preventDefault()` y bloquear el scroll de pagina durante el juego. Usa `e.touches[0].clientX` con la misma logica de conversion que el mouse.

### Teclado

| Tecla | Accion |
|---|---|
| `Flecha izquierda` / `A` | Mover paddle 18 px hacia la izquierda |
| `Flecha derecha` / `D` | Mover paddle 18 px hacia la derecha |
| `Espacio` / `Escape` | Pausar o Reanudar (toggle) |

### Tap y Click

Activa el lanzamiento de la bola retenida cuando PU_MAGNET esta activo. El angulo de lanzamiento es aleatorio centrado en -pi/2 con variacion +/-0.2 rad.

---

## 17. Sistema de Pausa

El sistema de pausa es **aditivo**: no modifica ningun mecanismo existente de gameplay ni de navegacion entre pantallas. Se apoya en la distincion entre dos tipos de callback que evita reanudar el juego de forma involuntaria.

### Arquitectura de callbacks

```
main.js
 |-- _onPause()      → toggle PLAYING ↔ PAUSED   (disparadores manuales)
 +-- _onPauseOnly()  → solo PLAYING → PAUSED      (disparadores automaticos)
```

`_onPause` alterna el estado. `_onPauseOnly` solo avanza hacia la pausa y no hace nada si el juego ya esta pausado o en cualquier otra fase.

### Disparadores de pausa

#### 1. Boton dedicado en el HUD (`#os-btn-pause`)

Un boton SVG posicionado en la esquina superior derecha del HUD. Solo es visible durante el gameplay (cuando `#os-hud` tiene la clase `active`). Usa `pointer-events: auto` para anular el `pointer-events: none` heredado del contenedor HUD.

- **Icono en juego:** dos barras verticales (⏸), renderizadas como `<rect>` SVG.
- **Icono en pausa:** triangulo de reproduccion (▶), generado via pseudo-elemento `::after` cuando el boton tiene la clase `.is-paused`. Los `<rect>` se ocultan con CSS.
- **Callback:** `_onPause` (toggle).

```css
/* Regla clave que permite que el boton reciba clics dentro del HUD */
#os-btn-pause {
  pointer-events: auto;
}
```

#### 2. Cambio de pestaña / minimizacion (`visibilitychange`)

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) onPauseOnly();
});
```

Se dispara cuando el navegador oculta la pestaña (cambio de tab, minimize, pantalla apagada). Solo pausa; nunca reanuda al volver al foco.

#### 3. Perdida de foco de ventana (`window blur`)

```js
window.addEventListener('blur', () => {
  onPauseOnly();
});
```

Se dispara cuando la ventana del navegador pierde el foco a nivel de sistema operativo (alt-tab a otra aplicacion, clic fuera del navegador). Cubre casos que `visibilitychange` no detecta, como cambiar a otra ventana del mismo escritorio sin minimizar.

#### 4. Doble tap con dos dedos (gesto tactil)

```js
// Ventana de deteccion: 350 ms entre el primer y el segundo tap de dos dedos
const DOUBLE_TAP_WINDOW = 350;
let lastTwoFingerTap = 0;

wrapper.addEventListener('touchstart', e => {
  if (e.touches.length >= 2) {
    const now = Date.now();
    if (now - lastTwoFingerTap <= DOUBLE_TAP_WINDOW) {
      e.preventDefault();
      onPause();           // toggle: pausa o reanuda
      lastTwoFingerTap = 0;
    } else {
      lastTwoFingerTap = now;
    }
  }
}, { passive: false });
```

Un "tap de dos dedos" se define como un evento `touchstart` con `touches.length >= 2`. Dos de estos eventos dentro de 350 ms activan el toggle de pausa. El contador se resetea tras el segundo tap para evitar que un triple tap produzca dos eventos de pausa seguidos.

`e.preventDefault()` se llama en el segundo tap para evitar que el navegador interprete el gesto como zoom o scroll.

### Gestion visual del boton

`ui/interface.js` gestiona la visibilidad y el icono del boton en cada transicion de pantalla:

| Funcion | Efecto sobre `#os-btn-pause` |
|---|---|
| `showPlaying()` | Añade `.visible` (display flex), elimina `.is-paused` (icono ⏸) |
| `setPaused(true)` | Añade `.is-paused` (icono ▶), actualiza `aria-label` |
| `setPaused(false)` | Elimina `.is-paused` (icono ⏸), actualiza `aria-label` |
| `showGameOver()` | Elimina `.visible` (oculta el boton) |
| `showMenu()` | Elimina `.visible` (oculta el boton) |

### Comportamiento del game loop durante la pausa

`update()` retorna inmediatamente si `state.phase !== 'PLAYING'`, congelando toda la simulacion (fisica, efectos, particulas). `draw()` siempre ejecuta el fondo y, cuando la fase es `PLAYING` o `PAUSED`, tambien renderiza el campo de juego (bricks, bolas, paddle, particulas). Esto hace que el estado de la escena sea visible bajo el overlay de pausa semitransparente, reforzando la orientacion espacial del jugador al reanudar.

---

## 18. Persistencia Local

La unica clave escrita en `localStorage` es `OS_highscore`, gestionada en `main.js → doGameOver()` y leida en `ui/interface.js → refreshHighscore()`:

```js
// Escritura (main.js) -- solo si es nuevo record
if (state.score > prevHs) {
  localStorage.setItem('OS_highscore', String(state.score));
}

// Lectura (ui/interface.js)
const hs = parseInt(localStorage.getItem('OS_highscore') || '0', 10);
```

No se guarda el estado de partida. Las sesiones de Arkanoid son cortas y la complejidad de serializar el estado del motor fisico (posiciones, velocidades, efectos activos) no esta justificada.

---

## 19. Diseno Responsivo y Mobile-First

El canvas tiene dimensiones de diseno fijas (390 x 700 px). El escalado al dispositivo real es responsabilidad exclusiva de CSS:

```css
#os-canvas {
  max-height: 100vh;
  max-width: calc(100vh * 390 / 700);  /* Mantiene aspect ratio 390:700 */
  width: 100%;
  height: auto;
}
```

El canvas ocupa el mayor espacio posible sin distorsionar el aspect ratio. En orientacion landscape, se centra con bandas negras laterales.

El HUD y los overlays usan `position: absolute` relativo al wrapper con `width: min(390px, calc(100vh * 390 / 700))` para seguir exactamente el ancho del canvas en cualquier viewport.

---

## 20. Modos de Ejecucion y Desarrollo

### Modo Integrado (Produccion)

El juego esta en `games/ollin-smash/` dentro del repositorio de Love Arcade. `app.js` se carga, `window.GameCenter` existe y las monedas se reportan. Los modulos ES se cargan directamente sin bundler porque GitHub Pages sirve archivos estaticos con los MIME types correctos.

### Modo Standalone (Desarrollo local)

Los modulos ES requieren servidor HTTP. **No funcionan con el protocolo `file://`** por restricciones CORS del navegador.

```bash
# Opcion A: Python (sin dependencias)
cd games/ollin-smash
python3 -m http.server 8080

# Opcion B: Node (sin dependencias)
npx serve .

# Abrir en el navegador: http://localhost:8080
```

Al arrancar sin `app.js`, el juego detecta la ausencia de `window.GameCenter` y muestra el aviso de modo practica. Para simular el GameCenter durante el desarrollo:

```js
// Pegar en la consola del navegador antes de iniciar una partida
window.GameCenter = {
  completeLevel: (gameId, levelId, coins) => {
    console.log(`[MOCK] ${gameId} / ${levelId} --> ${coins} monedas`);
  }
};
```

### Bundling para Produccion (Opcional)

Si el equipo desea optimizar tiempos de carga, se puede usar Vite o esbuild para concatenar los modulos. El codigo fuente no requiere modificaciones.

```bash
# Vite -- ejemplo de configuracion minima
npm create vite@latest ollin-smash-build -- --template vanilla
# Copiar js/ y css/ al src/, ajustar index.html para import "./main.js"
npm run build
# Output en dist/: un unico JS + CSS minificados, listo para GitHub Pages
```

---

## 21. API Publica del Juego

`window.OllinSmashGame` es un objeto congelado con tres metodos de solo lectura. Es el unico simbolo que el juego exporta al scope global de `window`.

```js
window.OllinSmashGame.getScore()
// --> number: puntuacion actual de la sesion (0 si no hay sesion activa)

window.OllinSmashGame.getWave()
// --> number: oleada actual (1 si no hay sesion activa)

window.OllinSmashGame.getState()
// --> string: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
```

No existen metodos de escritura. El estado solo puede modificarse a traves de la interfaz del juego.

---

## 22. Checklist de QA

### Estructura y Navegacion

- [x] Proyecto autocontenido en `games/ollin-smash/` (minusculas, sin espacios)
- [x] Boton de retorno al hub (`../../index.html`) visible en menu y pausa
- [x] `../../js/app.js` referenciado como script clasico al final del `<body>`
- [x] `./js/main.js` referenciado como `type="module"` antes de `app.js`

### Responsividad

- [x] Diseno Mobile First con escalado CSS puro
- [x] Canvas con aspect ratio 390:700 preservado en cualquier pantalla
- [x] `touchmove` y `touchend` funcionales con `{ passive: false }`
- [x] `touchstart` con `{ passive: false }` para deteccion de doble tap con dos dedos
- [x] `touch-action: none` en `<html>` para prevenir scroll durante el juego

### Rendimiento

- [x] Object Pool de 220 particulas (sin allocacion en el bucle caliente)
- [x] Sin archivos de audio externos
- [x] Iconos de drops dibujados en canvas, no como elementos DOM
- [x] Sin dependencias externas de JavaScript (npm install no requerido)

### Arquitectura de modulos

- [x] 13 archivos con responsabilidades unicas
- [x] Cero dependencias circulares (verificado por analisis estatico)
- [x] `core/physics.js` sin imports, testeable en aislamiento
- [x] `audio/audio-engine.js` sin imports, testeable en aislamiento
- [x] `ui/interface.js` sin imports del juego, DOM puro
- [x] Callbacks inyectados en `bindButtons()` y `bindInput()` desde `main.js`
- [x] `state.js` como Single Source of Truth mutable

### Sistema de Pausa

- [x] Boton `#os-btn-pause` visible unicamente durante `PLAYING` y `PAUSED`
- [x] Icono SVG ⏸ durante juego; icono CSS ▶ durante pausa (sin imagenes externas)
- [x] `aria-label` actualizado en cada transicion de estado del boton
- [x] `pointer-events: auto` en el boton para anular el `none` del contenedor HUD
- [x] `visibilitychange` pausa al ocultar la pestaña (tab switch, pantalla apagada)
- [x] `window blur` pausa al perder el foco del sistema operativo (alt-tab)
- [x] Doble tap con dos dedos detectado en ≤ 350 ms; toggle de pausa/reanuda
- [x] Disparadores automaticos llaman `_onPauseOnly()`: solo pausan, nunca reanudan
- [x] Disparadores manuales llaman `_onPause()`: toggle completo
- [x] El campo de juego sigue renderizandose mientras `state.phase === 'PAUSED'`

### Aislamiento y Namespacing

- [x] Modulos ES como mecanismo primario de aislamiento de scope
- [x] Unica exportacion global: `window.OllinSmashGame` (congelado con Object.freeze)
- [x] Prefijo `OS_` en la unica clave de localStorage (`OS_highscore`)
- [x] Sin declaracion ni sobreescritura de globales reservados del nucleo
- [x] Sin acceso a `gamecenter_v6_promos` en ningun modulo
- [x] Todos los selectores CSS con prefijo `#os-` o `.os-`

### Integracion con la Economia

- [x] Conversion `Math.floor(score / CFG.coinsDiv)` antes de llamar al GameCenter
- [x] Llamada unica a `window.GameCenter.completeLevel(CFG.gameId, levelId, coins)`
- [x] `levelId` unico por sesion: `wave_${state.wave}_${state.sessionId}`
- [x] Parametros tipados: `gameId` (String), `levelId` (String), `coins` (Int positivo)
- [x] `window.OllinSmashGame` expuesto con `getScore`, `getWave`, `getState`

### Modo Standalone y Robustez

- [x] Verificacion `typeof window.GameCenter !== 'undefined'` antes de reportar
- [x] Aviso visible en menu cuando GameCenter no esta disponible
- [x] Juego completamente funcional sin `app.js` (modo practica)
- [x] Modulos ES requieren servidor HTTP (documentado en seccion 19)

### Estetica

- [x] Cero emoji codepoints en todo el codigo fuente
- [x] Iconografia SVG inline en el HTML; iconos de drops renderizados en canvas
- [x] Paleta restringida a `CFG.C.*` en JS y `var(--os-*)` en CSS

---

## 23. Glosario

| Termino | Definicion |
|---|---|
| **AABB** | Axis-Aligned Bounding Box. Tecnica de deteccion de colisiones basada en rectangulos alineados con los ejes cartesianos. |
| **DAG** | Directed Acyclic Graph. Grafo dirigido sin ciclos. El grafo de dependencias de modulos de Ollin Smash es un DAG con config.js como raiz. |
| **ES Module** | Sistema de modulos nativo de JavaScript (import / export). Cada archivo es un scope independiente; las exportaciones son la unica interfaz publica. |
| **IIFE** | Immediately Invoked Function Expression. Tecnica usada en v2.0 para crear un scope privado sin modulos. Reemplazada por ES Modules en v2.1. |
| **Inversion de dependencia** | Principio de diseno en el que un modulo de alto nivel no depende de uno de bajo nivel; recibe sus dependencias como parametros. En Ollin Smash: interface.js recibe callbacks inyectados por main.js. |
| **Object Pool** | Patron de diseno que pre-aloca un conjunto fijo de objetos y los reutiliza para evitar presion continua sobre el Garbage Collector. |
| **Single Source of Truth** | Principio de arquitectura por el que un dato existe en un unico lugar del sistema. En Ollin Smash: state.js. |
| **Standalone** | Modo de ejecucion sin el motor central de Love Arcade cargado. El juego funciona en modo practica sin reportar monedas. |
| **GameCenter** | El objeto global `window.GameCenter` expuesto por `app.js`. Unico punto de acceso a la economia de Love Arcade. |
| **Oleada** | Una cuadricula completa de ladrillos. Al destruirlos todos se genera la siguiente oleada con mayor dificultad. |
| **Power-Up** | Item que cae de ciertos ladrillos y otorga un efecto temporal al ser recogido por el paddle. |
| **Combo** | Contador de ladrillos destruidos de forma consecutiva sin que la bola toque el paddle. Activa el multiplicador de puntuacion. |
| **Grecan** | Patron decorativo escalonado en angulo recto. Elemento arquitectonico caracteristico de la cultura mesoamericana (Mitla, Teotihuacan). |
| **Lerp** | Linear interpolation. `lerp(a, b, t) = a + (b - a) * t`. Usada para suavizar state.bgVelocity con factor 0.04 por frame. |
| **Web Audio API** | API nativa del navegador para sintesis y procesamiento de audio en tiempo real, sin archivos externos. |
| **Deferred script** | Script que el navegador ejecuta despues del parse completo del documento. Los modulos ES (type="module") son deferred implicitamente. |
| **Drop** | Item de power-up en caida libre tras la destruccion de un ladrillo marcado. Representado como descriptor en state.drops. |

---

*Documentacion de Ollin Smash v2.2 · Desarrollado para Love Arcade · Motor: Game Center Core v7.5 · 2026*
