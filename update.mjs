// AMP keeps itself up to date (owner, 22 Nov 2026: "Yes, build it"), through DSH's own plugin manager, the same path the
// Plugins page uses (compatibility check, pnpm, undo on a failed install). Never at a bad moment:
//   - not while a friend is borrowing this PC's AI or this PC is borrowing one (Borrow my AI)
//   - not while any DSH chat is running, not during a game
// Only release tags of this one repository (vX.Y.Z), only newer than the running version, at most one try per version.
// When DSH needs a restart to finish: this PC's idle-restart helper if it has one, else one line in the AMP panel.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPO = 'tonyous/DSH-AMP-Radio';
const HERE = dirname(fileURLToPath(import.meta.url));

export function semver(v) { const m = String(v || '').match(/^v?(\d+)\.(\d+)\.(\d+)$/); return m ? m.slice(1).map(Number) : null; }
export function newer(a, b) { const x = semver(a), y = semver(b); if (!x || !y) return false; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }
export function newestTag(tags) {
  return (Array.isArray(tags) ? tags : []).map(t => t?.name).filter(n => /^v\d+\.\d+\.\d+$/.test(n || ''))
    .reduce((best, n) => (!best || newer(n, best) ? n : best), null);
}

export function createUpdater({ctx, home, version, fetchImpl = globalThis.fetch, borrowState = () => null, isGaming = () => false,
  report = () => {}, checkEveryMs = 6 * 3600_000, firstCheckMs = 120_000, quietMs = 15 * 60_000, restartHelper = process.env.AMP_RESTART_HELPER || join(process.env.HOME || '', '.local/bin/dsh-restart-when-idle'),
  safeInstaller = join(home, 'skills', 'dsh-plugin-update', 'scripts', 'plugin_update.py'), now = Date.now} = {}) {
  const stateFile = join(home, 'amp-radio', 'update.json');
  const read = () => { try { return JSON.parse(readFileSync(stateFile, 'utf8')); } catch { return {}; } };
  const write = v => { try { mkdirSync(dirname(stateFile), {recursive: true}); writeFileSync(stateFile, JSON.stringify(v, null, 1)); } catch {} };
  const svc = n => { try { return ctx.get?.(n) ?? ctx[n] ?? null; } catch { return null; } };
  const state = {running: version, latest: null, step: 'idle', note: null};

  function busy() {
    const b = borrowState();
    if (b?.host?.lock || b?.host?.live?.turn || b?.host?.live?.connected?.length) return 'a friend is using your AI';
    if (b?.friend?.state?.turn === 'yours') return "you are using a friend's AI";
    try { if ((svc('agents')?.list?.() || []).some(a => a.status && a.status !== 'idle')) return 'a chat is running'; } catch {}
    if (isGaming()) return 'a game is running';
    // the gate's own log: any friend message in the last 15 minutes counts as busy
    try {
      const lines = readFileSync(join(home, 'amp-radio', 'borrow', 'gate', 'audit.log'), 'utf8').trim().split('\n').slice(-20);
      const last = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(r => r && (r.event === 'reply' || r.event === 'turn start')).pop();
      if (last && now() - Date.parse(last.t) < quietMs) return 'a friend used your AI in the last 15 minutes';
    } catch {}
    return null;
  }

  const run = (args, timeout) => new Promise(resolve => {
    const p = spawn('python3', args, {stdio: ['ignore', 'pipe', 'pipe']}); let out = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; });
    const t = setTimeout(() => p.kill(), timeout);
    p.on('exit', code => { clearTimeout(t); resolve({code, out}); }); p.on('error', () => { clearTimeout(t); resolve({code: -1, out}); });
  });
  async function viaSafeInstaller(spec) {
    const t = await run([safeInstaller, 'test', spec, '--owner-asked', 'AMP auto update (owner, 22 Nov 2026: "Yes, build it")'], 15 * 60_000);
    const dir = (t.out.match(/apply with: plugin_update\.py apply (\S+)/) || [])[1];
    if (!dir) return {application: 'failed', error: {message: 'test on a copy failed: ' + t.out.slice(-200)}};
    const a = await run([safeInstaller, 'apply', dir], 15 * 60_000);
    return /APPLIED/.test(a.out) ? {application: 'restart-required'} : {application: 'failed', error: {message: 'apply: ' + a.out.slice(-200)}};
  }
  async function check() {
    const pm = svc('pluginManager');
    if (!pm?.installBundle && !(safeInstaller && existsSync(safeInstaller))) { state.step = 'unavailable'; return state; }
    let tags;
    try {
      const r = await fetchImpl(`https://api.github.com/repos/${REPO}/tags?per_page=50`, {headers: {accept: 'application/vnd.github+json', 'user-agent': 'dsh-amp-radio'}, signal: AbortSignal.timeout(15_000)});
      if (!r.ok) throw new Error('github ' + r.status);
      tags = await r.json();
    } catch (e) { state.step = 'offline'; return state; }
    const latest = newestTag(tags); state.latest = latest;
    if (!latest || !newer(latest, version)) { state.step = 'current'; return state; }
    const saved = read();
    if (saved.tried === latest && saved.result === 'failed' && now() - (saved.at || 0) < 24 * 3600_000) { state.step = 'waiting-retry'; return state; }
    const why = busy();
    if (why) { state.step = 'waiting'; state.note = why; return state; }
    state.step = 'installing';
    let res;
    // A PC with its own careful plugin installer (test on a copy, backup, automatic rollback, DSH core untouched) uses
    // it; every other DSH uses its plugin manager, the same path as the Plugins page.
    if (safeInstaller && existsSync(safeInstaller)) res = await viaSafeInstaller(`dsh-amp-radio@github:${REPO}#${latest}`);
    else {
      try { res = await pm.installBundle(`github:${REPO}#${latest}`, {requestId: 'amp-auto-update-' + latest}); }
      catch (e) { res = {application: 'failed', error: {message: String(e?.message || e)}}; }
    }
    const ok = res?.application === 'applied' || res?.application === 'restart-required';
    write({tried: latest, result: ok ? res.application : 'failed', at: now()});
    report('auto update', `${version} -> ${latest}: ${res?.application}${res?.error ? ' ' + String(res.error.message || res.error.code || '').slice(0, 160) : ''}`);
    if (!ok) { state.step = 'failed'; return state; }
    if (res.application === 'restart-required') {
      if (existsSync(restartHelper)) {                      // restarts DSH only once nothing is running
        try { spawn(restartHelper, [], {detached: true, stdio: 'ignore'}).unref(); state.step = 'restarting'; } catch { state.step = 'restart'; }
      } else state.step = 'restart';
    } else state.step = 'done';
    return state;
  }

  let t = setTimeout(function run() { check().catch(e => report('auto update', e)).finally(() => { t = setTimeout(run, checkEveryMs); t.unref?.(); }); }, firstCheckMs);
  t.unref?.();
  return {check, state: () => ({...state}), stop() { clearTimeout(t); }};
}
