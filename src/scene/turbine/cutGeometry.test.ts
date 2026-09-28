/**
 * The cutaway's stencil caps need every clipped mesh to be a closed, outward-facing solid
 * (§8: "caps have no gaps from any angle"). Checks the hollow shells built for Phase 7.
 */
import { describe, expect, it } from 'vitest';
import { SphereGeometry } from 'three';
import { NACELLE_SIZE_M } from '@/config/turbine';
import { openEdges, signedVolume, sliceTriangles, triangleSoup } from '@/scene/section';
import { SPINNER, createSpinnerGeometry } from '@/scene/turbine/hub';
import { createShellGeometry, SHELL_WALL_M } from '@/scene/turbine/nacelle';
import { createTubeSection, TOWER_CUT_FROM_M, TOWER_WALL_M } from '@/scene/turbine/tower';
import { TOWER_HEIGHT_M } from '@/config/turbine';

const shells = {
  'nacelle shell': () => createShellGeometry(),
  spinner: () => createSpinnerGeometry(),
  'tower top section': () => createTubeSection(TOWER_CUT_FROM_M, TOWER_HEIGHT_M, TOWER_WALL_M),
  'hub body': () => new SphereGeometry(1.45, 24, 16),
};

describe('clipped meshes are closed, outward-facing solids', () => {
  it.each(Object.entries(shells))('%s', (_name, make) => {
    const soup = triangleSoup(make());
    expect(openEdges(soup)).toBe(0);
    expect(signedVolume(soup)).toBeGreaterThan(0);
  });

  it('the nacelle shell is hollow: its volume is a thin wall, not the whole box', () => {
    const v = signedVolume(triangleSoup(createShellGeometry()));
    const { width, height, length } = NACELLE_SIZE_M;
    const box = width * height * length;
    const t = SHELL_WALL_M;
    const inner = (width - 2 * t) * (height - 2 * t) * (length - 2 * t);
    // rounded corners shave a little off both skins
    expect(v).toBeGreaterThan(0.7 * (box - inner));
    expect(v).toBeLessThan(1.05 * (box - inner));
  });

  it('the spinner wall is thin', () => {
    const v = signedVolume(triangleSoup(createSpinnerGeometry()));
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(2 * Math.PI * SPINNER.radius * 6 * SPINNER.wall);
  });
});

describe('section slicing', () => {
  it('slices the shell at z = 0 into closed outer and inner outlines', () => {
    const soup = triangleSoup(createShellGeometry());
    const segs: number[] = [];
    sliceTriangles(soup, 0, segs);
    expect(segs.length % 6).toBe(0);
    // every segment endpoint is shared by exactly two segments (closed loops)
    const key = (i: number): string =>
      `${(segs[i] as number).toFixed(4)},${(segs[i + 1] as number).toFixed(4)}`;
    const count = new Map<string, number>();
    for (let i = 0; i < segs.length; i += 3) count.set(key(i), (count.get(key(i)) ?? 0) + 1);
    for (const c of count.values()) expect(c).toBe(2);
    // outline spans the full nacelle length
    const xs = segs.filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(NACELLE_SIZE_M.length, 1);
  });

  it('a plane outside the solid yields nothing', () => {
    const segs: number[] = [];
    sliceTriangles(triangleSoup(createShellGeometry()), NACELLE_SIZE_M.width, segs);
    expect(segs).toHaveLength(0);
  });
});
