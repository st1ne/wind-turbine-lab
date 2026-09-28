/**
 * Entry point. Bootstraps sim → scene → UI (TECH_SPEC §14.3, §14.4).
 * The store holds uiState; the sim reads SimInputs derived from it; scene and UI read the
 * snapshot each frame.
 */
import './ui/styles.css';
import { Color, FogExp2, Scene } from 'three';
import { THEME } from '@/config/theme';
import { createSim } from '@/physics/sim';
import type { SimInputs } from '@/physics/types';
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
import { createStore } from '@/state/store';
import { defaultUiState } from '@/state/uiState';
import { createDevOverlay } from '@/ui/devOverlay';
import { toast } from '@/ui/toast';
import { createUi } from '@/ui/ui';
import { createRafLoop } from '@/util/rafLoop';

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

// uiState → sim inputs (§14.3). The sim never reads the store directly.
const inputs: SimInputs = {
  windTarget: store.get().windTarget,
  gusts: store.get().gusts,
  pitchLockDeg: null,
  idealDisk: store.get().rotorMode === 'ideal',
};
store.subscribe(
  (s) => s.windTarget,
  (v) => (inputs.windTarget = v),
);
store.subscribe(
  (s) => s.gusts,
  (on) => (inputs.gusts = on),
);
store.subscribe(
  (s) => s.rotorMode,
  (mode) => (inputs.idealDisk = mode === 'ideal'),
);
// Locked freezes the pitch at its current angle as a what-if (§3.4).
store.subscribe(
  (s) => s.pitchLock,
  (locked) => (inputs.pitchLockDeg = locked ? sim.snapshot().beta : null),
);

const ui = createUi(uiRoot, store, {
  resetTrip() {
    const { state } = sim.snapshot();
    if (state === 'TRIP' || state === 'TRIPPED') sim.resetTrip();
  },
  toggleTour() {
    // The guided tour is built in Phase 13.
    toast('The guided tour is coming soon');
  },
  lockedPitchDeg: () => inputs.pitchLockDeg,
});

if (import.meta.env.DEV) {
  // handle for debugging in the browser console
  Object.assign(window, {
    __lab: { sim, scene, camera, controls, renderer, rig, store, inputs, turbine },
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
const loop = createRafLoop((dt) => {
  const uiState = store.get();
  sim.step(uiState.paused ? 0 : dt * uiState.timeScale, inputs);
  const snapshot = sim.snapshot();
  rig.update(dt);
  lights.update(snapshot, uiState, dt);
  for (const m of modules) m.update(snapshot, uiState, dt);
  renderer.info.reset();
  post.render(dt);
  ui.update(snapshot, dt);
  dev?.frame(dt, renderer, snapshot);
  if (firstFrame) {
    firstFrame = false;
    ui.firstFrame();
  }
});
loop.start();
