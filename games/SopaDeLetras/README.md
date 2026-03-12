# WORD HUNT — LoveArcade

## Descripción

Word Hunt es un juego de sopa de letras (_Word Search_) con estética neo-arcade oscura, completamente integrado con el sistema de recompensas de LoveArcade. El juego opera como sitio estático desplegable en **GitHub Pages** y no requiere ningún backend.

---

## Estructura de archivos

```
wordsearch/
├── index.html          ← Estructura HTML semántica + carga de fuentes
├── styles.css          ← Estilos completos (variables CSS, responsive, animaciones)
├── config_levels.js    ← Definición y validación de los 150 niveles del juego
├── game.js             ← Lógica completa del juego (IIFE)
└── README.md           ← Esta documentación
```

> **Nota importante:** el archivo de configuración se llama `config_levels.js` (con guión bajo). Las versiones anteriores del código referenciaban incorrectamente `config.levels.js` (con punto), lo que producía un error 404 silencioso y dejaba `window.LA_WS_LEVELS` como `undefined`.

---

## Características

### Diseño
- Estética Neo-Arcade Oscura: paleta oscura con acentos neón (rosa `#ff0080` / cyan `#00ffff`)
- Tipografía: **Orbitron** (títulos, números, UI del juego) + **Chakra Petch** (cuerpo)
- Animaciones CSS optimizadas basadas en `transform` y `opacity` (GPU compositing)
- _Mobile-first_: diseño responsive desde 320 px hasta 1440 px+
- Soporte de safe areas para dispositivos con notch o barra de gestos (`env(safe-area-inset-*)`)
- Partículas animadas en el fondo (desactivadas automáticamente con `prefers-reduced-motion`)

### Gameplay
- **150 niveles** configurables distribuidos en 4 dificultades
- Grids de 10×10 a 12×12 (escalable en `config_levels.js`)
- Palabras en 4 direcciones: →, ↓, ↘, ↙ (y su inversa)
- Detección de selección en tiempo real con throttle de redraws vía `requestAnimationFrame`
- Feedback visual inmediato al encontrar palabras
- Sistema de progreso persistente en `localStorage`

### Integración LoveArcade
- Uso correcto de `window.GameCenter.completeLevel(gameId, levelId, coins)`
- Verificación de existencia antes de llamar
- Prevención de doble pago (el nivel se paga solo la primera vez que se completa)
- Validación de tipos: `rewardCoins` siempre se convierte con `Math.floor()` antes de enviar
- Modo standalone funcional cuando GameCenter no está disponible
- Progreso guardado con clave prefijada `la_ws_completedLevels`

---

## Configuración de niveles

Editar `config_levels.js` para agregar o modificar niveles. Cada nivel sigue la estructura:

```javascript
{
    id: "lvl_XX",              // ID único — se valida automáticamente al cargar
    title: "Nombre del nivel", // Título descriptivo que aparece en la tarjeta
    gridSize: 12,              // Dimensión del grid (mínimo 10)
    words: ["PALABRA1", ...],  // Las palabras se convierten a mayúsculas internamente
    rewardCoins: 150           // Entero positivo — se valida automáticamente
}
```

### Criterios de recompensa aplicados

| Dificultad | Grid     | Palabras  | Base    | Bonus largo (+20) |
|------------|----------|-----------|---------|-------------------|
| Básica     | 10×10    | 5-6       | 100-125 | +20 si ≥8 chars   |
| Media      | 11×11    | 6-8       | 130-175 | +20 si ≥8 chars   |
| Avanzada   | 12×12    | 8-10      | 180-225 | +20 si ≥8 chars   |
| Maestra    | 12×12+   | 10+       | 230-250 | –                 |
| Hito       | cada 10° | cualquier | 250     | –                 |

### Validaciones automáticas al cargar

El IIFE al final de `config_levels.js` valida cada nivel en carga:
- IDs únicos (no duplicados)
- `gridSize >= 10`
- `rewardCoins` es entero positivo
- `words` es un array no vacío

Los errores se reportan en consola como `[WordSearch] Error: ...` y no bloquean el juego.

---

## Controles

### Escritorio
- **Click + Arrastrar**: seleccionar una palabra sobre el grid
- **Teclado**: navegación completa por botones; Escape cierra el modal de victoria

### Móvil / Táctil
- **Touch + Arrastrar**: seleccionar una palabra
- **Tap**: navegación de menús
- El panel de palabras es colapsable para liberar espacio en pantalla pequeña

---

## Arquitectura técnica

### Módulo principal (`game.js`)

El juego está contenido en un **IIFE** (_Immediately Invoked Function Expression_) con modo estricto. Esto aísla completamente el estado y las funciones del espacio de nombres global, evitando colisiones con otros scripts de LoveArcade.

El objeto `la_ws_state` centraliza todo el estado mutable. Las funciones leen y escriben este objeto en lugar de usar variables globales dispersas.

La caché de referencias DOM (`DOM`) se popula una sola vez en `la_ws_init()`. Esto evita llamadas repetidas a `document.getElementById()` en loops de render y en handlers de eventos frecuentes.

### Rendering del grid

El grid de juego se renderiza sobre un elemento `<canvas>` 2D. Esto evita el coste de crear y actualizar cientos de nodos DOM (una celda de div por letra en un grid 20×20 significaría 400 nodos; el canvas los dibuja todos en microsegundos).

Los redraws se agrupan con `requestAnimationFrame` para sincronizarse con el vsync de la pantalla y evitar frames duplicados cuando `touchmove` dispara múltiples veces por frame (patrón _throttle_ por RAF).

Las propiedades del contexto 2D como `ctx.font`, `ctx.textAlign` y `ctx.strokeStyle` se configuran **una sola vez antes del loop de celdas**, no dentro de él. Cambiar propiedades del contexto tiene un coste no trivial en el driver; evitarlo mejora el tiempo de render hasta un 20 % en grids grandes.

### Sistema de partículas

El canvas de fondo (`#la_ws_particles`) corre su propio loop RAF independiente. Este loop se **pausa automáticamente** cuando la pantalla de juego está activa (`cancelAnimationFrame`) y se reanuda al volver a pantallas de menú. Esto evita que dos loops RAF corran en paralelo, lo cual consumiría el doble de CPU/GPU en dispositivos de gama baja.

El sistema respeta `prefers-reduced-motion`: si el usuario tiene activada esta preferencia del sistema operativo, el canvas de partículas no se inicializa.

---

## Accesibilidad (WCAG 2.1 / 2.2)

- Navegación completa por teclado: todos los botones son elementos `<button>` nativos, el modal se cierra con Escape y el foco se mueve al modal al abrirse
- `aria-label` en todos los botones de solo icono
- `role="dialog"`, `aria-modal`, `aria-labelledby` en el modal de victoria
- `aria-live="polite"` en contadores de progreso y estadísticas para anuncios de lector de pantalla no intrusivos
- `aria-hidden="true"` en todos los SVG decorativos
- `aria-expanded` en el botón toggle del panel de palabras
- `aria-hidden` gestionado programáticamente en pantallas inactivas
- Targets táctiles mínimos de 44 × 44 px (WCAG 2.5.5)
- Estilos `:focus-visible` visibles sobre fondos oscuros

---

## Rendimiento en dispositivos de gama baja

Las siguientes optimizaciones son críticas para el target de dispositivos:

**CSS:** las animaciones del logo y el icono usan exclusivamente `transform` y `opacity`, que se componen en GPU sin repaint. Se eliminó la animación de `filter: drop-shadow` (costosa) y de `background-position` (causaba repaint en texto). Todas las transiciones de hover se protegen con `@media (hover: hover)` para no pagar su coste en dispositivos táctiles donde el estado hover nunca ocurre. `@media (prefers-reduced-motion: reduce)` deshabilita todas las animaciones en una sola regla.

**Canvas:** `ctx.getContext('2d', { alpha: false })` permite al navegador omitir la composición alfa del canvas con el fondo. `touch-action: none` en el canvas elimina el delay de 300 ms de detección de gesto del navegador y evita el jank de scroll durante la selección.

**JS:** event listeners del canvas registrados una única vez (sin duplicados al cambiar de nivel). Redraws con throttle vía RAF. DOM caché evita queries repetidas. Partículas pausadas durante el gameplay. Resize debounced a 150 ms.

---

## Instalación

1. Colocar la carpeta `wordsearch/` en `LoveArcade/games/`
2. Verificar que existe `../../js/app.js` (relativa a `index.html`)
3. Abrir `index.html` en un navegador (o servir con cualquier servidor HTTP estático)

---

## Flujo de juego

```
Pantalla Principal
  └─ [NIVELES] → Selector de Niveles
                   └─ [tarjeta] → Pantalla de Juego
                                    ├─ Encontrar todas las palabras
                                    └─ Modal de Victoria
                                         ├─ [SIGUIENTE NIVEL] → siguiente nivel
                                         └─ [VER NIVELES] → Selector de Niveles
```

---

## Paleta de colores

```css
--la-ws-bg-deep:          #0a0e1a   /* Fondo principal del body */
--la-ws-bg-dark:          #12172a   /* Fondo secundario, headers */
--la-ws-bg-card:          #1a2035   /* Cards, paneles, canvas */
--la-ws-accent-primary:   #ff0080   /* Accent principal (rosa neón) */
--la-ws-accent-secondary: #00ffff   /* Accent secundario (cyan) */
--la-ws-success:          #00ff88   /* Palabras encontradas */
--la-ws-warning:          #ffaa00   /* Recompensas en monedas */
--la-ws-text-primary:     #ffffff
--la-ws-text-secondary:   #8892b0
```

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
```

### Errores comunes

- **"No se pudo colocar la palabra"**: la palabra es más larga que el gridSize del nivel. Aumentar `gridSize` o acortar la palabra.
- **`window.LA_WS_LEVELS` es `undefined`**: verificar que `config_levels.js` se cargó antes de `game.js` y que el nombre del archivo en el `<script src>` coincide exactamente.
- **"GameCenter no disponible"**: `../../js/app.js` no fue cargado o la ruta relativa es incorrecta para el entorno de despliegue.

---

## Licencia

Parte del ecosistema LoveArcade. Todos los derechos reservados.

---

**Desarrollado para LoveArcade**
