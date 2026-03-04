# Criterios de Aceptación — `levels.json`
**Proyecto:** Rompecabezas Arcade  
**Versión del motor:** `main.js` v4.0  
**Última revisión:** Marzo 2026

---

## Contexto

El archivo `levels.json` es la fuente de verdad de toda la progresión del juego. Es consumido por `LevelManager.js` al arrancar la aplicación y sus valores son usados directamente por `main.js`, `Economy.js` y el sistema de temporizador para calcular recompensas, estrellas y límites de tiempo. Cualquier valor mal configurado puede romper el contrato con el sistema externo de monedas (`GameCenter`) o generar cuadrículas de piezas inválidas.

---

## 1. Estructura del Objeto de Nivel

Cada entrada del array en `levels.json` debe contener exactamente los siguientes campos:

| Campo         | Tipo     | Requerido | Descripción                                        |
|---------------|----------|-----------|----------------------------------------------------|
| `id`          | `string` | ✅        | Identificador único correlativo (ej: `"lvl_1"`)   |
| `image`       | `string` | ✅        | Ruta al activo visual principal (`./assets/`)      |
| `thumbnail`   | `string` | ✅        | Ruta a la miniatura (`./assets/thumbnails/`)       |
| `pieces`      | `number` | ✅        | Número de piezas del rompecabezas                  |
| `rewardCoins` | `number` | ✅        | Monedas a otorgar al completar el nivel            |
| `description` | `string` | ✅        | Texto descriptivo corto del nivel                  |
| `timeLimit`   | `number` | ✅        | Tiempo límite en segundos                          |

---

## 2. Criterios de Aceptación por Campo

### 2.1 `id`

- **CA-ID-01:** El valor debe ser un `string` con el formato `"lvl_N"`, donde `N` es un número entero positivo correlativo (ej: `"lvl_1"`, `"lvl_2"`, ..., `"lvl_35"`).
- **CA-ID-02:** No deben existir dos niveles con el mismo `id` dentro del array.
- **CA-ID-03:** Al agregar nuevos niveles, el `id` debe continuar la secuencia sin saltos (ej: el nivel siguiente a `lvl_35` debe ser `lvl_36`).

---

### 2.2 `image` y `thumbnail`

- **CA-IMG-01:** La imagen principal debe existir físicamente en `./assets/` con el formato `NivelN.webp`.
- **CA-IMG-02:** La miniatura debe existir físicamente en `./assets/thumbnails/` con el formato `NivelN_thumb.webp`.
- **CA-IMG-03:** Ambas rutas deben ser accesibles desde el contexto raíz del proyecto; una ruta rota causará que `PuzzleEngine` no pueda cargar el nivel.

---

### 2.3 `pieces` — Dificultad de Piezas

- **CA-PCE-01:** El valor debe ser un **número entero con raíz cuadrada perfecta**. Esto es un requisito técnico de `PuzzleEngine.js` para generar la cuadrícula (ej: 4×4, 5×5). Valores sin raíz exacta causarán un error en la generación del tablero.
- **CA-PCE-02:** Los únicos valores válidos para los niveles actuales son `16` (cuadrícula 4×4) y `25` (cuadrícula 5×5).
- **CA-PCE-03:** Queda **prohibido** usar `36` piezas o más en niveles orientados a móvil, ya que compromete la usabilidad táctil en pantallas pequeñas.
- **CA-PCE-04:** La progresión de dificultad por tramos debe seguir esta tabla:

  | Tramo        | Niveles | Piezas permitidas         |
  |--------------|---------|---------------------------|
  | Básico       | 1–10    | `16` (fijas)              |
  | Intermedio   | 11–25   | Alternancia entre `16` y `25` |
  | Experto      | 26–35   | `25` (fijas)              |

---

### 2.4 `rewardCoins` — Sistema de Recompensas

- **CA-RWD-01:** El valor debe ser un **entero positivo**. Si se recibe un valor no entero o negativo, `Economy.js` rechazará la transacción con un error y no se depositarán monedas al jugador.
- **CA-RWD-02:** El rango válido es de **150 a 270 monedas** (ambos extremos inclusivos). Ningún nivel puede tener un valor fuera de este rango.
- **CA-RWD-03:** La progresión de recompensas debe escalar gradualmente entre niveles para premiar el avance del jugador:

  | Tramo        | Niveles | Rango de recompensa        |
  |--------------|---------|----------------------------|
  | Básico       | 1–10    | 150 → 180 monedas          |
  | Intermedio   | 11–25   | 181 → 230 monedas          |
  | Experto      | 26–35   | 231 → 270 monedas          |

- **CA-RWD-04:** El incremento entre niveles consecutivos debe ser gradual (se recomienda entre +2 y +5 monedas por nivel) para evitar saltos bruscos en la curva de economía.
- **CA-RWD-05:** El valor `270` es el **tope estricto de economía**. Ningún nivel, incluidos los futuros, puede superar este límite sin una revisión formal del contrato de `Economy.js`.

---

### 2.5 `timeLimit` — Tiempo Límite

- **CA-TLM-01:** Todos los niveles existentes y futuros deben configurarse con un valor de **`350` segundos**.
- **CA-TLM-02:** Este valor se deriva de la fórmula: `Base Original (250s) + 100s = 350s`. Cualquier modificación a esta fórmula requiere una actualización simultánea en la lógica de `startTimer()` en `main.js`.
- **CA-TLM-03:** Un `timeLimit` de `0` o negativo desactivará el temporizador por completo (comportamiento en `main.js`: `if (levelConfig.timeLimit && levelConfig.timeLimit > 0)`). Esto solo es admisible en entornos de prueba, nunca en producción.

---

## 3. Cálculo de Estrellas (Dependencia con `main.js`)

El sistema de estrellas es calculado automáticamente por `main.js` al detectar la victoria. Los valores de `pieces` en `levels.json` son el insumo directo de este cálculo. **No hay un campo de estrellas en `levels.json`; es siempre derivado.**

```
⭐⭐⭐  →  tiempo transcurrido ≤ pieces × 5
⭐⭐    →  tiempo transcurrido ≤ pieces × 10
⭐     →  cualquier otro caso (completó el nivel)
```

Los umbrales concretos según los valores de `pieces` válidos son:

| Piezas | Umbral 3 estrellas | Umbral 2 estrellas |
|--------|--------------------|--------------------|
| `16`   | ≤ 80 segundos      | ≤ 160 segundos     |
| `25`   | ≤ 125 segundos     | ≤ 250 segundos     |

> **Nota para diseñadores:** Al definir la dificultad de un nivel, considerar si el tiempo de 3 estrellas es alcanzable dado el tamaño de la imagen y la complejidad visual. Un nivel con `pieces: 25` exige completarlo en menos de 2 minutos para obtener la calificación máxima.

---

## 4. Checklist para Nuevos Niveles (lvl_36 en adelante)

Antes de hacer `merge` de un nuevo nivel al repositorio, verificar todos los puntos:

- [ ] **CA-NEW-01 · ID Único y Correlativo:** El campo `id` sigue la secuencia (`lvl_36`, `lvl_37`, ...) sin saltos ni duplicados.
- [ ] **CA-NEW-02 · Activos Visuales Presentes:** La imagen `./assets/NivelN.webp` y su miniatura `./assets/thumbnails/NivelN_thumb.webp` existen en el repositorio antes del despliegue.
- [ ] **CA-NEW-03 · Piezas Válidas:** El valor de `pieces` es `16` o `25`. No se usan otros valores sin aprobación técnica.
- [ ] **CA-NEW-04 · Validación de Economía:** `rewardCoins` es un entero positivo dentro del rango 150–270. Se verifica que `Economy.js` no lanzará error al recibir el valor.
- [ ] **CA-NEW-05 · Tiempo Estándar:** `timeLimit` está configurado a `350`.
- [ ] **CA-NEW-06 · Escalamiento de Recompensa:** La recompensa del nuevo nivel es mayor o igual a la del nivel anterior, sin superar `270`.
- [ ] **CA-NEW-07 · Validación de Estrellas:** Se confirma que el umbral de 3 estrellas (`pieces × 5` segundos) es razonablemente desafiante pero alcanzable para el jugador objetivo.
- [ ] **CA-NEW-08 · JSON Válido:** El archivo `levels.json` completo pasa una validación de sintaxis JSON antes del commit.

---

## 5. Ejemplo de Objeto Válido

```json
{
  "id": "lvl_36",
  "image": "./assets/Nivel36.webp",
  "thumbnail": "./assets/thumbnails/Nivel36_thumb.webp",
  "pieces": 25,
  "rewardCoins": 270,
  "description": "El desafío definitivo",
  "timeLimit": 350
}
```

---

## 6. Errores Comunes y Sus Consecuencias

| Error en `levels.json`                   | Consecuencia en el juego                                      |
|------------------------------------------|---------------------------------------------------------------|
| `pieces: 36` o más                       | Cuadrícula inutilizable en móvil; posible error de renderizado |
| `pieces` sin raíz cuadrada perfecta      | `PuzzleEngine` no puede generar el tablero; nivel no carga    |
| `rewardCoins` con decimal (ej: `150.5`)  | `Economy.js` rechaza la transacción; el jugador no recibe monedas |
| `rewardCoins` fuera del rango 150–270    | Rompe la curva de economía del juego completo                 |
| `timeLimit` distinto de `350`            | Desincronización entre el HUD visual y la lógica de victoria  |
| `id` duplicado                           | `LevelManager` puede cargar el nivel incorrecto               |
| Ruta de imagen inexistente               | Pantalla de carga infinita; el nivel queda inutilizable        |
