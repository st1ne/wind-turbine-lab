/**
 * Low-poly island diorama (TECH_SPEC §4.1, §4.3): a flat-shaded grassy hill rising from the
 * bench to the turbine foundation at the origin, a few rocks and 6 instanced trees.
 * Exposes heightAt() so later props (village, pylon, person) can sit on the terrain.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENVIRONMENT } from '@/config/environment';
import { PALETTE } from '@/config/theme';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { toModel } from '@/scene/units';
import { mulberry32, smoothstep } from '@/util/math';

const D = ENVIRONMENT.diorama;
const BENCH_Y = ENVIRONMENT.bench.topY;
const PAD_R = toModel(11);

/** Terrain height at (x, z) in scene units; the plateau around the origin is at y = 0. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r >= D.radius) return BENCH_Y;
  const th = Math.atan2(z, x);
  const edge = D.radius * (0.93 + 0.05 * Math.sin(3 * th + 0.7) + 0.03 * Math.sin(7 * th));
  const t = smoothstep(PAD_R * 1.4, edge, r);
  const bumps = 0.006 * Math.sin(9 * x + 2.1) * Math.sin(11 * z - 0.4) * smoothstep(0.1, 0.25, r);
  const y = -D.height * Math.pow(t, 0.8) + bumps * (1 - t);
  return Math.max(y, BENCH_Y);
}

export const TREE_SPOTS: readonly (readonly [number, number, number])[] = [
  // x, z, scale
  [-0.3, 0.22, 1.0],
  [-0.22, 0.32, 0.8],
  [0.24, -0.3, 1.1],
  [0.34, -0.18, 0.85],
  [-0.12, -0.38, 0.95],
  [0.42, 0.12, 0.75],
];

function hillGeometry(): BufferGeometry {
  const rings = 22;
  const segs = 72;
  const pos: number[] = [];
  const col: number[] = [];
  const grassA = new Color(PALETTE.grassA);
  const grassB = new Color(PALETTE.grassB);
  const soil = new Color(PALETTE.soil);
  const rnd = mulberry32(7);
  const vert = (ri: number, si: number): [number, number, number] => {
    const r = (ri / rings) * D.radius;
    const th = (si / segs) * Math.PI * 2;
    const jitter = ri > 0 && ri < rings ? 0.35 * (D.radius / rings) : 0;
    const jr = r + jitter * Math.sin(si * 12.9898 + ri * 78.233);
    const x = jr * Math.cos(th);
    const z = jr * Math.sin(th);
    return [x, heightAt(x, z), z];
  };
  const tmp = new Color();
  for (let ri = 0; ri < rings; ri++) {
    for (let si = 0; si < segs; si++) {
      const a = vert(ri, si);
      const b = vert(ri + 1, si);
      const c = vert(ri + 1, si + 1);
      const d = vert(ri, si + 1);
      for (const tri of [
        [a, b, c],
        [a, c, d],
      ] as const) {
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        const edgeness = smoothstep(-D.height * 0.75, BENCH_Y, cy);
        tmp.copy(rnd() < 0.5 ? grassA : grassB).lerp(soil, edgeness * 0.9);
        for (const v of tri) {
          pos.push(v[0], v[1], v[2]);
          col.push(tmp.r, tmp.g, tmp.b);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(col), 3));
  // triangles were emitted clockwise seen from above; flip to face up
  const idx = g.getAttribute('position');
  for (let k = 0; k < idx.count; k += 3) {
    const x1 = idx.getX(k + 1),
      y1 = idx.getY(k + 1),
      z1 = idx.getZ(k + 1);
    idx.setXYZ(k + 1, idx.getX(k + 2), idx.getY(k + 2), idx.getZ(k + 2));
    idx.setXYZ(k + 2, x1, y1, z1);
  }
  g.computeVertexNormals();
  return g;
}

export interface Diorama extends SceneModule<Group> {
  /** tree trunks and crowns (instanced; fx/trees.ts bends them in the wind) */
  readonly trees: { readonly trunks: InstancedMesh; readonly crowns: InstancedMesh };
}

/** full-scale tree height, m (trunk 4 m + crown to 14 m) */
export const TREE_HEIGHT_M = 14;

export function createDiorama(): Diorama {
  const group = new Group();
  group.name = 'diorama';

  const hillGeo = hillGeometry();
  const hill = new Mesh(
    hillGeo,
    makeMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }, 'environment'),
  );
  hill.receiveShadow = true;
  hill.castShadow = true;
  group.add(hill);

  const padGeo = new CylinderGeometry(PAD_R, PAD_R * 1.08, 0.008, 24);
  const pad = new Mesh(
    padGeo,
    makeMaterial({ color: PALETTE.concrete, roughness: 0.85 }, 'structure'),
  );
  pad.position.y = -0.003;
  pad.receiveShadow = true;
  group.add(pad);

  // Rocks: a few flat-shaded icosahedra merged into one mesh.
  const rnd = mulberry32(3);
  const rocks = [];
  for (const [x, z, s] of [
    [0.36, 0.3, 0.022],
    [0.4, 0.26, 0.014],
    [-0.42, -0.12, 0.026],
    [0.05, 0.47, 0.018],
    [-0.05, -0.5, 0.02],
  ] as const) {
    const g = new IcosahedronGeometry(s, 0);
    g.scale(1, 0.6 + rnd() * 0.3, 0.8 + rnd() * 0.4);
    g.rotateY(rnd() * 6);
    g.translate(x, heightAt(x, z) + s * 0.25, z);
    // polyhedron geometries are already non-indexed, as mergeGeometries needs here
    rocks.push(g);
  }
  const rockGeo = mergeGeometries(rocks);
  rocks.forEach((g) => g.dispose());
  const rockMesh = new Mesh(
    rockGeo,
    makeMaterial({ color: PALETTE.rock, flatShading: true, roughness: 0.9 }, 'environment'),
  );
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  // Trees: 6 instances of trunk + two stacked cones (≈ 15 m tall at full scale).
  const trunkGeo = new CylinderGeometry(toModel(0.5), toModel(0.7), toModel(4), 6);
  trunkGeo.translate(0, toModel(2), 0);
  const c1 = new ConeGeometry(toModel(3.6), toModel(8), 7);
  c1.translate(0, toModel(7), 0);
  const c2 = new ConeGeometry(toModel(2.6), toModel(6), 7);
  c2.translate(0, toModel(11), 0);
  const crownGeo = mergeGeometries([c1.toNonIndexed(), c2.toNonIndexed()]);
  c1.dispose();
  c2.dispose();
  const trunks = new InstancedMesh(
    trunkGeo,
    makeMaterial({ color: PALETTE.bark, flatShading: true, roughness: 0.9 }, 'environment'),
    TREE_SPOTS.length,
  );
  const crowns = new InstancedMesh(
    crownGeo,
    makeMaterial({ color: PALETTE.grassB, flatShading: true, roughness: 0.85 }, 'environment'),
    TREE_SPOTS.length,
  );
  const m = new Matrix4();
  // no yaw: the wind bend works along the geometry's +x, which must stay the wind direction
  const q = new Quaternion();
  TREE_SPOTS.forEach(([x, z, s], k) => {
    m.compose(new Vector3(x, heightAt(x, z) - 0.002, z), q, new Vector3(s, s, s));
    trunks.setMatrixAt(k, m);
    crowns.setMatrixAt(k, m);
  });
  trunks.castShadow = crowns.castShadow = true;
  trunks.receiveShadow = crowns.receiveShadow = true;
  group.add(trunks, crowns);

  return {
    object3d: group,
    trees: { trunks, crowns },
    update() {},
    dispose() {
      [hillGeo, padGeo, rockGeo, trunkGeo, crownGeo].forEach((g) => g.dispose());
    },
  };
}
