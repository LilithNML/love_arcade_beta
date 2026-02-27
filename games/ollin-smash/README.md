# Ollin Smash

**Versión:** `2.0.0` · **Motor:** Love Arcade Game Center Core `v7.5` · **Estado:** Producción

> Arkanoid Neo-Mexica / Cyberpunk para la plataforma Love Arcade. Un juego de ruptura de bloques generado proceduralmente con estética prehispánica, cinco power-ups con mecánicas únicas, sistema de combo multiplicador, audio sintetizado en tiempo real mediante Web Audio API e integración completa con la economía universal de Love Arcade.

---

## Índice

1. [Descripción General](#1-descripción-general)
2. [Estructura de Archivos](#2-estructura-de-archivos)
3. [Identidad Visual y Paleta](#3-identidad-visual-y-paleta)
4. [Arquitectura del Código](#4-arquitectura-del-código)
5. [Motor de Juego (Ollin-Engine)](#5-motor-de-juego-ollin-engine)
6. [Sistema de Oleadas Procedurales](#6-sistema-de-oleadas-procedurales)
7. [Power-Ups: Catálogo Técnico](#7-power-ups-catálogo-técnico)
8. [Sistema de Combo y Puntuación](#8-sistema-de-combo-y-puntuación)
9. [Motor de Audio](#9-motor-de-audio)
10. [Integración con Love Arcade](#10-integración-con-love-arcade)
11. [Namespacing y Aislamiento](#11-namespacing-y-aislamiento)
12. [Controles e Input](#12-controles-e-input)
13. [Persistencia Local](#13-persistencia-local)
14. [Diseño Responsivo y Mobile-First](#14-diseño-responsivo-y-mobile-first)
15. [Modos de Ejecución](#15-modos-de-ejecución)
16. [API Pública del Juego](#16-api-pública-del-juego)
17. [Checklist de QA](#17-checklist-de-qa)
18. [Glosario](#18-glosario)

---

## 1. Descripción General

**Ollin** significa *movimiento* o *terremoto* en náhuatl, y es también el decimotercer signo del calendario azteca. Este nombre dicta la dirección conceptual del juego: energía en estado puro, destrucción rítmica y patrones geométricos en perpetuo movimiento.

Ollin Smash es un clon espiritual de Arkanoid reinterpretado bajo una estética **Neo-Mexica Arcade**: grecas prehispánicas convertidas en circuitos de neón, paleta cromática basada en los colores ceremoniales del Templo Mayor (carmesí, violeta, oro electrónico) y un sistema de audio enteramente sintetizado que mezcla synthwave con percusiones orgánicas prehispánicas.

El juego opera sobre un **bucle infinito de oleadas generadas proceduralmente**. No tiene pantalla final: la dificultad escala de forma continua hasta que el jugador agota sus vidas.

### Características principales

- Física de colisiones AABB optimizada para 60 FPS estables en dispositivos móviles
- 5 power-ups con efectos visuales distintos y mecánicas únicas
- Sistema de combo con multiplicador de puntuación ×1 / ×2 / ×4 / ×8
- Audio reactivo generado por Web Audio API sin archivos externos
- Fondo dinámico que reacciona a la velocidad de la bola en tiempo real
- Iconografía 100% SVG inline, sin emojis ni imágenes rasterizadas
- Modo standalone (sin `app.js`) con aviso visible al jugador
- Integración completa con `window.GameCenter.completeLevel()` de Love Arcade

---

## 2. Estructura de Archivos

El juego reside como un módulo autocontenido dentro de la plataforma Love Arcade:

```
games/
└── ollin-smash/
    └── index.html        ← Juego completo (HTML + CSS + JS en un solo archivo)

js/
└── app.js                ← Motor de Love Arcade (externo, NO modificar)

index.html                ← Hub principal de Love Arcade
```

Todo el código fuente de Ollin Smash se encuentra en `games/ollin-smash/index.html`. Esta es una decisión deliberada de arquitectura: al ser un juego estático alojado en GitHub Pages, un único archivo reduce la complejidad de rutas relativas, elimina problemas de CORS entre módulos y simplifica el despliegue.

El archivo `../../js/app.js` se referencia al final del `<body>`, garantizando que el DOM del juego esté completamente inicializado antes de que el motor central de Love Arcade se ejecute.

---

## 3. Identidad Visual y Paleta

Toda la paleta se define mediante variables CSS en `:root` y se aplica de forma consistente en JavaScript a través del objeto `OS_CFG.C`.

### Variables CSS

| Variable        | Valor     | Uso                                              |
|-----------------|-----------|--------------------------------------------------|
| `--os-crimson`  | `#DC2626` | Color primario, bola de fuego, bordes activos    |
| `--os-violet`   | `#7C3AED` | Color secundario, paddle base, efectos de pausa  |
| `--os-gold`     | `#FACC15` | Power-ups, combo, indicadores HUD                |
| `--os-cyan`     | `#06B6D4` | Power-up Atracción Tláloc (magnetismo)           |
| `--os-dark`     | `#07000F` | Fondo profundo                                   |
| `--os-darker`   | `#030007` | Fondo más oscuro del body                        |
| `--os-text`     | `#F0E8FF` | Texto general, tinte frío-violáceo               |

### Grecas Prehispánicas

El borde superior (bajo los ladrillos) y el borde inferior del canvas se renderizan con un patrón de **escalón greca** dibujado proceduralmente en Canvas 2D. Este patrón es una estilización de la greca escalonada presente en Mitla y Teotihuacán. Se pinta con `rgba(220,38,38,0.22)` para integrarse al fondo sin saturar la escena.

### Cuadrícula Dinámica

El fondo combina dos capas de cuadrícula:

- **Vertical** (tono violeta, `rgba(124,58,237,...)`) — simula un campo de fuerza digital
- **Horizontal** (tono carmesí, `rgba(220,38,38,...)`) — simula líneas de tierra / circuitos

La opacidad de ambas capas varía en tiempo real según `OS_bgV`, un valor suavizado (lerp con factor `0.04`) de la velocidad promedio de las bolas activas. A mayor velocidad, la cuadrícula se intensifica.

### Tipografía

| Fuente               | Uso                                       |
|----------------------|-------------------------------------------|
| `Exo 2` (Google Fonts) | Titulares, UI general, nombre del juego |
| `Share Tech Mono`    | HUD de puntuación, etiquetas, teclas      |

El uso de `Share Tech Mono` para todos los contadores numéricos garantiza que los dígitos tengan ancho fijo, evitando el parpadeo visual al cambiar de valor.

---

## 4. Arquitectura del Código

El juego se implementa como una **IIFE** (Immediately Invoked Function Expression) que encapsula completamente su scope:

```js
(function () {
  'use strict';
  // Todo el código de Ollin Smash
})();
```

Esta técnica previene cualquier fuga de variables al scope global de `window`, que es compartido con el motor de Love Arcade y otros juegos de la plataforma.

### State Machine

El juego opera sobre cinco estados discretos gestionados por la variable `OS_state`:

```
MENU ──► PLAYING ──► PAUSED
  ▲          │         │
  │          ▼         │
  └──── GAMEOVER ◄─────┘
```

| Estado      | Descripción                                                       |
|-------------|-------------------------------------------------------------------|
| `MENU`      | Pantalla inicial. El bucle de render está activo pero no hay lógica de juego. |
| `PLAYING`   | Juego activo. `OS_update()` y `OS_draw()` se ejecutan cada frame. |
| `PAUSED`    | Lógica de juego suspendida. Solo se dibuja el estado actual.      |
| `GAMEOVER`  | Partida terminada. Se reportan monedas y se muestra el resumen.   |

### Separación Update / Draw

El bucle principal separa completamente la lógica del rendering:

```js
function OS_loop() {
  OS_update();  // Lógica pura: física, colisiones, timers, efectos
  OS_draw();    // Renderizado: canvas, HUD DOM, partículas
  requestAnimationFrame(OS_loop);
}
```

`OS_update()` retorna inmediatamente si el estado no es `PLAYING`, evitando comprobaciones en cada función auxiliar.

---

## 5. Motor de Juego (Ollin-Engine)

### 5.1 Colisiones AABB

Se implementa un detector de colisiones **Axis-Aligned Bounding Box** que, además de detectar la intersección, identifica el lado de impacto para calcular la reflexión correcta:

```js
function OS_aabb(ball, rect) {
  // Comprueba solapamiento en ambos ejes
  // Calcula penetración en los cuatro lados
  // Devuelve el lado con menor penetración: 'left' | 'right' | 'top' | 'bottom' | null
}
```

La reflexión sobre el paddle no es una simple inversión de `vy`. En su lugar, el ángulo de salida se calcula en función de la **posición relativa de impacto** dentro del paddle (0 = borde izquierdo, 1 = borde derecho):

```js
const hit   = (ball.x - paddleLeft) / paddle.w;  // 0.0 → 1.0
const angle = -Math.PI/2 + (hit - 0.5) * Math.PI * 0.78;
```

Esto produce un arco de rebote de ±70° aproximadamente, dando al jugador control sobre la dirección.

### 5.2 Velocidad de la Bola

La velocidad base escala linealmente con la oleada actual:

```
velocidad = ballBaseSpeed × (1 + (oleada - 1) × 0.07)
```

Con `ballBaseSpeed = 5.0`, la bola pasa de 5.0 px/frame en la oleada 1 a 9.3 px/frame en la oleada 15. Si el power-up `slow` está activo, la velocidad se reduce un 30%. Al expirar, la velocidad se restaura al valor correspondiente a la oleada, no al valor previo.

### 5.3 Bolas Múltiples

El array `OS_balls` puede contener cualquier número de bolas simultáneas. Cada bola es un objeto independiente con su propia posición, velocidad, estado `fire` y array de trail.

Cuando una bola sale por el borde inferior, se elimina del array. Solo cuando `OS_balls.length === 0` se descuenta una vida y se lanza una bola nueva. Esto significa que perder una bola secundaria (generada por el power-up `multi`) no tiene penalización.

### 5.4 Object Pooling de Partículas

Para evitar la creación y destrucción continua de objetos (que disparara el Garbage Collector en dispositivos de gama media), todas las partículas se gestionan mediante un **pool de tamaño fijo de 220 objetos**:

```js
const OS_POOL = Array.from({ length: 220 }, () =>
  ({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '#fff', alpha: 1 })
);
```

Al romper un ladrillo, se busca el primer objeto inactivo del pool y se reutiliza. Si el pool está lleno, la emisión se ignora silenciosamente. Las partículas tienen gravedad suave (`vy += 0.12` por frame) y se desvanecen gradualmente (`alpha = life / max`).

### 5.5 Textos Flotantes

Los mensajes de combo y activación de power-ups se renderizan como textos flotantes en canvas mediante el array `OS_floats`. Cada elemento tiene posición, velocidad vertical negativa (suben), vida en frames y color. Se eliminan automáticamente al expirar.

---

## 6. Sistema de Oleadas Procedurales

El juego no tiene niveles prediseñados. Cada oleada se genera en tiempo de ejecución mediante `OS_genBricks(wave)`.

### Parámetros de Generación

| Propiedad          | Fórmula                                        | Oleada 1 | Oleada 10 |
|--------------------|------------------------------------------------|----------|-----------|
| Filas de ladrillos | `brickRowBase + min(wave - 1, 7)`              | 5        | 12        |
| Ladrillos duros    | Probabilidad `18%` si `wave > 3`               | 0%       | 18%       |
| Power-ups          | `min(wave, 3)` posiciones aleatorias           | 1        | 3         |

Los **ladrillos duros** (`hp: 2`) requieren dos impactos para romperse. Se identifican visualmente por dos barras verticales en su borde derecho. La posición de los power-ups dentro de la cuadrícula se selecciona aleatoriamente usando un `Set` para evitar duplicados.

### Transición entre Oleadas

Cuando todos los ladrillos están destruidos (`OS_bricks.every(b => !b.alive)`), se ejecuta `OS_nextWave()`:

1. Se incrementa `OS_wave`
2. Se resetean todos los efectos activos (el paddle vuelve a su ancho normal)
3. Se genera la nueva cuadrícula de ladrillos
4. Se vacía el array de drops en caída
5. Se lanza una bola nueva desde el paddle
6. Se muestra el mensaje de transición con fade

Las monedas acumuladas durante la oleada **no se reportan** en la transición, solo al final de la partida (Game Over). Esto se debe a que el método `completeLevel` de Love Arcade acepta un único ID de hito por sesión.

---

## 7. Power-Ups: Catálogo Técnico

Los power-ups caen desde la posición del ladrillo destruido como ítems visuales con icono SVG dibujado en canvas. El jugador los recoge pasando el paddle por encima. Cada power-up tiene su propio icono dibujado por la función `OS_DROP_DRAW[type]`.

### PU_MULTI — Fragmentación

**Icono:** Tres círculos en fila horizontal  
**Efecto:** Por cada bola activa en el momento de la recogida, se generan dos bolas adicionales con ángulos desviados ±0.42 radianes respecto a la dirección original.  
**Duración:** Instantáneo  
**Nota técnica:** La velocidad de las bolas nuevas se hereda de la bola origen (`Math.hypot(vx, vy)`), no de la configuración base. Si se activa con el power-up `fire` activo, las bolas nuevas también tienen `fire: true`.

### PU_LONG — Expansión Ollin

**Icono:** Flecha doble horizontal con puntas internas  
**Efecto:** El ancho del paddle aumenta un 40% (`paddleW × 1.4`)  
**Duración:** 20 segundos (1200 frames a 60 FPS)  
**Nota técnica:** Al expirar, el ancho se restaura exactamente a `OS_CFG.paddleInitW`, no al valor previo. Activaciones múltiples no acumulan el bonus ni reinician el timer; simplemente refrescan el estado.

### PU_FIRE — Aliento de Quetzalcóatl

**Icono:** Llama estilizada en curvas bézier  
**Efecto:** La bola atraviesa los ladrillos sin rebotar. La bola cambia de color a carmesí y su halo de glow se intensifica. El ladrillo sigue destruyéndose, pero la dirección de la bola no cambia.  
**Duración:** 30 segundos (1800 frames)  
**Nota técnica:** La lógica de no-reflexión se implementa omitiendo el `break` en el bucle de colisiones con ladrillos cuando `ball.fire === true`. Las bolas nuevas generadas por `PU_MULTI` mientras `fire` está activo heredan el estado de fuego.

### PU_SLOW — Tiempo de Obsidiana

**Icono:** Reloj de arena con triángulos superior e inferior  
**Efecto:** La velocidad de todas las bolas activas se reduce un 30% de forma inmediata.  
**Duración:** 15 segundos (900 frames)  
**Nota técnica:** La reducción se aplica multiplicando los vectores de velocidad por `0.7`. Al expirar, la velocidad se recalcula a partir de la velocidad base y la oleada actual, normalizando el vector de velocidad actual:

```js
const spd = Math.hypot(ball.vx, ball.vy);
ball.vx = (ball.vx / spd) * target;
ball.vy = (ball.vy / spd) * target;
```

Esto preserva la dirección de la bola pero restaura la magnitud correcta.

### PU_MAGNET — Atracción Tláloc

**Icono:** Imán en U con patas externas  
**Efecto:** El paddle atrapa la siguiente bola que lo toque. La bola queda adherida al centro del paddle y se mueve con él. El jugador puede redirigir la bola tocando la pantalla o haciendo clic.  
**Duración:** 5 disparos  
**Nota técnica:** El estado `OS_fx.magnet.held` congela la bola en la posición del paddle. Al tocar/clicar, se calcula un ángulo de lanzamiento aleatorio centrado en `-π/2` con variación de ±0.2 radianes. El contador de disparos decrece con cada lanzamiento; al llegar a cero el efecto se desactiva.

---

## 8. Sistema de Combo y Puntuación

### Multiplicador

El multiplicador de puntos aumenta según el número de ladrillos consecutivos destruidos **sin que la bola toque el paddle**:

| Ladrillos consecutivos | Multiplicador |
|------------------------|---------------|
| 0 – 4                  | ×1            |
| 5 – 9                  | ×2            |
| 10 – 19                | ×4            |
| 20+                    | ×8            |

Cada vez que la bola toca el paddle, `OS_combo` se resetea a `0` y el multiplicador vuelve a ×1.

### Cálculo de Puntos

```
puntos_por_ladrillo = 10 × multiplicador_actual
```

Un ladrillo estándar vale 10 puntos. Un ladrillo roto durante un combo ×8 vale 80 puntos. Los ladrillos duros otorgan puntos en el segundo impacto (cuando su `hp` llega a 0), no en el primero.

### Conversión a Monedas

La conversión de puntos a Monedas Love Arcade sigue la tasa definida en el brief:

```
monedas = Math.floor(puntuacion_final / 10)
```

Esta conversión solo se aplica en el momento del Game Over, no de forma continua. El HUD muestra una estimación en tiempo real (`Math.floor(OS_score / 10)`) pero el reporte oficial al `GameCenter` ocurre una sola vez.

---

## 9. Motor de Audio

Todo el audio se genera en tiempo real mediante la **Web Audio API**. No existen archivos de audio externos; esto cumple con el límite de peso de assets (`< 1.2 MB`) y garantiza latencia cero.

El contexto de audio (`AudioContext`) se crea de forma lazy en el primer evento de interacción del usuario, cumpliendo con las políticas de autoplay de todos los navegadores modernos.

### Función Base

```js
function OS_tone(freq, type, dur, gain = 0.25, detune = 0) {
  const ctx = OS_ac();
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}
```

### Catálogo de SFX

| Evento              | Descripción técnica                                                                |
|---------------------|------------------------------------------------------------------------------------|
| Rebote en paddle    | Oscilador `triangle` a 750–1000 Hz, 60ms, gain 0.18                               |
| Ruptura de ladrillo | Dos osciladores (`sawtooth` + `triangle`) a 320/640 Hz con detune aleatorio ±100 Hz |
| Activación power-up | Cuatro tonos `sine` en secuencia ascendente (400→600→850→1050 Hz), 55ms de separación |
| Combo ×2 / ×4 / ×8  | Tono `sine` a 880 / 1100 / 1350 Hz respectivamente                                |
| Game Over           | Tres acordes `sawtooth` descendentes (220→196→165 Hz) con gap de 180ms             |

La variación aleatoria de pitch en la ruptura de ladrillos (`detune` entre -100 y +100 cents) evita la repetición monótona del mismo sonido en sesiones largas.

---

## 10. Integración con Love Arcade

Ollin Smash implementa el contrato de integración definido en `love-arcade-coin-system.md` de forma estricta.

### Reporte de Monedas

El reporte se realiza **una única vez**, al producirse el Game Over:

```js
function OS_reportCoins() {
  const coins = Math.floor(OS_score / 10);
  if (coins <= 0) return;

  const levelId = `wave_${OS_wave}_${OS_sessionId}`;

  if (typeof window.GameCenter !== 'undefined') {
    window.GameCenter.completeLevel('ollin_smash', levelId, coins);
  } else {
    console.warn('[OllinSmash] Modo standalone — monedas no acumuladas.');
  }
}
```

### Idempotencia

Cada partida genera un `OS_sessionId` único al iniciarse:

```js
OS_sessionId = Date.now().toString(36);
```

El `levelId` resultante tiene la forma `wave_8_lz4b9k`, combinando la oleada alcanzada y el identificador de sesión. Esto garantiza que cada partida tenga un ID único y que el sistema de Love Arcade no duplique el pago en caso de reintento de reporte.

### Parámetros del Payload

| Parámetro | Tipo   | Ejemplo                   | Descripción                                    |
|-----------|--------|---------------------------|------------------------------------------------|
| `gameId`  | String | `'ollin_smash'`           | Identificador permanente del juego             |
| `levelId` | String | `'wave_8_lz4b9k'`         | ID único de sesión (oleada + timestamp base36) |
| `coins`   | Int    | `340`                     | Puntuación final ÷ 10, redondeado hacia abajo  |

### Verificación de Existencia

La llamada siempre está envuelta en una comprobación de tipo para garantizar la degradación elegante en modo standalone:

```js
if (typeof window.GameCenter !== 'undefined') {
  window.GameCenter.completeLevel(...);
}
```

### Modo Standalone

Si `window.GameCenter` no existe en el momento del arranque (`OS_boot()`), se muestra un aviso en la pantalla de menú:

```
MODO PRACTICA — LAS MONEDAS NO SE GUARDARAN
```

Este aviso se implementa como un elemento DOM que solo se hace visible (`classList.add('visible')`) cuando se detecta la ausencia del `GameCenter`. En producción (con `app.js` cargado) el elemento permanece oculto.

---

## 11. Namespacing y Aislamiento

Ollin Smash convive en el mismo `window` y `localStorage` que el motor de Love Arcade y cualquier otro juego de la plataforma. El incumplimiento de las reglas de namespace causa colisiones que rompen el sistema completo.

### Prefijo de Variables

Toda variable JavaScript con scope global (fuera de la IIFE) utiliza el prefijo `OS_`:

| Tipo           | Ejemplo correcto       | Ejemplo incorrecto |
|----------------|------------------------|--------------------|
| Variable       | `OS_score`             | `score`            |
| Función        | `OS_update()`          | `update()`         |
| Constante      | `OS_CFG`               | `CONFIG`           |
| Clave localStorage | `OS_highscore`     | `highscore`        |

Dado que el juego usa una IIFE, la totalidad de su estado interno es privado. Las únicas exposiciones al scope global son:

- `window.OllinSmashGame` — objeto de API pública (ver §16)

### Globales Reservados Respetados

El juego no declara, modifica ni accede para escritura a ninguno de los globales del núcleo:

| Global reservado        | Tratamiento en Ollin Smash |
|-------------------------|----------------------------|
| `window.GameCenter`     | Solo lectura, con verificación de existencia |
| `window.ECONOMY`        | No utilizado               |
| `window.THEMES`         | No utilizado               |
| `window.debounce`       | No utilizado               |
| `window.formatCoinsNavbar` | No utilizado            |
| `CONFIG` (sin prefijo)  | No declarado               |

### Claves de localStorage

La única clave de localStorage que escribe Ollin Smash es:

| Clave           | Tipo   | Contenido                      |
|-----------------|--------|--------------------------------|
| `OS_highscore`  | String | Puntuación máxima histórica    |

La clave reservada del sistema (`gamecenter_v6_promos`) nunca es accedida.

---

## 12. Controles e Input

El juego soporta tres métodos de control simultáneamente.

### Mouse (Desktop)

El evento `mousemove` sobre el wrapper convierte la posición X del cursor a coordenadas de canvas y la asigna al centro del paddle. La conversión tiene en cuenta el escalado CSS del canvas:

```js
const canvasX = (clientX - rect.left) * (OS_CFG.W / rect.width);
```

### Touch (Mobile)

El evento `touchmove` con `{ passive: false }` (para poder llamar `preventDefault()` y evitar el scroll de página durante el juego) sigue la misma lógica que el mouse usando `e.touches[0].clientX`.

### Teclado (Desktop)

| Tecla                  | Acción                                      |
|------------------------|---------------------------------------------|
| `←` / `A`              | Mover paddle a la izquierda (18 px/pulsación) |
| `→` / `D`              | Mover paddle a la derecha (18 px/pulsación)  |
| `Espacio` / `Escape`   | Pausar / Reanudar                            |

### Tap / Click

Un clic o toque (sin movimiento) sobre cualquier punto del wrapper activa el lanzamiento de la bola cuando el power-up `Magnetismo` está activo y retiene una bola.

---

## 13. Persistencia Local

Ollin Smash guarda exclusivamente la puntuación máxima histórica:

```js
// Guardar al Game Over (solo si es nuevo récord)
if (OS_score > highscore) {
  localStorage.setItem('OS_highscore', String(OS_score));
}

// Leer al arrancar
const hs = parseInt(localStorage.getItem('OS_highscore') || '0');
```

No se guarda el estado de partida. Si el usuario cierra el navegador durante una sesión, la partida se pierde. Esta es una decisión de diseño deliberada: las sesiones de Arkanoid son cortas y el valor de la continuidad no justifica la complejidad de serializar el estado del motor físico.

---

## 14. Diseño Responsivo y Mobile-First

El canvas tiene dimensiones fijas de diseño (`390 × 700 px`), que corresponden al viewport de un iPhone 14. El escalado al dispositivo real se delega completamente a CSS:

```css
#os-canvas {
  max-height: 100vh;
  max-width: calc(100vh * 390 / 700);  /* Mantiene el aspect ratio 390:700 */
  width: 100%;
  height: auto;
}
```

Esta técnica garantiza que el canvas ocupe el mayor espacio posible en cualquier pantalla sin distorsionar la relación de aspecto. En pantallas muy anchas (landscape en tablet), el canvas se centra horizontalmente con bandas negras a los lados.

El HUD, las píldoras de power-up y el botón de retorno se posicionan usando `position: absolute` relativo al wrapper, con `left: 50%` + `transform: translateX(-50%)` + `width: min(390px, ...)` para seguir exactamente el ancho del canvas independientemente del tamaño de pantalla.

La dimensión mínima de toque recomendada por las guías de Material Design (48×48 dp) se respeta en todos los botones interactivos.

---

## 15. Modos de Ejecución

### Modo Integrado (Producción)

El juego está alojado en `games/ollin-smash/index.html` dentro del repositorio de Love Arcade. El script `../../js/app.js` se carga correctamente, `window.GameCenter` existe y las monedas se reportan al sistema central al terminar la partida.

### Modo Standalone (Desarrollo)

Al abrir `index.html` de forma directa (desde el sistema de archivos o un servidor local independiente), `app.js` no se carga (la ruta `../../js/app.js` no existe). El juego detecta la ausencia de `window.GameCenter` y muestra el aviso de modo práctica. Toda la lógica de juego funciona con normalidad; solo el reporte de monedas queda desactivado.

Para pruebas locales que requieran simular el `GameCenter`, se puede inyectar un mock en la consola del navegador antes de iniciar la partida:

```js
window.GameCenter = {
  completeLevel: (gameId, levelId, coins) => {
    console.log(`[MOCK GameCenter] ${gameId} / ${levelId} → ${coins} monedas`);
  }
};
```

---

## 16. API Pública del Juego

Para facilitar la integración con herramientas de analítica o testing externo, Ollin Smash expone una API de solo lectura en `window.OllinSmashGame`:

```js
window.OllinSmashGame.getScore()   // → Number: puntuación actual
window.OllinSmashGame.getWave()    // → Number: oleada actual
window.OllinSmashGame.getState()   // → String: 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
```

Estos métodos son de **solo lectura**. No exponen referencias mutables al estado interno del juego. No existen métodos de escritura en la API pública; el estado solo puede modificarse mediante la interacción del usuario con la interfaz.

---

## 17. Checklist de QA

Lista de verificación basada en los requisitos del brief y el `love-arcade-minigame-dev-manual.md`:

### Estructura y Navegación

- [x] Proyecto autocontenido en `games/ollin-smash/` (minúsculas, sin espacios)
- [x] Botón de retorno al hub (`../../index.html`) visible en menú y pausa
- [x] Script `../../js/app.js` referenciado al final del `<body>`

### Responsividad

- [x] Diseño Mobile First con escalado CSS puro (sin media queries de layout)
- [x] Canvas con aspect ratio fijo 390:700 preservado en cualquier pantalla
- [x] Controles táctiles funcionales con `touchmove` y `touchend`
- [x] `touch-action: none` en `<html>` para prevenir scroll involuntario

### Rendimiento

- [x] Object Pooling de 220 partículas (sin allocación de objetos en el bucle caliente)
- [x] Sin archivos de audio externos (Web Audio API sintetizado en tiempo real)
- [x] SVG iconos de power-ups dibujados en canvas, sin elementos DOM adicionales
- [x] Sin dependencias externas de JavaScript (cero `npm install`)

### Aislamiento y Namespacing

- [x] Toda la lógica encapsulada en IIFE con `'use strict'`
- [x] Prefijo `OS_` en todas las variables y funciones internas
- [x] Prefijo `OS_` en la única clave de localStorage (`OS_highscore`)
- [x] Sin declaración ni sobreescritura de globales reservados del núcleo
- [x] Única exportación global: `window.OllinSmashGame` (API pública de solo lectura)

### Integración con la Economía

- [x] Conversión interna: `Math.floor(score / 10)` antes de llamar al `GameCenter`
- [x] Llamada única a `window.GameCenter.completeLevel('ollin_smash', levelId, coins)`
- [x] `levelId` único por sesión (combinación de oleada + timestamp base36)
- [x] Parámetros tipados: `gameId` (String), `levelId` (String), `coins` (Int positivo)
- [x] Sin acceso a `localStorage` con claves del sistema (`gamecenter_v6_promos`)

### Modo Standalone y Robustez

- [x] Verificación `typeof window.GameCenter !== 'undefined'` antes de cada llamada
- [x] Aviso visible en menú cuando `GameCenter` no está disponible
- [x] Juego completamente funcional sin `app.js`

### Estética

- [x] Sin emojis en código fuente ni en UI
- [x] Toda iconografía es SVG inline de trazo fino
- [x] Paleta restringida a las variables definidas en `:root`

---

## 18. Glosario

| Término         | Definición                                                                                                    |
|-----------------|---------------------------------------------------------------------------------------------------------------|
| **AABB**        | Axis-Aligned Bounding Box. Técnica de detección de colisiones basada en rectángulos alineados con los ejes.   |
| **Object Pool** | Patrón de diseño que reutiliza objetos pre-creados para evitar la allocación/recolección continua de memoria.  |
| **IIFE**        | Immediately Invoked Function Expression. Función que se ejecuta en el momento de su definición, creando un scope privado. |
| **Standalone**  | Modo de ejecución aislado, sin el motor central de Love Arcade (`app.js`) cargado.                            |
| **GameCenter**  | El objeto global `window.GameCenter` expuesto por `app.js`, único punto de acceso a la economía de Love Arcade.|
| **Oleada**      | Una pantalla completa de ladrillos. Al destruirlos todos, se genera la siguiente oleada con mayor dificultad.  |
| **Power-Up**    | Ítem que cae al destruir ciertos ladrillos y otorga un efecto temporal al ser recogido por el paddle.          |
| **Combo**       | Contador de ladrillos destruidos de forma consecutiva sin tocar el paddle. Activa el multiplicador de puntos. |
| **Grecan**      | Patrón decorativo escalonado en ángulo recto. Elemento arquitectónico recurrente en la cultura mesoamericana.  |
| **Web Audio API**| API nativa del navegador para síntesis y procesamiento de audio en tiempo real, sin archivos externos.       |
| **Lerp**        | Linear interpolation. Técnica para suavizar transiciones de valores numéricos entre dos estados.               |

---

*Documentación de Ollin Smash v2.0 · Desarrollado para Love Arcade · Motor: Game Center Core v7.5 · 2026*
