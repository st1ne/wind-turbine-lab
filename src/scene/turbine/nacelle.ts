/**
 * Nacelle exterior (TECH_SPEC §5.1, §5.4) in full-scale metres: an 18 × 6 × 6 m rounded shell
 * built as two halves split by the vertical plane through the shaft axis (so the cutaway can drop
 * one), a yaw bearing ring, a roof radiator with slats, an anemometer (cups spin ∝ V) and wind
 * vane, a red aviation light blinking at 1 Hz, and a service crane.
 * The nacelle frame has x downwind along the shaft, origin on the tower axis.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/config/theme';
import { NACELLE_SIZE_M, TOWER_HEIGHT_M, TOWER_TOP_DIAMETER_M } from '@/config/turbine';
import { makeMaterial } from '@/scene/materials';

export const NACELLE = {
  frontX: -2.7,
  bottomY: TOWER_HEIGHT_M + 0.25,
  get centerY(): number {
    return this.bottomY + NACELLE_SIZE_M.height / 2;
  },
  get topY(): number {
    return this.bottomY + NACELLE_SIZE_M.height;
  },
} as const;

const BEVEL = 0.8;
const CORNER = 1.1;

export interface Nacelle {
  readonly object3d: Group;
  /** the two shell halves: [+z side, −z side] */
  readonly halves: readonly [Mesh, Mesh];
  /** world-space anchor objects for labels */
  readonly anchors: { anemometer: Group; light: Mesh };
  update(windMs: number, timeS: number, dt: number): void;
  dispose(): void;
}

function halfShell(side: 1 | -1): ExtrudeGeometry {
  const hw = NACELLE_SIZE_M.width / 2 - BEVEL;
  const hh = NACELLE_SIZE_M.height / 2 - BEVEL;
  // Shape coordinates (u, v) = (−z, y) so that rotateY(+90°) maps extrusion → +x, u → −z.
  const u = -side * hw;
  // The bevel grows the outline by BEVEL on every side, so the flat inner edge starts BEVEL
  // away from the split plane and ends up exactly on z = 0.
  const u0 = -side * BEVEL;
  const s = new Shape();
  s.moveTo(u0, -hh);
  s.lineTo(u + (u > 0 ? -CORNER : CORNER), -hh);
  s.quadraticCurveTo(u, -hh, u, -hh + CORNER);
  s.lineTo(u, hh - CORNER);
  s.quadraticCurveTo(u, hh, u + (u > 0 ? -CORNER : CORNER), hh);
  s.lineTo(u0, hh);
  s.closePath();
  const depth = NACELLE_SIZE_M.length - 2 * BEVEL;
  const g = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 4,
    curveSegments: 8,
  });
  g.rotateY(Math.PI / 2);
  g.translate(NACELLE.frontX + BEVEL, NACELLE.centerY, 0);
  g.computeVertexNormals();
  return g;
}

export function createNacelle(): Nacelle {
  const group = new Group();
  group.name = 'nacelle';
  const geos: BufferGeometry[] = [];
  const shellMat = makeMaterial(
    { color: PALETTE.turbine, roughness: 0.45, metalness: 0.1 },
    'structure',
  );
  const darkMat = makeMaterial({ color: '#59616d', roughness: 0.5, metalness: 0.6 }, 'structure');

  // The far half has its own material so the cutaway can render its inside (BackSide).
  const shellMatB = makeMaterial(
    { color: PALETTE.turbine, roughness: 0.45, metalness: 0.1 },
    'structure',
  );
  const hA = halfShell(1);
  const hB = halfShell(-1);
  geos.push(hA, hB);
  const halfA = new Mesh(hA, shellMat);
  const halfB = new Mesh(hB, shellMatB);
  halfA.name = 'nacelle-shell-front';
  halfB.name = 'nacelle-shell-back';
  for (const h of [halfA, halfB]) {
    h.castShadow = true;
    h.receiveShadow = true;
    group.add(h);
  }

  // Yaw bearing ring on the tower top.
  const yaw = new TorusGeometry(TOWER_TOP_DIAMETER_M / 2 + 0.2, 0.22, 8, 48);
  yaw.rotateX(Math.PI / 2);
  yaw.translate(0, TOWER_HEIGHT_M + 0.12, 0);
  geos.push(yaw);
  group.add(new Mesh(yaw, darkMat));

  // Roof radiator: a frame with vertical slats, merged.
  const top = NACELLE.topY;
  const rad: BufferGeometry[] = [];
  const frame = new BoxGeometry(3.4, 0.25, 4.4);
  frame.translate(12.6, top + 1.7, 0);
  rad.push(frame);
  for (let k = 0; k < 12; k++) {
    const slat = new BoxGeometry(0.1, 1.5, 4.2);
    slat.translate(11.1 + k * 0.27, top + 0.8, 0);
    rad.push(slat);
  }
  for (const z of [-2.1, 2.1]) {
    const post = new BoxGeometry(3.4, 1.6, 0.12);
    post.translate(12.6, top + 0.8, z);
    rad.push(post);
  }
  const radGeo = mergeGeometries(rad);
  rad.forEach((g) => g.dispose());
  geos.push(radGeo);
  const radiator = new Mesh(radGeo, darkMat);
  radiator.castShadow = true;
  group.add(radiator);

  // Instrument mast with anemometer and vane.
  const mast = new CylinderGeometry(0.09, 0.12, 3.2, 8);
  mast.translate(15.4, top + 1.6, 0);
  const boom = new CylinderGeometry(0.06, 0.06, 3.4, 6);
  boom.rotateX(Math.PI / 2);
  boom.translate(15.4, top + 3.1, 0);
  const mastGeo = mergeGeometries([mast, boom]);
  mast.dispose();
  boom.dispose();
  geos.push(mastGeo);
  group.add(new Mesh(mastGeo, darkMat));

  const anemometer = new Group();
  anemometer.position.set(15.4, top + 3.2, 1.6);
  const cupParts: BufferGeometry[] = [];
  const spindle = new CylinderGeometry(0.05, 0.05, 0.7, 6);
  spindle.translate(0, 0.35, 0);
  cupParts.push(spindle);
  for (let k = 0; k < 3; k++) {
    const arm = new CylinderGeometry(0.03, 0.03, 0.8, 5);
    arm.rotateZ(Math.PI / 2);
    arm.translate(0.4, 0.7, 0);
    const cup = new SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cup.rotateZ(Math.PI / 2);
    cup.translate(0.8, 0.7, 0.08);
    for (const g of [arm, cup]) {
      g.rotateY((k * 2 * Math.PI) / 3);
      cupParts.push(g);
    }
  }
  const cupsGeo = mergeGeometries(cupParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  cupParts.forEach((g) => g.dispose());
  geos.push(cupsGeo);
  const cups = new Mesh(cupsGeo, makeMaterial({ color: '#d7dce3', roughness: 0.4 }, 'wind'));
  anemometer.add(cups);
  group.add(anemometer);

  const vane = new Group();
  vane.position.set(15.4, top + 3.2, -1.6);
  const vaneParts = [new CylinderGeometry(0.04, 0.04, 0.6, 6), new BoxGeometry(1.1, 0.5, 0.04)];
  (vaneParts[0] as BufferGeometry).translate(0, 0.3, 0);
  (vaneParts[1] as BufferGeometry).translate(0.55, 0.65, 0);
  const vaneGeo = mergeGeometries(vaneParts.map((g) => g.toNonIndexed()));
  vaneParts.forEach((g) => g.dispose());
  geos.push(vaneGeo);
  vane.add(new Mesh(vaneGeo, darkMat));
  group.add(vane);

  // Aviation light: always on, blinking at 1 Hz (bloom).
  const lightGeo = new SphereGeometry(0.28, 12, 8);
  geos.push(lightGeo);
  const lightOn = new Color(PALETTE.tipBand).multiplyScalar(6);
  const lightOff = new Color('#3a0b0b');
  const lightMat = new MeshBasicMaterial({ color: lightOn.clone() });
  const light = new Mesh(lightGeo, lightMat);
  light.position.set(14.2, top + 0.55, 0);
  group.add(light);

  // Service crane at the front of the roof.
  const crane = [new CylinderGeometry(0.1, 0.12, 1.8, 8), new BoxGeometry(3.2, 0.14, 0.14)];
  (crane[0] as BufferGeometry).translate(1.5, top + 0.9, -1.8);
  (crane[1] as BufferGeometry).translate(0.1, top + 1.75, -1.8);
  const craneGeo = mergeGeometries(crane.map((g) => g.toNonIndexed()));
  crane.forEach((g) => g.dispose());
  geos.push(craneGeo);
  group.add(new Mesh(craneGeo, darkMat));

  return {
    object3d: group,
    halves: [halfA, halfB],
    anchors: { anemometer, light },
    update(windMs, timeS, dt) {
      // cups: ≈ 0.25 rev/s per m/s would strobe; cap at 3 rev/s visually
      anemometer.rotation.y -= Math.min(0.25 * windMs, 3) * 2 * Math.PI * dt;
      const on = timeS % 1 < 0.5;
      lightMat.color.copy(on ? lightOn : lightOff);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      shellMat.dispose();
      shellMatB.dispose();
      darkMat.dispose();
      lightMat.dispose();
    },
  };
}
