# Jungle Dash — Documentación del Juego

> **Versión:** `1.2.0` · **Plataforma:** Love Arcade · **ID del juego:** `jungle-dash`  
> **Namespace:** `JD_` · **Motor:** Game Center Core v7.5

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Mecánicas de juego](#2-mecánicas-de-juego)
3. [Arquitectura de módulos](#3-arquitectura-de-módulos)
4. [Sistema de puntuación y economía](#4-sistema-de-puntuación-y-economía)
5. [Progresión y dificultad](#5-progresión-y-dificultad)
6. [Biomas y mundo visual](#6-biomas-y-mundo-visual)
7. [Sistema de audio](#7-sistema-de-audio)
8. [Controles](#8-controles)
9. [Experiencia móvil y pantalla completa](#9-experiencia-móvil-y-pantalla-completa)
10. [Sistema de fallback](#10-sistema-de-fallback)
11. [Integración con Love Arcade](#11-integración-con-love-arcade)
12. [Persistencia local](#12-persistencia-local)
13. [Estructura de archivos](#13-estructura-de-archivos)
14. [Historial de cambios](#14-historial-de-cambios)

---

## 1. Descripción general

**Jungle Dash** es un juego de carrera infinita de desplazamiento lateral (*endless runner*). El jugador controla a un jaguar que corre automáticamente a través de una selva dinámica, esquivando obstáculos mientras la velocidad del escenario aumenta de forma progresiva.

El juego opera sobre un sistema de coordenadas virtuales de **800 × 450 px** (relación de aspecto 16:9) que se escala mediante CSS para adaptarse a cualquier pantalla sin distorsionar la lógica de física ni las cajas de colisión.

---

## 2. Mecánicas de juego

### Salto proporcional

El salto no es binario: la altura final depende del tiempo de presión sobre el control.

- **Toque corto** (< ~80 ms de presión): el jaguar ejecuta un salto bajo, de aproximadamente 64 px de altura virtual.
- **Presión mantenida** (hasta 380 ms máx.): cada frame adicional aplica un vector de impulso extra (`JD_JUMP_BOOST_VEL = -0.42 px/frame²`), alcanzando un máximo de aproximadamente **150 px** de altura virtual.
- Al soltar el control el boost se cancela inmediatamente, devolviendo el control preciso al jugador.

### Física de gravedad

| Parámetro | Valor | Descripción |
|---|---|---|
| `JD_GRAVITY` | `0.55 px/frame²` | Aceleración de caída por frame |
| `JD_JUMP_INIT_VEL` | `-8.5 px/frame` | Velocidad vertical inicial del salto |
| `JD_JUMP_BOOST_VEL` | `-0.42 px/frame²` | Boost adicional por frame en hold |
| `JD_MAX_BOOST_MS` | `380 ms` | Duración máxima del boost |
| `JD_MAX_FALL_VEL` | `14 px/frame` | Velocidad máxima de caída (terminal) |

El delta de tiempo se normaliza a 60 fps (`delta = Δt / 16.667`) y se limita a un máximo de 3 para evitar *tunneling* ante bajadas de framerate.

### Detección de colisiones (AABB al 80 %)

Las cajas de colisión se reducen simétricamente al **80 % del tamaño real del sprite** en ambos ejes. Esto produce una experiencia más justa al evitar falsos positivos en los bordes visuales de los sprites.

```
hitbox.x = entity.x + entity.w * 0.10
hitbox.y = entity.y + entity.h * 0.10
hitbox.w = entity.w * 0.80
hitbox.h = entity.h * 0.80
```

Al detectarse una colisión, `JD_Core` detiene el loop de juego, reproduce el SFX de impacto, calcula la recompensa e invoca el flujo de fin de partida.

---

## 3. Arquitectura de módulos

El juego se divide en **5 módulos ES6** bajo el namespace `JD_`. Cada módulo es un *Immediately Invoked Function Expression* (IIFE) que expone únicamente una API pública, manteniendo el estado interno privado.

```
JD_Audio.js      ←── Web Audio API (BGM + SFX)
JD_Physics.js    ←── Gravedad, salto, AABB
JD_Entities.js   ←── Jugador, obstáculos, decoraciones
JD_Renderer.js   ←── Canvas 2D, parallax, biomas, fallback
JD_Core.js       ←── Game loop, estados, input, fullscreen, GameCenter
```

### Orden de dependencias

```
JD_Audio  ──┐
JD_Physics ─┤
JD_Entities ┼──→ JD_Core (orquestador)
JD_Renderer ┘
```

`JD_Core` es el único módulo que conoce a todos los demás. El resto son independientes entre sí, a excepción de `JD_Physics`, que invoca `JD_Audio.playJump()` al iniciar un salto.

### Estados del juego

```
START ──(primera interacción)──→ PLAYING ──(colisión)──→ GAMEOVER
  ↑                                                          │
  └──────────────────────(reiniciar)────────────────────────┘
```

| Estado | Descripción |
|---|---|
| `START` | Pantalla de inicio. El canvas renderiza el fondo en loop. El botón de mute es visible. El juego es interactuable en cualquier orientación. |
| `PLAYING` | Loop activo. Física, entidades, parallax y puntuación actualizándose. El botón de mute se oculta para evitar toques accidentales. |
| `GAMEOVER` | Loop detenido. Se muestra el panel de resultado y se reporta al GameCenter. El botón de mute vuelve a ser visible. |

---

## 4. Sistema de puntuación y economía

### Puntuación

La puntuación aumenta continuamente mientras el jugador está en estado `PLAYING`:

```js
JD_score += delta * 0.85;  // ~51 puntos por segundo a 60 fps
```

El valor se muestra en tiempo real en el elemento `#jd-score-display` del HUD HTML, actualizado cada 100 ms por el glue script de `index.html`. El antiguo `JD_drawHUD()` del canvas fue eliminado en v1.2.0 (ver §9).

### Conversión a monedas Love Arcade

Al finalizar la partida se aplica la regla de negocio definida en el brief técnico:

```js
JD_coinsEarned = Math.floor(JD_score / 500);
```

| Puntuación | Monedas otorgadas |
|---|---|
| 0 – 499 | 0 (no se reporta al GameCenter) |
| 500 – 999 | 1 |
| 1 000 – 1 499 | 2 |
| 5 000 | 10 |
| 10 000 | 20 |

Si el resultado es `0`, la llamada al GameCenter se omite para respetar la regla de validación `coins > 0` del sistema universal.

### Flujo de reporte al GameCenter

```js
// JD_Core.js — gameOver()
if (JD_coinsEarned > 0) {
    if (typeof window.GameCenter !== 'undefined') {
        const JD_sessionId = 'jd_session_' + Date.now();
        window.GameCenter.completeLevel('jungle-dash', JD_sessionId, JD_coinsEarned);
    }
}
```

El `levelId` se genera con `Date.now()` para garantizar la unicidad de cada sesión y evitar el rechazo por idempotencia del sistema.

---

## 5. Progresión y dificultad

### Velocidad del escenario

La velocidad base es **4.0 px/frame** y escala con la puntuación:

```js
JD_gameSpeed = Math.min(4.0 + Math.floor(JD_score / 500) * 0.55, 13.0);
```

| Puntuación | Velocidad (px/frame virtual) |
|---|---|
| 0 | 4.0 |
| 500 | 4.55 |
| 2 000 | 6.20 |
| 5 000 | 9.50 |
| 8 200+ | 13.0 (techo) |

### Frecuencia de aparición de obstáculos

El intervalo entre spawns se reduce progresivamente:

```
intervalo = max(800 ms, 2200 ms − floor(score / 500) × 100 ms)
```

A partir de **1 500 puntos**, existe un 25 % de probabilidad de que aparezcan dos obstáculos consecutivos con un gap mínimo entre ellos, aumentando la dificultad de forma no lineal.

---

## 6. Biomas y mundo visual

### Parallax de 4 capas

Cada capa se desplaza a una velocidad proporcional a la velocidad del juego:

| Capa | Asset | Factor de velocidad | Contenido |
|---|---|---|---|
| 0 | `JD_bg_layer0.webp` | `0.08` | Cielo / atmósfera, estrellas |
| 1 | `JD_bg_layer1.webp` | `0.25` | Ruinas, árboles lejanos |
| 2 | `JD_bg_layer2.webp` | `0.55` | Selva media, vegetación densa |
| 3 | `JD_bg_layer3.webp` | `1.00` | Suelo, línea base de 4 px |

Las capas hacen *wrapping* infinito: cuando el offset supera el ancho virtual, se reinicia para simular un fondo continuo.

### Biomas y transiciones

Cada 2 000 puntos el mundo cambia de bioma. La transición se produce mediante interpolación lineal de color (`lerp`) en una ventana de **400 puntos** antes del límite, produciendo un fundido suave entre paletas.

| Rango de puntuación | Bioma | Paleta principal |
|---|---|---|
| 0 – 1 999 | Selva Densa | Verdes profundos, niebla esmeralda |
| 2 000 – 3 999 | Cueva Ancestral | Púrpuras oscuros, arcos de piedra |
| 4 000+ | Riberas | Azules acuáticos, niebla cyan |

> **Nota v1.1.0:** La etiqueta de texto `#jd-biome-label` fue eliminada. El bioma queda comunicado exclusivamente a través del parallax y la paleta de colores.

---

## 7. Sistema de audio

Todo el audio se gestiona a través de la **Web Audio API** mediante un `AudioContext` compartido con un `GainNode` maestro que controla el volumen global y el estado de mute.

### Política de Autoplay

El `AudioContext` no se inicializa hasta la primera interacción del usuario (click, tap o tecla), en cumplimiento con las políticas de Autoplay de los navegadores modernos. La inicialización se realiza junto al resto de APIs restringidas (Fullscreen, orientation.lock) en `JD_Core._onActionStart()`.

### BGM (música de fondo)

El sistema intenta cargar `./assets/audio/JD_bgm_jungle.mp3` con un timeout de **5 segundos**. Si el archivo no está disponible, activa un **BGM procedural**: una melodía pentatónica generada con osciladores `sine` a intervalos de 520 ms, complementada con ruido de ambiente filtrado en banda para simular el sonido de la selva.

### SFX (efectos de sonido)

Todos los efectos se sintetizan en tiempo real sin latencia mediante la creación de nodos de audio instantáneos:

| Evento | Tipo de síntesis | Descripción |
|---|---|---|
| Salto | Oscilador `square` con sweep ascendente | Tono agudo de ~150 ms |
| Colisión | Buffer de ruido blanco filtrado (`lowpass`) | Impacto de ~300 ms |

### Control de mute

El estado de mute se persiste en `localStorage` bajo la clave `JD_muted`. El botón (`#jd-mute-btn`) reside en `#jd-mute-container`, desacoplado del HUD superior. Solo es visible en los estados `START` y `GAMEOVER`; la clase `.jd-hidden` la aplica el glue script de `index.html`.

---

## 8. Controles

### Escritorio

| Acción | Tecla |
|---|---|
| Iniciar / Saltar / Reiniciar | `Espacio` o `↑ ArrowUp` |

### Móvil (táctil)

| Acción | Gesto |
|---|---|
| Iniciar / Saltar / Reiniciar | Tap en el canvas |
| Salto alto | Mantener el dedo presionado |

El canvas captura los eventos `touchstart` y `touchend` con `passive: false` para prevenir el scroll del navegador durante el juego.

---

## 9. Experiencia móvil y pantalla completa

### El problema del "bucle de visibilidad"

Los navegadores modernos exigen un **gesto explícito del usuario** para activar la Fullscreen API y `screen.orientation.lock()`. Si el juego se oculta cuando el dispositivo está en portrait, el usuario no puede interactuar y el flujo de automatización nunca se desencadena. La solución es la estrategia "Permitir para Transformar".

### Estrategia "Permitir para Transformar"

El juego permanece **completamente visible en cualquier orientación**. La pantalla de inicio actúa como punto de entrada accesible en portrait, permitiendo que el primer toque desencadene todas las APIs restringidas de forma simultánea.

```
Usuario en portrait
      │
      ▼ (toca la pantalla)
JD_Core._onActionStart()
      │
      ├─ JD_Audio.init()                   ← desbloquea AudioContext
      ├─ container.requestFullscreen()     ← expande a pantalla completa
      └─ screen.orientation.lock('landscape')
               │
         ┌─────┴──────┐
         ✅ éxito      ❌ rechazado (iOS Safari)
         │              │
     gira auto      muestra overlay
                   "Gira tu dispositivo"
```

### Fullscreen API

`JD_Core._requestFullscreen()` aplica fullscreen sobre `#jd-container` (no el canvas), para que el HUD HTML siga siendo visible dentro del modo pantalla completa. Incluye prefijos `webkit`, `moz` y `ms` para máxima compatibilidad.

```js
// JD_Core.js — _requestFullscreen()
const JD_rfs = JD_el.requestFullscreen
             || JD_el.webkitRequestFullscreen
             || JD_el.mozRequestFullScreen
             || JD_el.msRequestFullscreen;

JD_rfs.call(JD_el)
    .then(() => screen.orientation.lock('landscape').catch(onFail))
    .catch(onFail);
```

### Overlay "Gira tu dispositivo" — fallback JS-only

El overlay `#jd-rotate-overlay` es `display: none` por defecto. Solo se activa desde JavaScript, añadiendo la clase `.jd-visible`, cuando `orientation.lock()` o `requestFullscreen()` son rechazados **y** el dispositivo está en portrait (`window.innerWidth < window.innerHeight`).

**No existe ninguna regla `@media (orientation: portrait)` que oculte el canvas o el contenedor.** El overlay desaparece automáticamente cuando el usuario gira el dispositivo, gracias al listener `orientationchange` del glue script de `index.html`.

```js
// index.html — glue script
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (window.innerWidth > window.innerHeight) {
            JD_overlay.classList.remove('jd-visible');
        }
    }, 100);
});
```

### HUD de puntuación — migración al DOM

`JD_drawHUD()` fue **eliminado del render loop del canvas** en v1.2.0. La puntuación se muestra ahora en el elemento `#jd-score-display` del DOM HTML, actualizado cada 100 ms por el glue script. Esta migración resuelve el problema del texto "borroso" en pantallas de alta densidad (Retina / OLED), donde el canvas escala mediante CSS pero el texto del navegador usa sub-pixel rendering nativo.

### Notas de compatibilidad

| Plataforma | Fullscreen | orientation.lock | Overlay portrait |
|---|---|---|---|
| Chrome / Edge (Android) | ✅ | ✅ | — (no necesario) |
| Firefox (Android) | ✅ | ✅ | — (no necesario) |
| Safari (macOS) | ✅ (webkit) | ❌ No soportado en web | ✅ (solo si en portrait) |
| Safari (iOS) | ❌ No soportado en web | ❌ No soportado en web | ✅ (crítico) |
| Chrome (iOS) | ❌ Motor WebKit | ❌ Motor WebKit | ✅ (crítico) |

---

## 10. Sistema de fallback

Si los assets gráficos no están disponibles o no cargan en menos de **5 segundos**, el motor renderiza formas geométricas procedurales que garantizan la jugabilidad completa.

| Elemento | Fallback visual |
|---|---|
| Jugador (jaguar) | Rectángulo `rgba(255, 200, 0, 1)` con orejas, manchas y ojos |
| Obstáculo: planta | Triángulo `rgba(200, 50, 50, 1)` con dentículos decorativos |
| Obstáculo: tronco | Triángulo `rgba(200, 50, 50, 1)` horizontal con anillos |
| Fondos | Gradientes de color por bioma, árboles y ruinas procedurales |
| Suelo | Línea base continua de 4 px de grosor en color de acento del bioma |
| BGM | Melodía pentatónica generada con Web Audio API |

El fallback se activa de forma transparente: el jugador no recibe ningún mensaje de error ni interrupción.

---

## 11. Integración con Love Arcade

### Parámetros de integración

| Campo | Valor |
|---|---|
| `gameId` | `'jungle-dash'` |
| `levelId` | `'jd_session_' + Date.now()` |
| `rewardAmount` | `Math.floor(JD_score / 500)` |
| Namespace JS | `JD_` |

### Inclusión del motor central

```html
<!-- Al final del <body>, después de todos los scripts del juego -->
<script src="../../js/app.js"></script>
```

> ⚠️ **No modificar esta etiqueta ni las meta-tags de Game Center.** Son críticas para la persistencia de monedas y la comunicación con el backend de la plataforma.

### Modo standalone

El juego detecta la ausencia de `window.GameCenter` antes de intentar cualquier llamada. En modo standalone (desarrollo local sin `app.js`), la partida funciona con normalidad y las monedas simplemente no se acumulan.

```js
if (typeof window.GameCenter !== 'undefined') {
    window.GameCenter.completeLevel('jungle-dash', JD_sessionId, JD_coinsEarned);
} else {
    console.warn('[JD] Modo standalone — monedas no acumuladas.');
}
```

---

## 12. Persistencia local

El juego solo escribe en `localStorage` bajo claves con prefijo `JD_`. No lee ni escribe ninguna clave reservada del sistema (`gamecenter_v6_promos` u otras).

| Clave | Tipo | Descripción |
|---|---|---|
| `JD_highscore` | `String (int)` | Mejor puntuación personal del usuario |
| `JD_muted` | `'0'` / `'1'` | Estado de mute del audio |

---

## 13. Estructura de archivos

```
games/jungle-dash/
├── index.html                  ← Entrada principal. HUD DOM, canvas, overlay JS, scripts.
├── js/
│   ├── JD_Audio.js             ← Módulo de audio (Web Audio API)
│   ├── JD_Physics.js           ← Módulo de física (gravedad, salto, AABB)
│   ├── JD_Entities.js          ← Módulo de entidades (jugador, obstáculos)
│   ├── JD_Renderer.js          ← Módulo de renderizado (canvas, parallax, biomas)
│   └── JD_Core.js              ← Módulo principal (loop, estados, input, fullscreen, GameCenter)
└── assets/
    ├── sprites/                ← Assets gráficos (ver guía de sprites)
    └── audio/
        └── JD_bgm_jungle.mp3   ← Música de fondo (opcional; hay fallback procedural)
```

---

## 14. Historial de cambios

### v1.2.0 — Automatización de Orientación y Limpieza de UI

**Problema resuelto:** El "bucle de visibilidad" — ocultar el juego en portrait impedía al usuario interactuar, bloqueando la activación de las APIs de rotación automática.

**`JD_Core.js`**
- **Nuevo método `_showRotateOverlayIfPortrait()`**: encapsula la lógica de mostrar el overlay solo cuando el dispositivo está en portrait (`innerWidth < innerHeight`). Evita que el overlay aparezca en escritorio o en dispositivos ya en landscape.
- **`_requestFullscreen()` refactorizado**: el overlay de rotación ya no se muestra por defecto. Solo se activa si `requestFullscreen()` o `screen.orientation.lock()` son rechazados por el navegador y el dispositivo está en portrait.
- **`_onActionStart()` actualizado**: activa `JD_Audio.init()`, `requestFullscreen()` y `orientation.lock()` de forma simultánea en la primera interacción, aprovechando el único gesto de usuario requerido.

**`JD_Renderer.js`**
- **`JD_drawHUD()` desactivado del render loop**: la llamada `JD_drawHUD(score, state)` en `render()` fue comentada. La función se preserva en el código para referencia histórica. El HUD migró al DOM HTML para eliminar el doble renderizado y el texto borroso en pantallas de alta densidad (Retina / OLED).

**`index.html`**
- **Overlay portrait JS-only**: `#jd-rotate-overlay` es `display: none` por defecto. Se activa añadiendo la clase `.jd-visible` desde `JD_Core._showRotateOverlayIfPortrait()`. No existe ninguna regla `@media (orientation: portrait)` que oculte el canvas ni el contenedor.
- **Eliminada restricción CSS de portrait**: el juego permanece completamente visible en cualquier orientación, habilitando la estrategia "Permitir para Transformar".
- **`#jd-score-display` añadido al HUD**: nuevo elemento `<span>` dentro de `#jd-session-info` que muestra la puntuación en vivo. Reemplaza a `JD_drawHUD()` del canvas.
- **Glue script actualizado**: sincroniza `#jd-score-display` con `JD_Core.score` a 10 fps. Añade listener `orientationchange` para retirar automáticamente el overlay cuando el usuario rota a landscape.

### v1.1.0 — Optimización Mobile & Fullscreen

- Añadida Fullscreen API sobre `#jd-container`.
- `screen.orientation.lock('landscape')` tras fullscreen (con prefijo webkit).
- Overlay CSS `@media (orientation: portrait)` (reemplazado en v1.2.0 por lógica JS).
- Eliminados `#jd-touch-hint` y `#jd-biome-label`.
- Botón de mute reubicado a `#jd-mute-container`.
- HUD migrado de `px` fijos a unidades relativas `clamp`, `vw`, `vh`.
- Eliminados `box-shadow` y `border` de `#jd-container`.

---

*Documentación de Jungle Dash · Love Arcade · v1.2.0 · 2026*
