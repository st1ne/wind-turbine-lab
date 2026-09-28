/**
 * Cutaway clipping with stencil caps (TECH_SPEC §8), after three.js' clipping-stencil example.
 *
 *   plane   world plane through the shaft axis, z = side·k; everything with side·z > k is
 *           clipped (the camera's half). k animates from OPEN (nothing cut) to 0.
 *   stencil per clipped closed mesh: back faces increment, front faces decrement the stencil
 *           (no colour, no depth), so pixels whose view ray is inside a solid at the plane
 *           end up non-zero
 *   cap     a hatched quad on the plane drawn where stencil ≠ 0; it resets the stencil
 *   edge    2 px amber lines where each mesh crosses the plane, sliced on the CPU
 *
 * Targets must be closed, outward-facing shells (see section.ts) and their line parents must
 * share the world z axis (only x/y translation and rotation about z above them).
 */
import {
  AlwaysStencilFunc,
  BackSide,
  Color,
  DecrementWrapStencilOp,
  DoubleSide,
  FrontSide,
  Group,
  IncrementWrapStencilOp,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NotEqualStencilFunc,
  Plane,
  PlaneGeometry,
  RepeatWrapping,
  ReplaceStencilOp,
  Vector3,
  type Material,
  type Object3D,
  type Side,
  type StencilOp,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { THEME } from '@/config/theme';
import { createCanvasTexture } from '@/scene/canvasTexture';
import { applyBend, type BendSpec } from '@/scene/materials';
import { sliceTriangles, triangleSoup } from '@/scene/section';

/** render order: stencil passes, then the cap (normal meshes default to 0) */
const STENCIL_ORDER = 10;
const CAP_ORDER = 11;
/** edge lines sit this far in front of the cap (toward the camera), world units */
const EDGE_LIFT = 3e-4;
const OFF = 1e4;

export interface CutTarget {
  readonly mesh: Mesh;
  /** frame for the edge lines; the mesh's pose relative to it must not change while cut */
  readonly lineParent: Object3D;
  /** vertex displacement of the mesh (tower bending) */
  readonly bend?: BendSpec;
  /** CPU mirror of `bend`: x offset at object-space height y */
  readonly displaceX?: (y: number) => number;
}

export interface CutawayOptions {
  /** world-space centre and size of the cap quad (must cover every section) */
  readonly capCenter: Vector3;
  readonly capWidth: number;
  readonly capHeight: number;
}

export interface Cutaway {
  /** the cap quad, in world space */
  readonly object3d: Group;
  readonly plane: Plane;
  /** side = +1 clips z > k, −1 clips z < −k; k = null turns the cut off */
  setPlane(side: 1 | -1, k: number | null): void;
  /** re-slice the edge lines when the plane or a bend moved */
  update(): void;
  setResolution(width: number, height: number): void;
  dispose(): void;
}

function hatchTexture(): ReturnType<typeof createCanvasTexture> {
  const tex = createCanvasTexture(64, 64);
  const { ctx } = tex;
  ctx.fillStyle = '#151922';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#2f3746';
  ctx.lineWidth = 7;
  for (let k = -64; k <= 128; k += 32) {
    ctx.beginPath();
    ctx.moveTo(k, 64);
    ctx.lineTo(k + 64, 0);
    ctx.stroke();
  }
  tex.texture.wrapS = RepeatWrapping;
  tex.texture.wrapT = RepeatWrapping;
  tex.texture.needsUpdate = true;
  return tex;
}

function stencilMaterial(side: Side, op: StencilOp, plane: Plane, bend?: BendSpec): Material {
  const m = new MeshBasicMaterial({
    side,
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: AlwaysStencilFunc,
    stencilFail: op,
    stencilZFail: op,
    stencilZPass: op,
    clippingPlanes: [plane],
  });
  if (bend) applyBend(m, bend);
  return m;
}

interface Slot {
  readonly target: CutTarget;
  /** triangle soup in the line parent's frame (before bending) */
  readonly soup: Float32Array;
  readonly lines: LineSegments2;
  readonly stencils: Mesh[];
  lastBend: number;
}

export function createCutaway(targets: readonly CutTarget[], opts: CutawayOptions): Cutaway {
  const plane = new Plane(new Vector3(0, 0, -1), OFF);
  const group = new Group();
  group.name = 'cutaway';

  const hatch = hatchTexture();
  hatch.texture.repeat.set(opts.capWidth / 0.0075, opts.capHeight / 0.0075);
  const capGeo = new PlaneGeometry(opts.capWidth, opts.capHeight);
  const capMat = new MeshBasicMaterial({
    map: hatch.texture,
    side: DoubleSide,
    stencilWrite: true,
    stencilRef: 0,
    stencilFunc: NotEqualStencilFunc,
    stencilFail: ReplaceStencilOp,
    stencilZFail: ReplaceStencilOp,
    stencilZPass: ReplaceStencilOp,
  });
  const cap = new Mesh(capGeo, capMat);
  cap.name = 'cutaway-cap';
  cap.renderOrder = CAP_ORDER;
  cap.position.copy(opts.capCenter);
  cap.visible = false;
  group.add(cap);

  const edgeMat = new LineMaterial({
    color: new Color(THEME.power).getHex(),
    linewidth: 2,
    worldUnits: false,
  });

  const rel = new Matrix4();
  const slots: Slot[] = targets.map((target) => {
    const { mesh, lineParent } = target;
    const mat = mesh.material as Material;
    mat.clippingPlanes = [plane];
    mat.clipShadows = true;
    const stencils = [
      stencilMaterial(BackSide, IncrementWrapStencilOp, plane, target.bend),
      stencilMaterial(FrontSide, DecrementWrapStencilOp, plane, target.bend),
    ].map((m) => {
      const s = new Mesh(mesh.geometry, m);
      s.renderOrder = STENCIL_ORDER;
      s.visible = false;
      mesh.add(s);
      return s;
    });
    // pose of the mesh in the line parent's frame, captured once
    mesh.updateWorldMatrix(true, false);
    lineParent.updateWorldMatrix(true, false);
    rel.copy(lineParent.matrixWorld).invert().multiply(mesh.matrixWorld);
    const lines = new LineSegments2(new LineSegmentsGeometry(), edgeMat);
    lines.name = `cut-edge-${mesh.name}`;
    lines.visible = false;
    lines.frustumCulled = false;
    lineParent.add(lines);
    return { target, soup: triangleSoup(mesh.geometry, rel), lines, stencils, lastBend: NaN };
  });

  let side: 1 | -1 = 1;
  let k: number | null = null;
  let slicedK = NaN;
  let slicedSide = 0;
  const p = new Vector3();
  const segs: number[] = [];

  function slice(slot: Slot): void {
    const parent = slot.target.lineParent;
    // world plane z = side·k (+ a lift toward the camera) expressed in the parent's frame
    p.set(0, 0, side * ((k ?? 0) + EDGE_LIFT));
    parent.worldToLocal(p);
    segs.length = 0;
    sliceTriangles(slot.soup, p.z, segs);
    const dx = slot.target.displaceX;
    if (dx)
      for (let i = 0; i < segs.length; i += 3)
        segs[i] = (segs[i] as number) + dx(segs[i + 1] as number);
    slot.lines.visible = segs.length > 0;
    if (segs.length > 0) slot.lines.geometry.setPositions(segs);
  }

  return {
    object3d: group,
    plane,
    setPlane(s, kk) {
      side = s;
      k = kk;
      plane.normal.set(0, 0, -side);
      plane.constant = kk ?? OFF;
      const on = kk !== null;
      cap.visible = on;
      cap.position.z = side * (kk ?? 0);
      for (const slot of slots) {
        for (const st of slot.stencils) st.visible = on;
        if (!on) slot.lines.visible = false;
      }
    },
    update() {
      if (k === null) return;
      const moved = k !== slicedK || side !== slicedSide;
      for (const slot of slots) {
        const bendNow = slot.target.displaceX?.(1e3) ?? 0;
        if (moved || Math.abs(bendNow - slot.lastBend) > 1e-3 || Number.isNaN(slot.lastBend)) {
          slot.lastBend = bendNow;
          slice(slot);
        }
      }
      slicedK = k;
      slicedSide = side;
    },
    setResolution(width, height) {
      edgeMat.resolution.set(width, height);
    },
    dispose() {
      capGeo.dispose();
      capMat.dispose();
      hatch.texture.dispose();
      edgeMat.dispose();
      for (const slot of slots) {
        slot.lines.geometry.dispose();
        slot.lines.removeFromParent();
        for (const st of slot.stencils) {
          (st.material as Material).dispose();
          st.removeFromParent();
        }
      }
    },
  };
}
