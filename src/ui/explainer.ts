/**
 * Live explanation panel (TECH_SPEC §3.5): re-renders at most every 150 ms and only when the
 * rendered text (i.e. its rounded values) changed. Screen readers get a separate polite live
 * region updated at most once per 2 s (§16).
 */
import { h } from '@/ui/dom';
import { regimeTitle, renderTemplate, type TemplateContext } from '@/ui/templates';

const THROTTLE_S = 0.15;
const SR_THROTTLE_S = 2;

export interface Explainer {
  el: HTMLElement;
  update(ctx: TemplateContext, dt: number): void;
}

export function createExplainer(): Explainer {
  const title = h('span', { class: 'explainer-title' });
  const text = h('p', { class: 'explainer-text' });
  // the body animates its height, so a longer or shorter paragraph never jolts the chart below
  const body = h('div', { class: 'explainer-body' }, text);
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const el = h(
    'section',
    { class: 'explainer glass', 'aria-label': 'What is happening' },
    h(
      'header',
      { class: 'panel-head' },
      h('span', { class: 'overline' }, 'What is happening'),
      title,
    ),
    body,
    live,
  );

  let acc = THROTTLE_S;
  let srAcc = SR_THROTTLE_S;
  let lastHtml = '';
  let lastTitle = '';

  return {
    el,
    update(ctx, dt) {
      acc += dt;
      srAcc += dt;
      if (acc < THROTTLE_S) return;
      acc = 0;
      const html = renderTemplate(ctx);
      if (html === lastHtml) return;
      lastHtml = html;
      text.innerHTML = html;
      body.style.height = `${text.offsetHeight}px`;
      const t = regimeTitle(ctx);
      if (t !== lastTitle) {
        lastTitle = t;
        title.textContent = t;
        el.dataset.regime = ctx.s.regime;
        // restart the soft fade so a regime change reads as a new paragraph
        text.classList.remove('fade-in');
        void text.offsetWidth;
        text.classList.add('fade-in');
      }
      if (srAcc >= SR_THROTTLE_S) {
        srAcc = 0;
        live.textContent = text.textContent;
      }
    },
  };
}
