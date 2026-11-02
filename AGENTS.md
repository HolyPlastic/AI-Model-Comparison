# AGENTS.md — AI Model Comparison

## Purpose
Maintain a single interactive comparison of AI coding models available through OpenCode Go, ChatGPT Plus/Codex sign-in, and Claude subscriptions/API. Prioritize task-relevant benchmark evidence, speed, relative costs and usable subscription allowances.

## Canonical source
- Repository: `HolyPlastic/AI-Model-Comparison`.
- `ai-model-comparison.html` is the canonical standalone offline-capable dashboard.
- Read the current repository versions of this file and the HTML before any modification. Commit edits to the same files, rather than generating copies.

## Must preserve
- Clickable table column headings to sort in both directions, with null values always last.
- Provider multi-filter (OpenCode Go, ChatGPT Plus, Claude Max), model search, and benchmark filter.
- Cost view toggle: combined blended cost versus separate input/output and relative cost columns.
- CSV export. Compare relative cost against DeepSeek V4.1 Flash.

## Accuracy and research
- The initial dashboard is an *unverified working dataset* copied from a conversation on 2026-11-02, not an authoritative leaderboard. Previous conversations contained conflicting Go allowances and version identities. Validate facts before treating them as confirmed.
- Cite direct source links for exact benchmark version, model/checkpoint, evaluation harness, reasoning effort, date, API rates, cached-token rates and provider/model availability. Do not substitute benchmark variants or infer missing scores.
- Keep subscription quota conceptually separate from reference API prices. Plus/Max usage is not billed at the displayed API rates. Claude Max subscription authentication is not officially supported in OpenCode; mark it as comparison-only where appropriate.
- Go allowance figures are monthly dollar-equivalent usage caps, *not* extra charges.
- 3:1 blended uncached reference price (USD per million combined tokens) = `(3*input + output)/4`. Relative blended cost is divided by Flash's blended price `$0.2625` using its off-peak rates. Never label this as Artificial Analysis's current cache-aware 7:2:1 price without supplying and verifying cached-input costs.
- Record citations, verification status and retrieval dates for new or corrected rows.

## Workflow
1. Fetch AGENTS.md and the HTML from GitHub.
2. Verify requested changes against current primary docs/leaderboards; preserve unknowns as unknown.
3. Update the existing HTML and check sorting, filters, cost toggle, CSV and escaping.
4. Commit changes and link the GitHub file/commit, explaining corrections and remaining uncertainties.

## Response preferences
Concise, objective, use emojis in headings. Prefer one comprehensive sortable table over fragmented tables. Never assert a model is better solely on price.
