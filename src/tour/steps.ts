/**
 * Guided tour (TECH_SPEC §12): six steps of 7–10 s at time scale ×4, ≈ 50 s in all.
 *
 * | # | Camera  | State                                   | Caption |
 * | 1 | Rotor   | 6 m/s, Follow Wind                      | The rotor slows the wind. … |
 * | 2 | Rotor   | Ideal disk, b 1 → 0 → 1/3               | How much should it slow the wind? … |
 * | 3 | Nacelle | Real, 11.4 m/s, Cutaway, Follow Power   | At 11.4 m/s it makes its full 5 MW. |
 * | 4 | Blade   | 18 m/s, chart Along the blade           | More wind? Twist the blades … |
 * | 5 | Wide    | Storm 30, Follow Loads                  | Storm: blades edge-on, brake on … |
 * | 6 | Wide    | 9 m/s                                   | Back to work. Now it's your turn. |
 *
 * `jump` starts the step at the steady operating point (§6.11); `wind` lets the mean wind ramp
 * (so the storm visibly builds). `animate(k)` runs every frame with the step's progress 0–1.
 */
import type { CameraPreset } from '@/scene/cameraRig';
import { PRESET_WIND, type UiState } from '@/state/uiState';
import { easeInOutCubic } from '@/util/easing';

export const TOUR_TIME_SCALE = 4;

export interface TourStep {
  readonly title: string;
  readonly caption: string;
  readonly camera: CameraPreset;
  readonly durationS: number;
  readonly state: Partial<UiState>;
  /** jump to the steady point at this wind, m/s */
  readonly jump?: number;
  /** ramp the mean wind to this target, m/s */
  readonly wind?: number;
  animate?(k: number): Partial<UiState>;
}

const BASE: Partial<UiState> = {
  follow: 'all',
  view: 'whole',
  rotorMode: 'real',
  wakeB: 1,
  pitchLock: false,
  gusts: false,
  chart: 'power',
};

/** b(k): 1 → 0 over the first 40 %, 0 → 1/3 until 75 %, then hold at the Betz optimum. */
export function betzSweep(k: number): number {
  if (k < 0.4) return 1 - easeInOutCubic(k / 0.4);
  if (k < 0.75) return (1 / 3) * easeInOutCubic((k - 0.4) / 0.35);
  return 1 / 3;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'The rotor slows the wind',
    caption: 'The rotor slows the wind. Watch the smoke spread.',
    camera: 'rotor',
    durationS: 8,
    jump: 6,
    state: { ...BASE, follow: 'wind' },
  },
  {
    title: 'The Betz limit',
    caption: 'How much should it slow the wind? Exactly to a third.',
    camera: 'rotor',
    durationS: 10,
    state: { ...BASE, follow: 'wind', rotorMode: 'ideal', wakeB: 1 },
    animate: (k) => ({ wakeB: Math.round(betzSweep(k) * 1000) / 1000 }),
  },
  {
    title: 'Full power',
    caption: 'At 11.4 m/s it makes its full 5 MW.',
    camera: 'nacelle',
    durationS: 8,
    jump: PRESET_WIND.rated,
    state: { ...BASE, view: 'cutaway', follow: 'power' },
  },
  {
    title: 'Pitch control',
    caption: 'More wind? Twist the blades and let it pass.',
    camera: 'blade',
    durationS: 8,
    jump: 18,
    state: { ...BASE, chart: 'alongBlade' },
  },
  {
    title: 'Storm',
    caption: 'Storm: blades edge-on, brake on, thrust nearly gone.',
    camera: 'wide',
    durationS: 10,
    wind: PRESET_WIND.storm,
    state: { ...BASE, follow: 'loads' },
  },
  {
    title: 'Your turn',
    caption: "Back to work. Now it's your turn.",
    camera: 'wide',
    durationS: 7,
    jump: 9,
    state: { ...BASE },
  },
];

export function tourDurationS(steps: readonly TourStep[] = TOUR_STEPS): number {
  return steps.reduce((s, st) => s + st.durationS, 0);
}
