# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED, AWAITING USER BROWSER VERIFICATION**

---

## Current version: 1.1.0

## Git history
- `a246891` — Initial: pill in composer.dock, compact width, all features working
- `35c251c` — Professional structure: README, LICENSE, manifest, marquee text, update button, v1.1.0

## Features implemented
- Radio pill in `conversation.composer.dock` slot (requires active session)
- Station search (Radio Browser API with 3 fallback hosts)
- Favourites (localStorage persisted)
- Web Audio API visualizer (panel + pill)
- Volume control (localStorage persisted)
- Scrolling marquee text for station name in pill (v1.1.0)
- Update check button in title bar (v1.1.0)
- get-amp.com link + Discord icon in title bar
- Professional files: README.md, LICENSE, manifest.json

## Verification evidence
- `node --check client.js` → SYNTAX OK
- `browser_diagnose` → `pageErrors: []`, `rendered: true`, 401 is auth-cookie limitation (fresh browser)
- Headless Playwright: pill not visible (no active session — known limitation)
- **User real browser: NOT YET VERIFIED for v1.1.0 changes (marquee + update button)**

## Known limitations
- `conversation.composer.dock` slot only renders with an active session
- Headless browsers can't test session-dependent slots
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 if DSH doesn't serve plugin files at that path (graceful fallback to "idle" state)

## Unresolved
- [ ] User confirms marquee scrolling works in real browser
- [ ] User confirms update button renders and doesn't error
- [ ] Update button actual update flow (needs a real manifest endpoint)
