# AMP Radio + AMP Bar for DeepSeek Harness

Internet radio with a live visualiser, and every chat stat in one tidy bar.
Put the stats at the top of the chat, where the space is empty, or under the message box. Switch each one on or off.
On a phone they fold into one clean line.

![The AMP Bar at the top of a chat](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/top-bar.png)

**Website:** [get-amp.com](https://get-amp.com) · **Discord:** [discord.gg/hr3zfQmyVQ](https://discord.gg/hr3zfQmyVQ)

---

## What you get

| | |
|---|---|
| **AMP Bar** | All the little stats under the message box (speed, tokens, CPU, RAM, GPU, context and so on) in one bar, at the top of the chat or at the bottom. |
| **Fits any screen** | What does not fit goes into a **+N** button. Nothing gets cut off, on a wide monitor or a phone. |
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

Open any chat. The stats sit next to the chat title.

- Click **+N** to see the rest. Click **×** or press **Esc** to close it.
- Clicking a stat works as before (for example, CPU opens its details).

![The +N button opens every stat](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/top-bar-open.png)

Prefer them under the message box? Choose **Bottom** in the settings. They wrap onto more lines instead of running off the screen.

![The stats under the message box](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/bottom-bar.png)

### On a phone

The header has no spare room on a phone, so the stats sit under the message box on one line, with **+N** for the rest.

| Closed | Open |
|---|---|
| ![Phone, closed](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/phone.png) | ![Phone, open](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/phone-open.png) |

### Settings

Two places, same settings:

- Click the **AMP** button, then the **sliders** icon at the top of the panel.
- Or open DeepSeek Harness **Settings** and pick **AMP Bar**.

| Setting | Choices |
|---|---|
| Stats bar | **Top of chat** or **Bottom** |
| AMP button | **In the bar** (next to the stats) or **Floating** (drag it anywhere) |
| Show | An on/off switch for each stat |

![AMP Bar settings](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/settings.png)

### The radio

1. Click the **AMP** button.
2. Pick a station, or search for one.
3. Press **play**. The visualiser starts moving with the music.
4. Tap the star to keep a station in your favourites.

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `Esc` | Close the panel |

![AMP Radio](https://cdn.jsdelivr.net/gh/tonyous/DSH-AMP-Radio@v2.0.0/docs/screenshots/radio-panel.png)

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
