/**
 * Rain (TECH_SPEC §11): instanced streaks over the bench, 4,000 on desktop and 1,500 on mobile
 * (halved again under reduced motion), and splash rings on the bench top. Everything moves in
 * the vertex shader from sim time; only the number of drawn instances and the opacity follow
 * the storm level s.
 *
 *   slant  the streaks lean downwind by atan(V / 9): wind V over a ≈ 9 m/s fall speed
 *   count  instanceCount = N · s, opacity ∝ s
 */
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  RingGeometry,
  ShaderMaterial,
} from 'three';
import { ENVIRONMENT } from '@/config/environment';
import type { SceneModule } from '@/scene/module';
import { prefersReducedMotion } from '@/util/easing';
import { mulberry32 } from '@/util/math';

/** raindrop terminal speed used for the slant, m/s (§11) */
export const RAIN_FALL_M_S = 9;
const BOX = { xMin: -2.0, xMax: 2.15, zMin: -0.7, zMax: 0.7, top: 1.7 } as const;
const FALL_UNITS_S = 3.2;
const STREAK_LEN = 0.09;
const SPLASHES = 220;

/** Streak lean from vertical, rad. */
export function rainSlant(V: number): number {
  return Math.atan(Math.max(V, 0) / RAIN_FALL_M_S);
}

export function rainCount(): number {
  const mobile =
    typeof matchMedia === 'function' &&
    (matchMedia('(pointer: coarse)').matches || window.innerWidth < 900);
  return Math.round((mobile ? 1500 : 4000) / (prefersReducedMotion() ? 2 : 1));
}

const STREAK_VERT = /* glsl */ `
uniform float uTime;
uniform float uSlant;
attribute vec3 aSeed;
varying float vAlong;
varying float vSide;
void main() {
  float bottom = ${ENVIRONMENT.bench.topY.toFixed(3)};
  float height = ${BOX.top.toFixed(2)} - bottom;
  float fall = fract(aSeed.y + uTime * ${FALL_UNITS_S.toFixed(2)} / height);
  vec3 dir = normalize(vec3(sin(uSlant), -cos(uSlant), 0.0));
  // the drop drifts downwind as it falls, wrapped inside the box
  float drift = tan(uSlant) * fall * height;
  float x = ${BOX.xMin.toFixed(2)} + mod(aSeed.x + drift, ${(BOX.xMax - BOX.xMin).toFixed(2)});
  vec3 head = vec3(x, ${BOX.top.toFixed(2)} - fall * height, aSeed.z);
  vec3 toCam = normalize(cameraPosition - head);
  vec3 side = normalize(cross(dir, toCam));
  vec3 p = head - dir * position.y * ${STREAK_LEN.toFixed(3)} + side * position.x * 0.0018;
  vAlong = position.y;
  vSide = position.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const STREAK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlong;
varying float vSide;
void main() {
  float a = uOpacity * (1.0 - vAlong) * (1.0 - vSide * vSide);
  gl_FragColor = vec4(uColor * a, a);
}
`;

const SPLASH_VERT = /* glsl */ `
uniform float uTime;
attribute vec3 aSeed;
varying float vLife;
void main() {
  float life = fract(aSeed.z + uTime * 1.6);
  vLife = life;
  vec3 p = position * (0.15 + 0.85 * life);
  p.x += aSeed.x;
  p.z += aSeed.y;
  p.y += ${(ENVIRONMENT.bench.topY + 0.0008).toFixed(4)};
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const SPLASH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vLife;
void main() {
  float a = uOpacity * (1.0 - vLife);
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function createRain(): SceneModule<Group> {
  const group = new Group();
  group.name = 'rain';
  const count = rainCount();
  const rnd = mulberry32(21);

  // one streak: a unit quad, x ∈ [−1, 1] across, y ∈ [0, 1] along (0 = head)
  const quad = new PlaneGeometry(2, 1);
  quad.translate(0, 0.5, 0);
  const streakGeo = new InstancedBufferGeometry();
  streakGeo.index = quad.index;
  streakGeo.setAttribute('position', quad.getAttribute('position'));
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3] = rnd() * (BOX.xMax - BOX.xMin);
    seeds[i * 3 + 1] = rnd();
    seeds[i * 3 + 2] = BOX.zMin + rnd() * (BOX.zMax - BOX.zMin);
  }
  streakGeo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 3));
  streakGeo.instanceCount = 0;
  const streakUniforms = {
    uTime: { value: 0 },
    uSlant: { value: 0 },
    uColor: { value: new Color('#d6e6ff') },
    uOpacity: { value: 0 },
  };
  const streakMat = new ShaderMaterial({
    uniforms: streakUniforms,
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    // the quad is turned toward the camera in the shader, so its winding varies
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const streaks = new Mesh(streakGeo, streakMat);
  streaks.frustumCulled = false;
  group.add(streaks);

  const ring = new RingGeometry(0.004, 0.0055, 16);
  ring.rotateX(-Math.PI / 2);
  const splashGeo = new InstancedBufferGeometry();
  splashGeo.index = ring.index;
  splashGeo.setAttribute('position', ring.getAttribute('position'));
  const sSeeds = new Float32Array(SPLASHES * 3);
  for (let i = 0; i < SPLASHES; i++) {
    sSeeds[i * 3] =
      ENVIRONMENT.bench.xMin +
      0.1 +
      rnd() * (ENVIRONMENT.bench.xMax - ENVIRONMENT.bench.xMin - 0.2);
    sSeeds[i * 3 + 1] = (rnd() - 0.5) * (ENVIRONMENT.bench.depth - 0.1);
    sSeeds[i * 3 + 2] = rnd();
  }
  splashGeo.setAttribute('aSeed', new InstancedBufferAttribute(sSeeds, 3));
  splashGeo.instanceCount = 0;
  const splashUniforms = {
    uTime: { value: 0 },
    uColor: { value: new Color('#9fbfe8') },
    uOpacity: { value: 0 },
  };
  const splashMat = new ShaderMaterial({
    uniforms: splashUniforms,
    vertexShader: SPLASH_VERT,
    fragmentShader: SPLASH_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const splashes = new Mesh(splashGeo, splashMat);
  splashes.frustumCulled = false;
  group.add(splashes);

  return {
    object3d: group,
    update(s) {
      const k = s.stormLevel;
      group.visible = k > 0.01;
      if (!group.visible) return;
      streakGeo.instanceCount = Math.round(count * k);
      splashGeo.instanceCount = Math.round(SPLASHES * k);
      streakUniforms.uTime.value = s.t;
      streakUniforms.uSlant.value = rainSlant(s.V);
      streakUniforms.uOpacity.value = 0.6 * k;
      splashUniforms.uTime.value = s.t;
      splashUniforms.uOpacity.value = 0.5 * k;
    },
    dispose() {
      quad.dispose();
      ring.dispose();
      streakGeo.dispose();
      splashGeo.dispose();
      streakMat.dispose();
      splashMat.dispose();
    },
  };
}
