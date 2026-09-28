/**
 * DPR-aware 2D canvas chart base: axes, grid, mono ticks (§3.6).
 * Built in TODO.md Phase 10.
 */
import { notImplemented } from '@/util/stub';

export interface Chart {
  readonly canvas: HTMLCanvasElement;
  draw(): void;
}

export function createChartBase(_width: number, _height: number): Chart {
  return notImplemented('createChartBase');
}
