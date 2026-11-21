// Borrow my AI, host side: the AMP Gate. One small door in front of this PC's AI. Plain Node, no packages.
//
// It listens on 127.0.0.1 only; Tailscale's own door (tailscale serve) is the only way in from outside. It answers six
// addresses and nothing else: GET /amp/v1/hello, GET /amp/v1/events, POST /amp/v1/release, GET /v1/models,
// POST /v1/chat/completions. Every friend has their own key (only its fingerprint is saved) bound to their Tailscale login
// on first use. It holds the turn (the friend's or the host's), the limits, the live usage meter, Force stop, and an audit
// log of numbers only (never what anyone wrote).
//
// Run by the AMP plugin as a child process (fork). It ends when DSH ends, so the door cannot outlive DSH.
// In tests it is used in-process: createGate({...}).
import http from 'node:http';
import {readFileSync, writeFileSync, renameSync, mkdirSync, appendFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PROTOCOL, DEFAULTS, SAY, newKey, fingerprint, sameFingerprint, newId, openaiError, cleanChatRequest, offerOf} from './protocol.mjs';

const json = (res, status, body, extra = {}) => {
  if (res.headersSent || res.destroyed) { try { res.end(); } catch {} return; }
  const text = JSON.stringify(body);
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text), ...extra});
  res.end(text);
};
const today = t => new Date(t).toLocaleDateString('en-CA');            // the host's own date decides "per day"

export function createGate(options = {}) {
  const o = {
    stateDir: null, hostName: 'Your friend', requireIdentity: true, models: [], now: Date.now,
    notify: () => {}, fetchImpl: globalThis.fetch, ...options,
  };
  const L = {...DEFAULTS, ...(options.limits || {})};
  const now = () => o.now();
  const send = msg => { try { o.notify(msg); } catch {} };

  // ---- saved friends (fingerprints only) and the audit log ----------------------------------------------------------
  const friendsFile = o.stateDir && join(o.stateDir, 'friends.json');
  const auditFile = o.stateDir && join(o.stateDir, 'audit.log');
  let friends = [];
  if (friendsFile) {
    try { mkdirSync(o.stateDir, {recursive: true, mode: 0o700}); } catch {}
    try {
      const j = JSON.parse(readFileSync(friendsFile, 'utf8'));
      if (Array.isArray(j)) friends = j.filter(f => f && typeof f.id === 'string' && typeof f.fp === 'string');
    } catch {}
  }
  const saveFriends = () => {
    if (!friendsFile) return;
    try {
      const tmp = `${friendsFile}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      writeFileSync(tmp, JSON.stringify(friends, null, 1), {mode: 0o600});
      renameSync(tmp, friendsFile);
    } catch (e) { send({type: 'problem', where: 'save friends', message: String(e?.message || e)}); }
  };
  const audit = row => {
    if (!auditFile) return;
    try {
      appendFileSync(auditFile, JSON.stringify({t: new Date(now()).toISOString(), ...row}) + '\n', {mode: 0o600});
      if (statSync(auditFile).size > L.auditLines * 260) {
        const lines = readFileSync(auditFile, 'utf8').trim().split('\n').slice(-L.auditLines);
        const tmp = auditFile + '.tmp'; writeFileSync(tmp, lines.join('\n') + '\n', {mode: 0o600}); renameSync(tmp, auditFile);
      }
    } catch {}
  };

  // ---- live state ---------------------------------------------------------------------------------------------------
  let models = [];
  let ai = 'ready';           // the host's AI: ready | asleep | game (the light on both cards)
  let paused = false;
  let hostBusy = 0;
  let turn = null;            // {friendId, since, last, inflight: Map, idleT, dropT, warnT, tokIn, tokOut, replies}
  const subs = new Set();     // {friendId, res}
  const waiting = new Set();  // friend ids waiting for the host to finish
  const hostIdle = new Set(); // resolvers
  const rate = new Map();
  const meter = {window: [], tps: 0};
  // Waking the host's AI: the first message to a model that is not running asks the host to load it (never during a
  // game), then waits for it, keeping the line alive. Every message waiting for the same model waits together.
  const wakes = new Map();   // model id -> {until, denied}
  const refused = e => e?.cause?.code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed/i.test(String(e?.cause?.code || e?.message));
  async function waitAwake(model, signal) {
    let w = wakes.get(model.id);
    if (!w || w.until < now()) { w = {until: now() + L.wakeMs, denied: null}; wakes.set(model.id, w); send({type: 'wake', provider: model.provider, model: model.id}); }
    const headers = model.upstream.apiKey ? {authorization: 'Bearer ' + model.upstream.apiKey} : {};
    while (now() < w.until && !signal.aborted && !w.denied) {
      try { const r = await o.fetchImpl(model.upstream.baseURL.replace(/\/+$/, '') + '/models', {headers, signal: AbortSignal.timeout(2000)}); if (r.ok) { wakes.delete(model.id); return 'up'; } } catch {}
      await new Promise(r => setTimeout(r, L.wakePollMs ?? 2000));
    }
    return w.denied || 'timeout';
  }

  const setModels = list => {
    models = (Array.isArray(list) ? list : []).filter(m => m && typeof m.id === 'string' && m.upstream?.baseURL)
      .map(m => ({...m, upstreamModel: m.upstream.model ?? m.id}));
    broadcast();
  };

  const friendById = id => friends.find(f => f.id === id);
  const dayUsed = f => (f.day?.date === today(now()) ? f.day.ms : 0) + (turn?.friendId === f.id ? now() - turn.since : 0);
  const secondsLeft = f => {
    if (turn?.friendId !== f.id) return null;
    const left = Math.min(turn.since + L.turnMs - now(), L.dayMs - dayUsed(f));
    return Math.max(0, Math.round(left / 1000));
  };
  const viewFor = f => ({
    protocol: PROTOCOL, host: o.hostName, paused, ai,
    turn: paused ? 'off' : turn ? (turn.friendId === f.id ? 'yours' : 'other') : waiting.has(f.id) ? 'waiting' : hostBusy > 0 ? 'host' : 'free',
    secondsLeft: secondsLeft(f), models: offerOf(models),
    limits: {idleMs: L.idleMs, turnMs: L.turnMs, dayMs: L.dayMs, perMinute: L.perMinute},
  });
  const hostView = () => {
    const f = turn && friendById(turn.friendId);
    return {
      sharing: !paused, hostBusy, ai, models: models.map(m => m.id),
      turn: turn ? {friend: f?.name ?? '?', friendId: turn.friendId, since: turn.since, secondsLeft: f ? secondsLeft(f) : null,
        replying: turn.inflight.size > 0, tokIn: turn.tokIn, tokOut: turn.tokOut + (turn.live || 0), replies: turn.replies, tps: meter.tps,
        connected: [...subs].some(s => s.friendId === turn.friendId)} : null,
      waiting: [...waiting].map(id => friendById(id)?.name ?? '?'),
      connected: [...new Set([...subs].map(s => s.friendId))].map(id => friendById(id)?.name ?? '?'),
    };
  };
  function broadcast() {
    for (const s of subs) {
      const f = friendById(s.friendId);
      if (f) sse(s.res, 'state', viewFor(f));
    }
    send({type: 'state', state: hostView()});
  }
  let lastBroadcast = 0;
  const soon = () => { if (now() - lastBroadcast >= 1000) { lastBroadcast = now(); broadcast(); } };
  function sse(res, event, data) {
    if (res.destroyed || res.writableEnded) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
  }

  // ---- the turn ---------------------------------------------------------------------------------------------------------
  function startTurn(f) {
    turn = {friendId: f.id, since: now(), last: now(), inflight: new Map(), idleT: null, dropT: null, warnT: null, tokIn: 0, tokOut: 0, replies: 0};
    waiting.delete(f.id);
    const left = Math.min(L.turnMs, L.dayMs - dayUsed(f));
    if (left > L.warnMs) turn.warnT = setTimeout(() => broadcast(), left - L.warnMs);
    turn.endT = setTimeout(() => endTurn(left >= L.turnMs ? 'turn limit' : 'day limit'), Math.max(0, left));
    audit({friend: f.id, event: 'turn start'});
    send({type: 'lock', on: true, friend: f.name});
    broadcast();
  }
  function endTurn(reason, {abort = true} = {}) {
    if (!turn) return;
    const t = turn; turn = null;
    for (const ac of t.inflight.values()) if (abort) try { ac.abort(reason); } catch {}
    for (const k of ['idleT', 'dropT', 'warnT', 'endT']) clearTimeout(t[k]);
    const f = friendById(t.friendId);
    if (f) {
      const d = today(now());
      f.day = {date: d, ms: (f.day?.date === d ? f.day.ms : 0) + (now() - t.since)};
      saveFriends();
    }
    meter.window = []; meter.tps = 0;
    audit({friend: t.friendId, event: 'turn end', reason, ms: now() - t.since, tokIn: t.tokIn, tokOut: t.tokOut, replies: t.replies});
    send({type: 'lock', on: false, reason});
    broadcast();
    for (const r of [...hostIdle]) r();     // a friend waiting behind nobody can retry
  }
  function touchIdle() {
    if (!turn) return;
    clearTimeout(turn.idleT);
    turn.idleT = setTimeout(() => { if (turn && !turn.inflight.size) endTurn('quiet'); }, L.idleMs);
  }
  function scheduleDrop() {
    if (!turn) return;
    clearTimeout(turn.dropT);
    turn.dropT = setTimeout(() => {
      if (!turn) return;
      const present = [...subs].some(s => s.friendId === turn.friendId);
      if (!present && !turn.inflight.size) endTurn('dropped');
    }, L.dropMs);
  }
  const waitHostIdle = signal => new Promise((resolve, reject) => {
    if (hostBusy <= 0) return resolve();
    let timer;
    const done = err => { clearTimeout(timer); hostIdle.delete(check); signal?.removeEventListener?.('abort', onAbort); err ? reject(err) : resolve(); };
    const check = () => { if (hostBusy <= 0) done(); };
    const onAbort = () => done(new Error('aborted'));
    timer = setTimeout(() => done(new Error('host wait')), L.hostWaitMs);
    hostIdle.add(check);
    signal?.addEventListener?.('abort', onAbort, {once: true});
  });

  // ---- who is asking ----------------------------------------------------------------------------------------------------
  function who(req) {
    const h = String(req.headers.authorization || '');
    const key = /^bearer\s+/i.test(h) ? h.replace(/^bearer\s+/i, '').trim() : '';
    if (!key) return {error: [401, SAY.badKey, 'bad_key']};
    const fp = fingerprint(key);
    const f = friends.find(x => sameFingerprint(x.fp, fp));
    if (!f || f.revoked) return {error: [401, SAY.badKey, 'bad_key']};
    if (!f.login && f.inviteExp && f.inviteExp < now()) return {error: [401, SAY.expired, 'expired']};
    if (f.expires && f.expires < now()) return {error: [401, SAY.expired, 'expired']};
    const login = String(req.headers['tailscale-user-login'] || '').trim().toLowerCase();
    if (o.requireIdentity) {
      if (!login) return {error: [403, SAY.noIdentity, 'no_identity']};
      if (!f.login) {
        f.login = login; f.firstUsed = now();
        if (f.autoName) { const n = login.split('@')[0].replace(/[._-]+/g, ' ').trim(); f.name = (n.charAt(0).toUpperCase() + n.slice(1)).slice(0, 40) || f.name; f.autoName = false; }
        saveFriends(); audit({friend: f.id, event: 'invite used'});
      }
      else if (f.login !== login) return {error: [403, SAY.otherPerson, 'other_person']};
    }
    return {friend: f};
  }
  function overRate(f) {
    const t = now(), list = (rate.get(f.id) || []).filter(x => t - x < 60_000);
    list.push(t); rate.set(f.id, list);
    return list.length > L.perMinute;
  }
  const readBody = req => new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > L.maxBodyBytes) { req.removeAllListeners('data'); req.pause(); reject(Object.assign(new Error('too big'), {tooBig: true})); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  // ---- the chat itself --------------------------------------------------------------------------------------------------
  function replier(res, stream) {
    let started = false, done = false;
    const head = () => {
      if (started || res.destroyed) return; started = true;
      res.writeHead(200, {'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no'});
    };
    // Big prompts can take minutes before the first word; a quiet line keeps every proxy on the way from timing out.
    const timer = stream ? setInterval(() => { if (!done) { head(); try { res.write(': thinking\n\n'); } catch {} } }, L.keepaliveMs) : null;
    return {
      get started() { return started; },
      fail(status, message, code) {
        if (done) return; done = true; clearInterval(timer);
        if (started) { try { res.write(`data: ${JSON.stringify(openaiError(message, code))}\n\n`); res.end(); } catch {} }
        else json(res, status, openaiError(message, code), status === 429 || status === 503 ? {'retry-after': '20'} : {});
      },
      stream() { clearInterval(timer); head(); },
      end() { done = true; clearInterval(timer); try { if (!res.writableEnded) res.end(); } catch {} },
    };
  }
  function countUsage(text, acc) {
    acc.buf += text;
    let i;
    while ((i = acc.buf.indexOf('\n')) >= 0) {
      const line = acc.buf.slice(0, i).trim(); acc.buf = acc.buf.slice(i + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data);
        if (j.usage) { acc.in = j.usage.prompt_tokens ?? acc.in; acc.out = j.usage.completion_tokens ?? acc.out; }
        const d = j.choices?.[0]?.delta;
        if (d && (d.content || d.reasoning_content || d.reasoning || d.tool_calls)) { acc.deltas++; meter.window.push(now()); }
      } catch {}
    }
    const t = now(); meter.window = meter.window.filter(x => t - x < 3000); meter.tps = Math.round(meter.window.length / 3);
  }
  const upstreamProblem = (status, text) => {
    if (/context|too (long|large)|exceed/i.test(text)) return [413, SAY.tooBig, 'too_big'];
    if (status === 503 || status === 502) return [503, SAY.notLoaded, 'not_loaded'];
    return [502, SAY.upstream, 'upstream'];
  };

  async function chat(req, res, f) {
    if (turn && turn.friendId !== f.id) return json(res, 503, openaiError(SAY.busyOther, 'busy'), {'retry-after': '30'});
    if (overRate(f)) return json(res, 429, openaiError(SAY.slowDown, 'rate'), {'retry-after': '20'});
    let raw;
    try { raw = await readBody(req); }
    catch (e) {
      if (!e.tooBig) return;
      // answer first, then drop the connection so the rest of an oversized body is never read
      res.on('finish', () => setTimeout(() => req.destroy(), 50));
      return json(res, 413, openaiError(SAY.tooBig, 'too_big'), {connection: 'close'});
    }
    let body;
    try { body = JSON.parse(raw.toString('utf8')); } catch { return json(res, 400, openaiError(SAY.badRequest, 'bad_request')); }
    const model = models.find(m => m.id === body?.model);
    if (!model) return json(res, models.length ? 404 : 503, openaiError(models.length ? SAY.unknownModel : SAY.notLoaded, models.length ? 'unknown_model' : 'not_loaded'));
    let clean;
    try { clean = cleanChatRequest(body, model); } catch { return json(res, 400, openaiError(SAY.badRequest, 'bad_request')); }
    if (turn?.friendId === f.id && turn.inflight.size) return json(res, 429, openaiError(SAY.oneAtATime, 'one_at_a_time'), {'retry-after': '5'});
    if (L.dayMs - dayUsed(f) <= 0) return json(res, 403, openaiError(SAY.dayOver, 'day_limit'));

    const ac = new AbortController();
    const reply = replier(res, clean.stream);
    let finished = false;
    res.on('close', () => { if (!finished) { ac.abort('friend left'); if (turn?.friendId === f.id) scheduleDrop(); } });

    if (!turn) {
      waiting.add(f.id); broadcast();
      try { await waitHostIdle(ac.signal); }
      catch (e) { waiting.delete(f.id); broadcast(); if (!ac.signal.aborted) reply.fail(503, SAY.hostWaitTooLong, 'host_busy'); finished = true; return; }
      waiting.delete(f.id);
      if (paused) { finished = true; return reply.fail(503, SAY.paused, 'stopped'); }
      if (turn && turn.friendId !== f.id) { finished = true; return reply.fail(503, SAY.busyOther, 'busy'); }
      if (!turn) startTurn(f);
    }
    const id = newId();
    turn.inflight.set(id, ac); clearTimeout(turn.idleT); clearTimeout(turn.dropT); turn.last = now();
    broadcast();
    const started = now(), acc = {buf: '', in: 0, out: 0, deltas: 0};
    let status = 'ok';
    try {
      const headers = {'content-type': 'application/json'};
      if (model.upstream.apiKey) headers.authorization = 'Bearer ' + model.upstream.apiKey;
      const call = () => o.fetchImpl(model.upstream.baseURL.replace(/\/+$/, '') + '/chat/completions',
        {method: 'POST', headers, body: JSON.stringify(clean), signal: ac.signal});
      let up;
      for (let tries = 0; ; tries++) {
        let asleep = false;
        try { up = await call(); asleep = up.status === 503 && /load/i.test(await up.clone().text().catch(() => '')); }
        catch (e) { if (ac.signal.aborted || !refused(e)) throw e; asleep = true; }
        if (!asleep || tries >= 1) break;
        const woke = await waitAwake(model, ac.signal);
        if (woke === 'game') { status = 'host gaming'; reply.fail(503, SAY.gaming, 'gaming'); up = null; break; }
        if (woke !== 'up') { if (ac.signal.aborted) throw new Error('aborted'); status = 'not loaded'; reply.fail(503, SAY.notLoaded, 'not_loaded'); up = null; break; }
      }
      if (!up) { /* already answered */ }
      else if (!up.ok) {
        const text = (await up.text().catch(() => '')).slice(0, 2000);
        status = 'upstream ' + up.status;
        reply.fail(...upstreamProblem(up.status, text));
      } else if (clean.stream) {
        reply.stream();
        const dec = new TextDecoder();
        for await (const chunk of up.body) {
          if (res.destroyed) break;
          res.write(chunk);
          countUsage(dec.decode(chunk, {stream: true}), acc);
          if (turn?.friendId === f.id) { turn.live = acc.deltas; soon(); }
        }
        reply.end();
      } else {
        const text = await up.text();
        try { const j = JSON.parse(text); acc.in = j.usage?.prompt_tokens ?? 0; acc.out = j.usage?.completion_tokens ?? 0; } catch {}
        finished = true;
        if (!res.headersSent && !res.destroyed) {
          res.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text)});
          res.end(text);
        }
      }
    } catch (e) {
      if (ac.signal.aborted) {
        const why = String(ac.signal.reason || 'abort');
        status = 'stopped: ' + why;
        const [msg, code] = paused || why === 'force stop' ? [SAY.paused, 'stopped'] : why === 'day limit' ? [SAY.dayOver, 'day_limit']
          : why === 'revoked' || why === 'removed' ? [SAY.badKey, 'bad_key'] : [SAY.turnOver, 'turn_over'];
        reply.fail(503, msg, code);
      } else if (e?.cause?.code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed/i.test(String(e?.cause?.code || e?.message))) {
        status = 'not loaded'; reply.fail(503, SAY.notLoaded, 'not_loaded');
      } else { status = 'error'; reply.fail(502, SAY.upstream, 'upstream'); }
    } finally {
      finished = true;
      if (turn?.friendId === f.id) {
        turn.inflight.delete(id);
        turn.tokIn += acc.in; turn.tokOut += acc.out || acc.deltas; turn.live = 0; turn.replies++; turn.last = now();
        touchIdle();
        if (res.destroyed && !ac.signal.aborted) scheduleDrop();
      }
      audit({friend: f.id, event: 'reply', model: model.id, ms: now() - started, tokIn: acc.in, tokOut: acc.out, status});
      broadcast();
    }
  }

  function events(req, res, f) {
    res.writeHead(200, {'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no'});
    const s = {friendId: f.id, res};
    subs.add(s);
    if (turn?.friendId === f.id) clearTimeout(turn.dropT);
    sse(res, 'state', viewFor(f));
    send({type: 'state', state: hostView()});
    const hb = setInterval(() => { try { res.write(`: ${now()}\n\n`); } catch {} }, L.heartbeatMs);
    res.on('close', () => {
      clearInterval(hb); subs.delete(s);
      if (turn?.friendId === f.id && ![...subs].some(x => x.friendId === f.id)) scheduleDrop();
      send({type: 'state', state: hostView()});
    });
  }

  // ---- the door ---------------------------------------------------------------------------------------------------------
  const ROUTES = {
    'GET /amp/v1/hello': (req, res, f) => json(res, 200, viewFor(f)),
    'GET /amp/v1/events': events,
    'POST /amp/v1/release': (req, res, f) => {
      if (turn?.friendId === f.id) endTurn('friend is done');
      req.resume(); json(res, 200, {ok: true});
    },
    'GET /v1/models': (req, res) => json(res, 200, {object: 'list', data: models.map(m => ({id: m.id, object: 'model', owned_by: 'amp-borrow', name: m.name ?? m.id}))}),
    'POST /v1/chat/completions': chat,
  };
  async function handle(req, res) {
    let path;
    try { path = new URL(req.url, 'http://gate').pathname.replace(/\/+$/, '') || '/'; } catch { return json(res, 400, openaiError(SAY.notHere, 'not_here')); }
    const route = ROUTES[`${req.method} ${path}`];
    if (!route) { req.resume(); return json(res, 404, openaiError(SAY.notHere, 'not_here')); }
    const w = who(req);
    if (w.error) { req.resume(); return json(res, w.error[0], openaiError(w.error[1], w.error[2])); }
    if (paused && path !== '/amp/v1/hello' && path !== '/amp/v1/events') { req.resume(); return json(res, 503, openaiError(SAY.paused, 'stopped')); }
    w.friend.lastSeen = now();
    await route(req, res, w.friend);
  }
  const server = http.createServer((req, res) => {
    handle(req, res).catch(e => { send({type: 'problem', where: 'gate request', message: String(e?.message || e)}); json(res, 500, openaiError(SAY.upstream, 'gate')); });
  });
  setModels(o.models);
  server.requestTimeout = 0; server.headersTimeout = 30_000; server.keepAliveTimeout = 65_000;

  return {
    server,
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(server.address().port); });
      });
    },
    async close() {
      endTurn('closing');
      for (const s of subs) try { s.res.end(); } catch {}
      server.closeAllConnections?.();
      await new Promise(r => server.close(() => r()));
    },
    addFriend({name, expiresMs = null} = {}) {
      const key = newKey();
      const f = {id: newId(), name: String(name || 'Friend').slice(0, 40), autoName: !name, fp: fingerprint(key), login: null, created: now(),
        inviteExp: now() + L.inviteMs, expires: expiresMs ? now() + expiresMs : null, revoked: false, day: null};
      friends.push(f); saveFriends(); audit({friend: f.id, event: 'invite made'});
      broadcast();
      return {id: f.id, key, inviteExp: f.inviteExp};
    },
    revokeFriend(id) {
      const f = friendById(id); if (!f) return false;
      if (turn?.friendId === id) endTurn('revoked');
      f.revoked = true; saveFriends(); audit({friend: id, event: 'revoked'});
      for (const s of [...subs]) if (s.friendId === id) { sse(s.res, 'stopped', {message: SAY.badKey}); try { s.res.end(); } catch {} }
      broadcast(); return true;
    },
    forgetFriend(id) {
      const before = friends.length;
      if (turn?.friendId === id) endTurn('removed');
      friends = friends.filter(f => f.id !== id); saveFriends();
      for (const s of [...subs]) if (s.friendId === id) try { s.res.end(); } catch {}
      broadcast(); return friends.length < before;
    },
    friends: () => friends.map(({fp, ...f}) => ({...f, login: f.login ? f.login.replace(/^(.).*(@.*)$/, '$1…$2') : null})),
    setModels,
    wakeDenied(modelId, reason) { const w = wakes.get(modelId); if (w) w.denied = reason; else wakes.set(modelId, {until: now() + 60_000, denied: reason}); },
    setAi(state) { if (['ready', 'asleep', 'game'].includes(state) && state !== ai) { ai = state; broadcast(); } },
    setHostBusy(n) {
      hostBusy = Math.max(0, Number(n) || 0);
      if (hostBusy <= 0) for (const r of [...hostIdle]) r();
      broadcast();
    },
    forceStop() {
      paused = true;
      endTurn('force stop');
      for (const s of [...subs]) { sse(s.res, 'stopped', {message: SAY.paused}); try { s.res.end(); } catch {} }
      audit({event: 'force stop'});
      broadcast();
    },
    resume() { paused = false; broadcast(); },
    release() { if (turn) endTurn('host freed it'); },
    status: hostView,
    _turn: () => turn,
  };
}

// ---- run as the plugin's child process --------------------------------------------------------------------------------
if (process.send && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let gate = null;
  const reply = m => { try { process.send(m); } catch {} };
  process.on('message', async m => {
    try {
      if (m?.type === 'start' && !gate) {
        gate = createGate({stateDir: m.stateDir, hostName: m.hostName, limits: m.limits, models: m.models,
          requireIdentity: m.requireIdentity !== false, notify: reply});
        const port = await gate.listen(m.port || 0);
        reply({type: 'ready', port});
      } else if (gate) {
        if (m.type === 'models') gate.setModels(m.models);
        else if (m.type === 'hostBusy') gate.setHostBusy(m.n);
        else if (m.type === 'wakeDenied') gate.wakeDenied(m.model, m.reason);
        else if (m.type === 'ai') gate.setAi(m.state);
        else if (m.type === 'stop') { gate.forceStop(); reply({type: 'stopped', id: m.id}); }
        else if (m.type === 'resume') gate.resume();
        else if (m.type === 'release') gate.release();
        else if (m.type === 'addFriend') { const f = gate.addFriend(m); reply({type: 'friendAdded', id: m.id, friendId: f.id, key: f.key, inviteExp: f.inviteExp}); }
        else if (m.type === 'revoke') gate.revokeFriend(m.friendId);
        else if (m.type === 'forget') gate.forgetFriend(m.friendId);
        else if (m.type === 'friends') reply({type: 'friends', id: m.id, friends: gate.friends()});
        else if (m.type === 'status') reply({type: 'status', id: m.id, state: gate.status()});
      }
    } catch (e) { reply({type: 'problem', where: 'gate ' + m?.type, message: String(e?.message || e)}); }
  });
  // DSH ended or the plugin let go: the gate ends too, and Tailscale's door (owned by the plugin) goes with it.
  process.on('disconnect', () => { Promise.resolve(gate?.close()).finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });
  process.on('uncaughtException', e => { reply({type: 'problem', where: 'gate crash', message: String(e?.message || e)}); });
}
