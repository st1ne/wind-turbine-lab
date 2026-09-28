/**
 * Steady blade-element momentum theory (TECH_SPEC §6.3). Line-by-line port of prandtl(),
 * section() and rotor() in reference/wind_model_reference.py.
 *
 *   φ = atan2(V(1−a), ωr(1+a')),  α = φ − θ,  θ = twist + β,  σ = B c / (2π r)
 *   cn = cl cosφ + cd sinφ,  ct = cl sinφ − cd cosφ
 *   C_T = σ(1−a)² cn / sin²φ; a from momentum, or Buhl (2005) above 0.96 F
 *   dT = ½ρW²c·cn,  dQ = ½ρW²c·ct·r
 *
 * Sources: Hansen, Aerodynamics of Wind Turbines (BEM, Prandtl loss);
 * Buhl, NREL/TP-500-36834 (high-induction correction).
 */
import { BLADES, HUB_RADIUS_M, RADIUS_M, RHO_KG_M3, SWEPT_AREA_M2 } from '@/config/turbine';
import { STATIONS, STATION_COUNT, station } from '@/physics/blade';
import { polar } from '@/physics/polars';

const RAD = Math.PI / 180;

export interface ElementResult {
  /** thrust per unit span per blade, N/m */
  dT: number;
  /** torque per unit span per blade, N·m/m */
  dQ: number;
  alphaDeg: number;
  a: number;
  aPrime: number;
  cl: number;
  cd: number;
}

/** Model switches for the loss waterfall (§3.6); the defaults are the reference model. */
export interface BemOptions {
  /** Prandtl tip and hub loss (default true) */
  tipLoss?: boolean;
  /** profile drag (default true) */
  drag?: boolean;
}

export interface RotorResult {
  cp: number;
  ct: number;
  thrustN: number;
  torqueNm: number;
}

/** Combined Prandtl tip × hub loss factor F, floored at 1e-4. */
export function prandtlLoss(rM: number, phiRad: number): number {
  const sp = Math.max(Math.abs(Math.sin(phiRad)), 1e-6);
  const ft = (BLADES * (RADIUS_M - rM)) / (2 * rM * sp);
  const fh = (BLADES * (rM - HUB_RADIUS_M)) / (2 * HUB_RADIUS_M * sp);
  const F =
    (2 / Math.PI) ** 2 *
    Math.acos(Math.min(1.0, Math.exp(-ft))) *
    Math.acos(Math.min(1.0, Math.exp(-fh)));
  return Math.max(F, 1e-4);
}

/** Steady BEM for one blade element; fixed-point iteration with 0.3 relaxation. */
export function solveElement(
  V: number,
  omegaRad: number,
  pitchDeg: number,
  i: number,
  iters = 200,
  opts: BemOptions = {},
): ElementResult {
  const tipLoss = opts.tipLoss ?? true;
  const drag = opts.drag ?? true;
  const aero = (family: typeof st.family, alphaDeg: number): { cl: number; cd: number } => {
    const p = polar(family, alphaDeg);
    return drag ? p : { cl: p.cl, cd: 0 };
  };
  const st = station(i);
  const ri = st.rM;
  const c = st.chordM;
  const th = (st.twistDeg + pitchDeg) * RAD;
  const sig = (BLADES * c) / (2 * Math.PI * ri);
  let a = 0.3;
  let ap = 0.0;
  for (let k = 0; k < iters; k++) {
    const phi = Math.atan2(V * (1 - a), omegaRad * ri * (1 + ap));
    const { cl, cd } = aero(st.family, (phi - th) / RAD);
    const cn = cl * Math.cos(phi) + cd * Math.sin(phi);
    const ct = cl * Math.sin(phi) - cd * Math.cos(phi);
    const F = tipLoss ? prandtlLoss(ri, phi) : 1;
    const sphi = Math.sin(phi);
    const cphi = Math.cos(phi);
    if (Math.abs(sphi) < 1e-4) break;
    const CT = (sig * (1 - a) ** 2 * cn) / sphi ** 2;
    let an: number;
    if (CT <= 0.96 * F) {
      an = cn !== 0 ? 1.0 / (1.0 + (4 * F * sphi ** 2) / (sig * cn)) : 0.0;
    } else {
      // Buhl (2005) high-induction correction
      an =
        (18 * F - 20 - 3 * Math.sqrt(Math.max(CT * (50 - 36 * F) + 12 * F * (3 * F - 4), 0))) /
        (36 * F - 50);
    }
    let apn =
      Math.abs(ct) > 1e-9 && Math.abs(cphi) > 1e-6
        ? 1.0 / ((4 * F * sphi * cphi) / (sig * ct) - 1)
        : 0.0;
    an = Math.max(Math.min(an, 0.95), -0.5);
    apn = Math.max(Math.min(apn, 1.0), -0.5);
    if (Math.abs(an - a) < 1e-6 && Math.abs(apn - ap) < 1e-6) {
      a = an;
      ap = apn;
      break;
    }
    a = 0.7 * a + 0.3 * an;
    ap = 0.7 * ap + 0.3 * apn;
  }
  const vAx = V * (1 - a);
  const vT = omegaRad * ri * (1 + ap);
  const phi = Math.atan2(vAx, vT);
  const alphaDeg = (phi - th) / RAD;
  const { cl, cd } = aero(st.family, alphaDeg);
  const cn = cl * Math.cos(phi) + cd * Math.sin(phi);
  const ct = cl * Math.sin(phi) - cd * Math.cos(phi);
  const q = 0.5 * RHO_KG_M3 * (vAx * vAx + vT * vT) * c;
  return { dT: q * cn, dQ: q * ct * ri, alphaDeg, a, aPrime: ap, cl, cd };
}

/** Whole-rotor Cp, Ct, thrust and torque. V must be > 0. */
export function rotor(
  V: number,
  omegaRad: number,
  pitchDeg: number,
  opts: BemOptions = {},
): RotorResult {
  let T = 0;
  let Q = 0;
  for (let i = 0; i < STATION_COUNT; i++) {
    const s = solveElement(V, omegaRad, pitchDeg, i, 200, opts);
    const dr = (STATIONS[i] as { drM: number }).drM;
    T += BLADES * s.dT * dr;
    Q += BLADES * s.dQ * dr;
  }
  return {
    cp: (Q * omegaRad) / (0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 3),
    ct: T / (0.5 * RHO_KG_M3 * SWEPT_AREA_M2 * V ** 2),
    thrustN: T,
    torqueNm: Q,
  };
}

/** Angle of attack at every station, deg (for the Along the blade chart). */
export function spanwiseAlpha(V: number, omegaRad: number, pitchDeg: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < STATION_COUNT; i++) out.push(solveElement(V, omegaRad, pitchDeg, i).alphaDeg);
  return out;
}
