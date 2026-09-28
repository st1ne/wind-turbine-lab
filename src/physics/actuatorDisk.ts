/**
 * Actuator disk, Betz limit and the stream tube (TECH_SPEC §6.5).
 *
 *   b = V_wake / V = 1 − 2a,  Cp_ideal = 4a(1−a)² = ½(1+b)(1−b²),  max 16/27 at a = 1/3
 *   Ct_ideal = 4a(1−a)
 *   a from Ct: (1 − √(1 − Ct))/2 for Ct ≤ 0.96, else Buhl's quadratic with F = 1
 *   u(x) = V[1 − a(1 + x/√(x² + R²))]                  (vortex-cylinder axial velocity)
 *   r_tube(x) = R √((1−a) V / u(x))                     (mass conservation)
 *   inside:  r(x) = r∞ √(V/u(x));  outside: r(x)² = r∞² + r_tube(x)² − R²(1−a)
 *
 * Sources: Betz 1920; Burton et al., Wind Energy Handbook §3; Buhl, NREL/TP-500-36834.
 */

/** Visual clamp on induction: beyond this momentum theory breaks down (turbulent wake state). */
export const A_VISUAL_MAX = 0.45;

/** Half-width of the Betz sweet spot around b = 1/3 (§10). */
export const BETZ_SWEET_SPOT = 0.015;

export function cpIdeal(b: number): number {
  return 0.5 * (1 + b) * (1 - b * b);
}

export function ctIdeal(a: number): number {
  return 4 * a * (1 - a);
}

/** Wake speed ratio → axial induction. */
export function inductionFromB(b: number): number {
  return (1 - b) / 2;
}

/** Disk-averaged axial induction from the thrust coefficient (Glauert/Buhl, F = 1). */
export function inductionFromCt(ct: number): number {
  if (!Number.isFinite(ct)) return 0;
  if (ct <= 0.96) return (1 - Math.sqrt(1 - ct)) / 2;
  // Buhl: Ct = 8/9 + (4F − 40/9)a + (50/9 − 4F)a², F = 1  →  (14/9)a² − (4/9)a + (8/9 − Ct) = 0
  const qa = 50 / 9 - 4;
  const qb = 4 - 40 / 9;
  const qc = 8 / 9 - Math.min(ct, 2);
  const a = (-qb + Math.sqrt(Math.max(qb * qb - 4 * qa * qc, 0))) / (2 * qa);
  return Math.min(a, 1);
}

/** Axial velocity on the axis, x = 0 at the rotor, positive downstream. */
export function axialVelocity(xM: number, a: number, radiusM: number, V: number): number {
  return V * (1 - a * (1 + xM / Math.sqrt(xM * xM + radiusM * radiusM)));
}

/** Stream-tube radius at x (bounding streamline through the rotor tip). */
export function tubeRadius(xM: number, a: number, radiusM: number): number {
  const u = axialVelocity(xM, a, radiusM, 1);
  return radiusM * Math.sqrt((1 - a) / Math.max(u, 1e-6));
}

/** Far-wake stream-tube radius R√((1−a)/(1−2a)). */
export function farWakeRadius(a: number, radiusM: number): number {
  return radiusM * Math.sqrt((1 - a) / Math.max(1 - 2 * a, 1e-6));
}

/** Radius at x of the streamline that starts at radius rInf far upstream. */
export function streamlineRadius(rInfM: number, xM: number, a: number, radiusM: number): number {
  const u = Math.max(axialVelocity(xM, a, radiusM, 1), 1e-6);
  // seed radius far upstream of the tube boundary: R√(1−a)
  const rTubeInf = radiusM * Math.sqrt(1 - a);
  if (rInfM <= rTubeInf) return rInfM * Math.sqrt(1 / u);
  const rt = tubeRadius(xM, a, radiusM);
  return Math.sqrt(rInfM * rInfM + rt * rt - radiusM * radiusM * (1 - a));
}

/**
 * Travel time τ(x) = ∫ dx / u(x) along the axis, from the first sample, for unit V
 * (divide by V for seconds). Trapezoidal rule on the given samples.
 */
export function travelTime(xSamplesM: readonly number[], a: number, radiusM: number): Float32Array {
  const out = new Float32Array(xSamplesM.length);
  let acc = 0;
  for (let k = 1; k < xSamplesM.length; k++) {
    const x0 = xSamplesM[k - 1] as number;
    const x1 = xSamplesM[k] as number;
    const u0 = Math.max(axialVelocity(x0, a, radiusM, 1), 1e-3);
    const u1 = Math.max(axialVelocity(x1, a, radiusM, 1), 1e-3);
    acc += 0.5 * (x1 - x0) * (1 / u0 + 1 / u1);
    out[k] = acc;
  }
  return out;
}
