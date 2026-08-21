# 🧪 Capability Test — Can StudioPro generate its own OG image in the canvas editor?

> **Date:** 2026-08-14 · Live test driven programmatically in the running editor (exactly how an AI agent would drive it), on the user's real project (658 clips / 654 captions), then fully restored.
> **Framing:** this is the first *hands-on* step toward the HyperFrames-style future — *user gives a prompt, StudioPro builds the thing*. Here the "thing" is a 1200×630-class social/OG image. If the editor can do **that** through its own APIs, it can do anything the timeline can render.

---

## 🏁 TL;DR — Yes, it works

The editor produced a **share-ready OG image entirely in-app, programmatically**, in ~3 minutes of script:

- Indigo background (#312e81) + **STUDIOPRO** (Google Font **Bangers**, yellow #ffe600, drop shadow) + tagline "Free browser-based video editor" (**Plus Jakarta Sans**, white)
- Rendered at **1920×1080** (16:9) and exported as **WebP = 27 KB** (PNG ≈ 149 KB, JPEG ≈ 81 KB) — comfortably under WhatsApp's 300 KB large-card limit
- Same flow works at **9:16 (1080×1920), 1:1 (1920×1920), 4:3 (1920×1440)** — WebP 42–47 KB each
- Fonts were fetched live from Google Fonts and confirmed loaded (`document.fonts.check()` → true) before rendering
- Pixel-verified: 34,160 yellow brand pixels + 3,979 white tagline pixels on the indigo canvas — text really rendered, not fallback

**Verdict:** the editor already has every capability needed to generate production-quality static graphics — fonts, colors, shadows, aspect ratios, and a 1080p WebP export — **but only through low-level, footgun-prone globals**. The gap to "AI does this in seconds" is an API/schema problem, not a rendering problem. See the roadmap at the bottom.

---

## 🔬 The test (script, condensed)

What an agent had to know and call — all globals, no UI clicks except creating clips:

```js
// 1. Look of the frame
State.canvasBgColor = '#312e81';

// 2. Load a display font + body font from Google Fonts, WAIT for it
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=Bangers:wght@400&display=swap';
document.head.appendChild(link);
await document.fonts.load('100px "Bangers"');           // ← must await, or the export
await document.fonts.load('100px "Plus Jakarta Sans"'); //   captures the fallback font

// 3. Create a text clip (only via simulating the toolbar button — no direct API)
document.getElementById('btnAddText').click();
const brand = State.clips.find(c => c.type === 'text' && !origIds.has(c.id));

// 4. Style it via the global effect setter
setClipEffect(brand.id, 'fontFamily', 'Bangers');
setClipEffect(brand.id, 'fillColor', '#ffe600');
setClipEffect(brand.id, 'fontSize', 110);
setClipEffect(brand.id, 'scale', 1.3);
setClipEffect(brand.id, 'offsetY', -10);                // ← % of canvas, not px (see footguns)
setClipEffect(brand.id, 'shadowEnable', true);
setClipEffect(brand.id, 'shadowBlur', 36);
setClipEffect(brand.id, 'text', 'STUDIOPRO');           // ← ⚠️ silently does NOTHING (see footguns)

// 5. Playhead inside the clip, then export the frame
State.currentTime = brand.start + 0.1;
drawCanvas();
localStorage.setItem('studiopro_frameExportConfig', JSON.stringify({ resolution: 1920, format: 'webp' }));
const { canvas, w, h } = await renderFrameCanvas();     // ← the real export path
const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.92));
// blob.size = 27 KB, w×h = 1920×1080 ✅
```

The screenshot showed the result on the live preview canvas: yellow **STUDIOPRO** (Bangers + shadow) over **STUDIOPRO**-indigo, white tagline underneath.

---

## 📊 Measured results

| Aspect | Export size (WebP @0.92) | Formats at 16:9 | Fonts loaded | Pixel proof |
|---|---|---|---|---|
| 16:9 → 1920×1080 (clean still) | **27.3 KB** | WebP 27 KB · PNG 149 KB · JPEG 81 KB | Bangers ✅ · Plus Jakarta Sans ✅ | 34,160 yellow + 3,979 white |
| 16:9 → 1920×1080 (full timeline) | 41.6 KB | — | — | — |
| 9:16 → 1080×1920 | 42.5 KB | — | — | — |
| 1:1 → 1920×1920 | 46.8 KB | — | — | — |
| 4:3 → 1920×1440 | 45.1 KB | — | — | — |

All under WhatsApp's 300 KB target; all rendered by `renderFrameCanvas()` → `drawCanvas(ctx, w, h)` — the same pipeline the camera-icon export uses.

---

## 🕳️ Friction found (the honest part — these cost ~10 of the 15 minutes)

1. **Clip text is NOT an effect.** `setClipEffect(clipId, 'text', ...)` silently no-ops — text is a direct property (`clip.text = '...'`), set only by the properties textarea. An agent calling `setClipEffect` for text gets no error and no change. (This is the bug in the script above — line marked ⚠️.)
2. **`offsetX/offsetY` are % of canvas, not pixels.** Setting `offsetY: 130` pushes text **+1,400 px below center** — off-canvas, silently. First render had *zero* text pixels; had to switch to `-10 / +13`.
3. **Captions render into the frame.** Subtitle drawing is separate from clip visibility; the export includes captions unless you pass `{ skipSubtitles: true }` to `drawCanvas`. Fine for video stills, wrong for a logo card.
4. **No direct "add text clip" API.** Creating one means clicking `#btnAddText` and finding the new clip by diffing ids — or copy-pasting the 40-key effects object literal.
5. **Font loading is fire-and-forget.** `loadGoogleFonts()` injects a stylesheet and returns; nothing awaits it. You must `document.fonts.load()` yourself before exporting, or the frame captures the fallback font.
6. **Aspect is index-based.** `State.preview.aspectIndex` (0–5), not `'16/9'` — fine for humans, opaque for AI.
7. **Export is download-oriented.** `exportFrame()` triggers a browser download; the useful piece (`renderFrameCanvas()`) returns the canvas, but nothing exposes "render me a Blob at 1200×630 webp" as one call.
8. **Real timelines interfere.** The audited project has full-canvas videos + captions; a "clean" still requires hiding 658 clips (and the Re-import modal pops when media is missing). An OG-image generator needs an isolated scene or an explicit "stills-only" mode.

---

## 🤖 AI-readiness roadmap (what to build so prompt → video/graphic is fast)

The future is HyperFrames-style: *"make me a poster with STUDIOPRO in Bangers on indigo"* → done in seconds. The rendering engine already does the hard part. What's missing is a **thin, declarative API layer** on top:

### P0 — `renderProjectFrame(opts)` → Blob (30–60 min)
One call that does the whole pipeline: `{ t, aspect: '16/9'|'9:16'|'1:1', resolution: 1920, format: 'webp', skipCaptions: true }` → Blob. Wraps `renderFrameCanvas()` + `toBlob`, awaits fonts, no downloads. This alone un-blocks every downstream AI tool.

### P0 — First-class clip creation + text setter
`addTextClip({ text, fontFamily, fontSize, fillColor, offsetX, offsetY, shadow, bg })` → clip id, and make **`setClipText(id, value)`** a real function. Kill footguns 1, 2, 4 by accepting **pixel** offsets (or a `%` flag).

### P1 — `awaitFonts(families)` 
Promise that resolves when every requested family is loaded (wraps `document.fonts.load` + link injection). The AI shouldn't know CSS details.

### P1 — AI-friendly project schema + presets
A documented JSON schema of the timeline (clips, effects, tracks — already serialized by `serializeProject()`) plus a "template" concept: a collection of presets (the existing text/color/background presets) that a prompt maps onto. This is the seed of HyperFrames-style design templates (see `docs/hyperframes/Design-Templates-and-Skills-Plan.md`).

### P2 — Stills-only mode / isolated scene
A lightweight "scene" for cards: no captions, no media re-import nag, one aspect. Lets AI compose graphics without fighting the user's timeline.

### P2 — Batch + variants
Render N variants (colors/fonts) in one call — trivial once P0 exists; powers A/B OG-image testing and thumbnail grids.

### P3 — Headless/worker rendering
The canvas pipeline is main-thread. Fine for stills; the *video* future needs the worker path (already exists for export) to expose per-frame rendering at speed.

---

## 🔗 Where this plugs in

- **WhatsApp card fix** (`docs/features/WhatsApp-Link-Preview-Plan.md`): the `og-image-v2.webp` it wants can now be **generated inside the editor** — Bangers brand + tagline on brand colors, 1200×630-class, 27 KB WebP. The camera-icon export (Settings → resolution/format) already produces exactly this file.
- **HyperFrames direction**: this test is the first proof that the editor's own canvas can be the *content generator*, not just the editor. The P0 API layer is the foundation every prompt-driven feature will build on.

---

## 📋 Test hygiene

- The user's project was snapshotted before the test and restored after (658 clips / 654 captions, background, aspect, settings verified after reload). One residue: the saved playhead position (3.1 s) — the test moved it and the original position wasn't recoverable.
- The sample image was not committed (generated live; regenerate in-app via camera icon → WebP → 1920 if needed).
