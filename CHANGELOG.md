# Changelog

## 2.2.3 (22 Nov 2026)
- Same as 2.2.2, which was published with an empty package file and could not be installed.

## 2.2.2 (22 Nov 2026, broken: do not use)
- An AI light on both cards: green = running, amber = asleep, red = paused while the sharer plays a game.
- A friend's message wakes the sharer's AI by itself (through DSH's own model switcher), never during a game.

## 2.2.1 (22 Nov 2026)
- Borrow my AI is one button at a time: Share my AI or Use a friend's AI, then one short line and one button.
- It finishes by itself: Tailscale missing or signed out, the share not accepted yet, the admin password (a normal password
  window on Linux). Each page opens once; nothing to press again.
- Invites need no name (your friend's name fills in by itself) and are copied for you. Paste invite reads the copied code.
- New chats use the borrowed AI straight away; Stop using puts your own model back.
- It heals itself: a message is retried through a short drop or a bad line, and a lost Tailscale door or helper is
  reopened within seconds on the same address, so friends reconnect on their own.

## 2.2.0 (22 Nov 2026)
- **Borrow my AI**: a new page in the AMP panel (the link button in its header). Share my AI lends the AI running on this PC
  to a friend's DeepSeek Harness over Tailscale; Use a friend's AI borrows theirs. Only the AI is reachable, never the PC:
  one door for one port, a key per friend tied to their Tailscale account, limits, and a Force stop that always works.
  While a friend has the turn, your own messages to that model wait; cloud models never wait.
- The friend's DSH gets the model as "Borrowed · <name>" with the same size, picture support and effort levels.
  Forget this friend puts their settings back exactly.

## 2.1.0 (21 Nov 2026)
- **Task timer** in the AMP Bar: which task the AI is on, a live clock, and about how long the whole list has left.
  A pulsing dot while it works, green when done, red if a task runs over. Switch each pill on or off.
- The task timer **pauses while DeepSeek Harness is compacting the chat** (amber dot, "paused · compacting"), and that time
  is not counted against the task.
- Saving settings twice at the same moment no longer fails (two saves used to share one temporary file).
- Broken or odd saved timings can no longer show strange times. A changed PC clock is handled.
- If something goes wrong, the plugin hides that piece and writes a short note to `amp-radio/problems.log` in your
  DeepSeek Harness folder, so it can be fixed. The chat is never affected.
- The plugin checks that the DeepSeek Harness parts it uses are still there. If an update renames one, the AMP Bar
  settings tell you, and the bar falls back to DeepSeek Harness's own layout there.
- Automatic tests on GitHub for every change (Node 20 and 22, React 18 and 19). Works with DeepSeek Harness 0.2.2
  alpha.3 and rc.5.
- Tested on Windows, macOS and Linux paths, without an NVIDIA card, with browser storage blocked, offline, on phone
  and desktop widths, and with every button pressed many times.

## 2.0.2 (19 Nov 2026)
- A stat wider than the free space goes into **+N** instead of being cut off.

## 2.0.1 (19 Nov 2026)
- Two lines of stats in the chat header. Stats keep a steady width so they don't jump when numbers change.

## 2.0.0 (19 Nov 2026)
- **AMP Bar**: every chat stat in one bar, at the top of the chat or under the message box, each one switchable,
  phone-friendly. The AMP button sits in the bar or floats.

## 1.2.0 (13 Oct 2026)
- AMP Radio: internet radio with a live visualiser, search and favourites.
