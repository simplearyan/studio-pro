# `video-editor (16).html` — the reference editor, feature by feature

A complete inventory of everything the reference Clip Lite editor does, read
straight out of its source, written as a shopping list for Studio Lite. The goal
is not to copy the file: it is to know **what it already solved**, so Studio Lite
can ship the same ideas with the rough edges fixed rather than rediscover each one.

**Where it lives.** `D:\Code\Antigravity\design_concepts\studios\yt\video-editor (16).html`
— **outside this repository**, so nothing here is committed from it. It is 793
lines, ~76 KB, `lang="en"`, titled *Clip Lite – Video Editor*. `IPAD-LAYOUT-PLAN.md`
cites an earlier iteration of the same prototype (`video-editor (13).html`); this
is a later one, and it is the only mock in that folder with real persistence.

**How to read this.** Every section is *what it does → how it actually works →
what we would change*. Line numbers point at `video-editor (16).html` so any claim
can be checked. Where the reference is wrong or thin, it says so rather than
dressing it up.

---

## 1. Persistence — refresh keeps the project *(the headline)*

This is the feature to study first, because it changes what the app *is*: you can
close the tab, reopen it, and your video, your trims, your captions and your
effects are all still there.

### What survives a refresh

| survives | does not survive |
|---|---|
| imported video files (as Blobs) | nothing, in normal use |
| every clip: in/out points, speed, volume, filter, rotation | (the layout, divider and playhead mode are separate, in `localStorage`) |
| captions and titles, with their text, template, position and length | |
| the canvas aspect ratio and background | |
| the uid counter (so ids never collide after a reload) | |

### How it actually works

Two stores in an IndexedDB database named **`cliplite`**, opened at version 1
(L650):

```js
const IDB=new Promise(r=>{try{const q=indexedDB.open('cliplite',1);
  q.onupgradeneeded=()=>{q.result.createObjectStore('f');q.result.createObjectStore('s')};
  q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)}catch(e){r(null)}});
```

- **`f`** holds one record per imported file, keyed by its numeric source id:
  `dbPut('f',id,{blob:f,name})` where `f` is the `File` itself (L352, inside
  `addFile`). The **Blob is what persists** — not a URL. Object URLs die with the
  page; the bytes do not.
- **`s`** holds one record, `state`, rewritten as JSON:
  `{clips, texts, proj, uid}` (L666).

Every read/write goes through three tiny wrappers that **return `null` instead of
throwing** (L651–652) — so private-mode browsers and quota failures degrade to
"no persistence" rather than a broken editor:

```js
const dbGet=(st,k)=>..., dbPut=(st,k,v)=>..., dbClear=st=>...
```

**Restore** runs once at boot (L654–662): read `state`, collect the unique source
ids, load every referenced blob back through `loadSrc()`, then assign `clips`,
`texts`, `proj`, `uid` and call `refresh()`. It re-runs the expensive derived work
afterwards — `thumbs(id)` for the filmstrip and `peaks(id, file)` for the waveform
— and finishes with a toast: *"Restored your last project"*.

**Autosave** is a poll, not a queue (L663):

```js
setInterval(()=>{if(!restored)return;
  const j=JSON.stringify({clips,texts,proj,uid});
  if(j!==lastSaved){lastSaved=j;dbPut('s','state',j)}},2000);
```

Serialise the whole project every two seconds, and write only when the string
changed. No debounce on input, no dirty flags, no `requestIdleCallback`.

**New project** is deliberately hard to trigger (L664): the menu item arms on the
first tap (`"Tap again to start a new project"`, valid 3 s) and only the second
tap clears `clips`, `texts`, `srcs`, `hist`, `redoS`, the project, and calls
`dbClear('f')` + `dbClear('s')`.

**Three smaller things persist in `localStorage`**, all under a `cl.` prefix
(L648): `cl.lay` (preview position), `cl.pw` (divider width), `cl.free`
(free-vs-centred playhead). A helper pair wraps it so a blocked storage never
throws.

### Why this matters for Studio Lite

The reference proves the pattern works in a single 76 KB file with no build step:
**blobs in one store, a JSON project in another, restore on boot, poll on save.**
For Studio Lite we would keep the shape and fix the sharp edges:

| reference behaviour | polish for Studio Lite |
|---|---|
| full project re-serialised every 2 s | write on change with a short debounce, and only the fields that changed |
| `restore()` `return`s if **any** referenced file is missing (L658) — one lost blob discards the whole project | restore what is present and flag the clips whose media is gone |
| no schema version for the stored JSON | stamp a version and migrate; the DB already carries `version: 1` but the *payload* is unversioned |
| deleted clips leave their blob in `f` forever | garbage-collect unreferenced sources (refcount by `src`) |
| no quota handling beyond `null` | surface "storage full" and offer to drop large media |
| media and project share one origin with the app | keep the DB name namespaced (`cliplite` does this correctly) |

---

## 2. Shell and layout — four states, one divider, one shortcut

The app does not have a phone layout and a desktop layout. It has **one grid and
four states**, and the preview's position is the only variable.

| state | columns | where the timeline goes |
|---|---|---|
| `top` *(default under 600px)* | one | under the preview — the phone layout |
| `left` | `--pw · 12px · 1fr` | right column, preview left |
| `right` | `1fr · 12px · var(--pw)` | left column, preview right |
| `full` | one | nowhere — preview only, chrome hidden |

### The mechanism that makes it possible

```css
body{display:grid;grid-template-areas:"bar" "view" "panel" "ar" "tc" "tlw" "tools"}
.dock{display:contents}
```

`.dock` is a flex box in the phone state; in the side states it becomes
`display:contents`, so its children (transport, timecode, timeline, tools)
**dissolve into the page grid** and can be placed in different columns. One
property is what buys the whole split.

### Choosing a state

`eff()` picks automatically, and `lay` can override it (L668):

```js
function eff(){const w=innerWidth,h=innerHeight;if(w<600)return'top';
  if(lay=='auto')return(w>=900&&w>h)||(w>h&&h<500)?'left':'top';return lay}
```

Landscape **and** ≥900 wide splits; a phone never does; a landscape phone does.
The header button cycles all four (or press `p`), and the icon changes to the
state you would get *if you tapped again* (L676–681). `shift+P` jumps between
`full` and `left`. The switch is wrapped in `document.startViewTransition` with a
`prefers-reduced-motion` guard (L680).

The chosen state is remembered (`cl.lay`), and a `resize` listener re-decides —
so rotating the device re-runs the whole thing.

### The divider is a real control

`#split` is a 12px grid column with `role="separator"`, `aria-orientation`,
`tabindex=0` and `cursor:col-resize` (L700–709):

- drag with pointer capture, converting the x position into a fraction;
- **`--pw` clamped to `0.28–0.6`**, so neither column can be lost;
- double-click resets to `0.4`;
- `ArrowLeft` / `ArrowRight` nudge by 2%, mirrored in the `right` state;
- the value is persisted as `cl.pw`;
- a grip is drawn with `#split::after`.

### The sheet adapts to the layout

In the phone state, opening a property sheet hides the whole dock
(`body.es .dock{display:none}`). In the side states the dock stays and the panel
becomes a **fixed card down the side**: `width:340px`, `top:64px`, `bottom:12px`,
with the timeline given `margin-right:352px` so nothing hides underneath it.

### Free vs centred playhead

Two playback modes for the timeline, switched from the ⋮ menu and persisted as
`cl.free` (L670–678):

- **centred** — the playhead is pinned at `clientWidth/2` and the *timeline
  scrolls* under it (`tl.scrollLeft = t*pps`);
- **free** — the playhead *moves inside the view*, and the timeline only scrolls
  when the head approaches an edge, then it re-frames at 15% from the left.

Free mode needs ≥600px, adds a draggable knob (`#phh`), and **re-masks the ruler**
so the tick strip hides behind the timecode in a different pattern than the
centred mode does.

---

## 3. The timeline

Five stacked rows inside one horizontally-scrolling strip (`#inn`), each given the
same computed width so they stay in register (L397):

| row | contents | height |
|---|---|---|
| `#ruler` | dot guides on a masked strip | 22px |
| `#track` | video clips, filmstrips, trim handles, transition junctions | 50–76px |
| `#atrack` | audio waveform per clip | 36–50px |
| `#ttrack` | "text effects" lane (upper) | computed |
| `#btrack` | captions lane (lower) | computed |

### Ruler dots instead of labels

Ticks are 3px dots, and the **interval is derived from zoom, not chosen**:

```js
const st=pps>=12?1:[2,5,10,30,60].find(v=>v*pps>=12)||60;
```

A `#rl` overlay carries a `mask-image` that fades the dots out beside the timecode
and the transport, so the strip never collides with the chrome — and free-playhead
mode swaps in a different mask.

### Lane packing

Captions and text effects each get their own stack, packed greedily by start time
(`lanes()`, L387): walk the texts in order, drop each into the first row whose
last end is ≤ its start, else open a new row. Track heights are then computed from
the row counts.

### Four ways to zoom

| gesture | behaviour |
|---|---|
| pinch (two fingers) | `pps` scales by the distance ratio |
| ctrl + wheel | ×1.1 / ×0.9 per notch |
| wheel / shift-wheel | scrolls the timeline sideways |
| View menu | zoom out, zoom in, **Fit all** (`clientWidth*0.8/total`) |

`pps` is clamped to **2–240** everywhere.

### Snapping, with haptics

`snapV(v)` pulls a dragged value to the nearest of: 0, `total`, the playhead,
every clip start and end, and every *other* text's start and end — but only within
an 8px threshold (`8/pps` seconds). When a snap is taken, a vertical `#snap` line
appears at that position and the device **vibrates for 6ms**
(`navigator.vibrate(6)`), and a small `#tip` bubble shows the live number
(`"00:03.2 → 00:08.0 · 4.8s"`).

---

## 4. Editing operations

| operation | how it behaves |
|---|---|
| **Trim** | drag the 22px edge handles (14px on a fine pointer). Live readout of `in → out · duration`; snapping; the video seeks to follow the edge. |
| **Split** | cuts at the playhead, inserts the tail as a new clip, selects it. Refuses with a toast if the playhead is within 0.15s of either end. |
| **Delete** | removes the selected clip or text; multi-select deletes the whole set. |
| **Duplicate** | inserts a copy directly after; for a text it drops the copy just past the original's end. |
| **Reorder** | long-press (380ms) **or** immediate drag when the clip is already selected (or the pointer is a mouse). A `#ins` marker shows the landing slot; the dragged clip lifts with a shadow; a 10ms haptic fires on lift. |
| **Nudge** | ±1/30s per press; shift = ±1s; press-and-hold repeats every 70ms after 350ms. |
| **Freeze frame** | splits the clip at the playhead and inserts a 2-second still (`fz:true`, `vol:0`) between the two halves. |
| **Transition** | a junction button between clips; none / fade black / fade white / wipe → / wipe ↓, with a 0.2–2s duration. |
| **Trim to playhead** | `[` trims the start, `]` trims the end (also toolbar buttons). |

Every destructive edit calls `snap()` first, which pushes a full JSON snapshot of
`{clips,texts,proj}` onto the undo stack — capped at **40 entries** — and clears
the redo stack. `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` walk it.

---

## 5. Multi-select — a real mode, not a modifier

Holding ctrl / meta / shift and tapping a clip enters **multi-select mode**; the
Select tool enters it too. It is a distinct UI, not a highlight:

- the toolbar is *replaced*: `Done · Delete · Duplicate · Move left · Move right · Select all`
  (plus the four clip tools, which then edit every selected clip at once);
- a `"N selected"` counter sits in the tool strip;
- each selected clip grows a **✓ badge** (`.msel::after`);
- **Move left / right** reorders the selection through the timeline without
  disturbing the clips it passes;
- **dragging a property slider applies it to every selected clip** —
  `syncMulti()` (L737) copies speed, volume, filter and rotation from the
  *first* selected clip to the rest as you drag.

Selection is a `Set` of `'c'+id` / `'t'+id` strings, so clips and captions share
one mechanism.

---

## 6. Titles and captions

Two independent lanes ("fx" above, "cap" below) with **four templates** drawn
straight into the canvas (L497–518):

| template | look |
|---|---|
| **Plain** | white, black outline, lower third (`H*0.86`) |
| **Rainbow** | each character a different colour, darkened outline, plus an animated **8-point star field** around the text |
| **Neon** | cyan glow via `shadowBlur`, drawn twice |
| **Comic** | heavy black stroke, yellow fill |

Details worth stealing:

- **Word wrap is measured, not guessed** — `wrapT()` uses `ctx.measureText` word
  by word against 84% of the canvas width;
- colours cycle `TXC[id % 5]`, so captions are distinguishable at a glance;
- the sparkles are **deterministic pseudo-random from the text id**
  (`Math.sin(id*31+i)*43758.5453`), so they twinkle but never jump frame to frame;
- **unselected captions collapse to 14px bars** and expand to 34px when selected,
  which is how a lane of captions stays readable without a legend;
- the text input lives in the sheet (`maxlength=60`) and edits live.

---

## 7. Properties and effects

Seven tools, each a sheet with **Cancel / Reset / Done** (L589–640):

| tool | control | details |
|---|---|---|
| **Speed** | slider 0.25–4× | presets 0.5 / 1 / 2 |
| **Volume** | slider 0–1 | presets Mute / 50% / 100% |
| **Filter** | 6 chips | `none, vivid, mono, warm, cool, fade` — each a CSS `filter` string |
| **Rotate** | −180…180° | plus a "Rotate 90°" button that wraps |
| **Transition** | 5 chips + duration | none / black / white / wipe→ / wipe↓ |
| **Canvas** | aspect + background | 16:9, 9:16, 1:1, 4:5; black, charcoal, grey, white |
| **Text** | input + 4 templates | see §6 |

The sheet's commit model is worth copying exactly: **`esBase` is a snapshot taken
when the sheet opens.** *Cancel* restores it wholesale; *Done* pushes it to the
undo history if anything changed; *Reset* returns the single property to default.
That is why a slider drag is safe on a phone with no confirm dialog.

---

## 8. The media pipeline (all derived on import)

Importing one file kicks off three independent jobs, none of which block:

1. **`loadSrc`** — creates the `<video>`, and wires it into a shared
   **`AudioContext` → `MediaStreamDestination`** graph so export can capture audio.
2. **`thumbs`** — seeks the video every `duration/120` (max 120 frames, min 4),
   draws each frame to a 72px-tall canvas, encodes **JPEG at 0.6**, and stores an
   object URL per frame. Repaints the strip every 10 frames so it fills in
   progressively.
3. **`peaks`** — decodes the *whole file* with `decodeAudioData`, sampling 25
   peaks/second, normalising to the loudest, and storing a `Float32Array`. Skips
   files over **200 MB**. The waveform is then drawn as one SVG path of vertical
   strokes, so it scales with zoom instead of being a bitmap.

If the first import decides the project aspect (`v.videoHeight > v.videoWidth ?
'9:16' : '16:9'`), it applies it automatically.

---

## 9. Export

`MediaRecorder` over `cv.captureStream(30)`, plus the audio tracks from the shared
`MediaStreamDestination` (L777–786):

- codec preference: `video/mp4;codecs=avc1` → `video/webm;codecs=vp9,opus` →
  `video/webm`, picked with `isTypeSupported`;
- **8 Mbps** video bitrate;
- it seeks to 0, shows a modal overlay with a **progress bar driven by `t/total`**,
  and starts playback — the recording *is* the preview;
- a **Cancel** button stops and discards;
- on stop it downloads `clip-lite.mp4` or `clip-lite.webm` and toasts "Exported".

This is **realtime** capture: a 20-second video takes 20 seconds to export, and
nothing is drawn offscreen. Studio Pro's export pipeline is the more capable one;
what is worth keeping here is the progress UI and the graceful `isTypeSupported`
fallback chain.

---

## 10. Input and gesture model

Almost everything is `pointer*`, which is why it works on a finger and a mouse at
once:

| gesture | result |
|---|---|
| tap a clip | select (synthetic `click` still fires after a drag is suppressed) |
| drag a clip's middle | reorder, after long-press or if already selected |
| drag the timeline background | **scrub to pan** (scroll the view) |
| drag the playhead knob | seek, with a dead zone and auto-scroll at the edges |
| pinch | zoom the timeline |
| drill-down on the ruler | seeks by proxy-dispatched `pointerdown` |

Three details that make it feel native:

- **`noClick` timestamp** — after any drag, a 300ms window swallows the click, so
  finishing a drag never also selects something else (L415, L457);
- **auto-scroll** — while dragging near an edge (±48px / ±40px), the timeline
  scrolls 8–10px per frame inside a `requestAnimationFrame` loop;
- **`navigator.vibrate`** on snap and on clip lift.

The timeline's `contextmenu` is disabled outright.

---

## 11. Keyboard shortcuts (L771–776)

| key | action |
|---|---|
| `Space` | play / pause |
| `s` | split at the playhead |
| `Delete` / `Backspace` | delete selection |
| `Ctrl/Cmd+Z` · `Ctrl+Shift+Z` · `Ctrl+Y` | undo · redo · redo |
| `←` / `→` | ±1/30s, with `Shift` = ±1s |
| `d` | duplicate |
| `p` · `Shift+P` | cycle layout · toggle fullscreen preview |
| `[` / `]` | trim start / end to the playhead |
| `Escape` | leave fullscreen; finish multi-select |

Text inputs are excluded explicitly, so typing in a caption never fires `s` or
`Delete`.

---

## 12. Theming, tokens and touch sizing

**One token set, three ways to resolve it:** light by default, dark under
`prefers-color-scheme: dark`, and an explicit `data-theme` override from the menu.
Around twenty custom properties carry it — surface pairs (`--sf`, `--sf2`,
`--pc`), text pairs (`--on`, `--on2`, `--onpc`), `--pri`/`--onpri`, the clip and
caption colours (`--clip`, `--tx`), the outline `--ol`, and the playhead `--ph`.

Smaller decisions that read as polish:

- **`env(safe-area-inset-*)` on all four sides** — the notch and the home bar are
  respected, not discovered in the field;
- **`100dvh` behind `@supports`**, with a plain `100%` fallback;
- **sizing scales with input type**, not just width:
  `--tgt: 48px` touch vs `40px` fine pointer; `--hw: 22px` handle vs `14px`;
  `--vh: 50/54/64px` lane height by breakpoint;
- **container queries on the tool strip** (`container-type:inline-size`), so the
  strip reacts to *its own* width rather than the viewport's;
- `font-variant-numeric: tabular-nums` on the timecode so digits stop jittering;
- a **`focus-visible` outline** everywhere, and real `aria-label`s on icon buttons;
- `overflow:hidden` on `body` with `user-select:none` — an app, not a document.

---

## 13. The icon system — SVG now, Material Symbols when available

The file ships **two complete icon sets** and picks at runtime:

- a hand-written inline SVG path per icon (`ICON[…]`, ~45 of them);
- a **Material Symbols** name per icon (`MSMAP[…]`), loaded as a font.

`hydrate()` replaces every `<i class="ico" data-i="…">` with whichever is live.
At boot it renders SVG; when `document.fonts.load('24px "Material Symbols Outlined"')`
resolves with a face, it flips a global `MS` flag and re-hydrates (L790).

It is progressive enhancement done properly: **no flash of missing icons, no hard
dependency on a font CDN**, and one name map decides everything. `.ms.fill`
carries the FILL axis for solid glyphs; `.ms.flip` mirrors the right-hand layout icon.

---

## 14. Menus, popovers and feedback

| surface | contents |
|---|---|
| **⋮ More** | theme toggle, playhead mode, New project |
| **View** | Snapping, Zoom out, Zoom in, Fit all, Collapse text tracks |
| **Tool overflow** | any tool button that did not fit the strip |
| **Toast** | transient confirmation, 1.8s, bottom-centre |
| **Export overlay** | progress bar + cancel |

The overflow menu is **measured, not breakpointed** (`strip()`, L564): it counts
how many tool buttons fit the strip's real width (`iconOnly` when a side column is
narrow, 56px vs 72px per button), keeps the last slot for a `more` button, and
moves the rest into a popover. The popover is positioned from the button's own
`getBoundingClientRect`, and **every open menu closes on any outside
`pointerdown`** via one capture-phase listener (L686).

---

## 15. The polish backlog — what to take, and what to fix on the way in

Ordered roughly by how much they would change Studio Lite, with the reference's
rough edge stated so it is not shipped by accident.

| # | feature | reference does | polish for Studio Lite |
|---|---|---|---|
| 1 | **Project persistence** | IndexedDB blobs + JSON, 2s poll | debounced writes, versioned schema, refcounted media GC, quota message, partial restore |
| 2 | **Layout states + divider** | 4 states, `--pw` 28–60%, persisted | keep it, but clamp against the **safe-area box**, not `innerWidth`, and re-measure the preview on reset |
| 3 | **Free vs centred playhead** | two modes, persisted | keep — it is the single best touch convention here; make the mode a Settings row, not a mystery icon |
| 4 | **Multi-select** | ctrl/shift, toolbar swap, property sync | keep the mode and the ✓ badge; add marquee drag-select and make "select all" scope explicit (clips vs captions) |
| 5 | **Long-press reorder** | 380ms, lift shadow, insertion marker | keep; add a **drag handle** so the long-press is discoverable, and cancel on scroll |
| 6 | **Snap + haptic + tip** | 8px fixed threshold, vibrate 6ms | make the threshold **density-aware** (px, not seconds), keep vibration, and show which target was snapped to |
| 7 | **Derived media** | JPEG filmstrip, decoded peaks | move to a **worker** (Studio Pro already has `export-worker.js`); decode peaks incrementally instead of the whole file |
| 8 | **Caption templates** | 4 canvas-drawn styles | keep the measured word-wrap and deterministic sparkles; move styling to a real text model so it is themeable and testable |
| 9 | **Sheet commit model** | `esBase` snapshot, Cancel/Done/Reset | keep exactly — it is the cleanest phone-editing contract in the file |
| 10 | **Ruler dots + fade masks** | derived interval, mask near chrome | keep; our own mock already has a stricter dot ladder (`RULER-GUIDES-PLAN.md`) |
| 11 | **Export** | realtime MediaRecorder, 8 Mbps | keep the progress/cancel UI; **use Studio Pro's offline export**, not realtime capture |
| 12 | **Dual icon set** | SVG with Material Symbols upgrade | keep the fallback idea; our `ADJUST-FILTERS-TEXT-CLIP.md` already argues for hand-drawn geometric icons |
| 13 | **Zoom gestures** | pinch, ctrl+wheel, wheel-pan | keep; separate pan from scrub clearly, and give zoom a visible readout |
| 14 | **New project** | two-tap arm within 3s | keep the guard, state the consequence in the label, and offer undo |

---

## 16. What not to copy

These are real weaknesses in the reference, listed so a port does not inherit them:

- **`restore()` abandons the whole project if one blob is missing** (L658). A
  single evicted file must not cost you the edit.
- **Unversioned payload.** The DB is versioned; the JSON inside it is not. Any
  field rename silently corrupts a saved project.
- **No media garbage collection.** Deleting a clip leaves its blob in `f` until a
  New project clears the store; the origin accumulates until quota.
- **Full re-serialisation every 2s** regardless of edit size, on the main thread.
- **Realtime export.** Fine as a demo, wrong as a product; it also means export
  quality is tied to playback smoothness.
- **`max-height:46vh` on the timeline** in the phone state, which is what the
  reference's own IPAD plan criticises as "leaves the column half empty".
- **Panel overrides accumulate.** The stylesheet carries several generations of
  `#panel`, `.tools` and `.tx` rules stacked on top of each other; a port should
  resolve each component once.
- **`snapV`'s threshold is in seconds converted from a fixed 8px**, so snapping
  gets *harder* to hit the more you zoom in, which is backwards.

---

## 17. Where our own mock already stands

Useful when deciding what is genuinely new. Compared with
[`clip-lite-mock.html`](clip-lite-mock.html):

| already in ours | only in the reference |
|---|---|
| filter shelf with **11 chains + 2 layered effects** | **project persistence** (§1) |
| Adjust shelf, 13 knobs (incl. bipolar Vignette + Grain, and Blue tone, Blur, Opacity) | **multi-select mode** (§5) |
| captions with templates, live trim, snapping | **free-vs-centred playhead** (§2) |
| transitions, aspect + background | **layout states + draggable divider** (§2) |
| ruler with a derived dot ladder | **freeze frame** |
| self-check suite (21 controls + 4 row checks) | **waveform lane** derived from audio |
| iPad side-by-side **plan** | **undo/redo with a 40-deep stack** |
| | **keyboard shortcut layer** |
| | **export with progress + cancel** |

The headline gap is §1. Everything else is a smaller, well-scoped port, and the
ones worth doing first are **persistence**, **free playhead** and **multi-select**
— each is a self-contained change with a clear success test, and each changes what
the editor can be used for rather than how it looks.

