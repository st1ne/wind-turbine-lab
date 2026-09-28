/**
 * Read/write query params with debounced replaceState (§17).
 * Built in TODO.md Phase 13.
 */
import { notImplemented } from '@/util/stub';
import type { UiState } from '@/state/uiState';

export function readUrlState(): Partial<UiState> {
  return notImplemented('readUrlState');
}

export function writeUrlState(_ui: UiState): void {
  notImplemented('writeUrlState');
}
