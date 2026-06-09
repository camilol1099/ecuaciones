# 📊 Panel de Estadísticas en Tiempo Real - Guía de Uso

## Descripción General

Se ha implementado un **panel de estadísticas en tiempo real** que visualiza la dinámica del modelo LWR directamente en la interfaz. El panel aparece en la esquina inferior derecha cuando la simulación está en marcha y proporciona métricas clave sobre el tráfico.

## ✅ Características Implementadas

### 1. **Gráfico de Densidad Promedio**
- **Ubicación**: Panel inferior derecho
- **Datos**: Últimos 120 puntos (60 segundos con DT=0.5s)
- **Visualización**: Gráfico de línea azul usando Recharts
- **Información**: Evolución de la densidad promedio de todas las vías en tiempo real
- **Escala**: Eje Y muestra valores en veh/m (0 a 0.06 típicamente)

### 2. **Contador de Incidentes**
- **Datos mostrados**:
  - Número de incidentes **activos** (con fondo rojo si hay incidentes)
  - Número total de incidentes **ocurridos** durante la simulación
- **Indicador visual**: 
  - Borde rojo cuando hay incidentes activos
  - Borde verde cuando no hay incidentes

### 3. **Indicador de Mejora/Empeora de Ruta**
- **Requisito**: Debe haber una ruta calculada (origen y destino)
- **Métrica**: Porcentaje de cambio en tiempo de viaje entre cálculos
- **Visualización**:
  - Verde (↓) cuando la ruta mejora
  - Rojo (↑) cuando la ruta empeora
  - Gris (-) cuando sin cambios
- **Tiempo estimado**: Se muestra en formato m:ss

### 4. **Densidad Actual**
- **Valor**: Densidad promedio de todas las vías en este momento
- **Unidad**: veh/m (vehículos por metro)
- **Actualización**: Cada paso de simulación (0.5s)

---

## 🚦 Semáforos Simulados - Guía de Uso

### Características
- Los semáforos aparecen como **círculos pequeños** en los nodos de intersección
- **Estados**: 
  - 🟢 Verde (flujo normal)
  - 🔴 Rojo (reduce flujo a 10%)
- **Interactividad**: Click para alternar estado

### Cómo Usar Semáforos
1. **Hacer clic en un nodo** (intersección) en el mapa
2. Se abre un popup con opciones:
   - "Crear semáforo" (si no existe)
   - "Alternar semáforo" (si ya existe)
3. El semáforo afectará el flujo en los edges que salen de ese nodo

### Efecto en el Tráfico
- **Semáforo en VERDE**: Vehículos pueden pasar normalmente
- **Semáforo en ROJO**: Flujo reducido al 10%, crea congestión rápidamente
- **Visualización**: La onda roja se propaga hacia atrás en el gráfico LWR

---

## 🎮 Cómo Interactuar con la Aplicación

### Panel de Control (Esquina Superior Izquierda)
1. **▶ Iniciar Simulación**: Comienza la simulación y muestra el panel de estadísticas
2. **⏸ Detener Simulación**: Pausa la simulación
3. **🚨 Crear Incidentes**: Alterna el modo incidente
   - Con modo activado, haz clic en una vía para crear un incidente
4. **🗑️ Limpiar Todo**: Resetea origen, destino e incidentes

### Crear una Ruta
1. Haz clic en un nodo para establecer **origen**
2. Haz clic en otro nodo para establecer **destino**
3. La ruta se calcula automáticamente (línea cian punteada)
4. El indicador de mejora/empeora aparece en el panel

### Monitorear Estadísticas
1. El panel se actualiza automáticamente cada 0.5 segundos
2. El gráfico muestra la tendencia de densidad promedio
3. Los contadores de incidentes se actualizan en tiempo real

---

## 📈 Interpretación de Datos

### Densidad Promedio
- **< 0.01**: Sistema muy fluido
- **0.01 - 0.03**: Tráfico fluido a normal
- **0.03 - 0.05**: Tráfico moderado
- **0.05 - 0.08**: Tráfico congestionado
- **> 0.08**: Tráfico crítico

### Impacto de Incidentes
- Un incidente típicamente **aumenta la densidad promedio en 50-100%**
- Se propaga hacia atrás (onda roja) afectando vías antes del incidente
- La onda se disipa cuando el incidente se resuelve

### Impacto de Semáforos
- Un semáforo en rojo **crea una acumulación local inmediata**
- Si hay muchos semáforos en rojo simultáneamente, la densidad promedio **aumenta significativamente**
- Verde semaforizado puede mejorar el flujo en aristas críticas

---

## 🔧 Detalles Técnicos

### Actualización del Panel
- **Frecuencia**: Cada SIMULATION_STEP (DT = 0.5s)
- **Historial**: Últimos 120 puntos (60 segundos)
- **Gestión de memoria**: Se descartan automáticamente puntos antiguos

### Cálculo de Mejora/Empeora
```
improvement% = ((previousTravelTime - currentTravelTime) / previousTravelTime) * 100
```
- Positivo = mejora (ruta más rápida)
- Negativo = empeora (ruta más lenta)

### Penalización por Semáforo
```
outFlow = demand(rho, ...) * 0.1  (cuando semáforo destino está en rojo)
```

---

## 💡 Próximas Mejoras Sugeridas

1. **Ciclos de Semáforos Automáticos**
   - Implementar ciclos verde/rojo periódicos (ej: 30s verde, 30s rojo)
   - Mostrar contador de tiempo en tooltip

2. **Coordinación de Semáforos**
   - Detectar calles paralelas/consecutivas
   - Implementar "onda verde" automática

3. **Dashboard Responsivo**
   - Versión compacta para pantallas pequeñas
   - Panel minimizable

4. **Alertas Visuales**
   - Animación cuando densidad excede umbral
   - Notificación sonora opcional

5. **Exportación de Datos**
   - Descargar gráfico como imagen
   - Exportar histórico de densidades a CSV

6. **Control de Semáforos Inteligente**
   - Algoritmo que optimiza ciclos basado en densidad actual
   - Predicción de flujo

---

## 📝 Archivos Modificados

- `src/components/StatsPanel.jsx` - Nuevo: Panel de estadísticas
- `src/components/TrafficLights.jsx` - Nuevo: Control de semáforos
- `src/components/MapView.jsx` - Integración de componentes
- `src/context/SimulationContext.jsx` - Lógica de estadísticas y semáforos

---

## 🐛 Troubleshooting

### Panel no aparece
- ✓ Verifica que la simulación esté corriendo
- ✓ El panel solo aparece cuando `state.simRunning === true`

### Gráfico vacío
- ✓ Espera 60 segundos para que se llene el historial
- ✓ Verifica que la simulación siga corriendo

### Semáforos no afectan el tráfico
- ✓ Los semáforos solo aplican penalización a edges que salen del nodo
- ✓ Asegúrate de que el semáforo esté en rojo (🔴)
- ✓ El efecto se ve en el siguiente step de simulación

### Densidad no cambia
- ✓ Esto es normal si no hay incidentes ni cambios de semáforos
- ✓ Los datos de entrada/salida mantienen la densidad estable
