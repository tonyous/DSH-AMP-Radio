// The whole chain on one PC: friend's DSH -> AMP Link -> pretend Tailscale door -> AMP Gate -> pretend AI.
// Plus the Borrowed provider settings. No real model, no Tailscale, no DSH.
//   node test/borrow-link.test.mjs
import http from 'node:http';
import {createGate} from '../borrow/gate.mjs';
import {createLink} from '../borrow/link.mjs';
import {encodeInvite, decodeInvite} from '../borrow/protocol.mjs';
import {offerFromConfig, buildProvider, providerId, addProvider, removeProvider, restoreDefault, isLocalURL, cleanCompat} from '../borrow/provider.mjs';

let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x === '' ? '' : String(x).slice(0, 160)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(25); } return false; };

// pretend AI
let slow = false;
const ai = http.createServer(async (req, res) => {
  let raw = ''; for await (const c of req) raw += c;
  const body = JSON.parse(raw || '{}');
  if (!body.stream) { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify({choices: [{message: {content: 'hello'}}]})); }
  res.writeHead(200, {'content-type': 'text/event-stream'});
  for (let i = 0; i < (slow ? 200 : 4) && !res.destroyed; i++) { res.write(`data: {"choices":[{"delta":{"content":"t${i}"}}]}\n\n`); await sleep(slow ? 20 : 2); }
  if (!res.destroyed) res.end('data: [DONE]\n\n');
});
await new Promise(r => ai.listen(0, '127.0.0.1', r));

// host settings as DSH would have them (one local model, one cloud model that must never be lent)
const hostPiAi = {providers: {
  'local-basalt': {api: 'openai-completions', baseURL: `http://127.0.0.1:${ai.address().port}/v1`, apiKeyEnv: 'LOCAL_KEY_T', defaultContextWindow: 262144,
    compat: {supportsDeveloperRole: true, maxTokensField: 'max_tokens', chatTemplateKwargs: {enable_thinking: {$var: 'thinking.enabled'}}, evilField: 'x'},
    thinkingBudgets: {low: 4096, high: 12288},
    models: [{id: 'basalt-q', name: 'Qwen Basalt', contextWindow: 262144, maxTokens: 32768, input: ['text', 'image'], reasoningEfforts: {off: null, low: 'low', high: 'xhigh'}}]},
  'deepseek-cloud': {api: 'openai-completions', baseURL: 'https://api.deepseek.com/v1', models: [{id: 'deepseek-chat'}]},
  'lan-box': {api: 'openai-completions', baseURL: 'http://192.168.1.5:8080/v1', models: [{id: 'lan'}]},
}};
const offer = offerFromConfig(hostPiAi, {LOCAL_KEY_T: 'local-only'});
ok(offer.length === 1 && offer[0].id === 'basalt-q', 'host: only models running on this PC are offered (no cloud, no other machine)', offer.map(m => m.id));
ok(offer[0].upstream.apiKey === 'local-only' && offer[0].maxTokens === 32768 && offer[0].input.includes('image'), 'host: limits, pictures and the local key read from settings');
ok(offer[0].compat?.chatTemplateKwargs && !('evilField' in offer[0].compat), 'host: only known request settings travel', JSON.stringify(offer[0].compat));
ok(isLocalURL('http://[::1]:8080/v1') && !isLocalURL('http://127.0.0.1.evil.com/v1') && !isLocalURL('file:///etc/passwd'), 'local address check');

const gate = createGate({hostName: 'Alex', models: offer, limits: {idleMs: 5000, dropMs: 400, keepaliveMs: 100, heartbeatMs: 150}});
const gatePort = await gate.listen(0);
const A = gate.addFriend({name: 'Sam'});

// pretend Tailscale door: adds the identity header and removes any copy the caller sent (as tailscale serve does)
let doorUp = true;
const door = http.createServer((req, res) => {
  if (!doorUp) { req.socket.destroy(); return; }
  const headers = {...req.headers}; delete headers['tailscale-user-login']; delete headers['tailscale-user-name'];
  headers['tailscale-user-login'] = 'friend@example.com';
  const up = http.request({host: '127.0.0.1', port: gatePort, path: req.url, method: req.method, headers}, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => res.destroy());
  res.on('close', () => up.destroy());
  req.pipe(up);
});
await new Promise(r => door.listen(0, '127.0.0.1', r));
const invite = encodeInvite({host: 'Alex', url: `http://127.0.0.1:${door.address().port}`, key: A.key, exp: Date.now() + 3600_000});

// friend side
const events = [];
const link = createLink({invite: decodeInvite(invite), notify: m => events.push(m), pingEveryMs: 200, backoff: [100, 200], retries: [150, 300]});
const linkPort = await link.listen(0);
const L = `http://127.0.0.1:${linkPort}`;
const LH = {authorization: 'Bearer ' + link.localKey, 'content-type': 'application/json'};
ok(await until(() => link.state().connected && link.state().models.length === 1), 'link connects and receives the model offer');
ok(events.some(e => e.type === 'models' && e.models[0]?.contextWindow === 262144), 'friend\'s plugin is told the models (for the provider)');
ok(await until(() => Number.isFinite(link.state().pingMs)), 'ping measured', link.state().pingMs + ' ms');
ok(gate.status().connected.includes('Sam'), 'host sees the friend connected');

let r = await fetch(L + '/v1/models', {headers: LH});
let j = await r.json();
ok(r.status === 200 && j.data[0].id === 'basalt-q', 'friend\'s DSH lists the borrowed model through the link');
r = await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', stream: true, messages: [{role: 'user', content: 'hi'}]})});
let t = await r.text();
ok(r.status === 200 && t.includes('t3') && t.includes('[DONE]'), 'a streamed reply comes all the way back');
ok(gate.status().turn?.friend === 'Sam', 'it is the friend\'s turn on the host');
ok(await until(() => link.state().turn === 'yours'), 'the friend\'s card says it is their turn');

// the link only serves this PC's DSH
r = await fetch(L + '/v1/models');
ok(r.status === 401, 'no local key: refused', r.status);
r = await fetch(L + '/v1/models', {headers: {...LH, origin: 'https://evil.example'}});
ok(r.status === 403, 'a web page in the browser: refused', r.status);
r = await fetch(L + '/amp/v1/hello', {headers: LH});
ok(r.status === 404, 'the host\'s own addresses are not passed through', r.status);
r = await fetch(L + '/v1/models', {headers: {...LH, 'tailscale-user-login': 'someone-else@example.com'}});
ok(r.status === 200, 'a forged identity header is replaced by the door (still the real friend)', r.status);

// friend's DSH stops a reply: the host's model stops too
slow = true;
const ac = new AbortController();
const p = fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, signal: ac.signal, body: JSON.stringify({model: 'basalt-q', stream: true, messages: [{role: 'user', content: 'x'}]})}).then(r => r.text()).catch(() => 'cut');
ok(await until(() => gate.status().turn?.replying), 'host sees the reply running');
ac.abort(); await p;
ok(await until(() => !gate.status().turn?.replying, 1500), 'friend pressed stop: the host\'s model stops within 1.5 s');

// host Force stop
const p2 = fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', stream: true, messages: [{role: 'user', content: 'x'}]})}).then(r => r.text());
await until(() => gate.status().turn?.replying);
gate.forceStop();
t = await p2;
ok(/stopped sharing/.test(t), 'Force stop: the friend\'s DSH shows "Your friend stopped sharing."', t.slice(-100));
ok(await until(() => link.state().paused), 'Force stop: the friend\'s card shows it');
r = await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', messages: [{role: 'user', content: 'x'}]})});
j = await r.json();
ok(r.status === 503 && /stopped sharing/.test(j.error.message), 'after Force stop: plain message, no retry storm', j.error?.message);
gate.resume(); slow = false;
link.reconnectNow();
ok(await until(() => link.state().connected && !link.state().paused && link.state().turn === 'free'), 'host shares again: the friend\'s card comes back by itself');

// the host's PC goes away and comes back
doorUp = false; door.closeAllConnections?.();
r = await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', messages: [{role: 'user', content: 'x'}]})});
j = await r.json();
ok(r.status === 503 && /asleep, off/.test(j.error.message), 'host PC unreachable: plain message', j.error?.message);
ok(await until(() => !link.state().connected), 'friend\'s card: not connected');
doorUp = true;
ok(await until(() => link.state().connected, 4000), 'host PC back: reconnected by itself');
// a short drop while sending: the message is retried quietly and gets through
doorUp = false; door.closeAllConnections?.();
setTimeout(() => { doorUp = true; }, 200);
r = await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', messages: [{role: 'user', content: 'x'}]})});
ok(r.status === 200, 'a drop for a moment while sending: retried by itself, the friend sees no error', r.status); await r.text();

// "I'm done"
await (await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', messages: [{role: 'user', content: 'x'}]})})).text();
ok(!!gate.status().turn, 'friend has the turn');
await link.release();
ok(await until(() => !gate.status().turn), '"I\'m done" from the friend\'s card: the host gets the AI back');

// the friend closes DSH: the host is freed after the drop time
await fetch(L + '/v1/chat/completions', {method: 'POST', headers: LH, body: JSON.stringify({model: 'basalt-q', messages: [{role: 'user', content: 'x'}]})}).then(r => r.text());
await link.close();
ok(await until(() => !gate.status().turn, 2000), 'friend closed DSH: the AI is the host\'s again after the drop time');

// a busy port on the friend's PC: the link picks another
const blocker = http.createServer(() => {}); await new Promise(r => blocker.listen(0, '127.0.0.1', r));
const link2 = createLink({invite: decodeInvite(invite), pingEveryMs: 60_000});
const port2 = await link2.listen(blocker.address().port);
ok(port2 !== blocker.address().port && port2 > 0, 'saved port taken by another program: a free one is used', port2);
await link2.close(); blocker.close();

// provider settings on the friend's side
const id = providerId('Alex\'s PC!');
ok(id === 'amp-borrow-alex-s-pc', 'provider id: lowercase, permanent, safe', id);
const entry = buildProvider({host: 'Alex', port: 41234, offer: link.state().models.length ? link.state().models : gate.status().models.map(m => ({id: m}))});
const fromOffer = buildProvider({host: 'Alex', port: 41234, offer: offerFromConfig(hostPiAi, {}).map(({upstream, ...m}) => m)});
ok(fromOffer.baseURL === 'http://127.0.0.1:41234/v1' && fromOffer.apiKeyEnv === 'AMP_BORROW_KEY' && fromOffer.displayName === 'Borrowed · Alex', 'provider points at the link, key by reference only');
const m0 = fromOffer.models[0];
ok(m0.contextWindow === 262144 && m0.maxTokens === 32768 && m0.input.includes('image') && m0.reasoningEfforts.high === 'xhigh', 'model size, pictures and effort levels match the host', JSON.stringify(m0));
ok(m0.compat?.maxTokensField === 'max_tokens' && fromOffer.thinkingBudgets?.high === 12288, 'request settings and thinking budgets match the host');
ok(!JSON.stringify(fromOffer).includes(String(ai.address().port)), 'no host address in the friend\'s settings');
ok(cleanCompat({chatTemplateKwargs: {a: {b: {c: {d: 1}}}}}) === null, 'deeply nested settings from a host are refused');
const hostile = buildProvider({host: 'x', port: 1, offer: [{id: '../../etc'}, {id: 'ok-model', compat: {thinkingFormat: 'x'.repeat(500)}}, {id: {}}]});
ok(hostile.models.length === 1 && hostile.models[0].id === 'ok-model' && !hostile.models[0].compat, 'odd model names and oversized settings from a host are dropped');

const friendPiAi = {providers: {deepseek: {api: 'openai-completions', baseURL: 'https://api.deepseek.com/v1', models: [{id: 'deepseek-chat'}]}}};
const added = addProvider({}, friendPiAi, id, fromOffer);
ok(added.providers.deepseek && added.providers[id], 'adding keeps every provider the friend had');
const removed = removeProvider(added, friendPiAi, id);
ok(JSON.stringify(removed) === JSON.stringify(friendPiAi), 'removing puts the friend\'s settings back exactly');
ok(JSON.stringify(restoreDefault({provider: id, model: 'basalt-q'}, {}, id, {provider: 'deepseek', model: 'deepseek-chat'})) === '{"provider":"deepseek","model":"deepseek-chat"}', 'their old default model comes back');
ok(restoreDefault({provider: 'deepseek', model: 'x'}, {}, id, {provider: 'other'}) === null, 'a default they changed themselves is left alone');

await gate.close(); door.close(); ai.close();
console.log(bad ? `\n${bad} FAILED` : '\nall link checks passed');
process.exit(bad ? 1 : 0);
