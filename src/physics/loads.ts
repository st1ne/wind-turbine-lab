/**
 * Loads and derived values (TECH_SPEC §6.8).
 *
 *   δ_top = T L³ / (3 EI)                 cantilever tip deflection, shape δ(z) = δ_top (z/L)²(3 − z/L)/2
 *   M_base = T · h_hub                    tower-base overturning moment
 *   δ_tip = 5.4 m · T / 725 kN            blade flap deflection (scaled from the NREL rated value)
 *   ṁ = ρ A V (1 − a)                     air mass flow through the disk
 *   runaway: λ_free = 16.7 at β = 0       rpm = λ V / R · 30/π, Mach = λ V / 343
 */
import {
  BLADES,
  BLADE_TIP_DEFLECTION_RATED_M,
  GEAR_RATIO,
  HOME_POWER_W,
  HUB_HEIGHT_M,
  RADIUS_M,
  RHO_KG_M3,
  RUNAWAY_TSR,
  SPEED_OF_SOUND_M_S,
  SWEPT_AREA_M2,
  THRUST_RATED_N,
  TOWER_EI_NM2,
  TOWER_HEIGHT_M,
} from '@/config/turbine';
import { ctAt } from '@/physics/tables';

export function windPowerW(V: number): number {
  return 0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 3;
}

export function dynamicForceN(V: number): number {
  return 0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 2;
}

export function towerTopDeflectionM(thrustN: number): number {
  return (thrustN * TOWER_HEIGHT_M ** 3) / (3 * TOWER_EI_NM2);
}

/** Cantilever deflection shape, z in metres from the tower base. */
export function towerDeflectionAtM(deflectionTopM: number, zM: number): number {
  const s = Math.min(Math.max(zM / TOWER_HEIGHT_M, 0), 1);
  return (deflectionTopM * s * s * (3 - s)) / 2;
}

export function baseMomentNm(thrustN: number): number {
  return thrustN * HUB_HEIGHT_M;
}

export function bladeTipDeflectionM(thrustN: number): number {
  return (BLADE_TIP_DEFLECTION_RATED_M * thrustN) / THRUST_RATED_N;
}

export function tipSpeedMs(omegaRad: number): number {
  return omegaRad * RADIUS_M;
}

export function bladePassHz(omegaRad: number): number {
  return (BLADES * omegaRad) / (2 * Math.PI);
}

export function lssTorqueNm(qGenNm: number): number {
  return qGenNm * GEAR_RATIO;
}

export function massFlowKgS(V: number, a: number): number {
  return RHO_KG_M3 * SWEPT_AREA_M2 * V * (1 - a);
}

export function homesPowered(powerW: number): number {
  return Math.max(powerW, 0) / HOME_POWER_W;
}

export function runawayRpm(V: number): number {
  return ((RUNAWAY_TSR * V) / RADIUS_M) * (30 / Math.PI);
}

export function runawayTipMach(V: number): number {
  return (RUNAWAY_TSR * V) / SPEED_OF_SOUND_M_S;
}

/** Parked thrust with blades flat to the wind (β = 0, λ = 0), for contrast in the PARKED text. */
export function lockedFlatThrustN(V: number): number {
  return ctAt(0, 0) * dynamicForceN(V);
}
