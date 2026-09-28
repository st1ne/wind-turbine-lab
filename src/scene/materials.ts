/**
 * Material factory (TECH_SPEC §9). Every turbine/environment material gets the shared uniform
 * uDim of its system injected via onBeforeCompile: dimmed meshes desaturate toward luminance and
 * multiply by 0.35. Follow modes (Phase 8) animate DIM[system].value over 400 ms.
 */
import {
  MeshStandardMaterial,
  type Material,
  type MeshStandardMaterialParameters,
  type WebGLProgramParametersWithUniforms,
} from 'three';

/**
 * System tags (§9). `rotor` (blades, hub) is emphasized by both Power and Loads, so it gets
 * its own tag instead of belonging to either.
 */
export type SystemTag = 'wind' | 'power' | 'rotor' | 'loads' | 'structure' | 'environment';

/** Shared uDim uniforms, one per system (0 = full color, 1 = dimmed). */
export const DIM: Record<SystemTag, { value: number }> = {
  wind: { value: 0 },
  power: { value: 0 },
  rotor: { value: 0 },
  loads: { value: 0 },
  structure: { value: 0 },
  environment: { value: 0 },
};

const DIM_CHUNK = /* glsl */ `
  {
    float dimLum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(dimLum) * 0.35, uDim);
  }
  #include <dithering_fragment>`;

/** Patch a compiled shader so it reads the system's uDim. Usable by custom materials too. */
export function injectDim(shader: WebGLProgramParametersWithUniforms, system: SystemTag): void {
  shader.uniforms.uDim = DIM[system];
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', 'uniform float uDim;\nvoid main() {')
    .replace('#include <dithering_fragment>', DIM_CHUNK);
}

export function makeMaterial(
  opts: MeshStandardMaterialParameters,
  system: SystemTag,
): MeshStandardMaterial {
  const m = new MeshStandardMaterial(opts);
  m.onBeforeCompile = (shader) => injectDim(shader, system);
  m.userData.system = system;
  return m;
}

/** Object-space vertex displacement shared by a mesh and its helper passes (stencil caps). */
export interface BendSpec {
  readonly uniforms: Record<string, { value: number }>;
  /** GLSL that may modify `transformed` (and read `position`) */
  readonly displace: string;
  /** program cache key for this displacement */
  readonly key: string;
}

/** Patch any built-in material so its vertices are displaced per `bend` before projection. */
export function applyBend(m: Material, bend: BendSpec, system?: SystemTag): void {
  m.onBeforeCompile = (shader) => {
    if (system) injectDim(shader, system);
    Object.assign(shader.uniforms, bend.uniforms);
    const decl = Object.keys(bend.uniforms)
      .map((u) => `uniform float ${u};`)
      .join('\n');
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `${decl}\nvoid main() {`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${bend.displace}`);
  };
  m.customProgramCacheKey = () => bend.key;
}

/**
 * Material whose vertices are displaced in object space before projection (tower bending,
 * blade flap). `uniforms` are merged into the shader; `displace` is GLSL that may modify
 * `transformed` (and read `position`). The cache key keeps each variant's program separate.
 */
export function makeBendMaterial(
  opts: MeshStandardMaterialParameters,
  system: SystemTag,
  uniforms: Record<string, { value: number }>,
  displace: string,
  key: string,
): MeshStandardMaterial {
  const m = new MeshStandardMaterial(opts);
  applyBend(m, { uniforms, displace, key }, system);
  m.userData.system = system;
  return m;
}
