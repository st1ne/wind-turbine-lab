/**
 * Lightning (TECH_SPEC §4.2, §11): when the storm level exceeds 0.8, a flash every 6–14 s of
 * sim time: a 60 ms burst (with a quick second flicker) from a point light between the
 * clouds, which also glow from inside. Disabled under prefers-reduced-motion. `flashes`
 * counts them for the thunder in the audio phase.
 */
import { Group, PointLight } from 'three';
import type { Clouds } from '@/scene/environment/clouds';
import type { SceneModule } from '@/scene/module';
import { prefersReducedMotion } from '@/util/easing';
import { mulberry32 } from '@/util/math';

export const LIGHTNING_THRESHOLD = 0.8;
export const FLASH_S = 0.06;
const GAP_S = { min: 6, max: 14 } as const;
const PEAK_INTENSITY = 7;

export interface Lightning extends SceneModule<Group> {
  readonly flashes: number;
}

/** Flash envelope at time τ after the strike: main burst, a dark gap, a weaker flicker. */
export function flashEnvelope(tau: number): number {
  if (tau < 0) return 0;
  if (tau < FLASH_S) return 1;
  if (tau < FLASH_S + 0.05) return 0;
  if (tau < FLASH_S + 0.09) return 0.5;
  return 0;
}

export function createLightning(clouds: Clouds): Lightning {
  const group = new Group();
  group.name = 'lightning';
  const light = new PointLight('#dfe8ff', 0, 6, 1.5);
  const c = clouds.centers;
  light.position.set(
    c.reduce((s, p) => s + p.x, 0) / c.length,
    c.reduce((s, p) => s + p.y, 0) / c.length + 0.1,
    0.3,
  );
  group.add(light);
  const rnd = mulberry32(99);
  const reduced = prefersReducedMotion();
  let next = Number.NaN;
  let strike = -Infinity;
  let flashes = 0;

  return {
    object3d: group,
    get flashes() {
      return flashes;
    },
    update(s) {
      const active = !reduced && s.stormLevel > LIGHTNING_THRESHOLD;
      if (!active) {
        next = Number.NaN;
      } else {
        if (Number.isNaN(next)) next = s.t + 1 + rnd() * 3;
        if (s.t >= next) {
          strike = s.t;
          flashes++;
          next = s.t + GAP_S.min + rnd() * (GAP_S.max - GAP_S.min);
        }
      }
      const k = flashEnvelope(s.t - strike);
      light.intensity = PEAK_INTENSITY * k;
      clouds.setFlash(k);
    },
    dispose() {
      light.dispose();
    },
  };
}
