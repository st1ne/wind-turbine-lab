# Wind Turbine Lab: The 59 % Limit

An interactive 3D explainer built with three.js. Turn up the wind on a desktop wind-tunnel
diorama and watch a 5 MW turbine chase the wind, cap its power and feather its blades to hide
from a storm. Every number on screen comes from a real physics model.

- Spec: [`TECH_SPEC.md`](TECH_SPEC.md)
- Build plan: [`TODO.md`](TODO.md)

## Run

```bash
npm install
npm run dev        # dev server
npm test           # Vitest physics suites
npm run lint
npm run build      # type-check + production build
npm run tables     # regenerate src/physics/tables.generated.json (Phase 1)
```

## Where the physics comes from

`reference/wind_model_reference.py` is the source of truth. It models the NREL 5 MW reference
rotor (Jonkman et al. 2009, NREL/TP-500-38060) with simplified airfoil polars (linear lift plus
Viterna–Corrigan post-stall), steady BEM with Prandtl tip/hub loss and Buhl's high-induction
correction, the NREL baseline torque law, a gain-scheduled PI pitch controller and a supervisory
state machine. The TypeScript port in `src/physics` is pure (no three.js), deterministic and
unit-tested against the numbers quoted in TECH_SPEC §7. `reference/tables.json` is the Python
output used to diff the TypeScript Cp/Ct tables.

## Layout

```
src/
  config/   constants (turbine, controller, environment, theme)
  physics/  pure SI physics: polars, BEM, tables, actuator disk, control, sim
  state/    observable store, UI state, URL state
  scene/    three.js: renderer, post, camera, environment, turbine, fx
  ui/       vanilla DOM UI and 2D charts
  tour/     guided tour
  audio/    WebAudio synthesis
  util/     math, easing, tweens, frame loop
```

### Validation

- `npm run tables` regenerates the Cp/Ct grid, optimum and steady schedule, then diffs the grid
  against `reference/tables.json` (currently a bit-exact match).
- `npm test` checks every number in TECH_SPEC §7: BEM vectors, the steady schedule, spanwise
  angle of attack, the storm-ramp and pitch-lock trip scenarios, Betz, loads, plus a 10,000-step
  NaN fuzz.

### Deliberate differences from the reference sim

- Cut-out needs V̄ ≥ 25 m/s held for 3 s, restart V̄ < 20 m/s held for 10 s (the reference
  switches instantly; real turbines use a 10-minute mean).
- The mean wind is ramp-limited to 2 m/s per sim second.
- STARTUP connects at 90 % of the *scheduled* speed for the current wind (the reference uses 90 %
  of rated, which equals it above ≈ 10.4 m/s) so the rotor can reconnect in a light breeze.
- Below 3 m/s (CALM) the generator torque is zero.

## Status

Phases 0–5 done (scaffold, physics core, scene shell, turbine exterior, nacelle internals, UI
shell). Modules not built yet throw `not implemented`.

Dev helpers (dev server only): backtick toggles the stats/snapshot overlay; `window.__lab`
exposes sim, store, scene and camera. All hotkeys from TECH_SPEC §3.9 are live; press H for the
list.

UI notes: the TRIP text quotes the peak rotor speed seen since the trip began; the pitch-lock
sentence only shows in RUN (every other state drives the pitch itself); CAPTURED clamps a
negative Cp (rotor coasting while feathering) to 0 %. The guided-tour button shows a
"coming soon" toast until Phase 13.

Scene deviation: the orbit minimum distance is 0.3 instead of 0.6 (§4.5) so the nacelle
close-up can actually get close.
