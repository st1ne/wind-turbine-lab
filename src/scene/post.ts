/**
 * Post chain (TECH_SPEC §4.4): RenderPass → UnrealBloomPass(0.55, 0.42, 0.82) → SMAA → OutputPass.
 * The OutputPass applies the renderer's tone mapping and sRGB conversion.
 */
import { Vector2, type Camera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const BLOOM = { strength: 0.55, radius: 0.42, threshold: 0.82 } as const;

export interface Post {
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  render(dt: number): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: Camera): Post {
  const composer = new EffectComposer(renderer);
  const size = renderer.getSize(new Vector2());
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new Vector2(size.x, size.y),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  );
  composer.addPass(bloom);
  composer.addPass(new SMAAPass());
  composer.addPass(new OutputPass());

  return {
    composer,
    bloom,
    render(dt) {
      composer.render(dt);
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
