import { useContext } from "react";
import { SimulationContext } from "./SimulationContextFile";

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation debe usarse dentro de SimulationProvider");
  }
  return context;
}
