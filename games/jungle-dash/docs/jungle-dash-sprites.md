# Jungle Dash — Guía de Sprites y Assets Visuales

> **Versión:** `1.0.0` · **Módulo de referencia:** `JD_Entities.js` · `JD_Renderer.js`  
> **Ruta raíz de assets:** `games/jungle-dash/assets/`

---

## Índice

1. [Convenciones generales](#1-convenciones-generales)
2. [Sprites del jugador](#2-sprites-del-jugador)
3. [Sprites de obstáculos](#3-sprites-de-obstáculos)
4. [Capas de fondo (Parallax)](#4-capas-de-fondo-parallax)
5. [Assets de audio](#5-assets-de-audio)
6. [Fallback procedural](#6-fallback-procedural)
7. [Tabla resumen de assets](#7-tabla-resumen-de-assets)
8. [Pipeline de exportación recomendado](#8-pipeline-de-exportación-recomendado)

---

## 1. Convenciones generales

### Nomenclatura

Todos los archivos de assets deben seguir el patrón `JD_<tipo>_<nombre>.<ext>`. El prefijo `JD_` es obligatorio y crítico: el módulo `JD_Entities.js` referencia cada archivo por su nombre exacto en tiempo de ejecución. Un nombre incorrecto hará que el asset sea ignorado silenciosamente y se active el fallback procedural.

```
JD_jaguar_run.webp      ✅ Correcto
jaguar_run.webp         ❌ Sin prefijo — no se cargará
JD_Jaguar_Run.webp      ❌ Mayúsculas — no se cargará (rutas case-sensitive en servidor)
```

### Rutas de acceso

```
games/jungle-dash/assets/sprites/   ← Todos los sprites (WebP y PNG)
games/jungle-dash/assets/audio/     ← Archivos de audio
```

El código referencia los assets con rutas relativas desde `index.html`:

```js
'./assets/sprites/JD_jaguar_run.webp'
'./assets/audio/JD_bgm_jungle.mp3'
```

### Timeout de carga

El sistema espera un máximo de **5 segundos** por asset. Si un archivo tarda más en cargar (o devuelve error 404), se activa el fallback procedural para ese elemento específico sin interrumpir el juego.

### Transparencia

Todos los sprites deben usar canal alfa real (no tramados ni con fondo de color sólido). El motor no aplica ningún color key ni chroma key.

---

## 2. Sprites del jugador

### `JD_jaguar_run.webp` — Animación de carrera

| Propiedad | Valor |
|---|---|
| **Dimensiones totales** | 384 × 64 px |
| **Número de frames** | 6 |
| **Ancho por frame** | 64 px |
| **Alto por frame** | 64 px |
| **Formato** | WebP con canal alfa |
| **Disposición** | Horizontal, izquierda a derecha |

La hoja de sprites contiene 6 frames dispuestos en una fila horizontal. El motor los recorre de izquierda a derecha en un loop continuo mientras el jaguar está en el suelo.

```
┌────────┬────────┬────────┬────────┬────────┬────────┐
│ Frame 0│ Frame 1│ Frame 2│ Frame 3│ Frame 4│ Frame 5│  ← 384 px total
│  64px  │  64px  │  64px  │  64px  │  64px  │  64px  │
└────────┴────────┴────────┴────────┴────────┴────────┘
          ↑ altura: 64 px
```

**Cadencia de animación:** el motor avanza un frame cada **6 ticks** (`JD_frameSpeed = 6`), lo que produce aproximadamente 10 fps de animación a 60 fps de juego. Para una carrera más fluida se puede reducir `JD_frameSpeed` a 4.

**Guía de poses por frame sugerida:**

| Frame | Pose |
|---|---|
| 0 | Pata trasera izquierda adelante, pata delantera derecha adelante |
| 1 | Despegue: cuerpo extendido horizontalmente |
| 2 | Máxima extensión: las 4 patas separadas en el aire |
| 3 | Recogida: patas acercándose al cuerpo |
| 4 | Aterrizaje: pata delantera izquierda toca el suelo |
| 5 | Posición de empuje: pata trasera empuja |

---

### `JD_jaguar_jump.webp` — Frame de salto

| Propiedad | Valor |
|---|---|
| **Dimensiones** | 64 × 64 px |
| **Número de frames** | 1 |
| **Formato** | WebP con canal alfa |

Se muestra este frame único durante todo el tiempo que el jaguar esté en el aire (condición `!JD_Physics.onGround`). Debe representar al jaguar en postura de salto: cuerpo arqueado, patas agrupadas.

---

### Especificaciones de diseño para el jaguar

- El cuerpo del jaguar debe ocupar aproximadamente el **85 %** del área del frame para que la caja de colisión al 80 % sea precisa.
- El origen del sprite (esquina superior izquierda del frame) debe estar alineado con el techo de la cabeza del animal, dejando márgenes mínimos.
- Paleta sugerida: dorado `#FFC800`, naranja `#DC8C00` para manchas, blanco `#FFFAF0` en el pecho.

---

## 3. Sprites de obstáculos

### `JD_obs_plant.png` — Planta carnívora

| Propiedad | Valor |
|---|---|
| **Dimensiones** | 48 × 80 px |
| **Formato** | PNG8 con transparencia de índice |
| **Anclaje** | Base inferior del sprite al nivel del suelo (`groundY`) |

La planta se posiciona con su borde inferior exactamente en `groundY` (375 px en coordenadas virtuales), por lo que la ilustración debe dibujarse con la base de la planta pegada al borde inferior del canvas del sprite.

**Guía de composición:**

```
    ┌──────────────┐  ← y=0 (techo del sprite)
    │     boca     │
    │   abierta    │  ← detalle principal: mandíbulas visibles
    │   con dientes│
    │              │
    │    tallo     │  ← tallo grueso y ondulado
    │    y hojas   │
    └──────────────┘  ← y=80 (base del sprite = nivel del suelo)
      48 px de ancho
```

Paleta sugerida: verde oscuro `#1A6B2A` para tallo y hojas, rojo `#C83232` para el interior de la boca, blanco `#FFFFF0` para los dientes.

---

### `JD_obs_log.png` — Tronco caído

| Propiedad | Valor |
|---|---|
| **Dimensiones** | 64 × 32 px |
| **Formato** | PNG8 con transparencia de índice |
| **Anclaje** | Base inferior del sprite al nivel del suelo (`groundY`) |

Obstáculo horizontal de baja altura. El jugador puede superarlo con un salto corto, a diferencia de la planta que requiere mayor altura.

**Guía de composición:**

```
┌────────────────────────────────────────────────────┐  ← y=0
│    vista lateral de tronco cortado                 │
│    con anillos de crecimiento visibles en el extremo│
│    y textura de corteza rugosa                     │
└────────────────────────────────────────────────────┘  ← y=32
                     64 px de ancho
```

Paleta sugerida: marrón `#6B3A1F` para corteza, naranja `#A0522D` para la sección transversal, beige `#D2B48C` para los anillos internos.

---

## 4. Capas de fondo (Parallax)

Las cuatro capas de fondo se renderizan con un sistema de *wrapping* infinito: cada imagen se repite horizontalmente en loop. Para que el seamless sea correcto, **los bordes izquierdo y derecho de cada imagen deben ser continuos** (el píxel del borde derecho debe continuar visualmente en el borde izquierdo).

### Dimensiones base y escala

Todas las capas tienen la misma resolución base. El motor las escala para ajustarse al sistema de coordenadas virtuales de **800 × 450 px**.

| Propiedad | Valor |
|---|---|
| **Dimensiones de arte** | 1920 × 1080 px |
| **Resolución de renderizado** | 800 × 450 px (el motor hace el scale-down) |
| **Formato** | WebP |

Producir el arte a 1920 × 1080 permite tener margen para resoluciones altas y facilita el detalle en post-producción.

---

### `JD_bg_layer0.webp` — Cielo / Atmósfera

| Propiedad | Valor |
|---|---|
| **Factor de parallax** | `0.08` (más lento) |
| **Posición en escena** | Capa base (primera en renderizarse) |

Esta capa ocupa todo el fondo. Debe representar el cielo de la selva con profundidad de campo máxima.

**Contenido sugerido:**
- Gradiente de cielo de noche o amanecer tropical (azul profundo en la parte superior, verde oscuro difuso en la inferior).
- Siluetas muy lejanas de copas de árboles (opcional, muy difuminadas).
- En el bioma *Cueva Ancestral* el motor ignora este asset y dibuja un cielo oscuro procedural con gradiente de índigo a violeta; no se requiere asset adicional para ese bioma.

---

### `JD_bg_layer1.webp` — Árboles lejanos / Ruinas

| Propiedad | Valor |
|---|---|
| **Factor de parallax** | `0.25` |
| **Posición en escena** | Segunda capa |

Capa de elementos de mediana lejanía.

**Contenido sugerido:**
- Siluetas de palmeras y árboles tropicales altos, con poca definición de detalle (efecto de niebla atmosférica).
- Fragmentos de arquitectura perdida en la selva: columnas medio cubiertas de vegetación, arcos de piedra, muros con musgo.
- La franja inferior (últimas 200 px del alto) debe ser transparente o estar abierta para que la capa 2 sea visible por debajo.

---

### `JD_bg_layer2.webp` — Selva media

| Propiedad | Valor |
|---|---|
| **Factor de parallax** | `0.55` |
| **Posición en escena** | Tercera capa (sobre ruinas, bajo suelo) |

Vegetación de primer plano cercano, con mayor definición que las capas anteriores.

**Contenido sugerido:**
- Hojas grandes de helecho y palmito en silueta, con algo de transparencia para ver la capa de ruinas a través de ellas.
- Lianas colgantes que entran desde la parte superior.
- La franja inferior debe ser totalmente transparente: el suelo lo dibuja la capa 3.
- Se recomienda un borde superior difuminado (gradiente a transparente) para integrarse bien con la capa 1.

---

### `JD_bg_layer3.webp` — Suelo

| Propiedad | Valor |
|---|---|
| **Factor de parallax** | `1.00` (se mueve a la misma velocidad que el juego) |
| **Posición en escena** | Capa frontal de fondo |

Única capa que se mueve a velocidad plena y que contiene el suelo donde corre el jaguar.

**Contenido sugerido:**
- Franja de tierra y hierba en la parte inferior (desde `groundY` = 375 px hacia abajo), con textura densa.
- Una línea de acento de 4 px exactamente en `y = 375` (esta línea también se dibuja programáticamente como respaldo).
- El resto de la imagen (por encima del suelo) debe ser completamente transparente para que las capas anteriores se vean.
- Elementos opcionales: raíces que emergen del suelo, pequeñas flores, piedras.

---

## 5. Assets de audio

### `JD_bgm_jungle.mp3` / `JD_bgm_jungle.ogg`

| Propiedad | Valor |
|---|---|
| **Ruta** | `./assets/audio/` |
| **Formatos** | MP3 (principal) · OGG (fallback) |
| **Duración** | Recomendado entre 90 y 180 segundos |
| **Loop** | Obligatorio: el punto de fin debe conectar sin corte con el punto de inicio |
| **Bitrate** | 128 kbps mínimo · 192 kbps recomendado |

El motor intenta cargar primero el `.mp3`. Si no lo encuentra, intenta `.ogg`. Si ninguno carga en 5 segundos, activa el BGM procedural.

**Guía de composición sonora:**
- Género: ambient tropical / percusión étnica ligera.
- Elementos sugeridos: grillos, agua lejana, pájaros tropicales, tambores suaves de fondo.
- Sin voces ni melodía protagonista: el audio debe ser atmosférico para no distraer.
- El volumen de masterización debe ser conservador (no maximizado) ya que el `GainNode` maestro opera a `0.5` de volumen.

---

## 6. Fallback procedural

Cuando un asset no está disponible, el motor activa el siguiente fallback para cada elemento. Los fallbacks están **completamente implementados en código** y no requieren ningún archivo adicional.

| Asset | Fallback visual | Paleta |
|---|---|---|
| `JD_jaguar_run.webp` | Rectángulo dorado con orejas triangulares, manchas y ojos verdes | `rgba(255, 200, 0, 1)` |
| `JD_jaguar_jump.webp` | Mismo rectángulo dorado (mismo fallback) | `rgba(255, 200, 0, 1)` |
| `JD_obs_plant.png` | Triángulo apuntando hacia arriba con dentículos decorativos | `rgba(200, 50, 50, 1)` |
| `JD_obs_log.png` | Triángulo horizontal con anillos de tronco | `rgba(200, 50, 50, 1)` |
| `JD_bg_layer0.webp` | Gradiente de cielo + estrellas procedurales | Colores del bioma activo |
| `JD_bg_layer1.webp` | Siluetas de árboles y ruinas dibujadas con arcos y rectángulos | Colores del bioma activo |
| `JD_bg_layer2.webp` | Copas de árboles circulares con troncos y niebla | Colores del bioma activo |
| `JD_bg_layer3.webp` | Franja de suelo sólida + línea base de 4 px + textura | Colores del bioma activo |
| `JD_bgm_jungle.mp3` | Melodía pentatónica + ruido de ambiente filtrado (Web Audio API) | — |

---

## 7. Tabla resumen de assets

| Archivo | Tipo | Dimensiones (px) | Formato | Transparencia | Estado |
|---|---|---|---|---|---|
| `JD_jaguar_run.webp` | Spritesheet (6 frames) | 384 × 64 | WebP | ✅ Canal alfa | Recomendado |
| `JD_jaguar_jump.webp` | Frame único | 64 × 64 | WebP | ✅ Canal alfa | Recomendado |
| `JD_obs_plant.png` | Sprite estático | 48 × 80 | PNG8 | ✅ Índice | Recomendado |
| `JD_obs_log.png` | Sprite estático | 64 × 32 | PNG8 | ✅ Índice | Recomendado |
| `JD_bg_layer0.webp` | Fondo continuo | 1920 × 1080 | WebP | ❌ Opaco | Recomendado |
| `JD_bg_layer1.webp` | Fondo continuo | 1920 × 1080 | WebP | ✅ Parcial | Recomendado |
| `JD_bg_layer2.webp` | Fondo continuo | 1920 × 1080 | WebP | ✅ Parcial | Recomendado |
| `JD_bg_layer3.webp` | Fondo continuo | 1920 × 1080 | WebP | ✅ Parcial | Recomendado |
| `JD_bgm_jungle.mp3` | Audio en loop | — | MP3 | — | Opcional |
| `JD_bgm_jungle.ogg` | Audio en loop | — | OGG | — | Opcional |

Todos los assets son **opcionales** desde el punto de vista técnico (el juego funciona sin ninguno de ellos), pero su ausencia activa el fallback procedural. Se recomienda entregar al menos los sprites del jugador y los obstáculos para una experiencia visual completa.

---

## 8. Pipeline de exportación recomendado

### Sprites del jugador y obstáculos

1. Dibujar en resolución doble (2×): jugador a 128 × 128 px, spritesheet a 768 × 128 px.
2. Exportar a WebP o PNG con canal alfa.
3. Reducir al 50 % con un reescalado de alta calidad (Lanczos o Bicúbico).
4. Comprimir el WebP final con calidad 85-90. Para PNG8, usar `pngquant` con paleta de 256 colores.

### Fondos parallax

1. Componer en 1920 × 1080 px asegurando seamless horizontal (bordes continuos).
2. Exportar a WebP con calidad 80 (los fondos tienen mucha área plana y comprimen bien).
3. Verificar que los fondos con transparencia no tienen halos de color premultiplicado.

### Verificación rápida de integración

Después de colocar los assets, abrir la consola del navegador al iniciar el juego. El módulo `JD_Entities.js` registra el estado de carga de cada asset:

```
[JD] BGM cargado desde ./assets/audio/JD_bgm_jungle.mp3
```

Si en cambio aparece el mensaje de advertencia:

```
[JD] No se pudo cargar ./assets/sprites/JD_jaguar_run.webp — usando fallback.
```

el nombre del archivo, la ruta o el formato son incorrectos.

---

*Guía de sprites de Jungle Dash · Love Arcade · v1.0.0 · 2026*
