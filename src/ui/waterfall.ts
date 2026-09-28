/**
 * Loss waterfall row (TECH_SPEC §3.6, §10): Betz 59.3 → swirl → blade shape/root → tip & hub
 * loss → drag → generator, as a share of the wind power. Every number comes from
 * physics/losses.ts (Glauert and BEM variants at λ_opt). Shown in Ideal-disk mode and for 6 s
 * after leaving it.
 */
import { fixed } from '@/physics/format';
import { lossWaterfall } from '@/physics/losses';
import { h } from '@/ui/dom';

export const WATERFALL_LINGER_S = 6;

export interface Waterfall {
  el: HTMLElement;
  setVisible(visible: boolean): void;
}

export function createWaterfall(): Waterfall {
  const steps = lossWaterfall();
  const row = h('ol', { class: 'waterfall-row' });
  steps.forEach((s, i) => {
    const item = h(
      'li',
      { class: `wf-step wf-${s.key}` },
      h('span', { class: 'wf-label' }, s.label),
      h('b', { class: 'mono' }, fixed(s.cp * 100, 1)),
    );
    if (s.key === 'generator') item.append(h('span', { class: 'wf-note' }, '(electric)'));
    row.append(item);
    if (i < steps.length - 1)
      row.append(h('li', { class: 'wf-arrow', 'aria-hidden': 'true' }, '→'));
  });
  const el = h(
    'section',
    { class: 'waterfall glass', 'aria-label': 'Where the Betz limit goes', hidden: true },
    h(
      'header',
      { class: 'panel-head' },
      h('span', { class: 'overline' }, 'Where the 59 % goes'),
      h('span', { class: 'key-hint mono' }, '% of wind power'),
    ),
    row,
  );
  let visible = false;
  return {
    el,
    setVisible(v) {
      if (v === visible) return;
      visible = v;
      el.hidden = !v;
      if (v) {
        el.classList.remove('fade-in');
        void el.offsetWidth;
        el.classList.add('fade-in');
      }
    },
  };
}
