/**
 * Units (TECH_SPEC §5.6). Physics works in full-scale SI; the scene is a 1:200 model.
 * This is the only place full-scale metres convert to model metres.
 */
import { MODEL_SCALE } from '@/config/turbine';

export function toModel(m: number): number {
  return m * MODEL_SCALE;
}

export function toFullScale(modelM: number): number {
  return modelM / MODEL_SCALE;
}
