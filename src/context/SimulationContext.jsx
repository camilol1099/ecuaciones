import { useReducer, useEffect } from "react";
import { SIMULATION, speed, demand, supply } from "../engine/lwr";
import { findFastestRoute } from "../engine/dijkstra";
import { SimulationContext } from "./SimulationContextFile";

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
    previousTravelTime: null,
    currentTravelTime: null,
  },
  incidentMode: false,
  selectionMode: null,
  simRunning: false,
  loading: true,
  error: null,
  statistics: {
    densityHistory: [], // Array de {timestamp, averageDensity}
    incidentCount: 0,
    totalIncidentsOccurred: 0,
    routeImprovement: 0, // Porcentaje de mejora o empeora
  },
  trafficLights: {},
  defaultTrafficLights: {
    '0': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '559': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '560': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '558': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '553': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '554': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '571': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '573': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '567': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '565': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '566': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '545': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '546': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '537': { state: 'red', greenDuration: 30, redDuration: 30, elapsed: 0 },
    '53': { state: 'green', greenDuration: 30, redDuration: 30, elapsed: 0 },
  }
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
        trafficLights: state.defaultTrafficLights,
      };
    }

    case "START_SIMULATION":
      return { ...state, simRunning: true };

    case "STOP_SIMULATION":
      return { ...state, simRunning: false };

    case "SIMULATION_STEP": {
      const { graph, traffic, trafficLights } = state;
      
      // 0. Actualizar ciclos de semáforos automáticos
      const DT = 0.5; // Intervalo de tiempo en segundos
      const updatedTrafficLights = {};
      for (const nodeId in trafficLights) {
        const light = { ...trafficLights[nodeId] };
        light.elapsed = (light.elapsed || 0) + DT;
        
        const currentDuration = light.state === 'green' ? light.greenDuration : light.redDuration;
        if (light.elapsed >= currentDuration) {
          light.elapsed = 0;
          light.state = light.state === 'green' ? 'red' : 'green';
        }
        
        updatedTrafficLights[nodeId] = light;
      }
      
      // 1. Preparar nuevos estados
      const newDensities = { ...traffic.densities };
      const newSpeeds = {};
      const newIncidents = { ...traffic.incidents };
      const allEdgeIds = Object.keys(graph.edges);

      // 2. Calcular flujos de salida (Demanda)
      const outFlows = {};
      for (let edgeId in graph.edges) {
        const edge = graph.edges[edgeId];
        const rho = traffic.densities[edgeId] || 0;
        let flow = demand(rho, edge.length, edge.maxSpeed, edge.jamDensity);
        
        // Aplicar bloqueo por incidente (manual o aleatorio)
        if (newIncidents[edgeId]) {
          const factor = newIncidents[edgeId].factor || 0.9;
          flow *= (1 - factor); 
        }
        
        // Aplicar penalización por semáforo en rojo en el nodo destino
        const toNodeId = String(edge.toNode);
        if (updatedTrafficLights[toNodeId] && updatedTrafficLights[toNodeId].state === 'red') {
          flow *= 0.1; // Reduce a 10% del flujo normal cuando está en rojo
        }
        
        outFlows[edgeId] = flow;
      }

      // 3. Calcular flujos de entrada (Oferta y Distribución)
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

      // 4. Integración Numérica (Método de Euler)
      // Resolvemos la EDO de conservación: dN/dt = Σ q_in - Σ q_out
      // Donde N es el número de vehículos (N = ρ * L)
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
        
        // Calculamos velocidad base y aplicamos penalización si hay incidente
        let s = speed(newRho, rhoMax, edge.maxSpeed);
        
        // Verificación robusta de incidente
        const incident = newIncidents[edgeId];
        if (incident) {
          // Forzamos velocidad casi nula para el algoritmo de ruta
          s = 0.00001;
        }
        
        newSpeeds[edgeId] = s;
      }

      // 5. Inyección y sumidero de tráfico
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

      // 6. Gestión de incidentes y propagación de ondas
      // Crear nuevos incidentes aleatoriamente (ej. 3% por paso de 0.5s ≈ 6% por segundo)
      if (Math.random() < 0.03) {
        const randomEdgeId =
          allEdgeIds[Math.floor(Math.random() * allEdgeIds.length)];
        if (!newIncidents[randomEdgeId]) {
          newIncidents[randomEdgeId] = {
            remainingTime: 15 + Math.floor(Math.random() * 20),
            factor: 0.9,
            waveDistance: 0,
            affectedEdges: [randomEdgeId],
          };
        }
      }

      // Actualizar incidentes existentes y propagar ondas rojas
      const updatedIncidents = {};
      for (const incidentEdgeId in newIncidents) {
        const incident = { ...newIncidents[incidentEdgeId] }; // Clonar para evitar mutación
        incident.remainingTime -= 1;

        if (incident.remainingTime > 0) {
          // Propagar onda roja hacia atrás (a las aristas entrantes)
          const edge = graph.edges[incidentEdgeId];
          if (edge) {
            // Copiamos el array de aristas afectadas para mantener inmutabilidad
            const newAffectedEdges = [...incident.affectedEdges];
            
            const fromNodeId = edge.fromNode;
            if (fromNodeId !== undefined && graph.nodes[fromNodeId]) {
              const node = graph.nodes[fromNodeId];
              if (node.edges) {
                for (const incomingEdgeId of node.edges) {
                  const inEdge = graph.edges[incomingEdgeId];
                  if (
                    inEdge &&
                    inEdge.toNode === fromNodeId &&
                    !newAffectedEdges.includes(incomingEdgeId)
                  ) {
                    // Afectar la arista entrante: aumentar densidad (onda roja)
                    const currentRho = newDensities[incomingEdgeId] || 0;
                    newDensities[incomingEdgeId] = Math.min(
                      currentRho + 0.05,
                      inEdge.jamDensity * 0.8,
                    );
                    newAffectedEdges.push(incomingEdgeId);
                    incident.waveDistance++;
                  }
                }
              }
            }
            incident.affectedEdges = newAffectedEdges;
          }
          updatedIncidents[incidentEdgeId] = incident;
        }
      }

      // Calcular estadísticas
      const densityValues = Object.values(newDensities);
      const averageDensity = densityValues.length > 0 
        ? densityValues.reduce((a, b) => a + b, 0) / densityValues.length 
        : 0;
      
      const incidentCount = Object.keys(updatedIncidents).length;
      
      // Historial de densidades (últimos 120 puntos = 60 segundos con DT=0.5)
      const newHistory = [...state.statistics.densityHistory, { 
        timestamp: state.statistics.densityHistory.length,
        averageDensity 
      }];
      if (newHistory.length > 120) newHistory.shift();
      
      // Contar incidentes nuevos
      const prevIncidentCount = Object.keys(traffic.incidents).length;
      const newIncidentsCount = incidentCount > prevIncidentCount ? 1 : 0;
      
      return {
        ...state,
        traffic: {
          ...traffic,
          densities: newDensities,
          speeds: newSpeeds,
          incidents: updatedIncidents,
        },
        trafficLights: updatedTrafficLights,
        statistics: {
          ...state.statistics,
          densityHistory: newHistory,
          incidentCount,
          totalIncidentsOccurred: state.statistics.totalIncidentsOccurred + newIncidentsCount,
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
      
      // Calcular tiempo de viaje actual
      let currentTravelTime = 0;
      for (const edgeId of path) {
        const edge = graph.edges[edgeId];
        const speed = traffic.speeds[edgeId] || edge.maxSpeed;
        const time = speed > 0 ? edge.length / speed : 999; // tiempo en segundos
        currentTravelTime += time;
      }
      
      // Calcular porcentaje de mejora/empeora
      let improvement = 0;
      if (route.previousTravelTime && route.previousTravelTime > 0) {
        improvement = ((route.previousTravelTime - currentTravelTime) / route.previousTravelTime) * 100;
      }
      
      return {
        ...state,
        route: {
          ...route,
          path,
          previousTravelTime: route.currentTravelTime,
          currentTravelTime,
        },
        statistics: {
          ...state.statistics,
          routeImprovement: improvement,
        }
      };
    }

    case 'TOGGLE_INCIDENT_MODE':
      return { ...state, incidentMode: !state.incidentMode };

    case 'SET_SELECTION_MODE':
      return { ...state, selectionMode: action.payload };

    case 'CREATE_MANUAL_INCIDENT': {
      const edgeId = action.payload;
      const { graph, traffic } = state;
      const incidents = { ...traffic.incidents };
      const newDensities = { ...traffic.densities };
      const newSpeeds = { ...traffic.speeds };

      if (!incidents[edgeId]) {
        const edge = graph.edges[edgeId];
        const duration = 240; // 2 minutos (en pasos de 0.5s) para pruebas extendidas
        incidents[edgeId] = {
          factor: 0.9, // Bloquea 90% del flujo
          remainingTime: duration,
          affectedEdges: [edgeId],
          waveDistance: 0,
          isManual: true,
        };
        // Llenar la arista de inmediato con vehículos
        newDensities[edgeId] = edge.jamDensity;
        newSpeeds[edgeId] = 0.00001; 
        console.log('🚨 INCIDENTE MANUAL creado en arista:', edgeId, 'Duración:', duration, 'pasos');
      }

      return {
        ...state,
        route: {
          ...state.route,
          // Forzamos el recálculo de la ruta para que evite el nuevo incidente
          recomputeFlag: state.route.recomputeFlag + 1
        },
        traffic: {
          ...traffic,
          incidents,
          densities: newDensities,
          speeds: newSpeeds,
        },
      };
    }

    case 'SET_ORIGIN_MANUAL':
      return {
        ...state,
        route: { ...state.route, origin: action.payload, destination: null, path: [] }
      };

    case 'SET_DESTINATION_MANUAL':
      if (!state.route.origin) return state;
      return {
        ...state,
        route: { ...state.route, destination: action.payload, path: [] }
      };

    case 'CLEAR_ROUTE':
      return {
        ...state,
        route: { ...state.route, origin: null, destination: null, path: [] }
      };

    case 'SET_TRAFFIC_LIGHT': {
      const { nodeId, state: lightState } = action.payload;
      const newTrafficLights = { ...state.trafficLights };
      
      if (newTrafficLights[nodeId]) {
        newTrafficLights[nodeId].state = lightState;
      } else {
        newTrafficLights[nodeId] = {
          state: lightState,
          cycle: 0,
          duration: 30, // 30 segundos por ciclo
        };
      }
      
      return {
        ...state,
        trafficLights: newTrafficLights,
      };
    }

    case 'REMOVE_TRAFFIC_LIGHT': {
      const nodeId = action.payload;
      const newTrafficLights = { ...state.trafficLights };
      delete newTrafficLights[nodeId];
      
      return {
        ...state,
        trafficLights: newTrafficLights,
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


