/**
 * Top-right control panel (TECH_SPEC §3.4, §10):
 *   Follow · Weather presets + Wind slider (or the Wake speed b slider in Ideal-disk mode) ·
 *   Rotor / Pitch / View · icon row (tour, time scale, gusts, sound, help) · Reset pill on TRIP.
 * Every control writes to the store; the panel mirrors the store, never the other way round.
 */
import { V_CUT_IN, V_CUT_OUT } from '@/config/turbine';
import { fixed, fmtMs } from '@/physics/format';
import type { SimSnapshot } from '@/physics/types';
import { beaufort } from '@/physics/wind';
import type { Store } from '@/state/store';
import {
  nextInCycle,
  PRESET_WIND,
  presetFor,
  WIND_MAX_M_S,
  type FollowMode,
  type RotorMode,
  type TimeScale,
  type UiState,
  type ViewMode,
  type WeatherPreset,
} from '@/state/uiState';
import { h, icon, keyHint, setText } from '@/ui/dom';
import { createSegmented } from '@/ui/segmented';
import { createSlider } from '@/ui/slider';

export interface PanelActions {
  resetTrip(): void;
  toggleTour(): void;
  toggleHelp(): void;
}

export interface ControlPanel {
  el: HTMLElement;
  update(s: SimSnapshot): void;
}

const ICONS = {
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.3 1.4M9.5 3h5"/>',
  gusts: '<path d="M3 8.5h10.5a2.5 2.5 0 1 0-2.5-2.5M3 12.5h15a2.5 2.5 0 1 1-2.5 2.5M3 16.5h7"/>',
  soundOn:
    '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.9" r=".6" fill="currentColor"/>',
} as const;

const TIME_SCALES: readonly TimeScale[] = [1, 4, 10];

/** Track position (%) of a wind speed, for the fill gradient stops. */
const at = (v: number): string => `${fixed((v / WIND_MAX_M_S) * 100, 2)}%`;

function row(label: string, keys: string, ...content: HTMLElement[]): HTMLElement {
  return h(
    'div',
    { class: 'panel-row' },
    h('div', { class: 'panel-head' }, h('span', { class: 'overline' }, label), keyHint(keys)),
    ...content,
  );
}

function iconButton(label: string, svg: string, key: string): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': label, title: `${label} (${key})` },
    icon(svg),
  );
}

export function createControlPanel(store: Store<UiState>, actions: PanelActions): ControlPanel {
  const set = (p: Partial<UiState>): void => store.set(p);

  // Row 1: Follow
  const follow = createSegmented<FollowMode>(
    [
      { value: 'all', label: 'All' },
      { value: 'wind', label: 'Wind' },
      { value: 'power', label: 'Power' },
      { value: 'loads', label: 'Loads' },
    ],
    (v) => set({ follow: v }),
    'Follow',
  );

  // Row 2: Weather presets + wind / wake slider
  const presets = createSegmented<Exclude<WeatherPreset, null>>(
    [
      { value: 'breeze', label: 'Breeze' },
      { value: 'rated', label: 'Rated' },
      { value: 'gale', label: 'Gale' },
      { value: 'storm', label: 'Storm' },
    ],
    (v) => set({ weatherPreset: v, windTarget: PRESET_WIND[v] }),
    'Weather preset',
  );
  const wind = createSlider({
    label: 'Wind speed',
    min: 0,
    max: WIND_MAX_M_S,
    step: 0.1,
    readout: (v) => fmtMs(v),
    valueText: (v) => `${fixed(v, 1)} metres per second, Beaufort ${beaufort(v).force}`,
    onInput: (v) => set({ windTarget: v, weatherPreset: presetFor(v) }),
    ticks: [
      { value: V_CUT_IN, label: 'in' },
      { value: PRESET_WIND.rated, label: 'rated' },
      { value: V_CUT_OUT, label: 'out' },
    ],
    fill:
      `linear-gradient(90deg, var(--wind) 0%, var(--wind) calc(${at(PRESET_WIND.rated)} - 1%), ` +
      `var(--power) calc(${at(PRESET_WIND.rated)} + 1%), var(--power) calc(${at(V_CUT_OUT)} - 1%), ` +
      `var(--alarm) calc(${at(V_CUT_OUT)} + 1%), var(--alarm) 100%)`,
  });
  const wake = createSlider({
    label: 'Wake speed b',
    min: 0,
    max: 1,
    step: 0.005,
    readout: (v) => `b = ${fixed(v, 2)} V`,
    valueText: (v) => `wake at ${fixed(v * 100, 0)} percent of the wind speed`,
    onInput: (v) => set({ wakeB: v }),
    ticks: [{ value: 1 / 3, label: 'Betz' }],
    fill: 'linear-gradient(90deg, var(--ideal), #c4b5fd)',
  });
  const windLabel = h('span', { class: 'overline' }, 'Wind');
  const windKeys = keyHint('← →');
  const sliderSlot = h('div', { class: 'slider-slot' }, wind.el);
  const windRow = h(
    'div',
    { class: 'panel-row' },
    h('div', { class: 'panel-head' }, windLabel, windKeys),
    sliderSlot,
  );

  // Row 3: Rotor · Pitch · View
  const rotor = createSegmented<RotorMode>(
    [
      { value: 'real', label: 'Real' },
      { value: 'ideal', label: 'Ideal disk' },
    ],
    (v) => set({ rotorMode: v }),
    'Rotor',
  );
  const pitch = createSegmented<'auto' | 'locked'>(
    [
      { value: 'auto', label: 'Auto' },
      { value: 'locked', label: 'Locked' },
    ],
    (v) => set({ pitchLock: v === 'locked' }),
    'Pitch control',
  );
  const lockTag = h(
    'span',
    { class: 'warn-tag', hidden: true, title: 'What-if: pitch frozen' },
    '⚠',
  );
  const view = createSegmented<ViewMode>(
    [
      { value: 'whole', label: 'Whole' },
      { value: 'cutaway', label: 'Cutaway' },
      { value: 'exploded', label: 'Exploded' },
    ],
    (v) => set({ view: v }),
    'View',
  );
  const trio = h(
    'div',
    { class: 'panel-trio' },
    row('Rotor', 'B', rotor.el),
    h(
      'div',
      { class: 'panel-row' },
      h(
        'div',
        { class: 'panel-head' },
        h('span', { class: 'overline' }, 'Pitch'),
        lockTag,
        keyHint('L'),
      ),
      pitch.el,
    ),
    row('View', 'V', view.el),
  );

  // Row 4: icon buttons
  const tourBtn = iconButton('Guided tour', ICONS.play, 'Enter');
  const timeBtn = iconButton('Time scale', ICONS.timer, 'T');
  const timeText = h('span', { class: 'mono icon-text' }, '×1');
  timeBtn.append(timeText);
  timeBtn.classList.add('wide');
  const gustBtn = iconButton('Gusts', ICONS.gusts, 'G');
  const soundBtn = iconButton('Sound', ICONS.soundOff, 'M');
  const volume = h('input', {
    type: 'range',
    class: 'volume',
    min: 0,
    max: 1,
    step: 0.05,
    'aria-label': 'Volume',
    title: 'Volume',
  });
  // moving the volume up while muted turns the sound on (a user gesture, so audio may start)
  volume.addEventListener('input', () => {
    const v = Number(volume.value);
    set(v > 0 && !store.get().sound ? { volume: v, sound: true } : { volume: v });
  });
  const soundGroup = h('div', { class: 'sound-group' }, soundBtn, volume);
  const helpBtn = iconButton('Help', ICONS.help, 'H');
  const pausedTag = h('span', { class: 'paused-tag mono', hidden: true }, 'paused · space');
  const resetBtn = h(
    'button',
    { type: 'button', class: 'reset-pill', hidden: true, title: 'Reset after trip (X)' },
    'Reset',
    keyHint('X'),
  );
  const icons = h(
    'div',
    { class: 'panel-icons' },
    tourBtn,
    timeBtn,
    gustBtn,
    soundGroup,
    helpBtn,
    pausedTag,
    resetBtn,
  );

  tourBtn.addEventListener('click', actions.toggleTour);
  timeBtn.addEventListener('click', () =>
    set({ timeScale: nextInCycle(TIME_SCALES, store.get().timeScale) }),
  );
  gustBtn.addEventListener('click', () => set({ gusts: !store.get().gusts }));
  soundBtn.addEventListener('click', () => set({ sound: !store.get().sound }));
  helpBtn.addEventListener('click', actions.toggleHelp);
  resetBtn.addEventListener('click', actions.resetTrip);

  const el = h(
    'section',
    { class: 'control-panel glass', 'aria-label': 'Controls' },
    row('Follow', '1 2 3 4', follow.el),
    row('Weather', 'Q W E R', presets.el),
    windRow,
    trio,
    icons,
  );

  // mirror the store
  const sync = (s: Readonly<UiState>): void => {
    follow.set(s.follow);
    presets.set(s.weatherPreset);
    wind.set(s.windTarget);
    wake.set(s.wakeB);
    rotor.set(s.rotorMode);
    pitch.set(s.pitchLock ? 'locked' : 'auto');
    lockTag.hidden = !s.pitchLock;
    view.set(s.view);
    setText(timeText, `×${s.timeScale}`);
    timeBtn.setAttribute('aria-label', `Time scale ×${s.timeScale}`);
    gustBtn.setAttribute('aria-pressed', String(s.gusts));
    soundBtn.setAttribute('aria-pressed', String(s.sound));
    if (Number(volume.value) !== s.volume) volume.value = String(s.volume);
    volume.setAttribute('aria-valuetext', `${Math.round(s.volume * 100)} percent`);
    volume.style.setProperty('--vol', `${s.volume * 100}%`);
    soundGroup.classList.toggle('muted', !s.sound);
    soundBtn.replaceChild(
      icon(s.sound ? ICONS.soundOn : ICONS.soundOff),
      soundBtn.firstChild as Node,
    );
    const touring = s.tourStep >= 0;
    tourBtn.setAttribute('aria-pressed', String(touring));
    tourBtn.replaceChild(icon(touring ? ICONS.stop : ICONS.play), tourBtn.firstChild as Node);
    helpBtn.setAttribute('aria-pressed', String(s.help));
    pausedTag.hidden = !s.paused;

    const ideal = s.rotorMode === 'ideal';
    const slider = ideal ? wake.el : wind.el;
    if (sliderSlot.firstChild !== slider) {
      sliderSlot.replaceChildren(slider);
      sliderSlot.classList.remove('swap');
      void sliderSlot.offsetWidth;
      sliderSlot.classList.add('swap');
    }
    setText(windLabel, ideal ? 'Wake speed b' : 'Wind');
    windKeys.hidden = ideal;
  };
  sync(store.get());
  store.subscribe((s) => s, sync);

  let tripped = false;
  return {
    el,
    update(s) {
      const trip = s.state === 'TRIP' || s.state === 'TRIPPED';
      if (trip !== tripped) {
        tripped = trip;
        resetBtn.hidden = !trip;
      }
    },
  };
}
