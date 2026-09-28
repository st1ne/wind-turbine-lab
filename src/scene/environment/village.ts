/**
 * Village, pylon and cable (TECH_SPEC §4.1, §9): 12 instanced houses on the diorama slope whose
 * windows light up with the turbine's output, lit count = round(12 · P / P_rated), and a
 * power line from the transformer at the tower base over a pylon to the village.
 * Model-scale world units; houses ≈ 9 × 7 m with 5 m walls at full scale.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  QuadraticBezierCurve3,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THEME } from '@/config/theme';
import { P_RATED_W } from '@/config/turbine';
import type { SimSnapshot } from '@/physics/types';
import { heightAt } from '@/scene/environment/diorama';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { toModel } from '@/scene/units';
import { mulberry32 } from '@/util/math';

export const HOUSES = 12;
const WINDOWS_PER_HOUSE = 4;
export const VILLAGE_CENTER = { x: 0.22, z: 0.32 } as const;
const PYLON = { x: 0.125, z: 0.175, heightM: 24 } as const;

/** Houses lit at electrical power P (§9): round(12 · P / P_rated), clamped to 0–12. */
export function litHouses(powerW: number): number {
  return Math.round(HOUSES * Math.min(Math.max(powerW / P_RATED_W, 0), 1));
}

export interface Village extends SceneModule<Group> {
  /** world-space points the power-flow path runs through */
  readonly pylonTop: Vector3;
  readonly feed: Vector3;
  readonly lit: number;
}

export function createVillage(transformerTop: Vector3): Village {
  const group = new Group();
  group.name = 'village';
  const geos: BufferGeometry[] = [];
  const rnd = mulberry32(11);

  const W = toModel(9);
  const D = toModel(7);
  const H = toModel(5);
  const ROOF = toModel(3.5);

  // house layout: two rough rows along a lane, slightly jittered
  const spots: { x: number; z: number; yaw: number }[] = [];
  for (let k = 0; k < HOUSES; k++) {
    const row = k % 2;
    const col = Math.floor(k / 2) - 2.5;
    const along = col * 0.034 + (rnd() - 0.5) * 0.008;
    const across = (row - 0.5) * 0.05 + (rnd() - 0.5) * 0.008;
    // lane runs diagonally across the slope
    const x = VILLAGE_CENTER.x + along * 0.8 - across * 0.6;
    const z = VILLAGE_CENTER.z + along * 0.6 + across * 0.8;
    spots.push({ x, z, yaw: -0.64 + (row ? Math.PI : 0) + (rnd() - 0.5) * 0.3 });
  }

  const bodyGeo = new BoxGeometry(W, H, D);
  bodyGeo.translate(0, H / 2, 0);
  const roofGeo = new ConeGeometry(Math.SQRT1_2, 1, 4);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 0.5, 0);
  const winGeo = new BoxGeometry(toModel(1.6), toModel(1.4), toModel(0.3));
  geos.push(bodyGeo, roofGeo, winGeo);

  const bodyMat = makeMaterial({ color: '#efe6d8', roughness: 0.8 }, 'power');
  const roofMat = makeMaterial({ color: '#ffffff', roughness: 0.7, flatShading: true }, 'power');
  const winMat = new MeshBasicMaterial({ color: '#ffffff' });
  const bodies = new InstancedMesh(bodyGeo, bodyMat, HOUSES);
  const roofs = new InstancedMesh(roofGeo, roofMat, HOUSES);
  const windows = new InstancedMesh(winGeo, winMat, HOUSES * WINDOWS_PER_HOUSE);
  const roofColors = ['#b5523b', '#8c4a3a', '#5f6b7a', '#a0674a', '#7a3d33'].map(
    (c) => new Color(c),
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const up = new Vector3(0, 1, 0);
  const pos = new Vector3();
  const scl = new Vector3();
  spots.forEach((s, i) => {
    const y = heightAt(s.x, s.z) - toModel(0.6);
    q.setFromAxisAngle(up, s.yaw);
    pos.set(s.x, y, s.z);
    bodies.setMatrixAt(i, m.compose(pos, q, scl.set(1, 1, 1)));
    pos.set(s.x, y + H, s.z);
    roofs.setMatrixAt(i, m.compose(pos, q, scl.set(W * 1.12, ROOF, D * 1.12)));
    roofs.setColorAt(i, roofColors[i % roofColors.length] as Color);
    // two windows on each long face
    for (let w = 0; w < WINDOWS_PER_HOUSE; w++) {
      const face = w < 2 ? 1 : -1;
      const local = new Vector3(((w % 2) - 0.5) * W * 0.5, H * 0.55, face * (D / 2 + toModel(0.1)));
      local.applyQuaternion(q);
      local.add(pos.set(s.x, y, s.z));
      windows.setMatrixAt(i * WINDOWS_PER_HOUSE + w, m.compose(local, q, scl.set(1, 1, 1)));
    }
  });
  for (const im of [bodies, roofs]) {
    im.castShadow = true;
    im.receiveShadow = true;
  }
  group.add(bodies, roofs, windows);

  const litColor = new Color(THEME.power).multiplyScalar(3.2);
  const darkColor = new Color('#1b2130');
  let lit = -1;
  function setLit(n: number): void {
    if (n === lit) return;
    lit = n;
    for (let i = 0; i < HOUSES; i++) {
      for (let w = 0; w < WINDOWS_PER_HOUSE; w++) {
        windows.setColorAt(i * WINDOWS_PER_HOUSE + w, i < n ? litColor : darkColor);
      }
    }
    if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  }
  setLit(0);

  // pylon: four tapering legs, two cross-arms
  const baseY = heightAt(PYLON.x, PYLON.z);
  const h = toModel(PYLON.heightM);
  const legParts: BufferGeometry[] = [];
  const foot = toModel(2.2);
  const head = toModel(0.7);
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const from = new Vector3(sx * foot, 0, sz * foot);
    const to = new Vector3(sx * head, h, sz * head);
    const len = from.distanceTo(to);
    const leg = new CylinderGeometry(toModel(0.18), toModel(0.25), len, 5);
    leg.applyQuaternion(new Quaternion().setFromUnitVectors(up, to.clone().sub(from).normalize()));
    leg.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
    legParts.push(leg);
  }
  for (const [y, span] of [
    [0.82, 9],
    [0.97, 6],
  ] as const) {
    const arm = new BoxGeometry(toModel(span), toModel(0.4), toModel(0.4));
    arm.translate(0, h * y, 0);
    legParts.push(arm);
  }
  const pylonGeo = mergeGeometries(legParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  legParts.forEach((g) => g.dispose());
  geos.push(pylonGeo);
  const pylonMat = makeMaterial({ color: '#6d7480', roughness: 0.5, metalness: 0.6 }, 'power');
  const pylon = new Mesh(pylonGeo, pylonMat);
  pylon.position.set(PYLON.x, baseY, PYLON.z);
  // cross-arms point across the line
  pylon.rotation.y = Math.atan2(
    VILLAGE_CENTER.x - transformerTop.x,
    VILLAGE_CENTER.z - transformerTop.z,
  );
  pylon.castShadow = true;
  group.add(pylon);

  const pylonTop = new Vector3(PYLON.x, baseY + h * 0.82, PYLON.z);
  const feed = new Vector3(
    VILLAGE_CENTER.x,
    heightAt(VILLAGE_CENTER.x, VILLAGE_CENTER.z) + H * 1.3,
    VILLAGE_CENTER.z,
  );

  // sagging cable: transformer → pylon → village
  const sag = (a: Vector3, b: Vector3): Vector3[] => {
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= a.distanceTo(b) * 0.08;
    return new QuadraticBezierCurve3(a, mid, b).getPoints(24);
  };
  const cablePts = [...sag(transformerTop, pylonTop), ...sag(pylonTop, feed).slice(1)];
  const cableGeo = new BufferGeometry();
  cableGeo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(cablePts.flatMap((p) => [p.x, p.y, p.z])), 3),
  );
  geos.push(cableGeo);
  const cableMat = new LineBasicMaterial({ color: '#2b303a' });
  group.add(new Line(cableGeo, cableMat));

  return {
    object3d: group,
    pylonTop,
    feed,
    get lit() {
      return lit;
    },
    update(s: SimSnapshot) {
      setLit(litHouses(s.Pel));
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [bodyMat, roofMat, winMat, pylonMat, cableMat].forEach((x) => x.dispose());
    },
  };
}
