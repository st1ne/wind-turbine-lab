/**
 * Screen regions: left column, control panel, chips, share (§3.1).
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';

export interface Layout {
  readonly left: HTMLElement;
  readonly panel: HTMLElement;
  readonly chips: HTMLElement;
  readonly corner: HTMLElement;
}

export function createLayout(_root: HTMLElement): Layout {
  return notImplemented('createLayout');
}
