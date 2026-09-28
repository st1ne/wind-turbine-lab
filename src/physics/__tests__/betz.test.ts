/** Actuator disk and Betz limit, TECH_SPEC §6.5. */
import { describe, expect, it } from 'vitest';
import {
  axialVelocity,
  cpIdeal,
  ctIdeal,
  farWakeRadius,
  inductionFromCt,
  streamlineRadius,
  travelTime,
  tubeRadius,
} from '@/physics/actuatorDisk';

const R = 63;

describe('Betz', () => {
  it('cpIdeal peaks at 16/27 for b = 1/3', () => {
    let best = -1;
    let bBest = 0;
    for (let k = 0; k <= 3000; k++) {
      const b = k / 3000;
      if (cpIdeal(b) > best) {
        best = cpIdeal(b);
        bBest = b;
      }
    }
    expect(cpIdeal(1 / 3)).toBeCloseTo(16 / 27, 12);
    expect(best).toBeCloseTo(16 / 27, 6);
    expect(bBest).toBeCloseTo(1 / 3, 3);
    expect(cpIdeal(1)).toBe(0);
  });

  it('Ct and induction are inverse, incl. the Buhl branch', () => {
    for (const a of [0, 0.1, 1 / 3, 0.39]) expect(inductionFromCt(ctIdeal(a))).toBeCloseTo(a, 9);
    // continuity at Ct = 0.96 (a = 0.4)
    expect(inductionFromCt(0.96)).toBeCloseTo(0.4, 9);
    expect(inductionFromCt(0.9601)).toBeCloseTo(0.4, 3);
    expect(inductionFromCt(1.5)).toBeGreaterThan(0.4);
  });

  it('u(x) goes V → V(1−a) → V(1−2a)', () => {
    const a = 1 / 3;
    expect(axialVelocity(-1e7, a, R, 10)).toBeCloseTo(10, 4);
    expect(axialVelocity(0, a, R, 10)).toBeCloseTo(10 * (1 - a), 12);
    expect(axialVelocity(1e7, a, R, 10)).toBeCloseTo(10 * (1 - 2 * a), 4);
  });

  it('tubeRadius(+∞, 1/3) = √2·R and R at the disk', () => {
    expect(tubeRadius(1e7, 1 / 3, R)).toBeCloseTo(Math.SQRT2 * R, 3);
    expect(farWakeRadius(1 / 3, R)).toBeCloseTo(Math.SQRT2 * R, 9);
    expect(tubeRadius(0, 0.2, R)).toBeCloseTo(R, 9);
  });

  it('streamlines are continuous across the tube boundary and expand downstream', () => {
    const a = 0.25;
    const rb = R * Math.sqrt(1 - a);
    for (const x of [-100, 0, 50, 300]) {
      expect(streamlineRadius(rb - 1e-9, x, a, R)).toBeCloseTo(streamlineRadius(rb + 1e-9, x, a, R), 5);
    }
    expect(streamlineRadius(0.75 * R, 200, a, R)).toBeGreaterThan(streamlineRadius(0.75 * R, -200, a, R));
    expect(streamlineRadius(1.2 * R, -1e6, a, R)).toBeCloseTo(1.2 * R, 2);
  });

  it('travel time is monotonic', () => {
    const xs = Array.from({ length: 50 }, (_, k) => -150 + k * 10);
    const tau = travelTime(xs, 1 / 3, R);
    for (let k = 1; k < tau.length; k++) expect(tau[k]).toBeGreaterThan(tau[k - 1] as number);
  });
});
