# Vibe Maps

## Project
A personal, map-first Progressive Web App for London that dogfoods the Mapbox GL JS platform. Primary use is daily personal use, with secondary value as an internal Mapbox dogfooding reference. Installable to iPhone home screen via Safari. No backend, no auth — Mapbox API key captured via UI on first use and stored in localStorage.

## Stack
- Vanilla JS, single `index.html`, all CSS/JS inline
- Mapbox GL JS v3 CDN, Google Fonts (Fraunces, Inter Tight, JetBrains Mono)
- GitHub Pages hosting, PWA via manifest.json + sw.js
- Tokens in localStorage — collected via first-run setup screen
- Design system: VibeMaps (forest-ink ground, lime-signal accent, paper neutrals)

## Tokens
- Single `pk.*` public token with `styles:read`, `tiles:read`, `fonts:read` scopes
- Sufficient for Map, Search Box API, Directions, Isochrone, Geocoding
- Collected at runtime via first-run prompt, stored as `vibemaps_map_token` in localStorage

## Design Decisions
- Used Mapbox Standard style with `setConfigProperty` for vibe switching (lightPreset: day/dusk)
- 5 vibes: Day (default), Warm, Dusk, Trailhead, Aviator — each sets lightPreset and route accent color
- Search uses Mapbox Search Box API v1 (suggest + retrieve endpoints)
- Directions use Mapbox Directions API v5 with driving-traffic/cycling/walking profiles
- Isochrone uses Mapbox Isochrone API v1 with contours_minutes parameter
- Incidents use Mapbox Incidents API v1 with bounding box from route geometry
- Reverse geocode on map click uses Mapbox Geocoding API v5
- MCP DevKit confirmed available but token has limited scopes; app collects user's own token at runtime

## Status
- Step 1 ✅ — Scaffold (index.html, manifest.json, sw.js, icons, CLAUDE.md)
- Step 2 ✅ — Token setup screen with validation
- Step 3 ✅ — Map with Mapbox Standard, 3D, terrain, geolocation, position persistence
- Step 4 ✅ — Place search (Search Box API autocomplete, fly-to, place sheet)
- Step 5 ✅ — Directions (3 profiles, route line, step-by-step)
- Step 6 ✅ — Incident overlay (severity badges, popup details)
- Step 7 ✅ — Isochrone explorer (draggable pin, 3 time bands, show-all toggle)
- Step 8 ✅ — Layers panel (vibe grid, 3D/terrain/traffic toggles, token management)
- Step 9 ☐ — Polish & push

## Build Plan
1. Scaffold: project folder, git init, GitHub repo, index.html, manifest.json, sw.js, icons
2. Token setup: first-run prompt, validate against Mapbox API, persist to localStorage
3. Map: Mapbox Standard style, 3D buildings + terrain, geolocation, position save/restore
4. Search: Search Box API autocomplete, result selection, fly-to, place sheet with directions CTA
5. Directions: 3 profiles, route geometry on map, step list, duration/distance summary
6. Incidents: fetch from Incidents API on driving routes, severity-coded markers + detail sheet
7. Isochrone: draggable pin, 3 time bands, show-all contours, re-fetch on change
8. Layers: vibe grid (5 palettes), 3D/terrain/traffic toggles, token management
9. Polish: animations, safe-area handling, landscape lock, final commit + push

## Out of Scope (V1)
- Live navigation (position tracking, turn callouts, rerouting)
- Public transit routing
- Saved places persistence (UI exists but session-only)
- Sharing / social features
- Offline map support
