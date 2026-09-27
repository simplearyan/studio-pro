# meta — site social art, rendered by test-renderer

Regenerates the **OG images** (Google Material You + iOS glass cards, both
16:9 and square) and the **favicon set** for the IITM site by driving
`docs/html-in-canvas/test-renderer.html` — the studio's real clip engine —
with **Playwright**. The social card is literally a frame of the same engine
that plays the animations.

```
automation/meta/
├── render-meta.mjs        CLI driver: vite check → Playwright → TR → PNG/WebP
├── sync-presets.mjs       mirrors clips/* into TR's PRESETS gallery (markers)
├── clips/                 ← SOURCE OF TRUTH for the designs
│   ├── og-material.js     Google Material You OG card (Roboto Flex)
│   ├── og-ios.js          iOS glass OG card (Inter, dark ultramarine)
│   └── favicon.js         1:1 ✓ glyph tile (stage green on #0e1512)
└── output/                generated PNGs/WebPs (git-ignored)
```

## Run it

```bash
# from studio-pro-editor/  (vite on :5173 is auto-started if missing)
node automation/meta/render-meta.mjs

node automation/meta/render-meta.mjs --only ios       # one clip
node automation/meta/render-meta.mjs --quality=0.85   # webp quality
node automation/meta/render-meta.mjs --site           # also copy favicons
                                                      # to ../IITM/site/public
```

Output set per OG clip:

| file | what |
|---|---|
| `og-<name>-1920x1080.webp` | 1080p native pass-through (no resampling) |
| `og-<name>-1200x630.png` | classic `og:image` size |
| `og-<name>-square-1200x1200.webp` | square card (1:1 frame + bg fill, no crop) |
| `favicon-{512,64,32}.png` | favicon set |

Every file passes a per-pixel blank-frame self-check (distinct colors +
bright-pixel ratio on the final raster) before it is written; the run exits
non-zero if any check fails. Failed/missing chromium falls back to system
Chrome automatically.

## Test-renderer gallery

`node automation/meta/sync-presets.mjs` compiles `clips/*` into test-renderer's
`PRESETS` table between the `/* [meta-presets] … */` marker comments — so the
OG card designs are also playable, scrubable, exportable presets
(*OG Card · Material You*, *OG Card · iOS Glass*, *Favicon*, category "meta").
The sync is deterministic:

```bash
node automation/meta/sync-presets.mjs --check   # exit 1 if out of date (CI-friendly)
```

**Edit the clips, not the generated block** — change `clips/*.js`, then
re-run sync + render. Gallery names come from each clip's `galleryName`
export; TR's `<title>` backfill handles modal headers.

## How the driver works (the seams it uses)

1. paste the clip's fenced payload into TR's AI tab (`aiReply` →
   `aiApplyReply()`), with `<!-- ds:16:9 -->` and `<!-- dur:4000 -->`
   markers so the frame + timeline adopt the clip's design space;
2. wait for **real** readiness: `modalSlider.max` equals the dur marker,
   the clip's token appears inside `_lastAppliedCode` (set only after
   `applyCode`'s awaited `setClip` resolves — font `<link>` inlining makes
   that take seconds cold), and `modalRenderer._onFrame` exists;
3. pick frame aspect + bg (`curFrame` → `applyAspect()`), seek
   (`modalSlider`), call `exportFrame('png'|'webp')`, capture the download;
4. post-process on a blank workbench page: cover-resize / encode via
   canvas, run the self-check, write the file.

Clips render in **parallel** (one browser context each), so cold font
fetches overlap.

### Gotchas baked into the code (learned the hard way)

- TR's app globals (`modalSlider`, `_lastAppliedCode`, …) are **lexical**
  (`let`) — `window.modalSlider` is `undefined` in `waitForFunction`;
  use the bare identifiers with `typeof` guards.
- The AI tab **strips `title:`/`desc:`/`ds:`/`dur:` comment markers** when
  pasting a *gallery preset's* code back into itself — `sync-presets.mjs`
  removes them from generated entries to keep Copy code → AI tab idempotent.
- Marker comments sit **inside the PRESETS object literal**: both must be
  complete comments, and the block must follow a trailing comma
  (`ensureTrailingComma`). A bare leading `[` there parses as a computed
  property key with a regex inside; V8 blames the object's closing brace,
  not the real line.
- The export download lands in the browser's Downloads dir; the tool
  intercepts it via Playwright's `download` event instead.

## Site wiring

Favicons: `--site` copies them to `../IITM/site/public/`. OG cards: pick
per page — e.g. copy `og-ios-1920x1080.webp` to `public/og-default.png`
(or reference it directly) in `Base.astro` / page frontmatter. The old
`pq-002-og.png` (storyboard verdict frame) remains the pq-002 page's card;
this tool covers the generic/default and future artwork.
