/**
 * Workbench with legs and the brass plate (TECH_SPEC §4.1):
 * "{BRAND domain} / wind-turbine · 5 MW class · 1:200".
 */
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh } from 'three';
import { BRAND } from '@/config/brand';
import { ENVIRONMENT } from '@/config/environment';
import { PALETTE } from '@/config/theme';
import { createCanvasTexture, MONO_FONT, UI_FONT } from '@/scene/canvasTexture';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const B = ENVIRONMENT.bench;

export function createBench(): SceneModule<Group> {
  const group = new Group();
  group.name = 'bench';
  const length = B.xMax - B.xMin;
  const cx = (B.xMin + B.xMax) / 2;

  const topGeo = new BoxGeometry(length, B.thickness, B.depth);
  const top = new Mesh(
    topGeo,
    makeMaterial({ color: PALETTE.benchTop, roughness: 0.7, metalness: 0.15 }, 'environment'),
  );
  top.position.set(cx, B.topY - B.thickness / 2, 0);
  top.receiveShadow = true;
  group.add(top);

  // Metal edge trim along the front and back.
  const trimGeo = new BoxGeometry(length + 0.02, B.thickness + 0.012, 0.012);
  const trimMat = makeMaterial(
    { color: PALETTE.benchEdge, roughness: 0.35, metalness: 0.8 },
    'environment',
  );
  const trims = new InstancedMesh(trimGeo, trimMat, 2);
  const m = new Matrix4();
  trims.setMatrixAt(0, m.makeTranslation(cx, B.topY - B.thickness / 2, B.depth / 2 + 0.006));
  trims.setMatrixAt(1, m.makeTranslation(cx, B.topY - B.thickness / 2, -B.depth / 2 - 0.006));
  group.add(trims);

  const legGeo = new BoxGeometry(0.07, B.legHeight, 0.07);
  const legs = new InstancedMesh(
    legGeo,
    makeMaterial({ color: PALETTE.benchLeg, roughness: 0.6, metalness: 0.5 }, 'environment'),
    4,
  );
  const legY = B.topY - B.thickness - B.legHeight / 2;
  let k = 0;
  for (const x of [B.xMin + 0.12, B.xMax - 0.12]) {
    for (const z of [-B.depth / 2 + 0.1, B.depth / 2 - 0.1]) {
      legs.setMatrixAt(k++, m.makeTranslation(x, legY, z));
    }
  }
  legs.castShadow = true;
  group.add(legs);

  // Brass plate on the front right of the bench.
  const plate = createCanvasTexture(1024, 256);
  const { ctx } = plate;
  ctx.fillStyle = '#6e5424';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#e8cf8d';
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.fillStyle = '#f3dea0';
  ctx.textAlign = 'center';
  ctx.font = `600 58px ${UI_FONT}`;
  ctx.fillText(BRAND.domain ? `${BRAND.domain} / wind-turbine` : 'wind-turbine', 512, 112);
  ctx.font = `500 42px ${MONO_FONT}`;
  ctx.fillText('5 MW class · 1:200', 512, 184);
  plate.texture.needsUpdate = true;
  const plateGeo = new BoxGeometry(0.2, 0.006, 0.05);
  const plateMesh = new Mesh(
    plateGeo,
    makeMaterial(
      { color: PALETTE.brass, map: plate.texture, roughness: 0.35, metalness: 0.85 },
      'environment',
    ),
  );
  plateMesh.position.set(1.72, B.topY + 0.003, 0.48);
  plateMesh.rotation.y = -0.12;
  plateMesh.castShadow = true;
  group.add(plateMesh);

  return {
    object3d: group,
    update() {},
    dispose() {
      [topGeo, trimGeo, legGeo, plateGeo].forEach((g) => g.dispose());
      plate.texture.dispose();
    },
  };
}
