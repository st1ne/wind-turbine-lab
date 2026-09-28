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
    tourStep: -1,
    paused: false,
    camChip: null,
    help: false,
  };
}
