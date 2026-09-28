/**
 * Smoke lines (TECH_SPEC §9, §6.5): 14 camera-facing ribbons from the rake at x = −2.5R to
 * +5R, 180 segments each, one draw call. Vertex positions come from the actuator-disk stream
 * tube in the vertex shader (fx/diskFlow.ts), so the lines bend with `a` without re-uploading
 * geometry. Dashes scroll with the flow: each vertex carries τ(x) = ∫ dx/û (m), recomputed on the
 * CPU when `a` moves by more than 0.005, and a parcel keeps τ − ∫V dt constant.
 *
 * Seeds: two rings at r∞ = 0.35R and 0.75R (6 each, offset 30°) and 2 lines outside at 1.2R
 * (top and bottom). Colour: pale in All; in Wind, u/V from cyan (1) to violet (0.5).
 * The stream-tube boundary is drawn as a violet dashed outline in Wind mode.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineDashedMaterial,
  Mesh,
  ShaderMaterial,
} from 'three';
import { THEME } from '@/config/theme';
import { RADIUS_M } from '@/config/turbine';
import { travelTime } from '@/physics/actuatorDisk';
import { DISK_FLOW_GLSL, diskFlow } from '@/scene/fx/diskFlow';
import type { Flow } from '@/scene/fx/flow';
import { DIM } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

export const SMOKE = {
  xStart: -2.5,
  xEnd: 5,
  segments: 180,
  /** world-space ribbon width */
  width: 0.0026,
  /** dash wavelength in full-scale metres of travel */
  wavelengthM: 14,
  /** re-integrate τ(x) when a moves by more than this (§9) */
  tauEpsilon: 0.005,
} as const;

/** (r∞ / R, angle) of the 14 rake nozzles. */
export const SMOKE_SEEDS: readonly (readonly [number, number])[] = [
  ...[0, 1, 2, 3, 4, 5].map((k) => [0.35, (k * Math.PI) / 3] as const),
  ...[0, 1, 2, 3, 4, 5].map((k) => [0.75, (k * Math.PI) / 3 + Math.PI / 6] as const),
  // y = r cos φ, z = r sin φ: φ = 0 is straight up
  [1.2, 0],
  [1.2, Math.PI],
];

const VERT = /* glsl */ `
${DISK_FLOW_GLSL}
uniform float uA;
uniform float uTurb;
uniform float uTime;
uniform float uFlowS;
uniform float uWavelength;
uniform float uWidth;
attribute float aX;
attribute float aSide;
attribute vec2 aSeed;
attribute float aTau;
attribute float aLine;
varying float vU;
varying float vPhase;
varying float vSide;
varying float vX;

vec3 centerAt(float x) {
  vec2 rs = diskStreamline(aSeed.x, x, uA);
  float n = uTurb * smoothstep(0.0, 2.0, x);
  vec2 wob = n * vec2(
    sin(x * 6.1 + uTime * 1.3 + aLine * 1.7) + 0.5 * sin(x * 13.7 - uTime * 2.1 + aLine),
    cos(x * 4.7 - uTime * 1.1 + aLine * 2.3) + 0.5 * cos(x * 11.3 + uTime * 1.9 + aLine * 0.7)
  );
  return vec3(x, rs.x * cos(aSeed.y) + wob.x, rs.x * sin(aSeed.y) + wob.y);
}

void main() {
  vec4 wp = modelMatrix * vec4(centerAt(aX), 1.0);
  vec3 ahead = (modelMatrix * vec4(centerAt(aX + 0.02), 1.0)).xyz;
  vec3 tangent = normalize(ahead - wp.xyz);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vec3 side = normalize(cross(tangent, toCam));
  wp.xyz += side * aSide * uWidth * 0.5;
  vU = diskStreamline(aSeed.x, aX, uA).y;
  vPhase = (aTau - uFlowS) / uWavelength;
  vSide = aSide;
  vX = aX;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uNeutral;
uniform vec3 uFast;
uniform vec3 uSlow;
uniform float uSpeedColor;
uniform float uIntensity;
uniform float uDim;
varying float vU;
varying float vPhase;
varying float vSide;
varying float vX;

void main() {
  float f = fract(vPhase);
  float dash = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.42, 0.62, f));
  float edge = 1.0 - vSide * vSide;
  float ends = smoothstep(-2.5, -2.2, vX) * (1.0 - smoothstep(3.8, 5.0, vX));
  float alpha = (0.3 + 0.7 * dash) * edge * ends * uIntensity;
  vec3 speed = mix(uSlow, uFast, clamp((vU - 0.5) / 0.5, 0.0, 1.0));
  vec3 col = mix(uNeutral, speed, uSpeedColor);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * 0.35, uDim);
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

export interface SmokeLines extends SceneModule<Group> {
  /** the a the τ attribute was last integrated for (tests, dev overlay) */
  readonly tauA: number;
}

export function createSmokeLines(flow: Flow): SmokeLines {
  const group = new Group();
  group.name = 'smoke';
  const n = SMOKE.segments + 1;
  const lines = SMOKE_SEEDS.length;
  const verts = lines * n * 2;
  const aX = new Float32Array(verts);
  const aSide = new Float32Array(verts);
  const aSeed = new Float32Array(verts * 2);
  const aTau = new Float32Array(verts);
  const aLine = new Float32Array(verts);
  const index: number[] = [];
  const xs: number[] = [];
  for (let i = 0; i < n; i++)
    xs.push(SMOKE.xStart + ((SMOKE.xEnd - SMOKE.xStart) * i) / SMOKE.segments);
  SMOKE_SEEDS.forEach(([r, phi], l) => {
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < 2; s++) {
        const v = (l * n + i) * 2 + s;
        aX[v] = xs[i] as number;
        aSide[v] = s === 0 ? -1 : 1;
        aSeed[v * 2] = r;
        aSeed[v * 2 + 1] = phi;
        aLine[v] = l;
      }
      if (i < n - 1) {
        const v0 = (l * n + i) * 2;
        index.push(v0, v0 + 1, v0 + 2, v0 + 1, v0 + 3, v0 + 2);
      }
    }
  });
  const geo = new BufferGeometry();
  // positions are computed in the shader; this attribute only sizes the draw
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('aX', new BufferAttribute(aX, 1));
  geo.setAttribute('aSide', new BufferAttribute(aSide, 1));
  geo.setAttribute('aSeed', new BufferAttribute(aSeed, 2));
  const tauAttr = new BufferAttribute(aTau, 1);
  geo.setAttribute('aTau', tauAttr);
  geo.setAttribute('aLine', new BufferAttribute(aLine, 1));
  geo.setIndex(index);

  const uniforms = {
    uA: { value: 0 },
    uTurb: { value: 0 },
    uTime: { value: 0 },
    uFlowS: { value: 0 },
    uWavelength: { value: SMOKE.wavelengthM },
    uWidth: { value: SMOKE.width },
    uNeutral: { value: new Color('#d8f3ff') },
    uFast: { value: new Color(THEME.wind) },
    uSlow: { value: new Color(THEME.ideal) },
    uSpeedColor: { value: 0 },
    uIntensity: { value: 0.6 },
    uDim: DIM.wind,
  };
  const mat = new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'smoke-ribbons';
  mesh.frustumCulled = false;
  group.add(mesh);

  // stream-tube outline (top and bottom boundary in the vertical plane through the axis)
  const outlineMat = new LineDashedMaterial({
    color: THEME.ideal,
    dashSize: 0.1,
    gapSize: 0.07,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const outlines = [1, -1].map((sign) => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3));
    const line = new Line(g, outlineMat);
    line.frustumCulled = false;
    line.userData.sign = sign;
    group.add(line);
    return line;
  });

  let tauA = Number.NaN;
  const xsM = xs.map((x) => x * RADIUS_M);
  function integrate(a: number): void {
    tauA = a;
    const tau = travelTime(xsM, a, RADIUS_M);
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < n; i++) {
        const v = (l * n + i) * 2;
        aTau[v] = tau[i] as number;
        aTau[v + 1] = tau[i] as number;
      }
    }
    tauAttr.needsUpdate = true;
    for (const line of outlines) {
      const pos = line.geometry.getAttribute('position') as BufferAttribute;
      const sign = line.userData.sign as number;
      for (let i = 0; i < n; i++) {
        pos.setXYZ(i, xs[i] as number, sign * diskFlow.tubeR(xs[i] as number, a), 0);
      }
      pos.needsUpdate = true;
      line.computeLineDistances();
    }
  }

  return {
    object3d: group,
    get tauA() {
      return tauA;
    },
    update(_s, _ui, _dt) {
      group.position.copy(flow.center);
      group.scale.setScalar(flow.radius);
      const a = flow.aVisual;
      if (!(Math.abs(a - tauA) <= SMOKE.tauEpsilon)) integrate(a);
      uniforms.uA.value = a;
      uniforms.uTurb.value = flow.turbulence;
      uniforms.uTime.value = flow.t;
      uniforms.uFlowS.value = flow.flowS;
      uniforms.uSpeedColor.value = flow.windFocus;
      uniforms.uIntensity.value = 0.6 + 0.4 * flow.windFocus;
      outlineMat.opacity = 0.8 * flow.windFocus;
      for (const line of outlines) line.visible = flow.windFocus > 0.01;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      outlineMat.dispose();
      outlines.forEach((l) => l.geometry.dispose());
    },
  };
}
