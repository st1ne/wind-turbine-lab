/** Optimum and steady schedule, TECH_SPEC §7.1–7.2. */
import { describe, expect, it } from 'vitest';
import { computeOptimum, computeSchedule } from '@/physics/schedule';
import { OPTIMUM, SCHEDULE } from '@/physics/tables';
import { K_HSS, VS_TR } from '@/physics/controller';

// V, rpm, pitch, TSR, Cp, Ct, P (MW), Q (MN·m), T (kN)
const TABLE: number[][] = [
  [3, 3.48, 0.0, 7.65, 0.471, 0.779, 0.09, 0.27, 54],
  [5, 5.8, 0.0, 7.65, 0.471, 0.779, 0.42, 0.74, 149],
  [6, 6.96, 0.0, 7.65, 0.471, 0.779, 0.73, 1.07, 214],
  [8, 9.28, 0.0, 7.65, 0.471, 0.779, 1.74, 1.9, 381],
  [10, 11.6, 0.0, 7.65, 0.471, 0.779, 3.4, 2.96, 595],
  [11, 12.1, 0.0, 7.26, 0.469, 0.751, 4.5, 3.77, 694],
  [11.42, 12.1, 0.05, 6.99, 0.466, 0.728, 5.0, 4.18, 725],
  [12, 12.1, 3.51, 6.65, 0.401, 0.544, 5.0, 4.18, 598],
  [13, 12.1, 6.39, 6.14, 0.316, 0.397, 5.0, 4.18, 513],
  [15, 12.1, 10.35, 5.32, 0.205, 0.246, 5.0, 4.18, 422],
  [18, 12.1, 14.9, 4.43, 0.119, 0.141, 5.0, 4.18, 348],
  [20, 12.1, 17.48, 3.99, 0.087, 0.104, 5.0, 4.18, 317],
  [25, 12.1, 23.19, 3.19, 0.044, 0.056, 5.0, 4.18, 269],
];

const opt = computeOptimum();
const schedule = computeSchedule(opt);

describe('optimum (§7.1)', () => {
  it('Cp_max 0.4709 at λ_opt 7.65', () => {
    expect(opt.cpMax).toBeCloseTo(0.4709, 4);
    expect(opt.lambdaOpt).toBeCloseTo(7.65, 6);
  });
  it('K_opt 2.0085e6 N·m·s², K_HSS 2.2007', () => {
    expect(opt.kOpt / 1e6).toBeCloseTo(2.0085, 3);
    expect(K_HSS).toBeCloseTo(2.2007, 3);
  });
  it('V_rated 11.42 ± 0.03', () => {
    expect(Math.abs(opt.vRated - 11.42)).toBeLessThan(0.03);
  });
  it('region 2.5 starts at 1,131.3 generator rpm', () => {
    expect((VS_TR * 30) / Math.PI).toBeCloseTo(1131.3, 0);
  });
});

describe('steady schedule (§7.2)', () => {
  it.each(TABLE)('V = %f', (V, rpm, pitch, tsr, cp, ct, P, Q, T) => {
    const row = schedule.find((r) => Math.abs(r.V - V) < 1e-9);
    expect(row).toBeDefined();
    if (!row) return;
    expect(Math.abs(row.rpm - rpm)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(row.pitch - pitch)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(row.tsr - tsr)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(row.cp - cp)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(row.ct - ct)).toBeLessThanOrEqual(0.002);
    expect(Math.abs(row.P_MW - P)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(row.Q_MNm - Q)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(row.T_kN - T)).toBeLessThanOrEqual(3);
  });

  it('the generated JSON matches a fresh computation (run `npm run tables` if not)', () => {
    expect(OPTIMUM.cpMax).toBeCloseTo(opt.cpMax, 10);
    expect(SCHEDULE).toEqual(schedule);
  });
});
