# WORK STATE — dsh-radio plugin

Status: **IMPLEMENTED + VERIFIED (Playwright 17/17 assertions), AWAITING USER CONFIRMATION**

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
- `b3162e7` — Pill: fit-content width (74×16px), AMP logo + visualizer only
- (next) — Apple-perfect volume ducking: MutationObserver + focusout + ease-out cubic fades

## Features implemented
- Radio pill in `conversation.composer.dock` slot (requires active session)
- Station search (Radio Browser API with 3 fallback hosts)
- Favourites (localStorage persisted)
- Web Audio API visualizer (panel + pill)
- Volume control (localStorage persisted)
- Update check button in title bar
- get-amp.com link + Discord icon in title bar (properly aligned)
- Professional files: README.md, LICENSE, manifest.json
- Escape key to close panel
- Space key for play/pause (when panel focused)
- Remember-last-station (localStorage, restores on reload)
- Buffering indicator ("Connecting…" pulse)
- Station metadata display (country · codec)
- **Volume ducking (Apple-perfect)**: smooth fade down 30% while typing, fade up on Enter/blur/empty

## Volume ducking implementation (final)
- **Detection**: Single `MutationObserver` on `[contenteditable=true]` catches ALL composer changes (typing, backspace, paste, cut, select-all-delete, app clear)
- **Start ducking**: text.length > 0 && !duckingRef.current && (Date.now() - lastEnterRef > 600ms)
- **Stop ducking**: text.length === 0 (composer emptied) OR Enter key OR focusout (blur, 150ms delay)
- **Fade down**: `volume * 0.7` over 250ms, ease-out cubic (`1 - (1-t)^3`)
- **Fade up**: `originalVolRef.current` over 350ms, ease-out cubic
- **Never mutes**: proportional duck (30% reduction from current level)
- **No double-duck**: `duckingRef.current` guard + 600ms Enter cooldown

## Verification evidence (2026-10-10T15:00)
- `node --check client.js` → SYNTAX OK
- **Playwright 10-scenario suite → 17/17 ASSERTIONS PASS**:
  1. Type → duck down to ~70% (0.8 → 0.56) ✅
  2. Enter → restore to original (0.56 → 0.8) ✅
  3. Type → Backspace all → restore (no Enter needed) ✅
  4. Type → Click away (blur) → restore ✅
  5. Proportional duck (never mutes, 70% of current) ✅
  6. Type → Enter → Type again → ducks again ✅
  7. Rapid typing → stays ducked, stable at ~70% ✅
  8. Type → Select all → Delete → restore ✅
  9. Volume preserved after full duck cycle ✅
  10. No double-duck (typing while already ducked) ✅
- **Screenshot**: `/tmp/dsh-radio-pill.png` — pill visible at bottom (AMP logo + 45% volume)

## Pill design (final)
- **Logo + visualizer only** — no station name text, no marquee
- `.dsh-radio-pill`: `width:fit-content`, `display:inline-flex`, `gap:4px`, `padding:2px 6px`, `font-size:11px`
- AMP logo (10px) + "Connecting…" loading text + visualizer canvas (36×14, only when playing)

## Known limitations
- `conversation.composer.dock` slot only renders with an active session (not "New Session" view)
- Update button fetches `/plugins/dsh-radio/manifest.json` — may 404 (graceful fallback)
- Headless Chromium: `<audio>` stays `paused:true`, visualizer canvas never renders in automated tests

## Unresolved
- [ ] User confirms volume ducking feels right in real browser (speed, floor level)
- [ ] Update button actual update flow (needs a real manifest endpoint)

---

## Brave taskbar icon fix (2026-10-11)

**Problem**: Opening Brave showed a green DeepSeek whale in the KDE taskbar, not the default Brave lion.

**Root cause**: The running "Brave" window is the DeepSeek Harness PWA (`/opt/brave-bin/brave --app=http://127.0.0.1:3080/ --class=crx_hgiemfgfjhalibdoboikeiepnnjapnpc`). KDE matches the window's `WM_CLASS` (`crx_hgiemfgfjhalibdoboikeiepnnjapnpc`) against `StartupWMClass` in `.desktop` files. It matched `~/.local/share/applications/brave-hgiemfgfjhalibdoboikeiepnnjapnpc-Default.desktop`, whose `Icon=` pointed to the green DeepSeek whale PNG (`~/.local/share/icons/hicolor/256x256/apps/brave-hgiemfgfjhalibdoboikeiepnnjapnpc-Default.png`).

**Fix**: Changed that desktop file's `Icon=` from the green-whale path to `brave-desktop` (the standard Brave lion, present in `/usr/share/icons/hicolor/{16..256}x{16..256}/apps/`). Ran `update-desktop-database`. Original backed up to `brave-hgiemfgfjhalibdoboikeiepnnjapnpc-Default.desktop.bak-whale`.

**Verification (10/10 angles passed)**:
1. Desktop file `Icon=` is `brave-desktop` ✅
2. Old green-whale path removed from desktop file ✅
3. `brave-desktop` 256×256 icon file exists ✅
4. `brave-desktop` present in all 7 standard sizes (16–256) ✅
5. Running window `--class` == desktop file `StartupWMClass` ✅
6. No competing desktop file claims the same WM_CLASS ✅
7. `update-desktop-database` completed (exit 0) ✅
8. hicolor icon theme structure valid for `brave-desktop` ✅
9. Backup `.bak-whale` retains original green-whale path ✅
10. Icon theme resolves `brave-desktop` to a real file ✅

**End-to-end**: Launched a fresh PWA window with the same `--class`; KWin resolution WM_CLASS → desktop file → `Icon=brave-desktop` → `/usr/share/icons/hicolor/256x256/apps/brave-desktop.png` (lion). ✅

**Visual evidence**: `/tmp/icon-before-after.png` — side-by-side green whale (before) vs Brave lion (after).

**Note**: The currently-open PWA window (PID 12738) still shows the cached green whale in the taskbar until it is closed and reopened; new windows show the lion. Full-panel screenshot capture is limited on this Wayland session (compositor screen-capture protocol unavailable to agent processes; `grim`/`spectacle` blocked), so panel-level capture relies on the icon-file + resolution evidence above.
