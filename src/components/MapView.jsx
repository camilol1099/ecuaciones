import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, Popup } from "react-leaflet";
import { useSimulation } from "../context/SimulationContext";
import { SIMULATION } from "../engine/lwr";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

// Función para calcular el ángulo entre dos puntos
function calculateAngle(lat1, lng1, lat2, lng2) {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return Math.atan2(dLng, dLat) * (180 / Math.PI);
}

// Crear un icono de flecha SVG
function createArrowIcon(angle, color) {
  const svg = `
    <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,2 18,18 10,15 2,18" fill="${color}" stroke="white" stroke-width="1"/>
    </svg>
  `;
  return L.icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    className: `arrow-icon`,
    html: svg,
  });
}

// Componente para mostrar flechas en las líneas
function DirectionArrow({ fromLat, fromLng, toLat, toLng, color }) {
  const midLat = (fromLat + toLat) / 2;
  const midLng = (fromLng + toLng) / 2;
  const angle = calculateAngle(fromLat, fromLng, toLat, toLng);

  return (
    <Marker
      position={[midLat, midLng]}
      icon={createArrowIcon(angle, color)}
      interactive={false}
    />
  );
}

function densityToColor(rho, jamDensity, hasIncident = false) {
  if (hasIncident) return { color: '#000000', weight: 12 }; // Negro para incidentes - MUY GRUESO

  const ratio = rho / jamDensity;
  let color = '#22c55e';
  let weight = 2;

  if (ratio < 0.3) {
    color = '#22c55e'; // verde - fluido
    weight = 2;
  } else if (ratio < 0.5) {
    color = '#84cc16'; // lima claro - leve
    weight = 3;
  } else if (ratio < 0.7) {
    color = '#eab308'; // amarillo - medio
    weight = 5;
  } else if (ratio < 0.85) {
    color = '#f97316'; // naranja - congestionado
    weight = 8;
  } else {
    color = '#ef4444'; // rojo - muy congestionado
    weight = 12; // MUY GRUESO para zonas rojas
  }

  return { color, weight };
}

function MapView() {
  const { state, dispatch } = useSimulation();
  const { graph, traffic, loading, simRunning } = state;

  const handleMapClick = (latlng) => {
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
  }, [state.route.origin, state.route.destination, dispatch]);

  const edgeLines = [];

  if (!loading && graph.edges) {
    for (const edgeId in graph.edges) {
      const edge = graph.edges[edgeId];
      const fromNode = graph.nodes[edge.fromNode];
      const toNode = graph.nodes[edge.toNode];
      if (!fromNode || !toNode) continue;

      const rho = traffic.densities[edgeId] || 0;
      const hasIncident = traffic.incidents && traffic.incidents[edgeId];
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
      });
    }

    console.log('Colores actualizados:', edgeLines.slice(0, 3).map(e => `${e.id}: ${e.color}`).join(', '));
  }

  return (
    <div style={{ height: "100%", position: "relative" }}>
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
        {(() => {
          const routePolyline = [];
          if (state.route.path.length > 0 && graph.edges) {
            console.log('🛣️ Renderizando ruta, aristas en path:', state.route.path.length);
            const pathEdges = state.route.path;
            for (let edgeId of pathEdges) {
              const edge = graph.edges[edgeId];
              if (!edge) {
                console.log('  ⚠️ Arista no encontrada:', edgeId);
                continue;
              }
              const fromNode = graph.nodes[edge.fromNode];
              const toNode = graph.nodes[edge.toNode];
              if (fromNode && toNode) {
                routePolyline.push([fromNode.lat, fromNode.lng]);
                routePolyline.push([toNode.lat, toNode.lng]);
              } else {
                console.log('  ⚠️ Nodo no encontrado para arista:', edgeId, 'fromNode:', edge.fromNode, 'toNode:', edge.toNode);
              }
            }
            console.log('  📍 Polyline con', routePolyline.length, 'puntos');
          }
          return routePolyline.length >= 2 && (
            <Polyline positions={routePolyline} color="#00ffff" weight={5} />
          );
        })()}
        {edgeLines.map((line) => (
          <Polyline
            key={`${line.id}-${line.color}`}
            positions={line.positions}
            color={line.color}
            weight={line.weight}
          />
        ))}
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
        }}
      >
        <button
          onClick={() =>
            dispatch({
              type: simRunning ? "STOP_SIMULATION" : "START_SIMULATION",
            })
          }
          style={{ padding: "6px 12px", fontWeight: "bold" }}
        >
          {simRunning ? "⏸ Detener Simulación" : "▶ Iniciar Simulación"}
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
    </div>
  );
}

export default MapView;
