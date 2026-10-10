# dsh-radio

Internet radio player plugin for DeepSeek Harness.

## Features

- **Station browser** — search thousands of internet radio stations via the [Radio Browser](https://www.radio-browser.info/) directory
- **Favourites** — star stations to pin them to the top of your list (persisted in localStorage)
- **Audio visualizer** — real-time frequency bars using the Web Audio API (panel + pill)
- **Volume control** — persistent volume slider
- **Live update check** — check for plugin updates from the title bar
- **Compact pill** — sits in the composer dock with a scrolling station name and mini visualizer
- **Sleep timer** — auto-pause after 5, 15, 30, or 60 minutes
- **Remember last station** — restores your last played station on page reload
- **Buffering indicator** — "Connecting…" pulse while a stream loads
- **Station metadata** — shows country and codec for the current station
- **Keyboard shortcuts** — `Space` = play/pause, `Escape` = close panel

## Installation

This plugin is installed as a local DSH plugin. It lives in:

```
~/.local/share/deepseek-harness/home/profiles/web/plugins/dsh-radio/
```

No build step required. The plugin is loaded automatically when the DSH web server starts.

## Usage

1. Click the **AMP pill** in the composer dock (bottom of the conversation area)
2. The radio panel opens above the pill
3. **Search** for any station by name, or pick from the default stations
4. Click a station to start streaming
5. Use **Play/Pause** and **Stop** buttons to control playback
6. **Star** stations to add them to your favourites
7. Adjust **volume** with the slider
8. Set a **sleep timer** to auto-pause after a set duration
9. Click the **refresh icon** in the title bar to check for updates
10. Click **×** or press **Escape** to close the panel (audio keeps playing)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause (when panel is focused) |
| `Escape` | Close panel |

## Title Bar Links

| Element | Destination |
|---------|-------------|
| AMP logo | (decorative) |
| get-amp.com | https://get-amp.com |
| Discord icon | https://discord.gg/tZKwTk9y |
| Refresh icon | Check for plugin updates |
| × | Close panel |

## Default Stations

| Name | Stream |
|------|--------|
| Groove Salad | SomaFM — relaxing guitar |
| Drone Zone | SomaFM — ambient drones |
| Indie Pop | SomaFM — indie music |
| Sonic Universe | SomaFM — electronic |

## Development

```
dsh-radio/
├── package.json          # Plugin metadata & DSH config
├── index.js              # Host entry point (no-op)
├── client.js             # All client-side code (React)
├── cordis.patch.yml      # Bundle patch registration
├── icon.svg              # Plugin icon
├── manifest.json         # Version manifest for update checks
├── locale/
│   └── en.json           # Display name & description
├── README.md             # This file
└── LICENSE               # MIT License
```

### Architecture

- Single-file React component (`client.js`) using `createElement` (no JSX)
- Audio element is module-level (survives session switches)
- Web Audio API `AnalyserNode` drives both visualizers
- Station search uses the Radio Browser public API with fallback hosts
- Favourites, volume, and last station persisted in `localStorage`
- Sleep timer uses `setInterval` countdown with auto-pause
- Pill label uses CSS marquee animation (only when text overflows)

## License

MIT — see [LICENSE](./LICENSE)
