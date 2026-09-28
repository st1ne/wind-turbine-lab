/**
 * The §3.7 label table: anchors, live values (all from src/physics via format.ts) and the
 * Follow / View rules, plus the coarse occlusion proxies.
 *
 * | Name          | Value                     | Visible in                 |
 * | Upstream      | V                         | All, Wind                  |
 * | At the rotor  | (1 − a) V                 | All, Wind                  |
 * | Wake          | u(2R) = V[1 − a(1 + 2/√5)] | All, Wind                  |
 * | Blade tip     | ωR · km/h                 | All, Wind (real rotor)     |
 * | Pitch         | β                         | All, Power (real rotor)    |
 * | Main shaft    | rpm · LSS torque          | Cutaway, Exploded          |
 * | Gearbox       | 97 : 1                    | Cutaway, Exploded          |
 * | Brake         | released / ON             | Cutaway, Exploded          |
 * | Generator     | generator rpm · P         | Cutaway, Exploded, Power   |
 * | Converter     | 690 V                     | Exploded                   |
 * | Yaw           | facing the wind           | Exploded                   |
 * | Anemometer    | V                         | All                        |
 * | Thrust        | T ≈ tonnes                | Loads                      |
 * | Sway          | δ_top (×25)               | Loads                      |
 * | Base moment   | T · h_hub                 | Loads                      |
 * | Homes         | ≈ P / 0.4 kW              | Power                      |
 * | Person        | 1.8 m                     | Loads                      |
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { ENVIRONMENT } from '@/config/environment';
import {
  CONVERTER_VOLTAGE_V,
  G_M_S2,
  GEAR_RATIO,
  NACELLE_SIZE_M,
  RADIUS_M,
  TOWER_BASE_DIAMETER_M,
  TOWER_HEIGHT_M,
  TOWER_TOP_DIAMETER_M,
} from '@/config/turbine';
import { axialVelocity } from '@/physics/actuatorDisk';
import {
  fixed,
  fmtDeg,
  fmtKN,
  fmtM,
  fmtMNm,
  fmtMs,
  fmtMW,
  fmtRpm,
  grouped,
  NBSP,
} from '@/physics/format';
import {
  baseMomentNm,
  homesPowered,
  lssTorqueNm,
  tipSpeedMs,
  towerTopDeflectionM,
} from '@/physics/loads';
import type { Village } from '@/scene/environment/village';
import { diskFlow } from '@/scene/fx/diskFlow';
import type { Flow } from '@/scene/fx/flow';
import type { LabelSpec, OcclusionProxy } from '@/scene/labels';
import { NACELLE } from '@/scene/turbine/nacelle';
import { SPINNER } from '@/scene/turbine/hub';
import { TOWER_EXAGGERATION_LOADS, type Turbine } from '@/scene/turbine/turbine';
import type { UiState } from '@/state/uiState';

const RPM = 30 / Math.PI;

const inFollow =
  (...modes: UiState['follow'][]) =>
  (ui: Readonly<UiState>): boolean =>
    modes.includes(ui.follow);
const inView = (ui: Readonly<UiState>, ...views: UiState['view'][]): boolean =>
  views.includes(ui.view);
const real = (ui: Readonly<UiState>): boolean => ui.rotorMode === 'real';

export interface LabelSetup {
  readonly specs: LabelSpec[];
  readonly proxies: OcclusionProxy[];
  dispose(): void;
}

export function createLabelDefs(
  scene: Object3D,
  turbine: Turbine,
  flow: Flow,
  village: Village,
  person: Object3D,
): LabelSetup {
  const { rotor, drivetrain, nacelle, tower } = turbine;
  const root = turbine.object3d;
  const blade = rotor.pitchGroups[0] as Object3D;

  // ---- occlusion proxies (invisible; raycasts ignore visibility)
  const geos: BufferGeometry[] = [];
  const mat = new MeshBasicMaterial();
  const proxy = (geo: BufferGeometry, parent: Object3D, name: string): Mesh => {
    geos.push(geo);
    const m = new Mesh(geo, mat);
    m.name = `proxy-${name}`;
    m.visible = false;
    parent.add(m);
    return m;
  };
  const towerGeo = new CylinderGeometry(
    TOWER_TOP_DIAMETER_M / 2,
    TOWER_BASE_DIAMETER_M / 2,
    TOWER_HEIGHT_M,
    12,
  );
  towerGeo.translate(0, TOWER_HEIGHT_M / 2, 0);
  const towerProxy = proxy(towerGeo, tower.object3d, 'tower');
  const nacGeo = new BoxGeometry(
    NACELLE_SIZE_M.length,
    NACELLE_SIZE_M.height,
    NACELLE_SIZE_M.width,
  );
  nacGeo.translate(NACELLE.frontX + NACELLE_SIZE_M.length / 2, NACELLE.centerY, 0);
  const nacelleProxy = proxy(nacGeo, nacelle.object3d, 'nacelle');
  const hubProxy = proxy(new SphereGeometry(SPINNER.radius, 12, 8), rotor.object3d, 'hub');
  const D = ENVIRONMENT.diorama;
  const hillGeo = new CylinderGeometry(0.12, D.radius, D.height, 24);
  hillGeo.translate(0, -D.height / 2, 0);
  const hillProxy = proxy(hillGeo, scene, 'hill');
  const F = ENVIRONMENT.fan;
  const fanGeo = new CylinderGeometry(F.radius + 0.04, F.radius + 0.04, F.length, 16);
  fanGeo.rotateZ(Math.PI / 2);
  fanGeo.translate(F.x, F.y, 0);
  const fanProxy = proxy(fanGeo, scene, 'fan');
  const B = ENVIRONMENT.bench;
  const benchGeo = new BoxGeometry(B.xMax - B.xMin, B.thickness, B.depth);
  benchGeo.translate((B.xMax + B.xMin) / 2, B.topY - B.thickness / 2, 0);
  const benchProxy = proxy(benchGeo, scene, 'bench');
  const whole = (ui: Readonly<UiState>): boolean => ui.view === 'whole';
  const proxies: OcclusionProxy[] = [
    { mesh: towerProxy, active: () => true },
    // in Cutaway/Exploded the shell and spinner are open or faded
    { mesh: nacelleProxy, active: whole },
    { mesh: hubProxy, active: whole },
    { mesh: hillProxy, active: () => true },
    { mesh: fanProxy, active: () => true },
    { mesh: benchProxy, active: () => true },
  ];

  // ---- anchors
  const local = (obj: Object3D, x: number, y: number, z: number) => (out: Vector3) => {
    out.set(x, y, z);
    obj.localToWorld(out);
  };
  const at = (obj: Object3D) => (out: Vector3) => obj.getWorldPosition(out);
  /** a point on the smoke line seeded at r∞ (φ = 0: straight up) at x/R */
  const onSmoke = (xHat: number, rInf: number) => (out: Vector3) => {
    const r = diskFlow.streamline(rInf, xHat, flow.aVisual) * flow.radius;
    out.copy(flow.center).add(new Vector3(xHat * flow.radius, r, 0));
  };
  const towerTop = (out: Vector3): void => {
    out.set(tower.displacementAt(TOWER_HEIGHT_M), TOWER_HEIGHT_M - 1.5, TOWER_TOP_DIAMETER_M / 2);
    root.localToWorld(out);
  };

  const specs: LabelSpec[] = [
    {
      id: 'upstream',
      name: 'Upstream',
      tone: 'wind',
      priority: 9,
      anchor: onSmoke(-1.9, 0.75),
      value: (s) => fmtMs(s.V),
      visible: inFollow('all', 'wind'),
    },
    {
      id: 'rotor',
      name: 'At the rotor',
      tone: 'wind',
      priority: 10,
      anchor: onSmoke(0.15, 0.75),
      value: (s) => fmtMs(s.V * (1 - flow.a)),
      visible: inFollow('all', 'wind'),
    },
    {
      id: 'wake',
      name: 'Wake',
      tone: 'wind',
      priority: 9,
      anchor: onSmoke(2, 0.75),
      value: (s) => fmtMs(axialVelocity(2 * RADIUS_M, flow.aVisual, RADIUS_M, s.V)),
      visible: inFollow('all', 'wind'),
    },
    {
      id: 'tip',
      name: 'Blade tip',
      tone: 'wind',
      priority: 7,
      anchor: local(blade, 0, RADIUS_M, 0),
      value: (s) =>
        `${fmtMs(tipSpeedMs(s.omega), 0)} · ${fixed(tipSpeedMs(s.omega) * 3.6, 0)}${NBSP}km/h`,
      visible: (ui) => real(ui) && inFollow('all', 'wind')(ui),
    },
    {
      id: 'pitch',
      name: 'Pitch',
      tone: 'power',
      priority: 6,
      anchor: local(blade, 0, 3.2, 0),
      value: (s) => fmtDeg(s.beta),
      visible: (ui) => real(ui) && inFollow('all', 'power')(ui),
    },
    {
      id: 'shaft',
      name: 'Main shaft',
      tone: 'power',
      priority: 8,
      anchor: at(drivetrain.anchors.mainShaft),
      value: (s) => `${fmtRpm(s.omega)} · ${fmtMNm(lssTorqueNm(s.Qgen))}`,
      visible: (ui) => inView(ui, 'cutaway', 'exploded'),
    },
    {
      id: 'gearbox',
      name: 'Gearbox',
      tone: 'power',
      priority: 7,
      anchor: at(drivetrain.anchors.gearbox),
      value: () => `${fixed(GEAR_RATIO, 0)} : 1`,
      visible: (ui) => inView(ui, 'cutaway', 'exploded'),
    },
    {
      id: 'brake',
      name: 'Brake',
      tone: 'power',
      priority: 6,
      anchor: at(drivetrain.anchors.brake),
      value: (s) => (s.brakeOn ? 'ON' : 'released'),
      visible: (ui) => inView(ui, 'cutaway', 'exploded'),
    },
    {
      id: 'generator',
      name: 'Generator',
      tone: 'power',
      priority: 9,
      anchor: at(drivetrain.anchors.generator),
      value: (s) => `${grouped(s.omega * GEAR_RATIO * RPM)}${NBSP}rpm · ${fmtMW(s.Pel)}`,
      visible: (ui) => inView(ui, 'cutaway', 'exploded') || ui.follow === 'power',
      ignore: [nacelleProxy],
    },
    {
      id: 'converter',
      name: 'Converter',
      tone: 'power',
      priority: 5,
      anchor: at(drivetrain.anchors.converter),
      value: () => `${grouped(CONVERTER_VOLTAGE_V)}${NBSP}V`,
      visible: (ui) => inView(ui, 'exploded'),
    },
    {
      id: 'yaw',
      name: 'Yaw',
      tone: 'structure',
      priority: 4,
      anchor: at(drivetrain.anchors.yaw),
      value: () => 'facing the wind',
      visible: (ui) => inView(ui, 'exploded'),
      ignore: [towerProxy],
    },
    {
      id: 'anemometer',
      name: 'Anemometer',
      tone: 'wind',
      priority: 5,
      anchor: at(nacelle.anchors.anemometer),
      value: (s) => fmtMs(s.V),
      visible: inFollow('all'),
    },
    {
      id: 'thrust',
      name: 'Thrust',
      tone: 'loads',
      priority: 10,
      anchor: local(rotor.object3d, SPINNER.noseX - 0.4, 0, 0),
      value: (s) =>
        s.T < 0
          ? `${fmtKN(-s.T)} reverse`
          : `${fmtKN(s.T)} ≈ ${grouped(s.T / G_M_S2 / 1000)}${NBSP}t`,
      visible: inFollow('loads'),
    },
    {
      id: 'sway',
      name: 'Sway',
      tone: 'loads',
      priority: 9,
      anchor: towerTop,
      value: (s) => `${fmtM(towerTopDeflectionM(s.T))} (×${TOWER_EXAGGERATION_LOADS})`,
      visible: inFollow('loads'),
      ignore: [towerProxy],
    },
    {
      id: 'base',
      name: 'Base moment',
      tone: 'loads',
      priority: 8,
      anchor: local(root, 0, 6, TOWER_BASE_DIAMETER_M / 2),
      value: (s) => fmtMNm(baseMomentNm(s.T), 0),
      visible: inFollow('loads'),
      ignore: [towerProxy],
    },
    {
      id: 'homes',
      name: 'Homes',
      tone: 'power',
      priority: 8,
      anchor: (out) => out.copy(village.feed),
      value: (s) => `≈ ${grouped(homesPowered(s.Pel))}`,
      visible: inFollow('power'),
    },
    {
      id: 'person',
      name: 'Person',
      tone: 'structure',
      priority: 4,
      anchor: local(person, 0, 0.012, 0),
      value: () => fmtM(1.8, 1),
      visible: inFollow('loads'),
      ignore: [hillProxy],
    },
  ];

  return {
    specs,
    proxies,
    dispose() {
      geos.forEach((g) => g.dispose());
      mat.dispose();
      for (const p of proxies) p.mesh.removeFromParent();
    },
  };
}
