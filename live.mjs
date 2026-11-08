// live.mjs — the live numbers layer.
//
// Fetches and merges the two sources the comparison page needs:
//   Artificial Analysis  scores, speed, AA's own reference prices
//   OpenRouter           catalog: context, max output, price, tool support
//
// Runs server-side only, because Artificial Analysis sends no cross-origin
// permission and its key must never reach a browser. Everything else is a
// plain public JSON call, cached on disk so a restart is instant and the page
// still renders when a source is down.
//
// Shape of getLive(): { generated_at, sources, models[] } where each model is
// already merged, so any surface (the page, an app, a future Worker) renders
// the same object instead of re-implementing the join.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '.cache')
const HERMES_KEYS = join(homedir(), '.claude', 'static', 'hermes-config.json')

// Cache lifetimes (ms). Refresh bypasses them; a failed fetch falls back to them.
const TTL = {
  aa: 6 * 3600e3,
  openrouter: 6 * 3600e3,
}

// ── cache ────────────────────────────────────────────────────────────────────

function cachePath(name) {
  return join(CACHE_DIR, `${name}.json`)
}

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

// ── sources ──────────────────────────────────────────────────────────────────

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
  for (let page = 1; page <= 12; page++) {
    const r = await fetch(`${AA_BASE}?page=${page}`, {
      headers: { 'x-api-key': key },
      signal: AbortSignal.timeout(30_000),
    })
    if (!r.ok) throw new Error(`AA HTTP ${r.status}`)
    const j = await r.json()
    const data = Array.isArray(j.data) ? j.data : []
    rows.push(...data)
    if (!j.pagination?.has_more || data.length === 0) break
  }
  return rows
}

async function fetchOpenRouter() {
  const r = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`OpenRouter HTTP ${r.status}`)
  const j = await r.json()
  return Array.isArray(j.data) ? j.data : []
}

// One source, one cache-or-fetch decision. A source that fails loudly returns
// its last good copy and says so, so the page can show "stale" rather than
// blanking a column that was fine a minute ago.
async function source(name, fetcher, force) {
  const cached = readCache(name)
  const fresh = cached && cached.age < TTL[name]
  if (fresh && !force) {
    return { data: cached.data, fetched: cached.fetched, error: null, stale: false, cached: true }
  }
  try {
    const data = await fetcher()
    if (!data?.length) throw new Error('empty response')
    writeCache(name, data)
    return { data, fetched: Date.now(), error: null, stale: false, cached: false }
  } catch (e) {
    const msg = String(e?.message ?? e)
    if (cached) return { data: cached.data, fetched: cached.fetched, error: msg, stale: true, cached: true }
    return { data: [], fetched: null, error: msg, stale: true, cached: false }
  }
}

// ── name matching ────────────────────────────────────────────────────────────
// A model is spelled differently by every source: "Claude Opus 5.5 (Max,
// Default Fallback)", "openai/gpt-6.1-sol", "GPT-6.1 Sol". One normaliser, one
// key, so the join cannot drift.

const NOISE = /\b(non-reasoning|reasoning|thinking|nothinking|adaptive|instruct|chat|latest|preview|exp|experimental|fast|turbo|high|low|medium|max|xhigh|minimal|default|fallback)\b/g

function norm(s) {
  let t = String(s || '').toLowerCase()
  t = t.slice(t.lastIndexOf('/') + 1)          // drop the vendor prefix
  t = t.replace(/\(.*?\)/g, ' ')               // drop "(Max, Default Fallback)"
  t = t.replace(/:(free|batch|extended|online)$/g, '')
  t = t.replace(NOISE, ' ')
  t = t.replace(/^[a-z]+:\s+/, '')             // drop "MoonshotAI: " style prefixes
  t = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ') // drop snapshot dates
  t = t.replace(/\b\d{6,}\b/g, ' ')            // drop long numeric snapshot ids
  return t.replace(/[^a-z0-9]+/g, '')
}

// An AA row carries one reasoning effort per row ("GPT-6 Luna (Max)"). The page
// wants one line per model, so group them and keep the strongest variant, with
// the effort named so nothing is silently swapped.
function pickBest(list) {
  return [...list].sort((a, b) => {
    const ai = a.evaluations?.artificial_analysis_intelligence_index
    const bi = b.evaluations?.artificial_analysis_intelligence_index
    if ((bi ?? -1) !== (ai ?? -1)) return (bi ?? -1) - (ai ?? -1)
    return (b.evaluations?.artificial_analysis_coding_index ?? -1) - (a.evaluations?.artificial_analysis_coding_index ?? -1)
  })[0]
}

function effortOf(name) {
  const m = String(name || '').match(/\((.*?)\)\s*$/)
  return m ? m[1] : null
}

// ── the merge ────────────────────────────────────────────────────────────────

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const perMillion = (v) => {
  const x = Number(v)
  return Number.isFinite(x) ? +(x * 1e6).toFixed(4) : null
}

export async function getLive({ force = false } = {}) {
  const [aa, or] = await Promise.all([
    source('aa', fetchAA, force),
    source('openrouter', fetchOpenRouter, force),
  ])

  // index the OpenRouter catalog by normalised id and normalised display name
  const orByKey = new Map()
  for (const m of or.data) {
    for (const k of [norm(m.id), norm(m.name)]) {
      if (!k) continue
      const cur = orByKey.get(k)
      // prefer the plain channel over :free / :batch / variants
      const penalty = (x) => (/:free|:batch|:extended|:online/.test(x) ? 1 : 0)
      if (!cur || penalty(m.id) < penalty(cur.id)) orByKey.set(k, m)
    }
  }

  const groups = new Map()
  for (const row of aa.data) {
    const k = norm(row.name)
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(row)
  }

  const models = []
  for (const [key, variants] of groups) {
    const best = pickBest(variants)
    const orMatch = orByKey.get(key) || null
    const aaPrice = best.pricing || {}
    const orPrice = orMatch?.pricing || {}
    models.push({
      key,
      name: String(best.name || '').replace(/\s*\(.*?\)\s*$/, ''),
      aaName: best.name,
      effort: effortOf(best.name),
      variants: variants.length,
      creator: best.model_creator?.name ?? null,
      released: best.release_date ?? null,
      slug: best.slug ?? null,
      // scores
      intel: n(best.evaluations?.artificial_analysis_intelligence_index),
      // The free access level leaves coding_index and agentic_index empty for
      // every model; the engineering domain index is populated, so that is the
      // second score the page can honestly show.
      eng: n(best.evaluations?.artificial_analysis_engineering_index),
      code: n(best.evaluations?.artificial_analysis_coding_index),
      agentic: n(best.evaluations?.artificial_analysis_agentic_index),
      // speed
      tps: n(best.performance?.median_output_tokens_per_second),
      ttft: n(best.performance?.median_time_to_first_token_seconds),
      // Catalog (OpenRouter) for what AA does not carry, AA's own reference
      // price for money: AA lists the vendor's standard rate, while OpenRouter's
      // model-level price is the cheapest partner listing and often half.
      ctx: n(orMatch?.context_length),
      maxOut: n(orMatch?.top_provider?.max_completion_tokens),
      tools: orMatch ? (orMatch.supported_parameters || []).includes('tools') : null,
      priceIn: n(aaPrice.price_1m_input_tokens) ?? perMillion(orPrice.prompt),
      priceOut: n(aaPrice.price_1m_output_tokens) ?? perMillion(orPrice.completion),
      cacheHit: perMillion(orPrice.input_cache_read) ?? n(aaPrice.price_1m_cache_hit_tokens),
      cacheWrite: perMillion(orPrice.input_cache_write) ?? n(aaPrice.price_1m_cache_write_tokens),
      orId: orMatch?.id ?? null,
      orName: orMatch?.name ?? null,
      priceSource: aaPrice.price_1m_input_tokens != null ? 'artificial-analysis' : (orMatch ? 'openrouter' : null),
    })
  }

  models.sort((a, b) => (b.intel ?? -1) - (a.intel ?? -1))

  return {
    generated_at: new Date().toISOString(),
    sources: {
      aa: { fetched: aa.fetched, error: aa.error, stale: aa.stale, count: aa.data.length },
      openrouter: { fetched: or.fetched, error: or.error, stale: or.stale, count: or.data.length },
    },
    counts: {
      total: models.length,
      scored: models.filter((m) => m.intel != null).length,
      matched: models.filter((m) => m.orId).length,
    },
    models,
  }
}
