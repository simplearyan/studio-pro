# Canvas Mock Placeholder — Style Cleanup Plan

**Status:** Phase 1 implemented (index.html) — style-only; the DOM selection bounding box is intentionally untouched (user: "the bounding box bleeding is intentional").
**Bonus:** the canvas preview container itself was cleaned too — `canvasAspectWrapper` lost its `rounded-lg`, `ring-1 ring-white/5`, and `shadow-2xl` (now `shadow-lg` + theme-aware subtle border), so the frame around the preview is square and ring-free.

## What the user sees (from the live screenshot)

In the canvas preview, mock/placeholder media render as a full-bleed (or markdown-card-sized)
themed pastel rectangle. Stacked clips currently look messy:

- An **outer pale-pink rectangle** (image mock behind, Vivid Red theme) with a **mint-green
  rectangle on top** (video mock, Vivid Mint theme) that has **rounded corners** — two
  full-canvas placeholders with *different* corner radii overlapping.
- A **dark pill badge** ("RE-IMPORT MEDIA") top-left, plus faint underlying text showing
  through the top mock's fill ("views on TikTok. [music]"), and the mock's own four text rows
  (alt text, timecode, hint) stacked in the middle.

The request: clean up the ring + border-radius + general placeholder design.

## Where the style comes from (index.html, clip draw loop — mock branch)

All of it lives in one branch of `drawCanvas`, gated on `!source || clip._mdMock` (roughly
lines 5455–5630). The offenders, in code:

| # | Issue | Code |
|---|-------|------|
| 1 | **Border-radius clips the whole card** | `if (borderRadius > 0 && ctx.roundRect) { ctx.roundRect(-dw/2, -dh/2, dw, dh, borderRadius); ctx.clip(); }` — the clip's `borderRadius` effect rounds the *placeholder* corners, so stacked mocks show ragged mixed radii. |
| 2 | **The "ring"** | `if (clip.effects.strokeEnable) { stroke roundRect; strokeWidth * 2 }` — a thick outline around the placeholder. Reads like an error/selection state on a placeholder. The indigo selection box (`2px solid #6366f1` + glow, DOM overlay) adds a second ring when selected. |
| 3 | **Translucent fill → bleed-through** | `ctx.globalAlpha = aState.animAlpha * (opacity / 100)` applied before the card fill — a clip at <100% opacity lets the clip *behind* it show through (the faint overlapping text in the screenshot). Real media is opaque; the placeholder should be too. |
| 4 | **Text density** | Four scaled rows: type chip 14px·mk, alt hero 42px·mk, timecode 26px·mk, hint 18px·mk at 80% alpha — plus a center icon. On stacked mocks this collides. |
| 5 | **Dead config** | `mockImageColor1/2`, `mockVideoColor1/2` defaults in `markdownConfig` are never read anymore (themed PALETTES replaced gradients). |

## Design direction — CapCut-clean placeholder

Keep the **themed pastel card** (matching the clip's timeline color is a feature), but strip the
chrome and tighten the text:

1. **Square, unclipped card — always.** Mocks ignore the `borderRadius` effect (radius applies
   only to real media once it loads). A placeholder is a frame, not content.
2. **No stroke ring while mocking.** Ignore `strokeEnable` in the mock branch; selection gets
   its own overlay only.
3. **Opaque fill, content at clip opacity.** Draw the card fill at full alpha; apply
   `opacity`/anim alpha to the text+icon layer only — kills bleed-through while honoring the
   opacity effect on the content.
4. **One hero line + one meta line.** Alt text stays the hero (34·mk, down from 42). Timecode
   and the hint ("Replace source in Properties tab" / "Loading media…" / "Mock from markdown…")
   merge into a single small meta row (20·mk). Chip shrinks to 11·mk and becomes an *outline*
   pill moved to the **top-right** so it never collides with hero text.
5. **Keep the single center icon** (picture frame / play glyph) as the only mid-card element.

## Phases

### Phase 1 — Mock chrome cleanup (implemented ✔)
In the mock branch only:
- Drop the `borderRadius` clip (card already draws with `cardRadius = 0`). ✔
- Skip the `strokeEnable` ring while mocking. ✔
- Fill the card at `globalAlpha = 1` (then set alpha for the content pass). ✔
- Restructure text: hero 34·mk, merged meta row 20·mk (timecode + hint on one baseline),
  chip 11·mk outline pill at top-right. ✔
- Delete the dead `mockImageColor1/2`, `mockVideoColor1/2` defaults. ✔

**Verified live:** square card under `borderRadius: 60` (corner = theme bg), no red ring with
`strokeEnable` + `strokeWidth: 30`, opaque center at 50% clip opacity, DOM bounding box still
renders on selection (kept as-is).

### Phase 2 — Selection overlay restyle (SKIPPED by design)
The user confirmed the selection bounding box is **intentional** — no restyle. The DOM overlay
(`2px solid #6366f1` + glow + handles) stays exactly as it is.

### Phase 3 — Mock style option (optional, ~1h)
- In Markdown → Style → **Media & Mock**: a "Mock card style" toggle — `Themed` (current
  pastel) vs `Minimal` (dark translucent card `rgba(0,0,0,.55)` + white text, like the
  "Video unavailable" chip). One new `mockCardStyle` config key applied in the mock branch.

## Risks / watch-items

- The borderRadius clip currently also clips chip/icon/text — removing it means text bounds
  must come from padding math, not clipping (the `wrapMockText` clamp at `dw - 56*mk` already
  guards width).
- The `mk` layout scale is shared across canvas sizes — reflows must stay readable at 720p,
  1080p, and 9:16 (mock `dw = w, dh = h` full-bleed).
- MD mocks (640×360 card, `MD_MOCK_W/H`) use the same branch — the compact card must still
  read; the 2-line alt wrap (`isMdCard ? 16 : …`) stays.
- **Export** draws the same branch into the capture canvas (`targetCtx`) — verify the new
  chrome renders identically in exported frames.
- Keep the three hint strings — they become the meta row, so no information is lost.

## Test plan

1. Render image mock, video mock, markdown mock, and missing-media mock ("RE-IMPORT MEDIA")
   at 16:9 **and** 9:16.
2. Stack two mocks (pink behind green): square corners on both, no ring, no bleed-through.
3. Clip with `borderRadius = 24` + `strokeEnable` → mock stays square/ring-free; replace with
   real media → radius + stroke return.
4. Export one frame containing mocks; compare with preview.
5. `vite build` ✓, console clean.

## Effort summary

| Phase | Effort | Benefit |
|-------|--------|---------|
| 1 (chrome cleanup) | 30–45 min | Fixes the ring, radii, bleed, and text clutter in one pass |
| 2 (selection overlay) | ~30 min | Calmer selection state |
| 3 (mock style toggle) | ~1h | Optional Minimal look for exported placeholders |
