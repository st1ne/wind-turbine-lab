/**
 * Tip vortices (TECH_SPEC §9): three helices trailed by the blade tips, on the stream-tube
 * radius r_t(x) from the rotor to 5R, fading downstream. The vortex shed from blade k when the
 * rotor was at azimuth ψ − ωτ has convected x = u_c τ, so at x its angle is
 *
 *   θ_k(x) = −ψ + 2πk/3 + ω x / u_c,   u_c = V (1 − a)   (helix pitch p = 2π u_c / ω)
 *
 * matching the rotor's azimuth convention (rotor.ts: spin.rotation.x = −ψ). Positions are
 * computed in the vertex shader in rotor-radius units, like the smoke.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  ShaderMaterial,
} from 'three';
import { BLADES, RADIUS_M } from '@/config/turbine';
import { DISK_FLOW_GLSL } from '@/scene/fx/diskFlow';
import { spinFactor, type Flow } from '@/scene/fx/flow';
import { DIM } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const X_END = 5;
const SAMPLES = 260;
/** below this convection speed the helix pitch is meaningless, m/s */
const MIN_CONVECTION_M_S = 0.5;

const VERT = /* glsl */ `
${DISK_FLOW_GLSL}
uniform float uA;
uniform float uPsi;
uniform float uTwist;
attribute float aX;
attribute float aBlade;
varying float vX;
void main() {
  float r = 0.985 * diskTubeR(aX, uA);
  float th = -uPsi + aBlade * ${((2 * Math.PI) / BLADES).toFixed(6)} + uTwist * aX;
  vX = aX;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aX, r * cos(th), r * sin(th), 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uVis;
uniform float uDim;
varying float vX;
void main() {
  float fade = pow(max(1.0 - vX / ${X_END.toFixed(1)}, 0.0), 1.4) * smoothstep(0.0, 0.05, vX);
  vec3 col = mix(uColor, vec3(dot(uColor, vec3(0.2126, 0.7152, 0.0722))) * 0.35, uDim);
  gl_FragColor = vec4(col * fade * uVis, fade * uVis);
}
`;

/** Radians the helix turns per rotor radius downstream: ω R / u_c. */
export function helixTwist(omegaRad: number, V: number, a: number): number {
  return (omegaRad * RADIUS_M) / Math.max(V * (1 - a), MIN_CONVECTION_M_S);
}

export function createTipVortices(flow: Flow): SceneModule<LineSegments> {
  const verts = BLADES * SAMPLES * 2;
  const aX = new Float32Array(verts);
  const aBlade = new Float32Array(verts);
  let v = 0;
  for (let k = 0; k < BLADES; k++) {
    for (let i = 0; i < SAMPLES; i++) {
      for (const j of [i, i + 1]) {
        aX[v] = (X_END * j) / SAMPLES;
        aBlade[v] = k;
        v++;
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('aX', new BufferAttribute(aX, 1));
  geo.setAttribute('aBlade', new BufferAttribute(aBlade, 1));
  const uniforms = {
    uA: { value: 0 },
    uPsi: { value: 0 },
    uTwist: { value: 0 },
    uColor: { value: new Color('#e6f7ff') },
    uVis: { value: 0 },
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
  const lines = new LineSegments(geo, mat);
  lines.name = 'tip-vortices';
  lines.frustumCulled = false;

  return {
    object3d: lines,
    update() {
      lines.position.copy(flow.center);
      lines.scale.setScalar(flow.radius);
      uniforms.uA.value = flow.aVisual;
      uniforms.uPsi.value = flow.psi;
      uniforms.uTwist.value = helixTwist(flow.omega, flow.V, flow.aVisual);
      // a hint in All, clear in Wind; only a spinning real rotor sheds tip vortices
      const vis = (0.12 + 0.43 * flow.windFocus) * spinFactor(flow.omega) * (1 - flow.ideal);
      uniforms.uVis.value = vis;
      lines.visible = vis > 0.005;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
