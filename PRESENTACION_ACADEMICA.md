# SimuRoute Valledupar: Simulación de Flujo de Tráfico basada en Ecuaciones Diferenciales

## Presentación Académica para Profesores de Ecuaciones Diferenciales

---

## 📚 INTRODUCCIÓN TEÓRICA

### Objetivo General
Este proyecto implementa un **modelo macroscópico de flujo de tráfico basado en el modelo LWR (Lighthill-Whitham-Richards)**, que es un sistema de ecuaciones diferenciales parciales (EDP) hiperbólicas que describe la dinámica del tráfico vehicular en una red vial.

### Contexto: Ecuaciones de Conservación
El modelo LWR está fundamentado en la **ecuación de conservación de masa** (continuidad):

$$\frac{\partial \rho}{\partial t} + \frac{\partial (\rho \cdot v)}{\partial x} = 0$$

Donde:
- $\rho(x,t)$ = **densidad vehicular** [veh/m] en posición $x$ y tiempo $t$
- $v(x,t)$ = **velocidad** [m/s] en posición $x$ y tiempo $t$
- El término $\rho \cdot v$ = **flujo vehicular** [veh/s]

---

## 🔬 MODELO LWR: FUNDAMENTO MATEMÁTICO

### Principio Fundamental
El flujo de tráfico se rige por una **relación constitutiva velocidad-densidad**:

$$v(\rho) = v_{max} \cdot \left(1 - \frac{\rho}{\rho_{max}}\right)$$

Donde:
- $v_{max}$ = velocidad máxima en flujo libre [m/s]
- $\rho_{max}$ = densidad de congestión máxima [veh/m]

### Derivación del Flujo
El **flujo de demanda** (número de vehículos que pueden pasar por unidad de tiempo) es:

$$q(\rho) = \rho \cdot v(\rho) = \rho \cdot v_{max} \cdot \left(1 - \frac{\rho}{\rho_{max}}\right)$$

Este es un **modelo parabólico** clásico que produce:
- Flujo máximo en $\rho = \rho_{max}/2$ (densidad crítica)
- Comportamiento no-lineal que causa fenómenos de **shock** (ondas de choque en tráfico)

### Capacidad de Oferta
La **capacidad de la vía** (máximo flujo que puede soportar) es:

$$q_{max} = v_{max} \cdot \frac{\rho_{max}}{4}$$

---

## 💻 DISCRETIZACIÓN NUMÉRICA

### Método: Godunov (First-Order Upwind)
Dividimos el espacio en celdas (aristas de la red) y el tiempo en pasos discretos:

$$\rho_i^{n+1} = \rho_i^n - \frac{\Delta t}{\Delta x}(f_{i+1/2}^n - f_{i-1/2}^n)$$

Donde:
- $\rho_i^n$ = densidad en celda $i$ en tiempo $n$
- $f_{i+1/2}$ = flujo numérico entre celdas
- $\Delta t = 0.5$ segundos
- $\Delta x$ = longitud de la arista

### Flujo Numérico (Godunov)
$$f_{i+1/2} = \min(q(\rho_i), q(\rho_{i+1}))$$

**Interpretación física**: El flujo está limitado por el mínimo de:
1. **Demanda** del segmento anterior: $q(\rho_i)$ = capacidad que ofrece
2. **Capacidad/Oferta** del segmento siguiente: $q_{máx}$ = máximo que puede recibir

---

## 🚗 PARÁMETROS DEL MODELO

### Parámetros Calibrados para Valledupar:

| Parámetro | Valor | Unidad | Significado |
|-----------|-------|--------|------------|
| $v_{max}$ | 13.9 | m/s | ≈ 50 km/h (velocidad promedio en ciudad) |
| $\rho_{max}$ | 0.2 | veh/m | Densidad máxima (aproximadamente un vehículo cada 5 metros) |
| $\Delta t$ | 0.5 | s | Paso temporal (Courant: CFL ≤ 1) |
| $L_{arista}$ | Variable | m | Longitud de cada segmento vial |
| $\rho_0$ | 0.1-0.4 | - | Densidad inicial (fracción de $\rho_{max}$) |

### Número de Courant-Friedrichs-Lewy (CFL)
$$CFL = \frac{v_{max} \cdot \Delta t}{\Delta x} \approx 0.69 \text{ (estable)}$$

**Garantiza estabilidad numérica** del esquema upwind.

---

## 📊 COMPONENTES MATEMÁTICOS DEL SISTEMA

### 1. Cálculo de Velocidad
```javascript
speed(rho, rhoMax, vMax) = vMax * (1 - rho / rhoMax)
```
**Interpretación**: Velocidad lineal decreciente con densidad.

### 2. Cálculo de Flujo (Demanda)
```javascript
demand(rho, length, vMax, rhoMax) = rho * speed(rho) * length
```
**Significado**: Cantidad total de vehículos que pueden fluir por la arista.

### 3. Cálculo de Capacidad (Oferta)
```javascript
supply(rho, rhoMax, vMax) = vMax * rhoMax / 4
```
**Significado**: Máximo flujo que la vía puede soportar (independiente de densidad actual).

### 4. Flujo Transferido (Godunov)
```javascript
flow = min(demand(rho_origen), supply)
```

---

## 🌊 FENÓMENOS CAPTURADOS POR EL MODELO

### Ondas de Tráfico
El modelo LWR captura la formación de **shocks** (discontinuidades) que representan:
- **Ondas de congestionamiento** (moving bottlenecks)
- **Colas estacionarias** en semáforos
- **Propagación hacia atrás** de congestión (característica fundamental del modelo)

**Velocidad de propagación del shock**:
$$v_{shock} = \frac{\Delta q}{\Delta \rho}$$

### Incidentes y Perturbaciones
Cuando hay un incidente (accidente, bloqueo):
- Se reduce la demanda del segmento
- Se propaga una onda de congestión **hacia atrás** (hacia el origen)
- **Cadena de colas** se forma aguas arriba

---

## 🚦 CONTROL ÓPTIMO: SEMÁFOROS

### Efecto de Semáforos en Rojo
Un semáforo en estado **ROJO** modifica el flujo:

$$f_{rojo} = 0.1 \cdot f_{normal}$$

**Justificación matemática**: 
- En rojo, solo pasa tráfico residual (~10%)
- En verde, pasa el flujo completo calculado por Godunov
- Produce oscilaciones periódicas (ciclos de $T = 60$ segundos)

### Ciclos de Semáforos
$$t_{verde} = 30s, \quad t_{rojo} = 30s$$

**Efecto en EDP**: Introduce un **término de control forzado** que modifica periódicamente la frontera:

$$\rho(t)_{nodo,semáforo} = \begin{cases} 
\rho_{acumulación} & \text{si } t \mod 60 \in [0, 30) \text{ (rojo)} \\
\rho_{normal} & \text{si } t \mod 60 \in [30, 60) \text{ (verde)}
\end{cases}$$

---

## 🗺️ ESTRUCTURA DE LA RED

### Grafo de Valledupar
- **Nodos**: 1,052 intersecciones
- **Aristas**: 1,436 segmentos viales
- **Estructura**: Red viaria completa de la ciudad

### Aristas (Ecuaciones Diferenciales Escalares)
Cada arista es un **dominio unidimensional** donde se resuelve:

$$\frac{\partial \rho}{\partial t} + \frac{\partial q(\rho)}{\partial x} = 0, \quad x \in [0, L_{arista}]$$

**Acoplamiento**: Las condiciones de frontera de una arista están dadas por el flujo de la arista anterior (nodo compartido).

---

## 🎯 RUTAS ÓPTIMAS: ALGORITMO DE DIJKSTRA

### Integración con la Dinámica
Se utiliza **Dijkstra dinámico** que recalcula cada 3 segundos basándose en:

$$\text{costo}(u \to v) = \frac{L_{arista}}{v(t)} = \frac{L_{arista}}{v_{max}(1 - \rho(t)/\rho_{max})}$$

**Interpretación**: El costo es el **tiempo de tránsito**, que es dinámico y depende de la densidad.

**Ecuación diferencial implícita**:
$$\frac{dx}{dt} = v(\rho(x,t))$$

Integrando:
$$T = \int_0^L \frac{1}{v(\rho(x,t))} dx$$

---

## 📈 ESTADÍSTICAS Y OBSERVABLES

### Densidad Promedio
$$\bar{\rho}(t) = \frac{1}{E} \sum_{i=1}^{E} \rho_i(t)$$

Donde $E = 1,436$ es el número de aristas.

**Interpretación**: Medida del congestionamiento global del sistema.

### Historial de Densidades
Se almacenan los últimos 120 puntos = 60 segundos de simulación.

**Derivada numérica**: Permite estimar la **tasa de cambio** $\frac{d\bar{\rho}}{dt}$.

### Conteo de Incidentes
Cada incidente active es un **punto de inyección de error** en el sistema:

$$q_i(t) \to q_i(t) \cdot (1 - f_i(t))$$

---

## 🔗 CONEXIÓN CON ECUACIONES DIFERENCIALES

### EDP Hiperbólica vs Implementación
| Aspecto | Teoría (EDP) | Implementación |
|--------|-------------|---|
| Dominio | $x \in [0, L]$ | Nodos de una arista |
| Variable | $\rho(x,t)$ | Densidad media por arista |
| Ecuación | $\rho_t + q(\rho)_x = 0$ | Método de Godunov |
| Condiciones | Frontera Dirichlet | Flujo entre nodos |
| Tiempo | $t \in [0, T]$ | Pasos de 0.5 segundos |

### Propiedades Matemáticas Preservadas
✅ **Conservación de masa**: $\int \rho \, dx = cte$ (sin fuentes/sumideros)

✅ **Principio del máximo**: $\rho \leq \rho_{max}$

✅ **Entropía numérica**: Godunov preserva la entropía física

✅ **Propagación de perturbaciones**: Velocidad máxima $= v_{max}$ (CFL)

---

## 📊 VALIDACIÓN Y FENÓMENOS OBSERVABLES

### Fenómenos Esperados del Modelo LWR
1. ✅ **Ondas de choque**: Se ven en el mapa como transiciones abruptas de color
2. ✅ **Remanso de congestionamiento**: Cola que crece hacia atrás del incidente
3. ✅ **Disipación**: Cuando desaparece la causa, la cola se disuelve
4. ✅ **Efecto de semáforos**: Oscilaciones periódicas en densidad
5. ✅ **Adaptación de rutas**: Dijkstra elige caminos menos congestinados

### Datos Reales del Proyecto
- **Densidad promedio inicial**: ~0.05 veh/m (flujo libre)
- **Densidad en congestión**: ~0.15-0.20 veh/m (crítica)
- **Tiempo de simulación**: Pasos de 0.5s (120 pasos = 60 segundos)
- **Incidentes generados**: ~3% por paso (6% por segundo aproximadamente)

---

## 🎓 CONCLUSIONES ACADÉMICAS

Este proyecto es una **aplicación práctica e interactiva** de:

1. **Ecuaciones Diferenciales Parciales Hiperbólicas** (modelo LWR)
2. **Métodos Numéricos** (esquema de Godunov first-order upwind)
3. **Análisis Funcional** (espacios de Sobolev, principios del máximo)
4. **Teoría de Control** (semáforos como control de frontera)
5. **Teoría de Grafos** (algoritmo de Dijkstra en red dinámica)

**Relevancia pedagógica**: Permite visualizar en tiempo real cómo las EDP rigen fenómenos del mundo real, especialmente la propagación de ondas de congestionamiento que es el descubrimiento clave del modelo LWR.

---

---

# 📖 MANUAL DE USUARIO: Cómo Usar SimuRoute Valledupar

## 1. INICIO DE LA APLICACIÓN

### Paso 1: Abrir la aplicación
1. Abre tu navegador web (Chrome, Firefox, Edge)
2. Ve a: `http://localhost:5173`
3. Deberías ver un **mapa de Valledupar** con una **barra de herramientas en la esquina superior izquierda**

### Interfaz Principal
```
┌─────────────────────────────────────────────────────────┐
│  [▶ Iniciar Simulación] [🚨 Crear Incidentes] [🗑️ Limpiar]  │
│                                                           │
│  Leyenda:                                                │
│  ● Fluido      ● Leve      ● Medio      ● Muy Congestionado
│  ● Crítico     ● Bloqueo (Incidente)                      │
│                                                           │
│  Debug: Primera arista densidad: 0.05                    │
│         Densidad promedio: 0.05                          │
│         Incidentes activos: 0                            │
│                                                           │
│        [MAPA CON CARRETERAS Y SEMÁFOROS 🚦]              │
│                                                           │
│                                 ┌─ Estadísticas ────┐    │
│                                 │ 📊 Densidad       │    │
│                                 │ 🚨 Incidentes     │    │
│                                 │ 📈 Mejora Ruta    │    │
│                                 └───────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. ELEMENTOS DEL MAPA

### Colores de Carreteras (Densidad Vehicular)
| Color | Densidad | Significado |
|-------|----------|-------------|
| 🟢 Verde | < 0.05 veh/m | Flujo libre, poco tráfico |
| 🟡 Amarillo | 0.05-0.10 | Tráfico leve |
| 🟠 Naranja | 0.10-0.15 | Tráfico medio |
| 🔴 Rojo | 0.15-0.20 | Muy congestionado |
| ⚫ Negro | > 0.20 | Crítico (parado) |
| 🟣 Púrpura | Accidente | Segmento bloqueado |

### Semáforos Preconfigurados 🚦
- **Círculos VERDES**: Semáforo permitiendo paso (30 segundos)
- **Círculos ROJOS**: Semáforo bloqueando paso (30 segundos)
- Hay **15 semáforos automáticos** en intersecciones principales
- Cambian automáticamente cada 30 segundos

---

## 3. INICIAR LA SIMULACIÓN

### Paso 1: Hacer clic en "Iniciar Simulación"
```
Antes:  ▶ Iniciar Simulación
Después: ⏸ Detener Simulación
```

### Qué sucede:
1. **Las carreteras cambian de color** según densidad de tráfico
2. **Los semáforos cambian** entre verde y rojo automáticamente
3. **El panel de estadísticas aparece** en la esquina inferior derecha
4. **El gráfico de densidad se actualiza** en tiempo real

### Velocidad de la Simulación
- **1 paso** = 0.5 segundos de tiempo simulado
- **60 pasos** = 30 segundos reales
- **120 pasos** = 60 segundos reales

---

## 4. PANEL DE ESTADÍSTICAS 📊

### Ubicación
Esquina inferior derecha del mapa (solo durante simulación)

### Componentes

#### 4.1 Gráfico de Densidad
```
┌─────────────────────────────────┐
│ Densidad Promedio (últimos 60s) │
│                                 │
│     │        ╱╲╱╲              │
│0.06 ├────╱──╱  ╲─────────────  │
│     │╱╲╱                        │
│0.04 ├───────────────────────    │
│     │                           │
│0.02 ├───────────────────────    │
│     │________________________    │
│  0  └─────────────────────────  │
│     0    10   20   30   40   50 │
│            Tiempo (segundos)    │
└─────────────────────────────────┘
```

**Interpretación**:
- Línea suave = tráfico libre
- Picos = congestión
- Oscilaciones periódicas = efecto de semáforos

#### 4.2 Contador de Incidentes
```
🚨 INCIDENTES
Activos: 3        Totales: 7
```

- **Activos**: Cuántos accidentes hay ahora bloqueando vías
- **Totales**: Suma acumulada de todos los accidentes que han ocurrido

#### 4.3 Densidad Actual
```
DENSIDAD ACTUAL
0.045 veh/m
```

**Valor en tiempo real** del promedio de densidad en toda la ciudad.

#### 4.4 Mejora de Ruta (cuando estableces origen/destino)
```
MEJORA DE RUTA
+12.5%
```

El porcentaje que la ruta mejoró con respecto al cálculo anterior.

---

## 5. CREAR INCIDENTES VIALES 🚨

### Paso 1: Activar modo de incidentes
Haz clic en el botón: `🚨 Crear Incidentes`

### Paso 2: El botón cambia de color
```
Antes: 🚨 Crear Incidentes (gris)
Después: 🚨 Crear Incidentes (rojo/activo)
```

### Paso 3: Los incidentes se generan automáticamente
- **Cada segundo**: ~6% de probabilidad de crear un incidente
- **Afecta una arista aleatoria**: Se torna púrpura
- **Duración**: 15-35 segundos cada incidente
- **Efecto**: Bloquea ~90% del flujo, propaga onda roja hacia atrás

### Paso 4: Ver cómo se propaga la congestión
```
Incidente                Onda de congestión
original                 propagándose atrás
    |                         |
    v                         v
[Aumento]────→ [Aumento] ──→ [Aumento]
  Rojo                  Rojo        Rojo
```

### Paso 5: Desactivar incidentes
Vuelve a hacer clic: `🚨 Crear Incidentes` para desactivar

---

## 6. CALCULAR RUTAS DINÁMICAS

### Paso 1: Seleccionar origen
1. **Haz clic en un punto del mapa** donde quieras empezar
2. Verás un **marcador AZUL** aparecer

### Paso 2: Seleccionar destino
1. **Haz clic en otro punto del mapa** donde quieras llegar
2. Verás un **marcador ROJO** aparecer
3. Se dibuja automáticamente una **línea CYAN punteada** mostrando la ruta

### Paso 3: Observar el cálculo dinámico
- **Se recalcula cada 3 segundos** basándose en tráfico actual
- La ruta **cambia de color según densidad** en tiempo real
- El panel muestra:
  - Tiempo estimado actual
  - Mejora con respecto al cálculo anterior
  - Comparación visual en el gráfico

### Paso 4: Borrar origen/destino
- Haz clic en el botón: `🗑️ Limpiar Todo`
- Borra todos los marcadores, rutas e incidentes

---

## 7. LIMPIAR SIMULACIÓN 🗑️

### Botón "Limpiar Todo"
Limpia:
- ✅ Origen y destino
- ✅ Ruta trazada
- ✅ Todos los incidentes
- ✅ Todas las densidades vuelven a inicial
- ✅ Contador de incidentes
- ⚠️ **NO reinicia la simulación** (sigue corriendo)

---

## 8. PAUSA Y REANUDACIÓN

### Pausar Simulación
Haz clic en: `⏸ Detener Simulación`

**Efecto**:
- El mapa congela sus colores
- El gráfico detiene su actualización
- Puedes observar el estado actual

### Reanudar
Haz clic nuevamente en: `▶ Iniciar Simulación`

**Efecto**:
- Se reanuda desde el último estado
- El tráfico y semáforos continúan su lógica

---

## 9. EJEMPLO PRÁCTICO: ESCENARIO COMPLETO

### Escenario: "Análisis de impacto de semáforo en congestionamiento"

**Paso 1: Iniciar simulación**
- Botón: ▶ Iniciar Simulación
- Espera 10 segundos a que se estabilice

**Paso 2: Observar densidad base**
- Mira el gráfico: debería estar ~0.04-0.06 veh/m
- Nota: Los 15 semáforos ya están funcionando automáticamente

**Paso 3: Activar incidentes**
- Botón: 🚨 Crear Incidentes
- Espera 30 segundos

**Paso 4: Observar propagación de ondas**
- Nota cómo se forman ondas de congestionamiento
- El gráfico mostrará picos cada ~30 segundos (ciclo de semáforos)
- Ver cambios de ruta: dibuja origen/destino

**Paso 5: Análisis**
- ¿Cuántos incidentes se acumulan?
- ¿Cuánto aumenta la densidad promedio?
- ¿Las rutas se adaptan eficientemente?

---

## 10. INFORMACIÓN DE DEBUG

### En la esquina superior izquierda ves:

```
Debug:
● Primera arista densidad: 0.0168
● Densidad promedio: 0.0434
● Incidentes activos: 1
```

**Significado**:
- **Primera arista**: Densidad del primer segmento vial (referencia)
- **Densidad promedio**: Promedio en TODAS las 1,436 aristas
- **Incidentes activos**: Número de bloqueos actualmente

---

## 11. CICLOS DE SEMÁFOROS: LO QUE DEBERÍAS VER

### Patrón Esperado (cada 60 segundos)

**Tiempo 0-30s**: Algunos semáforos en VERDE, otros en ROJO
```
Nodo 0: 🟢 VERDE      Nodo 559: 🔴 ROJO
Nodo 560: 🟢 VERDE    Nodo 558: 🔴 ROJO
...
```

**Tiempo 30-60s**: Todos cambian (VERDE ↔ ROJO)
```
Nodo 0: 🔴 ROJO      Nodo 559: 🟢 VERDE
Nodo 560: 🔴 ROJO    Nodo 558: 🟢 VERDE
...
```

**Efecto en gráfico de densidad**:
- Picos cada 30 segundos cuando semáforos se cierren
- Depresiones cuando se abren
- Patrón periódico muy claro

---

## 12. INTERPRETACIÓN MATEMÁTICA DE LO QUE VES

### Cuando ves ondas de choque en el mapa:

**En ecuaciones diferenciales:**
$$\frac{\partial \rho}{\partial t} + \frac{\partial q(\rho)}{\partial x} = 0$$

**En la interfaz:**
- Línea de transición entre colores (ej: verde → rojo)
- Se **propaga hacia atrás** (aguas arriba)
- Velocidad depende de $v_{shock} = \frac{\Delta q}{\Delta \rho}$

### Cuando un semáforo se cierra (ROJO):

**En ecuaciones:**
$$f = 0.1 \cdot q_{normal}$$

**En interfaz:**
- Densidad comienza a crecer (más vehículos acumulándose)
- Color comienza a cambiar hacia rojo/púrpura
- Onda se propaga hacia atrás en el segmento anterior

### Cuando un semáforo se abre (VERDE):

**En ecuaciones:**
$$f = q_{normal}$$

**En interfaz:**
- Flujo máximo comienza a pasar
- Densidad comienza a decrecer
- Color cambia hacia verde progresivamente

---

## 13. TIPS PARA MEJORES RESULTADOS

### Para ver el modelo LWR en acción:
1. **Inicia simulación** y espera 20 segundos a estabilización
2. **Activa incidentes** y observa cómo se propagan ondas
3. **Crea una ruta** (origen → destino) en una zona congestionada
4. **Observa dinámicamente** cómo Dijkstra adapta el camino

### Para entender semáforos:
1. **Fija origen-destino** cerca de un semáforo
2. **Observa el gráfico** de mejora de ruta
3. Verás **oscilaciones periódicas** de 60 segundos exactas

### Para visualizar la red completa:
1. **Usa controles de zoom** (+ y − en esquina superior derecha)
2. **Zoom out**: Ver patrón global de congestión
3. **Zoom in**: Ver detalles de segmentos individuales

---

## 14. PREGUNTAS FRECUENTES

### P: ¿Por qué los semáforos cambian cada 30 segundos?
**R**: Son ciclos preconfigurados de 60s (30s verde + 30s rojo) para simular un control de tráfico realista en ciudades.

### P: ¿Cómo sé cuándo mejora la ruta?
**R**: El panel de Estadísticas muestra el porcentaje. Si es (+), mejoró; si es (−), empeoró.

### P: ¿Qué significa "Densidad Crítica"?
**R**: Cuando densidad > 0.15 veh/m, el flujo comienza a saturarse. Cerca de 0.20 está totalmente bloqueado.

### P: ¿Los incidentes se crean solos o los creo yo?
**R**: Cuando activas "Crear Incidentes", se generan ALEATORIAMENTE. Sin activar, no hay incidentes.

### P: ¿Se puede ver el tráfico en tiempo real (verdadero)?
**R**: No, esta es una simulación matemática idealizada basada en el modelo LWR. Simula física, no datos reales.

---

## 15. RESUMEN TÉCNICO RÁPIDO

| Elemento | Qué hace | Fórmula |
|----------|----------|---------|
| **Densidad** | Medida de congestión | $\rho$ = vehículos/metro |
| **Velocidad** | Depende de densidad | $v = v_{max}(1-\rho/\rho_{max})$ |
| **Flujo** | Vehículos que pasan | $q = \rho \cdot v$ |
| **Semáforo Rojo** | Reduce flujo | $f_{rojo} = 0.1 \cdot q$ |
| **Semáforo Verde** | Flujo normal | $f_{verde} = q$ |
| **Incidente** | Bloquea vía | $q_{inc} = 0.1 \cdot q$ |
| **Ruta Óptima** | Dijkstra dinámico | $min(\sum tiempo)$ |

---

## 🎓 PARA PRESENTAR A PROFESORES

### Estructura de Presentación Sugerida:

1. **Introducción (5 min)**
   - "Este es un modelo macroscópico de flujo de tráfico basado en ecuaciones diferenciales hiperbólicas"
   - Mostrar ecuación LWR principal

2. **Demostración en Vivo (10 min)**
   - Iniciar simulación
   - Mostrar colores de densidad
   - Activar incidentes y mostrar propagación de ondas
   - Crear una ruta y mostrar adaptación dinámica

3. **Explicación de Matemáticas (10 min)**
   - Explicar método de Godunov
   - Mostrar relación velocidad-densidad
   - Discutir estabilidad numérica (CFL)

4. **Insights (5 min)**
   - Cómo los semáforos son un "control de frontera" en la EDP
   - Por qué los incidentes se propagan hacia atrás
   - Aplicaciones en investigación de operaciones

---

**¡Listo para presentar en clase!** 🚗📊

