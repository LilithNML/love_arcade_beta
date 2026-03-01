# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v8.1 · Phase 5: Daily Claim Security & UX Hardening

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Novedades en v8.0](#2-novedades-en-v80)
2b. [Novedades en v8.1](#2b-novedades-en-v81--daily-claim-security--ux-hardening)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [app.js — El Motor](#5-appjs--el-motor)
6. [sync-worker.js — Web Worker](#6-sync-workerjs--web-worker)
7. [shop.json — El Catálogo](#7-shopjson--el-catálogo)
8. [index.html — Dashboard](#8-indexhtml--dashboard)
9. [shop.html — Tienda](#9-shophtml--tienda)
10. [styles.css — Sistema de Diseño Mobile-First](#10-stylescss--sistema-de-diseño-mobile-first)
11. [Códigos Promocionales (SHA-256)](#11-códigos-promocionales-sha-256)
12. [Sistema de Racha (Streaks)](#12-sistema-de-racha-streaks)
13. [Bendición Lunar](#13-bendición-lunar)
14. [Wishlist — Funcionalidad Completa](#14-wishlist--funcionalidad-completa)
15. [Sincronización con Archivo .txt](#15-sincronización-con-archivo-txt)
16. [Historial de Transacciones](#16-historial-de-transacciones)
17. [Flujos de Usuario](#17-flujos-de-usuario)
18. [Guía de Mantenimiento](#18-guía-de-mantenimiento)
19. [Seguridad y Limitaciones](#19-seguridad-y-limitaciones)
20. [Compatibilidad](#20-compatibilidad)
21. [Glosario](#21-glosario)

---

## 1. Visión General

Love Arcade es una **plataforma de recompensas sin backend** construida con HTML, CSS y JavaScript vanilla. Funciona como un sistema de fidelización gamificado: el usuario gana monedas virtuales jugando minijuegos o canjeando códigos, y las utiliza para desbloquear wallpapers en la tienda.

**Principios de diseño:**

- **Sin servidor.** Todo el estado vive en `localStorage`. No hay llamadas a APIs externas.
- **Mobile-First.** Los estilos base en `styles.css` corresponden a pantallas móviles. Los overrides para desktop se definen con `@media (min-width: 768px)`.
- **Arquitectura de isla única.** `app.js` es el único archivo de lógica compartida.
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
| **Tiempo de red** | Nueva función `getNetworkTime()` consulta `worldtimeapi.org` antes de cada reclamo. Si falla, usa `Date.now()` con `verified: false`. |
| **Reloj desincronizado** | Si la discrepancia entre red y reloj local supera 5 minutos, el reclamo se bloquea con el mensaje "Reloj desincronizado". |
| **Lógica de día** | Sustituido el contador de 24 h exactas por **días calendario**. El bono está disponible a las 00:00:00 del día siguiente al último reclamo. |
| **Fórmula de racha** | `diffDays === 1` → streak+1 · `diffDays > 1` → reset a 1 · `diffDays === 0` → ya reclamado. Calculado con `setHours(0,0,0,0)` para comparar medianoche contra medianoche. |
| **Race condition** | El botón `#btn-daily` se pone a `disabled = true` de forma **síncrona** antes de cualquier `await`, evitando múltiples reclamos por doble clic. |
| **Feedback visual** | El texto del botón cambia a `"Procesando..."` mientras la Promise está pendiente. Se restaura por `updateDailyButton()` al finalizar. |
| **Saltos negativos** | Si `currentTime < lastClaimTime` (manipulación de reloj), se bloquea el reclamo y se muestra un mensaje informativo. La racha no se reinicia. |
| **Unverified mode** | Si `getNetworkTime()` retorna `verified: false`, se permite el reclamo base pero se bloquea el bonus de Bendición Lunar. |

---

## 3. Arquitectura del Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                               │
│                                                                 │
│   index.html              shop.html                             │
│   (Dashboard)             (Tienda)                              │
│        │                       │                                │
│        └──────────┬────────────┘                                │
│                   │                                             │
│              js/app.js                                          │
│          (Motor / API pública)                                  │
│                   │                              │              │
│            localStorage                 js/sync-worker.js      │
│       "gamecenter_v6_promos"            (Web Worker: Base64     │
│                   │                     + SHA-256 checksum)     │
│        data/shop.json                                           │
│        wallpapers/ (archivos)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Estructura de Archivos

```
love_arcade/
│
├── index.html              # Dashboard principal
├── shop.html               # Tienda completa (v8.0 Mobile-First)
├── styles.css              # Hoja de estilos global — Mobile-First (v8.0)
│
├── js/
│   ├── app.js              # Motor principal — GameCenter API v8.1 (Daily Claim Security)
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
    └── LoveBreaker/
```

---

## 5. app.js — El Motor

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

#### `getNetworkTime()` — nueva función asíncrona

```javascript
async function getNetworkTime()
// Returns: { time: number, verified: boolean, desynced: boolean }
```

Consulta `https://worldtimeapi.org/api/ip` con un timeout de 5 segundos.

| Campo | Descripción |
|---|---|
| `time` | Timestamp en ms a usar como "ahora" |
| `verified` | `true` si se obtuvo de la red, `false` si es fallback local |
| `desynced` | `true` si la diferencia red↔local supera `CLOCK_SKEW_LIMIT` (5 min) |

Constante asociada: `CLOCK_SKEW_LIMIT = 5 * 60 * 1000` (ms).

#### `claimDaily()` — ahora `async`

Antes devolvía un objeto síncrono. Ahora retorna una `Promise` e integra cuatro capas de validación en orden:

1. **Salto negativo** (`now < lastClaim`): bloquea sin tocar la racha.
2. **Reloj desincronizado** (`desynced === true`): bloquea con advertencia.
3. **Día calendario** (diff via `setHours(0,0,0,0)`): reemplaza el contador de 24 h exactas.
4. **Bonus Lunar bloqueado** si `verified === false`: se otorga el reclamo base pero sin el bonus de Bendición Lunar.

```javascript
// Signature
async claimDaily(): Promise<{
    success: boolean,
    reward?: number,
    baseReward?: number,
    moonBonus?: number,
    streak?: number,
    verified: boolean,
    message: string
}>
```

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

## 8. index.html — Dashboard

**Cambio en v8.0:** El `<span class="moon-blessing-badge">` que anteriormente contenía el emoji `🌙` ahora contiene un icono Lucide:

```html
<!-- v7.5 (anterior) -->
<span class="moon-blessing-badge hidden" title="Bendición Lunar activa">🌙</span>

<!-- v8.0 (actual) -->
<span class="moon-blessing-badge hidden" title="Bendición Lunar activa">
    <i data-lucide="moon" size="14" color="#c084fc"></i>
</span>
```

El icono SVG ya se renderiza al inicio por `lucide.createIcons()` en el DOMContentLoaded. La función `updateMoonBlessingUI()` solo muestra/oculta el `<span>` mediante la clase `hidden`, sin modificar su contenido.

---

## 9. shop.html — Tienda

### Cambios en v8.0

**Filtros de categoría simplificados:**

```html
<!-- v8.0: solo Todos / PC / Mobile / Mis Lista -->
<button class="pill active" data-filter="Todos">Todos</button>
<button class="pill" data-filter="PC">
    <i data-lucide="monitor" size="11"></i> PC
</button>
<button class="pill" data-filter="Mobile">
    <i data-lucide="smartphone" size="11"></i> Mobile
</button>
<button class="pill pill--wishlist" data-filter="Wishlist">
    <i data-lucide="heart" size="11"></i> Mis Lista
</button>
```

**Indicador de coste de Wishlist:**

```html
<div id="wishlist-cost-banner" class="wishlist-cost-banner hidden">
    <i data-lucide="heart" size="13" fill="currentColor" style="color:#ff4f7a;"></i>
    <span id="wishlist-cost-text"></span>
</div>
```

Se actualiza automáticamente al cargar el catálogo y cada vez que el usuario modifica su Wishlist.

**Wishlist button (icono Lucide):**

```html
<!-- v7.5 (anterior) -->
<button class="wishlist-btn">♥</button>

<!-- v8.0 (actual) -->
<button class="wishlist-btn wishlist-btn--active">
    <i data-lucide="heart" size="13"></i>
</button>
```

El relleno del corazón se controla por CSS:
```css
.wishlist-btn--active svg path { fill: currentColor !important; }
```

**Sección de Sincronización (exportar):**

El `<textarea id="export-output">` fue eliminado. El flujo es ahora:
1. Clic en "Exportar y descargar" → `handleExport()` async.
2. `navigator.clipboard.writeText(code)` — copia al portapapeles.
3. `new Blob([code], {type:'text/plain'})` → `URL.createObjectURL()` → descarga automática del archivo `love-arcade-backup-YYYY-MM-DD.txt`.

**Sección de Sincronización (importar):**

```html
<!-- Carga por archivo (sin bloqueo de hilo) -->
<label for="import-file" class="btn-ghost file-label">
    <i data-lucide="file-up" size="15"></i> Cargar archivo .txt
</label>
<input type="file" id="import-file" accept=".txt" hidden>
<span id="import-file-name" class="file-name-display">Ningún archivo seleccionado</span>

<!-- Separador -->
<div class="sync-separator">o pega el código manualmente</div>

<!-- Textarea como fallback manual -->
<textarea id="import-input" class="sync-textarea"></textarea>
```

El listener de `#import-file` usa `FileReader.readAsText()` para leer el archivo en el hilo principal de forma no bloqueante y vuelca el contenido en el `<textarea>`.

**Emojis reemplazados:**

| Elemento | v7.5 | v8.0 |
|---|---|---|
| Moon badge en navbar | `🌙` en `<span>` | `<i data-lucide="moon">` |
| Moon badge en hero | `🌙` en `<span>` | `<i data-lucide="moon">` |
| Icono del panel "Bendición Lunar" | `<span>🌙</span>` | `<i data-lucide="moon">` |
| Botón moon blessing | `'Activar Bendición Lunar (100 🪙)'` | `<i data-lucide="moon"> + <span>` |
| Wishlist button | `♥` / `♡` texto | `<i data-lucide="heart">` |
| Monedas en economy row | `100 🪙` | `100 monedas` (texto plano) |

---

## 10. styles.css — Sistema de Diseño Mobile-First

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

## 11. Códigos Promocionales (SHA-256)

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

## 12. Sistema de Racha (Streaks)

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

## 13. Bendición Lunar

Sin cambios funcionales en v8.0. La representación visual migra de emoji a icono Lucide.

| Parámetro | Valor |
|---|---|
| Costo de activación | 100 monedas |
| Efecto | +90 monedas por cada reclamo diario |
| Vigencia | 7 días reales desde la activación |
| Indicador UI | Icono `<i data-lucide="moon">` animado junto al saldo |

### Restricción v8.1: modo Unverified

Si `getNetworkTime()` no puede contactar la API (red caída, timeout), el reclamo diario se procesa igualmente con el reloj local (`verified: false`), **pero el bonus de Bendición Lunar no se otorga**. Esto previene que un usuario desconectado de internet abuse del buff deshábilitando la red para eludir la verificación temporal.

El historial registra la operación con la nota `(tiempo sin verificar)` para auditoría.

---

## 14. Wishlist — Funcionalidad Completa

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

## 15. Sincronización con Archivo .txt

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

## 16. Historial de Transacciones

Sin cambios en v8.0. Cada operación que modifica el saldo genera una entrada en `store.history`:

```javascript
{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado',       fecha: timestamp }
{ tipo: 'gasto',   cantidad: 88,  motivo: 'Compra: Rouge the Bat',  fecha: timestamp }
{ tipo: 'ingreso', cantidad: 9,   motivo: 'Cashback: Rouge the Bat', fecha: timestamp }
```

El store mantiene un máximo de 150 entradas. La pestaña Ajustes muestra las 50 más recientes con scroll.

---

## 17. Flujos de Usuario

### Flujo de Bono Diario (v8.1)

```
Usuario hace clic en #btn-daily
    │
    ▼ [SÍNCRONO — antes de cualquier await]
btn.disabled = true  ·  texto → "Procesando..."
    │
    ▼
getNetworkTime()  →  consulta worldtimeapi.org (timeout: 5 s)
    ├── Éxito  →  { time: networkTs, verified: true,  desynced: false/true }
    └── Error  →  { time: Date.now(), verified: false, desynced: false }
    │
    ▼ [Validaciones en orden]
1. now < lastClaim?
   └── SÍ → "Se detectó una inconsistencia horaria…"  [racha intacta, sin reclamo]
2. desynced === true?
   └── SÍ → "Reloj desincronizado…"  [bloqueo total]
3. diffDays === 0? (mismo día calendario)
   └── SÍ → "¡Ya reclamaste tu bono hoy!"  [bloqueo]
    │
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

## 18. Guía de Mantenimiento

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

## 19. Seguridad y Limitaciones

| Aspecto | Estado v8.1 | Detalle |
|---|---|---|
| **Códigos promo** | ✅ Protegidos | Hash SHA-256. El texto plano no es visible en el código fuente. |
| **Integridad de sync** | ✅ Checksum | Partidas editadas manualmente son rechazadas al importar (incluyendo archivos .txt). |
| **Manipulación del saldo** | ⚠️ Posible | Un usuario puede editar `localStorage` directamente. Aceptable por diseño en plataforma de confianza. |
| **Importación de archivos** | ✅ Validado | FileReader solo lee el contenido; sync-worker.js verifica el checksum SHA-256 antes de aplicar. |
| **LocalStorage key** | ✅ Intocable | `'gamecenter_v6_promos'` no debe modificarse jamás para no perder el progreso de usuarios existentes. |
| **Bono diario — reloj local** | ✅ Mitigado | `getNetworkTime()` contrasta el reloj local con `worldtimeapi.org`. Discrepancia > 5 min bloquea el reclamo. |
| **Bono diario — modo offline** | ✅ Degradado gracefully | Si la API de tiempo no responde, se usa el reloj local con `verified: false`. El bonus de Bendición Lunar queda bloqueado en este modo. |
| **Salto negativo de reloj** | ✅ Detectado | Si `now < lastClaimTime`, el reclamo se bloquea con mensaje informativo. La racha no se reinicia. |
| **Double-tap / race condition** | ✅ Prevenido | El botón `#btn-daily` se desactiva síncronamente antes de cualquier `await`, imposibilitando múltiples reclamos simultáneos. |

---

## 20. Compatibilidad

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

## 21. Glosario

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
| **getNetworkTime** | Función async (v8.1) que consulta `worldtimeapi.org` para obtener un timestamp verificado externamente. |
| **verified** | Campo del objeto retornado por `getNetworkTime`. `true` si el tiempo viene de la red; `false` si es fallback local. |
| **desynced** | Campo del objeto retornado por `getNetworkTime`. `true` si la diferencia entre reloj local y red supera 5 minutos. |
| **Día Natural** | Modelo de reset de bono diario (v8.1) basado en días calendario (medianoche). Reemplaza el contador de 24 h exactas. |
| **Race condition** | Condición de carrera donde múltiples clics rápidos disparan varias llamadas a `claimDaily()`. Prevenida en v8.1 desactivando el botón síncronamente. |
| **CLOCK_SKEW_LIMIT** | Constante (5 min en ms). Umbral máximo de discrepancia tolerable entre reloj local y de red. |

---

*Love Arcade · Documentación técnica v8.1 · Phase 5: Daily Claim Security & UX Hardening*
*Arquitectura: vanilla JS + localStorage · Sin backend · Compatible con GitHub Pages*
