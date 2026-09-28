/**
 * Turbine assembly (TECH_SPEC §5): built in full-scale metres and scaled 1/200 so the tower base
 * sits at the origin and the hub at y = 0.45. Wind blows along +x; the rotor is upwind of the
 * tower by the 5 m overhang, with 5° shaft tilt and 2.5° precone.
 *
 * Deflections come from physics/loads.ts; Loads mode exaggerates the tower ×25 and the blade
 * flap ×2 (§6.8, §9). Everything else follows the sim snapshot directly.
 */
import { BoxGeometry, Group, Mesh } from 'three';
import { HUB_HEIGHT_M, MODEL_SCALE, OVERHANG_M, SHAFT_TILT_DEG } from '@/config/turbine';
import { bladeTipDeflectionM, towerTopDeflectionM } from '@/physics/loads';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { createDrivetrain, type Drivetrain } from '@/scene/turbine/drivetrain';
import { createNacelle, type Nacelle } from '@/scene/turbine/nacelle';
import { createRotor, type Rotor } from '@/scene/turbine/rotor';
import { createTower, type Tower } from '@/scene/turbine/tower';

const DEG = Math.PI / 180;
export const TOWER_EXAGGERATION_LOADS = 25;
export const FLAP_EXAGGERATION_LOADS = 2;

export interface Turbine extends SceneModule<Group> {
  readonly tower: Tower;
  readonly nacelle: Nacelle;
  readonly rotor: Rotor;
  readonly drivetrain: Drivetrain;
  /** moves with the tower top: nacelle + rotor */
  readonly top: Group;
  /** shaft frame at the hub centre (tilted) */
  readonly shaft: Group;
}

export function createTurbine(): Turbine {
  const root = new Group();
  root.name = 'turbine';
  root.scale.setScalar(MODEL_SCALE);

  const tower = createTower();
  root.add(tower.object3d);

  const top = new Group();
  top.name = 'turbine-top';
  root.add(top);

  const nacelle = createNacelle();
  top.add(nacelle.object3d);

  const shaft = new Group();
  shaft.name = 'shaft';
  shaft.position.set(-OVERHANG_M, HUB_HEIGHT_M, 0);
  // local +x (downwind) tilts down by 5°, so the upwind end and the rotor plane lean up/back
  shaft.rotation.z = -SHAFT_TILT_DEG * DEG;
  top.add(shaft);

  const rotor = createRotor();
  shaft.add(rotor.object3d);

  const drivetrain = createDrivetrain();
  shaft.add(drivetrain.shaftGroup);
  top.add(drivetrain.nacelleGroup);

  // Transformer cabinet at the tower base (690 V → 33 kV), always visible.
  const transformerGeo = new BoxGeometry(3.2, 2.6, 2.2);
  transformerGeo.translate(6.5, 1.3, 4.5);
  const transformer = new Mesh(
    transformerGeo,
    makeMaterial({ color: '#c9ced6', roughness: 0.6, metalness: 0.2 }, 'power'),
  );
  transformer.name = 'transformer';
  transformer.castShadow = true;
  transformer.receiveShadow = true;
  root.add(transformer);

  let towerExag = 1;
  let flapExag = 1;

  return {
    object3d: root,
    tower,
    nacelle,
    rotor,
    drivetrain,
    top,
    shaft,
    update(s, ui, dt) {
      drivetrain.update(s, dt);
      // Exaggeration eases in and out with Follow = Loads (display only, not physics).
      const loads = ui.follow === 'loads';
      const k = 1 - Math.exp(-dt / 0.25);
      towerExag += ((loads ? TOWER_EXAGGERATION_LOADS : 1) - towerExag) * k;
      flapExag += ((loads ? FLAP_EXAGGERATION_LOADS : 1) - flapExag) * k;

      const deltaTop = towerTopDeflectionM(s.T);
      tower.uniforms.uTopDeflection.value = deltaTop;
      tower.uniforms.uExaggeration.value = towerExag;
      top.position.x = deltaTop * towerExag;

      rotor.set(s.psi, s.beta, bladeTipDeflectionM(s.T) * flapExag);
      nacelle.update(s.V, s.t, dt);
    },
    dispose() {
      tower.dispose();
      nacelle.dispose();
      rotor.dispose();
      drivetrain.dispose();
      transformerGeo.dispose();
    },
  };
}
