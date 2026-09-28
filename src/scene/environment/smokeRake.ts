/**
 * Smoke rake (TECH_SPEC §4.1, §9): the wind-tunnel comb that seeds the 14 smoke lines, at
 * x = −2.5R upstream of the rotor. Two rings carry the inner nozzles, a vertical bar the two
 * outer ones, and a post stands it on the bench. Nozzle tips glow (bloom). Built once around
 * the rotor's rest position; the nozzles sit on the far-upstream seed radii r∞.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENVIRONMENT } from '@/config/environment';
import { THEME } from '@/config/theme';
import { SMOKE, SMOKE_SEEDS } from '@/scene/fx/smokeLines';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const TUBE_R = 0.0011;
const NOZZLE_LEN = 0.022;

export function createSmokeRake(rotorCenter: Vector3, radius: number): SceneModule<Group> {
  const group = new Group();
  group.name = 'smoke-rake';
  group.position.set(rotorCenter.x + SMOKE.xStart * radius, rotorCenter.y, rotorCenter.z);
  const geos: BufferGeometry[] = [];

  // frame: two rings, a vertical bar to the outer nozzles, a post down to the bench
  const frameParts: BufferGeometry[] = [];
  for (const r of [0.35, 0.75]) {
    const t = new TorusGeometry(r * radius, TUBE_R, 6, 64);
    t.rotateY(Math.PI / 2);
    frameParts.push(t);
  }
  const barH = 2.4 * radius;
  const bar = new CylinderGeometry(TUBE_R, TUBE_R, barH, 6);
  frameParts.push(bar);
  const cross = new CylinderGeometry(TUBE_R, TUBE_R, 1.5 * radius, 6);
  cross.rotateX(Math.PI / 2);
  frameParts.push(cross);
  const postTop = -1.2 * radius;
  const postBottom = ENVIRONMENT.bench.topY - rotorCenter.y;
  const post = new CylinderGeometry(TUBE_R * 2.2, TUBE_R * 2.2, postTop - postBottom, 8);
  post.translate(0, (postTop + postBottom) / 2, 0);
  frameParts.push(post);
  const foot = new CylinderGeometry(0.03, 0.034, 0.006, 20);
  foot.translate(0, postBottom + 0.003, 0);
  frameParts.push(foot);
  const frameGeo = mergeGeometries(frameParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  frameParts.forEach((g) => g.dispose());
  geos.push(frameGeo);
  const frameMat = makeMaterial({ color: '#5c6573', roughness: 0.45, metalness: 0.7 }, 'wind');
  const frame = new Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  group.add(frame);

  // nozzles pointing downstream, and their glowing tips
  const nozzleGeo = new CylinderGeometry(TUBE_R * 1.3, TUBE_R * 1.6, NOZZLE_LEN, 8);
  nozzleGeo.rotateZ(-Math.PI / 2);
  nozzleGeo.translate(NOZZLE_LEN / 2, 0, 0);
  const tipGeo = new SphereGeometry(TUBE_R * 1.8, 8, 6);
  geos.push(nozzleGeo, tipGeo);
  const nozzles = new InstancedMesh(nozzleGeo, frameMat, SMOKE_SEEDS.length);
  const tipMat = new MeshBasicMaterial({ color: new Color(THEME.wind).multiplyScalar(4) });
  const tips = new InstancedMesh(tipGeo, tipMat, SMOKE_SEEDS.length);
  const m = new Matrix4();
  SMOKE_SEEDS.forEach(([r, phi], i) => {
    const y = r * radius * Math.cos(phi);
    const z = r * radius * Math.sin(phi);
    nozzles.setMatrixAt(i, m.makeTranslation(0, y, z));
    tips.setMatrixAt(i, m.makeTranslation(NOZZLE_LEN, y, z));
  });
  group.add(nozzles, tips);

  return {
    object3d: group,
    update() {},
    dispose() {
      geos.forEach((g) => g.dispose());
      frameMat.dispose();
      tipMat.dispose();
    },
  };
}
