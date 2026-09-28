/**
 * Entry point (TECH_SPEC §14.3, §14.4): store → sim → scene → UI → audio.
 * The store holds uiState; the sim bridge derives SimInputs from it; scene, UI and audio read
 * the immutable snapshot each frame. The scene never mutates the sim.
 */
import './ui/styles.css';
import { Color, FogExp2, Scene } from 'three';
import { THEME } from '@/config/theme';
import { createSim } from '@/physics/sim';
import { createAudio } from '@/audio/audio';
import { createCamera, createControls } from '@/scene/camera';
import { createCameraRig } from '@/scene/cameraRig';
import { createLights } from '@/scene/lights';
import type { SceneModule } from '@/scene/module';
import { createPost } from '@/scene/post';
import { createRenderer, MAX_DPR } from '@/scene/renderer';
import { createBench } from '@/scene/environment/bench';
import { createDiorama } from '@/scene/environment/diorama';
import { createFan } from '@/scene/environment/fan';
import { createRoom } from '@/scene/environment/room';
import { createRuler } from '@/scene/environment/ruler';
import { createTurbine } from '@/scene/turbine/turbine';
import { createSimBridge } from '@/state/simBridge';
import { createStore } from '@/state/store';
import { defaultUiState } from '@/state/uiState';
import { createDevOverlay } from '@/ui/devOverlay';
import { toast } from '@/ui/toast';
import { createUi } from '@/ui/ui';
import { createRafLoop } from '@/util/rafLoop';
import { createTweens } from '@/util/tween';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

const store = createStore(defaultUiState());
const sim = createSim();
sim.initSteady(store.get().windTarget);

const renderer = createRenderer(canvas);
renderer.info.autoReset = false;
const scene = new Scene();
scene.background = new Color(THEME.bg);
scene.fog = new FogExp2(THEME.bg, 0.06);

const camera = createCamera(window.innerWidth / window.innerHeight);
const controls = createControls(camera, canvas);
const rig = createCameraRig(camera, controls);
const post = createPost(renderer, scene, camera);
const lights = createLights(renderer, scene);
scene.add(lights.object3d);

const turbine = createTurbine();
const modules: SceneModule[] = [
  createRoom(),
  createBench(),
  createRuler(),
  createFan(),
  createDiorama(),
  turbine,
];
modules.forEach((m) => scene.add(m.object3d));

const dev = import.meta.env.DEV ? createDevOverlay(uiRoot) : null;

const bridge = createSimBridge(store, sim);
const audio = createAudio();
store.subscribe(
  (s) => s.sound,
  (on) => audio.setEnabled(on),
);
/** one-shot UI/scene animations (§4.6); updated once per frame after the sim */
const tweens = createTweens();

const ui = createUi(uiRoot, store, {
  resetTrip: bridge.resetTrip,
  toggleTour() {
    // The guided tour is built in Phase 13; it will call bridge.jumpTo() per step.
    toast('The guided tour is coming soon');
  },
  lockedPitchDeg: bridge.lockedPitchDeg,
});

if (import.meta.env.DEV) {
  // handle for debugging in the browser console
  Object.assign(window, {
    __lab: { sim, bridge, scene, camera, controls, renderer, rig, store, turbine, tweens },
  });
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  post.resize(w, h, dpr);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let firstFrame = true;
// Frame order (§14.4): sim fixed steps → tweens → scene → render → UI (throttled) → audio.
const loop = createRafLoop((dt) => {
  bridge.frame(dt);
  const snapshot = sim.snapshot();
  const uiState = store.get();
  tweens.update(dt);
  rig.update(dt);
  lights.update(snapshot, uiState, dt);
  for (const m of modules) m.update(snapshot, uiState, dt);
  renderer.info.reset();
  post.render(dt);
  ui.update(snapshot, dt);
  audio.update(snapshot, dt);
  dev?.frame(dt, renderer, snapshot, uiState);
  if (firstFrame) {
    firstFrame = false;
    ui.firstFrame();
  }
});
loop.start();
