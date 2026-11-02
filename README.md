# 📊 AI Model Comparison

**[🚀 Open the interactive comparison in your browser](https://htmlpreview.github.io/?https://github.com/HolyPlastic/AI-Model-Comparison/blob/main/ai-model-comparison.html)**

This preview opens the latest committed HTML directly from the repository without installing anything. Bookmark the link to launch it whenever you need it. The preview service is third-party and may cache changes temporarily.

## Local / offline launch

Download [ai-model-comparison.html](ai-model-comparison.html) and double-click to open it in a browser. No install, build, or server required.

## Filters, comparisons, favourites and display

- **+ Filter:** add Provider, Model, Favourite, TB4, DeepSWE, API cost or Go allowance conditions. Metric operators include greater/less than, baseline-relative comparisons and missing scores. Multiple filters intersect; multiselected values within a choice filter combine as alternatives.
- **Click a model row:** choose **Use as baseline**, **Pin/Unpin**, or **Deselect**. Pinned models remain visible and appear at the top of the table even when other filters would hide them. Use **Favourites only** to focus on pinned models.
- **Baseline:** choose a reference from the selector or by row action. Turning comparison off disables baseline-relative filters and cost-difference multipliers.
- **Display:** choose combined cost (labelled **Cost**) or input/output cost; show/hide columns, adjust relative/absolute/off colouring and intensity.
- **Preferences:** saved locally in your browser. On another browser or device, settings and favourites do not automatically sync. **Reset view** restores defaults, including visible columns and baseline, without deleting favourites.
- **CSV:** exports the currently displayed columns and rows, including pinned models.
- **Sorting:** click a column heading; click again to reverse. Missing scores sort last.

**Important:** The dataset is a working draft containing unverified claims. API price references are *not* ChatGPT Plus or Claude Max subscription charges. See [AGENTS.md](AGENTS.md) for verification and maintenance instructions.

## GitHub Pages (optional permanent first-party URL)

If you want a GitHub-hosted public URL rather than the external preview service, enable **Settings → Pages → Deploy from a branch → main / (root)** and use the resulting Pages domain with `/ai-model-comparison.html`. This requires repository settings permissions.
