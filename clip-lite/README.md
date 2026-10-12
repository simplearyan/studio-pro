<div align="center">

# 📱 Clip Lite

**A working phone video editor in one self-contained HTML file.**

Import real video, build a filmstrip and waveform from the source, scrub on a pinned
playhead, trim, split, grade — and export with `MediaRecorder`. No framework, no build
step, no backend.

[![Live](https://img.shields.io/badge/live-clip--lite-e2483d?style=for-the-badge)](https://simplearyan.github.io/studio-pro/clip-lite/)
[![Self-check](https://img.shields.io/badge/self--check-suite-4ec9a0?style=for-the-badge)](https://simplearyan.github.io/studio-pro/clip-lite/selfcheck.html)
[![PWA](https://img.shields.io/badge/installable-PWA-5b8def?style=for-the-badge)](https://simplearyan.github.io/studio-pro/clip-lite/)

</div>

---

## 🚀 Run it

| | |
|---|---|
| **Live** | [simplearyan.github.io/studio-pro/clip-lite/](https://simplearyan.github.io/studio-pro/clip-lite/) |
| **Local** | `npm run dev` at the repo root, then [http://localhost:3000/clip-lite/](http://localhost:3000/clip-lite/) |
| **Self-check** | […/clip-lite/selfcheck.html](https://simplearyan.github.io/studio-pro/clip-lite/selfcheck.html) — open it and press *Run checks* |

The app is [`index.html`](index.html) — about 3,500 lines of vanilla HTML/CSS/JS in one
file. The only external requests are Google Fonts (Roboto + Anton); everything else —
engine, UI, state — lives inside that file, so it also works from a plain static host
or straight off disk.

---

## 🧰 What's in the folder

| File | What it is |
|---|---|
| [`index.html`](index.html) | The editor itself — the whole app in one self-contained page |
| [`selfcheck.html`](selfcheck.html) | The measurement suite: Adjust knobs, filters, sheet geometry, gestures, persistence — each check *injects the failure it exists to catch*, so a check that cannot go red is not a check |
| [`manifest.webmanifest`](manifest.webmanifest) | Its own app manifest, so Clip Lite installs to a home screen as a **separate app** from Studio Pro (two manifests on one origin = two icons, two start URLs) |
| `src/core/` · `src/export/` | Empty on purpose — named homes for the day the one-file split happens (see [`docs/CLIP-LITE-HOME-PLAN.md`](docs/CLIP-LITE-HOME-PLAN.md)) |
| [`docs/`](docs/) | The plans and studies behind every feature — see the index below |

---

## ✂️ What it does

- **Import** a real video file; the rail builds a **filmstrip** of thumbnails and a
  **waveform** from the source itself.
- **Pinned playhead scrubbing** — the playhead stays under your thumb while the filmstrip
  moves beneath it, with a ruler that labels seconds and zooms with the timeline.
- **Clip actions** — trim (drag handles), **split** at the playhead, delete, replace,
  rearrange; multi-select several clips and act on them together, with undo/redo.
- **Adjust** — thirteen knobs (exposure, contrast, saturation…) each proven by the
  self-check to be an exact no-op at rest and to move its own metric the way its name
  promises — at preview scale, not just full size.
- **Filters** — eleven graded looks as exclusive chains, plus **Vignette** and **Grain**
  as layers drawn over whichever chain is picked, each with its own strength.
- **Captions** — text clips on their own track over the video.
- **Sheets** — Aspect ratio, Canvas and Export as one row grammar; snap-to-playhead and
  guides for alignment; an **iPad side-by-side layout** on large screens.
- **Persistence** — the project survives a reload in IndexedDB (media as Blobs, deduped
  by hash), so closing the tab doesn't lose the edit.
- **Export** — `MediaRecorder` (WebM), phone-first and offline-capable; installable as a
  PWA with the app-root service worker.

---

## ✅ The self-check page

[`selfcheck.html`](selfcheck.html) is the folder's regression suite — open it in a
browser and run it. Its sections:

| Section | What it proves |
|---|---|
| Adjust — thirteen knobs | Each is a no-op at rest, moves its own metric in the promised direction, and still does after downscaling to preview size |
| Filters — eleven chains + two layers | A chain replaces the chain; Vignette/Grain layer *over* the grade instead of quietly replacing it |
| Shelf rows hold their place | A tap never moves the row it was on; a rebuild still brings an off-screen selection into view |
| The sheet's geometry | The readout, footer and slider dot are found by measurement at phone width, not by pixel-guessing |
| Clip actions & the Format split | Reverse/Replace/Rearrange/Delete hit the *selected* clip, in the rail's committed order |
| The iPad layout toggle | The side-by-side layout at a real 1194×834, compared against the committed build |
| Does the project survive a reload | Real bytes hashed, real Blobs stored and read back — in its own `?db=sc-persist` store, so it never touches your project |
| Driven by a pointer, not by a function | Real `pointerdown`/drag/`input` sequences, the order a browser sends them |

---

## 📦 How it ships

[`vite.config.js`](../vite.config.js) **static-copies** `index.html`,
`selfcheck.html` and `manifest.webmanifest` into `dist/clip-lite/` byte-for-byte rather
than adding them to the bundle. That is deliberate:

- As a rollup entry, Vite would treat the page as an app shell and **inject Studio Pro's
  manifest and service-worker registration into it** — silently replacing Clip Lite's own
  identity with the editor's (see `CLIP-LITE-HOME-PLAN.md` §8).
- The service worker is the **app root's** worker (`../sw.js`, scope `/`) — one worker
  serves both apps — and `clip-lite/**` is excluded from the precache and on the
  navigation denylist, so a phone that installed Studio Pro once can never be served a
  stale Clip Lite (or vice versa).

---

## 📚 Docs index

Every feature grew out of a written plan or study in [`docs/`](docs/):

| Doc | What it covers |
|---|---|
| [CLIP-LITE-HOME-PLAN.md](docs/CLIP-LITE-HOME-PLAN.md) | The plan that gave Clip Lite this folder — out of `docs/studio-lite/`, with its own manifest and the static-copy rationale |
| [VIDEO-EDITOR-16-FEATURE-STUDY.md](docs/VIDEO-EDITOR-16-FEATURE-STUDY.md) | Feature-by-feature inventory of the reference editor this app was studied against |
| [YT-CREATE-PATTERN-PLAN.md](docs/YT-CREATE-PATTERN-PLAN.md) | YouTube Create pattern study and adoption plan *(study only — not built)* |
| [CLIP-LITE-PATTERN-PLAN.md](docs/CLIP-LITE-PATTERN-PLAN.md) | The executable phone-editor prototype, studied *(study only — not built)* |
| [CHROME-DECLUTTER-PLAN.md](docs/CHROME-DECLUTTER-PLAN.md) | Decluttering the chrome so the preview owns the top *(M1–M3, B1–B5 applied)* |
| [RAIL-LAYOUT-PLAN.md](docs/RAIL-LAYOUT-PLAN.md) | Preview on top, the sheet down the side |
| [TIMELINE-SPACE-PLAN.md](docs/TIMELINE-SPACE-PLAN.md) | The timeline ceiling — ratio-aware *(C1–C3 applied)* |
| [RULER-GUIDES-PLAN.md](docs/RULER-GUIDES-PLAN.md) | Ruler labels and a density that follows zoom |
| [SHEET-REDESIGN-PLAN.md](docs/SHEET-REDESIGN-PLAN.md) | One row grammar across the sheets, icons that mean something |
| [FORMAT-EXPORT-SHEETS.md](docs/FORMAT-EXPORT-SHEETS.md) | The Aspect ratio, Canvas and Export sheets — split from one overloaded question |
| [SETTINGS-SHEET-PLAN.md](docs/SETTINGS-SHEET-PLAN.md) | The settings sheet and its category shelf |
| [ADJUST-FILTERS-TEXT-CLIP.md](docs/ADJUST-FILTERS-TEXT-CLIP.md) | Adjust knobs, filter chains and the caption timeline |
| [MULTI-SELECT-AND-RESET.md](docs/MULTI-SELECT-AND-RESET.md) | Selecting several clips with one gesture — and undoing it with one |
| [IPAD-LAYOUT-PLAN.md](docs/IPAD-LAYOUT-PLAN.md) | The side-by-side studio layout on a toggle |
| [PROJECT-PERSISTENCE.md](docs/PROJECT-PERSISTENCE.md) | How the project survives a reload (IndexedDB, Blobs, hash-dedup) |
| [STUDIO-PRO-UI-LESSONS.md](docs/STUDIO-PRO-UI-LESSONS.md) | What Studio Pro's components taught this smaller editor |
| [TEST-MEDIA.md](docs/TEST-MEDIA.md) | The canonical local test videos to drive it with |

---

## 🧭 Lineage

Clip Lite began as the phone-first prototypes in
[`docs/studio-lite/`](../docs/studio-lite/index.html) — those pages still ship, frozen,
at their old URLs (`…/docs/studio-lite/clip-lite-mock.html`) as the before-picture. This
folder is where the working app lives now. The full-size editor is
[`../index.html`](../index.html) — Studio Pro itself, which shares nothing but the ideas.

<div align="center">

*One file. One thumb. Real video.*

</div>
