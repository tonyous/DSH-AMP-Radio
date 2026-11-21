// Borrow my AI inside DSH's server: the one controller the AMP plugin's index.js starts.
//
// Host:   Share my AI on -> check Tailscale -> read which local models are loaded -> start the gate (child process)
//         -> open Tailscale's door for one port -> make invites. While a friend has the turn, this DSH's own requests to
//         those local models wait (the lock). Force stop: the friend is told, the gate ends, the door closes, checked.
// Friend: paste an invite -> check Tailscale -> wait for Accept -> start AMP Link -> add "Borrowed · <name>" to DSH's
//         models. Leave: remove it and put their old default model back.
// Every DSH service is optional (ctx.get at the use site): a DSH without one shows a plain message for that part,
// and nothing here can stop the radio, the bar or DSH itself.
import {fork, spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULTS, encodeInvite, decodeInvite, isShareLink} from './protocol.mjs';
import {offerFromConfig, buildProvider, providerId, addProvider, removeProvider, restoreDefault, KEY_ENV, isLocalURL} from './provider.mjs';
import {createTailscale, setupStep, freeDoorPort, pathWords} from './tailscale.mjs';
import {createLink} from './link.mjs';

const GATE = fileURLToPath(new URL('./gate.mjs', import.meta.url));
export const HOST_SAY = Object.freeze({
  noConfig: "This DSH can't share its models yet. Update DSH, then try again.",
  noLocal: 'Sharing is on. Your friend can use it once you load an AI.',
  gateDied: 'Turn sharing off and on again.',
  stopped: 'Stopped. Nobody is connected.',
  doorStillOpen: "Stopped, but Tailscale still shows AMP's door. Turn Tailscale off and on, or restart DSH.",
  notSharing: 'Turn Share my AI on first.',
  shareLink: 'That is not a Tailscale share link. In Tailscale, press Share on this PC, then Copy link.',
  waitAccept: 'Press Accept in the Tailscale page that just opened.',
  joined: name => `Connected to ${name}'s AI.`,
  left: 'Removed. Your own models are back.',
  noEditor: 'This DSH cannot add models by itself. Open Settings, Models, Custom model API, and enter the four values below.',
});

const readJSON = f => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } };
const writeJSON = (f, v) => {
  const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  writeFileSync(tmp, JSON.stringify(v, null, 1), {mode: 0o600}); renameSync(tmp, f);
};

// Opens a page in the person's own browser, from DSH's server on their own PC (so nobody has to click a link).
export function openInBrowser(url) {
  try {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd, args, {detached: true, stdio: 'ignore', windowsHide: true}).on('error', () => {}).unref();
    return true;
  } catch { return false; }
}
// The one admin step on Linux, as the desktop's own password window (polkit). Nothing to copy or type in a terminal.
export function askAdmin(tsPath, user) {
  return new Promise(resolve => {
    if (process.platform !== 'linux' || !existsSync('/usr/bin/pkexec') || !tsPath || !user) return resolve(false);
    const p = spawn('/usr/bin/pkexec', [tsPath.startsWith('/') ? tsPath : '/usr/bin/tailscale', 'set', `--operator=${user}`], {stdio: 'ignore'});
    p.on('error', () => resolve(false)); p.on('exit', code => resolve(code === 0));
  });
}

// Is a game running on this PC? The owner's game guard writes a state file; on any Linux PC a Steam game runs from
// steamapps/common. A friend's message never wakes the AI while a game runs.
export function gameRunning() {
  try { if (JSON.parse(readFileSync(join(process.env.HOME || '', '.local/state/game-guard.json'), 'utf8')).paused === true) return true; } catch {}
  if (process.platform !== 'linux') return false;
  try {
    for (const pid of readdirSync('/proc')) {
      if (!/^\d+$/.test(pid)) continue;
      try { if (readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes('steamapps/common')) return true; } catch {}
    }
  } catch {}
  return false;
}

export function createBorrow({ctx, home, tailscale = createTailscale(), forkImpl = fork, fetchImpl = globalThis.fetch,
  report = () => {}, refreshMs = 10_000, resumeDelayMs = 10_000, openURL = openInBrowser, admin = askAdmin, retryMs = 5000,
  isGaming = gameRunning} = {}) {
  const shown = new Set();
  const openOnce = url => { if (url && !shown.has(url)) { shown.add(url); try { openURL(url); } catch {} } };
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
    const loaded = up.filter(Boolean);
    // Nothing running: still offer the model this PC normally uses, so a friend's message can wake it.
    const def = defaultRow()?.effective;
    const sleepy = loaded.length ? [] : [all.find(m => m.provider === def?.provider && m.id === def?.model) || all[0]].filter(Boolean);
    return {models: loaded.length ? loaded : sleepy, asleep: !loaded.length && sleepy.length > 0, providers: new Set(all.map(m => m.provider))};
  }

  // A friend's message reached a model that is not running: load it the way DSH loads any model (its own model switcher,
  // with all of this PC's rules), with one tiny request. Never during a game.
  let rawStream = null;
  async function wake({provider, model}) {
    if (isGaming()) return toGate({type: 'wakeDenied', model, reason: 'game'});
    const llm = svc('llm');
    const stream = rawStream || llm?.stream?.bind(llm);
    if (!stream) return toGate({type: 'wakeDenied', model, reason: 'no-llm'});
    const ac = new AbortController(); const t = setTimeout(() => ac.abort('wake timeout'), 6 * 60_000);
    try { for await (const _ of stream({provider, model, messages: [{role: 'user', content: [{type: 'text', text: '.'}]}], maxTokens: 1, signal: ac.signal})) break; }
    catch (e) { if (!ac.signal.aborted) report('borrow wake', e); }
    finally { clearTimeout(t); ac.abort(); }
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
    host.models = r.asleep ? [] : r.models.map(m => m.id);
    host.ai = !r.asleep && r.models.length ? 'ready' : isGaming() ? 'game' : 'asleep';
    await toGate({type: 'ai', state: host.ai});
    if (r.error) host.problem = r.error;
    else if (!r.models.length) host.problem = HOST_SAY.noLocal;
    else if (host.problem === HOST_SAY.noLocal || host.problem === HOST_SAY.noConfig) host.problem = null;
    await toGate({type: 'models', models: r.models});
  }

  // The switch is a wish: once it is on, sharing keeps trying by itself until it works and opens the one page a person
  // needs, once. Nobody presses "check again".
  let hostRetryT = null;
  const retryShare = () => { clearTimeout(hostRetryT); if (settings.sharing && !host.sharing) { hostRetryT = setTimeout(() => startSharing().catch(e => report('borrow retry', e)), retryMs); hostRetryT.unref?.(); } };
  let starting = null;
  function startSharing() { return (starting ??= startSharingOnce().finally(() => { starting = null; })); }
  // Every few seconds while sharing: the models, and is the door still there? Tailscale restarting, a network change or a
  // crash closes it; then sharing starts again by itself on the same port, so the friend's link reconnects on its own.
  async function watch() {
    if (!host.sharing) return;
    if (tailscale.doorOpen && !tailscale.doorOpen()) { report('borrow door', 'door gone, reopening'); await stopSharing({keepSetting: true}); return startSharing(); }
    return refresh();
  }
  async function startSharingOnce() {
    if (host.sharing) return status();
    if (!settings.sharing) { settings.sharing = true; save(); }
    host.problem = null;
    const st = await tailscale.status();
    const step = setupStep(st);
    host.step = step; host.tsName = st?.name || null; host.tsIP = st?.ips?.[0] || null;
    if (step.step !== 'ready') {
      if (step.step === 'missing') openOnce('https://tailscale.com/download');
      if (step.step === 'login' || step.step === 'expired') openOnce(step.url || 'https://login.tailscale.com/');
      retryShare(); return status();
    }
    const r = await loadedModels();
    if (r.error) { host.problem = r.error; return status(); }
    host.localProviders = r.providers; host.models = r.asleep ? [] : r.models.map(m => m.id);
    host.ai = !r.asleep && r.models.length ? 'ready' : isGaming() ? 'game' : 'asleep';
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
      if (m?.type === 'wake') wake(m).catch(e => report('borrow wake', e));
    });
    child.on('exit', () => {
      if (host.gate !== child) return;                 // an older helper ending late: not the one in use
      const wasOn = host.sharing;
      host.gate = null; setLock(false);
      // the helper stopped without being asked: close up and start again by itself (the switch is still on)
      if (wasOn) stopSharing({keepSetting: true}).then(() => retryShare()).catch(() => {});
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
    toGate({type: 'ai', state: host.ai});
    // the door
    const taken = await tailscale.doorPorts();
    // the same door every time, so invites already sent keep working
    const port = settings.lastDoor && !taken.includes(settings.lastDoor) ? settings.lastDoor : freeDoorPort(taken);
    let opened = await tailscale.openDoor({port, target: `http://127.0.0.1:${ready}`});
    if (!opened.ok && opened.problem === 'operator' && !host.askedAdmin) {
      host.askedAdmin = true;
      host.step = {step: 'admin', say: 'Type your password in the window that just opened.'};
      if (await admin(await tailscale.find?.(), process.env.USER || process.env.USERNAME || '')) opened = await tailscale.openDoor({port, target: `http://127.0.0.1:${ready}`});
    }
    if (!opened.ok && opened.problem === 'https' && opened.url) openOnce(opened.url);
    if (!opened.ok) {
      try { child.kill(); } catch {} host.gate = null;
      host.step = {step: opened.problem, say: opened.say, url: opened.url || null, command: opened.problem === 'operator' ? tailscale.operatorCommand() : null};
      if (opened.problem !== 'operator') retryShare();
      return status();
    }
    if (!settings.sharing) {                          // switched off while it was starting: off wins
      try { child.kill(); } catch {} host.gate = null; await tailscale.closeDoor(); host.step = null; return status();
    }
    host.door = {port: opened.port, url: opened.url || `https://${st.name}:${opened.port}`};
    host.sharing = true; settings.sharing = true; settings.lastDoor = opened.port; save();
    if (!r.models.length) host.problem = HOST_SAY.noLocal;
    clearInterval(refreshT); refreshT = setInterval(() => watch().catch(e => report('borrow refresh', e)), refreshMs); refreshT.unref?.();
    return status();
  }

  async function stopSharing({keepSetting = false, force = false} = {}) {
    clearInterval(refreshT); refreshT = null; clearTimeout(hostRetryT);
    if (!keepSetting) { settings.sharing = false; save(); }
    host.step = null; host.askedAdmin = false; host.problem = null;
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
    const added = await toGate({type: 'addFriend', name: name ? String(name).slice(0, 40) : ''}, true);
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
    rawStream = options => stream.call(llm, options);      // waking a model must not wait behind the friend's own turn
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
    catch (e) { report('borrow add provider', e); friend.problem = HOST_SAY.noEditor; return; }
    // New chats use the friend's AI straight away (nothing to pick); "Stop using" puts their own choice back.
    if (!s.defaultSet && entry.models.length) {
      const d = defaultRow();
      if (d) try { await d.ed.edit(d.entry, cur => ({...(cur || {}), provider: s.providerId, model: entry.models[0].id})); s.defaultSet = true; writeJSON(friendFile, s); }
      catch (e) { report('borrow set default', e); }
    }
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
  // Joining keeps going by itself: Tailscale installed? signed in? share accepted? Each page opens once, the card shows
  // one line, and it connects the moment everything is in place. Up to 30 minutes, then it asks to paste again.
  let joinT = null, joinUntil = 0;
  async function joinInvite(text) {
    let inv;
    try { inv = decodeInvite(text); } catch (e) { friend.step = null; return {...status(), error: e.message}; }
    friend.pending = inv; joinUntil = Date.now() + 30 * 60_000; friend.problem = null;
    return attemptJoin();
  }
  async function attemptJoin() {
    clearTimeout(joinT);
    const inv = friend.pending; if (!inv) return status();
    const again = () => {
      if (Date.now() < joinUntil) { joinT = setTimeout(() => attemptJoin().catch(e => report('borrow join', e)), retryMs); joinT.unref?.(); }
      else { friend.pending = null; friend.step = {step: 'timeout', say: 'That took too long. Paste the invite again.'}; }
      return status();
    };
    const st = await tailscale.status();
    const step = setupStep(st);
    friend.step = step;
    if (step.step !== 'ready') {
      if (step.step === 'missing') openOnce('https://tailscale.com/download');
      if (step.step === 'login' || step.step === 'expired') openOnce(step.url || 'https://login.tailscale.com/');
      return again();
    }
    // can this PC reach the host's door yet? if not, the share has not been accepted
    let reach = false;
    try { const r = await fetchImpl(inv.url + '/amp/v1/hello', {headers: {authorization: 'Bearer ' + inv.key}, signal: AbortSignal.timeout(6000)}); reach = r.status !== 404; if (r.status === 401 || r.status === 403) { const j = await r.json().catch(() => null); friend.pending = null; friend.step = {step: 'bad', say: j?.error?.message || 'This invite is not valid any more. Ask your friend for a new one.'}; return {...status(), error: friend.step.say}; } }
    catch { reach = false; }
    if (!reach) { friend.step = {step: 'accept', say: HOST_SAY.waitAccept, url: inv.share}; openOnce(inv.share); return again(); }
    friend.pending = null; friend.step = null;
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
    friend.saved = null; friend.providerSet = false; friend.pending = null; friend.step = null; clearTimeout(joinT);
    try { rmSync(friendFile, {force: true}); } catch {}
    return {...status(), say: HOST_SAY.left};
  }

  // ---- what the card shows ------------------------------------------------------------------------------------------
  function status() {
    return {
      host: {sharing: host.sharing, wish: !!settings.sharing, ai: host.ai || null, tsIP: host.tsIP || null, step: host.step, problem: host.problem, door: host.door ? {port: host.door.port} : null,
        name: settings.hostName, models: host.models, lock: host.lock, lockFriend: host.lockFriend, waitingHere: host.waitingHere,
        live: host.state, settings: {idleMin: settings.idleMin, turnHours: settings.turnHours, dayHours: settings.dayHours, showPing: settings.showPing}},
      friend: friend.saved ? {host: friend.saved.invite.host, providerId: friend.saved.providerId, state: friend.state, step: friend.step,
        problem: friend.problem, manual: friend.manual || null} : {step: friend.step, problem: friend.problem, pending: !!friend.pending},
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
      clearTimeout(resumeT); clearTimeout(hostRetryT); clearTimeout(joinT); undoLock();
      await stopSharing({keepSetting: true}).catch(() => {});
      try { await friend.link?.close(); } catch {}
    },
  };
}
