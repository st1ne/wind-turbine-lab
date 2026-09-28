/**
 * Follow modes (TECH_SPEC §9): every material reads the uDim uniform of its system tag
 * (materials.ts). A mode sets a target dim per system; changes ease over 400 ms
 * (easeInOutCubic) from wherever the previous transition was.
 *
 *   All    nothing dimmed
 *   Wind   smoke, stream tube, vortices, anemometer; the rest dims
 *   Power  blades and hub, drivetrain, cable, village
 *   Loads  tower, blades and hub
 * The environment (room, bench, diorama) only dims halfway so the scene never goes black.
 */
import { Group } from 'three';
import { DIM, type SystemTag } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import type { FollowMode } from '@/state/uiState';
import { easeInOutCubic } from '@/util/easing';

export const FOLLOW_S = 0.4;

export const FOLLOW_DIM: Record<FollowMode, Record<SystemTag, number>> = {
  all: { wind: 0, power: 0, rotor: 0, loads: 0, structure: 0, environment: 0 },
  wind: { wind: 0, power: 1, rotor: 0.55, loads: 1, structure: 1, environment: 0.5 },
  power: { wind: 1, power: 0, rotor: 0, loads: 1, structure: 0.8, environment: 0.5 },
  loads: { wind: 1, power: 1, rotor: 0, loads: 0, structure: 0.8, environment: 0.5 },
};

const TAGS = Object.keys(DIM) as SystemTag[];

export function createFollow(): SceneModule<Group> {
  let mode: FollowMode | null = null;
  let t = FOLLOW_S;
  const from = {} as Record<SystemTag, number>;
  return {
    object3d: new Group(),
    update(_s, ui, dt) {
      if (ui.follow !== mode) {
        mode = ui.follow;
        t = 0;
        for (const tag of TAGS) from[tag] = DIM[tag].value;
      }
      if (t >= FOLLOW_S) return;
      t = Math.min(t + dt, FOLLOW_S);
      const k = easeInOutCubic(t / FOLLOW_S);
      const target = FOLLOW_DIM[mode];
      for (const tag of TAGS) DIM[tag].value = from[tag] + (target[tag] - from[tag]) * k;
    },
    dispose() {},
  };
}
