/** Host half of AMP Radio: the radio itself runs in the page (client.js).
 *  Since 2.0 it also serves the AMP Bar:
 *   GET/POST /api/amp-bar/settings  the stats-bar choices (Top/Bottom, which pills), saved in the DSH home so the
 *                                   phone and the PC share them
 *   GET      /api/amp-bar/stats     CPU, RAM and (NVIDIA only) GPU/VRAM, for setups without a hardware-stats plugin
 *  Every route is behind DSH's own login (connection.fetch). If that service is missing, the page falls back to
 *  this browser's saved settings and simply shows no AMP stats.
 */
import os from 'node:os';
import {execFile} from 'node:child_process';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {join, dirname} from 'node:path';

export const name = 'dsh-amp-radio';
export const inject = ['connection'];

const HOME = process.env.DSH_HOME || join(os.homedir(), '.dsh');
const SETTINGS = join(HOME, 'amp-radio', 'bar.json');
const KEYS = ['activity', 'usage', 'live', 'cpu', 'ram', 'gpu', 'vram', 'ramcache', 'effort', 'vision', 'context', 'compact', 'ring', 'amp'];

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

export function apply(ctx) {
  if (!ctx.connection?.fetch?.register) return;
  cpuPercent();
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/amp-bar/settings', methods: ['GET', 'POST'], requestBody: 'buffered',
    fetch: async request => {
      if (request.method === 'POST') {
        let body;
        try { body = JSON.parse(await request.text()); } catch { return json({error: 'Bad settings.'}, 400); }
        const value = clean(body);
        await mkdir(dirname(SETTINGS), {recursive: true});
        await writeFile(SETTINGS + '.tmp', JSON.stringify(value, null, 1));
        await rename(SETTINGS + '.tmp', SETTINGS);
        return json(value);
      }
      try { return json(clean(JSON.parse(await readFile(SETTINGS, 'utf8')))); } catch { return json(clean({})); }
    },
  }), 'amp-bar: settings route');
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/amp-bar/stats', methods: ['GET'], requestBody: 'buffered',
    fetch: async () => json({cpu: cpuPercent(), ram: await memory(), gpu: await gpu()}),
  }), 'amp-bar: stats route');
}
