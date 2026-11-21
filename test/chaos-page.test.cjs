// Chaos: the page half (client.js) on anyone's browser. Not published (runs on GitHub for every change).
//   node test/chaos-page.test.cjs
const path = require('path');
const NM = path.join(process.env.HOME, '.local/share/deepseek-harness/tools/ui-design/node_modules');
const React = require(path.join(NM, 'react'));
const {renderToStaticMarkup} = require(path.join(NM, 'react-dom/server'));
let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x); if (!c) bad++; };
const origWarn = console.warn; const warns = []; console.warn = (...a) => warns.push(a.join(' '));

function load({storage = 'ok', fetchMode = 'ok'} = {}) {
  const store = new Map();
  const ls = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)};
  const thrower = {getItem() { throw new Error('SecurityError: storage blocked'); }, setItem() { throw new Error('QuotaExceeded'); }, removeItem() { throw new Error('blocked'); }};
  Object.defineProperty(global, 'localStorage', {configurable: true, get() { if (storage === 'getter-throws') throw new Error('access denied'); return storage === 'throws' ? thrower : ls; }});
  global.document = {hidden: false, querySelector: () => null, querySelectorAll: () => [], head: {appendChild() {}}, createElement: () => ({dataset: {}, remove() {}}), documentElement: {dataset: {}}, addEventListener() {}, removeEventListener() {}};
  global.window = global;
  global.fetch = fetchMode === 'offline' ? () => Promise.reject(new TypeError('Failed to fetch')) : fetchMode === 'garbage' ? () => Promise.resolve({ok: true, json: async () => 'garbage'}) : () => Promise.resolve({ok: false});
  let factory; global.window.__ModuleLoader__ = {load: m => { factory = m.factory; }};
  require('vm').runInThisContext(require('fs').readFileSync(path.resolve(__dirname, '../client.js'), 'utf8'), {filename: 'client.js'});
  const mod = factory(n => n === 'react' ? React : n === 'react-dom' ? {createPortal: x => x} : {});
  const reg = []; mod.apply({effect() {}, slots: {inject: (n, fn) => fn(), register: (o, c) => reg.push({...o, c})}});
  return {store, reg, tasks: reg.find(r => r.id === 'amp-tasks').c, settings: reg.find(r => r.id === 'amp-bar').c};
}
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const R = (c, p) => { try { return renderToStaticMarkup(React.createElement(c, p)); } catch (e) { return 'THREW: ' + e.message; } };
const list = [{content: 'A [~2m]', status: 'completed'}, {content: 'B [~5m]', status: 'in_progress'}, {content: 'C', status: 'pending'}];

for (const storage of ['throws', 'getter-throws']) {
  let env; try { env = load({storage}); } catch (e) { ok(false, `storage ${storage}: plugin loads`, e.message); continue; }
  const out = R(env.tasks, {sessionId: 'S', useProjection: () => list});
  ok(!out.startsWith('THREW') && /Task 2\/3/.test(text(out)), `browser storage ${storage} (private mode / locked down): pills still render`, text(out));
}
for (const fetchMode of ['offline', 'garbage']) {
  let env, threw = false; try { env = load({fetchMode}); } catch { threw = true; }
  ok(!threw && !R(env.tasks, {sessionId: 'S', useProjection: () => list}).startsWith('THREW'), `network ${fetchMode}: loads and renders`);
}

const env = load();
const big = [...Array(300)].map((_, i) => ({content: `Task number ${i} ` + 'x'.repeat(i === 7 ? 5000 : 10), status: i < 120 ? 'completed' : i === 120 ? 'in_progress' : 'pending'}));
let out = R(env.tasks, {sessionId: 'BIG', useProjection: () => big});
ok(/Task 121\/300/.test(text(out)) && out.length < 2000, '300 tasks with a 5,000-character name: short pill, no overflow', out.length + ' chars of HTML');
ok(env.store.get('dsh-task-timers:v1:BIG').length < 200000, 'saved timings stay small with 300 tasks');

out = R(env.tasks, {sessionId: 'U', useProjection: () => [{content: 'مرحبا 🎵 日本語 [~3m]', status: 'in_progress'}, {content: '<script>alert(1)</script>', status: 'pending'}]});
ok(/Task 1\/2/.test(text(out)) && !out.includes('<script>'), 'emoji, Arabic, Japanese and HTML in task names: shown safely');

out = R(env.tasks, {sessionId: 'D', useProjection: () => [{content: 'same', status: 'completed'}, {content: 'same', status: 'in_progress'}]});
ok(!out.startsWith('THREW'), 'duplicate task names: no crash', text(out));
out = R(env.tasks, {sessionId: 'X', useProjection: () => [{content: 'a', status: 'weird'}, {content: 'b', status: 'in_progress'}]});
ok(!out.startsWith('THREW') && /Task/.test(text(out)), 'unknown task status from a future DSH: no crash', text(out));
env.store.set('dsh-task-timers:v1:F', JSON.stringify({items: {'B [~5m]': {start: Date.now() + 3600000}}}));
out = R(env.tasks, {sessionId: 'F', useProjection: () => list});
ok(!out.startsWith('THREW') && !/NaN|-\d/.test(text(out)), 'clock changed (start in the future): no negative or NaN times', text(out));
out = R(env.tasks, {useProjection: () => list});
ok(!out.startsWith('THREW') && /Task 2\/3/.test(text(out)), 'no session id: counts shown, nothing saved', text(out));
env.store.set('dsh-task-timers:v1:history', JSON.stringify([null, 'x', {ms: -5}, {ms: 1e15}, 42]));
out = R(env.tasks, {sessionId: 'H', useProjection: () => list});
ok(!out.startsWith('THREW') && !/NaN|Infinity/.test(text(out)), 'junk in the shared history: no NaN or Infinity', text(out));

out = R(env.settings, {});
ok(/Task timer/.test(out) && /Time to finish/.test(out) && (out.match(/role="switch"/g) || []).length >= 16, 'settings list has the two new switches (16 in all)');

// the DSH parts self-check: a DSH update that renamed the stats row and the header
{
  const e2 = load(); const sent = [];
  global.fetch = (u, o) => { if (String(u).includes('/report')) sent.push(JSON.parse(o.body)); return Promise.resolve({ok: true}); };
  global.document.querySelector = sel => sel === '[data-composer-card]' ? {} : null;   // message box only
  const mod2 = (() => { let f; global.window.__ModuleLoader__ = {load: m => { f = m.factory; }};
    require('vm').runInThisContext(require('fs').readFileSync(path.resolve(__dirname, '../client.js'), 'utf8'));
    return f(n => n === 'react' ? React : n === 'react-dom' ? {createPortal: x => x} : {}); })();
  mod2.__test.checkDshParts(); mod2.__test.checkDshParts();
  const miss = mod2.__test.getDshMissing();
  ok(miss.length === 3 && miss.includes('chat header buttons (Top position)'), 'self-check: renamed DSH parts are named', miss.join(' | '));
  ok(sent.filter(x => x.where === 'dsh changed').length === 3, 'self-check: each reported once, not every minute', sent.length + ' reports');
  global.document.querySelector = () => null;
  mod2.__test.checkDshParts();
  ok(mod2.__test.getDshMissing().length === 3, 'self-check: not on a chat page = no new judgement');
}
console.warn = origWarn;
console.log(`(${warns.length} warnings logged by the plugin, as designed)`);
console.log(bad ? `${bad} FAILURES` : 'all page chaos checks passed'); process.exit(bad ? 1 : 0);
