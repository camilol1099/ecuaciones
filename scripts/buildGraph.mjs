import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el archivo GeoJSON
const geoJsonPath = path.join(__dirname, 'raw_valledupar.geojson');
const outputPath = path.join(__dirname, '../src/Data/valledupar.graph.json');

// Crear carpeta si no existe
const dataDir = path.dirname(outputPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Leer y parsear GeoJSON
const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf-8'));

// Estructuras para el grafo
const nodesMap = new Map(); // Map de {lat,lng} -> nodeId
const edgesArray = [];
let nodeIdCounter = 0;

// Parámetros de la simulación
const SIMULATION = {
  V_MAX: 13.9,      // velocidad máxima (m/s) ≈ 50 km/h
  RHO_MAX: 0.2      // densidad de atasco (vehículos por metro)
};

// Función para crear un ID único basado en coordenadas
function getNodeKey(lon, lat) {
  return `${lat.toFixed(8)},${lon.toFixed(8)}`;
}

// Función para calcular distancia entre dos puntos (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radio de la Tierra en metros
  const rad1 = lat1 * Math.PI / 180;
  const rad2 = lat2 * Math.PI / 180;
  const deltaLat = (lat2 - lat1) * Math.PI / 180;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(rad1) * Math.cos(rad2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Procesar cada feature (calle/way) del GeoJSON
geoJsonData.features.forEach((feature) => {
  if (feature.geometry.type === 'LineString') {
    const coordinates = feature.geometry.coordinates;
    const streetName = feature.properties.name || 'Unknown';
    const highway = feature.properties.highway || 'unknown';

    // Procesar cada coordenada para crear nodos
    const nodeIds = [];
    coordinates.forEach(([lon, lat]) => {
      const key = getNodeKey(lon, lat);
      
      if (!nodesMap.has(key)) {
        // Crear nuevo nodo
        const nodeId = nodeIdCounter++;
        nodesMap.set(key, nodeId);
      }
      
      nodeIds.push(nodesMap.get(key));
    });

    // Crear aristas entre nodos consecutivos
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromId = nodeIds[i];
      const toId = nodeIds[i + 1];
      const [fromLon, fromLat] = coordinates[i];
      const [toLon, toLat] = coordinates[i + 1];
      const distance = calculateDistance(fromLat, fromLon, toLat, toLon);

      edgesArray.push({
        fromNode: fromId,
        toNode: toId,
        street: streetName,
        highway: highway,
        length: Math.max(distance, 1), // al menos 1 metro
        maxSpeed: SIMULATION.V_MAX,
        jamDensity: SIMULATION.RHO_MAX
      });
    }
  }
});

// Construir estructura de nodos con referencias a aristas
const nodes = {};
const edges = {};

// Primero, crear todos los nodos con array de aristas vacío
nodesMap.forEach((nodeId) => {
  nodes[nodeId] = {
    id: nodeId,
    lat: 0,
    lng: 0,
    edges: []
  };
});

// Recuperar coordenadas y agregar referencias a aristas
const nodeCoords = new Map();
geoJsonData.features.forEach((feature) => {
  if (feature.geometry.type === 'LineString') {
    const coordinates = feature.geometry.coordinates;
    coordinates.forEach(([lon, lat]) => {
      const key = getNodeKey(lon, lat);
      const nodeId = nodesMap.get(key);
      if (nodeId !== undefined && !nodeCoords.has(nodeId)) {
        nodeCoords.set(nodeId, { lat, lng: lon });
      }
    });
  }
});

// Asignar coordenadas a nodos
nodeCoords.forEach((coords, nodeId) => {
  nodes[nodeId].lat = coords.lat;
  nodes[nodeId].lng = coords.lng;
});

// Crear aristas indexadas por ID y agregar referencias a nodos
edgesArray.forEach((edge, edgeId) => {
  edges[edgeId] = edge;
  // Agregar referencia de esta arista a los nodos
  if (nodes[edge.fromNode]) {
    nodes[edge.fromNode].edges.push(edgeId);
  }
  if (nodes[edge.toNode]) {
    nodes[edge.toNode].edges.push(edgeId);
  }
});

// Construir el grafo en el formato esperado
const graph = {
  nodes,
  edges,
  metadata: {
    totalNodes: Object.keys(nodes).length,
    totalEdges: Object.keys(edges).length,
    createdAt: new Date().toISOString()
  }
};

// Guardar el grafo
fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));

console.log(`Grafo generado con ${Object.keys(nodes).length} nodos y ${Object.keys(edges).length} aristas.`);
console.log(`Archivo guardado en: ${outputPath}`);
