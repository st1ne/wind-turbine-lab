/**
 * Loads visualisation (TECH_SPEC §9, Follow = Loads):
 *   - thrust arrow, coral, 1 cm at model scale per 20 kN, pushing on the spinner nose from
 *     upwind; it flips (pointing upwind) when the thrust is negative
 *   - the tower's stress ramp (tower.ts) ∝ T / T_rated
 *   - a 1.8 m person at the tower base for scale
 * The ×25 tower bend and ×2 blade flap are applied by turbine.ts.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Color,
} from 'three';
import { THEME } from '@/config/theme';
import { THRUST_RATED_N } from '@/config/turbine';
import type { SimSnapshot } from '@/physics/types';
import { FOCUS_TAU_S } from '@/scene/fx/flow';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { SPINNER } from '@/scene/turbine/hub';
import type { Turbine } from '@/scene/turbine/turbine';
import { toModel } from '@/scene/units';
import type { UiState } from '@/state/uiState';
import { approach } from '@/util/math';

/** §9: 1 cm per 20 kN at model scale */
export const ARROW_M_PER_N = 0.01 / 20e3;
const SHAFT_R = 0.0022;
const HEAD_LEN = 0.014;
const HEAD_R = 0.0055;

/** Arrow length in world units for a thrust in N (sign ignored). */
export function arrowLength(thrustN: number): number {
  return Math.abs(thrustN) * ARROW_M_PER_N;
}

export function createLoadsViz(turbine: Turbine): SceneModule<Group> {
  const group = new Group();
  group.name = 'loads-viz';
  const coral = new Color(THEME.loads);
  const arrowMat = new MeshBasicMaterial({
    color: coral.clone().multiplyScalar(1.6),
    transparent: true,
  });

  // the arrow lives in the rotor's frame at the spinner nose, x along the wind, model units
  const arrow = new Group();
  arrow.name = 'thrust-arrow';
  const shaftGeo = new CylinderGeometry(SHAFT_R, SHAFT_R, 1, 12);
  shaftGeo.rotateZ(-Math.PI / 2);
  shaftGeo.translate(0.5, 0, 0);
  const headGeo = new ConeGeometry(HEAD_R, HEAD_LEN, 16);
  headGeo.rotateZ(-Math.PI / 2);
  headGeo.translate(-HEAD_LEN / 2, 0, 0);
  const shaft = new Mesh(shaftGeo, arrowMat);
  const head = new Mesh(headGeo, arrowMat);
  arrow.add(shaft, head);
  group.add(arrow);

  // person for scale: 1.8 m, on the foundation pad next to the tower
  const personMat = makeMaterial({ color: '#f2c14e', roughness: 0.6 }, 'loads');
  const bodyGeo = new CylinderGeometry(toModel(0.22), toModel(0.2), toModel(1.45), 10);
  bodyGeo.translate(0, toModel(0.725), 0);
  const headBall = new SphereGeometry(toModel(0.16), 10, 8);
  headBall.translate(0, toModel(1.62), 0);
  const person = new Group();
  person.name = 'person-1.8m';
  person.add(new Mesh(bodyGeo, personMat), new Mesh(headBall, personMat));
  person.position.set(toModel(6), 0.001, toModel(-5));
  group.add(person);

  const nose = SPINNER.noseX;
  let focus = 0;

  return {
    object3d: group,
    update(s: SimSnapshot, ui: Readonly<UiState>, dt: number) {
      focus = approach(focus, ui.follow === 'loads' ? 1 : 0, dt, FOCUS_TAU_S);
      turbine.tower.stress.uStress.value = Math.max(s.T, 0) / THRUST_RATED_N;
      turbine.tower.stress.uStressVis.value = focus;
      group.visible = focus > 0.01;
      if (!group.visible) return;
      arrowMat.opacity = focus;
      person.scale.setScalar(Math.max(focus, 0.001));

      // spinner nose in world space (rotor frame, full-scale metres → world)
      const rotor = turbine.rotor.object3d;
      rotor.updateWorldMatrix(true, false);
      arrow.position.set(nose, 0, 0);
      rotor.localToWorld(arrow.position);
      const len = Math.max(arrowLength(s.T), HEAD_LEN * 1.2);
      // positive thrust pushes downwind: tail upwind, head at the nose; negative flips it
      const dir = s.T >= 0 ? 1 : -1;
      arrow.scale.set(dir, 1, 1);
      shaft.scale.set(len - HEAD_LEN, 1, 1);
      shaft.position.x = -len;
      head.position.x = 0;
      if (dir < 0) arrow.position.x -= len;
    },
    dispose() {
      [shaftGeo, headGeo, bodyGeo, headBall].forEach((g) => g.dispose());
      arrowMat.dispose();
      personMat.dispose();
    },
  };
}
