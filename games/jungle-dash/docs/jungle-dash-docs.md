# Jungle Dash — Documentación del Juego

> **Versión:** `1.1.0` · **Plataforma:** Love Arcade · **ID del juego:** `jungle-dash`  
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
| `START` | Pantalla de inicio. El canvas renderiza el fondo en loop pero no hay lógica de juego activa. El botón de mute es visible. |
| `PLAYING` | Loop activo. Se actualiza física, entidades, parallax y puntuación. El botón de mute se oculta para evitar activaciones accidentales. |
| `GAMEOVER` | Loop detenido. Se muestra la pantalla de resultado y se reporta al GameCenter. El botón de mute vuelve a ser visible. |

---

## 4. Sistema de puntuación y economía

### Puntuación

La puntuación aumenta continuamente mientras el jugador está en estado `PLAYING`:

```js
JD_score += delta * 0.85;  // ~51 puntos por segundo a 60 fps
```

El resultado se muestra en el canvas como un contador de 6 dígitos con ceros a la izquierda.

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

### Fullscreen API

Al detectar la primera interacción del usuario, `JD_Core._requestFullscreen()` activa el modo pantalla completa sobre el elemento `#jd-container` (no el canvas). Usar el contenedor en lugar del canvas permite que el HUD HTML siga siendo visible y accesible en modo fullscreen.

```js
// JD_Core.js — _requestFullscreen()
const JD_el = document.getElementById('jd-container');
const JD_rfs = JD_el.requestFullscreen
             || JD_el.webkitRequestFullscreen   // Safari / Chrome iOS
             || JD_el.mozRequestFullScreen
             || JD_el.msRequestFullscreen;

JD_rfs.call(JD_el).then(() => {
    screen.orientation.lock('landscape').catch(() => {});
});
```

La activación se integra en el mismo gesto que desbloquea el `AudioContext`, evitando la necesidad de un segundo gesto de usuario.

### Forzado de orientación (`orientation.lock`)

Tras activar el fullscreen, se invoca `screen.orientation.lock('landscape')` para fijar la orientación horizontal. Los errores se silencian con `.catch(() => {})` ya que esta API **no está soportada en iOS Safari web** (solo en PWA instaladas).

### Overlay "Gira tu dispositivo"

Para cubrir el caso de iOS y cualquier otro navegador que no soporte `orientation.lock`, se implementa un bloqueo por CSS mediante una media query de orientación:

```css
/* index.html — overlay portrait */
@media (orientation: portrait) {
    #jd-rotate-overlay { display: flex; }   /* Muestra el mensaje */
    #JD_canvas          { visibility: hidden; } /* Evita errores de renderizado */
}
```

El overlay `#jd-rotate-overlay` es un elemento `position: fixed` con `z-index: 9999` que cubre completamente la pantalla, mostrando un icono animado y el mensaje "Gira tu dispositivo". El canvas se oculta con `visibility: hidden` (en lugar de `display: none`) para preservar sus dimensiones y evitar que `JD_Renderer` recalcule el layout durante la rotación.

### Notas de compatibilidad

| Plataforma | Fullscreen | orientation.lock | Overlay portrait |
|---|---|---|---|
| Chrome / Edge (Android) | ✅ | ✅ | ✅ (respaldo) |
| Firefox (Android) | ✅ | ✅ | ✅ (respaldo) |
| Safari (macOS) | ✅ (webkit) | ❌ No soportado | ✅ (crítico) |
| Safari (iOS) | ❌ Web no soportado | ❌ No soportado | ✅ (crítico) |
| Chrome (iOS) | ❌ Motor WebKit | ❌ No soportado | ✅ (crítico) |

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
├── index.html                  ← Entrada principal. HUD, canvas, overlay portrait, scripts.
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

## Historial de cambios

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

*Documentación de Jungle Dash · Love Arcade · v1.1.0 · 2026*
