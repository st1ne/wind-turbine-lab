/**
 * WebAudio synthesis: whoosh, hum, wind, rain, thunder, brake (§13).
 * Phase 6 wires a silent stub into the frame loop; the synthesis is built in TODO.md Phase 14.
 */
import type { SimSnapshot } from '@/physics/types';

export interface Audio {
  setEnabled(on: boolean): void;
  update(s: SimSnapshot, dt: number): void;
  dispose(): void;
}

export function createAudio(): Audio {
  let enabled = false;
  return {
    setEnabled(on) {
      enabled = on;
    },
    update() {
      if (!enabled) return;
      // Phase 14: drive the WebAudio graph from the snapshot here.
    },
    dispose() {
      enabled = false;
    },
  };
}
