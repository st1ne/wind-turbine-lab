/**
 * Chart card (TECH_SPEC §3.6): tabs Power curve · Cp–λ · Along the blade (C cycles), and the
 * Betz tab that Ideal-disk mode forces. A DPR-aware canvas redrawn at up to 30 Hz (§14.4);
 * the canvas's aria-label summarises the current chart about once a second.
 */
import type { SimSnapshot } from '@/physics/types';
import type { Store } from '@/state/store';
import type { ChartTab, UiState } from '@/state/uiState';
import { createAlongBlade } from '@/ui/charts/alongBlade';
import { createBetzCurve } from '@/ui/charts/betzCurve';
import { createChartCanvas } from '@/ui/charts/chartBase';
import { createCpTsr } from '@/ui/charts/cpTsr';
import { createPowerCurve } from '@/ui/charts/powerCurve';
import type { ChartView } from '@/ui/charts/types';
import { h, keyHint } from '@/ui/dom';
import { createThrottle, RATE_HZ } from '@/util/throttle';

export const CHART_SIZE = { width: 334, height: 150 } as const;

const TABS: readonly { id: ChartTab; label: string }[] = [
  { id: 'power', label: 'Power curve' },
  { id: 'cpTsr', label: 'Cp–λ' },
  { id: 'alongBlade', label: 'Along the blade' },
  { id: 'betz', label: 'Betz' },
];

export interface ChartCard {
  el: HTMLElement;
  update(s: SimSnapshot, ui: Readonly<UiState>, dt: number, nowS: number): void;
  resize(dpr: number): void;
}

export function createChartCard(store: Store<UiState>): ChartCard {
  const views: Record<ChartTab, ChartView> = {
    power: createPowerCurve(),
    cpTsr: createCpTsr(),
    alongBlade: createAlongBlade(),
    betz: createBetzCurve(),
  };
  const tabs = h('div', { class: 'chart-tabs', role: 'tablist', 'aria-label': 'Chart' });
  const buttons = TABS.map((t) => {
    const b = h(
      'button',
      { type: 'button', class: 'chart-tab', role: 'tab', 'aria-selected': 'false' },
      t.label,
    );
    b.addEventListener('click', () => store.set({ chart: t.id }));
    tabs.append(b);
    return b;
  });
  const canvas = h('canvas', { class: 'chart-canvas', role: 'img' });
  // 900–1279 px (§16): the card collapses to this button until opened
  const toggle = h(
    'button',
    { type: 'button', class: 'chart-toggle', 'aria-expanded': 'false' },
    'Chart',
  );
  const el = h(
    'section',
    { class: 'chart-card glass', 'aria-label': 'Chart' },
    h('header', { class: 'panel-head' }, toggle, tabs, keyHint('C')),
    canvas,
  );
  toggle.addEventListener('click', () => {
    const open = !el.classList.contains('open');
    el.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    chart.resize(fitWidth(), CHART_SIZE.height, Math.min(window.devicePixelRatio || 1, 2));
    redraw.force();
  });
  const chart = createChartCanvas(canvas);
  /** the canvas follows the card's inner width (narrow columns, the phone sheet) */
  const fitWidth = (): number => {
    const inner = el.clientWidth - 24;
    return inner > 120 ? Math.min(inner, CHART_SIZE.width + 60) : CHART_SIZE.width;
  };
  chart.resize(CHART_SIZE.width, CHART_SIZE.height, Math.min(window.devicePixelRatio || 1, 2));

  const redraw = createThrottle(RATE_HZ.charts);
  const describe = createThrottle(1);
  let lastTab: ChartTab | null = null;
  let lastIdeal: boolean | null = null;

  return {
    el,
    resize(dpr) {
      chart.resize(fitWidth(), CHART_SIZE.height, dpr);
      redraw.force();
    },
    update(s, ui, dt, nowS) {
      const ideal = ui.rotorMode === 'ideal';
      if (ui.chart !== lastTab || ideal !== lastIdeal) {
        lastTab = ui.chart;
        lastIdeal = ideal;
        TABS.forEach((t, i) => {
          const b = buttons[i] as HTMLButtonElement;
          const on = t.id === ui.chart;
          b.setAttribute('aria-selected', String(on));
          b.classList.toggle('on', on);
          // Betz only exists in Ideal-disk mode, and Ideal-disk mode only shows Betz
          b.hidden = t.id === 'betz' ? !ideal : false;
          b.disabled = ideal && t.id !== 'betz';
        });
        redraw.force();
        describe.force();
        // a tab switch cross-fades instead of snapping
        canvas.classList.remove('fade-in');
        void canvas.offsetWidth;
        canvas.classList.add('fade-in');
      }
      if (!redraw.ready(dt)) return;
      if (canvas.offsetParent === null) return; // collapsed or hidden: skip the drawing
      const view = views[ui.chart];
      const input = { s, ui, nowS };
      view.draw(chart, input);
      if (describe.ready(1 / RATE_HZ.charts))
        canvas.setAttribute('aria-label', view.describe(input));
    },
  };
}
