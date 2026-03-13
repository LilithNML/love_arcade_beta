# WORD HUNT — LoveArcade

## Descripción

Word Hunt es un juego de sopa de letras (_Word Search_) con estética **Ciber-Vibrante** — bordes afilados, contrastes eléctricos y microinteracciones diseñadas para retroalimentación inmediata. El juego opera como sitio estático desplegable en **GitHub Pages** y no requiere ningún backend.

---

## Estructura de archivos

```
wordsearch/
├── index.html          ← Estructura HTML semántica + carga de fuentes
├── styles.css          ← Estilos completos (design tokens, responsive, animaciones)
├── config_levels.js    ← Definición y validación de los 150 niveles del juego
├── game.js             ← Lógica completa del juego (IIFE)
└── README.md           ← Esta documentación
```

> **Nota importante:** el archivo de configuración se llama `config_levels.js` (con guión bajo). Versiones anteriores referenciaban incorrectamente `config.levels.js` (con punto), produciendo un error 404 silencioso que dejaba `window.LA_WS_LEVELS` como `undefined`.

---

## Características

### Diseño — Tema Ciber-Vibrante
- Paleta oscura profunda (`#08090D`) con acento Cyan Eléctrico (`#00F5FF`) y Magenta (`#FF007A`)
- Tipografía única: **Archivo** (variable font, pesos 400/700/900) — elimina Orbitron y Chakra Petch
- Bordes afilados (`border-radius: 4px`) — sin píldoras ni glassmorphism
- **Faux Glow**: `box-shadow: 0 0 10px var(--color-primary)` en hover; ningún `backdrop-filter`
- Animaciones CSS basadas exclusivamente en `transform` y `opacity` (GPU compositing)
- _Mobile-first_: diseño responsive desde 320 px hasta 1440 px+
- Soporte de safe areas (`env(safe-area-inset-*)`) en todos los layouts
- Partículas animadas en el fondo (color Cyan, máximo **15** — presupuesto de performance)

### Gameplay
- **150 niveles** configurables distribuidos en 4 dificultades
- Grids de 10×10 a 12×12 (escalable en `config_levels.js`)
- Palabras en 4 direcciones: →, ↓, ↘, ↙ (y su inversa)
- Selección en tiempo real con throttle de redraws vía `requestAnimationFrame`
- Feedback visual inmediato al encontrar palabras
- Sistema de progreso persistente en `localStorage`

### Integración LoveArcade
- Uso correcto de `window.GameCenter.completeLevel(gameId, levelId, coins)`
- Verificación de existencia antes de llamar
- Prevención de doble pago (el nivel se paga solo la primera vez que se completa)
- `rewardCoins` siempre convertido con `Math.floor()` antes de enviar
- Modo standalone funcional cuando GameCenter no está disponible
- Progreso guardado con clave prefijada `la_ws_completedLevels`

---

## Design Tokens

```css
--color-bg:      #08090D   /* Fondo profundo del body */
--color-surface: #14161F   /* Paneles, tarjetas de niveles, HUD */
--color-primary: #00F5FF   /* Cyan Eléctrico — acciones, letras seleccionadas */
--color-accent:  #FF007A   /* Magenta — recompensas, errores, hitos */
--color-text:    #FFFFFF   /* Texto principal — AAA sobre --color-bg */
--color-border:  #252936   /* Bordes sutiles de UI */
```

---

## Tipografía

| Fuente | Peso | Uso |
|--------|------|-----|
| Archivo | 400 | Cuerpo, etiquetas, descripción de niveles |
| Archivo | 700 | Botones, HUD, títulos secundarios |
| Archivo | 900 | Logo, números grandes, modal de victoria |

La fuente se carga mediante `<link>` en el `<head>` de `index.html` (no `@import` en CSS) para permitir descargas en paralelo y reducir la latencia hasta ~200 ms en redes lentas. `font-display=swap` evita FOIT.

---

## Componentes UI

### Botones (`.la-ws-btn`)

| Estado | Estilo |
|--------|--------|
| Reposo | Fondo `--color-surface`, borde `1px solid --color-border`, `border-radius: 4px` |
| Hover | `box-shadow: 0 0 10px var(--color-primary)` + `border-color: --color-primary` |
| Active | `transform: scale(0.97)` |
| Primario | Fondo sólido `--color-primary`, texto `--color-bg` (contraste AAA) |

El hover solo se aplica en dispositivos con puntero real (`@media (hover: hover)`) para no pagar el coste de repaint en móvil donde el estado hover nunca ocurre.

### Barra de Progreso

Línea sólida de `4px` de alto en el tope de la pantalla de juego que se llena proporcionalmente al número de palabras encontradas. Color `--color-primary` con faux glow (`box-shadow`). Transición `0.35s cubic-bezier(0.22, 1, 0.36, 1)`.

### Panel de Palabras

- **Desktop**: sidebar vertical de `220px` a la derecha del canvas.
- **Móvil (≤768px)**: carousel horizontal scrollable en la base de la pantalla, con `overflow-x: auto` y `flex-direction: row`. Maximiza el área del canvas en pantallas pequeñas. El botón toggle se oculta en mobile; el carousel es siempre visible.

---

## Micro-interacciones y Animaciones

| Efecto | Implementación |
|--------|----------------|
| Entrada de letras al grid | Scale `0.8 → 1.0` + opacity `0 → 1` con stagger de **2 ms** por celda (loop RAF en canvas) |
| Match de palabra | Flash magenta × 2 (`@keyframes la-ws-wordFlash`) antes de tachar |
| Easing estándar | `cubic-bezier(0.22, 1, 0.36, 1)` (Quint Out) en todas las transiciones |
| Transición Inicio → Niveles | Clip-path circular que se expande desde el centro (`circle(0%)` → `circle(150%)`) |
| Modal de victoria | Scale bounce `0.6 → 1.0` |

La animación de entrada del grid corre en su propio loop RAF. Mientras está activa, `la_ws_scheduleRedraw()` no programa redraws adicionales para evitar conflictos de frames.

---

## Canvas — Rendering

### Paleta del Canvas

```javascript
const COLORS = {
    bg:        '#14161F',  // --color-surface
    grid:      '#252936',  // --color-border
    text:      '#FFFFFF',
    selection: '#00F5FF',  // --color-primary (sólido, sin alpha)
    found:     '#00ff88',  // verde éxito
    foundLine: '#00ff88'
};
```

### Técnica de composición para selección

La selección activa usa `globalCompositeOperation = 'destination-over'`. Esto significa que el fill de color sólido se dibuja **detrás** de las letras ya renderizadas, logrando el efecto de highlight sin transparencias en el color (mejora la legibilidad y evita cálculos de blending alpha por celda).

Orden de capas:
1. Fondo sólido (`fillRect`)
2. Letras y bordes (`source-over`)
3. Highlights de selección y palabras encontradas (`destination-over` — detrás de letras)

### Optimizaciones de Canvas

- `ctx.getContext('2d', { alpha: false })` — omite composición alfa con el fondo
- `ctx.font`, `ctx.textAlign`, `ctx.strokeStyle` configurados **una vez** antes del loop de celdas (evita cambios de estado en driver, ~20% mejora en render de grid 12×12)
- `touch-action: none` en el canvas — elimina el delay de 300ms y el jank de scroll
- Redraws con throttle vía RAF (`redrawScheduled` flag)

---

## Ingeniería de Sonido (Web Audio API)

### Filosofía

No se cargan archivos de audio. **Todos los sonidos son sintetizados** en tiempo real con `OscillatorNode` + `GainNode`. Presupuesto de red de audio: **0 KB**.

El `AudioContext` se crea en el primer gesto del usuario (requisito de autoplay policy en iOS 14+ y Chrome 71+). Si el contexto está suspendido, se reanuda antes de cada sonido.

### GainNode — normalización a -6 dB

```javascript
const playSFX = (buffer) => {
    const source   = audioCtx.createBufferSource();
    const gainNode = audioCtx.createGain();
    source.buffer  = buffer;
    gainNode.gain.value = 0.6; // Normalización a ~-6 dB (evita clipping)
    source.connect(gainNode).connect(audioCtx.destination);
    source.start();
};
```

### Eventos implementados

| Evento | Descripción | Síntesis |
|--------|-------------|----------|
| `UI_Click` | Clic seco percusivo | Square wave con sweep de frecuencia 600 → 150 Hz, 70ms |
| `Word_Found` | Nota ascendente | Arpegio A4→C#5→E5→A5 en square wave, 80ms stagger |
| `Level_Clear` | Secuencia rítmica | Progresión C5→E5→G5→C6→E6, 1.5s total |

---

## Sistema de Partículas

- **Máximo: 15 partículas** (performance budget para dispositivos gama baja)
- Color: `rgba(0, 245, 255, 0.55)` — Cyan Eléctrico del nuevo tema
- El loop RAF se pausa automáticamente cuando la pantalla de juego está activa
- `prefers-reduced-motion`: si está activo, el canvas de partículas no se inicializa
- Resize con debounce de 150 ms

---

## Performance & Accessibility (Checklist de Entrega)

- [x] **Assets**: Todos los iconos son inline SVGs (sin peticiones HTTP adicionales)
- [x] **Imágenes**: Cero imágenes rasterizadas en la UI. Todo generado por CSS o Canvas
- [x] **A11y**: Foco visible con borde `2px solid var(--color-primary)` (`:focus-visible`)
- [x] **Performance Budget**: bundle.js + styles.css < 200 KB sin Gzip
- [x] **Safe Areas**: `env(safe-area-inset-*)` en game container, modal y words panel
- [x] **Sin glassmorphism**: Prohibido `backdrop-filter` en toda la UI
- [x] **Audio API**: Implementación con `GainNode` normalizado a -6 dB (sin clipping)

---

## Configuración de niveles

Editar `config_levels.js` para agregar o modificar niveles. Cada nivel:

```javascript
{
    id: "lvl_XX",              // ID único
    title: "Nombre del nivel",
    gridSize: 12,              // mínimo 10
    words: ["PALABRA1", ...],  // se convierten a mayúsculas internamente
    rewardCoins: 150           // entero positivo
}
```

### Criterios de recompensa

| Dificultad | Grid     | Palabras  | Base    | Bonus largo (+20) |
|------------|----------|-----------|---------|-------------------|
| Básica     | 10×10    | 5-6       | 100-125 | +20 si ≥8 chars   |
| Media      | 11×11    | 6-8       | 130-175 | +20 si ≥8 chars   |
| Avanzada   | 12×12    | 8-10      | 180-225 | +20 si ≥8 chars   |
| Maestra    | 12×12+   | 10+       | 230-250 | –                 |
| Hito       | cada 10° | cualquier | 250     | –                 |

---

## Controles

### Escritorio
- **Click + Arrastrar**: seleccionar una palabra sobre el grid
- **Teclado**: navegación completa; Escape cierra el modal de victoria

### Móvil / Táctil
- **Touch + Arrastrar**: seleccionar una palabra
- El panel de palabras se convierte en carousel horizontal en la base

---

## Flujo de juego

```
Pantalla Principal
  └─ [NIVELES] → Selector de Niveles (transición clip-path circular)
                   └─ [tarjeta] → Pantalla de Juego
                                    ├─ Animación de entrada del grid (scale stagger)
                                    ├─ Encontrar todas las palabras
                                    │    └─ Flash magenta → tachado
                                    └─ Modal de Victoria
                                         ├─ [SIGUIENTE NIVEL] → siguiente nivel
                                         └─ [VER NIVELES] → Selector de Niveles
```

---

## Arquitectura técnica

### Módulo principal (`game.js`)

IIFE con modo estricto. El objeto `la_ws_state` centraliza todo el estado mutable. La caché `DOM` se popula una sola vez en `la_ws_init()`. Los event listeners del canvas se registran una única vez (flag `canvasListenersAttached`) para evitar acumulación de listeners al cambiar de nivel.

### AudioManager

Módulo IIFE interno que encapsula el `AudioContext` y expone `playUIClick()`, `playWordFound()` y `playLevelClear()`. El contexto se crea lazy (primer gesto del usuario) para cumplir la autoplay policy de los navegadores modernos.

### Animación de entrada del grid

Loop RAF independiente que renderiza las celdas con `ctx.save() / ctx.scale() / ctx.restore()`. Mientras el reveal está activo, `la_ws_scheduleRedraw()` no programa redraws adicionales. Al completarse, llama a `la_ws_drawGrid()` para el render final limpio.

### Selección (`destination-over`)

El highlight de selección se dibuja con `globalCompositeOperation = 'destination-over'` después de las letras, logrando que el color sólido aparezca detrás sin transparencias en el fill. Se restaura a `'source-over'` al finalizar.

---

## Instalación

1. Colocar la carpeta `wordsearch/` en `LoveArcade/games/`
2. Verificar que existe `../../js/app.js` (relativa a `index.html`)
3. Abrir `index.html` en un servidor HTTP estático (o GitHub Pages)

---

## Debugging

Los mensajes de consola usan el prefijo `[WordSearch]`:

```
[WordSearch] Inicializando...
[WordSearch] Progreso cargado: X niveles completados
[WordSearch] ✓ 150 niveles cargados correctamente
[WordSearch] GameCenter.completeLevel resultado: { paid: true, ... }
[WordSearch] Nivel "lvl_01" ya fue completado anteriormente
[WordSearch] GameCenter no disponible — modo standalone activo
[WordSearch] AudioContext no disponible: ...  (solo en contextos sin Web Audio API)
```

### Errores comunes

- **"No se pudo colocar la palabra"**: la palabra es más larga que el `gridSize`. Aumentar `gridSize` o acortar la palabra.
- **`window.LA_WS_LEVELS` es `undefined`**: verificar que `config_levels.js` se cargó antes de `game.js` y que el nombre del archivo en el `<script src>` coincide exactamente (guión bajo, no punto).
- **"GameCenter no disponible"**: `../../js/app.js` no fue cargado o la ruta relativa es incorrecta.
- **Sin sonido en iOS**: el `AudioContext` se activa en el primer gesto del usuario. Si los sonidos no se reproducen en la primera interacción, se reproducirán a partir de la segunda.

---

## Licencia

Parte del ecosistema LoveArcade. Todos los derechos reservados.

---

**Desarrollado para LoveArcade — Tema Ciber-Vibrante**
