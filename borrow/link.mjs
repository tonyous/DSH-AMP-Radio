// Borrow my AI, friend side: AMP Link. A small relay on the friend's own PC.
//
// The friend's DSH talks to it as an ordinary model provider ("Borrowed · <name>") at http://127.0.0.1:<port>/v1 with a
// local key only their DSH holds. The link adds the friend's own key and passes the two AI addresses to the host's door
// over Tailscale. It also keeps a live line to the host (whose turn it is, Force stop), measures the ping, reconnects by
// itself and turns every problem into one plain sentence. The friend's DSH settings never hold the host's address or key.
import http from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {newKey, openaiError} from './protocol.mjs';

const json = (res, status, body) => {
  if (res.headersSent || res.destroyed) { try { res.end(); } catch {} return; }
  const text = JSON.stringify(body);
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(text)});
  res.end(text);
};
export const LINK_SAY = Object.freeze({
  unreachable: "Can't reach your friend's PC. It may be asleep, off, or not sharing right now.",
  localKey: 'This address is only for DeepSeek Harness on this PC.',
  browser: 'This address is only for DeepSeek Harness on this PC.',
  notHere: 'Not here.',
});

export function createLink(options = {}) {
  const o = {invite: null, localKey: null, fetchImpl: globalThis.fetch, now: Date.now, notify: () => {},
    pathProbe: null, pingEveryMs: 15_000, backoff: [1000, 2000, 5000, 10_000, 30_000], ...options};
  const inv = o.invite;
  if (!inv?.url || !inv?.key) throw new Error('no invite');
  const localKey = o.localKey || newKey();
  const door = inv.url.replace(/\/+$/, '');
  const auth = {authorization: 'Bearer ' + inv.key};
  const state = {connected: false, reachable: null, host: inv.host, turn: null, secondsLeft: null, paused: false,
    models: [], pingMs: null, path: null, problem: null, since: null};
  const send = m => { try { o.notify(m); } catch {} };
  let modelsKey = '';
  const update = patch => {
    Object.assign(state, patch);
    const k = JSON.stringify(state.models.map(m => [m.id, m.contextWindow, m.maxTokens]));
    if (k !== modelsKey) { modelsKey = k; send({type: 'models', models: state.models}); }
    send({type: 'state', state: {...state}});
  };

  // ---- the live line to the host ------------------------------------------------------------------------------------
  let closed = false, evAbort = null, tries = 0, retryT = null;
  async function listen() {
    if (closed) return;
    evAbort = new AbortController();
    try {
      const r = await o.fetchImpl(door + '/amp/v1/events', {headers: auth, signal: evAbort.signal});
      if (r.status === 401 || r.status === 403) {
        const j = await r.json().catch(() => null);
        update({connected: false, reachable: true, problem: j?.error?.message || LINK_SAY.unreachable});
        return schedule(30_000);
      }
      if (!r.ok || !r.body) throw new Error('events ' + r.status);
      tries = 0; update({connected: true, reachable: true, problem: null, since: o.now()});
      const dec = new TextDecoder(); let buf = '';
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, {stream: true});
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i); buf = buf.slice(i + 2);
          const ev = (block.match(/^event: (.*)$/m) || [])[1];
          const data = (block.match(/^data: (.*)$/m) || [])[1];
          if (!ev || !data) continue;
          let d; try { d = JSON.parse(data); } catch { continue; }
          if (ev === 'state') update({turn: d.turn, secondsLeft: d.secondsLeft, paused: !!d.paused, models: Array.isArray(d.models) ? d.models : [], host: d.host || state.host});
          if (ev === 'stopped') update({paused: true, turn: 'off', problem: d.message || null});
        }
      }
      throw new Error('line ended');
    } catch {
      if (closed) return;
      update({connected: false, reachable: state.reachable === true ? null : false, problem: state.paused ? state.problem : LINK_SAY.unreachable});
      schedule(o.backoff[Math.min(tries++, o.backoff.length - 1)]);
    }
  }
  const schedule = ms => { clearTimeout(retryT); if (!closed) retryT = setTimeout(listen, ms); };

  // ---- the ping ---------------------------------------------------------------------------------------------------------
  let pingT = null;
  async function ping() {
    const t0 = performance.now();
    try {
      const r = await o.fetchImpl(door + '/amp/v1/hello', {headers: auth, signal: AbortSignal.timeout(10_000)});
      await r.arrayBuffer();
      const pingMs = Math.round(performance.now() - t0);
      let path = state.path;
      if (o.pathProbe) { try { path = await o.pathProbe(); } catch {} }
      update({pingMs, path, reachable: true});
    } catch { update({pingMs: null}); }
  }

  // ---- the relay for the friend's DSH -------------------------------------------------------------------------------
  const okLocal = req => {
    const h = String(req.headers.authorization || '');
    const got = Buffer.from(h.replace(/^bearer\s+/i, '').trim()), want = Buffer.from(localKey);
    return got.length === want.length && timingSafeEqual(got, want);
  };
  const ROUTES = new Set(['GET /v1/models', 'POST /v1/chat/completions']);
  async function relay(req, res) {
    // A web page open in the friend's browser can send requests to 127.0.0.1 too. Browsers always add Origin or
    // Sec-Fetch-Site to those; Node's fetch (which DSH uses for models) adds neither, only Sec-Fetch-Mode, so that is allowed.
    if (req.headers.origin || req.headers['sec-fetch-site']) { req.resume(); return json(res, 403, openaiError(LINK_SAY.browser, 'browser')); }
    let path; try { path = new URL(req.url, 'http://link').pathname.replace(/\/+$/, ''); } catch { path = ''; }
    if (!ROUTES.has(`${req.method} ${path}`)) { req.resume(); return json(res, 404, openaiError(LINK_SAY.notHere, 'not_here')); }
    if (!okLocal(req)) { req.resume(); return json(res, 401, openaiError(LINK_SAY.localKey, 'local_key')); }
    const ac = new AbortController();
    let done = false;
    res.on('close', () => { if (!done) ac.abort('dsh left'); });
    try {
      const up = await o.fetchImpl(door + path, {
        method: req.method, signal: ac.signal, duplex: 'half',
        headers: {...auth, 'content-type': req.headers['content-type'] || 'application/json', accept: req.headers.accept || '*/*'},
        body: req.method === 'POST' ? req : undefined,
      });
      const headers = {'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-store'};
      const ra = up.headers.get('retry-after'); if (ra) headers['retry-after'] = ra;
      res.writeHead(up.status, headers);
      if (up.body) for await (const chunk of up.body) { if (res.destroyed) break; res.write(chunk); }
      done = true; res.end();
      if (up.status === 503 || up.status === 401) ping();
    } catch {
      done = true;
      if (ac.signal.aborted) { try { res.end(); } catch {} return; }
      if (res.headersSent) { try { res.write(`data: ${JSON.stringify(openaiError(LINK_SAY.unreachable, 'unreachable'))}\n\n`); res.end(); } catch {} }
      else json(res, 503, openaiError(LINK_SAY.unreachable, 'unreachable'));
      update({reachable: false, problem: LINK_SAY.unreachable});
    }
  }
  const server = http.createServer((req, res) => { relay(req, res).catch(() => json(res, 500, openaiError(LINK_SAY.unreachable, 'link'))); });
  server.requestTimeout = 0; server.headersTimeout = 30_000;

  return {
    server, localKey, state: () => ({...state}),
    listen(port = 0) {
      const tryPort = p => new Promise((resolve, reject) => {
        const onErr = e => { server.off('error', onErr); reject(e); };
        server.once('error', onErr);
        server.listen(p, '127.0.0.1', () => { server.off('error', onErr); resolve(server.address().port); });
      });
      // the saved port first (so DSH's settings stay right); if something else took it, any free one
      return tryPort(port).catch(e => (port && e.code === 'EADDRINUSE' ? tryPort(0) : Promise.reject(e))).then(p => {
        listen(); ping(); pingT = setInterval(ping, o.pingEveryMs); pingT.unref?.();
        return p;
      });
    },
    async release() {
      try { await o.fetchImpl(door + '/amp/v1/release', {method: 'POST', headers: auth, signal: AbortSignal.timeout(10_000)}); return true; }
      catch { return false; }
    },
    reconnectNow() { tries = 0; evAbort?.abort(); schedule(0); },
    async close() {
      closed = true; clearTimeout(retryT); clearInterval(pingT); evAbort?.abort();
      server.closeAllConnections?.();
      await new Promise(r => server.close(() => r()));
    },
  };
}
