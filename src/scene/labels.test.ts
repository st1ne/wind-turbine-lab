import { describe, expect, it } from 'vitest';
import { MAX_LABELS, offscreen, overlaps, placeLabels } from '@/scene/labels';

const r = (x: number, y: number, w = 100, h = 20) => ({ x, y, w, h });

describe('label placement (§3.7)', () => {
  it('overlap test', () => {
    expect(overlaps(r(0, 0), r(50, 10))).toBe(true);
    expect(overlaps(r(0, 0), r(100, 0))).toBe(false);
    expect(overlaps(r(0, 0), r(0, 20))).toBe(false);
  });

  it('keeps separate labels where they are', () => {
    expect(placeLabels([r(0, 0), r(300, 0), r(0, 200)]).map((p) => p?.dy)).toEqual([0, 0, 0]);
  });

  it('drops a label when every slot is taken', () => {
    const crowd = Array.from({ length: 7 }, () => r(200, 100));
    expect(placeLabels(crowd).filter((p) => p === null)).toHaveLength(1);
  });

  it('nudges a clashing label up, then down, then drops it', () => {
    const p = placeLabels([r(200, 100), r(210, 100), r(220, 100), r(200, 100)]);
    expect(p[0]).toEqual({ dy: 0, flip: false });
    expect(p[1]).toEqual({ dy: -24, flip: false });
    expect(p[2]).toEqual({ dy: 24, flip: false });
    // right side full: flips left of its anchor
    expect(p[3]).toEqual({ dy: 0, flip: true });
  });

  it('shows at most 9, in priority (input) order', () => {
    const many = Array.from({ length: 14 }, (_, i) => r(i * 200, 0));
    const p = placeLabels(many);
    expect(p.filter((d) => d !== null)).toHaveLength(MAX_LABELS);
    expect(p.slice(0, MAX_LABELS).every((d) => d?.dy === 0)).toBe(true);
  });

  it('slides off UI panels, or drops when it cannot', () => {
    const panel = { x: 0, y: 90, w: 400, h: 30 };
    expect(placeLabels([r(10, 100)], 9, 4, [panel])).toEqual([{ dy: 24, flip: false }]);
    // a panel to the right: the label flips left of its dot
    expect(placeLabels([r(500, 100)], 9, 4, [{ x: 520, y: 0, w: 400, h: 400 }])).toEqual([
      { dy: 0, flip: true },
    ]);
    expect(placeLabels([r(10, 100)], 9, 4, [{ x: -500, y: 0, w: 2000, h: 400 }])).toEqual([null]);
  });
});

describe('viewport edges', () => {
  it('a label near the right edge flips left instead of running off screen', () => {
    expect(placeLabels([{ x: 950, y: 100, w: 100, h: 20 }], 9, 4, offscreen(1000, 800))).toEqual([
      { dy: 0, flip: true },
    ]);
  });
});
