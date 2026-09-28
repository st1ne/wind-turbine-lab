/**
 * Nacelle internals (TECH_SPEC §5.4), full-scale metres.
 *
 * Two frames:
 *   shaft frame   (origin at the hub centre, +x downwind along the tilted shaft): main shaft,
 *                 main bearing, 3-stage 97:1 gearbox, HSS, brake, coupling, generator
 *   nacelle frame (level, origin on the tower axis): bedplate, converter, yaw drives
 *
 * Kinematics from the rotor speed ω (carrier = ω):
 *   stage 1 planetary, ring 99 fixed, planets 39, sun 21:  sun = ω(1 + 99/21) = 5.714ω,
 *           planets spin −(99/39)ω relative to the carrier
 *   stage 2 parallel 83 : 22  → intermediate = −3.773 × sun
 *   stage 3 parallel 72 : 16  → HSS = −4.5 × intermediate = 97.0ω
 * Visual speed cap (§5.4): each part turns at min(|true|, 2.5 rev/s); above the cap a radial
 * motion-blur disc cross-fades in. Labels always show the true speed.
 * Emissives: generator end-windings ∝ P / P_rated (amber), brake disc ∝ brake heat (red).
 */
import {
  AdditiveBlending,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, THEME } from '@/config/theme';
import { P_RATED_W, TOWER_HEIGHT_M } from '@/config/turbine';
import type { SimSnapshot } from '@/physics/types';
import { createCanvasTexture } from '@/scene/canvasTexture';
import { makeMaterial } from '@/scene/materials';
import { createGearGeometry, pitchRadius } from '@/scene/turbine/gears';
import { smoothstep } from '@/util/math';

/** visual speed cap, rad/s (2.5 rev/s) */
export const VISUAL_CAP_RAD_S = 2.5 * 2 * Math.PI;

export const TEETH = {
  ring: 99,
  planet: 39,
  sun: 21,
  s2Gear: 83,
  s2Pinion: 22,
  s3Gear: 72,
  s3Pinion: 16,
} as const;

export const SUN_RATIO = 1 + TEETH.ring / TEETH.sun;
export const PLANET_REL_RATIO = -TEETH.ring / TEETH.planet;
export const INTERMEDIATE_RATIO = -SUN_RATIO * (TEETH.s2Gear / TEETH.s2Pinion);
export const HSS_RATIO = -INTERMEDIATE_RATIO * (TEETH.s3Gear / TEETH.s3Pinion);

// modules chosen for readable proportions: ring Ø ≈ 3.0 m, stage offsets 1.0 m and 0.6 m
const M1 = 3.0 / TEETH.ring;
const S2_OFFSET = 1.0;
const S3_OFFSET = 0.6;
const M2 = (2 * S2_OFFSET) / (TEETH.s2Gear + TEETH.s2Pinion);
const M3 = (2 * S3_OFFSET) / (TEETH.s3Gear + TEETH.s3Pinion);
const PLANET_RADIUS = pitchRadius(TEETH.sun, M1) + pitchRadius(TEETH.planet, M1);
const HSS_Y = S2_OFFSET + S3_OFFSET;

/** axial stations along the shaft frame, m */
export const DT = {
  lssFrom: 1.3,
  lssTo: 6.3,
  mainBearing: 3.4,
  carrier: 6.2,
  stage1: 6.7,
  stage2: 7.9,
  stage3: 8.8,
  brake: 10.1,
  coupling: 11.7,
  genFrom: 12.9,
  genTo: 15.9,
} as const;

/** (y, z) position at angle φ and radius r, matching the gear tooth angle convention */
function polarYZ(phi: number, r: number): [number, number] {
  return [r * Math.sin(phi), -r * Math.cos(phi)];
}

function blurTexture(): ReturnType<typeof createCanvasTexture> {
  const tex = createCanvasTexture(256, 256);
  const { ctx } = tex;
  ctx.translate(128, 128);
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * Math.PI * 2;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.25 * Math.abs(Math.sin(k * 1.7))})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 124, a, a + (Math.PI * 2) / 180);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(0.7, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);
  tex.texture.needsUpdate = true;
  return tex;
}

/**
 * A part the Exploded view moves (§8): `offset` in the part's parent frame (m), `order` sets
 * its 60 ms stagger slot, `guide` whether it gets a dashed line from its home.
 */
export interface ExplodePart {
  readonly obj: Object3D;
  readonly offset: Vector3;
  readonly order: number;
  readonly guide: boolean;
}

/** Exploded offsets along the shaft axis (+x downwind), m. */
export const EXPLODE_M = {
  mainShaft: -2.5,
  mainBearing: -1.2,
  stage23: 1.1,
  hss: 2.4,
  generator: 4.4,
  converter: 4.5,
  yawDrop: -2.2,
} as const;

interface Spinning {
  obj: Object3D;
  ratio: number;
  angle: number;
  phase: number;
}

export interface Drivetrain {
  /** parts in the tilted shaft frame */
  readonly shaftGroup: Group;
  /** parts in the level nacelle frame */
  readonly nacelleGroup: Group;
  /** label anchors (shaft frame or nacelle frame objects) */
  readonly anchors: Record<
    'mainShaft' | 'gearbox' | 'brake' | 'generator' | 'converter' | 'yaw',
    Object3D
  >;
  /** parts spread along the shaft in the Exploded view */
  readonly explode: readonly ExplodePart[];
  update(s: SimSnapshot, dt: number): void;
  setVisible(v: boolean): void;
  dispose(): void;
}

export function createDrivetrain(): Drivetrain {
  const shaftGroup = new Group();
  shaftGroup.name = 'drivetrain';
  const nacelleGroup = new Group();
  nacelleGroup.name = 'nacelle-internals';
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const g = <G extends BufferGeometry>(x: G): G => {
    geos.push(x);
    return x;
  };
  const mat = <M extends Material>(m: M): M => {
    mats.push(m);
    return m;
  };

  const steel = mat(
    makeMaterial({ color: PALETTE.steel, roughness: 0.35, metalness: 0.8 }, 'power'),
  );
  const darkSteel = mat(
    makeMaterial({ color: '#4a525e', roughness: 0.45, metalness: 0.75 }, 'structure'),
  );
  const brass = mat(
    makeMaterial({ color: PALETTE.brass, roughness: 0.3, metalness: 0.9 }, 'power'),
  );
  const housing = mat(
    makeMaterial({ color: '#39414d', roughness: 0.55, metalness: 0.6 }, 'structure'),
  );
  const paint = mat(makeMaterial({ color: '#2e6f8f', roughness: 0.5, metalness: 0.3 }, 'power'));
  const copper = mat(
    makeMaterial(
      {
        color: '#b8733e',
        roughness: 0.35,
        metalness: 0.85,
        emissive: new Color(THEME.power),
        emissiveIntensity: 0,
      },
      'power',
    ),
  );
  const brakeMat = mat(
    makeMaterial(
      {
        color: '#9aa1ab',
        roughness: 0.3,
        metalness: 0.9,
        emissive: new Color(THEME.alarm),
        emissiveIntensity: 0,
      },
      'power',
    ),
  );
  const blur = blurTexture();
  const blurMat = mat(
    new MeshBasicMaterial({
      map: blur.texture,
      color: new Color('#aab4c2'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    }),
  );

  const spinning: Spinning[] = [];
  const addSpinning = (obj: Object3D, ratio: number, phase = 0): void => {
    spinning.push({ obj, ratio, angle: 0, phase });
  };

  // ---------------------------------------------------------------- main shaft + bearing
  const lss = new Group();
  lss.name = 'main-shaft';
  const lssLen = DT.lssTo - DT.lssFrom;
  const lssGeo = g(new CylinderGeometry(0.5, 0.5, lssLen, 32));
  lssGeo.rotateZ(Math.PI / 2);
  lss.add(new Mesh(lssGeo, steel));
  const flangeGeo = g(new CylinderGeometry(0.85, 0.85, 0.16, 40));
  flangeGeo.rotateZ(Math.PI / 2);
  const flange = new Mesh(flangeGeo, steel);
  flange.position.x = -lssLen / 2 + 0.1;
  lss.add(flange);
  lss.position.x = (DT.lssFrom + DT.lssTo) / 2;
  shaftGroup.add(lss);
  addSpinning(lss, 1);

  // bolts on the rotating flange (instanced)
  const boltGeo = g(new CylinderGeometry(0.045, 0.045, 0.12, 6));
  boltGeo.rotateZ(Math.PI / 2);
  const flangeBolts = new InstancedMesh(boltGeo, darkSteel, 24);
  const m4 = new Matrix4();
  for (let k = 0; k < 24; k++) {
    const [y, z] = polarYZ((k / 24) * Math.PI * 2, 0.7);
    flangeBolts.setMatrixAt(k, m4.makeTranslation(-lssLen / 2 + 0.2, y, z));
  }
  lss.add(flangeBolts);

  const bearingParts: BufferGeometry[] = [];
  const bRing = new TorusGeometry(0.78, 0.22, 10, 40);
  bRing.rotateY(Math.PI / 2);
  bearingParts.push(bRing);
  const bBlock = new BoxGeometry(1.4, 0.9, 2.2);
  bBlock.translate(0, -0.75, 0);
  bearingParts.push(bBlock);
  const bearingGeo = g(mergeGeometries(bearingParts.map((x) => x.toNonIndexed())));
  bearingParts.forEach((x) => x.dispose());
  const bearing = new Mesh(bearingGeo, housing);
  bearing.position.x = DT.mainBearing;
  shaftGroup.add(bearing);

  // ---------------------------------------------------------------- stage 1: planetary
  const face1 = 0.46;
  const ringGeo = g(
    createGearGeometry({
      teeth: TEETH.ring,
      moduleM: M1,
      faceWidthM: face1,
      internal: true,
      rimRadiusM: pitchRadius(TEETH.ring, M1) + 0.16,
    }),
  );
  const ring = new Mesh(ringGeo, housing);
  ring.position.x = DT.stage1;
  shaftGroup.add(ring);

  const carrier = new Group();
  carrier.name = 'carrier';
  carrier.position.x = DT.carrier;
  const carrierGeo = g(new CylinderGeometry(1.25, 1.25, 0.14, 48));
  carrierGeo.rotateZ(Math.PI / 2);
  carrier.add(new Mesh(carrierGeo, steel));
  shaftGroup.add(carrier);
  addSpinning(carrier, 1);

  const sunGeo = g(createGearGeometry({ teeth: TEETH.sun, moduleM: M1, faceWidthM: face1 + 0.02 }));
  const planetGeo = g(
    createGearGeometry({ teeth: TEETH.planet, moduleM: M1, faceWidthM: face1, boreRadiusM: 0.09 }),
  );
  const pinGeo = g(new CylinderGeometry(0.09, 0.09, face1 + 0.6, 12));
  pinGeo.rotateZ(Math.PI / 2);
  const pSun = (2 * Math.PI) / TEETH.sun;
  const pPlanet = (2 * Math.PI) / TEETH.planet;
  for (let k = 0; k < 3; k++) {
    const phi = (k * 2 * Math.PI) / 3;
    const [y, z] = polarYZ(phi, PLANET_RADIUS);
    const planet = new Mesh(planetGeo, brass);
    planet.position.set(DT.stage1 - DT.carrier, y, z);
    const pin = new Mesh(pinGeo, darkSteel);
    pin.position.set(DT.stage1 - DT.carrier - 0.2, y, z);
    carrier.add(planet, pin);
    // assembly: sun shows a gap toward each planet, so each planet shows a tooth to the sun
    addSpinning(planet, PLANET_REL_RATIO, phi - 0.5 * pPlanet);
  }

  const sunShaft = new Group();
  sunShaft.name = 'sun-shaft';
  sunShaft.position.x = DT.stage1;
  const sun = new Mesh(sunGeo, steel);
  sunShaft.add(sun);
  const sunAxle = g(new CylinderGeometry(0.14, 0.14, DT.stage2 - DT.stage1 + 0.4, 16));
  sunAxle.rotateZ(Math.PI / 2);
  const sunAxleMesh = new Mesh(sunAxle, steel);
  sunAxleMesh.position.x = (DT.stage2 - DT.stage1) / 2;
  sunShaft.add(sunAxleMesh);
  const s2GearGeo = g(
    createGearGeometry({ teeth: TEETH.s2Gear, moduleM: M2, faceWidthM: 0.24, boreRadiusM: 0.14 }),
  );
  const s2Gear = new Mesh(s2GearGeo, brass);
  s2Gear.position.x = DT.stage2 - DT.stage1;
  sunShaft.add(s2Gear);
  shaftGroup.add(sunShaft);
  addSpinning(sunShaft, SUN_RATIO, 0.5 * pSun);

  // ---------------------------------------------------------------- stages 2–3: parallel
  const inter = new Group();
  inter.name = 'intermediate-shaft';
  inter.position.set(DT.stage2, S2_OFFSET, 0);
  const s2PinionGeo = g(
    createGearGeometry({ teeth: TEETH.s2Pinion, moduleM: M2, faceWidthM: 0.26 }),
  );
  inter.add(new Mesh(s2PinionGeo, steel));
  const interAxle = g(new CylinderGeometry(0.09, 0.09, DT.stage3 - DT.stage2 + 0.5, 12));
  interAxle.rotateZ(Math.PI / 2);
  const interAxleMesh = new Mesh(interAxle, steel);
  interAxleMesh.position.x = (DT.stage3 - DT.stage2) / 2;
  inter.add(interAxleMesh);
  const s3GearGeo = g(
    createGearGeometry({ teeth: TEETH.s3Gear, moduleM: M3, faceWidthM: 0.2, boreRadiusM: 0.09 }),
  );
  const s3Gear = new Mesh(s3GearGeo, brass);
  s3Gear.position.x = DT.stage3 - DT.stage2;
  inter.add(s3Gear);
  shaftGroup.add(inter);
  addSpinning(inter, INTERMEDIATE_RATIO);

  // ---------------------------------------------------------------- HSS, brake, coupling
  const hss = new Group();
  hss.name = 'hss';
  hss.position.set(DT.stage3, HSS_Y, 0);
  const s3PinionGeo = g(
    createGearGeometry({ teeth: TEETH.s3Pinion, moduleM: M3, faceWidthM: 0.22 }),
  );
  hss.add(new Mesh(s3PinionGeo, steel));
  const hssLen = DT.genFrom - DT.stage3 + 0.3;
  const hssGeo = g(new CylinderGeometry(0.12, 0.12, hssLen, 16));
  hssGeo.rotateZ(Math.PI / 2);
  const hssMesh = new Mesh(hssGeo, steel);
  hssMesh.position.x = hssLen / 2;
  hss.add(hssMesh);
  const discGeo = g(new CylinderGeometry(0.6, 0.6, 0.07, 48));
  discGeo.rotateZ(Math.PI / 2);
  const disc = new Mesh(discGeo, brakeMat);
  disc.position.x = DT.brake - DT.stage3;
  hss.add(disc);
  const couplingParts: BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const t = new TorusGeometry(0.26, 0.07, 8, 24);
    t.rotateY(Math.PI / 2);
    t.translate(k * 0.16 - 0.16, 0, 0);
    couplingParts.push(t);
  }
  const couplingGeo = g(mergeGeometries(couplingParts));
  couplingParts.forEach((x) => x.dispose());
  const coupling = new Mesh(couplingGeo, paint);
  coupling.position.x = DT.coupling - DT.stage3;
  hss.add(coupling);
  shaftGroup.add(hss);
  addSpinning(hss, HSS_RATIO);

  // blur discs (not spinning themselves; they fade with speed)
  const blurDiscs: { mesh: Mesh; ratio: number; explodeX: number; order: number }[] = [];
  const addBlur = (
    parent: Object3D,
    x: number,
    y: number,
    r: number,
    ratio: number,
    explodeX = 0,
    order = 0,
  ): void => {
    const d = g(new CircleGeometry(r, 48));
    d.rotateY(Math.PI / 2);
    const m = new Mesh(d, blurMat.clone());
    mats.push(m.material as Material);
    m.position.set(x, y, 0);
    m.renderOrder = 2;
    parent.add(m);
    blurDiscs.push({ mesh: m, ratio, explodeX, order });
  };
  const s23 = EXPLODE_M.stage23;
  const hx = EXPLODE_M.hss;
  addBlur(
    shaftGroup,
    DT.stage2 + 0.14,
    S2_OFFSET,
    pitchRadius(TEETH.s2Pinion, M2) + M2 * 1.5,
    INTERMEDIATE_RATIO,
    s23,
    3,
  );
  addBlur(
    shaftGroup,
    DT.stage3 - 0.12,
    S2_OFFSET,
    pitchRadius(TEETH.s3Gear, M3) + M3 * 1.5,
    INTERMEDIATE_RATIO,
    s23,
    3,
  );
  addBlur(
    shaftGroup,
    DT.stage3 + 0.13,
    HSS_Y,
    pitchRadius(TEETH.s3Pinion, M3) + M3 * 1.5,
    HSS_RATIO,
    hx,
    4,
  );
  addBlur(shaftGroup, DT.brake + 0.05, HSS_Y, 0.62, HSS_RATIO, hx, 4);
  addBlur(shaftGroup, DT.coupling + 0.25, HSS_Y, 0.36, HSS_RATIO, hx, 4);

  // brake caliper (fixed) straddling the top of the disc
  const caliperGeo = g(new BoxGeometry(0.3, 0.32, 0.36));
  const caliper = new Mesh(
    caliperGeo,
    mat(makeMaterial({ color: '#b3342c', roughness: 0.5 }, 'power')),
  );
  caliper.position.set(DT.brake, HSS_Y + 0.52, 0);
  shaftGroup.add(caliper);

  // gearbox torque arms / supports under the stages
  const gbSupport = g(new BoxGeometry(2.4, 0.4, 2.8));
  const gbSupportMesh = new Mesh(gbSupport, housing);
  gbSupportMesh.position.set(DT.stage2, -1.35, 0);
  shaftGroup.add(gbSupportMesh);

  // ---------------------------------------------------------------- generator
  const genLen = DT.genTo - DT.genFrom;
  const gen = new Group();
  gen.name = 'generator';
  gen.position.set((DT.genFrom + DT.genTo) / 2, HSS_Y, 0);
  const statorGeo = g(new CylinderGeometry(0.95, 0.95, genLen - 0.5, 40, 1, true));
  statorGeo.rotateZ(Math.PI / 2);
  gen.add(new Mesh(statorGeo, paint));
  const finParts: BufferGeometry[] = [];
  for (let k = 0; k < 20; k++) {
    const fin = new BoxGeometry(genLen - 0.7, 0.16, 0.05);
    fin.translate(0, 1.0, 0);
    fin.rotateX((k / 20) * Math.PI * 2);
    finParts.push(fin);
  }
  const finGeo = g(mergeGeometries(finParts));
  finParts.forEach((x) => x.dispose());
  gen.add(new Mesh(finGeo, paint));
  // copper end windings (emissive ∝ power) at both ends of the stator
  const windGeo = g(new TorusGeometry(0.72, 0.17, 10, 40));
  windGeo.rotateY(Math.PI / 2);
  for (const x of [-(genLen - 0.5) / 2, (genLen - 0.5) / 2]) {
    const w = new Mesh(windGeo, copper);
    w.position.x = x;
    gen.add(w);
  }
  const endCapGeo = g(new CylinderGeometry(0.6, 0.6, 0.08, 32));
  endCapGeo.rotateZ(Math.PI / 2);
  const genRotor = new Group();
  const endCap = new Mesh(endCapGeo, steel);
  endCap.position.x = genLen / 2 - 0.1;
  const spokeGeo = g(new BoxGeometry(0.1, 1.1, 0.12));
  const spokes = new Mesh(spokeGeo, darkSteel);
  spokes.position.x = genLen / 2 - 0.04;
  genRotor.add(endCap, spokes);
  gen.add(genRotor);
  shaftGroup.add(gen);
  addSpinning(genRotor, HSS_RATIO);
  addBlur(gen, genLen / 2 + 0.02, 0, 0.62, HSS_RATIO);
  const genFeet = g(new BoxGeometry(2.4, 0.6, 1.6));
  const genFeetMesh = new Mesh(genFeet, housing);
  genFeetMesh.position.set(0, -1.1, 0);
  gen.add(genFeetMesh);

  // ---------------------------------------------------------------- nacelle frame parts
  const bedParts: BufferGeometry[] = [];
  const bedBase = new BoxGeometry(17.2, 0.3, 3.6);
  bedBase.translate(6.3, TOWER_HEIGHT_M + 0.7, 0);
  bedParts.push(bedBase);
  for (const z of [-1.7, 1.7]) {
    const rail = new BoxGeometry(17.2, 0.7, 0.25);
    rail.translate(6.3, TOWER_HEIGHT_M + 1.05, z);
    bedParts.push(rail);
  }
  const bedGeo = g(mergeGeometries(bedParts));
  bedParts.forEach((x) => x.dispose());
  nacelleGroup.add(new Mesh(bedGeo, darkSteel));

  const yawGeoParts: BufferGeometry[] = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const motor = new CylinderGeometry(0.28, 0.28, 1.3, 14);
    motor.translate(2.25 * Math.cos(a), TOWER_HEIGHT_M + 1.25, 2.25 * Math.sin(a));
    const cap = new CylinderGeometry(0.33, 0.33, 0.18, 14);
    cap.translate(2.25 * Math.cos(a), TOWER_HEIGHT_M + 1.95, 2.25 * Math.sin(a));
    yawGeoParts.push(motor, cap);
  }
  const yawGeo = g(mergeGeometries(yawGeoParts));
  yawGeoParts.forEach((x) => x.dispose());
  const yaw = new Mesh(yawGeo, paint);
  yaw.name = 'yaw-drives';
  nacelleGroup.add(yaw);

  const converter = new Group();
  converter.name = 'converter';
  converter.position.set(12.4, TOWER_HEIGHT_M + 2.35, -1.55);
  const cabGeo = g(new BoxGeometry(2.6, 2.6, 1.0));
  converter.add(new Mesh(cabGeo, mat(makeMaterial({ color: '#c9ced6', roughness: 0.6 }, 'power'))));
  const ventParts: BufferGeometry[] = [];
  for (let k = 0; k < 6; k++) {
    const v = new BoxGeometry(1.6, 0.06, 0.02);
    v.translate(-0.25, 0.8 - k * 0.16, 0.51);
    ventParts.push(v);
  }
  const ventGeo = g(mergeGeometries(ventParts));
  ventParts.forEach((x) => x.dispose());
  converter.add(new Mesh(ventGeo, darkSteel));
  const ledGeo = g(new BoxGeometry(0.1, 0.1, 0.03));
  const ledOk = mat(new MeshBasicMaterial({ color: new Color(THEME.ok).multiplyScalar(3) }));
  const ledPower = mat(new MeshBasicMaterial({ color: new Color(THEME.power).multiplyScalar(3) }));
  const leds: Mesh[] = [];
  for (let k = 0; k < 3; k++) {
    const led = new Mesh(ledGeo, k === 0 ? ledOk : ledPower);
    led.position.set(0.85, 0.9 - k * 0.2, 0.51);
    converter.add(led);
    leds.push(led);
  }
  nacelleGroup.add(converter);

  // internals don't cast shadows (the shell does); keeps the shadow pass cheap
  [shaftGroup, nacelleGroup].forEach((grp) =>
    grp.traverse((o) => {
      if (o instanceof Mesh) o.receiveShadow = true;
    }),
  );

  const yawAnchor = new Object3D();
  yawAnchor.position.set(2.3, TOWER_HEIGHT_M + 1.9, 1.6);
  nacelleGroup.add(yawAnchor);

  let blinkT = 0;

  const along = (x: number): Vector3 => new Vector3(x, 0, 0);
  const explode: ExplodePart[] = [
    { obj: lss, offset: along(EXPLODE_M.mainShaft), order: 1, guide: true },
    { obj: bearing, offset: along(EXPLODE_M.mainBearing), order: 2, guide: true },
    { obj: sunShaft, offset: along(EXPLODE_M.stage23), order: 3, guide: true },
    { obj: inter, offset: along(EXPLODE_M.stage23), order: 3, guide: false },
    { obj: hss, offset: along(EXPLODE_M.hss), order: 4, guide: true },
    { obj: caliper, offset: along(EXPLODE_M.hss), order: 4, guide: false },
    { obj: gen, offset: along(EXPLODE_M.generator), order: 5, guide: true },
    { obj: converter, offset: along(EXPLODE_M.converter), order: 6, guide: true },
    { obj: yaw, offset: new Vector3(0, EXPLODE_M.yawDrop, 0), order: 6, guide: false },
    ...blurDiscs.map((b) => ({
      obj: b.mesh,
      offset: along(b.explodeX),
      order: b.order,
      guide: false,
    })),
  ];

  return {
    shaftGroup,
    nacelleGroup,
    anchors: {
      mainShaft: lss,
      gearbox: ring,
      brake: caliper,
      generator: gen,
      converter,
      yaw: yawAnchor,
    },
    explode,
    update(s, dt) {
      const omega = s.omega;
      for (const sp of spinning) {
        const w = sp.ratio * omega;
        const vis = Math.sign(w) * Math.min(Math.abs(w), VISUAL_CAP_RAD_S);
        sp.angle = (sp.angle + vis * dt) % (Math.PI * 2 * 1e6);
        sp.obj.rotation.x = sp.angle + sp.phase;
      }
      for (const b of blurDiscs) {
        const w = Math.abs(b.ratio * omega);
        const k = smoothstep(VISUAL_CAP_RAD_S, 2 * VISUAL_CAP_RAD_S, w);
        (b.mesh.material as MeshBasicMaterial).opacity = 0.75 * k;
        b.mesh.visible = k > 0.01;
        b.mesh.rotation.x += VISUAL_CAP_RAD_S * dt * Math.sign(b.ratio);
      }
      copper.emissiveIntensity = 2.2 * Math.min(Math.max(s.Pel / P_RATED_W, 0), 1.1);
      brakeMat.emissiveIntensity = 3 * (1 - Math.exp(-s.brakeHeat / 1.5e7));
      blinkT += dt;
      const [, ledRun, ledBlink] = leds;
      if (ledRun) ledRun.visible = s.Pel > 1e4;
      if (ledBlink) ledBlink.visible = s.Pel > 1e4 && blinkT % 0.8 < 0.4;
    },
    setVisible(v) {
      shaftGroup.visible = v;
      nacelleGroup.visible = v;
    },
    dispose() {
      geos.forEach((x) => x.dispose());
      mats.forEach((x) => x.dispose());
      blur.texture.dispose();
    },
  };
}
