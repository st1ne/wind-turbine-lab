/** Dynamic scenarios (TECH_SPEC §7.5), supervisor behaviour and NaN fuzzing (§19). */
import { describe, expect, it } from 'vitest';
import { cpAt, ctAt } from '@/physics/tables';
import { createSim, type Sim } from '@/physics/sim';
import type { SimInputs, SimSnapshot } from '@/physics/types';
import { mulberry32 } from '@/util/math';

const RPM = 30 / Math.PI;

interface LogRow {
  t: number;
  s: SimSnapshot;
}

/** Mirrors simulate() in the reference: dt = 0.02, log after the step at t ≥ next log. */
function run(
  sim: Sim,
  Vfun: (t: number) => number,
  tEnd: number,
  logEvery: number,
  pitchLockDeg: number | null = null,
): LogRow[] {
  const dt = 0.02;
  const inputs: SimInputs = { windTarget: Vfun(0), gusts: false, pitchLockDeg, idealDisk: false };
  sim.initSteady(Vfun(0));
  const log: LogRow[] = [];
  let t = 0;
  let next = 0;
  while (t <= tEnd + 1e-9) {
    inputs.windTarget = Vfun(t);
    sim.advance(dt, inputs);
    if (t >= next - 1e-9) {
      log.push({ t: Math.round(t * 10) / 10, s: sim.snapshot() });
      next += logEvery;
    }
    t += dt;
  }
  return log;
}

const storm = (t: number): number =>
  t < 20 ? 12 : t < 80 ? 12 + (t - 20) * 0.3 : t < 180 ? 30 : 15;

describe('storm ramp, reference behaviour (§7.5)', () => {
  const log = run(createSim({ holds: false, windRamp: false }), storm, 260, 10);
  // t, rpm, pitch, P (MW), T (kN), state
  const rows: [number, number, number, number, number, string][] = [
    [20, 12.1, 3.49, 5.0, 599, 'RUN'],
    [40, 12.55, 14.53, 5.0, 352, 'RUN'],
    [60, 12.61, 21.46, 5.0, 279, 'RUN'],
    [70, 6.4, 49.19, 0.0, -67, 'SHUTDOWN'],
    [90, 0.0, 90.0, 0.0, 28, 'PARKED'],
    [200, 2.65, 49.96, 0.0, 25, 'STARTUP'],
    [220, 10.98, 7.09, 5.0, 593, 'RUN'],
    [250, 12.1, 10.35, 5.0, 422, 'RUN'],
  ];
  it.each(rows)('t = %i s', (t, rpm, pitch, P, T, state) => {
    const row = log.find((r) => r.t === t);
    expect(row).toBeDefined();
    if (!row) return;
    expect(Math.abs(row.s.omega * RPM - rpm)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(row.s.beta - pitch)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(row.s.Pel / 1e6 - P)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(row.s.T / 1e3 - T)).toBeLessThanOrEqual(3);
    expect(row.s.state).toBe(state);
  });
});

describe('storm ramp, app behaviour (holds + wind ramp)', () => {
  const log = run(createSim(), storm, 300, 1);
  it('reaches PARKED with β = 90° and ω = 0', () => {
    const parked = log.filter((r) => r.s.state === 'PARKED');
    expect(parked.length).toBeGreaterThan(0);
    const last = parked[parked.length - 1] as LogRow;
    expect(last.s.beta).toBeCloseTo(90, 6);
    expect(last.s.omega).toBe(0);
  });
  it('cuts out within ±5 s of the reference (t ≈ 63 s)', () => {
    const first = log.find((r) => r.s.state === 'SHUTDOWN');
    expect(first).toBeDefined();
    expect(Math.abs((first?.t ?? 0) - 63.3)).toBeLessThanOrEqual(5);
  });
  it('restarts to RUN at 15 m/s and settles at rated', () => {
    const end = log[log.length - 1] as LogRow;
    expect(end.s.state).toBe('RUN');
    expect(Math.abs(end.s.omega * RPM - 12.1)).toBeLessThan(0.1);
    expect(Math.abs(end.s.Pel / 1e6 - 5)).toBeLessThan(0.02);
    expect(end.s.regime).toBe('SPILL');
  });
  it('brakes and heats the disc while stopping', () => {
    expect(log.some((r) => r.s.brakeOn && r.s.brakeHeat > 0)).toBe(true);
  });
});

describe('pitch locked at 0°, wind jump 12 → 22 m/s at t = 10 s', () => {
  const sim = createSim({ holds: false, windRamp: false });
  const log = run(sim, (t) => (t < 10 ? 12 : 22), 26, 0.02, 0);
  it('trips on overspeed between t = 10 and 12 s', () => {
    const trip = log.find((r) => r.s.state === 'TRIP');
    expect(trip).toBeDefined();
    expect(trip?.t).toBeGreaterThanOrEqual(10);
    expect(trip?.t).toBeLessThanOrEqual(12);
    expect(trip?.s.regime).toBe('TRIP');
  });
  it('peaks near 17.6 rpm and stops by ≈ 22 s (TRIPPED)', () => {
    const peak = Math.max(...log.map((r) => r.s.omega * RPM));
    expect(Math.abs(peak - 17.6)).toBeLessThan(0.3);
    const tripped = log.find((r) => r.s.state === 'TRIPPED');
    expect(tripped).toBeDefined();
    expect(Math.abs((tripped?.t ?? 0) - 22)).toBeLessThanOrEqual(1.5);
  });
  it('is latched until reset, then restarts', () => {
    const inputs: SimInputs = { windTarget: 12, gusts: false, pitchLockDeg: null, idealDisk: false };
    for (let k = 0; k < 500; k++) sim.advance(0.02, inputs);
    expect(sim.snapshot().state).toBe('TRIPPED');
    sim.resetTrip();
    expect(sim.snapshot().state).toBe('STARTUP');
    for (let k = 0; k < 6000; k++) sim.advance(0.02, inputs);
    expect(sim.snapshot().state).toBe('RUN');
  });
});

describe('steady init', () => {
  it.each([0, 2, 5, 8, 11.4, 15, 24.9])('holds steady at %f m/s', (V) => {
    const sim = createSim({ holds: true, windRamp: true });
    sim.initSteady(V);
    const w0 = sim.snapshot().omega;
    const inputs: SimInputs = { windTarget: V, gusts: false, pitchLockDeg: null, idealDisk: false };
    for (let k = 0; k < 120 * 10; k++) sim.advance(1 / 120, inputs);
    const s = sim.snapshot();
    expect(s.state).toBe('RUN');
    if (V >= 3) expect(Math.abs(s.omega - w0) * RPM).toBeLessThan(0.15);
  });
  it('starts parked above cut-out', () => {
    const sim = createSim();
    sim.initSteady(30);
    expect(sim.snapshot().state).toBe('PARKED');
    expect(sim.snapshot().beta).toBe(90);
  });
  it('regimes CALM / CHASE / CAP / SPILL', () => {
    const sim = createSim();
    const regime = (V: number): string => {
      sim.initSteady(V);
      return sim.snapshot().regime;
    };
    expect(regime(2)).toBe('CALM');
    expect(regime(8)).toBe('CHASE');
    // region 2.5 is the narrow band of generator speed 1,131–1,162 rpm (≈ 10.05–10.33 m/s)
    expect(regime(10.2)).toBe('CAP');
    expect(regime(15)).toBe('SPILL');
  });
});

describe('fuzz: no NaN or Infinity', () => {
  const rnd = mulberry32(42);
  it('10,000 random table lookups', () => {
    for (let k = 0; k < 10000; k++) {
      const l = rnd() * 40 - 10;
      const b = rnd() * 200 - 50;
      expect(Number.isFinite(cpAt(l, b)) && Number.isFinite(ctAt(l, b))).toBe(true);
    }
    expect(Number.isFinite(cpAt(NaN, Infinity))).toBe(true);
  });
  it('10,000 random sim steps', () => {
    const sim = createSim();
    const inputs: SimInputs = { windTarget: 8, gusts: true, pitchLockDeg: null, idealDisk: false };
    for (let k = 0; k < 10000; k++) {
      if (k % 50 === 0) {
        inputs.windTarget = rnd() * 35;
        inputs.pitchLockDeg = rnd() < 0.2 ? rnd() * 90 : null;
        inputs.gusts = rnd() < 0.5;
        if (rnd() < 0.05) sim.resetTrip();
        if (rnd() < 0.02) sim.initSteady(rnd() * 35);
      }
      sim.step(rnd() * 0.3, inputs);
      const s = sim.snapshot();
      for (const v of [s.V, s.omega, s.beta, s.Pel, s.T, s.cp, s.ct, s.a, s.Qaero, s.brakeHeat]) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(s.omega).toBeGreaterThanOrEqual(0);
    }
  });
});
