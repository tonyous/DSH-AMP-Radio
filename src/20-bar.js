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
