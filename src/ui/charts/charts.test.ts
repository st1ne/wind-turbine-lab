import { describe, expect, it } from 'vitest';
import { STATIONS } from '@/physics/blade';
import { cpAt } from '@/physics/tables';
import { FIRST_AIRFOIL } from '@/ui/charts/alongBlade';
import { cpCurve, LAMBDAS } from '@/ui/charts/cpTsr';

describe('chart data', () => {
  it('Cp–λ curves are the BEM tables', () => {
    const c = cpCurve(5);
    expect(c).toHaveLength(LAMBDAS.length);
    LAMBDAS.forEach((l, i) => expect(c[i]).toBe(cpAt(l, 5)));
  });
  it('the along-the-blade chart starts at the first airfoil station', () => {
    expect(STATIONS.slice(0, FIRST_AIRFOIL).every((s) => s.family.startsWith('CYL'))).toBe(true);
    expect((STATIONS[FIRST_AIRFOIL] as { family: string }).family.startsWith('CYL')).toBe(false);
  });
});
