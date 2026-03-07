# Snake — Documentación de Economía
### LA-Snake Classic v1.3 | Sistema Económico

---

## Tabla de Contenidos

1. [Principios del Sistema Económico](#1-principios-del-sistema-económico)
2. [Changelog](#2-changelog)
3. [Diagnóstico: Por Qué Fallaban las Recompensas](#3-diagnóstico-por-qué-fallaban-las-recompensas)
4. [Flujo de Puntuación](#4-flujo-de-puntuación)
5. [Sistema de Combo](#5-sistema-de-combo)
6. [Sistema de Recompensas (Coins)](#6-sistema-de-recompensas-coins)
7. [Sistema de Skins y Progresión](#7-sistema-de-skins-y-progresión)
8. [Persistencia y Almacenamiento](#8-persistencia-y-almacenamiento)
9. [Integración GameCenter — Contrato Completo](#9-integración-gamecenter--contrato-completo)
10. [Balanceo Económico](#10-balanceo-económico)
11. [Referencia de API (snake-economy.js)](#11-referencia-de-api-snake-economyjs)

---

## 1. Principios del Sistema Económico

**1. Recompensa solo al finalizar sesión**
Los coins se calculan y entregan únicamente cuando la serpiente muere. No existe entrega parcial ni durante el juego.

**2. Progresión por alto puntaje histórico**
Las skins se desbloquean basándose en el `highScore` histórico, no en el score de la sesión actual.

**3. `levelId` único por sesión — Regla crítica de integración**
La API `completeLevel()` de Love Arcade es idempotente: registra cada `levelId` que ha pagado y rechaza silenciosamente cualquier repetición. Por ello, cada sesión genera su propio `LAS_sessionId` único. Ver §3 para el análisis completo.

**4. Multiplicador capturado en el momento de muerte (v1.2+)**
El `comboMultiplier` se captura antes del reset para recompensar sesiones de alto ritmo que terminan abruptamente.

---

## 2. Changelog

### v1.3 — Corrección de integración GameCenter

**Bugs corregidos:**

| Bug | Síntoma | Causa | Fix |
|-----|---------|-------|-----|
| Script ausente | `window.GameCenter` siempre era el stub de desarrollo | `<script src="../../js/app.js">` faltaba en `snake.html` | Añadido como primera etiqueta script, antes de todos los módulos |
| Idempotencia | Solo la primera sesión de vida recibía monedas | `levelId = 'standard_mode'` era estático | `LAS_sessionId` único generado en `startSession()` |

### v1.2

- `LAS_GAME_ID`: `'snake'` → `'la_snake_classic'`
- Fórmula de reward: `Math.floor(score × comboAtDeath)`
- `Math.floor()` + `Math.max(1, …)` garantizan entero positivo
- `try/catch` + verificación de existencia alrededor de `completeLevel`

---

## 3. Diagnóstico: Por Qué Fallaban las Recompensas

### Bug A — `app.js` no cargado

`snake.html` no incluía `<script src="../../js/app.js">`. Al no cargarse, `window.GameCenter` nunca era el sistema real de Love Arcade. En su lugar, el stub de desarrollo dentro del orquestador siempre se activaba:

```javascript
// Este bloque corría SIEMPRE porque app.js nunca definía window.GameCenter
if (!window.GameCenter) {
    window.GameCenter = {
        completeLevel: (gameId, levelId, reward) =>
            console.log(...) // Solo imprimía en consola, no acreditaba coins
    };
}
```

**Fix:** `app.js` se carga como primera etiqueta script. El stub permanece pero ya no se activa mientras app.js esté presente.

```html
<!-- CORRECTO — app.js primero, luego los módulos del juego -->
<script src="../../js/app.js"></script>
<script src="snake-audio.js"></script>
<script src="snake-economy.js"></script>
...
```

---

### Bug B — Idempotencia de `completeLevel()`

`completeLevel()` en app.js implementa protección anti-duplicados:

```javascript
// Fragmento de app.js
completeLevel: (gameId, levelId, rewardAmount) => {
    if (!store.progress[gameId]) store.progress[gameId] = [];
    if (store.progress[gameId].includes(levelId)) {
        return { paid: false, coins: store.coins }; // ← RECHAZA SILENCIOSAMENTE
    }
    store.progress[gameId].push(levelId);
    store.coins += rewardAmount;
    // ...
}
```

Con `levelId = 'standard_mode'` fijo (v1.2):

```
Sesión 1: completeLevel('la_snake_classic', 'standard_mode', 80)
    → store.progress['la_snake_classic'] = ['standard_mode']
    → paid: true ✅ — 80 coins acreditados

Sesión 2: completeLevel('la_snake_classic', 'standard_mode', 120)
    → 'standard_mode' ya está en el array
    → paid: false ❌ — 0 coins, silenciosamente ignorado

Sesión N: Siempre rechazado ❌
```

**Fix (v1.3):** `LAS_sessionId` se genera en `startSession()` combinando timestamp y sufijo hexadecimal aleatorio:

```javascript
function LAS_generateSessionId() {
    const ts   = Date.now();
    const rand = Math.floor(Math.random() * 0xffff)
                     .toString(16).padStart(4, '0');
    return `session_${ts}_${rand}`;  // ej: "session_1719432800123_a7f3"
}
```

Cada sesión produce un `levelId` que app.js nunca ha visto:

```
Sesión 1: completeLevel('la_snake_classic', 'session_1719432800123_a7f3', 80)
    → paid: true ✅

Sesión 2: completeLevel('la_snake_classic', 'session_1719432800456_b2c1', 120)
    → paid: true ✅

Sesión N: Siempre un nuevo ID → siempre pagado ✅
```

> **Nota sobre crecimiento del store:** `store.progress['la_snake_classic']` acumula una entrada por sesión (~28 chars). Con 100 sesiones/día eso es ~2.8 KB/día. El localStorage soporta ~5 MB, equivalente a ~178 000 sesiones. Sin impacto práctico.

---

## 4. Flujo de Puntuación

### 4.1 Fuentes de Puntos

| Evento            | Puntos Base | Con Multiplicador         |
|-------------------|-------------|---------------------------|
| Comer comida      | 10          | 10 × combo_multiplier     |
| Comer power-up    | 25          | 25 × combo_multiplier     |

### 4.2 Ejemplo de Sesión

```
Ítem 1 comido (t=0s)     x1  →  10 pts  | Total: 10
Ítem 2 comido (t=1.2s)   x2  →  20 pts  | Total: 30
Ítem 3 comido (t=2.5s)   x3  →  30 pts  | Total: 60
Power-up (t=1.0s)        x4  → 100 pts  | Total: 160
Ítem 5 comido (t=2.9s)   x5  →  50 pts  | Total: 210
[Muerte con combo=5]
────────────────────────────────────────────
rewardAmount = floor(210 × 5) = 1 050 coins
```

---

## 5. Sistema de Combo

### 5.1 Mecánica

Cada ítem comido en menos de **3 segundos** del anterior incrementa el multiplicador en +1, hasta x8. Sin comer durante 3 segundos: reset a x1.

### 5.2 Tabla de Multiplicadores

| x | Pts/comida | Pts/power-up |
|---|------------|--------------|
| 1 | 10         | 25           |
| 2 | 20         | 50           |
| 3 | 30         | 75           |
| 4 | 40         | 100          |
| 5 | 50         | 125          |
| 6 | 60         | 150          |
| 7 | 70         | 175          |
| 8 | 80         | 200          |

---

## 6. Sistema de Recompensas (Coins)

### 6.1 Fórmula (v1.2+)

```javascript
const multiplierAtDeath = LAS_comboMultiplier; // capturar ANTES del reset
const rewardAmount = Math.max(1, Math.floor(finalScore * multiplierAtDeath));
```

### 6.2 Tabla de Ejemplos

| Score Final | Combo al morir | Reward  |
|-------------|----------------|---------|
| 10          | x1             | 10      |
| 100         | x5             | 500     |
| 500         | x2             | 1 000   |
| 500         | x8             | 4 000   |
| 0           | x1             | 1 (mín) |

### 6.3 Secuencia de Entrega (v1.3)

```
Muerte de serpiente
    │
    ▼ sfxDeath() + render overlay final
    │
    ▼ [100ms delay — DOM de app.js estable]
    │
    ▼ LAS_Economy.endSession(finalScore, snakeLength)
        ├── captureMultiplier = LAS_comboMultiplier   ← ANTES del reset
        ├── LAS_comboMultiplier = 1                   ← reset
        ├── saveHighScore()
        ├── rewardAmount = max(1, floor(score × captured))
        └── GameCenter.completeLevel(
                'la_snake_classic',       ← gameId estable
                'session_1719…_a7f3',     ← levelId ÚNICO ← FIX v1.3
                rewardAmount              ← integer >= 1
            )
    │
    ▼ [700ms — pausa para leer overlay]
    │
    ▼ Pantalla Game Over → muestra reward
```

---

## 7. Sistema de Skins y Progresión

| Score mínimo | Skin ID   | Nombre         |
|--------------|-----------|----------------|
| 0            | `classic` | Classic Green  |
| 500          | `neon`    | Neon Pulse     |
| 1500         | `cyber`   | Cyber Scale    |
| 3000         | `gold`    | Gold Edition   |

Condición de selección: `LAS_Economy.getHighScore() >= skin.unlockScore`. El botón SELECT está desactivado si no se cumple.

---

## 8. Persistencia y Almacenamiento

Claves exclusivas con prefijo `LAS_` (no interfieren con claves de Love Arcade):

| Clave               | Tipo       |
|---------------------|------------|
| `LAS_highScore`     | `number`   |
| `LAS_unlockedSkins` | `string[]` |
| `LAS_selectedSkin`  | `string`   |

> **Separación de stores:** Snake usa claves `LAS_*` mientras Love Arcade usa `gamecenter_v6_promos`. No hay colisión posible.

---

## 9. Integración GameCenter — Contrato Completo

### 9.1 Firma de la API (per Love Arcade docs §5.2)

```typescript
window.GameCenter.completeLevel(
    gameId:       string,  // 'la_snake_classic' — estable, registrado en app.js
    levelId:      string,  // 'session_{ts}_{rand}' — único por sesión
    rewardAmount: number   // integer >= 1
): { paid: boolean, coins: number }
```

### 9.2 Código de producción (snake-economy.js)

```javascript
if (window.GameCenter &&
    typeof window.GameCenter.completeLevel === 'function') {
    try {
        window.GameCenter.completeLevel(
            LAS_GAME_ID,   // 'la_snake_classic'
            LAS_sessionId, // 'session_1719432800123_a7f3' — único
            rewardAmount
        );
    } catch (err) {
        console.warn('[LAS_Economy] completeLevel failed:', err);
    }
}
```

### 9.3 Stub de desarrollo (snake.html orquestador)

```javascript
// Solo activo cuando app.js NO está cargado (modo standalone/pruebas)
if (!window.GameCenter) {
    window.GameCenter = {
        completeLevel: (gameId, levelId, reward) =>
            console.log(`[GameCenter STUB] ${gameId} / ${levelId} / ${reward} coins`)
    };
}
```

### 9.4 Checklist de integración Love Arcade (§11 de los docs oficiales)

| Item | Estado |
|------|--------|
| El juego importa `app.js` | ✅ v1.3 — `<script src="../../js/app.js">` añadido primero |
| Recompensas calculadas internamente antes del evento | ✅ |
| `completeLevel()` llamado en el momento de victoria | ✅ |
| Parámetros respetan tipos (`String`, `String`, `Int`) | ✅ |
| El juego NO escribe claves reservadas en `localStorage` | ✅ prefijo `LAS_` |
| Funciona sin `window.GameCenter` (modo standalone) | ✅ stub guardado con `if` |
| El contador de Navbar incrementa al ganar | ✅ — con todos los fixes aplicados |

---

## 10. Balanceo Económico

| Habilidad    | Score/sesión | Combo típico | Reward   |
|--------------|-------------|--------------|----------|
| Principiante | 80          | x1           | 80       |
| Intermedio   | 300         | x2           | 600      |
| Avanzado     | 1 000       | x4           | 4 000    |
| Experto      | 3 000       | x6           | 18 000   |

Ajustar en `snake-economy.js`:

```javascript
const LAS_COMBO_WINDOW_MS = 3000;   // ms — ventana de combo
const LAS_MAX_MULTIPLIER  = 8;      // techo del multiplicador
const LAS_BASE_POINT_FOOD = 10;     // puntos base por comida
```

---

## 11. Referencia de API (snake-economy.js)

```javascript
// Sesión
LAS_Economy.startSession()           // genera nuevo sessionId único; resetea todo
LAS_Economy.endSession(score, len)   // → { finalScore, rewardAmount, multiplierAtDeath,
                                     //     isNewRecord, allTimeHigh, sessionId }

// Puntuación
LAS_Economy.onItemEaten(isPowerup)   // → number (pts otorgados)
LAS_Economy.getSessionScore()        // → number
LAS_Economy.getComboMultiplier()     // → number (1–8)
LAS_Economy.getComboBarData()        // → { multiplier, multiplierPercent, timePercent, isActive }

// Skins
LAS_Economy.getSkinDefinitions()     // → [{ id, name, unlockScore, description }]
LAS_Economy.isSkinAvailable(id)      // → bool (highScore >= unlockScore)
LAS_Economy.getSelectedSkin()        // → string
LAS_Economy.setSelectedSkin(id)      // persiste en localStorage
LAS_Economy.getHighScore()           // → number

// Callbacks
LAS_Economy.onComboChange(fn)        // fn(multiplier: number)
LAS_Economy.onScoreChange(fn)        // fn(score: number)
LAS_Economy.onSkinUnlock(fn)         // fn(skinId: string)

// Constantes
LAS_Economy.GAME_ID                  // 'la_snake_classic'
LAS_Economy.COMBO_WINDOW_MS          // 3000
LAS_Economy.MAX_MULTIPLIER           // 8
```

---

*Documentación de Economía — LA-Snake Classic v1.3.0*
*Módulo: snake-economy.js | Game ID: la_snake_classic | Prefijo: LAS_*
