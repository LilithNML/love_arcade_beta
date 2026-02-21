# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v7.2 · Phase 2

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Proyecto](#2-arquitectura-del-proyecto)
3. [Estructura de Archivos](#3-estructura-de-archivos)
4. [app.js — El Motor](#4-appjs--el-motor)
   - [Configuración global](#configuración-global)
   - [El Store (estado)](#el-store-estado)
   - [API pública: window.GameCenter](#api-pública-windowgamecenter)
   - [Sistema de temas](#sistema-de-temas)
   - [Sistema de economía](#sistema-de-economía)
   - [Animación de contador](#animación-de-contador)
   - [Ciclo de vida del estado](#ciclo-de-vida-del-estado)
5. [shop.json — El Catálogo](#5-shopjson--el-catálogo)
   - [Estructura de un ítem](#estructura-de-un-ítem)
   - [Campo tags](#campo-tags)
   - [Rutas de archivos](#rutas-de-archivos)
6. [index.html — Dashboard](#6-indexhtml--dashboard)
   - [Navbar y avatar](#navbar-y-avatar)
   - [Bono diario](#bono-diario)
   - [Juegos](#juegos)
7. [shop.html — Tienda](#7-shophtml--tienda)
   - [Sistema de pestañas](#sistema-de-pestañas)
   - [Catálogo con buscador y filtros](#catálogo-con-buscador-y-filtros)
   - [La Bóveda de Descargas](#la-bóveda-de-descargas)
   - [Mis Tesoros (Biblioteca)](#mis-tesoros-biblioteca)
   - [Sincronización entre dispositivos](#sincronización-entre-dispositivos)
   - [Ajustes y selector de tema](#ajustes-y-selector-de-tema)
   - [Confetti y micro-interacciones](#confetti-y-micro-interacciones)
8. [styles.css — Sistema de Diseño](#8-stylescss--sistema-de-diseño)
   - [Variables CSS (Design Tokens)](#variables-css-design-tokens)
   - [Componentes reutilizables](#componentes-reutilizables)
9. [Flujos de Usuario](#9-flujos-de-usuario)
   - [Flujo de compra completo](#flujo-de-compra-completo)
   - [Flujo de código promo](#flujo-de-código-promo)
   - [Flujo de sincronización](#flujo-de-sincronización)
10. [Códigos Promocionales](#10-códigos-promocionales)
    - [Agregar un código nuevo](#agregar-un-código-nuevo)
    - [Lista completa de códigos](#lista-completa-de-códigos)
11. [Guía de Mantenimiento](#11-guía-de-mantenimiento)
    - [Agregar un wallpaper nuevo](#agregar-un-wallpaper-nuevo)
    - [Activar una oferta especial](#activar-una-oferta-especial)
    - [Cambiar el bono diario](#cambiar-el-bono-diario)
    - [Agregar un juego nuevo](#agregar-un-juego-nuevo)
12. [Seguridad y Limitaciones](#12-seguridad-y-limitaciones)
13. [Compatibilidad](#13-compatibilidad)
14. [Glosario](#14-glosario)

---

## 1. Visión General

Love Arcade es una **plataforma de recompensas sin backend** construida íntegramente con HTML, CSS y JavaScript vanilla. Funciona como un sistema de fidelización gamificado: el usuario gana monedas virtuales jugando a minijuegos o canjeando códigos, y las utiliza para desbloquear y descargar wallpapers desde una tienda integrada.

**Principios de diseño:**

- **Sin servidor.** Todo el estado vive en `localStorage`. No hay llamadas a APIs externas ni bases de datos.
- **Arquitectura de isla única.** `app.js` es el único archivo de lógica compartida. Las páginas HTML solo consumen la API pública `window.GameCenter`.
- **Compatibilidad retroactiva.** Cada versión del estado se fusiona con `defaultState` al cargar, así que nunca se rompe el progreso de versiones anteriores.
- **Configuración centralizada.** Las constantes `ECONOMY`, `THEMES`, `CONFIG` y `PROMO_CODES` están al principio de `app.js` para que cualquier ajuste sea inmediato sin necesidad de buscar en el código.

---

## 2. Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────┐
│                   NAVEGADOR                         │
│                                                     │
│   index.html          shop.html                     │
│   (Dashboard)         (Tienda)                      │
│        │                   │                        │
│        └──────┬────────────┘                        │
│               │                                     │
│           app.js                                    │
│        (Motor / API)                                │
│               │                                     │
│        localStorage                                 │
│    "gamecenter_v6_promos"                           │
│               │                                     │
│     shop.json (catálogo)                            │
│     wallpapers/ (archivos)                          │
└─────────────────────────────────────────────────────┘
```

**Flujo de datos:**

```
Acción del usuario
      ↓
  shop.html / index.html
      ↓
  window.GameCenter.método()   ← API pública en app.js
      ↓
  Mutación del objeto `store`
      ↓
  saveState() → localStorage
      ↓
  updateUI() → DOM actualizado
```

---

## 3. Estructura de Archivos

```
love_arcade/
│
├── index.html              # Dashboard principal (juegos + daily bonus)
├── shop.html               # Tienda completa (catálogo, biblioteca, sync, ajustes)
├── styles.css              # Hoja de estilos global (design system)
│
├── js/
│   └── app.js              # Motor principal — GameCenter API
│
├── data/
│   └── shop.json           # Catálogo de wallpapers
│
├── wallpapers/             # Archivos descargables (ZIP o JPG)
│   ├── rouge_the_bat_a94a3cca.zip
│   ├── sonic_the_hedgehog_2936a9be.zip
│   └── ... (un archivo por cada ítem del JSON)
│
├── assets/
│   ├── default_avatar.png
│   ├── product-thumbs/     # Imágenes de vista previa de cada wallpaper
│   │   ├── rouge_the_bat_a94a3cca_thumbs.webp
│   │   └── ...
│   └── cover/              # Portadas de los juegos
│       ├── space_shooter_cover_art.webp
│       └── ...
│
└── games/                  # Carpetas de cada minijuego
    ├── Shooter/
    ├── SopaDeLetras/
    ├── pixel_drop.html
    ├── maze.html
    ├── rompecabezas/
    ├── Dodger/
    └── LoveBreaker/
```

---

## 4. app.js — El Motor

`app.js` es el único archivo de JavaScript compartido entre todas las páginas. Se carga antes del script inline de cada HTML mediante `<script src="js/app.js"></script>`.

### Configuración global

```javascript
const CONFIG = {
    stateKey:     'gamecenter_v6_promos', // Clave de localStorage — NO cambiar
    initialCoins: 0,                      // Monedas al crear cuenta nueva
    dailyReward:  20,                     // Monedas del bono diario
    wallpapersPath: 'wallpapers/'         // Directorio de archivos descargables
};
```

> ⚠️ `stateKey` nunca debe modificarse. Si se cambia, todos los usuarios perderán su progreso porque el sistema buscará una clave diferente en `localStorage`.

---

### El Store (estado)

El estado completo de un usuario es un único objeto JSON guardado en `localStorage`:

```javascript
// Estructura completa del store v7.2
{
    // ── Core (existía desde v6) ──────────────────
    coins: 450,
    progress: {
        maze:              ['level_1', 'level_2'],
        wordsearch:        ['word_set_1'],
        secretWordsFound:  ['GATO', 'PERRO']
    },
    inventory: {
        1:  1,   // id del ítem: cantidad comprada
        15: 1,
        30: 2    // stock 3, comprado 2 veces
    },
    redeemedCodes: ['FEB14', 'SAMUEL1000'],
    history: [
        {
            itemId:        1,
            name:          'Rouge the Bat',
            price:         110,
            originalPrice: 110,
            cashback:      11,
            file:          'rouge_the_bat_a94a3cca.zip',
            date:          '2026-02-20T15:30:00.000Z'
        }
    ],

    // ── Nuevos en v7 ────────────────────────────
    userAvatar: 'data:image/png;base64,...',  // null si no hay avatar
    lastDaily:  '2026-02-20',                 // null si nunca se reclamó

    // ── Nuevos en v7.2 ──────────────────────────
    theme: 'violet'   // 'violet' | 'pink' | 'cyan' | 'gold'
}
```

**Fusión de versiones:** Al cargar la página, el store se construye así:

```javascript
store = { ...defaultState, ...JSON.parse(localStorage.getItem(CONFIG.stateKey)) };
```

Esto garantiza que si un usuario tiene datos de v6 (sin `theme` ni `lastDaily`), esos campos se inicializan con los valores por defecto sin borrar sus monedas ni inventario.

---

### API pública: window.GameCenter

Todos los métodos disponibles para las páginas HTML:

#### `GameCenter.completeLevel(gameId, levelId, rewardAmount)`

Registra un nivel completado y añade monedas. Idempotente: si el nivel ya fue completado, no vuelve a pagar.

```javascript
// Llamado desde los juegos
const result = GameCenter.completeLevel('maze', 'level_3', 50);
// → { paid: true, coins: 550 }    (si es la primera vez)
// → { paid: false, coins: 550 }   (si ya fue completado antes)
```

| Parámetro | Tipo | Descripción |
|---|---|---|
| `gameId` | `string` | Identificador del juego (ej: `'maze'`, `'wordsearch'`) |
| `levelId` | `string` | Identificador único del nivel dentro del juego |
| `rewardAmount` | `number` | Monedas a añadir al saldo |

---

#### `GameCenter.buyItem(itemData)`

Procesa la compra de un ítem aplicando descuentos y cashback según `ECONOMY`.

```javascript
const result = GameCenter.buyItem(item);
// → { success: true, finalPrice: 88, cashback: 8 }
// → { success: false, reason: 'coins' }
// → { success: false, reason: 'stock' }
```

El objeto `itemData` debe tener: `id`, `name`, `price`, `stock`, `file` (opcional).

---

#### `GameCenter.redeemPromoCode(inputCode)`

Valida y canjea un código promocional. Normaliza a mayúsculas y elimina espacios.

```javascript
GameCenter.redeemPromoCode('feb14')
// → { success: true, reward: 500, message: '¡+500 Monedas!' }

GameCenter.redeemPromoCode('CODIGO_FALSO')
// → { success: false, message: 'Código inválido' }
```

---

#### `GameCenter.getDownloadUrl(itemId, fileName)`

La función "bóveda". Solo retorna la URL si el ítem está en el inventario del usuario.

```javascript
GameCenter.getDownloadUrl(1, 'rouge_the_bat_a94a3cca.zip')
// → 'wallpapers/rouge_the_bat_a94a3cca.zip'  (si está comprado)
// → null                                       (si no está comprado)
```

---

#### `GameCenter.claimDaily()` / `GameCenter.canClaimDaily()`

```javascript
GameCenter.canClaimDaily()
// → true  (si no se ha reclamado hoy)
// → false (si ya se reclamó hoy)

GameCenter.claimDaily()
// → { success: true, reward: 20, message: '¡+20 monedas de bono diario!' }
// → { success: false, message: 'Ya reclamaste tu bono hoy. ¡Vuelve mañana!' }
```

---

#### `GameCenter.exportSave()` / `GameCenter.importSave(code)`

Serializa / deserializa el store completo en Base64.

```javascript
const code = GameCenter.exportSave();
// → 'eyJjb2lucyI6NDUwLCJwcm9n...' (string Base64)

GameCenter.importSave(code)
// → { success: true }
// → { success: false, message: 'Código inválido o corrupto.' }
```

---

#### `GameCenter.setTheme(key)` / `GameCenter.getTheme()`

```javascript
GameCenter.setTheme('pink');  // Aplica el tema y lo persiste en el store
GameCenter.getTheme();        // → 'pink'
```

---

#### Otros helpers

```javascript
GameCenter.setAvatar(dataUrl)       // Guarda y aplica el avatar
GameCenter.getAvatar()              // → 'data:image/png;base64,...' | null
GameCenter.getBoughtCount(id)       // → número de veces comprado el ítem
GameCenter.getBalance()             // → número de monedas actuales
GameCenter.getInventory()           // → { 1: 1, 15: 1, 30: 2, ... }
```

---

### Sistema de temas

```javascript
const THEMES = {
    violet: { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)', name: 'Violeta' },
    pink:   { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)', name: 'Rosa Neón' },
    cyan:   { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',  name: 'Cyan Arcade' },
    gold:   { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', name: 'Dorado' }
};
```

Al llamar a `applyTheme(key)`, se sobrescriben 3 variables CSS en `:root`:
- `--accent` → color principal
- `--accent-hover` → versión con 80% de opacidad para hover
- `--accent-glow` → color de los box-shadows y glows

Para **añadir un tema nuevo**, simplemente agrega una entrada al objeto `THEMES` y un `<button class="theme-btn" data-theme="mi_tema">` en el panel de Ajustes de `shop.html`.

---

### Sistema de economía

Documentado en detalle en **[ECONOMIA.md](./ECONOMIA.md)**.

Resumen:

```javascript
const ECONOMY = {
    isSaleActive:   false,  // Activa/desactiva el descuento global
    saleMultiplier: 0.8,    // 0.8 = precio al 80% (20% dto.)
    saleLabel:      '20% OFF',
    cashbackRate:   0.1     // 10% de devolución tras cada compra
};
```

---

### Animación de contador

```javascript
function animateValue(elements, start, end, duration = 650)
```

Toma un array de elementos DOM con `.coin-display`, el valor actual, el valor final y la duración en ms. Usa `requestAnimationFrame` con una curva de **ease-out cúbico** para que el número "desacelere" al llegar al destino, dando sensación de físicas reales.

La variable `_displayedCoins` rastrea el último valor mostrado para que la animación siempre arranque desde el número correcto, incluso si se disparan múltiples actualizaciones seguidas.

---

### Ciclo de vida del estado

```
Carga de página
    │
    ▼
localStorage.getItem(stateKey)
    │
    ├─ Si existe → merge con defaultState → store
    └─ Si no existe o error → defaultState → store
    │
    ▼
applyTheme(store.theme)     ← Antes del primer paint
    │
    ▼
updateUI()                  ← Sincroniza DOM con store
    │
    ▼
Interacción del usuario
    │
    ▼
GameCenter.método()
    │
    ▼
Mutación de store
    │
    ▼
saveState() → localStorage + updateUI()
```

---

## 5. shop.json — El Catálogo

`shop.json` es el único lugar donde se define qué wallpapers existen, cuánto cuestan y dónde está el archivo descargable. Se carga con `fetch('data/shop.json')` desde `shop.html`.

### Estructura de un ítem

```json
{
    "id":    1,
    "name":  "Rouge the Bat",
    "desc":  "La espía de G.U.N. para que le de estilo a tu teléfono.",
    "price": 110,
    "stock": 1,
    "image": "assets/product-thumbs/rouge_the_bat_a94a3cca_thumbs.webp",
    "file":  "rouge_the_bat_a94a3cca.zip",
    "tags":  ["Mobile", "Gaming", "Sonic"]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number` | Identificador único. **Nunca reutilizar IDs.** |
| `name` | `string` | Nombre visible en la card |
| `desc` | `string` | Descripción corta (~80 caracteres recomendado) |
| `price` | `number` | Precio en monedas. Debe ser entero positivo. |
| `stock` | `number` | Cantidad disponible. `0` = agotado desde el inicio. `1` = único. `3+` = múltiple. |
| `image` | `string` | Ruta relativa al thumbnail. Formato recomendado: `.webp` |
| `file` | `string` | Nombre del archivo en `/wallpapers/`. Si es `null`, el botón de descarga se desactiva. |
| `tags` | `array` | Etiquetas para los filtros. Ver sección siguiente. |

---

### Campo tags

Los tags disponibles que coinciden con las pills de filtro de la tienda:

| Tag | Filtro correspondiente | Uso |
|---|---|---|
| `"PC"` | 🖥 PC | Fondos formato 16:9, alta resolución |
| `"Mobile"` | 📱 Mobile | Fondos formato vertical/9:16 |
| `"Anime"` | ✨ Anime | Personajes de anime en general |
| `"Gaming"` | 🎮 Gaming | Personajes de videojuegos |
| `"Sonic"` | 💨 Sonic | Universo Sonic the Hedgehog |
| `"DragonBall"` | 🔥 Dragon Ball | Personajes de Dragon Ball |
| `"Genshin"` | ⭐ Genshin | Personajes de Genshin Impact / ZZZ |
| `"Chibi"` | — (sin pill propia, busqueda por texto) | Estilo chibi/deformed |

Un ítem puede tener **múltiples tags**. Ejemplo: `["Mobile", "Anime", "Genshin"]` aparece al filtrar por cualquiera de los tres.

---

### Rutas de archivos

- **Thumbnails:** `assets/product-thumbs/{nombre}_thumbs.webp`
- **Wallpapers:** `wallpapers/{nombre}.zip` ← directorio servido estáticamente

La convención de nombres usa el nombre descriptivo del personaje + un hash de 8 caracteres para evitar colisiones:

```
rouge_the_bat_a94a3cca_thumbs.webp   ← thumbnail
rouge_the_bat_a94a3cca.zip           ← archivo descargable
```

---

## 6. index.html — Dashboard

La página de inicio. Carga `app.js` y llama a `lucide.createIcons()` para renderizar todos los iconos vectoriales.

### Navbar y avatar

La navbar contiene el `coin-badge` (con clase `.coin-display`) y el label del avatar. Al hacer clic en el avatar, se abre el `<input type="file">` que llama a `FileReader` para convertir la imagen a Base64 y guarddarla en `store.userAvatar` mediante `GameCenter.setAvatar()`.

El avatar se persiste entre sesiones y dispositivos (si se usa la función de sincronización).

### Bono diario

El botón `#btn-daily` muestra el icono de regalo y el monto del bono. Su lógica completa vive en `app.js` (`updateDailyButton`, handler en `DOMContentLoaded`).

- **Activo:** Fondo dorado, habilitado, texto "Bono Diario (+20)".
- **Ya reclamado:** Opacidad al 50%, deshabilitado, texto "Vuelve mañana".
- Al reclamar: `#daily-msg` muestra el mensaje por 3 segundos con `opacity` animado.

El control de tiempo usa solo la **fecha** (no la hora) en formato `YYYY-MM-DD`, así el bono se resetea a medianoche sin importar la zona horaria exacta del dispositivo.

### Juegos

Cada juego es un `<article class="game-card">` con su portada como `background-image`. Los juegos actualmente integrados y sus identificadores para `completeLevel`:

| Nombre | `gameId` sugerido | Ruta |
|---|---|---|
| Vortex | `'shooter'` | `games/Shooter` |
| Word Hunt | `'wordsearch'` | `games/SopaDeLetras` |
| Pixel Drop | `'pixeldrop'` | `games/pixel_drop.html` |
| Laberinto | `'maze'` | `games/maze.html` |
| Rompecabezas | `'puzzle'` | `games/rompecabezas` |
| Dodger | `'dodger'` | `games/Dodger` |
| LoveBreaker | `'lovebreaker'` | `games/LoveBreaker` |

---

## 7. shop.html — Tienda

La página más compleja del proyecto. Toda la lógica específica de la tienda está en un bloque `<script>` inline al final del archivo, organizado en funciones claramente nombradas.

### Sistema de pestañas

4 pestañas controladas por la función `switchTab(name)`:

```
catalog   → #tab-catalog   (por defecto al cargar)
library   → #tab-library
sync      → #tab-sync
settings  → #tab-settings
```

Cada pestaña es un `<section class="tab-panel">` que alterna la clase `hidden`. Al entrar a `library`, se llama `renderLibrary(allItems)` para actualizar la biblioteca con el inventario actual.

---

### Catálogo con buscador y filtros

La función central es `filterItems()`. Se dispara en:
- `oninput` del `#search-input`
- `click` en cualquier `.pill`

```javascript
function filterItems() {
    const filtered = allItems.filter(item => {
        const matchesFilter = activeFilter === 'Todos' ||
            item.tags.includes(activeFilter);

        const matchesSearch = !searchQuery ||
            item.name.toLowerCase().includes(searchQuery)    ||
            item.desc.toLowerCase().includes(searchQuery)    ||
            item.tags.some(t => t.toLowerCase().includes(searchQuery));

        return matchesFilter && matchesSearch;
    });

    renderShop(filtered); // Re-renderiza solo los ítems filtrados
}
```

La búsqueda por texto busca coincidencias en **nombre**, **descripción** y **tags**. Los filtros de pill y la búsqueda de texto se aplican simultáneamente (lógica AND).

El botón de limpiar `#search-clear` (×) aparece solo cuando hay texto en el input y lo borra al hacer clic, restaurando el catálogo completo.

---

### La Bóveda de Descargas

La seguridad de la descarga se implementa en `GameCenter.getDownloadUrl()`:

```javascript
// Solo retorna la URL si el inventario confirma la posesión
getDownloadUrl: (itemId, fileName) => {
    if (!fileName) return null;
    return (store.inventory[itemId] || 0) > 0
        ? CONFIG.wallpapersPath + fileName
        : null;
}
```

Si `url` es `null`, `renderShop` y `renderLibrary` muestran un botón deshabilitado en lugar de un enlace de descarga. El archivo físico existe en el repositorio, pero el link nunca se expone en el HTML hasta que el ítem sea comprado.

---

### Mis Tesoros (Biblioteca)

`renderLibrary(items)` filtra los ítems del JSON por los IDs presentes en `store.inventory` con valor `> 0`:

```javascript
const owned = items.filter(item => inventory[item.id] > 0);
```

Si `owned.length === 0`, muestra un empty state con ícono y mensaje de invitación. Si hay ítems, renderiza una cuadrícula idéntica al catálogo pero sin precios ni filtros, con el botón verde de descarga como acción principal.

---

### Sincronización entre dispositivos

El sistema usa Base64 del JSON completo del store:

**Exportar:**
```javascript
btoa(unescape(encodeURIComponent(JSON.stringify(store))))
```
El doble encoding (`encodeURIComponent` + `unescape`) garantiza que los caracteres Unicode (como emojis en el saleLabel) no rompan el Base64.

**Importar:**
```javascript
JSON.parse(decodeURIComponent(escape(atob(code.trim()))))
```
Proceso inverso. Incluye validación mínima: si el objeto resultante no tiene `coins` como número, se rechaza con mensaje de error.

Al importar exitosamente, la página se recarga después de 1.2 segundos para aplicar el nuevo estado desde cero.

---

### Ajustes y selector de tema

El theme picker muestra 4 botones `.theme-btn`, cada uno con:
- Un `.theme-swatch` (círculo de color estático en el CSS)
- El nombre del tema
- Un `.theme-check` (ícono de check, visible solo en el botón activo)

Al hacer clic en un botón, `GameCenter.setTheme(key)` llama a `applyTheme(key)` que modifica las variables CSS y persiste la elección. El cambio es **instantáneo y global** — afecta a todos los acentos, botones, glows y bordes de toda la página sin recargar.

El panel de **estado de economía** es de solo lectura y refleja los valores actuales de `ECONOMY` en tiempo real al cargar la pestaña.

---

### Confetti y micro-interacciones

La librería `canvas-confetti` se carga vía CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js"></script>
```

Se dispara en dos situaciones:

**Compra exitosa** (`fireConfetti()`):
```javascript
// Ráfagas desde ambos laterales con la paleta de colores del tema
confetti({ particleCount: 60, angle: 60,  spread: 70, origin: { x: 0, y: 0.7 } });
confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
```

**Código promo canjeado:**
```javascript
confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 } });
```

Los **toasts** se inyectan en el `<body>` como divs con clase `.toast--success` o `.toast--error`. La animación de entrada/salida usa `requestAnimationFrame` + clases CSS con `transition: opacity, transform`.

---

## 8. styles.css — Sistema de Diseño

### Variables CSS (Design Tokens)

```css
:root {
    /* Fondo y superficies */
    --bg-main:       #0e0e12;   /* Fondo de la página */
    --surface:       #1a1d22;   /* Cards y paneles */
    --surface-hover: #23262b;   /* Hover de superficies */

    /* Glassmorphism */
    --glass-bg:     rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --glass-blur:   blur(12px);

    /* Acento (dinámico — sobreescrito por applyTheme) */
    --accent:       #9b59ff;
    --accent-hover: #9b59ffcc;
    --accent-glow:  rgba(155, 89, 255, 0.4);

    /* Jerarquía de texto */
    --text-high: #ffffff;   /* Títulos, texto principal */
    --text-med:  #c8c8d0;   /* Descripciones, subtítulos */
    --text-low:  #8a8a95;   /* Placeholders, metadatos */

    /* Geometría */
    --radius-lg: 20px;
    --radius-md: 12px;
    --nav-height: 70px;
    --bottom-nav-height: 65px;
}
```

Para **cambiar el fondo o las superficies** de forma global, basta con modificar `--bg-main` y `--surface` en `:root`.

---

### Componentes reutilizables

| Clase | Descripción |
|---|---|
| `.glass-panel` | Panel con efecto glassmorphism (fondo semitransparente + blur) |
| `.btn-primary` | Botón principal con color de acento |
| `.btn-ghost` | Botón secundario transparente con borde |
| `.coin-badge` | Badge dorado con ícono de estrella para mostrar saldo |
| `.shop-card` | Card de producto de la tienda |
| `.shop-grid` | Grid responsive de cards de tienda |
| `.games-grid` | Grid responsive de cards de juegos |
| `.owned-badge` | Badge verde "Tuyo" posicionado sobre la imagen de la card |
| `.vault-btn` | Botón verde de descarga (hereda de `.btn-primary`) |
| `.pill` / `.pill.active` | Chip de filtro redondeado |
| `.feedback-msg` | Párrafo de mensajes de estado con transición de opacidad |
| `.toast--success` / `.toast--error` | Notificación flotante temporal |
| `.theme-btn` / `.theme-btn--active` | Botón del selector de tema |
| `.sale-banner` | Banner de oferta con animación de shimmer |
| `.daily-btn` | Botón dorado del bono diario |

---

## 9. Flujos de Usuario

### Flujo de compra completo

```
Usuario ve una card en el Catálogo
        │
        ▼
Hace clic en "Canjear"
        │
        ▼
initiatePurchase(item) en shop.html
        │
        ├─ Calcula finalPrice y cashback con ECONOMY
        ├─ Muestra confirm() con precio final
        │
        ▼ (confirma)
GameCenter.buyItem(item)
        │
        ├─ Valida stock y saldo
        ├─ Descuenta finalPrice del saldo
        ├─ Suma cashback al saldo
        ├─ Añade al inventory y history
        └─ saveState() → localStorage
        │
        ▼
filterItems() → renderShop()
        │
        ├─ Card ahora muestra botón "Descargar" verde
        │
        ▼
fireConfetti()
        │
        ▼
showToast("¡Desbloqueado! +X cashback")
```

---

### Flujo de código promo

```
Usuaria escribe código en #promo-input
        │
        ▼
handleRedeem() → GameCenter.redeemPromoCode(code)
        │
        ├─ Normaliza: trim() + toUpperCase()
        ├─ Busca en PROMO_CODES
        ├─ Verifica que no esté en redeemedCodes
        │
        ├─ ÉXITO → suma reward + pushea a redeemedCodes
        │   └─ Toast + confetti + animación de contador
        │
        └─ ERROR → mensaje rojo + sacudida del botón
```

---

### Flujo de sincronización

```
EXPORTAR
────────
Usuaria hace clic en "Generar código"
        │
        ▼
GameCenter.exportSave()
        │
        ▼
btoa(encodeURIComponent(JSON.stringify(store)))
        │
        ▼
Texto en #export-output + auto-copia al portapapeles


IMPORTAR (en otro dispositivo)
──────────────────────────────
Usuaria pega código en #import-input
        │
        ▼
Confirm dialog: "¿Reemplazar partida actual?"
        │
        ▼
GameCenter.importSave(code)
        │
        ├─ atob() → JSON.parse() → validación
        ├─ store = { ...defaultState, ...data }
        └─ saveState() → reload() después de 1.2s
```

---

## 10. Códigos Promocionales

Los códigos viven en el objeto `PROMO_CODES` al inicio de `app.js`.

### Agregar un código nuevo

```javascript
const PROMO_CODES = {
    // ... códigos existentes ...
    'MI_CODIGO_NUEVO': 100,   // ← Nueva línea: 'CÓDIGO': monedas
};
```

Reglas:
- El código debe ser una string en **MAYÚSCULAS** (el sistema normaliza la entrada del usuario, pero la clave debe estar en mayúsculas para que coincida).
- El valor es la cantidad de monedas a otorgar.
- Una vez que un usuario canjea el código, se registra en `store.redeemedCodes` y no puede usarlo de nuevo.

---

### Lista completa de códigos

| Código | Monedas | Código | Monedas |
|---|---|---|---|
| `GOUL50` | 50 | `HAMI50` | 50 |
| `AMRO50` | 50 | `MA50` | 50 |
| `GOVE50` | 50 | `XI50` | 50 |
| `FU50` | 50 | `LADEHI50` | 50 |
| `GO50` | 50 | `HIGO50` | 50 |
| `GOBR50` | 50 | `KAWA50` | 50 |
| `CH50` | 50 | `SACAME` | 60 |
| `ASYA50` | 50 | `SAMUEL1000` | 1000 |
| `MINA50` | 50 | `FEB14` | 500 |
| `SA50` | 50 | `SOFYEK300` | 300 |
| `TRFU50` | 50 | `ERRORRC` | 200 |
| `VEZA50` | 50 | `JADO50` | 50 |
| `JADOUNO50` | 50 | `JADODOS50` | 50 |
| `JADOTRES50` | 50 | | |

---

## 11. Guía de Mantenimiento

### Agregar un wallpaper nuevo

**Paso 1 — Preparar los archivos:**
- Thumbnail: `assets/product-thumbs/{nombre}_{hash8}_thumbs.webp` (recomendado ~300×400px)
- Archivo descargable: `wallpapers/{nombre}_{hash8}.zip`

**Paso 2 — Añadir al JSON** (`data/shop.json`):
```json
{
    "id":    37,
    "name":  "Nombre del Wallpaper",
    "desc":  "Descripción corta del wallpaper.",
    "price": 500,
    "stock": 1,
    "image": "assets/product-thumbs/nombre_a1b2c3d4_thumbs.webp",
    "file":  "nombre_a1b2c3d4.zip",
    "tags":  ["Mobile", "Anime"]
}
```

> **Importante:** El `id` debe ser único y consecutivo. Nunca reutilizar un ID ya existente, aunque el ítem haya sido eliminado, para no confundir el inventario de usuarios que ya lo compraron.

**Paso 3 — Subir el commit.** No es necesario tocar ningún archivo `.js` ni `.html`.

---

### Activar una oferta especial

En `app.js`, editar el objeto `ECONOMY`:

```javascript
const ECONOMY = {
    isSaleActive:   true,        // ← Cambiar a true
    saleMultiplier: 0.80,        // ← Ajustar el descuento
    saleLabel:      'EVENTO 🎉', // ← Actualizar el texto
    cashbackRate:   0.10
};
```

Para desactivar, volver `isSaleActive: false`. Ver **[ECONOMIA.md](./ECONOMIA.md)** para más detalles.

---

### Cambiar el bono diario

En `app.js`, modificar `CONFIG.dailyReward`:

```javascript
const CONFIG = {
    stateKey:     'gamecenter_v6_promos',
    initialCoins: 0,
    dailyReward:  30,             // ← Era 20, ahora 30
    wallpapersPath: 'wallpapers/'
};
```

El texto del botón en `index.html` se actualiza automáticamente desde `updateDailyButton()` en `app.js`, así que solo hay que cambiar este número.

---

### Agregar un juego nuevo

**Paso 1 — Crear la portada:** `assets/cover/{nombre}_cover_art.webp`

**Paso 2 — Añadir la card en `index.html`:**
```html
<article class="game-card">
    <div class="card-cover" style="background-image: url('assets/cover/mi_juego_cover_art.webp');">
        <div class="card-badge badge-new">NUEVO</div>
    </div>
    <div class="card-info">
        <h3 class="card-title">Mi Juego</h3>
        <p class="card-desc">Descripción breve del juego.</p>
        <a href="games/MiJuego" class="btn-primary w-full">
            <i data-lucide="play"></i> Jugar Ahora
        </a>
    </div>
</article>
```

**Paso 3 — Integrar GameCenter en el juego.** El juego debe cargar `app.js` y llamar:
```javascript
// Al completar un nivel
const result = window.GameCenter.completeLevel('mi_juego', 'nivel_1', 50);
if (result.paid) console.log('¡+50 monedas!');
```

---

## 12. Seguridad y Limitaciones

| Aspecto | Estado | Detalle |
|---|---|---|
| **Manipulación del saldo** | ⚠️ Posible | Un usuario puede editar `localStorage` directamente desde las DevTools del navegador. Por diseño, esto es aceptable: la plataforma es para una usuaria de confianza. |
| **Links de descarga** | ✅ Protegidos en UI | `getDownloadUrl()` no expone el link si el ítem no está en el inventario. Sin embargo, los archivos físicos en `/wallpapers/` son accesibles si se conoce la URL directa. |
| **Códigos promo** | ⚠️ Visibles en source | `PROMO_CODES` está en el código fuente JavaScript. Un usuario técnico podría verlos inspeccionando el bundle. |
| **Exportar/Importar** | ✅ Validado | El importador valida que el JSON tenga la estructura mínima esperada antes de aplicarlo. |
| **Integridad del store** | ✅ Merge seguro | El sistema siempre hace merge con `defaultState`, nunca reemplaza ciegamente. Campos faltantes se inicializan con valores por defecto. |

> **Filosofía:** Esta plataforma está diseñada para un entorno de confianza, no para uso público masivo. La "seguridad" es de UX (ocultar links), no criptográfica.

---

## 13. Compatibilidad

| Tecnología | Versión mínima soportada |
|---|---|
| Chrome | 88+ |
| Firefox | 85+ |
| Safari | 14+ |
| Edge | 88+ |
| Hosting | Cualquier servidor de archivos estáticos (GitHub Pages, Netlify, etc.) |
| Backend requerido | ❌ Ninguno |
| Dependencias externas | Lucide Icons (CDN), canvas-confetti (CDN) |
| Frameworks | ❌ Ninguno (vanilla JS) |

---

## 14. Glosario

| Término | Definición |
|---|---|
| **Store** | El objeto JavaScript en memoria que contiene todo el estado del usuario. Se persiste en `localStorage`. |
| **GameCenter** | La API pública (`window.GameCenter`) que expone todos los métodos del motor. |
| **Bóveda** | El sistema que valida el inventario antes de entregar un link de descarga. |
| **Cashback** | Devolución automática de un porcentaje de monedas tras cada compra. |
| **Daily** | Bono diario: cantidad fija de monedas reclamable una vez cada 24 horas. |
| **Partida** | El estado completo del usuario serializado en Base64, usado para sincronización. |
| **Acento** | El color principal variable (`--accent`) que define la identidad visual del tema activo. |
| **stateKey** | La clave de `localStorage` donde se guarda el estado: `'gamecenter_v6_promos'`. |
| **Phase 1** | Versión v7.0: Bóveda, Biblioteca, Sincronización, Avatar, Daily Bonus. |
| **Phase 2** | Versión v7.2: Búsqueda/Filtros, Economía avanzada, Temas, Confetti, Micro-interacciones. |

---

*Love Arcade · Documentación técnica v7.2 · Phase 2*
*Arquitectura: vanilla JS + localStorage · Sin backend · Compatible con GitHub Pages*
