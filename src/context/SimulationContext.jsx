import { createContext, useContext, useReducer, useEffect } from "react";
import { SIMULATION, speed, demand, supply } from "../engine/lwr";
import { findFastestRoute } from "../engine/dijkstra";

const SimulationContext = createContext();

const initialState = {
  graph: { nodes: {}, edges: {} },
  traffic: {
    densities: {},
    speeds: {},
    incidents: {},
  },
  route: {
    origin: null,
    destination: null,
    path: [],
    recomputeFlag: 0,
  },
  simRunning: false,
  loading: true,
  error: null,
};

function simulationReducer(state, action) {
  switch (action.type) {
    case "LOAD_GRAPH": {
      const rawGraph = action.payload;
      // Normalizar: convertir IDs de nodo a string y asegurar que fromNode/toNode sean números
      const nodes = {};
      for (const [id, node] of Object.entries(rawGraph.nodes)) {
        nodes[String(id)] = {
          ...node,
          id: String(id),
          edges: node.edges.map(String),
        };
      }
      const edges = {};
      for (const [id, edge] of Object.entries(rawGraph.edges)) {
        edges[String(id)] = {
          ...edge,
          id: String(id),
          fromNode: Number(edge.fromNode),
          toNode: Number(edge.toNode),
        };
      }
      const graph = { nodes, edges };

      // Inicializar densidades: entre 10% y 40% de la densidad máxima
      const initialDensities = {};
      for (let edgeId in graph.edges) {
        const edge = graph.edges[edgeId];
        initialDensities[edgeId] =
          (0.1 + Math.random() * 0.3) * edge.jamDensity;
      }

      return {
        ...state,
        graph,
        loading: false,
        traffic: {
          ...state.traffic,
          densities: initialDensities,
          speeds: {},
        },
      };
    }

    case "START_SIMULATION":
      return { ...state, simRunning: true };

    case "STOP_SIMULATION":
      return { ...state, simRunning: false };

    case "SIMULATION_STEP": {
      const { graph, traffic } = state;
      // ─── Gestión de incidentes ───
      let incidents = { ...traffic.incidents };

      // Decrementar tiempo de vida
      for (let eid in incidents) {
        incidents[eid] = {
          ...incidents[eid],
          remainingTime: incidents[eid].remainingTime - 1,
        };
        if (incidents[eid].remainingTime <= 0) {
          delete incidents[eid];
        }
      }

      // Generar nuevo incidente aleatorio (7% de probabilidad cada segundo)
      if (Math.random() < 0.07) {
        const edgeIds = Object.keys(graph.edges);
        if (edgeIds.length > 0) {
          const randomEdge =
            edgeIds[Math.floor(Math.random() * edgeIds.length)];
          if (!incidents[randomEdge]) {
            const duration = 15 + Math.floor(Math.random() * 20); // 15-35 segundos
            incidents[randomEdge] = {
              factor: 0.9, // bloquea el 90% del flujo de salida
              remainingTime: duration,
            };
          }
        }
      }
      const newDensities = { ...traffic.densities };
      const newSpeeds = {};

      const outFlows = {};
      for (let edgeId in graph.edges) {
        const edge = graph.edges[edgeId];
        const rho = traffic.densities[edgeId] || 0;
        let flow = demand(rho, edge.length, edge.maxSpeed, edge.jamDensity);
        // Aplicar bloqueo si hay incidente
        if (incidents[edgeId]) {
          flow *= 1 - incidents[edgeId].factor; // solo sale el 10% del flujo deseado
        }
        outFlows[edgeId] = flow;
      }

      const inFlows = {};
      for (let nodeId in graph.nodes) {
        const node = graph.nodes[nodeId];
        const incomingEdges = node.edges.filter(
          (eId) => graph.edges[eId].toNode === Number(nodeId),
        );
        const outgoingEdges = node.edges.filter(
          (eId) => graph.edges[eId].fromNode === Number(nodeId),
        );
        if (outgoingEdges.length === 0) continue;

        for (let inEdgeId of incomingEdges) {
          let remainingFlow = outFlows[inEdgeId] || 0;
          if (remainingFlow <= 0) continue;
          const shareFlow = remainingFlow / outgoingEdges.length;

          for (let outEdgeId of outgoingEdges) {
            const outEdge = graph.edges[outEdgeId];
            const rhoOut = newDensities[outEdgeId] || 0;
            const capacityAccept = supply(
              rhoOut,
              outEdge.jamDensity,
              outEdge.maxSpeed,
            );
            const flowToSend = Math.min(shareFlow, capacityAccept);
            inFlows[outEdgeId] = (inFlows[outEdgeId] || 0) + flowToSend;
            remainingFlow -= flowToSend;
          }
        }
      }

      for (let edgeId in graph.edges) {
        const edge = graph.edges[edgeId];
        const L = edge.length;
        const oldRho = traffic.densities[edgeId] || 0;
        const flowOut = outFlows[edgeId] || 0;
        const flowIn = inFlows[edgeId] || 0;
        const N_old = oldRho * L;
        const deltaN = SIMULATION.DT * (flowIn - flowOut);
        let N_new = N_old + deltaN;
        if (N_new < 0) N_new = 0;
        const rhoMax = edge.jamDensity;
        const maxN = rhoMax * L;
        if (N_new > maxN) N_new = maxN;
        const newRho = N_new / L;
        newDensities[edgeId] = newRho;
        newSpeeds[edgeId] = speed(newRho, rhoMax, edge.maxSpeed);
      }

      // --- Inyección y sumidero de tráfico ---
      const allEdgeIds = Object.keys(graph.edges);
      const injectCount = Math.max(2, Math.floor(allEdgeIds.length * 0.06)); // 6% de las aristas como entradas
      const sinkCount = Math.max(1, Math.floor(allEdgeIds.length * 0.01)); // 1% como salidas

      // Inyectar vehículos
      for (let i = 0; i < injectCount; i++) {
        const eid = allEdgeIds[Math.floor(Math.random() * allEdgeIds.length)];
        const edge = graph.edges[eid];
        const L = edge.length;
        // Añadir un 2% de la capacidad total de la arista
        const addVeh = 0.02 * edge.jamDensity * L;
        const currentN = (newDensities[eid] || 0) * L;
        let newN = currentN + addVeh;
        const maxN = edge.jamDensity * L;
        if (newN > maxN) newN = maxN;
        newDensities[eid] = newN / L;
      }

      // Sumidero: quitar vehículos de algunas aristas
      for (let i = 0; i < sinkCount; i++) {
        const eid = allEdgeIds[Math.floor(Math.random() * allEdgeIds.length)];
        const edge = graph.edges[eid];
        const L = edge.length;
        // Quitar un 0.5% de la capacidad
        const removeVeh = 0.005 * edge.jamDensity * L;
        const currentN = (newDensities[eid] || 0) * L;
        let newN = currentN - removeVeh;
        if (newN < 0) newN = 0;
        newDensities[eid] = newN / L;
      }

      // Log de diagnóstico
      console.log(
        "Densidad promedio:",
        Object.values(newDensities).reduce((a, b) => a + b, 0) /
          Object.keys(newDensities).length,
      );

      // --- Sistema de incidentes (bloqueos aleatorios) ---
      const newIncidents = { ...traffic.incidents };

      // Crear nuevos incidentes aleatoriamente (5% de probabilidad por paso)
      if (Math.random() < 0.05) {
        const randomEdgeId =
          allEdgeIds[Math.floor(Math.random() * allEdgeIds.length)];
        newIncidents[randomEdgeId] = {
          duration: 15, // 15 pasos de simulación
          waveDistance: 0,
          affectedEdges: [randomEdgeId],
        };
        // Bloquear totalmente la arista (densidad máxima)
        newDensities[randomEdgeId] = graph.edges[randomEdgeId].jamDensity;
        newSpeeds[randomEdgeId] = 0;
      }

      // Actualizar incidentes existentes y propagar ondas rojas
      const incidentsToRemove = [];
      for (const incidentEdgeId in newIncidents) {
        const incident = newIncidents[incidentEdgeId];
        incident.duration--;

        if (incident.duration <= 0) {
          incidentsToRemove.push(incidentEdgeId);
        } else {
          // Propagar onda roja hacia atrás (a las aristas entrantes)
          const edge = graph.edges[incidentEdgeId];
          if (edge) {
            const fromNodeId = edge.fromNode;
            if (fromNodeId !== undefined && graph.nodes[fromNodeId]) {
              const node = graph.nodes[fromNodeId];
              if (node.edges) {
                for (const incomingEdgeId of node.edges) {
                  const inEdge = graph.edges[incomingEdgeId];
                  if (
                    inEdge &&
                    inEdge.toNode === fromNodeId &&
                    !incident.affectedEdges.includes(incomingEdgeId)
                  ) {
                    // Afectar la arista entrante: aumentar densidad (onda roja)
                    const L = inEdge.length;
                    const currentRho = newDensities[incomingEdgeId] || 0;
                    newDensities[incomingEdgeId] = Math.min(
                      currentRho + 0.05,
                      inEdge.jamDensity * 0.8,
                    );
                    incident.affectedEdges.push(incomingEdgeId);
                    incident.waveDistance++;
                  }
                }
              }
            }
          }
        }
      }

      // Remover incidentes expirados
      for (const edgeId of incidentsToRemove) {
        delete newIncidents[edgeId];
      }

      return {
        ...state,
        traffic: {
          ...traffic,
          densities: newDensities,
          speeds: newSpeeds,
          incidents: newIncidents,
        },
      };
    }

    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };

    case 'SET_ORIGIN':
      return {
        ...state,
        route: { ...state.route, origin: action.payload, destination: null, path: [] }
      };

    case 'SET_DESTINATION':
      if (!state.route.origin) return state;
      return {
        ...state,
        route: { ...state.route, destination: action.payload, path: [] }
      };

    case 'COMPUTE_ROUTE': {
      const { graph, traffic, route } = state;
      console.log('🔍 COMPUTE_ROUTE ejecutándose');
      console.log('  Origen:', route.origin, 'Destino:', route.destination);
      if (!route.origin || !route.destination) {
        console.log('  ❌ Origen o destino no definido');
        return state;
      }
      const path = findFastestRoute(graph, traffic, route.origin, route.destination);
      console.log('  ✓ Ruta calculada, aristas:', path.length, 'IDs:', path);
      return {
        ...state,
        route: {
          ...route,
          path,
          recomputeFlag: state.route.recomputeFlag + 1
        }
      };
    }

    default:
      return state;
  }
}

export function SimulationProvider({ children }) {
  const [state, dispatch] = useReducer(simulationReducer, initialState);

  useEffect(() => {
    async function loadGraph() {
      try {
        const graphData = await import("../Data/valledupar.graph.json");
        dispatch({
          type: "LOAD_GRAPH",
          payload: graphData.default || graphData,
        });
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: err.message });
      }
    }
    loadGraph();
  }, []);

  return (
    <SimulationContext.Provider value={{ state, dispatch }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation debe usarse dentro de SimulationProvider");
  }
  return context;
}
