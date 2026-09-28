/**
 * Screen regions (TECH_SPEC §3.1): left column (brand, title block, stat cards, explanation,
 * chart), top-right control panel, bottom-center camera chips, bottom-right share / X link.
 * The canvas stays full-bleed behind everything; regions sit in a 24 px gutter.
 */
import { BRAND } from '@/config/brand';
import { h } from '@/ui/dom';

export interface Layout {
  readonly left: HTMLElement;
  readonly panel: HTMLElement;
  readonly chips: HTMLElement;
  readonly corner: HTMLElement;
}

function titleBlock(): HTMLElement {
  return h(
    'header',
    { class: 'title-block' },
    ...(BRAND.name ? [h('span', { class: 'brand mono' }, BRAND.name)] : []),
    h('p', { class: 'overline-lg' }, 'WIND TURBINE LAB'),
    h('h1', { class: 'headline' }, h('span', {}, 'THE 59 %'), h('span', {}, 'LIMIT')),
    h(
      'p',
      { class: 'intro' },
      'Everyone has seen a wind turbine turn. Almost nobody knows it can never catch more than 59 % of the wind, or why it hides from storms. Turn up the wind and watch.',
    ),
  );
}

export function createLayout(root: HTMLElement): Layout {
  const left = h('div', { class: 'region-left' }, titleBlock());
  const panel = h('div', { class: 'region-panel' });
  const chips = h('nav', { class: 'region-chips', 'aria-label': 'Camera views' });
  const corner = h(
    'div',
    { class: 'region-corner' },
    h(
      'a',
      {
        class: 'x-link',
        href: BRAND.handleUrl,
        target: '_blank',
        rel: 'noopener',
        'aria-label': `Follow ${BRAND.handle} on X`,
      },
      `Follow ${BRAND.handle}`,
    ),
  );
  root.append(left, panel, chips, corner);
  return { left, panel, chips, corner };
}
