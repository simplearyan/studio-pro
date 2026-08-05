# 🚦 Lighthouse Report Analysis & Performance Roadmap

Latest run: **2026-08-05 · Lighthouse 13.3.0** against **https://simplearyan.github.io/studio-pro/** (Chrome 150, mobile emulation, simulated throttling, 3,478 benchmark index).

> Previous run (2026-08-05, earlier) is at the bottom for comparison. This run reflects the deployed **Lucide pin + CDN preconnects** — the previous version was still shipping `lucide@latest` with a 302 redirect.

---

## 📊 Scores (Latest Run)

| Category | Score | Verdict |
|---|---|---|
| **Performance** | ~97–99 | Excellent — 1 big item left (MathJax) |
| **Accessibility** | ~96–100 | 3 fixes committed (see below) — re-run to confirm |
| **Best Practices** | ~98 | Only item: missing source maps |
| **SEO** | ~100 | Full meta/OG/JSON-LD now shipped — re-run to confirm |

### Core Web Vitals

| Metric | Value | Grade | Target |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | **1.05 s** | 🟢 Excellent | < 2.5 s |
| **FCP** (First Contentful Paint) | **1.05 s** | 🟢 | < 1.8 s |
| **Speed Index** | **1.05 s** | 🟢 | < 3.4 s |
| **TBT** (Total Blocking Time) | **40 ms** | 🟢 Excellent | < 200 ms |
| **CLS** (Layout Shift) | **0.024** | 🟢 Excellent | < 0.1 |
| **TTI** (Interactive) | **1.74 s** | 🟢 | — |

**Bottom line:** the page is now *fast across the board*. Every Core Web Vital is green and LCP/FCP dropped **1.51 s → 1.05 s** (−31%) thanks to the pinned Lucide build (no 302) and the `unpkg` preconnect. The only meaningful performance lever left is **deferring MathJax**.

---

## 🔍 What's Actually Loading

12 requests · **~992 KB** total transfer (was 1.09 MB):

| Resource | Size (transfer) | Notes |
|---|---|---|
| Main document (`index.html`) | 194 KB / 1.20 MB raw | The entire app is one inline `<script>` — **781 KB unused (70%)** per treemap |
| MathJax `tex-svg.js` | **618 KB** (2.1 MB raw) | ✅ preconnected, but still **eager** on every visit — now the **#1 bottleneck** |
| Lucide icons `lucide@1.28.0` | 97 KB (414 KB raw) | ✅ **Pinned + preconnected** — direct `dist/umd` URL, HTTP 200, **no redirect**, h3 |
| Google Fonts (5 families, 3 woff2) | ~107 KB | Preconnects present; two families (`Google Sans`, `Gajraj One`) load dynamically |
| `export-worker.js` | 0.2 KB (225 KB raw) | ✅ Lazy-loaded worker — good |
| `main-*.js` / `.css` | 17 KB | Vite bundle — small |

### The bottlenecks that remain

1. **Eager MathJax (618 KB = 62% of all script bytes).** Fetched at startup even for users who never touch math. It also accounts for the **72 ms long task** at t≈1.67 s and ~44 ms of scripting in `bootup-time`.
2. **A 1.2 MB inline script, 70% unused.** Still the single biggest raw payload. This is why the doc transfer is 194 KB for what is effectively a small app.
3. **~190 ms third-party server latency** (fonts.googleapis, unpkg, GH Pages) — mostly masked now by preconnects; root document TTFB is a healthy **74 ms**.

---

## 🛠 Performance Fixes (ranked by impact ÷ effort)

### ✅ DONE — P2: Pin Lucide and drop the redirect

```html
<!-- WAS: 302 redirect on every load -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- NOW: direct file URL, HTTP 200, 1-year cache -->
<script src="https://unpkg.com/lucide@1.28.0/dist/umd/lucide.min.js"></script>
```

Verified in this report's network log: `lucide@1.28.0/dist/umd/lucide.min.js` → **200, no redirects, h3**. Part of the FCP/LCP improvement.

### ✅ DONE — P4: Preconnect to CDNs

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net">   <!-- MathJax -->
<link rel="preconnect" href="https://unpkg.com">          <!-- Lucide -->
```

Both visible in the head; jsdelivr now answers in ~41 ms server latency.

### P1 — Defer MathJax until it's needed ✅ High impact, 10 min (still open)

```html
<!-- BEFORE: fetched on every page load -->
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
```

```html
<!-- AFTER: only load when the user creates/edits a math element -->
<script>
  const loadMathJax = () => new Promise((res) => {
    if (window.MathJax) return res();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
    s.async = true;
    s.onload = res;
    document.head.appendChild(s);
  });
  // call loadMathJax() inside addMathClip() / the math tab, not at startup
</script>
```

**Expected:** removes **618 KB (62% of script bytes)** from the critical path and the 72 ms MathJax long task. LCP should land near **~0.8 s** and transfer drops to **~370 KB**.

### P3 — Lazy-load the big feature scripts (medium effort)

- Load MathJax only for math (P1).
- Move the giant inline app script into a **deferred module** (`<script type="module" src="app.js" defer>`) so the HTML shell paints instantly.
- Split `export-worker.js` already happens — keep it.

### P5 — Trim unused JS (781 KB)

1. Move **preset/markdown script data** (`MARKDOWN_PRESETS`) into a separate JSON fetched on demand — plain data, not logic.
2. Remove dead config keys and long-unused helpers.
3. Long-term: split the monolith into Vite modules (`index.html` + `src/*.js`) — same code, but tree-shaken and code-split.

---

## ♿ Accessibility (3 fixes — ✅ committed, re-run to confirm)

All three issues from the previous report were fixed in commit `b94f741` + the SEO pass:

| Issue | Fix (committed) |
|---|---|
| Export button has no accessible name | ✅ `aria-label="Export media"` + `title="Export"` |
| Playhead time popup contrast 4.46:1 | ✅ `bg-brand-600` → `bg-indigo-700` (≈8.8:1 light / 6.7:1 dark — passes WCAG AA) |
| Canvas color picker unlabeled | ✅ `aria-label` + Enter/Space `showPicker()` handler; removed `role="button"` (invalid on `<input>`) |

**Bonus in the SEO pass:** all `dark:text-surface-400/500` labels (2.9–4.2:1) bumped to `surface-300`, and light-theme `surface-400` labels to `surface-600` — the whole app now clears WCAG AA in **both** themes.

---

## 🛡 Best Practices / Security

| Finding | Status | Action |
|---|---|---|
| **Console errors** | ✅ **0 errors** — clean (previous extension error is gone) | — |
| **Missing source maps** | 🟡 score 0 | Inline script ships no source map. If code is split (P5), enable Vite `build.sourcemap`. |
| **No CSP header** | 🟡 High | GH Pages can't send custom headers — use `<meta http-equiv="Content-Security-Policy">` (permissive but real, e.g. `default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com; img-src * data:; media-src * blob:; connect-src *`). |
| **COOP / clickjacking / Trusted Types / HSTS preload** | 🟡 | Header-only — not settable via meta on GH Pages. Acceptable for a static site. |

---

## ✅ What's Already Excellent

- **CLS 0.024** — down from 0.065; only residual shift is the canvas wrapper during font load (0.024) plus a 0.00005 font swap.
- **TBT 40 ms** — no task exceeds 100 ms (longest: 78 ms, unattributable).
- **Zero console errors, no deprecated APIs, no third-party cookies, HTTPS everywhere.**
- **No image issues** — correct aspect ratios, no oversized/unsized images.
- **Worker-based export** keeps encoding off the main thread.
- Root document TTFB **74 ms**; server latency for GH Pages ~160 ms but hidden by preconnects.

---

## 📈 Expected After Remaining Fixes

| Metric | Now | After P1 (defer MathJax) |
|---|---|---|
| FCP / LCP | 1.05 s | **~0.8 s** |
| TTI | 1.74 s | **~1.4 s** |
| Max-Potential-FID | 72 ms | **< 60 ms** |
| Transfer size | 992 KB | **~370 KB** |
| Performance score | ~97–99 | **~99–100** |
| Accessibility | fixes committed | **100** (confirm on re-run) |

---

## 🧪 How to Re-measure

1. Build and push to GH Pages (or use the live URL) — the last SEO/a11y commit must be deployed for the a11y/SEO scores to show.
2. Lighthouse → **Analyze page load** → Mobile, default simulated throttling.
3. Or CLI:
   ```bash
   npx lighthouse https://simplearyan.github.io/studio-pro/ \
     --preset=perf --only-categories=performance,accessibility,best-practices --view
   ```
4. Re-run in an **incognito window** to exclude extension noise.

---

## 🏁 TL;DR

The site is now **fast everywhere**: LCP 1.05 s, TBT 40 ms, CLS 0.024, zero console errors. The Lucide pin + preconnects already paid off (FCP/LCP −31%). **The single remaining high-impact fix is deferring MathJax** (−618 KB, the last long task). Everything else — the 70%-unused inline script, source maps, CSP — is polish or structural, and the accessibility/SEO fixes are committed and just need a post-deploy re-run to confirm 100s.

---

## 📋 Previous Run (for reference — 2026-08-05, pre-fix)

| Metric | Then | Now |
|---|---|---|
| FCP / LCP | 1.51 s | **1.05 s** |
| Speed Index | 1.51 s | **1.05 s** |
| TBT | 40 ms | **40 ms** |
| CLS | 0.065 | **0.024** |
| TTI | 2.18 s | **1.74 s** |
| Lucide | `@latest` + 302 | **pinned 1.28.0, 200** |
| Console errors | 1 (extension) | **0** |
