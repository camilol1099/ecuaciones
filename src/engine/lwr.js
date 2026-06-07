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
 * Modelo de Greenshields: v(ρ) = V_max * (1 - ρ/ρ_max)
 * Relación constitutiva lineal entre velocidad y densidad.
 */
export function speed(rho, rhoMax = SIMULATION.RHO_MAX, vMax = SIMULATION.V_MAX) {
  return vMax * (1 - rho / rhoMax);
}

/**
 * Función de Flujo (q = ρ * v). 
 * Representa la 'Demanda' en el esquema de Daganzo.
 */
export function demand(rho, length, vMax = SIMULATION.V_MAX, rhoMax = SIMULATION.RHO_MAX) {
  if (rho <= 0) return 0;
  const v = speed(rho, rhoMax, vMax);
  return rho * v; // veh/s
}

/**
 * Función de Oferta (Supply): Limitador de flujo basado en la capacidad residual.
 * Previene que la densidad supere ρ_max (condición de frontera).
 */
export function supply(rho, rhoMax = SIMULATION.RHO_MAX, vMax = SIMULATION.V_MAX) {
  const capacity = vMax * rhoMax * SIMULATION.CAPACITY_FACTOR; // veh/s
  if (rho >= rhoMax) return 0;
  // Espacio disponible proporcional
  return capacity * (1 - rho / rhoMax);
}