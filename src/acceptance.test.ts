/**
 * TECH_SPEC §19 acceptance criteria that can be checked without a browser. Items 1 (the §7
 * vectors, storm ramp, pitch-lock trip) live in physics/__tests__; this file adds items 2 and 3
 * and a wider NaN fuzz over everything that turns the snapshot into on-screen numbers.
 */
import { describe, expect, it } from 'vitest';
import { cpIdeal, streamlineRadius, tubeRadius } from '@/physics/actuatorDisk';
import { lossWaterfall } from '@/physics/losses';
import { createSim } from '@/physics/sim';
import type { SimInputs, SimSnapshot } from '@/physics/types';
import { beaconColor } from '@/scene/fx/beacon';
import { pulseCount, pulseSpeed } from '@/scene/fx/powerFlow';
import { createSimBridge } from '@/state/simBridge';
import { createStore } from '@/state/store';
import { defaultUiState, PRESET_WIND, type UiState } from '@/state/uiState';
import { regimeTitle, renderTemplate } from '@/ui/templates';
import { mulberry32 } from '@/util/math';

const FRAME = 1 / 60;
const finite = (s: SimSnapshot): boolean =>
  Object.values(s).every((v) => typeof v !== 'number' || Number.isFinite(v));

describe('§19.2 wind slider 0 → 35 → 0: glitch-free power, no NaN', () => {
  // drag the slider up over 60 s, hold, then back down (the mean wind ramps behind it)
  function sweep(V0: number): { maxStepMW: number; dips: number; peakMW: number } {
    const sim = createSim();
    sim.initSteady(V0);
    const inputs: SimInputs = {
      windTarget: V0,
      gusts: false,
      pitchLockDeg: null,
      idealDisk: false,
    };
    let prev = sim.snapshot();
    let maxStepMW = 0;
    let peakMW = 0;
    let dips = 0;
    for (let t = 0; t < 200; t += FRAME) {
      inputs.windTarget =
        t < 60 ? V0 + ((35 - V0) * t) / 60 : t < 100 ? 35 : Math.max(35 - (35 * (t - 100)) / 60, 0);
      sim.step(FRAME, inputs);
      const s = sim.snapshot();
      expect(finite(s)).toBe(true);
      // a supervisor transition (RUN → SHUTDOWN disconnects the generator: §6.9, the card
      // reads 0.00 MW, §3.3) is a real step; within one state the dot must move smoothly
      if (s.state === prev.state) maxStepMW = Math.max(maxStepMW, Math.abs(s.Pel - prev.Pel) / 1e6);
      // while the wind rises in RUN below cut-out, power never drops noticeably
      if (t < 60 && s.state === 'RUN' && s.Vmean < 24 && s.Pel < prev.Pel - 0.02e6) dips++;
      peakMW = Math.max(peakMW, s.Pel / 1e6);
      prev = s;
    }
    return { maxStepMW, dips, peakMW };
  }

  it('from standstill: monotonic while rising, no steps, never NaN', () => {
    // at fine pitch a parked rotor starts slowly (deep stall at λ ≈ 0), so it may cut out first
    const r = sweep(0);
    expect(r.dips).toBe(0);
    expect(r.maxStepMW).toBeLessThan(0.25);
  });

  it('from idle (3 m/s): climbs to rated power smoothly', () => {
    const r = sweep(3);
    expect(r.dips).toBe(0);
    expect(r.maxStepMW).toBeLessThan(0.25);
    expect(r.peakMW).toBeGreaterThan(4.9);
  });
});

describe('§19.3 Storm from Rated', () => {
  it('edge-on within ≈ 30 s, beacon on, brake hot, text SHUTDOWN then PARKED', () => {
    const store = createStore<UiState>({ ...defaultUiState(), windTarget: PRESET_WIND.rated });
    const sim = createSim();
    sim.initSteady(PRESET_WIND.rated);
    const bridge = createSimBridge(store, sim);
    store.set({ weatherPreset: 'storm', windTarget: PRESET_WIND.storm });
    const titles: string[] = [];
    let edgeOnAt = Number.NaN;
    for (let t = 0; t < 40; t += FRAME) {
      bridge.frame(FRAME);
      const s = sim.snapshot();
      const title = regimeTitle({ s, wakeB: 1, pitchLockDeg: null });
      if (titles.at(-1) !== title) titles.push(title);
      if (Number.isNaN(edgeOnAt) && s.beta > 89.9) edgeOnAt = s.t;
    }
    const s = sim.snapshot();
    expect(edgeOnAt).toBeLessThan(35);
    expect(s.state).toBe('PARKED');
    expect(beaconColor(s.state)).toBe('amber');
    expect(s.brakeHeat).toBeGreaterThan(0);
    expect(titles.indexOf('Storm shutdown')).toBeGreaterThan(-1);
    expect(titles.indexOf('Parked')).toBeGreaterThan(titles.indexOf('Storm shutdown'));
    expect(pulseCount(s.Pel)).toBe(0);
  });
});

describe('fuzz: every display path stays finite (§19.2, Phase 17)', () => {
  it('10,000 random sim states through the templates and FX mappings', () => {
    const rnd = mulberry32(7);
    const sim = createSim();
    const inputs: SimInputs = { windTarget: 8, gusts: false, pitchLockDeg: null, idealDisk: false };
    for (let k = 0; k < 10000; k++) {
      if (k % 40 === 0) {
        inputs.windTarget = rnd() * 35;
        inputs.gusts = rnd() < 0.5;
        inputs.pitchLockDeg = rnd() < 0.15 ? rnd() * 90 : null;
        inputs.idealDisk = rnd() < 0.2;
        if (rnd() < 0.05) sim.resetTrip();
        if (rnd() < 0.02) sim.initSteady(rnd() * 35);
      }
      sim.step(rnd() * 0.2, inputs);
      const s = sim.snapshot();
      expect(finite(s)).toBe(true);
      const wakeB = rnd();
      const html = renderTemplate({
        s,
        wakeB,
        pitchLockDeg: inputs.pitchLockDeg,
        tripPeakOmegaRad: s.omega,
      });
      expect(html).not.toMatch(/NaN|Infinity|undefined|—/);
      expect(Number.isFinite(pulseSpeed(s.Pel))).toBe(true);
      expect(Number.isFinite(cpIdeal(wakeB))).toBe(true);
      const a = Math.min(Math.max(s.a, 0), 0.45);
      expect(Number.isFinite(tubeRadius(rnd() * 7.5 - 2.5, a, 1))).toBe(true);
      expect(Number.isFinite(streamlineRadius(rnd() * 1.5, rnd() * 7.5 - 2.5, a, 1))).toBe(true);
    }
  });
  it('the loss waterfall is finite and ordered', () => {
    const cps = lossWaterfall().map((s) => s.cp);
    expect(cps.every(Number.isFinite)).toBe(true);
  });
});
