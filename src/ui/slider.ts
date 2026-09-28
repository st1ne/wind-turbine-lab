/**
 * Range slider (TECH_SPEC §3.4): a real <input type="range"> with aria-valuetext, tick marks
 * with 9 px mono captions under the track, a gradient fill up to the thumb and a mono readout.
 */
import { h, setText } from '@/ui/dom';

export interface SliderTick {
  value: number;
  label: string;
}

export interface SliderOptions {
  label: string;
  min: number;
  max: number;
  step: number;
  /** spoken value, e.g. "11.4 metres per second, Beaufort 6" */
  valueText: (v: number) => string;
  /** visible readout, e.g. "11.4 m/s" */
  readout: (v: number) => string;
  onInput: (v: number) => void;
  ticks?: readonly SliderTick[];
  /** CSS gradient painted across the full track; the fill reveals it up to the thumb */
  fill?: string;
}

export interface Slider {
  el: HTMLElement;
  set(v: number): void;
}

export function createSlider(opts: SliderOptions): Slider {
  const { min, max } = opts;
  const pct = (v: number): number => ((Math.min(Math.max(v, min), max) - min) / (max - min)) * 100;

  const input = h('input', {
    type: 'range',
    class: 'slider-input',
    min,
    max,
    step: opts.step,
    'aria-label': opts.label,
  });
  const fill = h('div', { class: 'slider-fill', 'aria-hidden': 'true' });
  if (opts.fill) fill.style.background = opts.fill;
  const track = h('div', { class: 'slider-track' }, fill, input);

  const ticks = h('div', { class: 'slider-ticks', 'aria-hidden': 'true' });
  for (const t of opts.ticks ?? []) {
    const tick = h('span', { class: 'slider-tick' }, h('i'), h('b', { class: 'mono' }, t.label));
    tick.style.left = `calc(var(--thumb) / 2 + (100% - var(--thumb)) * ${pct(t.value) / 100})`;
    ticks.append(tick);
  }
  const readout = h('output', { class: 'slider-readout mono', 'aria-hidden': 'true' });
  const el = h(
    'div',
    { class: 'slider' },
    h('div', { class: 'slider-body' }, track, ticks),
    readout,
  );

  function paint(v: number): void {
    // the thumb centre travels inset by half its width; keep the fill edge under it
    fill.style.clipPath = `inset(0 calc((100% - var(--thumb)) * ${(100 - pct(v)) / 100} + var(--thumb) / 2) 0 0 round 99px)`;
    setText(readout, opts.readout(v));
    input.setAttribute('aria-valuetext', opts.valueText(v));
  }

  input.addEventListener('input', () => {
    const v = Number(input.value);
    paint(v);
    opts.onInput(v);
  });

  return {
    el,
    set(v) {
      if (Number(input.value) !== v) input.value = String(v);
      paint(v);
    },
  };
}
