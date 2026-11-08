# 📊 AI Model Comparison

One interactive table of the AI coding models I can actually reach (OpenCode Go, ChatGPT Plus, Claude Max), with the live numbers filled in from Artificial Analysis and OpenRouter.

## 🏠 Run it locally (the full version, with live numbers)

Double-click **`+_START_+.bat`**. It starts the local helper if it is not already running and opens [http://127.0.0.1:8099](http://127.0.0.1:8099).

- The **↻ Refresh live** button re-fetches both sources now. The page also quietly refreshes when you come back to it, at most once every ten minutes.
- Nothing else needs to be installed. Node only. `+_STOP_+.bat` stops the helper.
- The helper is the only part that talks to Artificial Analysis, so the API key stays out of the browser. Everything is fetched server-side, merged, and cached on disk for six hours (a failed fetch reuses the last good copy and says so).

## 🌐 Offline and Pages

`ai-model-comparison.html` still opens by double-click with no helper. You get my rows and my numbers; the live columns show a dash and the live bar says the helper is not running. The same file works on GitHub Pages, and there the live columns stay empty by design.

**[🚀 Open the interactive comparison in your browser](https://htmlpreview.github.io/?https://github.com/HolyPlastic/AI-Model-Comparison/blob/main/ai-model-comparison.html)**

## 📈 What is live and what is mine

| Live, refreshed on demand | Mine, hand-kept |
|---|---|
| Intelligence index, Engineering index (Artificial Analysis) | Provider (OpenCode Go / ChatGPT Plus / Claude Max) |
| Standard list price in/out, cache-hit price | TB4, DeepSWE |
| Context window, max output, tool support (OpenRouter) | Go allowance |
| Tokens per second, time to first token (AA) | My own reference prices (kept as sub-columns) |

The free Artificial Analysis tier carries no coding or agentic index, which is why the page shows Intel and Engineering rather than Code and Agentic. Prices in the Cost column are the standard list rate; OpenRouter's cheapest partner listing is often half and would distort the comparison, so it is not used for money.

## 🧰 Filters, comparisons, favourites and display

- **+ Filter:** add Provider, Model, Favourite, TB4, DeepSWE, live metrics, API cost or Go allowance conditions. Metric operators include greater/less than, baseline-relative comparisons and missing scores. Multiple filters intersect; multiselected values within a choice filter combine as alternatives.
- **Click a model row:** choose **Use as baseline**, **Pin/Unpin**, or **Deselect**. Pinned models remain visible and appear at the top of the table even when other filters would hide them. Use **Favourites only** to focus on pinned models.
- **Baseline:** choose a reference from the selector or by row action. Turning comparison off disables baseline-relative filters and cost-difference multipliers.
- **Display:** a column with a ▸ next to its name folds open into more columns in place. Cost opens into $/M in, $/M out, cache-hit and my own prices; Cost diff into input and output multipliers; Intel into Engineering; Context into max output; Speed into time to first token. Choose relative/absolute/off colouring and intensity, and pick which columns show.
- **Include models not in my list** adds every scored model from Artificial Analysis that my list does not cover (in italics).
- **Preferences:** saved locally in your browser. On another browser or device, settings and favourites do not automatically sync. **Reset view** restores defaults, including visible columns, folds and baseline, without deleting favourites.
- **CSV:** exports the currently displayed columns and rows, including pinned models.
- **Sorting:** click a column heading; click again to reverse. Missing scores sort last.

**Important:** TB4, DeepSWE, provider and Go allowance are a working draft containing unverified claims. API price references are *not* ChatGPT Plus or Claude Max subscription charges. See [AGENTS.md](AGENTS.md) for verification and maintenance instructions.

## 🔧 GitHub Pages (optional permanent first-party URL)

Enable **Settings → Pages → Deploy from a branch → main / (root)** and use the resulting Pages domain with `/ai-model-comparison.html`. This requires repository settings permissions. Live columns need the local helper and stay empty there.
