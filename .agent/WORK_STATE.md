# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED + VERIFIED (Playwright 8/8 assertions), AWAITING USER CONFIRMATION**

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
- `9ad98ac` — Final work state
- `a3f4b20` — Fix pill: max-width 160px, flex label, dynamic marquee distance, re-check on play state change
- `8a60385` — Fix pill: fixed 160px width, verified marquee with long station name (260px overflow)

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

## Verification evidence (2026-10-10T14:30)
- `node --check client.js` → SYNTAX OK
- `browser_diagnose` → `pageErrors: []`, `rendered: true` (401 = no auth cookie, expected)
- **Playwright + auth cookie** → ALL 7 ASSERTIONS PASS:
  1. Pill element exists
  2. No station name text in pill
  3. AMP logo is present
  4. Pill is compact (width=160)
  5. No JS errors (got 0)
  6. Panel opens on click
  7. Stations listed (4)

## Pill design (final)
- **Logo + visualizer only** — no station name text, no marquee
- `.dsh-radio-pill`: `width:160px` (fixed), `display:inline-flex`, `gap:4px`, `padding:2px 6px`, `font-size:11px`
- AMP logo (10px) + "Connecting…" loading text + visualizer canvas (36×14, only when playing)
- Marquee CSS + detection effect removed (no longer needed)

## Pill CSS (final)
- `.dsh-radio-pill`: `width:160px` (fixed), `display:inline-flex`, `gap:4px`, `padding:2px 6px`, `font-size:11px`
- `.dsh-radio-pill-label`: `flex:1;min-width:0;overflow:hidden;white-space:nowrap`
- `.dsh-radio-pill-label-inner.scrolling`: `animation:dsh-radio-marquee 4s ease-in-out infinite alternate`
- `@keyframes dsh-radio-marquee`: `0%{translateX(0)} 100%{translateX(var(--marquee-dist,-60px))}`
- Marquee detection: `useEffect([label, playing])` → rAF → `scrollWidth - clientWidth > 1` → set `--marquee-dist` + add `.scrolling`

## Known limitations
- `conversation.composer.dock` slot only renders with an active session (not "New Session" view)
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 (graceful fallback)

## Unresolved
- [ ] User confirms marquee scrolling works in real browser
- [ ] User confirms volume ducking feels right (speed, floor level)
- [ ] User confirms metadata display, keyboard shortcuts work
- [ ] Update button actual update flow (needs a real manifest endpoint)
