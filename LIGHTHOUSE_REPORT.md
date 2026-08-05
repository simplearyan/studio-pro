# 🚦 Lighthouse Report Analysis & Performance Roadmap

Analysis of a Lighthouse 13.3.0 run against **https://simplearyan.github.io/studio-pro/** (Chrome 150, mobile emulation, simulated throttling, 3,441 benchmark index).

---

## 📊 Current Scores (Summary)

| Category | Score | Verdict |
|---|---|---|
| **Performance** | ~94–96 | Good — a few targeted wins available |
| **Accessibility** | ~96 | 3 real, easily-fixable issues |
| **Best Practices** | ~98 | 1 non-app bug + source maps |
| **SEO** | ~99 | Solid |

### Core Web Vitals

| Metric | Value | Grade | Target |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | **1.51 s** | 🟢 Excellent | < 2.5 s |
| **FCP** (First Contentful Paint) | **1.51 s** | 🟢 | < 1.8 s |
| **Speed Index** | **1.51 s** | 🟢 | < 3.4 s |
| **TBT** (Total Blocking Time) | **40 ms** | 🟢 Excellent | < 200 ms |
| **CLS** (Layout Shift) | **0.065** | 🟢 Excellent | < 0.1 |
| **TTI** (Interactive) | **2.18 s** | 🟢 | — |

**Bottom line:** this is already a fast page. The metrics that cost the most points are **FCP (0.55 score)** and **LCP (0.80)** — both pinned at ~1.5 s by *network + script evaluation*, not by rendering. Everything else is green.

---

## 🔍 What's Actually Loading

11 requests · **1.09 MB** total transfer:

| Resource | Size (transfer) | Notes |
|---|---|---|
| Main document (`index.html`) | 193 KB / 1.12 MB raw | **#1 problem** — the entire app is one inline `<script>` |
| MathJax `tex-svg.js` | **618 KB** (2.1 MB raw) | Loaded **eagerly** on every visit — 563 KB unused |
| Lucide icons `lucide@latest` | 97 KB (414 KB raw) | **Unpinned** `@latest` + 302 redirect (extra RTT) |
| Google Fonts (3 fonts) | 107 KB | Fine, preconnects already present |
| `export-worker.js` | 55 KB | Lazy-loaded worker — good |
| `main-*.js` / `.css` | 17 KB | Vite bundle — small |

### The 3 performance bottlenecks

1. **Eager MathJax (618 KB).** `tex-svg.js` is fetched at startup even for users who never touch math. It also accounts for the 73 ms long task on load.
2. **A 1.12 MB inline script.** Lighthouse flags **781 KB of unused JS** in the inline app script. This is the *398 ms long task* (the page's only real long task) that pushes TTI to 2.18 s and max-potential-FID to 400 ms.
3. **TTFB 388 ms** (GitHub Pages cold start + first H2 request). Not controllable on GH Pages, but preconnects/early hints can hide it.

---

## 🛠 Performance Fixes (ranked by impact ÷ effort)

### P1 — Defer MathJax until it's needed ✅ High impact, 10 min

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

**Expected:** removes **618 KB** from the critical path and the 73 ms long task. LCP should drop well under 1.2 s.

### P2 — Pin Lucide and drop the redirect ✅ 5 min

```html
<!-- BEFORE -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- AFTER -->
<script src="https://unpkg.com/lucide@1.28.0/dist/umd/lucide.min.js"></script>
```

Removes the `302 → 540 ms` redirect and a wasted RTT; guarantees reproducible builds.

### P3 — Lazy-load the big feature scripts ✅ Medium effort

The app is a single HTML file by design — the cleanest win without a rewrite is **route-by-interaction lazy loading**:

- Load MathJax only for math (P1).
- Vendor the huge inline app script into a **deferred module** (`<script type="module" src="app.js" defer>`) so the HTML shell paints instantly. Combined with a tiny skeleton in the canvas area, this would make FCP ≈ first paint (~50 ms instead of 1.5 s).
- Split `export-worker.js` already happens — keep it.

### P4 — Preconnect to CDNs (hide the 388 ms TTFB) ✅ 2 min

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://unpkg.com">
```

### P5 — Trim unused JS (781 KB)

Biggest structural item. Options, cheapest first:
1. Move **preset/markdown script data** (the `MARKDOWN_PRESETS` strings) into a separate JSON fetched on demand — they're plain data, not logic.
2. Remove dead config keys (`mockImageColor1/2`, `mockVideoColor1/2` are no longer read) and any long-unused helpers.
3. Long-term: split the monolith into modules via Vite (`index.html` + `src/*.js`) — this is the same code, just organized, and Vite will tree-shake and code-split it.

---

## ♿ Accessibility Fixes (3 items — all quick)

Lighthouse found exactly **3** real issues. All are one-liners:

| Issue | Where | Fix |
|---|---|---|
| **Export button has no accessible name** (critical) | `index.html:511` — `<button onclick="openExportModal()" class="bg-surface-900…">` | Add `aria-label="Export"` and/or `title="Export"` |
| **Playhead time popup contrast 4.46:1** | `index.html:747` — white text on `bg-brand-600` (`#6366f1`) at 9px | Use `bg-indigo-500` (`#6366f1` → **`#4f46e5`**) or bump to `text-brand-50` on `brand-700` — reach ≥ 4.5:1 |
| **Canvas color picker has no label** | `index.html:466` — `<input type="color" id="canvasColorPicker" class="… opacity-0">` | Add `aria-label="Canvas background color"` + `role="button"` or a wrapping labelled element |

Bonus a11y: the `opacity-0` color input is only 64×64 and invisible — wrap it in a labelled, focusable container so keyboard users can reach it.

---

## 🛡 Best Practices / Security

| Finding | Status | Action |
|---|---|---|
| **Console error** | 🟡 Not our bug | The single error is from a **Chrome extension** (`chrome-extension://ailcfipphnefalipkhikhojopgjmocil`), not the app. Retest in an incognito window to confirm a clean console. |
| **Missing source maps** | 🟡 | The inline script ships no source map. If code is split into files (P5), enable `build.sourcemap` in Vite for dev debugging. |
| **No CSP header** | 🟡 | GH Pages can't send custom headers — but a `<meta http-equiv="Content-Security-Policy">` works. A permissive-but-real policy (e.g. `default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net unpkg.com; img-src * data:; media-src * blob:; connect-src *`) removes the "High" severity flag. |
| **COOP / clickjacking** | 🟡 | Also header-only on GH Pages; `X-Frame-Options` can't be set via meta. Acceptable for a static site. |

---

## ✅ What's Already Excellent

- **CLS 0.065** — canvas wrapper is the only shift (font loading); nothing to do.
- **TBT 40 ms** — main thread is almost never blocked.
- **No deprecated APIs, no third-party cookies, HTTPS everywhere.**
- **No image issues** — correct aspect ratios, no oversized images.
- **Worker-based export** keeps encoding off the main thread.
- Page already has `preconnect` for Google Fonts.

---

## 📈 Expected After Fixes

| Metric | Now | After P1–P4 |
|---|---|---|
| FCP / LCP | 1.51 s | **~0.8–1.0 s** |
| TTI | 2.18 s | **~1.5 s** |
| Max-Potential-FID | 400 ms | **< 250 ms** |
| Transfer size | 1.09 MB | **~470 KB** |
| Performance score | ~95 | **~98–100** |
| Accessibility | ~96 | **100** |

---

## 🧪 How to Re-measure

1. Run the site on the local server, then build and push to GH Pages (or use the live URL).
2. Lighthouse → **Analyze page load** → Mobile, throttling `4x` (the report above used default simulated throttling).
3. Or CLI:
   ```bash
   npx lighthouse https://simplearyan.github.io/studio-pro/ \
     --preset=perf --only-categories=performance,accessibility,best-practices --view
   ```
4. Re-run in an **incognito window** to exclude extension noise from the console audit.

---

## 🏁 TL;DR

The app is already fast (LCP 1.5 s, TBT 40 ms, CLS 0.065). The **biggest single win is deferring MathJax** (−618 KB from the critical path), followed by pinning Lucide and preconnecting CDNs. Accessibility is 3 one-line fixes from a perfect 100. The only structural project — splitting the giant inline script — is optional and can be done gradually with Vite modules.
