# Wind Turbine Lab: build TODO

Companion to `TECH_SPEC.md` (§ numbers refer to it). Work top to bottom: each phase ends with a **Done when** check and a ready-to-paste **Opus prompt**. Keep `TECH_SPEC.md`, `TODO.md` and `reference/` in the repo root and attach them to every prompt.

**Ground rules for every phase**
- Everything in English: code, comments, UI copy, commits.
- Physics first, pixels second. No number goes on screen unless it comes from `src/physics`.
- One phase per Opus session. Commit after each phase: `feat(phase-N): …`.
- After each phase, run `npm run dev`, click through it yourself, and tick the boxes.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · ★ = critical for the wow moments

---

## Phase 0: Project setup  (≈ 0.5 h)

- [x] `npm create vite@latest wind-turbine-lab -- --template vanilla-ts`
- [x] Install `three` (pin the exact version), `@types/three`, `vitest`, `eslint`, `prettier`, `tsx` (for scripts)
- [x] `tsconfig`: `strict: true`, `noUncheckedIndexedAccess: true`, path alias `@/` → `src/`
- [x] Create the folder tree from §14.2 with empty modules exporting typed stubs
- [x] Copy `reference/wind_model_reference.py` and its generated `reference/tables.json` into the repo
- [x] `src/ui/styles.css` with all tokens from §3.2; load the Google Fonts (Outfit, Inter, JetBrains Mono) with preconnect
- [x] `index.html`: full-bleed `<canvas id="scene">`, `#ui-root` overlay, `<noscript>` fallback text
- [x] npm scripts: `dev`, `build`, `preview`, `test`, `lint`, `format`, `tables`
- [x] `.editorconfig`, `README.md` (what it is, how to run, where the physics comes from)

**Done when:** `npm run dev` shows a dark page with the token-colored background; `npm test` runs (0 tests); lint is clean.

**Opus prompt**
```
You are building "Wind Turbine Lab" from TECH_SPEC.md (attached). Do Phase 0 from TODO.md only:
scaffold a Vite + strict TypeScript project, install three (pin the exact version), vitest, eslint, prettier, tsx.
Create the full folder tree from §14.2 with typed stub modules (each exports its public function signatures and throws "not implemented").
Add the CSS tokens from §3.2, fonts, index.html structure, npm scripts. All code and comments in English.
Output every file in full. Do not start on physics or 3D yet.
```

---

## Phase 1: Physics core ★  (≈ 3–4 h)

### 1.1 Data
- [x] `config/turbine.ts`: constants from §6.1 (ρ, R, R_hub, B, η, P_rated, N, ω_rated, J, V_in/out/restart)
- [x] `physics/blade.ts`: the 17 stations (r, Δr, twist, chord, family), exactly as in §6.1
- [x] `physics/polars.ts`: `polar(family, alphaDeg): { cl, cd }`, a line-by-line port of the reference (attached range, Viterna, flat plate beyond 90°)

### 1.2 BEM
- [x] `physics/bem.ts`: `prandtlLoss(r, phi)`, `solveElement(V, omega, pitchDeg, i)` → `{ dT, dQ, alphaDeg, a, aPrime, cl, cd }`, `rotor(V, omega, pitchDeg)` → `{ cp, ct, thrustN, torqueNm }`
- [x] Same algorithm as §6.3: start a = 0.3, relax 0.3, Buhl branch, clamps, ≤ 200 iterations
- [x] `scripts/build-tables.ts` → `src/physics/tables.generated.json` (λ 0–20 step 0.25, β −2…90 step 1, V = 10)
- [x] `physics/tables.ts`: `cpAt(lambda, pitchDeg)`, `ctAt(...)`, bilinear and clamped
- [x] Diff script: compare the generated JSON with `reference/tables.json`, max abs error < 0.002

### 1.3 Ideal disk
- [x] `physics/actuatorDisk.ts`: `cpIdeal(b)`, `ctIdeal(a)`, `inductionFromCt(ct)` (with Buhl inverse), `axialVelocity(x, a, R, V)`, `tubeRadius(x, a, R)`, `streamlineRadius(rInf, x, a, R)`, `travelTime(xSamples, a)`

### 1.4 Control and dynamics
- [x] `physics/controller.ts`: torque law (regions 2 / 2.5 / 3 with K_HSS, VS_RT, VS_SY, SLOPE25, VS_TR computed from constants) and the gain-scheduled pitch PI with anti-windup; rate limits per state
- [x] `physics/supervisor.ts`: states RUN / SHUTDOWN / PARKED / STARTUP / TRIP / TRIPPED with the 3 s cut-out hold and 10 s restart hold; `reset()`; brake logic and brake heat
- [x] `physics/drivetrain.ts`: `J dω/dt` integration, azimuth ψ
- [x] `physics/loads.ts`: thrust, tower-top deflection, base moment, blade tip deflection, tip speed, blade-pass frequency, mass flow, homes, runaway rpm, tip Mach
- [x] `physics/wind.ts`: mean-wind ramp limiter (≤ 2 m/s per sim second), gust generator (TI 0.12, 4 sines), `beaufort(V)`
- [x] `physics/regime.ts`: CALM / CHASE / CAP / SPILL / SHUTDOWN / PARKED / STARTUP / TRIP / BETZ
- [x] `physics/sim.ts`: `createSim()` → `{ step(dtSim, inputs), snapshot(), initSteady(V) }`, fixed dt 1/120, interpolated steady init from the schedule
- [x] `physics/format.ts`: `fmtMW`, `fmtKN`, `fmtRpm`, `fmtDeg`, `fmtMs` (tabular, fixed decimals)

### 1.5 Tests (Vitest)
- [x] `bem.test.ts`: 8 vectors from §7.3 (±0.002)
- [x] `schedule.test.ts`: Cp_max 0.4709 at λ 7.65; V_rated 11.42 ± 0.03; the schedule rows of §7.2 (pitch ±0.1°, P ±0.01 MW, T ±3 kN)
- [x] `alongBlade.test.ts`: the 3 spanwise α rows of §7.4 (±0.2°)
- [x] `controller.test.ts`: storm ramp reaches PARKED (β = 90, ω = 0) and restarts to RUN at 15 m/s; pitch lock at 0 plus 12 → 22 m/s trips; no NaN over 10k random fuzz steps
- [x] `betz.test.ts`: cpIdeal max = 16/27 at b = 1/3; tubeRadius(+∞, 1/3) = √2·R

**Done when:** `npm test` is green, and `npm run tables` output diffs cleanly against the reference.

**Opus prompt**
```
Implement Phase 1 of TODO.md (physics core) exactly per TECH_SPEC.md §6 and §7.
The Python file reference/wind_model_reference.py is the source of truth: port polar(), prandtl(), section(), rotor(),
the controller and the supervisor LINE BY LINE into TypeScript (src/physics/*), pure functions, no three.js imports,
SI units, units in names (omegaRad, pitchDeg, thrustN, powerW).
Add scripts/build-tables.ts and the Vitest suites listed in Phase 1.5 using the numbers from §7 with the stated tolerances.
Every physics file starts with a header comment: formula, spec section, source paper. English only.
Run the tests mentally for edge cases (lambda=0, V=0, pitch=90) and guard against NaN.
```

---

## Phase 2: Scene shell  (≈ 2 h)

- [x] `scene/renderer.ts`: WebGLRenderer (antialias off; SMAA in post), sRGB output, tone mapping ACES (or AgX; decide and lock), shadows PCFSoft, DPR ≤ 2
- [x] `scene/post.ts`: EffectComposer: RenderPass → UnrealBloom (0.55 / 0.42 / 0.82) → SMAA → OutputPass; resize handling
- [x] `scene/camera.ts` + `cameraRig.ts`: fov 35, OrbitControls with limits (§4.5), idle drift after 8 s, `flyTo(preset, 1.2 s)`
- [x] `scene/lights.ts`: key / fill / rim plus the RoomEnvironment PMREM (§4.2)
- [x] `scene/materials.ts`: factory `makeMaterial(opts, system)` that injects the `uDim` uniform via onBeforeCompile (needed in Phase 8)
- [x] `scene/units.ts`: `toModel(m) = m / 200`
- [x] `util/rafLoop.ts`: frame loop with fixed-step sim accumulator (§6.11), pause when the tab is hidden
- [x] Environment: `room.ts` (walls, floor, ceiling light strips), `bench.ts`, `ruler.ts` (engraved ticks in full-scale meters, text via CanvasTexture), brass plate
- [x] `fan.ts`: ducted fan with honeycomb ring (emissive), blades spinning ∝ V̄, LED display (CanvasTexture)
- [x] `diorama.ts`: low-poly hill (flatShading), rocks, 6 trees (instanced), foundation pad at the origin
- [x] Placeholder turbine: a gray cylinder tower plus a box, to check scale

**Done when:** the scene renders at 60 fps with bloom on the fan ring; orbit limits feel right; the placeholder turbine stands 0.45 units tall on the hill; a stats overlay (dev only) shows draw calls < 80.

**Opus prompt**
```
Phase 2 of TODO.md: build the scene shell per TECH_SPEC.md §4 and §14.
Renderer, post chain, camera + OrbitControls with limits and idle drift, lights, material factory with uDim injection,
fixed-step raf loop wired to the Phase 1 sim, and the "desktop wind tunnel" environment: room, bench with a full-scale
metre ruler, ducted fan with glowing honeycomb and LED readout, low-poly diorama hill with instanced trees.
All geometry procedural. Keep draw calls < 80. Include a dev-only stats overlay (toggle with backtick). English comments.
```

---

## Phase 3: Turbine exterior ★  (≈ 3 h)

- [x] `turbine/tower.ts`: tapered cylinder 6.0 → 3.87 m, 30 height segments, flanges, door; a vertex shader hook for bending (uniform `uTopDeflection`, `uExaggeration`)
- [x] `turbine/nacelle.ts`: rounded box 18×6×6 m shell (two halves, so cutaway can remove one), roof radiator, anemometer (cups spin ∝ V), wind vane, aviation light (1 Hz blink, bloom), crane
- [x] `turbine/hub.ts`: spinner (LatheGeometry) with 3 blade openings, flange rings
- [x] `turbine/bladeGeometry.ts` ★: loft from the 17 stations (§5.2): cylinder → airfoil sections with thickness ratios, cosine spacing 48 points, Catmull-Rom 40 rings, tip cap, root flange, red tip band via a vertex color / second material group
- [x] `turbine/rotor.ts`: 3 blades at 120°, pitch rotation about the span axis, precone 2.5°, shaft tilt 5°, overhang 5 m, azimuth ψ from the sim; flap bending uniform `uTipDeflection`
- [x] Put the turbine group on the diorama at scale 1/200; remove the placeholder
- [x] Verify: at pitch 90° the blades are visibly edge-on to the wind (a chord line parallel to the rotor axis)

**Done when:** the rotor spins at the sim's ω (count: 12.1 rpm ≈ 5 s per rev at ×1), pitch changes rotate the blades smoothly, and the silhouette reads as a modern 3-blade turbine from every orbit angle.

**Opus prompt**
```
Phase 3 of TODO.md: procedural turbine exterior per TECH_SPEC.md §5 (full-scale metres, group scaled 1/200).
Most important: bladeGeometry.ts. Loft the 17 NREL stations (chord, twist, family → thickness ratio) into one BufferGeometry,
pitch axis at 25 % chord, cylinder root blending into airfoils, rounded tip, red tip band. Twist baked in; pitch applied as
a rotation about the span axis at runtime. Rotor with precone, tilt, overhang; azimuth from sim snapshot psi.
Tower with a bending vertex-shader hook. Nacelle shell as two halves. Anemometer cups spin with V. English comments.
```

---

## Phase 4: Nacelle internals  (≈ 3 h)

- [x] `turbine/gears.ts`: gear geometry generator (ExtrudeGeometry, trapezoid teeth, configurable tooth count, module, face width)
- [x] `turbine/drivetrain.ts`: main bearing, LSS, planetary stage (ring 99, 3 × planet 39, sun 21, carrier), parallel stages 83:22 and 72:16 (total 97.0), HSS, brake disc + caliper, coupling, generator with fins + copper windings, converter cabinet, yaw ring + 4 drives, bedplate
- [x] Kinematics from ω: carrier = ω; sun = 5.714ω; planets spin about their own axes; stage 2/3 speeds; HSS = 97ω
- [x] Visual speed cap of 2.5 rev/s plus cross-faded radial motion-blur discs above the cap (§5.4)
- [x] Emissives: generator windings ∝ P/P_rated (amber), brake disc ∝ brake heat (red)
- [x] Hub internals: pitch bearings (torus), pitch motors, teeth rotating with pitch
- [x] Instanced bolts on flanges
- [x] Internals are `visible = false` in Whole view (not merely hidden behind the shell)

**Done when:** with a temporary "shell off" dev toggle, the full drivetrain is readable, gears mesh visually, and nothing strobes at rated speed.

**Opus prompt**
```
Phase 4 of TODO.md: nacelle and hub internals per TECH_SPEC.md §5.3–5.4.
Write a reusable gear generator, then build the 3-stage 97:1 gearbox with the exact tooth counts from the spec, and animate
every part kinematically from the rotor speed. Add the 2.5 rev/s visual speed cap with motion-blur discs. Emissive generator
windings (∝ power) and brake disc (∝ brake heat). Instanced bolts. Internals must be culled (visible=false) in Whole view.
```

---

## Phase 5: UI shell  (≈ 3 h)

- [x] `ui/layout.ts`: regions per §3.1 (left column, top-right panel, bottom chips, bottom-right share/X)
- [x] Title block: overline, gradient headline "THE 59 % / LIMIT", intro text (§1.1)
- [x] `ui/segmented.ts` and `ui/slider.ts`: reusable components (keyboard accessible, aria-pressed / aria-valuetext)
- [x] `ui/controlPanel.ts`: Follow, Weather presets + wind slider with in / rated / out ticks and a gradient fill, Rotor, Pitch, View, the icon row, a conditional Reset pill (§3.4)
- [x] `ui/statCards.ts`: 3 cards with tweened tabular numbers, sub-lines, Beaufort names (§3.3)
- [x] `ui/explainer.ts` + `templates.ts` ★: regime templates from §3.5, bold numbers, colored concept words, throttle 150 ms, change detection
- [x] `ui/hotkeys.ts`: every key in §3.9, ignored while typing
- [x] `ui/help.ts`: overlay with hotkeys, assumptions (1:200 scale, simplified polars, 3 s cut-out hold, homes = 0.4 kW each), references
- [x] `ui/toast.ts`: small top-center toasts ("Link copied", "You found the limit: 59.3 %", "TRIP: overspeed")
- [x] `ui/loader.ts`: spinning turbine silhouette SVG, fades out on the first rendered frame
- [x] `state/store.ts` + `uiState.ts`: tiny observable store (§14.3)

**Done when:** every control changes `uiState`, the sim reacts (wind, lock, time scale, pause), the stat cards and text update live, and hotkeys work.

**Opus prompt**
```
Phase 5 of TODO.md: the HTML/CSS UI per TECH_SPEC.md §3 using vanilla TS and the CSS tokens.
Glass panels, segmented controls, slider with cut-in/rated/cut-out ticks, stat cards with tweened tabular numbers,
the live explanation panel with ALL regime templates from §3.5, hotkeys §3.9, help overlay, toasts, loader, and the
tiny observable store from §14.3. Match the reference look: dark glass, white active pill, dim mono hotkey hints.
No UI framework. Accessible markup (buttons, range inputs, aria attributes). English copy exactly as in the spec.
```

---

## Phase 6: Wiring and time  (≈ 1.5 h)

- [x] `main.ts`: create store → sim → scene → UI → audio stub; subscribe the UI to the store; the scene reads snapshot + uiState each frame
- [x] Time scale ×1/×4/×10, pause, the V̄ ramp limiter on presets
- [x] `initSteady(V)` on load and on tour jumps / URL restore
- [x] Throttles: text 10 Hz, charts 30 Hz (`util/throttle.ts`); labels every frame (projection) and occlusion every 6th frame land with the labels in Phase 12
- [x] Dev overlay: live snapshot JSON (backtick key)

**Done when:** Storm preset from Rated at ×1 goes RUN → SHUTDOWN → PARKED in ≈ 30 s sim time, matching the §7.5 table within tolerance, and the UI text follows every state.

---

## Phase 7: Views: Whole / Cutaway / Exploded  (≈ 3 h)

- [x] `scene/views.ts`: state machine with animated transitions (§8)
- [x] Cutaway: a clipping plane through the shaft axis on the camera side; animate the plane constant 0.9 s; clip the nacelle shell, spinner, hub and tower top 12 m
- [x] Stencil caps with a hatched dark fill and a 2 px amber edge (stencil works everywhere tested, so no BackSide fallback was built)
- [x] Exploded: components offset along the shaft axis with 60 ms stagger; the shell lifts +4 m and fades to 0.15; the rotor moves +6 m forward; dashed guide lines
- [ ] Labels for internals appear only in Cutaway/Exploded (moved to Phase 12, with the label system)
- [~] Hotkey V cycles (done in Phase 5); URL param `view` lands with the URL state in Phase 13

**Done when:** switching views never pops, caps have no gaps from any angle, and the rotor and gears keep running during transitions.

**Opus prompt**
```
Phase 7 of TODO.md: Whole/Cutaway/Exploded per TECH_SPEC.md §8. Implement stencil-capped clipping (three.js clipping
stencil technique) with a hatched cap material and amber edge; animate the clipping plane. Exploded view with staggered
eased offsets and dashed guide lines. Provide the BackSide fallback behind a flag. Keep everything animating during transitions.
```

---

## Phase 8: Follow modes and FX ★  (≈ 4 h)

- [x] `follow.ts`: tag meshes by system; animate `uDim` (400 ms) per §9
- [x] `fx/smokeLines.ts` ★: 14 camera-facing ribbons (180 segments each), positions computed in the **vertex shader** from the actuator-disk formulas (§6.5), scrolling dashes via a precomputed travel-time attribute, color by u/V, downstream turbulence noise ∝ gusts/storm
- [x] `environment/smokeRake.ts`: comb of 14 nozzles at x = −2.5R with tiny emissive tips
- [x] Stream-tube outline (violet dashed) in Wind mode
- [x] `fx/tipVortices.ts`: 3 helices of radius r_tube(x), pitch p = u_conv·2π/ω, rotating with ψ, fading downstream
- [x] `fx/powerFlow.ts`: CatmullRom path blades → hub → LSS → gearbox → HSS → generator → converter → tower cable → transformer → pylon → village; amber pulses, count and speed ∝ P
- [x] `environment/village.ts`: 12 houses (instanced), window emissive, lit count = round(12·P/P_rated)
- [x] `fx/loadsViz.ts`: thrust arrow (coral, length ∝ T, flips when T < 0), tower bend ×25, blade flap ×2, stress color ramp on the tower, person figure 1.8 m
- [ ] Labels per mode (§3.7 table): moved to Phase 12, with the label system

**Done when:** in Wind mode at 8 m/s the smoke visibly slows and widens to about 1.25R in the wake. In Power mode the pulses stop when parked. In Loads mode the tower visibly straightens when the storm feathers the blades.

**Opus prompt**
```
Phase 8 of TODO.md: Follow modes per TECH_SPEC.md §9 and the actuator-disk math in §6.5.
The smoke lines are the hero effect: GPU ribbons whose vertex positions come from u(x)=V[1-a(1+x/sqrt(x²+R²))] and the
stream-tube radius formulas, with dashes scrolling at the local speed (precomputed travel-time attribute), colored by u/V.
Add tip-vortex helices, the power-flow pulses to a village whose lights scale with power, and the loads visualisation
(thrust arrow, exaggerated tower bend with cantilever shape, stress ramp). Dim non-focused systems via the uDim uniform.
```

---

## Phase 9: Betz disk mode ★  (≈ 2 h)

- [ ] `betzDisk.ts`: violet emissive disk with a fresnel edge; blades fade out (500 ms)
- [ ] Control-panel swap: wind slider → **Wake speed b** slider (0–1) while in Ideal mode
- [ ] Smoke lines use a = (1 − b)/2; for a > 0.45 show "turbulent wake state" noise and text
- [ ] Card 3 shows Cp(b); chart forced to the Betz tab
- [ ] Sweet-spot detection |b − 1/3| < 0.015 → disk pulse, chart ring, toast once per entry
- [ ] Exit → the loss waterfall row appears for 6 s (§3.6)

**Done when:** a new user finds the 59.3 % peak by dragging within ~10 s, and the explanation text and chart agree at every b.

---

## Phase 10: Charts  (≈ 2.5 h)

- [ ] `charts/chartBase.ts`: DPR-aware canvas, axes, grid, mono tick labels, theme colors, redraw-on-change
- [ ] `powerCurve.ts`: steady curve, Betz max, power in the wind, region bands (wait / catch / spill / hide), live dot + 6 s trail
- [ ] `cpTsr.ts`: Cp(λ) at current pitch and 0°, Betz line 0.593, live dot
- [ ] `alongBlade.ts`: α(r) live (per-element BEM ≤ 10 Hz), ghost at pitch 0, stall band 10–11°
- [ ] `betzCurve.ts`: ½(1 + b)(1 − b²) with peak marker
- [ ] `waterfall.ts`: 59.3 → 58.1 → 55.3 → 51.7 → 47.1 → 44.5
- [ ] Tabs + key C; `environment/screens.ts` renders the stream-tube and Cp–λ plots onto the two wall monitors at 5 Hz

**Done when:** the chart dot moves continuously with the sim (dynamic, not steady), and the wall screens mirror the state.

---

## Phase 11: Weather and storm  (≈ 2.5 h)

- [ ] `stormLevel = smoothstep(18, 28, V̄)` in the snapshot
- [ ] `fx/rain.ts`: instanced streaks (4k desktop / 1.5k mobile), wind slant, bench splashes
- [ ] `environment/clouds.ts`: color lerp and bob; `fx/lightning.ts`: flash every 6–14 s when s > 0.8 (disabled under reduced motion)
- [ ] `fx/trees.ts`: vertex-shader sway, bend ∝ V² (capped at 18°), gust flutter
- [ ] Room light, fog and exposure lerps with s; fan LED shows `STORM`
- [ ] `fx/beacon.ts`: rotating amber beacon (red on TRIP)
- [ ] Vignette + grain pass when s > 0.5
- [ ] Gusts toggle (G) with `±gust` badge on the WIND card

**Done when:** the Storm preset feels like a storm within 3 s, then eases back smoothly when the wind drops.

---

## Phase 12: Labels  (≈ 2 h)

- [ ] `scene/labels.ts`: DOM pool, projection each frame, behind-camera culling, occlusion raycasts on coarse proxies every 6th frame
- [ ] Priority collision (greedy vertical nudge, max 9 visible), 200 ms fades
- [ ] All labels in the §3.7 table with live values and follow/view visibility rules

**Done when:** labels never jitter, never stack on top of each other, and never show through the tower.

---

## Phase 13: Tour, URL, share, chips  (≈ 2 h)

- [ ] `tour/steps.ts` + `tour.ts`: 6 steps (§12), caption bar with progress dots, pauses on user input, Resume pill
- [ ] `ui/chips.ts`: 4 camera chips (§3.8) with fly-to and mode switches
- [ ] `state/urlState.ts`: read/write query params (§17), debounced replaceState
- [ ] `ui/share.ts`: Web Share API, else clipboard + toast
- [ ] `{BRAND}` wordmark placeholder and `{HANDLE}` link in one config file

**Done when:** a shared URL reproduces the view, wind, mode and camera chip; the tour runs start to finish in ≈ 50 s.

---

## Phase 14: Audio  (≈ 1.5 h)

- [ ] `audio/audio.ts`: WebAudio graph from §13 (whoosh at blade-pass frequency, generator hum at 2 × ω_g/2π, wind noise, rain, thunder, brake squeal), master limiter
- [ ] Starts only after a user gesture; mute state in the URL; off by default

---

## Phase 15: Polish ★  (≈ 3 h)

- [ ] Motion pass: every discrete change animates (§4.6); no physics easing
- [ ] Bloom and exposure tuning so only intended parts glow (fan ring, aviation light, windows, generator, smoke)
- [ ] Idle drift, camera chip flights, loader → first-frame dolly-in
- [ ] Typography pass: tabular numbers, no layout shift, consistent units (`m/s`, `MW`, `kN`, `rpm`, `°`)
- [ ] Copy pass: every template reads naturally at edge values (0 m/s, 35 m/s, b = 0, b = 1)
- [ ] Compare side by side with the reference screenshots: panel spacing, pill style, label style, headline scale

---

## Phase 16: Performance, mobile, accessibility  (≈ 3 h)

- [ ] Measure draw calls, triangles and frame time against the §15 budget; fix the top offenders
- [ ] Adaptive DPR and half-resolution bloom (§15)
- [ ] Mobile layout (§16): bottom sheet with peek, compact tiles, max 5 labels, touch gestures
- [ ] `prefers-reduced-motion` behavior (§4.6)
- [ ] Keyboard-only pass; screen-reader pass (aria-live throttled); contrast check
- [ ] Test on Chrome, Safari, Firefox (desktop) and iOS Safari, Android Chrome

---

## Phase 17: QA and launch  (≈ 2 h)

- [ ] Run the §19 acceptance checklist, item by item
- [ ] Fuzz test: 10k random inputs through `sim.step` and table lookups, no NaN or Infinity
- [ ] Traceability review: every on-screen number maps to a physics function (make a table in README)
- [ ] Lighthouse: Perf ≥ 85, A11y ≥ 95, BP ≥ 95
- [ ] OG image 1200×630 (Storm + Cutaway), meta tags, favicon, `noscript` fallback
- [ ] Deploy (Vercel / Netlify / Cloudflare Pages); optional single-file build via `vite-plugin-singlefile`
- [ ] Record a 20–30 s screen capture for the launch post: Breeze → Betz peak → Storm feather → Cutaway power flow

---

## Stretch ideas (after launch)
- [ ] Yaw misalignment slider: power ∝ cos³(γ), with the wake skewing
- [ ] Offshore mode: waves, monopile, 15 MW rotor preset
- [ ] Two turbines in a row: wake losses on the second turbine (Jensen wake model)
- [ ] Air density slider (hot/high site vs cold/sea level)
- [ ] Record-and-replay of a real storm day from a public wind dataset

## Time estimate
≈ 45–50 hours of focused work, or about 18 Opus sessions (one per phase, plus 1–2 fix-up sessions for Phases 8 and 15).
