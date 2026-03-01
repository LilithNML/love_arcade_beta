# Jungle Dash — Documentación del Juego

> **Versión:** `1.3.0` · **Plataforma:** Love Arcade · **ID del juego:** `jungle-dash`  
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

### Detección de colisiones (hitbox diferencial v1.3.0)

Las cajas de colisión aplican factores distintos según el tipo de entidad para maximizar la fairness en obstáculos y la accesibilidad en recompensas:

| Entidad | Factor | Efecto |
|---|---|---|
| Obstáculos (`JD_HITBOX_FACTOR`) | **0.80** | Caja reducida al 80 % del sprite — evita falsos positivos en bordes visuales |
| Ítems / Super Monedas (`JD_ITEM_HITBOX_FACTOR`) | **1.30** | Caja expandida al 130 % — efecto magnético, elimina "casi lo agarro" |

```
// Obstáculo (reducción simétrica 80%)
hitbox.x = entity.x + entity.w * 0.10
hitbox.y = entity.y + entity.h * 0.10
hitbox.w = entity.w * 0.80
hitbox.h = entity.h * 0.80

// Ítem de recompensa (expansión simétrica 130%)
hitbox.x = entity.x - entity.w * 0.15
hitbox.y = entity.y - entity.h * 0.15
hitbox.w = entity.w * 1.30
hitbox.h = entity.h * 1.30
```

Al detectarse una colisión con un obstáculo, `JD_Core` detiene el loop de juego, reproduce el SFX de impacto, calcula la recompensa e invoca el flujo de fin de partida. Al detectarse solapamiento con un ítem, este se retira del array y se reproduce el SFX correspondiente.

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
| `START` | Pantalla de inicio. El canvas renderiza el fondo en loop pero no hay lógica de juego activa. El botón de mute es visible. |
| `PLAYING` | Loop activo. Se actualiza física, entidades, parallax y puntuación. El botón de mute se oculta para evitar activaciones accidentales. |
| `GAMEOVER` | Loop detenido. Se muestra la pantalla de resultado y se reporta al GameCenter. El botón de mute vuelve a ser visible. |

---

## 4. Sistema de puntuación y economía

> 📄 **La documentación completa del sistema de economía de recompensas se encuentra en el archivo dedicado:**  
> **[`jungle-dash-economy.md`](./jungle-dash-economy.md)**
>
> Ese documento cubre en detalle: conversión pasiva y activa de monedas, multiplicador dinámico de score, mecánica de la Super Moneda, matriz de balance, hitbox diferencial (magnetismo) y flujo de reporte al GameCenter.

### Resumen rápido (v1.3.0)

La puntuación aumenta con un **multiplicador dinámico** que premia la longevidad:

```js
// JD_Core.js — _update()
JD_score += (delta * 0.1) * JD_currentMultiplier;
```

| Tramo | Multiplicador |
|---|---|
| 0 – 1 000 pts | 1.0× |
| 1 001 – 3 000 pts | 1.5× |
| 3 001 + pts | 2.0× |

Al finalizar la partida, las monedas se calculan desde dos fuentes y se reportan al GameCenter en una única llamada:

```js
JD_coinsEarned = Math.floor(JD_score / 40)           // pasivas
               + JD_Entities.superCoinsCollected * 25; // activas (Super Monedas)
```

**Meta de diseño:** ~200 monedas en 5 000 puntos.

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

> **Nota:** La etiqueta de texto `#jd-biome-label` que identificaba el bioma activo ha sido **eliminada del HUD** en la v1.1.0. El bioma queda comunicado exclusivamente a través del parallax y la paleta de colores, eliminando redundancia visual y manteniendo la estética inmersiva del juego.

---

## 7. Sistema de audio

Todo el audio se gestiona a través de la **Web Audio API** mediante un `AudioContext` compartido con un `GainNode` maestro que controla el volumen global y el estado de mute.

### Política de Autoplay

El `AudioContext` no se inicializa hasta la primera interacción del usuario (click, tap o tecla), en cumplimiento con las políticas de Autoplay de los navegadores modernos.

### BGM (música de fondo)

El sistema intenta cargar `./assets/audio/JD_bgm_jungle.mp3` con un timeout de **5 segundos**. Si el archivo no está disponible, activa un **BGM procedural**: una melodía pentatónica generada con osciladores `sine` a intervalos de 520 ms, complementada con ruido de ambiente filtrado en banda para simular el sonido de la selva.

### SFX (efectos de sonido)

Todos los efectos se sintetizan en tiempo real sin latencia mediante la creación de nodos de audio instantáneos:

| Evento | Tipo de síntesis | Descripción |
|---|---|---|
| Salto | Oscilador `square` con sweep ascendente | Tono agudo de ~150 ms |
| Colisión | Buffer de ruido blanco filtrado (`lowpass`) | Impacto de ~300 ms |
| Moneda normal (`playCoin`) | Oscilador `triangle` 520 Hz → 880 Hz | Tono suave de 0.18 s |
| Super Moneda (`playSuperCoin`) | Dos osciladores `triangle` en cadena, 900–2 000 Hz | Doble tono agudo de ~0.24 s |

> El SFX de Super Moneda tiene un pitch más agudo y una estructura de dos notas para diferenciarlo inequívocamente del sonido de coleccionables ordinarios, reforzando el feedback positivo.

### Control de mute

El estado de mute se persiste en `localStorage` bajo la clave `JD_muted`. El botón de la UI activa/desactiva el `GainNode` maestro con una transición suave de 50 ms para evitar clicks de audio.

El botón de mute (`#jd-mute-btn`) reside en el contenedor `#jd-mute-container`, **desacoplado del HUD superior**. Solo es visible en los estados `START` y `GAMEOVER` para evitar activaciones accidentales con los pulgares durante el juego.

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

> **Nota:** El hint táctil `#jd-touch-hint` ("👆 Toca para saltar") ha sido **eliminado** en la v1.1.0. La mecánica de toque es autodescubrible en el primer segundo de juego, y el elemento ocupaba espacio vital en pantallas pequeñas.

---

## 9. Experiencia móvil y pantalla completa

### Fullscreen API — Glue Script v2.1.0

La inmersión (fullscreen + orientation lock) se gestiona íntegramente en el **glue script** de `index.html`. `JD_Core._requestFullscreen()` es un stub vacío mantenido solo por compatibilidad; no se invoca desde ningún lugar del motor.

El glue script opera en dos fases separadas:

**Fase 1 — Desbloqueo de AudioContext (`pointerdown` en `window`, `passive: true`)**

Se registra en el momento de carga. Al primer contacto (sea sobre el canvas, el HUD o cualquier punto de la pantalla), crea el `AudioContext` en estado `suspended` sin emitir sonido. El uso de `passive: true` garantiza que no bloquea el hilo principal.

**Fase 2 — Inmersión completa: dos rutas paralelas**

El trigger de inmersión usa **dos rutas complementarias** que comparten la función `JD_doImmersion()` y se auto-eliminan mutuamente al primer disparo válido:

| Ruta | Evento | Propósito |
|---|---|---|
| Principal (táctil) | `touchend` en `window`, `capture: true` | Android: funciona aunque `touchstart` haya llamado a `preventDefault()` |
| Respaldo | `click` en `window`, `capture: true` | Desktop y Safari iOS donde `touchstart` no suprime `click` |

Un tercer listener en `touchstart` (`passive: true`) registra las coordenadas del punto de contacto para filtrar swipes en `touchend`:

```js
// index.html — glue script v2.1.0
const JD_TAP_DRIFT = 10; // px
let JD_touchStartX = 0, JD_touchStartY = 0;

// Rastreo de posición inicial (solo para cálculo de drift)
window.addEventListener('touchstart', JD_trackTouchStart, { capture: true, passive: true });

// Ruta principal: touchend (se genera aunque touchstart llame a preventDefault)
window.addEventListener('touchend', JD_touchTrigger, { capture: true, passive: true });

// Ruta de respaldo: click (desktop + Safari iOS)
window.addEventListener('click', JD_clickTrigger, { capture: true });
```

```js
const JD_doImmersion = (fsTarget) => {
    JD_removeTriggers(); // auto-eliminación de los tres listeners

    if (typeof JD_Core !== 'undefined' && JD_Core.state === 'START') {
        JD_Core.startGame(); // guard: evita duplicado si _onActionStart() ya lo llamó
    }

    const JD_fsReq = fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen /* … */;
    if (JD_fsReq) {
        JD_fsReq.call(fsTarget)
            .then(() => {
                // orientation.lock DENTRO del .then(): el SO ya concedió fullscreen.
                if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
            })
            .catch(() => { /* Fullscreen denegado — juego continúa en modo ventana */ });
    }
};
```

**Selección del elemento para `requestFullscreen`**

En Android, `requestFullscreen()` debe invocarse sobre el elemento que recibió la interacción del usuario. Ambas rutas determinan el elemento correcto según `e.target`:

```js
// Si el tap cayó sobre JD_canvas → requestFullscreen en JD_canvas
// Si cayó sobre JD_container (u otro elemento) → requestFullscreen en JD_container
const JD_fsTarget = (e.target === JD_canvas || e.target === JD_container)
    ? e.target
    : JD_container;
```

**Filtro de swipes en la ruta `touchend`**

Para evitar que un swipe de scroll active fullscreen, `JD_touchTrigger` compara las coordenadas finales con las iniciales registradas en `touchstart`. Si el drift supera `JD_TAP_DRIFT` (10 px) en cualquier eje, el evento se ignora.

**Guard de `startGame()` duplicado**

La ruta `touchend` del glue se dispara simultáneamente con el listener `touchstart` del canvas en `JD_Core`, que ya habrá llamado a `_onActionStart()` → `startGame()`. El guard `state === 'START'` en el glue evita una segunda invocación.

La ruta `click` en cambio llama a `e.stopPropagation()` para impedir que `JD_Core` reciba ese primer click, y llama a `startGame()` de forma explícita.

### Por qué v2.0.0 fallaba

La v2.0.0 escuchaba **únicamente `click`** en `window`. En Android, cuando el toque cae sobre el canvas:

1. El canvas recibe `touchstart` con `passive: false` y llama a `e.preventDefault()`.
2. `preventDefault()` en `touchstart` **cancela la síntesis del evento `click` por parte del navegador**.
3. El listener de inmersión nunca recibe el evento → fullscreen no se activa.

Al tocar el `jd-container` fuera del canvas no había `preventDefault()` y el `click` sí se generaba, haciendo el bug parcialmente reproducible (área visible ≈ 0 en móvil).

La solución correcta no es interceptar el evento antes del `preventDefault()` sino usar **`touchend`**, que el navegador genera **siempre**, independientemente de lo que `touchstart` haya declarado.

### Forzado de orientación (`orientation.lock`)

Tras activar el fullscreen, se invoca `screen.orientation.lock('landscape')` encadenado dentro del `.then()` de la promesa de `requestFullscreen`. Esto es crítico: llamarlo de forma síncrona antes de que la promesa resuelva provoca que Android rechace el lock porque el SO todavía no ha aplicado el cambio de ventana.

Los errores se silencian con `.catch(() => {})` ya que esta API **no está soportada en iOS Safari web** (solo en PWA instaladas).

Un listener adicional en `fullscreenchange` reintenta el orientation lock para Samsung Internet y WebViews que disparan el evento de forma diferida (hasta 600 ms después de que `requestFullscreen` resuelva).

### Overlay "Gira tu dispositivo"

El overlay `#jd-rotate-overlay` (`position: fixed`, `z-index: 9999`) se activa **exclusivamente por JavaScript**, no por `@media (orientation: portrait)`. El glue script lo oculta en cuanto se dispara la inmersión, y un listener `resize` lo vuelve a ocultar cuando el usuario gira el dispositivo manualmente (caso iOS Safari donde `orientation.lock` no está disponible).

Esta arquitectura permite que la pantalla de inicio (`START`) sea visible en cualquier orientación antes de la primera interacción, sin bloquear el primer tap que desencadenará `requestFullscreen`.

### Notas de compatibilidad

| Plataforma | Fullscreen | orientation.lock | Overlay portrait |
|---|---|---|---|
| Chrome / Edge (Android) | ✅ | ✅ | ✅ (respaldo) |
| Firefox (Android) | ✅ | ✅ | ✅ (respaldo) |
| Safari (macOS) | ✅ (webkit) | ❌ No soportado | ✅ (crítico) |
| Safari (iOS) | ❌ Web no soportado | ❌ No soportado | ✅ (crítico) |
| Chrome (iOS) | ❌ Motor WebKit | ❌ No soportado | ✅ (crítico) |


## 10. Sistema de fallback

Si los assets gráficos no están disponibles o no cargan en menos de **5 segundos**, el motor renderiza formas geométricas procedurales que garantizan la jugabilidad completa.

| Elemento | Fallback visual |
|---|---|
| Jugador (jaguar) | Rectángulo `rgba(255, 200, 0, 1)` con orejas, manchas y ojos |
| Obstáculo: planta | Triángulo `rgba(200, 50, 50, 1)` con dentículos decorativos |
| Obstáculo: tronco | Triángulo `rgba(200, 50, 50, 1)` horizontal con anillos |
| Super Moneda | Círculo con gradiente dorado radial, halo exterior y estrella de 4 puntas blanca |
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
| `rewardAmount` | `Math.floor(score / 40) + superCoinsCollected × 25` |
| Namespace JS | `JD_` |

### Inclusión del motor central

```html
<!-- Al final del <body>, después de todos los scripts del juego -->
<script src="../../js/app.js"></script>
```

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
├── index.html                       ← Entrada principal. HUD, canvas, overlay portrait, scripts.
├── docs/
│   ├── jungle-dash-docs.md          ← Documentación general del juego (este archivo)
│   └── jungle-dash-economy.md       ← Documentación dedicada de la economía de recompensas (v1.3.0)
├── js/
│   ├── JD_Audio.js                  ← Módulo de audio (Web Audio API + SFX playCoin/playSuperCoin)
│   ├── JD_Physics.js                ← Módulo de física (gravedad, salto, AABB, hitbox diferencial)
│   ├── JD_Entities.js               ← Módulo de entidades (jugador, obstáculos, Super Monedas)
│   ├── JD_Renderer.js               ← Módulo de renderizado (canvas, parallax, biomas, Super Monedas)
│   └── JD_Core.js                   ← Módulo principal (loop, estados, input, multiplicador, GameCenter)
└── assets/
    ├── sprites/
    │   └── JD_item_supercoin.webp   ← Sprite de la Super Moneda (32×32 px, con fallback procedural)
    └── audio/
        └── JD_bgm_jungle.mp3        ← Música de fondo (opcional; hay fallback procedural)
```

---

## Historial de cambios

### v1.3.0 — Optimización del Sistema de Recompensas

- **Añadido:** Multiplicador de score dinámico (`JD_currentMultiplier`): 1.0× (0–1 000 pts), 1.5× (1 001–3 000 pts), 2.0× (3 001+ pts). Nueva fórmula: `JD_score += (delta * 0.1) * JD_currentMultiplier`.
- **Añadido:** Nueva entidad `JD_SuperCoin` con efecto de flotación senoidal (`y = baseY + sin(t) * 12`). Spawn al 5 % de probabilidad por ciclo, habilitado tras los 1 000 puntos. Valor: 25 monedas cada una.
- **Añadido:** Sprite `JD_item_supercoin.webp` (32×32 px) con fallback procedural dorado (gradiente radial + halo + estrella de 4 puntas).
- **Añadido:** Hitbox diferencial en `JD_Physics`: `JD_ITEM_HITBOX_FACTOR = 1.30` para ítems de recompensa (efecto magnético), manteniendo `JD_HITBOX_FACTOR = 0.80` para obstáculos. Nuevo método público `checkItemCollection()`.
- **Añadido:** SFX `playCoin()` (triangle 520→880 Hz, 0.18 s) y `playSuperCoin()` (doble nota 900→2 000 Hz, ~0.24 s) en `JD_Audio`.
- **Modificado:** Economía de monedas dual: pasiva `Math.floor(score / 40)` + activa `superCoinsCollected × 25`. Meta: ~200 monedas en 5 000 pts.
- **Documentación:** Sección de economía extraída a `jungle-dash-economy.md` (archivo dedicado). `jungle-dash-docs.md` conserva el resumen rápido con referencia cruzada.

### v1.2.0 — Corrección de activación Fullscreen desde canvas (Glue Script v2.1.0)

- **Corregido:** La inmersión (Fullscreen API + `orientation.lock`) no se activaba cuando el primer toque del usuario caía sobre el canvas (el 100 % del área visible en móvil). El bug era reproducible en prácticamente todos los dispositivos Android.
- **Causa raíz:** El glue script v2.0.0 escuchaba únicamente el evento `click` en `window`. El canvas de `JD_Core` registra `touchstart` con `passive: false` y llama a `e.preventDefault()`, lo que **cancela la síntesis del evento `click` por parte del navegador** en Android Chrome y Samsung Internet. El trigger de inmersión nunca recibía el evento al tocar el canvas.
- **Solución — dos rutas paralelas en `JD_doImmersion()`:**
  - **Ruta principal:** `touchend` en `window` (capture, passive). `touchend` se genera siempre, independientemente de si `touchstart` llamó a `preventDefault()`. Es el canal táctil primario en Android.
  - **Ruta de respaldo:** `click` en `window` (capture). Para desktop y Safari iOS donde `touchstart` no suprime `click`.
  - Un listener adicional en `touchstart` (passive) registra coordenadas para filtrar swipes en `touchend` (drift máximo: 10 px).
  - Ambas rutas se auto-eliminan mutuamente al primer disparo válido.
- **Selección de elemento para `requestFullscreen`:** se usa `e.target` para invocar `requestFullscreen()` sobre el elemento exacto que recibió la interacción (canvas o contenedor), cumpliendo el requisito de User Activation Token de Android.
- **Guard de `startGame()` duplicado:** la ruta `touchend` puede coincidir con `_onActionStart()` de `JD_Core`. El guard `state === 'START'` en el glue evita la doble invocación.
- **Documentación:** Sección 9 actualizada para reflejar la arquitectura real del glue script v2.1.0 y el análisis de causa raíz.

### v1.1.0 — Optimización Mobile & Fullscreen

- **Añadido:** Fullscreen API sobre `#jd-container` activada en la primera interacción del usuario (`JD_Core._requestFullscreen()`). Incluye prefijo `webkit` para compatibilidad con Safari.
- **Añadido:** `screen.orientation.lock('landscape')` tras activar el fullscreen. Los errores en plataformas no compatibles (iOS Safari web) se silencian sin romper el flujo.
- **Añadido:** Overlay CSS `#jd-rotate-overlay` visible únicamente en `@media (orientation: portrait)`. Cubre el canvas y muestra un icono animado con el mensaje "Gira tu dispositivo". Mecanismo de protección principal para iOS Safari, donde `orientation.lock` no está disponible en contextos web.
- **Eliminado:** `#jd-touch-hint` — el hint táctil "👆 Toca para saltar" se elimina del HTML, CSS y lógica de actualización. La mecánica es autodescubrible.
- **Eliminado:** `#jd-biome-label` — la etiqueta de texto de bioma se elimina del HTML, CSS y ticker de UI. El bioma queda comunicado únicamente a través del arte visual (parallax + paleta).
- **Reubicado:** `#jd-mute-btn` se desacopla del `<header id="jd-hud">` y se traslada a `#jd-mute-container` (elemento `fixed` independiente). Solo es visible en los estados `START` y `GAMEOVER`; se oculta automáticamente durante `PLAYING` mediante la clase CSS `.jd-hidden` gestionada por el glue script.
- **Limpieza:** Se eliminan `box-shadow` y `border` de `#jd-container`. En fullscreen generan *gaps* blancos visibles en los bordes y consumen GPU innecesariamente.
- **HUD responsivo:** Padding, fuentes y tamaños del HUD migrados de px fijos a unidades relativas (`clamp`, `vw`, `vh`) para escalar correctamente en tablets y pantallas grandes en modo fullscreen.

---

*Documentación de Jungle Dash · Love Arcade · v1.3.0 · 2026*
