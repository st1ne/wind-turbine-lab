/**
 * Keyboard shortcuts (§3.9); ignored while typing.
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';
import type { Store } from '@/state/store';
import type { UiState } from '@/state/uiState';

export function installHotkeys(_store: Store<UiState>): () => void {
  return notImplemented('installHotkeys');
}
