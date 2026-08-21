# Caption Clips vs. Markdown-Generated Clips — Comparison

**Area:** `index.html` — Captions system (`State.subtitles`, `syncSubtitlesToClips`, `drawSubtitlesOnCanvas`) vs. Markdown system (`State.markdownConfig`, `parseMarkdownToClips`, `applyMarkdownStyle`)
**Date:** Aug 2026

---

## 1. Executive summary

Both features generate **text clips on the timeline from written text**, but they are
architecturally opposite:

| | **Caption clips** | **Markdown-generated clips** |
|---|---|---|
| **Source of truth** | `State.subtitles[]` (timed entries) | The markdown script (`State.markdownText`) |
| **Clip lifecycle** | Mirrors of a subtitle; rebuilt on every sync | Rebuilt from scratch on every parse |
| **Style owner** | Global `subtitleConfig` + per-caption `sub.effects` overrides | Baked into each clip's `effects` at generation |
| **Render path** | Overlay `drawSubtitlesOnCanvas()` — clip renderer **skips** them | Normal clip pipeline in `drawCanvas()` |
| **Timing** | Explicit per-caption start/end (from SRT/VTT/auto-chunk) | Slide-relative (fixed `slideDuration`, `textDelay`) |
| **Track** | One dedicated `Captions` track at the top | Auto: per-element-type lanes; Script: one lane per element position |

In short: **captions are a data-driven overlay** (the clip on the timeline is a
convenience mirror), while **markdown clips are ordinary, fully self-contained clips**
that happen to be generated from a script.

---

## 2. Origins & generation paths

### Captions — `State.subtitles[]` is the source of truth

Entries are created by:

1. **Import** — `.srt` / `.vtt` files via `parseSRT()` (L15571).
2. **Manual** — `addEmptySubtitle()` at the playhead, edited inline.
3. **Generate from Text** — `chunkTextForCaptions()` (L16236) + `generateCaptionsFromText()` (L16266): pasted plain text is chunked into back-to-back captions at ~2.8 words/sec (or one caption per line), each with a fixed duration.

`syncSubtitlesToClips()` (L15874) then creates **one text clip per subtitle** on the
dedicated `Captions` track (`id: 'subtitle_track'`), linked by `clip.subtitleId = sub.id`.
The clip's `text`, `start`, and `duration` are always overwritten from the subtitle on
every sync — the clip is a **mirror**, not an owner.

### Markdown — the script is the source of truth

`parseMarkdownToClips()` (L18675) tokenizes the script line by line into *slides*
(separated by `---`), each slide holding headings (`#`/`##`), body text, images
(`![alt](url)`), videos (`[video](url)` or `mp4`/`webm` URLs), math (`$$ latex $$`),
and position tags (`[left]`, `[top-right]`, …). Each element becomes its own clip:

| Element | Clip type | Marker |
|---|---|---|
| `# Heading` | `text` | `_mdGenerated: true` |
| Body text | `text` | `_mdGenerated: true` |
| `$$ … $$` | `text` (`renderAsMath: true`) | `_mdGenerated`, `_mdMath` |
| `![alt](url)` | `image` (or `video` for video URLs) | `_mdGenerated`, `_mdMedia`, `_mdMock` for mocks |
| `[audio:name]` tag | attached to any of the above | `_mdAudioRef` + `sfx` |

**Regeneration is destructive:** every parse starts with
`State.clips = State.clips.filter(c => !c._mdGenerated)` (L18686), so any manual edits to
markdown clips are lost on re-parse. `clearMarkdownClips()` (L18438) removes them all.

---

## 3. Data model — clip shape side by side

### Caption clip (created by `syncSubtitlesToClips`, L15902)

```js
{
  id: 'subclip_sub_…',        // deterministic: 'subclip_' + subtitle id
  subtitleId: 'sub_…',        // ← the link back to State.subtitles[]
  trackId: 'subtitle_track',  // always the Captions track
  type: 'text',
  title: 'Caption',
  text: sub.text,             // overwritten on every sync
  start: sub.startTime,
  duration: sub.endTime - sub.startTime,
  effects: {                  // minimal defaults; the REAL style lives in
    scale: 1, rotate: 0,      //   State.subtitleConfig + sub.effects
    offsetX: 0, offsetY: 0,
    fontFamily: 'Inter', fontWeight: 700, fillColor: '#ffffff', fontSize: 80
  }
}
```

Key points:

- The clip carries almost no style. `drawSubtitlesOnCanvas` merges
  `{ ...State.subtitleConfig, ...sub.effects }` — **`clip.effects` is not read**.
- The `subtitleId` link makes every `setClipEffect` call mirror the value into
  `sub.effects` through `subtitleEffectMap` (L6864), so edits from the Properties /
  Animations panels land on the subtitle.
- Timeline drag/trim of the clip writes back to `sub.startTime`/`sub.endTime`
  (bidirectional sync, in `handleMouseUp`).

### Markdown text clip (created by `mdHeadingClip` / `mdTextClip`)

```js
{
  id: 'md_<ts>_<slide>_<rand>_heading',  // or '_text'
  trackId: <lane>,          // auto: slide track / next track; script: per-position lane
  type: 'text',
  text: '…',                // wrapped (wrapMdText, 45 chars) — plain clips don't wrap
  start: <slide start>,     // text uses textDelay: tStart = start + textDelay
  duration: slideDuration,  // (text: slideDuration - textDelay)
  _mdGenerated: true,       // ← regeneration marker
  _mdPos: 'top' | 'center' | …,   // from position tag or config
  _mdStackIdx: 0,           // stacking index for same-side elements
  effects: {                // FULLY baked: font, stroke, shadow, extrude,
    scale: 1, rotate: 0,    //   animIn, animText*, wordOverrides, …
    fontFamily: 'Rubik', fontSize: 60, fontWeight: 700, fillColor: '#ffffff',
    strokeEnable: true, strokeColor: '#000000', strokeWidth: 4,
    shadowEnable: true, shadowBlur: 20, …
    extrudeEnable: false, …
    animIn: 'fadeIn', animTextIn: 'none', animTextStagger: 'letter', …
  }
}
```

Key points:

- **Everything is baked** at generation from `State.markdownConfig` (per-element-type
  keys: `heading*`, `text*`, `image*`, `math*`). After generation the clip is an
  ordinary text clip — the Properties / Animations / Keyframes panels work normally.
- `**bold**` in body text becomes `wordOverrides` (`fontWeight: 700` per word index)
  using the letter-style tokenizer (L19020).
- Mocks (`_mdMock`) draw a styled placeholder card (640×360) with the alt text instead
  of loading media; replacing the source clears `_mdMock`/`_mdMedia` (L12436).

---

## 4. Track placement & timeline layout

### Captions

- **One track:** `Captions` (id `subtitle_track`), always unshifted to the top,
  36px tall, indigo-bordered.
- All caption clips live there (unless the user manually moves one — it keeps
  `subtitleId` and still renders through the overlay; overlap resolution uses the new
  track's index, L19531).

### Markdown — two track modes (`markdownConfig.trackMode`)

| Mode | Layout |
|---|---|
| `auto` (default) | Heading on the slide's track; body text on the next available video track; images/videos on `Media` (bottom), `Media 2`… lanes below the heading track; math on a dedicated `Math` lane. |
| `script` | One lane per **element position** in the slide — `mdscr_<pos>_` lanes shared across all slides (or reused plain V tracks), mirroring script order top-to-bottom. |

Lanes are **reused across generations** (`getMdImageLane`, `getMdScriptLane`,
`getMdMathLane` look for existing `mdimg_`/`mdscr_`/`mdmath_` tracks first), so
re-running the parse doesn't duplicate tracks.

---

## 5. Rendering pipeline

### Captions — overlay renderer

In `drawCanvas()`, the active-clip loop **skips** subtitle clips:

```js
// Skip subtitle-linked clips — drawSubtitlesOnCanvas handles them
if (clip.type === 'text' && !clip.subtitleId) { … }
```

`drawSubtitlesOnCanvas(ctx, w, h)` (L19531) runs at the very end of `drawCanvas()`
(and therefore in both export paths). It:

1. Filters active subtitles (`time >= startTime && time < endTime`), resolving overlap
   by track index / zIndex.
2. Merges `ef = { ...cfg, ...sub.effects }`.
3. Positions by `ef.position` (`bottom`/`top`) + `ef.bottomOffset` — **not** by
   `offsetX`/`offsetY`; wraps text to 85% of canvas width (unscaled by `styleScale`).
4. Applies entrance/exit animation (alpha/yOffset/xOffset/scale), then either the plain
   line draw, a letter preset (`drawCaptionLetters` L19324), or a word preset
   (`drawCaptionWordGlow` L19401) when `animFullSpan` (karaoke) is on.

### Markdown — normal clip pipeline

Markdown text/image/video/math clips flow through the ordinary clip renderer:

- **Text** (L4538): centered at `w/2, h/2` + `offsetX/offsetY` **percent**, full effect
  schema (scale/rotate/stroke/shadow/extrude/letter-animations).
- **Image/video**: standard media draw with crop/mask/framing, or the mock card when
  `_mdMock`.
- **Math**: `renderAsMath: true` renders via MathJax→sprite (`warmMathImage`).
- **Audio tags**: `sfx` attached via `withMdAudio`, played like any clip sound.

---

## 6. Styling model

### Captions — global config + per-caption override

- **Global:** `State.subtitleConfig` (L1128) — font, size, weight, color, stroke,
  shadow, background box, texture, position, animations, karaoke preset +
  `highlightColor`. Edited in the captions panel **Style** sub-tab.
- **Per-caption:** `sub.effects` overrides, edited from the caption's Properties card.
  The UI (`captionStyleControlHtml` L16325) renders the *same* control groups for both
  scopes, with **Global / revert chips** (per field) that drop an override back to
  inheritance (`setSubCaptionAnim`, L16160).
- **Presets:** `applyCaptionPreset` (L16540) applies a saved text preset to global or a
  single caption, mapping text-clip animation vocabulary via
  `ANIM_IN_TEXT_TO_CAPTION` / `TEXT_LETTER_TO_PRESET`.
- **Reset:** `resetAllSubtitleOverrides` clears every per-caption override.

### Markdown — global config baked into clips

- **Global:** `State.markdownConfig` (L1066) with per-element-type key prefixes
  (`heading*`, `text*`, `image*`, `math*`), position/offset/gap, slide duration,
  track mode, embedded audio assets.
- **Re-style:** `applyMarkdownStyle()` (L17155) re-applies the config onto every
  `_mdGenerated` clip (overwrites style keys only — keeps per-clip tweaks to other
  keys until the next re-style/parse).
- **Quick Styles:** preset chips in the Markdown panel that call
  `applyMarkdownStyle` with preset config values (mirrors the caption preset strip).

---

## 7. Animation model

### Captions (caption vocabulary, `drawSubtitlesOnCanvas`)

- **Entrance / exit:** `animIn` / `animOut` — `fadeIn/fadeOut`, `slideUp/slideDown`,
  `slideLeft/slideRight`, `scaleIn/scaleOut`, `popIn`, with durations + easing.
  Also accepts text-clip values (`fade`, `zoomIn`, `pop`, …) through alias tables.
- **Presets:** `animPreset` — `fade`, `pop`, and the **CapCut-style karaoke set**:
  `letterPop`, `letterFade`, `typewriter`, `bounce`, `rotate`, and the word presets
  `wordHighlight`, `wordColor`, `wordPop`, `wordUnderline`, `wordGradient`,
  `wordShake`, `wordStretch`.
- **Karaoke mode:** `animFullSpan: true` makes the sweep span the **caption's full
  on-screen time** with speech-weighted word slices (chars + pause per word) across
  all lines, so every word lights up as it's spoken — even on short, dense captions.
  `highlightColor` drives the accent.
- Timing basis is `subTime`/`timeLeft` — relative to the caption's own window.

### Markdown (text-clip vocabulary, normal clip renderer)

- **Clip entrance/exit/loop:** `animIn` (`fade`, `slideUp`, `zoomIn`, `pop`, …),
  `animOut`, `animLoop` + durations/easing.
- **Per-letter:** `animTextIn` / `animTextOut` / `animTextLoop` (`scaleFade`,
  `slideUp`, `typewriter`, `odometer`, …) with `animTextStagger` (`letter`/`word`) —
  the standard text letter-animation system.
- No karaoke word-highlight presets on markdown text clips (the word presets are
  caption-only; converting a caption to text maps them to `typewriter`, see §9).

---

## 8. Editing, keyframing & undo

| Behavior | Caption clips | Markdown clips |
|---|---|---|
| **Timeline drag/trim** | Bidirectional — writes back to `sub.startTime/endTime`; the next sync re-applies | Plain clip edit; survives until re-parse |
| **Canvas drag** | Sets `clip.effects.offsetX/offsetY` (L22856), but the overlay renderer never reads them (they're not in `subtitleEffectMap`) → **no visual move** | Works normally (percent offsets) |
| **Properties/Animations panel** | Edits mirror into `sub.effects` via `subtitleEffectMap`; works for caption keys | Works normally on baked effects |
| **Keyframing** | Clip keyframes are interpolated by the clip renderer, which **skips** subtitle clips — and the overlay renderer doesn't call `getInterpolatedValue`. Only keys mirrored into `sub.effects` (e.g. `scale`) animate; **position keyframes don't move the caption** | Full keyframing works (text clips) |
| **Undo/redo** | Covered by the timeline/canvas/keyframe undo (snapshots include all clips) | Covered the same way; re-parse bypasses history (destructive regen) |
| **Deletion** | `deleteSubtitle` removes subtitle → clip removed on next sync | `clearMarkdownClips` removes all `_mdGenerated` |

---

## 9. Conversion & interoperability

### Captions → text clips

- `convertSubtitleClipToText(clipId)` (L16082) / `convertCaptionTrackToText()` (L16107)
  bake the effective style into `clip.effects` via `bakeSubtitleStyleIntoClip`
  (L15948), delete `subtitleId`, and (for the whole-track version) clear
  `State.subtitles` and rename the track to a normal text track.
- Animation mapping: caption `animIn` → text values (`fadeIn→fade`, `slideUp→slideUp`,
  `scaleIn→zoomIn`), and word presets degrade to `animTextIn: 'typewriter'` (spread
  across the clip when `animFullSpan` was on) because the text pipeline has no word
  highlight renderer.
- Position is converted from `position` + `bottomOffset` into an `offsetY` percentage
  so the converted text sits where the caption was.

### Markdown → anything

No reverse conversion exists; `**bold**` produces `wordOverrides` inline. Markdown
clips are just text clips, so they can be further edited, keyframed, converted to
captions only by copy-paste of text.

---

## 10. Persistence

| | Captions | Markdown |
|---|---|---|
| **localStorage** | `studioPro_subtitles`, `studioPro_subtitleConfig` | `studiopro_markdownConfig`, `markdownText` (in State) |
| **Project file** | `subtitles`, `subtitleConfig` saved (L25253); clips rebuilt by `syncSubtitlesToClips` on load | `markdownConfig`, `markdownText` saved; `_mdGenerated` clips serialize as ordinary clips (re-styling still works via `applyMarkdownStyle`) |
| **On load** | Subtitle clips re-created from data | Generated clips restored as-is; re-running parse rebuilds from script |

Both survive project save/load; captions additionally re-derive their clips, markdown
clips additionally carry a regeneration tag.

---

## 11. Gaps & notable differences (worth knowing)

1. **Canvas drag / position keyframes do nothing on caption clips.** The drag handler
   and keyframe interpolator write `clip.effects.offsetX/offsetY`, but
   `drawSubtitlesOnCanvas` renders from `position`+`bottomOffset` and never reads
   clip offsets (nor calls `getInterpolatedValue`). Dragging a caption on canvas
   appears "stuck". Only properties mirrored into `sub.effects` via
   `subtitleEffectMap` (e.g. `scale`, fonts, colors, animations) affect the render.
2. **Destructive regeneration.** Re-running `parseMarkdownToClips` drops all manual
   edits to markdown clips; captions never have this problem (they're mirrors).
3. **No word-karaoke on text clips.** The 7 CapCut word presets are caption-only;
   converted captions fall back to typewriter.
4. **Different positioning models.** Captions anchor to canvas edges (bottom/top +
   pixel offset); markdown text anchors to canvas center + percentage offsets
   (with `mdStackOffsets` for same-side stacking).
5. **Line wrapping differs.** Captions wrap by measured pixel width (85% canvas);
   markdown text wraps by character count (`wrapMdText`, 45 chars) at generation and
   stores the wrapped string in `clip.text`.
6. **Timing model differs.** Caption timing is absolute per entry; markdown timing is
   slide-relative (back-to-back slides of `slideDuration`, body text delayed by
   `textDelay`). Markdown clips *look* like captions only when `slideDuration` matches
   the reading pace.
7. **Audio differs.** Captions have no per-caption audio; markdown clips can carry
   `[audio:name]` SFX references.

---

## 12. Side-by-side quick reference

| Dimension | Caption clip | Markdown clip |
|---|---|---|
| Created by | `syncSubtitlesToClips` (L15874) | `parseMarkdownToClips` (L18675) |
| Identity | `subclip_<subId>` + `subtitleId` | `md_<ts>_<n>_<rand>_<kind>` + `_mdGenerated` |
| Source of truth | `State.subtitles[]` | Markdown script |
| Style | `subtitleConfig` + `sub.effects` | Baked `clip.effects` from `markdownConfig` |
| Renderer | `drawSubtitlesOnCanvas` overlay (L19531) | Normal clip pipeline in `drawCanvas` |
| Track | `Captions` (top) | Auto: type lanes / Script: position lanes |
| Position | `position` + `bottomOffset` (edge-anchored) | `offsetX/offsetY` % (center-anchored) |
| Animation vocab | caption entrance/exit + karaoke presets | text clip `animIn`/`animOut`/`animText*` |
| Text wrap | pixel-width (85% canvas) | char-count (45) at generation |
| Regeneration | Non-destructive (mirror) | Destructive (rebuild) |
| Conversion | → text clip (`convertSubtitleClipToText`) | n/a (already text clips) |
| Audio | none | `[audio:name]` SFX |

---

## 13. Suggested follow-ups (bridging the two)

1. **Let caption clips honor `offsetX/offsetY`** (from canvas drags and keyframes) by
   reading them in `drawSubtitlesOnCanvas` — or routing canvas drags on captions into
   `bottomOffset`/`position` changes.
2. **Port the word-karaoke presets into the text-clip renderer** so markdown text and
   converted captions keep CapCut-style sweeps.
3. **Make markdown regeneration non-destructive** (e.g. re-style in place like
   `applyMarkdownStyle` instead of rebuild) or warn when manual edits would be lost.
4. **Add a captions ↔ markdown bridge** (e.g. "Generate captions from markdown body
   text" or "Bake captions back into the script").
