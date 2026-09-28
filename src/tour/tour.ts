/**
 * Guided tour runner (TECH_SPEC §12): plays TOUR_STEPS at time scale ×4 with a caption bar
 * above the camera chips (step title, sentence, progress dots). Any user input (a control, a
 * hotkey, orbiting the camera) pauses it and shows a Resume pill; Enter or × stops it. The
 * tour's own store writes are marked so they don't count as input. Steps run in real time.
 */
import type { CameraPreset } from '@/scene/cameraRig';
import type { SimBridge } from '@/state/simBridge';
import type { Store } from '@/state/store';
import { presetFor, type TimeScale, type UiState } from '@/state/uiState';
import { TOUR_STEPS, TOUR_TIME_SCALE, type TourStep } from '@/tour/steps';
import { h } from '@/ui/dom';

export interface TourDeps {
  readonly store: Store<UiState>;
  readonly bridge: SimBridge;
  flyTo(preset: CameraPreset): void;
  /** register a callback for camera input (orbit, zoom, pan) */
  onCameraInput(cb: () => void): void;
  readonly host: HTMLElement;
  readonly steps?: readonly TourStep[];
}

export interface Tour {
  readonly running: boolean;
  readonly paused: boolean;
  readonly step: number;
  start(): void;
  stop(): void;
  toggle(): void;
  resume(): void;
  update(dt: number): void;
}

export function createTour(deps: TourDeps): Tour {
  const { store, bridge } = deps;
  const steps = deps.steps ?? TOUR_STEPS;

  const count = h('span', { class: 'tour-count mono' });
  const title = h('b', { class: 'tour-title' });
  const caption = h('p', { class: 'tour-caption', 'aria-live': 'polite' });
  const dots = h('div', { class: 'tour-dots', 'aria-hidden': 'true' });
  const dotEls = steps.map(() => {
    const d = h('i', {}, h('span'));
    dots.append(d);
    return d;
  });
  const resumeBtn = h('button', { type: 'button', class: 'tour-resume', hidden: true }, 'Resume');
  const closeBtn = h(
    'button',
    { type: 'button', class: 'icon-btn tour-close', 'aria-label': 'Stop the tour' },
    '×',
  );
  const bar = h(
    'section',
    { class: 'tour-bar glass', hidden: true, 'aria-label': 'Guided tour' },
    h('div', { class: 'tour-text' }, h('div', { class: 'tour-head' }, count, title), caption),
    h('div', { class: 'tour-side' }, dots, resumeBtn, closeBtn),
  );
  deps.host.append(bar);

  let running = false;
  let paused = false;
  let index = -1;
  let t = 0;
  let applying = false;
  let timeScaleBefore: TimeScale = 1;

  const apply = (patch: Partial<UiState>): void => {
    applying = true;
    try {
      store.set(patch);
    } finally {
      applying = false;
    }
  };

  function show(i: number): void {
    const step = steps[i] as TourStep;
    count.textContent = `${i + 1} / ${steps.length}`;
    title.textContent = step.title;
    caption.textContent = step.caption;
    dotEls.forEach((d, k) => {
      d.classList.toggle('done', k < i);
      d.classList.toggle('on', k === i);
    });
  }

  function enter(i: number): void {
    const step = steps[i] as TourStep;
    index = i;
    t = 0;
    applying = true;
    try {
      deps.flyTo(step.camera);
      store.set({
        ...step.state,
        tourStep: i,
        timeScale: TOUR_TIME_SCALE,
        paused: false,
        camChip: null,
      });
      if (step.jump !== undefined) bridge.jumpTo(step.jump);
      else if (step.wind !== undefined) {
        store.set({ windTarget: step.wind, weatherPreset: presetFor(step.wind) });
      }
    } finally {
      applying = false;
    }
    show(i);
  }

  function setPaused(p: boolean): void {
    paused = p;
    resumeBtn.hidden = !p;
    bar.classList.toggle('paused', p);
  }

  const onInput = (): void => {
    if (running && !paused && !applying) setPaused(true);
  };
  store.subscribe((s) => s, onInput);
  deps.onCameraInput(onInput);

  const api: Tour = {
    get running() {
      return running;
    },
    get paused() {
      return paused;
    },
    get step() {
      return index;
    },
    start() {
      if (running) return;
      running = true;
      timeScaleBefore = store.get().timeScale;
      bar.hidden = false;
      setPaused(false);
      enter(0);
    },
    stop() {
      if (!running) return;
      running = false;
      index = -1;
      setPaused(false);
      bar.hidden = true;
      apply({ tourStep: -1, timeScale: timeScaleBefore });
    },
    toggle() {
      if (running) api.stop();
      else api.start();
    },
    resume() {
      if (!running || !paused) return;
      setPaused(false);
      // pick the step back up where it was, camera included
      deps.flyTo((steps[index] as TourStep).camera);
    },
    update(dt) {
      if (!running || paused) return;
      t += dt;
      const step = steps[index] as TourStep;
      const k = Math.min(t / step.durationS, 1);
      if (step.animate) apply(step.animate(k));
      const fill = dotEls[index]?.firstElementChild as HTMLElement | null;
      if (fill) fill.style.transform = `scaleX(${k})`;
      if (t < step.durationS) return;
      if (index + 1 < steps.length) enter(index + 1);
      else api.stop();
    },
  };
  resumeBtn.addEventListener('click', () => api.resume());
  closeBtn.addEventListener('click', () => api.stop());
  return api;
}
