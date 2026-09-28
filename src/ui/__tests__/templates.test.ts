import { describe, expect, it } from 'vitest';
import { createSim } from '@/physics/sim';
import type { Regime, SimSnapshot } from '@/physics/types';
import { cpIdeal } from '@/physics/actuatorDisk';
import { fmtPct } from '@/physics/format';
import { regimeTitle, renderTemplate } from '@/ui/templates';

function steady(V: number, idealDisk = false): SimSnapshot {
  const sim = createSim();
  sim.initSteady(V);
  sim.step(0.05, { windTarget: V, gusts: false, pitchLockDeg: null, idealDisk });
  return sim.snapshot();
}

const REGIMES: Regime[] = [
  'CALM',
  'CHASE',
  'CAP',
  'SPILL',
  'SHUTDOWN',
  'PARKED',
  'STARTUP',
  'TRIP',
  'BETZ',
];

describe('explanation templates (§3.5)', () => {
  const base = steady(8);
  it.each(REGIMES)('%s renders without NaN or placeholders', (regime) => {
    for (const V of [0, 2, 8, 11.4, 20, 30, 35]) {
      const s: SimSnapshot = { ...steady(V), regime };
      const html = renderTemplate({ s, wakeB: 1 / 3, pitchLockDeg: null });
      expect(html.length).toBeGreaterThan(40);
      expect(html).not.toMatch(/NaN|undefined|Infinity|—|\{/);
    }
  });

  it('picks the regime from the live snapshot', () => {
    expect(base.regime).toBe('CHASE');
    expect(steady(2).regime).toBe('CALM');
    expect(steady(20).regime).toBe('SPILL');
    expect(steady(30).regime).toBe('PARKED');
    expect(steady(8, true).regime).toBe('BETZ');
  });

  it('quotes the live numbers', () => {
    const html = renderTemplate({ s: steady(20), wakeB: 1, pitchLockDeg: null });
    expect(html).toContain('<b>17.5°</b>');
    expect(html).toContain('<b>725\u00a0kN</b>');
  });

  it('adds the pitch-lock sentence and the Betz sweet spot', () => {
    expect(renderTemplate({ s: base, wakeB: 1, pitchLockDeg: 0 })).toContain('Pitch is locked at');
    const betz = { ...base, regime: 'BETZ' as const };
    expect(renderTemplate({ s: betz, wakeB: 0.34, pitchLockDeg: null })).toContain('Betz limit');
    expect(renderTemplate({ s: betz, wakeB: 0.6, pitchLockDeg: null })).not.toContain('c-ok');
  });
});

describe('Betz mode text (§10)', () => {
  const betz = { ...steady(8), regime: 'BETZ' as const };
  it('quotes Cp(b) exactly as card 3 formats it, at every b', () => {
    for (let b = 0; b <= 1.0001; b += 0.005) {
      const html = renderTemplate({ s: betz, wakeB: b, pitchLockDeg: null });
      expect(html).toContain(`<b>${fmtPct(cpIdeal(b), 1)}</b>`);
    }
  });
  it('flags the turbulent wake state only below b = 0.10', () => {
    expect(renderTemplate({ s: betz, wakeB: 0.05, pitchLockDeg: null })).toContain(
      'turbulent wake state',
    );
    expect(renderTemplate({ s: betz, wakeB: 0.2, pitchLockDeg: null })).not.toContain('turbulent');
    expect(renderTemplate({ s: betz, wakeB: 1 / 3, pitchLockDeg: null })).not.toContain(
      'turbulent',
    );
  });
});

describe('copy at the edges (Phase 15)', () => {
  const text = (s: ReturnType<typeof steady>, wakeB = 1) =>
    renderTemplate({ s, wakeB, pitchLockDeg: null })
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ');
  it('0 m/s says there is no wind instead of quoting 0 kW', () => {
    expect(text(steady(0))).toMatch(/^No wind/);
  });
  it('just above rated, before the blades pitch, it reads as full power', () => {
    const s = steady(11);
    expect(s.regime).toBe('SPILL');
    expect(text(s)).toMatch(/^Full power/);
    expect(text(s)).not.toContain('0.0°');
    expect(regimeTitle({ s, wakeB: 1, pitchLockDeg: null })).toBe('Full power');
    expect(text(steady(15))).toMatch(/^Too much wind/);
  });
  it('a restart after a reset in strong wind does not claim the wind dropped', () => {
    const s = { ...steady(22), state: 'STARTUP' as const, regime: 'STARTUP' as const };
    expect(text(s)).toMatch(/^Restarting after the reset/);
    const calm = { ...steady(15), state: 'STARTUP' as const, regime: 'STARTUP' as const };
    expect(text(calm)).toMatch(/^Wind back under 20 m\/s/);
  });
  it('a tripped rotor points at the Reset button', () => {
    const s = { ...steady(22), state: 'TRIPPED' as const, regime: 'TRIP' as const };
    expect(text(s)).toContain('press Reset (X)');
    expect(regimeTitle({ s, wakeB: 1, pitchLockDeg: null })).toBe('Tripped');
  });
  it('b = 1 explains why the disk takes nothing', () => {
    const s = { ...steady(8), regime: 'BETZ' as const };
    expect(text(s, 1)).toContain("doesn't slow the air at all");
  });
});
