/**
 * Rotor assembly (TECH_SPEC §5.1–5.2) in full-scale metres. Frame: origin at the hub centre,
 * rotor axis +x downwind (the parent applies the 5° shaft tilt).
 *
 *   spin    rotation.x = −ψ (azimuth from the sim; clockwise seen from upwind, never eased)
 *   blade k rotation.x = k·120°
 *   precone rotation.z = +2.5° (tips cone upwind, away from the tower)
 *   pitch   rotation.y = +β (β = 90° puts the chord parallel to the rotor axis: edge-on)
 *
 * Flap bending (Loads): vertex offset along the rotor axis Δx(r) = δ_tip (r/R)², via the
 * uniforms uTipDeflection (m) and uPitch (rad) so the offset stays along the axis at any pitch.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  SphereGeometry,
  TorusGeometry,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { PALETTE } from '@/config/theme';
import { BLADES, PRECONE_DEG, RADIUS_M } from '@/config/turbine';
import { createHub, type Hub } from '@/scene/turbine/hub';
import { createBladeGeometry } from '@/scene/turbine/bladeGeometry';
import { createGearGeometry, pitchRadius } from '@/scene/turbine/gears';
import { makeBendMaterial, makeMaterial } from '@/scene/materials';

const DEG = Math.PI / 180;

export interface Rotor {
  readonly object3d: Group;
  readonly spin: Group;
  readonly hub: Hub;
  /** per blade: the pitch group (blade tip anchor is at y = R in it) */
  readonly pitchGroups: readonly Group[];
  readonly bladeMaterials: readonly MeshStandardMaterial[];
  set(psiRad: number, pitchDeg: number, tipDeflectionM: number): void;
  setInternalsVisible(v: boolean): void;
  dispose(): void;
}

/** pitch bearing plane along the blade span, m from the rotor centre */
export const PITCH_BEARING_Y = 1.75;
const PITCH_RING_TEETH = 110;
const PITCH_PINION_TEETH = 14;

function createHubInternals() {
  const m = 3.9 / PITCH_RING_TEETH;
  const rp = pitchRadius(PITCH_RING_TEETH, m);
  const rPinion = pitchRadius(PITCH_PINION_TEETH, m);
  const ringGeo = createGearGeometry({
    teeth: PITCH_RING_TEETH,
    moduleM: m,
    faceWidthM: 0.26,
    internal: true,
    rimRadiusM: rp + 0.14,
    axis: 'y',
  });
  const pinionGeo = createGearGeometry({
    teeth: PITCH_PINION_TEETH,
    moduleM: m,
    faceWidthM: 0.3,
    axis: 'y',
  });
  const raceGeo = new TorusGeometry(rp + 0.3, 0.13, 8, 48);
  raceGeo.rotateX(Math.PI / 2);
  const motorGeo = new CylinderGeometry(0.22, 0.22, 0.75, 16);
  motorGeo.translate(rp - rPinion, PITCH_BEARING_Y - 0.55, 0);
  const boltGeo = new CylinderGeometry(0.04, 0.04, 0.16, 6);
  const boltLocal: Matrix4[] = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    boltLocal.push(
      new Matrix4().makeTranslation(
        (rp + 0.3) * Math.cos(a),
        PITCH_BEARING_Y - 0.12,
        (rp + 0.3) * Math.sin(a),
      ),
    );
  }
  const bodyGeo = new SphereGeometry(1.45, 24, 16);
  bodyGeo.scale(1.25, 1, 1);
  const castMat = makeMaterial({ color: '#6b737f', roughness: 0.6, metalness: 0.6 }, 'rotor');
  const body = new Mesh(bodyGeo, castMat);
  body.position.x = 0.15;
  const gearMat = makeMaterial({ color: PALETTE.brass, roughness: 0.3, metalness: 0.9 }, 'rotor');
  const raceMat = makeMaterial({ color: PALETTE.steel, roughness: 0.35, metalness: 0.8 }, 'rotor');
  const motorMat = makeMaterial({ color: '#2e6f8f', roughness: 0.5, metalness: 0.3 }, 'rotor');
  const parts: Object3D[] = [];
  return {
    ringGeo,
    pinionGeo,
    raceGeo,
    motorGeo,
    boltGeo,
    boltLocal,
    body,
    gearMat,
    raceMat,
    motorMat,
    parts,
    pinionOffset: rp - rPinion,
    ratio: PITCH_RING_TEETH / PITCH_PINION_TEETH,
    dispose() {
      [ringGeo, pinionGeo, raceGeo, motorGeo, boltGeo, bodyGeo].forEach((g) => g.dispose());
      [castMat, gearMat, raceMat, motorMat].forEach((x) => x.dispose());
    },
  };
}

export function createRotor(): Rotor {
  const group = new Group();
  group.name = 'rotor';
  const spin = new Group();
  group.add(spin);

  const hub = createHub();
  spin.add(hub.object3d);

  const uniforms = { uTipDeflection: { value: 0 }, uPitch: { value: 0 } };
  const bend = /* glsl */ `{
    float rr = max(position.y, 0.0) / ${RADIUS_M.toFixed(1)};
    float d = uTipDeflection * rr * rr;
    transformed.x += d * cos(uPitch);
    transformed.z += d * sin(uPitch);
  }`;
  const bladeMat = makeBendMaterial(
    { color: PALETTE.turbine, roughness: 0.45, metalness: 0.1 },
    'rotor',
    uniforms,
    bend,
    'blade-bend',
  );
  const bandMat = makeBendMaterial(
    { color: new Color(PALETTE.tipBand), roughness: 0.5, metalness: 0.05 },
    'rotor',
    uniforms,
    bend,
    'blade-bend',
  );
  const bladeGeo = createBladeGeometry();
  const flangeGeo = new TorusGeometry(1.95, 0.16, 8, 40);
  flangeGeo.rotateX(Math.PI / 2);
  flangeGeo.translate(0, 2.45, 0);
  const flangeMat = makeMaterial({ color: '#8d96a3', roughness: 0.35, metalness: 0.8 }, 'rotor');

  // Hub internals (§5.3): pitch bearing (outer race fixed to the hub, inner ring gear turning
  // with the blade), pitch motor + pinion, cast hub body, instanced bearing bolts.
  const internals = createHubInternals();
  spin.add(internals.body);

  const pitchGroups: Group[] = [];
  const pinions: Mesh[] = [];
  const boltMatrices: Matrix4[] = [];
  for (let k = 0; k < BLADES; k++) {
    const az = new Group();
    az.rotation.x = (k * 2 * Math.PI) / BLADES;
    const precone = new Group();
    precone.rotation.z = PRECONE_DEG * DEG;
    const pitch = new Group();
    const blade = new Mesh(bladeGeo, [bladeMat, bandMat]);
    blade.castShadow = true;
    blade.receiveShadow = true;
    blade.name = `blade-${k + 1}`;
    pitch.add(blade, new Mesh(flangeGeo, flangeMat));
    const ringGear = new Mesh(internals.ringGeo, internals.gearMat);
    ringGear.position.y = PITCH_BEARING_Y;
    internals.parts.push(ringGear);
    pitch.add(ringGear);
    const race = new Mesh(internals.raceGeo, internals.raceMat);
    race.position.y = PITCH_BEARING_Y;
    const motor = new Mesh(internals.motorGeo, internals.motorMat);
    const pinion = new Mesh(internals.pinionGeo, internals.gearMat);
    pinion.position.set(internals.pinionOffset, PITCH_BEARING_Y, 0);
    pinions.push(pinion);
    internals.parts.push(race, motor, pinion);
    precone.add(pitch, race, motor, pinion);
    az.add(precone);
    spin.add(az);
    pitchGroups.push(pitch);
    az.updateMatrix();
    precone.updateMatrix();
    for (const bm of internals.boltLocal) {
      boltMatrices.push(new Matrix4().multiplyMatrices(az.matrix, precone.matrix).multiply(bm));
    }
  }
  const bolts = new InstancedMesh(internals.boltGeo, internals.raceMat, boltMatrices.length);
  boltMatrices.forEach((m, i) => bolts.setMatrixAt(i, m));
  spin.add(bolts);
  internals.parts.push(bolts, internals.body);

  return {
    object3d: group,
    spin,
    hub,
    pitchGroups,
    bladeMaterials: [bladeMat, bandMat],
    set(psiRad, pitchDeg, tipDeflectionM) {
      spin.rotation.x = -psiRad;
      const b = pitchDeg * DEG;
      for (const p of pitchGroups) p.rotation.y = b;
      // internal mesh: the pinion turns the same way as the ring, faster by Z_ring / Z_pinion
      for (const p of pinions) p.rotation.y = b * internals.ratio;
      uniforms.uPitch.value = b;
      uniforms.uTipDeflection.value = tipDeflectionM;
    },
    setInternalsVisible(v) {
      for (const p of internals.parts) p.visible = v;
    },
    dispose() {
      bladeGeo.dispose();
      flangeGeo.dispose();
      bladeMat.dispose();
      bandMat.dispose();
      flangeMat.dispose();
      hub.dispose();
      internals.dispose();
    },
  };
}
