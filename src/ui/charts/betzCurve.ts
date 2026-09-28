/**
 * Betz curve (TECH_SPEC §3.6 tab 4, §10), only in Ideal-disk mode: Cp(b) = ½(1 + b)(1 − b²)
 * for the wake speed ratio b ∈ [0, 1], the peak marker at (1/3, 16/27) and the live dot at the
 * slider's b. Entering the sweet spot rings the peak marker once.
 */
import { BETZ } from '@/config/turbine';
import { BETZ_SWEET_SPOT, cpIdeal } from '@/physics/actuatorDisk';
import { fixed, fmtPct } from '@/physics/format';
import { linspace, type Axes } from '@/ui/charts/chartBase';
import { CHART_COLORS as C, type ChartView } from '@/ui/charts/types';

const RING_S = 0.9;

const AXES: Axes = {
  x: { min: 0, max: 1 },
  y: { min: 0, max: 0.65 },
  xTicks: [0, 0.2, 0.4, 0.6, 0.8, 1],
  yTicks: [0, 0.2, 0.4, 0.6],
  xFormat: (v) => fixed(v, 1),
  yFormat: (v) => fixed(v, 1),
  xTitle: 'wake speed b = V_wake / V',
  yTitle: 'Cp',
};

export function createBetzCurve(): ChartView {
  const bs = linspace(0, 1, 101);
  const cps = Array.from(bs, cpIdeal);
  let inSpot = false;
  let ringAt = -Infinity;
  return {
    describe({ ui }) {
      return `Betz curve: Cp ${fmtPct(cpIdeal(ui.wakeB), 1)} at b = ${fixed(ui.wakeB, 2)}; peak ${fmtPct(BETZ, 1)} at b = 1/3`;
    },
    draw(c, { ui, nowS }) {
      const b = ui.wakeB;
      const spot = Math.abs(b - 1 / 3) < BETZ_SWEET_SPOT;
      if (spot && !inSpot) ringAt = nowS;
      inSpot = spot;
      c.begin(AXES);
      c.clipped(() => {
        c.polyline(bs, cps, { color: C.ideal, width: 1.8 });
        c.polyline([1 / 3, 1 / 3], [0, BETZ], {
          color: C.ideal,
          width: 1,
          dash: [2, 3],
          alpha: 0.6,
        });
        c.ring(1 / 3, BETZ, 5, spot ? C.ok : C.ideal, 0.9);
        const k = (nowS - ringAt) / RING_S;
        if (k >= 0 && k < 1) c.ring(1 / 3, BETZ, 5 + 18 * k, C.ok, 1 - k, 2);
        c.ring(b, cpIdeal(b), 6, C.text, 0.3);
        c.dot(b, cpIdeal(b), spot ? C.ok : C.text, 3.5);
      });
      c.label(`16/27 = ${fmtPct(BETZ, 1)}`, 1 / 3 + 0.03, BETZ, spot ? C.ok : C.ideal);
    },
  };
}
