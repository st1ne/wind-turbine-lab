/**
 * Engraved ruler along the bench front edge, in full-scale metres (TECH_SPEC §4.1).
 * 0 m is the turbine axis; the wind flows toward positive values.
 */
import { Group, Mesh, PlaneGeometry } from 'three';
import { ENVIRONMENT } from '@/config/environment';
import { createCanvasTexture, MONO_FONT } from '@/scene/canvasTexture';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';
import { toModel } from '@/scene/units';

const WIDTH_M = 0.04;

export function createRuler(): SceneModule<Group> {
  const group = new Group();
  group.name = 'ruler';
  const { fromM, toM, z } = ENVIRONMENT.ruler;
  const x0 = toModel(fromM);
  const x1 = toModel(toM);
  const lengthModel = x1 - x0;

  const W = 4096;
  const H = Math.round((W * WIDTH_M) / lengthModel);
  const tex = createCanvasTexture(W, H);
  const { ctx } = tex;
  const px = (m: number): number => ((m - fromM) / (toM - fromM)) * W;
  ctx.fillStyle = '#1d222c';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#aeb6c4';
  ctx.fillStyle = '#c9d0dc';
  ctx.textBaseline = 'bottom';
  ctx.font = `500 ${Math.round(H * 0.42)}px ${MONO_FONT}`;
  for (let m = Math.ceil(fromM / 10) * 10; m <= toM; m += 10) {
    const major = m % 50 === 0;
    const x = Math.round(px(m)) + 0.5;
    ctx.lineWidth = major ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H * (major ? 0.42 : 0.24));
    ctx.stroke();
    if (major) {
      ctx.textAlign = m === fromM ? 'left' : 'center';
      ctx.fillText(m === 0 ? '0 m' : `${m}`, x, H - 3);
    }
  }
  tex.texture.needsUpdate = true;

  const geo = new PlaneGeometry(lengthModel, WIDTH_M);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(
    geo,
    makeMaterial({ map: tex.texture, roughness: 0.4, metalness: 0.6 }, 'environment'),
  );
  mesh.position.set((x0 + x1) / 2, ENVIRONMENT.bench.topY + 0.0015, z - WIDTH_M / 2);
  mesh.receiveShadow = true;
  group.add(mesh);

  return {
    object3d: group,
    update() {},
    dispose() {
      geo.dispose();
      tex.texture.dispose();
    },
  };
}
