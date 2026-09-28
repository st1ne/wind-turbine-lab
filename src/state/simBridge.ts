/**
 * uiState → SimInputs bridge (TECH_SPEC §14.3). The sim never reads the store; this module keeps
 * the mutable inputs object in sync and owns the UI-driven sim actions:
 *   - Locked freezes the pitch at the angle it has when locked (§3.4)
 *   - jumpTo(V) is an instant jump (tour steps, URL restore): initSteady, no wind ramp (§6.11)
 *   - resetTrip() only acts in TRIP / TRIPPED (§6.9)
 */
import type { Sim } from '@/physics/sim';
import type { SimInputs } from '@/physics/types';
import type { Store } from '@/state/store';
import { presetFor, WIND_MAX_M_S, type UiState } from '@/state/uiState';
import { clamp } from '@/util/math';

export interface SimBridge {
  readonly inputs: Readonly<SimInputs>;
  /** Jump straight to the steady operating point at V and move the slider there. */
  jumpTo(V: number): void;
  resetTrip(): void;
  /** the angle the sim holds the pitch at, or null on auto */
  lockedPitchDeg(): number | null;
  /** Advance the sim by one frame of real time, honouring pause and time scale. */
  frame(frameDt: number): void;
  dispose(): void;
}

export function createSimBridge(store: Store<UiState>, sim: Sim): SimBridge {
  const s0 = store.get();
  const inputs: SimInputs = {
    windTarget: s0.windTarget,
    gusts: s0.gusts,
    pitchLockDeg: s0.pitchLock ? sim.snapshot().beta : null,
    idealDisk: s0.rotorMode === 'ideal',
  };
  const offs = [
    store.subscribe(
      (s) => s.windTarget,
      (v) => (inputs.windTarget = v),
    ),
    store.subscribe(
      (s) => s.gusts,
      (on) => (inputs.gusts = on),
    ),
    store.subscribe(
      (s) => s.rotorMode,
      (mode) => (inputs.idealDisk = mode === 'ideal'),
    ),
    store.subscribe(
      (s) => s.pitchLock,
      (locked) => (inputs.pitchLockDeg = locked ? sim.snapshot().beta : null),
    ),
  ];

  return {
    inputs,
    jumpTo(V) {
      const v = clamp(V, 0, WIND_MAX_M_S);
      sim.initSteady(v);
      store.set({ windTarget: v, weatherPreset: presetFor(v) });
      // a lock survives the jump but re-freezes at the new steady pitch
      if (inputs.pitchLockDeg !== null) inputs.pitchLockDeg = sim.snapshot().beta;
    },
    resetTrip() {
      const { state } = sim.snapshot();
      if (state === 'TRIP' || state === 'TRIPPED') sim.resetTrip();
    },
    lockedPitchDeg: () => inputs.pitchLockDeg,
    frame(frameDt) {
      const ui = store.get();
      sim.step(ui.paused ? 0 : frameDt * ui.timeScale, inputs);
    },
    dispose() {
      offs.forEach((off) => off());
    },
  };
}
