/**
 * URL state (TECH_SPEC §17, §13): query params `v` (wind), `view`, `follow`, `mode` (real|ideal),
 * `b`, `lock`, `t` (time scale), `gusts`, `cam` (camera chip), `sound` and `vol` (0–1). Read on load; written with
 * history.replaceState, debounced 500 ms. Only values that differ from the defaults are
 * written, so a fresh visit has a clean URL. Anything malformed is ignored.
 */
import type { Store } from '@/state/store';
import {
  defaultUiState,
  presetFor,
  WIND_MAX_M_S,
  type CameraChip,
  type FollowMode,
  type TimeScale,
  type UiState,
  type ViewMode,
} from '@/state/uiState';

export const URL_DEBOUNCE_MS = 500;

const VIEWS: readonly ViewMode[] = ['whole', 'cutaway', 'exploded'];
const FOLLOWS: readonly FollowMode[] = ['all', 'wind', 'power', 'loads'];
const CHIPS: readonly Exclude<CameraChip, null>[] = ['rotor', 'nacelle', 'tower', 'blade'];
const SCALES: readonly TimeScale[] = [1, 4, 10];

export type UrlState = Partial<
  Pick<
    UiState,
    | 'windTarget'
    | 'view'
    | 'follow'
    | 'rotorMode'
    | 'wakeB'
    | 'pitchLock'
    | 'timeScale'
    | 'gusts'
    | 'camChip'
    | 'sound'
    | 'volume'
  >
>;

function num(v: string | null, min: number, max: number): number | undefined {
  if (v === null || v.trim() === '') return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(Math.max(x, min), max) : undefined;
}

function pick<T extends string | number>(v: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => String(a) === v);
}

function flag(v: string | null): boolean | undefined {
  if (v === '1' || v === 'true') return true;
  if (v === '0' || v === 'false') return false;
  return undefined;
}

/** Parse a query string into the UI fields it sets (unknown or invalid values dropped). */
export function readUrlState(search: string): UrlState {
  const q = new URLSearchParams(search);
  const out: UrlState = {};
  const v = num(q.get('v'), 0, WIND_MAX_M_S);
  if (v !== undefined) out.windTarget = Math.round(v * 10) / 10;
  const view = pick(q.get('view'), VIEWS);
  if (view) out.view = view;
  const follow = pick(q.get('follow'), FOLLOWS);
  if (follow) out.follow = follow;
  const mode = pick(q.get('mode'), ['real', 'ideal'] as const);
  if (mode) out.rotorMode = mode;
  const b = num(q.get('b'), 0, 1);
  if (b !== undefined) out.wakeB = b;
  const lock = flag(q.get('lock'));
  if (lock !== undefined) out.pitchLock = lock;
  const t = pick(q.get('t'), SCALES);
  if (t !== undefined) out.timeScale = t;
  const gusts = flag(q.get('gusts'));
  if (gusts !== undefined) out.gusts = gusts;
  const cam = pick(q.get('cam'), CHIPS);
  if (cam) out.camChip = cam;
  const sound = flag(q.get('sound'));
  if (sound !== undefined) out.sound = sound;
  const vol = num(q.get('vol'), 0, 1);
  if (vol !== undefined) out.volume = Math.round(vol * 100) / 100;
  return out;
}

/** Query string (with leading "?", or "" when everything is default) for a UI state. */
export function writeUrlState(ui: Readonly<UiState>): string {
  const d = defaultUiState();
  const q = new URLSearchParams();
  if (ui.windTarget !== d.windTarget) q.set('v', String(Math.round(ui.windTarget * 10) / 10));
  if (ui.view !== d.view) q.set('view', ui.view);
  if (ui.follow !== d.follow) q.set('follow', ui.follow);
  if (ui.rotorMode !== d.rotorMode) q.set('mode', ui.rotorMode);
  if (ui.rotorMode === 'ideal' || ui.wakeB !== d.wakeB) {
    q.set('b', String(Math.round(ui.wakeB * 1000) / 1000));
  }
  if (ui.pitchLock) q.set('lock', '1');
  if (ui.timeScale !== d.timeScale) q.set('t', String(ui.timeScale));
  if (ui.gusts) q.set('gusts', '1');
  if (ui.camChip) q.set('cam', ui.camChip);
  if (ui.sound) q.set('sound', '1');
  if (ui.volume !== d.volume) q.set('vol', String(Math.round(ui.volume * 100) / 100));
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Store fields for a parsed URL (keeps the Weather pill in sync with `v`). */
export function urlToUiPatch(url: UrlState): Partial<UiState> {
  const patch: Partial<UiState> = { ...url };
  if (url.windTarget !== undefined) patch.weatherPreset = presetFor(url.windTarget);
  return patch;
}

export interface UrlSync {
  /** write the URL now (before sharing) and return it */
  flush(): string;
  dispose(): void;
}

/** Keep the address bar in sync with the store (debounced replaceState). */
export function installUrlSync(store: Store<UiState>): UrlSync {
  let timer = 0;
  const write = (): string => {
    window.clearTimeout(timer);
    timer = 0;
    const search = writeUrlState(store.get());
    const url = `${location.pathname}${search}${location.hash}`;
    if (url !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(history.state, '', url);
    }
    return location.href;
  };
  const off = store.subscribe(
    (s) => writeUrlState(s),
    () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(write, URL_DEBOUNCE_MS);
    },
  );
  return {
    flush: write,
    dispose() {
      off();
      window.clearTimeout(timer);
    },
  };
}
