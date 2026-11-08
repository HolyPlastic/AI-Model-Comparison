// live.mjs — the live numbers layer.
//
// Fetches and merges the sources the comparison page needs:
//   Artificial Analysis  scores, speed, AA's own reference prices
//   OpenRouter           catalog: context, max output, price, tool support
//   Terminal-Bench 4.0   resolution rate per model (leaderboard rows live in the
//                        page's own RSC payload; parsed and validated)
//   DeepSWE              pass@1 per model, from the public leaderboard JSON
//
// Runs server-side only. Artificial Analysis sends no cross-origin permission
// and its key must never reach a browser; the benchmark sites are parsed here
// too, so the page has one shape to render and no scraping code in the browser.
// Everything is cached on disk, so a restart is instant and a dead source falls
// back to its last good copy instead of blanking a column.
//
// getLive() returns { generated_at, sources, counts, models[] } with every row
// already merged. Any second surface renders that object instead of
// re-implementing the join.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '.cache')
const HERMES_KEYS = join(homedir(), '.claude', 'static', 'hermes-config.json')

const TTL = {
  aa: 6 * 3600e3,
  openrouter: 6 * 3600e3,
  tb: 12 * 3600e3,
  swe: 12 * 3600e3,
}
// ── cache ────────────────────────────────────────────────────────────────────

const cachePath = (name) => join(CACHE_DIR, `${name}.json`)

function readCache(name) {
  try {
    const j = JSON.parse(readFileSync(cachePath(name), 'utf8'))
    return { data: j.data, fetched: j.fetched, age: Date.now() - j.fetched }
  } catch {
    return null
  }
}

function writeCache(name, data) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(cachePath(name), JSON.stringify({ fetched: Date.now(), data }))
  } catch {
    /* read-only disk: the page still works, just slower */
  }
}

const getText = async (url, headers = {}, ms = 30_000) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url.slice(0, 60)}`)
  return r.text()
}

const getJson = async (url, headers = {}, ms = 30_000) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(ms) })
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url.slice(0, 60)}`)
  return r.json()
}

// ── Artificial Analysis ──────────────────────────────────────────────────────

function aaKey() {
  if (process.env.AA_API_KEY) return process.env.AA_API_KEY
  try {
    return JSON.parse(readFileSync(HERMES_KEYS, 'utf8')).artificialAnalysisApiKey || ''
  } catch {
    return ''
  }
}

const AA_BASE = 'https://artificialanalysis.ai/api/v2/language/models/free'

async function fetchAA() {
  const key = aaKey()
  if (!key) throw new Error('no Artificial Analysis key')
  const rows = []
  let indexVersion = null
  for (let page = 1; page <= 12; page++) {
    const j = await getJson(`${AA_BASE}?page=${page}`, { 'x-api-key': key })
    const data = Array.isArray(j.data) ? j.data : []
    rows.push(...data)
    indexVersion = j.intelligence_index_version ?? indexVersion
    if (!j.pagination?.has_more || data.length === 0) break
  }
  // the index version matters: a score without it is not comparable over time
  return { rows, indexVersion }
}

// ── OpenRouter ───────────────────────────────────────────────────────────────

const fetchOpenRouter = () =>
  getJson('https://openrouter.ai/api/v1/models').then((j) => (Array.isArray(j.data) ? j.data : []))

// ── Terminal-Bench 4.0 ───────────────────────────────────────────────────────
// The leaderboard has no JSON endpoint. The rows are embedded in the page's
// Next.js flight payload, so they are read from there. Validation is strict:
// anything unexpected throws and the cached copy is used instead.

const TB_URL = 'https://www.tbench.ai/'

function flightPayload(html) {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g
  let m
  const parts = []
  while ((m = re.exec(html))) {
    try {
      parts.push(JSON.parse(m[1]))
    } catch {
      /* a malformed chunk is not fatal, the rest still joins */
    }
  }
  return parts.join('')
}

function firstJsonArray(text, needle) {
  const at = text.indexOf(needle)
  if (at < 0) throw new Error(`Terminal-Bench payload has no ${needle}`)
  const start = text.indexOf('[', at)
  let depth = 0
  for (let p = start; p < text.length; p++) {
    if (text[p] === '[') depth++
    else if (text[p] === ']') {
      depth--
      if (depth === 0) return JSON.parse(text.slice(start, p + 1))
    }
  }
  throw new Error('Terminal-Bench payload array never closed')
}

async function fetchTB() {
  const html = await getText(TB_URL)
  const rows = firstJsonArray(flightPayload(html), '"rows":[{"id"')

  // Their own wording for the benchmark comes from the public repo readme. A
  // failure here only costs the description, never the scores.
  let tagline = null
  let tasks = null
  try {
    const md = await getText('https://raw.githubusercontent.com/harbor-framework/terminal-bench/main/README.md')
    const clean = md.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '')
        tagline = clean.split('\n').find((l) => /is a benchmark designed/i.test(l))?.trim() ?? null
    tasks = md.match(/(\d+)\s+tasks/i)?.[1] ?? null
  } catch {
    /* description only */
  }

  return {
    tagline,
    tasks,
    rows: rows
      .filter((r) => r?.metadata?.model_display?.label && r?.metrics)
      .map((r) => ({
        name: r.metadata.model_display.label,
        agent: r.metadata.agent_display?.label ?? null,
        effort: r.metadata.reasoning_effort ?? null,
        // accuracy is a percentage (61.82), display strings carry markup noise
        score: typeof r.metrics.accuracy === 'number' ? r.metrics.accuracy : null,
        date: r.metadata.date ?? null,
        rank: r.rank ?? null,
      }))
      .filter((r) => r.score != null),
  }
}

// ── DeepSWE ──────────────────────────────────────────────────────────────────
// A real JSON artifact, one row per harness + model + reasoning effort.

const SWE_URL = 'https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json'

async function fetchSWE() {
  const j = await getJson(SWE_URL)
  const rows = Array.isArray(j.rows) ? j.rows : []
  if (!rows.length) throw new Error('DeepSWE leaderboard returned no rows')
  return {
    generated_at: j.generated_at ?? null,
    scope: j.scope ?? null,
    unit: j.unit ?? null,
    tasks: j.n_tasks_in_set ?? null,
    rows: rows
      .filter((r) => r?.model && typeof r.pass_at_1 === 'number')
      .map((r) => ({
        name: r.model,
        harness: r.harness ?? null,
        effort: r.reasoning_effort ?? null,
        score: +(r.pass_at_1 * 100).toFixed(2),
        tasks: r.n_tasks_attempted ?? null,
      })),
  }
}

// ── name matching ────────────────────────────────────────────────────────────
// Every source spells a model differently: "Claude Opus 5.5 (Max, Default
// Fallback)", "openai/gpt-6.1-sol", "GPT-6.1 Sol", "gpt-6-astra", "Tencent Hy4".
// One normaliser, and a second key with the vendor prefix removed, so the join
// cannot drift and "Hy4 Preview" still finds "Tencent Hy4".

const NOISE = /\b(non-reasoning|reasoning|thinking|nothinking|adaptive|instruct|chat|latest|preview|exp|experimental|fast|turbo|high|low|medium|max|xhigh|minimal|default|fallback)\b/g

const VENDORS = ['openai', 'anthropic', 'google', 'googledeepmind', 'meta', 'metallama', 'mistral', 'mistralai',
  'nvidia', 'qwen', 'alibaba', 'deepseek', 'moonshotai', 'moonshot', 'kimi', 'minimax', 'zai', 'zhipu', 'z-ai',
  'xai', 'x-ai', 'microsoft', 'amazon', 'cohere', 'ai21', 'upstage', 'tencent', 'baidu', 'bytedance', 'stepfun',
  'inclusionai', 'liquid', 'nousresearch', 'nous', 'perplexity', 'thinkingmachines', 'nexagi', 'poolside', 'opencode',
  // model families that one source prefixes and another drops, e.g. AA's
  // "Claude Opus 5.5" against Terminal-Bench's "Opus 5.5"
  'claude', 'gemini', 'grok', 'glm', 'llama']

function norm(s) {
  const raw = String(s || '').toLowerCase()
  let t = raw.slice(raw.lastIndexOf('/') + 1)   // drop a provider/ prefix
  t = t.replace(/\(.*?\)/g, ' ')                // drop "(Max, Default Fallback)"
  t = t.replace(/:(free|batch|extended|online)$/g, '')
  t = t.replace(NOISE, ' ')
  t = t.replace(/^[a-z]+:\s+/, '')              // drop "MoonshotAI: "
  t = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')  // drop snapshot dates
  t = t.replace(/\b\d{6,}\b/g, ' ')             // drop long snapshot ids
  return t.replace(/[^a-z0-9]+/g, '')
}

// Both spellings of a key: as-is, and with a leading vendor name removed.
// A stripped key is only produced when what remains starts with a letter, so
// "Qwen3.8 Flash" cannot degrade to "38flash" and inherit Gemini 3.8 Flash's
// scores. That collision was real and silent.
function keys(s) {
  const full = norm(s)
  const out = full ? [full] : []
  for (const v of VENDORS) {
    if (!full.startsWith(v)) continue
    const rest = full.slice(v.length)
    if (rest.length >= 3 && /^[a-z]/.test(rest)) out.push(rest)
    break
  }
  return out
}

// An AA row carries one reasoning effort each. Group them and keep the
// strongest, naming the effort so nothing is silently swapped.
function pickBest(list, field) {
  return [...list].sort((a, b) => {
    const av = a[field], bv = b[field]
    if (av == null) return 1
    if (bv == null) return -1
    return bv - av
  })[0]
}

const effortOf = (name) => String(name || '').match(/\((.*?)\)\s*$/)?.[1] ?? null

// ── the merge ────────────────────────────────────────────────────────────────

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const perMillion = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? +(x * 1e6).toFixed(4) : null
}

async function source(name, fetcher, force) {
  const cached = readCache(name)
  const fresh = cached && cached.age < TTL[name]
  if (fresh && !force) return { data: cached.data, fetched: cached.fetched, error: null, stale: false }
  try {
    const data = await fetcher()
    writeCache(name, data)
    return { data, fetched: Date.now(), error: null, stale: false }
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (cached) return { data: cached.data, fetched: cached.fetched, error: msg, stale: true }
    return { data: null, fetched: null, error: msg, stale: true }
  }
}

const emptySWE = { generated_at: null, rows: [] }

export async function getLive({ force = false } = {}) {
  const [aa, or, tb, swe] = await Promise.all([
    source('aa', fetchAA, force),
    source('openrouter', fetchOpenRouter, force),
    source('tb2', fetchTB, force),
    source('swe2', fetchSWE, force),
  ])

  const aaRows = aa.data?.rows || []
  const orRows = or.data || []
  const tbRows = tb.data?.rows || []
  const sweRows = swe.data?.rows || []

  // one catalogue index: a model is reachable by id or display name
  const orByKey = new Map()
  for (const m of orRows) {
    for (const k of keys(m.id).concat(keys(m.name))) {
      const cur = orByKey.get(k)
      const penalty = (x) => (/:free|:batch|:extended|:online/.test(x) ? 1 : 0)
      if (!cur || penalty(m.id) < penalty(cur.id)) orByKey.set(k, m)
    }
  }

  // benchmark indexes, best row per model
  const tbByKey = new Map()
  for (const r of tbRows) {
    for (const k of keys(r.name)) {
      const cur = tbByKey.get(k)
      if (!cur || r.score > cur.score) tbByKey.set(k, r)
    }
  }
  const sweByKey = new Map()
  for (const r of sweRows) {
    for (const k of keys(r.name)) {
      const cur = sweByKey.get(k)
      if (!cur || r.score > cur.score) sweByKey.set(k, r)
    }
  }

  // group AA's per-effort rows into one model each
  const aaGroups = new Map()
  for (const row of aaRows) {
    const k = keys(row.name)[0]
    if (!k) continue
    if (!aaGroups.has(k)) aaGroups.set(k, [])
    aaGroups.get(k).push(row)
  }

  const models = []
  const seen = new Set()

  const build = (key, best, orMatch) => {
    const aaPrice = best?.pricing || {}
    const orPrice = orMatch?.pricing || {}
    const look = (map) => {
      for (const k of [key, ...keys(best?.name ?? ''), ...keys(orMatch?.name ?? ''), ...keys(orMatch?.id ?? '')]) {
        if (k && map.has(k)) return map.get(k)
      }
      return null
    }
    const tbHit = look(tbByKey)
    const sweHit = look(sweByKey)
    const name = best
      ? String(best.name || '').replace(/\s*\(.*?\)\s*$/, '')
      : String(orMatch?.name || '').replace(/^[^:]+:\s*/, '')
    return {
      key,
      name,
      aaName: best?.name ?? null,
      effort: best ? effortOf(best.name) : null,
      variants: best ? (aaGroups.get(key) || []).length : 0,
      creator: best?.model_creator?.name ?? (orMatch?.id ? orMatch.id.split('/')[0] : null),
      released: best?.release_date ?? null,
      slug: best?.slug ?? null,
      intel: n(best?.evaluations?.artificial_analysis_intelligence_index),
      // The free access level leaves coding_index and agentic_index empty for
      // every model; the engineering domain index is populated, so that is the
      // second score the page can honestly show.
      eng: n(best?.evaluations?.artificial_analysis_engineering_index),
      code: n(best?.evaluations?.artificial_analysis_coding_index),
      agentic: n(best?.evaluations?.artificial_analysis_agentic_index),
      tps: n(best?.performance?.median_output_tokens_per_second),
      ttft: n(best?.performance?.median_time_to_first_token_seconds),
      ctx: n(orMatch?.context_length),
      maxOut: n(orMatch?.top_provider?.max_completion_tokens),
      tools: orMatch ? (orMatch.supported_parameters || []).includes('tools') : null,
      priceIn: n(aaPrice.price_1m_input_tokens) ?? perMillion(orPrice.prompt),
      priceOut: n(aaPrice.price_1m_output_tokens) ?? perMillion(orPrice.completion),
      cacheHit: perMillion(orPrice.input_cache_read) ?? n(aaPrice.price_1m_cache_hit_tokens),
      cacheWrite: perMillion(orPrice.input_cache_write) ?? n(aaPrice.price_1m_cache_write_tokens),
      priceSource: aaPrice.price_1m_input_tokens != null ? 'artificial-analysis' : (orMatch ? 'openrouter' : null),
      // benchmarks
      tb: tbHit?.score ?? null,
      tbAgent: tbHit?.agent ?? null,
      tbEffort: tbHit?.effort ?? null,
      tbDate: tbHit?.date ?? null,
      swe: sweHit?.score ?? null,
      sweHarness: sweHit?.harness ?? null,
      sweEffort: sweHit?.effort ?? null,
      orId: orMatch?.id ?? null,
      orName: orMatch?.name ?? null,
    }
  }

  for (const [key, variants] of aaGroups) {
    const chosen = pickBest(variants.map((v) => ({
      ...v,
      _score: v.evaluations?.artificial_analysis_intelligence_index ?? null,
      _code: v.evaluations?.artificial_analysis_coding_index ?? null,
    })), '_score')
    const orMatch = keys(chosen.name).map((k) => orByKey.get(k)).find(Boolean) || null
    models.push(build(key, chosen, orMatch))
    seen.add(key)
  }

  // Catalogue-only models: no AA score yet, but they still carry context,
  // price and tools, and they let my own rows match a live model.
  for (const [k, m] of orByKey) {
    if (seen.has(k)) continue
    const model = build(k, null, m)
    if (models.some((x) => x.key === k)) continue
    models.push(model)
    seen.add(k)
  }

  models.sort((a, b) => (b.intel ?? -1) - (a.intel ?? -1))

  return {
    generated_at: new Date().toISOString(),
    sources: {
      aa: { fetched: aa.fetched, error: aa.error, stale: aa.stale, count: aaRows.length },
      openrouter: { fetched: or.fetched, error: or.error, stale: or.stale, count: orRows.length },
      tb: { fetched: tb.fetched, error: tb.error, stale: tb.stale, count: tbRows.length },
      swe: { fetched: swe.fetched, error: swe.error, stale: swe.stale, count: sweRows.length, generated_at: swe.data?.generated_at ?? null },
    },
    // What each source says about its own metric, in its own words. The page
    // appends this to the authored description in benchmarks.json, so a
    // definition can never drift away from the source that defines it.
    notes: {
      aa: { index_version: aa.data?.indexVersion ?? null },
      tb: { tagline: tb.data?.tagline ?? null, tasks: tb.data?.tasks ?? null },
      swe: {
        generated_at: swe.data?.generated_at ?? null,
        tasks: swe.data?.tasks ?? null,
        scope: swe.data?.scope ?? null,
        unit: swe.data?.unit ?? null,
      },
    },
    counts: {
      total: models.length,
      scored: models.filter((m) => m.intel != null).length,
      matched: models.filter((m) => m.orId).length,
      tb: models.filter((m) => m.tb != null).length,
      swe: models.filter((m) => m.swe != null).length,
    },
    models,
  }
}
