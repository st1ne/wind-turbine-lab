/** Shared input for the chart views (TECH_SPEC §3.6). */
import type { SimSnapshot } from '@/physics/types';
import type { UiState } from '@/state/uiState';
import type { ChartCanvas } from '@/ui/charts/chartBase';

export interface ChartInput {
  readonly s: SimSnapshot;
  readonly ui: Readonly<UiState>;
  /** real time, s (trails and pulses fade in real time, even when paused) */
  readonly nowS: number;
}

export interface ChartView {
  /** short text for the canvas's aria-label */
  describe(input: ChartInput): string;
  draw(c: ChartCanvas, input: ChartInput): void;
}

/** chart palette, mirroring the CSS tokens */
export const CHART_COLORS = {
  wind: '#4cc9ff',
  power: '#ffb547',
  ideal: '#a78bfa',
  loads: '#ff7a59',
  ok: '#5be49b',
  steady: '#8b93a7',
  text: '#e8ecf5',
  muted: '#8b93a7',
} as const;
