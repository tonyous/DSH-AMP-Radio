// Borrow my AI: everything the plugin asks Tailscale, through Tailscale's own command line. No packages, no root.
//  find()          where the tailscale command is on Windows, macOS or Linux
//  status()        installed? running? signed in? key expiry, this PC's Tailscale name, the peers and their path
//  setupStep()     the one next thing a person has to do, in plain words, or 'ready'
//  ping(ip)        one Tailscale ping: milliseconds and direct / relayed via <city> / peer relay
//  openDoor()      `tailscale serve` in the FOREGROUND for one port, owned by the plugin: the door exists only while
//                  that process lives, so it can never outlive DSH. It never touches the other doors on this PC.
//  closeDoor()     ends it, then checks the port is gone and turns off only that port if anything was left
import {execFile, spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import https from 'node:https';

// A knock on a fresh connection (never a pooled one, which can outlive the door): true when anything answers.
export function knock(url, timeout = 3000) {
  return new Promise(resolve => {
    let u; try { u = new URL(url); } catch { return resolve(false); }
    const req = https.request(u, {agent: false, method: 'GET', timeout, headers: {connection: 'close'}}, res => { res.resume(); resolve(true); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export const MIN_VERSION = '1.86.0';          // peer relays and today's serve flags
export const DOOR_PORTS = [8445, 8446, 8447, 10443, 9443];
export const TS_SAY = Object.freeze({
  missing: "Install Tailscale from the page that just opened.",
  old: 'Update Tailscale from the page that just opened.',
  stopped: 'Open Tailscale.',
  login: 'Sign in to Tailscale in the page that just opened.',
  machineAuth: 'Approve this PC in the Tailscale page that just opened.',
  expired: 'Sign in to Tailscale again in the page that just opened.',
  expiringSoon: days => `Tailscale will ask you to sign in again in ${days} day${days === 1 ? '' : 's'}.`,
  operator: 'Type your password in the window that opened.',
  https: 'Press Enable in the Tailscale page that just opened.',
  doorFailed: 'Turn sharing off and on again.',
  noNetwork: 'This network blocks Tailscale. Try another Wi-Fi or a phone hotspot.',
});

const CANDIDATES = {
  linux: ['/usr/bin/tailscale', '/usr/local/bin/tailscale', '/usr/sbin/tailscale', '/snap/bin/tailscale'],
  darwin: ['/Applications/Tailscale.app/Contents/MacOS/Tailscale', '/usr/local/bin/tailscale', '/opt/homebrew/bin/tailscale'],
  win32: ['C:\\Program Files\\Tailscale\\tailscale.exe', 'C:\\Program Files (x86)\\Tailscale\\tailscale.exe'],
};

export function versionAtLeast(v, min = MIN_VERSION) {
  const a = String(v || '').match(/(\d+)\.(\d+)\.(\d+)/), b = min.split('.').map(Number);
  if (!a) return false;
  for (let i = 0; i < 3; i++) { const x = Number(a[i + 1]); if (x !== b[i]) return x > b[i]; }
  return true;
}

// ---- pure readers (tested with recorded outputs) ------------------------------------------------------------------------
export function readStatus(text) {
  let d; try { d = JSON.parse(text); } catch { return null; }
  const self = d.Self || {};
  const users = d.User || {};
  const peers = Object.values(d.Peer || {}).map(p => ({
    name: String(p.DNSName || p.HostName || '').replace(/\.$/, ''), host: p.HostName || '', os: p.OS || '',
    ips: p.TailscaleIPs || [], online: !!p.Online, sharee: !!p.ShareeNode,
    login: users[p.UserID]?.LoginName || null,
    path: pathOf(p),
  }));
  return {
    state: d.BackendState || 'NoState', version: d.Version || '', authURL: d.AuthURL || null,
    name: String(self.DNSName || '').replace(/\.$/, ''), ips: self.TailscaleIPs || [], os: self.OS || '',
    selfLogin: users[self.UserID]?.LoginName || null,
    user: String(users[self.UserID]?.DisplayName || String(users[self.UserID]?.LoginName || '').split('@')[0] || '').slice(0, 40),
    keyExpiry: self.KeyExpiry ? Date.parse(self.KeyExpiry) : null, https: Array.isArray(d.CertDomains) && d.CertDomains.length > 0,
    health: Array.isArray(d.Health) ? d.Health : [], peers,
  };
}
export function pathOf(p) {
  if (p?.CurAddr) return {kind: 'direct', where: null};
  if (p?.PeerRelay) return {kind: 'peer-relay', where: null};
  if (p?.Relay) return {kind: 'relay', where: String(p.Relay)};
  return {kind: 'unknown', where: null};
}
const CITY = {syd: 'Sydney', mel: 'Melbourne', sin: 'Singapore', tok: 'Tokyo', hkg: 'Hong Kong', blr: 'Bangalore', dxb: 'Dubai',
  fra: 'Frankfurt', ams: 'Amsterdam', lhr: 'London', par: 'Paris', mad: 'Madrid', waw: 'Warsaw', hel: 'Helsinki', nue: 'Nuremberg',
  nyc: 'New York', ord: 'Chicago', dfw: 'Dallas', den: 'Denver', sfo: 'San Francisco', sea: 'Seattle', lax: 'Los Angeles',
  mia: 'Miami', tor: 'Toronto', sao: 'São Paulo', jnb: 'Johannesburg', nai: 'Nairobi', hnl: 'Honolulu'};
export const cityOf = code => CITY[String(code || '').toLowerCase()] || String(code || '').toUpperCase();

export function readPing(text) {
  const lines = String(text || '').split('\n').filter(l => l.startsWith('pong from'));
  const last = lines.at(-1);
  if (!last) return null;
  const ms = Number((last.match(/ in ([\d.]+)ms/) || [])[1]);
  const derp = last.match(/via DERP\(([^)]+)\)/), peer = last.match(/via peer-relay\(/), direct = last.match(/via (\[?[0-9a-f.:]+\]?:\d+) in/i);
  const path = derp ? {kind: 'relay', where: derp[1]} : peer ? {kind: 'peer-relay', where: null} : direct ? {kind: 'direct', where: null} : {kind: 'unknown', where: null};
  return Number.isFinite(ms) ? {ms: Math.round(ms), ...path} : null;
}
export function pathWords(p) {
  if (!p) return '';
  if (p.kind === 'direct') return 'Direct';
  if (p.kind === 'peer-relay') return 'Relayed by a peer';
  if (p.kind === 'relay') return `Relayed via ${cityOf(p.where)}`;
  return 'Connecting';
}
export function servePorts(text) {
  try { return Object.keys(JSON.parse(text)?.TCP || {}).map(Number).filter(Number.isFinite); } catch { return null; }
}
// Which addresses this PC's own Tailscale rules let in on a port (from `tailscale debug netmap`, read-only).
export function allowedSources(netmapText, port) {
  let d; try { d = JSON.parse(netmapText); } catch { return null; }
  const out = [];
  for (const r of d?.PacketFilter || []) {
    const hit = (r.Dsts || []).some(x => !x.Ports || (x.Ports.First <= port && port <= x.Ports.Last));
    if (hit) out.push(...(r.Srcs || []));
  }
  return out;
}
export function ipAllowed(ip, sources) {
  if (!ip || !sources) return true;                       // cannot tell: do not cry wolf
  const n = s => s.split('.').reduce((a, b) => (a << 8) + Number(b), 0) >>> 0;
  return sources.some(src => {
    if (src === '*' || src === '0.0.0.0/0') return true;
    const [net, bits = '32'] = src.split('/');
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(net) || !/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return false;
    const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
    return (n(ip) & mask) === (n(net) & mask);
  });
}
export function freeDoorPort(taken, wanted = DOOR_PORTS) { return wanted.find(p => !taken.includes(p)) ?? null; }

// What the person must do next, or ready. One step at a time, the first that applies.
export function setupStep(st, now = Date.now()) {
  if (!st) return {step: 'missing', say: TS_SAY.missing};
  if (st.version && !versionAtLeast(st.version)) return {step: 'old', say: TS_SAY.old};
  if (st.state === 'Stopped' || st.state === 'NoState' || st.state === 'Starting') return {step: 'stopped', say: TS_SAY.stopped};
  if (st.state === 'NeedsLogin') return {step: 'login', say: TS_SAY.login, url: st.authURL};
  if (st.state === 'NeedsMachineAuth') return {step: 'machine-auth', say: TS_SAY.machineAuth};
  if (st.keyExpiry && st.keyExpiry < now) return {step: 'expired', say: TS_SAY.expired};
  if (st.state !== 'Running') return {step: 'stopped', say: TS_SAY.stopped};
  // A network that blocks Tailscale itself (some school, work or hotel Wi-Fi): Tailscale says so in its health list.
  // Nothing on this PC can get through that; the card says to try another network and keeps checking by itself.
  if ((st.health || []).some(h => /coordination server|could not connect to any relay|DERP|unable to connect/i.test(String(h)))) return {step: 'network', say: TS_SAY.noNetwork};
  const days = st.keyExpiry ? Math.floor((st.keyExpiry - now) / 86_400_000) : null;
  return {step: 'ready', warn: days !== null && days <= 14 ? TS_SAY.expiringSoon(Math.max(0, days)) : null};
}
// What a failed `tailscale serve` said, in plain words.
export function serveProblem(text) {
  const t = String(text || '');
  const url = (t.match(/https:\/\/login\.tailscale\.com\/\S+/) || [])[0] || null;
  if (/access denied|permission denied|operator|sudo/i.test(t)) return {problem: 'operator', say: TS_SAY.operator};
  if (url && /https|serve|enable|consent/i.test(t)) return {problem: 'https', say: TS_SAY.https, url};
  return {problem: 'failed', say: TS_SAY.doorFailed};
}

// ---- the real command ---------------------------------------------------------------------------------------------------
export function createTailscale({platform = process.platform, run = null, spawnImpl = spawn, user = process.env.USER || process.env.USERNAME || ''} = {}) {
  let cli = null;
  const exec = run || ((file, args, timeout = 10_000) => new Promise(resolve => {
    execFile(file, args, {timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024}, (err, stdout, stderr) =>
      resolve({code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, missing: err?.code === 'ENOENT', stdout: String(stdout || ''), stderr: String(stderr || '')}));
  }));
  async function find() {
    if (cli) return cli;
    for (const c of ['tailscale', ...(CANDIDATES[platform] || [])]) {
      if (c !== 'tailscale' && !run && !existsSync(c)) continue;
      const r = await exec(c, ['version'], 5000);
      if (!r.missing && r.code === 0) return (cli = c);
    }
    return null;
  }
  const ts = async (args, timeout) => { const c = await find(); return c ? exec(c, args, timeout) : {code: -1, missing: true, stdout: '', stderr: ''}; };

  let door = null;          // {port, child}
  return {
    find,
    async status() {
      const r = await ts(['status', '--json'], 8000);
      if (r.missing) return null;
      return readStatus(r.stdout) || {state: 'Stopped', version: '', peers: [], health: [r.stderr.trim()].filter(Boolean)};
    },
    async ping(ip) {
      const r = await ts(['ping', '--c', '1', '--timeout', '5s', String(ip)], 12_000);
      return readPing(r.stdout + '\n' + r.stderr);
    },
    async doorSources(port) { const r = await ts(['debug', 'netmap'], 10_000); return r.code === 0 ? allowedSources(r.stdout, port) : null; },
    async doorPorts() { const r = await ts(['serve', 'status', '--json'], 8000); return r.code === 0 ? (servePorts(r.stdout || '{}') ?? []) : []; },
    async clearDoor(port) {                       // a door this plugin left behind (DSH was killed); only that port
      if (!port || door?.port === port) return false;
      if (!(await this.doorPorts()).includes(port)) return false;
      await ts(['serve', `--https=${port}`, 'off'], 8000); return true;
    },
    operatorCommand: () => `sudo tailscale set --operator=${user || '$USER'}`,
    async openDoor({port, target}) {
      if (door) return {ok: true, port: door.port};
      const c = await find();
      if (!c) return {ok: false, problem: 'missing', say: TS_SAY.missing};
      const taken = await this.doorPorts();
      if (taken.includes(port)) await ts([`serve`, `--https=${port}`, 'off'], 8000);       // a leftover of our own from a crash
      return new Promise(resolve => {
        let out = '', settled = false;
        const child = spawnImpl(c, ['serve', `--https=${port}`, '--yes', target], {stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true});
        const finish = v => { if (!settled) { settled = true; resolve(v); } };
        // A foreground door is not in Tailscale's saved list; it says "Available within your tailnet: https://...:<port>"
        // once it is up. That line (or the saved list, for older versions) is the proof.
        const up = () => out.includes(`:${port}`) && /available/i.test(out);
        const onData = d => { out += d; if (!settled && up()) { door = {port, child}; finish({ok: true, port}); } };
        child.stdout?.on('data', onData);
        child.stderr?.on('data', onData);
        child.on('error', () => finish({ok: false, problem: 'failed', say: TS_SAY.doorFailed}));
        child.on('exit', () => { if (door?.child === child) door = null; finish({ok: false, ...serveProblem(out)}); });
        setTimeout(async () => {
          if (settled) return;
          const ports = await this.doorPorts();
          if (ports.includes(port)) { door = {port, child}; finish({ok: true, port}); }
          else { try { child.kill(); } catch {} finish({ok: false, ...serveProblem(out)}); }
        }, 8000);
      });
    },
    async closeDoor({probeURL = null} = {}) {
      const d = door; door = null;
      // proof by knocking: any answer from the door's address means it is still open
      const answers = async () => (probeURL ? knock(probeURL) : false);
      if (d?.child && d.child.exitCode === null) {
        d.child.kill('SIGTERM');
        await new Promise(r => { const t = setTimeout(r, 2000); d.child.once('exit', () => { clearTimeout(t); r(); }); });
        if (d.child.exitCode === null) try { d.child.kill('SIGKILL'); } catch {}
      }
      const port = d?.port;
      if (!port) return {closed: true};
      let ports = await this.doorPorts();
      // Tailscale takes a few seconds to take a foreground door down: knock for up to 10 s before trying harder.
      for (let i = 0; i < 10 && await answers(); i++) await new Promise(r => setTimeout(r, 1000));
      if (ports.includes(port) || await answers()) { await ts(['serve', `--https=${port}`, 'off'], 8000); ports = await this.doorPorts(); }
      for (let i = 0; i < 5 && await answers(); i++) await new Promise(r => setTimeout(r, 1000));
      return {closed: !ports.includes(port) && !(await answers()), port};
    },
    doorOpen: () => !!door,
  };
}
