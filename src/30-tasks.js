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

