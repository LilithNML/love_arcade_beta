# Snake — Documentación de Economía
### LA-Snake Classic | Sistema Económico v1.0

---

## Tabla de Contenidos

1. [Principios del Sistema Económico](#1-principios-del-sistema-económico)
2. [Flujo de Puntuación](#2-flujo-de-puntuación)
3. [Sistema de Combo](#3-sistema-de-combo)
4. [Sistema de Recompensas (Coins)](#4-sistema-de-recompensas-coins)
5. [Sistema de Skins y Progresión](#5-sistema-de-skins-y-progresión)
6. [Persistencia y Almacenamiento](#6-persistencia-y-almacenamiento)
7. [Integración GameCenter](#7-integración-gamecenter)
8. [Balanceo Económico](#8-balanceo-económico)
9. [Referencia de API (snake-economy.js)](#9-referencia-de-api-snake-economyjs)

---

## 1. Principios del Sistema Económico

La economía de Snake se rige por tres principios fundamentales:

**1. Recompensa solo al finalizar sesión**
Los coins se calculan y entregan únicamente cuando la partida termina (muerte de la serpiente). No existe entrega de coins parcial ni durante el juego. Esto evita incentivos de abandono deliberado y asegura que cada coin representa una sesión completa.

**2. Progresión por alto puntaje histórico**
Las skins se desbloquean basándose en el `highScore` almacenado, no en el score de la sesión actual. Esto significa que una sesión extraordinaria desbloquea contenido permanente incluso si el jugador muere poco después.

**3. Multiplicadores de corto plazo**
El sistema de combo recompensa el ritmo de juego (comer rápido) pero se resetea al morir. Los multiplicadores no se acumulan entre sesiones.

---

## 2. Flujo de Puntuación

### 2.1 Fuentes de Puntos

| Evento            | Puntos Base | Con Multiplicador       |
|-------------------|-------------|-------------------------|
| Comer comida      | 10          | 10 × combo_multiplier   |
| Comer power-up    | 25          | 25 × combo_multiplier   |

### 2.2 Ejemplo de Sesión

```
Ítem 1 comido (t=0s)        → x1 →  10 pts   | Total: 10
Ítem 2 comido (t=1.5s)      → x2 →  20 pts   | Total: 30
Ítem 3 comido (t=2.8s)      → x3 →  30 pts   | Total: 60
[Pausa de 3.5s — combo reset]
Ítem 4 comido               → x1 →  10 pts   | Total: 70
Power-up comido (t=0.8s)    → x2 →  50 pts   | Total: 120
```

### 2.3 Techo de Puntuación por Sesión

No hay cap de puntuación por sesión. Una partida perfecta con multiplicador x8 sostenido podría generar puntajes en el rango de 5,000+ puntos.

**Estimación teórica de máximo:**
- Grid de 20×20 = 400 celdas
- Serpiente ocupa ~50 celdas en estado avanzado
- ~350 comidas posibles × 10pts × x8 = 28,000 pts máx teórico

---

## 3. Sistema de Combo

### 3.1 Mecánica Central

El combo mide la **velocidad de consumo de ítems**. Cada ítem comido en menos de **3 segundos** del anterior incrementa el multiplicador en +1.

```
Estado inicial:     x1
Comer en < 3s:      +1 (hasta x8)
Comer después 3s:   reset a x1
Morir:              reset a x1 (no persiste)
```

### 3.2 Tabla de Multiplicadores

| Multiplicador | Ítems consecutivos | Puntos por comida | Puntos por power-up |
|---------------|-------------------|-------------------|---------------------|
| x1            | 0 – 1             | 10                | 25                  |
| x2            | 2                 | 20                | 50                  |
| x3            | 3                 | 30                | 75                  |
| x4            | 4                 | 40                | 100                 |
| x5            | 5                 | 50                | 125                 |
| x6            | 6                 | 60                | 150                 |
| x7            | 7                 | 70                | 175                 |
| x8 (techo)    | 8+                | 80                | 200                 |

### 3.3 Ventana de Combo (3 segundos)

```
eat() ──────────────────────────────────────────────────────►
       │←────── 3000ms ──────►│
       │                       │
       │  Si se come aquí:     │  Si no se come aquí:
       │  combo++              │  combo RESET a x1
       └───────────────────────┘
```

El timer se reinicia con cada comida. Solo decae si no se come durante 3 segundos completos.

### 3.4 Visualización del Combo

**Barra de combo (LAS_comboBarOuter):**
- Barra sólida horizontal (no transparente, no blur)
- Ancho = `((multiplier - 1) / 7) × 100%`
- Color: `#ff9f0a` (naranja) — sólido

**Indicador de multiplicador (LAS_comboMulti):**
- Texto `x1`, `x2`, etc.
- Color activo: `#ff9f0a`
- Color inactivo (x1): `#444444`

**Borde del canvas (flash):**

| Rango          | Color del outline |
|----------------|-------------------|
| x2 – x4        | `#ff9f0a`         |
| x5 – x7        | `#ff6b00`         |
| x8             | `#ff3b30`         |

Duración del flash: **400ms**. No hay blur/glow (flat design).

### 3.5 Audio de Combo

Cada vez que sube el multiplicador:
- `LAS_Audio.sfxCombo(multiplier)` — tono doble que escala con el nivel
- Frecuencia base: `200 + multiplier × 80` Hz

---

## 4. Sistema de Recompensas (Coins)

### 4.1 Fórmula de Recompensa

```
rewardAmount = max(1, floor(finalScore / 10))
```

| Score Final | Coins Entregados |
|-------------|------------------|
| 0 – 9       | 1 (mínimo)       |
| 10          | 1                |
| 100         | 10               |
| 500         | 50               |
| 1,000       | 100              |
| 3,000       | 300              |
| 5,000       | 500              |

### 4.2 Timing de Entrega

```
Evento de muerte
    │
    ▼ (900ms — delay para ver la animación de muerte)
    │
    ▼ LAS_Economy.endSession(finalScore, snakeLength)
        │
        ├── Guarda high score si corresponde
        ├── Calcula rewardAmount
        ├── Llama window.GameCenter.completeLevel()  ← ÚNICA entrega
        └── Devuelve { finalScore, rewardAmount, isNewRecord, allTimeHigh }
```

**La recompensa se llama exactamente una vez por sesión.**

### 4.3 Pantalla de Game Over

La UI muestra los coins ganados en una caja destacada:

```
┌─────────────────────────────┐
│  + 150 COINS EARNED         │  ← borde dorado, texto dorado
└─────────────────────────────┘
```

---

## 5. Sistema de Skins y Progresión

### 5.1 Árbol de Progresión

```
0 pts ─────────────── Classic Green (desbloqueada por defecto)
  │
500 pts ─────────────── Neon Pulse
  │
1500 pts ────────────── Cyber Scale
  │
3000 pts ────────────── Gold Edition
```

### 5.2 Condición de Desbloqueo

```javascript
// Una skin está disponible si:
currentHighScore >= skin.unlockScore
```

El desbloqueo es **permanente** y se verifica:
1. Después de cada ítem comido (durante la sesión)
2. Al finalizar la sesión (endSession)
3. Al cargar la aplicación (el carrusel consulta el high score guardado)

### 5.3 Estados de una Skin

| Estado      | Condición                                     | UI                            |
|-------------|-----------------------------------------------|-------------------------------|
| Disponible  | `highScore >= unlockScore`                    | Seleccionable, preview activo |
| Bloqueada   | `highScore < unlockScore`                     | Preview gris, score requerido |
| Seleccionada| Disponible + elegida por el jugador           | Borde verde activo            |

### 5.4 Notificación de Desbloqueo

Al desbloquear una skin, aparece un toast en la parte superior:

```
┌────────────────────────────────┐
│  UNLOCKED: NEON PULSE          │  ← borde naranja, texto naranja
└────────────────────────────────┘
```

Duración: **3 segundos**. Animación: slide-down + fade.

---

## 6. Persistencia y Almacenamiento

### 6.1 Claves de localStorage

Todas las claves usan el prefijo `LAS_` para evitar colisiones con otros juegos del ecosistema.

| Clave             | Tipo         | Descripción                                       | Ejemplo          |
|-------------------|--------------|---------------------------------------------------|------------------|
| `LAS_highScore`   | `number`     | Puntuación histórica más alta                     | `1520`           |
| `LAS_unlockedSkins`| `string[]`  | Array de IDs de skins desbloqueadas               | `["classic","neon"]` |
| `LAS_selectedSkin`| `string`     | ID de la skin actualmente seleccionada            | `"neon"`         |

### 6.2 Funciones de Acceso

```javascript
// Lectura
LAS_Economy.getHighScore()         // → number
LAS_Economy.getUnlockedSkins()     // → string[]
LAS_Economy.getSelectedSkin()      // → string

// Escritura
LAS_Economy.setSelectedSkin(id)    // persiste selección

// Verificación
LAS_Economy.isSkinAvailable(id)    // highScore >= unlockScore
LAS_Economy.isSkinUnlocked(id)     // está en unlockedSkins[]
```

### 6.3 Manejo de Errores de Almacenamiento

Las funciones de escritura/lectura están envueltas en `try/catch`. Si `localStorage` no está disponible (modo privado, cuota llena), el juego continúa funcionando con datos en memoria pero sin persistencia entre sesiones.

---

## 7. Integración GameCenter

### 7.1 Contrato de API

El juego espera la siguiente firma en `window.GameCenter`:

```typescript
interface GameCenter {
    completeLevel(
        gameId: string,     // 'snake'
        levelId: string,    // 'session'
        rewardAmount: number // coins a entregar (entero ≥ 1)
    ): void;
}
```

### 7.2 Stub de Desarrollo

Si el host no inyecta `window.GameCenter`, se activa automáticamente un stub que loggea a consola sin lanzar errores:

```javascript
window.GameCenter = {
    completeLevel: function(gameId, levelId, reward) {
        console.log(`[GameCenter] ${gameId} / ${levelId} / ${reward} coins`);
    }
};
```

### 7.3 Ejemplo de Llamada Real

```javascript
// Sesión con score final de 750 pts:
window.GameCenter.completeLevel(
    'snake',     // gameId
    'session',   // levelId — siempre 'session' en este juego
    75           // floor(750 / 10) = 75 coins
);
```

### 7.4 Garantías de Llamada

- La llamada se realiza **exactamente una vez** por sesión.
- Siempre se llama incluso si el score es 0 (entrega mínima de 1 coin).
- El try/catch alrededor de la llamada garantiza que un fallo de GameCenter no rompa el flujo del juego.
- Los skins no se desbloquean a través de GameCenter — usan localStorage directamente.

---

## 8. Balanceo Económico

### 8.1 Velocidad de Progresión Estimada

Asumiendo un jugador promedio con combo x2 sostenido y 1 power-up cada 8 comidas:

| Nivel de habilidad | Score promedio/sesión | Sesiones para Neon (500) | Sesiones para Gold (3000) |
|--------------------|-----------------------|--------------------------|---------------------------|
| Principiante       | 80 – 150              | 4 – 7                    | 20 – 38                   |
| Intermedio         | 300 – 600             | 1 – 2                    | 5 – 10                    |
| Avanzado           | 1000 – 2000           | 1                        | 2 – 3                     |
| Experto (combo x8) | 3000+                 | 1                        | 1                         |

### 8.2 Curva de Dificultad

La serpiente crece con cada ítem consumido, lo que aumenta orgánicamente la dificultad:

- **Inicio**: Serpiente de 3 segmentos, fácil de maniobrar
- **Mid-game** (~20 segmentos): Requiere planificación de rutas
- **Late-game** (~50+ segmentos): Riesgo de auto-colisión elevado

El power-up **Ghost** actúa como válvula de seguridad en late-game, permitiendo al jugador avanzado sostener combos altos sin terminar la sesión por error.

### 8.3 Razón Coins/Score

La razón `1 coin : 10 puntos` está diseñada para que:
- Una sesión casual (~100pts) genere ~10 coins
- Una sesión excelente (~1000pts) genere ~100 coins
- El skin Gold requiere ~300 coins de valor de sesión para desbloquearse

Esto crea un sistema donde el contenido cosmético se desbloquea por **habilidad acumulada** (high score), no por grinding de coins.

### 8.4 Ajustes Recomendados

Para modificar el balance sin tocar la lógica central:

```javascript
// snake-economy.js — Constants
const LAS_COMBO_WINDOW_MS    = 3000;  // Aumentar = más fácil mantener combo
const LAS_MAX_MULTIPLIER     = 8;     // Reducir para combo menos poderoso
const LAS_BASE_POINT_FOOD    = 10;    // Aumentar = más monedas por sesión
const LAS_BASE_POINT_POWERUP = 25;    // Incentivo para recoger power-ups

// snake-core.js — Constants
const LAS_BASE_SPEED_MS      = 140;   // Reducir = juego más rápido
const LAS_POWERUP_SPAWN_INTERVAL = 8; // Reducir = más power-ups frecuentes
```

---

## 9. Referencia de API (snake-economy.js)

### Sesión

```javascript
LAS_Economy.startSession()
// Inicializa una nueva sesión. Resetea score y combo.
// Llamar antes de LAS_Core.startGame()

LAS_Economy.endSession(finalScore, snakeLength)
// Cierra la sesión, guarda high score, llama GameCenter.
// Devuelve: { finalScore, rewardAmount, isNewRecord, allTimeHigh }
```

### Puntuación y Combo

```javascript
LAS_Economy.onItemEaten(isPowerup)
// Registra un ítem consumido. Actualiza combo y score.
// Devuelve: number — puntos otorgados en esta comida

LAS_Economy.getSessionScore()     // → number — score sesión actual
LAS_Economy.getComboMultiplier()  // → number — multiplicador actual (1–8)
LAS_Economy.getComboBarData()     // → { multiplier, multiplierPercent, timePercent, isActive }
```

### Skins

```javascript
LAS_Economy.getSkinDefinitions()  // → array de { id, name, unlockScore, description }
LAS_Economy.getUnlockedSkins()    // → string[] — IDs desbloqueadas
LAS_Economy.isSkinUnlocked(id)    // → bool — está en unlockedSkins
LAS_Economy.isSkinAvailable(id)   // → bool — highScore >= unlockScore
LAS_Economy.getSelectedSkin()     // → string — ID actual
LAS_Economy.setSelectedSkin(id)   // persiste selección
```

### Persistencia

```javascript
LAS_Economy.getHighScore()        // → number — high score histórico
```

### Callbacks

```javascript
LAS_Economy.onComboChange(fn)     // fn(multiplier: number)
LAS_Economy.onScoreChange(fn)     // fn(score: number)
LAS_Economy.onSkinUnlock(fn)      // fn(skinId: string)
```

---

*Documentación de Economía — LA-Snake Classic v1.0.0*
*Módulo: snake-economy.js | Prefijo: LAS_*
