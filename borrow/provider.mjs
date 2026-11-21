// Borrow my AI: the settings both DSHs need, as pure functions (no DSH, no disk), so they can be tested anywhere.
//  - host: which of this DSH's models are local and can be lent (offerFromConfig)
//  - friend: the "Borrowed · <name>" model provider that points at AMP Link on the friend's own PC (buildProvider),
//    added to and removed from the llm-pi-ai settings without touching anything else (addProvider / removeProvider)

export const KEY_ENV = 'AMP_BORROW_KEY';

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|\[?::1\]?)$/i;
export function isLocalURL(url) {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) && LOOPBACK.test(u.hostname); } catch { return false; }
}

// Only these request settings travel from the host's model to the friend's DSH; values are simple and short.
const COMPAT_KEYS = ['supportsDeveloperRole', 'maxTokensField', 'supportsReasoningEffort', 'thinkingFormat',
  'thinkingTokenBudgetField', 'chatTemplateKwargs', 'supportsUsageInStreaming', 'supportsStore'];
function simple(v, depth = 0) {
  if (v === null || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return true;
  if (typeof v === 'string') return v.length <= 80;
  if (depth < 3 && v && typeof v === 'object' && !Array.isArray(v)) {
    const keys = Object.keys(v);
    return keys.length <= 12 && keys.every(k => /^[$A-Za-z_][\w.-]{0,40}$/.test(k) && simple(v[k], depth + 1));
  }
  return false;
}
export function cleanCompat(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {};
  for (const k of COMPAT_KEYS) if (Object.hasOwn(c, k) && simple(c[k])) out[k] = structuredClone(c[k]);
  return Object.keys(out).length ? out : null;
}
function cleanEfforts(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const out = {};
  for (const [k, v] of Object.entries(e).slice(0, 8)) if (/^[a-z]{2,12}$/.test(k) && (v === null || (typeof v === 'string' && v.length <= 20))) out[k] = v;
  return Object.keys(out).length ? out : null;
}
const num = (v, max) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(Math.floor(Number(v)), max) : null);

// HOST: llm-pi-ai settings -> the models that run on this PC. `env` resolves each provider's key reference.
export function offerFromConfig(piAiConfig, env = process.env) {
  const out = [];
  for (const [providerId, p] of Object.entries(piAiConfig?.providers ?? {})) {
    if (!p || p.api !== 'openai-completions' || !isLocalURL(p.baseURL)) continue;
    for (const m of Array.isArray(p.models) ? p.models : []) {
      if (!m || typeof m.id !== 'string') continue;
      const compat = cleanCompat({...(p.compat || {}), ...(m.compat || {})});
      out.push({
        id: m.id, name: String(m.name || m.id).slice(0, 80), provider: providerId,
        contextWindow: num(m.contextWindow ?? p.defaultContextWindow, 4_000_000),
        maxTokens: num(m.maxTokens ?? p.defaultMaxTokens, 1_000_000),
        input: Array.isArray(m.input) ? m.input.filter(x => x === 'text' || x === 'image') : ['text'],
        reasoningEfforts: cleanEfforts(m.reasoningEfforts), compat,
        thinkingBudgets: p.thinkingBudgets && simple(p.thinkingBudgets) ? structuredClone(p.thinkingBudgets) : null,
        upstream: {baseURL: p.baseURL, apiKey: p.apiKeyEnv ? (env[p.apiKeyEnv] ?? null) : null, model: m.id},
      });
    }
  }
  return out;
}

// FRIEND: the provider id is permanent in DSH, so it is made from the host's name once and kept.
export function providerId(hostName) {
  const slug = String(hostName || 'friend').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'friend';
  return 'amp-borrow-' + slug;
}

export function buildProvider({host, port, offer}) {
  const models = (Array.isArray(offer) ? offer : []).filter(m => m && typeof m.id === 'string' && /^[\w.:@/-]{1,120}$/.test(m.id) && !m.id.includes('..') && !m.id.startsWith('/')).map(m => {
    const row = {id: m.id, name: String(m.name || m.id).slice(0, 80)};
    const cw = num(m.contextWindow, 4_000_000), mt = num(m.maxTokens, 1_000_000);
    if (cw) row.contextWindow = cw;
    if (mt) row.maxTokens = mt;
    row.input = Array.isArray(m.input) && m.input.includes('image') ? ['text', 'image'] : ['text'];
    const eff = cleanEfforts(m.reasoningEfforts); if (eff) row.reasoningEfforts = eff;
    const compat = cleanCompat(m.compat); if (compat) row.compat = compat;
    return row;
  });
  const entry = {
    displayName: `Borrowed · ${String(host || 'friend').slice(0, 40)}`,
    api: 'openai-completions',
    baseURL: `http://127.0.0.1:${Number(port)}/v1`,
    apiKeyEnv: KEY_ENV,
    streamIdleTimeoutMs: 900000,
    models,
  };
  const budgets = offer?.find?.(m => m?.thinkingBudgets && simple(m.thinkingBudgets))?.thinkingBudgets;
  if (budgets) entry.thinkingBudgets = structuredClone(budgets);
  return entry;
}

// The llm-pi-ai row's next config: everything the friend had, plus (or minus) one provider.
const baseOf = (current, inherited) => (current && Object.keys(current).length ? current : inherited) || {};
export function addProvider(current, inherited, id, entry) {
  const base = structuredClone(baseOf(current, inherited));
  return {...base, providers: {...(base.providers || {}), [id]: entry}};
}
export function removeProvider(current, inherited, id) {
  const base = structuredClone(baseOf(current, inherited));
  const providers = {...(base.providers || {})}; delete providers[id];
  return {...base, providers};
}
// The friend's default model, put back when they stop borrowing, so their chat box is never left without a model.
export function restoreDefault(current, inherited, id, previous) {
  const base = structuredClone(baseOf(current, inherited));
  if (base.provider !== id) return null;            // they already moved on: leave it alone
  return previous && previous.provider !== id ? {...previous} : {};
}
