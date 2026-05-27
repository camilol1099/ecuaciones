// src/engine/lwr.js

/**
 * Parámetros globales de la simulación (se pueden ajustar)
 */
export const SIMULATION = {
  DT: 0.5,                // segundos (paso de tiempo)
  RHO_MAX: 0.2,         // densidad de atasco (vehículos por metro)
  V_MAX: 13.9,          // velocidad libre (m/s) -> 50 km/h
  CAPACITY_FACTOR: 0.25 // q_max = factor * V_MAX * RHO_MAX (máximo flujo teórico)
};

/**
 * Velocidad en función de la densidad (Greenshields)
 */
export function speed(rho, rhoMax = SIMULATION.RHO_MAX, vMax = SIMULATION.V_MAX) {
  return vMax * (1 - rho / rhoMax);
}

/**
 * Flujo deseado de salida de una arista (demanda)
 */
export function demand(rho, length, vMax = SIMULATION.V_MAX, rhoMax = SIMULATION.RHO_MAX) {
  if (rho <= 0) return 0;
  const v = speed(rho, rhoMax, vMax);
  return rho * v; // veh/s
}

/**
 * Flujo máximo que puede aceptar una arista (oferta simplificada)
 */
export function supply(rho, rhoMax = SIMULATION.RHO_MAX, vMax = SIMULATION.V_MAX) {
  const capacity = vMax * rhoMax * SIMULATION.CAPACITY_FACTOR; // veh/s
  if (rho >= rhoMax) return 0;
  // Espacio disponible proporcional
  return capacity * (1 - rho / rhoMax);
}