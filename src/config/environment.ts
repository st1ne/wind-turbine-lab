/**
 * Lab environment dimensions (TECH_SPEC §4.1, §4.5). Scene units are metres at model scale:
 * the turbine is built in full-scale metres and scaled 1/200, so its base sits at the origin and
 * the hub at y = 0.45. Wind blows along +x (the fan is at the left end of the bench).
 */
import { HUB_HEIGHT_M, MODEL_SCALE, RADIUS_M } from '@/config/turbine';

const HUB_Y = HUB_HEIGHT_M * MODEL_SCALE;
const ROTOR_R = RADIUS_M * MODEL_SCALE;

export const ENVIRONMENT = {
  hubY: HUB_Y,
  rotorRadius: ROTOR_R,
  bench: {
    /** top surface height; the diorama hill rises from here to the origin */
    topY: -0.06,
    xMin: -2.05,
    xMax: 2.15,
    depth: 1.25,
    thickness: 0.06,
    legHeight: 0.85,
  },
  fan: {
    x: -1.55,
    y: HUB_Y,
    /** shroud inner radius; bigger than the rotor so the whole disk sees wind */
    radius: 0.44,
    length: 0.34,
    blades: 7,
  },
  /** smoke rake at x = −2.5 R (§9) */
  rakeX: -2.5 * ROTOR_R,
  diorama: { radius: 0.62, height: 0.06 },
  room: { width: 9, depth: 8, height: 4.2, floorY: -0.97, backZ: -2.4 },
  ruler: { z: 0.61, fromM: -350, toM: 400 },
  camera: {
    fov: 35,
    near: 0.01,
    far: 60,
    position: [1.55, 0.62, 1.35] as const,
    target: [0, 0.28, 0] as const,
    minPolarDeg: 20,
    maxPolarDeg: 88,
    // §4.5 says 0.6; the nacelle close-up (18 m = 0.09 units) needs to get closer than that
    minDistance: 0.3,
    maxDistance: 5,
    /** pan box for the orbit target */
    panMin: [-1.6, 0.05, -0.8] as const,
    panMax: [1.8, 0.8, 0.8] as const,
    damping: 0.08,
    idleDelayS: 8,
    idleAmplitudeDeg: 4,
    idlePeriodS: 40,
  },
} as const;
