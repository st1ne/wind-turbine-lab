/**
 * Trees in the wind (TECH_SPEC §11): a vertex-shader bend of the instanced trees along +x
 * (downwind), growing with height, by the angle
 *
 *   θ = 18° · min(V̄², 900) / 900        (full lean at 30 m/s)
 *
 * plus a flutter from the gusts (V − V̄) and a small storm shimmer, phase-shifted per tree.
 * Driven by sim time, so it freezes with the sim.
 */
import { Group, MeshDepthMaterial, RGBADepthPacking, type Material } from 'three';
import type { Diorama } from '@/scene/environment/diorama';
import { TREE_HEIGHT_M } from '@/scene/environment/diorama';
import { applyBend, type BendSpec } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { toModel } from '@/scene/units';

const DEG = Math.PI / 180;
export const TREE_MAX_BEND_DEG = 18;

/** Steady lean for mean wind V̄ (§11). */
export function treeBendDeg(Vmean: number): number {
  return (TREE_MAX_BEND_DEG * Math.min(Vmean * Vmean, 900)) / 900;
}

export function createTreeSway(diorama: Diorama): SceneModule<Group> {
  const H = toModel(TREE_HEIGHT_M);
  const uniforms = { uBend: { value: 0 }, uFlutter: { value: 0 }, uTime: { value: 0 } };
  const bend: BendSpec = {
    uniforms,
    displace: /* glsl */ `{
      float h = clamp(position.y / ${H.toFixed(5)}, 0.0, 1.0);
      float phase = float(gl_InstanceID) * 1.7;
      float th = uBend + uFlutter * sin(uTime * 3.1 + phase) * h;
      // lean grows with height (a cantilever-ish curve), rotating about the tree base
      float lean = sin(th) * h;
      transformed.x += lean * position.y;
      transformed.y -= (1.0 - cos(th)) * h * position.y;
    }`,
    key: 'tree-bend',
  };
  const { trunks, crowns } = diorama.trees;
  // the shadow pass needs the same bend, or the trees would cast upright shadows
  const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking });
  applyBend(depth, { ...bend, key: 'tree-bend-depth' });
  for (const mesh of [trunks, crowns]) {
    applyBend(mesh.material as Material, bend, 'environment');
    mesh.customDepthMaterial = depth;
  }
  return {
    object3d: new Group(),
    update(s) {
      uniforms.uBend.value = treeBendDeg(s.Vmean) * DEG;
      const gust = Math.abs(s.V - s.Vmean) / Math.max(s.Vmean, 1);
      uniforms.uFlutter.value = (3 * gust + 2.5 * s.stormLevel) * DEG;
      uniforms.uTime.value = s.t;
    },
    dispose() {
      depth.dispose();
    },
  };
}
