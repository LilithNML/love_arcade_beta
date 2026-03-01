# Jungle Dash — Economía de Recompensas

> **Versión:** `1.3.0` · **Plataforma:** Love Arcade · **ID del juego:** `jungle-dash`

---

## Índice

1. [Objetivo de diseño](#1-objetivo-de-diseño)
2. [Fuentes de monedas](#2-fuentes-de-monedas)
3. [Multiplicador de score dinámico](#3-multiplicador-de-score-dinámico)
4. [Super Moneda](#4-super-moneda)
5. [Matriz de balance](#5-matriz-de-balance)
6. [Hitbox diferencial (magnetismo)](#6-hitbox-diferencial-magnetismo)
7. [Flujo de reporte al GameCenter](#7-flujo-de-reporte-al-gamecenter)
8. [Implementación técnica](#8-implementación-técnica)

---

## 1. Objetivo de diseño

La economía de v1.3.0 está diseñada para alcanzar **256 monedas** en **5 000 puntos**, con el objetivo de aumentar el *game feel* y la retención. Las recompensas se obtienen de dos fuentes complementarias:

| Fuente | Tipo | Monedas en 5 000 pts |
|---|---|---|
| Conversión pasiva (puntuación) | Automática al final de la partida | 166 |
| Super Monedas recogidas | Activa durante el juego | 90 (3 × 30) |
| **Total** | | **256** |

---

## 2. Fuentes de monedas

### Fuente pasiva — Conversión de puntuación

Al finalizar la partida, la puntuación acumulada se convierte directamente en monedas Love Arcade a razón de **1 moneda por cada 30 puntos**:

```js
// JD_Core.js — gameOver()
const JD_passiveCoins = Math.floor(JD_score / 30);
```

Este ratio reemplaza la conversión anterior (`score / 500`) e implica que el jugador empieza a acumular monedas a partir de los **30 puntos** en lugar de los 500.

### Fuente activa — Super Monedas

Las Super Monedas son ítems de recompensa que aparecen durante la partida y valen **30 monedas** cada una al ser recogidas. Se acumulan durante la sesión y se suman a las monedas pasivas al terminar:

```js
// JD_Core.js — gameOver()
const JD_activeCoins = JD_Entities.superCoinsCollected * 30;
JD_coinsEarned       = JD_passiveCoins + JD_activeCoins;
```

---

## 3. Multiplicador de score dinámico

La puntuación ya no crece a una tasa fija sino que incorpora un multiplicador que premia la longevidad. A mayor tiempo jugado, mayor es la aceleración del score y, por tanto, de las monedas pasivas obtenidas.

### Fórmula

```js
// JD_Core.js — _update()
JD_score += (delta * 0.1) * JD_currentMultiplier;
```

### Tramos del multiplicador

| Tramo de puntuación | Multiplicador | Tasa de score (pts/s a 60 fps) |
|---|---|---|
| 0 – 1 000 pts | **1.0×** | ~6 pts/s |
| 1 001 – 3 000 pts | **1.5×** | ~9 pts/s |
| 3 001 + pts | **2.0×** | ~12 pts/s |

### Lógica de actualización

```js
// JD_Core.js — _update()
if (JD_score <= 1000) {
    JD_currentMultiplier = 1.0;
} else if (JD_score <= 3000) {
    JD_currentMultiplier = 1.5;
} else {
    JD_currentMultiplier = 2.0;
}
```

El multiplicador se reinicia a `1.0` al inicio de cada nueva partida.

---

## 4. Super Moneda

### Asset

| Campo | Valor |
|---|---|
| Sprite | `assets/sprites/JD_item_supercoin.webp` |
| Dimensiones | 32 × 32 px (coordenadas virtuales) |
| Fallback | Círculo dorado con gradiente radial + halo + estrella de 4 puntas |

### Comportamiento

**Spawn:**

- Aparece con una probabilidad del **5 %** en cada ciclo de spawn de obstáculos, siempre que la puntuación supere los **1 000 puntos**.
- Cuando se decide spawnear una Super Moneda, **no aparece ningún obstáculo** en ese ciclo.
- Posición X: fuera del borde derecho del canvas (igual que los obstáculos).
- Posición Y base: `groundY − 90 px` (zona cómoda para alcanzar con un salto medio).

```js
// JD_Entities.js — JD_spawnObstacle()
if (JD_score > 1000 && Math.random() < 0.05) {
    const JD_sc  = new JD_SuperCoin(JD_canvasW, JD_groundY);
    JD_sc.JD_img = JD_sprites['item_supercoin'] || null;
    JD_superCoins.push(JD_sc);
    return; // No spawna obstáculo en este ciclo
}
```

**Flotación senoidal:**

Cada frame, la moneda actualiza su posición Y usando una función seno con una fase inicial aleatoria para que distintas monedas no se muevan en sincronía:

```js
// JD_SuperCoin — JD_updateFloat(delta)
this.JD_t += delta * 0.03;               // ~1.8 rad/s a 60 fps
this.y = this.baseY + Math.sin(this.JD_t) * 12; // ±12 px de amplitud
```

**Recogida:**

La detección de recogida usa `JD_Physics.checkItemCollection()` con `JD_ITEM_HITBOX_FACTOR = 1.30` (ver sección 6). Al recogerse:

1. La moneda se elimina del array `JD_superCoins`.
2. `JD_Entities.superCoinsCollected` incrementa en 1.
3. Se reproduce el SFX `JD_Audio.playSuperCoin()` (pitch agudo doble).

**Audio:**

El SFX de Super Moneda tiene un pitch significativamente más agudo que el de la moneda normal para reforzar el feedback positivo:

| SFX | Frecuencias | Duración | Forma de onda |
|---|---|---|---|
| Moneda normal (`playCoin`) | 520 Hz → 880 Hz | 0.18 s | Triangle |
| Super Moneda (`playSuperCoin`) | 900 Hz → 1 600 Hz + 1 600 Hz → 2 000 Hz | ~0.24 s (dos notas) | Triangle |

---

## 5. Matriz de balance

| Hito de puntuación | Multiplicador | Monedas pasivas (acum.) | Super Monedas (estimadas) | Total monedas |
|---|---|---|---|---|
| 1 000 pts | 1.0× | 33 | 0 | **33** |
| 2 500 pts | 1.5× | 83 | 1 (×30) | **113** |
| 5 000 pts | 2.0× | 166 | 3 (×30) | **256** |

> **Nota:** Las Super Monedas estimadas reflejan una tasa de spawn del 5 % a frecuencias de ciclo medias. Los valores reales varían por sesión.

---

## 6. Hitbox diferencial (magnetismo)

La detección de colisión aplica factores de hitbox distintos según el tipo de entidad:

| Tipo de entidad | Factor | Efecto |
|---|---|---|
| Obstáculos | `JD_HITBOX_FACTOR = 0.80` | Caja reducida al 80 % del sprite (mayor fairness) |
| Ítems / Super Monedas | `JD_ITEM_HITBOX_FACTOR = 1.30` | Caja expandida al 130 % del sprite |

El factor expandido crea un efecto de **succión magnética**: el jugador recoge la moneda visualmente antes de tocarla, eliminando la frustración del "casi lo agarro".

```js
// JD_Physics.js — checkItemCollection()
checkItemCollection(player, items) {
    const JD_pBox = JD_getHitboxWithFactor(player, JD_ITEM_HITBOX_FACTOR);
    for (let i = 0; i < items.length; i++) {
        const JD_iBox = JD_getHitboxWithFactor(items[i], JD_ITEM_HITBOX_FACTOR);
        if (JD_aabbOverlap(JD_pBox, JD_iBox)) return i;
    }
    return -1;
}
```

---

## 7. Flujo de reporte al GameCenter

```js
// JD_Core.js — gameOver()
const JD_passiveCoins = Math.floor(JD_score / 40);
const JD_activeCoins  = JD_Entities.superCoinsCollected * 25;
JD_coinsEarned        = JD_passiveCoins + JD_activeCoins;

if (JD_coinsEarned > 0) {
    if (typeof window.GameCenter !== 'undefined') {
        const JD_sessionId = 'jd_session_' + Date.now();
        window.GameCenter.completeLevel('jungle-dash', JD_sessionId, JD_coinsEarned);
    }
}
```

La llamada al GameCenter se omite si `JD_coinsEarned === 0` para respetar la regla de validación `coins > 0` del sistema universal.

### Parámetros de integración

| Campo | Valor |
|---|---|
| `gameId` | `'jungle-dash'` |
| `levelId` | `'jd_session_' + Date.now()` |
| `rewardAmount` | `Math.floor(score / 40) + superCoinsCollected * 25` |

---

## 8. Implementación técnica

### Archivos modificados en v1.3.0

| Archivo | Cambios |
|---|---|
| `JD_Core.js` | Variable `JD_currentMultiplier`; nueva fórmula de score; lógica de multiplicador; cálculo dual de monedas en `gameOver()`; bucle de recogida de Super Monedas en `_update()` |
| `JD_Physics.js` | Nueva constante `JD_ITEM_HITBOX_FACTOR = 1.30`; función `JD_getHitboxWithFactor(entity, factor)`; nuevo método público `checkItemCollection(player, items)` |
| `JD_Entities.js` | Nueva clase `JD_SuperCoin` con flotación senoidal; sprite `item_supercoin` en `JD_SPRITE_DEFS`; lógica de spawn al 5 %; array `JD_superCoins`; contador `JD_superCoinsCollected`; método `collectSuperCoin(index)` |
| `JD_Audio.js` | Nuevo helper privado `JD_playCoinSFX()`; métodos públicos `playCoin()` y `playSuperCoin()` |
| `JD_Renderer.js` | Nueva función `JD_drawSuperCoins(superCoins)` con sprite y fallback procedural dorado; llamada en `render()` |

---

*Documentación de Economía — Jungle Dash · Love Arcade · v1.3.0 · 2026*
