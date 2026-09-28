/** BEM test vectors rotor(V = 10, λ, β) from TECH_SPEC §7.3, tolerance ±0.002. */
import { describe, expect, it } from 'vitest';
import { RADIUS_M } from '@/config/turbine';
import { prandtlLoss, rotor } from '@/physics/bem';
import { polar } from '@/physics/polars';

const VECTORS: [lambda: number, pitch: number, cp: number, ct: number][] = [
  [4.0, 0, 0.2167, 0.329],
  [7.65, 0, 0.4709, 0.7788],
  [10.0, 0, 0.4286, 0.9203],
  [6.0, 5, 0.3513, 0.4522],
  [5.0, 15, 0.0837, 0.1056],
  [4.0, 25, -0.0745, -0.0557],
  [3.0, 35, -0.0984, -0.0812],
  [7.0, 90, -5.3105, 0.0723],
];

describe('rotor(V = 10, λ, β)', () => {
  it.each(VECTORS)('λ %f β %f', (lambda, pitch, cp, ct) => {
    const r = rotor(10, (lambda * 10) / RADIUS_M, pitch);
    expect(Math.abs(r.cp - cp)).toBeLessThan(0.002);
    expect(Math.abs(r.ct - ct)).toBeLessThan(0.002);
  });
});

describe('polars and tip loss', () => {
  it('are continuous at the stall points', () => {
    for (const fam of ['DU40', 'DU25', 'NACA64'] as const) {
      const a = polar(fam, 10.0);
      const b = polar(fam, 10.0001);
      expect(Math.abs(a.cl - b.cl)).toBeLessThan(0.3);
    }
  });

  it('never returns NaN over the full angle range', () => {
    for (let al = -180; al <= 180; al += 0.5) {
      const p = polar('DU30', al);
      expect(Number.isFinite(p.cl) && Number.isFinite(p.cd)).toBe(true);
      expect(p.cd).toBeGreaterThanOrEqual(0.012);
    }
  });

  it('Prandtl loss stays in (0, 1]', () => {
    for (let r = 2; r < 63; r += 3) {
      const F = prandtlLoss(r, 0.2);
      expect(F).toBeGreaterThan(0);
      expect(F).toBeLessThanOrEqual(1);
    }
  });

  it('rotor handles λ ≈ 0 and pitch 90 without NaN', () => {
    for (const [om, b] of [
      [1e-4, 0],
      [0, 90],
      [3, 90],
      [0.5, -2],
    ] as const) {
      const r = rotor(10, om, b);
      expect(Number.isFinite(r.cp) && Number.isFinite(r.ct)).toBe(true);
    }
  });
});
