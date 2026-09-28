/**
 * Betz ideal disk (TECH_SPEC §10). Toggling Ideal disk fades the blades out and a violet
 * actuator disk in over 500 ms (easeInOutCubic); leaving reverses it. The disk (R = 63 m, thin,
 * in the rotor frame) glows at its edge with a fresnel term and carries faint rings. Entering
 * the sweet spot |b − 1/3| < 0.015 fires one --ok pulse (again only after leaving the zone).
 */
import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  ShaderMaterial,
} from 'three';
import { THEME } from '@/config/theme';
import { RADIUS_M } from '@/config/turbine';
import { BETZ_SWEET_SPOT } from '@/physics/actuatorDisk';
import type { SceneModule } from '@/scene/module';
import type { Turbine } from '@/scene/turbine/turbine';
import { easeInOutCubic } from '@/util/easing';

export const DISK_FADE_S = 0.5;
const PULSE_S = 0.9;

const VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vR;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  vR = length(position.yz) / ${RADIUS_M.toFixed(1)};
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uPulseColor;
uniform float uOpacity;
uniform float uPulse;
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vR;
void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewV))), 2.5);
  float rim = smoothstep(0.93, 1.0, vR);
  float rings = 0.05 * smoothstep(0.35, 0.5, abs(fract(vR * 6.0) - 0.5) * 2.0);
  float a = (0.12 + rings + 0.9 * max(fresnel, rim)) * uOpacity;
  vec3 col = mix(uColor, uPulseColor, uPulse) * (1.4 + 2.2 * uPulse);
  gl_FragColor = vec4(col * a, a);
}
`;

/** object3d is an empty group: the disk itself lives in the rotor frame. */
export interface BetzDisk extends SceneModule<Group> {
  readonly disk: Mesh;
  /** eased 0–1 visibility of the disk (1 − blade opacity) */
  readonly shown: number;
}

export function createBetzDisk(turbine: Turbine): BetzDisk {
  const geo = new CylinderGeometry(RADIUS_M, RADIUS_M, 0.8, 128, 1, false);
  geo.rotateZ(Math.PI / 2); // axis along the rotor axis (+x)
  const uniforms = {
    uColor: { value: new Color(THEME.ideal) },
    uPulseColor: { value: new Color(THEME.ok) },
    uOpacity: { value: 0 },
    uPulse: { value: 0 },
  };
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });
  const disk = new Mesh(geo, mat);
  disk.name = 'betz-disk';
  disk.visible = false;
  turbine.rotor.object3d.add(disk);

  let clock = 0;
  let shown = 0;
  let inSpot = false;
  let pulseT = PULSE_S;

  return {
    object3d: new Group(),
    disk,
    get shown() {
      return shown;
    },
    update(_s, ui, dt) {
      const ideal = ui.rotorMode === 'ideal';
      clock = Math.min(Math.max(clock + (ideal ? dt : -dt), 0), DISK_FADE_S);
      shown = easeInOutCubic(clock / DISK_FADE_S);
      turbine.rotor.setBladeOpacity(1 - shown);
      uniforms.uOpacity.value = shown;
      disk.visible = shown > 0.005;

      const spot = ideal && Math.abs(ui.wakeB - 1 / 3) < BETZ_SWEET_SPOT;
      if (spot && !inSpot) pulseT = 0;
      inSpot = spot;
      pulseT = Math.min(pulseT + dt, PULSE_S);
      const p = 1 - pulseT / PULSE_S;
      uniforms.uPulse.value = p * p;
    },
    dispose() {
      disk.removeFromParent();
      geo.dispose();
      mat.dispose();
    },
  };
}
