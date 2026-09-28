/**
 * One-DOF drivetrain (TECH_SPEC §6.6):  J dω/dt = Q_aero − N·Q_gen − Q_brake,  ω ≥ 0.
 * Q_aero = Cp(λ, β)·½ρAV³ / ω with ω ≥ 1e-3,  λ = ωR / V.
 * Explicit Euler, as in reference/wind_model_reference.py.
 */
import { GEAR_RATIO, INERTIA_KG_M2 } from '@/config/turbine';

export function stepDrivetrain(
  omegaRad: number,
  qAeroNm: number,
  qGenNm: number,
  qBrakeNm: number,
  dt: number,
): number {
  const next = omegaRad + ((qAeroNm - qGenNm * GEAR_RATIO - qBrakeNm) / INERTIA_KG_M2) * dt;
  return Number.isFinite(next) ? Math.max(next, 0) : 0;
}

/** Advance the rotor azimuth, wrapped to [0, 2π). */
export function stepAzimuth(psiRad: number, omegaRad: number, dt: number): number {
  const p = (psiRad + omegaRad * dt) % (2 * Math.PI);
  return p < 0 ? p + 2 * Math.PI : p;
}
