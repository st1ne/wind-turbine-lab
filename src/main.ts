/**
 * Entry point. Bootstraps sim → scene → UI (TECH_SPEC §14.3, §14.4).
 * Phases 2–3: scene shell and turbine wired to the physics sim through the fixed-step loop.
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
import { defaultUiState } from '@/state/uiState';
import { createDevOverlay } from '@/ui/devOverlay';
import { createRafLoop } from '@/util/rafLoop';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

const ui = defaultUiState();
const sim = createSim();
sim.initSteady(ui.windTarget);

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

const inputs: SimInputs = {
  windTarget: ui.windTarget,
  gusts: ui.gusts,
  pitchLockDeg: null,
  idealDisk: false,
};

if (import.meta.env.DEV) {
  // handle for debugging in the browser console
  Object.assign(window, {
    __lab: { sim, scene, camera, controls, renderer, rig, ui, inputs, turbine },
  });
  // Temporary dev controls until the UI lands in Phase 5: ←/→ wind, Shift for ±2 m/s.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'v' || e.key === 'V') {
      const views = ['whole', 'cutaway', 'exploded'] as const;
      ui.view = views[(views.indexOf(ui.view) + 1) % views.length] ?? 'whole';
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const step = (e.shiftKey ? 2 : 0.5) * (e.key === 'ArrowRight' ? 1 : -1);
    ui.windTarget = Math.min(Math.max(ui.windTarget + step, 0), 35);
    inputs.windTarget = ui.windTarget;
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

const loop = createRafLoop((dt) => {
  if (!ui.paused) sim.step(dt * ui.timeScale, inputs);
  const snapshot = sim.snapshot();
  rig.update(dt);
  lights.update(snapshot, ui, dt);
  for (const m of modules) m.update(snapshot, ui, dt);
  renderer.info.reset();
  post.render(dt);
  dev?.frame(dt, renderer, snapshot);
});
loop.start();
