/**
 * Camera rig (TECH_SPEC §3.8, §4.5, §4.6): idle drift and fly-to presets.
 *   Idle drift: after 8 s without input, a ±4° azimuth sine (period 40 s); stops on input.
 *   flyTo: 1.2 s easeInOutCubic on position and target; cut instead under reduced motion.
 */
import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ENVIRONMENT } from '@/config/environment';
import { easeInOutCubic, prefersReducedMotion } from '@/util/easing';

const DEG = Math.PI / 180;
const C = ENVIRONMENT.camera;

export type CameraPreset = 'default' | 'rotor' | 'nacelle' | 'tower' | 'blade' | 'wide';

/** Camera presets: [position, target] in scene units. */
export const CAMERA_PRESETS: Record<CameraPreset, readonly [readonly number[], readonly number[]]> = {
  default: [C.position, C.target],
  // front 3/4 of the rotor, from upwind
  rotor: [
    [-0.95, 0.62, 0.78],
    [0.02, 0.43, 0],
  ],
  // side close-up of the nacelle
  nacelle: [
    [0.08, 0.53, 0.42],
    [0.0, 0.455, 0],
  ],
  // low wide shot of the tower
  tower: [
    [1.05, 0.14, 1.25],
    [0.0, 0.22, 0],
  ],
  // along the span from the hub
  blade: [
    [-0.12, 0.5, 0.1],
    [-0.02, 0.7, -0.02],
  ],
  wide: [
    [2.2, 1.0, 2.3],
    [0.0, 0.3, 0],
  ],
};

export interface CameraRig {
  flyTo(preset: CameraPreset, durationS?: number): void;
  /** true while a flight is running */
  readonly flying: boolean;
  /** called when the user interacts; cancels drift and flights */
  onUserInput(cb: () => void): void;
  update(dt: number): void;
  dispose(): void;
}

export function createCameraRig(camera: PerspectiveCamera, controls: OrbitControls): CameraRig {
  const reduced = prefersReducedMotion();
  let idleS = 0;
  let driftT = 0;
  let driftOffset = 0;
  let flight: {
    t: number;
    dur: number;
    p0: Vector3;
    p1: Vector3;
    t0: Vector3;
    t1: Vector3;
  } | null = null;
  const listeners: (() => void)[] = [];
  const offset = new Vector3();
  const sph = new Spherical();

  const onStart = (): void => {
    idleS = 0;
    driftT = 0;
    driftOffset = 0;
    flight = null;
    listeners.forEach((cb) => cb());
  };
  controls.addEventListener('start', onStart);

  function rotateAzimuth(delta: number): void {
    offset.subVectors(camera.position, controls.target);
    sph.setFromVector3(offset);
    sph.theta += delta;
    offset.setFromSpherical(sph);
    camera.position.copy(controls.target).add(offset);
  }

  return {
    get flying() {
      return flight !== null;
    },
    flyTo(preset, durationS = 1.2) {
      const [p, t] = CAMERA_PRESETS[preset];
      const p1 = new Vector3(p[0], p[1], p[2]);
      const t1 = new Vector3(t[0], t[1], t[2]);
      idleS = 0;
      driftT = 0;
      driftOffset = 0;
      if (reduced || durationS <= 0) {
        camera.position.copy(p1);
        controls.target.copy(t1);
        controls.update();
        flight = null;
        return;
      }
      flight = {
        t: 0,
        dur: durationS,
        p0: camera.position.clone(),
        p1,
        t0: controls.target.clone(),
        t1,
      };
    },
    onUserInput(cb) {
      listeners.push(cb);
    },
    update(dt) {
      if (flight) {
        flight.t += dt;
        const k = easeInOutCubic(Math.min(flight.t / flight.dur, 1));
        camera.position.lerpVectors(flight.p0, flight.p1, k);
        controls.target.lerpVectors(flight.t0, flight.t1, k);
        if (flight.t >= flight.dur) flight = null;
      } else if (!reduced) {
        idleS += dt;
        if (idleS > C.idleDelayS) {
          driftT += dt;
          const next = C.idleAmplitudeDeg * DEG * Math.sin((2 * Math.PI * driftT) / C.idlePeriodS);
          rotateAzimuth(next - driftOffset);
          driftOffset = next;
        }
      }
      controls.update();
    },
    dispose() {
      controls.removeEventListener('start', onStart);
    },
  };
}
