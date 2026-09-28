/**
 * Help overlay (TECH_SPEC §3.9, §6.8, §6.9, §21): hotkeys, model assumptions and references.
 * A modal dialog; Esc, the close button or a click on the backdrop closes it.
 */
import {
  CUT_OUT_HOLD_S,
  HOME_POWER_W,
  MODEL_SCALE,
  RESTART_HOLD_S,
  V_CUT_OUT,
  V_RESTART,
} from '@/config/turbine';
import { WIND_RAMP_M_S2 } from '@/config/controller';
import { fixed, fmtMs } from '@/physics/format';
import { h } from '@/ui/dom';

export const HOTKEYS: readonly (readonly [string, string])[] = [
  ['1 2 3 4', 'Follow: All / Wind / Power / Loads'],
  ['Q W E R', 'Weather: Breeze / Rated / Gale / Storm'],
  ['← →', 'Wind −/+ 0.5 m/s (Shift: ±2)'],
  ['B', 'Toggle the ideal disk'],
  ['L', 'Toggle pitch lock'],
  ['V', 'Cycle view: Whole / Cutaway / Exploded'],
  ['C', 'Cycle chart'],
  ['G', 'Gusts on/off'],
  ['T', 'Time scale ×1 → ×4 → ×10'],
  ['Space', 'Pause / resume the simulation'],
  ['Enter', 'Start / stop the guided tour'],
  ['X', 'Reset after a trip'],
  ['M', 'Sound on/off'],
  ['H or ?', 'This help'],
];

const REFERENCES: readonly (readonly [string, string])[] = [
  [
    'Jonkman et al., Definition of a 5-MW Reference Wind Turbine for Offshore System Development, NREL/TP-500-38060, 2009',
    'https://www.nrel.gov/docs/fy09osti/38060.pdf',
  ],
  [
    'Buhl, A New Empirical Relationship between Thrust Coefficient and Induction Factor for the Turbulent Windmill State, NREL/TP-500-36834, 2005',
    'https://www.nrel.gov/docs/fy05osti/36834.pdf',
  ],
  ['Betz, Das Maximum der theoretisch möglichen Ausnützung des Windes durch Windmotoren, 1920', ''],
  ['Viterna & Corrigan, Fixed Pitch Rotor Performance of Large HAWTs, NASA, 1982', ''],
  ['Burton, Jenkins, Sharpe & Bossanyi, Wind Energy Handbook, Wiley', ''],
];

function assumptions(): string[] {
  return [
    `The model is 1:${fixed(1 / MODEL_SCALE, 0)} scale: the ruler on the bench reads full-scale metres.`,
    'The rotor is the NREL 5 MW reference turbine, solved with steady blade-element momentum theory (Prandtl tip/hub loss, Buhl high-induction correction) and a one-degree-of-freedom drivetrain.',
    'Airfoil polars are simplified (linear lift plus Viterna post-stall), tuned to match the published rotor within about 2 %.',
    `Real turbines cut out on a 10-minute mean wind. Here cut-out needs ${fmtMs(V_CUT_OUT, 0)} held for ${CUT_OUT_HOLD_S} s, and restart needs under ${fmtMs(V_RESTART, 0)} held for ${RESTART_HOLD_S} s.`,
    `Weather presets ramp the mean wind at up to ${fixed(WIND_RAMP_M_S2, 0)} m/s per second so storms build visibly.`,
    `Homes powered = power ÷ ${fixed(HOME_POWER_W / 1000, 1)} kW, the average EU household use (about 3.5 MWh a year).`,
  ];
}

export interface Help {
  el: HTMLElement;
  toggle(open?: boolean): void;
  readonly open: boolean;
}

export function createHelp(onClose: () => void): Help {
  const close = h(
    'button',
    { type: 'button', class: 'icon-btn help-close', 'aria-label': 'Close help' },
    '×',
  );
  const keys = h('dl', { class: 'help-keys' });
  for (const [k, what] of HOTKEYS) {
    keys.append(h('dt', {}, h('kbd', { class: 'mono' }, k)), h('dd', {}, what));
  }
  const notes = h('ul', { class: 'help-notes' }, ...assumptions().map((t) => h('li', {}, t)));
  const refs = h(
    'ol',
    { class: 'help-refs' },
    ...REFERENCES.map(([title, url]) =>
      h('li', {}, url ? h('a', { href: url, target: '_blank', rel: 'noopener' }, title) : title),
    ),
  );
  const dialog = h(
    'div',
    { class: 'help glass', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title' },
    h('header', { class: 'help-head' }, h('h2', { id: 'help-title' }, 'How this lab works'), close),
    h(
      'div',
      { class: 'help-body' },
      h('section', {}, h('h3', { class: 'overline' }, 'Keys'), keys),
      h(
        'section',
        {},
        h('h3', { class: 'overline' }, 'Assumptions'),
        notes,
        h('h3', { class: 'overline' }, 'References'),
        refs,
      ),
    ),
  );
  const el = h('div', { class: 'help-backdrop', hidden: true }, dialog);

  let isOpen = false;
  let returnFocus: Element | null = null;
  close.addEventListener('click', onClose);
  el.addEventListener('click', (e) => {
    if (e.target === el) onClose();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  });

  return {
    el,
    get open() {
      return isOpen;
    },
    toggle(open = !isOpen) {
      if (open === isOpen) return;
      isOpen = open;
      if (open) {
        returnFocus = document.activeElement;
        el.hidden = false;
        requestAnimationFrame(() => el.classList.add('in'));
        close.focus();
      } else {
        el.classList.remove('in');
        el.hidden = true;
        if (returnFocus instanceof HTMLElement) returnFocus.focus();
      }
    },
  };
}
