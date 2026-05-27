// src/engine/dijkstra.js

/**
 * Implementación de Dijkstra para grafo dirigido con pesos dinámicos.
 * @param {Object} graph - { nodes: {...}, edges: {...} }
 * @param {Object} traffic - { speeds: {...} }
 * @param {string} originNodeId - ID del nodo origen
 * @param {string} destinationNodeId - ID del nodo destino
 * @returns {string[]} Array de IDs de aristas que forman la ruta más rápida, o [] si no hay camino.
 */
export function findFastestRoute(graph, traffic, originNodeId, destinationNodeId) {
  const nodes = graph.nodes;
  const edges = graph.edges;

  // Distancias en tiempo (segundos) desde origen a cada nodo
  const dist = {};
  // Nodo previo y arista usada para llegar a él
  const prevNode = {};
  const prevEdge = {};
  const visited = new Set();

  // Inicializar distancias
  for (let nodeId in nodes) {
    dist[nodeId] = Infinity;
  }
  dist[originNodeId] = 0;

  // Cola de prioridad simple (array ordenado, suficiente para grafos pequeños)
  const pq = [[originNodeId, 0]];

  while (pq.length > 0) {
    // Ordenar por distancia y tomar el menor (poco eficiente pero claro)
    pq.sort((a, b) => a[1] - b[1]);
    const [u, d] = pq.shift();
    if (u === destinationNodeId) break;
    if (visited.has(u)) continue;
    visited.add(u);

    const node = nodes[u];
    if (!node) continue;

    // Explorar aristas que salen de u (sentido correcto)
    for (let edgeId of node.edges) {
      const edge = edges[edgeId];
      if (!edge || edge.fromNode != u) continue; // solo las que empiezan en u (respetamos dirección)
      const v = String(edge.toNode); // nodo destino
      if (visited.has(v)) continue;

      // Velocidad actual en esta arista (si no hay dato, usar la máxima)
      const speed = traffic.speeds[edgeId] || edge.maxSpeed;
      if (speed <= 0) continue; // calle totalmente bloqueada, no transitable

      const weight = edge.length / speed; // tiempo en segundos
      const alt = dist[u] + weight;
      if (alt < dist[v]) {
        dist[v] = alt;
        prevNode[v] = u;
        prevEdge[v] = edgeId;
        pq.push([v, alt]);
      }
    }
  }

  // Reconstruir camino desde destino hacia origen
  const pathEdges = [];
  let curr = destinationNodeId;
  if (dist[curr] === Infinity) return []; // no hay ruta

  while (curr !== originNodeId) {
    const edgeId = prevEdge[curr];
    if (!edgeId) return []; // no se encontró camino
    pathEdges.unshift(edgeId);
    curr = prevNode[curr];
  }
  return pathEdges;
}