# 📱 WhatsApp / Social Link-Preview Plan (OG Image)

> Goal: make shared StudioPro links render a **large, premium card** in WhatsApp (and Twitter/X, LinkedIn, Facebook) instead of the current compact thumbnail card.
> Evidence: user's WhatsApp screenshot (2026-08-06) shows YouTube → large card, StudioPro → compact card, YouTube Shorts → tall card; plus the user's pasted breakdown of WhatsApp preview mechanics.

---

## 🧩 The mechanics (why the three cards differ)

Messaging platforms parse invisible `<meta>` tags — mainly **Open Graph** — to decide the preview layout. The screenshot shows three outcomes:

| Card | Source | Why WhatsApp picked that layout |
|---|---|---|
| **Large (full-width)** | YouTube standard | Wide 16:9 (1.91:1) thumbnail, ≥300 px wide, high-res, small enough — WhatsApp's parser is confident → large card |
| **Compact (left thumb)** | **StudioPro** ⚠️ | WhatsApp falls back to the small layout when the og:image doesn't meet the large-card requirements at *crawl time* (too small / wrong ratio / missing dimension tags / oversized file / **stale cache**) |
| **Tall (9:16)** | YouTube Shorts | Native vertical ratio recognized → tall container without cropping |

### WhatsApp's large-card requirements

| Spec | Ideal | Our current value |
|---|---|---|
| Dimensions | **1200 × 630 px** | ✅ declared 1200×630 |
| Aspect ratio | **1.91:1** (16:9 ok) | ✅ 1200/630 = 1.905 |
| File size | **< 300 KB** (hard cap ~600 KB) | ✅ 30 KB |
| Format | WebP / JPEG / PNG — **no SVG** | ⚠️ JPEG bytes, but named `.png` (see bug below) |
| URL | **Absolute** (`https://…`), reachable, 200 | ✅ absolute |
| `og:image:width` / `height` | Present | ✅ present |
| `og:image:type` | Present (recommended) | ❌ **missing** |
| Crawler cache | Busts on new URL / `?v=` | ⚠️ WhatsApp caches ~7 days (often longer) |

---

## 🔬 Current state of StudioPro's tags (verified in `index.html`)

```html
<meta property="og:title"       content="StudioPro | Free Online Video Editor">
<meta property="og:description" content="Free browser-based video editor: multi-track timeline, Markdown-to-video, captions, keyframe animations and fast MediaBunny export. Runs entirely in your browser.">
<meta property="og:url"         content="https://simplearyan.github.io/studio-pro/">
<meta property="og:image"       content="https://simplearyan.github.io/studio-pro/og-image.png">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt"    content="StudioPro — free browser-based video editor…">
<!-- missing: og:image:type -->
<meta name="twitter:card"  content="summary_large_image">
<meta name="twitter:image" content="https://simplearyan.github.io/studio-pro/og-image.png">
```

### The one concrete bug

`og-image.png` is **not a PNG** — it's a **JPEG** (`file` says *"JPEG image data, JFIF 1.01 … 1200×630"*; 30,268 bytes). GitHub Pages serves it with `Content-Type: image/png` because of the extension. Most crawlers sniff bytes and cope, but some parsers validate the MIME/extension pair and reject it — a plausible contributor to the compact fallback. Fix by re-encoding (or renaming to `.jpg`).

### The likely primary cause: WhatsApp's preview cache

Every tag requirement is already met (1200×630, 30 KB, absolute URL, dimension tags). The most common reason a *correctly-tagged* site still shows a compact card is that **WhatsApp's crawler cached the preview earlier** — before the OG pass shipped, or from an older/different image — and keeps serving it for ~7 days (often weeks). The only reliable cache-buster is a **new image URL**.

Also noted: the current image is a busy purple UI screenshot. It's technically valid, but a designed full-width banner reads better in the large layout and avoids any perceived "small thumbnail" crop.

---

## 🛠 The fix

### Phase 1 — Fix the image file + tags (15 min, highest impact)

1. **Produce a clean 1200×630 image, <300 KB, in a real format** (any of):
   - Re-encode with **cwebp / Squoosh / ffmpeg / Photoshop** → `public/og-image-v2.webp` (WebP, ~60–150 KB at 80% quality).
   - Or simplest: the bytes are already JPEG — copy `og-image.png` to `public/og-image-v2.jpg` (MIME then matches).
2. **Use a brand-new URL** to bust every crawler cache (WhatsApp's ~7-day cache included):

```html
<!-- AFTER (index.html head) -->
<meta property="og:image"       content="https://simplearyan.github.io/studio-pro/og-image-v2.webp?v=2">
<meta property="og:image:width"  content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type"   content="image/webp">   <!-- NEW: add this -->
<meta property="og:image:alt"    content="StudioPro — free browser-based video editor with Markdown-to-video, captions, keyframe animations and fast export">

<meta name="twitter:card"  content="summary_large_image">
<meta name="twitter:image" content="https://simplearyan.github.io/studio-pro/og-image-v2.webp?v=2">
```

   The `?v=2` query is the belt-and-suspenders for the platforms that honor it; the **new filename** is the real cache-buster.
3. **Keep `public/og-image.png`** — `vite.config.js`'s PWA manifest icon still references it (icons: `og-image.png`). Update the manifest icon to the new file only if you replace it. The repo-root `og-image.png` is legacy (GH Actions deploys `dist/`); `public/` is what ships.

### Phase 2 — Design a proper banner (optional, ~30 min)

A 1200×630 branded banner (dark theme, StudioPro wordmark, tagline, a clean mock of the timeline/editor) renders far better than a screenshot crop and avoids the "small thumbnail" look entirely. Keep it <300 KB (WebP). This is a design task, not code — the tags from Phase 1 are format-agnostic.

### Phase 3 — Verify (15 min)

| Checker | URL / method | Pass condition |
|---|---|---|
| WhatsApp | Send the link to **yourself** (`Message yourself`) | Large full-width card, new image |
| Facebook | Sharing Debugger → `https://developers.facebook.com/tools/debug/` | Scrape → image 1200×630, no warnings; then **"Scrape Again"** |
| LinkedIn | Post Inspector → `https://www.linkedin.com/post-inspector/` | Large image shown |
| X/Twitter | Card Validator → `https://cards-dev.twitter.com/validator` (login) | `summary_large_image`, image resolves |
| Head | `curl -sI https://simplearyan.github.io/studio-pro/og-image-v2.webp` | 200, `Content-Type: image/webp`, size < 300 KB |

> WhatsApp re-crawls on a **new URL** — the old compact card may persist for the ~7-day cache window for anyone who already has the old link cached, but new sends (and sends after the cache expires) will show the large card.

---

## 🏁 TL;DR

StudioPro's OG tags already meet WhatsApp's large-card specs (1200×630, 30 KB, absolute URL, dimension tags) — the compact card is a **stale cached preview** plus one real bug: **`og-image.png` is JPEG bytes served as `image/png`**. Fix = ship a clean re-encoded `og-image-v2.webp` (or `.jpg`) at a **new URL** with `og:image:type` added, keep the old file for the PWA manifest, and verify via the four debuggers above. Done in ~30 minutes, no code architecture involved.
