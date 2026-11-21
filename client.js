window.__ModuleLoader__.load({
  id: 'dsh-amp-radio',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const h = React.createElement;

    // Always-available offline stations (no network needed).
    const AMP_VERSION = '2.2.9';
    const reported = new Set();
    function ampReport(where, err) {
      const key = where + ':' + String(err?.message || err).slice(0, 80);
      if (reported.has(key)) return; reported.add(key);
      try { console.warn('[amp-bar] ' + where + ':', err?.message || err); } catch {}
      try { fetch('/api/amp-bar/report', {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'},
        body: JSON.stringify({where, message: String(err?.message || err).slice(0, 300), version: AMP_VERSION})}).catch(() => {}); } catch {}
    }


    // Every DSH part this plugin relies on, in ONE place (2.1). A DSH update that renames one shows up in the problem
    // log and in the AMP Bar settings, instead of a switch that silently stops working. `need`: must exist on a chat
    // page (DSH ships it); the others are optional (another plugin or a DSH setting may leave them out).
    const DSH_PARTS = [
      {name: 'message box', sel: '[data-composer-card]', need: true},
      {name: 'stats row under the message box', sel: '[data-composer-card] + div', need: true},
      {name: 'DSH stats (turns, tokens)', sel: '[data-composer-stat]', need: true},
      {name: 'chat header buttons (Top position)', sel: '[class*="headerActions"]', need: true},
      {name: 'context ring', sel: 'button[aria-label$="of context used"]', need: false},
      {name: 'task panel (task timer fallback)', sel: '[data-testid=todo-panel]', need: false},
      {name: 'hardware stats plugin', sel: '[data-hardware-stats]', need: false},
    ];
    let dshMissing = [];
    const dshListeners = new Set();
    function checkDshParts() {
      if (!document.querySelector('[data-composer-card]')) return;            // not on a chat page: nothing to judge
      const missing = DSH_PARTS.filter(p => p.need && !document.querySelector(p.sel)).map(p => p.name);
      if (missing.join() !== dshMissing.join()) { dshMissing = missing; dshListeners.forEach(fn => { try { fn(); } catch {} }); }
      for (const m of missing) ampReport('dsh changed', 'not found: ' + m);
    }
    const useDshMissing = () => React.useSyncExternalStore(fn => { dshListeners.add(fn); return () => dshListeners.delete(fn); }, () => dshMissing, () => dshMissing);

    const STATIONS = [
      {id: 'groove-salad', name: 'Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3'},
      {id: 'drone-zone', name: 'Drone Zone', url: 'https://ice1.somafm.com/dronezone-128-mp3'},
      {id: 'indie-pop', name: 'Indie Pop', url: 'https://ice1.somafm.com/indiepop-128-mp3'},
      {id: 'sonic-universe', name: 'Sonic Universe', url: 'https://ice1.somafm.com/sonicuniverse-128-mp3'},
    ];

    // Public, no-key directory of internet radio stations.
    const API_HOSTS = [
      'https://de1.api.radio-browser.info',
      'https://nl1.api.radio-browser.info',
      'https://at1.api.radio-browser.info',
    ];
    let apiHost = API_HOSTS[0];

    async function searchStations(query) {
      const params = new URLSearchParams({
        name: query,
        limit: '20',
        order: 'votes',
        reverse: 'true',
        hidebroken: 'true',
      });
      const url = apiHost + '/json/stations/search?' + params.toString();
      const res = await fetch(url, {headers: {'User-Agent': 'dsh-radio/1.0'}});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Bad response');
      return data
        .filter(s => s && s.url_resolved)
        .map(s => ({
          id: s.stationuuid,
          name: s.name,
          url: s.url_resolved,
          country: s.country || '',
          codec: s.codec || '',
        }));
    }

    // AMP CLI black wordmark logo (from amp.svg, embedded as data URI).
    // The official AMP wordmarks, byte for byte (BRAND.md): black on light, white on dark.
    const AMP_LOGO = "data:image/png;base64,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";
    const AMP_LOGO_WHITE = "data:image/png;base64,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";

    const css = `
      .dsh-radio-pill{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border:1px solid rgba(76,141,255,.3);border-radius:999px;background:rgba(76,141,255,.08);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:11px;line-height:1;cursor:pointer;transition:background .15s ease,border-color .15s ease;width:fit-content;flex-shrink:0;}
      .dsh-radio-pill-fixed{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:2147483000;box-shadow:0 4px 16px rgba(0,0,0,.4);background:rgba(20,20,24,.92);cursor:grab;height:22px;overflow:hidden;align-items:center;}
      .dsh-radio-pill-fixed:active{cursor:grabbing;}
      .dsh-radio-pill-visualizer{max-height:14px;}
      .dsh-radio-pill:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));}
      .dsh-radio-pill-logo{height:14px;width:auto;display:block;}
      .dsh-radio-pill-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8a8a8a);}
      .dsh-radio-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px;}
      .dsh-radio-eq i{width:2px;background:var(--dsw-alias-state-business-primary,#4c8dff);border-radius:1px;animation:dsh-radio-eq 1s ease-in-out infinite;}
      .dsh-radio-eq i:nth-child(1){height:40%;animation-delay:-.3s;}
      .dsh-radio-eq i:nth-child(2){height:100%;animation-delay:-.15s;}
      .dsh-radio-eq i:nth-child(3){height:60%;animation-delay:-.45s;}
      @keyframes dsh-radio-eq{0%,100%{transform:scaleY(.4);}50%{transform:scaleY(1);}}
      .dsh-radio-panel{position:fixed;z-index:2147483000;width:320px;height:520px;box-sizing:border-box;padding:0;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:14px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-l1,#1c1c1e));color:var(--dsw-alias-label-primary,#e6e6e6);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.45));font-size:13px;transform-origin:top left;animation:dsh-radio-open .18s ease-out;overflow:hidden;display:flex;flex-direction:column;}
      .dsh-radio-panel-bar>*:not(.dsh-radio-title):not(.amp-bar-settings){display:none!important;}
      .dsh-radio-panel-borrow>*:not(.dsh-radio-title):not(.amp-borrow){display:none!important;}
      .dsh-radio-panel-closing{animation:dsh-radio-close .15s ease-in forwards;pointer-events:none;}
      @keyframes dsh-radio-open{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
      @keyframes dsh-radio-close{from{opacity:1;transform:translateY(0);}to{opacity:0;transform:translateY(16px);}}
      .dsh-radio-title{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;font-weight:600;}
      .dsh-radio-title-logo{height:12px;width:auto;display:block;}
      .dsh-radio-close{border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a8a);font-size:20px;line-height:1;cursor:pointer;padding:6px 10px;border-radius:8px;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;}
      .dsh-radio-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));color:var(--dsw-alias-label-primary,#e6e6e6);}
      .dsh-radio-transport{display:flex;gap:6px;padding:0 14px;margin-bottom:12px;}
      .dsh-radio-btn{flex:1;display:flex;align-items:center;justify-content:center;padding:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:10px;background:var(--dsw-alias-bg-l2,rgba(128,128,128,.12));color:inherit;font:inherit;font-size:12px;cursor:pointer;transition:background .12s ease,border-color .12s ease;}
      .dsh-radio-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));border-color:var(--dsw-alias-state-business-primary,#4c8dff);}
      .dsh-radio-btn:disabled{opacity:.4;cursor:default;}
      .dsh-radio-volume{display:flex;align-items:center;padding:0 14px;margin-bottom:12px;}
      .dsh-radio-volume input{width:100%;accent-color:var(--dsw-alias-state-business-primary,#4c8dff);}
      .dsh-radio-section{padding:0 14px;margin:12px 0 6px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8a8a);font-weight:600;}
      .dsh-radio-search{padding:0 14px;margin-bottom:10px;}
      .dsh-radio-search-input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:10px;background:var(--dsw-alias-bg-l2,rgba(128,128,128,.12));color:inherit;font:inherit;font-size:12px;}
      .dsh-radio-search-input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4c8dff);}
      .dsh-radio-stations{display:flex;flex-direction:column;gap:2px;padding:0 10px;flex:1;min-height:0;overflow-y:auto;}
      .dsh-radio-station{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid transparent;border-radius:10px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:left;transition:background .1s ease;}
      .dsh-radio-station:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15));}
      .dsh-radio-station-active{border-color:var(--dsw-alias-state-business-primary,#4c8dff);background:rgba(76,141,255,.1);}
      .dsh-radio-station-main{display:flex;flex-direction:column;gap:2px;min-width:0;}
      .dsh-radio-station-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .dsh-radio-station-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .dsh-radio-station-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);flex-shrink:0;}
      .dsh-radio-star{border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a8a);cursor:pointer;padding:6px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;min-width:32px;min-height:32px;}
      .dsh-radio-star:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));}
      .dsh-radio-star-active{color:#f5c542;}
      .dsh-radio-empty{padding:14px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8a8a);text-align:center;}
      .dsh-radio-visualizer{position:absolute;bottom:0;left:0;width:100%;height:60px;display:block;padding:0;background:transparent;pointer-events:none;z-index:10;}
      .dsh-radio-pill-visualizer{display:block;flex-shrink:0;margin-left:6px;}
      .dsh-radio-title-link{white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);text-decoration:none;transition:color .15s ease;display:flex;align-items:center;}
      .dsh-radio-title-link:hover{color:var(--dsw-alias-label-primary,#e6e6e6);}
      .dsh-radio-title-discord{color:var(--dsw-alias-label-tertiary,#8a8a8a);display:flex;align-items:center;transition:color .15s ease;}
      .dsh-radio-title-discord:hover{color:var(--dsw-alias-label-primary,#e6e6e6);}
      .dsh-radio-title-update{margin-left:auto;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8a8a);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:color .15s ease,background .15s ease;}
      .dsh-radio-title-update:hover{color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));}
      .dsh-radio-title-update.spinning svg{animation:dsh-radio-spin 1s linear infinite;}
      .dsh-radio-title-update.available{color:var(--dsw-alias-state-success-primary,#57c785);}
      .dsh-radio-title-update.amp-borrow-on{color:#b98ad6;}
      .dsh-radio-title-update.up-to-date{color:var(--dsw-alias-state-business-primary,#4c8dff);}
      @keyframes dsh-radio-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
      .dsh-radio-pill-loading{color:var(--dsw-alias-label-tertiary,#8a8a8a);animation:dsh-radio-pulse 1.2s ease-in-out infinite;}
      @keyframes dsh-radio-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}

      .dsh-radio-now{padding:8px 14px;border-top:1px solid rgba(255,255,255,.06);}
      .dsh-radio-now-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dsh-radio-now-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);margin-top:2px;}
    `;

    // Is DSH showing a dark surface? Read from the page itself, so it follows whatever theme the person picked.
    function darkSurface() {
      try {
        for (const el of [document.querySelector('.dsh-radio-panel'), document.body, document.documentElement]) {
          const m = el && getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
          if (m && m.length >= 3 && !(m.length === 4 && Number(m[3]) === 0)) return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 < 0.5;
        }
      } catch {}
      return true;
    }
    function AmpLogo(props) {
      const size = (props && props.size) || 14;
      return h('img', {
        src: darkSurface() ? AMP_LOGO_WHITE : AMP_LOGO,
        alt: 'AMP',
        className: (props && props.className) || 'dsh-radio-pill-logo',
        style: {height: size + 'px', width: 'auto', display: 'block'},
        'aria-hidden': true,
      });
    }

    function StationRow(props) {
      const s = props.station;
      if (!s || !s.id) return null;
      const active = props.current && props.current.url === s.url;
      const meta = [s.country, s.codec].filter(Boolean).join(' · ');
      const isFav = props.favs && props.favs.has(s.id);
      return h('div', {
        key: s.id,
        className: 'dsh-radio-station' + (active ? ' dsh-radio-station-active' : ''),
        onClick: () => props.onPlay(s.url, s.name),
      },
        h('span', {className: 'dsh-radio-station-main'},
          h('span', {className: 'dsh-radio-station-name'}, s.name),
          meta ? h('span', {className: 'dsh-radio-station-meta'}, meta) : null
        ),
        h('button', {
          type: 'button',
          className: 'dsh-radio-star' + (isFav ? ' dsh-radio-star-active' : ''),
          'aria-label': isFav ? 'Remove favourite' : 'Add favourite',
          onClick: (e) => { e.stopPropagation(); props.onFav(s); },
        },
          h('svg', {viewBox: '0 0 24 24', width: 14, height: 14, fill: isFav ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true},
            h('path', {d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'})
          )
        )
      );
    }

    // Module-level audio: survives component unmount (session switch).
    let sharedAudio = null;
    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    function getSharedAudio() {
      if (!sharedAudio) {
        sharedAudio = document.createElement('audio');
        sharedAudio.preload = 'none';
        sharedAudio.crossOrigin = 'anonymous';
        sharedAudio.style.display = 'none';
        document.body.appendChild(sharedAudio);
      }
      return sharedAudio;
    }

    // Web Audio API setup for visualizer. Returns null where Web Audio is
    // unavailable: audio still plays, only the visualizer is skipped.
    function ensureAudioContext() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return { ctx: null, analyser: null };
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        sourceNode = audioCtx.createMediaElementSource(getSharedAudio());
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      }
      return { ctx: audioCtx, analyser };
    }

    function RadioPillInner({container}) {
      useBarSettings();
      const floating = !container || container.dataset.docked !== 'true';
      const audioRef = React.useRef(null);
      const pillRef = React.useRef(null);
      const panelRef = React.useRef(null);
      const canvasRef = React.useRef(null);
      const pillCanvasRef = React.useRef(null);
      const [open, setOpen] = React.useState(false);
      const [closing, setClosing] = React.useState(false);
      const [current, setCurrent] = React.useState(null);
      const [playing, setPlaying] = React.useState(false);
      const [loading, setLoading] = React.useState(false);
      const [error, setError] = React.useState(null);
      const [volume, setVolume] = React.useState(() => {
        try { const v = localStorage.getItem('dsh-radio-volume'); return v !== null ? Number(v) : 0.8; } catch { return 0.8; }
      });
      const [query, setQuery] = React.useState('');
      const [pos, setPos] = React.useState(null);
      // Draggable pill: null = docked bottom-center (CSS default). Saved to localStorage.
      const [pillPos, setPillPos] = React.useState(() => {
        try {
          const p = JSON.parse(localStorage.getItem('dsh-radio-pill-pos') || 'null');
          if (p && isFinite(p.left) && isFinite(p.top)
              && p.left >= 0 && p.top >= 0
              && p.left <= window.innerWidth - 40 && p.top <= window.innerHeight - 24) return p;
        } catch {}
        return null;
      });
      const justDraggedRef = React.useRef(false);
      // Re-clamp a saved spot the viewport outgrows (resolution change / window move).
      React.useEffect(() => {
        const onResize = () => {
          setPillPos(prev => {
            if (!prev) return prev;
            if (prev.left <= window.innerWidth - 40 && prev.top <= window.innerHeight - 24) return prev;
            try { localStorage.removeItem('dsh-radio-pill-pos'); } catch {}
            return null;
          });
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
      }, []);
      const [results, setResults] = React.useState(null);
      const [searching, setSearching] = React.useState(false);
      const [searchError, setSearchError] = React.useState(null);
      const [favs, setFavs] = React.useState(() => {
        try {
          const arr = JSON.parse(localStorage.getItem('dsh-radio-favs') || '[]');
          return new Map(arr.filter(s => s && s.id).map(s => [s.id, s]));
        } catch { return new Map(); }
      });
      const [updateState, setUpdateState] = React.useState('idle'); // idle | checking | available | up-to-date
      const [view, setView] = React.useState('radio'); // radio | bar (stats bar settings) | borrow (Borrow my AI)

      // Derived values (must be declared before any useEffect that references them).
      const label = current ? current.name : '';
      const statusText = loading ? 'Loading…' : playing ? 'Playing' : current ? 'Paused' : 'Off';
      const showSearch = query.trim().length > 0;
      const list = showSearch
        ? (searching && !results ? [] : (results || []))
        : [...favs.values(), ...STATIONS.filter(s => !favs.has(s.id))].filter(s => s && s.id);

      async function checkForUpdates() {
        setUpdateState('checking');
        try {
          // Current = our own installed manifest (no hardcoded version).
          const localRes = await fetch('/plugins/dsh-amp-radio/manifest.json', {cache: 'no-store'});
          const local = localRes.ok ? await localRes.json() : {};
          const current = local.version || '0.0.0';
          // Latest = GitHub raw manifest. Offline failure falls through to up-to-date.
          let latest = null;
          try {
            const rem = await fetch('https://raw.githubusercontent.com/tonyous/DSH-AMP-Radio/master/manifest.json', {cache: 'no-store'});
            if (rem.ok) latest = (await rem.json()).version;
          } catch {}
          if (latest && latest !== current) {
            setUpdateState('available');
            try { localStorage.setItem('dsh-radio-update', JSON.stringify({version: latest})); } catch {}
            return;
          }
          setUpdateState('up-to-date');
          setTimeout(() => setUpdateState('idle'), 2000);
        } catch {
          setUpdateState('idle');
        }
      }

      // On mount, sync state from the shared audio (survives session switch).
      React.useEffect(() => {
        const a = getSharedAudio();
        audioRef.current = a;
        a.volume = volume;
        // Sync playing state if audio is already playing from a previous session.
        if (!a.paused && a.src) {
          setPlaying(true);
          setCurrent(prev => prev || {name: 'Radio', url: a.src});
        } else {
          // Restore last station from localStorage (not playing, just remembered).
          try {
            const saved = JSON.parse(localStorage.getItem('dsh-radio-last') || 'null');
            if (saved && saved.name && saved.url) {
              setCurrent(prev => prev || saved);
            }
          } catch {}
        }
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        a.addEventListener('play', onPlay);
        a.addEventListener('pause', onPause);
        return () => {
          a.removeEventListener('play', onPlay);
          a.removeEventListener('pause', onPause);
        };
      }, []);

      React.useEffect(() => {
        const a = audioRef.current;
        if (a) a.volume = volume;
        try { localStorage.setItem('dsh-radio-volume', String(volume)); } catch {}
      }, [volume]);

      // ── Volume ducking: Apple-smooth, every scenario handled ──
      const [ducking, setDucking] = React.useState(false);
      const duckingRef = React.useRef(false);
      const originalVolRef = React.useRef(null);
      const volumeRef = React.useRef(volume);
      const lastEnterRef = React.useRef(0);
      const fadeRafRef = React.useRef(null);
      React.useEffect(() => { volumeRef.current = volume; }, [volume]);

      // Smooth fade with ease-out cubic (fast start, gentle finish)
      const fadeVolume = (from, to, duration) => {
        if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
        if (Math.abs(from - to) < 0.001) return;
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setVolume(from + (to - from) * eased);
          if (t < 1) fadeRafRef.current = requestAnimationFrame(step);
        };
        fadeRafRef.current = requestAnimationFrame(step);
      };

      React.useEffect(() => {
        // Single MutationObserver catches ALL composer changes:
        // typing, backspace, paste, cut, select-all-delete, app clear
        const composerEl = document.querySelector('[contenteditable=true]');
        let observer = null;
        if (composerEl) {
          observer = new MutationObserver(() => {
            const text = (composerEl.textContent || '').trim();
            if (text.length === 0) {
              // Composer emptied → restore volume
              if (duckingRef.current) {
                duckingRef.current = false;
                setDucking(false);
              }
            } else if (!duckingRef.current) {
              // Composer has content → start ducking
              if (Date.now() - lastEnterRef.current < 600) return;
              originalVolRef.current = volumeRef.current;
              duckingRef.current = true;
              setDucking(true);
            }
          });
          observer.observe(composerEl, { childList: true, characterData: true, subtree: true });
        }

        // Enter → restore
        const onKeyDown = (e) => {
          if (e.key === 'Enter' && duckingRef.current) {
            lastEnterRef.current = Date.now();
            duckingRef.current = false;
            setDucking(false);
          }
        };
        document.addEventListener('keydown', onKeyDown, true);

        // Click away → restore (150ms delay to let click propagate)
        const onBlur = () => {
          setTimeout(() => {
            if (duckingRef.current) {
              duckingRef.current = false;
              setDucking(false);
            }
          }, 150);
        };
        document.addEventListener('focusout', onBlur, true);

        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          document.removeEventListener('focusout', onBlur, true);
          if (observer) observer.disconnect();
        };
      }, []);

      // Fade down: 50% reduction (subtle, never mutes)
      React.useEffect(() => {
        if (!ducking) return undefined;
        const from = volumeRef.current;
        const to = from * 0.5;
        fadeVolume(from, to, 250);
        return () => { if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current); };
      }, [ducking]);

      // Fade up: restore to original
      React.useEffect(() => {
        if (ducking) return undefined;
        const target = originalVolRef.current;
        if (target === null) return undefined;
        const from = volumeRef.current;
        fadeVolume(from, target, 350);
        originalVolRef.current = null;
        return () => { if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current); };
      }, [ducking]);

      // Only scroll the pill label if the text actually overflows.
      // Close on outside click or Escape key.
      React.useEffect(() => {
        if (!open) return undefined;
        const clickHandler = (e) => {
          const pill = pillRef.current;
          const panel = panelRef.current;
          if (pill && pill.contains(e.target)) return;
          if (panel && panel.contains(e.target)) return;
          closePanel();
        };
        const keyHandler = (e) => {
          if (e.key === 'Escape') closePanel();
          // Never hijack typing: space in search/inputs must type a space.
          const t = e.target;
          const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
          if (e.key === ' ' && !typing && panelRef.current && panelRef.current.contains(document.activeElement)) {
            e.preventDefault();
            toggle();
          }
        };
        document.addEventListener('mousedown', clickHandler);
        document.addEventListener('keydown', keyHandler);
        return () => {
          document.removeEventListener('mousedown', clickHandler);
          document.removeEventListener('keydown', keyHandler);
        };
      }, [open]);

      React.useEffect(() => {
        if (!open) return undefined;
        const update = () => {
          const el = pillRef.current;
          const panel = panelRef.current;
          if (!el) {
            return;
          }
          const r = el.getBoundingClientRect();
          const panelH = panel ? panel.offsetHeight : 520;
          const width = 320;
          const left = Math.min(window.innerWidth - width - 12, Math.max(12, r.left));
          // Try to place above the pill first
          let top = r.top - panelH - 12;
          // If not enough room above, place below the pill
          if (top < 12) {
            top = r.bottom + 12;
          }
          // Ensure the panel fits in the viewport
          if (top + panelH > window.innerHeight - 12) {
            top = Math.max(12, window.innerHeight - panelH - 12);
          }
          setPos({top, left});
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
      }, [open]);

      // Audio visualizer animation loop.
      React.useEffect(() => {
        if (!open || !pos) return undefined;
        let animId;
        let cancelled = false;
        
        // Use requestAnimationFrame to ensure the canvas is in the DOM before starting.
        const start = requestAnimationFrame(() => {
          const canvas = canvasRef.current;
          if (!canvas || cancelled) return;
          const ctx2d = canvas.getContext('2d');
          let { analyser: a } = ensureAudioContext();
          if (!a) return;
          const data = new Uint8Array(a.frequencyBinCount);

          function draw() {
            if (cancelled) return;
            animId = requestAnimationFrame(draw);
            a.getByteFrequencyData(data);
            const w = canvas.width;
            const h = canvas.height;
            ctx2d.clearRect(0, 0, w, h);

            const barCount = 32;
            const barWidth = w / barCount;
            const step = Math.floor(data.length / barCount);

            for (let i = 0; i < barCount; i++) {
              const v = data[i * step] / 255;
              const barHeight = v * h * 0.9;
              const x = i * barWidth;
              const y = h - barHeight;

              const grad = ctx2d.createLinearGradient(0, y, 0, h);
              grad.addColorStop(0, '#4c8dff');
              grad.addColorStop(1, '#1a3a6e');
              ctx2d.fillStyle = grad;
              ctx2d.fillRect(x + 1, y, barWidth - 2, barHeight);
            }
          }
          draw();
        });
        
        return () => {
          cancelled = true;
          cancelAnimationFrame(start);
          if (animId) cancelAnimationFrame(animId);
        };
      }, [open, pos]);

      // Pill visualizer: one persistent loop for the component lifetime, driven by the
      // ELEMENT itself (React `playing` state desynced and left the pill dead twice).
      // Draws live bars, static bars for CORS-silent streams, clears when idle.
      React.useEffect(() => {
        let animId;
        let cancelled = false;
        let data = null;
        let flatFrames = 0;
        let analyser = null;
        const tick = () => {
          if (cancelled) return;
          animId = requestAnimationFrame(tick);
          const el = audioRef.current;
          const canvas = pillCanvasRef.current;
          if (!canvas) return;
          const ctx2d = canvas.getContext('2d');
          const live = !!(el && !el.paused && el.src);
          if (!live) {
            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            if (canvas.style.display !== 'none') canvas.style.display = 'none';
            flatFrames = 0;
            return;
          }
          if (canvas.style.display === 'none') canvas.style.display = '';
          if (!analyser) {
            const got = ensureAudioContext();
            analyser = got.analyser;
            if (!analyser) return;
            if (analyser.context && analyser.context.state === 'suspended') {
              try { analyser.context.resume(); } catch {}
            }
          }
          const a = analyser;
          if (!data || data.length !== a.frequencyBinCount) data = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(data);
          let peak = 0;
          for (let k = 0; k < data.length; k++) if (data[k] > peak) peak = data[k];
          const w = canvas.width;
          const h = canvas.height;
          ctx2d.clearRect(0, 0, w, h);
          if (peak === 0) {
            if (++flatFrames < 60) return;
            ctx2d.fillStyle = '#4c8dff';
            for (let i = 0; i < 5; i++) {
              const bh = h * 0.45;
              ctx2d.fillRect(i * (w / 5) + 1, h - bh, w / 5 - 2, bh);
            }
            return;
          }
          flatFrames = 0;
          const barCount = 5;
          const barWidth = w / barCount;
          const step = Math.floor(data.length / barCount);
          for (let i = 0; i < barCount; i++) {
            const v = data[i * step] / 255;
            const barHeight = Math.max(2, v * h * 0.9);
            const x = i * barWidth;
            const y = h - barHeight;
            const grad = ctx2d.createLinearGradient(0, y, 0, h);
            grad.addColorStop(0, '#4c8dff');
            grad.addColorStop(1, '#1a3a6e');
            ctx2d.fillStyle = grad;
            ctx2d.fillRect(x + 1, y, barWidth - 2, barHeight);
          }
        };
        animId = requestAnimationFrame(tick);
        return () => {
          cancelled = true;
          cancelAnimationFrame(animId);
        };
      }, []);

      // Debounced live search across the station directory.
      React.useEffect(() => {
        const q = query.trim();
        if (!q) { setResults(null); setSearchError(null); setSearching(false); return undefined; }
        setSearching(true);
        setSearchError(null);
        let cancelled = false;
        const timer = setTimeout(async () => {
          try {
            const found = await searchStations(q);
            if (!cancelled) { setResults(found); setSearching(false); }
          } catch (e) {
            if (!cancelled) {
              const idx = API_HOSTS.indexOf(apiHost);
              const next = API_HOSTS[(idx + 1) % API_HOSTS.length];
              try {
                apiHost = next;
                const found = await searchStations(q);
                if (!cancelled) { setResults(found); setSearching(false); }
              } catch (e2) {
                setResults([]); setSearching(false);
                setSearchError('Search failed — check your connection.');
              }
            }
          }
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
      }, [query]);

      const closingRef = React.useRef(false);
      function closePanel() {
        if (closingRef.current) return;
        closingRef.current = true;
        setClosing(true);
        setTimeout(() => {
          setOpen(false);
          setClosing(false);
          closingRef.current = false;
        }, 150);
      }

      // Click-hold-drag to move the pill anywhere. A drag (moved >5px) never
      // toggles the panel — justDraggedRef swallows the follow-up click.
      function startDrag(e) {
        if (e.button !== 0) return;
        const el = pillRef.current;
        if (!el) return;
        e.preventDefault();
        const startX = e.clientX, startY = e.clientY;
        const r = el.getBoundingClientRect();
        const offX = startX - r.left, offY = startY - r.top;
        const last = {moved: false, left: 0, top: 0};
        justDraggedRef.current = false;
        const onMove = (ev) => {
          if (!last.moved && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 5) return;
          last.moved = true;
          justDraggedRef.current = true;
          last.left = Math.min(window.innerWidth - 40, Math.max(0, ev.clientX - offX));
          last.top = Math.min(window.innerHeight - 24, Math.max(0, ev.clientY - offY));
          setPillPos({left: last.left, top: last.top});
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          if (last.moved) {
            try { localStorage.setItem('dsh-radio-pill-pos', JSON.stringify({left: last.left, top: last.top})); } catch {}
          }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      }

      function play(url, name) {
        const a = audioRef.current;
        if (!a) return;
        setError(null);
        setLoading(true);
        setCurrent({name, url});
        try { localStorage.setItem('dsh-radio-last', JSON.stringify({name, url})); } catch {}
        // Ensure audio context is created and resumed before playing.
        ensureAudioContext();
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume();
        }
        a.src = url;
        a.play().then(() => {
          setPlaying(true);
          setLoading(false);
        }).catch(() => {
          setError('This stream cannot be played.');
          setPlaying(false);
          setLoading(false);
        });
      }

      function toggle() {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
          if (a.src) {
            a.play().then(() => setPlaying(true)).catch(() => setError('Cannot resume.'));
          } else if (current) {
            play(current.url, current.name);
          }
        } else {
          a.pause();
          setPlaying(false);
        }
      }

      function stop() {
        const a = audioRef.current;
        if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
        setPlaying(false);
        setLoading(false);
        setError(null);
        setCurrent(null);
      }

      function toggleFav(s) {
        setFavs(prev => {
          const next = new Map(prev);
          if (next.has(s.id)) { next.delete(s.id); }
          else { next.set(s.id, {id: s.id, name: s.name, url: s.url, country: s.country || '', codec: s.codec || ''}); }
          try { localStorage.setItem('dsh-radio-favs', JSON.stringify([...next.values()])); } catch {}
          return next;
        });
      }

      return h(React.Fragment, null,
        h('button', {
          ref: pillRef, type: 'button', className: 'dsh-radio-pill ' + (floating ? 'dsh-radio-pill-fixed' : 'dsh-radio-pill-docked'),
          'aria-expanded': open, 'aria-haspopup': 'dialog',
          'aria-label': 'AMP Radio: ' + statusText,
          onClick: () => {
            try {
              if (justDraggedRef.current) { justDraggedRef.current = false; return; }
              if (open) closePanel();
              else setOpen(true);
            } catch (e) {
              // Ignore
            }
          },
          onMouseDown: floating ? startDrag : undefined,
          style: floating && pillPos ? {left: pillPos.left + 'px', top: pillPos.top + 'px', transform: 'none', bottom: 'auto'} : undefined,
        },
          h(AmpLogo, {size: 10}),
          loading ? h('span', {className: 'dsh-radio-pill-label dsh-radio-pill-loading'}, 'Connecting…') : null,
          h('canvas', {
            ref: (el) => { pillCanvasRef.current = el; },
            className: 'dsh-radio-pill-visualizer',
            width: 36,
            height: 14,
            'aria-hidden': true,
          })
        ),
        open && pos && createPortal(h('div', {
          ref: panelRef,
          className: 'dsh-radio-panel' + (closing ? ' dsh-radio-panel-closing' : '') + (view === 'bar' ? ' dsh-radio-panel-bar' : '') + (view === 'borrow' ? ' dsh-radio-panel-borrow' : ''),
          role: 'dialog', 'aria-label': 'AMP Radio',
          style: pos,
        },
          h('div', {className: 'dsh-radio-title'},
            h(AmpLogo, {size: 12, className: 'dsh-radio-title-logo'}),
            h('a', {
              href: 'https://get-amp.com',
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'dsh-radio-title-link',
              'aria-label': 'Visit get-amp.com'
            }, 'get-amp.com'),
            h('a', {
              href: 'https://discord.gg/hr3zfQmyVQ',
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'dsh-radio-title-discord',
              'aria-label': 'Join our Discord'
            },
              h('svg', {viewBox: '0 0 24 24', width: 14, height: 14, fill: 'currentColor', 'aria-hidden': true},
                h('path', {d: 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.89.078.078 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.291.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.09.242.18.37.291a.078.078 0 0 1-.008.128 12.6 12.6 0 0 1-1.873.89.076.076 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.078.078 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.67a.061.061 0 0 0-.031-.029zM8.02 15.33c-1.183 0-2.157-.984-2.157-2.196 0-1.21.955-2.194 2.157-2.194 1.21 0 2.176.994 2.157 2.194 0 1.212-.956 2.196-2.157 2.196zm7.975 0c-1.183 0-2.157-.984-2.157-2.196 0-1.21.955-2.194 2.157-2.194 1.21 0 2.176.994 2.157 2.194 0 1.212-.946 2.196-2.157 2.196z'}))
            ),
            h('button', {
              type: 'button',
                className: 'dsh-radio-title-update' + (updateState === 'checking' ? ' spinning' : '') + (updateState === 'available' ? ' available' : '') + (updateState === 'up-to-date' ? ' up-to-date' : ''),
                'aria-label': updateState === 'available' ? 'Update available (green) — reinstall plugin to update' : updateState === 'up-to-date' ? 'Up to date ✓' : updateState === 'checking' ? 'Checking for updates…' : 'Check for updates',
                title: updateState === 'available' ? 'Update available — reinstall plugin to update' : updateState === 'up-to-date' ? 'Up to date ✓' : updateState === 'checking' ? 'Checking for updates…' : 'Check for updates',
              onClick: checkForUpdates,
            },
              h('svg', {viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true},
                h('path', {d: 'M21 12a9 9 0 1 1-2.64-6.36'}),
                h('path', {d: 'M21 3v6h-6'})
              )
            ),
            h('button', {type: 'button', className: 'dsh-radio-title-update' + (view === 'bar' ? ' up-to-date' : ''), style: {marginLeft: 0},
              'aria-label': 'Stats bar settings', title: 'Stats bar settings', 'aria-pressed': view === 'bar',
              onClick: () => setView(view === 'bar' ? 'radio' : 'bar')},
              h('svg', {viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', 'aria-hidden': true},
                h('path', {d: 'M4 7h10M18 7h2M4 17h4M12 17h8'}), h('circle', {cx: 16, cy: 7, r: 2}), h('circle', {cx: 10, cy: 17, r: 2}))),
            h('button', {type: 'button', className: 'dsh-radio-title-update' + (view === 'borrow' ? ' amp-borrow-on' : ''), style: {marginLeft: 0},
              'aria-label': 'Borrow my AI', title: 'Borrow my AI', 'aria-pressed': view === 'borrow',
              onClick: () => setView(view === 'borrow' ? 'radio' : 'borrow')}, h(ILink)),
            h('button', {type: 'button', className: 'dsh-radio-close', 'aria-label': 'Close', onClick: closePanel}, '×')
          ),
          view === 'bar' ? h(BarSettings, {onBack: () => setView('radio')}) : null,
          view === 'borrow' ? h(BorrowView) : null,
          h('div', {className: 'dsh-radio-transport'},
            h('button', {type: 'button', className: 'dsh-radio-btn', disabled: !current, onClick: toggle, 'aria-label': playing ? 'Pause' : 'Play'},
              playing
                ? h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true}, h('rect', {x: 6, y: 4, width: 4, height: 16, rx: 1}), h('rect', {x: 14, y: 4, width: 4, height: 16, rx: 1}))
                : h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true}, h('path', {d: 'M8 5v14l11-7z'}))
            ),
            h('button', {type: 'button', className: 'dsh-radio-btn', disabled: !current, onClick: stop, 'aria-label': 'Stop'},
              h('svg', {viewBox: '0 0 24 24', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true}, h('rect', {x: 6, y: 6, width: 12, height: 12, rx: 2}))
            )
          ),
          h('div', {className: 'dsh-radio-volume'},
            h('input', {id: 'dsh-radio-vol', type: 'range', min: 0, max: 1, step: 0.01, value: volume, 'aria-label': 'Volume', onChange: e => setVolume(Number(e.target.value))})
          ),
          current ? h('div', {className: 'dsh-radio-now'},
            h('div', {className: 'dsh-radio-now-name'}, current.name),
            (current.country || current.codec) ? h('div', {className: 'dsh-radio-now-meta'}, [current.country, current.codec].filter(Boolean).join(' · ')) : null
          ) : null,
          h('div', {className: 'dsh-radio-search'},
            h('input', {
              type: 'search', className: 'dsh-radio-search-input',
              placeholder: 'Search all stations…', value: query,
              'aria-label': 'Search stations',
              onChange: e => setQuery(e.target.value),
            })
          ),
          h('div', {className: 'dsh-radio-section'}, showSearch ? 'Results' : (favs.size > 0 ? 'Favourites' : 'Stations')),
          h('div', {className: 'dsh-radio-stations'},
            list.length === 0
              ? h('div', {className: 'dsh-radio-empty'},
                  searching ? 'Searching…' : (searchError ? searchError : 'No stations found.'))
              : list.map(s => h(StationRow, {
                  key: s.id, station: s, current: current, playing: playing, onPlay: play,
                  favs: favs, onFav: toggleFav,
                }))
          ),
          h('canvas', {
            ref: (el) => { canvasRef.current = el; },
            className: 'dsh-radio-visualizer',
            width: 280,
            height: 60,
            'aria-label': 'Audio visualizer',
          })
        ), document.body)
      );
    }

    // Body-portal wrapper: the pill must survive session switches, route changes and
    // composer remounts (the reported bug was music playing with no pill: the old pill
    // lived in the composer dock container that gets torn down). The slot registration
    // below only anchors this stub; the real UI lives on document.body and cleans up
    // its container on unmount.
    function RadioPill() {
      const el = React.useMemo(() => {
        const node = document.createElement('div');
        document.body.appendChild(node);
        return node;
      }, []);
      React.useEffect(() => () => { el.remove(); }, [el]);
      // "In the bar": put this container into the AMP holder (header in Top mode, under the message box in Bottom
      // mode). "Floating" or no holder on screen: back on the page body. Only our own container moves.
      React.useEffect(() => {
        const place = () => {
          let host = document.body;
          if ((barSettings.amp || 'bar') === 'bar') {
            const want = document.documentElement.dataset.ampBarLive === 'top' ? 'top' : 'bottom';
            const found = [...document.querySelectorAll('[data-amp-host="' + want + '"]')].find(x => x.isConnected && x.getClientRects().length);
            if (found) host = found;
          }
          if (el.parentNode !== host) host.appendChild(el);
          const docked = host !== document.body;
          if (el.dataset.docked !== String(docked)) { el.dataset.docked = String(docked); barSettings = {...barSettings}; barNotify(); }
        };
        place();
        const t = setInterval(place, 400);
        return () => clearInterval(t);
      }, [el]);
      return createPortal(h(RadioPillInner, {container: el}), el);
    }

    // ===================== AMP Bar (2.0) =====================
    // One place to control every pill under the message box (DSH's own pills, the live tok/s pill, hardware pills,
    // AMP's own stats, the AMP radio pill): switch each one on or off, and put them at the TOP of the chat (in the
    // empty header space) or at the BOTTOM. Top mode never clips: pills that do not fit go into a "+N" button.
    // Fallbacks: no header (new-chat page) -> bottom layout; settings server missing -> this browser's copy;
    // any error -> the bar is left exactly as DSH draws it.
    const BAR_PILLS = [
      {key: 'activity', label: 'Turns & speed', hide: '[data-composer-stat="activity"]'},
      {key: 'usage', label: 'Tokens & cache', hide: '[data-composer-stat="usage"]'},
      {key: 'live', label: 'Live tok/s', hide: '[data-composer-stat="live"]'},
      {key: 'cpu', label: 'CPU', hide: 'button[aria-label^="CPU:"],[data-amp-stat="cpu"]'},
      {key: 'ram', label: 'RAM', hide: 'button[aria-label^="RAM:"],[data-amp-stat="ram"]'},
      {key: 'gpu', label: 'GPU', hide: 'button[aria-label^="GPU:"],[data-amp-stat="gpu"]'},
      {key: 'vram', label: 'VRAM', hide: 'button[aria-label^="VRAM:"],[data-amp-stat="vram"]'},
      {key: 'ramcache', label: 'RAM cache', hide: 'button[aria-label^="RAM cache:"]'},
      {key: 'effort', label: 'Reasoning effort', hide: 'button[aria-label^="Effort:"]'},
      {key: 'vision', label: 'Vision', hide: 'button[aria-label^="Vision:"]'},
      {key: 'context', label: 'Context', hide: 'button[aria-label^="Context:"]'},
      {key: 'compact', label: 'Auto compact', hide: 'button[aria-label^="Auto compact:"]'},
      {key: 'ring', label: 'Context ring', hide: 'span:has(> button[aria-label$="of context used"])'},
      {key: 'tasks', label: 'Task timer', hide: '[data-amp-stat="tasks"]'},
      {key: 'eta', label: 'Time to finish', hide: '[data-amp-stat="eta"]'},
      {key: 'amp', label: 'AMP radio', hide: '.dsh-radio-pill'},
    ];
    const BAR_DEFAULT = {position: 'top', amp: 'bar', off: {}};
    const NEW_KEYS = ['tasks', 'eta'];   // added in 2.1.0
    const BAR_LOCAL = 'amp-bar-settings';
    let barSettings = (() => {
      try { return {...BAR_DEFAULT, ...JSON.parse(localStorage.getItem(BAR_LOCAL) || '{}')}; } catch { return {...BAR_DEFAULT}; }
    })();
    const barListeners = new Set();
    const barNotify = () => barListeners.forEach(fn => { try { fn(); } catch {} });
    function useBarSettings() {
      return React.useSyncExternalStore(fn => { barListeners.add(fn); return () => barListeners.delete(fn); }, () => barSettings, () => barSettings);
    }
    async function loadBarSettings() {
      try {
        const r = await fetch('/api/amp-bar/settings', {credentials: 'same-origin', cache: 'no-store'});
        if (!r.ok) return;
        const s = await r.json();
        if (s && typeof s === 'object' && s.position) {
          // 2.1: a host older than this page forgets switches it does not know (tasks, eta): keep this browser's
          const keep = {}; for (const k of NEW_KEYS) if (barSettings.off?.[k] && !(s.off && k in s.off)) keep[k] = true;
          barSettings = {...BAR_DEFAULT, ...s, off: {...(s.off || {}), ...keep}}; saveLocal(); applyBarCss(); barNotify();
        }
      } catch {}
    }
    function saveLocal() { try { localStorage.setItem(BAR_LOCAL, JSON.stringify(barSettings)); } catch {} }
    function setBarSettings(next) {
      if (next.position) barTopRetry = true;
      barSettings = {...barSettings, ...next};
      saveLocal(); applyBarCss(); barNotify();
      // Saved on the DSH server too, so the phone and the PC share the same choice.
      fetch('/api/amp-bar/settings', {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'},
        body: JSON.stringify(barSettings)}).catch(() => {});
    }
    let barStyleEl = null;
    function applyBarCss() {
      if (!barStyleEl) return;
      const off = BAR_PILLS.filter(p => barSettings.off[p.key]).map(p => p.hide.split(',').map(s => s.trim() + '{display:none!important}').join(''));
      barStyleEl.textContent = off.join('');
      document.documentElement.dataset.ampBarPos = barSettings.position === 'bottom' ? 'bottom' : 'top';
    }
    const barCss = `
/* Bottom (and the fallback): rows wrap instead of scrolling off the screen */
[data-composer-card]+div [data-hardware-stats]{flex-wrap:wrap!important;overflow:visible!important;row-gap:2px;padding-left:8px!important;padding-right:8px!important}
[data-composer-card]+div{flex-wrap:wrap;row-gap:2px}
@media (max-width:640px){
 [data-composer-card]+div [data-composer-stat],[data-composer-card]+div [data-hardware-stats] button,[data-amp-stat]{font-size:12px!important;padding:1px 6px!important;gap:4px!important}
 [data-composer-card]+div [data-hardware-stats]{gap:0 2px!important}
}
/* Top: the anchor fills the empty middle of the chat header */
[class*="headerActions"]:has(.amp-bar-anchor){flex:1 1 auto;min-width:0}
.amp-bar-anchor{flex:1 1 auto;min-width:0;height:28px;display:flex;align-items:center;justify-content:flex-end;position:relative}
.amp-bar-chip{flex:none;height:24px;border:0;border-radius:12px;padding:0 9px;margin-left:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;font-variant-numeric:tabular-nums}
.amp-bar-chip:hover,.amp-bar-chip[aria-expanded=true]{color:var(--dsw-alias-label-primary)}
html[data-amp-bar-live=top] [data-composer-card]+div{position:fixed!important;z-index:30;left:var(--amp-bar-x);top:var(--amp-bar-y);width:var(--amp-bar-w);height:var(--amp-bar-h,28px);margin:0!important;padding:0!important;display:flex!important;flex-wrap:wrap!important;align-items:center;align-content:flex-start;justify-content:flex-end;gap:var(--amp-bar-gap,0px) 2px;overflow:hidden;background:none}
html[data-amp-bar-live=top] [data-composer-card]+div [data-composer-stat],html[data-amp-bar-live=top] [data-composer-card]+div [data-hardware-stats]>*,html[data-amp-bar-live=top] [data-amp-stat],html[data-amp-bar-live=top] [data-composer-card]+div>span{height:28px;box-sizing:border-box}
html[data-amp-bar-live=top] [data-composer-card]+div>*,html[data-amp-bar-live=top] [data-composer-card]+div [data-composer-stats],html[data-amp-bar-live=top] [data-composer-card]+div [data-hardware-stats],html[data-amp-bar-live=top] [data-composer-card]+div .dsh-hw-row{display:contents!important}
html[data-amp-bar-live=top] [data-amp-over]{display:none!important}
html[data-amp-bar-live=top][data-amp-bar-open] [data-composer-card]+div{left:auto;right:var(--amp-bar-r);top:calc(var(--amp-bar-y) + var(--amp-bar-h,28px) + 6px);width:auto;max-width:min(620px,calc(100vw - 24px));height:auto;max-height:70vh;overflow:auto;justify-content:flex-start;padding:8px!important;gap:4px!important;border-radius:12px;background:var(--dsw-specific-menu,#1c1c1e);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.45));z-index:1000}
html[data-amp-bar-live=top][data-amp-bar-open] [data-amp-over]{display:inline-flex!important}
.amp-bar-settings{padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px;font-size:13px}
.amp-bar-settings h3{margin:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.amp-bar-seg{display:flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover)}
.amp-bar-seg button{flex:1;border:0;border-radius:6px;padding:5px 8px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
.amp-bar-seg button[aria-checked=true]{background:var(--dsw-specific-menu,#2a2a2c);color:var(--dsw-alias-label-primary);font-weight:500}
.amp-bar-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2))}
.amp-bar-row small{color:var(--dsw-alias-label-tertiary)}
.amp-bar-switch{position:relative;width:34px;height:20px;border-radius:10px;border:0;background:var(--dsw-alias-interactive-bg-hover);cursor:pointer;flex:none}
.amp-bar-switch::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .15s}
.amp-bar-switch[aria-checked=true]{background:var(--dsw-static-blue-450,#3b82f6)}
.amp-bar-switch[aria-checked=true]::after{transform:translateX(14px);background:#fff}
html[data-amp-bar-live=compact] [data-composer-card]+div{display:flex!important;flex-wrap:wrap!important;justify-content:center;align-items:center;height:28px;overflow:hidden;position:relative;width:100%!important;max-width:100%!important;min-width:0!important;align-self:stretch;padding:0 var(--amp-bar-reserve) 0 4px!important;gap:0 2px;box-sizing:border-box}
html[data-amp-bar-live=compact] [data-composer-card]+div>*,html[data-amp-bar-live=compact] [data-composer-card]+div [data-composer-stats],html[data-amp-bar-live=compact] [data-composer-card]+div [data-hardware-stats],html[data-amp-bar-live=compact] [data-composer-card]+div .dsh-hw-row,html[data-amp-bar-live=compact] .amp-stats{display:contents!important}
html[data-amp-bar-live=compact] [data-amp-host=bottom]{position:absolute;right:4px;top:2px;margin:0}
[data-amp-w]{justify-content:center!important;box-sizing:border-box}
[data-composer-card]+div [data-composer-stat],[data-composer-card]+div [data-hardware-stats] button,[data-amp-stat]{font-variant-numeric:tabular-nums}
html[data-amp-bar-live] [data-composer-card]+div [data-composer-stat],html[data-amp-bar-live] [data-composer-card]+div [data-composer-stat] *{flex-shrink:0;max-width:none!important;text-overflow:clip!important}
html[data-amp-bar-live=compact] [data-amp-over]{display:none!important}
html[data-amp-bar-live=compact][data-amp-bar-open] [data-composer-card]+div{height:auto;max-height:60vh;overflow:auto;padding:8px 8px 34px!important;gap:4px!important;border-radius:12px;background:var(--dsw-specific-menu,#1c1c1e)}
html[data-amp-bar-live=compact][data-amp-bar-open] [data-amp-host=bottom]{top:auto;bottom:6px}
html[data-amp-bar-live=compact][data-amp-bar-open] [data-amp-over]{display:inline-flex!important}
.amp-bar-amp-host{display:inline-flex;align-items:center;flex:none;margin-left:6px}
.amp-bar-amp-host:empty{margin:0}
.dsh-radio-pill-docked{height:22px;overflow:hidden;align-items:center}
.amp-bar-note{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:17px;margin:0}
`;

    const PILL_SEL = '[data-composer-stat],[data-hardware-stats]>button,[data-hardware-stats]>span,[data-amp-stat],button[aria-label$="of context used"]';
    let barOverflow = 0, barOpen = false, barTopRetry = false, barMode = '';
    const flowListeners = new Set();
    const flowNotify = () => flowListeners.forEach(fn => { try { fn(); } catch {} });
    const useFlow = () => React.useSyncExternalStore(fn => { flowListeners.add(fn); return () => flowListeners.delete(fn); }, () => barOverflow + (barOpen ? ':open' : ''), () => '0');
    function setOpen(v) {
      barOpen = v;
      if (v) document.documentElement.dataset.ampBarOpen = '1'; else delete document.documentElement.dataset.ampBarOpen;
      flowNotify();
      const fix = () => { for (let p = document.querySelector('[data-composer-card] + div')?.parentElement; p && p !== document.body; p = p.parentElement) if (p.scrollLeft > 0 && getComputedStyle(p).overflowX === 'hidden') p.scrollLeft = 0; };
      requestAnimationFrame(fix); setTimeout(fix, 120);
    }

    // Keeps the pills on the header anchor (top mode) and decides which ones fit. Runs a few times a second;
    // any error leaves DSH's own layout untouched.
    function startBarController() {
      const root = document.documentElement;
      let fixX = 0, fixY = 0, failed = 0, blocked = 0, topImpossible = false, barLines = 1, barGap = 0;
      const dockOf = () => document.querySelector('[data-composer-card] + div');
      // DSH marks the message-box container "will-change: transform"; that captures fixed boxes and the chat's scroll
      // area then crops them. In Top mode only, that hint is switched off (and put back on release).
      const freed = new Set();
      function freeAncestors(dock) {
        for (let p = dock.parentElement; p && p !== document.body; p = p.parentElement) {
          if (!freed.has(p) && /transform/.test(getComputedStyle(p).willChange)) { p.dataset.ampWc = p.style.willChange || '-'; p.style.willChange = 'auto'; freed.add(p); }
        }
      }
      function restoreAncestors() {
        for (const p of freed) { const v = p.dataset.ampWc; p.style.willChange = v === '-' ? '' : v; delete p.dataset.ampWc; }
        freed.clear();
      }
      function release(dock) {
        restoreAncestors();
        if (root.dataset.ampBarLive) { delete root.dataset.ampBarLive; barMode = ''; setOpen(false); }
        dock?.querySelectorAll('[data-amp-over]').forEach(el => el.removeAttribute('data-amp-over'));
        if (barOverflow) { barOverflow = 0; flowNotify(); }
      }
      // Marks the pills that do not fit on the first line ("+N"); returns the drawn pills.
      function measure(dock, squeeze, extraLine = 0) {
        const items = [...dock.querySelectorAll(PILL_SEL)].filter(el => getComputedStyle(el).display !== 'none' || el.hasAttribute('data-amp-over'));
        items.forEach(el => el.removeAttribute('data-amp-over'));
        // Only real, drawn pills count: an empty wrapper (e.g. no context ring yet) has no size and sits at 0,0.
        const sized = items.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        if (squeeze) sized.forEach(el => el.setAttribute('data-amp-over', ''));
        else if (sized.length) {
          // A pill goes into "+N" when it is past the last allowed line OR would be cut off at either side
          // (one pill wider than the space). Repeat until nothing changes: hiding one lets the others close up.
          const box = dock.getBoundingClientRect(), cs = getComputedStyle(dock);
          const left = box.left + parseFloat(cs.paddingLeft || 0) - 1, right = box.right - parseFloat(cs.paddingRight || 0) + 1;
          for (let pass = 0; pass < 8; pass++) {
            const live = sized.filter(el => !el.hasAttribute('data-amp-over'));
            if (!live.length) break;
            const first = Math.min(...live.map(el => el.getBoundingClientRect().top));
            let changed = false;
            for (const el of live) {
              const r = el.getBoundingClientRect();
              if (r.top > first + extraLine + 4 || r.left < left || r.right > right) { el.setAttribute('data-amp-over', ''); changed = true; }
            }
            if (!changed) break;
          }
        }
        const hidden = sized.filter(el => el.hasAttribute('data-amp-over')).length;
        if (hidden !== barOverflow) { barOverflow = hidden; flowNotify(); }
        return sized;
      }
      function setMode(m) {
        if (root.dataset.ampBarLive === m) return;
        if (m) root.dataset.ampBarLive = m; else delete root.dataset.ampBarLive;
        barMode = m || ''; setOpen(false); flowNotify();
      }
      // DSH's chat box is a fixed-width layout box (overflow hidden) that is never meant to scroll sideways, but on
      // phones its own long lines (to-do summaries) make it wider than the screen and opening the panel slid it over.
      function unslide(dock) {
        for (let p = dock?.parentElement; p && p !== document.body; p = p.parentElement) {
          if (p.scrollLeft > 0 && getComputedStyle(p).overflowX === 'hidden') p.scrollLeft = 0;
        }
      }
      // Sticky widths: a pill may grow when its number gets longer but never shrinks back, so a changing value
      // ("9%" -> "10%", "Model idle" -> "34 tok/s") does not push its neighbours around or flip the "+N" count.
      function stabilize(dock) {
        for (const el of dock.querySelectorAll(PILL_SEL)) {
          const w = el.getBoundingClientRect().width;
          if (!(w > 0)) continue;
          const kept = Number(el.dataset.ampW || 0);
          if (w > kept + 0.5) { el.dataset.ampW = String(Math.ceil(w)); el.style.minWidth = Math.ceil(w) + 'px'; }
        }
      }
      function tick() {
        if (barTopRetry) { barTopRetry = false; topImpossible = false; blocked = 0; }
        const dock = dockOf();
        if (!dock) return release(dock);
        stabilize(dock);
        const anchor = [...document.querySelectorAll('.amp-bar-anchor')].find(a => a.getBoundingClientRect().width > 0);
        // The header only has room on wider screens; phones always get the compact line under the message box.
        const topOk = barSettings.position !== 'bottom' && !topImpossible && anchor && window.innerWidth >= 700;
        if (!topOk) {
          restoreAncestors();
          // Phones (and other narrow screens): one tidy line under the message box, the rest behind "+N".
          if (window.innerWidth < 700) {
            const host = dock.querySelector('[data-amp-host="bottom"]');
            const hw = host ? host.getBoundingClientRect().width : 0;
            root.style.setProperty('--amp-bar-reserve', Math.round(hw + 10) + 'px');
            setMode('compact');
            unslide(dock);
            if (!barOpen) measure(dock, false);
            return;
          }
          return release(dock);
        }
        freeAncestors(dock);
        const a = anchor.getBoundingClientRect();
        let chipW = 0;
        for (const c of anchor.children) { const r = c.getBoundingClientRect(); if (r.width > 0) chipW += r.width + 6; }
        // Two lines when the header has its second row (Chat / Trajectory tabs) with room on the right:
        // line 1 next to the title, line 2 in the empty part of the tab row.
        let x = a.left, w = a.width - chipW, gapY = 0, lines = 1;
        const header = anchor.closest('header');
        const tabs = header && (header.querySelector('[class*="viewsMoreAnchor"]') || header.querySelector('[class*="viewTabs"]'));
        if (tabs) {
          const tr = tabs.getBoundingClientRect();
          const dy = (tr.top + tr.height / 2) - (a.top + a.height / 2);
          const left = Math.max(a.left, tr.right + 16);
          if (dy > 24 && a.right - chipW - left > 200) { x = left; w = a.right - chipW - left; gapY = Math.round(dy - 28); lines = 2; }
        }
        root.style.setProperty('--amp-bar-x', Math.round(x + fixX) + 'px');
        root.style.setProperty('--amp-bar-y', Math.round(a.top + (a.height - 28) / 2 + fixY) + 'px');
        root.style.setProperty('--amp-bar-w', Math.max(0, Math.round(w)) + 'px');
        root.style.setProperty('--amp-bar-h', (lines === 2 ? 56 + gapY : 28) + 'px');
        root.style.setProperty('--amp-bar-gap', gapY + 'px');
        barLines = lines; barGap = gapY;
        root.style.setProperty('--amp-bar-r', Math.max(8, Math.round(window.innerWidth - a.right)) + 'px');
        setMode('top');
        if (barOpen) return;
        // An ancestor with a transform shifts "fixed" boxes: measure and correct once.
        const d = dock.getBoundingClientRect();
        if (Math.abs(d.left - x) > 2 && d.width > 0) fixX += Math.round(x - d.left);
        const yWant = a.top + (a.height - 28) / 2;
        if (Math.abs(d.top - yWant) > 2 && d.height > 0) fixY += Math.round(yWant - d.top);
        const sized = measure(dock, a.width < 90, barLines === 2 ? 28 + barGap : 0);
        // Fallback: if the first pill is not really drawn where it should be (something new crops it), use Bottom.
        const probe = sized.find(el => !el.hasAttribute('data-amp-over'));
        if (probe) {
          const r = probe.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          // Only the chat's own boxes count as "cropping"; a pop-up (settings, rename, menus) lives outside the chat box.
          const scope = dock.closest('[class*="_root"]') || anchor.closest('header')?.parentElement || null;
          const cropped = hit && scope && scope.contains(hit) && !probe.contains(hit) && !hit.contains(probe) && !dock.contains(hit);
          blocked = cropped ? blocked + 1 : 0;
          if (blocked >= 4) {
            topImpossible = true; console.warn('[amp-bar] Top position is hidden by this DSH layout; using Bottom (retrying in 30 s).');
            setTimeout(() => { barTopRetry = true; }, 30000);
            release(dock);
          }
        }
      }
      const resetWidths = () => document.querySelectorAll('[data-amp-w]').forEach(el => { delete el.dataset.ampW; el.style.minWidth = ''; });
      let lastW = window.innerWidth;
      const onResize = () => { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; resetWidths(); } run(); };
      const run = () => { try { tick(); failed = 0; } catch (e) { if (++failed === 3) console.warn('[amp-bar] layout paused:', e?.message || e); if (failed >= 3) release(dockOf()); } };
      const timer = setInterval(run, 350);
      window.addEventListener('resize', onResize);
      const outside = e => {
        if (!barOpen) return;
        const t = e.target;
        if (t.closest?.('[data-composer-card] + div,.amp-bar-chip,[role=dialog],[role=menu],.dsh-hw-panel')) return;
        setOpen(false);
      };
      const esc = e => { if (e.key === 'Escape' && barOpen) setOpen(false); };
      document.addEventListener('mousedown', outside, true);
      document.addEventListener('keydown', esc);
      return () => {
        clearInterval(timer); window.removeEventListener('resize', onResize); resetWidths();
        document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', esc);
        release(dockOf()); delete root.dataset.ampBarPos;
      };
    }

    function BarAnchor() {
      const s = useBarSettings();
      useFlow();
      if (s.position === 'bottom') return null;
      const n = barOverflow;
      // Until Top mode is really live (wide screen, layout checked) the anchor stays empty so the title keeps its room.
      if (barMode !== 'top') return h('div', {className: 'amp-bar-anchor', 'data-amp-bar-anchor': ''});
      return h('div', {className: 'amp-bar-anchor', 'data-amp-bar-anchor': ''},
        h('button', {type: 'button', className: 'amp-bar-chip', onMouseDown: e => e.preventDefault(), style: n > 0 || barOpen ? null : {display: 'none'},
          'aria-expanded': barOpen, 'aria-label': barOpen ? 'Hide extra stats' : n + ' more stats', title: barOpen ? 'Hide' : 'Show all stats',
          onClick: () => setOpen(!barOpen)}, barOpen ? '×' : '+' + n),
        h('span', {className: 'amp-bar-amp-host', 'data-amp-host': 'top'}));
    }
    // Holder for the AMP button under the message box (Bottom mode with "In the bar").
    function AmpDockHost() {
      useFlow();
      const chip = barMode === 'compact' && (barOverflow > 0 || barOpen);
      return h('span', {className: 'amp-bar-amp-host', 'data-amp-host': 'bottom'},
        chip ? h('button', {type: 'button', className: 'amp-bar-chip', onMouseDown: e => e.preventDefault(), 'aria-expanded': barOpen,
          'aria-label': barOpen ? 'Hide extra stats' : barOverflow + ' more stats', onClick: () => setOpen(!barOpen)},
          barOpen ? '×' : '+' + barOverflow) : null);
    }

    function DshCheckNote() {
      const missing = useDshMissing();
      return missing.length ? h('p', {className: 'amp-bar-note', role: 'status'},
        'This DeepSeek Harness version changed a part the bar uses (' + missing.join(', ') + '). The bar falls back to DSH\'s own layout there. Update AMP Radio when a new version is out.') : null;
    }
    function BarSettings({onBack}) {
      const s = useBarSettings();
      const toggle = key => setBarSettings({off: {...s.off, [key]: !s.off[key]}});
      return h('div', {className: 'amp-bar-settings'},
        onBack && h('button', {type: 'button', className: 'dsh-radio-btn', style: {alignSelf: 'flex-start'}, onClick: onBack}, '‹ Radio'),
        h('h3', null, 'Stats bar'),
        h('div', {className: 'amp-bar-seg', role: 'radiogroup', 'aria-label': 'Where the stats sit'},
          [['top', 'Top of chat'], ['bottom', 'Bottom']].map(([id, name]) => h('button', {key: id, type: 'button', role: 'radio',
            'aria-checked': s.position === id, onClick: () => setBarSettings({position: id})}, name))),
        h('p', {className: 'amp-bar-note'}, s.position === 'top'
          ? 'Next to the chat title. What does not fit goes into “+N”.'
          : 'Under the message box. Wraps onto a second line on small screens.'),
        h('h3', null, 'AMP button'),
        h('div', {className: 'amp-bar-seg', role: 'radiogroup', 'aria-label': 'Where the AMP button sits'},
          [['bar', 'In the bar'], ['float', 'Floating']].map(([id, name]) => h('button', {key: id, type: 'button', role: 'radio',
            'aria-checked': (s.amp || 'bar') === id, onClick: () => setBarSettings({amp: id})}, name))),
        h('p', {className: 'amp-bar-note'}, (s.amp || 'bar') === 'bar' ? 'Next to the stats.' : 'Drag it anywhere on the page.'),
        h('h3', null, 'Show'),
        BAR_PILLS.map(p => h('div', {key: p.key, className: 'amp-bar-row'},
          h('span', null, p.label),
          h('button', {type: 'button', role: 'switch', className: 'amp-bar-switch', 'aria-checked': !s.off[p.key],
            'aria-label': 'Show ' + p.label, onClick: () => toggle(p.key)}))),
        h('p', {className: 'amp-bar-note'}, 'Pills your setup does not have are ignored. Saved for this DSH, phone included.'),
        h(DshCheckNote, null));
    }

    // AMP's own CPU / RAM / GPU / VRAM pills, for setups without a hardware-stats plugin (they hide when one exists).
    function AmpStats() {
      const [data, setData] = React.useState(null);
      const [other, setOther] = React.useState(true);
      React.useEffect(() => {
        let stop = false, t;
        const run = async () => {
          const hw = !!document.querySelector('[data-hardware-stats]');
          setOther(hw);
          if (!hw && !document.hidden) {
            try { const r = await fetch('/api/amp-bar/stats', {credentials: 'same-origin', cache: 'no-store'}); if (r.ok) setData(await r.json()); } catch {}
          }
          if (!stop) t = setTimeout(run, 3000);
        };
        t = setTimeout(run, 800);
        return () => { stop = true; clearTimeout(t); };
      }, []);
      if (other || !data) return null;
      const gib = b => (b / 1073741824).toFixed(1);
      const items = [
        ['cpu', 'CPU', Number.isFinite(data.cpu) ? Math.round(data.cpu) + '%' : '—'],
        ['ram', 'RAM', data.ram ? gib(data.ram.used) + '/' + gib(data.ram.total) + ' GiB' : '—'],
      ];
      if (data.gpu) {
        items.push(['gpu', 'GPU', Math.round(data.gpu.util) + '%' + (Number.isFinite(data.gpu.temp) ? ' · ' + data.gpu.temp + '°C' : '')]);
        items.push(['vram', 'VRAM', gib(data.gpu.used) + '/' + gib(data.gpu.total) + ' GiB']);
      }
      return h('span', {className: 'amp-stats'}, items.map(([k, label, value]) =>
        h('span', {key: k, 'data-amp-stat': k, className: 'amp-stat-pill', title: label}, h('span', {className: 'amp-stat-label'}, label), value)));
    }
    // ===================== Task timer + time to finish (2.1.0) =====================
    // Two pills from the chat's task list: "Task 4/7 · 6:30 left" and "~1 h 11 min to go".
    // Timings use the SAME browser storage as the dsh-task-timers card (dsh-task-timers:v1:*), so when both are
    // installed they always show the same numbers; without it this keeps the record itself.
    // Where the task list comes from, in order (each one a fallback for the one before):
    //   1. DSH's own `todos` projection (useProjection('todos')), the way DSH's task panel gets it;
    //   2. the task panel on the page ([data-testid=todo-panel] rows with data-status), if a DSH update renamed (1);
    //   3. the panel's header ("3 completed · 1 in progress · 3 pending"): counts only, no times;
    //   4. nothing found: no pills (never a wrong number, never an error on the page).
    // Any error inside is caught by TasksBoundary: the pills vanish, the chat is untouched, and the problem is
    // reported once to /api/amp-bar/report (kept in the DSH home, amp-radio/problems.log).
    const TT = 'dsh-task-timers:v1:', TT_HIST = TT + 'history';
    const ttLoad = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
    const ttSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
    const ttMedian = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const ttClock = ms => { const t = Math.max(0, Math.round(ms / 1000)), hh = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60;
      return hh ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`; };
    const ttAbout = ms => { const m = Math.round(ms / 60000); return m < 1 ? '<1 min' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
    const ttGuess = text => { const m = /[\[(]\s*~\s*(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?)?\s*(?:(\d+)\s*s(?:ec)?)?\s*[\])]/i.exec(text || '');
      if (!m || !(m[1] || m[2] || m[3])) return null; return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000; };
    // Same rules as dsh-task-timers (kept identical on purpose: shared storage).
    function ttTrack(sessionId, todos) {
      const k = TT + sessionId, now = Date.now(); let rec = ttLoad(k, {items: {}});
      if (!rec || typeof rec !== 'object' || !rec.items) rec = {items: {}};
      if (Object.keys(rec.items).length && !todos.some(t => rec.items[t.content])) rec = {items: {}};
      let changed = false, prevEnd = null; const hist = ttLoad(TT_HIST, []);
      for (const t of todos) {
        const r = rec.items[t.content] || (rec.items[t.content] = {});
        if (t.status === 'in_progress' && !r.start) { r.start = prevEnd && now - prevEnd < 120000 ? prevEnd : now; delete r.end; changed = true; }
        if (t.status === 'completed' && !r.end) {
          r.end = now; if (!r.start) r.unknown = true;
          if (r.start && !r.unknown && Array.isArray(hist)) { hist.push({ms: r.end - r.start, guess: ttGuess(t.content)}); ttSave(TT_HIST, hist.slice(-60)); }
          changed = true;
        }
        if (t.status === 'pending' && (r.start || r.end)) { delete r.start; delete r.end; delete r.unknown; changed = true; }
        if (r.end) prevEnd = Math.max(prevEnd || 0, r.end);
      }
      if (changed) ttSave(k, rec);
      return rec;
    }
    function ttCompute(todos, rec, now) {
      const done = todos.filter(t => t.status === 'completed'), cur = todos.find(t => t.status === 'in_progress');
      const sane = ms => Number.isFinite(ms) && ms >= 1000 && ms <= 86400000;          // 1 s .. 24 h: anything else is junk
      const durs = done.map(t => rec.items[t.content]).filter(r => r?.start && r?.end && !r.unknown).map(r => r.end - r.start).filter(sane);
      const histRaw = ttLoad(TT_HIST, []);
      const hist = (Array.isArray(histRaw) ? histRaw : []).map(x => typeof x === 'number' ? {ms: x, guess: null} : x)
        .filter(x => x && typeof x === 'object' && sane(x.ms)).map(x => ({ms: x.ms, guess: sane(x.guess) ? x.guess : null}));
      const typical = ttMedian(durs) ?? ttMedian(hist.map(x => x.ms));
      const ratios = hist.filter(x => x.guess > 0).map(x => x.ms / x.guess);
      const fix = ratios.length >= 2 ? Math.min(5, Math.max(0.2, ttMedian(ratios))) : 1;
      const est = t => { const g = ttGuess(t.content); return g != null ? g * fix : typical; };
      const curStart = cur && rec.items[cur.content]?.start, onCur = curStart && curStart <= now ? now - curStart : null;   // future start = clock changed
      const curEst = cur ? est(cur) : null, curLeft = curEst == null || onCur == null ? null : curEst - onCur;
      const pend = todos.filter(t => t.status === 'pending').map(est);
      const allLeft = pend.some(x => x == null) || (cur && curLeft == null) ? null : Math.max(0, cur ? curLeft : 0) + pend.reduce((a, b) => a + b, 0);
      return {done: done.length, n: todos.length, cur, onCur, curLeft, allLeft};
    }
    // Fallbacks 2 and 3: read the task panel DSH draws.
    function todosFromPage() {
      const rows = [...document.querySelectorAll('[data-testid=todo-panel] li[data-status]')];
      if (rows.length) return {todos: rows.map(li => ({content: li.textContent.replace(/\s+/g, ' ').trim(), status: li.dataset.status})), source: 'page'};
      const head = document.querySelector('[data-testid=todo-panel]')?.textContent || '';
      const n = re => Number((re.exec(head) || [])[1] || 0);
      const c = n(/(\d+)\s+completed/i), p = n(/(\d+)\s+in progress/i), w = n(/(\d+)\s+pending/i);
      if (c + p + w === 0) return null;
      return {todos: [...Array(c)].map((_, i) => ({content: '#c' + i, status: 'completed'})).concat(
        [...Array(p)].map((_, i) => ({content: '#p' + i, status: 'in_progress'})), [...Array(w)].map((_, i) => ({content: '#w' + i, status: 'pending'}))), source: 'counts'};
    }
    function useTodos(useProjection) {
      let projected;
      try { projected = typeof useProjection === 'function' ? useProjection('todos') : undefined; }   // hook order stays fixed: called every render
      catch (e) { ampReport('tasks: todos projection', e); projected = undefined; }
      const [page, setPage] = React.useState(null);
      const fromDsh = Array.isArray(projected) && projected.every(t => t && typeof t.content === 'string' && typeof t.status === 'string');
      React.useEffect(() => {
        if (fromDsh) return;
        const read = () => { try { setPage(todosFromPage()); } catch (e) { ampReport('tasks: page fallback', e); } };
        read(); const id = setInterval(read, 2000);
        return () => clearInterval(id);
      }, [fromDsh]);
      if (fromDsh) return {todos: projected, source: 'dsh'};
      return page || {todos: [], source: 'none'};
    }
    // Compaction pauses the clock (2.1, owner 21 Nov 2026: "when its compacting it pauses the timer").
    // Sources, in order: AMP's own server status (any DSH), the hardware-stats plugin's status, the on-screen text.
    const COMPACT_TEXT = ['Compacting context', '正在压缩', 'コンテキストを圧縮中', 'compactación', 'compactage'];
    function useCompacting(useProjection) {
      let own, hw;
      try { own = typeof useProjection === 'function' ? useProjection('ampCompaction') : undefined; } catch { own = undefined; }
      try { hw = typeof useProjection === 'function' ? useProjection('hardwareCompactionStatus') : undefined; } catch { hw = undefined; }
      const known = (own && typeof own.active === 'boolean') || (hw && typeof hw.active === 'boolean');
      const [onPage, setOnPage] = React.useState(false);
      React.useEffect(() => {
        if (known) return;
        const look = () => { try {
          const xp = '//*[not(self::script) and not(self::style)][' + COMPACT_TEXT.map(w => `contains(text(),"${w}")`).join(' or ') + ']';
          const n = document.evaluate(xp, document.body, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          setOnPage(!!n && n.getClientRects().length > 0);
        } catch {} };
        look(); const id = setInterval(look, 2000); return () => clearInterval(id);
      }, [known]);
      if (own && typeof own.active === 'boolean') return {active: own.active, since: own.since || null};
      if (hw && typeof hw.active === 'boolean') return {active: hw.active, since: hw.startedAt || null};
      return {active: onPage, since: null};
    }
    // While compacting: remember when it began. When it ends: move the running task's start forward by the paused time
    // (shared storage, so the dsh-task-timers card gets the corrected clock too). `done` guards against two open tabs
    // both subtracting the same pause.
    function ttPause(sessionId, compacting, since, cur) {
      if (!sessionId) return null;
      const pk = TT + sessionId + ':pause', p = ttLoad(pk, null), now = Date.now();
      if (compacting) {
        if (!p || !Number.isFinite(p.since)) { const np = {since: Number.isFinite(since) && since <= now ? since : now}; ttSave(pk, np); return np; }
        return p;
      }
      if (p && Number.isFinite(p.since)) {
        const rec = ttLoad(TT + sessionId, null);
        if (rec && rec.items) {
          rec.done = Array.isArray(rec.done) ? rec.done : [];
          if (!rec.done.includes(p.since)) {
            const dur = Math.max(0, Math.min(now - p.since, 6 * 3600000));
            const r = cur && rec.items[cur.content];
            if (r && Number.isFinite(r.start) && r.start <= p.since && !r.end) r.start = Math.min(now, r.start + dur);
            rec.pausedMs = (rec.pausedMs || 0) + dur; rec.done = rec.done.concat(p.since).slice(-20);
            ttSave(TT + sessionId, rec);
          }
        }
        try { localStorage.removeItem(pk); } catch {}
      }
      return null;
    }
    function AmpTasksInner({useProjection, sessionId}) {
      const {todos, source} = useTodos(useProjection);
      const compacting = useCompacting(useProjection);
      const [now, setNow] = React.useState(Date.now());
      const sig = JSON.stringify(todos.map(t => [t.content, t.status]));
      const timed = source === 'dsh' || source === 'page';      // counts-only fallback: no clock (it would be made up)
      const rec = React.useMemo(() => (timed && sessionId && todos.length ? ttTrack(sessionId, todos) : {items: {}}), [sessionId, sig, timed]);
      const ticking = timed && todos.some(t => t.status === 'in_progress');
      React.useEffect(() => {
        if (!ticking) return;
        const id = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
        return () => clearInterval(id);
      }, [ticking]);
      if (!todos.length) return null;
      const curTask = todos.find(t => t.status === 'in_progress');
      const pause = timed ? ttPause(sessionId, compacting.active, compacting.since, curTask) : null;
      const recNow = timed && sessionId ? (ttLoad(TT + sessionId, null) || rec) : rec;   // re-read: a pause may have moved the start
      const s = ttCompute(todos, recNow && recNow.items ? recNow : rec, pause ? Math.min(now, pause.since) : now);
      const step = s.cur ? `${s.done + 1}/${s.n}` : `${s.done}/${s.n}`;
      let left = '', over = false;
      if (s.cur && timed) {
        if (s.curLeft != null) { over = s.curLeft < 0; left = over ? `over ${ttClock(-s.curLeft)}` : `${ttClock(s.curLeft)} left`; }
        else if (s.onCur != null) left = `${ttClock(s.onCur)} in`;
      } else if (s.done === s.n) left = 'all done';
      const state = pause && s.cur ? 'paused' : over ? 'over' : s.done === s.n ? 'done' : s.cur ? 'live' : 'idle';
      // progress of the current task (0-100), only when there is a real start time and a guess
      const pct = s.cur && timed && s.onCur != null && s.curLeft != null ? Math.max(2, Math.min(100, Math.round(s.onCur / (s.onCur + Math.max(0, s.curLeft)) * 100))) : null;
      const pills = [h('span', {key: 'tasks', 'data-amp-stat': 'tasks', 'data-state': state, className: 'amp-stat-pill amp-task-pill',
        title: s.cur ? `Task ${s.done + 1} of ${s.n}` + (source === 'counts' ? ' (times not available)' : '') : `${s.done} of ${s.n} tasks done`},
        h('i', {className: 'amp-task-dot', 'aria-hidden': 'true'}),
        h('span', {className: 'amp-stat-label'}, 'Task'),
        h('span', {className: 'amp-task-val'}, step),
        left || state === 'paused' ? h('span', {className: 'amp-task-sep', 'aria-hidden': 'true'}, '·') : null,
        left || state === 'paused' ? h('span', {className: 'amp-task-left'}, state === 'paused' ? 'paused · compacting' : left) : null,
        pct != null ? h('i', {className: 'amp-task-track', 'aria-hidden': 'true'}, h('i', {style: {width: pct + '%'}})) : null)];
      if (timed && s.allLeft && s.allLeft < 99 * 3600000 && s.done < s.n)
        pills.push(h('span', {key: 'eta', 'data-amp-stat': 'eta', className: 'amp-stat-pill amp-eta-pill', title: 'About how long the whole task list has left (a guess that learns as tasks finish)'},
          h('span', {className: 'amp-stat-label'}, 'Finish'), h('span', {className: 'amp-task-val'}, '~' + ttAbout(s.allLeft) + (state === 'paused' ? ' · paused' : ''))));
      return h('span', {className: 'amp-stats amp-tasks'}, pills);
    }
    class TasksBoundary extends React.Component {
      constructor(p) { super(p); this.state = {failed: false}; }
      static getDerivedStateFromError() { return {failed: true}; }
      componentDidCatch(e) { ampReport('tasks: render', e); }
      render() { return this.state.failed ? null : this.props.children; }
    }
    function AmpTasks(props) {
      // The dsh-task-timers card above the message box already shows this in full: the pills still show (the bar is
      // where he looks), each switchable in the AMP Bar settings.
      return h(TasksBoundary, null, h(AmpTasksInner, props));
    }
    const tasksCss = `
/* 2.1 task pills: same look as the other AMP pills; AMP blue accent; quiet motion only */
.amp-task-pill,.amp-eta-pill{position:relative;justify-content:center;animation:amp-pill-in .28s ease-out both}
.amp-task-pill{min-width:12.5em}
.amp-eta-pill{min-width:7.5em}
.amp-task-val{color:var(--dsw-alias-label-primary);font-weight:500}
.amp-task-sep{color:var(--dsw-alias-label-tertiary);margin:0 -2px}
.amp-task-left{color:var(--dsw-alias-label-secondary);transition:color .2s ease}
.amp-task-dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:background .3s ease}
.amp-task-pill[data-state=live] .amp-task-dot{background:#4c8dff;box-shadow:0 0 0 0 rgba(76,141,255,.45);animation:amp-task-breathe 2.4s ease-in-out infinite}
.amp-task-pill[data-state=paused] .amp-task-dot{background:var(--dsw-alias-state-warning-primary,#d29922)}
.amp-task-pill[data-state=paused] .amp-task-left{color:var(--dsw-alias-state-warning-primary,#d29922)}
.amp-task-pill[data-state=paused] .amp-task-track>i{background:var(--dsw-alias-state-warning-primary,#d29922)}
.amp-task-pill[data-state=done] .amp-task-dot{background:var(--dsw-alias-state-success-primary,#3fb950)}
.amp-task-pill[data-state=over] .amp-task-dot{background:var(--dsw-alias-state-error-primary,#e5534b)}
.amp-task-pill[data-state=over] .amp-task-left{color:var(--dsw-alias-state-error-primary,#e5534b)}
.amp-task-track{position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:2px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.18));overflow:hidden;pointer-events:none}
.amp-task-track>i{display:block;height:100%;border-radius:2px;background:#4c8dff;opacity:.75;transition:width 1s linear}
.amp-task-pill[data-state=over] .amp-task-track>i{background:var(--dsw-alias-state-error-primary,#e5534b)}
@keyframes amp-pill-in{from{opacity:0;transform:translateY(2px)}to{opacity:1;transform:none}}
@keyframes amp-task-breathe{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(76,141,255,.45)}50%{opacity:.55;box-shadow:0 0 0 3px rgba(76,141,255,0)}}
@media (prefers-reduced-motion:reduce){.amp-task-pill,.amp-eta-pill,.amp-task-dot,.amp-task-track>i{animation:none!important;transition:none!important}}`;

    const statsCss = `.amp-stats{display:inline-flex;flex-wrap:wrap;justify-content:center;gap:0 4px}
html[data-amp-bar-live=top] .amp-stats{display:contents}
.amp-stat-pill{display:inline-flex;align-items:center;gap:6px;padding:1px 8px;border-radius:24px;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:20px;font-variant-numeric:tabular-nums}
.amp-stat-label{color:var(--dsw-alias-label-secondary)}`;

    // ===================== Borrow my AI (2.2) =====================
    // Lend this PC's local AI to a friend's DSH over Tailscale, or use a friend's. The work happens in the server half
    // (borrow/host.mjs); this is the card in the AMP panel and the one-line notice above the message box.
    // Every call is guarded: a DSH without the server half shows "Restart DSH to finish installing AMP".
    const BORROW_POLL_OPEN = 1500, BORROW_POLL_IDLE = 5000;
    let borrowState = null, borrowErr = null;
    const borrowSubs = new Set();
    const borrowSet = (s, e = null) => { borrowState = s; borrowErr = e; borrowSubs.forEach(fn => { try { fn(); } catch {} }); };
    async function borrowCall(path, body) {
      try {
        const r = await fetch('/api/amp-borrow/' + path, body === undefined ? {credentials: 'same-origin', cache: 'no-store'}
          : {method: 'POST', credentials: 'same-origin', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
        if (r.status === 404) { borrowSet(null, 'restart'); return null; }
        const j = await r.json();
        if (j && (j.host || j.friend)) borrowSet(j);
        return j;
      } catch (e) { borrowSet(borrowState, 'DSH did not answer. Trying again.'); return null; }
    }
    function useBorrow(every) {
      const [, tick] = React.useState(0);
      React.useEffect(() => {
        const fn = () => tick(n => n + 1); borrowSubs.add(fn);
        let alive = true, t = null;
        const run = async () => { if (!alive) return; if (!document.hidden) await borrowCall('status'); t = setTimeout(run, every); };
        run();
        return () => { alive = false; clearTimeout(t); borrowSubs.delete(fn); };
      }, [every]);
      return [borrowState, borrowErr];
    }
    const clock = s => { if (!Number.isFinite(s)) return ''; const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`; };
    const num = n => (Number.isFinite(n) ? (n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n)) : '–');
    async function copy(text, el) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch { try { if (el) { el.focus(); el.select(); } } catch {} return false; }
    }
    // Icons in the panel's own line style (24 grid, 2 px stroke, round ends), drawn for this card.
    const ILink = () => h('svg', {viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', 'aria-hidden': true},
      h('circle', {cx: 6, cy: 12, r: 3}), h('circle', {cx: 18, cy: 12, r: 3}), h('path', {d: 'M9 12h6'}));
    const borrowCss = `
.amp-borrow{--amp-b-fill:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.14));--amp-b-fill-hover:color-mix(in srgb,var(--amp-b-fill) 100%,currentColor 8%);--amp-b-mute:var(--dsw-alias-label-secondary,#b4b4b4);padding:10px 16px 18px;min-height:236px;box-sizing:border-box;overflow:auto;display:flex;flex-direction:column;gap:10px;font-size:13px}
.amp-borrow section{display:flex;flex-direction:column;gap:10px}
.amp-borrow-line1{display:grid;grid-template-columns:30px 1fr;align-items:center;margin:0;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.amp-borrow-press{cursor:pointer}
.amp-borrow-mark{width:3px;height:14px;margin-left:6px;background:var(--amp-b-mute);border-radius:0}
.amp-borrow-mark[data-s=on]{background:#45e5ac}.amp-borrow-mark[data-s=wait]{background:#b98ad6}.amp-borrow-mark[data-s=stop]{background:#f23f43}
.amp-borrow-mark[data-s=none]{visibility:hidden}
.amp-borrow-line1:has(.amp-borrow-mark[data-s=none]){color:var(--amp-b-mute)}
.amp-borrow-big{display:flex;align-items:stretch;gap:6px;width:100%;height:44px;padding:0 14px 0 6px;border:0;border-radius:4px;background:var(--amp-b-fill);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:14px;font-weight:600;letter-spacing:0;text-align:left;cursor:pointer;transition:background .15s ease}
.amp-borrow-big:hover:not(:disabled){background:var(--amp-b-fill-hover)}
.amp-borrow-big:focus-visible{outline:2px solid #b98ad6;outline-offset:2px}
.amp-borrow-big:disabled{opacity:.5;cursor:default}
.amp-borrow-label{display:flex;align-items:center;padding-left:6px}
.amp-borrow-big-stop{background:rgba(242,63,67,.14);color:#ff8a82}
.amp-borrow-big-stop:hover:not(:disabled){background:rgba(242,63,67,.24)}
.amp-borrow-stripes{display:flex;gap:2px;width:18px;flex:none}
.amp-borrow-stripes i{width:3px;height:100%}
.amp-borrow-stripes i:nth-child(1){background:#e07ab4}.amp-borrow-stripes i:nth-child(2){background:#b98ad6}
.amp-borrow-stripes i:nth-child(3){background:#45e5ac}.amp-borrow-stripes i:nth-child(4){background:#2f8a68}
.amp-borrow-stripes-stop i{background:#f23f43!important}
.amp-borrow-busy .amp-borrow-stripes i{animation:amp-borrow-wave .9s ease-in-out infinite}
.amp-borrow-busy .amp-borrow-stripes i:nth-child(2){animation-delay:.12s}.amp-borrow-busy .amp-borrow-stripes i:nth-child(3){animation-delay:.24s}.amp-borrow-busy .amp-borrow-stripes i:nth-child(4){animation-delay:.36s}
.amp-borrow-busy:disabled{opacity:1;cursor:progress}
@keyframes amp-borrow-wave{0%,100%{transform:scaleY(1)}40%{transform:scaleY(.35)}}
@media (prefers-reduced-motion:reduce){.amp-borrow-busy .amp-borrow-stripes i{animation:none;opacity:.6}}
.amp-borrow-small{align-self:flex-start;margin-left:30px;border:0;background:none;padding:2px 0;color:var(--amp-b-mute);font:inherit;font-size:12.5px;text-decoration:underline;text-decoration-color:color-mix(in srgb,currentColor 45%,transparent);text-underline-offset:3px;cursor:pointer}
.amp-borrow-small:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.amp-borrow-meters{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.amp-borrow-meters div{display:flex;flex-direction:column;gap:1px;padding:6px 8px;border-radius:4px;background:var(--amp-b-fill);min-width:0}
.amp-borrow-meters span{font-size:10px;color:var(--amp-b-mute)}
.amp-borrow-meters b{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.amp-borrow-field{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:4px;background:transparent;color:inherit;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace}
.amp-borrow-field:focus{outline:none;border-color:#b98ad6}
.amp-borrow-friends{display:flex;flex-direction:column;gap:4px}
.amp-borrow-friend{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-left:30px;font-size:12.5px;color:var(--amp-b-mute)}
.amp-borrow-friend span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amp-borrow-friend .amp-borrow-small{margin-left:0}
.amp-borrow-banner{display:flex;align-items:center;gap:8px;padding:5px 10px;margin:0 0 6px;border-radius:10px;font-size:12px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.amp-borrow-banner span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amp-borrow-banner button{border:0;background:none;color:#e5534b;font:inherit;font-weight:600;cursor:pointer;padding:2px 4px}
@media (prefers-reduced-motion:reduce){.amp-borrow-wire[data-on]{animation:none}}
`;

    // One thing on screen at a time: one short line and one big button. Everything else happens by itself.
    // AMP's own parts, nothing borrowed from a kit: the four Laguna stripes stand as the left edge of every main button,
    // and every status mark is one stripe (mint = running, amber = waiting, red = stopped). One graphic edge, one text edge.
    const Stripes = ({stop}) => h('span', {className: 'amp-borrow-stripes' + (stop ? ' amp-borrow-stripes-stop' : ''), 'aria-hidden': true}, h('i'), h('i'), h('i'), h('i'));
    // Pressed and working: the four stripes run a short wave until the action is done (motion only on a press, never idle).
    function Big({onClick, children, danger, disabled}) {
      const [busy, setBusy] = React.useState(false);
      const press = async e => {
        setBusy(true); const t0 = Date.now();
        try { await onClick?.(e); } finally { setTimeout(() => setBusy(false), Math.max(0, 450 - (Date.now() - t0))); }
      };
      return h('button', {type: 'button', className: 'amp-borrow-big' + (danger ? ' amp-borrow-big-stop' : '') + (busy ? ' amp-borrow-busy' : ''), disabled: disabled || busy, 'aria-busy': busy, onClick: press},
        h(Stripes, {stop: danger}), h('span', {className: 'amp-borrow-label'}, children));
    }
    const plain = t => (typeof t === 'string' ? t.replace(/\.$/, '') : t);
    const Line = ({children, mark, onClick, title}) => h('p', {className: 'amp-borrow-line1' + (onClick ? ' amp-borrow-press' : ''), onClick, title},
      h('span', {className: 'amp-borrow-mark', 'data-s': mark || 'none'}), h('span', null, plain(children)));
    const Small = ({onClick, children}) => h('button', {type: 'button', className: 'amp-borrow-small', onClick}, children);
    async function readClip() { try { return (await navigator.clipboard.readText()) || ''; } catch { return null; } }
    function PasteBox({placeholder, onText}) {
      return h('input', {id: 'amp-borrow-pastebox', className: 'amp-borrow-field', autoFocus: true, placeholder,
        onPaste: e => { const t = e.clipboardData?.getData('text') || ''; if (t) { e.preventDefault(); onText(t); } },
        onKeyDown: e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) onText(e.currentTarget.value); }});
    }
    // The AI light, the same on both cards: running, asleep (wakes by itself when used), paused for a game.
    const AI_LIGHT = {ready: ['on', 'AI running'], asleep: ['wait', 'AI asleep, wakes when used'], game: ['stop', 'AI paused while gaming']};
    const AiLight = ({state, who}) => { const l = AI_LIGHT[state]; return l ? h(Line, {mark: l[0]}, who ? `${who}'s ${l[1]}` : l[1]) : null; };

    function ShareSide({s, onOff}) {
      const host = s.host || {}, turn = host.live?.turn;
      const [stage, setStage] = React.useState('idle');       // idle | copy | box | done
      const [msg, setMsg] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const makeInvite = async link => {
        setBusy(true);
        const r = await borrowCall('invite', {share: String(link || '').trim()});
        setBusy(false);
        if (!r?.invite) { setMsg('That was not the Tailscale link, copy it again'); setStage('copy'); return; }
        let copied = false; try { await navigator.clipboard.writeText(r.invite); copied = true; } catch {}
        setMsg(copied ? null : r.invite); setStage('done');
      };
      const copiedIt = async () => { const t = await readClip(); if (t === null) { setStage('box'); setMsg(null); } else makeInvite(t); };
      const off = h(Small, {onClick: () => { onOff?.(); borrowCall('share', {on: false}); }}, 'Turn sharing off');
      if (!host.sharing) return h('section', null,
        h(Line, {mark: 'wait'}, host.step?.say || (host.problem && !/Stopped/.test(host.problem) ? host.problem : 'Getting ready')), off);
      if (turn) return h('section', null,
        h(Line, {mark: 'on'}, `${turn.friend} is using your AI`),
        h('div', {className: 'amp-borrow-meters'},
          h('div', null, h('span', null, 'Speed'), h('b', null, turn.replying ? `${turn.tps || 0}/s` : '–')),
          h('div', null, h('span', null, 'In'), h('b', null, num(turn.tokIn))),
          h('div', null, h('span', null, 'Out'), h('b', null, num(turn.tokOut))),
          h('div', null, h('span', null, 'Left'), h('b', null, clock(turn.secondsLeft)))),
        h(Big, {danger: true, onClick: () => borrowCall('stop', {})}, 'Force stop'));
      return h('section', null,
        h(Line, {mark: 'on'}, 'Sharing is on'),
        h(AiLight, {state: host.ai}),
        host.rules?.blocked ? h(React.Fragment, null,
            h(Line, {mark: 'stop'}, 'Your Tailscale rules block friends'),
            h(Line, null, 'Press the button, paste under "grants": [ and Save'),
            h(Big, {onClick: async () => { try { await navigator.clipboard.writeText(host.rules.line); } catch {} window.open('https://login.tailscale.com/admin/acls/file', '_blank', 'noopener'); }}, 'Fix it in Tailscale'))
        : stage === 'idle' ? h(React.Fragment, null,
            h(Big, {onClick: () => { window.open(host.tsIP ? `https://login.tailscale.com/admin/machines/${host.tsIP}` : 'https://login.tailscale.com/admin/machines', '_blank', 'noopener'); setStage('copy'); }}, 'Invite a friend'),
            h(Friends, {name: host.name}))
        : h(React.Fragment, null,
            h(Line, null, 'In Tailscale: Share, Copy link, send it to your friend'),
            h(Big, {onClick: () => setStage('idle')}, 'Done')),
        off);
    }

    // Who can borrow, and your name as friends see it. One tap each.
    function Friends({name}) {
      const [list, setList] = React.useState([]);
      const [edit, setEdit] = React.useState(false);
      const load = async () => { const r = await borrowCall('friends'); setList((r?.friends || []).filter(f => !f.revoked && (f.login || f.inviteExp > Date.now()))); };
      React.useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);
      const save = v => { if (v.trim()) borrowCall('settings', {hostName: v}); setEdit(false); };
      return h('div', {className: 'amp-borrow-friends'},
        edit ? h('input', {id: 'amp-borrow-myname', className: 'amp-borrow-field', autoFocus: true, defaultValue: name || '', placeholder: 'Your name',
            onKeyDown: e => { if (e.key === 'Enter') save(e.currentTarget.value); if (e.key === 'Escape') setEdit(false); }, onBlur: e => save(e.currentTarget.value)})
          : h('div', {className: 'amp-borrow-friend'}, h('span', null, `Friends see you as ${name || 'you'}`), h(Small, {onClick: () => setEdit(true)}, 'Change')),
        list.map(f => h('div', {key: f.id, className: 'amp-borrow-friend'},
          h('span', null, f.login ? f.name : `Invite from ${new Date(f.created).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}, not used yet`),
          h(Small, {onClick: async () => { await borrowCall('remove', {friendId: f.id}); load(); }}, 'Remove'))));
    }

    function UseSide({s, onBack}) {
      const f = s.friend || {}, st = f.state || {};
      const [box, setBox] = React.useState(false);
      const [err, setErr] = React.useState(null);
      const [ping, setPing] = React.useState(() => { try { return localStorage.getItem('amp-borrow-ping') !== 'off'; } catch { return true; } });
      const join = async text => { setErr(null); const r = await borrowCall('join', {invite: text}); if (r?.error) { setErr(r.error); setBox(false); } };
      const paste = async () => { const t = await readClip(); if (t === null) setBox(true); else join(t); };
      React.useEffect(() => { if (!f.host && !f.pending && !f.step) join(''); }, []);   // look for a friend's AI at once
      if (!f.host && !f.pending) return h('section', null,
        h(Line, {mark: err ? 'wait' : null}, err || (f.step?.say && f.step.step !== 'ready' ? f.step.say : 'Copy the link your friend sent you')),
        box ? h(PasteBox, {placeholder: 'Paste the link here', onText: join}) : h(Big, {onClick: paste}, 'Paste link'),
        onBack ? h(Small, {onClick: onBack}, 'Back') : null);
      if (f.pending) return h('section', null, h(Line, {mark: 'wait'}, f.step?.say || "Looking for your friend's AI"), h(Small, {onClick: () => borrowCall('leave', {})}, 'Cancel'));
      const extra = st.connected ? [st.path?.words && st.path.words !== 'Connected' ? st.path.words : null, ping && Number.isFinite(st.pingMs) ? `${st.pingMs} ms` : null].filter(Boolean).join(' · ') : '';
      const turnLine = {yours: 'Your turn', waiting: `${f.host} is using it, yours is next`, host: `${f.host} is using it, yours is next`, other: 'Someone else is using it', off: `${f.host} stopped sharing`}[st.turn];
      return h('section', null,
        h(Line, {mark: st.turn === 'off' ? 'stop' : st.connected ? 'on' : 'wait', title: 'Show or hide the ping',
          onClick: () => { const v = !ping; setPing(v); try { localStorage.setItem('amp-borrow-ping', v ? 'on' : 'off'); } catch {} }},
          (st.connected ? `Connected to ${f.host}` : `Reconnecting to ${f.host}`) + (extra ? ` · ${extra}` : '')),
        st.connected ? h(AiLight, {state: st.ai, who: f.host}) : null,
        st.connected && st.models?.length ? h(Line, null, turnLine || `New chats use ${f.host}'s AI`) : null,
        f.problem ? h(Line, {mark: 'wait'}, f.problem) : null,
        st.turn === 'yours' ? h(Big, {onClick: () => borrowCall('done', {})}, "I'm done") : null,
        st.turn === 'yours' ? h(Small, {onClick: () => borrowCall('leave', {})}, 'Stop using this AI')
          : h(Big, {danger: true, onClick: () => borrowCall('leave', {})}, 'Stop using this AI'));
    }

    function useUpdateNote() {
      const [step, setStep] = React.useState(null);
      React.useEffect(() => { let alive = true; const run = () => fetch('/api/amp-update/status', {credentials: 'same-origin', cache: 'no-store'}).then(r => r.ok ? r.json() : null).then(j => { if (alive) setStep(j?.step || null); }).catch(() => {}); run(); const t = setInterval(run, 60_000); return () => { alive = false; clearInterval(t); }; }, []);
      return step === 'restart' ? 'Restart DeepSeek Harness to finish updating AMP' : null;
    }
    function BorrowView() {
      const [s, err] = useBorrow(BORROW_POLL_OPEN);
      const [pick, setPick] = React.useState(null);
      const updateNote = useUpdateNote();
      if (!s && err === 'restart') return h('div', {className: 'amp-borrow'}, h(Line, {mark: 'wait'}, 'Restart DeepSeek Harness to finish, this page then works by itself'));
      if (!s) return h('div', {className: 'amp-borrow'}, h(Line, {mark: 'wait'}, err || 'One moment'));
      const sharing = s.host?.wish || s.host?.sharing;
      const using = s.friend?.host || s.friend?.pending;
      const side = sharing ? 'share' : using ? 'use' : pick;
      return h('div', {className: 'amp-borrow'},
        updateNote ? h(Line, {mark: 'wait'}, updateNote) : null,
        side === 'share' ? h(ShareSide, {s, onOff: () => setPick(null)})
        : side === 'use' ? h(UseSide, {s, onBack: using ? null : () => setPick(null)})
        : h(React.Fragment, null,
            h(Big, {onClick: () => { setPick('share'); borrowCall('share', {on: true}); }}, 'Share my AI'),
            h(Big, {onClick: () => setPick('use')}, "Use a friend's AI")));
    }

    // Above the message box while a friend has this PC's AI: one line and Force stop, nothing else.
    function BorrowBanner() {
      const [s] = useBorrow(BORROW_POLL_IDLE);
      const host = s?.host;
      if (!host?.lock) return null;
      return h('div', {className: 'amp-borrow-banner', role: 'status'},
        h('span', {className: 'amp-borrow-mark', 'data-s': 'wait'}),
        h('span', null, `Your AI is lent to ${host.lockFriend || 'a friend'}.` + (host.waitingHere ? ' Your message waits until they are done.' : '')),
        h('button', {type: 'button', onClick: () => borrowCall('stop', {})}, 'Force stop'));
    }
    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'dsh-radio';
        style.textContent = css;
        document.head.appendChild(style);
        return () => style.remove();
      }, 'dsh-radio: scoped styles');
      // Never let a missing/renamed dock slot break client boot: worst case
      // on an unknown DSH version is a missing radio button, never an error.
      try {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'dsh-radio', order: 20,
        }, RadioPill));
      } catch (e) {
        console.warn('[dsh-radio] composer dock unavailable, pill not mounted:', e?.message || e);
      }
      // AMP Bar: each piece is optional; a DSH without one of these slots just skips that piece.
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'amp-bar';
        style.textContent = barCss + statsCss + tasksCss + borrowCss;
        document.head.appendChild(style);
        barStyleEl = document.createElement('style');
        barStyleEl.dataset.plugin = 'amp-bar-switches';
        document.head.appendChild(barStyleEl);
        applyBarCss();
        loadBarSettings();
        const stop = startBarController();
        return () => { stop(); style.remove(); barStyleEl?.remove(); barStyleEl = null; };
      }, 'amp-bar: layout and switches');
      const slot = (name, opts, comp) => {
        try { ctx.slots.inject(name, () => ctx.slots.register({name, ...opts}, comp)); }
        catch (e) { console.warn('[amp-bar] ' + name + ' unavailable:', e?.message || e); }
      };
      slot('conversation.session.header.actions', {id: 'amp-bar-anchor', order: 1000}, BarAnchor);
      slot('conversation.composer.dock', {id: 'amp-borrow-banner', order: 5}, BorrowBanner);
      slot('conversation.composer.dock', {id: 'amp-tasks', order: 11}, AmpTasks);
      slot('conversation.composer.dock', {id: 'amp-stats', order: 12}, AmpStats);
      slot('conversation.composer.dock', {id: 'amp-dock-host', order: 30}, AmpDockHost);
      slot('settings.section', {id: 'amp-bar', order: 40, label: 'AMP Bar'}, () => h(BarSettings, null));
      ctx.effect(() => {
        let t = setTimeout(function run() { try { checkDshParts(); } catch (e) { ampReport('dsh check', e); } t = setTimeout(run, 60000); }, 15000);
        return () => clearTimeout(t);
      }, 'amp-bar: DSH parts self-check');
    }

    return {inject: ['slots'], apply, RadioPill, __test: {checkDshParts, getDshMissing: () => dshMissing, ttCompute}};
  },
});
