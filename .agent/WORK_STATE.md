# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED, AWAITING USER BROWSER VERIFICATION**

---

## Current version: 1.1.0

## Git history
- `a246891` — Initial: pill in composer.dock, compact width, all features working
- `35c251c` — Professional structure: README, LICENSE, manifest, marquee text, update button, v1.1.0
- `9e66521` — Escape key to close panel, work state record
- `a330d61` — Fix pill width: fixed 120px label, scroll only on overflow, stop when revealed
- `6b2ce0f` — Remember-last-station (localStorage) + buffering indicator
- `3df151b` — Sleep timer (5/15/30/60 min) with auto-pause
- `cde9963` — Station metadata display (country/codec) + Space keyboard shortcut

## Features implemented
- Radio pill in `conversation.composer.dock` slot (requires active session)
- Station search (Radio Browser API with 3 fallback hosts)
- Favourites (localStorage persisted)
- Web Audio API visualizer (panel + pill)
- Volume control (localStorage persisted)
- Scrolling marquee text for station name in pill (only when overflow, stops when revealed)
- Update check button in title bar
- get-amp.com link + Discord icon in title bar (properly aligned)
- Professional files: README.md, LICENSE, manifest.json
- Escape key to close panel
- Space key for play/pause (when panel focused)
- Remember-last-station (localStorage, restores on reload)
- Buffering indicator ("Connecting…" pulse)
- Sleep timer (5/15/30/60 min, auto-pause)
- Station metadata display (country · codec)

## Verification evidence
- `node --check client.js` → SYNTAX OK (all commits)
- `browser_diagnose` 2026-10-10T13:08 → `pageErrors: []`, `rendered: true`, 401 is auth-cookie limitation
- Headless Playwright: pill not visible (no active session — known limitation)
- **User real browser: NOT YET VERIFIED for v1.1.0 changes**

## Known limitations
- `conversation.composer.dock` slot only renders with an active session
- Headless browsers can't test session-dependent slots
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 (graceful fallback)

## Unresolved
- [ ] User confirms marquee scrolling works in real browser
- [ ] User confirms update button renders and doesn't error
- [ ] User confirms sleep timer, metadata display, keyboard shortcuts work
- [ ] Update button actual update flow (needs a real manifest endpoint)
