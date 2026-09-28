/** Tiny DOM helpers for the vanilla UI. */

type Attrs = Record<string, string | number | boolean | undefined>;

/** Create an element: attributes (class, aria-*, data-*…) and children (nodes or text). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  el.append(...children);
  return el;
}

/** Set textContent only when it changed (avoids needless layout and aria-live chatter). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

/** Inline SVG icon from path data on a 24×24 grid (stroke style). */
export function icon(paths: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'icon');
  svg.innerHTML = paths;
  return svg;
}

/** Hotkey hint in dim mono, as in the panel headers. */
export function keyHint(keys: string): HTMLElement {
  return h('span', { class: 'key-hint mono', 'aria-hidden': 'true' }, keys);
}
