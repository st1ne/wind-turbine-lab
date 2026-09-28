import { describe, expect, it } from 'vitest';
import { BETZ, ETA } from '@/config/turbine';
import { glauertCp, lossWaterfall, type LossStep } from '@/physics/losses';
import { OPTIMUM } from '@/physics/tables';

describe('loss waterfall (§3.6)', () => {
  const steps = lossWaterfall();
  const cp = Object.fromEntries(steps.map((s) => [s.key, s.cp])) as Record<LossStep['key'], number>;

  it('Glauert optimum rotor matches the textbook table', () => {
    // Burton et al. Table 3.1 / Wilson & Lissaman: λ = 1 → 0.416, 5 → 0.570, 10 → 0.585
    expect(glauertCp(1)).toBeCloseTo(0.416, 2);
    expect(glauertCp(5)).toBeCloseTo(0.57, 2);
    expect(glauertCp(10)).toBeCloseTo(0.585, 2);
    expect(glauertCp(50)).toBeLessThan(BETZ);
  });

  it('starts at Betz, loses swirl ≈ 58.1 % at λ_opt, ends at Cp_max · η', () => {
    expect(cp.betz).toBeCloseTo(16 / 27, 10);
    expect(cp.swirl).toBeCloseTo(0.581, 2);
    expect(cp.drag).toBeCloseTo(OPTIMUM.cpMax, 3);
    expect(cp.generator).toBeCloseTo(OPTIMUM.cpMax * ETA, 3);
  });

  it('every step loses something', () => {
    for (let k = 1; k < steps.length; k++) {
      expect((steps[k] as { cp: number }).cp).toBeLessThan((steps[k - 1] as { cp: number }).cp);
    }
  });

  it('lands near the spec’s approximate numbers (55.3 / 51.7)', () => {
    expect(cp.shape).toBeGreaterThan(0.5);
    expect(cp.shape).toBeLessThan(0.58);
    expect(cp.tip).toBeGreaterThan(0.47);
    expect(cp.tip).toBeLessThan(cp.shape);
  });
});
