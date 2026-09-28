/**
 * Geometry helpers for the cutaway (TECH_SPEC §8):
 *   - flipGeometry: reverse winding and normals (inner walls of hollow shells)
 *   - sliceTriangles: segments where a mesh crosses the plane z = z0 (the amber cut edge)
 *   - signedVolume / openEdges: checks that a shell is closed and outward-facing, which the
 *     stencil caps rely on (every view ray must cross its surface an even number of times)
 */
import { BufferAttribute, type BufferGeometry, type Matrix4, Vector3 } from 'three';

/** Reverse triangle winding and negate normals in place. */
export function flipGeometry<G extends BufferGeometry>(g: G): G {
  const index = g.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1] as number;
      a[i + 1] = a[i + 2] as number;
      a[i + 2] = t;
    }
    index.needsUpdate = true;
  } else {
    for (const attr of Object.values(g.attributes)) {
      if (!(attr instanceof BufferAttribute)) continue;
      const n = attr.itemSize;
      const a = attr.array;
      for (let v = 0; v < attr.count; v += 3) {
        for (let k = 0; k < n; k++) {
          const i1 = (v + 1) * n + k;
          const i2 = (v + 2) * n + k;
          const t = a[i1] as number;
          a[i1] = a[i2] as number;
          a[i2] = t;
        }
      }
      attr.needsUpdate = true;
    }
  }
  const normal = g.getAttribute('normal');
  if (normal instanceof BufferAttribute) {
    const a = normal.array;
    for (let i = 0; i < a.length; i++) a[i] = -(a[i] as number);
    normal.needsUpdate = true;
  }
  return g;
}

/** Triangle soup of a geometry: positions transformed by `matrix`, three vertices per face. */
export function triangleSoup(g: BufferGeometry, matrix?: Matrix4): Float32Array {
  const pos = g.getAttribute('position');
  const index = g.getIndex();
  const n = index ? index.count : pos.count;
  const out = new Float32Array(n * 3);
  const v = new Vector3();
  for (let i = 0; i < n; i++) {
    const vi = index ? index.getX(i) : i;
    v.fromBufferAttribute(pos, vi);
    if (matrix) v.applyMatrix4(matrix);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  return out;
}

/**
 * Append to `out` the segments (x0,y0,z0,x1,y1,z1) where the triangles of `soup` cross the
 * plane z = z0. Vertices exactly on the plane count as slightly above it, so shared edges
 * never produce duplicate or missing segments.
 */
export function sliceTriangles(soup: Float32Array, z0: number, out: number[]): void {
  const p = soup;
  for (let t = 0; t < p.length; t += 9) {
    const d0 = (p[t + 2] as number) - z0 || 1e-9;
    const d1 = (p[t + 5] as number) - z0 || 1e-9;
    const d2 = (p[t + 8] as number) - z0 || 1e-9;
    const s0 = d0 > 0;
    const s1 = d1 > 0;
    const s2 = d2 > 0;
    if (s0 === s1 && s1 === s2) continue;
    const ds = [d0, d1, d2];
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ] as const) {
      const da = ds[a] as number;
      const db = ds[b] as number;
      if (da > 0 === db > 0) continue;
      const k = da / (da - db);
      const ia = t + a * 3;
      const ib = t + b * 3;
      out.push(
        (p[ia] as number) + ((p[ib] as number) - (p[ia] as number)) * k,
        (p[ia + 1] as number) + ((p[ib + 1] as number) - (p[ia + 1] as number)) * k,
        z0,
      );
    }
  }
}

/** Signed volume of a closed triangle soup; positive when the faces point outward. */
export function signedVolume(soup: Float32Array): number {
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  let v = 0;
  for (let t = 0; t < soup.length; t += 9) {
    a.fromArray(soup, t);
    b.fromArray(soup, t + 3);
    c.fromArray(soup, t + 6);
    v += a.dot(b.cross(c)) / 6;
  }
  return v;
}

/**
 * Number of edges not shared by exactly two faces with opposite directions, after welding
 * positions to `tol`. Zero means a closed, consistently oriented (watertight) surface.
 * Degenerate faces (two welded corners) are ignored.
 */
export function openEdges(soup: Float32Array, tol = 1e-4): number {
  const key = (i: number): string =>
    `${Math.round((soup[i] as number) / tol)},${Math.round((soup[i + 1] as number) / tol)},${Math.round((soup[i + 2] as number) / tol)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < soup.length; t += 9) {
    const k = [key(t), key(t + 3), key(t + 6)];
    if (k[0] === k[1] || k[1] === k[2] || k[2] === k[0]) continue;
    for (let e = 0; e < 3; e++) {
      const a = k[e] as string;
      const b = k[(e + 1) % 3] as string;
      // directed edge a→b counts +1, its twin b→a −1
      const fwd = `${a}|${b}`;
      const rev = `${b}|${a}`;
      if (edges.has(rev)) {
        const c = (edges.get(rev) as number) - 1;
        if (c === 0) edges.delete(rev);
        else edges.set(rev, c);
      } else {
        edges.set(fwd, (edges.get(fwd) ?? 0) + 1);
      }
    }
  }
  let open = 0;
  for (const c of edges.values()) open += Math.abs(c);
  return open;
}
