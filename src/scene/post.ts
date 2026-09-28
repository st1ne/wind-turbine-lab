/**
 * Post chain (TECH_SPEC §4.4, §11): RenderPass → UnrealBloomPass(0.55, 0.42, 0.82) → SMAA →
 * storm vignette + grain (only enabled above storm level 0.5) → OutputPass.
 * The OutputPass applies the renderer's tone mapping and sRGB conversion. The scene target
 * carries a stencil buffer for the cutaway caps.
 */
import {
  HalfFloatType,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const BLOOM = { strength: 0.55, radius: 0.42, threshold: 0.82 } as const;

/** Storm look (§11): vignette and 1 % film grain fade in above storm level 0.5. */
const STORM_SHADER = {
  name: 'StormVignetteGrain',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 43.1) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - uVignette * smoothstep(0.25, 0.75, dot(d, d) * 2.0);
      c.rgb *= v;
      c.rgb += (hash(vUv * 1000.0) - 0.5) * uGrain * max(c.rgb, vec3(0.05));
      gl_FragColor = c;
    }`,
};

export interface Post {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  render(dt: number): void;
  /** storm level s (0–1) and time for the grain */
  setStorm(s: number, timeS: number): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera): Post {
  const size = renderer.getSize(new Vector2());
  const dpr = renderer.getPixelRatio();
  // the cutaway caps need a stencil buffer in the scene render target (§8)
  const target = new WebGLRenderTarget(size.x * dpr, size.y * dpr, {
    type: HalfFloatType,
    stencilBuffer: true,
  });
  target.texture.name = 'EffectComposer.rt1';
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(size.x, size.y);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new Vector2(size.x, size.y),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  const storm = new ShaderPass(STORM_SHADER);
  storm.enabled = false;
  composer.addPass(storm);
  // ShaderPass clones the uniforms; keep typed handles to the clones
  const stormU = storm.uniforms as unknown as {
    uVignette: { value: number };
    uGrain: { value: number };
    uTime: { value: number };
  };
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    render(dt) {
      composer.render(dt);
    },
    setStorm(s, timeS) {
      const k = Math.min(Math.max((s - 0.5) / 0.5, 0), 1);
      storm.enabled = k > 0.001;
      stormU.uVignette.value = 0.35 * k;
      stormU.uGrain.value = 0.02 * k;
      stormU.uTime.value = timeS % 100;
    },
    resize(width, height, dpr) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    },
    dispose() {
      composer.dispose();
    },
  };
}
