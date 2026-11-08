# AGENTS.md — AI Model Comparison

## Purpose
Maintain a single interactive comparison of AI coding models available through OpenCode Go, ChatGPT Plus/Codex sign-in, and Claude subscriptions/API. Prioritize task-relevant benchmark evidence, speed, relative costs and usable subscription allowances.

## Canonical source
- Repository: `HolyPlastic/AI-Model-Comparison`.
- `ai-model-comparison.html` is the page: layout, filters, comparison, column folds. It still opens standalone from disk and is still the file published to Pages.
- `live.mjs` fetches and merges the live sources. One function, `getLive()`, returns the merged object every surface renders. Any second surface must import it, never re-implement the join.
- `server.mjs` serves the page and `GET /api/live` on `127.0.0.1:8099`, plus `GET /api/health`. It is the only thing that talks to Artificial Analysis, so the API key never reaches a browser.
- Read the current repository versions of these files before any modification. Commit edits to the same files, rather than generating copies.

## Live sources
| Source | What it gives | Reached by |
|---|---|---|
| Artificial Analysis | intelligence index, engineering index, prices, tok/s, TTFT | server only (`live.mjs`), key from `~/.claude/static/hermes-config.json` (`artificialAnalysisApiKey`) or `AA_API_KEY` |
| OpenRouter | context window, max output, tool support, cache-hit price, fallback prices | server (CORS-open, but kept server-side so there is one join) |
| my hand-kept data | provider, TB4, DeepSWE, Go allowance, my own reference prices | inline in the page |

- **The legacy endpoint `/api/v2/data/llms/models` was retired 4 November 2026 and returns 410 Gone.** The replacement is `/api/v2/language/models/free` (paginated, 200 rows per page). Do not restore the old path.
- The free access level returns **no coding index and no agentic index** for any model (the fields exist and are null). It does return the intelligence index and the domain indices (engineering, legal, health, finance, strategy, economics). That is why the page shows Intel and Engineering and not Code/Agentic. Pro is a paid tier; do not claim those columns work without it.
- LMArena was dropped as a source: the Hugging Face mirror stops at 2025 (top entry Gemini 2.5 Pro), so its Elo would contradict every 2026 row.

## Price policy
- The Cost column takes the **Artificial Analysis standard list price**, falling back to OpenRouter where AA has none. AA lists the vendor's rate; OpenRouter's model-level price is the cheapest partner listing and is frequently half, so it must not drive the comparison.
- My hand-entered prices are kept, not overwritten: they appear as **My $/M in** and **My $/M out** inside the expanded Cost column, because several of them are deliberate off-peak or discounted figures.
- Never mix the two silently. The cell tooltip names the source and the price.

## Must preserve
- Clickable table column headings to sort in both directions, with null values always last.
- Provider multi-filter (OpenCode Go, ChatGPT Plus, Claude Max), model search, and benchmark filter.
- **Fold-out columns**: a group header expands in place into its sub-columns. The parent shows the primary value, so the primary is never repeated as a sub-column (that repeat is what made earlier expandable columns read as ghost columns). Fold state persists.
- Clickable row selection with Use as baseline, Pin/Unpin, and Deselect actions.
- Any model may be baseline; DeepSeek Flash is merely the initial default. Baseline model remains available even if filtered out.
- Advanced filter bar supports Model, Provider, Favourite, TB4, DeepSWE, live metrics, API cost and Go allowance, with numerical comparisons and score presence.
- Baseline-relative filters are inactive while baseline comparisons are off; do not silently evaluate against a disabled baseline. Cost diff multipliers are unknown when baseline is disabled or its price is unavailable.
- Display settings: relative/absolute/off colouring, intensity, selectable columns, CSV of displayed rows and columns.
- Pinned models stay visible in the table and sort above regular rows, independent of other filters (unless favourites-only filtering is used).
- Persist preferences with localStorage where browser permissions allow.
- **Offline/standalone operation**: opened from disk with no helper running, the page must still render my rows and my own numbers, and must say plainly that live numbers are unavailable rather than showing blanks as if they were zero.
- Live refresh: the Refresh live button re-fetches now (`?force=1`). The page also quietly refreshes when it returns to the foreground, at most once every ten minutes.
- A source that fails returns its last good cached copy and is labelled stale. Never blank a column because a fetch failed.
- Relative colours: higher benchmarks and lower API prices are beneficial; equal/missing values should be neutral.

## Accuracy and research
- The hand-kept dataset is an *unverified working dataset* copied from a conversation on 2026-11-02, not an authoritative leaderboard. Validate facts before treating them as confirmed.
- Cite direct source links for exact benchmark version, model/checkpoint, evaluation harness, reasoning effort, date, API rates, cached-token rates and provider/model availability. Do not substitute benchmark variants or infer missing scores.
- Where Artificial Analysis lists several reasoning-effort rows for one model, the page shows the strongest variant and names it in the cell tooltip. Never present one effort as another.
- Keep subscription quota conceptually separate from reference API prices. Plus/Max usage is not billed at the displayed API rates. Claude Max subscription authentication is not officially supported in OpenCode; mark it as comparison-only where appropriate.
- Go allowance figures are monthly dollar-equivalent usage caps, *not* extra charges.
- 3:1 blended uncached reference price (USD per million combined tokens) = `(3*input + output)/4`. Relative blended cost is divided by the chosen model's blended reference price where available. Never label this as Artificial Analysis's current cache-aware 7:2:1 price without supplying and verifying cached-input costs.
- Record citations, verification status and retrieval dates for new or corrected rows.
- When a row says "no live match", the name spellings differ between my list and the live catalogs. Fix the row's name or accept the gap; do not fake a match.

## Workflow
1. Fetch AGENTS.md, the HTML, `live.mjs` and `server.mjs` from GitHub.
2. Verify requested changes against current primary docs/leaderboards; preserve unknowns as unknown.
3. Update the existing files and check sorting, filters, column folds, refresh, CSV and escaping.
4. Commit changes and link the GitHub file/commit, explaining corrections and remaining uncertainties.

## Response preferences
Concise, objective, use emojis in headings. Prefer one comprehensive sortable table over fragmented tables. Never assert a model is better solely on price.
