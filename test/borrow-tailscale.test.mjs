// The Tailscale layer: recorded outputs for every case, a pretend `tailscale` for Windows/macOS/Linux paths and for the
// door, and (only with --live) read-only questions to the real Tailscale on this PC. Never opens a real door.
//   node test/borrow-tailscale.test.mjs [--live]
import {EventEmitter} from 'node:events';
import {readStatus, readPing, pathWords, setupStep, serveProblem, servePorts, freeDoorPort, versionAtLeast, createTailscale, cityOf} from '../borrow/tailscale.mjs';

let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x === '' ? '' : String(x).slice(0, 160)); if (!c) bad++; };
const now = Date.parse('2026-11-22T12:00:00Z');
const status = (o = {}) => JSON.stringify({BackendState: 'Running', Version: '1.104.7-t', AuthURL: '', CertDomains: ['pc.tail1.ts.net'],
  Self: {DNSName: 'pc.tail1.ts.net.', TailscaleIPs: ['100.64.0.1'], KeyExpiry: '2027-03-13T00:00:00Z', OS: 'linux'},
  User: {'7': {LoginName: 'friend@example.com'}},
  Peer: {a: {DNSName: 'friend-pc.tail2.ts.net.', HostName: 'friend-pc', OS: 'windows', Online: true, ShareeNode: true, UserID: 7, Relay: 'fra', CurAddr: ''},
    b: {DNSName: 'box.tail1.ts.net.', OS: 'linux', Online: true, Relay: 'syd', CurAddr: '203.0.113.5:41641'}}, ...o});

let st = readStatus(status());
ok(st.state === 'Running' && st.name === 'pc.tail1.ts.net' && st.https, 'status: running, this PC\'s name, secure addresses on');
ok(st.peers[0].login === 'friend@example.com' && st.peers[0].sharee && st.peers[0].path.kind === 'relay', 'a friend\'s PC: who it is and that it is relayed');
ok(st.peers[1].path.kind === 'direct', 'a peer with a direct address: direct');
ok(readStatus('not json') === null, 'junk from tailscale: no crash');
ok(setupStep(st, now).step === 'ready' && !setupStep(st, now).warn, 'ready, key far away: nothing to do');
ok(setupStep(null).step === 'missing' && /Install Tailscale/.test(setupStep(null).say), 'not installed: plain message');
ok(setupStep(readStatus(status({Version: '1.60.0'})), now).step === 'old', 'too old: update first');
ok(setupStep(readStatus(status({BackendState: 'Stopped'})), now).step === 'stopped', 'not running: open it');
const login = setupStep(readStatus(status({BackendState: 'NeedsLogin', AuthURL: 'https://login.tailscale.com/a/abc123'})), now);
ok(login.step === 'login' && login.url === 'https://login.tailscale.com/a/abc123', 'not signed in: the sign-in page to open', login.url);
ok(setupStep(readStatus(status({BackendState: 'NeedsMachineAuth'})), now).step === 'machine-auth', 'account must approve the PC');
ok(setupStep(readStatus(status({Self: {DNSName: 'x.', KeyExpiry: '2026-11-01T00:00:00Z'}})), now).step === 'expired', 'key expired: sign in again');
const soon = setupStep(readStatus(status({Self: {DNSName: 'x.', KeyExpiry: '2026-11-30T00:00:00Z'}})), now);
ok(soon.step === 'ready' && /7 days/.test(soon.warn), 'key expires within 14 days: a warning ahead', soon.warn);
ok(setupStep(readStatus(status({Health: ['Unable to connect to the Tailscale coordination server to synchronize the state of your tailnet.']})), now).step === 'network', 'a network that blocks Tailscale: "try another network", keeps checking');
ok(versionAtLeast('1.104.7') && versionAtLeast('1.86.0') && !versionAtLeast('1.85.9') && !versionAtLeast('garbage'), 'version compare');

// ping, in the exact forms Tailscale prints (the first one recorded on the owner's PC, 22 Nov 2026)
let p = readPing('pong from dsh-cloud (100.81.28.102) via DERP(nyc) in 967ms\ndirect connection not established');
ok(p?.ms === 967 && p.kind === 'relay' && pathWords(p) === 'Relayed via New York', 'ping relayed: "Relayed via New York · 967 ms"', JSON.stringify(p));
p = readPing('pong from box (100.64.0.2) via 203.0.113.5:41641 in 23ms');
ok(p?.ms === 23 && pathWords(p) === 'Direct', 'ping direct');
p = readPing('pong from box (100.64.0.2) via [2001:db8::1]:41641 in 31ms');
ok(p?.kind === 'direct', 'ping direct over IPv6');
p = readPing('pong from box (100.64.0.2) via peer-relay(198.51.100.167:7777:vni:7) in 35ms');
ok(p?.kind === 'peer-relay' && pathWords(p) === 'Relayed by a peer', 'ping through a peer relay');
ok(readPing('timeout waiting for pong') === null, 'no answer: no number, no crash');
ok(cityOf('zzz') === 'ZZZ', 'an unknown relay city shows its code');

// serve
ok(JSON.stringify(servePorts('{"TCP":{"443":{"HTTPS":true},"8443":{"HTTPS":true},"8444":{"HTTPS":true}}}')) === '[443,8443,8444]', 'the owner\'s three doors read back');
ok(freeDoorPort([443, 8443, 8444]) === 8445 && freeDoorPort([8445, 8446]) === 8447, 'a free door port, never one in use');
ok(serveProblem('Access denied: serve config denied. Use \'sudo tailscale serve\' or set an operator').problem === 'operator', 'no permission: the one admin step');
const h = serveProblem('Serve is not enabled on your tailnet.\nTo enable, visit:\n\n         https://login.tailscale.com/f/serve?node=nABC');
ok(h.problem === 'https' && h.url.startsWith('https://login.tailscale.com/f/serve'), 'secure addresses off: the page to turn them on', h.url);
ok(serveProblem('something odd').problem === 'failed', 'anything else: "try again"');

// finding the command on each system (pretend runner)
for (const [platform, path] of [['win32', 'C:\\Program Files\\Tailscale\\tailscale.exe'], ['darwin', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'], ['linux', '/usr/bin/tailscale']]) {
  const t = createTailscale({platform, run: async (file) => (file === path ? {code: 0, stdout: '1.104.7', stderr: ''} : {code: -1, missing: true, stdout: '', stderr: ''})});
  ok(await t.find() === path, `${platform}: finds tailscale where its installer puts it`);
}
const none = createTailscale({platform: 'linux', run: async () => ({code: -1, missing: true, stdout: '', stderr: ''})});
ok(await none.find() === null && await none.status() === null, 'not installed anywhere: null, no crash');

// the door, with a pretend tailscale
const fakeTs = () => {
  const doors = new Set(); const calls = [];
  const run = async (file, args) => {
    calls.push(args.join(' '));
    if (args[0] === 'version') return {code: 0, stdout: '1.104.7', stderr: ''};
    if (args[0] === 'serve' && args[1] === 'status') return {code: 0, stdout: JSON.stringify({TCP: Object.fromEntries([...doors].map(p => [p, {HTTPS: true}]))}), stderr: ''};
    if (args[0] === 'serve' && args[2] === 'off') { doors.delete(Number(args[1].split('=')[1])); return {code: 0, stdout: '', stderr: ''}; }
    return {code: 0, stdout: '', stderr: ''};
  };
  const spawnImpl = (file, args, mode = 'ok') => {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.exitCode = null;
    const port = Number(args[1].split('=')[1]);
    child.kill = () => { if (child.exitCode !== null) return; child.exitCode = 0; doors.delete(port); setTimeout(() => child.emit('exit', 0), 10); };
    setTimeout(() => {
      if (spawnImpl.mode === 'denied') { child.stderr.emit('data', 'Access denied: serve config denied'); child.exitCode = 1; child.emit('exit', 1); }
      else if (spawnImpl.mode === 'leaves') { doors.add(port); child.kill = () => { child.exitCode = 0; setTimeout(() => child.emit('exit', 0), 10); }; }
      else if (spawnImpl.mode === 'foreground') child.stdout.emit('data', `Available within your tailnet:\n\nhttps://pc.t.ts.net:${port}/\n|-- proxy http://127.0.0.1:5555\n\nPress Ctrl+C to exit.\n`);
      else doors.add(port);
    }, 50);
    return child;
  };
  return {doors, calls, run, spawnImpl};
};
let f = fakeTs();
let t = createTailscale({platform: 'linux', run: f.run, spawnImpl: f.spawnImpl});
f.doors.add(443); f.doors.add(8443); f.doors.add(8444);
let opened = await t.openDoor({port: 8445, target: 'http://127.0.0.1:5555'});
ok(opened.ok && f.doors.has(8445), 'door opens on its own port');
let closed = await t.closeDoor();
ok(closed.closed && !f.doors.has(8445), 'door closes and Tailscale confirms it is gone');
ok([443, 8443, 8444].every(p => f.doors.has(p)) && !f.calls.some(c => /reset/.test(c)), 'the owner\'s other doors are never touched, no "serve reset"');
f.spawnImpl.mode = 'denied';
opened = await t.openDoor({port: 8445, target: 'http://127.0.0.1:5555'});
ok(!opened.ok && opened.problem === 'operator' && /password/.test(opened.say), 'no permission: the admin step is asked for, nothing opened');
ok(t.operatorCommand().startsWith('sudo tailscale set --operator='), 'the one admin command', t.operatorCommand());
f.spawnImpl.mode = 'leaves';
opened = await t.openDoor({port: 8446, target: 'http://127.0.0.1:5555'});
closed = await t.closeDoor();
ok(closed.closed && !f.doors.has(8446), 'a door left behind by tailscale: turned off by its port, then confirmed gone');
f.spawnImpl.mode = 'foreground';
opened = await t.openDoor({port: 8448, target: 'http://127.0.0.1:5555'});
ok(opened.ok && !f.doors.has(8448), 'a foreground door (not in the saved list, as on Tailscale 1.104) is seen as open from its own words');
await t.closeDoor();
f.spawnImpl.mode = 'ok'; f.doors.add(8447);
opened = await t.openDoor({port: 8447, target: 'http://127.0.0.1:5555'});
ok(opened.ok && f.calls.includes('serve --https=8447 off'), 'a leftover door of ours from a crash is cleared before opening');
await t.closeDoor();

// read-only questions to the real Tailscale on this PC
if (process.argv.includes('--live')) {
  const real = createTailscale();
  const where = await real.find();
  ok(!!where, 'this PC: tailscale found', where);
  const s = await real.status();
  ok(s && s.state === 'Running' && s.name.endsWith('.ts.net'), 'this PC: running and signed in', s?.state);
  ok(setupStep(s).step === 'ready', 'this PC: nothing to set up', JSON.stringify(setupStep(s)));
  const ports = await real.doorPorts();
  ok(Array.isArray(ports), 'this PC: doors in use read back', ports.join(','));
  ok(freeDoorPort(ports) !== null && !ports.includes(freeDoorPort(ports)), 'this PC: a free door port for AMP', freeDoorPort(ports));
  const peer = s.peers.find(x => x.online && x.name.startsWith('dsh-cloud'));
  if (peer) { const pg = await real.ping(peer.ips[0]); ok(pg && pg.ms > 0, 'this PC: ping to its own cloud box', pg ? `${pathWords(pg)} · ${pg.ms} ms` : 'none'); }
}

console.log(bad ? `\n${bad} FAILED` : '\nall tailscale checks passed');
process.exit(bad ? 1 : 0);
