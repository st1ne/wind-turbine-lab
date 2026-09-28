/**
 * Phase 8 checks: the smoke shader's formulas match physics/actuatorDisk, the wake at 8 m/s
 * widens to about 1.25 R (TODO "done when"), and every FX quantity follows the snapshot.
 */
import { describe, expect, it } from 'vitest';
import { OMEGA_RATED_RAD, P_RATED_W, RADIUS_M, THRUST_RATED_N } from '@/config/turbine';
import { farWakeRadius, streamlineRadius, tubeRadius } from '@/physics/actuatorDisk';
import { createSim } from '@/physics/sim';
import { HOUSES, litHouses } from '@/scene/environment/village';
import { ARROW_M_PER_N, arrowLength } from '@/scene/fx/loadsViz';
import { MAX_PULSES, pulseCount, pulseSpeed } from '@/scene/fx/powerFlow';
import { helixTwist } from '@/scene/fx/tipVortices';
import { FOLLOW_DIM } from '@/scene/follow';
import { stressShape } from '@/scene/turbine/tower';

/** Line-by-line port of DISK_FLOW_GLSL (fx/diskFlow.ts). */
const glsl = {
  u: (x: number, a: number) => 1 - a * (1 + x / Math.sqrt(x * x + 1)),
  tubeR: (x: number, a: number) => Math.sqrt((1 - a) / Math.max(glsl.u(x, a), 1e-4)),
  streamline(rInf: number, x: number, a: number): number {
    const u = Math.max(glsl.u(x, a), 1e-4);
    if (rInf * rInf <= 1 - a) return rInf * Math.sqrt(1 / u);
    const rt = glsl.tubeR(x, a);
    return Math.sqrt(Math.max(rInf * rInf + rt * rt - (1 - a), 0));
  },
};

function steady(V: number) {
  const sim = createSim();
  sim.initSteady(V);
  return sim.snapshot();
}

describe('smoke shader formulas = physics/actuatorDisk', () => {
  it.each([0, 0.1, 0.265, 1 / 3, 0.45])('a = %f', (a) => {
    for (let x = -2.5; x <= 5; x += 0.25) {
      expect(glsl.tubeR(x, a)).toBeCloseTo(tubeRadius(x, a, 1), 6);
      for (const r of [0.35, 0.75, 1.2]) {
        expect(glsl.streamline(r, x, a)).toBeCloseTo(streamlineRadius(r, x, a, 1), 6);
      }
    }
  });
});

describe('wake at 8 m/s (done when)', () => {
  const s = steady(8);
  it('the stream tube widens to about 1.25 R', () => {
    expect(s.a).toBeGreaterThan(0.24);
    expect(s.a).toBeLessThan(0.29);
    expect(tubeRadius(5, s.a, 1)).toBeGreaterThan(1.18);
    expect(farWakeRadius(s.a, 1)).toBeCloseTo(1.25, 1);
  });
  it('the smoke slows: wake speed ≈ (1 − 2a) V far downstream', () => {
    expect(glsl.u(5, s.a)).toBeLessThan(0.55);
    expect(glsl.u(-2.5, s.a)).toBeGreaterThan(0.95);
  });
});

describe('power flow and village follow P', () => {
  it('pulses: count and speed ∝ P, none when parked', () => {
    expect(pulseCount(0)).toBe(0);
    expect(pulseSpeed(0)).toBe(0);
    expect(pulseCount(P_RATED_W)).toBe(MAX_PULSES);
    expect(pulseSpeed(P_RATED_W / 2)).toBeCloseTo(pulseSpeed(P_RATED_W) / 2, 10);
    const parked = steady(30);
    expect(parked.state).toBe('PARKED');
    expect(pulseCount(parked.Pel)).toBe(0);
  });
  it('lit houses = round(12 · P / P_rated)', () => {
    expect(litHouses(0)).toBe(0);
    expect(litHouses(P_RATED_W)).toBe(HOUSES);
    expect(litHouses(steady(8).Pel)).toBe(Math.round((12 * steady(8).Pel) / P_RATED_W));
    expect(litHouses(-1e6)).toBe(0);
  });
});

describe('loads', () => {
  it('thrust arrow: 1 cm per 20 kN, 36 cm at rated', () => {
    expect(arrowLength(20e3)).toBeCloseTo(0.01, 10);
    expect(arrowLength(THRUST_RATED_N)).toBeCloseTo(0.3625, 6);
    expect(arrowLength(-20e3)).toBeCloseTo(0.01, 10);
    expect(ARROW_M_PER_N).toBeCloseTo(5e-7, 12);
  });
  it('stress ramp peaks at the base and falls toward the top', () => {
    expect(stressShape(0)).toBeCloseTo(1, 10);
    expect(stressShape(40)).toBeLessThan(1);
    expect(stressShape(87.6)).toBeLessThan(0.1);
  });
  it('a feathered, parked rotor carries a fraction of the rated thrust', () => {
    expect(steady(30).T / THRUST_RATED_N).toBeLessThan(0.05);
  });
});

describe('tip vortices', () => {
  it('helix pitch 2π u_c / ω', () => {
    const a = 0.27;
    const V = 8;
    const omega = OMEGA_RATED_RAD * 0.77;
    const pitchM = (2 * Math.PI * RADIUS_M) / helixTwist(omega, V, a);
    expect(pitchM).toBeCloseTo((2 * Math.PI * V * (1 - a)) / omega, 6);
  });
});

describe('follow modes', () => {
  it('each mode keeps its own systems at full colour', () => {
    expect(FOLLOW_DIM.wind.wind).toBe(0);
    expect(FOLLOW_DIM.power.power).toBe(0);
    expect(FOLLOW_DIM.loads.loads).toBe(0);
    expect(FOLLOW_DIM.loads.rotor).toBe(0);
    expect(Object.values(FOLLOW_DIM.all).every((v) => v === 0)).toBe(true);
  });
});
