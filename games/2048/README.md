# 2048 — Documentación Técnica

> **Versión:** `2.1.0` · **Plataforma:** Love Arcade · **Core compatible:** Game Center Core v7.5+
> **Ubicación:** `games/lumina-2048/`
> **Nombre anterior:** Lumina 2048 (v1.x)

---

## Estructura de Archivos

```
games/lumina-2048/
├── index.html          ← Punto de entrada principal
├── lumina_core.js      ← Módulo 1: Motor lógico (sin cambios desde v1.2)
├── lumina_render.js    ← Módulo 2: Capa visual, partículas
├── lumina_input.js     ← Módulo 3: Teclado + TouchEvents (sin cambios desde v1.2)
├── lumina_audio.js     ← Módulo 4: Síntesis Web Audio API (sin cambios desde v1.3)
└── lumina_bridge.js    ← Módulo 5: Integración Love Arcade (sin cambios desde v1.2)
```

---

## Changelog v2.1 — Accesibilidad y Optimización Gama Baja

**Objetivo:** corregir el contraste de la ficha 2 según la auditoría de accesibilidad
y aplicar cinco optimizaciones adicionales orientadas a mejorar la experiencia en
dispositivos de gama baja.

**Archivos modificados:** `index.html`, `lumina_render.js`.
**Archivos sin cambios:** `lumina_core.js`, `lumina_input.js`, `lumina_audio.js`, `lumina_bridge.js`.

---

### 1. Corrección de Contraste — Ficha 2 (Accesibilidad)

El auditor identificó que los azules profundos de las fichas 2 y 4 tienen un ratio
de contraste muy bajo respecto al fondo del tablero, lo que puede provocar que estas
fichas "desaparezcan" en pantallas con brillo reducido.

**Ficha 2 — cambios en `lumina_TILE_PALETTE`:**

| Propiedad | v2.0 | v2.1 | Ratio contraste |
|-----------|------|------|-----------------|
| Fondo (`bg`) | `#1D2444` | `#232B52` | — |
| Texto (`text`) | `#4A607E` | `#7090BC` | 2.4:1 → **4.3:1** |

La elevación del fondo equivale a aproximadamente +2 puntos de luminosidad HSL,
suficiente para que la ficha sea distinguible a brillo mínimo sin alterar la
progresión cromática del conjunto. El ratio de contraste texto/fondo resultante
(4.3:1) supera el umbral WCAG AA para texto grande y bold (3:1 requerido).

La ficha 4 no requirió corrección: su texto `#7EB4E8` sobre `#1C3068` ya ofrecía
un ratio de 5.7:1.

---

### 2. Eliminación de Transición CSS de Color en la Barra de Combo

**`index.html` — `#lumina-combo-bar`:**

La propiedad `transition` que incluía `background 0.4s ease` ha sido eliminada.
El color del combo bar es establecido desde JavaScript en cada movimiento del jugador,
lo que hacía que la transición CSS disparase una interpolación de color en la CPU
durante 0.4 segundos × 60 fps = hasta 24 recálculos por movimiento. `background`
(color) no es compositor-only: el navegador debe calcular el color interpolado
en cada frame en el hilo principal.

Con la transición eliminada, el cambio de color es un único recálculo de estilo
instantáneo. La transición de `width` (numérica) se conserva porque su interpolación
sí puede ser gestionada por el compositor.

---

### 3. Asignación Única de `className` en `lumina_syncTileEl`

**`lumina_render.js`:**

Las cuatro operaciones que anteriormente manejaban las clases de animación de cada
ficha han sido reemplazadas por una única asignación de `el.className`:

```js
// ANTES (v2.0): 4 operaciones DOM
el.classList.remove('lumina-tile--new', 'lumina-tile--merged', 'lumina-tile--energy');
if (tile.isEnergy) el.classList.add('lumina-tile--energy');
if (tile.isNew)    el.classList.add('lumina-tile--new');
if (tile.isMerged) el.classList.add('lumina-tile--merged');

// AHORA (v2.1): 1 operación DOM
let cls = 'lumina-tile';
if (tile.isEnergy) cls += ' lumina-tile--energy';
if (tile.isNew)    cls += ' lumina-tile--new';
if (tile.isMerged) cls += ' lumina-tile--merged';
el.className = cls;
```

Cada operación de `classList` dispara una validación interna del `DOMTokenList`
y puede forzar un micro-recálculo de estilo. En un movimiento típico con 4–8 fichas
afectadas, la optimización elimina entre 16 y 32 operaciones de DOM por movimiento.

---

### 4. Caché de Valor en `lumina_updateComboMeter`

**`lumina_render.js`:**

La función ahora guarda el último valor escrito al DOM en `lumina_lastComboMeter`.
Si `lumina_comboMeter` no ha cambiado entre llamadas (por ejemplo, en movimientos
sin fusión que resetean el combo a 0 y llaman a la función igualmente), retorna
inmediatamente sin tocar ningún estilo.

```js
if (lumina_comboMeter === lumina_lastComboMeter) return;
lumina_lastComboMeter = lumina_comboMeter;
// ... actualizar DOM solo cuando el valor realmente cambió
```

La variable `lumina_lastComboMeter` se resetea a `-1` en `lumina_clearBoard()` para
garantizar que la primera actualización tras una nueva partida siempre escriba el DOM.

---

### 5. Color Adaptativo del Combo por Nivel de Calidad

**`lumina_render.js`:**

En gama baja, el gradiente HSL dinámico del combo bar se sustituye por el color
acento sólido de plataforma:

```js
if (lumina_qualityLevel === 'low') {
    lumina_comboBarEl.style.background = 'var(--lumina-platform-accent)';
} else {
    const hue = Math.round(260 - lumina_comboMeter * 2.2);
    lumina_comboBarEl.style.background =
        `linear-gradient(90deg, hsl(${hue},85%,58%), hsl(${hue - 50},90%,62%))`;
}
```

En gama media y alta se mantiene el gradiente HSL dinámico. La combinación de
esta optimización con la eliminación de la transición CSS de color (§2) elimina
completamente el coste de interpolación de color en gama baja.

---

### 6. Debounce del Evento `resize` en el Canvas de Partículas

**`lumina_render.js`:**

El handler `lumina_resizeParticleCanvas` ahora incorpora un debounce de 150 ms.
El evento `resize` puede dispararse decenas de veces por segundo durante un cambio
de orientación del dispositivo. Sin debounce, cada disparo reasigna `width`/`height`
del canvas, lo que invalida el contexto 2D completo y fuerza un ciclo de reinicio.
Con debounce, solo se ejecuta la última llamada de cada ráfaga.

El listener también se registra con `{ passive: true }`, lo que permite al navegador
componer el siguiente frame sin esperar a que el handler finalice.

---

### 7. Optimizaciones CSS en Fichas

**`index.html` — `.lumina-tile`:**

Se han añadido dos propiedades CSS:

`contain: layout style paint` — la propiedad `paint` se suma a la contención
de `layout style` que ya existía desde v1.3. Indica al navegador que el contenido
de cada ficha no desborda su caja, lo que permite reducir el área de invalidación
de pintura durante movimientos: en lugar de propagar la invalidación a las celdas
vecinas, el motor de pintura solo invalida los píxeles dentro de cada caja de ficha.

`text-rendering: optimizeSpeed` — instruye al rasterizador de fuentes a priorizar
velocidad sobre precisión de hinting. En Montserrat Black a los tamaños usados
(16–30 px), el impacto visual es imperceptible; en gama baja, el rasterizador puede
omitir pasos costosos de autohinting, reduciendo el tiempo de composición de frames
con muchas fichas visibles.

---

### 8. `user-select: none` en `<body>` y `overscroll-behavior` en el Área de Juego

**`index.html`:**

`-webkit-user-select: none; user-select: none` se añaden al `<body>` como protección
global contra la selección accidental de texto durante gestos de swipe en iOS WebKit.
El `#lumina-board` ya tenía esta propiedad, pero algunos motores de gama baja
aplican la herencia de forma inconsistente.

`overscroll-behavior: none` se añade explícitamente a `#lumina-game-area` además
del `<body>`. Algunos navegadores WebKit de gama baja ignoran el valor heredado
del `body` cuando el contenedor hijo tiene `overflow-y: auto` propio.

---

## Changelog v2.0 — Rediseño Solid Modernism

**Objetivo:** eliminar la identidad visual "Lumina" (glassmorphism, orbes, brillos),
sustituirla por una estética Solid Modernism de alta legibilidad y bajo coste gráfico.

**Archivos modificados:** `index.html`, `lumina_render.js`.

### Identidad Visual

El juego pasa a llamarse **2048**. La paleta sigue la directriz "azules/violetas para
valores bajos, naranjas/ámbar vibrantes para valores altos" del brief §3. Solo la
ficha 2048 tiene gradiente. La ficha ⚡ ENERGY usa `#0B4D72` (azul eléctrico sólido).

### Regla 90/10

Todas las superficies activas durante el gameplay son sólidas. `backdrop-filter`
se conserva únicamente en los modales de victoria y derrota, donde el gameplay
está detenido (brief §2, reserva del 10% de efectos visuales).

### Cambios Clave

`backdrop-filter: blur(24px)` eliminado del tablero, fichas, botones y score boxes,
liberando la carga GPU que antes procesaba el desenfoque en tiempo real.

El módulo de parallax giroscópico (orbes animados + `DeviceOrientationEvent`) fue
eliminado por completo. El fondo es ahora `#0F1115` (near-black, OLED-friendly).

`font-weight: 900` (Montserrat Black) en fichas y título. La jerarquía visual la
aporta el peso tipográfico, no efectos de luz.

La profundidad visual se logra mediante `border-bottom: 3px solid rgba(0,0,0,0.38)`
en fichas (flat design sombreado), sin ningún `box-shadow` con blur.

La animación de la ficha ⚡ pasó de mutar `box-shadow + opacity` a mutar solo
`opacity`, que es compositor-only y no dispara repaint.

---

## Changelog v1.3 — Optimización de Rendimiento (retenido)

El sistema LOD (`lumina_detectQuality`), el Idle State de partículas, la Page
Visibility API, el frame-time adaptativo, la caché de estilos `lumina_tileValueCache`
y el posicionamiento de fichas via `transform: translate()` (compositor-only) se
mantienen íntegramente desde v1.3.

---

## Changelog v1.2 — Balance de Economía (sin cambios)

| Bono | Cálculo |
|------|---------|
| Persistencia | `floor(score / 25)` |
| Fusión ⚡ | 4 monedas por ficha fusionada |
| Hito 512 | +20 monedas (one-time por sesión) |
| Hito 1024 | +50 monedas (one-time por sesión) |
| Hito 2048 | +100 monedas (one-time por sesión) |

**Referencia de calibración:** 3 000 pts → ~160 monedas.

---

## Mecánicas de Juego

**2048 estándar:** fusionar fichas del mismo valor con flechas de teclado o swipe.
Objetivo: alcanzar la ficha 2048.

**Combo Meter:** cinco movimientos consecutivos con fusión llenan el medidor al 100%
y fusionan automáticamente todos los pares de fichas con valor 2 y 4.

**Fichas de Energía ⚡:** 6% de probabilidad por tile nuevo (máx. 2 simultáneas).
Al fusionarse, acumulan 4 monedas en el acumulador de sesión.

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

### Accesibilidad (v2.1) — NUEVO
- [x] Ficha 2 bg: `#232B52` (+2 pts luminosidad respecto a v2.0)
- [x] Ficha 2 text: `#7090BC` — ratio texto/fondo: 4.3:1 (WCAG AA ✓ para texto bold)
- [x] Ficha 4 sin cambios (ratio preexistente: 5.7:1)

### Optimizaciones Gama Baja (v2.1) — NUEVO
- [x] `className` única en `lumina_syncTileEl` (4 ops classList → 1)
- [x] Caché `lumina_lastComboMeter` — sin escrituras DOM redundantes
- [x] Combo bar: color sólido en gama baja, gradiente HSL en media/alta
- [x] Transición CSS `background` eliminada del combo bar (no compositor-only)
- [x] `lumina_resizeParticleCanvas` con debounce 150 ms y `{ passive: true }`
- [x] `contain: layout style paint` en `.lumina-tile` (área de paint reducida)
- [x] `text-rendering: optimizeSpeed` en `.lumina-tile`
- [x] `user-select: none` en `<body>` (herencia uniforme en WebKit)
- [x] `overscroll-behavior: none` explícito en `#lumina-game-area`
- [x] `lumina_lastComboMeter` reseteado en `lumina_clearBoard()`

### Rediseño Visual (v2.0) — Retenido
- [x] Nombre "2048", fondo `#0F1115`, superficies sólidas
- [x] `backdrop-filter` eliminado de tablero, fichas, botones y score boxes
- [x] `backdrop-filter` conservado en modales (gameplay detenido)
- [x] Parallax y orbes eliminados de HTML, CSS y JS
- [x] Montserrat 900 en fichas y título
- [x] Profundidad via `border-bottom` oscuro (flat design sombreado)

### Rendimiento (v1.3) — Retenido
- [x] Idle State de partículas (loop rAF detenido en reposo)
- [x] Page Visibility API (loops cancelados al ocultar pestaña)
- [x] AudioContext suspendido tras 30 s de inactividad
- [x] LOD `lumina_detectQuality()` al iniciar
- [x] Frame-time adaptativo (maxParticles reducido si FPS < 55)
- [x] Posicionamiento via `transform` (compositor-only)
- [x] `will-change: transform, opacity` en fichas y canvas
- [x] `contain: layout style` en `#lumina-board`
- [x] Caché `lumina_tileValueCache`

### Compatibilidad Retroactiva
- [x] Todos los IDs de DOM sin cambios
- [x] Todas las funciones públicas JS sin cambios
- [x] `lumina_core.js`, `lumina_input.js`, `lumina_audio.js`, `lumina_bridge.js` sin tocar

---

*2048 · Love Arcade · Game Center Core v7.5 · 2026 · v2.1.0*
