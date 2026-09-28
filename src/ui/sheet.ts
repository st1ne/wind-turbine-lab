/**
 * Mobile bottom sheet (TECH_SPEC §16, < 900 px): the control panel, explanation, chart and
 * waterfall move into a sheet pinned to the bottom. Collapsed it peeks 100 px (weather presets
 * and the wind slider); drag the handle up, or tap it, to open the rest. Dragging follows the
 * finger and snaps open or closed on release.
 */
import { h } from '@/ui/dom';

/** §16 says 76 px; presets plus a slider with 28 px finger-size thumbs need 100 (CSS --peek) */
export const SHEET_PEEK_PX = 100;
const SNAP_PX = 40;

export interface Sheet {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  readonly open: boolean;
  setOpen(open: boolean): void;
}

export function createSheet(): Sheet {
  const handle = h(
    'button',
    {
      type: 'button',
      class: 'sheet-handle',
      'aria-expanded': 'false',
      'aria-label': 'More controls',
    },
    h('i'),
  );
  const body = h('div', { class: 'sheet-body' });
  const el = h('section', { class: 'sheet glass', 'aria-label': 'Controls' }, handle, body);
  let open = false;
  let startY = 0;
  let dragDy = 0;
  let dragging = false;
  let moved = false;

  function setOpen(v: boolean): void {
    open = v;
    el.classList.toggle('open', v);
    handle.setAttribute('aria-expanded', String(v));
    el.style.removeProperty('--drag');
    if (!v) body.scrollTop = 0;
  }

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    startY = e.clientY;
    dragDy = 0;
    handle.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragDy = e.clientY - startY;
    if (Math.abs(dragDy) > 4) moved = true;
    el.style.setProperty('--drag', `${dragDy}px`);
  });
  const end = (): void => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    if (!moved) setOpen(!open);
    else if (dragDy < -SNAP_PX) setOpen(true);
    else if (dragDy > SNAP_PX) setOpen(false);
    else setOpen(open);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
  // keyboard: the handle is a button, Enter/Space toggle via click
  handle.addEventListener('click', (e) => {
    if (e.detail === 0) setOpen(!open);
  });

  return {
    el,
    body,
    get open() {
      return open;
    },
    setOpen,
  };
}
