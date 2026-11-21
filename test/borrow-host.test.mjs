// Two DSHs in one test: the host's plugin and a friend's plugin, each with pretend DSH services (settings writer, models,
// key store) and a pretend Tailscale whose door adds the identity header. Real gate (child process), real link.
//   node test/borrow-host.test.mjs
import http from 'node:http';
import {mkdtempSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBorrow} from '../borrow/host.mjs';
import {readStatus} from '../borrow/tailscale.mjs';

let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x === '' ? '' : String(x).slice(0, 180)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await sleep(30); } return false; };

// pretend AI on the host
let slow = false;
const ai = http.createServer(async (req, res) => {
  if (req.method === 'GET') { res.writeHead(200, {'content-type': 'application/json'}); return res.end('{"data":[{"id":"basalt-q"}]}'); }
  let raw = ''; for await (const c of req) raw += c;
  res.writeHead(200, {'content-type': 'text/event-stream'});
  for (let i = 0; i < (slow ? 300 : 3) && !res.destroyed; i++) { res.write(`data: {"choices":[{"delta":{"content":"t${i}"}}]}\n\n`); await sleep(slow ? 20 : 2); }
  if (!res.destroyed) res.end('data: [DONE]\n\n');
});
await new Promise(r => ai.listen(0, '127.0.0.1', r));

// pretend DSH services
function fakeDsh(piAi, def) {
  const rows = {'llm-pi-ai': {options: {id: 'llm-pi-ai'}, config: piAi}, 'agent-default-model': {options: {id: 'agent-default-model'}, config: def}};
  const creds = new Map(); const calls = [];
  const llm = {stream(options) { calls.push(options.provider); return (async function* () { yield {type: 'text', provider: options.provider}; })(); }};
  return {rows, creds, calls, llm, ctx: {get: n => ({
    configEditor: {configuration: () => Object.values(rows).map(r => ({entry: r, inherited: {}, override: r.config})),
      edit: async (entry, change) => { const next = change(structuredClone(entry.config), {}); entry.config = next; }},
    credentials: {resolve: async k => (creds.has(k) ? {value: creds.get(k)} : undefined), set: async (k, v) => creds.set(k, v), unset: async k => creds.delete(k)},
    llm,
  })[n]}};
}
const hostDsh = fakeDsh({providers: {
  'local-basalt': {api: 'openai-completions', baseURL: `http://127.0.0.1:${ai.address().port}/v1`, apiKeyEnv: 'LOCAL_LLM_KEY_T', defaultContextWindow: 262144,
    models: [{id: 'basalt-q', name: 'Qwen Basalt', contextWindow: 262144, maxTokens: 32768, reasoningEfforts: {low: 'low', high: 'xhigh'}}]},
  'deepseek-cloud': {api: 'openai-completions', baseURL: 'https://api.deepseek.com/v1', models: [{id: 'deepseek-chat'}]}}},
  {provider: 'local-basalt', model: 'basalt-q'});
hostDsh.creds.set('LOCAL_LLM_KEY_T', 'local-only');
const friendDsh = fakeDsh({providers: {deepseek: {api: 'openai-completions', baseURL: 'https://api.deepseek.com/v1', models: [{id: 'deepseek-chat'}]}}},
  {provider: 'deepseek', model: 'deepseek-chat'});
const friendOriginal = JSON.stringify(friendDsh.rows['llm-pi-ai'].config);

// pretend Tailscale: host is signed in; its door is a small proxy that adds who is calling, like tailscale serve
const statusJSON = (o = {}) => JSON.stringify({BackendState: 'Running', Version: '1.104.7', CertDomains: ['pc.t.ts.net'],
  Self: {DNSName: 'pc.t.ts.net.', TailscaleIPs: ['100.64.0.1'], KeyExpiry: '2027-03-01T00:00:00Z', UserID: 1}, User: {1: {DisplayName: 'Alex'}}, Peer: {}, ...o});
function fakeTs({state = 'Running', allowDoor = true} = {}) {
  let door = null; const t = {state, allowDoor, doorsOpened: 0};
  t.api = {
    status: async () => readStatus(statusJSON({BackendState: t.state, AuthURL: t.state === 'NeedsLogin' ? 'https://login.tailscale.com/a/x1' : ''})),
    doorPorts: async () => (door ? [door.port] : []),
    operatorCommand: () => 'sudo tailscale set --operator=tester',
    ping: async () => ({ms: 42, kind: 'direct'}),
    clearDoor: async () => false,
    doorOpen: () => !!door,
    openDoor: async ({port, target}) => {
      if (!t.allowDoor) return {ok: false, problem: 'operator', say: 'Type your password in the window that opened.'};
      const to = new URL(target);
      const srv = http.createServer((req, res) => {
        const headers = {...req.headers, 'tailscale-user-login': 'friend@example.com'};
        const up = http.request({host: to.hostname, port: to.port, path: req.url, method: req.method, headers}, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
        up.on('error', () => res.destroy()); res.on('close', () => up.destroy()); req.pipe(up);
      });
      await new Promise(r => srv.listen(0, '127.0.0.1', r));
      door = {port, srv}; t.doorsOpened++;
      return {ok: true, port, url: `http://127.0.0.1:${srv.address().port}`};
    },
    closeDoor: async () => { if (door) { door.srv.closeAllConnections(); door.srv.close(); } const had = !!door; door = null; return {closed: true, port: had}; },
  };
  return t;
}
const hostTs = fakeTs({allowDoor: false}), friendTs = fakeTs({state: 'NeedsLogin'});
const hostHome = mkdtempSync(join(tmpdir(), 'amp-host-')), friendHome = mkdtempSync(join(tmpdir(), 'amp-friend-'));
const problems = []; const opened = []; let adminAsked = 0;
const unloaded = [];
const quiet = {openURL: u => opened.push(u), admin: async () => { adminAsked++; return false; }, retryMs: 200, isGaming: () => false,
  unload: async ids => { unloaded.push(...ids); return ids; }, unloadAfterMs: 300, unloadAfterDropMs: 1500, hostQuietMs: 0};
const host = createBorrow({ctx: hostDsh.ctx, home: hostHome, tailscale: hostTs.api, report: (w, e) => problems.push(w + ': ' + e), refreshMs: 300, resumeDelayMs: 100, ...quiet});
const friend = createBorrow({ctx: friendDsh.ctx, home: friendHome, tailscale: friendTs.api, report: (w, e) => problems.push(w + ': ' + e), ...quiet});
const call = async (side, path, body) => (await side.routes['/api/amp-borrow/' + path](new Request('http://x', {method: 'POST', body: JSON.stringify(body || {})}))).json();

// host: the switch, first without the admin step
let s = await call(host, 'share', {on: true});
ok(!s.host.sharing && s.host.step?.step === 'operator' && s.host.step.command?.startsWith('sudo tailscale set --operator='), 'no admin step yet: the card shows the one command, nothing opened', JSON.stringify(s.host.step));
hostTs.allowDoor = true;
s = await call(host, 'share', {on: true});
ok(s.host.sharing && s.host.models.join() === 'basalt-q', 'Share my AI on: door open, the loaded model offered (no cloud model)', JSON.stringify(s.host.models));
ok(s.host.name === 'Alex', 'host name taken from the Tailscale account', s.host.name);
let inv = await call(host, 'invite', {name: 'Sam', share: 'https://evil.example/x'});
ok(/not a Tailscale share link/.test(inv.error || ''), 'a share link that is not Tailscale\'s is refused');
inv = await call(host, 'invite', {name: 'Sam', share: 'https://login.tailscale.com/admin/invite/abc123'});
ok(/^AMP1-/.test(inv.invite || ''), 'invite made', (inv.invite || '').slice(0, 20));

// friend: Tailscale not signed in yet, then signed in
let j = await call(friend, 'join', {invite: inv.invite});
ok(j.friend?.step?.step === 'login' && opened.includes('https://login.tailscale.com/a/x1'), 'friend not signed in: the sign-in page opens by itself', JSON.stringify(j.friend?.step));
ok(adminAsked === 1, 'host: the admin password window was asked for once, by itself');
friendTs.state = 'Running';
ok(await until(async () => !!(await call(friend, 'status')).friend.host), 'friend signs in: it connects by itself, nothing to press');
await call(friend, 'leave');
j = await call(friend, 'join', {invite: 'AMP1-garbage-00000000'});
ok(/incomplete/.test(j.error || ''), 'a badly copied invite: "copy it again"');
j = await call(friend, 'join', {invite: inv.invite});
ok(/Connected to Alex/.test(j.say || ''), 'friend joins', j.say || JSON.stringify(j));
const prov = () => friendDsh.rows['llm-pi-ai'].config.providers?.['amp-borrow-alex'];
ok(await until(() => !!prov()), 'friend\'s DSH now lists "Borrowed · Alex"');
ok(prov()?.models?.[0]?.contextWindow === 262144 && prov().displayName === 'Borrowed · Alex' && friendDsh.rows['llm-pi-ai'].config.providers.deepseek, 'same size and effort levels as on the host; their own models kept');
ok(friendDsh.creds.get('AMP_BORROW_KEY')?.startsWith('ampb_'), 'the link key is in DSH\'s key store, not in the settings file');

// the friend's DSH uses the Borrowed model exactly as DSH would: OpenAI request to the provider address with the key
const chat = (extra = {}) => fetch(prov().baseURL + '/chat/completions', {method: 'POST', headers: {authorization: 'Bearer ' + process.env.AMP_BORROW_KEY, 'content-type': 'application/json', 'sec-fetch-mode': 'cors'},
  body: JSON.stringify({model: 'basalt-q', stream: true, messages: [{role: 'user', content: 'hello'}], ...extra})});
let r = await chat(); let t = await r.text();
ok(r.status === 200 && t.includes('[DONE]'), 'friend gets a reply from the host\'s AI');
s = await call(host, 'status');
ok(s.host.lock && s.host.lockFriend === 'Sam', 'host: locked, lent to Sam');
ok(await until(async () => (await call(host, 'status')).host.live?.turn?.tokOut >= 3), 'host sees the usage live');
ok(await until(async () => (await call(friend, 'status')).friend.state?.turn === 'yours'), 'friend\'s card: your turn');
ok((await call(host, 'status')).host.ai === 'ready' && (await call(friend, 'status')).friend.state?.ai === 'ready', 'AI light: green on both cards while the AI runs');
ok(await until(async () => (await call(friend, 'status')).friend.state?.pingMs >= 0), 'friend\'s card: ping', (await call(friend, 'status')).friend.state?.pingMs);

// the host's own chat on the lent model waits; a cloud model does not
let hostDone = false;
const hostChat = (async () => { for await (const _ of hostDsh.llm.stream({provider: 'local-basalt'})) {} hostDone = true; })();
let cloudDone = false;
(async () => { for await (const _ of hostDsh.llm.stream({provider: 'deepseek-cloud'})) {} cloudDone = true; })();
await sleep(200);
ok(!hostDone && cloudDone, 'host\'s message to the lent model waits; cloud models are not held');
ok((await call(host, 'status')).host.waitingHere === 1, 'host card can say "your message waits"');
await call(friend, 'done');
ok(await until(() => hostDone), '"I\'m done" from the friend: the host\'s waiting message goes at once');
ok(await until(() => unloaded.includes('basalt-q'), 3000), 'friend done: the AI is unloaded from the graphics card by itself');
unloaded.length = 0;

// the friend waits while the host replies
slow = true;
const ownReply = (async () => { for await (const _ of hostDsh.llm.stream({provider: 'local-basalt'})) await sleep(400); })();
await sleep(30);
const fr = chat({stream: false});
await sleep(150);
ok(await until(async () => (await call(friend, 'status')).friend.state?.turn === 'waiting'), 'friend\'s card while the host replies: waiting');
await ownReply; slow = false;
r = await fr; ok(r.status === 200, 'host done: the friend\'s message goes by itself');

// Force stop mid-reply
slow = true;
const mid = chat().then(r => r.text());
await until(async () => (await call(host, 'status')).host.live?.turn?.replying);
s = await call(host, 'stop');
t = await mid;
ok(s.closed && !s.host.sharing && /Nobody is connected/.test(s.host.problem), 'Force stop: door closed and checked, "Stopped. Nobody is connected."', s.host.problem);
ok(/stopped sharing/.test(t), 'friend\'s reply ends with "Your friend stopped sharing."');
r = await chat(); j = await r.json();
ok(r.status === 503 && /asleep, off, or not sharing/.test(j.error.message), 'friend tries again: plain message', j.error?.message);
slow = false;

// sharing back on: the friend reconnects by itself (same invite still valid)
s = await call(host, 'share', {on: true});
ok(s.host.sharing, 'Share my AI on again');
// the door address changed (new pretend port); a real Tailscale door keeps its address, so re-join with a new invite here
inv = await call(host, 'invite', {name: 'Sam'});
j = await call(friend, 'join', {invite: inv.invite});
r = await chat().catch(() => chat()); ok(r.status === 200, 'friend borrows again (a new invite after the door moved)');

// Tailscale's door goes away on its own (Tailscale restarted): sharing reopens it by itself
const opens = hostTs.doorsOpened;
await hostTs.api.closeDoor();
ok(await until(async () => hostTs.doorsOpened > opens && (await call(host, 'status')).host.sharing, 5000), 'door lost: reopened by itself, still sharing');
// DSH restarts: sharing comes back by itself (decision 8)
await host.dispose();
ok(!(await host.status()).host.sharing, 'DSH closed: sharing ended with it');
const host2 = createBorrow({ctx: fakeDsh(hostDsh.rows['llm-pi-ai'].config, {}).ctx, home: hostHome, tailscale: fakeTs().api, report: () => {}, resumeDelayMs: 100, ...quiet});
ok(await until(() => host2.status().host.sharing, 5000), 'DSH opened again: sharing came back by itself');
await host2.dispose();

// the friend stops borrowing: their DSH is exactly as before
await call(friend, 'leave');
ok(JSON.stringify(friendDsh.rows['llm-pi-ai'].config) === friendOriginal, 'Forget this friend: the friend\'s model settings are exactly as before');
ok(friendDsh.rows['agent-default-model'].config.provider === 'deepseek' && !friendDsh.creds.has('AMP_BORROW_KEY') && !existsSync(join(friendHome, 'amp-radio', 'borrow', 'friend.json')), 'default model, key store and saved invite all cleaned up');
await friend.dispose();

console.log(problems.length ? 'problems logged: ' + problems.join(' / ') : 'no problems logged');
ai.close();
console.log(bad ? `\n${bad} FAILED` : '\nall host checks passed');
process.exit(bad ? 1 : 0);
