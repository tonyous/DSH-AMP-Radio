# Developing AMP Radio

## Layout
| File | What it is |
|---|---|
| `src/00-core.js` | Start of the page code: React, the version, problem reports, the list of DSH parts the plugin uses and its self-check |
| `src/10-radio.js` | AMP Radio: stations, player, visualiser, the AMP button |
| `src/20-bar.js` | AMP Bar: the stats layout (top / bottom, +N), the switches, AMP's own CPU/RAM/GPU pills |
| `src/30-tasks.js` | Task timer and time-to-finish pills |
| `src/90-apply.js` | Where each piece is registered with DSH (each one optional) |
| `client.js` | **Built** from `src/` (DSH loads one file). Never edit it by hand |
| `index.js` | Server side: settings (`/api/amp-bar/settings`), stats (`/api/amp-bar/stats`), problem reports (`/api/amp-bar/report`) |

## Build and test
```
node build.mjs                 # writes client.js from src/
npm i --no-save react@18 react-dom@18
npm test                       # build check + task pills + page chaos + server chaos
```
GitHub runs the same tests on Node 20 and 22, with React 18 (what DSH uses) and 19, for every push.

## Rules every change keeps
- **Nothing may break the chat.** Every slot is registered in a `try`; the task pills sit behind an error boundary;
  every timer and fetch is guarded. A failure hides that one piece and is reported once.
- **Every DSH part in one place:** `DSH_PARTS` in `src/00-core.js`. If DSH renames one, the self-check (15 s after
  start, then every minute) reports it and the AMP Bar settings say so. Add new parts there, not inline.
- **Old and new halves work together:** a new page with an old server keeps new switches in the browser
  (`NEW_KEYS`); an old page with a new server is unaffected.
- **Writes are atomic and one at a time** (`writeAtomic` in `index.js`).

## Task timer storage (shared with the dsh-task-timers plugin)
Both plugins read and write the same browser storage so their numbers always match. Keep this exact shape:
- `dsh-task-timers:v1:<sessionId>` = `{items: {"<task text>": {start: ms, end?: ms, unknown?: true}}}`
- `dsh-task-timers:v1:history` = the last 60 finished tasks: `[{ms, guess}]` (`guess` = the AI's own estimate in ms
  from text like `[~8m]`, or `null`)
- `dsh-task-timers:v1:<sessionId>:pause` = `{since: ms}` while DSH compacts; on the end the running task's `start` moves forward
  by the pause and the pause id goes into the record's `done` list (so two tabs never subtract it twice).
Times outside 1 s to 24 h are ignored as junk. A start time in the future (clock changed) counts as unknown.
