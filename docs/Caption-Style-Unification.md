# Caption Style Unification — Share the Text-Clip Effect Schema Instead of Duplicating

**Status:** Implemented (Option A) — `scale` added to the caption layer, a shared `captionStyleControlHtml` builder now drives both the Style tab and the per-caption card, and `drawSubtitlesOnCanvas` applies the scale transform (with wrap-width compensation). See §5 for what shipped.
**Scope:** Caption styling (scale, shadow, background, stroke, typography) — global + per-caption customization
**Precedents referenced:** Markdown styles (`applyMarkdownStyle`), text presets (`applyMdTextPreset`), caption sync (`bakeSubtitleStyleIntoClip`)

---

## TL;DR — Recommendation

**Unify captions onto the single text-clip effect schema** (Option A below). Captions are already text clips once synced, and `bakeSubtitleStyleIntoClip` already writes the caption style straight into `clip.effects` using the *same key names* as text clips. The "different logic" the user perceives is mostly an illusion of the code layout — the remaining work is closing three gaps, not building a new system:

1. Add the missing **`scale`** (and any other transform keys) to the caption layer.
2. **Delete/replace the duplicated non-synced caption draw path** so captions render through the same code as text.
3. **Drive both UIs (Style tab + per-caption card) from one shared key list**, exactly like markdown's Effects sub-tabs.

This follows the architecture the project already proved with markdown: a *global config layer* (`markdownConfig` / `subtitleConfig`) that bakes onto per-clip `effects`, with per-item overrides on top.

---

## 1. Current state (grounded in the code)

### 1.1 Captions already reuse text keys

- `State.subtitleConfig` (global) and `sub.effects` (per-caption override) use **the same key names as text clips**: `fontFamily, fontSize, fontWeight, fillColor, fontStyle, lineHeight, letterSpacing`, the full `stroke*`, `shadow*`, `bg*` (incl. `bgStroke*`, `bgShadow*`, `bgExtrude*`), and `texture*` families.
- `SUBTITLE_EFFECT_KEYS` is literally a text-effect key list plus a small caption-only tail (`position, bottomOffset, anim*`).
- `bakeSubtitleStyleIntoClip(clip, sub)` does `{ ...cfg, ...sub.effects }` and assigns onto `clip.effects` — so a synced caption clip **is** a text clip whose style came from the caption layer. No conversion step exists because there is nothing to convert.
- Per-caption inheritance is already implemented: `setSubCaptionAnim(clipId, key, value)` sets an override, `'__inherit__'` deletes the override and mirrors the global value back. This is finer-grained than markdown (which only has the global layer).

### 1.2 Markdown is the precedent for "global + individual"

- `markdownConfig` holds `heading*` / `text*` / `math*` / `image*` prefixed keys.
- `applyMarkdownStyle()` bakes that config onto every generated clip's `effects` (guarded by `clip._mdGenerated`).
- `applyMdTextPreset()` maps a saved text preset's `effects` onto the config — **zero new rendering logic**; presets just write effect keys.
- Quick Styles chips reuse `preset.thumbnail` and the same effect-key vocabulary.

### 1.3 The actual gaps

| Gap | Where | Consequence today |
|---|---|---|
| **No `scale` on captions** | `subtitleConfig`, `SUBTITLE_EFFECT_KEYS`, `bakeSubtitleStyleIntoClip`, `drawSubtitlesOnCanvas` | Users must convert a caption to a text clip to scale it (the exact friction the user wants removed). `scale` exists in `drawSubtitlesOnCanvas` only as an *animation* factor, not a style value. |
| **Duplicated draw path** | `drawSubtitlesOnCanvas` re-implements shadow/stroke/bg/typography that the clip renderer already does | The two paths can drift (font metrics, stroke joins, bg rounding). Synced captions go through the clip renderer; pre-sync captions go through the private path. |
| **Duplicated UI builders** | Style tab + Caption card each hand-roll property rows | Every new style property must be added in ~3 places (config defaults, bake, UI ×2). |

---

## 2. Option A — Unify on the text-effect schema (recommended)

**Model:** one effect-key namespace shared by text clips, markdown, and captions. The caption layer is just a *named style layer* (global config + per-caption overrides) that resolves to the same keys.

```
Global (per project)
  subtitleConfig  ──►  resolved style  ──►  clip.effects   (bakeSubtitleStyleIntoClip)
Per-caption
  sub.effects  ─┘         ▲
                          └── drawSubtitlesOnCanvas reads the SAME resolved style
Presets
  saved text preset.effects ──► applyMdTextPreset / caption equivalent ──► config
```

- Add `scale` (and any transform keys text gains) to `subtitleConfig` defaults, `SUBTITLE_EFFECT_KEYS`, `subtitleEffectMap` (the `setClipEffect` sync map), and `bakeSubtitleStyleIntoClip`.
- Make the non-synced caption draw path **delegate** to the shared text renderer (or apply `ef.scale` via `ctx` transform so the private path stays a thin wrapper).
- Render both the Style tab and the Caption card from the **same key list** (`SUBTITLE_EFFECT_KEYS`) with one `styleControlHtml(key, value)` builder — markdown's Effects sub-tab pattern.

**Why this is the better code structure:**

1. **Single source of truth.** One default block, one bake function, one draw implementation, one UI builder. Every key is defined, validated, and rendered once.
2. **Presets cross over for free.** A saved text preset can style captions (and a caption style can be saved as a preset) with no mapping table — `applyMdTextPreset` already proves the pattern. This is the product win the user asked for ("like markdown text clip styles").
3. **No divergence.** Stroke/shadow/background behave identically on captions and text because it is literally the same effect keys and same render path. Bug fixes land once.
4. **Conversion becomes a non-event.** "Select and edit captions individually without converting" and "convert to text" produce identical state — the schema is shared, so there is nothing to migrate.
5. **Less code to maintain.** Adding a new style property (e.g. a gradient fill or outline style) becomes: add key → default → it appears in text, markdown, captions, and presets automatically.
6. **Consistency with the established architecture.** The project already standardized on "config layer → bake → effects" for markdown; captions become the same pattern rather than a parallel one.

**Rough size:** ~60–100 lines of change (one new key family + one delegated draw path + one shared UI builder) versus building a parallel system (several hundred lines of duplicated code).

---

## 3. Option B — Keep a parallel caption-specific schema

Model: captions get their own `captionScale`, `captionShadow*`, `captionBg*` … keys, their own defaults, their own draw path, their own UI.

| # | Consequence |
|---|---|
| 1 | **Two default blocks** that must be kept in sync by hand (`subtitleConfig` + whatever text uses). |
| 2 | **Two draw implementations** for the same visual (private caption path + clip renderer) — the drift risk already latent today becomes permanent. |
| 3 | **Two override mechanisms** (`setSubCaptionAnim` + a second one) and **two UI card builders**. |
| 4 | **Presets can't cross over.** A text preset has `shadowEnable`; the caption path would need `captionShadowEnable` — a mapping table that grows with every new style feature. |
| 5 | **Every new feature costs 3–4×** (defaults, bake, draw, UI, preset map). |

Option B is strictly more code for the same product behavior, and it is the direction the codebase already started escaping from (`SUBTITLE_EFFECT_KEYS` shares text keys; `bakeSubtitleStyleIntoClip` writes text keys).

---

## 4. Comparison

| Criterion | A — Unify on text schema | B — Parallel caption schema |
|---|---|---|
| Lines of new code | ~60–100 | ~300+ |
| Sources of truth per style key | 1 | 2 (config) + 2 (draw) + 2 (UI) |
| Text presets style captions | Yes, zero mapping | Needs a mapping table |
| Caption → text conversion | No-op (same schema) | State migration |
| New style feature cost | 1 place per concern | 3–4 places per concern |
| Render-path drift risk | Eliminated (delegation) | Permanent |
| Matches markdown pattern | Yes | No |
| Per-caption override (inherit global) | Already implemented | Would need a second one |

---

## 5. Migration plan (Option A)

1. **Add `scale` (and `scaleX`/`scaleY` if introduced) to the caption layer:**
   - `subtitleConfig` defaults (`scale: 1`)
   - `SUBTITLE_EFFECT_KEYS`
   - `subtitleEffectMap` (so `setClipEffect` syncs it)
   - `bakeSubtitleStyleIntoClip` (`fx.scale = ef.scale !== undefined ? ef.scale : 1`)
2. **Apply scale in rendering:**
   - Synced path: automatic (clip renderer already honors `effects.scale`).
   - Private path: wrap the caption draw in `ctx.save(); ctx.translate(cx, cy); ctx.scale(ef.scale, ef.scale); ctx.translate(-cx, -cy)` — or better, route the private path through the shared text draw.
3. **Share the UI:** replace hand-rolled rows in the Style tab and Caption card with a single `styleControlHtml(key, value)` loop over the shared key list (markdown Effects-sub-tab pattern). Wire changes to `setSubtitleConfig` (global) and `setSubCaptionAnim` (override / `'__inherit__'`), both of which already exist.
4. **Keep the caption-only namespace small and documented:** `position`, `bottomOffset`, `anim*`, `animFullSpan` stay caption-only — do not force them onto text clips. The unification covers the *shared style subset* (typography, scale, stroke, shadow, background, texture), not caption layout/animation.
5. **(Optional, free with A):** save caption styles as presets by writing the resolved style into a preset's `effects`.

---

## 6. Caveats

- **Backward compatibility:** existing saved projects store `sub.effects` with text keys and `subtitleConfig` without `scale` — the `!== undefined` fallback (`1`) handles old saves; nothing is migrated destructively.
- **The two draw paths must not diverge during the transition.** Until the private path delegates, any new visual key must be mirrored there or captions-only rendering will look different from synced rendering.
- **Don't pollute text with caption concepts.** The recommendation is schema unification for the style subset; caption layout (`position`, `bottomOffset`) and caption animation remain caption-layer concerns and stay in `SUBTITLE_EFFECT_KEYS`' caption tail.
- **`setClipEffect`'s subtitle sync map** (`subtitleEffectMap`) is the one place a new key can silently "work in the panel but not stick on the clip" — the migration step 1 must include it or per-caption edits will appear to reset.

---

## 7. Animation unification (implemented alongside)

The same "share the text schema" principle was applied to caption animations, so **converting a caption clip to a text clip retains the same animation**:

- **Shared vocabulary bridge** — `ANIM_IN_TEXT_TO_CAPTION` (`fade→fadeIn`, `zoomIn→scaleIn`, `pop→popIn`), `ANIM_OUT_TEXT_TO_CAPTION` (`fade→fadeOut`, `zoomOut→scaleOut`), and `TEXT_LETTER_TO_PRESET` (`typewriter→typewriter`, `scaleFade→letterPop`, `slideUp→letterFade`, `odometer→rotate`, `randomSnap→bounce`).
- **Reverse editing** — the `setClipEffect` mirror translates text-clip animation values into caption vocabulary and now mirrors the letter keys (`animTextIn/Out/Ease/InDur/Stagger`), so editing a synced caption clip from its ANIMATIONS tab applies to the caption. `drawSubtitlesOnCanvas` also accepts the raw text vocabulary as a fallback (`fade`/`zoomIn`/`pop`/`slideLeft`/`slideRight`).
- **Conversion retention** — `bakeSubtitleStyleIntoClip` round-trips `animTextIn`/`animTextEase`/`animTextInDur`/`animTextOut` when no caption preset is set, keeps karaoke (`animFullSpan` → `animTextInDur = clip.duration`), and maps caption presets (`fade`/`pop`/`letterPop`/`letterFade`/`typewriter`/`wordHighlight`/`bounce`/`rotate`) onto text-clip `animIn`/`animTextIn`. Caption anim selects now expose Scale/Pop entrances and Scale exits.

## 8. Open questions

- Should captions also expose non-uniform scale (`scaleX`/`scaleY`), or is uniform `scale` enough? (Matches the current text-clip `scale`.)
- Should the Style tab's caption card be replaced entirely by the shared property list, or keep the visual "kit" layout (font/color swatches) and only share the advanced section?
- Should global caption style be *saveable as a preset* out of the box, or is that a follow-up?
