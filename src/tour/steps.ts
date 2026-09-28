/**
 * Guided tour steps (§12).
 * Built in TODO.md Phase 13.
 */
import { notImplemented } from '@/util/stub';
import type { CameraChip, UiState } from '@/state/uiState';

export interface TourStep {
  camera: CameraChip | 'wide';
  state: Partial<UiState>;
  caption: string;
  durationS: number;
}

export function tourSteps(): readonly TourStep[] {
  return notImplemented('tourSteps');
}
