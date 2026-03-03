# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v9.0 · Phase 6: SPA Architecture

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Novedades en v8.0](#2-novedades-en-v80)
2b. [Novedades en v8.1](#2b-novedades-en-v81--daily-claim-security--ux-hardening)
2c. [Novedades en v9.0](#2c-novedades-en-v90--spa-architecture)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [app.js — El Motor](#5-appjs--el-motor)
6. [router.js — El Router SPA](#6-routerjs--el-router-spa)
7. [sync-worker.js — Web Worker](#7-sync-workerjs--web-worker)
8. [shop.json — El Catálogo](#8-shopjson--el-catálogo)
9. [index.html — Shell SPA](#9-indexhtml--shell-spa)
10. [shop.html — Standalone (Legacy)](#10-shophtml--standalone-legacy)
11. [styles.css — Sistema de Diseño Mobile-First](#11-stylescss--sistema-de-diseño-mobile-first)
12. [Códigos Promocionales (SHA-256)](#12-códigos-promocionales-sha-256)
13. [Sistema de Racha (Streaks)](#13-sistema-de-racha-streaks)
14. [Bendición Lunar](#14-bendición-lunar)
15. [Wishlist — Funcionalidad Completa](#15-wishlist--funcionalidad-completa)
16. [Sincronización con Archivo .txt](#16-sincronización-con-archivo-txt)
17. [Historial de Transacciones](#17-historial-de-transacciones)
18. [Flujos de Usuario](#18-flujos-de-usuario)
19. [Guía de Mantenimiento](#19-guía-de-mantenimiento)
20. [Añadir una Nueva Sección (Minijuegos, etc.)](#20-añadir-una-nueva-sección)
21. [Seguridad y Limitaciones](#21-seguridad-y-limitaciones)
22. [Compatibilidad](#22-compatibilidad)
23. [Glosario](#23-glosario)

---

## 1. Visión General

Love Arcade es una **plataforma de recompensas sin backend** construida con HTML, CSS y JavaScript vanilla. Funciona como un sistema de fidelización gamificado: el usuario gana monedas virtuales jugando minijuegos o canjeando códigos, y las utiliza para desbloquear wallpapers en la tienda.

**Principios de diseño:**

- **Sin servidor.** Todo el estado vive en `localStorage`. No hay llamadas a APIs externas excepto el tiempo de red para el bono diario.
- **Mobile-First.** Los estilos base en `styles.css` corresponden a pantallas móviles.
- **SPA (Single-Page Application).** A partir de v9.0, toda la navegación ocurre dentro de un único documento HTML sin recargas de página. El motor de vistas vive en `js/router.js`.
- **Motor centralizado.** `js/app.js` es el único archivo de lógica compartida. Ninguna vista tiene acceso directo al store.
- **Compatibilidad retroactiva.** `migrateState()` garantiza que ningún usuario pierda datos al actualizar.
- **Configuración centralizada.** `ECONOMY`, `THEMES`, `CONFIG` y `PROMO_CODES_HASHED` están al inicio de `app.js`.

---

## 2. Novedades en v8.0

| Área | Cambio |
|---|---|
| **CSS** | Reescrito con arquitectura Mobile-First. |
| **UI Móvil** | Grilla de productos usa `repeat(2, 1fr)` como base. |
| **Iconografía** | Todos los emojis funcionales reemplazados por Lucide icons. |
| **Filtros** | Simplificados a: Todos, PC, Mobile y Lista de deseos. |
| **Wishlist** | Filtro, indicador de coste y prioridad en ordenamiento. |
| **Sync** | Exportación descarga `.txt` automáticamente + copia al portapapeles. Importación con `FileReader` para archivos `.txt`. |

---

## 2b. Novedades en v8.1 — Daily Claim Security & UX Hardening

| Área | Cambio |
|---|---|
| **Tiempo de red** | `getNetworkTime()` consulta `worldtimeapi.org`. Fallback a `Date.now()` con `verified: false`. |
| **Reloj desincronizado** | Discrepancia > 5 min bloquea el reclamo. |
| **Lógica de día** | Días calendario (00:00:00). |
| **Fórmula de racha** | `diffDays=1` → streak+1 · `diffDays>1` → reset · `diffDays=0` → ya reclamado. |
| **Race condition** | Botón `#btn-daily` se deshabilita síncronamente antes de cualquier `await`. |
| **Saltos negativos** | Bloquea el reclamo sin reiniciar racha si se detecta manipulación de reloj. |

---

## 2c. Novedades en v9.0 — SPA Architecture

| Área | Cambio |
|---|---|
| **Navegación** | Sin recargas de página. El paso entre Inicio y Tienda es una transición CSS en el mismo documento. |
| **Hash Routing** | URLs con fragmento: `#/` (Inicio), `#/shop` (Tienda). Compatible con los botones Atrás/Adelante del navegador (Deep Linking). |
| **Shell permanente** | La Navbar superior y el Bottom Nav son parte del `index.html` raíz y nunca se desmontan. El saldo de monedas se mantiene reactivo en todo momento. |
| **Ciclo de vida de vistas** | Cada vista tiene `template()`, `init()` y `teardown()`. El Router llama a `teardown()` de la vista anterior antes de montar la nueva. |
| **Transiciones** | Fade-out de 180ms + fade-in de 220ms con `opacity` y `transform` en `#view-container`. |
| **`js/router.js`** | Nuevo archivo. Contiene la clase `Router`, `HomeView`, `ShopView` y el registro de rutas. |
| **Event delegation en app.js** | Los listeners del botón de bono diario, temas y Bendición Lunar se mueven de `DOMContentLoaded` a delegación desde `document`. Esto garantiza que funcionen aunque los elementos sean desmontados y remontados por el router. |
| **Scroll a secciones** | Los links "Juegos" y "Ayuda" del navbar detectan si el usuario no está en Home y navegan primero a `/` antes de hacer scroll. |
| **Escalabilidad** | Añadir una nueva sección es registrar un objeto de vista en `AppRouter._views` con su ruta. Ver §20. |

---

## 3. Arquitectura del Proyecto

```
┌──────────────────────────────────────────────────────────────────┐
│                          NAVEGADOR                               │
│                                                                  │
│   index.html  ← Shell SPA (navbar, bottom-nav, #view-container) │
│        │                                                         │
│        ├── js/app.js         Motor / API pública (window.GameCenter)
│        │       │                                                 │
│        │   localStorage                                          │
│        │  "gamecenter_v6_promos"                                 │
│        │       │                                                 │
│        │   js/sync-worker.js  Web Worker: Base64 + SHA-256       │
│        │                                                         │
│        └── js/router.js      Router SPA + Vistas (HomeView / ShopView)
│                │                                                 │
│           #view-container  ← Punto de montaje dinámico          │
│                │                                                 │
│           data/shop.json   ← Catálogo de wallpapers             │
│           wallpapers/      ← Archivos de descarga               │
└──────────────────────────────────────────────────────────────────┘
```

### Flujo de navegación SPA

```
Usuario hace clic en "Tienda"
         │
         ▼
href="#/shop" → hashchange event
         │
         ▼
Router._onHashChange() detecta "#/shop"
         │
         ▼
ShopView.teardown() de vista anterior (si hay)
         │
         ▼
#view-container.innerHTML = ShopView.template()
         │
         ▼
lucide.createIcons() re-renderiza iconos
         │
         ▼
ShopView.init() → fetch shop.json, listeners, render
         │
         ▼
window.GameCenter (instancia única) ya tiene el saldo correcto
El coin-display de la navbar se actualiza reactivamente.
```

---

## 4. Estructura de Archivos

```
love-arcade/
├── index.html              ← Shell SPA (único punto de entrada)
├── shop.html               ← Versión standalone legacy (fallback)
├── styles.css              ← Sistema de diseño
│
├── js/
│   ├── app.js              ← Motor: GameCenter, Economy, Themes
│   ├── router.js           ← Router SPA + HomeView + ShopView
│   └── sync-worker.js      ← Web Worker para exportar/importar
│
├── data/
│   └── shop.json           ← Catálogo de wallpapers
│
├── assets/
│   ├── cover/              ← Portadas de juegos
│   ├── product-thumbs/     ← Miniaturas de wallpapers (shop.json apunta aquí)
│   └── default_avatar.png
│
└── wallpapers/             ← Archivos de descarga
```

> **Cambios respecto a v8.x:** `app.js` y `router.js` ahora viven en `js/`. La carpeta `js/` consolida todo el JavaScript de la plataforma.

---

## 5. app.js — El Motor

`js/app.js` es el núcleo de Love Arcade. Expone `window.GameCenter` como API pública.

### Objetos de configuración

```javascript
const CONFIG = { stateKey, initialCoins, dailyReward, dailyStreakCap, dailyStreakStep, wallpapersPath }
const ECONOMY = { isSaleActive, saleMultiplier, saleLabel, cashbackRate }  // → window.ECONOMY
const THEMES  = { violet, pink, cyan, gold, crimson }                      // → window.THEMES
const PROMO_CODES_HASHED = { [sha256_hash]: reward, ... }
```

### API pública — window.GameCenter

| Método | Descripción |
|---|---|
| `completeLevel(gameId, levelId, coins)` | Registra nivel completado y acredita monedas. Idempotente. |
| `buyItem(itemData)` | Compra un wallpaper aplicando descuento y cashback. |
| `getBoughtCount(id)` | Retorna cuántas veces fue comprado un ítem (0 o 1). |
| `getBalance()` | Saldo actual del usuario. |
| `getInventory()` | Copia del inventario completo. |
| `getDownloadUrl(itemId, fileName)` | URL de descarga o `null` si no es propietario. |
| `toggleWishlist(itemId)` | Alterna favorito; retorna estado actual. |
| `isWishlisted(itemId)` | `true` si el ítem está en la lista de deseos. |
| `getHistory()` | Historial de transacciones (orden inverso). |
| `redeemPromoCode(code)` | Async. Canjea código promo (SHA-256). |
| `claimDaily()` | Async. Reclama bono diario con verificación de tiempo de red. |
| `canClaimDaily()` | `true` si el bono está disponible (reloj local). |
| `getStreakInfo()` | `{ streak, nextReward, canClaim }`. |
| `buyMoonBlessing()` | Activa/extiende Bendición Lunar (100 monedas). |
| `getMoonBlessingStatus()` | `{ active, expiresAt, remainingMs }`. |
| `exportSave()` | Async. Genera código Base64 con checksum SHA-256. |
| `importSave(code)` | Async. Valida e importa un código. |
| `setAvatar(dataUrl)` | Guarda y aplica el avatar del usuario. |
| `getAvatar()` | Devuelve el dataUrl del avatar guardado. |
| `setTheme(key)` | Aplica un tema de color a toda la plataforma. |
| `getTheme()` | Clave del tema activo. |

### Cambios en v9.0

El bloque `DOMContentLoaded` en `app.js` migró de listeners directos a **delegación de eventos**:

```javascript
// ANTES (v8.x) — no funcionaba con SPA porque el botón no existe al cargar
const dailyBtn = document.getElementById('btn-daily');
if (dailyBtn) dailyBtn.addEventListener('click', handler);

// AHORA (v9.0) — funciona sin importar cuándo se monte la vista
document.addEventListener('click', async (e) => {
    const dailyBtn = e.target.closest('#btn-daily');
    if (dailyBtn && !dailyBtn.disabled) { /* handler */ }
});
```

Esto cubre: bono diario (`#btn-daily`), botones de tema (`.theme-btn`) y Bendición Lunar (`#btn-moon-blessing`).

---

## 6. router.js — El Router SPA

`js/router.js` implementa el sistema de navegación y contiene la definición de todas las vistas.

### Clase Router

```javascript
const AppRouter = new Router({
    '/':     HomeView,
    '/shop': ShopView,
});
window.AppRouter = AppRouter; // Accesible desde juegos integrados
```

| Método | Descripción |
|---|---|
| `AppRouter.navigate('/shop')` | Navega programáticamente a una ruta. |
| `AppRouter.currentRoute()` | Ruta activa actual (ej: `'/shop'`). |
| `AppRouter.start()` | Arranca leyendo la URL actual. Se llama en `DOMContentLoaded`. |

### Interfaz de Vista

Cada vista es un objeto con tres métodos:

```javascript
const MiVista = {
    template() {
        // Retorna un string HTML que se inyecta en #view-container.
        return `<main class="container">...</main>`;
    },
    init() {
        // Se llama DESPUÉS de inyectar el HTML y renderizar iconos Lucide.
        // Aquí se adjuntan listeners, se hace fetch de datos, etc.
    },
    teardown() {
        // Se llama ANTES de desmontar la vista.
        // Limpiar intervals, remover listeners globales (document-level), etc.
    }
};
```

### Routing por Hash

| URL | Vista activa |
|---|---|
| `tudominio.com/` | HomeView (home por defecto) |
| `tudominio.com/#/` | HomeView |
| `tudominio.com/#/shop` | ShopView |

El router ignora anclas de scroll como `#games` o `#faq` (no comienzan con `#/`).

### Ciclo de vida completo

```
hashchange o start()
    │
    ▼
Router._mount(route)
    │
    ├─ #view-container fade-out (180ms)
    ├─ vistaAnterior.teardown()
    ├─ container.innerHTML = nuevaVista.template()
    ├─ lucide.createIcons()
    ├─ Router._syncNav(route) → actualiza clases .active en navbar
    ├─ container fade-in (220ms)
    └─ nuevaVista.init()
```

---

## 7. sync-worker.js — Web Worker

`js/sync-worker.js` ejecuta las operaciones pesadas de codificación Base64 y cálculo de checksums SHA-256 en un hilo separado para no bloquear la UI.

Acciones soportadas: `export` y `import`. El worker es instanciado por `getSyncWorker()` en `app.js` y comunicado mediante `workerTask(payload)`.

---

## 8. shop.json — El Catálogo

`data/shop.json` define el catálogo de wallpapers disponibles en la tienda.

```json
{
  "id": 1,
  "name": "Rouge the Bat",
  "price": 110,
  "image": "assets/product-thumbs/rouge_the_bat_a94a3cca_thumbs.webp",
  "file": "rouge_the_bat_a94a3cca.webp",
  "tags": ["Mobile"]
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `number` | Identificador único. **Nunca reutilizar.** |
| `name` | `string` | Nombre visible en la tarjeta. |
| `price` | `number` | Precio base en monedas (sin descuento). |
| `image` | `string` | Ruta a la miniatura de la tarjeta. |
| `file` | `string` | Nombre del archivo en `wallpapers/`. |
| `tags` | `string[]` | `"PC"` y/o `"Mobile"` para los filtros. |

---

## 9. index.html — Shell SPA

`index.html` es el **único punto de entrada** de la aplicación a partir de v9.0. Su responsabilidad es mínima:

- Cargar `styles.css`, Lucide y canvas-confetti.
- Renderizar la Navbar superior y el Bottom Nav (elementos permanentes).
- Proveer el `<div id="view-container">` donde el router inyecta las vistas.
- Cargar `js/app.js` y `js/router.js`.

**No contiene lógica de negocio.** Toda la lógica de vistas está en `router.js`.

### Estructura del shell

```html
<body>
  <nav class="navbar glass-panel">  ← Siempre visible
    <!-- coin-display, avatar-upload, nav-links con data-spa-route -->
  </nav>

  <nav class="bottom-nav">          ← Siempre visible (mobile)
    <!-- items con data-spa-route y js-scroll-home -->
  </nav>

  <div id="view-container">         ← Las vistas se inyectan aquí
    <!-- HomeView o ShopView -->
  </div>

  <script src="js/app.js"></script>
  <script src="js/router.js"></script>
</body>
```

### Atributos de navegación

| Atributo | Uso |
|---|---|
| `data-spa-route="/"` | El router sincroniza la clase `.active` de estos elementos. |
| `class="js-scroll-home"` | Links de anclaje (ej: `#games`, `#faq`). Si el usuario no está en home, el router navega a `/` primero y luego hace scroll. |

---

## 10. shop.html — Standalone (Legacy)

`shop.html` se mantiene como página independiente por **retrocompatibilidad y fallback**. Si un usuario accede directamente a `shop.html`, la tienda funciona exactamente igual que antes.

> ⚠️ **No se debe enlazar a `shop.html`** desde ningún punto de la SPA. Todos los links internos deben usar `href="#/shop"` o `AppRouter.navigate('/shop')`. Los links a `shop.html` causan recarga completa del navegador (comportamiento MPA que la v9.0 elimina).

---

## 11. styles.css — Sistema de Diseño Mobile-First

Sin cambios estructurales en v9.0. Se añadieron dos clases de transición de vista directamente en `index.html` como `<style>` inline para no requerir una actualización del archivo CSS principal:

```css
#view-container.view-exit  { opacity: 0; transform: translateY(8px); transition: 0.18s ease; }
#view-container.view-enter { opacity: 1; transform: translateY(0);   transition: 0.22s ease; }
```

---

## 12. Códigos Promocionales (SHA-256)

Los códigos se almacenan como hashes SHA-256 en `PROMO_CODES_HASHED` dentro de `app.js`. El código en texto plano nunca se guarda ni se compara directamente.

Para añadir un nuevo código:

```bash
echo -n "MICÓDIGO" | sha256sum
# Copia el hash en PROMO_CODES_HASHED con su recompensa
```

```javascript
// En app.js
const PROMO_CODES_HASHED = {
    'hash_sha256_del_codigo': 100,  // MICÓDIGO → 100 monedas
    // ...
};
```

---

## 13. Sistema de Racha (Streaks)

La racha se incrementa cuando el usuario reclama el bono en días consecutivos del calendario.

| Días sin reclamar | Efecto |
|---|---|
| 0 (mismo día) | Ya reclamado — sin efecto. |
| 1 (ayer) | `streak + 1` (continuación). |
| > 1 | `streak = 1` (reset). |

**Recompensa:** `20 + (streak - 1) × 5` monedas, con techo en 60.

---

## 14. Bendición Lunar

Buff temporal de **+90 monedas** por reclamo diario.

- **Costo:** 100 monedas.
- **Duración:** 7 días desde la activación.
- **Extensión:** Si ya está activa, suma 7 días al vencimiento actual.
- **Bloqueo offline:** Si `getNetworkTime()` retorna `verified: false`, el bonus lunar no se otorga (el reclamo base sí).
- **Indicador:** Ícono 🌙 en el `coin-badge` de la navbar mientras está activo.

---

## 15. Wishlist — Funcionalidad Completa

- Botón de corazón en cada tarjeta no comprada.
- Filtro "Lista de deseos" en el catálogo.
- Banner de coste total: muestra cuántas monedas faltan para toda la lista.
- Los ítems wishlisted aparecen primero en los resultados.
- Persistidos en `store.wishlist[]` como array de IDs.

---

## 16. Sincronización con Archivo .txt

La función `exportSave()` genera un código Base64 con checksum SHA-256 del estado completo del usuario. El flujo:

```
store → JSON.stringify → SHA-256 hash → { data, checksum } → Base64
```

Al importar, se verifica el checksum antes de aplicar cualquier cambio. Si el código fue editado manualmente, la importación es rechazada.

---

## 17. Historial de Transacciones

Cada operación que modifica el saldo registra una entrada en `store.history`:

```javascript
{ tipo: 'ingreso'|'gasto', cantidad: number, motivo: string, fecha: timestamp }
```

Máximo 150 entradas (las más recientes). Visible en Tienda → Ajustes → Historial.

---

## 18. Flujos de Usuario

### Flujo de compra (ShopView)

```
Clic en precio de tarjeta
  → _initiatePurchase(item)
  → _openConfirmModal() → await usuario
  → GameCenter.buyItem(item)
  → _filterItems() + _renderLibrary()  ← actualización reactiva sin reload
  → _fireConfetti() + _showToast()
```

### Flujo de navegación SPA

```
Clic en "Tienda" (href="#/shop")
  → hashchange
  → Router._mount('/shop')
  → HomeView.teardown() → clearInterval countdown
  → container.innerHTML = ShopView.template()
  → lucide.createIcons()
  → ShopView.init() → fetch shop.json, listeners
  → GameCenter.getBalance() ya tiene el valor correcto (misma instancia)
```

---

## 19. Guía de Mantenimiento

### Activar una oferta

```javascript
// js/app.js — objeto ECONOMY
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.8,      // 20% dto.
    saleLabel:      '20% OFF',
    cashbackRate:   0.1
};
```

Ver `ECONOMIA.md` para la guía completa de eventos.

### Añadir un wallpaper

1. Copiar la miniatura a `assets/product-thumbs/`.
2. Copiar el archivo de descarga a `wallpapers/`.
3. Añadir el objeto al array en `data/shop.json` con un `id` único mayor al máximo existente.

### Añadir un código promo

```bash
echo -n "NUEVOCÓDIGO" | sha256sum
```

Añadir el hash a `PROMO_CODES_HASHED` en `js/app.js`.

---

## 20. Añadir una Nueva Sección

Para añadir, por ejemplo, una vista de "Minijuegos":

### Paso 1 — Crear el objeto de vista en `js/router.js`

```javascript
const MinigamesView = {
    template() {
        return `
            <main class="container">
                <h2 class="section-title">Minijuegos</h2>
                <!-- contenido de la sección -->
            </main>`;
    },
    init() {
        // Adjuntar listeners, cargar datos, etc.
        console.log('Minijuegos montado');
    },
    teardown() {
        // Limpiar lo que sea necesario
    }
};
```

### Paso 2 — Registrarlo en el router

```javascript
const AppRouter = new Router({
    '/':          HomeView,
    '/shop':      ShopView,
    '/minigames': MinigamesView,  // ← Nueva ruta
});
```

### Paso 3 — Añadir el link en `index.html`

```html
<!-- En .nav-links -->
<li><a href="#/minigames" class="nav-link" data-spa-route="/minigames">Minijuegos</a></li>

<!-- En .bottom-nav -->
<a href="#/minigames" class="b-nav-item" data-spa-route="/minigames">
    <i data-lucide="joystick" size="20"></i>
    <span>Minijuegos</span>
</a>
```

El router sincronizará automáticamente la clase `.active` en los elementos con `data-spa-route`.

---

## 21. Seguridad y Limitaciones

- **Sin backend:** El sistema confía completamente en `localStorage`. Un usuario técnico podría editar el estado directamente. El checksum SHA-256 en exportaciones/importaciones previene la transferencia de datos manipulados entre dispositivos, pero no protege el localStorage local.
- **Tiempo de red:** La verificación con `worldtimeapi.org` puede fallar en redes restrictivas. En ese caso, se usa el reloj local y el bono lunar queda bloqueado.
- **Web Worker:** Si el navegador no soporta Workers, las operaciones de sync se ejecutan en el hilo principal como fallback síncrono.
- **Hash routing vs. Path routing:** Se usa `#/` (hash) en vez de paths limpios (`/shop`) para evitar requerir configuración de servidor (redirecciones 404 → index.html). Esto es intencional y adecuado para despliegues en hosting estático.

---

## 22. Compatibilidad

| Tecnología | Requerimiento |
|---|---|
| JavaScript | ES2020+ (optional chaining, nullish coalescing, Promise, async/await) |
| CSS | Custom Properties, Grid, Flexbox, backdrop-filter |
| Lucide | CDN `unpkg.com/lucide@latest` |
| canvas-confetti | CDN `cdn.jsdelivr.net` |
| Web Workers | Soporte moderno (fallback síncrono incluido) |
| crypto.subtle | HTTPS requerido para SHA-256 |
| Hash Routing | Todos los navegadores modernos |

---

## 23. Glosario

| Término | Definición |
|---|---|
| **SPA** | Single-Page Application. Aplicación que carga una sola vez y actualiza el contenido dinámicamente sin recargar la página. |
| **Shell** | La estructura HTML permanente (navbar, bottom-nav, view-container) que nunca se desmonta. |
| **Vista** | Objeto JS con `template()`, `init()` y `teardown()`. Representa una "página" dentro de la SPA. |
| **Hash Routing** | Sistema de navegación que usa el fragmento `#` de la URL (`#/shop`) para identificar la vista activa. No requiere configuración de servidor. |
| **Deep Linking** | Capacidad de acceder directamente a una sección mediante su URL (ej: `tuapp.com/#/shop`). |
| **store** | Objeto JS interno que refleja el estado del usuario. Se persiste en `localStorage` con la clave `gamecenter_v6_promos`. |
| **ECONOMY** | Objeto de configuración de descuentos y cashback. Modificable por el administrador en `js/app.js`. |
| **Cashback** | Devolución automática de un porcentaje del precio pagado al saldo del usuario. |
| **Racha (Streak)** | Contador de días consecutivos de reclamo del bono diario. |
| **Bendición Lunar** | Buff temporal (+90 monedas/día) que se activa por 100 monedas. |
| **Teardown** | Función de limpieza que se ejecuta antes de desmontar una vista (limpiar intervals, listeners globales, etc.). |
| **Event Delegation** | Patrón de manejo de eventos donde el listener se adjunta a un ancestro (ej: `document`) en vez de al elemento específico, permitiendo que funcione incluso si el elemento es reemplazado dinámicamente. |
