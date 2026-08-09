# Puzzle Block-Reveal Animation

## Overview

The **Puzzle** animation is a Fireship-style entrance/exit effect where the content of a clip — image, text, math equation, video, scene composition, or shape — assembles (or disassembles) as a grid of square blocks, like a jigsaw puzzle snapping together. Blocks appear one-by-one in a directional sweep (top → bottom, bottom → top, left → right, right → left) or in a fully random order, exactly like the "random squares assembling" look popularized by YouTube editors such as Fireship.

Users get full control over **direction**, **duration**, **delay**, **block count**, and **block style** (pop vs. snap) from the Animation tab's Properties panel.

---

## How It Works

### 1. New Animation Types

Two new animation types were added to the existing animation system:

| Type | Tab | Effect |
|------|-----|--------|
| `puzzle` | Entrance (In) | Blocks appear one-by-one until the clip is fully revealed |
| `puzzle` | Exit (Out) | Blocks disappear one-by-one until the clip is fully hidden |

They behave like any other entrance/exit animation (`fade`, `slideUp`, `mosaic`, …): the clip is invisible before the entrance completes and after the exit begins, and both are driven by the same timing pipeline.

### 2. Timing — `calculateAnimationState`

The existing animation state calculator was extended to return two new values:

```js
return { animAlpha, animScale, animX, animY, animRot, mosaicLevel, puzzleLevel, puzzleDir };
```

- **`puzzleLevel`** — a `0 → 1` (entrance) or `1 → 0` (exit) progress value, already run through the clip's easing function (`animEase`).
- **`puzzleDir`** — the sweep direction, read from `clip.effects.animPuzzleDir` (`'random' | 'top' | 'bottom' | 'left' | 'right'`).

The same pass also gained **delay support** for *all* animations via two new effect keys:

```js
const delay = clip.effects.animInDelay || 0;   // entrance: hold hidden for `delay` seconds
const rawP  = clipTime < delay ? 0 : (clipTime - delay) / dur;
```

The exit delay is symmetric — the exit completes `animOutDelay` seconds early and holds the hidden state:

```js
const delay = clip.effects.animOutDelay || 0;
const rawP  = timeLeft < delay ? 0 : (timeLeft - delay) / dur;
```

Both use `Math.max(0, Math.min(1, rawP))` clamping, so out-of-range values are impossible.

### 3. Deterministic Randomness — `puzzleSeedFromId` + `mulberry32`

Random-order puzzles must **not flicker between frames** (a naive `Math.random()` per frame would re-shuffle the reveal every frame). Two small helpers guarantee determinism:

```js
function puzzleSeedFromId(id) { /* FNV-1a 32-bit hash of the clip id → integer seed */ }
function mulberry32(a)         { /* seeded PRNG, same sequence for the same seed */ }
```

Because the seed is derived from the clip's **id**, every frame (and every export frame) reproduces the identical block order. Different clips get different random patterns.

### 4. Block Rendering — `drawPuzzleBlocks`

```js
function drawPuzzleBlocks(ctx, offCanvas, level, dir, blockCount, seed, snap)
```

This is the heart of the effect. The clip's content is first rendered once to an **offscreen canvas** (reusing the same offscreen machinery as the existing mosaic/pixelate effect, so all styling — shadows, extrude, stroke, texture, letter overrides — is preserved). Then:

1. **Grid** — The offscreen is sliced into a grid:
   ```js
   const cols = Math.max(2, Math.round(blockCount || 8));
   const rows = Math.max(2, Math.round(cols * H / Math.max(1, W)));
   ```
   Row count is derived from the aspect ratio, so blocks stay roughly square.

2. **Cell order** — Each cell gets a reveal `order` in `[0, 1]` from the direction:
   ```js
   if (dir === 'top')    order = rn;            // row 0 first
   else if (dir === 'bottom') order = 1 - rn;   // last row first
   else if (dir === 'left')  order = cn;        // column 0 first
   else if (dir === 'right') order = 1 - cn;    // last column first
   else order = rand();                         // random puzzle
   order = clamp(order + (rand() - 0.5) * 0.15); // small organic jitter
   ```
   The ±0.15 jitter breaks up a perfectly linear sweep so it feels natural, not mechanical.

3. **Draw** — A cell is drawn once `level >= order`:
   - **Pop mode** (default): each block pops in with a quick scale + fade ramp (`local = (level - order) / 0.12`, `popScale = 0.5 + 0.5 * local`, alpha ramps to 1) — a soft, bouncy assemble.
   - **Snap mode** (`animPuzzleSnap: true`): each block appears **instantly at full size** the moment the sweep reaches it — a crisp "random squares appearing" look with no pop or fade.

4. **Seam fix** — Cell sizes are fractional (`W / cols`), which leaves hairline antialiasing gaps between adjacent blocks. Every cell is drawn with a **1 px bleed** (`bCw = min(cw + 1, W - sx)`), so neighboring blocks overlap by a pixel and the gaps disappear at all times — not just when the puzzle finishes:
   ```js
   ctx.drawImage(offCanvas, sx, sy, bCw, bCh, sx, sy, bCw, bCh);        // snap
   ctx.drawImage(offCanvas, sx, sy, bCw, bCh, -bCw/2, -bCh/2, bCw, bCh); // pop
   ```

5. **Fully assembled shortcut** — when `level >= 0.98` the entire offscreen is drawn in one `drawImage` call (no per-block loop), guaranteeing a pixel-perfect final frame and zero seams at the end.

The offscreen is centered on the clip origin (`ctx.translate(-W/2, -H/2)`), matching the exact placement of the clip's normal draw — so the puzzle assembles *in place*, not offset.

### 5. Supported Clip Types (5 draw branches)

The puzzle path is wired into every visual clip renderer:

| Clip type | How it renders |
|-----------|----------------|
| **Text / Math** | Reuses the existing mosaic offscreen pass; when `puzzleLevel > 0.05` it draws puzzle blocks instead of pixelating |
| **Image / Video** | Renders into an offscreen (also covers the no-shadow/border/mask case by creating a temporary offscreen), then draws blocks |
| **Scene comp** | Draws the scene's composited offscreen back as blocks |
| **Shape** | Shape drawing was refactored into a reusable `renderShapeContent(c)` so it can render into an offscreen for the puzzle pass and directly otherwise |

Image/video strokes are temporarily hidden during assembly (`!(puzzleLevel > 0.05)`) so a full outline doesn't flash over the assembling blocks — the stroke re-appears once the puzzle completes.

### 6. Animation Tab UI

The `puzzle` option appears in both the **Entrance** and **Exit** preset grids (icon: `grid-3x3`). When selected, the Entrance panel shows:

- **Duration** — slider (0.1–5.0 s), drives `animInDur`
- **Easing** — Linear / In / Out / In-Out / Elastic / Bounce, drives `animEase`
- **Delay** — slider (0–2.0 s), drives `animInDelay`
- **Puzzle Direction** — 5-button grid: Random / Top / Bottom / Left / Right, drives `animPuzzleDir`
- **Blocks** — slider (4–20), the number of columns across the clip, drives `animPuzzleSize`
- **Block Style** — Pop / Snap toggle, drives `animPuzzleSnap`

The Exit panel mirrors the Delay + Duration controls.

### 7. Defaults & Keyframe Safety

New effect keys were added to all three default-effects objects (main defaults, media-import clips, scene comps):

```js
animInDelay: 0,
animOutDelay: 0,
animPuzzleDir: 'random',
animPuzzleSize: 8,
animPuzzleSnap: false,
```

`animPuzzleDir` was also added to the **non-numeric keyframe effect list**, so keyframing it stores the string value directly instead of running it through `parseFloat`.

---

## Configuration Reference

| Effect key | Type | Default | Meaning |
|------------|------|---------|---------|
| `animIn` / `animOut` | string | `'none'` | Set to `'puzzle'` to enable |
| `animInDur` / `animOutDur` | number | `1.0` | Animation duration in seconds |
| `animInDelay` / `animOutDelay` | number | `0` | Hold time before the animation begins (all animation types) |
| `animEase` | string | `'easeOut'` | Easing curve for the overall sweep |
| `animPuzzleDir` | string | `'random'` | `'random'`, `'top'`, `'bottom'`, `'left'`, `'right'` |
| `animPuzzleSize` | number | `8` | Number of block columns (rows auto-derive from aspect ratio) |
| `animPuzzleSnap` | boolean | `false` | `true` = blocks snap instantly; `false` = pop with scale/fade |

---

## Examples

**Fireship-style random puzzle reveal (image):**
```
Entrance → Puzzle → Direction: Random → Block Style: Snap → Duration: 1.5 s → Delay: 0.2 s → Blocks: 10
```

**Top-to-bottom cascade (text):**
```
Entrance → Puzzle → Direction: Top → Block Style: Pop → Duration: 2.0 s → Blocks: 8
```

**Staggered scene exit:**
```
Exit → Puzzle → Direction: Bottom → Block Style: Snap → Duration: 1.0 s → Delay: 0.3 s
```

---

## Performance Notes

- The per-block draw loop only runs **while the animation is active** (`puzzleLevel > 0.05`); outside the window the clip draws normally at full speed.
- At `level >= 0.98` the loop short-circuits to a single `drawImage`.
- The random order is computed once per clip (seeded), so there is no per-frame shuffle cost.
- During the brief animation window each frame creates one offscreen canvas per animated clip — identical cost to the existing mosaic effect, and only for the clips currently animating.
