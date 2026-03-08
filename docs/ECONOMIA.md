# 💰 Guía de Economía — Ofertas y Cashback
### Love Arcade · Sistema de Recompensas

---

## Tabla de Contenidos

1. [¿Cómo funciona el sistema de economía?](#1-cómo-funciona-el-sistema-de-economía)
2. [El objeto ECONOMY](#2-el-objeto-economy)
3. [Ofertas (Descuentos Globales)](#3-ofertas-descuentos-globales)
   - [Activar una oferta](#activar-una-oferta)
   - [Cambiar el porcentaje de descuento](#cambiar-el-porcentaje-de-descuento)
   - [Personalizar el mensaje de oferta](#personalizar-el-mensaje-de-oferta)
   - [Desactivar la oferta](#desactivar-la-oferta)
4. [Cashback](#4-cashback)
   - [¿Cómo funciona exactamente?](#cómo-funciona-exactamente)
   - [Cambiar el porcentaje de cashback](#cambiar-el-porcentaje-de-cashback)
   - [Desactivar el cashback](#desactivar-el-cashback)
5. [Combinando ofertas y cashback](#5-combinando-ofertas-y-cashback)
6. [Ejemplos de eventos especiales](#6-ejemplos-de-eventos-especiales)
7. [Referencia rápida de valores](#7-referencia-rápida-de-valores)

---

## 1. ¿Cómo funciona el sistema de economía?

El sistema de economía de Love Arcade está diseñado para ser **controlado desde un único lugar** en el código: el objeto `ECONOMY` al inicio de `app.js`. No requiere tocar la lógica de compra, ni los HTMLs, ni el JSON de productos.

Cuando una usuaria compra un wallpaper, la función `buyItem` de `app.js` consulta ese objeto en tiempo real para calcular:

1. **El precio final** — aplicando el descuento si hay una oferta activa.
2. **El cashback** — devolviendo un porcentaje al saldo tras la compra.

```
Precio final = precio_original × saleMultiplier   (si isSaleActive = true)
Cashback     = precio_final × cashbackRate
Costo neto   = precio_final − cashback
```

> **Ejemplo:** Wallpaper de 1000 monedas · oferta del 20% · cashback del 10%
> - Precio con oferta: 1000 × 0.8 = **800 monedas**
> - Cashback: 800 × 0.1 = **80 monedas devueltas**
> - Costo neto real: 800 − 80 = **720 monedas**

---

## 2. El objeto ECONOMY

Se encuentra en las primeras líneas de `app.js`, después de `CONFIG`:

```javascript
// app.js — línea ~20
// NOTA: el estado de isSaleActive en el código puede diferir del que se muestra
// aquí como ejemplo. Verifica el archivo app.js para conocer el estado actual en producción.
const ECONOMY = {
    isSaleActive:   false,    // ¿Hay oferta activa ahora mismo?
    saleMultiplier: 0.8,      // Factor de precio (0.8 = 20% de descuento)
    saleLabel:      '20% OFF', // Texto del badge y banner de oferta
    cashbackRate:   0.1        // Porcentaje de devolución (0.1 = 10%)
};
```

Este objeto está también expuesto globalmente como `window.ECONOMY` para que `shop-logic.js` y cualquier módulo de la SPA pueda leerlo sin importaciones adicionales.

---

## 3. Ofertas (Descuentos Globales)

### Activar una oferta

Cambia `isSaleActive` a `true`. Eso es todo. El resto del sistema reacciona automáticamente:

```javascript
const ECONOMY = {
    isSaleActive:   true,     // ← CAMBIO
    saleMultiplier: 0.9,
    saleLabel:      '10% OFF',
    cashbackRate:   0.1
};
```

Con este cambio en producción:

| Elemento UI | Comportamiento |
|---|---|
| Banner superior de la tienda | Aparece con animación de shimmer rojo |
| Cards del catálogo | Muestran precio tachado + precio en verde + badge "OFERTA" |
| Pestaña Ajustes | Panel de economía refleja el descuento activo |
| Función `buyItem` | Descuenta el precio final (no el original) del saldo |
| Toast de compra | Incluye el monto de cashback recibido |

---

### Cambiar el porcentaje de descuento

`saleMultiplier` es un multiplicador del precio. La fórmula mental es:

```
saleMultiplier = 1 − (descuento_deseado / 100)
```

| Descuento deseado | Valor de saleMultiplier |
|---|---|
| 5% | `0.95` |
| **10%** | **`0.90`** ← valor por defecto |
| 15% | `0.85` |
| 20% | `0.80` |
| 25% | `0.75` |
| 30% | `0.70` |
| 50% | `0.50` |

**Ejemplo — Oferta del 30%:**

```javascript
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.70,      // ← 30% de descuento
    saleLabel:      '30% OFF', // ← Actualizar también el texto
    cashbackRate:   0.1
};
```

> ⚠️ **Importante:** Actualiza siempre `saleLabel` para que coincida visualmente con el multiplicador que estás usando.

---

### Personalizar el mensaje de oferta

`saleLabel` es el texto que aparece en el badge de las cards y en el banner superior. Puede ser cualquier string corto:

```javascript
// Ejemplos de saleLabel
saleLabel: '20% OFF'          // Descuento genérico
saleLabel: 'SAN VALENTÍN ❤️'  // Evento temático
saleLabel: 'FLASH SALE'       // Urgencia
saleLabel: 'OFERTA ESPECIAL'  // Genérico en español
saleLabel: '2×1'              // Aunque no sea literalmente 2×1, queda bien visualmente
```

El banner también construye su descripción automáticamente combinando el porcentaje calculado desde `saleMultiplier` con el `cashbackRate`:

```javascript
// shop-logic.js — función initSaleBanner()
const discount = Math.round((1 - eco.saleMultiplier) * 100);
// "20% de descuento en toda la tienda + 10% de cashback."
```

Si quieres cambiar ese texto de descripción del banner, edita directamente `initSaleBanner()` en `shop-logic.js`.

---

### Desactivar la oferta

```javascript
const ECONOMY = {
    isSaleActive: false, // ← Oferta desactivada
    // El resto de valores se ignoran mientras isSaleActive sea false
    saleMultiplier: 0.o,
    saleLabel:      '10% OFF',
    cashbackRate:   0.1
};
```

El banner desaparece, los precios vuelven a su valor original y los badges de oferta dejan de renderizarse. **El cashback sigue activo** porque es independiente de la oferta.

---

## 4. Cashback

### ¿Cómo funciona exactamente?

El cashback es una **devolución automática de monedas** que se aplica en el mismo instante de la compra, sin que la usuaria tenga que hacer nada. El flujo interno es:

```
1. La usuaria hace clic en "Canjear"
2. buyItem() calcula el finalPrice (con o sin descuento)
3. Se restan finalPrice monedas del saldo
4. Se calculan las monedas de cashback: Math.floor(finalPrice × cashbackRate)
5. Se suman esas monedas de vuelta al saldo
6. El resultado neto se guarda en el store
7. El toast notifica: "¡+X cashback devueltas!"
```

La función `Math.floor` asegura que siempre se devuelven monedas enteras (sin decimales).

```javascript
// Fragmento de buyItem() en app.js
const finalPrice = ECONOMY.isSaleActive
    ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
    : itemData.price;

const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);

store.coins -= finalPrice;
store.coins += cashback;  // Devolución inmediata
```

---

### Cambiar el porcentaje de cashback

`cashbackRate` es un número entre `0` y `1` que representa el porcentaje de devolución:

```
cashbackRate = porcentaje_deseado / 100
```

| Cashback deseado | Valor de cashbackRate |
|---|---|
| Sin cashback | `0` |
| 5% | `0.05` |
| **10%** | **`0.10`** ← valor por defecto |
| 15% | `0.15` |
| 20% | `0.20` |
| 25% | `0.25` |
| 50% | `0.50` |

**Ejemplo — Cashback del 15%:**

```javascript
const ECONOMY = {
    isSaleActive:   false,
    saleMultiplier: 0.8,
    saleLabel:      '20% OFF',
    cashbackRate:   0.15  // ← 15% de devolución
};
```

> 💡 **Recomendación:** Un cashback del 10–15% es suficiente para que se sienta como una recompensa sin desequilibrar la economía. Cashbacks por encima del 30% hacen que los precios pierdan sentido a largo plazo.

---

### Desactivar el cashback

Establece `cashbackRate` en `0`:

```javascript
const ECONOMY = {
    isSaleActive:   false,
    saleMultiplier: 0.8,
    saleLabel:      '20% OFF',
    cashbackRate:   0     // ← Sin cashback
};
```

Cuando es `0`, `Math.floor(finalPrice * 0)` devuelve `0`, así que no se suma nada al saldo y el toast omite la mención del cashback automáticamente (porque `result.cashback` es `0`).

---

## 5. Combinando ofertas y cashback

Las dos mecánicas son **independientes** y se pueden combinar libremente:

| Escenario | `isSaleActive` | `saleMultiplier` | `cashbackRate` |
|---|---|---|---|
| Solo cashback (cotidiano) | `false` | `0.8` (ignorado) | `0.10` |
| Oferta sin cashback | `true` | `0.80` | `0` |
| Oferta + cashback | `true` | `0.80` | `0.10` |
| Mega-evento | `true` | `0.70` | `0.15` |
| Economía desactivada | `false` | `0.8` (ignorado) | `0` |

---

## 6. Ejemplos de eventos especiales

### 🌹 San Valentín — Descuento + Cashback extra

```javascript
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.75,        // 25% de descuento
    saleLabel:      'SAN VALENTÍN ❤️',
    cashbackRate:   0.15         // 15% de cashback
};
```

---

### ⚡ Flash Sale — Descuento agresivo, sin cashback

```javascript
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.60,        // 40% de descuento
    saleLabel:      'FLASH SALE',
    cashbackRate:   0            // Sin cashback
};
```

---

### 🎂 Cumpleaños — Solo cashback elevado

```javascript
const ECONOMY = {
    isSaleActive:   false,       // Sin descuento en precios
    saleMultiplier: 0.8,
    saleLabel:      '20% OFF',
    cashbackRate:   0.25         // 25% de cashback
};
```

---

### 🛡️ Estado normal (sin eventos)

```javascript
const ECONOMY = {
    isSaleActive:   false,
    saleMultiplier: 0.8,
    saleLabel:      '20% OFF',
    cashbackRate:   0.10         // 10% de cashback permanente
};
```

---

## 7. Referencia rápida de valores

```javascript
// ╔══════════════════════════════════════════════╗
// ║  PANEL DE CONTROL — EVENTOS LOVE ARCADE      ║
// ╠══════════════════════════════════════════════╣
// ║  Archivo: app.js — objeto ECONOMY (~línea 20)║
// ╚══════════════════════════════════════════════╝

const ECONOMY = {

    // ── OFERTAS ──────────────────────────────────
    isSaleActive:   false,   // true = oferta ON · false = oferta OFF

    saleMultiplier: 0.8,     // Factor de precio:
                             //   0.95 =  5% dto.
                             //   0.90 = 10% dto.
                             //   0.80 = 20% dto.  ← por defecto
                             //   0.75 = 25% dto.
                             //   0.70 = 30% dto.
                             //   0.50 = 50% dto.

    saleLabel: '20% OFF',    // Texto del badge (actualizar según multiplier)

    // ── CASHBACK ─────────────────────────────────
    cashbackRate: 0.1        // Factor de devolución:
                             //   0    = sin cashback
                             //   0.05 =  5% devuelto
                             //   0.10 = 10% devuelto  ← por defecto
                             //   0.15 = 15% devuelto
                             //   0.20 = 20% devuelto
};
```

---

*Última actualización: Phase 3 — Love Arcade v9.4*

> **Nota de migración:** Antes de v9.0, `initSaleBanner()` y toda la lógica de la
> tienda vivían en `shop.html`. Desde la migración SPA (v9.0), estas funciones
> residen en `shop-logic.js`. Cualquier referencia a `shop.html` en el contexto
> de la economía es obsoleta.
