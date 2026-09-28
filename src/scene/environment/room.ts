/**
 * Dark lab room (TECH_SPEC §4.1): walls, floor and emissive ceiling light strips (bloom).
 */
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  BackSide,
} from 'three';
import { ENVIRONMENT } from '@/config/environment';
import { PALETTE } from '@/config/theme';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const ROOM = { halfX: 7.5, halfZ: 7.5, height: 5.2 } as const;

export function createRoom(): SceneModule<Group> {
  const group = new Group();
  group.name = 'room';
  const floorY = ENVIRONMENT.room.floorY;

  const wallsGeo = new BoxGeometry(ROOM.halfX * 2, ROOM.height, ROOM.halfZ * 2);
  const walls = new Mesh(
    wallsGeo,
    makeMaterial({ color: PALETTE.room, roughness: 0.92, metalness: 0, side: BackSide }, 'environment'),
  );
  walls.position.y = floorY + ROOM.height / 2 - 0.001;
  group.add(walls);

  const floorGeo = new PlaneGeometry(ROOM.halfX * 2, ROOM.halfZ * 2);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = new Mesh(
    floorGeo,
    makeMaterial({ color: PALETTE.roomFloor, roughness: 0.55, metalness: 0.2 }, 'environment'),
  );
  floor.position.y = floorY;
  floor.receiveShadow = true;
  group.add(floor);

  // Ceiling light strips: long thin emissive bars, one instanced draw call.
  const stripGeo = new BoxGeometry(3.2, 0.03, 0.08);
  const stripMat = new MeshBasicMaterial({ color: new Color(PALETTE.lightStrip).multiplyScalar(2.2) });
  const strips = new InstancedMesh(stripGeo, stripMat, 6);
  const m = new Matrix4();
  let k = 0;
  for (const x of [-2.2, 1.4]) {
    for (const z of [-1.8, 0, 1.8]) {
      m.makeTranslation(x, floorY + ROOM.height - 0.05, z);
      strips.setMatrixAt(k++, m);
    }
  }
  group.add(strips);

  return {
    object3d: group,
    update() {},
    dispose() {
      wallsGeo.dispose();
      floorGeo.dispose();
      stripGeo.dispose();
    },
  };
}
