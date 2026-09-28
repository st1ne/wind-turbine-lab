/**
 * Simplified airfoil polars (TECH_SPEC §6.2). Line-by-line port of polar() in
 * reference/wind_model_reference.py.
 *
 * Attached range −(α_s + 4°) ≤ α ≤ α_s:  cl = cl₀ + s·α,  cd = cd₀ + k_d·(α/10)².
 * Outside: Viterna–Corrigan extrapolation from the stall point on that side, CD90 = 1.8
 * (Viterna & Corrigan, NASA 1982). Beyond |α| > 90°: flat plate. cd ≥ cd₀ always.
 */
import type { AirfoilFamily } from '@/physics/types';

/** (cl0, lift slope per deg, positive stall angle deg, cd0, drag growth k) */
type PolarParams = readonly [number, number, number, number, number];

const POLARS: Record<Exclude<AirfoilFamily, 'CYL1' | 'CYL2'>, PolarParams> = {
  DU40: [0.2, 0.09, 11.0, 0.03, 0.02],
  DU35: [0.25, 0.095, 11.0, 0.018, 0.015],
  DU30: [0.3, 0.1, 10.5, 0.012, 0.012],
  DU25: [0.45, 0.105, 10.0, 0.009, 0.01],
  DU21: [0.45, 0.105, 10.0, 0.008, 0.01],
  NACA64: [0.5, 0.108, 10.0, 0.006, 0.008],
};

/** flat-plate drag at 90° */
export const CD90 = 1.8;

const RAD = Math.PI / 180;

export interface Polar {
  cl: number;
  cd: number;
}

/** Lift/drag coefficients for angle of attack alphaDeg. */
export function polar(family: AirfoilFamily, alphaDeg: number): Polar {
  if (family === 'CYL1') return { cl: 0, cd: 0.5 };
  if (family === 'CYL2') return { cl: 0, cd: 0.35 };
  const [cl0, s, ast, cd0, kd] = POLARS[family];
  const attachedCl = (a: number): number => cl0 + s * a;
  const attachedCd = (a: number): number => cd0 + kd * (a / 10) ** 2;
  const negStall = -(ast + 4.0); // negative-side stall angle
  if (negStall <= alphaDeg && alphaDeg <= ast) {
    return { cl: attachedCl(alphaDeg), cd: attachedCd(alphaDeg) };
  }
  const sgn = alphaDeg > ast ? 1 : -1;
  const aS = sgn > 0 ? ast : negStall;
  const cls = attachedCl(aS);
  const cds = attachedCd(aS);
  const asr = Math.abs(aS) * RAD;
  // Viterna–Corrigan coefficients
  const A1 = CD90 / 2;
  const B1 = CD90;
  const A2 =
    ((Math.abs(cls) - CD90 * Math.sin(asr) * Math.cos(asr)) * Math.sin(asr)) / Math.cos(asr) ** 2;
  const B2 = (cds - CD90 * Math.sin(asr) ** 2) / Math.cos(asr);
  let a = Math.min(Math.abs(alphaDeg) * RAD, Math.PI / 2);
  let cl = A1 * Math.sin(2 * a) + (A2 * Math.cos(a) ** 2) / Math.max(Math.sin(a), 1e-3);
  let cd = B1 * Math.sin(a) ** 2 + B2 * Math.cos(a);
  if (Math.abs(alphaDeg) > 90) {
    // beyond 90°: flat plate
    a = Math.abs(alphaDeg) * RAD;
    cl = (-CD90 / 2) * Math.sin(2 * a);
    cd = CD90 * Math.sin(a) ** 2;
  }
  return { cl: sgn * cl, cd: Math.max(cd, cd0) };
}
