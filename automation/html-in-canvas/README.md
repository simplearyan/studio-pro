# HTML-in-Canvas → Video

> Write a JavaScript composition using the StudioPro API → get an MP4/WebM.
> One pipeline, two export strategies. No React, no build step, no accounts.

This folder is the **HTML-in-Canvas** automation pipeline. It replaced both the old
`html-static/` and `html-waapi/` folders, which were the same Puppeteer client twice over
(168 byte-identical lines, including all of `_detectPort`/`launch`/`execute`/`export`/`close`).
Its clips are `type: 'hic'`; CSS `@keyframes` are compiled into a deterministic `onFrame(t)`
by the editor at clip creation.

---

## Quick Start

```bash
# 1. Start the editor dev server (Vite — required), from the repo root
npm run dev

# 2. In another terminal, from automation/
cd automation

# Deterministic: standalone page per clip + CDP screenshots + ffmpeg  (default)
node html-in-canvas/render.js html-in-canvas/examples/simple-test.js

# Parity: drive the running editor and let its own export pump render
node html-in-canvas/render.js html-in-canvas/examples/simple-test.js -m editor -e ftrt
```

The **script path resolves against the current working directory**, so from `automation/`
the correct form is `node html-in-canvas/render.js html-in-canvas/examples/x.js`.

Output lands in `html-in-canvas/output/` (gitignored).

---

## Two export strategies, one command

| Strategy | Flag | How | Use it for |
|---|---|---|---|
| **CDP screenshots** | `-m cdp` *(default)* | A standalone page per clip, `Page.captureScreenshot` per frame, ffmpeg | Anything you may need to **re-render, compare or diff** — it is a pure function of the frame index. Two runs of the same command produce byte-identical MP4s. |
| **Editor export** | `-m editor` | Drives the running editor: `openExportModal()` → `submitExport()`, MediaBunny / FTRT / standard | Answering "**does the thing the app ships actually render this clip?**" — the only automated consumer of the editor's real export pump. |

They are **not interchangeable**. Same clip, `simple-test`, 150 frames:

| | `-m editor -e ftrt` | `-m editor -e mediabunny` |
|---|---|---|
| size | 153,460 B | 153,459 B |
| distinct states | 14 / 150 | 14 / 150 |
| frames differing from the other encoder | **90 / 150** | — |

Both editor encoders are *realtime* capture loops, so each frame lands at a slightly different
point in the animation. The CDP path samples the same frame index every time. Use `cdp` for
reference files, `editor` for coverage of the shipped path.

---

## CLI

```
node html-in-canvas/render.js <script.js> [output] [options]
```

| Flag | Meaning |
|---|---|
| `-m, --mode <cdp\|editor>` | The strategy. Default `cdp`. |
| `-e, --encoder <mediabunny\|ftrt\|standard>` | **Editor mode only** — which of the editor's export paths to use (default `mediabunny`). Warned-and-ignored in cdp mode. |
| `-q, --quality <draft\|standard\|ultra>` | cdp: ffmpeg CRF 28/23/18. editor: accepted but **decorative** — the editor's export modal owns the bitrate. |
| `-f, --format <mp4\|webm>` | Container. Default `mp4`. |
| `--fps <n>` | Frame rate. Default `30`. |
| `-u, --url <http://localhost:3000>` | Skip port auto-detect (tries 7000, 3000, 3001). |
| `--retries <n>` | Editor-mode retry attempts. |
| `--no-headless` | Show the browser window (debugging). |

**Legacy mode names** are accepted and mapped with a warning:
`-m gui` / `-m mediabunny` → `-m editor -e mediabunny`, `-m ftrt` → `-m editor -e ftrt`,
`-m standard` → `-m editor -e standard`. Bad enum values now exit with the allowed list.

---

## Examples

| Example | Notes |
|---|---|
| `examples/simple-test.js` | Minimal composition — the smoke test |
| `examples/google-clean-test.js` | One 5 s clip |
| `examples/waapi-test.js` | 3 scenes with CSS `@keyframes` |
| `examples/animated-pollution.js` | 4 scenes, keyframes |
| `examples/india-pollution.js` | 9 scenes, 45 s |
| `examples/kinetic-text.js` | Kinetic typography, spring easing |
| `examples/product-launch.js` | Gradient cards, CTA |
| `examples/social-reel.js` | 9:16 vertical reel |

## Templates

`templates/design-tokens.md`, `glassmorphism.html`, `gradient-card.html`,
`premium-gradient.html` — reusable HTML/CSS assets and the brand token sheet.

---

## Compositions

```javascript
module.exports = function (StudioPro, State) {
    StudioPro.fonts.loadGoogle('Poppins');

    StudioPro.createComposition({
        id: 'my-video',
        duration: 10,
        clips: [
            StudioPro.html(
                '<div class="card"><h1>Hello World</h1></div>',
                '.card { background: linear-gradient(135deg, #667eea, #764ba2); }',
                '',                                   // js: an onFrame(t) function, optional
                { start: 0, duration: 5, fonts: ['Poppins'] }
            ),
            StudioPro.text('10× Faster', { start: 5, duration: 5 })
        ]
    });

    StudioPro.keyframes(State.clips[0], {
        opacity: [{ frame: 0, value: 0 }, { frame: 15, value: 100 }]
    });
};
```

The full API reference is `automation/shared/skills/AGENTS.md`; style guides are
`shared/skills/{kinetic-text,product-launch,social-reel}.md`.

---

## File Structure

```
html-in-canvas/
├── README.md            # this file
├── render.js            # CLI entry point — --mode cdp|editor
├── api.js               # editor client (used by --mode editor)
├── cdp-capture.js       # standalone page + CDP screenshots (--mode cdp)
├── examples/            # composition scripts
├── templates/           # reusable HTML/CSS + design tokens
└── output/              # rendered videos (gitignored)
```

---

## Measured results

All numbers below are `ffprobe` / `ffmpeg -f framemd5` / `signalstats` output, from the parity
run recorded in `docs/automation/HTML-IN-CANVAS-PIPELINE-PLAN.md` §12.

- **Reproducible:** two independent `-m cdp` runs of `google-clean-test` produced the **same
  file byte for byte** (42,362 B, sha256 identical, all 150 frame hashes matching).
- **Migration is behaviour-preserving:** frame 100 of `google-clean-test` measures
  YAVG 229.790 pre-migration vs 229.791 post-migration — a 0.001 difference between a render
  driven by `document.getAnimations()` on the old clip format and one driven by the compiled
  `onFrame`.
- **The editor path used to be the broken one:** the pre-merge editor baseline for
  `google-clean-test` was a valid, playable MP4 containing a *flat grey field* (4 distinct
  states). It is now a real render with 42 distinct states. The failure was clip-dependent,
  which is what made it dangerous.
- CDP capture speed is roughly 3.7–11.5 fps depending on Google-Font loading; the first clip is
  slowest (cold start + font cache).

---

## Open items

Carried from the retired `html-static/` tracker and the merge:

- **`batch.js` routes only `md-render/`.** Batching HTML-in-Canvas compositions means a shell
  loop of `render.js` calls; generalizing `batch.js` for a second input type is undecided.
- **`--quality` does nothing in editor mode** (see the CLI table).
- **No automated comparison harness.** Every parity number was produced by a shell one-liner.
  Making it re-runnable is the honest follow-up.
- **No preview / watch mode** — you must export to see a result, and re-run the CLI for each edit.
- Editor-feature gaps that used to be tracked here (transitions between clips, image loading
  from URLs, background audio, native text clips) are product work, not pipeline work.

---

## Troubleshooting

**No dev server found:** run `npm run dev` from the repo root (must be **Vite**, not
`http-server` — the UI is unstyled without it) and pass `-u http://localhost:3000` if the port
is unusual.

**Blank frames in `-m editor`:** try `-e mediabunny` instead of `-e ftrt` — FTRT is realtime and
can stall. Check the console for `[HIC] JS error: …` (the clip's `onFrame` threw).

**Fonts missing:** use `StudioPro.fonts.loadGoogle("Font Name")` in the composition.

**Stale Chrome / "Session closed":** `taskkill //IM chrome.exe //F` (Windows) or `pkill chrome`.
