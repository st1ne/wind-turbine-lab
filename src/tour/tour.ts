/**
 * Guided tour runner with caption bar and resume pill (§12).
 * Built in TODO.md Phase 13.
 */
import { notImplemented } from '@/util/stub';

export interface Tour {
  start(): void;
  stop(): void;
  update(_dt: number): void;
}

export function createTour(): Tour {
  return notImplemented('createTour');
}
