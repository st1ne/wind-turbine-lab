/**
 * WebAudio synthesis: whoosh, hum, wind, rain, thunder, brake (§13).
 * Built in TODO.md Phase 14.
 */
import { notImplemented } from '@/util/stub';
import type { SimSnapshot } from '@/physics/types';

export interface Audio {
  setEnabled(_on: boolean): void;
  update(_s: SimSnapshot): void;
}

export function createAudio(): Audio {
  return notImplemented('createAudio');
}
