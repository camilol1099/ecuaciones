import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import { useSimulation } from "../context/useSimulation";

export default function TrafficLights() {
  const { state, dispatch } = useSimulation();
  const { graph, trafficLights } = state;

  const handleNodeClick = (nodeId) => {
    const currentLight = trafficLights[nodeId];
    if (currentLight) {
      const newState = currentLight.state === "red" ? "green" : "red";
      dispatch({
        type: "SET_TRAFFIC_LIGHT",
        payload: { nodeId, state: newState },
      });
    } else {
      dispatch({
        type: "SET_TRAFFIC_LIGHT",
        payload: { nodeId, state: "green" },
      });
    }
  };

  return (
    <>
      {/* Solo mostrar bolitas de sem�foros que YA fueron creados */}
      {Object.entries(trafficLights).map(([nodeId, light]) => {
        const node = graph.nodes[nodeId];
        if (!node) return null;

        const color = light.state === "green" ? "#22c55e" : "#ef4444";

        return (
          <CircleMarker
            key={`traffic-light-${nodeId}`}
            center={[node.lat, node.lng]}
            radius={10}
            fillColor={color}
            color="#1f2937"
            weight={2}
            opacity={1}
            fillOpacity={0.9}
            eventHandlers={{
              click: () => handleNodeClick(nodeId),
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: "11px" }}>
                <strong>?? Sem�foro {nodeId}</strong>
                <br />
                Estado:{" "}
                <span
                  style={{
                    color: light.state === "green" ? "#22c55e" : "#ef4444",
                    fontWeight: "bold",
                  }}
                >
                  {light.state === "green" ? "?? VERDE" : "?? ROJO"}
                </span>
                <br />
                <span style={{ fontSize: "10px", color: "#64748b" }}>
                  Click para alternar
                </span>
              </div>
            </Tooltip>
            <Popup>
              <div style={{ fontSize: "12px", minWidth: "150px" }}>
                <strong>?? Sem�foro en Nodo {nodeId}</strong>
                <hr style={{ margin: "4px 0" }} />
                <p style={{ margin: "4px 0" }}>
                  Estado:{" "}
                  <span
                    style={{
                      color: light.state === "green" ? "#22c55e" : "#ef4444",
                      fontWeight: "bold",
                    }}
                  >
                    {light.state === "green" ? "?? VERDE" : "?? ROJO"}
                  </span>
                </p>
                <button
                  onClick={() => handleNodeClick(nodeId)}
                  style={{
                    width: "100%",
                    padding: "6px",
                    marginTop: "8px",
                    background: light.state === "green" ? "#ef4444" : "#22c55e",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                >
                  Cambiar a {light.state === "green" ? "ROJO" : "VERDE"}
                </button>
                <button
                  onClick={() => {
                    dispatch({
                      type: "REMOVE_TRAFFIC_LIGHT",
                      payload: nodeId,
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "6px",
                    marginTop: "6px",
                    background: "#64748b",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  ??? Eliminar sem�foro
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
