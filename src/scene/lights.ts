/**
 * Lighting (TECH_SPEC §4.2):
 *   key  warm directional #ffd9a8 × 2.2 from front-left above, PCFSoft 2048², bias −0.0005,
 *        shadow camera fitted to the bench
 *   fill cool hemisphere sky #6f8cff / ground #1a1410 × 0.35
 *   rim  cyan spot #4cc9ff × 1.4 from behind the turbine
 *   environment: RoomEnvironment through PMREM, intensity 0.25
 */
import {
  DirectionalLight,
  Group,
  HemisphereLight,
  PMREMGenerator,
  SpotLight,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PALETTE } from '@/config/theme';
import type { SceneModule } from '@/scene/module';

export interface Lights extends SceneModule<Group> {
  readonly key: DirectionalLight;
  readonly fill: HemisphereLight;
  readonly rim: SpotLight;
}

export const KEY_INTENSITY = 2.2;
export const FILL_INTENSITY = 0.35;
export const ENV_INTENSITY = 0.25;

export function createLights(renderer: WebGLRenderer, scene: Scene): Lights {
  const group = new Group();
  group.name = 'lights';

  const key = new DirectionalLight(PALETTE.keyLight, KEY_INTENSITY);
  key.position.set(-1.6, 2.6, 1.9);
  key.target.position.set(0.1, 0.1, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.002;
  const sc = key.shadow.camera;
  sc.left = -2.4;
  sc.right = 2.4;
  sc.top = 1.6;
  sc.bottom = -1.6;
  sc.near = 0.5;
  sc.far = 7;
  group.add(key, key.target);

  const fill = new HemisphereLight(PALETTE.fillSky, PALETTE.fillGround, FILL_INTENSITY);
  group.add(fill);

  const rim = new SpotLight(PALETTE.rimLight, 1.4, 6, Math.PI / 7, 0.6, 1.2);
  rim.position.set(1.9, 1.3, -1.6);
  rim.target.position.set(0, 0.35, 0);
  group.add(rim, rim.target);

  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = ENV_INTENSITY;
  pmrem.dispose();

  return {
    object3d: group,
    key,
    fill,
    rim,
    update() {
      // Storm dimming is driven in Phase 11.
    },
    dispose() {
      envRT.dispose();
      key.shadow.map?.dispose();
    },
  };
}
