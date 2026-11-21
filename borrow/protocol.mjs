// Borrow my AI: what the host's gate and the friend's link agree on. Plain Node, no packages.
// Borrow my AI, 22 Nov 2026.
import {randomBytes, createHash, timingSafeEqual} from 'node:crypto';

export const PROTOCOL = 1;

// The owner's answers (decision 7): free after 3 min quiet, 2 h a turn, 4 h a day. One friend connected at a time (decision 5).
export const DEFAULTS = Object.freeze({
  idleMs: 3 * 60_000,
  turnMs: 2 * 3600_000,
  dayMs: 4 * 3600_000,
  dropMs: 45_000,
  warnMs: 5 * 60_000,
  perMinute: 20,
  maxBodyBytes: 8 * 1024 * 1024,
  inviteMs: 24 * 3600_000,
  hostWaitMs: 15 * 60_000,
  wakeMs: 6 * 60_000,
  keepaliveMs: 10_000,
  heartbeatMs: 15_000,
  auditLines: 2000,
});

// Every sentence a person can see, in one place. Plain words, one message per problem.
export const SAY = Object.freeze({
  badKey: 'This invite is not valid any more. Ask your friend for a new one.',
  otherPerson: 'This invite belongs to someone else. Ask your friend for your own.',
  noIdentity: 'This only works through Tailscale. Open it from AMP in DSH.',
  expired: 'This invite has expired. Ask your friend for a new one.',
  paused: 'Your friend stopped sharing.',
  off: 'Your friend is not sharing right now.',
  busyOther: 'Someone else has the turn. Try again in a little while.',
  oneAtATime: 'One message at a time. Wait for this reply to finish.',
  slowDown: 'Slow down a little. Try again in 20 seconds.',
  tooBig: 'That chat is too big to send. Compact it and send again.',
  turnOver: 'Your turn is over for now. Your friend can let you back in.',
  dayOver: 'You have used this AI for 4 hours today. It opens again tomorrow.',
  notLoaded: "Your friend's AI is asleep. It wakes by itself; send your message again in a minute.",
  gaming: 'Your friend is playing a game. Their AI comes back when they finish.',
  unknownModel: 'Your friend is not sharing that model right now. Pick another in the model list.',
  hostWaitTooLong: 'Your friend is still using it. Try again soon.',
  badRequest: 'That message could not be read. Send it again.',
  upstream: "Your friend's AI had a problem answering. Send it again.",
  notHere: 'Not here.',
});

const b64u = buf => Buffer.from(buf).toString('base64url');

export function newKey() { return 'ampb_' + b64u(randomBytes(32)); }
export function fingerprint(key) { return createHash('sha256').update(String(key)).digest('hex'); }
export function sameFingerprint(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export const isShareLink = s => typeof s === 'string' && /^https:\/\/login\.tailscale\.com\/[\w/?=&.-]{1,200}$/.test(s.trim());
export function newId() { return b64u(randomBytes(9)); }

// An invite is one line a person pastes: AMP1-<data>-<check>. The check catches a bad copy before anything is tried.
export function encodeInvite({host, url, key, exp, share = null}) {
  const data = b64u(JSON.stringify({v: PROTOCOL, host: String(host).slice(0, 60), url, key, exp, share}));
  return `AMP1-${data}-${createHash('sha256').update(data).digest('hex').slice(0, 8)}`;
}
export function decodeInvite(text, now = Date.now()) {
  const m = String(text ?? '').replace(/\s+/g, '').match(/AMP1-([A-Za-z0-9_-]+)-([0-9a-f]{8})/);
  if (!m || createHash('sha256').update(m[1]).digest('hex').slice(0, 8) !== m[2]) throw new Error('That code is incomplete. Copy it again.');
  let j;
  try { j = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch { throw new Error('That code is incomplete. Copy it again.'); }
  if (!j || j.v !== PROTOCOL) throw new Error('Update AMP in Plugins to use this invite.');
  let u;
  try { u = new URL(j.url); } catch { throw new Error('That code is incomplete. Copy it again.'); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) throw new Error('That code is incomplete. Copy it again.');
  if (typeof j.key !== 'string' || !/^ampb_[A-Za-z0-9_-]{40,}$/.test(j.key)) throw new Error('That code is incomplete. Copy it again.');
  if (Number.isFinite(j.exp) && j.exp < now) throw new Error(SAY.expired);
  // the Tailscale share link the friend presses Accept on; only Tailscale's own sign-in site is ever opened
  const share = typeof j.share === 'string' && /^https:\/\/login\.tailscale\.com\/[\w/?=&.-]{1,200}$/.test(j.share) ? j.share : null;
  return {host: String(j.host || 'your friend').slice(0, 60), url: u.origin, key: j.key, exp: Number.isFinite(j.exp) ? j.exp : null, share};
}

export function openaiError(message, code = 'amp_borrow') {
  return {error: {message, type: 'amp_borrow', code}};
}

// The chat request is rebuilt from fields an OpenAI-style server understands. Anything else (server-side cache slots,
// grammar files, saving state) never reaches the model server.
const FIELDS = ['messages', 'stream', 'max_tokens', 'max_completion_tokens', 'temperature', 'top_p', 'top_k', 'min_p',
  'presence_penalty', 'frequency_penalty', 'repetition_penalty', 'stop', 'seed', 'tools', 'tool_choice',
  'parallel_tool_calls', 'response_format', 'reasoning_effort', 'thinking', 'chat_template_kwargs'];
const ROLES = new Set(['system', 'developer', 'user', 'assistant', 'tool']);

export function cleanChatRequest(body, model) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
  if (!Array.isArray(body.messages) || !body.messages.length) throw new Error('no messages');
  for (const m of body.messages) if (!m || typeof m !== 'object' || !ROLES.has(m.role)) throw new Error('bad message');
  const out = {model: model.upstreamModel ?? model.id};
  for (const k of FIELDS) if (Object.hasOwn(body, k) && body[k] !== undefined) out[k] = body[k];
  if (out.chat_template_kwargs !== undefined && (typeof out.chat_template_kwargs !== 'object' || Array.isArray(out.chat_template_kwargs))) delete out.chat_template_kwargs;
  out.stream = out.stream === true;
  out.n = 1;
  const cap = Number(model.maxTokens) > 0 ? Number(model.maxTokens) : null;
  for (const k of ['max_tokens', 'max_completion_tokens']) {
    if (out[k] === undefined) continue;
    const n = Math.floor(Number(out[k]));
    if (!Number.isFinite(n) || n < 1) delete out[k]; else out[k] = cap ? Math.min(n, cap) : n;
  }
  if (out.stream) out.stream_options = {include_usage: true};
  return out;
}

// The offer a friend's DSH receives: what its model picker needs, never an address or key of the host.
export function offerOf(models) {
  return models.map(m => ({
    id: m.id, name: m.name ?? m.id,
    contextWindow: m.contextWindow ?? null, maxTokens: m.maxTokens ?? null,
    input: Array.isArray(m.input) && m.input.length ? m.input : ['text'],
    reasoningEfforts: m.reasoningEfforts ?? null, compat: m.compat ?? null,
  }));
}
