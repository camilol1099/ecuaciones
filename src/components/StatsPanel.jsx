import { useSimulation } from "../context/useSimulation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function StatsPanel() {
  const { state } = useSimulation();
  const { statistics, route, traffic } = state;

  // Formatear tiempo de viaje
  const formatTime = (seconds) => {
    if (!seconds || seconds > 500) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Color según mejora/empeora
  const getImprovementColor = (improvement) => {
    if (improvement > 0) return "#22c55e"; // verde - mejora
    if (improvement < 0) return "#ef4444"; // rojo - empeora
    return "#94a3b8"; // gris - sin cambio
  };

  // Determinar si hay incidentes activos
  const hasIncidents = statistics.incidentCount > 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: 1000,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(8px)",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        width: "380px",
        maxHeight: "600px",
        overflow: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "bold" }}>
        📊 Estadísticas de Tráfico
      </h3>

      {/* Gráfico de densidad promedio */}
      <div style={{ marginBottom: "16px" }}>
        <p style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: "600", color: "#475569" }}>
          Densidad Promedio (últimos 60s)
        </p>
        {statistics.densityHistory.length > 1 ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={statistics.densityHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" style={{ fontSize: "10px" }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: "10px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
                formatter={(value) => value.toFixed(3)}
              />
              <Line
                type="monotone"
                dataKey="averageDensity"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ fontSize: "12px", color: "#94a3b8" }}>Iniciando recopilación...</p>
        )}
      </div>

      {/* Contador de incidentes */}
      <div
        style={{
          marginBottom: "16px",
          padding: "12px",
          background: hasIncidents ? "#fef2f2" : "#f0fdf4",
          borderRadius: "8px",
          borderLeft: `3px solid ${hasIncidents ? "#ef4444" : "#22c55e"}`,
        }}
      >
        <p style={{ margin: "0 0 4px 0", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
          INCIDENTES
        </p>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <div>
            <p style={{ margin: "0", fontSize: "24px", fontWeight: "bold", color: "#1f2937" }}>
              {statistics.incidentCount}
            </p>
            <p style={{ margin: "0", fontSize: "10px", color: "#94a3b8" }}>activos</p>
          </div>
          <div>
            <p style={{ margin: "0", fontSize: "16px", fontWeight: "600", color: "#64748b" }}>
              {statistics.totalIncidentsOccurred}
            </p>
            <p style={{ margin: "0", fontSize: "10px", color: "#94a3b8" }}>total</p>
          </div>
        </div>
      </div>

      {/* Indicador de mejora/empeora de ruta */}
      {route.origin && route.destination && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px",
            background: "#f8fafc",
            borderRadius: "8px",
            borderLeft: `3px solid ${getImprovementColor(statistics.routeImprovement)}`,
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
            ESTADO DE RUTA
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0", fontSize: "12px", color: "#475569" }}>
                Tiempo estimado: <strong>{formatTime(route.currentTravelTime)}</strong>
              </p>
              {route.previousTravelTime && (
                <p style={{ margin: "4px 0 0 0", fontSize: "10px", color: "#94a3b8" }}>
                  Cambio: {route.previousTravelTime ? formatTime(route.previousTravelTime) : "N/A"}
                </p>
              )}
            </div>
            <div
              style={{
                padding: "8px 12px",
                background: getImprovementColor(statistics.routeImprovement),
                color: "white",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "600",
                textAlign: "center",
                minWidth: "60px",
              }}
            >
              {statistics.routeImprovement > 0 ? (
                <>
                  ↓ {Math.round(statistics.routeImprovement)}%
                </>
              ) : statistics.routeImprovement < 0 ? (
                <>
                  ↑ {Math.round(Math.abs(statistics.routeImprovement))}%
                </>
              ) : (
                "-"
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resumen general */}
      <div style={{ padding: "12px", background: "#f1f5f9", borderRadius: "8px" }}>
        <p style={{ margin: "0", fontSize: "11px", fontWeight: "600", color: "#64748b" }}>
          DENSIDAD ACTUAL
        </p>
        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: "20px",
            fontWeight: "bold",
            color: "#1f2937",
          }}
        >
          {statistics.densityHistory.length > 0
            ? statistics.densityHistory[statistics.densityHistory.length - 1].averageDensity.toFixed(3)
            : "0.000"}{" "}
          <span style={{ fontSize: "12px", fontWeight: "normal", color: "#94a3b8" }}>veh/m</span>
        </p>
      </div>
    </div>
  );
}
