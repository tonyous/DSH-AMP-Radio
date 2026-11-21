// Borrow my AI inside DSH's server: the one controller the AMP plugin's index.js starts.
//
// Host:   Share my AI on -> check Tailscale -> read which local models are loaded -> start the gate (child process)
//         -> open Tailscale's door for one port -> make invites. While a friend has the turn, this DSH's own requests to
//         those local models wait (the lock). Force stop: the friend is told, the gate ends, the door closes, checked.
// Friend: paste an invite -> check Tailscale -> wait for Accept -> start AMP Link -> add "Borrowed · <name>" to DSH's
//         models. Leave: remove it and put their old default model back.
// Every DSH service is optional (ctx.get at the use site): a DSH without one shows a plain message for that part,
// and nothing here can stop the radio, the bar or DSH itself.
import {fork} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync, renameSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULTS, encodeInvite, decodeInvite, isShareLink} from './protocol.mjs';
import {offerFromConfig, buildProvider, providerId, addProvider, removeProvider, restoreDefault, KEY_ENV, isLocalURL} from './provider.mjs';
import {createTailscale, setupStep, freeDoorPort, pathWords} from './tailscale.mjs';
import {createLink} from './link.mjs';

const GATE = fileURLToPath(new URL('./gate.mjs', import.meta.url));
export const HOST_SAY = Object.freeze({
  noConfig: "This DSH can't share its models yet. Update DSH, then try again.",
  noLocal: "No AI is running on this PC right now. Load one in DSH's model picker and sharing starts by itself.",
  gateDied: 'The sharing helper stopped. Turn Share my AI on again.',
  stopped: 'Stopped. Nobody is connected.',
  doorStillOpen: "Stopped, but Tailscale still shows AMP's door. Turn Tailscale off and on, or restart DSH.",
  notSharing: 'Turn Share my AI on first.',
  shareLink: 'That is not a Tailscale share link. In Tailscale, press Share on this PC, then Copy link.',
  waitAccept: 'Waiting for you to press Accept in the Tailscale tab.',
  joined: name => `Connected to ${name}'s AI.`,
  left: 'Removed. Your own models are back.',
  noEditor: 'This DSH cannot add models by itself. Open Settings, Models, Custom model API, and enter the four values below.',
});

const readJSON = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const writeJSON = (f, v) => {
  const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(v, null, 1), {mode: 0o600}); renameSync(tmp, f);
};

export function createBorrow({ctx, home, tailscale = createTailscale(), forkImpl = fork, fetchImpl = globalThis.fetch,
  report = () => {}, refreshMs = 10_000, resumeDelayMs = 10_000} = {}) {
  const dir = join(home, 'amp-radio', 'borrow');
  try { mkdirSync(join(dir, 'gate'), {recursive: true, mode: 0o700}); } catch {}
  const settingsFile = join(dir, 'settings.json'), friendFile = join(dir, 'friend.json');
  const settings = {sharing: false, hostName: '', idleMin: 3, turnHours: 2, dayHours: 4, showPing: true, ...(readJSON(settingsFile) || {})};
  const save = () => { try { writeJSON(settingsFile, settings); } catch (e) { report('borrow settings', e); } };
  const svc = name => { try { return ctx.get?.(name) ?? ctx[name] ?? null; } catch { return null; } };

  // ---- reading DSH's own settings -----------------------------------------------------------------------------------
  function rowOf(match) {
    const ed = svc('configEditor');
    if (!ed?.configuration) return null;
    try {
      const row = ed.configuration().find(r => match(r.entry?.options));
      if (!row) return null;
      const effective = row.override && Object.keys(row.override).length ? row.override : row.inherited;
      return {entry: row.entry, effective: effective || {}, ed};
    } catch (e) { report('borrow read settings', e); return null; }
  }
  const piAiRow = () => rowOf(o => o?.id === 'llm-pi-ai' || String(o?.name || '').includes('dsh-llm-pi-ai'));
  const defaultRow = () => rowOf(o => o?.id === 'agent-default-model' || String(o?.name || '').includes('dsh-agent-default-model'));

  async function keysFor(cfg) {
    const env = {...process.env}, creds = svc('credentials');
    for (const p of Object.values(cfg?.providers || {})) {
      if (!p?.apiKeyEnv || !isLocalURL(p.baseURL)) continue;
      try { const hit = await creds?.resolve?.(p.apiKeyEnv); if (hit?.value) env[p.apiKeyEnv] = hit.value; } catch {}
    }
    return env;
  }
  // Which local models answer right now (the one loaded on the graphics card). Never loads anything.
  async function loadedModels() {
    const row = piAiRow();
    if (!row) return {error: HOST_SAY.noConfig, models: []};
    const all = offerFromConfig(row.effective, await keysFor(row.effective));
    const up = await Promise.all(all.map(async m => {
      try {
        const r = await fetchImpl(m.upstream.baseURL.replace(/\/+$/, '') + '/models', {
          headers: m.upstream.apiKey ? {authorization: 'Bearer ' + m.upstream.apiKey} : {}, signal: AbortSignal.timeout(1500)});
        return r.ok ? m : null;
      } catch { return null; }
    }));
    return {models: up.filter(Boolean), providers: new Set(all.map(m => m.provider))};
  }

  // ---- host: the gate, the door, the lock ---------------------------------------------------------------------------
  const host = {sharing: false, step: null, problem: null, door: null, gate: null, gatePort: null, state: null,
    lock: false, lockFriend: null, localProviders: new Set(), models: [], tsName: null, waitingHere: 0};
  const pending = new Map(); let seq = 0;
  const unlockWaiters = new Set();
  const toGate = (msg, reply) => new Promise(resolve => {
    if (!host.gate?.connected) return resolve(null);
    if (!reply) { try { host.gate.send(msg); } catch {} return resolve(true); }
    const id = ++seq; pending.set(id, resolve);
    setTimeout(() => { if (pending.delete(id)) resolve(null); }, 5000);
    try { host.gate.send({...msg, id}); } catch { pending.delete(id); resolve(null); }
  });
  const setLock = (on, friend = null) => {
    host.lock = on; host.lockFriend = on ? friend : null;
    if (!on) for (const r of [...unlockWaiters]) r();
  };

  let refreshT = null;
  async function refresh() {
    const r = await loadedModels();
    host.localProviders = r.providers || new Set();
    host.models = r.models.map(m => m.id);
    if (r.error) host.problem = r.error;
    else if (!r.models.length) host.problem = HOST_SAY.noLocal;
    else if (host.problem === HOST_SAY.noLocal || host.problem === HOST_SAY.noConfig) host.problem = null;
    await toGate({type: 'models', models: r.models});
  }

  async function startSharing() {
    if (host.sharing) return status();
    host.problem = null;
    const st = await tailscale.status();
    const step = setupStep(st);
    host.step = step; host.tsName = st?.name || null;
    if (step.step !== 'ready') return status();
    const r = await loadedModels();
    if (r.error) { host.problem = r.error; return status(); }
    host.localProviders = r.providers; host.models = r.models.map(m => m.id);
    if (!settings.hostName) { settings.hostName = st.user || 'Your friend'; save(); }
    // the gate
    const child = forkImpl(GATE, [], {stdio: ['ignore', 'ignore', 'pipe', 'ipc'], execArgv: []});
    host.gate = child;
    child.stderr?.on?.('data', d => report('borrow gate', String(d).slice(0, 300)));
    child.on('message', m => {
      if (m?.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m?.type === 'state') host.state = m.state;
      if (m?.type === 'lock') setLock(!!m.on, m.friend);
      if (m?.type === 'problem') report('borrow ' + m.where, m.message);
    });
    child.on('exit', () => {
      if (host.gate !== child) return;                 // an older helper ending late: not the one in use
      const wasOn = host.sharing;
      host.gate = null; setLock(false);
      if (wasOn) { host.problem = HOST_SAY.gateDied; stopSharing({keepSetting: true}).catch(() => {}); }
    });
    const ready = await new Promise(resolve => {
      const t = setTimeout(() => resolve(null), 8000);
      child.once('message', function first(m) { if (m?.type === 'ready') { clearTimeout(t); resolve(m.port); } else child.once('message', first); });
      try {
        child.send({type: 'start', stateDir: join(dir, 'gate'), hostName: settings.hostName, models: r.models, limits: {
          ...DEFAULTS, idleMs: settings.idleMin * 60_000, turnMs: settings.turnHours * 3600_000, dayMs: settings.dayHours * 3600_000}});
      } catch { clearTimeout(t); resolve(null); }
    });
    if (!ready) { try { child.kill(); } catch {} host.gate = null; host.problem = HOST_SAY.gateDied; return status(); }
    host.gatePort = ready;
    // the door
    const port = freeDoorPort(await tailscale.doorPorts());
    const opened = await tailscale.openDoor({port, target: `http://127.0.0.1:${ready}`});
    if (!opened.ok) {
      try { child.kill(); } catch {} host.gate = null;
      host.step = {step: opened.problem, say: opened.say, url: opened.url || null, command: opened.problem === 'operator' ? tailscale.operatorCommand() : null};
      return status();
    }
    host.door = {port: opened.port, url: opened.url || `https://${st.name}:${opened.port}`};
    host.sharing = true; settings.sharing = true; settings.lastDoor = opened.port; save();
    if (!r.models.length) host.problem = HOST_SAY.noLocal;
    clearInterval(refreshT); refreshT = setInterval(() => refresh().catch(e => report('borrow refresh', e)), refreshMs); refreshT.unref?.();
    return status();
  }

  async function stopSharing({keepSetting = false, force = false} = {}) {
    clearInterval(refreshT); refreshT = null;
    const child = host.gate;
    if (child) {
      if (force) {                                                    // the friend is told first, mid-reply if need be
        await toGate({type: 'stop'}, true);
        await new Promise(r => setTimeout(r, 400));                   // let that last message cross the door before it closes
      }
      host.gate = null;
      try { child.disconnect?.(); } catch {}
      await new Promise(r => { const t = setTimeout(r, 2000); child.once?.('exit', () => { clearTimeout(t); r(); }); });
      if (child.exitCode === null) try { child.kill('SIGKILL'); } catch {}
    }
    setLock(false);
    const closed = await tailscale.closeDoor({probeURL: host.door?.url ? host.door.url + '/amp/v1/hello' : null});
    host.sharing = false; host.door = null; host.state = null; host.gatePort = null;
    if (!keepSetting) { settings.sharing = false; save(); }
    if (force) host.problem = closed.closed ? HOST_SAY.stopped : HOST_SAY.doorStillOpen;
    return {...status(), closed: closed.closed};
  }

  async function invite(name, shareLink) {
    if (!host.sharing || !host.door) return {error: HOST_SAY.notSharing};
    if (shareLink && !isShareLink(shareLink)) return {error: HOST_SAY.shareLink};
    const added = await toGate({type: 'addFriend', name: String(name || 'Friend').slice(0, 40)}, true);
    if (!added?.key) return {error: HOST_SAY.gateDied};
    return {invite: encodeInvite({host: settings.hostName, url: host.door.url, key: added.key, exp: added.inviteExp, share: shareLink?.trim() || null}), expires: added.inviteExp};
  }

  // The lock on this DSH's own chats. Only local models this PC lends are held; cloud models never wait.
  const waitUnlocked = signal => new Promise((resolve, reject) => {
    if (!host.lock) return resolve();
    const done = () => { unlockWaiters.delete(done); signal?.removeEventListener?.('abort', onAbort); resolve(); };
    const onAbort = () => { unlockWaiters.delete(done); reject(signal.reason ?? new Error('aborted')); };
    unlockWaiters.add(done); signal?.addEventListener?.('abort', onAbort, {once: true});
  });
  function guard(provider, options, start) {
    if (!host.sharing || !host.localProviders.has(provider)) return start();
    return (async function* () {
      if (host.lock) { host.waitingHere++; try { await waitUnlocked(options?.signal); } finally { host.waitingHere--; } }
      busy(+1);
      try { yield* await start(); } finally { busy(-1); }
    })();
  }
  let hostBusy = 0;
  const busy = d => { hostBusy = Math.max(0, hostBusy + d); toGate({type: 'hostBusy', n: hostBusy}); };
  function installLock() {
    const llm = svc('llm');
    if (!llm || typeof llm.stream !== 'function') return () => {};
    const stream = llm.stream, prepare = llm.prepareCall;
    const streamLocked = function (options) { return guard(options?.provider, options, () => stream.call(this, options)); };
    llm.stream = streamLocked;
    let prepareLocked = null;
    if (typeof prepare === 'function') {
      prepareLocked = async function (cfg, ...rest) {
        const call = await prepare.call(this, cfg, ...rest);
        if (!call || typeof call.stream !== 'function') return call;
        return {...call, stream: options => guard(cfg?.provider, options, () => call.stream(options))};
      };
      llm.prepareCall = prepareLocked;
    }
    return () => { if (llm.stream === streamLocked) llm.stream = stream; if (prepareLocked && llm.prepareCall === prepareLocked) llm.prepareCall = prepare; };
  }

  // ---- friend: the link and the Borrowed models ---------------------------------------------------------------------
  const friend = {link: null, saved: readJSON(friendFile), state: null, step: null, problem: null, providerSet: false};
  async function setKey(key) {
    process.env[KEY_ENV] = key;
    try { await svc('credentials')?.set?.(KEY_ENV, key); } catch {}
  }
  async function writeProvider(models) {
    const s = friend.saved; if (!s) return;
    const row = piAiRow();
    const entry = buildProvider({host: s.invite.host, port: s.port, offer: models});
    if (!row) { friend.problem = HOST_SAY.noEditor; friend.manual = {baseURL: entry.baseURL, key: s.localKey, models: entry.models.map(m => m.id)}; return; }
    if (!entry.models.length && !friend.providerSet) return;          // nothing to add yet; the list fills when the host loads a model
    try { await row.ed.edit(row.entry, (cur, inh) => addProvider(cur, inh, s.providerId, entry)); friend.providerSet = true; }
    catch (e) { report('borrow add provider', e); friend.problem = HOST_SAY.noEditor; }
  }
  async function startLink() {
    const s = friend.saved; if (!s) return;
    await setKey(s.localKey);
    try { await friend.link?.close(); } catch {}
    friend.link = createLink({invite: s.invite, localKey: s.localKey, fetchImpl,
      pathProbe: async () => {
        const st = await tailscale.status(); const host = new URL(s.invite.url).hostname;
        const peer = st?.peers?.find(p => p.name === host);
        if (!peer?.ips?.[0]) return null;
        const pg = await tailscale.ping(peer.ips[0]);
        return pg ? {kind: pg.kind, where: pg.where, words: pathWords(pg), ms: pg.ms} : null;
      },
      notify: m => {
        if (m.type === 'state') friend.state = m.state;
        if (m.type === 'models') writeProvider(m.models).catch(e => report('borrow provider', e));
      }});
    const port = await friend.link.listen(s.port || 0);
    if (port !== s.port) { s.port = port; writeJSON(friendFile, s); friend.providerSet = false; }
  }
  async function joinInvite(text) {
    let inv;
    try { inv = decodeInvite(text); } catch (e) { return {error: e.message}; }
    const st = await tailscale.status();
    const step = setupStep(st);
    friend.step = step;
    if (step.step !== 'ready') return {...status(), needs: step};
    // can this PC reach the host's door yet? if not, the share has not been accepted
    let reach = false;
    try { const r = await fetchImpl(inv.url + '/amp/v1/hello', {headers: {authorization: 'Bearer ' + inv.key}, signal: AbortSignal.timeout(6000)}); reach = r.status !== 404; if (r.status === 401 || r.status === 403) { const j = await r.json().catch(() => null); return {error: j?.error?.message || 'This invite is not valid any more.'}; } }
    catch { reach = false; }
    if (!reach) return {...status(), needs: {step: 'accept', say: HOST_SAY.waitAccept, url: inv.share}};
    const prev = defaultRow()?.effective || null;
    const old = friend.saved;
    friend.saved = {invite: inv, localKey: old?.invite?.key === inv.key ? old.localKey : (await import('./protocol.mjs')).newKey(),
      port: old?.port || 0, providerId: providerId(inv.host), previousDefault: old?.previousDefault ?? (prev?.provider ? prev : null), joinedAt: Date.now()};
    writeJSON(friendFile, friend.saved);
    await startLink();
    return {...status(), say: HOST_SAY.joined(inv.host)};
  }
  async function leave() {
    const s = friend.saved;
    try { await friend.link?.release(); } catch {}
    try { await friend.link?.close(); } catch {}
    friend.link = null; friend.state = null;
    if (s) {
      const row = piAiRow();
      if (row) try { await row.ed.edit(row.entry, (cur, inh) => removeProvider(cur, inh, s.providerId)); } catch (e) { report('borrow remove provider', e); }
      const d = defaultRow();
      const next = d && restoreDefault(d.effective, {}, s.providerId, s.previousDefault);
      if (d && next) try { await d.ed.edit(d.entry, () => next); } catch (e) { report('borrow restore default', e); }
      try { await svc('credentials')?.unset?.(KEY_ENV); } catch {}
      delete process.env[KEY_ENV];
    }
    friend.saved = null; friend.providerSet = false;
    try { rmSync(friendFile, {force: true}); } catch {}
    return {...status(), say: HOST_SAY.left};
  }

  // ---- what the card shows ------------------------------------------------------------------------------------------
  function status() {
    return {
      host: {sharing: host.sharing, step: host.step, problem: host.problem, door: host.door ? {port: host.door.port} : null,
        name: settings.hostName, models: host.models, lock: host.lock, lockFriend: host.lockFriend, waitingHere: host.waitingHere,
        live: host.state, settings: {idleMin: settings.idleMin, turnHours: settings.turnHours, dayHours: settings.dayHours, showPing: settings.showPing}},
      friend: friend.saved ? {host: friend.saved.invite.host, providerId: friend.saved.providerId, state: friend.state, step: friend.step,
        problem: friend.problem, manual: friend.manual || null} : {step: friend.step, problem: friend.problem},
    };
  }

  // ---- routes (behind DSH's own login) ------------------------------------------------------------------------------
  const body = async req => { try { return JSON.parse((await req.text()).slice(0, 20_000) || '{}'); } catch { return {}; } };
  const ok = v => Response.json(v, {headers: {'cache-control': 'no-store'}});
  const routes = {
    '/api/amp-borrow/status': async () => ok(status()),
    '/api/amp-borrow/share': async req => { const b = await body(req); return ok(b.on ? await startSharing() : await stopSharing()); },
    '/api/amp-borrow/stop': async () => ok(await stopSharing({force: true})),
    '/api/amp-borrow/release': async () => { await toGate({type: 'release'}); return ok(status()); },
    '/api/amp-borrow/invite': async req => { const b = await body(req); return ok(await invite(b.name, b.share)); },
    '/api/amp-borrow/friends': async () => ok({friends: (await toGate({type: 'friends'}, true))?.friends || []}),
    '/api/amp-borrow/remove': async req => { const b = await body(req); await toGate({type: 'forget', friendId: String(b.friendId || '')}); return ok(status()); },
    '/api/amp-borrow/settings': async req => {
      const b = await body(req);
      const clamp = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
      settings.idleMin = clamp(b.idleMin, 1, 15, settings.idleMin);
      settings.turnHours = clamp(b.turnHours, 0.25, 12, settings.turnHours);
      settings.dayHours = clamp(b.dayHours, 0.25, 24, settings.dayHours);
      if (typeof b.showPing === 'boolean') settings.showPing = b.showPing;
      if (typeof b.hostName === 'string' && b.hostName.trim()) settings.hostName = b.hostName.trim().slice(0, 40);
      save(); return ok(status());
    },
    '/api/amp-borrow/join': async req => { const b = await body(req); return ok(await joinInvite(b.invite)); },
    '/api/amp-borrow/done': async () => ok({released: !!(await friend.link?.release())}),
    '/api/amp-borrow/leave': async () => ok(await leave()),
  };

  // ---- start and stop with DSH --------------------------------------------------------------------------------------
  const undoLock = installLock();
  // DSH was killed while sharing last time: its door may still be listed. Clear that one port, nothing else.
  if (settings.lastDoor && !host.sharing) tailscale.clearDoor?.(settings.lastDoor).catch?.(() => {});
  let resumeT = null;
  if (settings.sharing) {                                          // decision 8: sharing comes back when DSH opens
    resumeT = setTimeout(() => startSharing().then(s => { if (s.host.sharing) host.problem = null; }).catch(e => report('borrow resume', e)), resumeDelayMs);
    resumeT.unref?.();
  }
  if (friend.saved) startLink().catch(e => { friend.problem = String(e?.message || e); report('borrow link', e); });

  return {
    routes, status, startSharing, stopSharing, invite, joinInvite, leave, guard,
    async dispose() {
      clearTimeout(resumeT); undoLock();
      await stopSharing({keepSetting: true}).catch(() => {});
      try { await friend.link?.close(); } catch {}
    },
  };
}
