/**
 * Lighting (TECH_SPEC §4.2):
 *   key  warm directional #ffd9a8 × 2.2 from front-left above, PCFSoft 2048², bias −0.0005,
 *        shadow camera fitted to the bench
 *   fill cool hemisphere sky #6f8cff / ground #1a1410 × 0.35
 *   rim  cyan spot #4cc9ff × 1.4 from behind the turbine
 *   environment: RoomEnvironment through PMREM, intensity 0.25
 */
import {
  Color,
  DirectionalLight,
  FogExp2,
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
const RIM_INTENSITY = 1.4;
/** scene fog density (scene units); a storm adds FOG_STORM · s */
export const FOG_DENSITY = 0.06;
const FOG_STORM = 0.05;
const STORM_FILL = new Color('#3a4a8a');

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
  const fillSky = new Color(PALETTE.fillSky);
  group.add(fill);

  const rim = new SpotLight(PALETTE.rimLight, RIM_INTENSITY, 6, Math.PI / 7, 0.6, 1.2);
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
    update(s) {
      // Storm (§4.2, §11): key × (1 − 0.65 s), fill hue toward #3a4a8a, denser fog,
      // exposure − 0.15 s
      const k = s.stormLevel;
      key.intensity = KEY_INTENSITY * (1 - 0.65 * k);
      fill.color.copy(fillSky).lerp(STORM_FILL, k);
      rim.intensity = RIM_INTENSITY * (1 - 0.4 * k);
      if (scene.fog instanceof FogExp2) scene.fog.density = FOG_DENSITY + FOG_STORM * k;
      renderer.toneMappingExposure = 1 - 0.15 * k;
    },
    dispose() {
      envRT.dispose();
      key.shadow.map?.dispose();
    },
  };
}
