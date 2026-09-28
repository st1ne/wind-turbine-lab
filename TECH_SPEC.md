# Wind Turbine Lab: "The 59 % Limit"
### Technical specification · v1.0

An interactive 3D explainer page built with three.js. The visitor turns up the wind on a desktop wind-tunnel diorama and watches a 5 MW turbine chase the wind, cap its power, and feather its blades to hide from a storm. Every number on screen comes from a real physics model. The model is validated against a Python reference (`reference/wind_model_reference.py`) whose outputs are quoted in section 7.

> **Language rule:** all UI copy, code, identifiers, comments, commit messages and docs are in **English**.

---

## Contents
1. Concept and goals
2. Experience walkthrough
3. Layout and UI
4. Art direction
5. 3D model
6. Physics model
7. Reference numbers and test vectors
8. Views: Whole / Cutaway / Exploded
9. Follow modes: All / Wind / Power / Loads
10. Betz disk mode (the "wow")
11. Weather and storm FX
12. Guided tour
13. Audio
14. Architecture
15. Performance budget
16. Responsive layout and accessibility
17. URL state, sharing, SEO
18. Coding conventions
19. Acceptance criteria
20. Risks and mitigations
21. References

---

## 1. Concept and goals

### 1.1 Hook
- **Overline:** `WIND TURBINE LAB`
- **Headline (2 lines, gradient):** `THE 59 %` / `LIMIT`
- **Intro (≤ 3 lines):** "Everyone has seen a wind turbine turn. Almost nobody knows it can never catch more than 59 % of the wind, or why it hides from storms. Turn up the wind and watch."

### 1.2 The two "wow" moments
1. **Betz limit.** Replace the rotor with an ideal disk and drag how much it slows the wind. Stop too little air and the wind just passes by. Stop too much and it piles up and flows around. The peak is exactly when the wake leaves at 1/3 of the wind speed: 16/27 = **59.3 %**. The real rotor then scores 47 %, and a waterfall shows where the other 12 points go.
2. **Storm feathering.** Push the wind past 25 m/s. The controller rotates all three blades to 90°, edge-on to the wind. The rotor spins down and the brake closes. Rotor thrust falls from **725 kN at rated wind to about 28 kN parked at 30 m/s**. A "pitch lock" what-if shows the alternative: overspeed, an emergency trip and a runaway warning.

### 1.3 Goals
- Physically honest. No hand-tuned fake numbers; every displayed value traces to a formula in `src/physics`.
- Visually on par with the reference labs: a diorama lab scene, glass UI, 3D-pinned labels, bloom, and a living explanation panel.
- Instant: first meaningful frame in < 2.5 s on a mid laptop, steady 60 fps.
- Self-explaining: a first-time visitor reaches both wow moments in < 90 s without reading help.

### 1.4 Non-goals
- No full aeroelastic simulation (FAST/OpenFAST). The model is steady BEM plus a one-DOF drivetrain.
- No imported CAD or GLTF models. All geometry is procedural.
- No backend. It's a static site.

---

## 2. Experience walkthrough

| t | What the visitor sees | What they learn |
|---|---|---|
| 0–2 s | Loader: a turbine silhouette whose blades spin up as assets load. Fades into the scene; the camera dollies in from wide. | — |
| 2–10 s | Default state: **Breeze 8 m/s**, Follow = All, View = Whole. Smoke lines from the rake bend around the rotor and the stream tube visibly widens behind it. The rotor turns at 9.3 rpm. | The rotor slows the wind. |
| 10–30 s | Visitor drags the wind slider. Power climbs as V³. Labels update: "At the rotor 5.9 m/s", "Wake 3.8 m/s". | Power grows with the cube of the wind. |
| 30–50 s | Press **B** / "Ideal disk". Blades fade out, a glowing disk appears, and a "wake speed" slider replaces the wind slider. The chart becomes Cp(b) with a peak at 1/3. | The Betz limit. |
| 50–70 s | Press **R** / Storm preset. Pitch counts up 23° → 90°, blades turn edge-on, the rotor spins down, the brake disc glows, the beacon turns amber. Rain and bending trees. | Feathering. |
| 70–90 s | Toggle **Cutaway** and **Follow: Power**. The nacelle opens and amber pulses run shaft → gearbox → generator → cable → village lights. | Where the power goes. |

---

## 3. Layout and UI

### 3.1 Screen regions (desktop ≥ 1280 px)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ [BRAND]                                               ┌─ CONTROL PANEL ─────┐ │
│ WIND TURBINE LAB                                      │ Follow  1 2 3 4     │ │
│ THE 59 %                                              │ Weather  Wind ──●── │ │
│ LIMIT                                                 │ Rotor   Pitch  View │ │
│ intro text (3 lines)                                  │ ▶ ⏱ 🔊 ?            │ │
│ [WIND] [POWER] [CAPTURED]   ← stat cards              └─────────────────────┘ │
│ ┌ explanation panel (live) ┐                                                  │
│ └──────────────────────────┘          3D SCENE (full-bleed canvas)            │
│ ┌ chart (tabs) ────────────┐                                                  │
│ └──────────────────────────┘                                                  │
│                    [Rotor] [Nacelle] [Tower] [Blade]   ← camera chips  [↗][X] │
└───────────────────────────────────────────────────────────────────────────────┘
```

- The canvas is full-bleed behind everything. UI panels are absolutely positioned with 24 px outer gutter.
- The left column is 360 px wide. The control panel is 540–560 px wide, top-right.
- The bottom center holds camera chips. The bottom right holds the share button and a "Follow on X" link (placeholder `{HANDLE}`).
- The brand wordmark sits top-left as a placeholder `{BRAND}`. Do not reuse any third-party brand.

### 3.2 Design tokens (CSS custom properties)

```css
:root {
  --bg: #0a0e1a;
  --panel: rgba(13, 17, 30, 0.72);
  --panel-border: rgba(255, 255, 255, 0.08);
  --panel-blur: 18px;
  --text: #e8ecf5;
  --text-muted: #8b93a7;
  --text-dim: #5d6479;
  --wind: #4cc9ff;      /* cyan: air, smoke, wind values */
  --power: #ffb547;     /* amber: power, torque, heat */
  --ideal: #a78bfa;     /* violet: Betz / ideal disk */
  --loads: #ff7a59;     /* coral: thrust, bending */
  --alarm: #ff4d5e;     /* red: trip, overspeed */
  --ok: #5be49b;        /* green: grid OK, sweet spot */
  --radius-panel: 14px;
  --radius-btn: 9px;
  --font-display: "Outfit", system-ui, sans-serif;   /* 800 for headline */
  --font-ui: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}
```

- Headline: `--font-display` 800, 64/58 px, gradient `linear-gradient(180deg, #9be3ff 0%, #38bdf8 100%)` via `background-clip: text`. Overline: 22 px, 700, `--text`, letter-spacing 0.02em.
- Numbers always use `--font-mono` with `font-variant-numeric: tabular-nums`, so digits don't jitter.
- Glass panel: `background: var(--panel); backdrop-filter: blur(var(--panel-blur)) saturate(140%); border: 1px solid var(--panel-border); border-radius: var(--radius-panel); box-shadow: 0 10px 40px rgba(0,0,0,.35)`.

### 3.3 Stat cards (3, mono values)

| Card | Label | Value | Sub-line |
|---|---|---|---|
| 1 | `WIND` | `11.4 m/s` | `Beaufort 6 · strong breeze` |
| 2 | `POWER` | `5.00 MW` | `12.1 rpm · pitch 0.0°` |
| 3 | `CAPTURED` | `47 %` | `Betz max 59.3 %` |

- In Betz disk mode, card 3 shows `Cp(b)` and the sub-line becomes `wake at b = 0.33 V`.
- In SHUTDOWN / PARKED / TRIP, card 2 shows `0.00 MW` and the sub-line `parked · pitch 90°` (or `TRIP · brake on` in `--alarm`).
- Values tween over 250 ms (`--ease-out`); digits never re-layout (tabular nums, fixed min-width).
- Beaufort mapping (m/s upper bounds): 0 <0.5 Calm, 1 1.5 Light air, 2 3.3 Light breeze, 3 5.4 Gentle breeze, 4 7.9 Moderate breeze, 5 10.7 Fresh breeze, 6 13.8 Strong breeze, 7 17.1 Near gale, 8 20.7 Gale, 9 24.4 Strong gale, 10 28.4 Storm, 11 32.6 Violent storm, 12 ≥ 32.7 Hurricane force.

### 3.4 Control panel (top-right)

Row 1: **Follow** (segmented, hotkeys shown dim at right: `1 2 3 4`)
`All · Wind · Power · Loads`

Row 2: **Weather** (segmented presets) + **Wind** slider with readout
- Presets: `Breeze` 8 m/s (Q) · `Rated` 11.4 (W) · `Gale` 20 (E) · `Storm` 30 (R)
- Slider: 0–35 m/s, step 0.1. Tick marks under the track at **3** (cut-in), **11.4** (rated) and **25** (cut-out), with 9 px mono captions `in · rated · out`. The track fill is a gradient: cyan below 11.4, amber 11.4–25, red above 25.
- Readout: `11.4 m/s` mono, right-aligned.

Row 3: **Rotor** (segmented) · **Pitch** (segmented) · **View** (segmented)
- Rotor: `Real` · `Ideal disk` (B)
- Pitch: `Auto` · `Locked` (L). Locked freezes the pitch at its current angle as a what-if; show a small ⚠ tag.
- View: `Whole` · `Cutaway` · `Exploded` (V cycles)

Row 4: icon buttons (32 px): `▶` guided tour (Enter), `⏱ ×1` time scale cycling ×1/×4/×10 (T), `〰` gusts toggle (G), `🔊` sound (M), `?` help (H or ?). A `Reset` pill appears in `--alarm` only in TRIP/TRIPPED state (X).

Behavior:
- Segmented buttons: the active state is a white pill with dark text (as in the references). Hover raises opacity 0.7 → 1.
- Changing any control **never** snaps the scene; every change animates (see 4.6).
- The panel scrolls internally on short viewports; it never overflows the screen.

### 3.5 Explanation panel (live text)

A glass card under the stat cards. It re-renders at most every 150 ms, and only when the rounded values it prints change. The text is picked from templates by regime (6.9). Key numbers are **bold**. Colored words link concepts to scene colors: `wind` cyan, `power` amber, `Betz` violet, `thrust` coral.

| Regime | Template (values in `{}` are live) |
|---|---|
| CALM (V < 3) | "At **{V} m/s** the wind carries only **{Pwind} kW** through the 126 m disk: not enough to beat friction. The rotor idles and waits for **3 m/s**." |
| CHASE (region 2) | "**{Pwind} MW** of wind flows through the disk. The rotor keeps its tips at **{tsr}×** the wind speed ({tip} m/s), the ratio where it catches the most: **{cp} %**, or {ofBetz} % of the Betz limit. **{P} MW** reaches the grid." |
| CAP (region 2.5) | "The rotor has hit **12.1 rpm**. Tips at **80 m/s** are the limit for noise and erosion, so the generator leans on the shaft harder instead. **{P} MW**." |
| SPILL (region 3) | "Too much wind: **{Pwind} MW** arrives, the generator takes only **5.00 MW**. The blades twist **{pitch}°** out of the wind and let the rest blow through. Thrust drops from **725 kN** at rated to **{T} kN**." |
| SHUTDOWN (≥ 25) | "Storm, **{V} m/s**. The controller feathers the blades toward **90°**, edge-on, at 4°/s. Pitch **{pitch}°**, rotor **{rpm} rpm**. Once it slows, the brake closes." |
| PARKED | "Parked and feathered. The blades slice the storm edge-on: rotor thrust is **{T} kN**, not the **{Tlocked} kN** it would be with blades flat to the wind. It restarts below **20 m/s**." |
| STARTUP | "Wind back under 20 m/s. Blades pitch in at 2°/s, the rotor spins up, and the generator connects at 90 % speed." |
| TRIP | "Overspeed! With pitch locked the rotor hit **{rpm} rpm** (**{pct} %**). Emergency: blades to 90° at 8°/s and brake on. Left alone at {V} m/s it would try for **~{runaway} rpm**, tips at Mach **{mach}**. Blades fail long before that." |
| BETZ | "Slow the wind too little and most of it passes unused. Stop it entirely and nothing flows through. At **b = {b}** the disk takes **{cpb} %**. The peak, **16/27 = 59.3 %**, sits at b = 1/3 (Betz, 1920)." |

Add one tail sentence when Pitch = Locked: "Pitch is locked at **{pitch}°**; the controller can only use generator torque."

### 3.6 Chart card (tabs, key C cycles)

A 2D canvas chart (DPR-aware) under the explanation panel, 360 × 150 px. There are three tabs, and Betz mode forces a fourth.

1. **Power curve**: x 0–30 m/s, y 0–6 MW.
   - Steady power curve (grey 1.5 px) from the schedule.
   - A dashed violet "Betz max" line = η·(16/27)·½ρAV³, clipped at 6 MW.
   - A faint cyan "Power in the wind" line = ½ρAV³ that exits the top of the chart early. This shows how much is never taken.
   - Region bands with 9 px mono captions: `wait` (0–3), `catch` (3–11.4), `spill` (11.4–25), `hide` (> 25).
   - A live dot (dynamic, not steady) with a 6 s fading trail.
2. **Cp vs tip-speed ratio**: x 0–14, y 0–0.65. Curve at the current pitch (amber) and at 0° (grey), horizontal Betz line at 0.593 (violet dashed), live dot.
3. **Along the blade**: x = span 0–63 m, y = angle of attack −10…25°. The stall band 10–11° is shaded coral. Line at the current state, ghost line at pitch 0. This shows that pitching lowers α outboard.
4. **Betz** (only in Ideal-disk mode): Cp(b) = ½(1 + b)(1 − b²), b ∈ [0, 1], peak marker at (1/3, 0.593), live dot.

Loss waterfall mini-row in Betz mode (under the chart; percent of wind power, approximate):
`Betz 59.3 → swirl 58.1 → blade shape/root 55.3 → tip & hub loss 51.7 → drag 47.1 → generator 44.5 (electric)`

### 3.7 3D-pinned labels

HTML labels projected from 3D anchors each frame: a dot, **Name**, then a live value in dim mono. Style: pill `rgba(8,10,18,.78)`, 1 px border, 11 px Inter 600, value 10 px mono `--text-muted`.

| Anchor | Name | Value example | Visible in |
|---|---|---|---|
| Upstream smoke | Upstream | `11.4 m/s` | All, Wind |
| Rotor plane | At the rotor | `8.7 m/s` | All, Wind |
| Wake (2R behind) | Wake | `6.0 m/s` | All, Wind |
| Blade tip | Blade tip | `80 m/s · 287 km/h` | All, Wind |
| Pitch bearing | Pitch | `3.5°` | All, Power |
| Main shaft | Main shaft | `12.1 rpm · 4.18 MN·m` | Cutaway/Exploded |
| Gearbox | Gearbox | `97 : 1` | Cutaway/Exploded |
| Brake disc | Brake | `released` / `ON` | Cutaway/Exploded |
| Generator | Generator | `1,174 rpm · 5.00 MW` | Cutaway/Exploded, Power |
| Converter | Converter | `690 V` | Exploded |
| Yaw drive | Yaw | `facing the wind` | Exploded |
| Anemometer | Anemometer | `11.4 m/s` | All |
| Hub | Thrust | `725 kN ≈ 74 t` | Loads |
| Tower top | Sway | `0.45 m (×25)` | Loads |
| Tower base | Base moment | `65 MN·m` | Loads |
| Village | Homes | `≈ 12,500` | Power |

Rules:
- Hide labels whose anchor is behind the camera or occluded. For occlusion, raycast against a coarse proxy every 6th frame, never per frame.
- Collision: greedy vertical nudge by label priority; drop the lowest priority when overlap exceeds 2 labels.
- Fade in/out over 200 ms. Max 9 visible at once.

### 3.8 Camera chips (bottom center)

`Rotor · Betz & pitch` · `Nacelle · drivetrain` · `Tower · loads` · `Blade · along the span`

Each chip flies the camera (1.2 s, easeInOutCubic on position and target) to a preset and may switch Follow/View:
- Rotor: front 3/4 view, Follow = Wind.
- Nacelle: side close-up, View = Cutaway, Follow = Power.
- Tower: low wide shot, Follow = Loads.
- Blade: along the span from the hub, Chart = Along the blade.

The chip matching the last fly-to stays highlighted until the user orbits.

### 3.9 Hotkeys

| Key | Action |
|---|---|
| 1 2 3 4 | Follow: All / Wind / Power / Loads |
| Q W E R | Weather presets |
| ← → | Wind −/+ 0.5 m/s (Shift: ±2) |
| B | Toggle Ideal disk |
| L | Toggle pitch lock |
| V | Cycle view |
| C | Cycle chart |
| G | Gusts on/off |
| T | Time scale ×1 → ×4 → ×10 |
| Space | Pause / resume simulation |
| Enter | Start/stop guided tour |
| X | Reset after trip |
| M | Sound on/off |
| H or ? | Help overlay |

Hotkeys are ignored while focus is in a text input. Show the key hints in panel headers in dim mono, as in the references.

---

## 4. Art direction

### 4.1 Scene concept: "desktop wind tunnel"
A dark lab room. On a long workbench stands a **1:200 scale** turbine on a low-poly island diorama. At the left end of the bench, a big ducted fan with a glowing honeycomb straightener blows along the bench. That fan is the wind source, and its blades spin faster with V. Between fan and turbine, a **smoke rake** (a comb of 14 thin nozzles) emits smoke lines that flow through the rotor, the real technique used in wind tunnels.

Props:
- Bench with an engraved ruler along its front edge, in **full-scale meters** (0, 50, 100, 150, 200 m). A small brass plate reads `{BRAND domain} / wind-turbine · 5 MW class · 1:200`.
- Diorama: grassy low-poly hill, 6 wind-bent trees, a village of 12 tiny houses with window lights, a pylon and cable to the turbine base. A 1.8 m person figure (9 mm) with the label `Person 1.8 m` in Loads/Tower view.
- Two low-poly clouds hanging on thin wires above the bench. They darken in storms.
- Back wall: two framed "blueprint" screens (like the Nozzle Lab monitors). One shows a live **stream-tube diagram**, the other a **Cp–λ** mini plot. They're rendered to CanvasTextures at 5 Hz.
- An amber rotating warning beacon on the fan housing, active in SHUTDOWN/PARKED/TRIP.
- A red aviation light on the nacelle roof blinking at 1 Hz (always on, as real turbines have).

### 4.2 Lighting
- Key: a warm directional (#ffd9a8, 2.2) from front-left above, shadows PCFSoft 2048², bias −0.0005, shadow camera fitted to the bench.
- Fill: a cool hemisphere (sky #6f8cff, ground #1a1410, 0.35).
- Rim: a cyan spot from behind the turbine (#4cc9ff, 1.4) for silhouettes.
- Practical lights: the fan ring emissive, house windows emissive (bloom), the beacon spot.
- Environment: `RoomEnvironment` through PMREM for reflections, intensity 0.25.
- Storm: key intensity × 0.35, fill hue shifts to #3a4a8a, a lightning flash every 6–14 s (a 60 ms light burst, no thunder when muted).

### 4.3 Materials
- Turbine: off-white satin `MeshStandardMaterial` (#e9edf2, roughness 0.45, metalness 0.1). Blade tips have a thin red band (ICAO marking look).
- Nacelle internals: steel (#8d96a3, metal 0.8, rough 0.35), gears brass (#c9a45c), generator copper windings emissive amber ∝ power, brake disc emissive red ∝ braking heat.
- Diorama: `flatShading: true`, greens #4c9a5a / #3b7d48, rock #9aa0a6, houses warm white with colored roofs.
- Cut caps (cutaway): dark hatched material with an **amber edge line** (like the Raptor cutaway).

### 4.4 Post-processing
`RenderPass → UnrealBloomPass(strength 0.55, radius 0.42, threshold 0.82) → SMAA → OutputPass`. Tone mapping ACESFilmic (or AgX if it looks better; decide once and lock it), exposure 1.0, `outputColorSpace = SRGBColorSpace`. Emissives that should bloom use intensities > 1.

### 4.5 Camera
- `PerspectiveCamera` fov 35, near 0.01, far 60.
- `OrbitControls` with damping 0.08. Polar angle 20°–88°; distance 0.6–5 (scene units, meters at model scale). Pan limited to a box around the bench.
- Idle drift: after 8 s without input, a slow ±4° azimuth sine (period 40 s). Stop instantly on input.
- Default: position (1.55, 0.62, 1.35), target (0, 0.28, 0), with the turbine base at the origin.

### 4.6 Motion rules
- Every discrete change animates. UI 200–300 ms `--ease-out`; 3D transitions 0.8–1.2 s easeInOutCubic.
- Physics-driven motion (rotor, pitch, fan) is **never** eased artificially; it follows the sim.
- `prefers-reduced-motion`: disable idle drift, the lightning flash and camera flights (cut instead), halve particle counts.

---

## 5. 3D model (procedural, full-scale meters, then `group.scale = 1/200`)

### 5.1 Turbine dimensions (NREL 5 MW reference turbine)

| Item | Value |
|---|---|
| Rotor diameter / radius | 126 m / 63 m |
| Hub radius | 1.5 m |
| Hub height | 90 m |
| Tower height | 87.6 m; base Ø 6.0 m, top Ø 3.87 m (linear taper) |
| Shaft tilt / precone | 5° / 2.5° |
| Overhang (hub center ahead of tower axis) | 5.0 m |
| Nacelle box (visual) | 18 × 6 × 6 m (L × W × H), rounded edges |
| Blade length | 61.5 m |
| Gearbox ratio | 97 : 1 |
| Rated rotor / generator speed | 12.1 rpm / 1,173.7 rpm |
| Masses (for labels) | rotor 110 t, nacelle 240 t, tower 347 t |

### 5.2 Blade geometry (loft)
Use the 17 NREL stations (6.1: r, chord, twist, family). Cross-section per station:
- `CYL1/CYL2`: circle of diameter = chord.
- Others: a NACA-4-digit-style symmetric thickness profile with thickness ratio DU40 0.40, DU35 0.35, DU30 0.30, DU25 0.25, DU21 0.21, NACA64 0.18, plus ~3 % camber for DU/NACA sections so they read as airfoils.
- 48 points per section, cosine spacing. Loft stations with Catmull-Rom interpolation (40 spanwise rings) into one `BufferGeometry` with computed normals.
- The pitch axis sits at 25 % chord (station origin). Twist rotates about the pitch axis. Add a rounded tip cap and a root flange ring.
- **Pitch** rotates the whole blade about its span axis (local Y). Twist is baked into the geometry.
- **Flap bending** (Loads): vertex shader offset along the rotor axis `Δx(r) = δ_tip · (r/R)^2`, uniform `uTipDeflection` (meters, full scale).

### 5.3 Hub and spinner
- Spinner: `LatheGeometry` nose cone, 3 cutouts where blades pass through.
- Inside (cutaway): 3 pitch bearings (`TorusGeometry` rings), 3 pitch motors plus gearboxes (small cylinders) and a hub casting. Teeth on the bearing ring rotate visibly with pitch.

### 5.4 Nacelle internals, front to back

| # | Component | Geometry | Animation | Label |
|---|---|---|---|---|
| 1 | Main bearing + housing | torus + box | — | — |
| 2 | Main shaft (LSS) | cylinder Ø 1.0 × 5 m | rotates at ω | rpm, torque |
| 3 | Gearbox stage 1: planetary | ring (99 teeth), 3 planets (39), sun (21), carrier | carrier = ω; sun = ω·(1 + 99/21) = 5.714ω; planets spin about their own axes | ratio |
| 4 | Gearbox stage 2: parallel | gear pair 83 : 22 (×3.773) | | |
| 5 | Gearbox stage 3: parallel | gear pair 72 : 16 (×4.5), total 97.0 : 1 | | |
| 6 | HSS + brake disc + caliper | disc Ø 1.2 m | disc emissive red ∝ brake energy | brake state |
| 7 | Flexible coupling | short torus stack | | |
| 8 | Generator (DFIG) | cylinder Ø 2 × 3 m, fins, copper windings | windings emissive ∝ P | rpm, MW |
| 9 | Converter cabinet | box with vents | LEDs | 690 V |
| 10 | Transformer (tower base cabinet) | box | | 690 V → 33 kV |
| 11 | Yaw bearing + 4 yaw drives | torus + 4 cylinders | idle | facing the wind |
| 12 | Bedplate | extruded profile | | |
| 13 | Cooling radiator (roof rear) | box with slats | | |
| 14 | Anemometer + wind vane (roof) | 3 cups + vane | cups spin ∝ V | m/s |
| 15 | Aviation light | small sphere | blinks 1 Hz | |
| 16 | Service crane | thin arm | | |

Gears: build teeth with `ExtrudeGeometry` from a 2D involute-ish gear shape (trapezoid teeth are fine at this scale). Use `InstancedMesh` for bolts.

**Visual speed cap:** the true HSS speed (19.6 rev/s) would strobe. Visually rotate each shaft at `min(true, 2.5 rev/s)`. Above the cap, cross-fade a radial motion-blur disc (a transparent texture) over the part. Labels always show the true rpm.

### 5.5 Tower
A tapered cylinder with 30 height segments (for bending), 3 flange rings and a door. It sits on a foundation on the diorama hill. Loads bending is a vertex-shader cantilever shape (6.8).

### 5.6 Scale and units
- Scene unit = 1 m at model scale. Turbine group `scale = 1/200` → hub at 0.45, rotor Ø 0.63.
- Physics works in full-scale SI. **Never mix:** convert only in `scene/units.ts` (`toModel(m) = m / 200`).

---

## 6. Physics model

Everything lives in `src/physics` as pure TypeScript: no three.js imports, deterministic and unit-tested.

### 6.1 Constants

| Symbol | Value | Meaning |
|---|---|---|
| ρ | 1.225 kg/m³ | air density (sea level, 15 °C) |
| R, R_hub | 63 m, 1.5 m | rotor and hub radius |
| B | 3 | blades |
| A | π R² = 12,469 m² | swept area |
| η | 0.944 | generator + converter efficiency |
| P_rated | 5.0 MW | electrical |
| N | 97 | gearbox ratio |
| ω_rated | 12.1 rpm = 1.2671 rad/s | rotor |
| J | 43.784 × 10⁶ kg·m² | drivetrain inertia on the rotor shaft |
| V_in / V_out / V_restart | 3 / 25 / 20 m/s | cut-in / cut-out / restart |

Blade stations (NREL 5 MW, Jonkman 2009 Table 2-1):

| i | r (m) | Δr (m) | twist (°) | chord (m) | family |
|---|---|---|---|---|---|
| 1 | 2.8667 | 2.7333 | 13.308 | 3.542 | CYL1 |
| 2 | 5.6000 | 2.7333 | 13.308 | 3.854 | CYL1 |
| 3 | 8.3333 | 2.7333 | 13.308 | 4.167 | CYL2 |
| 4 | 11.7500 | 4.1 | 13.308 | 4.557 | DU40 |
| 5 | 15.8500 | 4.1 | 11.480 | 4.652 | DU35 |
| 6 | 19.9500 | 4.1 | 10.162 | 4.458 | DU35 |
| 7 | 24.0500 | 4.1 | 9.011 | 4.249 | DU30 |
| 8 | 28.1500 | 4.1 | 7.795 | 4.007 | DU25 |
| 9 | 32.2500 | 4.1 | 6.544 | 3.748 | DU25 |
| 10 | 36.3500 | 4.1 | 5.361 | 3.502 | DU21 |
| 11 | 40.4500 | 4.1 | 4.188 | 3.256 | DU21 |
| 12 | 44.5500 | 4.1 | 3.125 | 3.010 | NACA64 |
| 13 | 48.6500 | 4.1 | 2.319 | 2.764 | NACA64 |
| 14 | 52.7500 | 4.1 | 1.526 | 2.518 | NACA64 |
| 15 | 56.1667 | 2.7333 | 0.863 | 2.313 | NACA64 |
| 16 | 58.9000 | 2.7333 | 0.370 | 2.086 | NACA64 |
| 17 | 61.6333 | 2.7333 | 0.106 | 1.419 | NACA64 |

### 6.2 Airfoil polars (simplified, tuned so the rotor matches NREL within ~2 %)

| Family | cl₀ | dcl/dα (1/°) | α_stall (°) | cd₀ | k_d |
|---|---|---|---|---|---|
| CYL1 | cl = 0, cd = 0.50 | | | | |
| CYL2 | cl = 0, cd = 0.35 | | | | |
| DU40 | 0.20 | 0.090 | 11.0 | 0.030 | 0.020 |
| DU35 | 0.25 | 0.095 | 11.0 | 0.018 | 0.015 |
| DU30 | 0.30 | 0.100 | 10.5 | 0.012 | 0.012 |
| DU25 | 0.45 | 0.105 | 10.0 | 0.009 | 0.010 |
| DU21 | 0.45 | 0.105 | 10.0 | 0.008 | 0.010 |
| NACA64 | 0.50 | 0.108 | 10.0 | 0.006 | 0.008 |

- Attached range `−(α_s + 4°) ≤ α ≤ α_s`: `cl = cl₀ + s·α`, `cd = cd₀ + k_d·(α/10)²`.
- Outside that range: **Viterna–Corrigan** extrapolation from the stall point on that side, with CD90 = 1.8. Mirror the sign for negative α. Beyond |α| > 90°: flat plate `cl = −0.9·sin 2α`, `cd = 1.8·sin²α`. `cd ≥ cd₀` always.
- The exact function is `polar()` in the reference script. Port it line by line.

### 6.3 Steady BEM (per blade element)
For wind V, rotor speed ω, collective pitch β:
1. `θ = twist + β`, `σ = B·c / (2π r)`. Start `a = 0.3`, `a' = 0`.
2. Iterate ≤ 200 times:
   - `φ = atan2(V(1−a), ωr(1+a'))`, `α = φ − θ` → `cl, cd`
   - `cn = cl cosφ + cd sinφ`, `ct = cl sinφ − cd cosφ`
   - Prandtl tip × hub loss `F`, floored at 1e-4
   - Local `C_T = σ(1−a)² cn / sin²φ`
   - If `C_T ≤ 0.96 F`: `a_new = 1 / (1 + 4F sin²φ / (σ cn))`; else Buhl: `a_new = (18F − 20 − 3√(C_T(50 − 36F) + 12F(3F − 4))) / (36F − 50)`
   - `a'_new = 1 / (4F sinφ cosφ / (σ ct) − 1)`
   - Clamp `a ∈ [−0.5, 0.95]`, `a' ∈ [−0.5, 1]`. Converge at |Δ| < 1e-6, else relax `x ← 0.7x + 0.3x_new`.
3. Element loads: `dT = ½ρW²c·cn`, `dQ = ½ρW²c·ct·r`, where `W² = (V(1−a))² + (ωr(1+a'))²`.
4. Rotor: `T = B Σ dT Δr`, `Q = B Σ dQ Δr`, `Cp = Qω / (½ρAV³)`, `Ct = T / (½ρAV²)`.

### 6.4 Cp / Ct tables
- Precompute at **build time** (`npm run tables` → `src/physics/tables.generated.json`, about 150 KB). Use the TS BEM with V = 10 m/s, λ ∈ [0, 20] step 0.25 (81 values) and β ∈ [−2°, 90°] step 1° (93 values). The reference script writes an identical `tables.json` to diff against.
- Runtime: bilinear lookup `Cp(λ, β)`, `Ct(λ, β)`, clamped to the grid. The live per-element BEM runs only for the **Along the blade** chart (17 elements, ≤ 10 Hz).

### 6.5 Actuator disk and Betz (ideal disk mode and smoke lines)
- Wake speed ratio `b = V_wake/V = 1 − 2a`. `Cp_ideal = 4a(1−a)² = ½(1+b)(1−b²)`, max **16/27 = 0.5926** at a = 1/3 (b = 1/3). `Ct_ideal = 4a(1−a)`.
- Real rotor → disk-averaged induction from Ct: `a = (1 − √(1 − Ct))/2` for Ct ≤ 0.96; else invert Buhl's `Ct = 8/9 + (4F − 40/9)a + (50/9 − 4F)a²` with F = 1.
- Axial velocity along the axis (vortex-cylinder solution): `u(x) = V[1 − a(1 + x/√(x² + R²))]`, with x = 0 at the rotor and positive downstream. u(−∞) = V, u(0) = V(1−a), u(+∞) = V(1−2a).
- Stream-tube radius (mass conservation): `r_tube(x) = R √((1−a) V / u(x))` → far wake `R√((1−a)/(1−2a))`, which is 1.41 R at a = 1/3.
- Streamline of seed radius r∞: inside the tube, `r(x) = r∞ √(V/u(x))`; outside, preserve annulus area: `r(x)² = r∞² + r_tube(x)² − R²(1−a)`.
- Clamp `a ≤ 0.45` for visuals only. Beyond that, momentum theory breaks down, so show the text "turbulent wake state" and add noise to the lines.
- Tip-vortex helices: 3 helices of radius `r_tube(x)`, convection speed `(u(0) + u(∞))/2`, axial pitch per turn `p = u_conv · 2π / ω`. They rotate with the rotor azimuth.

### 6.6 Drivetrain
`J dω/dt = Q_aero − N·Q_gen − Q_brake`, where `Q_aero = Cp(λ, β)·½ρAV³ / ω` (guard ω ≥ 1e-3) and `λ = ωR/V`.
Rotor azimuth `ψ += ω dt` drives the blade rotation (no easing). Clamp ω ≥ 0.

### 6.7 Controllers (NREL baseline, simplified)

Generator torque on the HSS, ω_g = Nω:
- `K_opt = ½ρπR⁵ Cp_max / λ_opt³` (rotor shaft) → `K_HSS = K_opt / N³` = 2.2007 N·m/(rad/s)² = 0.02413 N·m/rpm²
- `VS_RT = 0.99 ω_g,rated`, `VS_SY = VS_RT / 1.10`, `SLOPE25 = (P_rated/η / VS_RT) / (VS_RT − VS_SY)`
- `VS_TR` = the lower root of `K_HSS ω² = SLOPE25(ω − VS_SY)` → 1,131.3 rpm
- Region 3 if `β ≥ 1°` or `ω_g ≥ VS_RT`: `Q_gen = P_rated / (η ω_g)`
- Region 2.5 if `ω_g ≥ VS_TR`: `Q_gen = SLOPE25 (ω_g − VS_SY)`
- Region 2: `Q_gen = K_HSS ω_g²`
- `Q_gen = 0` outside RUN.

Pitch, a gain-scheduled PI on generator speed error `e = ω_g − ω_g,rated` (rad/s):
- `GK(β) = 1 / (1 + β/6.302336°)`, `K_P = 0.01882681 s`, `K_I = 0.008068634`
- `I ← clamp(I + e·dt, 0, rad(90°)/(K_I·GK))`; `β_cmd = deg(GK·(K_P e + K_I I))`, clamped to [0°, 90°]
- Rate limits: RUN 8°/s, SHUTDOWN/PARKED 4°/s, STARTUP 2°/s, TRIP 8°/s.
- Pitch = Locked: `β_cmd = β_locked` (the torque controller still runs).

### 6.8 Loads and derived values
- Thrust `T = Ct(λ, β)·½ρAV²`. Signed: show negative values as "reverse" in the label and flip the arrow.
- Tower top deflection, cantilever: `δ_top = T L³ / (3 EI_eff)`, L = 87.6 m, EI_eff = 3.6 × 10¹¹ N·m² → **0.45 m at rated**. Shape `δ(z) = δ_top · (z/L)²(3 − z/L)/2`. Visual exaggeration ×25 in Loads.
- Tower base overturning moment `M = T · 90 m` (65 MN·m at rated).
- Blade tip flap deflection `δ_tip = 5.4 m · T / 725 kN` (visual ×2 in Loads).
- Tip speed `ωR`; blade-pass frequency `3ω/2π` (0.605 Hz at rated); LSS torque `Q_gen·N`; HSS torque `Q_gen` (43.1 kN·m at rated).
- Air mass flow `ṁ = ρ A V (1 − a)`: ≈ 90 t/s at 8 m/s, ≈ 133 t/s at rated.
- Homes powered right now: `P / 0.4 kW` (average EU household use, ≈ 3.5 MWh/yr). Footnote it in help.
- Runaway what-if (text only): free-spin λ at β = 0 is **16.7** → rpm = 16.7 V / R · 30/π; tip Mach = 16.7 V / 343.
- Locked-flat parked thrust at the current V: `Ct(0, 0) · ½ρAV²`, used by the PARKED text for contrast.

### 6.9 Supervisor state machine

```
            V ≥ 25 (held 3 s sim)             ω < 0.01
   RUN ──────────────────────────▶ SHUTDOWN ─────────▶ PARKED
    ▲  \  ω > 1.15 ω_rated                                 │ V < 20 (held 10 s sim)
    │   └──────────▶ TRIP ──(ω < 0.01)──▶ TRIPPED          ▼
    │                             (latched; Reset → STARTUP if V < 25)
    └──────────── ω ≥ 0.9 ω_rated ◀──────────── STARTUP ◀──┘
```
- The real cut-out uses a 10-minute mean; the demo uses a 3 s hold, and restart a 10 s hold below 20 m/s. Note this in help.
- Brake: engaged in TRIP/TRIPPED, and in SHUTDOWN/PARKED when ω < 0.3 ω_rated. `Q_brake = 28,116.2 × 97 N·m` on the rotor shaft. Brake heat `E += Q_brake·ω·dt`, decaying τ = 20 s → disc glow.
- CALM sub-state: RUN with V < 3 → Q_gen = 0, the rotor idles at whatever speed the aero torque sustains.
- Regime label for UI text: CALM / CHASE (region 2) / CAP (2.5) / SPILL (3) / SHUTDOWN / PARKED / STARTUP / TRIP / BETZ.

### 6.10 Wind and gusts
- Mean wind `V̄` from the slider. Preset changes ramp V̄ at ≤ 2 m/s per sim second so storms build visibly.
- Gusts (toggle G): `V = V̄ (1 + TI·n(t))`, TI = 0.12, where `n(t)` = normalized sum of 4 sines with periods 3.1, 7.3, 13.1 and 29.7 s and random phases (std ≈ 1). The anemometer label shows the instantaneous V; the WIND card shows V̄ with a small `±gust` badge.

### 6.11 Simulation loop
- Fixed step `dt = 1/120 s` of sim time; `simTime += realDelta × timeScale`, at most 40 sub-steps per frame (drop the backlog beyond that).
- On load and after instant jumps (tour steps, URL state), **initialize at the steady operating point** by interpolating the schedule. Never start from ω = 0 at high wind, or the rotor overshoots and trips.
- Pause (Space) freezes the sim; the camera and UI stay live.

---

## 7. Reference numbers and test vectors

All values come from `reference/wind_model_reference.py`. The TS port must match: Cp/Ct within ±0.002, pitch within ±0.1°, rpm ±0.02, power ±0.01 MW, thrust ±3 kN.

### 7.1 Optimum
- Cp_max = **0.4709** at λ_opt = **7.65** (79.5 % of Betz)
- K_opt = 2.0085 × 10⁶ N·m·s² (rotor shaft)
- V_rated = **11.42 m/s** (NREL: 11.4)

### 7.2 Steady schedule

| V (m/s) | rpm | pitch (°) | TSR | Cp | Ct | P (MW) | Q (MN·m) | T (kN) |
|---|---|---|---|---|---|---|---|---|
| 3 | 3.48 | 0.00 | 7.65 | 0.471 | 0.779 | 0.09 | 0.27 | 54 |
| 5 | 5.80 | 0.00 | 7.65 | 0.471 | 0.779 | 0.42 | 0.74 | 149 |
| 6 | 6.96 | 0.00 | 7.65 | 0.471 | 0.779 | 0.73 | 1.07 | 214 |
| 8 | 9.28 | 0.00 | 7.65 | 0.471 | 0.779 | 1.74 | 1.90 | 381 |
| 10 | 11.60 | 0.00 | 7.65 | 0.471 | 0.779 | 3.40 | 2.96 | 595 |
| 11 | 12.10 | 0.00 | 7.26 | 0.469 | 0.751 | 4.50 | 3.77 | 694 |
| 11.42 | 12.10 | 0.05 | 6.99 | 0.466 | 0.728 | 5.00 | 4.18 | 725 |
| 12 | 12.10 | 3.51 | 6.65 | 0.401 | 0.544 | 5.00 | 4.18 | 598 |
| 13 | 12.10 | 6.39 | 6.14 | 0.316 | 0.397 | 5.00 | 4.18 | 513 |
| 15 | 12.10 | 10.35 | 5.32 | 0.205 | 0.246 | 5.00 | 4.18 | 422 |
| 18 | 12.10 | 14.90 | 4.43 | 0.119 | 0.141 | 5.00 | 4.18 | 348 |
| 20 | 12.10 | 17.48 | 3.99 | 0.087 | 0.104 | 5.00 | 4.18 | 317 |
| 25 | 12.10 | 23.19 | 3.19 | 0.044 | 0.056 | 5.00 | 4.18 | 269 |

The pitch schedule is close to the published NREL 5 MW values (≈ 3.8° at 12 m/s, 10.5° at 15, 17.5° at 20, 23.5° at 25).

### 7.3 BEM test vectors: `rotor(V = 10, λ, β)`

| λ | β (°) | Cp | Ct |
|---|---|---|---|
| 4.00 | 0 | 0.2167 | 0.3290 |
| 7.65 | 0 | 0.4709 | 0.7788 |
| 10.00 | 0 | 0.4286 | 0.9203 |
| 6.00 | 5 | 0.3513 | 0.4522 |
| 5.00 | 15 | 0.0837 | 0.1056 |
| 4.00 | 25 | −0.0745 | −0.0557 |
| 3.00 | 35 | −0.0984 | −0.0812 |
| 7.00 | 90 | −5.3105 | 0.0723 |

### 7.4 Spanwise angle of attack (stations 4–17, degrees)

| Case | α |
|---|---|
| 8 m/s, β 0° | 16.2 9.5 7.5 5.8 4.3 4.0 3.9 4.0 3.9 4.0 4.1 4.2 4.1 4.0 |
| 11.42 m/s, β 0° | 19.3 11.9 9.0 7.1 5.6 5.2 5.0 5.0 4.9 4.9 5.0 5.0 4.9 4.7 |
| 20 m/s, β 17.48° | 19.1 12.2 8.0 4.9 2.5 1.0 −0.1 −0.9 −1.6 −2.2 −2.7 −2.9 −3.1 −3.5 |

### 7.5 Dynamic scenarios (dt = 0.02 s)
**Storm ramp** (12 → 30 m/s over t = 20…80 s, hold, then 15 m/s at t = 180 s):

| t (s) | V | rpm | pitch | P (MW) | T (kN) | state |
|---|---|---|---|---|---|---|
| 20 | 12 | 12.10 | 3.49 | 5.00 | 599 | RUN |
| 40 | 18 | 12.55 | 14.53 | 5.00 | 352 | RUN |
| 60 | 24 | 12.61 | 21.46 | 5.00 | 279 | RUN |
| 70 | 27 | 6.40 | 49.19 | 0.00 | −67 | SHUTDOWN |
| 90 | 30 | 0.00 | 90.00 | 0.00 | 28 | PARKED |
| 200 | 15 | 2.65 | 49.96 | 0.00 | 25 | STARTUP |
| 220 | 15 | 10.98 | 7.09 | 5.00 | 593 | RUN |
| 250 | 15 | 12.10 | 10.35 | 5.00 | 422 | RUN |

(The reference sim switches to SHUTDOWN instantly at 25 m/s; the app adds the 3 s hold, so allow ±5 s timing differences.)

**Pitch locked at 0° (test harness passes `pitchLockDeg = 0`), wind jump 12 → 22 m/s at t = 10 s:** the rpm crosses 13.9 (115 %) → TRIP between t = 10 and 12 s. Peak ≈ 17.6 rpm, then the rotor stops by t ≈ 22 s → TRIPPED. (In the app, Locked freezes the *current* angle; the test uses 0° explicitly.)

### 7.6 Other quotable numbers
- Power in the wind at 8 m/s: 3.91 MW → Betz max 2.32 → rotor 1.84 → electric 1.74 MW
- At 20 m/s the wind carries 61 MW; the turbine keeps 5 MW (8 %).
- Parked, feathered rotor thrust: 19 kN at 25 m/s, 28 kN at 30, 37 kN at 35. Braked with blades flat (β = 0): 357 / 515 / 701 kN.
- Runaway at 25 m/s: 63 rpm, tips 418 m/s = Mach 1.22.
- Tip speed at rated: 79.8 m/s (287 km/h). Rotor Ø 126 m is wider than an A380 wingspan (≈ 80 m).

---

## 8. Views: Whole / Cutaway / Exploded

| View | Nacelle shell | Hub/spinner | Internals | Tower | Transition |
|---|---|---|---|---|---|
| Whole | opaque | opaque | hidden (not rendered) | solid | — |
| Cutaway | clipped by the vertical plane through the shaft axis (the half facing the camera is removed) | clipped | visible | top 12 m clipped | clipping-plane constant animates 0.9 s |
| Exploded | lifts +4 m, opacity 0.15 | moves +6 m forward along the shaft with the rotor | components spread along the shaft axis with staggered 60 ms delays | solid | 1.1 s easeInOutCubic |

- Cutaway caps: stencil-buffer capping (three.js clipping-stencil pattern), dark hatched fill and an amber 2 px edge. The clipping plane follows the camera side: pick the plane normal facing the camera, re-evaluated only when the view is entered.
- Exploded guide lines: `LineDashedMaterial` from home to current position, fading in.
- Rotor keeps spinning and gears keep animating in all views.
- Blades don't clip.

## 9. Follow modes: All / Wind / Power / Loads

Each mesh gets a `system` tag: `wind | power | loads | structure | environment`. A shared uniform `uDim` (0–1) is injected via `onBeforeCompile` into all turbine and environment materials. Dimmed meshes desaturate toward luminance and multiply by 0.35. Follow transitions animate `uDim` over 400 ms.

| Mode | Emphasized | Extras |
|---|---|---|
| All | everything | smoke lines at 60 % intensity, key labels |
| Wind | smoke, stream tube, tip vortices, anemometer | stream-tube outline (violet dashed), speed labels, speed-colored smoke (cyan V → violet 0.5V) |
| Power | blades, shafts, gearbox, generator, cable, village | amber pulses along the power path (count and speed ∝ P), village windows lit ∝ P/5 MW, torque labels |
| Loads | tower, blades, hub | thrust arrow (coral, length ∝ T, 1 cm per 20 kN at model scale), tower bend ×25, blade flap ×2, stress color ramp on the tower (∝ M(z)/section modulus), person figure for scale |

**Smoke lines implementation:** 14 rake seeds (2 rings at r∞ = 0.35R and 0.75R with 6 per ring, plus 2 outside at 1.2R), each a camera-facing ribbon of 180 segments from x = −2.5R to +5R. Vertex positions are computed **in the vertex shader** from uniforms `uA`, `uR`, `uV` (6.5). A dash pattern scrolls with a per-vertex precomputed travel-time attribute `tau(x) = ∫dx/u(x)`, recomputed on the CPU when `a` changes by > 0.005 (180 samples × 14 lines). Add slight turbulence noise downstream, scaled by the gust level and by storm intensity.

## 10. Betz disk mode (the "wow")
1. Toggle B: blades scale their opacity to 0 over 500 ms, and an emissive violet disk (R = 63 m, thin cylinder, fresnel edge) fades in.
2. The wind slider row is replaced by a **Wake speed b** slider (0–1, default 1.0, which is "no disk") and a readout `b = 0.33 V`.
3. Smoke lines use `a = (1 − b)/2`. b → 0 shows heavy expansion plus the "turbulent wake state" noise. b → 1 shows straight lines.
4. The chart is forced to the Betz tab; card 3 shows `Cp(b)`.
5. When |b − 1/3| < 0.015: the disk pulses `--ok` once, the chart peak marker rings, and the text gets a highlighted "Betz limit" sentence. A small toast reads "You found the limit: 59.3 %".
6. Leaving the mode restores the real rotor and shows the waterfall row for 6 s.

## 11. Weather and storm FX
A single `stormLevel` s = smoothstep(18, 28, V̄) drives everything:
- Rain: instanced streaks (desktop 4,000, mobile 1,500), slant angle `atan(V/9)`, opacity ∝ s, splash sprites on the bench.
- Clouds: color lerp #d7deea → #3b4257, slight bob; lightning flash if s > 0.8.
- Trees: vertex shader sway, bend angle ∝ min(V², 900)/900 × 18°, plus gust flutter.
- Room: key light × (1 − 0.65s), fog density + 0.4s, exposure −0.15s.
- Fan: blade spin ∝ V̄, hum pitch ∝ V̄; its small LED display reads `08.0 m/s` / `STORM 30.0` in amber.
- Beacon: rotates 1 rev/s in SHUTDOWN/PARKED/TRIP; red in TRIP.
- Screen-space: subtle vignette increase and 1 % film grain when s > 0.5 (post pass, cheap).

## 12. Guided tour (▶ / Enter)
Six steps, 7–10 s each, at time scale ×4. There's a caption bar at the bottom (above the chips) with the step title, one sentence and a progress dots row. Any user input pauses the tour and shows a "Resume" pill.

| # | Camera | State | Caption |
|---|---|---|---|
| 1 | Rotor | 6 m/s, Follow Wind | "The rotor slows the wind. Watch the smoke spread." |
| 2 | Rotor | Ideal disk, animate b 1 → 0 → 1/3 | "How much should it slow the wind? Exactly to a third." |
| 3 | Nacelle | Real, 11.4 m/s, Cutaway, Follow Power | "At 11.4 m/s it makes its full 5 MW." |
| 4 | Blade | 18 m/s, chart Along the blade | "More wind? Twist the blades and let it pass." |
| 5 | Wide | Storm 30, Follow Loads | "Storm: blades edge-on, brake on, thrust nearly gone." |
| 6 | Wide | 9 m/s | "Back to work. Now it's your turn." |

## 13. Audio (off by default, WebAudio, no files)
- Blade whoosh: band-passed noise amplitude-modulated at the blade-pass frequency 3ω/2π, gain ∝ (ωR)².
- Generator hum: sine at `(ω_g/2π)·2` Hz, i.e. 2 pole pairs (≈ 39 Hz at rated), plus a 2nd harmonic. Gain ∝ P.
- Wind/fan: pink noise, low-pass cutoff ∝ V.
- Rain: high-passed noise ∝ s. Thunder: low noise burst 1–3 s after a flash.
- Brake squeal: short resonant tone when the brake engages.
- Master limiter; respect the mute state in the URL.

## 14. Architecture

### 14.1 Stack
- Vite + TypeScript (strict), vanilla DOM (no UI framework), `three` (pin the exact version; use `three/addons/*` imports), Vitest, ESLint + Prettier.
- Fonts: Google Fonts (Outfit 700/800, Inter 400/500/600, JetBrains Mono 400/500) with `display=swap` and preconnect.
- Optional: `vite-plugin-singlefile` build target for a single-HTML version.

### 14.2 File tree
```
wind-turbine-lab/
  index.html
  package.json · tsconfig.json · vite.config.ts · .eslintrc.cjs · .prettierrc
  reference/wind_model_reference.py        # physics source of truth
  scripts/build-tables.ts                  # writes src/physics/tables.generated.json
  public/  favicon.svg · og-image.png
  src/
    main.ts                                # bootstraps everything
    config/  turbine.ts · controller.ts · environment.ts · theme.ts
    physics/ blade.ts · polars.ts · bem.ts · tables.ts · actuatorDisk.ts
             controller.ts · supervisor.ts · drivetrain.ts · loads.ts · wind.ts
             sim.ts · regime.ts · format.ts
             __tests__/ bem.test.ts · schedule.test.ts · controller.test.ts · betz.test.ts
    state/   store.ts · uiState.ts · urlState.ts
    scene/   units.ts · renderer.ts · post.ts · camera.ts · lights.ts · materials.ts
             environment/ room.ts · bench.ts · ruler.ts · fan.ts · smokeRake.ts · diorama.ts · village.ts · clouds.ts · screens.ts
             turbine/ tower.ts · nacelle.ts · hub.ts · bladeGeometry.ts · rotor.ts · drivetrain.ts · gears.ts
             fx/ smokeLines.ts · tipVortices.ts · powerFlow.ts · loadsViz.ts · rain.ts · beacon.ts · lightning.ts · trees.ts
             views.ts · follow.ts · betzDisk.ts · labels.ts · cameraRig.ts
    ui/      styles.css · layout.ts · controlPanel.ts · segmented.ts · slider.ts · statCards.ts
             explainer.ts · templates.ts · charts/ chartBase.ts · powerCurve.ts · cpTsr.ts · alongBlade.ts · betzCurve.ts
             waterfall.ts · chips.ts · help.ts · toast.ts · loader.ts · hotkeys.ts · share.ts
    tour/    tour.ts · steps.ts
    audio/   audio.ts
    util/    math.ts · easing.ts · tween.ts · rafLoop.ts
```

### 14.3 Data flow
```
input (UI/hotkeys/tour/URL) → uiState (store) ─┐
                                               ├→ sim.step(dt) → SimSnapshot (immutable per frame)
wind.ts (V̄ + gusts) ───────────────────────────┘          │
                                                           ├→ scene.update(snapshot, uiState, frameDt)
                                                           ├→ ui.update(snapshot)   (throttled 10 Hz text, 30 Hz charts)
                                                           └→ audio.update(snapshot)
```
- `SimSnapshot`: `{ t, V, Vmean, omega, psi, beta, betaCmd, Qaero, Qgen, Pel, T, cp, ct, lambda, a, state, regime, brakeHeat, stormLevel }`.
- `uiState`: `{ follow, view, rotorMode, pitchLock, weatherPreset, windTarget, wakeB, timeScale, gusts, chart, sound, tourStep, paused }`.
- The store is a tiny observable (`get`, `set(partial)`, `subscribe(selector, cb)`) of about 40 lines, with no dependencies.
- The scene never mutates sim state; the UI never touches three.js objects directly (only via `scene.setX()` APIs).

### 14.4 Frame loop
`rafLoop`: measure `frameDt` (clamped to 0.1 s) → advance the sim by fixed steps → update tweens → scene update → labels projection → composer render → UI throttled update. Pause rendering when `document.hidden`.

## 15. Performance budget
| Metric | Target |
|---|---|
| JS (gzip) | ≤ 350 KB, including three |
| Draw calls | ≤ 180 (Whole), ≤ 260 (Exploded) |
| Triangles | ≤ 600 k |
| Frame time | ≤ 12 ms on an M1 Air / RTX 2060 laptop at 1440p; ≥ 45 fps on an iPhone 13 |
| First frame | ≤ 2.5 s on 4G throttled desktop |

Techniques:
- `InstancedMesh` for bolts, teeth, rain, houses and trees.
- Merge static diorama geometry.
- Shadow map updates only when the camera or view changes, plus the rotor (the rotor is a separate small shadow caster).
- Label occlusion raycasts every 6th frame.
- **Adaptive resolution:** if the rolling 2 s average frame time is > 18 ms, step the pixel ratio 2 → 1.5 → 1.25 → 1 and bloom resolution by half. Recover when < 10 ms.
- Charts redraw only on change. Blueprint screens redraw at 5 Hz.

## 16. Responsive layout and accessibility
- **≥ 1280 px:** as in 3.1. **900–1279 px:** left column 300 px, the chart card collapses to a tab button. **< 900 px (mobile):** the headline shrinks to 36 px; the stat cards form a row of 3 compact tiles; the control panel becomes a bottom sheet (peek height 76 px showing wind slider + presets; drag up for the rest); the explanation panel moves into the sheet; labels are limited to 5; the tour is available.
- Touch: one-finger orbit, two-finger pinch zoom. Slider thumbs are 28 px.
- A11y: all controls are real `<button>` / `<input type="range">` with `aria-pressed` / `aria-valuetext` ("11.4 metres per second, Beaufort 6"). The explanation panel is `aria-live="polite"` (throttled to 1 per 2 s for screen readers). Focus rings are visible. Contrast ≥ 4.5 : 1 for text.
- Canvas: `role="img"` with an `aria-label` summarizing the state.

## 17. URL state, sharing, SEO
- Query params: `v` (wind), `view`, `follow`, `mode` (real|ideal), `b`, `lock`, `t` (time scale), `gusts`, `cam` (chip id). Read on load; write with `history.replaceState`, debounced 500 ms.
- Share button: Web Share API when available, else copy the URL and show the toast "Link copied".
- `<title>`: "Wind Turbine Lab: The 59 % Limit". Meta description, OG and Twitter card with a 1200×630 screenshot (captured manually from the Storm + Cutaway state).
- `noscript` fallback text summarizing the Betz limit with a static image.

## 18. Coding conventions
- **English only**: identifiers, comments, UI strings, commit messages.
- Physics files carry a header comment with the formula and its source (section of this spec plus the reference paper).
- Units in names when ambiguous: `omegaRad`, `rpm`, `pitchDeg`, `thrustN`, `powerW`. SI internally; convert only in `format.ts`.
- No magic numbers in scene code: dimensions live in `config/turbine.ts`, colors in `config/theme.ts` (mirroring the CSS tokens).
- Each module exports `create…()` returning `{ object3d, update(snapshot, ui, dt), dispose() }`.
- No `any`. Strict null checks. Prettier default, 100 column.

## 19. Acceptance criteria
1. `npm test` passes: all section 7 vectors are within tolerance, the storm-ramp scenario reaches PARKED with β = 90° and ω = 0, and the pitch-lock scenario trips.
2. Wind slider 0 → 35 → 0 m/s produces monotonic, glitch-free power on the chart dot, with no NaN anywhere (fuzz test: 10,000 random V/β/ω inputs to `tables.lookup` and `sim.step`).
3. Storm preset from Rated: the blades are visibly edge-on within ≈ 30 s sim time at ×1 (≈ 7 s wind ramp, 3 s hold, ≈ 17 s feathering at 4°/s). The beacon is on, the brake disc glows, and the text is the SHUTDOWN then PARKED template.
4. Betz mode: the peak is found by dragging; the toast fires once per entry.
5. Views switch without popping; cut caps are solid (no see-through gaps).
6. 60 fps on the reference laptop in Whole view with Follow = All and Storm.
7. Lighthouse (desktop): Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
8. Every number on screen can be traced to a physics function (code review checklist).
9. All copy and code comments are in English and spell-checked.

## 20. Risks and mitigations
| Risk | Mitigation |
|---|---|
| BEM non-convergence at extreme λ/β | Precompute tables at build time; the runtime only interpolates. Clamp and relax exactly like the reference. |
| Controller oscillation / false trips on preset jumps | Ramp V̄ ≤ 2 m/s², initialize from the schedule, 3 s cut-out hold. |
| Stroboscopic shaft/rotor aliasing | Visual speed cap plus motion-blur discs (5.4). The rotor at 12 rpm is fine. |
| Label clutter | Priority system, max 9, follow-mode filtering. |
| Stencil caps complexity | Fallback: render back faces with a flat cap color (`side: BackSide`, emissive dark) if stencil caps misbehave. |
| Mobile GPU load | Adaptive DPR, halved particles, bloom at half resolution, no shadows from the environment. |
| Physics numbers look "wrong" to experts | Cite the NREL 5 MW reference and publish `reference/` in the repo; help shows assumptions. |

## 21. References
- J. Jonkman, S. Butterfield, W. Musial, G. Scott, *Definition of a 5-MW Reference Wind Turbine for Offshore System Development*, NREL/TP-500-38060, 2009. https://www.nrel.gov/docs/fy09osti/38060.pdf
- M. L. Buhl Jr., *A New Empirical Relationship between Thrust Coefficient and Induction Factor for the Turbulent Windmill State*, NREL/TP-500-36834, 2005. https://www.nrel.gov/docs/fy05osti/36834.pdf
- A. Betz, "Das Maximum der theoretisch möglichen Ausnützung des Windes durch Windmotoren", *Zeitschrift für das gesamte Turbinenwesen*, 1920.
- L. A. Viterna, R. D. Corrigan, *Fixed Pitch Rotor Performance of Large Horizontal Axis Wind Turbines*, NASA, 1982.
- T. Burton, N. Jenkins, D. Sharpe, E. Bossanyi, *Wind Energy Handbook*, Wiley (BEM, Glauert optimum rotor, wake rotation).
- M. O. L. Hansen, *Aerodynamics of Wind Turbines*, Routledge (BEM algorithm, Prandtl tip loss).
