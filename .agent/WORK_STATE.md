# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED + VERIFIED (screenshot), AWAITING USER CONFIRMATION**

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
- `1ec1c1b` — Fix pill TDZ bug (label before useEffect) + add volume ducking on typing/Enter
- `f2a0b5d` — Compact pill (74x16px) + remove sleep timer
- `bbfbc79` — Remove sleep timer references from README

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
- **Volume ducking**: auto-lower volume when typing in composer, restore on Enter

## Verification evidence
- `node --check client.js` → SYNTAX OK (all commits)
- `browser_diagnose` 2026-10-10T13:17 → `pageErrors: []`, `rendered: true`
- **Playwright + auth cookie** 2026-10-10T13:20 → `PILL_FOUND: true`, `RADIO_ELEMENTS: 2`, `JS_ERRORS: none`
- **Screenshot confirmed**: AMP pill visible at bottom of composer dock showing "AMP" + volume %
- TDZ bug root cause: `label` const used in `useEffect` dependency array before its declaration → `ReferenceError` crashed component
- Fix: moved `label`/`statusText`/`showSearch`/`list` declarations above all `useEffect` calls

## Known limitations
- `conversation.composer.dock` slot only renders with an active session (not "New Session" view)
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 (graceful fallback)

## Unresolved
- [ ] User confirms marquee scrolling works in real browser
- [ ] User confirms volume ducking feels right (speed, floor level)
- [ ] User confirms sleep timer, metadata display, keyboard shortcuts work
- [ ] Update button actual update flow (needs a real manifest endpoint)
