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

