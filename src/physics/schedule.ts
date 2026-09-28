/**
 * Optimum operating point and steady schedule (TECH_SPEC §7.1–7.2).
 * Port of the "optimum + steady schedule" block of reference/wind_model_reference.py.
 *
 *   λ_opt, Cp_max = argmax_λ Cp(λ, 0) over λ ∈ [4, 12] step 0.05
 *   K_opt = ½ρπR⁵ Cp_max / λ_opt³
 *   ω(V) = min(λ_opt V / R, ω_rated);  V_rated: η Cp ½ρAV³ = P_rated
 *   region 3 pitch: bisection on η Cp(λ, β) ½ρAV³ = P_rated
 *
 * This runs the full BEM and is slow-ish (~1 s); the app reads the result from
 * tables.generated.json (see scripts/build-tables.ts), tests recompute it.
 */
import {
  ETA,
  OMEGA_RATED_RAD,
  P_RATED_W,
  RADIUS_M,
  RHO_KG_M3,
  SWEPT_AREA_M2,
} from '@/config/turbine';
import { rotor } from '@/physics/bem';

export interface Optimum {
  lambdaOpt: number;
  cpMax: number;
  /** N·m·s² on the rotor shaft */
  kOpt: number;
  vRated: number;
}

export interface ScheduleRow {
  V: number;
  rpm: number;
  pitch: number;
  tsr: number;
  cp: number;
  ct: number;
  P_MW: number;
  Q_MNm: number;
  T_kN: number;
}

export const SCHEDULE_WINDS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 25];

const round = (x: number, d: number): number => {
  const k = 10 ** d;
  return Math.round(x * k) / k;
};

/** Bisection matching the reference: keeps the side whose sign equals f(lo). */
export function bisect(f: (x: number) => number, lo: number, hi: number, n = 60): number {
  let flo = f(lo);
  for (let k = 0; k < n; k++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (fm > 0 === flo > 0) {
      lo = mid;
      flo = fm;
    } else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export function computeOptimum(): Optimum {
  let best = -Infinity;
  let lambdaOpt = 0;
  for (let k = 0; k <= 160; k++) {
    const l = 4 + 0.05 * k;
    const cp = rotor(10.0, (l * 10.0) / RADIUS_M, 0).cp;
    if (cp > best) {
      best = cp;
      lambdaOpt = l;
    }
  }
  const kOpt = (0.5 * RHO_KG_M3 * Math.PI * RADIUS_M ** 5 * best) / lambdaOpt ** 3;
  const omegaOf = (V: number): number => Math.min((lambdaOpt * V) / RADIUS_M, OMEGA_RATED_RAD);
  const vRated = bisect(
    (V) => pEl(V, omegaOf(V), 0) - P_RATED_W,
    (OMEGA_RATED_RAD * RADIUS_M) / lambdaOpt,
    16,
  );
  return { lambdaOpt, cpMax: best, kOpt, vRated };
}

function pEl(V: number, omegaRad: number, pitchDeg: number): number {
  return ETA * rotor(V, omegaRad, pitchDeg).cp * 0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 3;
}

export function computeSchedule(opt: Optimum): ScheduleRow[] {
  const omegaOf = (V: number): number => Math.min((opt.lambdaOpt * V) / RADIUS_M, OMEGA_RATED_RAD);
  const winds = [...SCHEDULE_WINDS];
  winds.splice(winds.indexOf(12), 0, round(opt.vRated, 2));
  return winds.map((V) => {
    const om = omegaOf(V);
    const b =
      V <= opt.vRated + 1e-6 ? 0 : bisect((bb) => pEl(V, om, bb) - P_RATED_W, 0, 40);
    const r = rotor(V, om, b);
    return {
      V,
      rpm: round((om * 30) / Math.PI, 2),
      pitch: round(b, 2),
      tsr: round((om * RADIUS_M) / V, 2),
      cp: round(r.cp, 4),
      ct: round(r.ct, 4),
      P_MW: round((ETA * r.cp * 0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 3) / 1e6, 3),
      Q_MNm: round(r.torqueNm / 1e6, 3),
      T_kN: round(r.thrustN / 1e3, 1),
    };
  });
}
