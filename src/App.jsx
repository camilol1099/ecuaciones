import { useEffect } from "react";
import MapView from "./components/MapView";
import { useSimulation } from "./context/useSimulation";
import { SIMULATION } from "./engine/lwr";

function App() {
  const { state, dispatch } = useSimulation();

  // Bucle de simulación
  useEffect(() => {
    let simInterval, routeInterval;
    if (state.simRunning) {
      simInterval = setInterval(() => {
        dispatch({ type: "SIMULATION_STEP" });
      }, SIMULATION.DT * 1000);

      routeInterval = setInterval(() => {
        if (state.route.origin && state.route.destination) {
          dispatch({ type: "COMPUTE_ROUTE" });
        }
      }, 3000); // recalcular cada 3 segundos
    }
    return () => {
      clearInterval(simInterval);
      clearInterval(routeInterval);
    };
  }, [state.simRunning, state.route.origin, state.route.destination, dispatch]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <MapView />
    </div>
  );
}

export default App;
