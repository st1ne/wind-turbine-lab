/**
 * Shared per-frame flow state for the wind visuals (TECH_SPEC §6.5, §9, §10): the axial
 * induction the smoke should show, where the rotor is, how far the air has travelled, and how
 * much each Follow mode wants the wind visuals.
 *
 *   a        real rotor: a(Ct) from the snapshot; Ideal disk: a = (1 − b)/2 (§10)
 *   aVisual  clamped to 0.45: beyond it momentum theory breaks down (turbulent wake state)
 *   flowS    ∫ V dt in full-scale metres (sim time, so pause and time scale apply); a smoke
 *            parcel keeps τ(x)·V − flowS constant, which is what scrolls the dashes
 */
import { Vector3 } from 'three';
import { OMEGA_RATED_RAD, RADIUS_M } from '@/config/turbine';
import { A_VISUAL_MAX, inductionFromB } from '@/physics/actuatorDisk';
import type { SimSnapshot } from '@/physics/types';
import type { Turbine } from '@/scene/turbine/turbine';
import { toModel } from '@/scene/units';
import type { UiState } from '@/state/uiState';
import { approach, clamp } from '@/util/math';

/** Follow-mode transitions (§9: 400 ms) as an exponential time constant. */
export const FOCUS_TAU_S = 0.13;

export interface Flow {
  /** induction used by the smoke (clamped) and the raw value */
  readonly aVisual: number;
  readonly a: number;
  /** wind speed, m/s */
  readonly V: number;
  readonly flowS: number;
  readonly t: number;
  readonly omega: number;
  readonly psi: number;
  /** rotor centre (hub) in world space */
  readonly center: Vector3;
  /** rotor radius in world units */
  readonly radius: number;
  /** eased 0–1 weights: Follow = Wind, and "anything but Power/Loads" */
  readonly windFocus: number;
  readonly ideal: number;
  /** downstream turbulence amplitude in rotor radii (gusts, storm, turbulent wake) */
  readonly turbulence: number;
  update(s: SimSnapshot, ui: Readonly<UiState>, dt: number): void;
}

export function createFlow(turbine: Turbine): Flow {
  const center = new Vector3();
  let lastT: number | null = null;
  const state = {
    a: 0,
    aVisual: 0,
    V: 0,
    flowS: 0,
    t: 0,
    omega: 0,
    psi: 0,
    windFocus: 0,
    ideal: 0,
    turbulence: 0,
  };
  return {
    get a() {
      return state.a;
    },
    get aVisual() {
      return state.aVisual;
    },
    get V() {
      return state.V;
    },
    get flowS() {
      return state.flowS;
    },
    get t() {
      return state.t;
    },
    get omega() {
      return state.omega;
    },
    get psi() {
      return state.psi;
    },
    get windFocus() {
      return state.windFocus;
    },
    get ideal() {
      return state.ideal;
    },
    get turbulence() {
      return state.turbulence;
    },
    center,
    radius: toModel(RADIUS_M),
    update(s, ui, dt) {
      const ideal = ui.rotorMode === 'ideal';
      state.a = ideal ? inductionFromB(ui.wakeB) : s.a;
      state.aVisual = clamp(state.a, 0, A_VISUAL_MAX);
      state.V = s.V;
      if (lastT !== null && s.t >= lastT) state.flowS += s.V * (s.t - lastT);
      lastT = s.t;
      state.t = s.t;
      state.omega = s.omega;
      state.psi = s.psi;
      state.windFocus = approach(state.windFocus, ui.follow === 'wind' ? 1 : 0, dt, FOCUS_TAU_S);
      state.ideal = approach(state.ideal, ideal ? 1 : 0, dt, FOCUS_TAU_S);
      const turbulentWake = Math.max(state.a - 0.4, 0) * 0.8;
      state.turbulence = (ui.gusts ? 0.03 : 0) + 0.05 * s.stormLevel + turbulentWake;
      turbine.rotor.object3d.getWorldPosition(center);
    },
  };
}

/** Rotor speed as a 0–1 visibility factor for the tip vortices. */
export function spinFactor(omega: number): number {
  return clamp((omega / OMEGA_RATED_RAD) * 1.5, 0, 1);
}
