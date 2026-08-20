# 🚦 Lighthouse Report Analysis & Performance Roadmap

Latest run: **2026-08-14 · Lighthouse 13.4.0** against **https://simplearyan.github.io/studio-pro/** (Chrome 151, mobile emulation, simulated throttling, 3,353 benchmark index). Full JSON supplied by the user; raw numbers below are from that report.

> ⚠️ Run caveats (from the report's `runWarnings`): (1) *"Clearing the browser cache timed out"* — the SW precache may have served part of this load, so the numbers are likely *better* than a true cold cache; (2) *"There may be stored data affecting loading performance in this location: IndexedDB"* — the audited session restored a saved project (**658 clips / 654 captions**), which shows up as the 446 ms long task. Both caveats make this run representative of a **returning user**, not a first visit.

---

## 📊 Scores (Latest Run, 2026-08-14)

| Category | Score | Verdict |
|---|---|---|
| **Performance** | **≈81** (est. from metric scores) | 🟡 Regressed — see analysis below |
| **Best Practices** | ~96–98 | Only fail: missing source maps (score 0) |
| **Accessibility** | ~96–100 | No a11y fails in this report |
| **SEO** | ~100 | Full meta/OG/JSON-LD present |

### Core Web Vitals

| Metric | Value | Grade | Previous (08-05) | Target |
|---|---|---|---|---|
| **FCP** | **1.82 s** | 🟡 score 0.38 | 1.05 s 🟢 | < 1.8 s |
| **LCP** | **1.82 s** | 🟢 score 0.69 | 1.05 s 🟢 | < 2.5 s |
| **Speed Index** | **1.94 s** | 🟡 score 0.64 | 1.05 s 🟢 | < 3.4 s |
| **TBT** | **124 ms** | 🟢 score 0.94 | 40 ms 🟢 | < 200 ms |
| **CLS** | **0.010** | 🟢 score 1.0 | 0.024 🟢 | < 0.1 |
| **TTI** | **2.14 s** | 🟢 score 0.94 | 1.74 s 🟢 | — |
| Max-Potential-FID | 446 ms | 🟡 | 72 ms | — |

**Bottom line:** the *best-practices* work landed (zero console errors, CLS actually improved 0.024 → 0.010, all offline vendoring in place), but **FCP/LCP regressed 1.05 s → 1.82 s**. The page got measurably heavier since the 08-05 run and the app now restores a large saved project on every boot. Everything below is about getting back under 1.2 s.

---

## 🔍 Why It Regressed (evidence from the 2026-08-14 network log)

15 requests · **~1.30 MB** total transfer (was 992 KB). The four things that moved the needle:

1. **The main document is now 344 KB transfer / 1.85 MB raw** (was 194 KB / 1.20 MB). It downloads from t=11 ms → **t=1056 ms (≈1 s just for the HTML)** because the entire app is still one giant inline `<script>` that keeps growing with every feature. The treemap shows **1.15 MB (65%) of that inline script is unused at load**. This is the #1 FCP cost.
2. **Eager MathJax is still loaded on every visit.** The vendored `tex-svg.js` (687 KB transfer / 2.1 MB raw) is fetched at boot (t=932 → 4397 ms) even though the audited project contains **no math clips**. It's `async` so it doesn't block parse, but it costs bandwidth + a 76 ms parse task at t≈2.07 s.
3. **The saved project is restored synchronously at boot** → a **446 ms long task** at t≈1.39 s ("Unattributable" = restore + 658 clips/654 captions render). That's 90% of the 446 ms Max-Potential-FID and the bulk of TBT's cousins.
4. **Three render-blocking `fonts.googleapis.com` stylesheets** (Google Sans, Gajraj One, Anek Devanagari — user fonts stored in the project's `studiopro_google_fonts`) are re-imported at boot (t≈1146 ms, ~190 ms server latency each). Dynamically-inserted stylesheets block rendering while loading → directly delays FCP/LCP.

Plus two environment notes: TTFB was **326 ms** this run (74 ms last run — GH Pages cold cache; the cache-clear timeout warning confirms it), and the four critical woff2 (Plus Jakarta Sans, JetBrains Mono, Rubik, Inter) only start downloading at **t≈1331 ms** — after `fonts.css` parses — so they sit in the LCP path.

### What the 1.30 MB actually is

| Resource | Transfer | Raw | Notes |
|---|---|---|---|
| Main document (`index.html`) | **344 KB** | **1.85 MB** | The whole app in one inline script — 65% unused |
| MathJax `tex-svg.js` (local vendor) | **687 KB** | 2.1 MB | ✅ offline-safe, but still **eager on every visit** — the #1 lever |
| Lucide `lucide@1.28.0` (CDN) | 97 KB | 414 KB | ✅ pinned, fast (t=537→763 ms), no redirect |
| `fonts.css` + 4 woff2 (local vendor) | 143 KB | — | ✅ all local; start late (t≈1331 ms) |
| 3 × `fonts.googleapis.com` CSS | 3.5 KB | 38 KB | ⚠️ user fonts re-imported at boot — **render-blocking** |
| `main-*.js` / `.css` | 21 KB | 115 KB | Vite bundle — fine |
| `export-worker.js` | 0.4 KB | 225 KB | ✅ lazy worker, loaded off critical path |
| Inline data-URI font | 12.7 KB | — | Embedded OTF in the HTML |

### Long tasks this run (8)

| Task | Start | Duration | Cause |
|---|---|---|---|
| **446 ms** | 1.39 s | "Unattributable" | Autosave restore of 658 clips / 654 captions + first render |
| **245 ms** | 0.93 s | inline app script | Boot init + `lucide.createIcons()` over the whole DOM |
| **120 ms** | 1.87 s | inline app script | Post-FCP render (restore continuation) |
| 88 ms | 0.84 s | Unattributable | Early layout |
| 88 ms | 1.99 s | inline app script | Render |
| 76 ms | 2.07 s | `tex-svg.js` | MathJax startup |
| 75 ms | 1.24 s | inline app script | Restore |
| 61 ms | 1.32 s | Unattributable | — |

---

## 🛠 Fix Plan (ranked by impact ÷ effort)

### ✅ Already done since the last report

- **Zero console errors** (`errors-in-console` score 1) — the offline vendoring (Lucide + Google Fonts + MathJax local) plus the boot shim/fallback killed the `ERR_INTERNET_DISCONNECTED` / `lucide is not defined` failures from the previous debug session.
- **CLS improved 0.024 → 0.010** (score 1.0) — only residual shifts: the canvas wrapper while fonts load (0.0104) and the Re-import modal reflowing on web-font swap (0.0056).
- Fonts, MathJax and Lucide are all offline-safe; the SW precaches everything (76 entries) and runtime-caches the last CDN calls.

### P0 — Defer MathJax until it's actually needed ✅ highest impact ÷ effort (10 min)

The vendored bundle is still fetched on every boot. Load it on demand — the first time a math clip is created/edited/rendered:

```html
<!-- BEFORE (index.html head): fetched on every visit -->
<script id="MathJax-script" async src="vendor/mathjax/tex-svg.js"></script>
```

```html
<!-- AFTER: only fetched when the user touches math -->
<script id="MathJax-script"></script>
<script>
  window.__loadMathJax = function () {
    return new Promise(function (res) {
      if (window.MathJax && window.MathJax.tex2svg) return res();
      var s = document.createElement('script');
      s.src = 'vendor/mathjax/tex-svg.js';   // keep the local vendored path
      s.async = true;
      s.onload = function () { try { MathJax.startup && MathJax.startup.ready && MathJax.startup.ready().then(res); } catch (e) { res(); } };
      s.onerror = res;
      document.getElementById('MathJax-script').after(s);
    });
  };
  // call __loadMathJax() inside addMathClip() / the math tab / export, never at boot
</script>
```

**Expected:** −687 KB transfer, −76 ms task, and the fetch window t=932→4397 ms disappears from every non-math session.

### P0 — Defer the autosave restore past first paint (30–60 min)

The 446 ms restore task sits at t≈1.39 s. `restoreAutosavedProject()` (`index.html:2214`) runs synchronously at boot. Wrap it:

```js
// BEFORE: runs inline during boot, blocking first paint
restoreAutosavedProject();

// AFTER: let the shell paint first, then restore in idle time
if ('requestIdleCallback' in window) {
  requestIdleCallback(function () { restoreAutosavedProject(); }, { timeout: 1500 });
} else {
  setTimeout(restoreAutosavedProject, 250);
}
```

Then split the per-clip DOM/canvas work into chunks (`setTimeout(..., 0)` per N clips) so nothing blocks the main thread for 446 ms. **Expected:** Max-Potential-FID 446 → < 100 ms, TBT cut roughly in half.

### P1 — Extract the giant inline script into a real file (half a day)

The app script (`<script>` right before `</body>`, currently ~27k lines / 1.75 MB) should move to `src/app.js` and load with `defer`. This is the single biggest FCP lever:

- **HTML parse no longer blocked** — the document drops to ~30 KB and parses instantly (the 1 s document download becomes ~50 ms).
- **Vite minifies it** (the inline copy is unminified HTML, so it ships whitespace + comments): 1.85 MB raw → ~400–500 KB, gzip ~100 KB.
- **Caching + SW precache** — hashed asset (`assets/app-*.js`), cached forever, already in the precache manifest.
- **Enables source maps** (see P3) and a workable CSP (P4).

Mechanically safe: the app already runs as one top-level script that reaches `window.*` functions from inline `onclick` attributes — extraction keeps every global on `window` (they already are). Keep the small inline shims (theme, lucide, MathJax config) in the head.

### P1 — Non-blocking Lucide + deferred `createIcons` (20 min)

The 245 ms boot task includes `lucide.createIcons()` at `index.html:1096`, and the CDN script is a classic (render-blocking) tag. Make it async and run icon replacement after the DOM is ready:

```html
<script async src="https://unpkg.com/lucide@1.28.0/dist/umd/lucide.min.js"
        onerror="window.__loadLocalLucide && window.__loadLocalLucide()"></script>
```

```js
// boot: replace the eager call with a post-DOMContentLoaded one
function bootIcons() { try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) {} }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootIcons);
else bootIcons();
```

### P2 — Preload the four critical woff2 (10 min)

The critical fonts start at t≈1331 ms because they wait for `fonts.css`. Preload them so they download in parallel with the CSS:

```html
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="fonts/plusjakartasans-v12-LDIoaomQNQcsA88c7O9yZ4KMCoOg4Ko20yw.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="fonts/rubik-v31-iJWKBXyIfDnIV7nBrXw.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="fonts/jetbrainsmono-v24-tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="fonts/inter-v20-UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2">
```

**Expected:** shaves ~400–600 ms off LCP. (Names must match `public/fonts/` exactly; verify with a build.)

### P2 — Defer the user-font re-import at boot (20 min)

`loadGoogleFonts()` re-inserts the 3 render-blocking googleapis stylesheets during restore. Gate it on idle and/or make it non-blocking:

```js
// in the restore path — don't block first paint on user fonts
requestIdleCallback(function () { loadGoogleFonts(); }, { timeout: 3000 });
// and/or inject with media="print" onload-swap so it never blocks render:
//   link.media = 'print'; link.onload = function(){ this.media = 'all'; };
```

**Expected:** removes ~190 ms × 3 of render-blocking latency from FCP. (Also covered by the SW's `google-fonts` runtime cache for repeat visits.)

### P3 — Ship source maps for the first-party chunks (5 min, fixes the only BP fail)

`valid-source-maps` is score 0 — it flags the inline document script, `tex-svg.js` (vendored, no map shipped upstream), and Lucide (map URL present but from unpkg).

- `vite.config.js` → `build.sourcemap: true` (or `'hidden'` if you don't want to expose sources). This fixes the **inline script** once it's extracted (P1) and the `main-*.js` / worker chunks.
- **`tex-svg.js` will likely stay flagged** — MathJax 3's `es5` bundle ships no sourcemap, and it's served from our origin so Lighthouse treats it as first-party. Accept it (it's a vendored dependency) or exclude it from the map audit; not worth chasing.

### P4 — CSP + security headers (informative, don't affect score)

The report's security audits are all **informative** (no score impact): no CSP (High), no HSTS `includeSubDomains`/`preload`, no COOP, no XFO, no Trusted Types.

- **CSP via `<meta http-equiv="Content-Security-Policy">` is possible today** but weak: until the inline script is extracted (P1) we'd need `script-src 'unsafe-inline'`, which the audit still flags. Plan: after P1, a real policy — `default-src 'self'; script-src 'self' https://unpkg.com 'unsafe-eval'` (`'unsafe-eval'` is required by MathJax 3's `Function` usage) with a nonce on the remaining small inline shims; `object-src 'none'; frame-ancestors 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; worker-src 'self' blob:; connect-src 'self' https:`.
- **HSTS / COOP / XFO are header-only** — GitHub Pages cannot send custom headers, so they're not settable from this repo. If you ever want them, move the deploy to Cloudflare Pages / Netlify / Vercel (they accept a `_headers` file) — the exact headers are documented in `docs/features/Offline-Dev-Server-Plan.md`'s security appendix mindset. Acceptable for a static tool.

### P4 — Re-import overlay font-swap shift (minor)

One of the two layout shifts (0.0056) is the Re-import modal's text reflowing as the web font swaps. Cheap mitigation: `min-height` on the modal body or `font-display: swap` is already active — this is cosmetic; total CLS stays green regardless.

---

## ✅ What's Already Excellent

- **CLS 0.010 (score 1)** — improved from 0.024; only the canvas wrapper during font load + a tiny modal reflow.
- **Zero console errors** — offline vendoring + shims are holding up in production.
- **No deprecated APIs, no third-party cookies, HTTPS everywhere, no image issues.**
- **Worker-based export** keeps encoding off the main thread (lazy, 0.4 KB transfer).
- **Offline story complete** — everything precached + runtime-cached; this run's TTFB/font numbers are *with* a warm SW, i.e. the best case for repeat users.

---

## 📈 Expected After P0–P2

| Metric | Now (08-14) | After P0 (MathJax + restore deferral) | After P1–P2 (extract script, lazy icons, font preloads) |
|---|---|---|---|
| FCP / LCP | 1.82 s | ~1.3–1.4 s | **~0.9–1.1 s** |
| TTI | 2.14 s | ~1.7 s | **~1.4 s** |
| Max-Potential-FID | 446 ms | < 150 ms | **< 100 ms** |
| TBT | 124 ms | ~60–80 ms | **< 60 ms** |
| Transfer size | 1.30 MB | ~600 KB (non-math) | **~250 KB** |
| Performance score | ≈81 | ~90 | **~97–99** |
| Best Practices | ~96 | ~96 | **~100** (source maps) |

---

## 🧪 How to Re-measure

1. Implement P0 first (both deferrals), build, push to GH Pages.
2. Re-run in an **incognito window** (this run's IndexedDB warning means the saved project skewed the numbers):
   ```bash
   npx lighthouse https://simplearyan.github.io/studio-pro/ \
     --preset=perf --only-categories=performance,best-practices --view
   ```
3. Compare FCP/LCP/TBT and the long-task list — the 446 ms restore task and the 687 KB MathJax fetch should both be gone.

---

## 🏁 TL;DR

The 08-14 run proves the **reliability** work paid off — zero console errors, CLS down to 0.010, everything offline-safe — but the page **regressed on speed**: FCP 1.05 → 1.82 s because the inline app script grew to 344 KB transfer and boot now does a synchronous 658-clip restore (446 ms task) plus an eager 687 KB MathJax fetch plus 3 render-blocking user-font stylesheets. **Do P0 first** (defer MathJax on demand + defer the autosave restore past first paint) — that alone should recover ~0.4–0.5 s and most of the Max-Potential-FID. **P1** (extract the inline script to a real `src/app.js` with `defer`) is the structural fix that unlocks minification, caching, source maps and a real CSP. Best Practices only fails on missing source maps (`build.sourcemap: true`); the security header audits are informative and can't be fixed on GitHub Pages.

---

## 📋 History

| Metric | 08-05 (pre-fix) | 08-05 (post-fix) | 08-14 (latest) |
|---|---|---|---|
| FCP / LCP | 1.51 s | **1.05 s** | 1.82 s |
| Speed Index | 1.51 s | **1.05 s** | 1.94 s |
| TBT | 40 ms | **40 ms** | 124 ms |
| CLS | 0.065 | **0.024** | **0.010** ✅ |
| TTI | 2.18 s | **1.74 s** | 2.14 s |
| Transfer | 1.09 MB | **992 KB** | 1.30 MB |
| Lucide | `@latest` + 302 | **pinned 1.28.0, 200** | pinned 1.28.0, 200 |
| MathJax | CDN, eager | CDN, eager | **local vendor, still eager** |
| Console errors | 1 (extension) | **0** | **0** |
| Offline boot | ❌ crashed | ❌ crashed | ✅ fully offline-safe |
