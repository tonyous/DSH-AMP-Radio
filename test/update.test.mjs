// AMP keeps itself up to date: pretend GitHub, pretend plugin manager. Nothing is installed for real.
//   node test/update.test.mjs
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createUpdater, newestTag, newer} from '../update.mjs';

let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x === '' ? '' : String(x).slice(0, 160)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

ok(newestTag([{name: 'v2.2.10'}, {name: 'v2.2.9'}, {name: 'v2.10.0-beta'}, {name: 'junk'}, {name: 'v2.3.0'}]) === 'v2.3.0', 'newest release tag picked, odd tags ignored');
ok(newer('v2.2.10', '2.2.9') && !newer('2.2.7', 'v2.2.7') && !newer('x', '1.0.0'), 'version compare');

const home = mkdtempSync(join(tmpdir(), 'amp-upd-'));
let tags = [{name: 'v2.2.7'}, {name: 'v2.2.8'}];
const gh = async url => ({ok: true, json: async () => (url.includes('tonyous/DSH-AMP-Radio/tags') ? tags : [])});
const installs = []; let result = 'applied';
const pm = {installBundle: async (spec) => { installs.push(spec); return {application: result}; }};
let agentsBusy = false, borrow = null, gaming = false;
const ctx = {get: n => ({pluginManager: pm, agents: {list: () => [{status: agentsBusy ? 'running' : 'idle'}]}})[n]};
const helper = join(home, 'restart-helper.sh'); writeFileSync(helper, `#!/bin/sh\ntouch ${home}/restarted\n`); chmodSync(helper, 0o755);
const mk = (o = {}) => createUpdater({safeInstaller: null, ctx, home, version: '2.2.7', fetchImpl: gh, borrowState: () => borrow, isGaming: () => gaming, firstCheckMs: 1e9, restartHelper: helper, ...o});

let u = mk();
borrow = {host: {lock: true, live: {turn: {friend: 'Sam'}}}};
let s = await u.check();
ok(s.step === 'waiting' && /friend/.test(s.note) && !installs.length, 'a friend is borrowing: waits, installs nothing', s.note);
borrow = {friend: {state: {turn: 'yours'}}};
s = await u.check();
ok(s.step === 'waiting' && !installs.length, 'this PC is borrowing: waits', s.note);
borrow = null; agentsBusy = true;
s = await u.check();
ok(s.step === 'waiting' && /chat/.test(s.note), 'a chat is running: waits', s.note);
agentsBusy = false; gaming = true;
s = await u.check();
ok(s.step === 'waiting' && /game/.test(s.note), 'a game is running: waits', s.note);
gaming = false;
mkdirSync(join(home, 'amp-radio', 'borrow', 'gate'), {recursive: true});
writeFileSync(join(home, 'amp-radio', 'borrow', 'gate', 'audit.log'), JSON.stringify({t: new Date().toISOString(), event: 'reply'}) + '\n');
s = await u.check();
ok(s.step === 'waiting' && /15 minutes/.test(s.note), 'a friend messaged a minute ago: waits', s.note);
writeFileSync(join(home, 'amp-radio', 'borrow', 'gate', 'audit.log'), JSON.stringify({t: new Date(Date.now() - 3600_000).toISOString(), event: 'reply'}) + '\n');
s = await u.check();
ok(s.step === 'done' && installs.at(-1) === 'github:tonyous/DSH-AMP-Radio#v2.2.8', 'all quiet: installs the newest release through DSH\'s plugin manager', installs.at(-1));

u = mk(); tags = [{name: 'v2.2.7'}];
s = await u.check();
ok(s.step === 'current', 'already the newest: nothing to do');

tags = [{name: 'v2.2.9'}]; result = 'restart-required';
u = mk(); s = await u.check();
await sleep(300);
ok(s.step === 'restarting' && existsSync(join(home, 'restarted')), 'needs a restart: this PC\'s idle-restart helper is started');
u = mk({restartHelper: join(home, 'nope')}); tags = [{name: 'v2.3.0'}];
s = await u.check();
ok(s.step === 'restart', 'no helper on this PC: the card asks for one restart');

tags = [{name: 'v2.4.0'}]; result = 'failed'; const n = installs.length;
u = mk(); s = await u.check();
ok(s.step === 'failed', 'a failed install: reported, DSH keeps the old version (DSH undoes it)');
s = await u.check();
ok(s.step === 'waiting-retry' && installs.length === n + 1, 'the same failed version is not retried for a day');

u = mk({fetchImpl: async () => { throw new Error('offline'); }});
s = await u.check();
ok(s.step === 'offline', 'no internet: nothing happens, tries again later');
u = createUpdater({safeInstaller: null, ctx: {get: () => null}, home, version: '2.2.7', fetchImpl: gh, firstCheckMs: 1e9});
s = await u.check();
ok(s.step === 'unavailable', 'a DSH without the plugin manager: stays off quietly');

// a PC with the careful installer (test on a copy, backup, rollback) uses it instead of the plugin manager
const fake = join(home, 'plugin_update.py');
writeFileSync(fake, `import sys\nopen('${home}/installer-calls','a').write(' '.join(sys.argv[1:3])+'\\n')\nprint('RESULT: PASS - apply with: plugin_update.py apply /tmp/x' if sys.argv[1]=='test' else 'APPLIED. DSH core untouched.')\n`);
tags = [{name: 'v2.5.0'}]; const before = installs.length;
u = mk({safeInstaller: fake}); s = await u.check(); await sleep(200);
const calls = existsSync(join(home, 'installer-calls')) ? (await import('node:fs')).readFileSync(join(home, 'installer-calls'), 'utf8') : '';
ok(/test dsh-amp-radio@github:tonyous\/DSH-AMP-Radio#v2.5.0/.test(calls) && /apply \/tmp\/x/.test(calls) && installs.length === before, 'careful installer used: tested on a copy, then applied with backup', calls.trim().replace(/\n/g, ' | '));
ok(s.step === 'restarting', 'then DSH restarts when idle');

console.log(bad ? `\n${bad} FAILED` : '\nall update checks passed');
process.exit(bad ? 1 : 0);
