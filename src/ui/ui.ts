/**
 * UI assembly (TECH_SPEC §3, §14.3): layout, title block, stat cards, explanation panel,
 * control panel, help, loader and hotkeys. The UI reads the SimSnapshot each frame and writes
 * only to the store; it never touches three.js.
 */
import { BETZ } from '@/config/turbine';
import { fmtPct } from '@/physics/format';
import type { SimSnapshot } from '@/physics/types';
import type { Store } from '@/state/store';
import type { UiState } from '@/state/uiState';
import { createControlPanel } from '@/ui/controlPanel';
import { createExplainer } from '@/ui/explainer';
import { createHelp } from '@/ui/help';
import { installHotkeys } from '@/ui/hotkeys';
import { createLayout } from '@/ui/layout';
import { createLoader } from '@/ui/loader';
import { createStatCards } from '@/ui/statCards';
import { BETZ_SWEET_SPOT } from '@/ui/templates';
import { toast } from '@/ui/toast';

export interface UiActions {
  resetTrip(): void;
  toggleTour(): void;
  /** the angle the sim holds the pitch at, or null on auto */
  lockedPitchDeg(): number | null;
}

export interface Ui {
  /** per frame; text is throttled internally (§14.4) */
  update(s: SimSnapshot, dt: number): void;
  /** call after the first rendered frame (fades the loader) */
  firstFrame(): void;
}

export function createUi(root: HTMLElement, store: Store<UiState>, actions: UiActions): Ui {
  const loader = createLoader();
  document.body.append(loader.el);

  const layout = createLayout(root);
  const toggleHelp = (): void => store.set({ help: !store.get().help });
  const help = createHelp(() => store.set({ help: false }));
  root.append(help.el);
  store.subscribe(
    (s) => s.help,
    (open) => help.toggle(open),
  );

  const stats = createStatCards();
  const explainer = createExplainer();
  layout.left.append(stats.el, explainer.el);
  const panel = createControlPanel(store, { ...actions, toggleHelp });
  layout.panel.append(panel.el);
  installHotkeys(store, { ...actions, toggleHelp });

  // toasts on notable transitions
  let lastState = '';
  let tripPeakOmegaRad = 0;
  let sweetSpotShown = false;
  store.subscribe(
    (s) => s.rotorMode,
    () => {
      sweetSpotShown = false;
    },
  );

  return {
    update(s, dt) {
      const ui = store.get();
      const pitchLockDeg = actions.lockedPitchDeg();
      const tripped = s.state === 'TRIP' || s.state === 'TRIPPED';
      tripPeakOmegaRad = tripped ? Math.max(tripPeakOmegaRad, s.omega) : 0;
      stats.update({ s, rotorMode: ui.rotorMode, wakeB: ui.wakeB, gusts: ui.gusts }, dt);
      explainer.update({ s, wakeB: ui.wakeB, pitchLockDeg, tripPeakOmegaRad }, dt);
      panel.update(s);

      if (s.state !== lastState) {
        if (s.state === 'TRIP') toast('TRIP: overspeed', 'alarm');
        lastState = s.state;
      }
      if (
        ui.rotorMode === 'ideal' &&
        !sweetSpotShown &&
        Math.abs(ui.wakeB - 1 / 3) < BETZ_SWEET_SPOT
      ) {
        sweetSpotShown = true;
        toast(`You found the limit: ${fmtPct(BETZ, 1)}`, 'ok');
      }
    },
    firstFrame() {
      loader.done();
    },
  };
}
