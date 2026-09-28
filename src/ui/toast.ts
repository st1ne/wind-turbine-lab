/**
 * Small top-center toasts ("Link copied", "You found the limit: 59.3 %", "TRIP: overspeed").
 * One container, created lazily; each toast slides in, stays 2.6 s and fades out.
 */
import { h } from '@/ui/dom';

export type ToastTone = 'info' | 'ok' | 'alarm';

const VISIBLE_MS = 2600;
const MAX_TOASTS = 3;
let host: HTMLElement | null = null;

function container(): HTMLElement {
  if (host?.isConnected) return host;
  host = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  (document.getElementById('ui-root') ?? document.body).append(host);
  return host;
}

export function toast(message: string, tone: ToastTone = 'info'): void {
  const root = container();
  while (root.childElementCount >= MAX_TOASTS) root.firstElementChild?.remove();
  const el = h(
    'div',
    { class: `toast glass toast-${tone}` },
    h('i', { 'aria-hidden': 'true' }),
    message,
  );
  root.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  window.setTimeout(() => {
    el.classList.remove('in');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // fallback when transitions are disabled (reduced motion)
    window.setTimeout(() => el.remove(), 400);
  }, VISIBLE_MS);
}
