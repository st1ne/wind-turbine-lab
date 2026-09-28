/**
 * Live explanation panel, throttled 150 ms (§3.5).
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';
import type { SimSnapshot } from '@/physics/types';

export function createExplainer(): { el: HTMLElement; update(_s: SimSnapshot): void } {
  return notImplemented('createExplainer');
}
