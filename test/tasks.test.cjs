// AMP Bar 2.1 task pills: logic test against the real client.js (not published: .agent/ is git-ignored).
//   node test/tasks.test.cjs
// Loads client.js through a fake DSH module loader with real React, captures what apply() registers, and renders the
// task pills to HTML for: DSH's todos, no list, a broken projection (throws), an odd shape, a running-over task,
// shared storage with dsh-task-timers, and a DSH without the composer dock slot.
const path = require('path');
const NM = path.join(process.env.HOME, '.local/share/deepseek-harness/tools/ui-design/node_modules');
const React = require(path.join(NM, 'react'));
const {renderToStaticMarkup} = require(path.join(NM, 'react-dom/server'));
let bad = 0; const ok = (c, l, x = '') => { console.log(c ? 'ok  ' : 'BAD ', l, x); if (!c) bad++; };

const store = new Map();
global.localStorage = {getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k)};
global.document = {hidden: false, querySelector: () => null, querySelectorAll: () => [], head: {appendChild() {}}, createElement: () => ({dataset: {}, remove() {}}), documentElement: {dataset: {}}, addEventListener() {}, removeEventListener() {}};
global.window = global; global.fetch = () => Promise.resolve({ok: false});
let factory;
global.window.__ModuleLoader__ = {load: m => { factory = m.factory; }};
require(path.resolve(__dirname, '../client.js'));
const mod = factory(n => n === 'react' ? React : n === 'react-dom' ? {createPortal: x => x} : {});
const registered = [];
const ctx = {effect() {}, slots: {inject: (name, fn) => fn(), register: (opts, comp) => registered.push({...opts, comp})}};
mod.apply(ctx);
const tasks = registered.find(r => r.id === 'amp-tasks');
ok(!!tasks && tasks.name === 'conversation.composer.dock', 'registered in the composer dock as amp-tasks');
const render = props => renderToStaticMarkup(React.createElement(tasks.comp, props));
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const list = [{content: 'Read files [~2m]', status: 'completed'}, {content: 'Write code [~5m]', status: 'in_progress'}, {content: 'Test it [~3m]', status: 'pending'}];
// a known start 60 s ago for the current task, and the first done in 2 min (as dsh-task-timers would have saved)
const now = Date.now();
store.set('dsh-task-timers:v1:S1', JSON.stringify({items: {'Read files [~2m]': {start: now - 180000, end: now - 60000}, 'Write code [~5m]': {start: now - 60000}}}));
let out = text(render({sessionId: 'S1', useProjection: k => k === 'todos' ? list : undefined}));
ok(/Task 2\/3 · 4:0\d left/.test(out), 'task pill: step and time left from Qwen\'s guess', out);
ok(/Finish ~\d+ min/.test(out), 'eta pill: whole list', out);
ok(JSON.parse(store.get('dsh-task-timers:v1:S1')).items['Write code [~5m]'].start === now - 60000, 'shares dsh-task-timers storage (start kept)');

ok(render({sessionId: 'S2', useProjection: () => []}) === '', 'no task list: no pills');
ok(render({sessionId: 'S3', useProjection: () => { throw new Error('projection renamed'); }}) === '', 'projection throws: no pills, no crash');
ok(render({sessionId: 'S4', useProjection: () => [{text: 'x', state: 1}]}) === '', 'odd shape from a future DSH: no pills');
ok(render({sessionId: 'S5'}) === '', 'no useProjection prop at all: no pills');

store.set('dsh-task-timers:v1:S6', JSON.stringify({items: {'Slow one [~1m]': {start: now - 300000}}}));
out = render({sessionId: 'S6', useProjection: () => [{content: 'Slow one [~1m]', status: 'in_progress'}]});
ok(/data-state="over"/.test(out) && /over \d+:\d\d/.test(text(out)), 'running over its guess: red "over" label', text(out));

out = text(render({sessionId: 'S7', useProjection: () => list.map(t => ({...t, status: 'completed'}))}));
ok(/Task 3\/3 · all done/.test(out) && !/Finish/.test(out), 'all done: no eta pill', out);

store.set('dsh-task-timers:v1:S8', '{not json');
ok(typeof render({sessionId: 'S8', useProjection: () => list}) === 'string', 'corrupt saved timings: still renders');

// compaction pauses the clock (2.1)
{
  const t0 = Date.now();
  const L = [{content: 'Build it [~10m]', status: 'in_progress'}];
  store.set('dsh-task-timers:v1:P', JSON.stringify({items: {'Build it [~10m]': {start: t0 - 120000}}}));          // 2 min in
  const since = t0 - 30000;                                                                                     // compacting for 30 s
  const proj = active => k => k === 'todos' ? L : k === 'ampCompaction' ? {active, since: active ? since : null} : undefined;
  let o = text(render({sessionId: 'P', useProjection: proj(true)}));
  ok(/paused · compacting/.test(o) && /Task 1\/1/.test(o), 'while compacting: pill says paused', o);
  ok(/data-state="paused"/.test(render({sessionId: 'P', useProjection: proj(true)})), 'while compacting: amber paused state');
  ok(/Finish ~8 min · paused/.test(o) || /Finish ~\d+ min · paused/.test(o), 'while compacting: time to finish frozen', o);
  o = text(render({sessionId: 'P', useProjection: proj(false)}));
  const st = JSON.parse(store.get('dsh-task-timers:v1:P')).items['Build it [~10m]'].start;
  ok(Math.abs(st - (t0 - 120000 + (Date.now() - since))) < 2000, 'after compacting: the paused time is taken off the task clock', (st - (t0 - 120000)) + ' ms moved');
  render({sessionId: 'P', useProjection: proj(true)});                     // a second tab saw the same pause...
  store.set('dsh-task-timers:v1:P:pause', JSON.stringify({since}));
  render({sessionId: 'P', useProjection: proj(false)});
  const st2 = JSON.parse(store.get('dsh-task-timers:v1:P')).items['Build it [~10m]'].start;
  ok(st2 === st, 'the same pause is never taken off twice (two tabs)');
  const hw = k => k === 'todos' ? L : k === 'hardwareCompactionStatus' ? {active: true, startedAt: Date.now() - 1000, failed: false} : undefined;
  ok(/paused · compacting/.test(text(render({sessionId: 'Q', useProjection: hw}))), 'fallback: the hardware-stats status also pauses it');
}

// a DSH without the dock slot: apply() must not throw
const ctx2 = {effect() {}, slots: {inject: () => { throw new Error('unknown slot'); }, register() {}}};
let threw = false; const warn = console.warn; console.warn = () => {};
try { mod.apply(ctx2); } catch { threw = true; }
console.warn = warn;
ok(!threw, 'DSH without the slots: plugin loads, nothing breaks');

console.log(bad ? `${bad} FAILURES` : 'all task-pill checks passed'); process.exit(bad ? 1 : 0);
