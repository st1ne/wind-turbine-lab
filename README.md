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
- Pitch feed-forward: in RUN the pitch command is the scheduled pitch for the measured wind
  (low-passed, τ = 1 s) plus the NREL PI, whose integral may go negative just far enough to
  cancel the feed-forward. Without it the reference PI cannot follow the 2 m/s² preset ramp or
  TI 0.12 gusts above ≈ 18 m/s: Storm from Rated tripped on overspeed at 18.9 m/s. Tests that
  compare against the reference use `REFERENCE_SIM` (no holds, no ramp, no feed-forward).

## Status

All 17 phases done (scaffold, physics core, scene shell, turbine exterior, nacelle internals, UI
shell, wiring and time, Whole / Cutaway / Exploded views, Follow modes and FX, Betz disk mode,
charts, weather and storm, 3D labels, tour, camera chips, URL state and sharing, sound, polish,
performance / mobile / accessibility, QA and launch prep). Not done: the deploy itself and the
launch screen capture (see [Launch](#launch)).

Dev helpers (dev server only): backtick toggles the stats/snapshot overlay; `window.__lab`
exposes sim, bridge (`jumpTo(V)`), store, scene and camera. All hotkeys from TECH_SPEC §3.9 are live; press H for the
list.

UI notes: the TRIP text quotes the peak rotor speed seen since the trip began; the pitch-lock
sentence only shows in RUN (every other state drives the pitch itself); CAPTURED clamps a
negative Cp (rotor coasting while feathering) to 0 %.

Scene deviation: the orbit minimum distance is 0.3 instead of 0.6 (§4.5) so the nacelle
close-up can actually get close.

Views (§8): the nacelle shell, spinner and top 12 m of the tower are built as closed hollow
solids so the stencil caps show a thin wall, not a solid block; their walls (0.3 m, spinner
0.18 m) are thicker than real (≈ 30 mm) so the cut reads at 1:200. In Exploded the spinner fades
with the nacelle shell (0.15) so the pitch bearings stay visible; the spec only asks for the shell.

Follow modes and FX (§9): the smoke, stream-tube outline and tip vortices use the rotor's a(Ct)
(or (1 − b)/2 in Ideal-disk mode), clamped to 0.45 for the geometry. Streamlines outside the
tube move at V, which is what the stream-tube area formula implies. Smoke and pulses advance in
sim time, at full-scale speed, so at ×1 the air takes about 16 s to cross the rotor diameter
at 8 m/s. Power pulses are drawn through the shell and tower (x-ray) so the path stays readable
in Whole view. The tower stress ramp uses a thin-wall section modulus W ∝ r², normalised to
the base.

Loss waterfall (§3.6): the spec quotes approximate steps; the app computes them at λ_opt and
0° pitch in `physics/losses.ts`: Betz 16/27 → Glauert's optimum rotor with wake rotation →
BEM of the real blade without tip/hub loss and drag → with Prandtl loss → with drag (= Cp_max)
→ × η. Result: 59.3 → 58.1 → 55.2 → 51.4 → 47.1 → 44.4 % (spec: 55.3, 51.7, 44.5). The waterfall
shows in Ideal-disk mode and for 6 s after leaving it.

Storm (§11): everything follows s = smoothstep(18, 28, V̄) of the ramped mean wind. From Rated
the Storm preset needs ≈ 3.3 s before s leaves 0, reaches 0.5 at ≈ 5.8 s and lightning (s > 0.8)
at ≈ 7.3 s; it eases back the same way. The spec's "fog density + 0.4 s" is read as a relative
change: the fog density goes from 0.06 to 0.11 scene units⁻¹. Rain, tree flutter and lightning
run on sim time, so they freeze with the pause.

Labels (§3.7): besides other labels, UI panels count as obstacles, so a label never hides
under the control panel or the left column; when both nudges fail on the right of its anchor
the pill flips to the left before it is dropped.

Sound (§13): off by default and synthesised with WebAudio (no files). A volume slider sits next
to the speaker button; the gain follows volume² so the slider feels even, and a limiter guards
the output. `sound` and `vol` are part of the URL; a link with `sound=1` stays silent until the
first click or key press, because browsers only start audio after a user gesture.

Polish (Phase 15): bloom threshold 1.1 instead of 0.82 (the white spinner's highlight bloomed
into a halo; everything meant to glow has emissive intensity ≥ 3); numbers and units are joined
by no-break spaces; the camera dollies in from a wide shot after the loader unless a link picks
a camera chip.

Responsive and accessibility (Phase 16): phones (< 900 px) get a bottom sheet with the controls,
explanation, chart and waterfall; it peeks 100 px (the spec says 76) so the presets and a
wind slider with 28 px finger-size thumbs both fit, and shows at most 5 labels. 900–1279 px
collapse the chart to a button. Short desktop screens drop the intro paragraph. --text-dim is
#7a8196 (4.9 : 1 on the panels; the spec's #5d6479 is 3.2 : 1). The pixel ratio adapts to the
frame time (2 → 1.5 → 1.25 → 1, bloom at half resolution when stepped down).

## Every number on screen (TECH_SPEC §19.8)

All values come from the sim snapshot (`physics/sim.ts`, fields in `physics/types.ts`) or a pure
function in `src/physics`, and are formatted by `physics/format.ts`. Config constants live in
`src/config`.

| Where | Number | Source |
|---|---|---|
| Stat card Wind | V̄, Beaufort force and name | `snapshot.Vmean` (`physics/wind.ts` ramp), `beaufort()` (`physics/wind.ts`) |
| Stat card Power | P, rpm, pitch; `parked` / `TRIP` sub-lines | `snapshot.Pel` (`physics/drivetrain.ts`), `snapshot.omega`, `snapshot.beta`, `snapshot.state` (`physics/supervisor.ts`) |
| Stat card Captured | Cp (real rotor) or Cp(b) (Ideal disk), Betz max | `snapshot.cp` (`physics/tables.ts` lookup), `cpIdeal()` (`physics/actuatorDisk.ts`), `BETZ` (`config/turbine.ts`) |
| Explanation text | wind power, λ, tip speed, Cp, % of Betz, P, thrust, pitch, rpm, runaway rpm and tip Mach, flat-blade thrust | `windPowerW`, `tipSpeedMs`, `runawayRpm`, `runawayTipMach`, `lockedFlatThrustN` (`physics/loads.ts`); `snapshot.lambda/cp/Pel/T/beta/omega`; `cpIdeal` for Betz mode; limits from `config/turbine.ts` and `config/controller.ts` (`ui/templates.ts`) |
| Wind slider | V target, Beaufort | UI input; `beaufort()` |
| b slider | wake ratio b | UI input (the sim uses `a = (1 − b)/2`, `physics/actuatorDisk.ts`) |
| Chart: Power curve | curve, "in the wind" and Betz lines, live dot | `SCHEDULE` and `OPTIMUM` (`physics/tables.ts`), `windPowerW` × `BETZ`, `snapshot.V/Pel` |
| Chart: Cp–λ | curve at the current pitch, dot | `cpAt(λ, β)` (`physics/tables.ts`), `snapshot.lambda/cp/beta` |
| Chart: Along the blade | angle of attack per station | `spanwiseAlpha()` (`physics/bem.ts`), `STATIONS` (`physics/blade.ts`) |
| Chart: Betz curve | Cp(b), 16/27 | `cpIdeal()`, `BETZ` |
| Loss waterfall | 59.3 → … → 44.4 % | `lossWaterfall()` (`physics/losses.ts`) |
| Labels: Upstream / At the rotor / Wake / Anemometer | V, V(1 − a), far-wake speed | `snapshot.V`, flow `a` (`snapshot.a` or `inductionFromB`), `axialVelocity()` (`physics/actuatorDisk.ts`) |
| Label Blade tip | ωR in m/s and km/h | `tipSpeedMs()` |
| Label Pitch | β | `snapshot.beta` |
| Label Main shaft | rpm, low-speed-shaft torque | `snapshot.omega`, `lssTorqueNm(snapshot.Qgen)` (`physics/loads.ts`) |
| Label Gearbox / Converter | 97 : 1, 690 V | `GEAR_RATIO`, `CONVERTER_VOLTAGE_V` (`config/turbine.ts`) |
| Label Generator | generator rpm, P | `snapshot.omega × GEAR_RATIO`, `snapshot.Pel` |
| Label Brake | ON / released | `snapshot.brakeOn` (`physics/supervisor.ts`) |
| Label Thrust | T in kN and tonnes-force | `snapshot.T` (`physics/tables.ts` Ct), `G_M_S2` |
| Label Sway / Base moment | tower-top deflection, base moment | `towerTopDeflectionM()`, `baseMomentNm()` (`physics/loads.ts`) |
| Label Homes | homes powered | `homesPowered()` (`physics/loads.ts`) |
| Label Person | 1.8 m | scale reference constant |
| Wall screens | a, disk and wake speed ratios; Cp–λ with pitch | flow `a`; `cpAt`, `snapshot.beta` |
| Canvas `aria-label` | V, P, rpm, pitch, regime | snapshot fields, `regimeTitle()` |
| FX (no digits) | smoke speed and tube radius, pulse count and speed, tower stress, rotor blur, beacon, storm level | `tubeRadius`, `streamlineRadius` (`physics/actuatorDisk.ts`), `pulseCount/pulseSpeed(Pel)`, `baseMomentNm`, `snapshot.stormLevel/state` |
| Sound (no digits) | hum pitch 2·ω_g/2π, whoosh ∝ (ωR)², hum ∝ P | `humFrequencyHz`, `whooshLevel`, `humLevel` (`audio/audio.ts`) from snapshot fields |

## Acceptance (TECH_SPEC §19)

| # | Criterion | Result |
|---|---|---|
| 1 | §7 vectors, storm ramp to PARKED, pitch-lock trip | `npm test`: passes (171 tests) |
| 2 | Slider 0 → 35 → 0 is monotonic and glitch-free, no NaN; 10k fuzz | `src/acceptance.test.ts`: no power dip while the wind rises, no step > 0.25 MW within a supervisor state (RUN → SHUTDOWN disconnects the generator by design), 10,000 random states through the sim, templates and FX mappings stay finite; `physics/__tests__/controller.test.ts` fuzzes 10,000 `cpAt` / `ctAt` lookups and 10,000 sim steps |
| 3 | Storm from Rated: edge-on in ≈ 30 s, beacon, brake glow, SHUTDOWN then PARKED text | `src/acceptance.test.ts`: β > 89.9° before 35 s, PARKED, amber beacon, brake heat > 0, titles in order, no power pulses |
| 4 | Betz peak found by dragging, toast once per entry | checked in headless Chromium: the toast fires once per Ideal-disk entry however often b crosses 1/3 |
| 5 | Views switch without popping, solid caps | checked in headless Chromium (eased `cut` / `explode` channels, stencil caps) |
| 6 | 60 fps on the reference laptop (Whole, Follow All, Storm) | not measurable here: the container has no GPU (SwiftShader runs at ≈ 1.5 fps). The adaptive pixel ratio steps down on slow frames |
| 7 | Lighthouse desktop: Perf ≥ 85, A11y ≥ 95, BP ≥ 95 | on the production build under SwiftShader: Accessibility 100, Best Practices 96, SEO 100, Performance 35–43. Perf is dominated by software WebGL (≈ 7 s of shader compilation and the PMREM pass on the CPU); rerun on real hardware. The only BP failure is a TLS error on Google Fonts caused by the sandbox proxy |
| 8 | Every number traceable to physics | table above |
| 9 | Copy and comments in English, spell-checked | reviewed |

The slider sweep from a standing rotor is slow to produce power: at fine pitch a parked rotor
sits in deep stall (λ ≈ 0), so it takes ≈ 90 s at 8 m/s to spin up. From the 3 m/s idle, or
any preset, it reaches the operating point in 10–30 s.

## Launch

`npm run build` writes a static site to `dist/` (≈ 310 kB gzipped JS, fonts from Google Fonts).
Asset paths are relative (`base: './'`), so the same build works at a domain root or under a
subpath.

- GitHub Pages: `.github/workflows/pages.yml` tests, builds and publishes on every push to
  `main`. One-time setup: Settings → Pages → Build and deployment → Source: **GitHub Actions**.
  The site is served at https://st1ne.github.io/wind-turbine-lab/.
- Cloudflare Pages / Netlify / Vercel: build command `npm run build`, output directory `dist`.
- `og:image` in `index.html` is an absolute URL on GitHub Pages (link previews need one); change
  it if the site moves. Fill in `BRAND.name` / `BRAND.domain` in `src/config/brand.ts` when there
  is one (empty values are not rendered).
- `public/og-image.jpg` (1200 × 630, Storm shutdown in Cutaway) was captured from the app; the
  `noscript` fallback shows it too.
- The 20–30 s launch screen capture (Breeze → Betz peak → Storm feather → Cutaway power flow)
  needs a machine with a GPU.
