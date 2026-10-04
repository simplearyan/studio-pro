# Clip Lite gets a home — out of `docs/`, into its own folder

A plan to give the Clip Lite prototype a real home outside `docs/studio-lite/`: a
top-level folder with the mock as its `index.html`, where the shared core and the
export seam can live later. The copy is deliberate — `docs/studio-lite/` keeps a
**frozen** copy of the mock forever, so there is always a file to go back and see
what the prototype looked like before it became an app.

**This is a plan, not an implementation.** Nothing here is built.

> The four mechanical claims in §4 were measured with a throwaway probe folder
> (`clip-lite-probe/`, since removed) against the running dev server and a real
> build. They are marked *measured*; everything else says what it is.

---

## 1. The name

**Recommended: `clip-lite/`** — a top-level folder, sibling to `docs/` and `src/`.

| name | why not / why |
|---|---|
| **`clip-lite/`** | **the recommendation.** It is the product's own name, so the folder says what it holds. Short, and it gives the dev URL `/clip-lite/` and the Pages URL `<base>clip-lite/`. |
| `studio-lite/` | matches the app name in `docs/STUDIO-LITE-PLAN.md`, but it sits one level away from `docs/studio-lite/` and reads as the same thing twice in a diff or a URL. The study folder is `docs/studio-lite/`; the app should not be its near-namesake. |
| `apps/clip-lite/` | right shape if a second lite app is ever planned (Studio Lite is meant to scale up from this). Costs a nesting level for an `apps/` that has exactly one member today. |
| `lite/` | shortest, and the vaguest. Nothing in the name says *clip* or *lite what*. |

The chosen name is load-bearing in three places and all three are cheap to set
now and annoying to change later: the folder, the Vite entry key, and the
manifest's `start_url`.

---

## 2. What copies, and what stays

| file | fate |
|---|---|
| `docs/studio-lite/clip-lite-mock.html` | **copy** to `clip-lite/index.html`. The original stays, byte-identical, forever. |
| `docs/studio-lite/clip-lite-mock-v1.html` | untouched. It is already the "before" picture for an earlier pass; this plan adds a second one. |
| `docs/studio-lite/selfcheck.html` | **must move or be duplicated** — see §5. It is not optional. |
| `docs/studio-lite/manifest.webmanifest` | copied and adjusted for the new folder; the docs one stays with the frozen page. |

There is precedent for freezing a file rather than moving it: `clip-lite-mock-v1.html`
is kept "byte-identical to the file it arrived as — the before-picture for the
retarget pass, so the visual diff stays honest" (the folder's own hub text). This
plan makes `clip-lite-mock.html` a third such file.

---

## 3. The target layout

```
clip-lite/
  index.html            ← the copy of clip-lite-mock.html, now the living app
  manifest.webmanifest  ← start_url "./index.html"
  selfcheck.html        ← the same page, retargeted at index.html (§5)
  src/
    core/               ← EMPTY until the engine is extracted (docs/STUDIO-LITE-PLAN.md)
    export/             ← EMPTY until the export seam lands
```

`src/core/` and `src/export/` are named now and left empty on purpose. The
temptation is to invent a module structure before there is a module to put in it;
the plan in `docs/STUDIO-LITE-PLAN.md` is explicit that the engine is cut out of
`index.html` *behind a seam* and shipped as a package both apps consume, and that
is a separate, much larger piece of work. Until then `index.html` keeps its inline
script and the two folders are placeholders that say where things will go.

---

## 4. The mechanics — what was measured

**A root-level folder is served in dev, with Vite's client injected, so it is a
page Vite can also build.** *Measured:* a probe `clip-lite-probe/index.html`
answered **200** at both `/clip-lite-probe/` and `/clip-lite-probe/index.html`,
and the body carried `<script type="module" src="/@vite/client">`.

**A second Vite entry builds to `dist/<folder>/index.html`.** *Measured:* adding
`probe: './clip-lite-probe/index.html'` to `build.rollupOptions.input` emitted
`dist/clip-lite-probe/index.html` (37 bytes). For the real thing that means
`clipLite: './clip-lite/index.html'` → `dist/clip-lite/index.html`.

**Relative paths survive the move, but should be normalised anyway.** The mock
climbs out of its folder exactly twice — `../../sw.js` and
`../../icons/apple-touch-icon.png` — and the manifest carries
`../../icons/*.png`. From `docs/studio-lite/` (depth 2) those resolve to the app
root; from `clip-lite/` (depth 1) `../../` climbs *past* the root and the browser
clamps it back, so they would still resolve. Do not rely on the clamp: write
`../sw.js` and `../icons/…` so the depth matches the folder. The mock's own
service-worker comment already resolves the path with
`new URL('../../sw.js', location.href)`, which is clamp-safe, but the two `<link>`
hrefs are plain strings.

**The manifest needs two edits**, both in `start_url` and its icons:
`start_url` `./clip-lite-mock.html` → `./index.html`, and the four icon paths
`../../icons/` → `../icons/`.

### 4.1 The PWA trade — this is the real decision

*Measured:* adding one page at a root-level folder took the precache from **86
entries / 6888.98 KiB to 87 / 6889.02 KiB.** In other words **the new folder is
precached, and `docs/**` is not.**

That exclusion is not an accident. `vite.config.js` spells out why in a long
comment: a workbox precache is cache-first and only revalidated when its manifest
changes, so a phone that installed the app once keeps the HTML it first
downloaded "indefinitely", while a desktop on the same build fetches the new one —
"that is how a prototype can sit three commits behind on the device that is
supposed to be demonstrating it". `globIgnores: ['docs/**']` is what keeps the
prototypes honest, and the commit that added it measured 14 docs paths before,
0 after.

So the move has a consequence that must be decided, not discovered:

| choice | effect |
|---|---|
| **add `clip-lite/**` to `globIgnores`** *(recommended while it is being iterated)* | the app stays fresh on every reload, exactly like the docs prototypes. Costs one network round trip. Revisit when Clip Lite becomes something people install. |
| let it precache | it installs and works offline as a real app, and starts going stale on installed devices between releases. |

The mock also registers `../../sw.js` and ships its own `manifest.webmanifest`
with `"id": "./"` and a `start_url`. Its manifest `scope` is `"./"`, so the new
folder's manifest stays self-contained — but the service worker registration is
shared with Studio Pro, and that is what makes the precache question real rather
than theoretical.

---

## 5. The trap this plan must not walk into

`selfcheck.html` loads the mock **by relative path** —

```js
<iframe id="frame" src="clip-lite-mock.html" title="mock"></iframe>
<iframe id="rowframe" src="clip-lite-mock.html" title="mock (row checks)"></iframe>
```

— and the page exists to test *the code that ships*, not a copy of it: "A copy of
the filter strings would only prove the copy works". Copy the mock to `clip-lite/`
and leave `selfcheck.html` in `docs/studio-lite/`, and the suite goes on testing
the **frozen** file. Every check would keep passing, in green, while the app
regressed. That is the exact failure mode the self-check was built to catch,
pointed at itself.

So the move is not "copy the mock and we are done". The self-check moves with the
app (or a second `clip-lite/selfcheck.html` is added and the docs one is retired).
Recommended: **move** it — a frozen mock with a live suite testing it is worse than
no suite.

---

## 6. Where the core and the export go

`docs/STUDIO-LITE-PLAN.md` is the parent plan: Studio Lite is "a second app built
on the *same core*", and the core is extracted from Studio Pro's 38,689-line
`index.html` behind a seam, then shipped as versioned packages both apps consume.
This plan creates the consumer — nothing more.

```
clip-lite/src/core/     imports the shared engine once it exists
clip-lite/src/export/   wraps the export pipeline (src/workers/export-worker.js,
                        MediaBunny) behind one interface
```

Two rules that keep this from becoming a fork:

- **No engine code is copied into `clip-lite/`.** If something is needed by both
  apps it becomes a package, not a second copy. The repo already carries three
  divergent copies of Studio Pro and one toolkit synced by hand between two
  repos; this folder must not become the fourth.
- **`index.html` is allowed to stay one file until the seam exists.** Making the
  mock a module graph before the engine is a module is churn with no payoff.

---

## 7. Steps, each one verifiable on its own

| | step | done when |
|---|---|---|
| S1 | Create `clip-lite/`, copy `clip-lite-mock.html` → `clip-lite/index.html`, copy the manifest, fix `../../` → `../` in the two `<link>`s and the manifest, and `start_url` → `./index.html`. | `/clip-lite/` renders the editor; the frozen docs copy is byte-identical to `HEAD` (`git diff --stat` on it is empty). |
| S2 | Add `clipLite: './clip-lite/index.html'` to `build.rollupOptions.input`. | `npm run build` emits `dist/clip-lite/index.html`, and the docs copy still deploys through the existing static-copy glob. |
| S3 | Move `selfcheck.html` to `clip-lite/selfcheck.html`; both iframes point at `index.html`. Retarget any relative asset it uses. | the page reports **21 of 21 controls and 4 of 4 shelf rows**, run against the new folder. |
| S4 | Decide §4.1 and set `globIgnores` accordingly. | a fresh build's precache entry count is the number you chose, and a reload of `/clip-lite/` after an edit shows the edit. |
| S5 | Update `docs/studio-lite/index.html` (the hub) and `vite.config.js` comments to name the new home, and say in one line that the docs copy is frozen. | the hub's Clip Lite card points at the live app, and a reader can tell which file is which. |
| S6 | *Later, separate work:* `src/core/` and `src/export/` land per `docs/STUDIO-LITE-PLAN.md`. | — |

S1–S2 are safe to do in one commit; S3 must not lag behind them (§5).

---

## 8. Risks

| | risk | mitigation |
|---|---|---|
| 1 | **The self-check silently tests the frozen file.** Green suite, regressing app. | S3 in the same change as S1; the suite's own output names the file it loaded. |
| 2 | **The app goes stale on installed devices** once it leaves `docs/**`. | decide §4.1 before S4, and measure the precache delta rather than assuming it. |
| 3 | **A fourth divergent copy of Studio Pro.** | no engine code is ever copied into `clip-lite/`; shared things become packages. |
| 4 | **The `/clip-lite/` URL collides with the SPA fallback.** | the folder is a real build entry with its own `index.html`, so it is a static navigation, not a client route — but confirm on Pages, where `base` is `/studio-pro/`. |
| 5 | **The frozen docs copy drifts** because someone fixes a bug in `docs/` by habit. | S5's one-line note, and the hub card naming the live file. |
| 6 | **Two manifests on one origin.** | the mock already installs as its own app (`"id": "./"`); keep the new folder's manifest self-contained and do not merge it with Studio Pro's. |

---

## 9. Verification

Every row is a check, not a look.

| | check |
|---|---|
| dev | `/clip-lite/` and `/clip-lite/index.html` both answer 200; the served body is the copy, not the docs file |
| build | `npm run build` clean; `dist/clip-lite/index.html` exists; the docs glob still emits `dist/docs/studio-lite/clip-lite-mock.html` |
| frozen copy | `git diff --stat docs/studio-lite/clip-lite-mock.html` is empty after S1 |
| self-check | run against `clip-lite/index.html`: **21 of 21 controls, 4 of 4 rows**; and it must fail if the file it loads is the old one (point an iframe at the frozen copy deliberately, once, to prove the suite is bound to the right file) |
| paths | no `../../` remains in `clip-lite/index.html` or its manifest; the icons and `sw.js` resolve to the app root |
| PWA | precache entry count matches the §4.1 decision; a reload shows an edit |
| Pages | `<base>clip-lite/` serves the app, not the app shell, with `base = /studio-pro/` |

---

## 10. Out of scope

- **Extracting the engine.** That is `docs/STUDIO-LITE-PLAN.md`, and it does not
  depend on this folder existing.
- **Making the mock a module graph.** Deliberate: the file stays one script until
  there is a real module to import.
- **Deleting the docs copy.** The whole point is to keep it.
- **Renaming anything in `docs/studio-lite/`.** The hub, the v1 file and the plan
  documents stay where they are.
