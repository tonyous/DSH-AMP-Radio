/** Host half of AMP Radio: the radio itself runs in the page (client.js).
 *  Since 2.0 it also serves the AMP Bar:
 *   GET/POST /api/amp-bar/settings  the stats-bar choices (Top/Bottom, which pills), saved in the DSH home so the
 *                                   phone and the PC share them
 *   GET      /api/amp-bar/stats     CPU, RAM and (NVIDIA only) GPU/VRAM, for setups without a hardware-stats plugin
 *   projection ampCompaction       (2.1) is DSH compacting this chat now (for pausing the task timer)
 *   POST     /api/amp-bar/report    (2.1) a problem the page hit (e.g. the task pills lost their data source after a DSH
 *                                   update), kept in DSH_HOME/amp-radio/problems.log, newest 200 lines
 *  Every route is behind DSH's own login (connection.fetch). If that service is missing, the page falls back to
 *  this browser's saved settings and simply shows no AMP stats.
 */
import os from 'node:os';
import {execFile} from 'node:child_process';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {join, dirname} from 'node:path';

export const name = 'dsh-amp-radio';
export const inject = ['connection', 'sessionProjections'];

const HOME = process.env.DSH_HOME || join(os.homedir(), '.dsh');
const SETTINGS = join(HOME, 'amp-radio', 'bar.json');
const KEYS = ['activity', 'usage', 'live', 'cpu', 'ram', 'gpu', 'vram', 'ramcache', 'effort', 'vision', 'context', 'compact', 'ring', 'tasks', 'eta', 'amp'];
const PROBLEMS = join(HOME, 'amp-radio', 'problems.log');

function clean(input) {
  const out = {position: input?.position === 'bottom' ? 'bottom' : 'top', amp: input?.amp === 'float' ? 'float' : 'bar', off: {}};
  for (const k of KEYS) if (input?.off?.[k] === true) out.off[k] = true;
  return out;
}

let lastCpu = null;
function cpuPercent() {
  const now = os.cpus().reduce((acc, c) => {
    const t = c.times; acc.idle += t.idle; acc.total += t.user + t.nice + t.sys + t.idle + t.irq; return acc;
  }, {idle: 0, total: 0});
  const prev = lastCpu; lastCpu = now;
  if (!prev || now.total <= prev.total) return null;
  return Math.max(0, Math.min(100, 100 * (1 - (now.idle - prev.idle) / (now.total - prev.total))));
}

async function memory() {
  if (process.platform === 'linux') {
    try {
      const text = await readFile('/proc/meminfo', 'utf8');
      const kb = k => Number((text.match(new RegExp('^' + k + ':\\s+(\\d+)', 'm')) || [])[1]) * 1024;
      const total = kb('MemTotal'), avail = kb('MemAvailable');
      if (total > 0 && Number.isFinite(avail)) return {total, used: total - avail};
    } catch {}
  }
  return {total: os.totalmem(), used: os.totalmem() - os.freemem()};
}

let gpuMissing = false, gpuCache = null, gpuAt = 0;
function gpu() {
  if (gpuMissing) return Promise.resolve(null);
  if (Date.now() - gpuAt < 2000) return Promise.resolve(gpuCache);
  return new Promise(resolve => {
    execFile('nvidia-smi', ['--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'],
      {timeout: 2500, windowsHide: true}, (err, stdout) => {
        gpuAt = Date.now();
        if (err) { if (err.code === 'ENOENT') gpuMissing = true; gpuCache = null; return resolve(null); }
        const [util, temp, used, total] = stdout.trim().split('\n')[0].split(',').map(x => Number(x.trim()));
        gpuCache = Number.isFinite(total) && total > 0 ? {util, temp: Number.isFinite(temp) ? temp : null, used: used * 1048576, total: total * 1048576} : null;
        resolve(gpuCache);
      });
  });
}

const json = (body, status = 200) => Response.json(body, {status, headers: {'cache-control': 'no-store'}});

// 2.1: writes go one at a time, each through its own temp file (two saves at once used to share one .tmp and crash
// with ENOENT: found by the chaos test, 21 Nov 2026). A failed write answers 500 and never takes the server down.
let writing = Promise.resolve();
function writeAtomic(file, text) {
  const run = writing.then(async () => {
    await mkdir(dirname(file), {recursive: true});
    const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, file);
  });
  writing = run.catch(() => {});
  return run;
}

// 2.1: whether DSH is compacting this chat right now, from its own session events. The page pauses the task timer
// meanwhile. A plain validator (no zod: other DSH installs may not have it where a plugin can import it).
const compactSchema = {parse(v) {
  if (!v || typeof v !== 'object' || typeof v.active !== 'boolean') throw new Error('bad compaction state');
  return {active: v.active, since: Number.isFinite(v.since) ? v.since : null};
}};
export function foldCompaction(state, event) {
  if (event?.type === 'compaction/start') return {active: true, since: Number.isFinite(event.time) ? event.time : Date.now()};
  if (event?.type === 'compaction/end' || event?.type === 'turn/end') return {active: false, since: null};
  return state;
}

export function apply(ctx) {
  try {
    ctx.sessionProjections?.register?.({key: 'ampCompaction', stateSchema: compactSchema, init: () => ({active: false, since: null}),
      apply: foldCompaction, wire: {viewSchema: compactSchema, view: state => state}, stateVersion: 1});
  } catch (e) { console.warn('[amp-bar] compaction status unavailable:', e?.message || e); }
  if (!ctx.connection?.fetch?.register) return;
  cpuPercent();
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/amp-bar/settings', methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: async request => {
      if (request.method === 'POST') {
        let body;
        try { body = JSON.parse(await request.text()); } catch { return json({error: 'Bad settings.'}, 400); }
        const value = clean(body);
        try { await writeAtomic(SETTINGS, JSON.stringify(value, null, 1)); }
        catch { return json({...value, saved: false, error: 'Could not save on this PC; kept in this browser.'}, 500); }
        return json(value);
      }
      try { return json(clean(JSON.parse(await readFile(SETTINGS, 'utf8')))); } catch { return json(clean({})); }
    },
  }), 'amp-bar: settings route');
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/amp-bar/report', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const b = JSON.parse((await request.text()).slice(0, 2000));
        const line = [new Date().toISOString(), String(b.version || '?').slice(0, 12), String(b.where || '?').slice(0, 60),
          String(b.message || '').replace(/\s+/g, ' ').slice(0, 300)].join(' | ');
        const add = writing.then(async () => {
          let old = ''; try { old = await readFile(PROBLEMS, 'utf8'); } catch {}
          return (old + line + '\n').split('\n').filter(Boolean).slice(-200).join('\n') + '\n';
        });
        await writeAtomic(PROBLEMS, await add);
        return json({ok: true});
      } catch { return json({ok: false}, 400); }
    },
  }), 'amp-bar: problem reports');
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/amp-bar/stats', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => json({cpu: cpuPercent(), ram: await memory(), gpu: await gpu()}),
  }), 'amp-bar: stats route');
  applyBorrow(ctx);
}

// 2.2: Borrow my AI. Its code loads on first use (or at start when sharing / borrowing was on), inside its own try, so a
// fault there can never stop the radio, the bar or DSH.
const BORROW_PATHS = ['status', 'share', 'stop', 'release', 'invite', 'friends', 'remove', 'settings', 'join', 'done', 'leave'];
function applyBorrow(ctx) {
  let made = null, borrow = null;
  const get = () => (made ??= import('./borrow/host.mjs').then(m => (borrow = m.createBorrow({ctx, home: HOME,
    report: (where, e) => reportProblem('borrow', where + ': ' + String(e?.message || e)).catch(() => {})}))));
  for (const p of BORROW_PATHS) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/amp-borrow/' + p, methods: p === 'status' || p === 'friends' ? ['GET'] : ['POST'], requestBody: 'buffered',
      fetch: async request => {
        try { return await (await get()).routes['/api/amp-borrow/' + p](request); }
        catch (e) { reportProblem('borrow', p + ': ' + String(e?.message || e)).catch(() => {}); return json({error: 'Borrow my AI had a problem. Try again.'}, 500); }
      },
    }), 'amp-borrow: ' + p);
  }
  ctx.effect(() => {
    // start at once only if it was in use: sharing was on (comes back after a restart) or this PC borrows from a friend
    let on = false;
    try { on = JSON.parse(readFileSync(join(HOME, 'amp-radio', 'borrow', 'settings.json'), 'utf8')).sharing === true; } catch {}
    try { readFileSync(join(HOME, 'amp-radio', 'borrow', 'friend.json')); on = true; } catch {}
    if (on) get().catch(e => console.warn('[amp-borrow] start:', e?.message || e));
    return () => { Promise.resolve(borrow?.dispose()).catch(() => {}); };
  }, 'amp-borrow: start and stop with DSH');
}
async function reportProblem(where, message) {
  const line = [new Date().toISOString(), 'borrow', String(where).slice(0, 60), String(message).replace(/\s+/g, ' ').slice(0, 300)].join(' | ');
  const add = writing.then(async () => {
    let old = ''; try { old = await readFile(PROBLEMS, 'utf8'); } catch {}
    return (old + line + '\n').split('\n').filter(Boolean).slice(-200).join('\n') + '\n';
  });
  await writeAtomic(PROBLEMS, await add);
}
