// Chaos: the server half (index.js) on anyone's PC. Not published (runs on GitHub for every change).
//   node test/chaos-host.test.mjs
// Every route with junk, oversized, concurrent and hostile input; corrupt / missing / unwritable settings;
// no NVIDIA tools; Windows and macOS memory paths; an old DSH with no login service; a report flood.
import {mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x); if (!c) bad++; };

const home = mkdtempSync(join(tmpdir(), 'amp-chaos-'));
process.env.DSH_HOME = home;
process.env.PATH = '/nonexistent';                           // no nvidia-smi anywhere: a PC without NVIDIA
const mod = await import(new URL('../index.js', import.meta.url).href + '?t=' + Date.now());
const routes = {};
const ctx = {effect: fn => fn(), connection: {fetch: {register: r => { routes[r.path] = r; return () => {}; }}}};
mod.apply(ctx);
ok(['/api/amp-bar/settings', '/api/amp-bar/stats', '/api/amp-bar/report'].every(p => routes[p]), 'all three routes registered');
const call = async (path, method = 'GET', body) => {
  const r = await routes[path].fetch(new Request('http://x' + path, {method, body}));
  let j = null; try { j = await r.json(); } catch {}
  return {status: r.status, j};
};

// settings: junk in, clean out
let r = await call('/api/amp-bar/settings');
ok(r.status === 200 && r.j.position === 'top' && r.j.amp === 'bar', 'no settings file yet: defaults', JSON.stringify(r.j));
for (const [label, body] of [['not JSON', '{oops'], ['empty body', ''], ['a number', '42'], ['null', 'null'], ['array', '[1,2]'],
  ['huge 2 MB', JSON.stringify({position: 'x'.repeat(2e6)})], ['prototype attack', '{"__proto__":{"polluted":1},"off":{"__proto__":{"x":1}}}']]) {
  r = await call('/api/amp-bar/settings', 'POST', body);
  ok(r.status === 200 || r.status === 400, `POST ${label}: handled (${r.status})`);
}
ok(({}).polluted === undefined, 'no prototype pollution');
r = await call('/api/amp-bar/settings', 'POST', JSON.stringify({position: 'bottom', amp: 'float', off: {tasks: true, eta: true, evil: true, cpu: 'yes'}}));
ok(r.j.position === 'bottom' && r.j.amp === 'float' && r.j.off.tasks && r.j.off.eta && !('evil' in r.j.off) && !('cpu' in r.j.off), 'new switches kept, unknown and non-true dropped', JSON.stringify(r.j.off));
r = await call('/api/amp-bar/settings');
ok(r.j.off.tasks === true, 'saved and read back');

// 20 saves at once: file must stay valid JSON
await Promise.all([...Array(20)].map((_, i) => call('/api/amp-bar/settings', 'POST', JSON.stringify({position: i % 2 ? 'top' : 'bottom'}))));
let valid = true; try { JSON.parse(readFileSync(join(home, 'amp-radio', 'bar.json'), 'utf8')); } catch { valid = false; }
ok(valid, '20 saves at the same time: settings file still valid');

// corrupt file on disk
writeFileSync(join(home, 'amp-radio', 'bar.json'), '\u0000garbage{');
r = await call('/api/amp-bar/settings');
ok(r.status === 200 && r.j.position === 'top', 'corrupt settings file: defaults, no crash');

// stats with no NVIDIA tools
r = await call('/api/amp-bar/stats');
ok(r.status === 200 && r.j.gpu === null && r.j.ram && r.j.ram.total > 0, 'no nvidia-smi: stats without GPU, no crash', JSON.stringify({gpu: r.j.gpu, ram: !!r.j.ram}));

// reports: junk and flood
for (const body of ['{bad', '', JSON.stringify({where: 'x'.repeat(5000), message: 'y'.repeat(50000)})]) {
  r = await call('/api/amp-bar/report', 'POST', body); ok(r.status === 200 || r.status === 400, 'report with junk: handled (' + r.status + ')');
}
for (let i = 0; i < 400; i++) await call('/api/amp-bar/report', 'POST', JSON.stringify({where: 'flood', message: 'n' + i, version: '2.1.0'}));
const lines = readFileSync(join(home, 'amp-radio', 'problems.log'), 'utf8').trim().split('\n');
ok(lines.length === 200 && /n399/.test(lines.at(-1)), 'report flood: log kept to the newest 200 lines', lines.length + ' lines');
ok(statSync(join(home, 'amp-radio', 'problems.log')).size < 200 * 420, 'each report line is size-capped');

// unwritable settings folder (a locked-down PC)
chmodSync(join(home, 'amp-radio'), 0o500);
r = await call('/api/amp-bar/settings', 'POST', JSON.stringify({position: 'top'})).catch(e => ({status: 'threw', e}));
ok(r.status !== 'threw', 'settings folder read-only: answered, did not crash the server', String(r.status));
r = await call('/api/amp-bar/report', 'POST', JSON.stringify({where: 'x', message: 'y'})).catch(() => ({status: 'threw'}));
ok(r.status !== 'threw', 'report with read-only folder: answered');
chmodSync(join(home, 'amp-radio'), 0o700);

// Windows / macOS memory path
const real = process.platform;
for (const plat of ['win32', 'darwin']) {
  Object.defineProperty(process, 'platform', {value: plat});
  r = await call('/api/amp-bar/stats');
  ok(r.status === 200 && r.j.ram.total > 0, `${plat}: RAM from the portable path`);
}
Object.defineProperty(process, 'platform', {value: real});

// an old DSH without the login-protected fetch service: plugin must not throw
let threw = false; try { mod.apply({effect: fn => fn()}); mod.apply({effect: fn => fn(), connection: {}}); } catch { threw = true; }
ok(!threw, 'old DSH without connection.fetch: loads quietly');

// compaction status (2.1)
const {foldCompaction} = mod;
let st0 = {active: false, since: null};
st0 = foldCompaction(st0, {type: 'compaction/start', time: 1000}); ok(st0.active && st0.since === 1000, 'compaction start sets the pause');
st0 = foldCompaction(st0, {type: 'assistant/message'}); ok(st0.active, 'other events leave it');
st0 = foldCompaction(st0, {type: 'compaction/end', data: {}}); ok(!st0.active, 'compaction end clears it');
st0 = foldCompaction({active: true, since: 5}, {type: 'turn/end'}); ok(!st0.active, 'a stopped turn clears it');
ok(foldCompaction(st0, null) === st0, 'junk event: unchanged');
let regs = []; mod.apply({effect: fn => fn(), sessionProjections: {register: d => regs.push(d)}, connection: {fetch: {register: () => () => {}}}});
ok(regs.length === 1 && regs[0].key === 'ampCompaction' && regs[0].stateSchema.parse({active: true, since: 3}).since === 3, 'registers the ampCompaction status with a working validator');
let threwBad = false; try { regs[0].stateSchema.parse({x: 1}); } catch { threwBad = true; } ok(threwBad, 'validator rejects junk state');
let threw2 = false; try { mod.apply({effect: fn => fn(), sessionProjections: {register() { throw new Error('dup'); }}, connection: {fetch: {register: () => () => {}}}}); } catch { threw2 = true; }
ok(!threw2, 'a DSH that refuses the status: plugin still loads');

console.log(bad ? `${bad} FAILURES` : 'all server chaos checks passed'); process.exit(bad ? 1 : 0);
