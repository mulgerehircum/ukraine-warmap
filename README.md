# Ukraine War Map

An interactive war-event map of Ukraine built with Vue 3, TypeScript, MapLibre GL JS v5, and Three.js.  
Data source: [VIINA dataset](https://github.com/zhukovsd/russia-ukraine-conflict-map) (daily CSV → static JSON).  
Deployed on Vercel. Data refreshed weekly via GitHub Actions.

![App demo — event feed click, fly-to, article drawer](docs/app-demo.gif)

![Occupation timelapse — Feb 2022 → Jun 2026](docs/occupation.gif)

---

## Features

### Timeline
- Canvas histogram of daily event counts spanning Feb 24 2022 → today
- RAF-based playback at 20 days/second, DPR-aware rendering
- **Zoom lens** — scroll wheel opens a magnified 24%-wide lens over the histogram; drag the dot-grid handle to pan, hover highlights a bar with its date, click seeks to that day
- Hue-shift gradient fill (cyan → deep navy) anchored to bar zone; cell-shading contour on past bars, outline contour on future bars for legibility at low opacity
- Milestone markers (23 key events) with row-staggered dots; active milestone highlights relevant oblasts in amber

### Choropleth timeline (heatmap mode)

![Choropleth timelapse — cumulative strikes by oblast](docs/choropleth.gif)

- Stacked area chart showing Airstrike / Drone / Artillery / Ground event breakdown over time — same zoom lens UX as the main timeline
- **Group filter** — click any legend pill to highlight that group and fade others; drives EventFeed, TypeFilter, and oblast choropleth simultaneously
- Multi-select: compare any combination of groups; empty selection resets all filters
- Oblast choropleth switches from cumulative totals to per-type counts when a group is active (pre-computed per-type breakdown in `oblast-choropleth.json`)

### Event feed
- Left panel, grouped by type, max 5 per group with expand/collapse
- Tabs: All / Strikes / Forces / Other
- OG descriptions fetched via `/api/og` Vercel proxy (CONCURRENCY=5, stale-fetch cancellation)
- Cards: dark glass bg + left color strip + horizontal gradient glow
- Location from VIINA `asciiname` field
- **Village drill-down** — click any settlement dot on the map to filter the feed to all VIINA events at that location across the full dataset (all years); banner shows settlement name + date range; clears with ×

### Milestones
- 23 curated war events; each highlights relevant oblasts on the map
- MilestoneCard with Wikipedia thumbnail (cached per session)
- YouTube embed panel for events with video documentation
- Article drawer for linked sources

### Operation arrows
- 18 authored LineString arrows covering key operations (Kyiv advance/retreat, Mariupol encirclement, Kharkiv/Kherson counteroffensives, Bakhmut, Zaporizhzhia, Avdiivka, Kursk)
- Appear and disappear as the timeline scrubs through their date range
- Glow + shaft + SDF arrowhead layers; color-coded by type (attack / retreat / counteroffensive)
- Hidden in heatmap mode

### 3D layer
- Motherland Monument (Kyiv) — photogrammetry GLB, waving Ukrainian flag shader, cell-shading outline
- City spikes — cylinders at settlement coordinates, height = cumulative strikes, color = dominant event type
- Oblast bars — extruded polygons by event count
- Sun lighting tied to timeline date (`updateSunLight`)

### Live alerts
- Air raid alerts from alerts.in.ua via server-side Vercel proxy (`/api/alerts`)
- 30 s poll interval; pauses when tab hidden; exponential backoff on 429
- Alert count badge; oblast alert overlay on map

### Design system
- Aero glass aesthetic: dark translucent panels, cyan accent (`#4DD7FA`), near-white text
- CSS custom properties throughout (`--aero-glass`, `--aero-accent`, `--aero-border`, etc.)
- Consistent across all UI components

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Vue 3 — Composition API, `<script setup lang="ts">` |
| Map | MapLibre GL JS v5 — satellite tiles, terrain, occupation overlay |
| 3D | Three.js r184 — custom WebGL layer sharing MapLibre's context |
| Build | Vite + vue-tsc + ESLint |
| Hosting | Vercel + `api/og.js` + `api/alerts.js` serverless functions |
| Data refresh | GitHub Actions (`.github/workflows/update-data.yml`, weekly Mon 06:00 UTC) |

---

## Architecture — Feature-Sliced Design

```
src/
  shared/
    data/          milestones.ts, operationArrows.ts, constants/
    lib/map/       initMap, satellite, terrain, timeline, events, oblasts,
                   occupation, daynight, cities, tooltips, eventIcons,
                   threeLayer, landmarks, citySpikes, oblastBars, alerts,
                   arrows, typeTimeline
  widgets/
    map-view/ui/   MapView.vue, TimelineBar.vue, TypeChart.vue, EventFeed.vue,
                   MilestoneCard.vue, MilestoneVideo.vue, WarDayCounter.vue,
                   TypeFilter.vue, CompassSelector.vue, AttributionModal.vue,
                   AlertBadge.vue, ArticleDrawer.vue
```

---

## Map modes

| Mode | Description |
|---|---|
| `satellite` | Default — satellite tiles + event circles/clusters + 3D layer + operation arrows |
| `heatmap` | Oblast choropleth by cumulative event count + stacked area type breakdown |

---

## Event types (VIINA codes)

`S` Airstrike · `D` UAV/Drone · `A` Artillery · `F` Firefight  
`C` Civilian casualties · `V` Armor · `M` Military casualties · `L` Air alert · `O` Other

---

## 3D layer (`src/shared/lib/map/`)

### Coordinate system
The Three.js custom layer shares MapLibre's WebGL context and camera matrix.  
Coordinates follow a **mixed** convention:
- **X, Y** — Mercator [0, 1]
- **Z** — raw metres (MapLibre's matrix pre-scales the Z column by `pixelsPerMeter`)

All Three.js object positions must respect this convention.

### `threeLayer.ts`
- Creates `WebGLRenderer` bound to MapLibre's canvas/context
- Syncs `Camera.projectionMatrix` from MapLibre's MVP matrix each frame (X/Y columns multiplied by `worldSize`)
- Exports `scene`, `meterScale()`, `triggerRepaint()`, `updateSunLight()`

### `landmarks.ts` — Motherland Monument (Kyiv)

**Model:** `public/models/kyiv.glb` — photogrammetry scan cleaned in Blender (artifact cube removed headlessly via `scripts/fix_kyiv_glb.py`).

**Placement:**
- Positioned at Kyiv's Mercator coordinates + terrain elevation
- `rotation.x = π/2` converts GLTF Y-up → scene Z-up
- `rotation.y = π` faces the model south

**Scale formula:**
```
targetH = popScale(pop) * GLTF_M * SC   (in Mercator units)
scale = (xy, xy/SC, xy)   where xy = targetH / modelHeight
```
`GLTF_M = 60 000` · `SC = meterScale(31, 49)` ≈ 3.8 × 10⁻⁸ Mercator/metre.  
The Z scale `xy/SC` converts the model's height axis into scene metres so the monument appears as a prominent landmark spike at country-view zoom levels.

**Waving Ukrainian flag shader** (`ShaderMaterial`):
- Replaces the GLTF material; samples the original photogrammetry texture via `uMap`
- World-space flag projection: `nZ` (0 → 1 from base to top) drives blue/yellow split; `nX` (0 → 1 west → east) drives wave amplitude
- Sine wave: `0.22 * nX * sin(nX * 4π − t * 2.5)` — fixed at the pole end, free at the other
- `smoothstep` boundary (±0.02 band) avoids stripe aliasing
- Blended at 68% over the base texture
- `uTime` uniform updated every frame via `requestAnimationFrame`; `triggerRepaint()` keeps MapLibre repainting

**Cell-shading outline:**
- Second mesh rendered per-monument with `BackSide` and a dark navy `ShaderMaterial`
- Vertices expanded in clip space: `clip.xy += normalize(n.xy) * 0.0012 * clip.w`
- Gives a constant screen-pixel-width outline independent of zoom/distance

**HMR safety:** `import.meta.hot.dispose()` removes groups and cancels the RAF loop so hot-reloads don't accumulate scene objects.

### `citySpikes.ts`
Cylinders at city coordinates, height = cumulative strike count, colour by dominant event type.

### `oblastBars.ts`
Extruded oblast polygons, height = event count. Visible in 3D toggle mode.

---

## Data pipeline

```
npm run build:events [year]    # fetch VIINA CSV → public/data/viina-events-YYYY.json
npm run build:timeline         # rebuild timeline-summary.json
npm run build:choropleth       # rebuild oblast-choropleth.json  (includes per-type S/D/A/F/V/C/M/L per oblast)
npm run build:cities           # rebuild cities layer
npm run build:type-timeline    # rebuild type-timeline.json
```

Model cleanup (one-off):
```
blender --background --python scripts/fix_kyiv_glb.py
```

---

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_MAPTILER_KEY` | `.env` / Vercel dashboard | MapTiler tile API key |
| `ALERTS_TOKEN` | Vercel dashboard only | alerts.in.ua API token — **never use `VITE_` prefix** |

---

## Key gotchas

- `watch(..., { immediate: true })` in TimelineBar caused TDZ — init in `onMounted` instead
- `@wheel.prevent` required on histogram canvas (not `.passive`)
- Oblast feature IDs are auto-generated 0-based (`generateId: true`); index 0 is invalid
- MapLibre's `SpotLight.map` gobo projection doesn't work in the mixed Mercator/metre coordinate space — use `ShaderMaterial` world-space projection instead
- Vite HMR re-executes module-level code; Three.js `scene.add()` at module scope accumulates duplicate groups — always pair with `import.meta.hot.dispose()` cleanup
- Timeline canvas must use `align-self: stretch` (not fixed `height`) to fill the 84px container to the viewport bottom
- Zoom lens gradient must be anchored to bar zone (`PH - barAreaPH → PH`) not full canvas — anchoring to `0 → PH` causes a visible color jump at the bar tips

---

## Alerts integration (`alerts.in.ua`)

- Token is **server-side only** (`ALERTS_TOKEN`, no `VITE_` prefix)
- Client calls `/api/alerts` — never `alerts.in.ua` directly
- Poll interval: 30 s minimum; pause when tab hidden
- Rate limits: 12 req/min (active), 2 req/min (historical) — violations revoke token
- On 429: backoff × 2, cap 5 min; 3 consecutive → stop for session

---

## Live alerts overlay (`api/alerts.js`)

Vercel serverless proxy that forwards the compact IoT endpoint and sets  
`Cache-Control: s-maxage=30, stale-while-revalidate=10` so edge caching absorbs burst traffic.

---

## TODO

### High priority
- **Frontline animation** — occupation polygons (`viina-tess.geojson`) currently render as a static snapshot; wire `updateArrowsDate`-style date filtering so the frontline moves as the timeline scrubs

### Medium priority
- **Derived operation arrows** — diff consecutive occupation snapshots to auto-generate movement vectors; complement the authored arrows with continuous frontline shift indicators
- **Arrow refinement** — improve authored arrow coordinates with higher-precision paths; add Donbas 2022 encirclements, Robotyne, Vuhledar
- **Live event ingestion** — real-time event feed beyond air alerts; VIINA updates weekly but a near-real-time layer for confirmed events would make the "Today" end of the timeline live

### Low priority / out of scope for now
- Exportable clip / embed mode for journalists
- Comparison mode (two date ranges side by side)

### Done
- Story mode — `StoryMode.vue`, guided milestone auto-play with camera moves and EventFeed sync
- Location drill-down — click any settlement to filter EventFeed to all events at that location
- Mobile layout — two-row timeline grid, safe-area insets, iOS viewport handling
