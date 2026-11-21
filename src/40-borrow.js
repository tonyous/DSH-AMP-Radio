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
