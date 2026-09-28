/** Spanwise angle of attack at stations 4–17, TECH_SPEC §7.4, tolerance ±0.2°. */
import { describe, expect, it } from 'vitest';
import { OMEGA_RATED_RAD, RADIUS_M } from '@/config/turbine';
import { spanwiseAlpha } from '@/physics/bem';
import { OPTIMUM } from '@/physics/tables';

const omegaOf = (V: number): number => Math.min((OPTIMUM.lambdaOpt * V) / RADIUS_M, OMEGA_RATED_RAD);

const CASES: [name: string, V: number, pitch: number, alpha: number[]][] = [
  ['8 m/s, β 0°', 8, 0, [16.2, 9.5, 7.5, 5.8, 4.3, 4.0, 3.9, 4.0, 3.9, 4.0, 4.1, 4.2, 4.1, 4.0]],
  [
    'V_rated, β 0°',
    OPTIMUM.vRated,
    0,
    [19.3, 11.9, 9.0, 7.1, 5.6, 5.2, 5.0, 5.0, 4.9, 4.9, 5.0, 5.0, 4.9, 4.7],
  ],
  [
    '20 m/s, β 17.48°',
    20,
    17.48,
    [19.1, 12.2, 8.0, 4.9, 2.5, 1.0, -0.1, -0.9, -1.6, -2.2, -2.7, -2.9, -3.1, -3.5],
  ],
];

describe('spanwise α', () => {
  it.each(CASES)('%s', (_name, V, pitch, expected) => {
    const alpha = spanwiseAlpha(V, omegaOf(V), pitch).slice(3);
    expect(alpha).toHaveLength(14);
    alpha.forEach((a, k) => expect(Math.abs(a - (expected[k] as number))).toBeLessThanOrEqual(0.2));
  });
});
