# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED + VERIFIED (Playwright + screenshot), AWAITING USER CONFIRMATION**

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
- `e5741ed` — Update work state: compact pill + sleep timer removed

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
- Station metadata display (country · codec)
- **Volume ducking**: auto-lower volume when typing in composer, restore on Enter

## Verification evidence (2026-10-10T13:34)
- `node --check client.js` → SYNTAX OK
- `browser_diagnose` → `pageErrors: []`, `rendered: true` (401 = no auth cookie, expected)
- **Playwright + auth cookie** → ALL 9 CHECKS PASS:
  1. PILL_EXISTS: true, SIZE: 74x16, COMPACT: true
  2. PANEL_OPENS: true
  3. NO_SLEEP_TIMER: true
  4. TRANSPORT_BUTTONS: 2 (play + stop only)
  5. VOLUME_SLIDER: true
  6. SEARCH: true
  7. STATIONS: 4
  8. JS_ERRORS: NONE
  9. DUCKING_CODE: present in bundle

## Known limitations
- `conversation.composer.dock` slot only renders with an active session (not "New Session" view)
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 (graceful fallback)

## Unresolved
- [ ] User confirms marquee scrolling works in real browser
- [ ] User confirms volume ducking feels right (speed, floor level)
- [ ] User confirms metadata display, keyboard shortcuts work
- [ ] Update button actual update flow (needs a real manifest endpoint)
