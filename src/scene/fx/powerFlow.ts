/**
 * Power flow (TECH_SPEC §9, Follow = Power): amber pulses along the path hub → main shaft →
 * gearbox → high-speed shaft → generator → converter → down the tower → transformer → pylon →
 * village. Both the number of pulses and their speed are proportional to the electrical power,
 * so they stop when the turbine is parked or tripped. The path is re-evaluated every frame from
 * the parts' world positions (tower bending, Exploded offsets).
 *
 * Pulses are drawn x-ray (no depth test) so they read through the shell and tower.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { THEME } from '@/config/theme';
import { P_RATED_W, TOWER_HEIGHT_M } from '@/config/turbine';
import type { SimSnapshot } from '@/physics/types';
import type { Village } from '@/scene/environment/village';
import { FOCUS_TAU_S } from '@/scene/fx/flow';
import type { SceneModule } from '@/scene/module';
import type { Turbine } from '@/scene/turbine/turbine';
import { toModel } from '@/scene/units';
import type { UiState } from '@/state/uiState';
import { approach } from '@/util/math';

export const MAX_PULSES = 24;
/** path fraction per second at rated power */
export const PULSE_SPEED_RATED = 0.16;
const PATH_SAMPLES = 160;
const GOLDEN = 0.6180339887;

const powerFraction = (powerW: number): number => Math.min(Math.max(powerW / P_RATED_W, 0), 1);

/** Pulses shown at electrical power P: ∝ P, at least one while any power flows. */
export function pulseCount(powerW: number): number {
  const f = powerFraction(powerW);
  return f <= 0 ? 0 : Math.max(1, Math.round(MAX_PULSES * f));
}

/** Pulse speed along the path (fraction per sim second), ∝ P. */
export function pulseSpeed(powerW: number): number {
  return PULSE_SPEED_RATED * powerFraction(powerW);
}

export function createPowerFlow(turbine: Turbine, village: Village): SceneModule<Group> {
  const group = new Group();
  group.name = 'power-flow';
  const { rotor, drivetrain, tower } = turbine;
  const root = turbine.object3d;

  const points = Array.from({ length: 13 }, () => new Vector3());
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const rootPoint = (target: Vector3, x: number, y: number, z: number): void => {
    target.set(x + tower.displacementAt(y), y, z);
    root.localToWorld(target);
  };
  function updatePath(): void {
    const p = points;
    rotor.object3d.getWorldPosition(p[0] as Vector3);
    drivetrain.anchors.mainShaft.getWorldPosition(p[1] as Vector3);
    drivetrain.anchors.gearbox.getWorldPosition(p[2] as Vector3);
    drivetrain.anchors.brake.getWorldPosition(p[3] as Vector3);
    drivetrain.anchors.generator.getWorldPosition(p[4] as Vector3);
    drivetrain.anchors.converter.getWorldPosition(p[5] as Vector3);
    // cable down the inside of the tower, following its bend
    rootPoint(p[6] as Vector3, 0.9, TOWER_HEIGHT_M - 0.5, 0.9);
    rootPoint(p[7] as Vector3, 0.9, TOWER_HEIGHT_M * 0.5, 0.9);
    rootPoint(p[8] as Vector3, 0.9, 1.5, 0.9);
    rootPoint(p[9] as Vector3, 6.5, 2.6, 4.5);
    (p[10] as Vector3).copy(village.pylonTop);
    (p[11] as Vector3).copy(village.pylonTop).lerp(village.feed, 0.5);
    (p[12] as Vector3).copy(village.feed);
    (p[11] as Vector3).y -= 0.004;
    curve.updateArcLengths();
  }

  const pulseGeo = new SphereGeometry(toModel(0.9), 10, 8);
  const pulseMat = new MeshBasicMaterial({
    color: new Color(THEME.power).multiplyScalar(4),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const pulses = new InstancedMesh(pulseGeo, pulseMat, MAX_PULSES);
  pulses.frustumCulled = false;
  pulses.renderOrder = 20;
  group.add(pulses);

  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute('position', new BufferAttribute(new Float32Array(PATH_SAMPLES * 3), 3));
  const lineMat = new LineBasicMaterial({
    color: THEME.power,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const line = new Line(lineGeo, lineMat);
  line.frustumCulled = false;
  line.renderOrder = 19;
  group.add(line);

  let focus = 0;
  let phase = 0;
  let lastT: number | null = null;
  const m = new Matrix4();
  const v = new Vector3();

  return {
    object3d: group,
    update(s: SimSnapshot, ui: Readonly<UiState>, dt: number) {
      focus = approach(focus, ui.follow === 'power' ? 1 : 0, dt, FOCUS_TAU_S);
      const dtSim = lastT === null ? 0 : Math.max(s.t - lastT, 0);
      lastT = s.t;
      phase = (phase + pulseSpeed(s.Pel) * dtSim) % 1;
      group.visible = focus > 0.01;
      if (!group.visible) return;

      updatePath();
      const pos = lineGeo.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < PATH_SAMPLES; i++) {
        curve.getPointAt(i / (PATH_SAMPLES - 1), v);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      pos.needsUpdate = true;
      lineMat.opacity = 0.3 * focus;

      // low-discrepancy slots: adding a pulse never moves the others
      const n = pulseCount(s.Pel);
      pulses.count = n;
      for (let i = 0; i < n; i++) {
        curve.getPointAt((phase + i * GOLDEN) % 1, v);
        pulses.setMatrixAt(i, m.makeTranslation(v.x, v.y, v.z));
      }
      pulses.instanceMatrix.needsUpdate = true;
      pulseMat.opacity = focus;
    },
    dispose() {
      pulseGeo.dispose();
      pulseMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
