# Arkanoid — Love Arcade
## Documentación Técnica y de Juego · v3.0.0

---

## Índice
1. [Descripción general](#1-descripción-general)
2. [Estructura de archivos](#2-estructura-de-archivos)
3. [Arquitectura de módulos](#3-arquitectura-de-módulos)
4. [Sistema de juego](#4-sistema-de-juego)
5. [Sistema de niveles infinitos](#5-sistema-de-niveles-infinitos)
6. [Power-ups](#6-power-ups)
7. [Economía y recompensas](#7-economía-y-recompensas)
8. [Física y estabilidad](#8-física-y-estabilidad)
9. [Input y plataforma móvil](#9-input-y-plataforma-móvil)
10. [Integración Love Arcade](#10-integración-love-arcade)
11. [Guía para el jugador](#11-guía-para-el-jugador)
12. [Changelog](#12-changelog)

---

## 1. Descripción general

Arkanoid es un juego tipo breakout desarrollado para la plataforma **Love Arcade** como minijuego integrado en el Game Center Core v7.5. El jugador controla una paleta para rebotar una bola y destruir bloques generados proceduralmente en niveles que se extienden de forma infinita. Al completar cada nivel se reportan monedas a la economía de Love Arcade.

**Características principales:**
- Modo infinito — sin fin de juego por "completar todos los niveles"
- 10 patrones de tablero que rotan cada mundo (10 niveles = 1 mundo)
- 6 power-ups incluyendo el nuevo `🔥 Bola de fuego`
- Física estable con sub-stepping (sin tunneling a 30 FPS)
- Compatible con touch, mouse y teclado
- Single-file serverless deployment (GitHub Pages)

---

## 2. Estructura de archivos

```
games/arkanoid/
├── index.html          ← punto de entrada, HTML + CSS, sin JS inline
└── js/
    ├── ark.config.js   ← módulo A: configuración, generador de niveles, utilidades
    ├── ark.engine.js   ← módulo B: física, colisiones, estado, event bus
    ├── ark.integration.js ← módulo C: GameCenter API, persistencia
    └── ark.ui.js       ← módulo D: renderizado, input, pantallas, RAF loop
```

**Grafo de dependencias (sin ciclos):**
```
index.html
  └─ ark.ui.js
       ├─ ark.config.js   (data, utilidades)
       ├─ ark.engine.js
       │    └─ ark.config.js
       └─ ark.integration.js
            └─ ark.config.js
```

---

## 3. Arquitectura de módulos

### Módulo A — `ark.config.js`
Fuente de verdad de toda la configuración. Sin efectos secundarios, sin acceso a DOM. Exporta:

| Símbolo | Tipo | Descripción |
|---|---|---|
| `ARK_CONFIG` | `Object` (frozen) | Todas las constantes numéricas del juego |
| `ARK_BRICK_COLORS` | `string[]` | Paleta de colores por fila |
| `ARK_PW_TYPES` | `Object` (frozen) | Definición visual de cada power-up |
| `ARK_PW_KEYS` | `string[]` | Claves de power-ups para selección ponderada |
| `ARK_PW_WEIGHTS` | `number[]` | Pesos de probabilidad de spawn |
| `generateLevel(n)` | `function` | Generador procedural de niveles (ver §5) |
| `ARK_lerp / clamp / rng / pick / pickWeighted / hexToRgb` | `function` | Utilidades matemáticas puras |

### Módulo B — `ark.engine.js`
Motor de física puro. **Sin acceso a DOM ni a `window`**. Mantiene el estado privado `S` y emite eventos al bus.

**API pública:**
```js
startLevel(levelIndex)   // 0-based, sin límite superior
tick(dt)                 // avanza física en dt segundos
launchBall()             // lanza la bola pegada a la paleta
movePaddle(dx)           // desplazamiento relativo (teclado)
setPaddleX(x)            // posición absoluta (mouse/touch)
pause() / resume()
on(event, handler)       // suscripción a eventos
off(event, handler)
getState()               // snapshot de solo lectura
```

**Eventos emitidos:**
```
stateChange    {}
brickDestroyed { brick, score }
powerUp        { type }
lifeLost       { lives }
lifeGained     { lives }
shieldBroke    {}
levelComplete  { levelIndex, score }
gameOver       { score }
```

### Módulo C — `ark.integration.js`
Comunicación con `window.GameCenter`. Degradación elegante si el API no está disponible (modo standalone).

**API pública:**
```js
reportReward(levelId, internalPoints) → coinsEarned
getHighscore() → number
saveHighscore(score) → boolean   // true si nuevo récord
```

**Idempotencia:** cada recompensa genera un `sessionId = ark_arkanoid_${levelId}_${Date.now()}`. Se persiste en `localStorage['ARK_reportedSessions']` con TTL de 24h para prevenir duplicados.

### Módulo D — `ark.ui.js`
Renderizado Canvas 2D, manejo de input y gestión de pantallas. Punto de entrada: `ARK_UI.init()`.

**Responsabilidades exclusivas de este módulo:**
- Loop RAF (`requestAnimationFrame`)
- Escalado canvas a viewport (HiDPI, `devicePixelRatio`)
- Traducción de eventos DOM → comandos al engine
- Gestión de pantallas overlay (CSS + clases)
- Anuncios `aria-live` para accesibilidad

---

## 4. Sistema de juego

### Estados de fase (`_phase`)
```
IDLE → READY → PLAYING → LEVEL_COMPLETE → READY (siguiente nivel)
                        ↘ GAME_OVER
                        ↘ PAUSED → PLAYING
```

### Mecánica de bola
- La bola se lanza desde la paleta con un ángulo aleatorio pequeño (±0.3 rad)
- El ángulo de rebote en la paleta depende del punto de impacto: centro = recto, bordes = ±60°
- Velocidad base: **290 px/s** en nivel 1, +**18 px/s** por nivel, máximo **540 px/s**
- Trail visual de 14 frames

### Tipos de ladrillo
| Código | Nombre | HP | Puntos | Visual |
|---|---|---|---|---|
| `1` | Normal | 1 | 10 base | Color neon sólido |
| `2` | Duro | 2 | 25 base | Color + línea central de armadura |
| `3` | Acero | ∞ | 0 | Gris metálico con marcas X |

### Puntuación
- **Combo**: +50% de puntos por cada hit consecutivo sin tocar la paleta (máximo ×8)
- **Bonus de nivel**: 500 pts al completar
- **Bonus de vida**: 300 pts × vidas restantes al completar nivel

### Vidas
- Inicio: 3 vidas
- Máximo: 7 (por power-up LIFE)
- Al perder todas: Game Over → pantalla de resultados

---

## 5. Sistema de niveles infinitos

El generador `generateLevel(n)` crea un nivel único para cualquier `n ≥ 0` de forma determinista dentro de una sesión.

### Estructura de mundos
```
Cada mundo = 10 niveles (LEVELS_PER_WORLD)
Nivel  1–10: CYBER GRID
Nivel 11–20: NEON STORM
Nivel 21–30: DARK MATTER
Nivel 31–40: PLASMA CORE
Nivel 41–50: VOID NEXUS
... (continúa indefinidamente: SECTOR N)
```

El décimo nivel de cada mundo es un **nivel JEFE (⚡)**: patrón FORTRESS con anillo exterior indestructible y interior denso.

### Curvas de dificultad (0-indexed `n`)

| Parámetro | Fórmula | Rango |
|---|---|---|
| Filas de ladrillos | `min(9, 3 + floor(n/3))` | 3 → 9 |
| Densidad de relleno | `min(1.0, 0.58 + n×0.024)` | 58% → 100% |
| Probabilidad ladrillo duro | `min(0.65, n×0.045)` | 0% → 65% |
| Probabilidad indestructible | `min(0.30, max(0, (n-5)×0.022))` | 0% → 30% (desde n=5) |

Los ladrillos duros e indestructibles se concentran en las filas superiores (más alejadas de la paleta) mediante un `rowBias` multiplicador.

### Patrones de tablero (ciclo de 10 dentro de cada mundo)

| Pos. en mundo | Patrón | Descripción |
|---|---|---|
| 1 | FILLED | Rejilla densa con dropout aleatorio |
| 2 | CHECKERBOARD | Celdas alternadas en damero |
| 3 | DIAMOND | Rombo centrado en el tablero |
| 4 | ZIGZAG | Bandas diagonales en zigzag |
| 5 | V-SHAPE | V invertida que se abre hacia abajo |
| 6 | CROSS | Cruz (eje horizontal + vertical) |
| 7 | WAVES | Densidad sinusoidal por columna |
| 8 | COLUMNS | Bandas verticales alternadas |
| 9 | ARCH | Arco superior que curva hacia el centro |
| 10 (**Jefe**) | FORTRESS | Anillo exterior de acero + interior mixto |

---

## 6. Power-ups

Los power-ups caen al destruir un ladrillo (probabilidad 22%). La selección es ponderada.

| Power-up | Label | Prob. | Duración | Efecto |
|---|---|---|---|---|
| **EXPAND** | `E` | 28% | 8 s | Paleta x1.65 de ancho |
| **MULTI** | `M` | 18% | Permanente* | +2 bolas clonadas |
| **SLOW** | `S` | 20% | 8 s | Velocidad de bola × 0.58 |
| **LIFE** | `♥` | 10% | Instantáneo | +1 vida (máx. 7) |
| **SHIELD** | `🛡` | 18% | 12 s | Escudo inferior — absorbe 1 muerte |
| **🔥 FIRE** | `🔥` | 6% | 6 s | Bola de fuego — atraviesa ladrillos |

*MULTI: las bolas extra desaparecen si caen, solo queda la original si sobrevive.

### 🔥 Bola de fuego (FIRE) — mecánica detallada
- La bola activa `ball.fire = true` en **todas las bolas presentes**
- En modo FIRE la bola **atraviesa ladrillos normales y duros** sin deflectarse
- Cada ladrillo recibe 1 hp de daño por sub-frame de contacto (deduplicado por ID de ladrillo por sub-paso)
- Los ladrillos de **acero siguen deflectando** incluso en modo FIRE
- El efecto MULTI hereda el estado FIRE: las bolas clonadas también tienen fuego
- Visual: trail naranja/rojo, cuerpo amarillo→rojo, paleta anaranjada
- HUD: icono 🔥 pulsante con contador de segundos restantes

### Escudo (SHIELD) — efecto visual de onda
- Al activarse: barra amarilla bajo la paleta que decrece con el tiempo restante
- Al consumirse (bola cae): shockwave visual (anillo expansivo dorado) + respawn de bola sin perder vida

---

## 7. Economía y recompensas

### Conversión
```
coins = floor(finalScore / 100)
finalScore = levelScore + 500 (bonus) + lives × 300 (bonus)
```

### Flujo de reporte
```
1. Jugador completa nivel
2. UI calcula finalScore
3. ARK_Integration.reportReward(levelId, finalScore)
4. Integration calcula coins, genera sessionId único
5. Llama window.GameCenter.completeLevel('arkanoid', sessionId, coins)
6. app.js valida y actualiza saldo del navbar
```

### Idempotencia
Session IDs incluyen `Date.now()` para ser únicos entre sesiones. El caché local previene duplicados dentro de la misma sesión (ventana de 24h).

---

## 8. Física y estabilidad

### Sub-stepping (anti-tunneling)
```js
const subSteps = dt > (1/60) ? 2 : 1;
const subDt    = dt / subSteps;
```

A 60fps: 1 sub-paso. A 30fps (CPU throttling): 2 sub-pasos de 1/60s cada uno.

**Prueba matemática**: a velocidad máxima 540 px/s con `subDt = 1/60`:
```
distancia por sub-paso = 540 × 0.0167 = 9.0 px
PADDLE_H = 12 px  ✓  (bola no lo atraviesa)
BRICK_H  = 18 px  ✓
```

### Colisión círculo-AABB
Resolución por eje de menor solapamiento (método overlap). Depenetración explícita (+0.5 px) para evitar colisiones pegajosas.

### Pool de partículas
Array pre-alocado de 220 slots. Cursor circular para asignación O(1) promedio. **Cero allocations de heap durante la partida** — sin pausas de GC.

---

## 9. Input y plataforma móvil

### Problema de touch iOS — raíz y solución

**Causa**: `body { touch-action: none }` + `e.preventDefault()` incondicional en el listener `touchstart` del canvas suprime la generación de eventos `click` sintéticos en **todos** los elementos HTML, incluyendo los botones overlay aunque estén por encima del canvas (z-index mayor).

**Solución aplicada (doble):**

**Parte 1 — CSS:** `touch-action: manipulation` en todos los `.ark-btn`:
```css
.ark-btn { touch-action: manipulation; }
```
Esto le indica al browser que el elemento maneja sus propias interacciones tap, eliminando el delay de 300ms y la supresión de eventos.

**Parte 2 — JS:** `pointerdown` en lugar de `click` para todos los botones:
```js
el.addEventListener('pointerdown', (e) => { e.stopPropagation(); handler(); });
```
`pointerdown` se dispara de forma nativa para mouse Y touch sin necesitar síntesis de click. `e.stopPropagation()` previene que el evento suba al canvas.

**Parte 3 — JS:** `e.preventDefault()` condicional en el canvas:
```js
canvas.addEventListener('touchstart', (e) => {
  const activePhase = _phase === 'PLAYING' || _phase === 'READY';
  if (activePhase) e.preventDefault();  // solo bloquea en fases activas
  ...
});
```
En Game Over / pausa / inicio, los eventos de touch no se previenen, permitiendo que los botones HTML los reciban normalmente.

### Tabla de controles

| Acción | Teclado | Mouse | Touch |
|---|---|---|---|
| Mover paleta | ← → / A D | Mover sobre canvas | Deslizar sobre canvas |
| Lanzar bola | SPACE / ENTER | Click sobre canvas | Tap sobre canvas |
| Pausar | P / ESC | — | Tap en HUD (zona superior 56px) |
| Reanudar | P / ESC | — | Botón CONTINUAR |
| Reintentar | — | Click en botón | Tap en botón REINTENTAR |

### Resize y orientationchange
- `resize`: debounced 80ms via `window.debounce` (Love Arcade §8.1) o inmediato en standalone
- `orientationchange`: timeout de 100ms antes de recalcular (iOS actualiza `innerWidth` con delay)
- `_toLogicalX(clientX)`: siempre lee `_scale` y `_offsetX` en el momento del evento — sin closures obsoletas

---

## 10. Integración Love Arcade

### Checklist de cumplimiento

| Requisito | Estado | Detalle |
|---|---|---|
| Ruta `games/arkanoid/index.html` | ✅ | Estructura de carpeta correcta |
| Botón hub → `../../index.html` | ✅ | `#ARK_hub-link` + botones de menú |
| Script `../../js/app.js` último | ✅ | Último `<script>` antes de `</body>` |
| Prefijo `ARK_` en todos los globals | ✅ | Todos los exports, localStorage keys, IDs |
| No sobrescribir `window.GameCenter` | ✅ | Solo se lee, nunca se asigna |
| No usar `CONFIG`, `ECONOMY`, `THEMES`, `debounce`, `formatCoinsNavbar` | ✅ | Verificado — ninguno usado |
| localStorage prefijado | ✅ | `ARK_highscore`, `ARK_reportedSessions`, `ARK_bestLevel` |
| Degradación elegante sin GameCenter | ✅ | `typeof window.GameCenter !== 'undefined'` |
| Mobile-first | ✅ | viewport meta, touch-action, responsive canvas |
| Módulos ESM | ✅ | `<script type="module">` + imports |

### Carga del módulo ESM vs app.js
Los módulos ESM son `defer` por especificación del navegador. El `<script src="../../js/app.js">` es síncrono y aparece después del módulo en el HTML, pero se ejecuta **antes** de que el módulo cargue, garantizando que `window.GameCenter` esté definido cuando `ark.integration.js` lo invoca.

---

## 11. Guía para el jugador

### Objetivo
Destruye todos los ladrillos de cada nivel para avanzar. Los niveles se generan infinitamente — el objetivo es llegar lo más lejos posible.

### Consejos

**Básico:**
- Mantén la bola en juego a toda costa — cada vida perdida es difícil de recuperar
- Toca el borde de la paleta para ángulos pronunciados y llegar a ladrillos en las esquinas
- Los combos multiplican puntos: no dejes que la bola toque la paleta hasta destruir varios ladrillos seguidos

**Power-ups:**
- **🔥 FIRE** es el más poderoso — úsalo para arrasar una fila entera de ladrillos en segundos
- **SHIELD** actívalo antes de niveles jefe (nivel 10, 20, 30...) — te da margen de error
- **MULTI** multiplica el caos: más bolas = más destrucción, pero más difícil controlar
- **SLOW** es tu aliado en niveles con muchos ladrillos de acero — tiempo para pensar

**Niveles jefe (⚡):**
- Aparecen en los niveles 10, 20, 30... (último nivel de cada mundo)
- Patrón FORTRESS: anillo exterior de acero indestructible — enfócate en el interior
- Los ladrillos interiores son mayoritariamente tipo duro (2 HP)
- El power-up FIRE los destruye con facilidad

**Puntuación:**
- Completa niveles con vidas extra para multiplicar el bonus (300 × vidas)
- Cadenas de combo de 8+ hits valen el doble — intenta no tocar la paleta

### Pantallas del juego

| Pantalla | Cuándo aparece | Acción disponible |
|---|---|---|
| **Inicio** | Al cargar | JUGAR / volver al hub |
| **Pausa** | Durante la partida (P, ESC, tap HUD) | CONTINUAR / salir |
| **Nivel completado** | Al destruir todos los ladrillos | SIGUIENTE NIVEL |
| **Game Over** | Al perder todas las vidas | REINTENTAR (desde nivel 1) / hub |
| **Récord** | Caso especial (score milestone) | JUGAR DE NUEVO / hub |

---

## 12. Changelog

### v3.0.0 (actual)
**Bugfixes:**
- **[CRÍTICO] Touch bug iOS / Android**: los botones de reintentar no respondían a toque tras un Game Over. Causa: `e.preventDefault()` incondicional en `touchstart` + `touch-action: none` en body suprimía la síntesis de `click`. Fix: (a) `pointerdown` en todos los botones, (b) `e.preventDefault()` solo en fases activas, (c) `touch-action: manipulation` en `.ark-btn`.

**Nuevas características:**
- **Modo infinito**: sistema de niveles procedurales con `generateLevel(n)`. Sin límite de niveles.
- **10 patrones de tablero**: FILLED, CHECKERBOARD, DIAMOND, ZIGZAG, V-SHAPE, CROSS, WAVES, COLUMNS, ARCH, FORTRESS.
- **Mundos temáticos**: cada 10 niveles = nuevo mundo con nombre propio (CYBER GRID, NEON STORM, etc.)
- **Niveles jefe** (⚡): patrón FORTRESS en el nivel 10 de cada mundo.
- **Power-up 🔥 FIRE**: bola atraviesa ladrillos, hereda estado MULTI, efectos visuales de fuego, rareza 6%.
- **Curvas de dificultad escaladas**: filas (3→9), densidad, hard% e indestructible% aumentan gradualmente.
- **HUD actualizado**: muestra timer de FIRE, badge de jefe, número de nivel infinito.
- **Pantalla Game Over mejorada**: nivel alcanzado, mejor nivel histórico, récord de puntuación.

### v2.1.0
- Fix: double RAF loop al llamar `init()` varias veces (`cancelAnimationFrame` + `_initialized` flag)
- Sub-stepping physics: 2 pasos a 30fps para prevenir tunneling
- `_physicsStep()` extraída como función independiente

### v2.0.0
- Migración a ES Modules (4 módulos independientes)
- Particle object pool (zero allocations)
- Shockwave visual al consumir escudo
- `aria-live` para accesibilidad
- Fix de resize/orientationchange con timestamps frescos

### v1.0.0
- Versión inicial (single-file, 5 niveles fijos)
