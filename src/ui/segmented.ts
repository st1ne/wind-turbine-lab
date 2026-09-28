/**
 * Accessible segmented control (TECH_SPEC §3.4): a group of real buttons with aria-pressed.
 * The active option is a white pill with dark text; the pill slides between options.
 */
import { h } from '@/ui/dom';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** accessible name if the visible label is terse */
  ariaLabel?: string;
}

export interface Segmented<T extends string> {
  el: HTMLElement;
  set(value: T | null): void;
}

export function createSegmented<T extends string>(
  options: readonly SegmentedOption<T>[],
  onChange: (value: T) => void,
  groupLabel: string,
): Segmented<T> {
  const el = h('div', { class: 'seg', role: 'group', 'aria-label': groupLabel });
  const pill = h('span', { class: 'seg-pill', 'aria-hidden': 'true' });
  el.append(pill);
  const buttons = options.map((o) => {
    const b = h(
      'button',
      { type: 'button', class: 'seg-btn', 'aria-pressed': 'false', 'aria-label': o.ariaLabel },
      o.label,
    );
    b.addEventListener('click', () => onChange(o.value));
    el.append(b);
    return b;
  });

  let current: T | null = null;
  function place(): void {
    const i = options.findIndex((o) => o.value === current);
    const b = buttons[i];
    if (!b) {
      pill.style.opacity = '0';
      return;
    }
    if (b.offsetWidth === 0) return;
    pill.style.opacity = '1';
    pill.style.width = `${b.offsetWidth}px`;
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  // layout isn't known until the element is attached and fonts load
  new ResizeObserver(place).observe(el);

  return {
    el,
    set(value) {
      current = value;
      options.forEach((o, i) => {
        const b = buttons[i];
        if (!b) return;
        const on = o.value === value;
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('on', on);
      });
      place();
    },
  };
}
