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

    function BorrowView() {
      const [s, err] = useBorrow(BORROW_POLL_OPEN);
      const [pick, setPick] = React.useState(null);
      if (!s && err === 'restart') return h('div', {className: 'amp-borrow'}, h(Line, {mark: 'wait'}, 'Restart DeepSeek Harness to finish, this page then works by itself'));
      if (!s) return h('div', {className: 'amp-borrow'}, h(Line, {mark: 'wait'}, err || 'One moment'));
      const sharing = s.host?.wish || s.host?.sharing;
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
        h('span', {className: 'amp-borrow-mark', 'data-s': 'wait'}),
        h('span', null, `Your AI is lent to ${host.lockFriend || 'a friend'}.` + (host.waitingHere ? ' Your message waits until they are done.' : '')),
        h('button', {type: 'button', onClick: () => borrowCall('stop', {})}, 'Force stop'));
    }
