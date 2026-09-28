import { describe, expect, it } from 'vitest';
import { createSim } from '@/physics/sim';
import type { Regime, SimSnapshot } from '@/physics/types';
import { renderTemplate } from '@/ui/templates';

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
    expect(html).toContain('<b>725 kN</b>');
  });

  it('adds the pitch-lock sentence and the Betz sweet spot', () => {
    expect(renderTemplate({ s: base, wakeB: 1, pitchLockDeg: 0 })).toContain('Pitch is locked at');
    const betz = { ...base, regime: 'BETZ' as const };
    expect(renderTemplate({ s: betz, wakeB: 0.34, pitchLockDeg: null })).toContain('Betz limit');
    expect(renderTemplate({ s: betz, wakeB: 0.6, pitchLockDeg: null })).not.toContain('c-ok');
  });
});
