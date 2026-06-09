import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, Popup, Tooltip } from "react-leaflet";
import { useSimulation } from "../context/useSimulation";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import StatsPanel from "./StatsPanel";
import TrafficLights from "./TrafficLights";

const center = [10.4631, -73.2532];
const zoom = 15;

function findNearestNode(lat, lng, nodes) {
  console.log('🔍 Buscando nodo más cercano a:', { lat, lng }, 'Total nodos:', Object.keys(nodes).length);
  let minDist = Infinity;
  let nearest = null;
  for (let id in nodes) {
    const node = nodes[id];
    if (!node.lat || !node.lng) {
      console.log('  ⚠️ Nodo sin coordenadas:', id);
      continue;
    }
    const dLat = node.lat - lat;
    const dLng = node.lng - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDist) {
      minDist = dist;
      nearest = node;
    }
  }
  console.log('  ✓ Nodo más cercano encontrado:', nearest?.id, 'Distancia:', Math.sqrt(minDist));
  return nearest;
}

function findNearestEdge(lat, lng, edges, nodes) {
  let minDist = Infinity;
  let nearestEdge = null;
  
  for (let edgeId in edges) {
    const edge = edges[edgeId];
    const fromNode = nodes[edge.fromNode];
    const toNode = nodes[edge.toNode];
    
    if (!fromNode || !toNode) continue;
    
    // Calcular distancia del punto a la línea (edge)
    const dist = pointToLineDistance(
      lat, lng,
      fromNode.lat, fromNode.lng,
      toNode.lat, toNode.lng
    );
    
    if (dist < minDist) {
      minDist = dist;
      nearestEdge = { edgeId, edge, distance: dist };
    }
  }
  
  // Solo retornar si está razonablemente cerca (menos de 0.001 grados ~100m)
  if (nearestEdge && nearestEdge.distance < 0.001) {
    return nearestEdge;
  }
  
  return null;
}

function pointToLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const nearX = x1 + t * dx;
  const nearY = y1 + t * dy;
  const ddx = px - nearX;
  const ddy = py - nearY;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

function densityToColor(rho, jamDensity, hasIncident = false) {
  if (hasIncident) return { color: '#000000', weight: 12 }; // Negro para incidentes - MUY GRUESO

  const ratio = rho / jamDensity;

  if (ratio < 0.3) {
    return { color: '#22c55e', weight: 2 }; // verde - fluido
  } else if (ratio < 0.5) {
    return { color: '#84cc16', weight: 3 }; // lima claro - leve
  } else if (ratio < 0.7) {
    return { color: '#eab308', weight: 5 }; // amarillo - medio
  } else if (ratio < 0.85) {
    return { color: '#f97316', weight: 8 }; // naranja - congestionado
  } else {
    return { color: '#ef4444', weight: 12 }; // rojo - muy congestionado
  }
}

function MapView() {
  const { state, dispatch } = useSimulation();
  const { graph, traffic, loading, simRunning } = state;

  const handleMapClick = (latlng) => {
    // Si está en modo crear incidentes, buscar arista
    if (state.incidentMode) {
      const nearestEdgeInfo = findNearestEdge(latlng.lat, latlng.lng, graph.edges, graph.nodes);
      if (nearestEdgeInfo) {
        console.log('🚨 Creando incidente manual en arista:', nearestEdgeInfo.edgeId);
        dispatch({ type: 'CREATE_MANUAL_INCIDENT', payload: nearestEdgeInfo.edgeId });
        return;
      } else {
        console.log('  ❌ Haz clic más cerca de una carretera');
        return;
      }
    }

    // Modo normal: buscar nodo para origen/destino
    const nearestNode = findNearestNode(latlng.lat, latlng.lng, graph.nodes);
    console.log('🖱️ Clic en mapa:', latlng, 'Nodo más cercano:', nearestNode);
    if (!nearestNode) return;

    if (!state.route.origin) {
      console.log('📍 Estableciendo origen:', nearestNode.id);
      dispatch({ type: 'SET_ORIGIN', payload: nearestNode.id });
    } else if (!state.route.destination) {
      console.log('📍 Estableciendo destino:', nearestNode.id);
      dispatch({ type: 'SET_DESTINATION', payload: nearestNode.id });
    } else {
      console.log('🔄 Reiniciando ruta, nuevo origen:', nearestNode.id);
      dispatch({ type: 'SET_ORIGIN', payload: nearestNode.id });
      dispatch({ type: 'SET_DESTINATION', payload: null });
    }
  };

  useEffect(() => {
    if (state.route.origin && state.route.destination) {
      console.log('🚀 Disparando COMPUTE_ROUTE - origen:', state.route.origin, 'destino:', state.route.destination);
      dispatch({ type: 'COMPUTE_ROUTE' });
    }
  }, [state.route.origin, state.route.destination, state.route.recomputeFlag, dispatch]);

  // Efecto para recalcular la ruta periódicamente (cada 3s) según condiciones de tráfico
  useEffect(() => {
    let interval;
    if (state.simRunning && state.route.origin && state.route.destination) {
      interval = setInterval(() => {
        dispatch({ type: 'COMPUTE_ROUTE' });
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [state.simRunning, state.route.origin, state.route.destination, dispatch]);

  const edgeLines = [];

  if (!loading && graph.edges) {
    for (const edgeId in graph.edges) {
      const edge = graph.edges[edgeId];
      const fromNode = graph.nodes[edge.fromNode];
      const toNode = graph.nodes[edge.toNode];
      if (!fromNode || !toNode) continue;

      const rho = traffic.densities[edgeId] || 0;
      const currentSpeed = traffic.speeds[edgeId] || edge.maxSpeed;
      const hasIncident = !!(traffic.incidents && traffic.incidents[edgeId]);
      const { color, weight } = densityToColor(rho, edge.jamDensity, !!hasIncident);

      edgeLines.push({
        id: edgeId,
        positions: [
          [fromNode.lat, fromNode.lng],
          [toNode.lat, toNode.lng],
        ],
        fromLat: fromNode.lat,
        fromLng: fromNode.lng,
        toLat: toNode.lat,
        toLng: toNode.lng,
        color,
        weight,
        speed: currentSpeed,
        density: rho,
        street: edge.street,
        hasIncident: hasIncident
      });
    }

    console.log('Colores actualizados:', edgeLines.slice(0, 3).map(e => `${e.id}: ${e.color}`).join(', '));
  }

  return (
    <div style={{ height: "100%", position: "relative" }}>
      <style>
        {`
          .leaflet-container {
            cursor: default !important;
          }
          .leaflet-interactive {
            cursor: default !important;
          }
        `}
      </style>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <MapClickHandler onMapClick={handleMapClick} />
        {state.route.origin && (
          <Marker position={[graph.nodes[state.route.origin].lat, graph.nodes[state.route.origin].lng]}>
            <Popup>Origen</Popup>
          </Marker>
        )}
        {state.route.destination && (
          <Marker position={[graph.nodes[state.route.destination].lat, graph.nodes[state.route.destination].lng]}>
            <Popup>Destino</Popup>
          </Marker>
        )}
        {edgeLines.map((line) => (
          <Polyline
            // La clave cambia si el estado del incidente cambia, forzando el color negro
            key={`${line.id}-${line.hasIncident}`}
            positions={line.positions}
            color={line.color}
            weight={line.weight}
          >
            <Tooltip sticky>
              <div style={{ fontSize: "12px" }}>
                <strong>{line.street || "Calle sin nombre"}</strong><br />
                <b>Velocidad:</b> {line.speed.toFixed(2)} m/s ({(line.speed * 3.6).toFixed(1)} km/h)<br />
                <b>Densidad:</b> {line.density.toFixed(3)} veh/m<br />
                {line.color === "#000000" && (
                  <span style={{ color: "#ef4444", fontWeight: "bold" }}>🚨 INCIDENTE ACTIVO</span>
                )}
              </div>
            </Tooltip>
          </Polyline>
        ))}

        {/* Renderizamos la ruta AL FINAL para que siempre esté por encima de las calles */}
        {(() => {
          const routePolyline = [];
          if (state.route.path.length > 0 && graph.edges) {
            const pathEdges = state.route.path;
            for (let edgeId of pathEdges) {
              const edge = graph.edges[edgeId];
              if (!edge) continue;
              const fromNode = graph.nodes[edge.fromNode];
              const toNode = graph.nodes[edge.toNode];
              if (fromNode && toNode) {
                routePolyline.push([fromNode.lat, fromNode.lng]);
                routePolyline.push([toNode.lat, toNode.lng]);
              }
            }
          }
          return routePolyline.length >= 2 && (
            <Polyline 
              positions={routePolyline} 
              color="#00ffff" 
              weight={8} 
              opacity={0.9}
              dashArray="5, 10" // Opcional: estilo punteado para que resalte más
            />
          );
        })()}
        
        {/* Semáforos simulados */}
        <TrafficLights />
      </MapContainer>

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          zIndex: 1000,
          background: "white",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <button
          onClick={() =>
            dispatch({
              type: simRunning ? "STOP_SIMULATION" : "START_SIMULATION",
            })
          }
          style={{ padding: "8px 12px", fontWeight: "bold", cursor: "pointer" }}
        >
          {simRunning ? "⏸ Detener Simulación" : "▶ Iniciar Simulación"}
        </button>
        
        <button
          onClick={() => dispatch({ type: 'TOGGLE_INCIDENT_MODE' })}
          style={{
            padding: "8px 12px",
            fontWeight: "bold",
            backgroundColor: state.incidentMode ? "#ff6b6b" : "#e0e0e0",
            color: state.incidentMode ? "white" : "black",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {state.incidentMode ? "🚨 Modo Incidente (ON)" : "🚨 Crear Incidentes"}
        </button>
        
        {state.route.path.length > 0 && (
          <div style={{
            padding: "8px",
            backgroundColor: "#e0f7fa",
            borderRadius: "4px",
            fontSize: "13px",
            border: "1px solid #00acc1"
          }}>
            <b>Información de Ruta:</b><br/>
            Distancia: {(state.route.path.reduce((acc, id) => acc + (graph.edges[id]?.length || 0), 0) / 1000).toFixed(2)} km
            <br/>
            {(() => {
              const totalSeconds = state.route.path.reduce((acc, id) => {
                const edge = graph.edges[id];
                if (!edge) return acc;
                const speed = traffic.speeds[id] || edge.maxSpeed;
                const effectiveSpeed = speed > 0 ? speed : 0.001; // Evitar división por cero
                return acc + (edge.length / effectiveSpeed);
              }, 0);
              const mins = Math.floor(totalSeconds / 60);
              const secs = Math.floor(totalSeconds % 60);
              return <span>ETA: <b>{mins > 0 ? `${mins} min ` : ""}{secs} seg</b></span>;
            })()}
            <br/>
            Estado: <span style={{color: "#007c91"}}>Optimizado por tiempo</span>
          </div>
        )}

        <button
          onClick={() => dispatch({ type: 'CLEAR_ROUTE' })}
          style={{
            padding: "8px 12px",
            fontWeight: "bold",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          🗑️ Limpiar Todo
        </button>

         <div style={{ marginTop: 8 }}>
           <span style={{ color: "#22c55e" }}>● Fluido</span>
           <br />
           <span style={{ color: "#84cc16" }}>● Leve</span>
           <br />
           <span style={{ color: "#eab308" }}>● Medio</span>
           <br />
           <span style={{ color: "#f97316" }}>● Muy Congestionado</span>
           <br />
           <span style={{ color: "#ef4444" }}>● Crítico (Rojo)</span>
           <br />
           <span style={{ color: "#000" }}>● Bloqueo (Incidente)</span>
         </div>

        {!loading && graph.edges && (
          <div
            style={{
              marginTop: 8,
              fontSize: "12px",
              borderTop: "1px solid #ccc",
              paddingTop: 8,
            }}
          >
            <strong>Debug:</strong>
            <br />
            Primera arista densidad: {(traffic.densities[Object.keys(graph.edges)[0]] || 0).toFixed(4)}
            <br />
            Densidad promedio: {(
              Object.values(traffic.densities).reduce((a, b) => a + b, 0) /
                Object.keys(traffic.densities).length || 0
            ).toFixed(4)}
            <br />
            <span style={{ color: "#000" }}>
              ● Incidentes activos: {Object.keys(traffic.incidents || {}).length}
            </span>
          </div>
        )}
      </div>

      {/* Panel de estadísticas en tiempo real */}
      {state.simRunning && <StatsPanel />}
    </div>
  );
}

export default MapView;
