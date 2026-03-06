# 2048 — Documentación Técnica

> **Versión:** `2.0.0` · **Plataforma:** Love Arcade · **Core compatible:** Game Center Core v7.5+
> **Ubicación:** `games/lumina-2048/`
> **Nombre anterior:** Lumina 2048 (v1.x)

---

## Estructura de Archivos

```
games/lumina-2048/
├── index.html          ← Punto de entrada principal
├── lumina_core.js      ← Módulo 1: Motor lógico (sin cambios en v2.0)
├── lumina_render.js    ← Módulo 2: Capa visual, partículas
├── lumina_input.js     ← Módulo 3: Teclado + TouchEvents (sin cambios en v2.0)
├── lumina_audio.js     ← Módulo 4: Síntesis Web Audio API (sin cambios en v2.0)
└── lumina_bridge.js    ← Módulo 5: Integración Love Arcade (sin cambios en v2.0)
```

---

## Changelog v2.0 — Rediseño Solid Modernism

**Objetivo:** eliminar la identidad visual "Lumina" (glassmorphism, orbes, brillos),
sustituirla por una estética Solid Modernism de alta legibilidad y bajo coste gráfico,
y mantener todas las optimizaciones de rendimiento de v1.3.

**Archivos modificados:** `index.html`, `lumina_render.js`.
**Archivos sin cambios:** `lumina_core.js`, `lumina_input.js`, `lumina_audio.js`, `lumina_bridge.js`.

---

### 1. Identidad Visual

El juego pasa a llamarse **2048**. El título en la cabecera muestra solo "2048"
en Montserrat 900 (Black) blanco sólido. No hay gradiente en el texto del título.

La paleta sigue la directriz brief §3 ("escala de azules/violetas para valores
bajos, naranjas/ámbar vibrantes para valores altos"):

| Ficha | Color bg | Color texto | Categoría |
|-------|----------|-------------|-----------|
| 2 | `#1D2444` | `#4A607E` | Azul casi invisible |
| 4 | `#1C3068` | `#7EB4E8` | Azul marino |
| 8 | `#1350A8` | `#A8CCFF` | Azul medio |
| 16 | `#1860C8` | `#C8E2FF` | Azul brillante |
| 32 | `#3040E0` | `#D4DCFF` | Azul-índigo |
| 64 | `#7C3AED` | `#EDE0FF` | Violeta |
| 128 | `#9C27B0` | `#F4D8FF` | Violeta oscuro |
| 256 | `#B82810` | `#FFD0C0` | Rojo-naranja |
| 512 | `#E84808` | `#FFE8D8` | Naranja vibrante |
| 1024 | `#D97706` | `#FFF8E0` | Ámbar |
| **2048** | `linear-gradient(135deg, #F59E0B, #F97316)` | `#FFFFFF` | **Único con gradiente** |

La ficha ⚡ ENERGY usa `#0B4D72` (azul eléctrico sólido) con texto `#BAE6FD`.

---

### 2. Regla 90/10 — Implementación

**90% Superficies Sólidas:**

Todas las variables CSS que usaban `rgba()` semitransparente para simular
glassmorphism han sido reemplazadas por colores hexadecimales sólidos:

```css
/* ANTES (v1.3) */
--lumina-surface: rgba(255,255,255,0.035);
--lumina-border:  rgba(255,255,255,0.07);

/* AHORA (v2.0) */
--lumina-surface: #161B27;
--lumina-border:  #252D40;
```

El fondo del documento es `#0F1115` — un near-black que reduce el consumo
energético en pantallas OLED respecto a los grises semitransparentes previos.

**10% Efectos Visuales (solo cuando la acción está detenida):**

Los modales de victoria y game over conservan `backdrop-filter: blur(14px)`.
Esto está explícitamente justificado por el brief: "se reserva únicamente
para modales de victoria o menús principales, donde la acción está detenida."

---

### 3. Eliminación de backdrop-filter en el tablero

Este es el cambio de rendimiento más significativo del rediseño.

`backdrop-filter: blur(24px)` ha sido eliminado del tablero (`#lumina-board`)
y de todos los elementos activos durante el gameplay: fichas, score boxes,
botones y la barra de controles. Esto libera la carga de la GPU que antes
procesaba el desenfoque en tiempo real cada vez que algún elemento se movía.

La profundidad visual que antes aportaban las sombras difusas se recrea
ahora con un `border-bottom` de 2–3 px ligeramente más oscuro, técnica
del flat design sombreado que no requiere ningún cálculo de composición:

```css
/* ANTES (v1.3): dispara compositing en cada frame */
border-radius: 14px;
backdrop-filter: blur(24px);
box-shadow: 0 8px 60px rgba(0,0,0,0.55), ...;

/* AHORA (v2.0): borde estático, cero coste GPU */
border-radius: 4px;
border-bottom: 3px solid rgba(0,0,0,0.55);
box-shadow: 0 6px 28px rgba(0,0,0,0.55); /* sombra simple de profundidad */
```

---

### 4. Eliminación del Parallax de Fondo

El módulo de parallax giroscópico (orbes animados + efecto de desplazamiento
con `DeviceOrientationEvent`) ha sido completamente eliminado:

Las siguientes funciones y variables ya no existen en `lumina_render.js`:
`lumina_parallaxEl`, `lumina_parallaxRAF`, `lumina_parallaxTargetX/Y`,
`lumina_parallaxCurrentX/Y`, `lumina_parallaxStep()`,
`lumina_startParallaxLoop()`, `lumina_initParallax()`,
`lumina_PARALLAX_IDLE_THRESHOLD`.

El HTML correspondiente (el `div#lumina-bg-parallax` con sus tres orbes)
también ha sido eliminado de `index.html`. El fondo es ahora un color sólido
gestionado íntegramente por CSS.

`lumina_onVisibilityChange()` y `lumina_initRenderer()` han sido actualizados
para reflejar la ausencia del parallax.

---

### 5. Tipografía — Montserrat Black 900

La fuente se actualiza a los pesos 600/700/800/**900**. Las fichas ahora usan
`font-weight: 900` (Montserrat Black), lo que hace que los números "pesen"
visualmente y sean el elemento de mayor jerarquía dentro de cada celda.

El título "2048" en la cabecera también usa weight 900, reforzando la identidad.

---

### 6. Ficha de Energía — Animación Optimizada

La animación `lumina-energy-glow` de v1.3 (que mutaba `box-shadow` e `opacity`
cada frame) ha sido reemplazada por `lumina-energy-idle`, que muta únicamente
`opacity`. Dado que `opacity` es una propiedad compositor-only, esta animación
no desencadena ni layout ni paint:

```css
/* ANTES (v1.3): box-shadow mutable → más costoso */
@keyframes lumina-energy-glow {
  50% { box-shadow: 0 0 14px ...; opacity: 1; }
}

/* AHORA (v2.0): solo opacity — compositor puro */
@keyframes lumina-energy-idle {
  50% { opacity: 0.78; }
}
```

---

### 7. Compatibilidad Retroactiva

Todos los IDs de DOM, las funciones públicas de JavaScript y los nombres
de clase CSS se mantienen sin cambios. Los módulos `lumina_core.js`,
`lumina_input.js`, `lumina_audio.js` y `lumina_bridge.js` son binariamente
compatibles con v2.0 sin ninguna modificación.

---

## Changelog v1.3 — Optimización de Rendimiento (High Performance)

**KPIs alcanzados:**
- FPS estable a 60 en gama media; mínimo 30 FPS en gama baja.
- GPU Usage: 0% durante tablero estático (idle state).
- Reducción notable del drenaje de batería tras 15 minutos de sesión.

### 1. Idle State del Render Loop

El loop de partículas se detiene automáticamente cuando el array `lumina_particles`
queda vacío, garantizando `lumina_particleRAF = null` y un `clearRect` final.
El parallax (eliminado en v2.0) también tenía idle state en v1.3.

### 2. Page Visibility API

`lumina_onVisibilityChange()` cancela todos los loops rAF y suspende el
AudioContext al detectar `document.hidden`. Los reactiva al volver a la pestaña.

### 3. Sistema LOD — Calidad Adaptativa

`lumina_detectQuality()` evalúa `navigator.hardwareConcurrency` y
`navigator.deviceMemory` al iniciar:

| Gama | Cores | RAM | maxParticles | Confeti |
|------|-------|-----|--------------|---------|
| Alta | > 4 | > 2 GB | 50 | 100 piezas |
| Media | ≤ 4 | ≤ 2 GB | 20 | 50 piezas |
| Baja | ≤ 2 | ≤ 1 GB | 0 | Desactivado |

### 4. Frame-time Adaptativo

El loop de partículas mide el tiempo entre frames. Si el promedio de los
últimos 8 supera 18 ms (< 55 FPS), `maxParticles` se reduce a la mitad.

### 5. Posicionamiento de Fichas via `transform`

Las fichas usan `transform: translate()` en lugar de `left/top`, lo que
convierte el movimiento en una operación compositor-only sin layout recalc.
Las animaciones de aparición y merge incluyen el `translate()` en cada
fotograma clave para evitar conflictos con la transición base.

### 6. Gestión de Energía del AudioContext

El `AudioContext` se suspende automáticamente tras 30 segundos de
inactividad y al ocultarse la pestaña. Se reanuda en el siguiente
`touchstart` o al volver a la pestaña.

---

## Changelog v1.2 — Balance de Economía

| Bono | v1.1 | v1.2 |
|------|------|------|
| **Fusión ⚡** | 10 monedas/ficha | 4 monedas/ficha |
| **Persistencia** | `floor(score/150)` | `floor(score/25)` |
| **Hito 512** | Multiplicador ×1.5 | +20 monedas (one-time) |
| **Hito 1024** | — | +50 monedas (one-time) |
| **Hito 2048** | — | +100 monedas (one-time) |

**Referencia (3 000 pts):** `120 (persistencia) + 40 (energía) = 160 monedas`

---

## Changelog v1.1 — Correcciones Críticas

- Mapa de rotaciones `left/right` corregido en `lumina_core.js`.
- Ghost Moves eliminados (protección `hasMoved`).
- Audio Latency Android resuelto (`AudioContext` reanudado en `touchstart`).
- Rediseño del sistema de recompensas: `completeLevel()` solo al cierre de partida.

---

## Mecánicas de Juego

### 2048 Estándar

Fusionar fichas del mismo valor moviéndolas con flechas del teclado o swipe
táctil. El objetivo es alcanzar la ficha de **2048**.

### Combo Meter (exclusivo)

Cada movimiento con al menos una fusión incrementa el streak. Al completar
**5 movimientos consecutivos**, el Combo Meter llega al 100% y fusiona
automáticamente todos los pares de fichas con valor 2 y 4.

### Fichas de Energía (⚡)

Con un **6%** de probabilidad (máx. 2 simultáneas), cada tile nuevo puede ser
una Ficha de Energía. Al fusionarse, acumula **4 monedas** en la sesión.

---

## Arquitectura de Módulos

### `lumina_core.js` (sin cambios en v2.0)

Motor lógico puro de la matriz 4×4. Independiente del DOM. Gestiona el movimiento
mediante rotaciones de grilla, la detección de victoria/derrota, el Combo Meter,
las Fichas de Energía y la persistencia en `localStorage`.

### `lumina_render.js` (actualizado en v2.0)

Capa visual. Gestiona la sincronización DOM, las animaciones CSS, las partículas
en canvas, el sistema LOD, la Page Visibility API y los modales.

- **v2.0:** Nueva paleta sólida, eliminación del parallax, simplificación de `lumina_syncTileEl`.
- **v1.3:** Idle State, LOD, frame-time adaptativo, caché de estilos.
- **v1.2:** `lumina_animateCoinCount()` — animador 500 ms con tintineo.

### `lumina_input.js` (sin cambios en v2.0)

Gestión de teclado y TouchEvents. `lumina_resumeAudio()` en cada `touchstart`.
`lumina_clearGameState()` al detectar fin de partida.

### `lumina_audio.js` (sin cambios en v2.0)

Síntesis procedural via Web Audio API. Escala pentatónica, reverb sintético en
victoria. Gestión de energía del AudioContext (suspensión tras 30 s de inactividad).

### `lumina_bridge.js` (sin cambios en v2.0)

Punto de contacto con `app.js`. Acumulador de sesión, bonos fijos de hito,
reporte único a `window.GameCenter.completeLevel()` al cierre de partida.

---

## Economía de Monedas (v1.2, sin cambios)

| Fuente | Cálculo | Cuándo se suma |
|--------|---------|----------------|
| Persistencia | `floor(score / 25)` | Al cerrar la sesión |
| Fusión ⚡ | `4 × fichas_energía_fusionadas` | Acumulado, reportado al cierre |
| Hito 512 | +20 (one-time) | Al alcanzar ficha 512 por primera vez |
| Hito 1024 | +50 (one-time) | Al alcanzar ficha 1024 por primera vez |
| Hito 2048 | +100 (one-time) | Al alcanzar ficha 2048 por primera vez |

**Calibración:** 3 000 pts → ~160 monedas

---

## Namespacing (normativa v7.5)

| Tipo | Prefijo |
|------|---------|
| Variables/funciones JS globales | `lumina_` |
| Claves `localStorage` | `LUMINA_` |
| Clases CSS | `.lumina-` |
| ID del juego en GameCenter | `lumina_2048` |

---

## Checklist de Entrega ✅

### Estructura y Navegación
- [x] Botón "← Hub" visible → `../../index.html`
- [x] `../../js/app.js` referenciado al final del `<body>`

### Responsividad
- [x] Mobile First: tablero ocupa `90vw` en pantallas ≤ 375 px
- [x] Controles táctiles (swipe + flick) totalmente funcionales

### Rediseño Visual (v2.0) — NUEVO
- [x] Nombre actualizado a "2048"
- [x] Fondo `#0F1115` (OLED-friendly near-black)
- [x] `backdrop-filter` eliminado de tablero, fichas, botones y score boxes
- [x] Fichas con colores sólidos (azules → violetas → naranjas/ámbar)
- [x] Gradiente exclusivo en la ficha 2048
- [x] Profundidad via `border-bottom` oscuro (flat design sombreado)
- [x] Parallax y orbes de fondo eliminados de HTML, CSS y JS
- [x] Montserrat weight 900 en fichas y título
- [x] Título "2048" en blanco sólido, sin gradiente de texto
- [x] Ficha ⚡ ENERGY: color sólido `#0B4D72`, sin glow animado
- [x] Animación `lumina-energy-idle`: solo `opacity` (compositor-only)
- [x] Barra combo: color sólido, sin `box-shadow` de glow
- [x] Record badge: estático, sin animación pulsante
- [x] Modales conservan `backdrop-filter` (gameplay detenido, brief §2)

### Rendimiento (v1.3) — Retenido íntegramente
- [x] Idle State: partículas detienen su loop rAF en reposo
- [x] Page Visibility API: loops cancelados al ocultar la pestaña
- [x] AudioContext suspendido tras 30 s de inactividad
- [x] LOD: `lumina_detectQuality()` al iniciar
- [x] Frame-time adaptativo: `maxParticles` reducido si FPS < 55
- [x] Posicionamiento via `transform` (compositor-only)
- [x] `will-change: transform, opacity` en fichas y canvas
- [x] `contain: layout style` en `#lumina-board`
- [x] Caché de estilos `lumina_tileValueCache`

### Sistema de Recompensas (v1.2) — Sin cambios
- [x] Cero llamadas a `completeLevel()` durante el gameplay
- [x] Persistencia: `floor(score / 25)`
- [x] Fusión ⚡: 4 monedas por ficha
- [x] Bonos fijos: +20 (512), +50 (1024), +100 (2048) — one-time por sesión
- [x] Reporte único al cierre

### Compatibilidad Retroactiva
- [x] Todos los IDs de DOM mantenidos sin cambios
- [x] Todas las funciones públicas JS mantenidas sin cambios
- [x] `lumina_core.js`, `lumina_input.js`, `lumina_audio.js`, `lumina_bridge.js` sin tocar

---

*2048 · Love Arcade · Game Center Core v7.5 · 2026 · v2.0.0*
