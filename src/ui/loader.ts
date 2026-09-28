/**
 * Loader (TECH_SPEC §2): a turbine silhouette whose blades spin while the scene boots; it fades
 * out on the first rendered frame.
 */
import { h } from '@/ui/dom';

const SILHOUETTE = `
<svg viewBox="0 0 120 160" aria-hidden="true">
  <path class="loader-tower" d="M57 58 L63 58 L65.5 150 L54.5 150 Z" />
  <rect class="loader-nacelle" x="54" y="50" width="16" height="9" rx="3" />
  <g class="loader-rotor">
    <path d="M60 52 C57 36 58 18 60 6 C63 18 63.5 36 61.5 52 Z" />
    <path d="M60 52 C57 36 58 18 60 6 C63 18 63.5 36 61.5 52 Z" transform="rotate(120 60 54)" />
    <path d="M60 52 C57 36 58 18 60 6 C63 18 63.5 36 61.5 52 Z" transform="rotate(240 60 54)" />
    <circle cx="60" cy="54" r="3.4" />
  </g>
  <path class="loader-ground" d="M20 151 Q60 144 100 151" />
</svg>`;

export interface Loader {
  el: HTMLElement;
  done(): void;
}

export function createLoader(): Loader {
  const art = h('div', { class: 'loader-art' });
  art.innerHTML = SILHOUETTE;
  const el = h(
    'div',
    { class: 'loader', role: 'progressbar', 'aria-label': 'Loading the wind tunnel' },
    art,
    h('span', { class: 'loader-caption mono' }, 'spinning up…'),
  );
  let finished = false;
  return {
    el,
    done() {
      if (finished) return;
      finished = true;
      el.classList.add('out');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
      window.setTimeout(() => el.remove(), 1200);
    },
  };
}
