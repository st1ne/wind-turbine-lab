/**
 * Entry point (TECH_SPEC §14.3, §14.4): store → sim → scene → UI → audio.
 * The store holds uiState; the sim bridge derives SimInputs from it; scene, UI and audio read
 * the immutable snapshot each frame. The scene never mutates the sim.
 */
import './ui/styles.css';
import { Color, FogExp2, Group, Scene, Vector3 } from 'three';
import { THEME } from '@/config/theme';
import { createSim } from '@/physics/sim';
import { createAudio } from '@/audio/audio';
import { createCamera, createControls } from '@/scene/camera';
import { createCameraRig } from '@/scene/cameraRig';
import { createLights, FOG_DENSITY } from '@/scene/lights';
import type { SceneModule } from '@/scene/module';
import { createPost } from '@/scene/post';
import { createRenderer, MAX_DPR } from '@/scene/renderer';
import { createBench } from '@/scene/environment/bench';
import { createDiorama } from '@/scene/environment/diorama';
import { createFan } from '@/scene/environment/fan';
import { createRoom } from '@/scene/environment/room';
import { createRuler } from '@/scene/environment/ruler';
import { createTurbine } from '@/scene/turbine/turbine';
import { createViews } from '@/scene/views';
import { createLabelDefs } from '@/scene/labelDefs';
import { createLabels } from '@/scene/labels';
import { createBetzDisk } from '@/scene/betzDisk';
import { createFollow } from '@/scene/follow';
import { createFlow } from '@/scene/fx/flow';
import { createLoadsViz } from '@/scene/fx/loadsViz';
import { createPowerFlow } from '@/scene/fx/powerFlow';
import { createSmokeLines } from '@/scene/fx/smokeLines';
import { createTipVortices } from '@/scene/fx/tipVortices';
import { createSmokeRake } from '@/scene/environment/smokeRake';
import { createScreens } from '@/scene/environment/screens';
import { createVillage } from '@/scene/environment/village';
import { createClouds } from '@/scene/environment/clouds';
import { createBeacon } from '@/scene/fx/beacon';
import { createLightning } from '@/scene/fx/lightning';
import { createRain } from '@/scene/fx/rain';
import { createTreeSway } from '@/scene/fx/trees';
import { createSimBridge } from '@/state/simBridge';
import { createStore } from '@/state/store';
import { installUrlSync, readUrlState, urlToUiPatch } from '@/state/urlState';
import { defaultUiState } from '@/state/uiState';
import { createDevOverlay } from '@/ui/devOverlay';
import { createUi } from '@/ui/ui';
import { CHIPS, createChips } from '@/ui/chips';
import { h } from '@/ui/dom';
import { share } from '@/ui/share';
import { createTour } from '@/tour/tour';
import { createRafLoop } from '@/util/rafLoop';
import { createTweens } from '@/util/tween';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui-root') as HTMLElement;

// URL state (§17) is read before the sim starts, so a shared link opens in its steady state
const store = createStore({ ...defaultUiState(), ...urlToUiPatch(readUrlState(location.search)) });
const sim = createSim();
sim.initSteady(store.get().windTarget);

const renderer = createRenderer(canvas);
renderer.info.autoReset = false;
const scene = new Scene();
scene.background = new Color(THEME.bg);
scene.fog = new FogExp2(THEME.bg, FOG_DENSITY);

const camera = createCamera(window.innerWidth / window.innerHeight);
const controls = createControls(camera, canvas);
const rig = createCameraRig(camera, controls);
const post = createPost(renderer, scene, camera);
const lights = createLights(renderer, scene);
scene.add(lights.object3d);

const turbine = createTurbine();
const diorama = createDiorama();
const clouds = createClouds();
const lightning = createLightning(clouds);
const modules: SceneModule[] = [
  createRoom(),
  createBench(),
  createRuler(),
  createFan(),
  diorama,
  turbine,
];
// after the turbine: views move, clip and fade the parts the turbine just animated
const views = createViews(turbine, camera);
modules.push(views);

// Follow modes and FX (§9). The flow state reads the rotor after views have moved it.
turbine.object3d.updateMatrixWorld(true);
const flow = createFlow(turbine);
const rotorRest = turbine.rotor.object3d.getWorldPosition(new Vector3());
const loadsViz = createLoadsViz(turbine);
const village = createVillage(turbine.object3d.localToWorld(new Vector3(6.5, 2.6, 4.5)));
const fx: SceneModule[] = [
  { object3d: new Group(), update: flow.update, dispose() {} },
  createSmokeRake(rotorRest, flow.radius),
  createSmokeLines(flow),
  createTipVortices(flow),
  createBetzDisk(turbine),
  createScreens(flow),
  // weather and storm (§11)
  createTreeSway(diorama),
  createRain(),
  clouds,
  lightning,
  createBeacon(),
  village,
  createPowerFlow(turbine, village),
  loadsViz,
  createFollow(),
];
modules.push(...fx);
modules.forEach((m) => scene.add(m.object3d));

// 3D-pinned labels (§3.7), after every module that moves their anchors
scene.updateMatrixWorld(true);
const labelDefs = createLabelDefs(scene, turbine, flow, village, loadsViz.person);
const labels = createLabels(uiRoot, camera, labelDefs.specs, labelDefs.proxies);
modules.push(labels);

const dev = import.meta.env.DEV ? createDevOverlay(uiRoot) : null;

const bridge = createSimBridge(store, sim);
const audio = createAudio();
audio.setVolume(store.get().volume);
// a shared link with sound=1 starts muted-by-browser until the first click or key press
audio.setEnabled(store.get().sound);
store.subscribe(
  (s) => s.sound,
  (on) => audio.setEnabled(on),
);
store.subscribe(
  (s) => s.volume,
  (v) => audio.setVolume(v),
);
/** one-shot UI/scene animations (§4.6); updated once per frame after the sim */
const tweens = createTweens();

const ui = createUi(uiRoot, store, {
  resetTrip: bridge.resetTrip,
  toggleTour: () => tour.toggle(),
  lockedPitchDeg: bridge.lockedPitchDeg,
});

// camera chips (§3.8): highlighted until the user orbits
ui.layout.chips.append(createChips(store, (p) => rig.flyTo(p)));
rig.onUserInput(() => store.set({ camChip: null }));
const startChip = CHIPS.find((c) => c.id === store.get().camChip);
if (startChip) rig.flyTo(startChip.preset, 0);

// URL sync and share (§17)
const urlSync = installUrlSync(store);
const shareBtn = h(
  'button',
  { type: 'button', class: 'share-btn glass', 'aria-label': 'Share this view' },
  '↗ Share',
);
shareBtn.addEventListener('click', () => void share(urlSync.flush()));
ui.layout.corner.prepend(shareBtn);

// guided tour (§12)
const tour = createTour({
  store,
  bridge,
  flyTo: (p) => rig.flyTo(p),
  onCameraInput: (cb) => rig.onUserInput(cb),
  host: uiRoot,
});

if (import.meta.env.DEV) {
  // handle for debugging in the browser console
  Object.assign(window, {
    __lab: {
      sim,
      bridge,
      scene,
      camera,
      controls,
      renderer,
      rig,
      store,
      turbine,
      views,
      flow,
      lightning,
      tour,
      urlSync,
      audio,
      tweens,
    },
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
  views.setResolution(w, h);
}
window.addEventListener('resize', resize);
resize();

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
  post.setStorm(snapshot.stormLevel, snapshot.t);
  post.render(dt);
  tour.update(dt);
  ui.update(snapshot, dt);
  audio.update(snapshot, { flashes: lightning.flashes });
  dev?.frame(dt, renderer, snapshot, uiState);
  if (firstFrame) {
    firstFrame = false;
    ui.firstFrame();
  }
});
loop.start();
