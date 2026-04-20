# Vibe Maps — Findings

Running log of bugs, rough edges, and UX issues noticed while using the deployed app. Tested on mobile unless noted.

Legend: **FIXED** = shipped in b3, **OPEN** = still needs work/verification.

## Token / key collection screen

- **FIXED (b3)** — "Never sent to a server" copy: now reads "Stored locally in your browser. Only sent to Mapbox's APIs — never to a third-party server."
- **FIXED (b3)** — Missing token guidance: added inline text explaining default public token (`pk.*`) works, no special scopes needed.
- **FIXED (b3)** — Background gap at bottom: overlay changed from `position: absolute` with translucent bg to `position: fixed` with solid `--forest-ink` background. No more gap.
- **FIXED (b3)** — Layout whitespace: removed decorative drag handle; content is now compact and bottom-anchored in the sheet.

## Global layout

- **FIXED (b3)** — Viewport bottom gap: replaced `height: 100%` with `100dvh` + `-webkit-fill-available` fallback on `<body>`.
- **FIXED (b3)** — Location icon under status bar: hid the default Mapbox geolocate control UI via CSS (app uses its own recenter button which already respects safe-area insets).

## Search

- **FIXED (b3)** — "/" hint on mobile: hidden via `@media (hover: none), (pointer: coarse)`.
- **FIXED (b3)** — Feature picker overlap: tool rail is now hidden (`display: none`) when search mode is active.
- **FIXED (b3)** — Enter key: now selects the top search suggestion.

## Popup UIs (bottom sheets)

- **FIXED (b3)** — Drag handles: removed from all sheets (they were decorative-only and suggested non-existent drag interaction).

## Directions

- **FIXED (b3)** — Blank travel times: all 3 profiles (drive/cycle/walk) are now fetched in parallel so durations always display.
- **OPEN** — No route rendered on map: route layers exist and `drawRoute()` sets the GeoJSON source. If still not visible, may be a layer ordering issue with Mapbox Standard style (custom layers can render beneath the basemap). Needs on-device verification.

## Feature flow / dismiss pattern (general)

- **FIXED (b3)** — Isochrone: "Keep on map" dismisses the sheet but leaves polygons visible. "Clear" explicitly removes them.
- **FIXED (b3)** — Directions: added "Minimize" (dismiss sheet, keep route on map) alongside "Clear" (remove everything).
- **FIXED (b3)** — Shared pattern: returning to map mode no longer auto-clears overlays. Overlays persist until the user explicitly clears or switches to a different feature.

## Feature picker

- **FIXED (b3)** — Removed "Search" from tool rail. The persistent search capsule is the single entry point.

## Navigation feature

- **FIXED (b3)** — Mode switch flicker: travel mode buttons now update active state in-place via DOM manipulation instead of full sheet re-render. Only the selected profile triggers a new API call.

## Versioning / update cycle

- **FIXED (b3)** — Build number: visible as "Vibe Maps b3" in top-right wordmark.
- **FIXED (b3)** — Tap wordmark to force service worker update check.
- **FIXED (b3)** — Green update dot appears when a new SW is waiting to activate.
- **FIXED (b3)** — SW cache version bumped to v3 to match build.

---

## How to verify (b3)

1. **Build number visible:** Look for "Vibe Maps b3" in top-right corner of the map screen.
2. **Token screen:** Should show solid dark background (no gap at bottom), accurate copy about Mapbox-only, token type guidance, no drag handle.
3. **Viewport gap:** Check for any visible gap at the bottom of the screen on iPhone (map should fill edge to edge).
4. **"/" hint:** Open on phone — the "/" chip in the search bar should be hidden. On desktop with mouse, it should still show.
5. **Tool rail:** Should have 5 buttons (Map, Directions, Isochrone, Incidents, Layers) — no Search.
6. **Search overlap:** Tap the search bar — tool rail should disappear. Cancel search — it returns.
7. **Enter key:** Type a search, wait for suggestions, press Enter — should select top result.
8. **Drag handles:** No sheets should have the small gray drag handle bar at the top.
9. **Directions durations:** Open directions between two places — all 3 mode tabs should show durations, not "--".
10. **Route on map:** After directions are computed, check if the colored route line appears on the map. If not, this is the one **OPEN** issue (layer ordering vs Standard style).
11. **Minimize/Keep pattern:** In directions, tap "Minimize" — sheet closes, route stays. In isochrone, tap "Keep on map" — sheet closes, polygons stay. "Clear" removes everything.
12. **Mode switch flicker:** In directions, tap between Drive/Cycle/Walk — the panel should NOT flash/close/reopen; only content updates.
13. **Update flow:** Tap the "Vibe Maps b3" wordmark — should trigger a SW update check. If a new version is available, a green dot appears next to the wordmark.
