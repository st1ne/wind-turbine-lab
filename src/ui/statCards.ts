/**
 * Three stat cards (TECH_SPEC §3.3): WIND, POWER, CAPTURED. Mono tabular values tween over
 * 250 ms toward targets sampled at 10 Hz (§14.4); text nodes are written only when the string changes.
 */
import { BETZ } from '@/config/turbine';
import { cpIdeal } from '@/physics/actuatorDisk';
import { fixed, fmtDeg, fmtMs, fmtMW, fmtPct, fmtRpm } from '@/physics/format';
import type { SimSnapshot } from '@/physics/types';
import { beaufort } from '@/physics/wind';
import type { RotorMode } from '@/state/uiState';
import { h, setText } from '@/ui/dom';
import { createThrottle, RATE_HZ } from '@/util/throttle';
import { createTweenedNumber } from '@/util/tween';

export interface StatContext {
  s: SimSnapshot;
  rotorMode: RotorMode;
  wakeB: number;
  gusts: boolean;
}

export interface StatCards {
  el: HTMLElement;
  update(ctx: StatContext, dt: number): void;
}

function card(
  kind: string,
  label: string,
): {
  el: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
  sub: HTMLElement;
  badge: HTMLElement;
} {
  const labelEl = h('span', { class: 'stat-label' }, label);
  const badge = h('span', { class: 'stat-badge mono', hidden: true }, '±gust');
  if (kind !== 'wind') badge.remove();
  const value = h('span', { class: 'stat-value mono' });
  const sub = h('span', { class: 'stat-sub' });
  const el = h(
    'div',
    { class: `stat glass stat-${kind}`, role: 'group' },
    h('span', { class: 'stat-head' }, labelEl, badge),
    value,
    sub,
  );
  return { el, label: labelEl, value, sub, badge };
}

export function createStatCards(): StatCards {
  const wind = card('wind', 'WIND');
  const power = card('power', 'POWER');
  const captured = card('ideal', 'CAPTURED');
  const el = h('div', { class: 'stats' }, wind.el, power.el, captured.el);
  wind.el.setAttribute('aria-label', 'Wind');
  power.el.setAttribute('aria-label', 'Electrical power');
  captured.el.setAttribute('aria-label', 'Share of the wind power captured');

  const vT = createTweenedNumber(0);
  const pT = createTweenedNumber(0);
  const cT = createTweenedNumber(0);
  const sample = createThrottle(RATE_HZ.text);
  let first = true;
  let ideal = false;

  return {
    el,
    update(ctx, dt) {
      const { s } = ctx;
      if (sample.ready(dt)) {
        ideal = ctx.rotorMode === 'ideal';
        // negative Cp (rotor driven by its inertia while feathering) captures nothing
        const capturedFraction = ideal ? cpIdeal(ctx.wakeB) : Math.max(s.cp, 0);
        if (first) {
          vT.snap(s.Vmean);
          pT.snap(s.Pel);
          cT.snap(capturedFraction);
          first = false;
        }
        vT.target(s.Vmean);
        pT.target(s.Pel);
        cT.target(capturedFraction);

        const bf = beaufort(s.Vmean);
        setText(wind.sub, `Beaufort ${bf.force} · ${bf.name}`);
        wind.badge.hidden = !ctx.gusts;

        let sub: string;
        const alarm = s.state === 'TRIP' || s.state === 'TRIPPED';
        if (alarm) sub = 'TRIP · brake on';
        else if (s.state === 'PARKED') sub = `parked · pitch ${fmtDeg(s.beta, 0)}`;
        else if (s.state === 'SHUTDOWN') sub = `feathering · pitch ${fmtDeg(s.beta)}`;
        else sub = `${fmtRpm(s.omega)} · pitch ${fmtDeg(s.beta)}`;
        setText(power.sub, sub);
        power.el.classList.toggle('alarm', alarm);

        setText(captured.label, ideal ? 'Cp(b)' : 'CAPTURED');
        setText(
          captured.sub,
          ideal ? `wake at b = ${fixed(ctx.wakeB, 2)} V` : `Betz max ${fmtPct(BETZ, 1)}`,
        );
      }
      vT.update(dt);
      pT.update(dt);
      cT.update(dt);
      setText(wind.value, fmtMs(vT.value));
      setText(power.value, fmtMW(pT.value));
      setText(captured.value, fmtPct(cT.value, ideal ? 1 : 0));
    },
  };
}
