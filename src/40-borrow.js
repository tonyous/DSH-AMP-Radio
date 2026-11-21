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
        if (r.status === 404) { borrowSet(null, 'Restart DSH once to finish installing this part of AMP.'); return null; }
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
.amp-borrow-banner{display:flex;align-items:center;gap:8px;padding:5px 10px;margin:0 0 6px;border-radius:10px;font-size:12px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.amp-borrow-banner span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.amp-borrow-banner button{border:0;background:none;color:#e5534b;font:inherit;font-weight:600;cursor:pointer;padding:2px 4px}
@media (prefers-reduced-motion:reduce){.amp-borrow-wire[data-on]{animation:none}}
`;

    function Step({step, onRetry}) {
      const ref = React.useRef(null);
      if (!step || step.step === 'ready') return step?.warn ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, step.warn) : null;
      return h('div', {style: {display: 'flex', flexDirection: 'column', gap: 6}},
        h('p', {className: 'amp-borrow-say', 'data-warn': ''}, step.say),
        step.command ? h('div', {className: 'amp-borrow-row2'},
          h('input', {ref, id: 'amp-borrow-cmd', className: 'amp-borrow-field', readOnly: true, value: step.command}),
          h('button', {type: 'button', className: 'amp-borrow-btn', style: {flex: 'none'}, onClick: () => copy(step.command, ref.current)}, 'Copy')) : null,
        step.step === 'missing' ? h('a', {className: 'amp-borrow-btn', href: 'https://tailscale.com/download', target: '_blank', rel: 'noopener noreferrer', style: {textAlign: 'center', textDecoration: 'none'}}, 'Get Tailscale') : null,
        step.url ? h('a', {className: 'amp-borrow-btn', href: step.url, target: '_blank', rel: 'noopener noreferrer', style: {textAlign: 'center', textDecoration: 'none'}}, step.step === 'accept' ? 'Open the share' : 'Open the page') : null,
        h('button', {type: 'button', className: 'amp-borrow-btn', onClick: onRetry}, 'Check again'));
    }

    function ShareSide({s}) {
      const host = s.host || {}, live = host.live || {}, turn = live.turn;
      const [busy, setBusy] = React.useState(false);
      const [name, setName] = React.useState('');
      const [share, setShare] = React.useState('');
      const [invite, setInvite] = React.useState(null);
      const [msg, setMsg] = React.useState(null);
      const inviteRef = React.useRef(null);
      const act = async (path, body) => { setBusy(true); try { return await borrowCall(path, body); } finally { setBusy(false); } };
      const on = !!host.sharing;
      const dot = turn ? 'on' : on ? (host.problem ? 'wait' : 'on') : host.problem && /Stopped/.test(host.problem) ? 'stop' : '';
      return h('section', null,
        h('div', {className: 'amp-bar-row'},
          h('span', {style: {display: 'flex', alignItems: 'center', gap: 8}}, h('span', {className: 'amp-borrow-dot', 'data-s': dot}), h('b', {style: {fontWeight: 600}}, 'Share my AI')),
          h('button', {type: 'button', role: 'switch', 'aria-checked': on, 'aria-label': 'Share my AI', className: 'amp-bar-switch', disabled: busy,
            onClick: () => act('share', {on: !on})})),
        h(Step, {step: host.step, onRetry: () => act('share', {on: true})}),
        host.problem ? h('p', {className: 'amp-borrow-say', 'data-warn': on ? '' : undefined}, host.problem) : null,
        on && !turn ? h('p', {className: 'amp-borrow-say'}, host.models?.length ? `Ready to lend: ${host.models.join(', ')}.` : 'Nothing loaded yet.') : null,
        turn ? h(React.Fragment, null,
          h('div', {className: 'amp-borrow-line'}, h('b', null, host.name || 'You'), h('span', {className: 'amp-borrow-wire', 'data-on': turn.connected ? '' : undefined}), h('b', null, turn.friend)),
          h('p', {className: 'amp-borrow-say'}, turn.replying ? `${turn.friend} is using your AI. Your messages wait until they are done.` : `${turn.friend} has the turn. It comes back to you after a quiet moment.`),
          h('div', {className: 'amp-borrow-meters'},
            h('div', null, h('span', null, 'Speed'), h('b', null, turn.replying ? `${turn.tps || 0}/s` : '–')),
            h('div', null, h('span', null, 'In'), h('b', null, num(turn.tokIn))),
            h('div', null, h('span', null, 'Out'), h('b', null, num(turn.tokOut))),
            h('div', null, h('span', null, 'Left'), h('b', null, clock(turn.secondsLeft)))),
          h('button', {type: 'button', className: 'amp-borrow-btn', disabled: busy, onClick: () => act('release', {})}, 'Free it now')) : null,
        on && live.waiting?.length ? h('p', {className: 'amp-borrow-say'}, `${live.waiting.join(', ')} is waiting for your reply to finish.`) : null,
        on ? h('button', {type: 'button', className: 'amp-borrow-btn amp-borrow-stop', disabled: busy, onClick: () => act('stop', {})}, 'Force stop') : null,
        on ? h('details', null,
          h('summary', {style: {cursor: 'pointer', fontSize: 12}}, 'Invite a friend'),
          h('div', {style: {display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8}},
            h('p', {className: 'amp-borrow-say'}, '1. In Tailscale, press Share on this PC and copy the link. 2. Paste it here, add their name, make the invite.'),
            h('a', {className: 'amp-borrow-btn', href: 'https://login.tailscale.com/admin/machines', target: '_blank', rel: 'noopener noreferrer', style: {textAlign: 'center', textDecoration: 'none'}}, 'Open Tailscale'),
            h('input', {id: 'amp-borrow-share', className: 'amp-borrow-field', placeholder: 'Tailscale share link', value: share, onChange: e => setShare(e.target.value)}),
            h('input', {id: 'amp-borrow-name', className: 'amp-borrow-field', placeholder: "Friend's name", value: name, onChange: e => setName(e.target.value)}),
            h('button', {type: 'button', className: 'amp-borrow-btn', disabled: busy || !name.trim(), onClick: async () => {
              const r = await act('invite', {name, share: share.trim() || undefined});
              if (r?.invite) { setInvite(r.invite); setMsg(null); } else setMsg(r?.error || 'That did not work. Try again.');
            }}, 'Make invite'),
            msg ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, msg) : null,
            invite ? h('div', {className: 'amp-borrow-row2'},
              h('input', {ref: inviteRef, id: 'amp-borrow-invite', className: 'amp-borrow-field', readOnly: true, value: invite}),
              h('button', {type: 'button', className: 'amp-borrow-btn', style: {flex: 'none'}, onClick: async () => setMsg(await copy(invite, inviteRef.current) ? 'Copied. Send it to your friend; it works for 24 hours.' : 'Selected. Press Ctrl+C to copy.')}, 'Copy invite')) : null)) : null);
    }

    function UseSide({s}) {
      const f = s.friend || {}, st = f.state || {};
      const [text, setText] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [say, setSay] = React.useState(null);
      const [showPing, setShowPing] = React.useState(() => { try { return localStorage.getItem('amp-borrow-ping') !== 'off'; } catch { return true; } });
      const act = async (path, body) => { setBusy(true); try { const r = await borrowCall(path, body); setSay(r?.error || r?.say || null); return r; } finally { setBusy(false); } };
      if (!f.host) return h('section', null,
        h('h3', null, "Use a friend's AI"),
        h('textarea', {id: 'amp-borrow-paste', className: 'amp-borrow-field', rows: 3, placeholder: 'Paste the invite your friend sent', value: text, onChange: e => setText(e.target.value)}),
        h('button', {type: 'button', className: 'amp-borrow-btn', disabled: busy || !text.trim(), onClick: () => act('join', {invite: text})}, busy ? 'Connecting…' : 'Connect'),
        h(Step, {step: f.step && f.step.step !== 'ready' ? f.step : null, onRetry: () => act('join', {invite: text})}),
        say ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, say) : null,
        borrowState?.friend?.problem ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, borrowState.friend.problem) : null);
      const turnWords = {yours: 'Your turn.', free: 'Free. Send a message to start your turn.', host: `${f.host} is using it. You are next.`,
        waiting: `${f.host} is using it. Your message goes by itself when they finish.`, other: 'Someone else has the turn.', off: `${f.host} stopped sharing.`}[st.turn] || 'Connecting…';
      const path = st.path?.words || (st.connected ? 'Connected' : 'Reconnecting…');
      return h('section', null,
        h('h3', null, "Using a friend's AI"),
        h('div', {className: 'amp-borrow-line'}, h('b', null, 'You'), h('span', {className: 'amp-borrow-wire', 'data-on': st.connected ? '' : undefined, 'data-relay': st.path?.kind === 'relay' ? '' : undefined}), h('b', null, f.host)),
        h('p', {className: 'amp-borrow-say', style: {display: 'flex', alignItems: 'center', gap: 8}},
          h('span', {className: 'amp-borrow-dot', 'data-s': st.turn === 'off' ? 'stop' : st.connected ? (st.turn === 'waiting' || st.turn === 'host' ? 'wait' : 'on') : 'wait'}),
          h('span', null, turnWords)),
        h('p', {className: 'amp-borrow-say'}, showPing && Number.isFinite(st.pingMs) ? `${path} · ${st.pingMs} ms` : path,
          Number.isFinite(st.secondsLeft) && st.turn === 'yours' ? ` · ${clock(st.secondsLeft)} left` : ''),
        st.models?.length ? h('p', {className: 'amp-borrow-say'}, `In your model list as "Borrowed · ${f.host}": ${st.models.map(m => m.name || m.id).join(', ')}.`) : null,
        st.problem && st.turn !== 'off' ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, st.problem) : null,
        f.problem ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, f.problem) : null,
        f.manual ? h('p', {className: 'amp-borrow-say'}, `Base URL ${f.manual.baseURL} · API protocol OpenAI Chat Completions · key ${f.manual.key} · model ${f.manual.models.join(', ')}`) : null,
        h('div', {className: 'amp-borrow-row2'},
          h('button', {type: 'button', className: 'amp-borrow-btn', disabled: busy || st.turn !== 'yours', onClick: () => act('done', {})}, "I'm done"),
          h('button', {type: 'button', className: 'amp-borrow-btn', disabled: busy, onClick: () => act('leave', {})}, 'Forget this friend')),
        h('div', {className: 'amp-bar-row'}, h('span', null, 'Show ping'),
          h('button', {type: 'button', role: 'switch', 'aria-checked': showPing, 'aria-label': 'Show ping', className: 'amp-bar-switch',
            onClick: () => { const v = !showPing; setShowPing(v); try { localStorage.setItem('amp-borrow-ping', v ? 'on' : 'off'); } catch {} }})),
        say ? h('p', {className: 'amp-borrow-say'}, say) : null);
    }

    function BorrowView() {
      const [s, err] = useBorrow(BORROW_POLL_OPEN);
      if (!s) return h('div', {className: 'amp-borrow'}, h('p', {className: 'amp-borrow-say'}, err || 'Checking…'));
      return h('div', {className: 'amp-borrow'},
        err ? h('p', {className: 'amp-borrow-say', 'data-warn': ''}, err) : null,
        s.friend?.host ? null : h(ShareSide, {s}),
        s.host?.sharing ? null : h(UseSide, {s}));
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
