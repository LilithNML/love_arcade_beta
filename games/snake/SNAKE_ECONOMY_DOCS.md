# Snake — Documentación de Economía
### LA-Snake Classic v1.2 | Sistema Económico

---

## Tabla de Contenidos

1. [Principios del Sistema Económico](#1-principios-del-sistema-económico)
2. [Flujo de Puntuación](#2-flujo-de-puntuación)
3. [Sistema de Combo](#3-sistema-de-combo)
4. [Sistema de Recompensas (Coins)](#4-sistema-de-recompensas-coins)
5. [Sistema de Skins y Progresión](#5-sistema-de-skins-y-progresión)
6. [Persistencia y Almacenamiento](#6-persistencia-y-almacenamiento)
7. [Integración GameCenter — Correcciones v1.2](#7-integración-gamecenter--correcciones-v12)
8. [Balanceo Económico](#8-balanceo-económico)
9. [Referencia de API (snake-economy.js)](#9-referencia-de-api-snake-economyjs)

---

## 1. Principios del Sistema Económico

**1. Recompensa solo al finalizar sesión**
Los coins se calculan y entregan únicamente cuando la serpiente muere. No existe entrega parcial ni durante el juego.

**2. Progresión por alto puntaje histórico**
Las skins se desbloquean basándose en el `highScore` histórico, no en el score de la sesión actual.

**3. Multiplicador capturado en el momento de muerte (v1.2)**
A diferencia de la v1.0 donde el combo se reseteaba antes del cálculo, la v1.2 captura el `comboMultiplier` en el instante previo al reset, recompensando sesiones de alto ritmo que terminan abruptamente.

---

## 2. Flujo de Puntuación

### 2.1 Fuentes de Puntos

| Evento            | Puntos Base | Con Multiplicador         |
|-------------------|-------------|---------------------------|
| Comer comida      | 10          | 10 × combo_multiplier     |
| Comer power-up    | 25          | 25 × combo_multiplier     |

### 2.2 Ejemplo de Sesión

```
Ítem 1 comido (t=0s)          x1  →  10 pts  | Total: 10
Ítem 2 comido (t=1.2s)        x2  →  20 pts  | Total: 30
Ítem 3 comido (t=2.5s)        x3  →  30 pts  | Total: 60
Power-up comido (t=1.0s)      x4  →  100 pts | Total: 160
Ítem 5 comido (t=2.9s)        x5  →  50 pts  | Total: 210
[Muerte mientras combo=5]
────────────────────────────────────────────
finalReward = floor(210 × 5) = 1050 coins
```

---

## 3. Sistema de Combo

### 3.1 Mecánica Central

Cada ítem comido en menos de **3 segundos** del anterior incrementa el multiplicador en +1, hasta un máximo de x8.

```
Estado inicial:      x1
Comer en < 3s:       +1 (hasta x8)
Sin comer en 3s:     reset a x1
Muerte:              reset a x1 DESPUÉS de capturar para reward (v1.2)
```

### 3.2 Tabla de Multiplicadores

| x | Ítems consecutivos | Pts/comida | Pts/power-up |
|---|---------------------|------------|--------------|
| 1 | 0–1                 | 10         | 25           |
| 2 | 2                   | 20         | 50           |
| 3 | 3                   | 30         | 75           |
| 4 | 4                   | 40         | 100          |
| 5 | 5                   | 50         | 125          |
| 6 | 6                   | 60         | 150          |
| 7 | 7                   | 70         | 175          |
| 8 | 8+                  | 80         | 200          |

### 3.3 Ventana de 3 Segundos

```
eat() ────────────────────────────────────────────────►
       │←────── 3000ms ──────►│
       │                       │
       │  Si come aquí:        │  Si no come aquí:
       │  combo++              │  combo RESET a x1
       └───────────────────────┘
```

El timer se reinicia con cada comida exitosa.

### 3.4 Visualización

**Barra de combo (sólida, sin transparencias):**
- Ancho = `((multiplier - 1) / 7) × 100%`
- Color fijo: `#ff9f0a`

**Borde del canvas (outline sólido CSS, sin blur/glow):**

| Multiplicador | Color del outline |
|---------------|-------------------|
| x2 – x4       | `#ff9f0a`         |
| x5 – x7       | `#ff6b00`         |
| x8            | `#ff3b30`         |

---

## 4. Sistema de Recompensas (Coins)

### 4.1 Fórmula v1.2

```javascript
// Captura ANTES del reset del combo
const multiplierAtDeath = LAS_comboMultiplier;

// Siempre entero >= 1
const rewardAmount = Math.max(1, Math.floor(finalScore * multiplierAtDeath));
```

**Diferencia respecto a v1.0:**
- v1.0: `max(1, floor(score / 10))` — reward fija, independiente del combo
- v1.2: `max(1, floor(score × comboAtDeath))` — reward amplificada por el combo

### 4.2 Tabla de Ejemplos (v1.2)

| Score Final | Combo al morir | Reward            |
|-------------|----------------|-------------------|
| 10          | x1             | 10                |
| 10          | x3             | 30                |
| 100         | x1             | 100               |
| 100         | x5             | 500               |
| 500         | x2             | 1,000             |
| 500         | x8             | 4,000             |
| 1,000       | x1             | 1,000             |
| 0           | x1             | 1 (mínimo)        |

### 4.3 Timing de Entrega

```
Evento de muerte
    │
    ▼ sfxDeath() + render overlay
    │
    ▼ [100ms delay — app.js v9.4 DOM listo]
    │
    ▼ LAS_Economy.endSession(finalScore, snakeLength)
        ├── captureMultiplier = LAS_comboMultiplier  ← ANTES del reset
        ├── LAS_comboMultiplier = 1                   ← reset
        ├── saveHighScore()
        ├── rewardAmount = max(1, floor(score × capturedMultiplier))
        └── GameCenter.completeLevel(...)              ← ÚNICA llamada
    │
    ▼ [700ms — tiempo de lectura de overlay]
    │
    ▼ Pantalla Game Over → muestra reward
```

### 4.4 Garantías del Sistema

- **Exactamente una llamada** a `completeLevel` por sesión.
- **Siempre entero >= 1** (Math.floor + Math.max).
- **try/catch**: un fallo de GameCenter no rompe el flujo del juego.
- **Existencia verificada**: `window.GameCenter && typeof .completeLevel === 'function'`.

---

## 5. Sistema de Skins y Progresión

### 5.1 Árbol de Progresión

```
0 pts ────────────── Classic Green  (desbloqueada por defecto)
500 pts ──────────── Neon Pulse
1500 pts ─────────── Cyber Scale
3000 pts ─────────── Gold Edition
```

### 5.2 Condición de Selección (v1.2)

El botón SELECT en el menú está **desactivado** si `highScore < skin.unlockScore`:

```javascript
selectBtn.disabled = (LAS_Economy.getHighScore() < skin.unlockScore);
```

No se puede hacer click en skins bloqueadas aunque sean visibles en el selector.

### 5.3 Estados de una Skin

| Estado      | Condición                    | UI                                           |
|-------------|------------------------------|----------------------------------------------|
| Disponible  | `highScore >= unlockScore`   | Preview en color, botón SELECT activo        |
| Activa      | Disponible + seleccionada    | Borde verde, botón muestra "ACTIVE"          |
| Bloqueada   | `highScore < unlockScore`    | Preview grayscale 40% opacidad, btn LOCKED   |

---

## 6. Persistencia y Almacenamiento

### 6.1 Claves de localStorage

| Clave               | Tipo       | Descripción                         |
|---------------------|------------|-------------------------------------|
| `LAS_highScore`     | `number`   | Puntuación histórica máxima         |
| `LAS_unlockedSkins` | `string[]` | IDs de skins desbloqueadas          |
| `LAS_selectedSkin`  | `string`   | ID de la skin activa                |

### 6.2 Manejo de Errores

`try/catch` en lectura y escritura. Sin `localStorage` (modo privado, cuota llena): el juego funciona con datos en memoria sin persistencia.

---

## 7. Integración GameCenter — Correcciones v1.2

### 7.1 IDs Corregidos

| Campo    | v1.0 (incorrecto)  | v1.2 (correcto)      | Motivo                                  |
|----------|--------------------|----------------------|-----------------------------------------|
| `gameId` | `'snake'`          | `'la_snake_classic'` | app.js v9.4 rechaza IDs genéricos       |
| `levelId`| `'session'`        | `'standard_mode'`    | app.js v9.4 rechaza IDs no registrados  |

### 7.2 Contrato de API

```typescript
window.GameCenter.completeLevel(
    gameId:       'la_snake_classic',   // string — ID registrado en app.js
    levelId:      'standard_mode',      // string — modo de juego
    rewardAmount: number                // integer >= 1
): void
```

### 7.3 Stub de Desarrollo

```javascript
// Inyectado automáticamente si window.GameCenter no existe
window.GameCenter = {
    completeLevel: (gameId, levelId, reward) =>
        console.log(`[GameCenter] ${gameId} / ${levelId} / ${reward} coins`)
};
```

### 7.4 Delay de 100ms

El orquestador espera 100ms entre el evento de muerte y la llamada a `endSession`:

```javascript
// En el callback onDeath del orquestador
setTimeout(() => {
    const result = LAS_Economy.endSession(score, state.length);
    // ... mostrar resultados
}, 100); // Garantiza que el DOM de app.js v9.4 está listo
```

---

## 8. Balanceo Económico

### 8.1 Impacto de la Nueva Fórmula (v1.2)

La multiplicación del score por el combo al morir **eleva significativamente** las recompensas para jugadores avanzados:

| Habilidad    | Score/sesión | Combo típico | Reward v1.0 | Reward v1.2 |
|--------------|-------------|--------------|-------------|-------------|
| Principiante | 80          | x1           | 8           | 80          |
| Intermedio   | 300         | x2           | 30          | 600         |
| Avanzado     | 1,000       | x4           | 100         | 4,000       |
| Experto      | 3,000       | x6           | 300         | 18,000      |

### 8.2 Sesiones para Desbloqueo de Skins

Con la nueva fórmula de rewards, las skins se desbloquean por **skill acumulado (high score)** independientemente de los coins:

| Skin         | Score requerido | Sesiones (principiante) | Sesiones (intermedio) |
|--------------|-----------------|-------------------------|-----------------------|
| Neon Pulse   | 500             | 4 – 7                   | 1 – 2                 |
| Cyber Scale  | 1,500           | 10 – 20                 | 3 – 5                 |
| Gold Edition | 3,000           | 20 – 38                 | 5 – 10                |

### 8.3 Ajustes Recomendados

```javascript
// snake-economy.js — para recalibrar
const LAS_COMBO_WINDOW_MS    = 3000;  // aumentar = más fácil mantener combo
const LAS_MAX_MULTIPLIER     = 8;     // reducir para menos amplificación
const LAS_BASE_POINT_FOOD    = 10;    // ajusta base de puntuación
const LAS_BASE_POINT_POWERUP = 25;    // incentivo para recoger power-ups
```

---

## 9. Referencia de API (snake-economy.js)

### Sesión

```javascript
LAS_Economy.startSession()
// Resetea score, combo, timer. Llamar antes de startGame().

LAS_Economy.endSession(finalScore, snakeLength)
// → { finalScore, rewardAmount, multiplierAtDeath, isNewRecord, allTimeHigh }
// Guarda high score, llama GameCenter, resetea combo.
// Llamar con 100ms de delay tras el evento de muerte.
```

### Puntuación y Combo

```javascript
LAS_Economy.onItemEaten(isPowerup)
// → number — puntos otorgados. Actualiza combo, score, y dispara callbacks.

LAS_Economy.getSessionScore()     // → number
LAS_Economy.getComboMultiplier()  // → number (1–8)
LAS_Economy.getComboBarData()
// → { multiplier, multiplierPercent, timePercent, isActive }
```

### Skins

```javascript
LAS_Economy.getSkinDefinitions()  // → [{ id, name, unlockScore, description }]
LAS_Economy.getUnlockedSkins()    // → string[]
LAS_Economy.isSkinUnlocked(id)    // → bool
LAS_Economy.isSkinAvailable(id)   // → bool (highScore >= unlockScore)
LAS_Economy.getSelectedSkin()     // → string
LAS_Economy.setSelectedSkin(id)   // persiste en localStorage
```

### Persistencia

```javascript
LAS_Economy.getHighScore()        // → number
```

### Constantes Exportadas

```javascript
LAS_Economy.GAME_ID           // 'la_snake_classic'
LAS_Economy.LEVEL_ID          // 'standard_mode'
LAS_Economy.COMBO_WINDOW_MS   // 3000
LAS_Economy.MAX_MULTIPLIER    // 8
```

### Callbacks

```javascript
LAS_Economy.onComboChange(fn)   // fn(multiplier: number)
LAS_Economy.onScoreChange(fn)   // fn(score: number)
LAS_Economy.onSkinUnlock(fn)    // fn(skinId: string)
```

---

*Documentación de Economía — LA-Snake Classic v1.2.0*
*Módulo: snake-economy.js | Prefijo: LAS_ | Game ID: la_snake_classic*
