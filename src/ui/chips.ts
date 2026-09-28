/**
 * Camera chips (TECH_SPEC §3.8), bottom centre. Each flies the camera (1.2 s easeInOutCubic)
 * to a preset and switches Follow / View / Chart:
 *   Rotor · Betz & pitch     front 3/4 view, Follow = Wind
 *   Nacelle · drivetrain     side close-up, View = Cutaway, Follow = Power
 *   Tower · loads            low wide shot, Follow = Loads
 *   Blade · along the span   from the hub, Chart = Along the blade
 * The chip of the last fly-to stays highlighted until the user orbits (store.camChip).
 */
import type { CameraPreset } from '@/scene/cameraRig';
import type { Store } from '@/state/store';
import type { CameraChip, UiState } from '@/state/uiState';
import { h } from '@/ui/dom';

export interface ChipDef {
  readonly id: Exclude<CameraChip, null>;
  readonly title: string;
  readonly sub: string;
  readonly preset: CameraPreset;
  readonly state: Partial<UiState>;
}

export const CHIPS: readonly ChipDef[] = [
  { id: 'rotor', title: 'Rotor', sub: 'Betz & pitch', preset: 'rotor', state: { follow: 'wind' } },
  {
    id: 'nacelle',
    title: 'Nacelle',
    sub: 'drivetrain',
    preset: 'nacelle',
    state: { view: 'cutaway', follow: 'power' },
  },
  { id: 'tower', title: 'Tower', sub: 'loads', preset: 'tower', state: { follow: 'loads' } },
  {
    id: 'blade',
    title: 'Blade',
    sub: 'along the span',
    preset: 'blade',
    state: { chart: 'alongBlade' },
  },
];

/** State a chip applies; the Betz tab stays forced in Ideal-disk mode. */
export function chipState(chip: ChipDef, ui: Readonly<UiState>): Partial<UiState> {
  const s: Partial<UiState> = { ...chip.state, camChip: chip.id };
  if (ui.rotorMode === 'ideal') delete s.chart;
  return s;
}

export function createChips(
  store: Store<UiState>,
  flyTo: (preset: CameraPreset) => void,
): HTMLElement {
  const el = h('div', { class: 'chips', role: 'group', 'aria-label': 'Camera views' });
  const buttons = CHIPS.map((chip) => {
    const b = h(
      'button',
      { type: 'button', class: 'chip glass', 'aria-pressed': 'false' },
      h('b', {}, chip.title),
      h('span', {}, ` · ${chip.sub}`),
    );
    b.addEventListener('click', () => {
      flyTo(chip.preset);
      store.set(chipState(chip, store.get()));
    });
    el.append(b);
    return b;
  });
  const sync = (id: CameraChip): void => {
    CHIPS.forEach((c, i) => {
      const on = c.id === id;
      buttons[i]?.setAttribute('aria-pressed', String(on));
      buttons[i]?.classList.toggle('on', on);
    });
  };
  sync(store.get().camChip);
  store.subscribe((s) => s.camChip, sync);
  return el;
}
