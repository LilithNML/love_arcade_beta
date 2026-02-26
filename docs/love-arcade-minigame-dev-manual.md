# Love Arcade — Manual de Desarrollo de Minijuegos

> **Versión del núcleo:** `Game Center Core v7.5`  
> **Estado:** Estable · **Audiencia:** Equipos externos de desarrollo de juegos  
> **Archivos de referencia entregados:** `love-arcade-coin-system.md` · `app.js`

---

## Índice

1. [Introducción y Filosofía](#1-introducción-y-filosofía)
2. [Arquitectura Base y Requisitos Técnicos](#2-arquitectura-base-y-requisitos-técnicos)
3. [Estructura de Directorios y Navegación](#3-estructura-de-directorios-y-navegación)
4. [Aislamiento y Namespacing](#4-aislamiento-y-namespacing)
5. [Globales Reservados del Núcleo](#5-globales-reservados-del-núcleo)
6. [Integración con la Economía Universal](#6-integración-con-la-economía-universal)
7. [API de GameCenter — Referencia Completa](#7-api-de-gamecenter--referencia-completa)
8. [Utilidades Globales Disponibles](#8-utilidades-globales-disponibles)
9. [Manejo de Errores y Degradación Elegante](#9-manejo-de-errores-y-degradación-elegante)
10. [Checklist de Entrega y Aprobación](#10-checklist-de-entrega-y-aprobación)

---

## 1. Introducción y Filosofía

**Love Arcade** es una plataforma centralizada (Game Hub) que aloja múltiples videojuegos desarrollados de forma independiente. Tu equipo recibirá únicamente tres artefactos para comenzar:

| Artefacto | Propósito |
|---|---|
| Este manual | Directrices arquitectónicas, de diseño e integración |
| `love-arcade-coin-system.md` | Especificación detallada de la economía universal |
| `app.js` | Motor central (`Game Center Core v7.5`) — la fuente de verdad del sistema |

### Principios Fundamentales

El diseño de la plataforma gira en torno a dos ideas centrales:

**Soberanía del núcleo.** El sistema central (`app.js`) es la única entidad autorizada para gestionar el saldo global del usuario. Los juegos actúan como *proveedores de eventos*; Love Arcade actúa como el *banco*. Un juego reporta resultados; nunca administra el total.

**Aislamiento total.** Todos los juegos conviven en el mismo dominio y, por ende, en el mismo entorno de `window` y `localStorage`. Ningún juego debe interferir con otro ni con el núcleo. El incumplimiento de esta regla es motivo de rechazo inmediato.

---

## 2. Arquitectura Base y Requisitos Técnicos

Todos los juegos de Love Arcade deben adherirse estrictamente a la siguiente arquitectura. No hay excepciones.

### 2.1 Infraestructura Serverless

Los juegos no tendrán backend propio. Toda la plataforma está alojada estáticamente en **GitHub Pages**. Tu juego debe ser completamente funcional como un conjunto de archivos estáticos (HTML, CSS, JS, assets).

### 2.2 Almacenamiento Local

Cualquier progreso *interno* del juego (récords personales, configuraciones propias, estado de partida) debe guardarse exclusivamente en el `localStorage` del navegador del usuario, siempre bajo un prefijo de namespace único (ver [§4](#4-aislamiento-y-namespacing)).

Está terminantemente **prohibido** leer o escribir las claves reservadas del sistema global (ej. `gamecenter_v6_promos`).

### 2.3 Diseño Mobile First

Love Arcade se consume principalmente en dispositivos móviles. Todo juego debe diseñarse priorizando pantallas táctiles, tanto en orientación vertical como horizontal según la naturaleza del juego. Los controles y la interfaz gráfica deben ser responsivos y plenamente usables en pantallas pequeñas.

---

## 3. Estructura de Directorios y Navegación

Love Arcade funciona como un *hub* central. Tu juego vivirá como un módulo aislado dentro de la carpeta `games/`.

### 3.1 Ubicación del Proyecto

El código de tu juego debe estar autocontenido en una subcarpeta con un **nombre único en minúsculas y sin espacios** dentro del directorio `games/`.

| | Ejemplo |
|---|---|
| ✅ Correcto | `games/rompecabezas/index.html` |
| ❌ Incorrecto | `games/Mi Rompecabezas/index.html` |

### 3.2 Botón de Salida Obligatorio

Para garantizar una experiencia de usuario fluida dentro de la plataforma, el juego debe incluir —ya sea en su pantalla de inicio o en un menú de pausa accesible en todo momento— un botón para volver al menú principal de Love Arcade.

Este botón debe apuntar **estrictamente** a la siguiente ruta relativa:

```
../../index.html
```

### 3.3 Inclusión del Motor Central

Para que tu juego pueda comunicarse con el sistema de monedas, debes importar el script principal de Love Arcade en tu `index.html`. Añade la siguiente etiqueta **antes de cerrar tu `<body>`**:

```html
<script src="../../js/app.js"></script>
```

> **Importante:** La etiqueta debe colocarse al final del `<body>`, después de todos tus propios scripts, para garantizar que el DOM esté listo cuando `app.js` se inicialice.

---

## 4. Aislamiento y Namespacing

Dado que todos los juegos comparten el mismo entorno de `window` y `localStorage`, es **obligatorio** el uso de prefijos únicos (namespacing) para todas las variables, constantes, clases y claves de guardado de tu juego.

### 4.1 Convención de Prefijos

Elige un prefijo corto, descriptivo y en mayúsculas derivado del nombre de tu juego. Úsalo de forma consistente en absolutamente todos los identificadores globales.

Ejemplo para un juego llamado "Rompecabezas" (prefijo sugerido: `PUZZLE_`):

| Elemento | ❌ Práctica Incorrecta | ✅ Práctica Correcta |
|---|---|---|
| Variable global | `let score = 0;` | `let PUZZLE_score = 0;` |
| Función global | `function initGame() {}` | `function PUZZLE_initGame() {}` |
| Clave en localStorage | `localStorage.setItem('highscore', 10)` | `localStorage.setItem('PUZZLE_highscore', 10)` |
| Clase CSS conflictiva | `.modal { ... }` | `.puzzle-modal { ... }` |

### 4.2 Por Qué es Crítico

Si tu juego declara variables globales sin prefijo como `score`, `gameState`, `config` o `init`, existe una alta probabilidad de colisión con otros juegos o con el núcleo mismo. Si tu código sobrescribe alguno de los globales reservados del núcleo (listados en [§5](#5-globales-reservados-del-núcleo)), **romperás la plataforma entera** y el juego será rechazado sin posibilidad de revisión hasta que el problema sea corregido.

---

## 5. Globales Reservados del Núcleo

El archivo `app.js` declara y exporta los siguientes identificadores en el scope global. **Tu juego no debe declarar, sobrescribir ni alterar ninguno de ellos bajo ninguna circunstancia.**

| Identificador Global | Tipo | Descripción |
|---|---|---|
| `window.GameCenter` | `Object` | API pública del motor central. Única vía de comunicación con el sistema. |
| `window.ECONOMY` | `Object` | Configuración de economía activa (ventas, multiplicadores, cashback). |
| `window.THEMES` | `Object` | Paleta de temas visuales de la plataforma (violet, pink, cyan, gold, crimson). |
| `window.debounce` | `Function` | Utilidad de debounce exportada por el núcleo (ver [§8](#8-utilidades-globales-disponibles)). |
| `window.formatCoinsNavbar` | `Function` | Formateador de monedas para UI. Reservado para uso del hub. |
| `CONFIG` | `const` | Configuración interna del núcleo (no exportada a `window`, pero declarada globalmente). |
| `ECONOMY` | `const` | Alias interno del objeto de economía. |
| `THEMES` | `const` | Alias interno de la paleta de temas. |

> **Regla práctica:** Si tu juego necesita un objeto de configuración propio, nómbralo con tu prefijo, por ejemplo `PUZZLE_CONFIG`. Nunca uses `CONFIG` a secas.

---

## 6. Integración con la Economía Universal

Love Arcade cuenta con un **Sistema Universal de Monedas** gestionado íntegramente por `app.js`. Tu juego no administra ni puede administrar el saldo global; solo reporta ganancias puntuales al sistema.

### 6.1 Flujo de una Transacción

```
[Jugador cumple un hito en el juego]
         │
         ▼
[El juego calcula la recompensa en monedas]
  ej. "5.000 puntos internos = 50 monedas Love Arcade"
         │
         ▼
[El juego llama a window.GameCenter.completeLevel(...)]
         │
         ▼
[app.js valida: tipo, valor positivo, duplicidad]
         │
         ▼
[El saldo global se actualiza y se persiste]
         │
         ▼
[La navbar de Love Arcade refleja el nuevo saldo]
```

### 6.2 Idempotencia y Generación de IDs Únicos

El sistema de monedas es **idempotente por diseño**: si envías el mismo `levelId` para el mismo `gameId` más de una vez, el sistema ignorará las solicitudes posteriores. Esto previene abusos por recarga o repetición.

Existen dos estrategias para manejar los `levelId`:

**Hito único (pago único).** Para logros que solo deben premiarse una vez (ej. "completar el nivel 3"), usa un ID fijo y descriptivo.

```js
window.GameCenter.completeLevel('rompecabezas', 'nivel_3_completado', 25);
```

**Partidas repetibles (pago por sesión).** Para mecánicas donde el jugador puede ganar monedas infinitas jugando varias partidas, genera un ID dinámico con timestamp para que cada sesión sea única.

```js
const sessionId = 'victoria_' + Date.now();
window.GameCenter.completeLevel('rompecabezas', sessionId, monedasGanadas);
```

### 6.3 Conversión de Economía Interna

Si tu juego maneja una economía interna (puntos, gemas, estrellas, etc.), **debes convertir ese valor a monedas Love Arcade antes de emitir el evento**. El sistema central no acepta ni entiende monedas de otras denominaciones.

```js
// ❌ Incorrecto — enviar puntos internos directamente
window.GameCenter.completeLevel('rompecabezas', 'partida_1', 5000); // MAL

// ✅ Correcto — convertir internamente antes de enviar
const puntosInternos = 5000;
const monedasLoveArcade = Math.floor(puntosInternos / 100); // → 50 monedas
window.GameCenter.completeLevel('rompecabezas', 'partida_1', monedasLoveArcade);
```

> **Regla de Oro:** El sistema universal no se adapta al juego; el juego se adapta al sistema universal. El payload final siempre debe expresarse en enteros de *Monedas Love Arcade*.

---

## 7. API de GameCenter — Referencia Completa

Toda la interacción con el núcleo se realiza a través del objeto global `window.GameCenter`, inyectado automáticamente por `app.js`.

### 7.1 `completeLevel` — Otorgar Monedas

El método principal de integración. Debe llamarse inmediatamente después de que el usuario cumpla la condición de victoria o logro.

```js
window.GameCenter.completeLevel(gameId, levelId, rewardAmount)
```

**Parámetros:**

| Parámetro | Tipo | Obligatorio | Descripción | Ejemplo |
|---|---|---|---|---|
| `gameId` | `String` | ✅ | Identificador único del juego. Minúsculas, sin espacios. Debe coincidir con el nombre de la carpeta del juego. | `'rompecabezas'` |
| `levelId` | `String` / `Int` | ✅ | Identificador único del hito o nivel. Ver estrategias de ID en [§6.2](#62-idempotencia-y-generación-de-ids-únicos). | `'nivel_3'`, `'victoria_1703000000000'` |
| `rewardAmount` | `Int` | ✅ | Cantidad entera de monedas. No se permiten decimales ni valores negativos o cero. | `50`, `100` |

**Reglas de validación aplicadas por el sistema:**

El núcleo valida cada solicitud en el siguiente orden antes de procesar la transacción:

1. **Existencia** — ¿Existe `window.GameCenter`? Si no, el juego debe degradarse elegantemente (ver [§9](#9-manejo-de-errores-y-degradación-elegante)).
2. **Tipado** — ¿`rewardAmount` es un número entero?
3. **Lógica** — ¿`rewardAmount > 0`? No se permiten restas ni valores nulos.
4. **Duplicidad** — ¿Ya se procesó este `levelId` para este `gameId`? Si es así, la transacción se ignora silenciosamente.

**Implementación de referencia:**

```js
function PUZZLE_otorgarRecompensa(puntosObtenidos) {
    // 1. Calcular la conversión interna (100 puntos = 1 moneda)
    const monedasGanadas = Math.floor(puntosObtenidos / 100);

    // 2. Verificar que el sistema central exista (degradación elegante)
    if (typeof window.GameCenter !== 'undefined') {
        // 3. Generar un ID único para esta partida (estrategia de sesión repetible)
        const sessionId = 'victoria_' + Date.now();

        // 4. Reportar al núcleo
        window.GameCenter.completeLevel('rompecabezas', sessionId, monedasGanadas);
        console.log(`[PUZZLE] Reportadas ${monedasGanadas} monedas al GameCenter.`);
    } else {
        console.warn('[PUZZLE] Modo standalone activo — las monedas no se acumularán.');
    }
}
```

### 7.2 Otros Métodos del GameCenter

Los siguientes métodos son utilizados internamente por el hub de Love Arcade. Tu juego no debe invocarlos directamente, pero es importante conocerlos para evitar colisiones en nomenclatura o comportamientos inesperados.

| Método | Descripción |
|---|---|
| `window.GameCenter.claimDaily()` | Reclama el bono de monedas diario. Uso exclusivo del hub. |
| `window.GameCenter.canClaimDaily()` | Devuelve `true` si el bono diario está disponible. |
| `window.GameCenter.getStreakInfo()` | Devuelve información sobre la racha de bonos diarios del usuario. |
| `window.GameCenter.getMoonBlessingStatus()` | Estado del buff temporal "Bendición Lunar". |
| `window.GameCenter.buyMoonBlessing()` | Compra la Bendición Lunar (100 monedas). Uso exclusivo de la tienda. |
| `window.GameCenter.setAvatar(dataUrl)` | Actualiza el avatar del usuario. Uso exclusivo del hub. |
| `window.GameCenter.setTheme(key)` | Cambia el tema visual de la plataforma. Uso exclusivo del hub. |

> **Restricción:** No invoques ninguno de los métodos anteriores desde tu juego. El único método que tu juego debe llamar es `completeLevel`.

---

## 8. Utilidades Globales Disponibles

El núcleo de Love Arcade expone algunas utilidades de propósito general que tu juego puede aprovechar libremente, sin necesidad de reimplementarlas.

### 8.1 `window.debounce`

Crea una versión con debounce de cualquier función, útil para controlar la frecuencia de operaciones costosas como el manejo de eventos de teclado, redimensionado de ventana o búsquedas en tiempo real.

```js
/**
 * @param {Function} fn    Función a ejecutar con debounce.
 * @param {number}   delay Espera en milisegundos (por defecto: 300ms).
 * @returns {Function}     Nueva función con debounce aplicado.
 */
window.debounce(fn, delay = 300)
```

**Ejemplo de uso:**

```js
// Sin prefijo de namespace porque es una utilidad del núcleo, no una variable propia
const PUZZLE_onResize = window.debounce(() => {
    PUZZLE_recalcularLayout();
}, 200);

window.addEventListener('resize', PUZZLE_onResize);
```

### 8.2 `window.ECONOMY`

Objeto de solo lectura que expone la configuración de economía activa. Útil si tu juego quiere mostrar información sobre eventos especiales de la plataforma (ej. mostrar una etiqueta de "¡Venta activa!").

```js
// Ejemplo: mostrar badge si hay una venta activa en la plataforma
if (window.ECONOMY && window.ECONOMY.isSaleActive) {
    PUZZLE_mostrarBadgeVenta(window.ECONOMY.saleLabel); // ej. "20% OFF"
}
```

> **Restricción:** Este objeto es de solo lectura. No lo modifiques ni reasignes.

### 8.3 `window.THEMES`

Objeto de solo lectura con la paleta de colores de todos los temas disponibles. Puedes usarlo para sincronizar el esquema de colores de tu juego con el tema activo del usuario.

```js
// Ejemplo: aplicar el color de acento del tema activo a un elemento del juego
const temaActivo = /* leer del store si es necesario */ 'violet';
const accentColor = window.THEMES[temaActivo]?.accent || '#9b59ff';
document.getElementById('PUZZLE_score-display').style.color = accentColor;
```

---

## 9. Manejo de Errores y Degradación Elegante

Tu juego debe poder ejecutarse de forma completamente aislada —sin `app.js` cargado— para facilitar el desarrollo y las pruebas locales. A esto se le llama **modo standalone**.

### 9.1 Verificación de Existencia Antes de Llamar

Siempre verifica que `window.GameCenter` exista antes de invocar cualquiera de sus métodos. Esto evita errores fatales en la consola durante el desarrollo aislado.

```js
// ✅ Correcto — verificación defensiva
if (typeof window.GameCenter !== 'undefined') {
    window.GameCenter.completeLevel('myjuego', 'lvl_1', 50);
}

// ❌ Incorrecto — puede lanzar TypeError si app.js no está cargado
window.GameCenter.completeLevel('myjuego', 'lvl_1', 50);
```

### 9.2 Tabla de Casos Límite

| Caso | Comportamiento del Sistema | Acción Requerida del Juego |
|---|---|---|
| `window.GameCenter` es `undefined` | Nada — el juego corre aislado sin errores del núcleo | Envolver la llamada en `if (typeof window.GameCenter !== 'undefined')` |
| `rewardAmount` es negativo | El núcleo rechaza la transacción y loguea un error | Asegurar matemáticas internas correctas: usar `Math.max(0, valor)` |
| `rewardAmount` es decimal | El núcleo puede redondear hacia abajo | Enviar siempre enteros: usar `Math.floor(valor)` antes de la llamada |
| `levelId` ya fue procesado | El núcleo ignora silenciosamente la solicitud duplicada | Usar IDs dinámicos con `Date.now()` para sesiones repetibles |
| `rewardAmount` es cero | El núcleo rechaza la transacción | Validar que el cálculo de recompensa sea `> 0` antes de llamar |

### 9.3 Logging Recomendado

Adopta una convención de logging prefijada para facilitar el debugging sin contaminar la consola de otros módulos:

```js
// Prefija todos los mensajes de log con el nombre del juego
console.log('[PUZZLE] Partida iniciada.');
console.warn('[PUZZLE] GameCenter no disponible — modo standalone.');
console.error('[PUZZLE] Error inesperado en cálculo de recompensa:', err);
```

---

## 10. Checklist de Entrega y Aprobación

Antes de enviar el juego para su integración en Love Arcade, verifica cada uno de los siguientes puntos. Un juego que no cumpla **todos** los ítems será devuelto para corrección.

### Estructura y Navegación

- [ ] El proyecto está autocontenido en `games/nombre-del-juego/` (minúsculas, sin espacios).
- [ ] Existe un botón visible en la pantalla de inicio o menú de pausa que redirige a `../../index.html`.
- [ ] El archivo `../../js/app.js` está referenciado correctamente al final del `<body>` en `index.html`.

### Responsividad

- [ ] La UI sigue el enfoque *Mobile First* y se adapta correctamente a pantallas pequeñas (≤ 375px de ancho).
- [ ] Los controles táctiles son funcionales y usables en dispositivos móviles.

### Aislamiento y Namespacing

- [ ] Todas las variables globales, funciones y clases de JavaScript llevan el prefijo único del juego.
- [ ] Todas las claves de `localStorage` llevan el prefijo único del juego.
- [ ] El juego no declara ni sobrescribe ninguno de los globales reservados del núcleo (`CONFIG`, `ECONOMY`, `THEMES`, `window.GameCenter`, etc.).

### Integración con la Economía

- [ ] El juego calcula las recompensas internamente (y las convierte a enteros) antes de emitir el evento.
- [ ] El juego invoca únicamente `window.GameCenter.completeLevel(gameId, levelId, rewardAmount)` para otorgar monedas.
- [ ] Los parámetros enviados respetan los tipos de datos: `gameId` (String), `levelId` (String/Int), `rewardAmount` (Int positivo).
- [ ] El juego no intenta leer ni escribir las claves de localStorage reservadas del sistema (ej. `gamecenter_v6_promos`).

### Modo Standalone y Robustez

- [ ] El juego funciona correctamente incluso si `window.GameCenter` no está disponible (modo standalone).
- [ ] Al ganar en el juego integrado, el contador de monedas de la barra superior de Love Arcade incrementa visiblemente.

---

*Documentación mantenida por el equipo de Love Arcade · Basada en Game Center Core v7.5 · 2026*
