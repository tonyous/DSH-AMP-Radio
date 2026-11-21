// Chaos: the AMP Gate (borrow/gate.mjs) against a pretend AI server. No real model, no network, no Tailscale.
//   node test/borrow-gate.test.mjs
import http from 'node:http';
import {fork} from 'node:child_process';
import {mkdtempSync, readFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGate} from '../borrow/gate.mjs';
import {decodeInvite, encodeInvite} from '../borrow/protocol.mjs';

let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x === '' ? '' : String(x).slice(0, 160)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SECRET = 'zebra-pancake-71';

// ---- a pretend model server ---------------------------------------------------------------------------------------------
const seen = []; let mode = 'ok'; let aborted = 0; let slotsBusy = false;
const model = http.createServer(async (req, res) => {
  let raw = ''; for await (const c of req) raw += c;
  let body = null; try { body = JSON.parse(raw); } catch {}
  if (req.url === '/slots') { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify([{id: 0, is_processing: slotsBusy}])); }
  seen.push({path: req.url, auth: req.headers.authorization, body});
  let closed = false; res.on('close', () => { if (!res.writableEnded) { closed = true; aborted++; } });
  if (mode === 'error500') { res.writeHead(500); return res.end('boom'); }
  if (mode === 'context') { res.writeHead(400, {'content-type': 'application/json'}); return res.end('{"error":{"message":"the request exceeds the available context size"}}'); }
  if (!body?.stream) { res.writeHead(200, {'content-type': 'application/json'}); return res.end(JSON.stringify({choices: [{message: {role: 'assistant', content: 'hi'}}], usage: {prompt_tokens: 7, completion_tokens: 2}})); }
  if (mode === 'slowstart') await sleep(350);
  res.writeHead(200, {'content-type': 'text/event-stream'});
  const n = mode === 'long' ? 400 : 5;
  for (let i = 0; i < n && !closed; i++) {
    res.write(`data: ${JSON.stringify({choices: [{delta: {content: 'w' + i + ' '}}]})}\n\n`);
    await sleep(mode === 'long' ? 20 : 5);
  }
  if (closed) return;
  res.write(`data: ${JSON.stringify({choices: [], usage: {prompt_tokens: 11, completion_tokens: n}})}\n\n`);
  res.end('data: [DONE]\n\n');
});
await new Promise(r => model.listen(0, '127.0.0.1', r));
const MODEL = {id: 'basalt-flash-next-iq3_xxs', name: 'Qwen 3.8 Flash-Next', contextWindow: 262144, maxTokens: 4096, input: ['text'],
  reasoningEfforts: {low: 'low', high: 'high'}, compat: {supportsDeveloperRole: true},
  upstream: {baseURL: `http://127.0.0.1:${model.address().port}/v1`, apiKey: 'local-only', model: 'basalt-upstream-id'}};

// ---- the gate -----------------------------------------------------------------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), 'amp-gate-'));
const notes = [];
const limits = {wakeMs: 600, wakePollMs: 50, idleMs: 400, dropMs: 300, keepaliveMs: 100, heartbeatMs: 200, perMinute: 200, maxBodyBytes: 64 * 1024, hostWaitMs: 800};
const gate = createGate({stateDir: dir, hostName: 'Alex', models: [MODEL], limits, notify: m => notes.push(m)});
const port = await gate.listen(0);
const base = `http://127.0.0.1:${port}`;
const A = gate.addFriend({name: 'Sam'}), B = gate.addFriend({name: 'Second'});
const H = (key, login = 'alice@example.com', extra = {}) => ({authorization: 'Bearer ' + key, 'tailscale-user-login': login, ...extra});
const chatBody = (extra = {}) => JSON.stringify({model: MODEL.id, stream: true, messages: [{role: 'user', content: SECRET}], ...extra});
const post = (path, key, body, login, signal) => fetch(base + path, {method: 'POST', headers: {...H(key, login), 'content-type': 'application/json'}, body, signal});
const text = async r => { try { return await r.text(); } catch { return ''; } };

// who may knock
let r = await fetch(base + '/v1/models');
ok(r.status === 401, 'no key: refused', r.status);
r = await fetch(base + '/v1/models', {headers: H('ampb_' + 'x'.repeat(43))});
ok(r.status === 401, 'wrong key: refused', r.status);
r = await fetch(base + '/v1/models', {headers: {authorization: 'Bearer ' + A.key}});
ok(r.status === 403, 'right key but not through Tailscale (no identity header): refused', r.status);
for (const p of ['/slots', '/v1/embeddings', '/props', '/api/amp-bar/settings', '/', '/v1/completions', '/v1/chat/completions/../../slots?id_slot=0&action=save']) {
  r = await fetch(base + p, {method: p.includes('slots') ? 'POST' : 'GET', headers: H(A.key)});
  ok(r.status === 404, `${p}: not reachable`, r.status);
}
r = await fetch(base + '/v1/models', {headers: H(A.key)});
let j = await r.json();
ok(r.status === 200 && j.data.length === 1 && j.data[0].id === MODEL.id, 'model list: the shared model only');
r = await fetch(base + '/v1/models', {headers: H(A.key, 'mallory@example.com')});
ok(r.status === 403, 'invite already bound to the first Tailscale login: another person is refused', r.status);
r = await fetch(base + '/amp/v1/hello', {headers: H(A.key)});
const helloText = await r.text();
ok(r.status === 200 && JSON.parse(helloText).host === 'Alex' && JSON.parse(helloText).models[0].contextWindow === 262144, 'hello: host name and the model offer');
ok(!/127\.0\.0\.1|local-only|upstream|baseURL/.test(helloText), 'hello leaks no address, key or upstream name');

// junk
r = await post('/v1/chat/completions', A.key, '{oops');
ok(r.status === 400, 'not JSON: 400', r.status);
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: 'other-model', messages: [{role: 'user', content: 'x'}]}));
ok(r.status === 404, 'a model not shared: 404', r.status);
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'hacker', content: 'x'}]}));
ok(r.status === 400, 'a strange message role: 400', r.status);
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'.repeat(70 * 1024)}]}));
ok(r.status === 413, 'over the size cap: 413', r.status);
r = await post('/v1/chat/completions', A.key, '{"__proto__":{"polluted":1},"model":"' + MODEL.id + '","messages":[{"role":"user","content":"x"}]}');
ok(({}).polluted === undefined, 'no prototype pollution');
await sleep(450); gate.release();

// a normal streamed reply
seen.length = 0; notes.length = 0;
r = await post('/v1/chat/completions', A.key, chatBody({max_tokens: 999999, slot_id: 0, cache_prompt: true, grammar: 'root ::= "x"', n_probs: 5, n: 4, chat_template_kwargs: {enable_thinking: true}}));
let t = await r.text();
ok(r.status === 200 && t.includes('w4') && t.includes('[DONE]'), 'streamed reply arrives whole');
const sent = seen.at(-1)?.body || {};
ok(sent.model === 'basalt-upstream-id', 'the model server gets its own model name', sent.model);
ok(sent.max_tokens === 4096, 'reply size clamped to the model limit', sent.max_tokens);
ok(!('slot_id' in sent) && !('cache_prompt' in sent) && !('grammar' in sent) && !('n_probs' in sent) && sent.n === 1, 'server-only fields dropped, n forced to 1', Object.keys(sent).join(','));
ok(sent.stream_options?.include_usage === true, 'usage counting asked for');
ok(sent.chat_template_kwargs?.enable_thinking === true, 'thinking switch passed through');
ok(seen.at(-1)?.auth === 'Bearer local-only', 'the host\'s local key is added on the host side only');
ok(notes.some(n => n.type === 'lock' && n.on === true), 'host lock switched on for the friend\'s turn');
let st = gate.status();
ok(st.turn?.friend === 'Sam' && st.turn.tokOut === 5 && st.turn.tokIn === 11, 'host sees who and the usage', JSON.stringify(st.turn));

// the second friend while the first has the turn
r = await post('/v1/chat/completions', B.key, chatBody(), 'bob@example.com');
j = await r.json();
ok(r.status === 503 && j.error.code === 'busy', 'second friend: "someone else has the turn"', j.error?.message);

// one message at a time
mode = 'long';
const first = post('/v1/chat/completions', A.key, chatBody());
await sleep(120);
r = await post('/v1/chat/completions', A.key, chatBody());
ok(r.status === 429, 'second message while one is running: one at a time', r.status);
await (await first).text();
mode = 'ok';

// idle: free after the quiet time
await sleep(550);
ok(!gate._turn() && notes.some(n => n.type === 'lock' && n.on === false && n.reason === 'quiet'), 'quiet: the AI is free again and the host lock is off');

// friend drops mid-reply: the model stops at once
mode = 'long'; aborted = 0;
const ac = new AbortController();
const p1 = post('/v1/chat/completions', A.key, chatBody(), undefined, ac.signal).then(r => r.text()).catch(() => 'cut');
await sleep(150); const cutAt = Date.now(); ac.abort();
await p1;
for (let i = 0; i < 50 && !aborted; i++) await sleep(20);
ok(aborted === 1 && Date.now() - cutAt < 1000, 'friend drops mid-reply: the model server is stopped within 1 s', (Date.now() - cutAt) + ' ms');
await sleep(450);
ok(!gate._turn(), 'and the turn is freed after the drop time');

// Force stop mid-reply
aborted = 0; notes.length = 0;
const ev = await fetch(base + '/amp/v1/events', {headers: H(A.key)});
const evReader = ev.body.getReader(); let evText = '';
(async () => { try { for (;;) { const {value, done} = await evReader.read(); if (done) break; evText += new TextDecoder().decode(value); } } catch {} })();
const p2 = post('/v1/chat/completions', A.key, chatBody()).then(r => r.text());
await sleep(150); const stopAt = Date.now(); gate.forceStop();
t = await p2;
for (let i = 0; i < 50 && !aborted; i++) await sleep(20);
ok(aborted === 1 && Date.now() - stopAt < 1000, 'Force stop: model stopped within 1 s', (Date.now() - stopAt) + ' ms');
ok(/stopped sharing/.test(t), 'Force stop: the friend\'s reply ends with a plain message', t.slice(-120));
await sleep(50);
ok(/event: stopped/.test(evText), 'Force stop: the friend\'s card is told');
r = await post('/v1/chat/completions', A.key, chatBody());
ok(r.status === 503, 'after Force stop: nobody gets in until the host turns sharing back on', r.status);
ok(gate.status().sharing === false && !gate._turn(), 'host card: sharing paused, nobody connected');
gate.resume(); mode = 'ok';

// the host is using it: the friend waits, then goes
gate.setHostBusy(1);
const p3 = post('/v1/chat/completions', A.key, chatBody()).then(async r => [r.status, await r.text()]);
await sleep(150);
ok(gate.status().waiting.includes('Sam'), 'host busy: the friend is shown as waiting');
gate.setHostBusy(0);
let [s3, t3] = await p3;
ok(s3 === 200 && t3.includes('[DONE]'), 'host done: the friend\'s message goes through by itself');
gate.release();
gate.setHostBusy(1);
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'}]}));
ok(r.status === 503, 'host busy for too long: the friend is told to try again', r.status);
gate.setHostBusy(0);

// something else on the host (Hermes, another app) is using the AI: the friend waits, then goes by itself
slotsBusy = true;
const p4 = post('/v1/chat/completions', A.key, chatBody()).then(async r => [r.status, await r.text()]);
await sleep(250);
ok(gate.status().waiting.includes('Sam') && seen.filter(x => x.path?.includes('chat')).length >= 0, 'another app is using the AI: the friend is shown as waiting');
slotsBusy = false;
const [s4, t4] = await p4;
ok(s4 === 200 && t4.includes('[DONE]'), 'the other app finished: the friend\'s message went through by itself');
gate.release();

// the model is not there / answers badly
const saved = MODEL.upstream.baseURL;
gate.setModels([{...MODEL, upstream: {...MODEL.upstream, baseURL: 'http://127.0.0.1:9/v1'}}]);
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'}]}));
j = await r.json();
ok(r.status === 503 && j.error.code === 'not_loaded', 'model not loaded and it did not wake: plain message', j.error?.message);
ok(notes.some(n => n.type === 'wake' && n.model === MODEL.id), 'the host was asked to wake its AI');
// the host's AI wakes while the friend waits: the message goes through by itself
const sleepy = http.createServer(); await new Promise(r => sleepy.listen(0, '127.0.0.1', r)); const sp = sleepy.address().port; sleepy.close();
gate.setModels([{...MODEL, upstream: {...MODEL.upstream, baseURL: `http://127.0.0.1:${sp}/v1`}}]);
notes.length = 0;
const pw = post('/v1/chat/completions', A.key, chatBody());
await sleep(150);
ok(notes.some(n => n.type === 'wake'), 'asleep: wake asked for');
const awake = http.createServer((q, s2) => model.emit('request', q, s2)); await new Promise(r => awake.listen(sp, '127.0.0.1', r));
r = await pw; t = await r.text();
ok(r.status === 200 && t.includes('[DONE]'), 'the AI woke: the friend\'s message went through, nothing to press');
awake.close(); gate.release();
// a game is running on the host: the friend is told, nothing loads
gate.setModels([{...MODEL, upstream: {...MODEL.upstream, baseURL: 'http://127.0.0.1:9/v1'}}]);
const pg = post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'}]}));
await sleep(100); gate.wakeDenied(MODEL.id, 'game');
r = await pg; j = await r.json();
ok(r.status === 503 && j.error.code === 'gaming', 'host playing a game: "Your friend is playing a game"', j.error?.message);
gate.release();
gate.setModels([{...MODEL, upstream: {...MODEL.upstream, baseURL: saved}}]);
mode = 'context';
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'}]}));
ok(r.status === 413, 'too long for the model: "compact it" message', r.status);
mode = 'error500';
r = await post('/v1/chat/completions', A.key, JSON.stringify({model: MODEL.id, messages: [{role: 'user', content: 'x'}]}));
ok(r.status === 502, 'model server error: plain message, gate still up', r.status);
mode = 'slowstart';
r = await post('/v1/chat/completions', A.key, chatBody());
t = await r.text();
ok(r.status === 200 && t.startsWith(': thinking') && t.includes('[DONE]'), 'slow first word: the line is kept alive, then the reply');
mode = 'ok'; gate.release();
gate.setModels([]);
r = await post('/v1/chat/completions', A.key, chatBody());
ok(r.status === 503, 'nothing shared at all: "not loaded"', r.status);
gate.setModels([MODEL]);

// rate limit (its own gate, 5 a minute)
const g5 = createGate({models: [MODEL], limits: {...limits, perMinute: 5}});
const p5 = await g5.listen(0); const R = g5.addFriend({name: 'R'});
let codes = [];
for (let i = 0; i < 8; i++) codes.push((await fetch(`http://127.0.0.1:${p5}/v1/chat/completions`, {method: 'POST', headers: H(R.key, 'r@example.com'), body: '{'})).status);
ok(codes.slice(0, 5).every(c => c === 400) && codes.slice(5).every(c => c === 429), 'flood: the 6th message in a minute is slowed down', codes.join(','));
await g5.close();

// events: the friend's card leaving frees the turn
const g2 = createGate({stateDir: mkdtempSync(join(tmpdir(), 'amp-gate2-')), models: [MODEL], limits: {...limits, idleMs: 60_000}});
const p2port = await g2.listen(0); const C = g2.addFriend({name: 'C'});
const e2 = new AbortController();
const evs = await fetch(`http://127.0.0.1:${p2port}/amp/v1/events`, {headers: H(C.key, 'c@example.com'), signal: e2.signal});
const rr = await fetch(`http://127.0.0.1:${p2port}/v1/chat/completions`, {method: 'POST', headers: H(C.key, 'c@example.com'), body: chatBody()});
await rr.text();
ok(!!g2._turn(), 'friend has the turn');
e2.abort(); evs.body?.cancel?.().catch(() => {});
await sleep(500);
ok(!g2._turn(), 'friend\'s DSH went away: turn freed after the drop time');
const rel = await fetch(`http://127.0.0.1:${p2port}/v1/chat/completions`, {method: 'POST', headers: H(C.key, 'c@example.com'), body: chatBody()});
await rel.text();
await fetch(`http://127.0.0.1:${p2port}/amp/v1/release`, {method: 'POST', headers: H(C.key, 'c@example.com')});
ok(!g2._turn(), '"I\'m done": turn freed at once');

// turn and day limits (a pretend clock)
let clock = Date.now();
const g3 = createGate({stateDir: mkdtempSync(join(tmpdir(), 'amp-gate3-')), models: [MODEL], now: () => clock, limits: {...limits, dayMs: 1000, turnMs: 5000, idleMs: 60_000}});
const p3port = await g3.listen(0); const D = g3.addFriend({name: 'D'});
const d1 = await fetch(`http://127.0.0.1:${p3port}/v1/chat/completions`, {method: 'POST', headers: H(D.key, 'd@example.com'), body: chatBody()});
await d1.text();
clock += 1500; g3.release();
const d2 = await fetch(`http://127.0.0.1:${p3port}/v1/chat/completions`, {method: 'POST', headers: H(D.key, 'd@example.com'), body: chatBody()});
j = await d2.json();
ok(d2.status === 403 && j.error.code === 'day_limit', 'daily time used up: plain message', j.error?.message);
const E = g3.addFriend({name: 'E'}); clock += 25 * 3600_000;
const e1 = await fetch(`http://127.0.0.1:${p3port}/v1/models`, {headers: H(E.key, 'e@example.com')});
ok(e1.status === 401, 'an invite unused for over 24 hours: expired', e1.status);

// revoke
gate.revokeFriend(A.id);
r = await fetch(base + '/v1/models', {headers: H(A.key)});
ok(r.status === 401, 'revoked friend: refused', r.status);

// what is saved on disk
const saveText = readFileSync(join(dir, 'friends.json'), 'utf8') + (existsSync(join(dir, 'audit.log')) ? readFileSync(join(dir, 'audit.log'), 'utf8') : '');
ok(!saveText.includes(A.key) && !saveText.includes(B.key), 'keys are never saved, only fingerprints');
ok(!saveText.includes(SECRET), 'nothing anyone wrote is saved (numbers only)');
ok(/turn start/.test(saveText) && /tokOut/.test(saveText), 'audit log has the numbers');

// 60 hostile requests at once: still answering
await Promise.all([...Array(60)].map((_, i) => fetch(base + (i % 2 ? '/v1/chat/completions' : '/nope'), {method: 'POST', headers: {authorization: 'Bearer ' + 'z'.repeat(i)}, body: 'x'.repeat(i * 100)}).catch(() => null)));
r = await fetch(base + '/v1/models', {headers: H(B.key, 'bob@example.com')});
ok(r.status === 200, 'after a flood of junk: still answering');

// invites
const inv = encodeInvite({host: 'Alex', url: 'https://pc.example.ts.net:8445', key: B.key, exp: Date.now() + 1000});
ok(decodeInvite(inv).key === B.key && decodeInvite('  ' + inv + '\n').host === 'Alex', 'invite: reads back, spaces ignored');
let msg = ''; try { decodeInvite(inv.slice(0, -3) + 'aaa'); } catch (e) { msg = e.message; }
ok(/incomplete/.test(msg), 'invite with a typo: "copy it again"', msg);
try { decodeInvite(encodeInvite({host: 'x', url: 'https://u:p@evil.example', key: B.key})); msg = ''; } catch (e) { msg = e.message; }
ok(msg !== '', 'invite carrying a username/password address: refused');
try { decodeInvite(encodeInvite({host: 'x', url: 'https://pc.example.ts.net', key: B.key, exp: Date.now() - 1})); msg = ''; } catch (e) { msg = e.message; }
ok(/expired/.test(msg), 'old invite: expired', msg);

await gate.close(); await g2.close(); await g3.close();

// as the plugin runs it: a child process that ends with DSH
const dir4 = mkdtempSync(join(tmpdir(), 'amp-gate4-'));
const child = fork(new URL('../borrow/gate.mjs', import.meta.url).pathname, [], {stdio: ['ignore', 'ignore', 'pipe', 'ipc']});
const ask = (m, type) => new Promise(res => { const h = x => { if (x.type === type) { child.off('message', h); res(x); } }; child.on('message', h); child.send(m); });
const ready = await ask({type: 'start', stateDir: dir4, hostName: 'Alex', models: [MODEL], limits}, 'ready');
const added = await ask({type: 'addFriend', name: 'F'}, 'friendAdded');
r = await fetch(`http://127.0.0.1:${ready.port}/v1/chat/completions`, {method: 'POST', headers: H(added.key, 'f@example.com'), body: chatBody()});
ok(r.status === 200 && (await r.text()).includes('[DONE]') && added.friendId && added.id !== added.friendId, 'child process: reply through the gate');
const exited = new Promise(res => child.on('exit', () => res(true)));
child.disconnect();
ok(await Promise.race([exited, sleep(4000).then(() => false)]), 'DSH lets go: the gate ends by itself');
r = await fetch(`http://127.0.0.1:${ready.port}/v1/models`).catch(() => null);
ok(!r, 'and its port is closed');

model.close();
console.log(bad ? `\n${bad} FAILED` : '\nall gate checks passed');
process.exit(bad ? 1 : 0);
