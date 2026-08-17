# Markdown Props — Specification (P1)

> **Date:** August 2026
> **Status:** Spec for implementation · supersedes the informal prop sketch in [Projects-as-Templates-and-Md-Props-Plan.md](./Projects-as-Templates-and-Md-Props-Plan.md)
> **Scope:** The exact **front-matter key set**, the **element tag list**, the **precedence rules**, and the **backward-compatibility guarantees** for the Markdown → timeline generator's prop surface. Code refs are to `index.html` (29,829 lines).
> **Design north star:** Props are a *serialized projection of `markdownConfig` + project globals*, never a parallel config system. One store (`markdownConfig`), one parser (the existing one, generalized), backward compatible by construction.

---

## 0. Grammar Summary (one block)

```markdown
---
# ── front-matter (document level) ─────────────────────────────
template: shorts-captions        # .sptpl id/name — supplies any key not set below
aspect: 9:16                     # 16:9 | 9:16 | 1:1 | 4:5 | 4:3 | 3:2
fps: 30                          # 24 | 25 | 30 | 60
bg: #0b0b0f                      # canvas background hex
slideDuration: 4                 # seconds per slide (markdownConfig.slideDuration)
trackMode: auto                  # auto | script
startAt: zero                    # zero | playhead | 30 | 60
# ── global style (high-signal keys only) ─────────────────────
headingFontFamily: Anton
headingFontSize: 64
headingFontWeight: 900
headingColor: #fde047
headingPosition: top
headingAnimIn: zoomIn
textFontFamily: Inter
textFontSize: 34
textFontWeight: 400
textColor: #eeeeee
textPosition: bottom
textAnimIn: slideUp
imageAnimIn: fadeIn
imageScale: 1
imagePosition: right
mathFontSize: 56
mathColor: #ffffff
mathPosition: center
mathAnimIn: fadeIn
mdGap: 8
# ── captions (optional; only if the video is caption-driven) ──
captionAnim: wordHighlight       # subtitleConfig.animPreset
captionHighlight: #fde047        # subtitleConfig.highlightColor
captionFontFamily: Rubik
captionFillColor: #ffffff
---

# THIS IS BRUTAL [anim:zoomIn] [animDur:0.8] [animDelay:0.2] [top]

**The stat** [font:Anton] [size:140] [color:#fde047] [center]

![Logo](mock) [scale:1.4] [right] [audio:ding]

---

[dur:6]
## Second slide [anim:slideUp] [bottom]
```

**Two levels, one syntax family:**
- **Front-matter** — a `---`-delimited block at the very top; document-level keys (globals, template, global style, captions).
- **Element tags** — `[key:value]` brackets at the end of any element line (heading, paragraph, image, video, math) or slide separator; per-element overrides.
- Position tags (`[top]`…) and `[audio:name]` **stay exactly as they are** — they are the already-shipped members of the same tag family.

---

## 1. Front-Matter Keys (exact)

Parsed only at the **very top** of the script. A leading `---` is front-matter **only if** it closes with a later `---` and every line between is `key: value`, `# comment`, or blank; otherwise it is treated as today (a slide separator). `key:` must be followed by ` value` (space after colon, YAML-ish subset — no nested objects, no lists in P1).

| Key | Type | Target (code) | Valid values | Notes |
|---|---|---|---|---|
| `template` | string | `.sptpl` lookup | template id/name | Applies the design template; supplies any style key not set below. Unknown id → warn + continue (never fail). **V2 if the template engine hasn't shipped: accepted, warned, ignored.** |
| `aspect` | enum | `ASPECT_RATIOS[State.preview.aspectIndex]` | `16:9` `9:16` `4:3` `3:4` `1:1` `21:9` | Maps to the aspect index by label (see §9 F1 — `4:5`/`3:2` don't exist in `ASPECT_RATIOS`, index.html:1399) |
| `fps` | int | `State.exportFps` (export default) | `24` `25` `30` `60` | **There is no timeline fps** — only `State.exportFps` (index.html:28717); sets the export default only (see §9 F2) |
| `bg` | hex | `State.canvasBgColor` | `#rgb` `#rrggbb` | Canvas background |
| `slideDuration` | number | `markdownConfig.slideDuration` | `1–60` | Per-slide default (override per slide with `--- [dur:N]`) |
| `trackMode` | enum | `markdownConfig.trackMode` | `auto` `script` | Existing track-layout mode |
| `startAt` | enum | `markdownConfig.startAt` | `zero` `playhead` `30` `60` | Existing generate-from-time |
| `mdGap` | number | `markdownConfig.mdGap` | `0–30` (%) | Existing stack gap |
| `headingFontFamily` | string | `markdownConfig.headingFontFamily` | font name | Unquoted if one word; quoted for spaces: `headingFontFamily: "Space Grotesk"` |
| `headingFontSize` | number | `markdownConfig.headingFontSize` | `1–400` | |
| `headingFontWeight` | int | `markdownConfig.headingFontWeight` | `100–900` | |
| `headingColor` | hex | `markdownConfig.headingColor` | hex | |
| `headingPosition` | enum | `markdownConfig.headingPosition` | position names (§3.3) | Same values as `[top]` tags |
| `headingAnimIn` | string | `markdownConfig.headingAnimIn` | canonical anim set (§2 `[anim:]` row) | `fadeIn` alias → `fade`; unknown → warn, keep default |
| `textFontFamily` | string | `markdownConfig.textFontFamily` | font name | |
| `textFontSize` | number | `markdownConfig.textFontSize` | `1–400` | |
| `textFontWeight` | int | `markdownConfig.textFontWeight` | `100–900` | |
| `textColor` | hex | `markdownConfig.textColor` | hex | |
| `textPosition` | enum | `markdownConfig.textPosition` | position names | |
| `textAnimIn` | string | `markdownConfig.textAnimIn` | canonical anim set | `fadeIn` alias → `fade` |
| `imageAnimIn` | string | `markdownConfig.imageAnimIn` | canonical anim set | `fadeIn` alias → `fade` |
| `imageScale` | number | `markdownConfig.imageScale` | `0.1–5` | |
| `imagePosition` | enum | `markdownConfig.imagePosition` | position names | |
| `mathFontSize` | number | `markdownConfig.mathFontSize` | `1–400` | |
| `mathColor` | hex | `markdownConfig.mathColor` | hex | |
| `mathPosition` | enum | `markdownConfig.mathPosition` | position names | |
| `mathAnimIn` | string | `markdownConfig.mathAnimIn` | canonical anim set | `fadeIn` alias → `fade` |
| `captionAnim` | string | `subtitleConfig.animPreset` | any caption preset (`none` `wordHighlight` `wordPop` `wordUnderline` `wordGradient` `wordShake` `wordStretch` `letterPop` `letterFade` `bounce` `rotate` `typewriter` …) | Sets the **global `subtitleConfig`** — the single store the captions tab renders from (see §9 F8) |
| `captionHighlight` | hex | `subtitleConfig.highlightColor` | hex | |
| `captionFontFamily` | string | `subtitleConfig.fontFamily` | font name | |
| `captionFillColor` | hex | `subtitleConfig.fillColor` | hex | |

**Deliberately NOT in front-matter (P1):** stroke/shadow/extrude/`bg*`/texture keys, `*Position offset` fine-tuning, `*FxTab`, `letterTravel`-style micro-tunables. These are template/UI-owned "deep style". Rationale: the front-matter stays a clean *content + look-intent* spec (31 keys — 8 globals + 6 heading + 6 text + 3 image + 4 math + 4 caption), not a dump of every control. Anything in `markdownConfig` not listed above is left untouched by front-matter.

**Deliberately deferred (V2, documented but not implemented in P1):** `music:` (attach a named embedded-audio asset as a background track), `transition:` (between-slide transitions — needs a transition clip system), `palette:` (template owns palettes), `output:` (export hints).

---

## 2. Element Tags (exact)

**Grammar:** `[key:value]` — key = `[a-z][a-zA-Z0-9-]*`, value = anything up to `]` (trimmed; may be `"quoted"` / `'quoted'` to allow spaces). Any number per line, **any order**, stripped by one generalized regex before the existing audio/position handling runs:

```js
// one regex collects ALL key:value tags anywhere on the line (P1 addition)
const PROPS_RE = /\s*\[([a-zA-Z][\w-]*):([^\]]*)\]\s*/g;
// collect → strip → existing [audio:] + POS_RE handling on the remainder
```

**Allowed on:** heading lines, paragraph lines, image lines (`![alt](url)`), video lines (`[video](url)` / `![alt](x.mp4)`), math lines (`$$…$$`), and slide separators (`--- [dur:6]`). **Not** inside `**bold**` spans.

| Tag | Applies to | Target | Example | Notes |
|---|---|---|---|---|
| `[anim:NAME]` | any element | `clip.effects.animIn` | `[anim:zoomIn]` | Overrides the element type's global anim. **Canonical values:** `none fade slideUp slideDown slideLeft slideRight slide zoomIn pop spinIn mosaic puzzle` (verified in `calculateAnimationState`, index.html:3529–3555). `fadeIn`/`scaleIn`/`popIn` accepted as aliases → `fade`/`zoomIn`/`pop` (see §9 F3) |
| `[animDur:S]` | any element | `clip.effects.animInDur` | `[animDur:0.8]` | Seconds |
| `[animDelay:S]` | any element | `clip.effects.animInDelay` | `[animDelay:0.2]` | Seconds |
| `[font:NAME]` | text/heading | `clip.effects.fontFamily` | `[font:Anton]` `[font:"Space Grotesk"]` | |
| `[size:N]` | text/heading/math | `clip.effects.fontSize` | `[size:140]` | |
| `[weight:N]` | text/heading | `clip.effects.fontWeight` | `[weight:900]` | |
| `[color:HEX]` | text/heading/math | `clip.effects.fillColor` | `[color:#fde047]` | |
| `[stroke:HEX]` | text/heading | `clip.effects.strokeColor` + `strokeEnable:true` | `[stroke:#000000]` | |
| `[scale:N]` | image/video | `clip.effects.scale` (image) | `[scale:1.4]` | Image-scale override |
| `[z:N]` | any element | `_mdStackIdx` override | `[z:3]` | **Stack position along the shared side** (spacing via `mdStackOffsets`, index.html:18283) — NOT canvas z-order (see §9 F7) |
| `[dur:S]` | slide separator only (P1) | that slide's duration | `--- [dur:6]` | Overrides `slideDuration` for that slide; element-level durations are V2 |
| `[pos:NAME]` | any element | position | `[pos:top-right]` | Alias of the existing `[top-right]` tag — same values, alternative spelling |

**Existing, unchanged:** `[top] [left] [bottom-right] [center-left] …` (position, `POS_RE` index.html:19861) and `[audio:name]` (sound, index.html:19870).

**Unknown `[key:value]` tags: silently ignored** (console warn) — backward compatibility and forward tolerance. Unknown *values* for known keys: warn, fall back to the global/default (never hard-fail).

---

## 3. Precedence Rules (the single most important part)

### 3.1 The chain

> **per-element tag  >  template (.sptpl)  >  front-matter  >  current UI defaults (`markdownConfig`)**

Applied at **generation time only**, per clip, per style field. Concretely, in each builder (e.g. `mdHeadingClip`, index.html:20143) a field resolves as:

```js
const v = resolveMd(
  props.font,               // 1. per-element tag        (highest)
  templateVal('headingFontFamily'), // 2. template       (.sptpl applied earlier)
  fm.headingFontFamily,     // 3. front-matter           (parsed into cfg at generate)
  cfg.headingFontFamily     // 4. current UI defaults    (markdownConfig — lowest)
);
// builder then writes v into clip.effects.fontFamily
```

- A field is resolved independently — a line with `[anim:zoomIn]` keeps the template/front-matter *font* and overrides only the *anim*.
- `template:` is applied first, writing its values into a merged config; front-matter keys override template keys; element tags override both. ("Element > template > front-matter > defaults" is literally the merge order.)
- **UI edits made after generation are manual overrides**: the generated clip already has concrete `effects`; editing it in the Properties panel never re-runs the chain. Re-**Generate** re-runs the chain.

### 3.2 Front-matter vs UI drift (the two-way sync)

`markdownConfig` stays the **single store**. Front-matter is a *serialized projection*:

- **Script → UI (on Generate):** the front-matter block is parsed into `markdownConfig` (only the keys it states), then `saveMarkdownConfig()` persists; the Markdown Style panel renders from that same object, so it shows the script's values immediately.
- **UI → script ("Sync script from UI" button, new):** `syncFrontMatterFromUI()` rewrites the front-matter block from the *current* `markdownConfig` + globals (aspect, fps, bg, slideDuration, trackMode, high-signal style keys, caption keys). Merge, don't clobber: existing unknown/extra keys and `#` comments in the block are preserved; only known keys are updated.
- **Net effect:** no drift is possible — there is one store; both surfaces write it; Sync pushes UI state into the file so the script always *is* the look.

### 3.3 Position-name vocabulary (shared by `[pos:]` and the `*Position` front-matter keys)

`top` `bottom` `left` `right` `center` `top-left` `top-right` `bottom-left` `bottom-right` `center-left` `center-right` — identical to the existing `POS_RE` set.

---

## 4. Backward-Compatibility Guarantees

1. **Scripts without front-matter parse exactly as today.** The front-matter pre-pass only activates when line 1 is `---` AND a closing `---` exists AND every line between is `key: value` / comment / blank. A script that begins with `---` as a slide separator (empty first slide) is unaffected.
2. **All existing syntax is untouched:** `[top]`-family position tags, `[audio:name]` (either tag order), `---` `___` `***` separators, `## Heading`, `**bold**` per-word styling, `![alt](url)` / `mock` / `mock:image` / `mock:video` / `[video](url)`, `$$latex$$`, position tags on any element type.
3. **Unknown tags and keys are ignored, not errors.** Generation never fails because of a prop; worst case is a console warning + fallback to the global/default.
4. **No new state introduced.** Props are a parse-time transform that writes the *existing* `markdownConfig`/`subtitleConfig`/globals and the *existing* clip-effect fields. `serializeProject()`/`applyProject()` round-trips are unaffected (front-matter travels inside `markdownText`, which is already serialized).
5. **Existing projects, presets, templates, and generated clips are untouched** — the feature only changes what *future* Generate calls do.
6. **Opt-out:** `--- \nprops: off` … or simply deleting the front-matter block restores pure-default generation. (Kept as an escape hatch; not required since unknown keys already no-op.)

---

## 5. Parsing & Wire-in Points (code refs)

| Step | Where (index.html) | Change |
|---|---|---|
| Front-matter pre-pass | `window.parseMarkdownToClips` (~`19852`) | Before line iteration: detect + strip a leading front-matter block, parse into `fm` object; write into `markdownConfig` via the existing merge + `saveMarkdownConfig()` |
| Tag collection | **before** the `---` separator check (~`19895`) and the `[audio:]`/POS stripping (~`19870`) | One `PROPS_RE` pass: collect `props` map, strip tags. Order matters: props → `---` check → `[audio:]` → POS (`[dur:6]` on `---` only parses if tags are stripped first — see §9 F5) |
| Text-run merge | the paragraph run merge (~`20036`) | Props on later lines of the same paragraph merge into the run with **first-wins** semantics (same pattern as the existing `if (tPos && !lastEl.pos)`); document this in the help text (see §9 F10) |
| Prop persistence | builders + `applyMarkdownStyle` (`18295`) | Builders stamp `clip._mdProps = { …resolved per-element overrides }`; `applyMarkdownStyle` re-applies `_mdProps` **after** its global pass so per-element props survive restyles (see §9 F4) |
| Per-slide duration | the clip-creation loops (`20060`, auto mode `20409`) | Replace `clipStart = currentTime + index * slideDuration` with cumulative starts (`currentTime + Σ previous slide durations`) and thread the per-slide duration into `mdTextTiming` (`20134`) (see §9 F5) |
| Per-element props | slide objects built in the same loop (`currentSlide.elements.push({ kind, … })`) | Attach `props` (and slide-level `dur`) to each element + the slide |
| Template application | new helper `applyTemplateToConfig(templateId, cfg)` | Runs first (precedence §3.1); no-op warn if `template:` set but engine absent (V2) |
| Builder resolution | `mdHeadingClip` (`20143`), `mdTextClip` (`20210`), image/video/math builders | Replace `cfg.headingFontFamily`-style reads with `resolveMd(props[key], templateVal, fmVal, cfgVal)` |
| Front-matter → store | `saveMarkdownConfig` (`16290`) / `loadMarkdownConfig` (`16298`) | After parsing fm into cfg, persist via existing save |
| Sync UI → script | new `syncFrontMatterFromUI()` | Rewrites the block from current state; merge-preserving (§3.2) |
| Anim validation | `EASING` map + existing animIn preset set | `[anim:]`/`*AnimIn` values validated against the live set; unknown → warn + default |

---

## 6. Validation Summary

| Kind | Rule | On failure |
|---|---|---|
| `#hex` colors | `/^#([0-9a-f]{3}|[0-9a-f]{6})$/i` | warn, fall back to global/default |
| numbers | finite number within the documented range | warn, clamp or fall back |
| enums (`aspect`, positions, `trackMode`, `startAt`, anim names) | membership in the live set | warn, keep default |
| font names | any non-empty string (quoted or unquoted) | warn if empty, fall back |
| unknown keys / tags | — | silent ignore + one console warn |

---

## 7. Example — Full Lifecycle

1. **User designs** a brutal-style Shorts video in the GUI: Anton headings, `#fde047` accents, word-highlight captions. Hits **Generate** once — the timeline looks right.
2. **Sync script from UI** writes the front-matter block into `markdownText` (§3.2). The script now *is* the look.
3. **Save as Template** (P2) derives `shorts-captions.sptpl` from the same project — palette, fonts, caption language, skeleton.
4. **Next video** — the user (or an agent) writes:

   ```markdown
   ---
   template: shorts-captions
   aspect: 9:16
   ---

   # THE NUMBERS [anim:zoomIn] [top]
   **$10M raised** [size:150] [color:#fde047] [center]
   ![Logo](mock) [right]
   ```

5. **Generate** → template applies the look → front-matter confirms aspect → element tags art-direct the three lines → full styled timeline, zero GUI styling.
6. UI edits afterward are manual overrides; re-Generate re-runs the chain; Sync re-embeds any UI changes the user wants in the script.

---

## 8. Acceptance Criteria (P1 done = all of these)

- [ ] Scripts with **no** front-matter and **no** tags generate byte-identical timelines to today (regression-tested against the existing Showcase preset).
- [ ] Front-matter sets `aspect`/`bg`/`slideDuration`/global style; the Markdown Style panel reflects them after Generate.
- [ ] Element tags override per line; `[dur:6]` on `---` overrides one slide.
- [ ] Precedence verified: element > template > front-matter > defaults (template via a test `.sptpl` or stubbed resolver).
- [ ] **Sync script from UI** round-trips: UI edit → Sync → script shows it; script edit → Generate → UI shows it.
- [ ] Unknown keys/tags warn and no-op; generation never throws.
- [ ] `markdownText` (with front-matter) survives save/load/export round-trip.
- [ ] Help text (`MARKDOWN_HELP_TEXT`, ~`18679`) documents front-matter + tags.
- [ ] **F4 regression — per-element props survive `applyMarkdownStyle()`** (the §9 F4 trap):
  1. Set a script with a `[size:140]` tag (e.g. `**$10M** [size:140] [center]`) and **Generate**.
  2. Assert the generated text clip's `effects.fontSize === 140` (prop applied at build).
  3. Trigger `applyMarkdownStyle()` through a real UI path (move the mdGap slider in the Markdown Style panel, or toggle trackMode — both call it, index.html:18295).
  4. Assert the clip **keeps** `effects.fontSize === 140` — it must *not* be reset to `cfg.textFontSize`.
  5. Control case: the same script *without* the tag restyles to `cfg.textFontSize` after step 3 (globals still win when no prop is set).
  - Implementation must stamp `clip._mdProps` at build and re-apply it after `applyMarkdownStyle`'s global pass (§5 "Prop persistence" row).

---

## 9. Code Review Findings (verified against index.html, 2026-08-17)

Every key/tag in this spec was checked against the real parser (`window.parseMarkdownToClips`, ~19852), the builders (`mdHeadingClip` 20143, `mdTextClip` 20171, `mdMathClip` 20239, `mdImageClip` 20270, `mdVideoClip` 20309), and the config/constants. Verdicts:

### ✅ Wired in as specified (no change)
- **Front-matter → `markdownConfig` + `saveMarkdownConfig()`** (16290) — the merge-into-single-store approach works; `loadMarkdownConfig` (16298) merges on boot.
- **`[anim:]`/`[animDur:]`/`[animDelay:]`/`[font:]`/`[size:]`/`[weight:]`/`[color:]`/`[stroke:]`** — every one maps to a `clip.effects.*` field the builders already populate.
- **`[pos:]` alias** — same `POS_RE` vocabulary (19865); tag-strip-first leaves `[top]` for the existing regex.
- **`[audio:]`** — untouched; props strip runs before it, in either tag order.
- **`bg` → `State.canvasBgColor`**, **`template:` V2-warn behavior** (no engine exists yet — flag confirmed).
- **Unknown keys/tags ignored** — matches the parser's tolerant style; generation can't throw.

### 🚩 Flags — needs a code change or a spec correction

**F1 — `aspect:` valid values were wrong.** Spec listed `4:5`/`3:2`; `ASPECT_RATIOS` (1399) is `16:9, 9:16, 4:3, 3:4, 1:1, 21:9`. Fixed in §1.

**F2 — `fps:` has no timeline target.** There is **no `State.fps`**; the only fps is `State.exportFps` (28717), set by the export modal. `fps:` can only preset the export default — it cannot change playback or preview rate. Fixed in §1.

**F3 — `fadeIn` is not a valid clip anim; canonical set is different.** `calculateAnimationState` (3529–3555) handles exactly `none, fade, slideUp, slideDown, slideLeft, slideRight, slide, zoomIn, pop, spinIn, mosaic, puzzle`. The markdownConfig *defaults* (`headingAnimIn: 'fadeIn'`, `imageAnimIn: 'fadeIn'`) are silently no-ops today. Fix: `resolveMd` accepts `fadeIn`/`scaleIn`/`popIn` as aliases → `fade`/`zoomIn`/`pop`; validation uses the canonical set. Fixed in §2/§1.

**F4 — `applyMarkdownStyle()` clobbers per-element props.** (18295) restyles **all** `_mdGenerated` clips from cfg globals. After `[size:140]` writes `clip.effects.fontSize=140`, any later `applyMarkdownStyle()` (style-panel slider, track-mode toggle) resets it to `cfg.textFontSize`. **Fix (mandatory):** builders stamp `clip._mdProps = { …resolved per-element overrides }`; `applyMarkdownStyle` re-applies `_mdProps` after its global pass. This keeps parity with existing behavior (generated clips are style-owned; manual edits to them are already overwritten) and makes per-element props survive restyles. This is the biggest hidden trap in the spec — it shipped as a hard requirement in §5.

**F5 — `[dur:6]` on `---` doesn't parse today, and per-slide durations aren't supported.** Two separate issues:
1. The separator check is `line === '---'` (19895) — `--- [dur:6]` falls through to the **text-paragraph branch** and becomes a literal text element. Tag-stripping must run **before** the separator check.
2. All slides share one duration: `clipStart = currentTime + index * slideDuration` (20060, auto mode 20409) and `mdTextTiming` (20134) uses the single `slideDuration`. Per-slide durations need cumulative starts (`currentTime + Σ previous slide durations`) threaded through both clip-creation loops and `mdTextTiming`. Real change, not trivial — spec updated in §5.

**F6 — `[scale:]` applies to video too (harmless).** Both `mdImageClip` and `mdVideoClip` use `scale: cfg.imageScale || 1`; `[scale:]` → `effects.scale` works on both. Also sets `effects.scale` on text/math if used there — harmless, keep as image/video in the docs.

**F7 — `[z:]` is a stack index, not canvas z-order.** `_stackIdx` feeds `mdStackOffsets` (18283) — it spaces same-side elements apart; canvas layering is by track/clip order, not this field. Spec wording corrected in §2.

**F8 — caption keys set the global `subtitleConfig`, not "generated caption clips only".** `subtitleConfig` is the single store the captions tab renders from (the style panel edits it in place). Front-matter caption keys change tab defaults too — consistent with the single-store philosophy; wording corrected in §1.

**F9 — key count was 31, not 26.** 8 globals + 6 heading + 6 text + 3 image + 4 math + 4 caption. Cosmetic; fixed.

**F10 — multi-line paragraph props need explicit merge semantics.** Contiguous text lines merge into one run (20036) with existing first-wins rules for pos/audio (`if (tPos && !lastEl.pos)`). Props must follow the same first-wins merge — specified in §5, and the help text must document it (a `[size:140]` on line 2 of a paragraph wins over line 1's `[size:120]`... or define last-wins; **first-wins is chosen** to match the existing pos/audio pattern).

**F11 — heading/text props need slide-level plumbing.** Builders `mdHeadingClip`/`mdTextClip` receive the **slide object**, not the element; `mdMathClip`/`mdImageClip`/`mdVideoClip` receive the element. So heading/text per-element props must be carried on the slide (e.g. `slide.headingProps`, merged from the matching element) — noted in §5.

**F12 — `wordOverrides` (bold) interacts with `[weight:]`.** Bold sets per-word `fontWeight: 700` in `wordOverrides` (20211); `[weight:900]` sets the clip's base weight. They compose fine — no conflict, but the help text should note bold wins per-word.

**F13 — `[dur:]` element-level stays V2 (correct call).** Element durations would need per-element `duration` + timing arithmetic in both track modes beyond slide-level; keeping `[dur:]` slide-only for P1 is right.

### Bottom line
Ten of thirteen flags are **spec corrections** (F1–F3, F6–F10, F12) — the prop surface itself is sound and fully wireable. The two **real code changes** beyond the parser are **F4** (`_mdProps` re-apply in `applyMarkdownStyle` — mandatory) and **F5** (tag-strip before the `---` check + cumulative per-slide timing). **F11** is a small plumbing note. With F4 and F5 handled, every key/tag in this spec can be wired in as documented.
