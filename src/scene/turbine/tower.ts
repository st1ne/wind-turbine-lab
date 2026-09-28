/**
 * Tower (TECH_SPEC §5.5, §6.8, §8): tapered steel tube Ø 6.0 → 3.87 m, 87.6 m tall, flange
 * rings and a door, in full-scale metres. Bending is a vertex-shader cantilever shape
 * δ(z) = δ_top (z/L)²(3 − z/L)/2 along +x (downwind), driven by the uniforms uTopDeflection (m)
 * and uExaggeration.
 *
 * The top 12 m are a separate hollow section (outer wall, top and bottom rims, inward-facing
 * inner wall) joined at a flange, so the cutaway can clip and cap it while the rest of the
 * tower stays solid.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/config/theme';
import { TOWER_BASE_DIAMETER_M, TOWER_HEIGHT_M, TOWER_TOP_DIAMETER_M } from '@/config/turbine';
import { makeBendMaterial, type BendSpec } from '@/scene/materials';

const L = TOWER_HEIGHT_M;
/** height of the cutaway section: the top 12 m (§8) */
export const TOWER_CUT_FROM_M = L - 12;
/** wall thickness of the cut section, m (a real tower wall is ≈ 30 mm; this reads at 1:200) */
export const TOWER_WALL_M = 0.3;
const SEGMENTS = 48;

export interface Tower {
  readonly object3d: Group;
  readonly uniforms: { uTopDeflection: { value: number }; uExaggeration: { value: number } };
  /** vertex displacement shared with the cutaway's stencil passes */
  readonly bend: BendSpec;
  /** the hollow top section (clipped in Cutaway) */
  readonly upper: Mesh;
  /** current displayed bending offset along +x at height y, m */
  displacementAt(yM: number): number;
  dispose(): void;
}

const rAt = (y: number): number =>
  TOWER_BASE_DIAMETER_M / 2 + (TOWER_TOP_DIAMETER_M / 2 - TOWER_BASE_DIAMETER_M / 2) * (y / L);

const shape = (y: number): number => {
  const s = Math.min(Math.max(y / L, 0), 1);
  return (s * s * (3 - s)) / 2;
};

/** Closed hollow tube section between y0 and y1 (counter-clockwise lathe loop → outward). */
export function createTubeSection(y0: number, y1: number, wall: number, rings = 6): BufferGeometry {
  const loop: Vector2[] = [];
  for (let k = 0; k <= rings; k++) {
    const y = y0 + ((y1 - y0) * k) / rings;
    loop.push(new Vector2(rAt(y), y));
  }
  for (let k = rings; k >= 0; k--) {
    const y = y0 + ((y1 - y0) * k) / rings;
    loop.push(new Vector2(rAt(y) - wall, y));
  }
  loop.push(new Vector2(rAt(y0), y0));
  // separate lathes per wall keep the rims' normals crisp; together they form one closed loop
  const pieces: BufferGeometry[] = [];
  const outer = loop.slice(0, rings + 1);
  const top = [loop[rings] as Vector2, loop[rings + 1] as Vector2];
  const inner = loop.slice(rings + 1, 2 * rings + 2);
  const bottom = [loop[2 * rings + 1] as Vector2, loop[2 * rings + 2] as Vector2];
  for (const p of [outer, top, inner, bottom]) {
    pieces.push(new LatheGeometry(p, SEGMENTS).toNonIndexed());
  }
  const g = mergeGeometries(pieces);
  pieces.forEach((x) => x.dispose());
  return g;
}

export function createTower(): Tower {
  const group = new Group();
  group.name = 'tower';

  // ---- lower tower: solid tapered tube, flanges, door (never clipped)
  const Y = TOWER_CUT_FROM_M;
  const parts: BufferGeometry[] = [];
  const shell = new CylinderGeometry(rAt(Y), TOWER_BASE_DIAMETER_M / 2, Y, SEGMENTS, 26);
  shell.translate(0, Y / 2, 0);
  parts.push(shell.toNonIndexed());
  shell.dispose();
  for (const y of [0.4, L / 3, (2 * L) / 3]) {
    const t = new TorusGeometry(rAt(y) + 0.05, 0.12, 6, SEGMENTS);
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
  const lowerGeo = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());

  // ---- upper section: hollow tube with the joint flange and the top flange (clipped)
  const upperParts = [createTubeSection(Y, L, TOWER_WALL_M)];
  for (const y of [Y + 0.2, L - 0.3]) {
    const t = new TorusGeometry(rAt(y) + 0.05, 0.12, 6, SEGMENTS);
    t.rotateX(Math.PI / 2);
    t.translate(0, y, 0);
    upperParts.push(t.toNonIndexed());
    t.dispose();
  }
  const upperGeo = mergeGeometries(upperParts);
  upperParts.forEach((g) => g.dispose());

  const uniforms = { uTopDeflection: { value: 0 }, uExaggeration: { value: 1 } };
  const bend: BendSpec = {
    uniforms,
    displace: /* glsl */ `{
      float s = clamp(position.y / ${L.toFixed(2)}, 0.0, 1.0);
      transformed.x += uTopDeflection * uExaggeration * s * s * (3.0 - s) * 0.5;
    }`,
    key: 'tower-bend',
  };
  const params = { color: PALETTE.turbine, roughness: 0.45, metalness: 0.1 };
  const lowerMat = makeBendMaterial(params, 'loads', uniforms, bend.displace, bend.key);
  // own material instance: only this one gets the cutaway clipping plane
  const upperMat = makeBendMaterial(params, 'loads', uniforms, bend.displace, bend.key);
  const lower = new Mesh(lowerGeo, lowerMat);
  const upper = new Mesh(upperGeo, upperMat);
  lower.name = 'tower';
  upper.name = 'tower-top';
  for (const m of [lower, upper]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }

  return {
    object3d: group,
    uniforms,
    bend,
    upper,
    displacementAt(yM) {
      return uniforms.uTopDeflection.value * uniforms.uExaggeration.value * shape(yM);
    },
    dispose() {
      lowerGeo.dispose();
      upperGeo.dispose();
      lowerMat.dispose();
      upperMat.dispose();
    },
  };
}
