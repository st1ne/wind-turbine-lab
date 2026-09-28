/**
 * Accessible segmented control with aria-pressed (§3.4).
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function createSegmented<T extends string>(
  _options: readonly SegmentedOption<T>[],
  _onChange: (value: T) => void,
): { el: HTMLElement; set(_value: T): void } {
  return notImplemented('createSegmented');
}
