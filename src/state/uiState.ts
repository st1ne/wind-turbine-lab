/**
 * UI state shape and defaults (TECH_SPEC §14.3).
 */

export type FollowMode = 'all' | 'wind' | 'power' | 'loads';
export type ViewMode = 'whole' | 'cutaway' | 'exploded';
export type RotorMode = 'real' | 'ideal';
export type WeatherPreset = 'breeze' | 'rated' | 'gale' | 'storm' | null;
export type TimeScale = 1 | 4 | 10;
export type ChartTab = 'power' | 'cpTsr' | 'alongBlade' | 'betz';
export type CameraChip = 'rotor' | 'nacelle' | 'tower' | 'blade' | null;

export interface UiState {
  follow: FollowMode;
  view: ViewMode;
  rotorMode: RotorMode;
  /** true = pitch frozen at the angle it had when locked */
  pitchLock: boolean;
  weatherPreset: WeatherPreset;
  /** wind slider value, m/s */
  windTarget: number;
  /** ideal-disk wake speed ratio b = V_wake / V */
  wakeB: number;
  timeScale: TimeScale;
  gusts: boolean;
  chart: ChartTab;
  sound: boolean;
  /** master volume 0–1 (applies while sound is on) */
  volume: number;
  /** -1 = tour not running */
  tourStep: number;
  paused: boolean;
  camChip: CameraChip;
  help: boolean;
}

export const PRESET_WIND: Record<Exclude<WeatherPreset, null>, number> = {
  breeze: 8,
  rated: 11.4,
  gale: 20,
  storm: 30,
};

/** Wind slider range, m/s (§3.4). */
export const WIND_MAX_M_S = 35;

/** The preset whose wind matches v (to keep the Weather pill in sync with the slider). */
export function presetFor(v: number): WeatherPreset {
  for (const [name, wind] of Object.entries(PRESET_WIND) as [
    Exclude<WeatherPreset, null>,
    number,
  ][]) {
    if (Math.abs(v - wind) < 0.05) return name;
  }
  return null;
}

export const VIEW_ORDER: readonly ViewMode[] = ['whole', 'cutaway', 'exploded'];
/** Chart tabs cycled by C; 'betz' is forced in Ideal-disk mode instead (§3.6). */
export const CHART_ORDER: readonly ChartTab[] = ['power', 'cpTsr', 'alongBlade'];

export function nextInCycle<T>(order: readonly T[], current: T): T {
  const i = order.indexOf(current);
  return order[(i + 1) % order.length] ?? current;
}

export function defaultUiState(): UiState {
  return {
    follow: 'all',
    view: 'whole',
    rotorMode: 'real',
    pitchLock: false,
    weatherPreset: 'breeze',
    windTarget: PRESET_WIND.breeze,
    wakeB: 1,
    timeScale: 1,
    gusts: false,
    chart: 'power',
    sound: false,
    volume: 0.7,
    tourStep: -1,
    paused: false,
    camChip: null,
    help: false,
  };
}
