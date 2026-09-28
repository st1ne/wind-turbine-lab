import { describe, expect, it } from 'vitest';
import { defaultUiState, type UiState } from '@/state/uiState';
import { readUrlState, urlToUiPatch, writeUrlState } from '@/state/urlState';

describe('URL state (§17)', () => {
  it('a default state writes a clean URL', () => {
    expect(writeUrlState(defaultUiState())).toBe('');
  });

  it('round-trips view, wind, mode, camera chip and the rest', () => {
    const ui: UiState = {
      ...defaultUiState(),
      windTarget: 30,
      view: 'cutaway',
      follow: 'power',
      rotorMode: 'ideal',
      wakeB: 1 / 3,
      pitchLock: true,
      timeScale: 4,
      gusts: true,
      camChip: 'nacelle',
      sound: true,
      volume: 0.35,
    };
    const search = writeUrlState(ui);
    expect(search).toContain('v=30');
    expect(search).toContain('cam=nacelle');
    const back = { ...defaultUiState(), ...urlToUiPatch(readUrlState(search)) };
    expect(back.windTarget).toBe(30);
    expect(back.weatherPreset).toBe('storm');
    expect(back.view).toBe('cutaway');
    expect(back.follow).toBe('power');
    expect(back.rotorMode).toBe('ideal');
    expect(back.wakeB).toBeCloseTo(1 / 3, 3);
    expect(back.pitchLock).toBe(true);
    expect(back.timeScale).toBe(4);
    expect(back.gusts).toBe(true);
    expect(back.camChip).toBe('nacelle');
    expect(back.sound).toBe(true);
    expect(back.volume).toBe(0.35);
  });

  it('ignores junk and clamps numbers', () => {
    expect(readUrlState('?view=sideways&follow=&mode=x&t=3&cam=moon&lock=maybe')).toEqual({});
    expect(readUrlState('?v=99&b=-2&vol=3')).toEqual({ windTarget: 35, wakeB: 0, volume: 1 });
    expect(readUrlState('?v=abc')).toEqual({});
    expect(readUrlState('?v=12.34')).toEqual({ windTarget: 12.3 });
  });
});
