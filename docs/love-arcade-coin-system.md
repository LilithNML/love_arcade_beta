# 🎮 Love Arcade — Sistema Universal de Monedas

> **Versión:** `1.0.0` · **Estado:** Estable · **Audiencia:** Desarrolladores de juegos integrados

---

## Índice

1. [Contexto del Sistema](#1-contexto-del-sistema)
2. [Objetivo Funcional](#2-objetivo-funcional)
3. [Alcance y Límites](#3-alcance-y-límites)
4. [Fuente de Verdad y Propiedad de Datos](#4-fuente-de-verdad-y-propiedad-de-datos)
5. [Contrato de Integración (API)](#5-contrato-de-integración-api)
6. [Flujo Completo Paso a Paso](#6-flujo-completo-paso-a-paso)
7. [Compatibilidad con Economías Internas](#7-compatibilidad-con-economías-internas)
8. [Persistencia y Sincronización](#8-persistencia-y-sincronización)
9. [Manejo de Errores y Casos Límite](#9-manejo-de-errores-y-casos-límite)
10. [Restricciones Estrictas](#10-restricciones-estrictas)
11. [Checklist de Implementación](#11-checklist-de-implementación)

---

## 1. Contexto del Sistema

**Love Arcade** es una plataforma centralizada (Game Hub) que aloja múltiples videojuegos desarrollados de forma independiente.

| Componente | Descripción |
|---|---|
| **Los Juegos** | Módulos independientes (HTML/JS) con su propia lógica, física, reglas y economía interna (puntos, gemas, rings, etc.). |
| **El Sistema Universal** | Motor financiero de la plataforma (`app.js`). Es la **única entidad autorizada** para gestionar el saldo global del usuario. |

> **Principio Fundamental**
>
> El sistema universal es **agnóstico a la lógica del juego**. Los juegos reportan resultados, no gestionan el total global.
> El juego actúa como un *proveedor de datos* y Love Arcade actúa como el *banco*.

---

## 2. Objetivo Funcional

El propósito de este sistema es permitir la **acumulación persistente de valor (Monedas)** a través de diferentes sesiones de juego y diferentes títulos.

```
Generación  →  Recepción  →  Almacenamiento  →  Visualización
```

- **Generación:** Las monedas se generan dentro de cada juego al cumplir hitos (completar nivel, batir récord, etc.).
- **Recepción:** El núcleo de Love Arcade (`GameCenter`) recibe la solicitud de depósito.
- **Almacenamiento:** El sistema valida, registra y suma la cantidad al saldo global del usuario.
- **Visualización:** Love Arcade actualiza la interfaz gráfica (Navbar/Tienda) automáticamente.

### Ejemplo de Flujo

> *"Al completar el Nivel 5, el juego Tetris determina que el premio es 50 monedas y envía una solicitud de depósito al sistema universal. El sistema valida la solicitud, suma 50 al total y guarda el nuevo saldo."*

---

## 3. Alcance y Límites

### ✅ Incluido — Responsabilidad de Love Arcade

- Recepción de eventos de ganancias desde los juegos.
- Validación de tipos de datos y cantidades positivas.
- Suma aritmética al saldo global.
- Persistencia de datos (LocalStorage / Base de Datos).
- Prevención de duplicidad básica (idempotencia por ID de nivel).
- Actualización visual del HUD global.

### ❌ No Incluido — Responsabilidad del Juego

- Lógica interna de cómo se ganan las monedas.
- Conversión de divisas internas (ej: `1000 puntos = 1 moneda` es cálculo del juego).
- Gestión de inventarios internos del juego.
- Modificación directa del almacenamiento del navegador.

---

## 4. Fuente de Verdad y Propiedad de Datos

El saldo de monedas reside **exclusivamente** en el objeto global `window.GameCenter`, gestionado por `app.js`.

| Concepto | Detalle |
|---|---|
| **Single Source of Truth** | El valor almacenado en el sistema de persistencia de Love Arcade. |
| **Permisos de Escritura** | Exclusivo para el núcleo de Love Arcade. |
| **Permisos de Lectura** | Público — los juegos pueden consultar el saldo, pero no modificarlo. |

> **💡 Disponibilidad de `window.GameCenter`:**
>
> `app.js` está posicionado al **final del `<body>`** en `index.html` y se ejecuta de forma síncrona.
> Esto significa que `window.GameCenter` está disponible **antes** de que cualquier `DOMContentLoaded`
> se dispare, incluido el de los juegos integrados que cargan después del hub.
> No es necesario esperar ningún evento para acceder a la API desde un juego incrustado.

> **⚠️ Conflictos:** Si un juego intenta modificar el `localStorage` o la variable de monedas directamente, el sistema sobrescribirá dicho cambio en el siguiente ciclo de sincronización. Cualquier intento de *bypass* será ignorado.

---

## 5. Contrato de Integración (API)

Todo juego que desee otorgar monedas **debe implementar estrictamente este contrato**. No existen métodos alternativos.

### 5.1 Método de Reporte

```js
window.GameCenter.completeLevel(gameId, levelId, coins)
```

| Propiedad | Valor |
|---|---|
| **Disponibilidad** | Global (`window.GameCenter`). Disponible de forma **síncrona** al final del `<body>`, antes del `DOMContentLoaded` de los juegos, gracias al INIT síncrono de `app.js`. Los juegos pueden accederlo desde su propio `DOMContentLoaded` con seguridad. |
| **Momento de llamada** | Inmediatamente después de que el usuario cumple la condición de victoria/logro |

### 5.2 Parámetros del Payload

| Parámetro | Tipo | Obligatorio | Descripción | Ejemplo |
|---|---|---|---|---|
| `gameId` | `String` | ✅ | Identificador único del juego (minúsculas, sin espacios). | `"tetris"`, `"snake"` |
| `levelId` | `String` / `Int` | ✅ | Identificador único del hito o nivel completado. | `"lvl_1"`, `"score_1000"` |
| `coins` | `Int` | ✅ | Cantidad entera de monedas a otorgar. | `100`, `500` |

### 5.3 Reglas de Validación

El sistema universal aplica las siguientes reglas **en orden**:

1. **Existencia** — ¿Existe el objeto `window.GameCenter`? *(Si no, el juego debe degradarse elegantemente sin romper la ejecución).*
2. **Tipado** — ¿`coins` es un número?
3. **Lógica** — ¿`coins > 0`? *(No se permiten restas ni valores cero).*
4. **Duplicidad** — ¿Ya se pagó el `levelId` para el `gameId` actual? *(Opcional según configuración global, pero el juego debe enviar siempre IDs únicos si busca pago único).*

---

## 6. Flujo Completo Paso a Paso

```
[Jugador completa partida]
         │
         ▼
[Juego calcula recompensa]
  "5000 puntos = 500 monedas"
         │
         ▼
[Juego emite evento]
  window.GameCenter.completeLevel('tetris', 'score_5000', 500)
         │
         ▼
[app.js intercepta la llamada]
         │
         ▼
[Validación: número positivo ✅]
         │
         ▼
[Transacción]
  Saldo actual (200) + payload (500) = 700
  Guardado en persistencia
         │
         ▼
[Feedback visual]
  Navbar actualiza contador → 700 🪙
```

### Código de Ejemplo

```js
// ✅ Implementación correcta en el juego
if (window.GameCenter) {
  window.GameCenter.completeLevel('tetris', 'score_5000', 500);
}
```

---

## 7. Compatibilidad con Economías Internas

Es común que los juegos tengan su propia economía. El sistema universal es compatible bajo el **patrón Adaptador**.

### Escenario A — El juego usa "Puntos"

El juego debe implementar una fórmula interna de conversión **antes** de emitir el evento.

```js
// ❌ Incorrecto — enviar puntos directamente
window.GameCenter.completeLevel('myjuego', 'lvl_1', 50000); // MAL

// ✅ Correcto — convertir internamente antes de enviar
const puntos = 50000;
const monedas = Math.floor(puntos / 100); // 50000 / 100 = 500
window.GameCenter.completeLevel('myjuego', 'lvl_1', monedas);
```

### Escenario B — El juego no tiene economía

El juego debe asignar valores arbitrarios a la finalización de niveles.

```js
// ✅ Correcto — valor fijo por evento de victoria
window.GameCenter.completeLevel('myjuego', 'level_complete', 10);
```

> **Regla de Oro:** El sistema universal **no se adapta al juego**; el juego se adapta al sistema universal. El payload final siempre debe expresarse en *Monedas Love Arcade*.

---

## 8. Persistencia y Sincronización

| Operación | Comportamiento |
|---|---|
| **Guardado** | Síncrono e inmediato al recibir una transacción válida. |
| **Lectura** | Se realiza al cargar `index.html` o al recargar la página. |
| **Navegación** | Al salir del juego (volver al menú), el saldo ya estará actualizado porque la transacción ocurrió en tiempo real. |

---

## 9. Manejo de Errores y Casos Límite

| Caso | Comportamiento del Sistema Universal | Acción requerida del Juego |
|---|---|---|
| `coins` es negativo | Rechaza la transacción. Loguea error. | Asegurar matemáticas internas: `Math.max(0, coins)`. |
| `coins` es decimal | Redondea hacia abajo (`Math.floor`). | Debe enviar enteros siempre. |
| `window.GameCenter` es `undefined` | Nada — el juego corre aislado. | Usar un bloque `if` para verificar existencia antes de llamar. |
| Envío duplicado (mismo ID) | Ignora si el sistema tiene chequeo de unicidad activo. | Gestionar IDs de hitos únicos (`lvl_1`, `lvl_2`) si se requiere pago único. |

---

## 10. Restricciones Estrictas

Para mantener la integridad de Love Arcade, se aplican las siguientes **prohibiciones técnicas**:

> 🚫 **PROHIBIDO** acceder directamente a `localStorage.setItem('game_coins', ...)` o claves similares reservadas por el sistema.

> 🚫 **PROHIBIDO** sobrescribir el objeto global `window.GameCenter`.

> 🚫 **PROHIBIDO** asumir que el saldo local del juego es el saldo global.

> 🚫 **PROHIBIDO** crear interfaces de "banco" dentro del juego. La visualización del saldo total es responsabilidad exclusiva de la Navbar principal.

---

## 11. Checklist de Implementación

Antes de dar por finalizada la integración de un juego, verifica cada punto:

- [ ] El juego importa `app.js` (o tiene acceso al contexto global si es SPA).
- [ ] El juego calcula las recompensas internamente antes de emitir el evento.
- [ ] El juego invoca `window.GameCenter.completeLevel()` en el momento de la victoria.
- [ ] Los parámetros enviados respetan los tipos de datos (`String`, `String`, `Int`).
- [ ] El juego **NO** intenta leer ni escribir en `localStorage` las claves del sistema global.
- [ ] El juego funciona correctamente incluso si `window.GameCenter` no existe (modo standalone).
- [ ] Al ganar en el juego, el contador de la barra superior de Love Arcade incrementa.

---

*Documentación mantenida por el equipo de Love Arcade · v1.1.0 — actualizada para Love Arcade v9.4*
