window.__ModuleLoader__.load({
  id: 'dsh-amp-radio',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const h = React.createElement;

    // Always-available offline stations (no network needed).
    const AMP_VERSION = '2.2.1';
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
    const AMP_LOGO = "data:image/png;base64,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";

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
      .dsh-radio-title-update.up-to-date{color:var(--dsw-alias-state-business-primary,#4c8dff);}
      @keyframes dsh-radio-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
      .dsh-radio-pill-loading{color:var(--dsw-alias-label-tertiary,#8a8a8a);animation:dsh-radio-pulse 1.2s ease-in-out infinite;}
      @keyframes dsh-radio-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}

      .dsh-radio-now{padding:8px 14px;border-top:1px solid rgba(255,255,255,.06);}
      .dsh-radio-now-name{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .dsh-radio-now-meta{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);margin-top:2px;}
    `;

    function AmpLogo(props) {
      const size = (props && props.size) || 14;
      return h('img', {
        src: AMP_LOGO,
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
            h('button', {type: 'button', className: 'dsh-radio-title-update' + (view === 'borrow' ? ' up-to-date' : ''), style: {marginLeft: 0},
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
.amp-borrow{padding:4px 14px 14px;overflow:auto;display:flex;flex-direction:column;gap:12px;font-size:13px;min-height:0}
.amp-borrow h3{margin:0;font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-weight:600;color:var(--dsw-alias-label-tertiary,#8a8a8a)}
.amp-borrow section{display:flex;flex-direction:column;gap:8px}
.amp-borrow-line{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.amp-borrow-line b{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amp-borrow-line b:last-child{text-align:right}
.amp-borrow-wire{height:2px;width:56px;border-radius:1px;background:var(--dsw-alias-border-l2,rgba(128,128,128,.35));position:relative;overflow:hidden}
.amp-borrow-wire[data-on]{background:var(--dsw-alias-state-business-primary,#4c8dff);transform-origin:left;animation:amp-borrow-draw .5s ease-out}
.amp-borrow-wire[data-relay]{background:repeating-linear-gradient(90deg,var(--dsw-alias-state-business-primary,#4c8dff) 0 5px,transparent 5px 9px)}
@keyframes amp-borrow-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.amp-borrow-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;background:var(--dsw-alias-label-tertiary,#8a8a8a)}
.amp-borrow-dot[data-s=on]{background:var(--dsw-alias-state-success-primary,#57c785)}
.amp-borrow-dot[data-s=wait]{background:#d29922}
.amp-borrow-dot[data-s=stop]{background:#e5534b}
.amp-borrow-meters{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.amp-borrow-meters div{display:flex;flex-direction:column;gap:1px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));min-width:0}
.amp-borrow-meters span{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.amp-borrow-meters b{font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.amp-borrow-btn{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:10px;background:transparent;color:inherit;font:inherit;padding:7px 10px;cursor:pointer}
.amp-borrow-btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary,#4c8dff)}
.amp-borrow-btn:disabled{opacity:.45;cursor:default}
.amp-borrow-stop{width:100%;border-color:#e5534b;color:#e5534b;font-weight:600}
.amp-borrow-stop:hover{background:rgba(229,83,75,.1)}
.amp-borrow-say{margin:0;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.amp-borrow-say[data-warn]{color:#d29922}
.amp-borrow-field{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.35));border-radius:8px;background:var(--dsw-alias-bg-l2,transparent);color:inherit;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;resize:none}
.amp-borrow-field:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4c8dff)}
.amp-borrow-row2{display:flex;gap:6px}.amp-borrow-row2>*{flex:1;min-width:0}
.amp-borrow-big{width:100%;padding:13px 14px;border-radius:12px;border:1px solid var(--dsw-alias-state-business-primary,#4c8dff);background:rgba(76,141,255,.12);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s ease}
.amp-borrow-big:hover:not(:disabled){background:rgba(76,141,255,.22)}
.amp-borrow-big:disabled{opacity:.5;cursor:default}
.amp-borrow-big-stop{border-color:#e5534b;background:rgba(229,83,75,.12);color:#ff7b72}
.amp-borrow-big-stop:hover:not(:disabled){background:rgba(229,83,75,.22)}
.amp-borrow-line1{display:flex;align-items:center;gap:8px;margin:0;font-size:13px;line-height:18px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.amp-borrow-small{align-self:center;border:0;background:none;color:var(--dsw-alias-label-tertiary,#8a8a8a);font:inherit;font-size:12px;cursor:pointer;padding:4px 6px}
.amp-borrow-small:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}
.amp-borrow-ping{align-self:flex-start;padding:0;font-variant-numeric:tabular-nums}
.amp-borrow-banner{display:flex;align-items:center;gap:8px;padding:5px 10px;margin:0 0 6px;border-radius:10px;font-size:12px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.amp-borrow-banner span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amp-borrow-banner button{border:0;background:none;color:#e5534b;font:inherit;font-weight:600;cursor:pointer;padding:2px 4px}
@media (prefers-reduced-motion:reduce){.amp-borrow-wire[data-on]{animation:none}}
`;

    // One thing on screen at a time: one short line and one big button. Everything else happens by itself.
    const Big = ({onClick, children, danger, disabled}) => h('button', {type: 'button', className: 'amp-borrow-big' + (danger ? ' amp-borrow-big-stop' : ''), disabled, onClick}, children);
    const Line = ({children, dot}) => h('p', {className: 'amp-borrow-line1'}, dot ? h('span', {className: 'amp-borrow-dot', 'data-s': dot}) : null, h('span', null, children));
    const Small = ({onClick, children}) => h('button', {type: 'button', className: 'amp-borrow-small', onClick}, children);
    async function readClip() { try { return (await navigator.clipboard.readText()) || ''; } catch { return null; } }
    function PasteBox({placeholder, onText}) {
      return h('input', {id: 'amp-borrow-pastebox', className: 'amp-borrow-field', autoFocus: true, placeholder,
        onPaste: e => { const t = e.clipboardData?.getData('text') || ''; if (t) { e.preventDefault(); onText(t); } },
        onKeyDown: e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) onText(e.currentTarget.value); }});
    }

    function ShareSide({s, onOff}) {
      const host = s.host || {}, turn = host.live?.turn;
      const [stage, setStage] = React.useState('idle');       // idle | copy | box | done
      const [msg, setMsg] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const makeInvite = async link => {
        setBusy(true);
        const r = await borrowCall('invite', {share: String(link || '').trim()});
        setBusy(false);
        if (!r?.invite) { setMsg('That was not the Tailscale link. Copy it again, then press I copied it.'); setStage('copy'); return; }
        let copied = false; try { await navigator.clipboard.writeText(r.invite); copied = true; } catch {}
        setMsg(copied ? null : r.invite); setStage('done');
      };
      const copiedIt = async () => { const t = await readClip(); if (t === null) { setStage('box'); setMsg(null); } else makeInvite(t); };
      let line, dot = 'on';
      if (!host.sharing) { dot = 'wait'; line = host.step?.say || (host.problem && !/Stopped/.test(host.problem) ? host.problem : 'Getting ready…'); }
      else if (turn) line = `${turn.friend} is using your AI.`;
      else if (!host.models?.length) line = 'Sharing is on. Your friend can use it once you load an AI.';
      else line = 'Sharing is on.';
      return h('section', null,
        h(Line, {dot}, line),
        turn ? h(React.Fragment, null,
          h('div', {className: 'amp-borrow-meters'},
            h('div', null, h('span', null, 'Speed'), h('b', null, turn.replying ? `${turn.tps || 0}/s` : '–')),
            h('div', null, h('span', null, 'In'), h('b', null, num(turn.tokIn))),
            h('div', null, h('span', null, 'Out'), h('b', null, num(turn.tokOut))),
            h('div', null, h('span', null, 'Left'), h('b', null, clock(turn.secondsLeft)))),
          h(Big, {danger: true, onClick: () => borrowCall('stop', {})}, 'Force stop')) : null,
        host.sharing && !turn ? (
          stage === 'idle' ? h(Big, {onClick: () => { window.open(host.tsIP ? `https://login.tailscale.com/admin/machines/${host.tsIP}` : 'https://login.tailscale.com/admin/machines', '_blank', 'noopener'); setStage('copy'); }}, 'Invite a friend')
          : stage === 'copy' ? h(React.Fragment, null, h(Line, null, msg || 'In Tailscale, press Share, then Copy link.'), h(Big, {disabled: busy, onClick: copiedIt}, 'I copied it'))
          : stage === 'box' ? h(React.Fragment, null, h(Line, null, 'Paste the Tailscale link here.'), h(PasteBox, {placeholder: 'Paste here', onText: makeInvite}))
          : h(React.Fragment, null,
              h(Line, {dot: 'on'}, msg ? 'Send this to your friend:' : 'Invite copied. Paste it to your friend.'),
              msg ? h('input', {id: 'amp-borrow-invite', className: 'amp-borrow-field', readOnly: true, value: msg, onFocus: e => e.currentTarget.select()}) : null,
              h(Small, {onClick: () => { setStage('idle'); setMsg(null); }}, 'Invite someone else'))
        ) : null,
        h(Small, {onClick: () => { onOff?.(); borrowCall('share', {on: false}); }}, 'Turn sharing off'));
    }

    function UseSide({s, onBack}) {
      const f = s.friend || {}, st = f.state || {};
      const [box, setBox] = React.useState(false);
      const [err, setErr] = React.useState(null);
      const [ping, setPing] = React.useState(() => { try { return localStorage.getItem('amp-borrow-ping') !== 'off'; } catch { return true; } });
      const join = async text => { setErr(null); const r = await borrowCall('join', {invite: text}); if (r?.error) { setErr(r.error); setBox(false); } };
      const paste = async () => { const t = await readClip(); if (t === null) setBox(true); else join(t); };
      if (!f.host && !f.pending) return h('section', null,
        h(Line, null, err || (f.step?.say && f.step.step !== 'ready' ? f.step.say : 'Copy the invite your friend sent, then press:')),
        box ? h(PasteBox, {placeholder: 'Paste the invite here', onText: join}) : h(Big, {onClick: paste}, 'Paste invite'),
        onBack ? h(Small, {onClick: onBack}, 'Back') : null);
      if (f.pending) return h('section', null, h(Line, {dot: 'wait'}, f.step?.say || 'Connecting…'), h(Small, {onClick: () => borrowCall('leave', {})}, 'Cancel'));
      const where = st.path?.words || (st.connected ? 'Connected' : null);
      const turnLine = {yours: 'Your turn.', waiting: `${f.host} is using it. Yours is next.`, host: `${f.host} is using it. Yours is next.`, other: 'Someone else is using it.', off: `${f.host} stopped sharing.`}[st.turn];
      return h('section', null,
        h(Line, {dot: st.turn === 'off' ? 'stop' : st.connected ? (st.turn === 'waiting' || st.turn === 'host' ? 'wait' : 'on') : 'wait'},
          st.connected ? `Connected to ${f.host}.` : `Reconnecting to ${f.host}…`),
        st.connected && (st.models?.length ? h(Line, null, turnLine || `New chats use ${f.host}'s AI.`) : h(Line, null, `${f.host} has no AI loaded right now. It comes back by itself.`)),
        st.connected && where ? h('button', {type: 'button', className: 'amp-borrow-small amp-borrow-ping', title: 'Show or hide the ping',
          onClick: () => { const v = !ping; setPing(v); try { localStorage.setItem('amp-borrow-ping', v ? 'on' : 'off'); } catch {} }},
          ping && Number.isFinite(st.pingMs) ? `${where} · ${st.pingMs} ms` : where) : null,
        f.problem ? h(Line, null, f.problem) : null,
        st.turn === 'yours' ? h(Big, {onClick: () => borrowCall('done', {})}, "I'm done") : null,
        h(Small, {onClick: () => borrowCall('leave', {})}, 'Stop using this AI'));
    }

    function BorrowView() {
      const [s, err] = useBorrow(BORROW_POLL_OPEN);
      const [pick, setPick] = React.useState(null);
      if (!s && err === 'restart') return h('div', {className: 'amp-borrow'}, h(Line, {dot: 'wait'}, 'Restart DeepSeek Harness to finish. This page then works by itself.'));
      if (!s) return h('div', {className: 'amp-borrow'}, h(Line, {dot: 'wait'}, err || 'One moment…'));
      const sharing = pick !== 'off' && (s.host?.wish || s.host?.sharing);
      const using = s.friend?.host || s.friend?.pending;
      const side = sharing ? 'share' : using ? 'use' : pick;
      return h('div', {className: 'amp-borrow'},
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
        h('span', {className: 'amp-borrow-dot', 'data-s': 'wait'}),
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
