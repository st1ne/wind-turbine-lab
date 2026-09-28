/**
 * Tower (TECH_SPEC §5.5, §6.8): tapered steel tube Ø 6.0 → 3.87 m, 87.6 m tall, 30 height
 * segments, three flange rings and a door, in full-scale metres. Bending is a vertex-shader
 * cantilever shape δ(z) = δ_top (z/L)²(3 − z/L)/2 along +x (downwind), driven by the uniforms
 * uTopDeflection (m) and uExaggeration.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, TorusGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/config/theme';
import {
  TOWER_BASE_DIAMETER_M,
  TOWER_HEIGHT_M,
  TOWER_TOP_DIAMETER_M,
} from '@/config/turbine';
import { makeBendMaterial } from '@/scene/materials';

export interface Tower {
  readonly object3d: Group;
  readonly uniforms: { uTopDeflection: { value: number }; uExaggeration: { value: number } };
  dispose(): void;
}

const L = TOWER_HEIGHT_M;
const rAt = (y: number): number =>
  TOWER_BASE_DIAMETER_M / 2 + (TOWER_TOP_DIAMETER_M / 2 - TOWER_BASE_DIAMETER_M / 2) * (y / L);

export function createTower(): Tower {
  const group = new Group();
  group.name = 'tower';
  const parts: BufferGeometry[] = [];

  const shell = new CylinderGeometry(TOWER_TOP_DIAMETER_M / 2, TOWER_BASE_DIAMETER_M / 2, L, 48, 30);
  shell.translate(0, L / 2, 0);
  parts.push(shell.toNonIndexed());
  shell.dispose();

  for (const y of [0.4, L / 3, (2 * L) / 3, L - 0.3]) {
    const t = new TorusGeometry(rAt(y) + 0.05, 0.12, 6, 48);
    t.rotateX(Math.PI / 2);
    t.translate(0, y, 0);
    parts.push(t.toNonIndexed());
    t.dispose();
  }
  // door frame and steps on the +z side
  const door = new BoxGeometry(1.1, 2.3, 0.25);
  door.translate(0, 2.6, rAt(2.6) - 0.02);
  const step = new BoxGeometry(1.6, 0.25, 1.1);
  step.translate(0, 1.1, rAt(1.1) + 0.45);
  parts.push(door.toNonIndexed(), step.toNonIndexed());
  door.dispose();
  step.dispose();

  const geo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());

  const uniforms = { uTopDeflection: { value: 0 }, uExaggeration: { value: 1 } };
  const mat = makeBendMaterial(
    { color: PALETTE.turbine, roughness: 0.45, metalness: 0.1 },
    'loads',
    uniforms,
    /* glsl */ `{
      float s = clamp(position.y / ${L.toFixed(2)}, 0.0, 1.0);
      transformed.x += uTopDeflection * uExaggeration * s * s * (3.0 - s) * 0.5;
    }`,
    'tower-bend',
  );
  const mesh = new Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return {
    object3d: group,
    uniforms,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
