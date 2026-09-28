/**
 * Phase 6 "done when": the Storm preset from Rated at ×1 goes RUN → SHUTDOWN → PARKED in about
 * 30 s of sim time (§19.3: ≈ 7 s ramp, 3 s hold, ≈ 17 s feathering at 4°/s), the end state
 * matches §7.5, and the explanation text follows every state.
 */
import { describe, expect, it } from 'vitest';
import { createSim } from '@/physics/sim';
import type { Regime, SupervisorState } from '@/physics/types';
import { createSimBridge } from '@/state/simBridge';
import { createStore } from '@/state/store';
import { defaultUiState, PRESET_WIND, type UiState } from '@/state/uiState';
import { renderTemplate } from '@/ui/templates';

const FRAME_S = 1 / 60;
const RPM = 30 / Math.PI;

function setup(windTarget: number) {
  const store = createStore<UiState>({ ...defaultUiState(), windTarget, weatherPreset: null });
  const sim = createSim();
  sim.initSteady(windTarget);
  const bridge = createSimBridge(store, sim);
  return { store, sim, bridge };
}

describe('wiring: store → bridge → sim', () => {
  it('Storm from Rated: RUN → SHUTDOWN → PARKED in ≈ 30 s with the text following', () => {
    const { store, sim, bridge } = setup(PRESET_WIND.rated);
    store.set({ weatherPreset: 'storm', windTarget: PRESET_WIND.storm });

    const changes: { t: number; state: SupervisorState }[] = [];
    const regimes: Regime[] = [];
    let last: SupervisorState | null = null;
    for (let t = 0; t < 45; t += FRAME_S) {
      bridge.frame(FRAME_S);
      const s = sim.snapshot();
      if (s.state !== last) changes.push({ t: s.t, state: (last = s.state) });
      if (regimes.at(-1) !== s.regime) regimes.push(s.regime);
      expect(renderTemplate({ s, wakeB: 1, pitchLockDeg: null })).not.toMatch(/NaN|undefined/);
    }

    expect(changes.map((c) => c.state)).toEqual(['RUN', 'SHUTDOWN', 'PARKED']);
    const shutdown = changes[1]?.t ?? NaN;
    const parked = changes[2]?.t ?? NaN;
    // 11.4 → 25 m/s at 2 m/s² takes 6.8 s, then the 3 s hold
    expect(shutdown).toBeGreaterThan(9.5);
    expect(shutdown).toBeLessThan(10.5);
    expect(parked).toBeGreaterThan(20);
    expect(parked).toBeLessThan(35);
    // the text went through spill, storm shutdown and parked
    expect(regimes).toEqual(expect.arrayContaining(['SPILL', 'SHUTDOWN', 'PARKED']));
    expect(regimes.at(-1)).toBe('PARKED');

    // end state vs §7.5 (t = 90 s row: 30 m/s, 0 rpm, 90°, 0 MW, 28 kN)
    const s = sim.snapshot();
    expect(s.Vmean).toBeCloseTo(30, 6);
    expect(s.omega * RPM).toBeLessThan(0.01);
    expect(s.beta).toBeCloseTo(90, 6);
    expect(s.Pel).toBe(0);
    expect(s.T / 1e3).toBeGreaterThan(25);
    expect(s.T / 1e3).toBeLessThan(31);
    expect(s.brakeOn).toBe(true);
  });

  it('time scale ×4 compresses the same storm into a quarter of the real time', () => {
    const { store, sim, bridge } = setup(PRESET_WIND.rated);
    store.set({ weatherPreset: 'storm', windTarget: PRESET_WIND.storm, timeScale: 4 });
    for (let k = 0; k < 60 * 10; k++) bridge.frame(FRAME_S); // 10 s of real time
    expect(sim.snapshot().t).toBeCloseTo(40, 1);
    expect(sim.snapshot().state).toBe('PARKED');
  });

  it('pause freezes the sim; the clock resumes where it stopped', () => {
    const { store, sim, bridge } = setup(8);
    for (let k = 0; k < 60; k++) bridge.frame(FRAME_S);
    const t0 = sim.snapshot().t;
    store.set({ paused: true });
    for (let k = 0; k < 120; k++) bridge.frame(FRAME_S);
    expect(sim.snapshot().t).toBe(t0);
    store.set({ paused: false });
    for (let k = 0; k < 30; k++) bridge.frame(FRAME_S);
    expect(sim.snapshot().t).toBeCloseTo(t0 + 0.5, 2);
  });

  it('pitch lock freezes the current angle; jumpTo re-freezes at the new steady point', () => {
    const { store, sim, bridge } = setup(15);
    const beta15 = sim.snapshot().beta;
    store.set({ pitchLock: true });
    expect(bridge.lockedPitchDeg()).toBeCloseTo(beta15, 6);
    bridge.jumpTo(20);
    expect(store.get().windTarget).toBe(20);
    expect(store.get().weatherPreset).toBe('gale');
    expect(sim.snapshot().Vmean).toBe(20);
    expect(bridge.lockedPitchDeg()).toBeCloseTo(sim.snapshot().beta, 6);
    expect(bridge.lockedPitchDeg()).toBeGreaterThan(beta15);
    store.set({ pitchLock: false });
    expect(bridge.lockedPitchDeg()).toBeNull();
  });

  it('presets ramp the mean wind at ≤ 2 m/s per sim second; jumpTo does not', () => {
    const { store, sim, bridge } = setup(8);
    store.set({ weatherPreset: 'gale', windTarget: 20 });
    for (let k = 0; k < 60; k++) bridge.frame(FRAME_S);
    expect(sim.snapshot().Vmean).toBeCloseTo(10, 1);
    bridge.jumpTo(30);
    expect(sim.snapshot().Vmean).toBe(30);
    expect(sim.snapshot().state).toBe('PARKED');
  });

  it.each([
    ['breeze', 'storm'],
    ['breeze', 'gale'],
    ['rated', 'gale'],
    ['storm', 'breeze'],
    ['gale', 'rated'],
  ] as const)('preset %s → %s never trips on overspeed', (from, to) => {
    const { store, sim, bridge } = setup(PRESET_WIND[from]);
    store.set({ weatherPreset: to, windTarget: PRESET_WIND[to] });
    let peak = 0;
    for (let k = 0; k < 60 * 90; k++) {
      bridge.frame(FRAME_S);
      const s = sim.snapshot();
      peak = Math.max(peak, s.omega);
      expect(s.state).not.toBe('TRIP');
    }
    expect(peak * RPM).toBeLessThan(13.9);
  });

  it.each([12, 16, 20, 24])('gusts (TI 0.12) at %f m/s run 5 minutes without a trip', (V) => {
    const { store, sim, bridge } = setup(V);
    store.set({ gusts: true });
    for (let k = 0; k < 60 * 300; k++) {
      bridge.frame(FRAME_S);
      expect(sim.snapshot().state).toBe('RUN');
    }
  });

  it('reset only acts after a trip', () => {
    const { store, sim, bridge } = setup(12);
    bridge.resetTrip();
    expect(sim.snapshot().state).toBe('RUN');
    store.set({ pitchLock: true, windTarget: 22 });
    for (let k = 0; k < 60 * 30; k++) bridge.frame(FRAME_S);
    expect(sim.snapshot().state).toBe('TRIPPED');
    store.set({ pitchLock: false, windTarget: 15 });
    for (let k = 0; k < 60 * 6; k++) bridge.frame(FRAME_S);
    bridge.resetTrip();
    expect(sim.snapshot().state).toBe('STARTUP');
  });
});
