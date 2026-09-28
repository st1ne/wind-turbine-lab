/**
 * Two low-poly clouds hanging on thin wires above the bench (TECH_SPEC §4.1, §11). Their colour
 * lerps from #d7deea to #3b4257 with the storm level and they bob slightly; the lightning
 * module lights them from inside for a flash.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENVIRONMENT } from '@/config/environment';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { mulberry32 } from '@/util/math';

const FAIR = new Color('#d7deea');
const STORM = new Color('#3b4257');
const CEILING_Y = ENVIRONMENT.room.floorY + 5.2;
const SPOTS = [
  { x: -0.55, y: 1.25, z: -0.15, scale: 1 },
  { x: 0.95, y: 1.4, z: 0.05, scale: 0.8 },
] as const;

export interface Clouds extends SceneModule<Group> {
  /** 0–1 inner glow for lightning */
  setFlash(k: number): void;
  readonly centers: readonly { x: number; y: number; z: number }[];
}

function cloudGeometry(seed: number): BufferGeometry {
  const rnd = mulberry32(seed);
  const puffs: BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const r = 0.07 + rnd() * 0.07;
    const g = new IcosahedronGeometry(r, 1);
    g.scale(1, 0.72, 0.9);
    g.translate((k - 3) * 0.06 + (rnd() - 0.5) * 0.04, (rnd() - 0.3) * 0.05, (rnd() - 0.5) * 0.08);
    puffs.push(g);
  }
  const merged = mergeGeometries(puffs);
  puffs.forEach((g) => g.dispose());
  return merged;
}

export function createClouds(): Clouds {
  const group = new Group();
  group.name = 'clouds';
  const mat = makeMaterial(
    {
      color: FAIR.clone(),
      flatShading: true,
      roughness: 0.95,
      emissive: new Color('#dfe8ff'),
      emissiveIntensity: 0,
    },
    'environment',
  );
  const geos: BufferGeometry[] = [];
  const clouds = SPOTS.map((spot, i) => {
    const geo = cloudGeometry(5 + i);
    geos.push(geo);
    const mesh = new Mesh(geo, mat);
    mesh.scale.setScalar(spot.scale);
    mesh.position.set(spot.x, spot.y, spot.z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  });

  // two wires per cloud up to the ceiling
  const wirePts: number[] = [];
  for (const spot of SPOTS) {
    for (const dx of [-0.12, 0.12]) {
      wirePts.push(
        spot.x + dx * spot.scale,
        spot.y,
        spot.z,
        spot.x + dx * spot.scale,
        CEILING_Y,
        spot.z,
      );
    }
  }
  const wireGeo = new BufferGeometry();
  wireGeo.setAttribute('position', new BufferAttribute(new Float32Array(wirePts), 3));
  geos.push(wireGeo);
  const wireMat = new LineBasicMaterial({ color: '#4a5160', transparent: true, opacity: 0.6 });
  const wires = new LineSegments(wireGeo, wireMat);
  group.add(wires);

  return {
    object3d: group,
    centers: SPOTS,
    setFlash(k) {
      mat.emissiveIntensity = 1.4 * k;
    },
    update(s) {
      mat.color.copy(FAIR).lerp(STORM, s.stormLevel);
      clouds.forEach((c, i) => {
        const spot = SPOTS[i] as (typeof SPOTS)[number];
        c.position.y = spot.y + 0.01 * Math.sin(s.t * 0.7 + i * 2) * (0.5 + s.stormLevel);
        c.rotation.z = 0.02 * Math.sin(s.t * 0.5 + i) * s.stormLevel;
      });
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mat.dispose();
      wireMat.dispose();
    },
  };
}
