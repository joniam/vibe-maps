# Vibe Maps — Core Flows Spec

Reference spec for how the core features should behave, calibrated against Google Maps (the gold standard) and translated to what's achievable in a single-file vanilla-JS PWA on top of Mapbox GL JS + Mapbox APIs.

The purpose of this doc is to be **buildable**: every behavior described here should be implementable with the APIs already listed in `CLAUDE.md` (Search Box, Directions, Isochrone, Geocoding, Incidents).

---

## Guiding principles (from Google Maps)

Things Google Maps gets right that we want to borrow:

1. **The map is the canvas, always.** Every UI surface is a sheet, capsule, or chip *layered over* a map that keeps its state (center, zoom, bearing, pitch). UI never replaces the map; it occludes it partially. The map is never unmounted.
2. **One focused entity at a time.** At any moment there is zero or one "focused entity" on the map — a place, a route, an isochrone, a point of interest. The bottom sheet reflects that entity. Switching focus replaces what's in the sheet; it doesn't stack sheets.
3. **Results persist; UI dismisses.** When you close a sheet, the *result* (route line, polygon, pin) stays on the map by default. You explicitly "Clear" to remove overlays. This is already partially fixed in b3 and is the right pattern — enshrine it.
4. **Progressive disclosure via sheet states.** A sheet has at least two heights: *peek* (summary line, handle visible) and *expanded* (full detail). Some sheets have a third *full-screen* state (directions step list). The user can drag between states.
5. **Every entry point is reversible.** There is always a clear way back: back arrow, X in the sheet, or tap the map behind. The current state of the app is predictable from URL/hash fragments where possible, so refresh doesn't lose context.
6. **Speed > completeness.** Results should appear as-you-type with skeletons; never block on a full response when a partial one gets the user moving.

---

## Information model

To build this coherently, we need a small explicit state model. Suggested globals:

```js
AppState = {
  mode: 'idle' | 'search' | 'place' | 'directions' | 'isochrone' | 'layers',
  focus: null | {
    kind: 'place' | 'route' | 'isochrone' | 'incident',
    data: {...},       // the payload (place object, route geometry, etc.)
    renderedLayers: [] // Mapbox layer IDs currently drawn for this focus
  },
  sheet: {
    visible: bool,
    height: 'peek' | 'half' | 'expanded',
  },
  lastQuery: string,     // for restoring search
  recents: [],           // session-only list of places opened/searched
}
```

Every transition between modes is a single function (`goTo('directions', payload)`) that: (a) tears down the previous mode's sheet DOM, (b) decides whether to keep or clear the previous focus's layers, (c) renders the new sheet, (d) optionally animates the map. This is the single most important refactor — today, multiple features seem to step on each other because there's no owner of `mode`.

---

## Bottom sheet model

All feature UIs (place detail, directions, isochrone, incident detail, layers) are **bottom sheets** with a consistent contract.

- **Heights:** `peek` (≈ 96–120px, just a title line + one CTA), `half` (≈ 50% viewport), `expanded` (≈ 90% viewport, leaves ~10% of the map visible at top).
- **Drag:** handle at top is draggable between heights. Swipe down from `peek` dismisses. Swipe up from `peek` → `half` → `expanded`. If a sheet only has one height, **omit the drag handle** (per b3 fix — don't suggest drag we don't support).
- **Scrim:** no full-screen scrim. The map behind stays tappable even when the sheet is expanded (tapping the exposed map area collapses the sheet back to `half`, then to `peek`, then dismisses).
- **Close affordances:** every sheet has an explicit close button (`✕`) in the top-right of the sheet header. Close = dismiss sheet, keep focus result on map (see Principle 3). A separate "Clear" button removes the focus result.
- **Top of sheet = identity.** First line is always *what this sheet is about* (place name, route summary "25 min · 12 km", etc.). Don't make the user scroll to figure out which sheet they're in.

---

## Flow 1 — Map idle / exploration

### What the user sees
- Full-bleed map, Vibe Maps wordmark top-right, recenter/geolocate button top-right (below wordmark, respecting safe-area), tool rail (Directions, Isochrone, Incidents, Layers — no Search per b3), persistent search capsule top-center, vibe indicator somewhere.
- No sheet visible.

### Interactions

- **Pan / zoom / rotate / pitch:** standard Mapbox gestures. Position is persisted to localStorage on `moveend` (already built).
- **Tap an empty part of the map:** reverse-geocode the tapped point (Geocoding v5 `mapbox.places`), drop a temporary pin, and open a *lightweight place sheet* at `peek` height: coordinates + nearest address + "Directions" CTA + "Save" (session-only). Tapping elsewhere or the sheet's ✕ dismisses the pin + sheet.
- **Tap a Mapbox Standard POI (labels rendered by the basemap):** Mapbox Standard emits a `click` event with the POI feature — use it. Drop a pin, open the same place sheet, but with POI name + category + if available, phone/address. No extra network call needed if the basemap already includes the metadata; otherwise retrieve by `mapbox_id` via Search Box `retrieve`.
- **Long-press on map:** same as tap-empty but always forces a dropped pin regardless of whether there's a Mapbox POI nearby.
- **Recenter button:** re-center on user location. If permissions not granted, prompt. If already centered and user is at the location, a second tap switches to *heading-up* rotation (optional V2).

### State transitions out
- Any tap that selects a place → **Flow 3 (Place detail)**.
- Tap search capsule → **Flow 2 (Search)**.
- Tap tool rail item → that feature's flow.

---

## Flow 2 — Search (end-to-end)

This is the flow the user will hit most. Google Maps polishes it heavily; we should match the basics.

### Entry
- Tap the persistent search capsule at top of map. The capsule expands into a full-width search bar, and the UI enters `mode: 'search'`.

### On entry
- **Tool rail hides** (b3 fix; keep this).
- **Keyboard focuses** the input.
- **Recents panel** slides up as a sheet at `half` height showing:
  - Saved places (session-only) — none in V1, but leave the section.
  - Recent searches from `AppState.recents`.
  - Category chips row: *Coffee · Food · Bars · Transit · Parks · Fuel · Shops*. Tapping a chip triggers a category search (see below).
- Cancel button (text "Cancel", top-right of search bar) exits the mode and restores the tool rail.

### As the user types
- Debounce input ~150ms.
- Call Search Box `/suggest` with:
  - `q`=query, `language`=en, `limit`=8, `session_token`=persisted-per-session UUID, `proximity`=map center, `bbox`=viewport bbox (tightens results), `country`=gb (configurable).
- Replace the recents panel content with a **suggestions list**: each row shows icon (category-based), primary name, secondary line (address/context), right-side distance-from-center if available.
- While request in-flight, show a thin progress line (not a skeleton list — flashing rows when you're typing feels janky). Only show the spinner if typing paused and no results yet after ~300ms.

### Submitting
Three ways to commit a search:
1. **Tap a suggestion:** call Search Box `/retrieve` with `mapbox_id`, get full feature, pass to Flow 3.
2. **Press Enter:** commit top suggestion (b3 fix; keep).
3. **Press search/go on keyboard:** same as Enter.

If the query is a category keyword with no high-confidence specific match (e.g., "coffee"), run a **category search** using Search Box `/category/{canonical}` or a forward search with category filter. Render results as pins on the map + a list in the sheet (Flow 4).

### After commit
- Search bar collapses back to capsule, showing the searched term + ✕ to clear.
- Mode transitions to `place` (single result) or `category` (multiple results, see below).

### Category / list results sub-flow
- For multi-result queries (category chip, or vague term):
  - Drop pins for up to ~20 results in viewport.
  - Fit-bounds the map to pins (with padding for the sheet).
  - Sheet opens at `half`, listing results with name, category, distance, rating if available.
  - Tapping a row = focus that place, animate to its pin, promote sheet to place-detail mode. A back arrow in the sheet returns to the list.

### Dismiss
- Tap ✕ in capsule: clears pins + list, exits `search`/`category` mode, returns to idle.
- Tap map behind the list sheet: collapses sheet; second tap dismisses.

### What's new vs. today
- Recents panel + category chips on search-open.
- Category search / list results (multi-pin render).
- Debounce + proper `/retrieve` split (ensures we attribute the Search Box session correctly for billing/quota).
- Cancel button vs. implicit dismiss.

---

## Flow 3 — Place detail

Triggered by: tapping a search suggestion, tapping a map POI, long-press, reverse-geocode from map tap, or tapping a pin in a category list.

### Sheet layout

**Peek state (default on open):**
- Name (H1, Fraunces)
- Category • Distance • Open-now (if available)
- Primary action row: `Directions` (filled lime-signal button), `Save` (icon), `Share` (icon).

**Half / expanded state (drag up):**
- Hero area: could be a static icon or, if we had images, a photo (V2). For V1, use a styled category badge.
- Address (with copy-on-tap).
- Phone (if present, tappable `tel:`).
- Website (if present, tappable — opens in new tab).
- Coordinates (tiny, mono-font).
- **"Reachable in 15 min"** row: opens an isochrone centered here (cross-feature).
- **"Nearby incidents"** row: if any incidents within 1km of the place, show count; tap jumps to Incident flow filtered to this vicinity.

### Map state while sheet open
- Pin dropped at place.
- Camera flies to the place (`flyTo`, zoom ≥15 if closer-in, otherwise preserve current zoom minus 1).
- Padding is set so the pin stays above the sheet (use `map.easeTo({ padding: { bottom: sheetHeight } })`).

### Exit
- ✕ in sheet header: dismiss sheet, clear pin, return to idle.
- Tap a different place (suggestion, POI): replace focus — old pin/sheet gone, new one in.

### What's new vs. today
- Explicit multi-height sheet with progressive disclosure.
- Cross-feature entry points (isochrone from here, nearby incidents).
- Padding-aware fly-to so the pin doesn't land behind the sheet.

---

## Flow 4 — Directions (preview-only; live nav is V2 per CLAUDE.md)

Google Maps' directions has many layers. We're building the *preview / planning* layer only.

### Entry
- Tap **Directions** in tool rail.
- Or tap **Directions** from inside a place sheet (prefills "To:" with that place).

### Directions panel (top of screen, not a bottom sheet)
Google Maps puts the origin/destination inputs at the **top** with a swap button and a "X" close. We should match this — it's the one piece of UI that lives above the map instead of below, because the bottom sheet holds the *results* (duration, steps).

- **Top panel** (height ≈ 140px on mobile):
  - Back arrow (returns to idle/previous mode).
  - Two stacked input rows: `From` (defaults to "Your location" if geolocation granted, else prompts), `To`.
  - Swap-arrows icon between the two rows.
  - Each input uses the same Search Box suggestions pattern as Flow 2, but inline in a dropdown beneath the input while focused.
  - Mode selector: a horizontal tab bar below the inputs — `🚗 Drive · 🚴 Cycle · 🚶 Walk`. **In-place update on tap** (b3 fix; keep — no re-render).

### Once both From and To are set
- Fetch all three profiles **in parallel** (Directions v5: `driving-traffic`, `cycling`, `walking`) so duration chips show under each mode icon immediately (b3 fix; keep).
- **Render the selected profile's route** as a line on the map. Line color = vibe's route accent. Thickness ~6px, with a subtle outer casing of 8px for contrast.
- **Fit bounds** the map to the route geometry with padding that accounts for both the top panel and the bottom sheet (see below).
- **Bottom sheet (peek state):** "25 min · 12 km · via A4" + CTA row: `Start` (disabled in V1 — label it "Preview", greys out with a tooltip "Live nav coming soon"), `Steps` (promotes sheet to expanded).
- **Bottom sheet (expanded state):** Turn-by-turn step list. Each row: maneuver icon, instruction text (e.g., "Turn right onto Regent St"), distance-to-next-maneuver. Tapping a step pans/zooms the map to that maneuver location (use step's `maneuver.location`).

### Switching modes
- Tap a different mode tab: redraw the route from the already-cached response for that profile. No sheet re-render (b3 fix).
- Update the duration line and step list in place.

### Rendering the route reliably
**OPEN issue in b3** was "no route rendered on map" — likely a layer-order issue with Mapbox Standard (custom layers drawn under basemap labels). The route layer should be added *above* the "road-label" layer but *below* "settlement-subdivision-label" in the Standard style order. Use `map.addLayer(layer, 'road-label')` as the second argument to place it explicitly, and verify by logging `map.getStyle().layers` after add.

### Dismiss / Clear (b3 pattern, keep)
- **Minimize** button in sheet: closes the top panel + sheet, keeps the route on the map as a persistent focus. Returns to idle mode but with `focus.kind='route'`. Tapping the route line or a new "Route" chip (bottom-left) re-opens the sheet.
- **Clear** button: removes route layer, clears the focus, returns to idle.

### Incident overlay
- When a driving route is active, fetch Incidents for the route's bounding box (already built). Render incident icons *on* the route. Tapping an incident icon opens the incident sheet as a *secondary* sheet — the route sheet collapses to peek, incident sheet takes `half`. Dismissing the incident sheet returns focus to the route.

### What's new vs. today
- Top input panel (like Google), not a bottom panel.
- Parallel fetch of all profiles for instant mode switching.
- Reliable route render (layer-order fix).
- Step list with tap-to-fly-to-maneuver.
- Route chip to re-open after minimize.

---

## Flow 5 — Isochrone / reachable area

This is Vibe Maps' "Explore" equivalent. Google Maps doesn't have a direct analog (they have "Search along route" + driving times), so this is where we get to innovate. Treat it as a first-class feature.

### Entry
- Tap **Isochrone** in tool rail → a pin is placed at the current map center and a sheet opens.
- Or from a place sheet → "Reachable in 15 min" row centers the isochrone on that place.

### Sheet
**Peek:**
- "Reachable from [address]"
- Time band chips: `5 · 10 · 15 min` (single-select by default; shift-tap/toggle to overlay multiple).
- Profile icons (same 3 as directions).

**Expanded:**
- Pin address + coordinates.
- Show-all toggle (current behavior — keep).
- Place categories to highlight within the reachable area (e.g., "Show cafés in this zone") — this pulls POIs from Search Box `/category/cafe` with a `bbox` derived from the isochrone geometry. V2 can wait if this bloats V1.
- Button: "Use as starting point for directions" → hands off to Flow 4 with From prefilled.

### Map
- Pin is draggable. On `dragend`, re-fetch Isochrone.
- Polygons rendered with low-opacity fill (~0.2) + stroke, each band a different shade. Keep the current three-band color logic.

### Dismiss
- **Keep on map** (b3, keep): closes sheet, polygons + pin remain.
- **Clear**: removes polygons + pin + exits mode.

---

## Flow 6 — Layers / Vibes

Essentially a preferences sheet. Already mostly built.

### Entry
- Tool rail **Layers** button.

### Sheet (half, no expanded state — single height, no drag handle)
- Vibe grid (5 options with color swatches and names — current implementation).
- Toggles: 3D buildings, Terrain, Traffic, Incidents-on-map (default on when a driving route is active; default off otherwise).
- Token management footer: show masked token, "Change token" action, "Forget token" action (clears localStorage, returns to setup screen).

### Dismiss
- ✕ or tap-outside closes. No persistent focus (this sheet doesn't create map artifacts).

---

## Cross-cutting concerns

### Back button / dismiss hierarchy
Mobile users expect the OS back gesture (and our in-app back arrow) to walk up a stack of states, not slam them back to idle. Suggested stack:
1. Sub-sheet (incident inside a route) → primary sheet.
2. Place inside a category list → list.
3. Expanded sheet → half → peek → dismissed.
4. Mode → idle.

Implementation: maintain a simple `history` array on `AppState`; wire `popstate` for PWA (we're on GitHub Pages, `pushState` with hash fragments is fine and makes flows deep-linkable).

### Loading states
- Every API call: show a progress indicator within 200ms if still pending, not instantly.
- Never block the map (map stays interactive during API calls).
- Route fetch: skeleton line (dashed, grey) on the map while the real route loads (nice-to-have, V2).

### Error states
- Search: "No results" with a "Try broader search" CTA if we applied `bbox` filtering.
- Directions: "No route found" with an explanation for the mode (e.g., "No driving route between these points — try walking").
- Isochrone: "Couldn't calculate" with a single retry button.
- Token errors (401/403): toast "Your token doesn't have access to this API" + link to token settings.

### Empty states
- Idle-map first load with no location permission: soft banner at top "Tap the target icon to center on your location" — dismissible.
- Search pre-query: recents + categories panel (Flow 2).

### Accessibility
- Every button has a label (`aria-label`).
- Sheet drag handle has `role="button"` and `aria-label="Expand"` / "Collapse".
- Focus trap inside expanded sheets (so tab doesn't escape to map).
- Respect `prefers-reduced-motion` for `flyTo` animations (fall back to `jumpTo`).

### Deep-linkable state (nice-to-have)
Use hash fragments to encode mode + focus. Examples:
- `#place/<mapbox_id>`
- `#dir/<from_mapbox_id>/<to_mapbox_id>/driving`
- `#iso/<lng>,<lat>/15/driving`

Restores on refresh. Makes sharing a specific view possible later.

---

## Scope

### V1 (must work before we call this "Google Maps built with Mapbox")
- Flow 1 (idle + tap) with reverse geocode and Standard-POI tap
- Flow 2 full: recents panel, category chips, category list results, proper suggest/retrieve
- Flow 3 full: multi-height sheet, address/phone/website, padding-aware fly-to
- Flow 4 full (preview only): top panel, parallel profile fetch, **route reliably rendered**, step list with fly-to-maneuver, minimize/clear pattern, route chip to resume
- Flow 5: existing isochrone, plus "use as origin for directions" handoff
- Flow 6: existing layers, with token management consolidated in
- Cross-cutting: single `AppState` + `goTo(mode, payload)` owner for mode transitions (this is the refactor that unblocks most of the above)

### V1.5 (polish pass)
- Hash-fragment deep links
- Category POIs within isochrone
- Incident-on-route sub-sheet
- Reduced-motion fallback

### V2 (deliberately deferred per CLAUDE.md)
- Live navigation (position tracking, turn callouts, rerouting)
- Public transit profile
- Saved places persistence
- Sharing / social
- Offline support
- Place photos / reviews

---

## Build order (suggested)

The biggest unlock is the `AppState` + `goTo` refactor. Most of the current glitchiness (feature picker overlap, flicker on mode switch, sheets stepping on each other) stems from each feature mounting/unmounting its own UI with no central coordinator.

1. **Refactor: `AppState` + `goTo`** — no behavior change, just move state ownership. Validate by reproducing existing flows.
2. **Fix route rendering** (Flow 4 OPEN issue) — layer order vs. Standard style. Quick win.
3. **Directions top panel** — move inputs from bottom to top. Keep existing mode tabs + parallel fetch.
4. **Step list + fly-to-maneuver**.
5. **Place sheet v2** — multi-height, padding-aware fly-to, cross-feature rows.
6. **Search flow v2** — recents panel, category chips, category list results.
7. **Sheet model shared component** — extract the 2/3-state sheet into one implementation used by every feature.
8. **Isochrone v2** — "use as origin" handoff, category overlays (if appetite).
9. **Cross-cutting polish** — hash routing, error/empty states, a11y.

Each step is a sheddable unit: you can ship after any of them.
