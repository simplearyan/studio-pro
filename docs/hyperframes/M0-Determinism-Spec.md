# M0 — Determinism Spec (quantized time, seeded shake, parity harness)

> **Date:** August 2026
> **Status:** Spec for implementation
> **Scope:** `index.html` (30,212 lines). Milestone M0 of [Agent-Authoring-and-Automation-Plan.md](./Agent-Authoring-and-Automation-Plan.md) — the foundation for FTRT export (M1), `.spcomp` (M3), and agent authoring (M4).
> **Contract being adopted:** *same input → same output.* No unseeded `Math.random()`, no wall-clock, in the frame path. Time quantized to the fps grid.
> **North star (from the master plan, §C.1):** quantize time to frames on every *seek*; replace `Math.random()` shake with the existing seeded PRNG; keep wall-clock only in the interactive playback loop; add a preview=render parity check.

---

## 1. Goal & Non-Goals

**Goal:** rendering the same timeline at the same quantized time produces **byte-identical pixels**, whether it happens in preview scrub, in export, or on a different machine/run.

**Non-goals (deliberately NOT in M0):**
- **No export speedup.** M0 does not change how fast export runs — that's M1 (the export loop already uses a frame-count clock for *time*, see §4.1; what M1 removes is the real-time *pacing*).
- **No visual change.** Shake still looks like shake; it just becomes repeatable. Seeded textures still look like textures.
- **No `.spcomp`, no `.sptpl`, no AI panel.** Pure plumbing.
- **No audio rework.** The reverb-impulse randomness (§3, A5) is flagged, not fixed here.

---

## 2. Determinism Audit (complete, verified 2026-08-17)

Every `Math.random()` / `Date.now()` / `performance.now()` call site in `index.html`, classified by reachability from the frame path (`drawCanvas` at 4690).

### In the frame path (must fix) — **1 site**

| # | Line | Code | Verdict |
|---|---|---|---|
| F1 | **3617** | `if (type === 'shake') { animX += (Math.random() - 0.5) * 10; animY += (Math.random() - 0.5) * 10; }` | **The one true bug.** Inside `calculateAnimationState` — called on every frame of every draw for any clip with the `shake` loop animation. Every frame rolls fresh randomness → the same frame renders differently every time it's drawn. Fix in §5. |

### Time-dependent but NOT in the pixel frame path (flag — decide, don't ignore)

| # | Line | Code | Analysis | Verdict |
|---|---|---|---|---|
| T1 | **4246** | `vecMathRebakeAllowed()` uses `performance.now()` with an 80 ms cooldown to throttle math-sprite rebakes | The sprite is cached on `clip.__vecLastSprite`; the wall-clock gate only decides *when* a stale/missing sprite gets rebaked. Within one session frames reuse the baked sprite, so pixels are stable per frame — but *which* sprite exists at frame N depends on wall-clock → cross-run/cross-machine drift for vector-math clips after a load (canvas sprites don't survive serialize → first frames rebake). | **Fix in M0 (cheap):** cache keyed by `${targetW}x${targetH}` (and sprite-relevant effect fields) instead of a wall-clock gate; the gate stays only for interactive drag throttling, skipped when `State.exporting`. |
| T2 | **7915–7942** | `getTexturePresetCanvas` bakes Paper/Grain/Leather/Chalk textures with `Math.random()` (functions at 7962–8065) **once**, then caches in `_texturePresetCache` | Not per-frame (baked once per session → no parity break *within* a run). But two machines bake **different** textures, so a `.spcomp` rendered elsewhere (M3) differs. | **M0.2 optional:** seed the preset generators with a fixed seed (`mulberry32(0xTEXTURE)` per preset id) at bake time. Same pattern as F1, ~10 lines. |
| T3 | **2386–2387** | `createReverbImpulse` fills the reverb impulse buffer with `Math.random()` | Audio-side. Live preview reverb impulse is generated once at `AudioContext` init. The export path's deterministic `OfflineAudioContext` pre-render is claimed in the docs but must be re-verified separately — if export builds its own impulse, it is already seeded or uses a fixed buffer. | **Out of M0 scope.** One-line note in the acceptance log: "audio reverb impulse determinism verified against the export path; if not seeded, file a follow-up." |

### NOT in the frame path (safe — creation/UI time, values baked into data)

| # | Line | What | Why safe |
|---|---|---|---|
| S1 | 2092, 2095, 3232, 11499, 11746, 11881, 12660, 13707, 13841, 16283, 16336, 16838, 16992, 19724, 19780, 19809, 20204, 20238, 20276, 20567, 21388, 21419, 21550…21858 | Clip/track/preset/lib/subtitle **id generation** (`'c_' + Date.now() + Math.random()…`) | Runs once at creation; the id is baked into the clip and serialized. Deterministic *after* creation. |
| S2 | **7638** | `magicLetterRotate` bakes random per-letter rotations into `letterOverrides` | One-shot user action; the values are stored in `clip.effects` (serialized). Draw only *reads* them. |
| S3 | 12337 | `pushUndo` coalescing timestamps | UI-only. |
| S4 | 13718, 13897, 14227, 14363, 14567, 14796, 14874 | Audio-library LRU `_lastUsed` hints | Cache policy, not pixels. |
| S5 | 14094, 14122, 14127 | Group-rename double-confirm cooldown | UI-only. |
| S6 | 15295 | `Date.now()` in some state/timer path | UI-only (verified not reachable from `drawCanvas`). |

**Bottom line:** exactly **one** call site (F1) breaks per-frame determinism today; **two** more (T1, T2) break cross-run reproducibility. The audit is small because `drawCanvas` was already built as a pure seek function.

---

## 3. Part 1 — Quantization Helper

```js
// ── Determinism: snap a seek time to the frame grid (M0) ─────────────
function quantizeTimeToFrame(t, fps) {
    if (!isFinite(t) || t < 0) t = 0;
    const f = Math.max(1, Math.round(fps || 30));
    return Math.round(t * f) / f;
}
```

**Where to apply — at the seek boundary, NOT inside `drawCanvas`:**

| Site | Line(s) | Change |
|---|---|---|
| Timeline click / drag seek | 24788 (`State.currentTime = clickTime`), 24404 (hover playhead) | `State.currentTime = quantizeTimeToFrame(t, State.exportFps || 30)` |
| Keyframe prev/next seek | 12264, 12283 | Quantize the *target* (`clip.start + prev.time` etc.) |
| Time nudge (arrow keys / ±) | 22852 | Quantize the result of `currentTime + delta` |
| Slider / timecode input | wherever the scrub bar sets `State.currentTime` | Quantize on set |
| Export path | 29967–29968 | **Already quantized** — `frameElapsed = lastCapturedFrame * timeStep` is a frame-count clock. Leave untouched. |

**Rule:** quantization happens in the *setters* (all paths that write `State.currentTime`), never in the draw code — so interactive playback stays smooth (the rAF playback loop keeps advancing by wall-clock elapsed and only snaps the playhead display, which it already does), while every *seek* lands on the exact frame the export loop will render. This is what makes scrub(t) == export-frame(t) hold.

---

## 4. Part 2 — Seeded Shake

Replace the F1 line with the existing PRNG pattern (already proven by the puzzle-blocks path, `puzzleSeedFromId` 3625 + `mulberry32` 3633):

```js
if (type === 'shake') {
    // Seed: clip.id (stable across runs) ^ frame index (evolves the shake per frame).
    const shakeFrame = Math.max(0, Math.round(clipTime * (State.exportFps || 30)));
    const rng = mulberry32(puzzleSeedFromId(clip.id) ^ (shakeFrame * 2654435761 >>> 0));
    animX += (rng() - 0.5) * 10;
    animY += (rng() - 0.5) * 10;
}
```

- **`clip.id`** makes every run of the same project shake identically.
- **`^ frame index`** makes the shake evolve across frames (consecutive frames are not identical jitter) while remaining a pure function of (clip, frame).
- `shakeFrame` uses the **quantized** frame index, not raw `clipTime`, so a scrub at `3.4167` and an export frame at `3.4167` produce the same jitter.
- Visual amplitude (`* 10`) and distribution (`rng() - 0.5`) are unchanged → no look change.

**Audit guard (regression tripwire):** after the fix, add a dev-mode assertion at startup that scans `drawCanvas`'s reachable scope for `Math.random` / `Date.now` / `performance.now` string tokens and warns if found (cheap, catches future regressions like F1/T1):
```js
// dev-only, once
if (location.search.includes('determinism-audit')) {
    const src = drawCanvas.toString() + calculateAnimationState.toString() + drawVectorMath.toString();
    for (const tok of ['Math.random', 'Date.now', 'performance.now']) {
        if (src.includes(tok)) console.warn('[M0 audit]', tok, 'reachable in frame path');
    }
}
```

---

## 5. Part 3 — Parity-Check Harness (dev-only)

Three functions exposed as `window.__` (present always, safe no-ops when unused; the cost is only paid when called). All draw into a **fresh offscreen canvas** so they never touch the visible preview.

```js
// FNV-1a hash of the rendered frame's pixel data (sample stride for speed).
function __pixelHash(ctx, w, h) {
    const d = ctx.getImageData(0, 0, w, h).data;
    let hsh = 2166136261;
    for (let i = 0; i < d.length; i += 64) { // sample 1/16 of pixels
        hsh ^= d[i]; hsh = Math.imul(hsh, 16777619);
    }
    return (hsh >>> 0).toString(16);
}
function __renderFrameHash(t, w, h) {
    const fps = State.exportFps || 30;
    const qt = quantizeTimeToFrame(t, fps);
    const prev = State.currentTime;
    const c = document.createElement('canvas'); c.width = w || State.preview.width || 1280; c.height = h || State.preview.height || 720;
    const g = c.getContext('2d');
    State.currentTime = qt;
    drawCanvas(g, c.width, c.height);
    State.currentTime = prev;
    return { t: qt, hash: __pixelHash(g, c.width, c.height) };
}
```

**Checks:**

1. **Self-check (catches F1-class bugs):** `__renderFrameHash(3.4167)` called twice must return the same hash. Any `Math.random()` left in the frame path fails this immediately.
2. **Preview = export (catches quantization drift):** render the *scrub* time (`__renderFrameHash(t)`) and the *export* time for the same frame index (`startTime + frame * timeStep`, i.e. `__renderFrameHash(quantizeTimeToFrame(t))`) at the same canvas size → hashes must match.
3. **State-isolation:** run a full `for frame 0..N` sweep with `drawCanvas` into a scratch canvas and assert `State.currentTime` returns to the caller's value and no `clip.effects` field was mutated (deep-freeze a shallow copy and compare). Catches export mutating preview state.

**Usage:** `?determinism-check` query param in dev runs the self-check on the first rendered frame and logs `[M0] self-check OK` / diffs. No UI, no modal — it's a harness for CI/manual verification, not a feature.

---

## 6. Acceptance Criteria (M0 done = all of these)

- [ ] Same `(clip.id, frame)` produces identical shake pixels: the self-check hash is stable across repeated renders and across a page reload.
- [ ] A scrub to `t = 3.4167` and the export frame at `3.4167` produce the **same pixel hash** (preview = export).
- [ ] All `State.currentTime` *seek* setters quantize to the fps grid; the interactive playback loop still advances smoothly by wall-clock (no feel change).
- [ ] `vecMathRebakeAllowed` (T1) no longer gates sprite availability by wall-clock: the math sprite cache is keyed by size/effect fields, deterministic across runs; the 80 ms throttle remains only for interactive drags and is skipped while exporting.
- [ ] No `Math.random` / `Date.now` / `performance.now` reachable from the frame path (the `determinism-audit` guard warns on none).
- [ ] Textures (T2): preset bakes are seeded OR explicitly deferred with a TODO in the code comment (accepted as M0.2).
- [ ] **Regression:** the Showcase preset and a shake-clip project render with **no visible change** (pixel-diff against the pre-M0 build, hash-diff for shake frames; textures may differ only cross-run).
- [ ] `npm run build` passes; export timing and audio are unchanged.

## 7. Verification Checklist (manual)

1. Open `?determinism-check` in dev → `[M0] self-check OK` on load.
2. Scrub a shake clip back and forth → jitter repeats identically for the same frame (no flicker/noise accumulation).
3. Export a 2s shake clip twice → the two exports pixel-match frame-for-frame (hash-compare via the harness or visual diff).
4. Restart the app, reload the same project, repeat step 3 → still matches (clip.id seed stability).
5. Drag the timeline and a math-formula clip → no rebake pop/stutter (T1 fix preserved the interactive experience).
6. Confirm export progress, cancel, and audio are unaffected.

---

## 8. Out of Scope / Follow-ups

| Item | Where it lands |
|---|---|
| FTRT export (remove real-time pacing, `setTimeout(2)` at 30111) | M1 |
| `.spcomp` format + seek contract | M3 |
| `.sptpl` templates (which need deterministic seeds for palette/texture members) | M2 |
| Audio reverb-impulse determinism verification (T3) | Follow-up filed from M0 acceptance |
