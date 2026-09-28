/**
 * Range slider with ticks and aria-valuetext (§3.4).
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';

export interface SliderOptions {
  min: number;
  max: number;
  step: number;
  valueText: (v: number) => string;
  onInput: (v: number) => void;
}

export function createSlider(_opts: SliderOptions): { el: HTMLElement; set(_v: number): void } {
  return notImplemented('createSlider');
}
