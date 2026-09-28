/**
 * Keyboard shortcuts (TECH_SPEC §3.9). Ignored while focus is in a text field; a focused slider
 * keeps its native arrow keys, and Space/Enter are left to a focused button.
 * While the help dialog is open only H / ? (and its own Esc) work.
 */
import type { Store } from '@/state/store';
import {
  CHART_ORDER,
  nextInCycle,
  PRESET_WIND,
  presetFor,
  VIEW_ORDER,
  WIND_MAX_M_S,
  type FollowMode,
  type TimeScale,
  type UiState,
  type WeatherPreset,
} from '@/state/uiState';
import { clamp } from '@/util/math';

export interface HotkeyActions {
  resetTrip(): void;
  toggleTour(): void;
  toggleHelp(): void;
}

const FOLLOW_KEYS: Record<string, FollowMode> = {
  '1': 'all',
  '2': 'wind',
  '3': 'power',
  '4': 'loads',
};
const PRESET_KEYS: Record<string, Exclude<WeatherPreset, null>> = {
  q: 'breeze',
  w: 'rated',
  e: 'gale',
  r: 'storm',
};
const TIME_SCALES: readonly TimeScale[] = [1, 4, 10];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement) return target.type !== 'range';
  return target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

export function installHotkeys(store: Store<UiState>, actions: HotkeyActions): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (isTyping(e.target)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // a focused slider keeps its native arrow keys
    const onRange = e.target instanceof HTMLInputElement && e.target.type === 'range';
    if (onRange && key.startsWith('Arrow')) return;
    const s = store.get();

    if (s.help) {
      if (key === 'h' || key === '?') {
        e.preventDefault();
        actions.toggleHelp();
      }
      return;
    }
    const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
    if ((key === ' ' || key === 'Enter') && onButton) return;

    const follow = FOLLOW_KEYS[key];
    const preset = PRESET_KEYS[key];
    if (follow) {
      store.set({ follow });
    } else if (preset) {
      store.set({ weatherPreset: preset, windTarget: PRESET_WIND[preset] });
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const dir = key === 'ArrowRight' ? 1 : -1;
      if (s.rotorMode === 'ideal') {
        store.set({ wakeB: clamp(s.wakeB + dir * (e.shiftKey ? 0.05 : 0.01), 0, 1) });
      } else {
        const v = clamp(
          Math.round((s.windTarget + dir * (e.shiftKey ? 2 : 0.5)) * 10) / 10,
          0,
          WIND_MAX_M_S,
        );
        store.set({ windTarget: v, weatherPreset: presetFor(v) });
      }
    } else {
      switch (key) {
        case 'b':
          store.set({ rotorMode: s.rotorMode === 'ideal' ? 'real' : 'ideal' });
          break;
        case 'l':
          store.set({ pitchLock: !s.pitchLock });
          break;
        case 'v':
          store.set({ view: nextInCycle(VIEW_ORDER, s.view) });
          break;
        case 'c':
          if (s.rotorMode !== 'ideal') store.set({ chart: nextInCycle(CHART_ORDER, s.chart) });
          break;
        case 'g':
          store.set({ gusts: !s.gusts });
          break;
        case 't':
          store.set({ timeScale: nextInCycle(TIME_SCALES, s.timeScale) });
          break;
        case ' ':
          store.set({ paused: !s.paused });
          break;
        case 'Enter':
          actions.toggleTour();
          break;
        case 'x':
          actions.resetTrip();
          break;
        case 'm':
          store.set({ sound: !s.sound });
          break;
        case 'h':
        case '?':
          actions.toggleHelp();
          break;
        default:
          return;
      }
    }
    e.preventDefault();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
