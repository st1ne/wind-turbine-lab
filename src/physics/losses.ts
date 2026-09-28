/**
 * Loss waterfall (TECH_SPEC §3.6, §10): where the 59.3 % Betz limit goes on the way to the
 * electrical output, as a share of the wind power through the disk, at the rotor's optimum
 * tip-speed ratio λ_opt and 0° pitch. Each step removes one idealisation:
 *
 *   Betz        16/27: momentum theory, no wake rotation
 *   swirl       Glauert's optimum rotor with wake rotation at λ_opt:
 *                 Cp = (8/λ²) ∫₀^λ a'(1 − a) x³ dx,  16a³ − 24a² + a(9 − 3x²) − 1 + x² = 0,
 *                 a' = (1 − 3a)/(4a − 1)
 *   blade shape the real NREL blade (chord, twist, root cylinders) in BEM, no tip/hub loss,
 *               no drag
 *   tip & hub   + Prandtl tip and hub loss
 *   drag        + profile drag: the full BEM model, i.e. Cp_max
 *   generator   × η (generator and converter)
 *
 * Sources: Burton et al., Wind Energy Handbook §3.7 (Glauert); Hansen, Aerodynamics of Wind
 * Turbines (BEM); Jonkman et al. 2009 (NREL 5 MW).
 */
import { BETZ, ETA, RADIUS_M } from '@/config/turbine';
import { rotor } from '@/physics/bem';
import { OPTIMUM } from '@/physics/tables';

export interface LossStep {
  readonly key: 'betz' | 'swirl' | 'shape' | 'tip' | 'drag' | 'generator';
  readonly label: string;
  /** power coefficient after this step (share of the wind power) */
  readonly cp: number;
}

/** Axial induction of Glauert's optimum annulus at local speed ratio x (bisection on ¼…⅓). */
function glauertA(x: number): number {
  const f = (a: number): number => 16 * a ** 3 - 24 * a ** 2 + a * (9 - 3 * x * x) - 1 + x * x;
  let lo = 0.25 + 1e-12;
  let hi = 1 / 3;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Glauert's ideal Cp with wake rotation at tip-speed ratio λ (Simpson's rule). */
export function glauertCp(lambda: number, n = 400): number {
  const g = (x: number): number => {
    if (x <= 0) return 0;
    const a = glauertA(x);
    const ap = (1 - 3 * a) / (4 * a - 1);
    return ap * (1 - a) * x ** 3;
  };
  const h = lambda / n;
  let s = g(0) + g(lambda);
  for (let k = 1; k < n; k++) s += (k % 2 ? 4 : 2) * g(k * h);
  return ((8 / lambda ** 2) * s * h) / 3;
}

let cached: readonly LossStep[] | null = null;

/** The six steps, computed once (a few BEM solves). */
export function lossWaterfall(): readonly LossStep[] {
  if (cached) return cached;
  const lambda = OPTIMUM.lambdaOpt;
  const V = 10;
  const omega = (lambda * V) / RADIUS_M;
  const shape = rotor(V, omega, 0, { tipLoss: false, drag: false }).cp;
  const tip = rotor(V, omega, 0, { tipLoss: true, drag: false }).cp;
  const full = rotor(V, omega, 0).cp;
  cached = [
    { key: 'betz', label: 'Betz', cp: BETZ },
    { key: 'swirl', label: 'swirl', cp: glauertCp(lambda) },
    { key: 'shape', label: 'blade shape/root', cp: shape },
    { key: 'tip', label: 'tip & hub loss', cp: tip },
    { key: 'drag', label: 'drag', cp: full },
    { key: 'generator', label: 'generator', cp: full * ETA },
  ];
  return cached;
}
