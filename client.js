window.__ModuleLoader__.load({
  id: 'dsh-amp-radio',
  factory(require) {
    const React = require('react');
    const {createPortal} = require('react-dom');
    const h = React.createElement;

    // Always-available offline stations (no network needed).
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
      .dsh-radio-pill-fixed{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:2147483000;box-shadow:0 4px 16px rgba(0,0,0,.4);background:rgba(20,20,24,.92);cursor:grab;}
      .dsh-radio-pill-fixed:active{cursor:grabbing;}
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
      .dsh-radio-title-link{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8a8a);text-decoration:none;transition:color .15s ease;display:flex;align-items:center;}
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

    function RadioPillInner() {
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
          if (p && isFinite(p.left) && isFinite(p.top)) return p;
        } catch {}
        return null;
      });
      const justDraggedRef = React.useRef(false);
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

      // Pill visualizer animation loop (small canvas in the pill).
      // Self-healing: derives playing from the element too (React state can desync),
      // resumes a suspended context, and paints static bars when the stream is
      // cross-origin without CORS headers (analyser reads silence by spec).
      React.useEffect(() => {
        const el = audioRef.current;
        const elemPlaying = !!(el && !el.paused && el.src);
        if (!playing && !elemPlaying) return undefined;
        let animId;
        let cancelled = false;
        const start = requestAnimationFrame(() => {
          let { analyser: a } = ensureAudioContext();
          if (!a) return;
          if (a.context && a.context.state === 'suspended') {
            try { a.context.resume(); } catch {}
          }
          const data = new Uint8Array(a.frequencyBinCount);
          let flatFrames = 0;

          function draw() {
            if (cancelled) return;
            animId = requestAnimationFrame(draw);
            const canvas = pillCanvasRef.current;
            if (!canvas) return;
            const ctx2d = canvas.getContext('2d');
            a.getByteFrequencyData(data);
            let peak = 0;
            for (let k = 0; k < data.length; k++) if (data[k] > peak) peak = data[k];
            if (peak === 0 && ++flatFrames > 60) {
              // Cross-origin stream without CORS: analyser is silent by spec.
              // Paint static mid bars so the pill honestly shows "playing".
              cancelAnimationFrame(animId);
              const w = canvas.width;
              const h = canvas.height;
              ctx2d.clearRect(0, 0, w, h);
              ctx2d.fillStyle = '#4c8dff';
              for (let i = 0; i < 5; i++) {
                const bh = h * 0.45;
                ctx2d.fillRect(i * (w / 5) + 1, h - bh, w / 5 - 2, bh);
              }
              return;
            }
            if (peak > 0) flatFrames = 0;
            const w = canvas.width;
            const h = canvas.height;
            ctx2d.clearRect(0, 0, w, h);

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
          }
          draw();
        });

        return () => {
          cancelled = true;
          cancelAnimationFrame(start);
          if (animId) cancelAnimationFrame(animId);
        };
      }, [playing]);

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
          ref: pillRef, type: 'button', className: 'dsh-radio-pill dsh-radio-pill-fixed',
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
          onMouseDown: startDrag,
          style: pillPos ? {left: pillPos.left + 'px', top: pillPos.top + 'px', transform: 'none', bottom: 'auto'} : undefined,
        },
          h(AmpLogo, {size: 10}),
          loading ? h('span', {className: 'dsh-radio-pill-label dsh-radio-pill-loading'}, 'Connecting…') : null,
          playing ? h('canvas', {
            ref: (el) => { pillCanvasRef.current = el; },
            className: 'dsh-radio-pill-visualizer',
            width: 36,
            height: 14,
            'aria-hidden': true,
          }) : null
        ),
        open && pos && createPortal(h('div', {
          ref: panelRef,
          className: 'dsh-radio-panel' + (closing ? ' dsh-radio-panel-closing' : ''),
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
              href: 'https://discord.gg/tZKwTk9y',
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
            h('button', {type: 'button', className: 'dsh-radio-close', 'aria-label': 'Close', onClick: closePanel}, '×')
          ),
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
      return createPortal(h(RadioPillInner, null), el);
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
    }

    return {inject: ['slots'], apply, RadioPill};
  },
});
