# 🤝 Contributing to Studio Pro

First off — thank you for wanting to help! Studio Pro is a passion project and every contribution counts, whether it's a typo fix, a bug report, or a whole new feature.

---

## 🚀 Quick Start

```bash
# 1. Fork the repo, then clone your fork
git clone https://github.com/<your-username>/studio-pro.git
cd studio-pro

# 2. Install dependencies (Node 18+ recommended)
npm install

# 3. Start the dev server
npm run dev          # → http://localhost:5173

# 4. Make your changes, then verify
npm run build
npm run preview      # test the production build locally
```

> 💡 The whole editor lives in **`index.html`** — UI, styles, and logic together. This keeps the project simple to fork and run, but means large edits need care (see [Code Conventions](#-code-conventions)).

---

## 🧭 How the Project Is Organized

```
index.html            ← the ENTIRE editor (HTML + Tailwind + inline JS)
style.css             ← custom styles (Tailwind 4 + hand-written CSS)
tailwind.config.js    ← Tailwind theme
vite.config.js        ← build config
export-worker.js      ← MediaBunny export worker (runs off the main thread)
```

- **No framework, no backend, no build step for the source** — Vite is used purely for dev-server convenience and production bundling.
- **Tailwind CSS 4** via the `@tailwindcss/postcss` plugin.
- **MediaBunny** (MPL-2.0) powers the fast WebCodecs exports — see [LICENSE_RECOMMENDATION.md](LICENSE_RECOMMENDATION.md) for the licensing story.

---

## 🐛 Reporting Bugs

Open an issue with:

1. **What you did** — exact steps to reproduce.
2. **What happened** vs. **what you expected**.
3. **Screenshots or screen recordings** — timelines, canvas preview, console (DevTools → Console → copy the error).
4. **Environment** — browser + version (Chrome/Edge/Opera/Firefox…), OS, and whether you're on the [live site](https://simplearyan.github.io/studio-pro/) or a local build.

> Tip: many timeline/canvas bugs only reproduce in one of the two markdown track modes or with specific clip types — say which you used.

---

## ✨ Feature Requests

Tell us **what problem** you're solving and **how you imagine it working** — a quick sketch of the UI (even ASCII art) goes a long way. If it's a big feature (new clip type, new export format), mention how you'd split it into smaller PRs.

---

## 🛠 Making Changes

1. **Branch from `master`:** `git checkout -b feat/my-cool-feature`.
2. Keep changes **focused** — one logical change per PR.
3. Match the existing style (see below).
4. **Test your change manually** — the app is interactive, so click through: add clips, generate markdown, play the timeline, export.
5. Push and open a PR with a clear title + description.

---

## 📏 Code Conventions

- **English, lowercase-with-hyphens** for IDs/classes you add (`timelineScrollArea` for camelCase JS variables, `data-tab="markdown"` for attributes).
- **Inline `onclick` handlers** are the existing convention — follow it rather than introducing a new event-binding style.
- **State lives on the single `State` object** — add new settings there so the UI re-renders consistently.
- **Reuse helpers** — there are many small utilities (`mdStackOffsets`, `wrapMdText`, `formatClipTime`, etc.). Search before you re-implement.
- **Tailwind classes inline**; add custom CSS to `style.css` only for things Tailwind can't express.
- **Don't break the single-file structure casually** — if you must extract a big script, talk about it in the PR first.
- **Comment the *why***, not the *what* — especially for canvas drawing math and timeline math (pixel/time conversions).

### Testing checklist (manual, per change)

- [ ] App loads with no console errors
- [ ] Light + dark mode both render correctly
- [ ] Add / select / move / trim each affected clip type
- [ ] Markdown generate in **both** track modes (Auto and Script-order)
- [ ] Playback + seeking stay smooth
- [ ] Export (MediaBunny in Chrome) and standard export work
- [ ] `npm run build` passes

---

## 🎨 Adding a Markdown Preset

Presets are plain template-literal strings in `MARKDOWN_PRESETS` inside `index.html`, plus a button in the Content tab. See the existing `animals`, `math`, and `showcase` presets for the syntax (headings, `![alt](url)` / `(mock)` images, `$$latex$$`, position tags, `---` slide separators).

---

## 🧾 Licensing & Attribution

- **Your code** is licensed under the project license (see [LICENSE_RECOMMENDATION.md](LICENSE_RECOMMENDATION.md)).
- **MediaBunny** is **MPL-2.0** — we use it unmodified; its license and copyright notices must stay intact. Don't edit files inside the vendored `mediabunny` package; patch it via a wrapper instead.
- Never add assets with unclear licenses (fonts, images, icons) without noting the source.

---

## 💬 Questions?

Open a discussion or comment on the relevant issue — maintainers will get back to you. Thanks again for contributing! 🚀
