# 📚 Documentación Técnica — Love Arcade
### Plataforma de Recompensas · v7.5 · Phase 3: Security & Gamification

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Novedades en v7.5](#2-novedades-en-v75)
3. [Arquitectura del Proyecto](#3-arquitectura-del-proyecto)
4. [Estructura de Archivos](#4-estructura-de-archivos)
5. [app.js — El Motor](#5-appjs--el-motor)
   - [Configuración global](#configuración-global)
   - [Migración silenciosa](#migración-silenciosa)
   - [El Store (estado)](#el-store-estado)
   - [API pública: window.GameCenter](#api-pública-windowgamecenter)
   - [Sistema de temas](#sistema-de-temas)
   - [Sistema de economía](#sistema-de-economía)
6. [sync-worker.js — Web Worker](#6-sync-workerjs--web-worker)
7. [shop.json — El Catálogo](#7-shopjson--el-catálogo)
8. [index.html — Dashboard](#8-indexhtml--dashboard)
9. [shop.html — Tienda](#9-shophtml--tienda)
10. [styles.css — Sistema de Diseño](#10-stylescss--sistema-de-diseño)
11. [Códigos Promocionales (SHA-256)](#11-códigos-promocionales-sha-256)
    - [Cómo funcionan ahora](#cómo-funcionan-ahora)
    - [Agregar un código nuevo](#agregar-un-código-nuevo)
    - [Lista de hashes actuales](#lista-de-hashes-actuales)
12. [Sistema de Racha (Streaks)](#12-sistema-de-racha-streaks)
13. [Bendición Lunar](#13-bendición-lunar)
14. [Historial de Transacciones](#14-historial-de-transacciones)
15. [Wishlist](#15-wishlist)
16. [Sincronización con Checksum](#16-sincronización-con-checksum)
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
- **Arquitectura de isla única.** `app.js` es el único archivo de lógica compartida.
- **Compatibilidad retroactiva.** La función `migrateState()` garantiza que ningún usuario pierda datos al actualizar.
- **Configuración centralizada.** `ECONOMY`, `THEMES`, `CONFIG` y `PROMO_CODES_HASHED` están al inicio de `app.js`.

---

## 2. Novedades en v7.5

| Área | Cambio |
|---|---|
| **Seguridad** | Los códigos promocionales se comparan por hash SHA-256. El texto plano ya no es legible en el código fuente. |
| **Seguridad** | La exportación de partida incluye un checksum SHA-256. Cualquier edición manual invalida el código. |
| **Rendimiento** | Las operaciones de exportación/importación se delegan a un Web Worker (`sync-worker.js`) para no bloquear el hilo principal. |
| **Rendimiento** | La búsqueda en el catálogo usa `debounce(300ms)` para reducir operaciones de DOM en móvil. |
| **Rendimiento** | Skeleton screens visibles mientras se carga `shop.json`, eliminando el parpadeo de "Cargando...". |
| **Gamificación** | Sistema de racha de bono diario con premios escalonados (+5 monedas por día, tope 60). |
| **Gamificación** | Bendición Lunar: buff temporal de +90 monedas por reclamo diario, activo 7 días por 100 monedas. |
| **Datos** | Wishlist persistente por ítem con icono de corazón en las cards. |
| **Datos** | Historial de transacciones estructurado `{tipo, cantidad, motivo, fecha}` visible en Ajustes. |
| **UI/UX** | Nuevo tema "Carmesí Arcade" (`#e11d48`). |
| **UI/UX** | Animación `shake` en el botón y precio cuando el saldo es insuficiente. |
| **UI/UX** | Icono de luna 🌙 animado junto al saldo cuando la Bendición Lunar está activa. |
| **Accesibilidad** | Contraste `--text-med` elevado en temas Rosa Neón y Cyan para cumplir WCAG AA (ratio ≥ 4.5:1). |
| **Migración** | `migrateState()` convierte automáticamente `lastDaily` (string) → `daily.lastClaim` (timestamp). |

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
│                   │                           │                 │
│            localStorage              js/sync-worker.js         │
│       "gamecenter_v6_promos"         (Web Worker: Base64        │
│                   │                  + SHA-256 checksum)        │
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
├── shop.html               # Tienda completa
├── styles.css              # Hoja de estilos global
│
├── js/
│   ├── app.js              # Motor principal — GameCenter API v7.5
│   └── sync-worker.js      # Web Worker — Base64 + checksum SHA-256
│
├── data/
│   └── shop.json           # Catálogo de wallpapers
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

### Configuración global

```javascript
const CONFIG = {
    stateKey:       'gamecenter_v6_promos', // ← NO modificar jamás
    initialCoins:   0,
    dailyReward:    20,      // Monedas base (día 1 de racha)
    dailyStreakCap: 60,      // Máximo de monedas por bono diario
    dailyStreakStep: 5,      // Incremento por día de racha consecutivo
    wallpapersPath: 'wallpapers/'
};
```

> ⚠️ `stateKey` nunca debe modificarse. Cambiarla haría que todos los usuarios pierdan su progreso.

---

### Migración silenciosa

La función `migrateState(loadedStore)` se ejecuta **siempre** al inicializar el store, antes de cualquier otra operación. Garantiza que los datos de versiones anteriores sean compatibles sin sobrescribir nada:

```javascript
function migrateState(loadedStore) {
    const defaults = {
        coins:          0,
        progress:       { maze: [], wordsearch: [], secretWordsFound: [] },
        inventory:      {},
        redeemedCodes:  [],    // Legado (v6-v7.2): lista de códigos en texto
        redeemedHashes: [],    // v7.5: hashes SHA-256 de códigos canjeados
        history:        [],
        userAvatar:     null,
        theme:          'violet',
        wishlist:       [],
        daily:          { lastClaim: 0, streak: 0 },
        buffs:          { moonBlessingExpiry: 0 }
    };
    const merged = { ...defaults, ...loadedStore };
    // Convierte lastDaily (v7.2) → daily.lastClaim (v7.5)
    if (merged.lastDaily && merged.daily.lastClaim === 0) { ... }
    return merged;
}
```

---

### El Store (estado)

Estructura completa del store v7.5:

```javascript
{
    // ── Core ────────────────────────────────────────────────
    coins:   450,
    progress: { maze: ['level_1'], wordsearch: ['word_set_1'] },
    inventory: { 1: 1, 15: 1 },

    // ── Códigos promo ────────────────────────────────────────
    redeemedCodes:  ['FEB14'],          // Legado: texto plano (historial)
    redeemedHashes: ['79de29d2...'],    // v7.5: hashes SHA-256

    // ── Historial (v7.5 formato estructurado) ────────────────
    history: [
        { tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado',      fecha: 1708000000000 },
        { tipo: 'gasto',   cantidad: 110, motivo: 'Compra: Rouge the Bat', fecha: 1708001000000 },
        { tipo: 'ingreso', cantidad: 11,  motivo: 'Cashback: Rouge the Bat', fecha: 1708001000001 }
    ],

    // ── Perfil ───────────────────────────────────────────────
    userAvatar: 'data:image/png;base64,...',
    theme: 'violet',   // 'violet' | 'pink' | 'cyan' | 'gold' | 'crimson'

    // ── Wishlist (v7.5) ──────────────────────────────────────
    wishlist: [3, 7, 21],

    // ── Bono diario con racha (v7.5) ─────────────────────────
    daily: {
        lastClaim: 1708000000000,  // Timestamp del último reclamo
        streak:    5               // Días consecutivos
    },

    // ── Buffs (v7.5) ─────────────────────────────────────────
    buffs: {
        moonBlessingExpiry: 1708604800000  // Timestamp de vencimiento
    }
}
```

---

### API pública: window.GameCenter

#### `GameCenter.completeLevel(gameId, levelId, rewardAmount)`
Sin cambios respecto a v7.2. Registra un nivel y otorga monedas. Idempotente.

#### `GameCenter.buyItem(itemData)` → `{success, finalPrice, cashback}`
Sin cambios. Ahora también registra una entrada en `store.history` con formato estructurado.

#### `GameCenter.redeemPromoCode(inputCode)` → `Promise<{success, reward?, message}>`
**Ahora es asíncrona (retorna una Promise).** Internamente hashea el código con SHA-256 antes de comparar. Los llamadores deben usar `await`.

```javascript
// Uso correcto en shop.html
const result = await GameCenter.redeemPromoCode('FEB14');
```

#### `GameCenter.claimDaily()` → `{success, reward, baseReward, moonBonus, streak, message}`
Implementa la lógica de racha. Devuelve información detallada del reclamo.

#### `GameCenter.getStreakInfo()` → `{streak, nextReward, canClaim}`
Devuelve el estado de la racha actual sin consumirla.

#### `GameCenter.buyMoonBlessing()` → `{success, expiresAt?, reason?}`
Activa la Bendición Lunar por 100 monedas durante 7 días. Si ya está activa, extiende su vigencia.

#### `GameCenter.getMoonBlessingStatus()` → `{active, expiresAt, remainingMs}`
Consulta el estado del buff sin modificarlo.

#### `GameCenter.toggleWishlist(itemId)` → `boolean`
Añade o quita un ítem de la wishlist. Devuelve `true` si quedó en favoritos.

#### `GameCenter.isWishlisted(itemId)` → `boolean`
Consulta si un ítem está en la wishlist.

#### `GameCenter.getHistory()` → `Array`
Devuelve el historial de transacciones en orden cronológico inverso (máx. 50 entradas).

#### `GameCenter.exportSave()` → `Promise<string>`
**Ahora es asíncrona.** Genera un código Base64 con checksum SHA-256. Delega al Web Worker cuando está disponible.

#### `GameCenter.importSave(code)` → `Promise<{success, message?}>`
**Ahora es asíncrona.** Valida el checksum antes de aplicar el estado. Rechaza códigos editados manualmente.

---

### Sistema de temas

Se añade el tema **Carmesí Arcade** al objeto `THEMES`:

```javascript
const THEMES = {
    violet:  { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:    { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:    { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:    { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' },
    crimson: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)',   name: 'Carmesí Arcade' }  // ← NUEVO
};
```

---

## 6. sync-worker.js — Web Worker

El archivo `js/sync-worker.js` maneja las operaciones pesadas de sincronización en un hilo separado para no bloquear la UI.

**Mensajes soportados:**

| `action`   | Payload requerido          | Resultado devuelto                          |
|------------|---------------------------|---------------------------------------------|
| `'export'` | `{ store, salt }`          | `string` — código Base64 con checksum       |
| `'import'` | `{ code, salt }`           | `{ data, valid, legacy }` — store + validez |

**Ejemplo de uso desde `app.js`:**

```javascript
// Exportar (usado internamente por GameCenter.exportSave)
const code = await workerTask({ action: 'export', store, salt: SYNC_SALT });

// Importar (usado internamente por GameCenter.importSave)
const result = await workerTask({ action: 'import', code, salt: SYNC_SALT });
if (!result.valid) { /* rechazar */ }
```

El worker tiene un fallback: si `new Worker(...)` falla (p. ej., por restricciones del servidor), las operaciones se ejecutan en el hilo principal usando `sha256()` directamente.

---

## 7. shop.json — El Catálogo

Sin cambios estructurales. Cada ítem tiene:

```json
{
    "id":    1,
    "name":  "Rouge the Bat",
    "desc":  "La espía de G.U.N. para que le de estilo a tu teléfono.",
    "price": 110,
    "stock": 1,
    "image": "assets/product-thumbs/rouge_the_bat_a94a3cca_thumbs.webp",
    "file":  "rouge_the_bat_a94a3cca.webp",
    "tags":  ["Mobile", "Gaming", "Sonic"]
}
```

---

## 8. index.html — Dashboard

**Cambios en v7.5:**

- El `.coin-badge` incluye un elemento `<span class="moon-blessing-badge hidden">🌙</span>` que `app.js` hace visible cuando la Bendición Lunar está activa.
- El botón de bono diario ahora muestra la racha actual cuando está bloqueado (ej. "Vuelve mañana · Racha: 5 🔥") y la recompensa esperada cuando está disponible.
- Las FAQ se actualizaron para documentar la racha, la Bendición Lunar y el checksum de sincronización.

---

## 9. shop.html — Tienda

**Cambios en v7.5:**

- **Skeleton screens** — Seis `.skeleton-card` se muestran mientras `shop.json` carga y se ocultan al renderizar el grid real.
- **Debounce en búsqueda** — El listener de `#search-input` usa `debounce(filterItems, 300)` en lugar de llamar a `filterItems()` en cada keystroke.
- **Wishlist** — Cada card incluye un botón `.wishlist-btn` con icono ♡/♥. El estado se sincroniza con `GameCenter.toggleWishlist()`.
- **Shake en error** — Cuando `buyItem()` falla por saldo insuficiente, se aplica la clase `.anim-shake` al botón y al elemento de precio.
- **Promo code async** — `handleRedeem()` es `async` y usa `await GameCenter.redeemPromoCode()`. El botón se deshabilita durante el proceso.
- **Sync async** — `handleExport()` y `handleImport()` son `async` y muestran estado de carga ("Generando código…", "Verificando integridad…") mientras trabajan.
- **Ajustes ampliados** — La pestaña Ajustes incluye tres nuevos paneles: Bendición Lunar, y el Historial de Transacciones.
- **Tema Carmesí** — Nuevo botón en el selector de tema (`data-theme="crimson"`).
- **Moon Blessing badge** — El `.coin-badge` de la navbar incluye el badge de luna.

---

## 10. styles.css — Sistema de Diseño

**Cambios en v7.5:**

### Nuevo tema: Carmesí Arcade
El tema usa variables CSS `--accent: #e11d48` y `--accent-glow: rgba(225, 29, 72, 0.4)`. Se activa con `data-theme="crimson"` y se aplica vía `applyTheme()`.

### Corrección de contraste WCAG AA
Los temas Rosa Neón y Cyan Arcade ahora eleva `--text-med` a `#d8d8e0` (ratio ≈ 5.2:1) y `--text-low` a `#a0a0ae` (ratio ≈ 4.6:1) mediante el selector `[data-theme="pink"], [data-theme="cyan"]`. Esto cumple el estándar WCAG AA de 4.5:1 sobre fondos oscuros de vidrio.

> **Nota:** El atributo `data-theme` se aplica al `<html>` para que el selector CSS funcione correctamente. Actualmente `applyTheme()` cambia variables CSS en `:root` pero no escribe el atributo. Para activar los overrides de contraste, añadir `document.documentElement.setAttribute('data-theme', key)` dentro de `applyTheme()` en `app.js` si se desea usar esta funcionalidad.

### Skeleton screens
```css
@keyframes skeleton-loading {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
```
Las clases `.skeleton-card`, `.skeleton-img` y `.skeleton-line` imitan la estructura de una card real con animación de pulso.

### Shake animation
```css
@keyframes shake { /* 7 keyframes, duración 0.45s */ }
.anim-shake { animation: shake 0.45s ease-in-out; }
```

### Wishlist
`.wishlist-btn` — botón circular posicionado en la esquina superior derecha de cada card.
`.wishlist-btn--active` — estado activo (corazón lleno, color rosa).

### Bendición Lunar
`.moon-btn` — gradiente morado→rosa.
`.eco-badge--moon` — badge morado para mostrar el estado del buff.
`.moon-blessing-badge` — icono 🌙 con animación de pulso.

### Historial
`.history-list`, `.history-entry`, `.history-icon`, `.history-detail`, `.history-amount` — componentes para la tabla de transacciones con scroll vertical.

---

## 11. Códigos Promocionales (SHA-256)

### Cómo funcionan ahora

En v7.2 y anteriores, `PROMO_CODES` almacenaba pares `{ 'CODIGO': monedas }` en texto plano. Cualquier usuario con acceso a las DevTools podía ver todos los códigos válidos inspeccionando el JavaScript.

En v7.5, `PROMO_CODES_HASHED` almacena el **hash SHA-256 del código** como clave. El flujo es:

```
Usuario escribe "FEB14"
       ↓
sha256("FEB14") → "79de29d2..."
       ↓
PROMO_CODES_HASHED["79de29d2..."] === 500 ✅
       ↓
Se otorgan 500 monedas. El hash se guarda en store.redeemedHashes.
```

Un usuario que inspeccione el código fuente solo verá hashes hexadecimales de 64 caracteres, sin poder deducir el texto original a partir de ellos.

---

### Agregar un código nuevo

**Paso 1 — Calcular el hash SHA-256 del código en MAYÚSCULAS:**

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
    'HASH_DE_64_CARACTERES_AQUI': 150,   // MICODIGO → 150 monedas
};
```

> ⚠️ El código que el usuario escribe siempre se normaliza con `.trim().toUpperCase()`. El hash debe calcularse del texto **exactamente en mayúsculas y sin espacios**.

---

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

> Los hashes completos se encuentran en `app.js` dentro de `PROMO_CODES_HASHED`.

---

## 12. Sistema de Racha (Streaks)

El bono diario ya no es una cantidad fija de 20 monedas. Ahora escala según los días consecutivos de reclamo:

**Fórmula:**
```
recompensa = min(dailyReward + (streak - 1) × dailyStreakStep, dailyStreakCap)
           = min(20 + (streak - 1) × 5, 60)
```

| Día de racha | Recompensa base |
|---|---|
| 1 | 20 |
| 2 | 25 |
| 3 | 30 |
| 4 | 35 |
| 5 | 40 |
| 6 | 45 |
| 7+ | 60 (tope) |

**Reglas de mantenimiento de racha:**

- **< 24h** desde el último reclamo → Bloqueado.
- **Entre 24h y 48h** → La racha continúa (`streak + 1`).
- **> 48h** → La racha se reinicia a 1 (`streak = 1`).

**Almacenamiento:**

```javascript
store.daily = {
    lastClaim: 1708000000000,  // Timestamp ms del último reclamo exitoso
    streak:    5               // Días consecutivos acumulados
}
```

---

## 13. Bendición Lunar

La Bendición Lunar es un buff temporal de pago que amplifica el bono diario.

**Especificaciones:**

| Parámetro | Valor |
|---|---|
| Costo de activación | 100 monedas |
| Efecto | +90 monedas por cada reclamo diario |
| Vigencia | 7 días reales desde la activación |
| Extensión | Si ya está activa, la nueva duración se añade desde el vencimiento actual |
| Indicador UI | Icono 🌙 animado junto al saldo en navbar y hero de tienda |

**API:**

```javascript
// Activar (o extender)
const result = GameCenter.buyMoonBlessing();
// { success: true, expiresAt: '27 de febrero de 2026' }

// Consultar estado
const status = GameCenter.getMoonBlessingStatus();
// { active: true, expiresAt: '27 de febrero de 2026', remainingMs: 604800000 }
```

**Almacenamiento:**

```javascript
store.buffs = {
    moonBlessingExpiry: 1708604800000  // Timestamp de vencimiento. 0 = inactiva.
}
```

---

## 14. Historial de Transacciones

Cada operación que modifica el saldo genera una entrada en `store.history`:

```javascript
// Formato v7.5 (nuevo)
{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado',       fecha: 1708001000000 }
{ tipo: 'gasto',   cantidad: 88,  motivo: 'Compra: Rouge the Bat',  fecha: 1708002000000 }
{ tipo: 'ingreso', cantidad: 9,   motivo: 'Cashback: Rouge the Bat', fecha: 1708002000001 }
{ tipo: 'ingreso', cantidad: 35,  motivo: 'Bono diario · racha 4',   fecha: 1708003000000 }
```

El historial se renderiza en la pestaña Ajustes de `shop.html` con hasta 50 entradas visibles y scroll vertical. El store mantiene un máximo de 150 entradas para no inflar el `localStorage`.

---

## 15. Wishlist

Los usuarios pueden marcar ítems como favoritos con el icono ♡/♥ en cada card del catálogo.

**API:**

```javascript
GameCenter.toggleWishlist(itemId)  // → true si quedó en wishlist
GameCenter.isWishlisted(itemId)    // → boolean
```

**Almacenamiento:**

```javascript
store.wishlist = [3, 7, 21]  // Array de IDs numéricos
```

La wishlist se persiste en `localStorage` y sobrevive recarga. No tiene límite de ítems.

---

## 16. Sincronización con Checksum

A partir de v7.5, los códigos de exportación incluyen un checksum SHA-256 para detectar ediciones manuales:

**Formato del payload (antes de codificar en Base64):**

```json
{
    "data":     { /* store completo */ },
    "checksum": "b7f3a2...64 chars"
}
```

El checksum se calcula como `sha256(JSON.stringify(store) + SYNC_SALT)` donde `SYNC_SALT` es una constante interna.

**En la importación:** Si el hash del `data` recibido no coincide con el `checksum` del payload, la importación se rechaza con el mensaje "El código fue modificado manualmente. Importación rechazada."

**Compatibilidad con v7.2:** Si el código no tiene campo `checksum` (formato legado), se acepta de todas formas pero con aviso de formato heredado. Esto permite que usuarios con partidas antiguas migren sin perder datos.

---

## 17. Flujos de Usuario

### Flujo de bono diario (v7.5)

```
Usuaria hace clic en "Bono Diario"
           │
           ▼
GameCenter.claimDaily()
           │
           ├─ ¿msSince < 24h?  → Rechazado + mensaje "Vuelve mañana"
           │
           ├─ ¿msSince < 48h?  → streak++
           └─ ¿msSince ≥ 48h?  → streak = 1
                       │
                       ▼
           baseReward = min(20 + (streak-1)×5, 60)
                       │
                       ▼
           ¿moonBlessingExpiry > now?
               Sí → totalReward = baseReward + 90
               No → totalReward = baseReward
                       │
                       ▼
           store.coins += totalReward
           store.daily = { lastClaim: now, streak }
           logTransaction('ingreso', totalReward, ...)
                       │
                       ▼
           updateUI() → contador animado
```

### Flujo de código promo (v7.5)

```
Usuaria escribe código → hace clic en "Canjear"
            │
            ▼
handleRedeem() — async
            │
            ▼
GameCenter.redeemPromoCode(code) — await
            │
            ├─ sha256(code.trim().toUpperCase())
            │
            ├─ hash en PROMO_CODES_HASHED? No → "Código inválido"
            │
            ├─ hash en redeemedHashes?    Sí → "Ya canjeaste este código"
            │
            └─ Otorgar reward → push hash → logTransaction → saveState
                        │
                        ▼
             Toast + confetti + animación de contador
```

### Flujo de sincronización con checksum (v7.5)

```
EXPORTAR
────────
Clic en "Generar código" → handleExport() async
    │
    ▼
GameCenter.exportSave() → workerTask({action:'export', store, salt})
    │
    ▼  [en sync-worker.js]
json = JSON.stringify(store)
checksum = sha256(json + salt)
payload = {data: store, checksum}
encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
    │
    ▼
Mostrar código + copiar al portapapeles

IMPORTAR
────────
Pegar código → clic en "Importar"
    │
    ▼
GameCenter.importSave(code) → workerTask({action:'import', code, salt})
    │
    ▼  [en sync-worker.js]
json = atob(code) → JSON.parse()
expected = sha256(JSON.stringify(data) + salt)
payload.checksum === expected? No → rechazar
                               Sí → store = migrateState(data) → saveState()
```

---

## 18. Guía de Mantenimiento

### Agregar un wallpaper nuevo

1. Preparar archivos: `assets/product-thumbs/{nombre}_{hash8}_thumbs.webp` y `wallpapers/{nombre}_{hash8}.webp`.
2. Añadir entrada en `data/shop.json` con ID consecutivo único.
3. Subir el commit. No es necesario tocar JS ni HTML.

### Activar una oferta especial

En `app.js`, editar el objeto `ECONOMY`. Ver `ECONOMIA.md` para referencia completa.

### Agregar un código promo nuevo

1. Calcular hash: `python3 -c "import hashlib; print(hashlib.sha256(b'MICODIGO').hexdigest())"`.
2. Añadir `'<hash>': <monedas>` en `PROMO_CODES_HASHED` dentro de `app.js`.

### Cambiar el bono diario base

Modificar `CONFIG.dailyReward`. El texto del botón se actualiza automáticamente via `updateDailyButton()`.

### Cambiar el tope o el paso de racha

```javascript
const CONFIG = {
    dailyStreakCap:  60,  // ← Máximo de monedas por día
    dailyStreakStep:  5,  // ← Incremento por día de racha
};
```

### Agregar un juego nuevo

1. Crear portada: `assets/cover/{nombre}_cover_art.webp`.
2. Añadir card en `index.html`.
3. Integrar GameCenter en el juego con `window.GameCenter.completeLevel(gameId, levelId, coins)`.

---

## 19. Seguridad y Limitaciones

| Aspecto | Estado v7.5 | Detalle |
|---|---|---|
| **Códigos promo** | ✅ Protegidos | Se comparan por hash SHA-256. El texto plano no es visible en el código fuente. |
| **Integridad de sync** | ✅ Checksum | Partidas editadas manualmente son rechazadas al importar. |
| **Manipulación del saldo** | ⚠️ Posible | Un usuario puede editar `localStorage` directamente. Por diseño, esto es aceptable en una plataforma de confianza. |
| **Links de descarga** | ✅ Protegidos en UI | `getDownloadUrl()` no expone el link sin inventario. Los archivos físicos son accesibles por URL directa. |
| **Exportar/Importar** | ✅ Validado | Checksum + `migrateState()` garantizan estructura correcta. |

---

## 20. Compatibilidad

| Tecnología | Versión mínima |
|---|---|
| Chrome | 89+ (SubtleCrypto + Workers) |
| Firefox | 87+ |
| Safari | 15+ |
| Edge | 89+ |
| Hosting | Cualquier servidor estático (GitHub Pages, Netlify) |
| Backend | ❌ Ninguno |
| Dependencias | Lucide Icons (CDN), canvas-confetti (CDN) |

> Los Web Workers requieren que los archivos se sirvan desde un servidor HTTP (no funciona con `file://`). En desarrollo local se recomienda usar `npx serve .` o la extensión Live Server de VS Code.

---

## 21. Glosario

| Término | Definición |
|---|---|
| **Store** | El objeto JavaScript en memoria que contiene todo el estado del usuario. Se persiste en `localStorage`. |
| **GameCenter** | La API pública (`window.GameCenter`) con todos los métodos del motor. |
| **Checksum** | Hash SHA-256 del store exportado, incluido en el código de sincronización para detectar edición manual. |
| **Racha / Streak** | Días consecutivos en que se reclama el bono diario. Determina la recompensa escalonada. |
| **Bendición Lunar** | Buff temporal de +90 monedas por reclamo diario. Costo 100 monedas, vigencia 7 días. |
| **Wishlist** | Lista de ítems marcados como favoritos con el icono ♥. |
| **Skeleton Screen** | Placeholder visual con animación de pulso que imita la estructura de las cards mientras carga el JSON. |
| **Debounce** | Técnica que retrasa la ejecución de una función hasta que el usuario deja de interactuar. Usado en la búsqueda. |
| **Bóveda** | El sistema que valida el inventario antes de entregar un link de descarga. |
| **Cashback** | Devolución automática de un porcentaje de monedas tras cada compra. |
| **SYNC_SALT** | Constante interna usada para calcular checksums de sincronización. |
| **migrateState** | Función que fusiona el store cargado con los defaults de la versión actual sin sobrescribir datos. |
| **stateKey** | La clave de `localStorage`: `'gamecenter_v6_promos'`. No debe modificarse jamás. |
| **Phase 3** | Versión v7.5: Seguridad SHA-256, Web Workers, racha, Bendición Lunar, wishlist, historial, Carmesí. |

---

*Love Arcade · Documentación técnica v7.5 · Phase 3: Security & Gamification*
*Arquitectura: vanilla JS + localStorage · Sin backend · Compatible con GitHub Pages*
