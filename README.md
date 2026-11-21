# AMP Radio + AMP Bar for DeepSeek Harness

Internet radio with a live visualiser, and every chat stat in one tidy bar.
Put the stats at the top of the chat, where the space is empty, or under the message box. Switch each one on or off.
On a phone they fold into one clean line.

![The AMP Bar at the top of a chat](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/top-bar.png)

**Website:** [get-amp.com](https://get-amp.com) · **Discord:** [discord.gg/hr3zfQmyVQ](https://discord.gg/hr3zfQmyVQ)

---

## What you get

| | |
|---|---|
| **AMP Bar** | All the little stats under the message box (speed, tokens, CPU, RAM, GPU, context and so on) in one bar, at the top of the chat or at the bottom. |
| **Fits any screen** | Two neat lines in the header. What does not fit goes into a **+N** button. Nothing gets cut off, on a wide monitor or a phone. |
| **Task timer** | While the AI works through a task list: which task it is on, a live clock for that task, and about how long the whole list has left. It learns from how long tasks really take. |
| **Your choice of stats** | An on/off switch for every stat. Saved on your DeepSeek Harness, so your phone and your PC match. |
| **AMP Radio** | Thousands of internet radio stations, search, favourites, and a visualiser that moves with the music. |
| **AMP button where you want it** | In the bar next to the stats, or floating so you can drag it anywhere. |

## Install

Install it from inside DeepSeek Harness. Nothing to download by hand. Works on Windows, macOS and Linux.

1. Open **Plugins**.
2. Click **Add plugin**.
3. Paste `https://github.com/tonyous/DSH-AMP-Radio` and click **Install**.

Already have an older AMP Radio? Install again with the same link to update.

## How to use it

### The stats bar

Open any chat. The stats sit next to the chat title, and on a second line beside the Chat / Trajectory tabs when there is room.
Numbers update in place: the stats never jump around when a value changes.

- Click **+N** to see the rest. Click **×** or press **Esc** to close it.
- Clicking a stat works as before (for example, CPU opens its details).

![The +N button opens every stat](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/top-bar-open.png)

Prefer them under the message box? Choose **Bottom** in the settings. They wrap onto more lines instead of running off the screen.

![The stats under the message box](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/bottom-bar.png)

### Task timer

When the AI makes a task list, two pills appear in the bar:

- **● Task 4/7 · 6:30 left**: the task it is on and about how long that task has left. The dot pulses while it works,
  turns green when everything is done and red if a task runs over. A thin line under it fills as the task goes.
- **Finish ~1 h 11 min**: about how long the whole list has left.

While DeepSeek Harness compacts a long chat, the clock **pauses** (amber dot, "paused · compacting") and that time is not
counted. The times are estimates. They start from the AI's own guesses and get better as tasks finish.
Turn either pill off in the settings. If you also use the task-timers plugin, both show the same numbers.

### On a phone

The header has no spare room on a phone, so the stats sit under the message box on one line, with **+N** for the rest.

| Closed | Open |
|---|---|
| ![Phone, closed](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/phone.png) | ![Phone, open](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/phone-open.png) |

### Settings

Two places, same settings:

- Click the **AMP** button, then the **sliders** icon at the top of the panel.
- Or open DeepSeek Harness **Settings** and pick **AMP Bar**.

| Setting | Choices |
|---|---|
| Stats bar | **Top of chat** or **Bottom** |
| AMP button | **In the bar** (next to the stats) or **Floating** (drag it anywhere) |
| Show | An on/off switch for each stat |

![AMP Bar settings](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/settings.png)

### The radio

1. Click the **AMP** button.
2. Pick a station, or search for one.
3. Press **play**. The visualiser starts moving with the music.
4. Tap the star to keep a station in your favourites.

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `Esc` | Close the panel |

![AMP Radio](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.2/docs/screenshots/radio-panel.png)

### Borrow my AI

Lend the AI running on your PC to a friend's DeepSeek Harness, anywhere in the world, or use theirs. Their chats stay on
their PC; only the thinking happens on yours. It works over [Tailscale](https://tailscale.com) (free); AMP sets it up for you.

Click the **AMP** button, then the **link** button (two circles) at the top of the panel.

**Share yours:** press **Share my AI**, then **Invite a friend**. In the Tailscale page that opens, press **Share**, copy the
link and send it to your friend. If your Tailscale rules would block them, the card shows one button that fixes it.

**Use a friend's:** press **Use a friend's AI**. It looks for your friend's AI by itself; if it asks, copy the link they sent
and press **Paste link**. New chats now use their AI.

Everything else happens by itself: installing or signing in to Tailscale opens the right page and carries on when it is
done, a lost connection reconnects, and closing and opening DeepSeek Harness on either side keeps you connected.

| Light | Means |
|---|---|
| Green | The AI is running |
| Amber | The AI is asleep and wakes by itself when your friend sends a message |
| Red | The AI is paused while the sharer plays a game |

While your friend is using your AI, your own messages to it wait until they are done (cloud models never wait), and you
see their usage live. **Force stop** always ends it at once. When they are done, the AI leaves your graphics card by
itself. Only the AI can be reached, never your files or anything else on your PC; each friend has their own invite, and
**Remove** takes it away. Nothing anyone writes is saved; only usage numbers are kept, on your PC.

## Which stats show up

The bar arranges the stats your DeepSeek Harness already shows: turns and speed, tokens and cache, live speed, the context ring, and any hardware or context stats from other plugins.
If you have no hardware-stats plugin, AMP adds its own **CPU**, **RAM**, **GPU** and **VRAM** (GPU needs an NVIDIA card).
Stats your setup does not have are simply skipped.

## If something looks wrong

| You see | Do this |
|---|---|
| No AMP button after installing | Restart DeepSeek Harness, then refresh the page. |
| Stats stay at the bottom even on Top | The chat header has no room at this window size, or a newer DeepSeek Harness changed the header. AMP then uses the bottom layout on its own and tries the top again later. |
| A stat you want is missing | Check its switch in the settings. If it is on, your setup does not have that stat. |

## Privacy

The stats are read on your own computer and only shown to you. Settings are saved in your DeepSeek Harness folder.
The radio plays public streams listed by [radio-browser.info](https://www.radio-browser.info/). Nothing else leaves your PC.

## License

MIT, see [LICENSE](./LICENSE).

## What's new

See [CHANGELOG.md](CHANGELOG.md). Latest: **2.2.7**: the Tailscale link is the whole invite.

Want to change it? See [docs/DEVELOPING.md](docs/DEVELOPING.md).
