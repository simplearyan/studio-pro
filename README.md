# 🎬 Studio Pro — Browser Video Editor

A powerful, **100% in-browser** video editor and motion-graphics builder. No accounts, no servers, no uploads — your project stays on your machine. Build multi-track timelines from text, shapes, images, video, audio, math equations and scenes, generate entire slideshows from **Markdown scripts**, and export finished MP4/WebM videos right from the browser.

> **Live site:** https://simplearyan.github.io/studio-pro/
> **GitHub repo:** https://github.com/simplearyan/studio-pro

---

## ✨ Highlights

- **Single-file editor** — everything runs in the browser (Vite + Tailwind CSS 4 + MediaBunny).
- **Markdown → video generator** — write a script, get a full timeline of clips in seconds.
- **Two math engines** — LaTeX equations as crisp images (MathJax) *or* as smooth editable vector shapes.
- **MediaBunny turbo export** — WebCodecs-based MP4/WebM encoding that's dramatically faster than standard MediaRecorder (Chrome/Edge/Opera).
- **Deep per-clip styling** — stroke/outline, drop shadows, 3D extrude, textures, backgrounds, letter-by-letter text editing, and 30+ animation presets.

---

## 🧭 The Interface

| Area | What it does |
|---|---|
| **Top toolbar** | Add clips (Text `T`, Shapes, Image, Video, Audio, Math `Σ`, Scene), undo/redo, export, settings |
| **Canvas preview** | Live preview with selectable/movable/resizable clips, frame-by-frame playback |
| **Timeline (bottom)** | Multi-track editor with playhead, zoom, ripple/push-trim, blade tool, per-track heights |
| **Sidebar** | Six panels: **Properties · Animations · Audio · Presets · Captions · Markdown** |

---

## 🧩 Elements & Clips

Add any of these from the header, or via Markdown generation:

- **Text** — per-letter styling (each character independently styled like Thumb-Maker), backgrounds with border-radius + opacity, stroke, drop shadow, 3D extrude, textures.
- **Shapes** — rectangle, ellipse, triangle, star, line, arrows, callouts… with fill/stroke/effects/textures.
- **Image** — paste a URL or upload a file; optional timeline thumbnail previews (toggleable).
- **Video** — URL or file; auto-linked audio track; mock placeholder while loading.
- **Audio** — file or from the built-in audio library; volume/pan/effects, waveform thumbnails.
- **Math (image)** — LaTeX via MathJax, cached to an image; fill, stroke, drop shadow, 3D extrude.
- **Math (vector)** — same equations rendered as *vector shapes* (no rough.js) — infinitely smooth scaling, no raster flicker.
- **Scene** — group clips into a reusable composition; transparency and opaque-background modes.

### Styling depth (Properties panel)

- Fill / stroke / outline width & color
- Drop shadow (color, blur, offset, opacity)
- **3D extrude** shadow with adjustable depth
- **Textures** — grain, carbon, paper, leather, neon grid… (plus upload your own)
- Backgrounds for text with radius + opacity
- Blend modes, flip, rotation, scale, opacity, aspect ratio presets (9:16, 16:9, 1:1, 4:5…)
- Per-letter editing for text clips (fonts, color, weight per character)

---

## 📝 Markdown → Video Generator

Write plain Markdown in the **Markdown → Content** tab, hit **Generate**, and Studio Pro builds slides on the timeline — headings, paragraphs, images, videos, math and mocks, all with per-slide timing, positions and stacking.

### Syntax

```markdown
# 🎬 Slide Title

## 🦖 T-Rex [top-left]

![T-Rex](https://.../t-rex.jpeg) [right]

The Tyrannosaurus Rex was one of the largest land carnivores… [bottom]

$$e^{i\pi} + 1 = 0$$ [center-right]

![Alt text](mock)          ← mock image placeholder (shows alt text on canvas)
![Reel](mock:video)        ← mock video placeholder
![Clip](video.mp4)         ← real video by extension
[video](https://…/x.mp4)   ← real video by URL

---                          ← separates slides
```

### Features

- **Element types:** `## Heading`, paragraphs (with `**bold**` and per-word styling), `![alt](url)` images, `$$latex$$` image math, mock image/video placeholders, and real video URLs.
- **Position tags:** `[top]`, `[bottom]`, `[left]`, `[right]`, `[center]`, plus corners `[top-left]`, `[top-right]`, `[bottom-left]`, `[bottom-right]` and sides `[center-left]`, `[center-right]` — pin any element anywhere on the slide.
- **Element Gap** — elements stacked on the same side auto-space with your chosen gap, in both auto and script-order modes.
- **Timing:** per-slide duration, text delay, and generate-from time (0s, 30s, 1min, or the playhead position).
- **Track modes:** Auto layout (V1/V2… tracks) or Script-order lanes (row 1, row 2… following script flow).
- **Heading/Text styling tabs:** font, size, color, weight, position, plus an **Effects** sub-tab (stroke, drop shadow, 3D extrude) for both headings and body text.
- **Presets:** Animals & Dinosaurs, Σ Math, and the **Showcase** script (corners, mocks, stacking, real video).
- All markdown style settings persist to `localStorage`.

---

## 🎞️ Animations

- **Preset grid** (Transform): In / Out / Loop animations — fade, slide (all directions, with *off-canvas vs. in-canvas* mode), zoom, bounce, spin, flip, blur, **Puzzle Blocks** (Fireship-style square reveal from top/bottom/left/right, with duration/delay and pop vs. snap appearance), and more.
- **Text tab:** letter-by-letter pop, background sweep, stagger effects.
- **Custom tab:** full keyframe editor — add/delete keyframes, seek between them with arrow icons, per-property reset.
- Per-clip duration, delay, and easing controls.

---

## 🗒️ Captions

- **Import SRT/VTT** files — auto-synced caption clips.
- Convert any caption (or an entire caption track) into a normal **text track** for full timeline control, keeping style + animation.
- Overlap handling: keep bottom/top clip priority, trim only the overlapping part, custom gap & minimum-duration options with live preview.

---

## ⏱️ Timeline Editing

- Multi-track timeline (V1…, A1…) with per-track height adjustment (global *and* per-track via drag).
- **Split** at playhead — one clip, all linked clips (video+audio), or every clip across all tracks (CapCut/Premiere-style blade tool with hover blade).
- Trim from start or end; **push/ripple trim** (`P` shortcut or header toggle) moves neighbors when you extend a clip.
- **Gap select** — click empty space between clips and remove it, rippling later clips left (Premiere-style).
- Multi-select, group to scene, duplicate, copy/paste, drag across tracks, zoom & scroll.
- Real-time canvas preview that stays in sync — no seek needed after split/import.

---

## 📤 Export

Hit **Export** in the toolbar, choose a tab and format:

| Format | Engine | Notes |
|---|---|---|
| **MP4** (MediaBunny) | WebCodecs | ⚡ Fast, high quality — needs Chrome/Edge/Opera |
| **WebM** (MediaBunny) | WebCodecs | ⚡ Fast VP9 |
| **MP4** (standard) | MediaRecorder | H.264 + AAC, universal fallback |
| **WebM** (standard) | MediaRecorder | VP9 + Opus |
| **GIF** | MediaRecorder | Animated GIF via WebM |
| **Audio WebM / WAV** | MediaRecorder | Audio-only export |

- **Resolution** up to 1080p+ (1920 base, scaled to the current aspect ratio), **FPS** selectable, and **time-range export** (start/end or playhead position).
- Custom aspect ratios (9:16 Shorts, 16:9, 1:1, 4:5…) applied at export.
- Progress bar + cancel, settings remembered in `localStorage`.

---

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev          # → http://localhost:5173

# 3. Production build
npm run build
npm run preview      # serve the built site locally
```

Open the app, then try the **Showcase** preset in the Markdown tab and hit **Generate** — you'll have a full timeline in seconds.

> **Note:** MediaBunny exports require a Chromium browser (Chrome, Edge, Opera). The standard MediaRecorder export still works everywhere.

---

## 🛠 Tech Stack

- **Vite** — instant dev server & builds
- **Tailwind CSS 4** — utility-first styling, dark mode
- **MediaBunny** — WebCodecs encoding for fast MP4/WebM export
- **MathJax** — LaTeX rendering for image-based math
- Vanilla JS single-page app — no framework, no backend, no telemetry

---

## 📁 Project Structure

```
index.html          ← the entire editor (UI + logic)
style.css           ← custom styles (Tailwind 4 + hand-written)
tailwind.config.js  ← Tailwind theme
vite.config.js      ← build config
export-worker.js    ← MediaBunny export worker
```

---

*Built for creators who want a pro editing feel with zero setup. Make something great! 🚀*
