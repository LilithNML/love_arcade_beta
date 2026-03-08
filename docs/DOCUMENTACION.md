# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v9.3 · Zero-Flicker Initiative · Arcade Solid 3.0

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Novedades en v8.0](#2-novedades-en-v80)
2b. [Novedades en v8.1](#2b-novedades-en-v81--daily-claim-security--ux-hardening)
2c. [Novedades en v9.0 — SPA Migration](#2c-novedades-en-v90--spa-migration--performance)
2d. [Novedades en v9.1 — History API, Retry UI & Theme Fix](#2d-novedades-en-v91--history-api-retry-ui--theme-fix)
2e. [Novedades en v9.2 — Font FOIT/FOUT, Coin Init & Treasury Grid](#2e-novedades-en-v92--font-foitfout-coin-init--treasury-grid)
2f. [Novedades en v9.3 — Zero-Flicker Initiative](#2f-novedades-en-v93--zero-flicker-initiative)
2g. [Novedades en v9.4 — Identity Update](#2g-novedades-en-v94--identity-update)
2h. [Novedades en v10.0 — Arcade Solid 3.0](#2h-novedades-en-v100--arcade-solid-30)
2j. [Novedades en v10.2 — Preview 2.0 Sistema de Mockup Dinámico](#2j-novedades-en-v102--preview-20-sistema-de-mockup-dinámico)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [app.js — El Motor](#5-appjs--el-motor)
6. [sync-worker.js — Web Worker](#6-sync-workerjs--web-worker)
7. [shop.json — El Catálogo](#7-shopjson--el-catálogo)
8. [index.html — SPA Unificada](#8-indexhtml--spa-unificada)
9. [js/shop-logic.js — Módulo de Tienda](#9-jsshop-logicjs--módulo-de-tienda)
10. [js/spa-router.js — Router SPA](#10-jsspa-routerjs--router-spa)
11. [styles.css — Sistema de Diseño Mobile-First](#11-stylescss--sistema-de-diseño-mobile-first)
12. [Códigos Promocionales (SHA-256)](#12-códigos-promocionales-sha-256)
13. [Sistema de Racha (Streaks)](#13-sistema-de-racha-streaks)
14. [Bendición Lunar](#14-bendición-lunar)
15. [Wishlist — Funcionalidad Completa](#15-wishlist--funcionalidad-completa)
16. [Sincronización con Archivo .txt](#16-sincronización-con-archivo-txt)
17. [Historial de Transacciones](#17-historial-de-transacciones)
18. [Flujos de Usuario](#18-flujos-de-usuario)
19. [Guía de Mantenimiento](#19-guía-de-mantenimiento)
20. [Seguridad y Limitaciones](#20-seguridad-y-limitaciones)
21. [Compatibilidad](#21-compatibilidad)
22. [Glosario](#22-glosario)

---

## 1. Visión General

Love Arcade es una **plataforma de recompensas sin backend** construida con HTML, CSS y JavaScript vanilla. Funciona como un sistema de fidelización gamificado: el usuario gana monedas virtuales jugando minijuegos o canjeando códigos, y las utiliza para desbloquear wallpapers en la tienda.

**Principios de diseño:**

- **Sin servidor.** Todo el estado vive en `localStorage`. No hay llamadas a APIs externas salvo la verificación de tiempo (`timeapi.io` → `worldtimeapi.org` como fallback).
- **Mobile-First.** Los estilos base en `styles.css` corresponden a pantallas móviles. Los overrides para desktop se definen con `@media (min-width: 768px)`.
- **Arquitectura SPA.** A partir de v9.0, toda la plataforma es una Single Page Application. `index.html` es el único archivo HTML; `shop.html` ha sido eliminado. La navegación entre vistas no provoca recargas.
- **Separación de responsabilidades.** `app.js` (núcleo), `shop-logic.js` (tienda) y `spa-router.js` (navegación) son módulos independientes con responsabilidades estrictamente delimitadas.
- **Compatibilidad retroactiva.** La función `migrateState()` garantiza que ningún usuario pierda datos al actualizar.
- **Configuración centralizada.** `ECONOMY`, `THEMES`, `CONFIG` y `PROMO_CODES_HASHED` están al inicio de `app.js`.

---

## 2. Novedades en v8.0

| Área | Cambio |
|---|---|
| **CSS** | Reescrito con arquitectura Mobile-First. Los estilos base aplican a móvil; los overrides de desktop usan `@media (min-width: 768px)`. |
| **UI Móvil** | El "Hero Balance" (banner grande de monedas) se oculta en móvil mediante `display: none` en el CSS base. El saldo ya es visible en la Navbar superior. |
| **UI Móvil** | La grilla de productos en la tienda usa `repeat(2, 1fr)` como base (2 columnas en móvil), en lugar de 1 columna. |
| **Iconografía** | Todos los emojis funcionales (`🌙`, `⚡`, `♥`) han sido reemplazados por nodos `<i data-lucide="...">` de la librería Lucide ya integrada. |
| **Filtros** | Los filtros del catálogo se simplifican a: Todos, PC, Mobile y Mis Lista. Se eliminan Anime, Gaming, Sonic, DragonBall y Genshin. |
| **Wishlist** | Nuevo filtro "Mis Lista" para ver solo los ítems marcados con el corazón. |
| **Wishlist** | Indicador de coste: muestra cuántas monedas faltan para comprar toda la lista. |
| **Wishlist** | Los ítems en Wishlist aparecen siempre al principio de los resultados de búsqueda. |
| **Sync** | Exportación: el código se copia al portapapeles **y** se descarga automáticamente como archivo `.txt`. No se muestra en un `<textarea>`. |
| **Sync** | Importación: se añade `<input type="file">` con `FileReader` para cargar el archivo `.txt` sin pegar texto masivo, evitando el error de memoria en móvil. |
| **Economía** | Sin cambios. `saleMultiplier` y `cashbackRate` se mantienen intactos. |
| **LocalStorage** | Sin cambios. La clave `gamecenter_v6_promos` permanece igual. |

---

## 2b. Novedades en v8.1 — Daily Claim Security & UX Hardening

| Área | Cambio |
|---|---|
| **Tiempo de red** | `_syncTimeBackground()` consulta `timeapi.io` y `worldtimeapi.org` en paralelo (background). `_readTimeCache()` lee el caché de forma síncrona en el momento del reclamo — sin red, sin espera. |
| **Reloj desincronizado** | Si la discrepancia entre red y reloj local supera 5 minutos, el reclamo se bloquea con el mensaje "Reloj desincronizado". |
| **Lógica de día** | Sustituido el contador de 24 h exactas por **días calendario**. El bono está disponible a las 00:00:00 del día siguiente al último reclamo. |
| **Fórmula de racha** | `diffDays === 1` → streak+1 · `diffDays > 1` → reset a 1 · `diffDays === 0` → ya reclamado. Calculado con `setHours(0,0,0,0)` para comparar medianoche contra medianoche. |
| **Race condition** | El botón `#btn-daily` se pone a `disabled = true` de forma **síncrona** antes de cualquier `await`, evitando múltiples reclamos por doble clic. |
| **Feedback visual** | El texto del botón cambia a `"Procesando..."` mientras la Promise está pendiente. Se restaura por `updateDailyButton()` al finalizar. |
| **Saltos negativos** | Si `currentTime < lastClaimTime` (manipulación de reloj), se bloquea el reclamo y se muestra un mensaje informativo. La racha no se reinicia. |
| **Tolerancia de red** | `claimDaily()` no depende de la red en tiempo de ejecución. La Bendición Lunar se concede siempre que el buff esté activo. Solo se bloquea si `desynced: true` en el caché (reloj adelantado detectado en el último sync). |

---

## 2c. Novedades en v9.0 — SPA Migration & Performance

| Área | Cambio |
|---|---|
| **Arquitectura** | `index.html` y `shop.html` fusionados en una única SPA. `shop.html` eliminado. |
| **Navegación** | Cero recargas de página. El router SPA alterna `display:none` entre `#view-home` y `#view-shop`. |
| **Modales** | `#preview-modal`, `#confirm-modal` y `#email-modal` movidos al final de `<body>`, fuera de `<main>`. Soluciona el bug de scroll gigante. |
| **Separación JS** | Toda la lógica de tienda extraída de `shop.html` al módulo independiente `js/shop-logic.js`. |
| **SPA Router** | Nuevo módulo `js/spa-router.js` gestiona navegación, scroll y sincronización de saldo. |
| **Saldo sincronizado** | `window.GameCenter.syncUI()` garantiza que Navbar y HUD muestren el mismo saldo al cambiar de vista. |
| **Animaciones GPU** | `will-change: transform, opacity` aplicado a `.shop-card` para compositing acelerado por GPU. |
| **Confetti optimizado** | `fireConfetti()` verifica `document.hidden` y la vista activa antes de disparar. Evita renders invisibles. |
| **Carga única del catálogo** | `fetch('data/shop.json')` se ejecuta una sola vez en `DOMContentLoaded`. El resultado se guarda en `allItems`. No hay refetch al cambiar de vista. |
| **`getState()`** | Nueva API pública en `GameCenter`. Devuelve lectura segura del store sin exponer la referencia interna. |
| **`syncUI()`** | Nueva API pública en `GameCenter`. Fuerza sincronización visual completa del saldo desde cualquier módulo. |
| **Limpieza del DOM** | Los toasts usan `.remove()` tras su animación. Los listeners de modales no se duplican (registrados solo en `DOMContentLoaded`). |

---

## 2d. Novedades en v9.1 — History API, Retry UI & Theme Fix

| Área | Cambio |
|---|---|
| **History API** | `spa-router.js` ahora llama a `history.pushState()` en cada transición de vista. El botón Atrás del navegador/móvil vuelve a la vista anterior sin recargar. |
| **Popstate handler** | `window.addEventListener('popstate')` restaura la vista desde `e.state.viewId` usando `_applyView()` (sin nuevo pushState, evitando bucle). |
| **Estado inicial** | `history.replaceState({ viewId:'home' })` al cargar garantiza que la primera entrada del historial sea válida. |
| **Retry UI** | `#shop-error-state` añadido en `index.html` dentro de `#tab-catalog`. Se muestra si `fetch('data/shop.json')` falla con mensaje de error y botón `#btn-retry-shop`. |
| **`loadCatalog()`** | Función encapsulada en `shop-logic.js`. Maneja loading, error, y reintento. El botón Reintentar la llama de nuevo. El listener del retry usa `dataset.bound` para no duplicarse. |
| **`applyTheme()` refactorizado** | Elimina todas las clases `theme-*` del `<body>` y añade la nueva (`theme-violet`, `theme-pink`, etc.). Esto garantiza que el cambio sea inmediato y visible en toda la SPA. |
| **`<body class="theme-violet">`** | El `<body>` arranca con la clase del tema por defecto para evitar un flash sin tema antes de que `app.js` cargue. |
| **Listener `.theme-btn` unificado** | Eliminado el registro duplicado en `app.js`. El único listener vive en `shop-logic.js` DOMContentLoaded. `setTheme()` de `app.js` sigue siendo la fuente de verdad para el store y la visual. |
| **`styles.css`** | Nuevas reglas `.shop-error-state`, `.shop-error-title` y `.shop-error-desc` para el estado de error de red. |

---

## 2e. Novedades en v9.2 — Font FOIT/FOUT, Coin Init & Treasury Grid

### Problema 1 — FOIT/FOUT: Salto de tipografía

| Archivo | Cambio |
|---|---|
| `index.html` | `<link rel="preconnect">` a `fonts.googleapis.com` y `fonts.gstatic.com` antes del stylesheet. Reduce el tiempo de handshake TCP/TLS para la descarga de fuentes. |
| `styles.css` | Dos bloques `@font-face` con `src: local('Arial')` y propiedades `size-adjust`, `ascent-override`, `descent-override` para Exo 2 y DM Sans. Cuando la web font aún no ha cargado, el navegador usa Arial escalada a las mismas métricas verticales, minimizando el reflow visible. |
| `styles.css` | `--font-display` y `--font-body` actualizados con stacks explícitos: `'Exo 2', Arial, system-ui, sans-serif`. |

El `&display=swap` del `@import` de Google Fonts ya estaba presente desde v9.0; esta entrega complementa el mecanismo con fallback de métricas ajustadas.

### Problema 2 — Brinco en contador de monedas (> 10k)

**Causa raíz:** `animateValue` con `start === end` escribía el valor crudo (`store.coins`) en todos los `.coin-display`, sobreescribiendo el texto formateado `"12.5k"` recién pintado.

**Flujo corregido en `app.js` DOMContentLoaded:**

```
1. applyTheme(store.theme)           // tema antes del primer paint
2. _displayedCoins = store.coins     // fijar base sin delta
3. navbar .coin-display → formatCoinsNavbar(store.coins)  // SÍNCRONO
4. otros .coin-display  → store.coins                     // SÍNCRONO
5. requestAnimationFrame → .coin-badge--visible           // fade-in 150ms
6. updateUI()                        // avatar, botón daily, luna…
```

`updateUI()` ahora detecta `_displayedCoins === store.coins` y escribe los valores formateados directamente sin pasar por `animateValue`, evitando el sobreescrito. La animación numérica solo ocurre cuando hay un delta real (ej. al ganar monedas jugando).

**CSS:**

```css
.coin-badge           { opacity: 0; transition: opacity 150ms ease; }
.coin-badge--visible  { opacity: 1; }
```

### Problema 3 — Desborde en "Mis Tesoros" (móvil < 380px)

**Causa:** `#library-container` heredaba `.shop-grid` con `grid-template-columns: repeat(2, 1fr)`. En pantallas muy estrechas, las tarjetas con padding se salían del viewport.

**Solución:** nueva clase `.treasury-grid` añadida junto a `.shop-grid` en `#library-container`:

```css
.treasury-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    justify-content: center;
}
@media (max-width: 320px) {
    .treasury-grid { grid-template-columns: 1fr; }
}
```

`box-sizing: border-box` ya era global desde el reset; no requirió cambios adicionales.

---

## 2f. Novedades en v9.3 — Zero-Flicker Initiative

Esta entrega elimina los tres tipos de parpadeo (FOUC / Hydration Gap) que afectaban a la experiencia de carga.

### Causa Raíz

La "inteligencia" de la página (JavaScript) se ejecutaba demasiado tarde. El navegador pintaba el HTML estático con el **tema violeta, 0 monedas y avatar vacío**, y solo cuando DOMContentLoaded se disparaba, JS corregía esos valores. El usuario percibía un parpadeo de colores, un salto de contador y un destello del avatar por defecto.

### Fix A — Theme Flash (salto de color al cargar)

**Archivo:** `index.html`

**Causa:** `<body class="theme-violet">` hardcodeado. El navegador pintaba la web en violeta y milisegundos después JS cambiaba la clase al tema real del usuario.

**Solución:** Script crítico inline en `<head>`, que se ejecuta síncronamente **antes del primer layout/paint**.

```html
<!-- En <head>, justo antes de Lucide -->
<script>
!function(){
  var KEY='gamecenter_v6_promos';
  var T={
    violet: ['#9b59ff','rgba(155,89,255,0.4)'],
    pink:   ['#ff59b4','rgba(255,89,180,0.4)'],
    // ...
  };
  try {
    var theme = JSON.parse(localStorage.getItem(KEY)||'{}').theme;
    if(!theme||!T[theme]||theme==='violet') return; // violeta ya es el default en :root
    var d=document.documentElement, accent=T[theme][0], glow=T[theme][1];
    d.style.setProperty('--accent', accent);
    // ... (6 custom properties)
    d.setAttribute('data-theme', theme);
  } catch(e) {}
}();
</script>
```

El tag `<body>` ya **no tiene clase hardcodeada**. `applyTheme()` en app.js sigue añadiendo `theme-{key}` al body síncronamente (defensa en profundidad).

### Fix B — Coin Jitter y State Sync Gap

**Archivo:** `app.js`

**Causa:** El bloque `DOMContentLoaded` esperaba a que *todo* el documento terminara de cargar para ejecutar `applyTheme()`, `updateDailyButton()`, etc. En ese intervalo el usuario veía los valores por defecto del HTML.

**Solución:** Mover TODO el trabajo visual fuera de `DOMContentLoaded` a ejecución **síncrona** al final del `<body>`. Como `app.js` está posicionado al final de body, el DOM ya existe, pero el navegador NO ha pintado todavía (las scripts síncronas bloquean el render).

```
Antes (v9.2):          DOMContentLoaded → applyTheme → init saldo → revealUI
Ahora (v9.3):          Script síncrono → applyTheme → init saldo → revealUI
                        DOMContentLoaded → solo registra event listeners
```

| Función movida a sync | Efecto |
|---|---|
| `applyTheme()` | Tema correcto antes del primer pixel (defensa en profundidad del Fix A) |
| Init de `.coin-display` | Nunca muestra "0" |
| `updateDailyButton()` | Botón diario en estado correcto desde el primer frame |
| `updateMoonBlessingUI()` | Badge lunar correcto desde el primer frame |
| `applyAvatar()` | Avatar real antes del primer paint |
| `revealUI()` | Fade-in de `.coin-badge` y `.hud-avatar-wrap` |

### Fix C — Avatar Wrap Flash

**Archivo:** `styles.css`

**Causa:** `.hud-avatar-wrap` era visible inmediatamente con el avatar por defecto (`assets/default_avatar.png`) antes de que JS aplicara la imagen guardada.

**Solución:**

```css
.hud-avatar-wrap {
    opacity: 0;
    transition: opacity 100ms ease;
}
.hud-avatar-wrap.is-ready {
    opacity: 1;
}
```

`revealUI()` en app.js añade `.is-ready` al hud-avatar-wrap en el siguiente `requestAnimationFrame`, garantizando que el avatar real (o el placeholder si no hay guardado) ya esté cargado antes de revelarse.

### Resumen de archivos modificados

| Archivo | Cambio |
|---|---|
| `index.html` | Script crítico inline en `<head>` + eliminar `class="theme-violet"` del `<body>` |
| `app.js` | INIT síncrono fuera de DOMContentLoaded + nueva función `revealUI()` |
| `styles.css` | `.hud-avatar-wrap { opacity: 0 }` + `.hud-avatar-wrap.is-ready { opacity: 1 }` |

---

## 2g. Novedades en v9.4 — Identity Update

### Visión General

Permite al usuario elegir un **nickname** (máx. 15 chars) y su **género de saludo** (`o` / `a` / `@`) en su primer acceso, con persistencia en `localStorage`. La implementación es compatible con la Zero-Flicker Initiative: el HUD permanece invisible hasta que el estado de identidad está completamente escrito en el DOM.

---

### Esquema de Datos (store)

Dos campos nuevos añadidos a `migrateState()` en `app.js`:

```javascript
nickname: '',    // string, max 15 chars. Vacío = primer acceso.
gender:   '@'    // 'o' | 'a' | '@' — controla el sufijo del saludo.
```

La migración silenciosa valida ambos en stores existentes:

```javascript
if (typeof merged.nickname !== 'string')       merged.nickname = '';
if (!['o','a','@'].includes(merged.gender))    merged.gender   = '@';
```

---

### API Pública (`window.GameCenter`)

| Método | Descripción |
|---|---|
| `setIdentity(nickname, gender)` | Valida, guarda y aplica la identidad. Recorta el nickname a 15 chars. |
| `getIdentity()` | Devuelve `{ nickname, gender }` sin referencia al store. |
| `hasIdentity()` | `true` si `nickname.trim()` no está vacío. |

---

### Función interna `applyIdentity()`

Escribe el nickname y sufijo de género en el DOM **síncronamente** antes de `revealUI()`:

```javascript
function applyIdentity() {
    document.getElementById('pref-suffix').textContent   = store.gender   || '@';
    document.getElementById('display-nickname').textContent = store.nickname || '';
}
```

Se llama en el bloque INIT síncrono de `app.js`, justo después de `applyAvatar()`.

---

### HUD Dinámico (`index.html`)

El saludo estático "Bienvenido de vuelta / Lilith" se reemplaza:

```html
<p class="hud-greeting">
    Bienvenid<span id="pref-suffix">@</span> de vuelta
</p>
<p class="hud-name" id="display-nickname"></p>
```

El `<span id="pref-suffix">` hereda los estilos de `.hud-greeting`. El `<p id="display-nickname">` usa `.hud-name` con `min-height: 1.3em` para evitar colapso de layout durante el init.

---

### Flujo Zero-Flicker (pipeline de ejecución)

```
app.js (síncrono):
  applyTheme()  →  init saldo  →  updateDailyButton()  →  applyAvatar()  →  applyIdentity()
                                                                                    │
                                                              nickname en store?
                                                             ┌──────┴──────┐
                                                            SÍ            NO
                                                             │              │
inline script (síncrono):                                    │              │
  updateStreakBar()  →  updateCountdownDisplay()              │              │
                                                             │              │
  GameCenter.hasIdentity()?                                  │              │
    └─ true  → revealUI()  ◄────────────────────────────────┘              │
    └─ false → mostrar Identity Modal ◄────────────────────────────────────┘
                    │
                    │ (usuario confirma)
                    ▼
              setIdentity() → applyIdentity() → modal.hidden → revealUI()
```

El `.player-hud` permanece en `opacity: 0` en **ambos caminos** hasta el `revealUI()` final.

---

### Identity Modal

- **Activación:** aparece síncronamente si `hasIdentity()` es `false`. No usa `DOMContentLoaded`.
- **Overlay especial:** `.identity-modal-overlay` con `backdrop-filter: blur(12px) brightness(0.45)` y `z-index: 10500`.
- **Chips de género:** grid de 3 botones con animación `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Input:** `font-family: var(--font-display)`, contador de chars en tiempo real, validación con mensaje inline.
- **Teclado móvil:** `max-height: 90dvh` + `overflow-y: auto` en `.identity-modal-box`. Al hacer focus en el input, el botón "Empezar" hace `scrollIntoView` para quedar visible por encima del teclado.
- **Confirmación:** click en botón o tecla `Enter`. Valida que el nickname no esté vacío antes de guardar.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `app.js` | `migrateState`: +`nickname`, +`gender`. `GameCenter`: +`setIdentity`, +`getIdentity`, +`hasIdentity`. Nueva función `applyIdentity()`. INIT síncrono: llama a `applyIdentity()`. |
| `index.html` | HUD: `hud-greeting` con `<span id="pref-suffix">`, `hud-name` con `id="display-nickname"`. Identity Modal completo. Inline script: lógica condicional `hasIdentity → revealUI / modal`. |
| `styles.css` | `.identity-modal-overlay`, `.identity-modal-box`, `.identity-chips`, `.identity-chip`, `.identity-chip--active`, `.identity-input`, `.identity-char-count`, `.identity-input-error`, `.identity-confirm-btn`. `.hud-name`: +`min-height`. |

---

## 2h. Novedades en v10.0 — Arcade Solid 3.0

### Visión General

Rediseño completo del sistema visual de `styles.css`. Se abandona el Glassmorphism genérico (costoso en GPU) en favor de un diseño **Sólido Premium**: superficies oscuras definidas, bordes de acento hard-edge y efectos de movimiento basados en animaciones de capa (no en desenfoque). El resultado es una interfaz que carga más rápido en gama media-baja y transmite robustez táctica.

**Ratio de diseño: 90% Sólido / 10% Glass.**

---

### Cambios en `styles.css`

#### A. Sistema de Tokens — Nuevas Variables de Superficie Sólida

Se eliminan los tokens `--glass-*` como valores transparentes y se redefinen como alias a superficies sólidas. Se añaden tokens `--solid-surface-*` y `--border-*` para el nuevo sistema de jerarquía visual.

```css
/* ANTES — transparencias con blur */
--glass-base-bg:  rgba(255,255,255,0.035);
--glass-float-bg: rgba(255,255,255,0.06);

/* AHORA — superficies sólidas oscuras */
--solid-surface-base:  #0f1018;
--solid-surface-float: #141620;
--solid-surface-hi:    #1a1d2e;
--solid-surface-deep:  #0a0b12;

/* Hard-edge borders (jerarquía por color, no por blur) */
--border-subtle:  rgba(255,255,255,0.06);
--border-mid:     rgba(255,255,255,0.10);
--border-bright:  rgba(255,255,255,0.18);
```

Los tokens `--glass-*` se mantienen en el CSS como alias de compatibilidad para no romper lógica JavaScript que pueda leer CSS custom properties.

---

#### B. Eliminación Masiva de `backdrop-filter`

Todos los `backdrop-filter: blur()` han sido eliminados de los elementos de panel. La jerarquía visual se expresa ahora mediante bordes de acento y sombras cortas sólidas.

| Elemento | Antes | Después |
|---|---|---|
| `.glass-panel` | `backdrop-filter: blur(14px)` | ❌ Eliminado — bg `#0f1018` sólido |
| `.glass-float` | `backdrop-filter: blur(20px)` | ❌ Eliminado — bg `#141620` sólido |
| `.glass-highlight` | `backdrop-filter: blur(24px)` | ❌ Eliminado — bg `#1a1d2e` sólido |
| `.navbar` | `backdrop-filter: blur(24px)` | ❌ Eliminado — bg `#0d0e15` sólido |
| `.bottom-nav` | `backdrop-filter: blur(20px)` | ❌ Eliminado — bg `#050508` sólido |
| `.card-badge` | `backdrop-filter: blur(8px)` | ❌ Eliminado — bg sólido |
| `.card-reward` | `backdrop-filter: blur(8px)` | ❌ Eliminado — bg sólido |
| `.wishlist-btn` | `backdrop-filter: blur(8px)` | ❌ Eliminado — bg `rgba(0,0,0,0.9)` |
| `.owned-badge` | `backdrop-filter: blur(6px)` | ❌ Eliminado — bg `rgba(34,208,122,0.2)` |

**El 10% Glass permitido (excepciones):**

| Elemento | Blur permitido | Justificación |
|---|---|---|
| `.toast` | `blur(12px)` | Legibilidad sobre cualquier fondo |
| `.modal-overlay` | `blur(4px)` | Modal crítico, blur reducido de 8px → 4px |
| `.identity-modal-overlay` | `blur(4px) brightness(0.4)` | Primera pantalla, reducido de 12px → 4px |
| `.coin-badge` | Sin blur, `rgba` translúcida | Efecto cristal sobre metal sólido en navbar |

---

#### C. Avatar Power Ring — Conic-Gradient Animado

El anillo del HUD se reconstruye con `conic-gradient` para crear un núcleo de energía visual. Se implementa aceleración en hover.

```css
/* ANTES — gradient en border-box con mask trick */
background: linear-gradient(135deg, var(--accent), transparent) border-box;
animation: ringRotate 4s linear infinite;

/* AHORA — conic-gradient con mask radial (Power Ring) */
background: conic-gradient(
    from 0deg,
    var(--accent) 0%, var(--accent-dim) 30%, transparent 50%,
    transparent 70%, var(--accent-dim) 85%, var(--accent) 100%
);
-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #fff calc(100% - 3px));
animation: powerRingRotate 3s linear infinite;
will-change: transform;  /* GPU compositor layer */
```

En hover o focus-within, la animación se acelera de 3s → 1s y aumenta la opacidad + `filter: drop-shadow`.

---

#### D. Banner de Oferta — Efecto Laser Scan

Se elimina el shimmer estático `ticketSweep` y se implementa un **escaneo láser**: una línea oblicua de luz que recorre el banner de izquierda a derecha cada 3.5 segundos. El banner tiene ahora una textura de puntos como fondo.

```css
/* ANTES — sweep horizontal de 60% de ancho, movimiento lineal */
@keyframes ticketSweep { to { left: 200%; } }

/* AHORA — línea fina oblicua (105°), GPU-only con translate3d */
.sale-banner__ticket::after {
    width: 15%;   /* línea estrecha, aspecto de láser */
    background: linear-gradient(105deg, transparent, rgba(251,191,36,0.35), transparent);
    animation: laserScan 3.5s ease-in-out infinite;
    will-change: transform;
}
@keyframes laserScan {
    0%   { transform: translate3d(0, 0, 0);    opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translate3d(800%, 0, 0); opacity: 0; }
}
```

La textura de fondo del ticket cambia del patrón diagonal a **puntos radiales** para un aspecto más "ticket electrónico":

```css
.sale-banner__ticket::before {
    background-image: radial-gradient(circle, rgba(251,191,36,0.08) 1px, transparent 1px);
    background-size: 14px 14px;
}
```

---

#### E. Game Cards y Shop Cards — Hover por Glow de Borde

Las tarjetas de juego y tienda abandonan el fondo variable en hover. En su lugar, el borde se ilumina intensamente con el color de acento.

```css
/* ANTES — hover aclara el fondo (overdraw) */
.shop-card:hover { background: var(--glass-float-bg); }

/* AHORA — hover ilumina el borde (solo compositor GPU) */
.shop-card:hover {
    border-color: var(--accent-border);
    box-shadow: 0 0 15px var(--accent-glow), 0 8px 24px rgba(0,0,0,0.4);
}
.game-card:hover {
    box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 15px var(--accent-glow);
    border-color: var(--accent-border);
}
```

---

#### F. Player HUD — Detalles Tech de Esquina

El HUD reemplaza el ambient glow (gradiente radial costoso) por líneas de acento en la esquina superior izquierda usando `::before` y `::after` — señales de panel ensamblado.

```css
/* Línea horizontal de acento */
.player-hud::before { width: 48px; height: 2px; background: linear-gradient(90deg, var(--accent), transparent); }
/* Línea vertical de acento */
.player-hud::after  { width: 2px; height: 48px; background: linear-gradient(180deg, var(--accent), transparent); }
```

El mismo patrón de corner accent se aplica a `.glass-panel` (paneles del ajustes, sync, etc.).

---

#### G. Navbar y Bottom Nav — Superficies Tácticas

| Elemento | Color | Box-Shadow |
|---|---|---|
| `.navbar` | `#0d0e15` | `0 4px 24px rgba(0,0,0,0.6)` |
| `.bottom-nav` | `#050508` | `0 -4px 20px rgba(0,0,0,0.7)` |

Ambos mantienen el borde de 1px con `--border-subtle`. Los pseudo-elementos `::before` de degradado de acento se conservan para el indicador de sección activa.

---

### Resumen de archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | Rediseño completo — v2.0 → v3.0 "Arcade Solid". 15+ instancias de `backdrop-filter` eliminadas. Nuevos tokens `--solid-surface-*` y `--border-*`. Power Ring, Laser Scan, border-glow hover. |
| `DOCUMENTACION.md` | Sección 2h añadida. Título actualizado a v10.0. |

---



```
┌─────────────────────────────────────────────────────────────────────┐
│                              NAVEGADOR                               │
│                                                                      │
│   index.html  (SPA única)                                            │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  <nav class="navbar">        ← Global, siempre visible      │   │
│   │  <nav class="bottom-nav">    ← Global, siempre visible      │   │
│   │                                                             │   │
│   │  <main class="container">                                   │   │
│   │    <div id="view-home">   ← HUD, juegos, FAQ                │   │
│   │    <div id="view-shop" class="hidden">  ← Tienda            │   │
│   │  </main>                                                    │   │
│   │                                                             │   │
│   │  <!-- Modales — fuera de main, position:fixed seguro -->    │   │
│   │  <div id="preview-modal">                                   │   │
│   │  <div id="confirm-modal">                                   │   │
│   │  <div id="email-modal">                                     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   JS Load Order:                                                     │
│   1. js/app.js          → GameCenter API, store, updateUI            │
│   2. js/shop-logic.js   → Catálogo, compras, sync, ajustes          │
│   3. js/spa-router.js   → Navegación SPA sin recargas                │
│   4. Inline script      → lucide.createIcons(), HomeView lógica      │
│                                                                      │
│   Persistencia:   localStorage "gamecenter_v6_promos"                │
│   Web Worker:     js/sync-worker.js  (SHA-256 + Base64)              │
│   Catálogo:       data/shop.json  (cargado una sola vez)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2i. Novedades en v10.1 — Limpieza Visual & Transiciones Anti-Golpe

### Resumen

| Área | Cambio |
|---|---|
| **CSS — Corner accents** | Eliminados los pseudo-elementos de "corchete" en `.glass-panel` y `.player-hud`. |
| **CSS — `.view-section`** | Nueva clase con transición GPU de entrada (opacity + translateY, 250ms). |
| **spa-router.js** | Scroll reset reordenado: ahora ocurre **antes** de quitar `.hidden` en la vista entrante. |

---

### 1. Eliminación de Corner Accents

Los pseudo-elementos `::before` / `::after` añadidos en v10.0 sobre `.glass-panel` y `.player-hud` generaban líneas de acento en la esquina superior izquierda. En pantallas móviles a alta densidad de píxeles estas líneas de 2px se percibían como artefactos o errores de renderizado, rompiendo la limpieza de los paneles sólidos.

**Acción:** eliminados completamente de `.glass-panel::after`, `.player-hud::before` y `.player-hud::after`. La jerarquía visual se mantiene únicamente a través del color de fondo sólido y el borde de 1px.

```css
/* ELIMINADO — ya no existe en styles.css */
.glass-panel::after  { content: ''; width: 24px; height: 2px; ... }
.player-hud::before  { content: ''; width: 48px; height: 2px; ... }
.player-hud::after   { content: ''; width: 2px;  height: 48px; ... }
```

---

### 2. Sistema de Transiciones de Vista — `.view-section`

#### Problema

Al alternar entre Inicio y Tienda, el contenido aparecía instantáneamente (un "golpe" visual), haciendo que la app se sintiera como una página web recargando en lugar de una interfaz reactiva.

#### Solución

Nueva clase `.view-section` en `styles.css`. Debe aplicarse en el HTML a los contenedores `#view-home` y `#view-shop`:

```html
<div id="view-home"  class="view-section">...</div>
<div id="view-shop"  class="view-section hidden">...</div>
```

```css
.view-section {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.25s ease-out, transform 0.25s ease-out;
    will-change: opacity, transform;
    contain: paint;
}
.view-section:not(.hidden) {
    opacity: 1;
    transform: translateY(0);
}
```

#### Decisiones técnicas

| Decisión | Justificación |
|---|---|
| `opacity` + `transform` únicamente | Propiedades compositor-only. Cero layout, cero paint. |
| `translateY(10px)` → `translateY(0)` | Solo 10px: entrada suave sin parecer slide agresivo. |
| `ease-out` | Respuesta perceptualmente inmediata; la animación desacelera al llegar. |
| `0.25s` (250ms) | Regla de los 300ms: por encima el usuario percibe lentitud. |
| `will-change: opacity, transform` | Promueve el nodo a capa GPU antes del primer frame. |
| `contain: paint` | Limita repaints al área del nodo; el documento padre no se ve afectado. |

#### Reglas de oro — GPU-First

```css
/* ❌ PROHIBIDO — provoca reflow */
transition: height 0.3s;
transition: margin 0.3s;
transition: width 0.3s;

/* ✅ PERMITIDO — solo compositor GPU */
transition: opacity 0.25s ease-out, transform 0.25s ease-out;
```

---

### 3. Reordenación del Scroll Reset en spa-router.js

#### Problema

El scroll reset se ejecutaba **después** de quitar `.hidden`. La vista nueva aparecía durante un frame con su scroll anterior antes de saltar al inicio, compitiendo visualmente con la animación de entrada.

#### Solución (v9.2)

`_applyView()` ejecuta el scroll reset **antes** de modificar `.hidden`:

```javascript
function _applyView(viewId, anchor) {
    // 1. Scroll reset instantáneo ANTES de mostrar la vista
    if (!anchor) window.scrollTo({ top: 0, behavior: 'instant' });

    // 2. Toggle .hidden → dispara la transición CSS de entrada
    VIEWS.forEach(id => viewEls[id].classList.toggle('hidden', id !== viewId));

    // 3. Sincronizar saldo, iconos, callbacks...
}
```

Cuando la transición `opacity 0→1` empieza, el scroll ya está en `top: 0`.

---

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `styles.css` | v3.0 → v3.1. Corner accents eliminados. `.view-section` añadido. |
| `spa-router.js` | v9.1 → v9.2. Scroll reset reordenado. JSDoc actualizado. |
| `DOCUMENTACION.md` | Sección 2i añadida. |

> **Nota HTML:** añadir clase `view-section` a `#view-home` y `#view-shop` en `index.html` para activar las transiciones. Sin esta clase, las vistas siguen funcionando correctamente pero sin animación de entrada.

---

## 2j. Novedades en v10.2 — Preview 2.0 Sistema de Mockup Dinámico

> **v10.2.3 — Performance & Security hardening:**
> Carga progresiva con doble capa, flush de memoria GPU, will-change dinámico,
> bloqueo anti-extracción reforzado, y restricción 90/10 backdrop-filter en mobile.

### Resumen

| Área | Cambio |
|---|---|
| **shop-logic.js** | `openPreviewModal()` reemplazado con sistema de mockup dinámico. Nuevas funciones: `_buildMockupHTML()`, `updateMockupTime()`, `closePreviewModal()`. Expuestas en `window`. |
| **index.html** | `#preview-img-wrap` sustituido por `#preview-mockup-stage` + `#mockup-slot`. El `<img>` fue eliminado; el arte vive ahora como CSS `background-image`. |
| **styles.css** | +130 líneas. Nuevas clases: `.mockup-container`, `.mockup-mobile`, `.mockup-pc`, `.mockup-layer-*`, `.mockup-statusbar`, `.mockup-app-grid`, `.mockup-taskbar` y variantes. |

---

### 1. Arquitectura del Mockup ("Sándwich de Capas")

Dentro de `#mockup-slot`, JS inyecta un `div.mockup-container` con tres capas superpuestas via `position: absolute; inset: 0`:

```
┌─────────────────────────────────────┐  ← mockup-container (border-radius, overflow:hidden)
│  Layer 3 — UI          z-index: 3   │  Status bar / taskbar / reloj / grid de iconos
│  Layer 2 — Protección  z-index: 2   │  pointer-events:none · noise SVG overlay
│  Layer 1 — Arte        z-index: 1   │  background-image (CSS, no <img>)
└─────────────────────────────────────┘
```

**¿Por qué `background-image` y no `<img>`?**
El menú contextual del navegador "Guardar imagen como…" solo aparece sobre elementos `<img>` y `<video>`. Al usar `background-image` en un div, ese menú no ofrece la opción de guardar — primera línea de defensa anti-piratería.

---

### 2. Detección de Frame (Tags → Ratio)

La función `_buildMockupHTML(item)` lee `item.tags[]` del catálogo:

| Tag en `shop.json` | Clase aplicada | Ratio | Descripción |
|---|---|---|---|
| `"Mobile"` | `.mockup-mobile` | 9:20 | Frame teléfono, max-height 58vh, border-radius 24px |
| `"PC"` | `.mockup-pc` | 16:9 | Frame escritorio, ancho 100% |
| (ninguno) | `.mockup-fallback` | 4:3 | Neutral con watermark del logo |

---

### 3. UI Elements — Mobile

El frame Mobile incluye tres componentes UI sobre el wallpaper:

**Status Bar**
- Izquierda: reloj en tiempo real (`.mockup-clock-text`)
- Derecha: iconos SVG inline de señal, Wi-Fi y batería
- `mix-blend-mode: difference` adapta el color del texto al brillo del fondo

**App Grid**
- Cuadrícula 4×4 de 16 placeholders (`.mockup-app-icon`)
- Por defecto: `rgba(12,12,24,0.82)` sólido — sin coste GPU en gama baja
- Con soporte `backdrop-filter`: glassmorphism blur(4px) activado vía `@supports`

**Home Indicator**
- Barra de 28% del ancho centrada en el borde inferior
- `mix-blend-mode: difference` para contraste automático

---

### 4. UI Elements — PC

El frame PC incluye una **barra de tareas** en el borde inferior:

- Izquierda: botón de inicio + 5 app slots genéricos
- Derecha: iconos Wi-Fi + batería + reloj (`.mockup-pc-clock`)
- Fondo: `rgba(8,8,18,0.78)` sólido o glassmorphism con `@supports`

---

### 5. Reloj en Tiempo Real

```javascript
// shop-logic.js
let _mockupClockInterval = null;

function updateMockupTime() {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock')
        .forEach(el => el.textContent = t);
}

// En openPreviewModal():
updateMockupTime();                              // Inmediato al abrir
_mockupClockInterval = setInterval(updateMockupTime, 30_000); // Cada 30 s
```

El intervalo se destruye explícitamente en `closePreviewModal()` para evitar memory leaks.

---

### 6. Anti-Piratería (Hardening)

| Técnica | Implementación |
|---|---|
| Bloqueo "Guardar imagen" | Arte como `background-image` en div, no `<img>` |
| Bloqueo menú contextual | `contextmenu` → `preventDefault()` en `#preview-mockup-stage` |
| Overlay de cobertura | `.mockup-layer-ui` cubre el 100% del arte con SVG de interfaz |
| Noise overlay | `.mockup-layer-protection` con ruido SVG data-URI (sin HTTP) |
| `user-select: none` | En todas las capas de UI y protección |

---

### 7. Optimización para Gama Baja

| Técnica | Implementación |
|---|---|
| GPU rendering | `transform: translateZ(0)` en `.mockup-container` |
| Containment | `contain: paint` en `.mockup-container` |
| Container queries | `container-type: inline-size` en `#mockup-slot` para escalar iconos de forma fluida |
| SVG inline | Todos los iconos del mockup son SVG inline; cero peticiones HTTP extra |
| Glassmorphism condicional | Default = sólido. `@supports (backdrop-filter)` opt-in solo si el hardware lo soporta |

**Regla de gama baja para el app grid:**
```css
/* ✅ CORRECTO — sólido por defecto, glassmorphism como opt-in */
.mockup-app-icon {
    background: rgba(12, 12, 24, 0.82); /* sin coste GPU */
}
@supports (backdrop-filter: blur(4px)) {
    .mockup-app-icon { backdrop-filter: blur(4px); } /* solo en hardware capaz */
}

/* ❌ INCORRECTO — backdrop-filter como valor por defecto degrada gama baja */
.mockup-app-icon { backdrop-filter: blur(4px); }
```

---

### 8. API Pública — Funciones en `window`

A partir de v10.2.1, las funciones del preview están expuestas globalmente:

```javascript
window.openPreviewModal(itemOrId)  // Acepta objeto item O número de ID
window.closePreviewModal()         // Sin parámetros — resuelve refs internamente
```

Esto permite llamarlas desde:
- Event listeners en HTML dinámico: `onclick="openPreviewModal(5)"`
- Módulos de juego integrados
- La consola del navegador durante desarrollo

```javascript
// ✅ Ambas formas son válidas:
openPreviewModal(item);           // objeto completo (renderShop)
openPreviewModal(5);              // ID numérico (onclick dinámico)
openPreviewModal('5');            // ID como string (atributo HTML)
```

---

### 9. Nuevas Funciones en `shop-logic.js`

| Función | Visibilidad | Responsabilidad |
|---|---|---|
| `_buildMockupHTML(item)` | Privada | Genera el HTML del mockup según los tags del item. Retorna string. |
| `updateMockupTime()` | Privada | Actualiza el reloj en todos los elementos de clock activos. |
| `closePreviewModal([modal], [stage])` | **Pública (`window`)** | Cierra el modal, cancela el intervalo, elimina listener contextmenu. Sin args = auto-resolve. |
| `openPreviewModal(itemOrId)` | **Pública (`window`)** | Acepta objeto O ID. Null-guard. Orquesta mockup, reloj y acciones. |
| `MOCKUP_SVG` | Privada (constante) | Paths SVG inline: signal, wifi, battery, arcadeLogo. |

---

### Correcciones y mejoras v10.2.3

#### A. Carga Progresiva — Doble Capa "Thumbnail de Sacrificio"

Elimina el "pop-in" blanco en conexiones lentas. El sistema usa dos fases sin bloquear el hilo principal:

```
Fase 1 (inmediata, 0ms):   thumbnail en caché → blurred placeholder
Fase 2 (async, cuando carga): wallpaper HiRes → swap con 400ms ease
```

```javascript
// Fase 1 — placeholder visible al instante
artEl.style.backgroundImage = `url('${item.image}')`;  // thumb ya en caché
artEl.classList.add('mockup-bg-loading');               // blur(10px) + scale(1.1)

// Fase 2 — HiRes en background
const hiRes = new Image();
hiRes.onload = () => {
    artEl.style.backgroundImage = `url('${wallpaperPath}')`;
    artEl.classList.remove('mockup-bg-loading');
    artEl.classList.add('mockup-bg-ready');             // blur(0) + scale(1)
};
hiRes.src = wallpaperPath;
```

**Stale-load guard:** `_pendingHiResImg` almacena la referencia del `Image()` activo. Si el usuario cierra y reabre el modal antes de que cargue, el `onload` del objeto anterior comprueba `_pendingHiResImg !== hiRes` y se descarta sin ejecutar.

| CSS class | filter | transform | Cuándo |
|---|---|---|---|
| `.mockup-bg-loading` | `blur(10px)` | `scale(1.1)` | Thumbnail mostrado |
| `.mockup-bg-ready` | `blur(0)` | `scale(1)` | HiRes listo |
| (sin clase) | — | — | Estado inicial / tras close |

---

#### B. Gestión de Memoria GPU (Memory Flush)

`closePreviewModal()` realiza limpieza activa en este orden:

1. **Cancela el `Image()` en vuelo** — anula `onload`/`onerror`, evita callbacks huérfanos
2. **Flush GPU** — `artEl.style.backgroundImage = 'none'` libera el buffer de textura
3. **Limpia clases de estado** — `classList.remove('mockup-bg-loading', 'mockup-bg-ready')`
4. **Elimina `will-change`** — `modal.style.willChange = 'auto'` descarta la capa GPU del compositor
5. **Oculta el modal** — `classList.add('hidden')`
6. **Elimina contextmenu listeners** — stage + slot

```javascript
// Patrón correcto en closePreviewModal():
artEl.style.backgroundImage = 'none';   // ← libera textura GPU inmediatamente
modal.style.willChange = 'auto';        // ← descarta capa compositor
```

---

#### C. `will-change` Dinámico (Solo Durante Uso)

`will-change` en CSS global desperdicia memoria GPU en capas que nunca se animan. El sistema lo gestiona únicamente durante la vida del modal:

```javascript
// openPreviewModal():
modal.style.willChange = 'opacity, transform';  // Promueve capa al abrir

// closePreviewModal():
modal.style.willChange = 'auto';                // La descarta al cerrar
```

`.mockup-container` usa `translate3d(0,0,0)` (sin `will-change`) para forzar la creación de capa GPU sólo en ese elemento, sin el coste de memoria de `will-change`.

---

#### D. Anti-Extracción Reforzado

| Capa | Mecanismo |
|---|---|
| CSS `background-image` | El arte nunca es un `<img>` — no hay "Guardar imagen como…" |
| `.mockup-layer-protection` | Overlay con ruido SVG `feTurbulence`, `pointer-events: none` |
| `.mockup-layer-art::after` | Segunda capa de ruido a 3% opacidad directamente sobre el arte |
| `stage.addEventListener('contextmenu')` | Bloquea el menú en toda la zona del mockup |
| `slot.oncontextmenu = (e) => { e.preventDefault(); return false; }` | Bloqueo adicional directo sobre el slot |

---

#### E. Regla 90/10 — `backdrop-filter` Restringido en Mobile

`backdrop-filter: blur()` consume GPU de forma intensiva. En hardware móvil (touch) causa caídas de fps:

```css
/* Detección: pointer: coarse = dispositivo táctil (móvil/tablet) */
@media (pointer: coarse) {
    .mockup-app-icon { backdrop-filter: none !important; }
    .mockup-taskbar  { backdrop-filter: none !important;
                       background: rgba(8,8,18,0.92) !important; }
}
```

`pointer: coarse` es más fiable que `max-width` para detectar hardware táctil — un iPad en horizontal tiene 1024px pero sigue siendo gama media. La mayor opacidad del taskbar compensa visualmente la ausencia de blur.

---

### Archivos modificados

| Archivo | Versión | Cambio |
|---|---|---|
| `shop-logic.js` | v9.1 → v10.2.3 | Carga progresiva, memory flush, will-change dinámico, contextmenu reforzado. |
| `index.html` | — | Preview modal con `#preview-mockup-stage` + `#mockup-slot`. |
| `styles.css` | v3.1 → v3.2.3 | `.mockup-bg-loading/ready`, `::after` noise en art layer, `backface-visibility` en overlay, `@media (pointer: coarse)`. |
| `DOCUMENTACION.md` | — | Sección 2j v10.2.3. |

Dentro de `#mockup-slot`, JS inyecta un `div.mockup-container` con tres capas superpuestas via `position: absolute; inset: 0`:

```
┌─────────────────────────────────────┐  ← mockup-container (border-radius, overflow:hidden)
│  Layer 3 — UI          z-index: 3   │  Status bar / taskbar / reloj / grid de iconos
│  Layer 2 — Protección  z-index: 2   │  pointer-events:none · noise SVG overlay
│  Layer 1 — Arte        z-index: 1   │  background-image (CSS, no <img>)
└─────────────────────────────────────┘
```

**¿Por qué `background-image` y no `<img>`?**
El menú contextual del navegador "Guardar imagen como…" solo aparece sobre elementos `<img>` y `<video>`. Al usar `background-image` en un div, ese menú no ofrece la opción de guardar — primera línea de defensa anti-piratería.

---

### 2. Detección de Frame (Tags → Ratio)

La función `_buildMockupHTML(item)` lee `item.tags[]` del catálogo:

| Tag en `shop.json` | Clase aplicada | Ratio | Descripción |
|---|---|---|---|
| `"Mobile"` | `.mockup-mobile` | 9:20 | Frame teléfono, max-height 58vh, border-radius 24px |
| `"PC"` | `.mockup-pc` | 16:9 | Frame escritorio, ancho 100% |
| (ninguno) | `.mockup-fallback` | 4:3 | Neutral con watermark del logo |

---

### 3. UI Elements — Mobile

El frame Mobile incluye tres componentes UI sobre el wallpaper:

**Status Bar**
- Izquierda: reloj en tiempo real (`.mockup-clock-text`)
- Derecha: iconos SVG inline de señal, Wi-Fi y batería
- `mix-blend-mode: difference` adapta el color del texto al brillo del fondo

**App Grid**
- Cuadrícula 4×4 de 16 placeholders (`.mockup-app-icon`)
- 90% sólido (`rgba(12,12,24,0.82)`) con borde sutil
- Con soporte `backdrop-filter`: glassmorphism blur(4px) activado vía `@supports`

**Home Indicator**
- Barra de 28% del ancho centrada en el borde inferior
- `mix-blend-mode: difference` para contraste automático

---

### 4. UI Elements — PC

El frame PC incluye una **barra de tareas** en el borde inferior:

- Izquierda: botón de inicio + 5 app slots genéricos
- Derecha: iconos Wi-Fi + batería + reloj (`.mockup-pc-clock`)
- Fondo: `rgba(8,8,18,0.78)` sólido o glassmorphism con `@supports`

---

### 5. Reloj en Tiempo Real

```javascript
// shop-logic.js
let _mockupClockInterval = null;

function updateMockupTime() {
    const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('.mockup-clock-text, .mockup-pc-clock')
        .forEach(el => el.textContent = t);
}

// En openPreviewModal():
updateMockupTime();                              // Inmediato al abrir
_mockupClockInterval = setInterval(updateMockupTime, 30_000); // Cada 30 s
```

El intervalo se destruye explícitamente en `_closePreviewModal()` para evitar memory leaks.

---

## 4. Estructura de Archivos

```
love_arcade/
│
├── index.html              # SPA unificada (Inicio + Tienda en un solo archivo)
│                           # shop.html ELIMINADO en v9.0
├── styles.css              # Hoja de estilos global — Arcade Solid 3.1 (v10.1)
│
├── js/
│   ├── app.js              # Motor principal — GameCenter API v9.0
│   │                       #   + getState(), syncUI() (nuevos en v9.0)
│   ├── shop-logic.js       # Módulo de Tienda — extraído de shop.html (nuevo en v9.0)
│   ├── spa-router.js       # Router SPA — v9.2, scroll-before-transition (v10.1)
│   └── sync-worker.js      # Web Worker — Base64 + checksum SHA-256 (sin cambios)
│
├── data/
│   └── shop.json           # Catálogo de wallpapers (sin cambios)
│
├── wallpapers/             # Archivos descargables
├── assets/
│   ├── default_avatar.png
│   ├── product-thumbs/
│   └── cover/
│
└── games/
    ├── Shooter/
    ├── SopaDeLetras/
    ├── pixel_drop.html
    ├── maze.html
    ├── rompecabezas/
    ├── Dodger/
    └── jungle-dash/
```

---

## 5. app.js — El Motor

### Cambios en v9.1 (Theme Fix)

#### `applyTheme()` — refactorizado

El problema: `applyTheme` solo aplicaba CSS custom properties en `:root` y el atributo `data-theme` en `<html>`, pero no escribía ninguna clase en `<body>`. Si el CSS usaba selectores del tipo `body.theme-crimson .selector {}`, el cambio no era visible.

**Solución:** `applyTheme` ahora hace tres cosas en orden:

```javascript
function applyTheme(key) {
    // 1. Actualizar CSS custom properties (retrocompatibilidad con juegos)
    root.style.setProperty('--accent', t.accent);
    // ...

    // 2. Limpiar clases de tema previas y añadir la nueva en <body>
    Object.keys(THEMES).forEach(k => document.body.classList.remove(`theme-${k}`));
    document.body.classList.add(`theme-${key}`);

    // 3. data-theme en <html> (retrocompatibilidad)
    document.documentElement.setAttribute('data-theme', key);

    // 4. Sincronizar estado visual de los botones
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('theme-btn--active', btn.dataset.theme === key);
    });
}
```

El `<body>` arranca con `class="theme-violet"` en el HTML para evitar un flash sin tema antes de que `app.js` ejecute el primer `applyTheme`.

#### Listener `.theme-btn` — deduplicado

En v9.0, el listener de clic en `.theme-btn` estaba registrado dos veces: en `app.js` DOMContentLoaded y en `shop-logic.js` DOMContentLoaded. Esto causaba que `setTheme()` se llamara dos veces por clic.

**Solución v9.1:** el registro en `app.js` DOMContentLoaded fue eliminado. El único listener vive en `shop-logic.js`. `setTheme()` sigue siendo la fuente de verdad para el store y la lógica visual.

### Cambios en v9.0 (SPA Migration)

Dos métodos nuevos añadidos al objeto `window.GameCenter`:

#### `getState()` — lectura segura del store

```javascript
GameCenter.getState()
// Returns: { coins, streak, theme, moonBlessingExpiry }
```

Devuelve una copia plana de los campos públicos del store. **No expone la referencia al objeto `store` interno**, evitando que módulos externos puedan mutar el estado sin pasar por la API.

Usado por `shop-logic.js` en `renderStreakCalendar()` y potencialmente por cualquier módulo externo que necesite leer el estado sin depender de múltiples llamadas individuales.

#### `syncUI()` — sincronización forzada del saldo

```javascript
GameCenter.syncUI()
// Returns: void
```

Resetea `_displayedCoins` al valor real del store y ejecuta `updateUI()`. Garantiza que, al navegar entre vistas, todos los `.coin-display` (Navbar + HUD) muestren el saldo correcto de forma inmediata y animada.

Llamado por `spa-router.js` en cada transición de vista.

```javascript
// Ejemplo de uso interno en spa-router.js
function navigateTo(viewId) {
    // ... toggle views ...
    window.GameCenter?.syncUI?.();
}
```

### Cambios en v8.0

Sin cambios en la lógica de negocio. Las únicas modificaciones en v8.0 son:

**Emojis eliminados de strings internos:**

| Antes (v7.5) | Después (v8.0) |
|---|---|
| `'🌙 Bendición Lunar activada (7 días)'` | `'Bendición Lunar activada (7 días)'` |
| `Racha: ${n} 🔥` | `Racha: ${n}` |
| `' + 🌙 Bendición Lunar'` | `' + Bendición Lunar'` |
| `'+🌙'` en moonNote | `'+Luna'` |
| `'Activar Bendición Lunar (100 🪙)'` | `'Activar Bendición Lunar (100 monedas)'` |
| Badge title: `'🌙 Bendición Lunar activa hasta…'` | `'Bendición Lunar activa hasta…'` |

La representación visual de la luna es ahora responsabilidad exclusiva del icono Lucide `<i data-lucide="moon">` en el HTML.

La función `updateMoonBlessingUI()` actualiza el `<span class="moon-blessing-badge">` (que ya contiene el icono SVG) mostrándolo u ocultándolo con la clase `hidden`. Ya no modifica el `textContent` del badge porque ese contenido es el icono SVG.

### Cambios en v8.1 (Daily Claim Security)

#### Sistema de tiempo — rediseño en v9.6 (Background Sync)

La verificación de tiempo fue **completamente desacoplada del momento del reclamo**. En lugar de hacer una petición de red cuando el usuario pulsa el botón, el sistema mantiene un caché local que se actualiza silenciosamente en segundo plano.

##### `_syncTimeBackground()` — sincronización en background

```javascript
async function _syncTimeBackground()  // sin valor de retorno
```

Consulta ambas APIs **en paralelo** (`Promise.any`) y escribe el resultado en `localStorage` (`love_arcade_time_cache`). Se lanza automáticamente en tres momentos:

| Trigger | Cuándo ocurre |
|---|---|
| `DOMContentLoaded` + 800 ms | Al cargar la página, sin competir con el primer paint |
| `visibilitychange → visible` | Cuando el usuario vuelve a la pestaña |
| `setInterval` 30 min | Refresco periódico si la app permanece abierta |

El resultado nunca interrumpe la UI — si todas las fuentes fallan, el caché existente se conserva.

##### `_readTimeCache()` — lectura síncrona del caché

```javascript
function _readTimeCache()
// Returns: { time: number, verified: boolean, desynced: boolean, cacheAge: number }
```

Lectura puramente local, sin red. Usada por `claimDaily()`.

| Campo | Descripción |
|---|---|
| `time` | Estimación del timestamp de red: `Date.now() + drift` |
| `verified` | `true` si el caché existe y tiene menos de `TIME_CACHE_TTL` (4 h) |
| `desynced` | `true` si el último sync detectó que el reloj local estaba adelantado > 5 min |
| `cacheAge` | Antigüedad del caché en ms |

Constantes asociadas:
- `CLOCK_SKEW_LIMIT = 5 * 60 * 1000` ms
- `TIME_API_TIMEOUT = 4000` ms (por petición individual)
- `TIME_CACHE_TTL = 4 * 60 * 60 * 1000` ms (4 horas)

#### `claimDaily()` — síncrono desde v9.6

Ya **no es `async`** ni hace ninguna petición de red. Lee `_readTimeCache()` y devuelve el resultado de forma instantánea.

```javascript
// Signature (v9.6)
claimDaily(): {
    success: boolean,
    reward?: number,
    baseReward?: number,
    moonBonus?: number,
    streak?: number,
    verified: boolean,
    message: string
}
```

Capas de validación (en orden):

1. **Salto negativo** (`now < lastClaim`): bloquea sin tocar la racha.
2. **Reloj adelantado** (`desynced === true` del caché): bloquea con advertencia.
3. **Día calendario** (diff via `setHours(0,0,0,0)`).
4. **Bendición Lunar**: se concede siempre que el buff esté activo — la protección contra abuso queda cubierta por el `desynced` del sync anterior.

#### `canClaimDaily()` — lógica de día calendario

```javascript
// Antes (v8.0):
canClaimDaily: () => Date.now() - store.daily.lastClaim >= 86_400_000

// Ahora (v8.1):
canClaimDaily: () => {
    const nowMidnight  = new Date().setHours(0, 0, 0, 0);
    const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
    return (nowMidnight - lastMidnight) >= 86_400_000;
}
```

#### `getStreakInfo()` — lógica de día calendario

Usa la misma normalización a medianoche para calcular `diffDays` y determinar si la racha continúa o se reinicia.

#### Event listener de `#btn-daily`

```javascript
// Antes (v8.0): handler síncrono
dailyBtn.addEventListener('click', () => {
    const result = window.GameCenter.claimDaily();
    // ...
});

// Ahora (v8.1): handler async con bloqueo inmediato
dailyBtn.addEventListener('click', async () => {
    // SÍNCRONO — antes de cualquier await:
    dailyBtn.disabled      = true;
    dailyBtn.style.opacity = '0.5';
    // Cambiar texto a "Procesando..."
    // ...
    const result = await window.GameCenter.claimDaily();
    // Restaurar estado por updateDailyButton()
});
```

---

## 6. sync-worker.js — Web Worker

**Sin cambios en v8.0.**

El worker sigue manejando el checksum SHA-256 para los archivos `.txt` importados, garantizando que cualquier archivo cargado sea validado antes de aplicarse. El flujo completo es:

```
Usuario carga archivo .txt  →  FileReader lee el texto  →
textarea recibe el contenido  →  handleImport() llama a
GameCenter.importSave(code)  →  workerTask({action:'import', code, salt})
→  sync-worker.js verifica el checksum SHA-256  →
¿válido? → store = migrateState(data) → saveState()
¿inválido? → rechazado con mensaje de error
```

Los mensajes soportados son los mismos que en v7.5:

| `action`   | Payload requerido       | Resultado devuelto                        |
|---|---|---|
| `'export'` | `{ store, salt }`       | `string` — código Base64 con checksum     |
| `'import'` | `{ code, salt }`        | `{ data, valid, legacy }` — store + validez |

---

## 7. shop.json — El Catálogo

**Sin cambios estructurales en v8.0.** Cada ítem mantiene su estructura con el campo `tags` que contiene etiquetas como `"PC"`, `"Mobile"`, `"Anime"`, etc. Sin embargo, **solo se renderizan los tags `PC` y `Mobile`** en las cards del catálogo (v8.0: simplificación de UI).

Los filtros del catálogo también se reducen a `Todos`, `PC`, `Mobile` y `Wishlist`. Las etiquetas adicionales (`Anime`, `Gaming`, `Sonic`, etc.) se mantienen en el JSON para uso futuro, pero no se muestran como pills ni se usan en los filtros.

---

## 8. index.html — SPA Unificada

A partir de v9.0, `index.html` es el **único archivo HTML** de la plataforma. Contiene las dos vistas de la aplicación, la navbar y bottom-nav globales, y todos los modales.

### Cambios en v9.1

#### `<body class="theme-violet">`

El `<body>` arranca con la clase del tema por defecto. Esto evita un FOUC (Flash Of Unstyled Content) en el selector de temas antes de que `app.js` ejecute `applyTheme()`. Si el usuario ya tenía guardado otro tema en localStorage, `applyTheme()` reemplaza la clase inmediatamente en el primer ciclo.

```html
<!-- v9.0 -->
<body>

<!-- v9.1 -->
<body class="theme-violet">
```

#### `#shop-error-state` — UI de error de red

Añadido dentro de `#tab-catalog`, inicialmente oculto. Se hace visible cuando `loadCatalog()` detecta un fallo de red:

```html
<div id="shop-error-state" class="shop-error-state hidden" role="alert">
    <i data-lucide="wifi-off" size="40"></i>
    <p class="shop-error-title">No se pudo cargar el catálogo</p>
    <p class="shop-error-desc">Revisa tu conexión e inténtalo de nuevo.</p>
    <button id="btn-retry-shop" class="btn-primary">
        <i data-lucide="refresh-cw" size="14"></i>
        Reintentar
    </button>
</div>
```

El botón `#btn-retry-shop` es enlazado por `loadCatalog()` en `shop-logic.js`.

### Jerarquía del DOM

```
<body>
  <nav class="navbar glass-panel">        ← Global (Navbar superior)
  <nav class="bottom-nav">                ← Global (Nav inferior móvil)

  <main class="container">
    <div id="view-home">                  ← Vista Inicio
      .player-hud
      #games.games-grid
      #faq
    </div>

    <div id="view-shop" class="hidden">   ← Vista Tienda (oculta al inicio)
      #sale-banner
      .promo-toggle-wrap
      .shop-tabs
      #tab-catalog
      #tab-library
      #tab-sync
      #tab-settings
    </div>
  </main>

  <!-- MODALES — fuera de <main> ─────────────────────────── -->
  <div id="preview-modal" class="modal-overlay hidden">
  <div id="confirm-modal" class="modal-overlay hidden">
  <div id="email-modal"   class="modal-overlay hidden">

  <script src="js/app.js"></script>
  <script src="js/shop-logic.js"></script>
  <script src="js/spa-router.js"></script>
  <script>/* lucide + HomeView logic */</script>
</body>
```

### Por qué los modales están fuera de `<main>`

El bug de scroll gigante que afectaba a versiones anteriores era causado por modales con `position: fixed` anidados dentro de contenedores con `overflow: hidden` o `transform`. Al estar dentro de `<main>`, su contexto de apilamiento (stacking context) quedaba confinado al contenedor padre.

**Solución:** mover los tres modales al final de `<body>`, a nivel raíz. `position: fixed` ahora toma el viewport completo como referencia y los modales se superponen correctamente sin arrastrar el layout.

### Navegación con `data-view`

Los enlaces de la navbar y la bottom-nav usan `data-view` en lugar de `href` para que `spa-router.js` pueda interceptar el clic:

```html
<!-- Antes (multi-page) -->
<a href="shop.html" class="nav-link">Tienda</a>

<!-- Ahora (SPA) -->
<a href="#" class="nav-link" data-view="shop">Tienda</a>
```

Los deep-links a secciones internas del Inicio usan adicionalmente `data-anchor`:

```html
<a href="#" class="nav-link" data-view="home" data-anchor="games">Juegos</a>
```

El router detecta el anchor, navega al Inicio y hace scroll suave hasta el elemento `#games`.

### `window.HomeView`

Objeto expuesto por el script inline de `index.html`. Permite al router refrescar la vista de Inicio sin conocer los detalles de su implementación:

```javascript
window.HomeView = {
    refresh() {
        updateCountdownDisplay(); // Refresca el countdown del bono diario
        updateStreakBar();         // Actualiza la barra de racha
    }
};
```

---

## 9. js/shop-logic.js — Módulo de Tienda

Contiene toda la lógica que anteriormente vivía como script inline en `shop.html`. Se carga después de `app.js` y antes de `spa-router.js`.

### Dependencias

| Dependencia | Fuente |
|---|---|
| `window.GameCenter` | `js/app.js` |
| `window.ECONOMY` | `js/app.js` |
| `window.debounce` | `js/app.js` |
| `window.MailHelper` | `js/app.js` |
| `window.lucide` | CDN `unpkg.com/lucide` |
| `window.confetti` | CDN `cdn.jsdelivr.net/canvas-confetti` |

### API pública expuesta

```javascript
window.ShopView = {
    onEnter()  // Llamado por spa-router.js al entrar a la vista de Tienda
};

window.resetFilters = resetFilters; // Compatible con onclick="resetFilters()" en HTML
```

### Cambios en v9.1

#### `loadCatalog()` — carga con manejo de errores y reintento

En v9.0 el fetch era inline en DOMContentLoaded y no tenía gestión de errores. En v9.1 se extrae a la función `loadCatalog()`:

```javascript
function loadCatalog() {
    // 1. Mostrar loading, ocultar error state y grid anterior
    // 2. fetch('data/shop.json') con verificación HTTP
    // 3a. Éxito: renderizar catálogo, ocultar error state
    // 3b. Error: mostrar #shop-error-state con botón #btn-retry-shop
    //     El retry llama de nuevo a loadCatalog() (retry pattern)
}
```

El botón de reintento usa `dataset.bound` para no registrar el listener múltiples veces:

```javascript
if (retryBtn && !retryBtn.dataset.bound) {
    retryBtn.dataset.bound = 'true';
    retryBtn.addEventListener('click', () => {
        delete retryBtn.dataset.bound;
        loadCatalog();
    });
}
```

#### Listener `.theme-btn` — única fuente de verdad

El listener de `.theme-btn` fue eliminado de `app.js` y vive exclusivamente en el `DOMContentLoaded` de este módulo. Delega a `window.GameCenter.setTheme()`.

### Inicialización única (v9.0+)

El `DOMContentLoaded` de este módulo se ejecuta **una sola vez** cuando la SPA carga. Registra todos los event listeners de la tienda y llama a `loadCatalog()` que guarda el resultado en `allItems`. Las navegaciones posteriores a la vista de Tienda no vuelven a hacer fetch.

```javascript
// v9.1: loadCatalog() encapsula fetch + error handling + retry
loadCatalog();
// → si OK: allItems = items, filterItems(), renderLibrary()
// → si KO: mostrar #shop-error-state con botón de reintento
```

### `window.ShopView.onEnter()`

Llamado por el router al cambiar a la vista de Tienda. Refresca los indicadores de economía y luna sin re-renderizar el catálogo completo (que ya está en memoria):

```javascript
window.ShopView.onEnter = function() {
    initEconomyInfo();
    renderMoonBlessingStatus();
    document.querySelectorAll('.coin-display').forEach(/* update */);
};
```

### Optimizaciones de rendimiento

- **`loading="lazy"`** en todos los `<img>` del catálogo y la biblioteca.
- **`will-change: transform, opacity`** en cada `.shop-card` generado dinámicamente.
- **`fireConfetti()`** verifica `document.hidden` y la vista activa antes de disparar.
- **Toasts:** `.remove()` tras la animación de salida — limpieza real del DOM, no solo ocultado.
- **Debounce global:** la búsqueda usa `window.debounce(fn, 300)` de `app.js`.

---

## 10. js/spa-router.js — Router SPA

Módulo IIFE responsable exclusivo de la navegación entre vistas.

### API pública

```javascript
window.SpaRouter = {
    navigateTo(viewId, anchor?, replace?),  // Navega a 'home' o 'shop'
    getCurrentView()                         // Devuelve el id de la vista activa
};
```

### `navigateTo(viewId, anchor?, replace?)`

```javascript
SpaRouter.navigateTo('shop');         // Ir a Tienda (pushState)
SpaRouter.navigateTo('home', 'faq'); // Ir a Inicio y scroll a #faq (pushState)
SpaRouter.navigateTo('home', null, true); // Estado inicial (replaceState)
```

Pasos internos al llamar a `navigateTo`:

1. `history.pushState({ viewId, anchor })` — registra la entrada en el historial (o `replaceState` si `replace=true`).
2. Llama a `_applyView(viewId, anchor)` con la lógica de transición visual.

### `_applyView(viewId, anchor)` — transición pura

Función interna que aplica la transición SIN tocar el historial. Es la que llama el handler de `popstate` para evitar un bucle de entradas:

1. Alterna `.hidden` entre `#view-home` y `#view-shop`.
2. Actualiza clases `.active` en navbar y bottom-nav.
3. Llama a `window.GameCenter.syncUI()`.
4. Llama a `lucide.createIcons()`.
5. `window.scrollTo({ top: 0, behavior: 'instant' })` o scroll suave al anchor.
6. Ejecuta el callback de vista: `window.HomeView.refresh()` o `window.ShopView.onEnter()`.

### History API — botón Atrás/Adelante (v9.1)

```javascript
// Al cargar la página — registrar estado inicial
navigateTo('home', null, /* replace= */ true);
// → history.replaceState({ viewId: 'home', anchor: null }, '')

// Al navegar a Tienda — registrar nueva entrada
navigateTo('shop');
// → history.pushState({ viewId: 'shop', anchor: null }, '')

// Al pulsar Atrás — restaurar vista anterior SIN pushState
window.addEventListener('popstate', (e) => {
    const viewId = VIEWS.includes(e.state?.viewId) ? e.state.viewId : 'home';
    _applyView(viewId, e.state?.anchor || null); // ← sin pushState
});
```

**Por qué `_applyView` en popstate y no `navigateTo`:** si usáramos `navigateTo` en el handler popstate, generaríamos un nuevo pushState por cada Atrás, creando un historial infinito que nunca permitiría salir de la app.

### Sin reflows

La transición usa únicamente la clase `.hidden` (`display: none !important`). No se animan propiedades de layout.

---

## 11. styles.css — Sistema de Diseño Arcade Solid 3.1

### Filosofía de Diseño (v10.1)

### Filosofía de Diseño (v10.1)

A partir de v10.0 el sistema visual abandona el Glassmorphism y adopta un diseño **Sólido Premium** de ratio 90/10. En v10.1 se refinan dos puntos adicionales: eliminación de artefactos de esquina y sistema de transiciones de vista GPU-only.

- **90% Sólido:** Todas las superficies de panel, navegación, tarjetas y entradas usan fondos de color sólido oscuro. La jerarquía de profundidad se comunica mediante bordes de acento (hard-edge) y sombras cortas sólidas.
- **10% Glass:** El `backdrop-filter` está permitido *solo* en elementos flotantes críticos (toasts, modales de confirmación, identity modal).
- **GPU-First:** Ninguna animación toca `height`, `width` o `margin`. Solo `opacity`, `transform` y opcionalmente `filter`. La regla de los 300ms se cumple en todas las transiciones.

**Beneficio de rendimiento:** eliminar el `backdrop-filter` de navbar, bottom-nav y todos los paneles reduce ~30-50% el overdraw en dispositivos gama baja/media.

### Principio Mobile-First

A partir de v8.0, los estilos base en `styles.css` corresponden al viewport más pequeño (pantalla de teléfono). Las expansiones para pantallas más grandes se definen con media queries de tipo `min-width`.

```css
/* ANTES (v7.5): Desktop como base, mobile como excepción */
.shop-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }

@media (max-width: 768px) {
    /* overrides de mobile */
}

/* AHORA (v8.0): Mobile como base, desktop como expansión */
.shop-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }

@media (min-width: 768px) {
    .shop-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
}
```

### Breakpoints

| Breakpoint | Valor | Descripción |
|---|---|---|
| Base (mobile) | — | Teléfonos (< 768px) |
| Desktop | `min-width: 768px` | Tablets y escritorios |
| Desktop wide | `min-width: 1024px` | Escritorios grandes |

### Cambios clave por componente

**Body:**
- Mobile base: `padding-bottom: var(--bottom-nav-height)` (espacio para bottom nav)
- Desktop: `padding-bottom: 0`

**Bottom Nav:**
- Mobile base: `display: flex` (visible)
- Desktop: `display: none` (oculto)

**Nav Links (top):**
- Mobile base: `display: none`
- Desktop: `display: flex`

**`.shop-hero` (Hero Balance):**
- Mobile base: `display: none` — eliminado visualmente en móvil porque el saldo ya está en la Navbar superior
- Desktop: `display: flex`

**`.shop-grid`:**
- Mobile base: `repeat(2, 1fr); gap: 12px` — 2 columnas compactas
- Desktop: `repeat(auto-fill, minmax(220px, 1fr)); gap: 20px`

**`.shop-card`:**
- Mobile base: `padding: 12px`
- Desktop: `padding: 18px`

**`.shop-img`:**
- Mobile base: `height: 120px`
- Desktop: `height: 170px`

**`.section-title`:**
- Mobile base: `font-size: 1.4rem`
- Desktop: `font-size: 1.8rem`

**`.shop-tab`:**
- Mobile base: `padding: 8px 10px; font-size: 0.78rem`
- Desktop: `padding: 10px 18px; font-size: 0.88rem`

**`.promo-input-group`:**
- Mobile base: `flex-direction: column` (apilado)
- Desktop: `flex-direction: row`

**`.theme-grid`:**
- Mobile base: `grid-template-columns: 1fr 1fr` (2 columnas)
- Desktop: `repeat(auto-fill, minmax(150px, 1fr))`

**`.faq-grid`:**
- Mobile base: `grid-template-columns: 1fr`
- Desktop: `repeat(auto-fill, minmax(340px, 1fr))`

**`.toast`:**
- Mobile base: `bottom: calc(var(--bottom-nav-height) + 10px)` — sobre la bottom nav
- Desktop: `bottom: 30px`

### Tokens de Superficie (v10.0)

```css
/* Superficies sólidas (Arcade Solid 3.0) */
--solid-surface-base:  #0f1018;   /* Paneles base: settings, cards */
--solid-surface-float: #141620;   /* Elementos flotantes: HUD, game cards */
--solid-surface-hi:    #1a1d2e;   /* Highlight: modal box */
--solid-surface-deep:  #0a0b12;   /* Profundidad máxima: inputs, balance */

/* Bordes hard-edge */
--border-subtle:  rgba(255,255,255,0.06);   /* Bordes neutros */
--border-mid:     rgba(255,255,255,0.10);   /* Bordes medios (identidad) */
--border-bright:  rgba(255,255,255,0.18);   /* Bordes de highlight */
```

Los tokens `--glass-base-bg`, `--glass-float-bg` etc. son mantenidos como **alias** a los valores sólidos para compatibilidad retroactiva.

### Animaciones GPU (v10.0)

Todas las nuevas animaciones usan propiedades compositor-only para evitar repaints:

| Animación | Elemento | Propiedad animada | FPS garantizado |
|---|---|---|---|
| `powerRingRotate` | `.hud-avatar-ring` | `transform: rotate()` | 60fps |
| `laserScan` | `.sale-banner__ticket::after` | `transform: translate3d()` | 60fps |

Ambas tienen `will-change: transform` para promoverse a capas GPU antes del primer frame.

---

### Clases nuevas en v8.0

**`.wishlist-cost-banner`** — Contenedor del indicador de coste de Wishlist:
```css
.wishlist-cost-banner {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px;
    border-radius: var(--radius-md);
    background: rgba(255,79,122,0.08); border: 1px solid rgba(255,79,122,0.25);
    font-size: 0.82rem; color: var(--text-med);
}
.wishlist-cost-banner strong { color: #ff4f7a; }
```

**`.pill--wishlist`** — Pill de filtro con color rosa diferenciado:
```css
.pill--wishlist.active { background: #ff4f7a; border-color: #ff4f7a; }
```

**`.wishlist-btn--active svg path`** — Rellena el corazón SVG de Lucide vía CSS:
```css
.wishlist-btn--active svg path,
.wishlist-btn--active svg circle { fill: currentColor !important; }
```

**`.sync-separator`** — Separador visual entre métodos de importación:
```css
.sync-separator { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 0.78rem; color: var(--text-low); }
.sync-separator::before, .sync-separator::after { content: ''; flex: 1; height: 1px; background: var(--glass-border); }
```

**`.file-label`** — Label del input de archivo estilizado como botón ghost:
```css
.file-label { cursor: pointer; width: 100%; justify-content: center; padding: 10px; }
```

**`.card-name` y `.card-desc-text`** — Clases CSS para los textos de cards (v8.0 reemplaza inline styles para facilitar overrides responsive):
```css
.shop-card .card-name { font-size: 0.9rem; font-weight: 700; /* desktop: 1.02rem */ }
.shop-card .card-desc-text { font-size: 0.76rem; -webkit-line-clamp: 2; /* desktop: 0.82rem, clamp 3 */ }
```

**`.moon-blessing-badge`** — Actualizado para ser compatible con el icono SVG Lucide:
```css
.moon-blessing-badge {
    display: inline-flex; align-items: center; justify-content: center;
    filter: drop-shadow(0 0 6px rgba(192, 132, 252, 0.8));
    animation: moonPulse 2.5s ease-in-out infinite;
}
```

---

## 12. Códigos Promocionales (SHA-256)

### Cómo funcionan

Los códigos promocionales se almacenan en `PROMO_CODES_HASHED` como hashes SHA-256. El usuario escribe el código, se hashea en el cliente y se compara contra el diccionario. El texto plano nunca se almacena ni se compara directamente.

### Agregar un código nuevo

**Paso 1 — Calcular el hash SHA-256 (siempre en MAYÚSCULAS, sin espacios):**

```bash
# Linux / macOS
echo -n "MICODIGO" | sha256sum

# Python (multiplataforma)
python3 -c "import hashlib; print(hashlib.sha256(b'MICODIGO').hexdigest())"
```

**Paso 2 — Añadir la entrada en `app.js`:**

```javascript
const PROMO_CODES_HASHED = {
    // ... entradas existentes ...
    'HASH_DE_64_CARACTERES': 150,   // MICODIGO → 150 monedas
};
```

> ⚠️ El código que el usuario escribe se normaliza con `.trim().toUpperCase()`. El hash debe calcularse del texto **exactamente en mayúsculas y sin espacios**.

### Lista de hashes actuales

| Hash SHA-256 (primeros 16 chars) | Monedas | Código original |
|---|---|---|
| `bf321fd2057fa13f` | 50 | GOUL50 |
| `b4d84aca1d5ff57b` | 50 | AMRO50 |
| `4558eb9beb0e7795` | 50 | GOVE50 |
| `72b39c0a7c2fe8a8` | 50 | FU50 |
| `72cf61b005e730b6` | 50 | GO50 |
| `e6453c805f71d9e7` | 50 | GOBR50 |
| `ab96dc80db7dba63` | 50 | CH50 |
| `02dcc8750da36c25` | 50 | ASYA50 |
| `92bdd5dffca1bfee` | 50 | MINA50 |
| `0c313dd65a464d2e` | 50 | SA50 |
| `37c74d7abd7b237c` | 50 | TRFU50 |
| `8db94e555d11f110` | 50 | VEZA50 |
| `f75a0e6945982ff7` | 50 | JADO50 |
| `0512cff95aa63306` | 50 | JADOUNO50 |
| `ac7b6ff2fd991864` | 50 | JADODOS50 |
| `03a757ee862ded77` | 50 | JADOTRES50 |
| `379dcec413be95bf` | 50 | HAMI50 |
| `5bc5dd8321afdd53` | 50 | MA50 |
| `c5395455063acab1` | 50 | XI50 |
| `0cd1cd7704a567e4` | 50 | LADEHI50 |
| `888b5b43925b50cb` | 50 | HIGO50 |
| `190d2b7ebff147a6` | 50 | KAWA50 |
| `88feae97920cf17c` | 60 | SACAME |
| `76d06ecc24894e3d` | 1000 | SAMUEL1000 |
| `79de29d219b29ccb` | 500 | FEB14 |
| `724dd40fbeb9e3d5` | 300 | SOFYEK300 |
| `07d2dde1b4c1fe43` | 200 | ERRORRC |

> Los hashes completos (64 caracteres) se encuentran en `PROMO_CODES_HASHED` dentro de `app.js`.

---

## 13. Sistema de Racha (Streaks)

### Cambio en v8.1: Día Natural vs. 24 horas exactas

Hasta v8.0, el sistema verificaba si habían pasado ≥ 86.400.000 ms desde el último reclamo. Esto producía un "desplazamiento de horario": si el usuario reclamaba a las 23:55, debía esperar hasta las 23:55 del día siguiente.

A partir de **v8.1**, la comparación se realiza por **día calendario** (medianoche contra medianoche):

```javascript
// Normalizar ambas fechas a las 00:00:00.000 de su día
const nowMidnight  = new Date(now).setHours(0, 0, 0, 0);
const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
const diffDays     = Math.round((nowMidnight - lastMidnight) / 86_400_000);
```

**Fórmula de racha:**

| `diffDays` | Acción |
|---|---|
| `0` | Ya reclamado hoy. No se otorga recompensa. |
| `1` | Racha continúa: `streak + 1`. |
| `> 1` | Racha interrumpida: `streak = 1`. |

Esto garantiza que un usuario que reclamó a las **23:59** puede volver a reclamar a las **00:01** del día siguiente (diff = 1 → racha continúa).

**Fórmula de recompensa base** (sin cambios):

`recompensa = min(20 + (streak - 1) × 5, 60)`

| Día de racha | Recompensa base |
|---|---|
| 1 | 20 |
| 2 | 25 |
| 3 | 30 |
| 4 | 35 |
| 5 | 40 |
| 6 | 45 |
| 7+ | 60 (tope) |

---

## 14. Bendición Lunar

Sin cambios funcionales en v8.0. La representación visual migra de emoji a icono Lucide.

| Parámetro | Valor |
|---|---|
| Costo de activación | 100 monedas |
| Efecto | +90 monedas por cada reclamo diario |
| Vigencia | 7 días reales desde la activación |
| Indicador UI | Icono `<i data-lucide="moon">` animado junto al saldo |

### Comportamiento v9.6: Bendición Lunar sin dependencia de red

Desde v9.6, el bonus de Bendición Lunar **siempre se concede** mientras el buff esté activo, sin condiciones de red:

```javascript
moonBonus = moonActive ? 90 : 0
```

La protección contra abuso queda cubierta por el `desynced` del sync en background: si el usuario adelanta el reloj para hacer pasar un día, el sync detectará la discrepancia y bloqueará el reclamo completo (no solo el bonus lunar). Sin conexión genuina, el usuario tampoco puede comprar la Bendición Lunar (requiere 100 monedas que se obtienen jugando), por lo que el riesgo neto es despreciable.

---

## 15. Wishlist — Funcionalidad Completa

A partir de v8.0, la Wishlist tiene tres funcionalidades activas:

### 14.1 Filtro "Mis Lista"

La pill `[data-filter="Wishlist"]` en la barra de filtros muestra únicamente los ítems marcados con el corazón:

```javascript
// En filterItems()
} else if (activeFilter === 'Wishlist') {
    matchesFilter = GameCenter.isWishlisted(item.id);
}
```

### 14.2 Prioridad en búsqueda

Al listar resultados, los ítems en Wishlist siempre aparecen antes, sin importar el filtro activo:

```javascript
const wishlisted = filtered.filter(item => GameCenter.isWishlisted(item.id));
const others     = filtered.filter(item => !GameCenter.isWishlisted(item.id));
renderShop([...wishlisted, ...others]);
```

### 14.3 Indicador de coste

El banner `#wishlist-cost-banner` muestra en tiempo real cuántas monedas faltan para comprar todos los ítems de la lista que aún no se poseen:

```javascript
function updateWishlistCost() {
    const unwownedWishlisted = allItems.filter(item =>
        GameCenter.isWishlisted(item.id) && GameCenter.getBoughtCount(item.id) === 0
    );
    const total = unwownedWishlisted.reduce((sum, item) => {
        const price = eco.isSaleActive
            ? Math.floor(item.price * eco.saleMultiplier)
            : item.price;
        return sum + price;
    }, 0);
    const needed = Math.max(0, total - GameCenter.getBalance());
    // Actualizar banner...
}
```

`updateWishlistCost()` se llama en: carga inicial del catálogo, toggle de Wishlist, y tras completar una compra.

### API de Wishlist (sin cambios)

```javascript
GameCenter.toggleWishlist(itemId)  // → true si quedó en wishlist
GameCenter.isWishlisted(itemId)    // → boolean
```

**Almacenamiento:**

```javascript
store.wishlist = [3, 7, 21]  // Array de IDs numéricos
```

---

## 16. Sincronización con Archivo .txt

### Flujo de exportación (v8.0)

```
Clic "Exportar y descargar"  →  handleExport() async
    │
    ▼
GameCenter.exportSave()  →  workerTask({action:'export', store, salt})
    │
    ▼  [sync-worker.js calcula checksum SHA-256]
checksum = sha256(JSON.stringify(store) + SYNC_SALT)
código = btoa(encodeURIComponent(JSON.stringify({data: store, checksum})))
    │
    ▼
1. navigator.clipboard.writeText(código)  → copiado al portapapeles
2. new Blob([código]) → URL.createObjectURL() → descarga love-arcade-backup-YYYY-MM-DD.txt
    │
    ▼
Mensaje: "Código copiado al portapapeles y archivo .txt descargado."
```

> **Sin textarea.** En v7.5 el código se mostraba en un `<textarea>` que podía copiarse. Esto bloqueaba el hilo principal con strings muy largos. En v8.0, la operación de copia y la descarga ocurren directamente en memoria.

### Flujo de importación (v8.0)

**Opción A — Cargar archivo:**

```
Usuario selecciona archivo .txt  →  evento 'change' en #import-file
    │
    ▼
FileReader.readAsText(file)  →  onload: textarea.value = contenido
    │
    ▼
Usuario hace clic en "Importar progreso"  →  handleImport() async
    │
    ▼  [igual que antes]
GameCenter.importSave(code)  →  workerTask({action:'import', code, salt})
    │
    ▼  [sync-worker.js verifica checksum SHA-256]
¿checksum válido? → store = migrateState(data) → saveState() → reload
¿inválido?        → rechazado con mensaje de error
```

**Opción B — Pegar código manualmente:**

El `<textarea id="import-input">` sigue disponible como alternativa. El botón "Importar progreso" lee su contenido y llama a `handleImport()`.

---

## 17. Historial de Transacciones

Sin cambios en v8.0. Cada operación que modifica el saldo genera una entrada en `store.history`:

```javascript
{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado',       fecha: timestamp }
{ tipo: 'gasto',   cantidad: 88,  motivo: 'Compra: Rouge the Bat',  fecha: timestamp }
{ tipo: 'ingreso', cantidad: 9,   motivo: 'Cashback: Rouge the Bat', fecha: timestamp }
```

El store mantiene un máximo de 150 entradas. La pestaña Ajustes muestra las 50 más recientes con scroll.

---

## 18. Flujos de Usuario

### Flujo de Bono Diario (v9.6 — Background Sync)

```
[Al cargar la página / volver a la pestaña / cada 30 min]
    │
    ▼ [SILENCIOSO — no bloquea la UI]
_syncTimeBackground()
    ├── Promise.any([timeapi.io, worldtimeapi.org])  timeout: 4 s
    ├── Éxito  → _writeTimeCache({ drift, desynced })
    └── Error  → caché anterior se conserva intacto


[Usuario hace clic en #btn-daily]
    │
    ▼ [INSTANTÁNEO — sin red]
_readTimeCache()  →  { time, verified, desynced }  (localStorage)
    │
    ▼ [Validaciones en orden]
1. now < lastClaim?
   └── SÍ → "Se detectó una inconsistencia horaria…"  [racha intacta]
2. desynced === true?  (detectado en el sync anterior)
   └── SÍ → "Reloj desincronizado…"  [bloqueo]
3. diffDays === 0? (mismo día calendario)
   └── SÍ → "¡Ya reclamaste tu bono hoy!"  [bloqueo]
4. moonBonus = moonActive ? 90 : 0
    │
    ▼
Recompensa entregada instantáneamente · UI actualizada
```
    ▼ [diffDays >= 1 → reclamo válido]
diffDays === 1 → streak + 1
diffDays  > 1 → streak = 1
    │
    ▼
baseReward = min(20 + (streak-1)×5, 60)
moonBonus  = verified && moonActive ? 90 : 0
totalReward = baseReward + moonBonus
    │
    ▼
store.coins += totalReward  ·  store.daily = { lastClaim: now, streak }
logTransaction(...)  ·  saveState()
    │
    ▼
updateDailyButton()  →  restaura el botón al estado correcto
                         (desactivado con contador si el reclamo fue exitoso,
                          habilitado si falló por error recuperable)
```

### Flujo de Wishlist y compra

```
Usuario toca el corazón en una card
    │
    ▼
GameCenter.toggleWishlist(id)  →  store.wishlist actualizado  →  saveState()
    │
    ▼
CSS: .wishlist-btn--active → svg path { fill: currentColor }  [corazón lleno]
    │
    ▼
updateWishlistCost()  →  Banner: "Necesitas X monedas para tu lista"
    │
    ▼  [usuario activa filtro "Mis Lista"]
filterItems() → solo ítems en wishlist → wishlisted primero
    │
    ▼  [usuario canjea un ítem de la lista]
GameCenter.buyItem(item)  →  resultado exitoso
filterItems() + updateWishlistCost()  →  banner actualizado
```

### Flujo de sincronización (v8.0)

```
EXPORTAR
────────
Clic "Exportar y descargar"
    │
    ├── clipboard.writeText(code)  →  código en portapapeles
    └── Blob → download  →  love-arcade-backup-2026-02-21.txt

IMPORTAR
────────
Opción A: Cargar archivo .txt
    │
    FileReader.readAsText() → textarea.value = código
    └── Clic "Importar progreso" → handleImport() → importSave(code)

Opción B: Pegar código en textarea
    └── Clic "Importar progreso" → handleImport() → importSave(code)

importSave(code)
    │
    ├── workerTask({action:'import', code, salt})
    ├── ¿checksum válido? → migrateState(data) → saveState() → reload
    └── ¿inválido?        → "El código fue modificado manualmente."
```

---

## 19. Guía de Mantenimiento

### Agregar un wallpaper nuevo

1. Preparar archivos: `assets/product-thumbs/{nombre}_{hash8}_thumbs.webp` y `wallpapers/{nombre}_{hash8}.webp`.
2. Añadir entrada en `data/shop.json` con ID consecutivo único y tags que incluyan al menos `"PC"` o `"Mobile"`.
3. Subir el commit. No es necesario tocar JS ni HTML.

### Activar una oferta especial

Editar el objeto `ECONOMY` en `app.js`. Ver `ECONOMIA.md` para referencia completa.

### Agregar un código promo nuevo

1. Calcular hash: `python3 -c "import hashlib; print(hashlib.sha256(b'MICODIGO').hexdigest())"`.
2. Añadir `'<hash>': <monedas>` en `PROMO_CODES_HASHED` dentro de `app.js`.

### Volver a los filtros completos (Anime, Gaming, etc.)

Si se decide restaurar los filtros eliminados en v8.0, agregar las pills en `shop.html`:

```html
<button class="pill" data-filter="Anime"><i data-lucide="sparkles" size="11"></i> Anime</button>
<button class="pill" data-filter="Gaming"><i data-lucide="gamepad-2" size="11"></i> Gaming</button>
<!-- etc. -->
```

Y actualizar `filterItems()` para aceptar los nuevos filtros (el código base ya los soporta, solo se eliminaron del HTML).

### Restaurar tags en cards de producto

En `renderShop()`, cambiar el filtro de tags:

```javascript
// v8.0 (actual): solo PC y Mobile
const filteredTags = item.tags.filter(t => t === 'PC' || t === 'Mobile');

// Para mostrar todos los tags:
const filteredTags = item.tags;
```

---

## 20. Seguridad y Limitaciones

| Aspecto | Estado v8.1 | Detalle |
|---|---|---|
| **Códigos promo** | ✅ Protegidos | Hash SHA-256. El texto plano no es visible en el código fuente. |
| **Integridad de sync** | ✅ Checksum | Partidas editadas manualmente son rechazadas al importar (incluyendo archivos .txt). |
| **Manipulación del saldo** | ⚠️ Posible | Un usuario puede editar `localStorage` directamente. Aceptable por diseño en plataforma de confianza. |
| **Importación de archivos** | ✅ Validado | FileReader solo lee el contenido; sync-worker.js verifica el checksum SHA-256 antes de aplicar. |
| **LocalStorage key** | ✅ Intocable | `'gamecenter_v6_promos'` no debe modificarse jamás para no perder el progreso de usuarios existentes. |
| **Bono diario — reloj local** | ✅ Mitigado | `_syncTimeBackground()` contrasta el reloj con dos APIs en paralelo. Si detecta > 5 min de diferencia, escribe `desynced: true` en el caché; `claimDaily()` bloquea el reclamo en el siguiente intento. |
| **Bono diario — modo offline** | ✅ Mejorado v9.6 | Sin conexión, `claimDaily()` usa el caché existente (TTL 4 h). Si el caché expiró y no hay red, el reclamo se permite con `verified: false` (comportamiento graceful). |
| **Rate limiting / CORS API tiempo** | ✅ Resuelto v9.6 | El sync corre en background sin bloquear la UI. Errores de red son silenciosos; el caché previo actúa como buffer. timeapi.io como primaria elimina los 429 de worldtimeapi.org. |
| **Latencia en el reclamo** | ✅ Eliminada v9.6 | `claimDaily()` es 100% síncrono. El usuario recibe la recompensa instantáneamente sin ninguna espera de red. |
| **Salto negativo de reloj** | ✅ Detectado | Si `now < lastClaimTime`, el reclamo se bloquea con mensaje informativo. La racha no se reinicia. |
| **Double-tap / race condition** | ✅ Prevenido | El botón `#btn-daily` se desactiva síncronamente antes de cualquier `await`, imposibilitando múltiples reclamos simultáneos. |

---

## 21. Compatibilidad

| Tecnología | Versión mínima |
|---|---|
| Chrome | 89+ (SubtleCrypto, Workers, Clipboard API, FileReader) |
| Firefox | 87+ |
| Safari | 15+ |
| Edge | 89+ |
| Hosting | Cualquier servidor estático (GitHub Pages, Netlify) |
| Backend | Ninguno |
| Dependencias | Lucide Icons (CDN), canvas-confetti (CDN) |

> La `Clipboard API` (`navigator.clipboard.writeText`) requiere HTTPS o localhost. En entornos sin HTTPS, `handleExport()` tiene un fallback con `document.execCommand('copy')`. Si ambos fallan, el archivo `.txt` igualmente se descarga.

---

## 22. Glosario

| Término | Definición |
|---|---|
| **Store** | El objeto JavaScript en memoria que contiene todo el estado del usuario. Se persiste en `localStorage`. |
| **GameCenter** | La API pública (`window.GameCenter`) con todos los métodos del motor. |
| **Checksum** | Hash SHA-256 del store exportado, incluido en el código/archivo de sincronización para detectar edición manual. |
| **Mobile-First** | Estrategia de CSS donde los estilos base aplican a pantallas pequeñas y los overrides se definen con `@media (min-width: ...)`. |
| **Hero Balance** | El banner grande de monedas en la parte superior de la tienda. Oculto en móvil (v8.0). |
| **Wishlist** | Lista de ítems marcados como favoritos. Ahora con filtro activo, indicador de coste y prioridad en búsqueda. |
| **Racha / Streak** | Días consecutivos en que se reclama el bono diario. Determina la recompensa escalonada. |
| **Bendición Lunar** | Buff temporal de +90 monedas por reclamo diario. Costo 100 monedas, vigencia 7 días. |
| **Skeleton Screen** | Placeholder visual con animación de pulso que imita la estructura de las cards mientras carga el JSON. |
| **Debounce** | Técnica que retrasa la ejecución de una función hasta que el usuario deja de interactuar. Usado en la búsqueda. |
| **Cashback** | Devolución automática de un porcentaje de monedas tras cada compra. |
| **SYNC_SALT** | Constante interna usada para calcular checksums de sincronización. |
| **migrateState** | Función que fusiona el store cargado con los defaults de la versión actual sin sobrescribir datos. |
| **stateKey** | La clave de `localStorage`: `'gamecenter_v6_promos'`. No debe modificarse jamás. |
| **FileReader** | API nativa del navegador para leer archivos locales de forma asíncrona y no bloqueante. Usada en la importación de partidas. |
| **Blob** | Objeto de datos binarios utilizado para generar el archivo `.txt` de exportación sin necesidad de un servidor. |
| **_syncTimeBackground** | Función async (v9.6) que consulta timeapi.io y worldtimeapi.org en paralelo y escribe el resultado en el caché de tiempo. Se ejecuta en background sin bloquear la UI. |
| **_readTimeCache** | Función síncrona (v9.6) que lee el caché de tiempo del localStorage y devuelve la estimación de tiempo de red. Usada por `claimDaily()`. |
| **TIME_CACHE_KEY** | Clave de localStorage (`love_arcade_time_cache`) donde se almacena el caché de tiempo. Separada del store principal. |
| **TIME_CACHE_TTL** | TTL del caché de tiempo: 4 horas. Mientras el caché sea más reciente, `claimDaily()` lo usa directamente. |
| **verified** | Campo de `_readTimeCache()`. `true` si el caché existe y tiene menos de 4 horas. |
| **desynced** | Campo de `_readTimeCache()`. `true` si el último sync detectó que el reloj local superaba `CLOCK_SKEW_LIMIT`. |
| **Día Natural** | Modelo de reset de bono diario (v8.1) basado en días calendario (medianoche). Reemplaza el contador de 24 h exactas. |
| **Race condition** | Condición de carrera donde múltiples clics rápidos disparan varias llamadas a `claimDaily()`. Prevenida en v8.1 desactivando el botón síncronamente. |
| **CLOCK_SKEW_LIMIT** | Constante (5 min en ms). Umbral máximo de discrepancia tolerable entre reloj local y de red. |

---

*Love Arcade · Documentación técnica v9.6 · Background Time Sync & Instant Daily Claim*
*Arquitectura: vanilla JS + localStorage · Sin backend · Compatible con GitHub Pages*
