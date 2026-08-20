# captureStream + MediaRecorder Fix Plan

> **Date:** August 20, 2026
> **Status:** Analysis complete, immediate fix applied, long-term plan below

---

## 1. What we confirmed works

| Test | Result |
|---|---|
| Isolated `captureStream(30)` + rAF loop | ✅ 1.4 MB for 5s |
| Isolated `captureStream(0)` + `requestFrame()` | ❌ 0-byte blob (same-tick) |
| Isolated MP4 `captureStream(30)` + rAF | ✅ 1.5 MB for 10s |
| `startExport` with rAF | ❌ 2-3s video |
| `startExport` with setTimeout + requestFrame | ❌ 2-3s video |
| `startExport` with visible canvas + rAF | ❌ 2-3s video |

**Key finding:** `captureStream` works in isolation but fails inside `startExport`. The issue is NOT the API itself — it's something in the `startExport` setup that breaks the stream.

## 2. Root cause analysis

After 7+ debugging attempts, the most likely causes (in order of probability):

### Cause A: `stopMedia()` interferes with the stream
`stopMedia()` is called BEFORE the export loop starts. It:
1. Sets `State.currentTime = 0`
2. Calls `drawCanvas()` (no args) — draws to preview canvas
3. Calls `stopAllMedia()` — pauses all elements
4. Calls `updatePlayhead()` — updates DOM

Step 2 draws to the preview canvas at t=0. Then the export sets up `captureStream` on the SAME visible canvas. The stream might capture the t=0 state instead of the export frames.

### Cause B: `drawCanvas` throws silently during export
The current `drawCanvas` (32K lines) has many features not in the archive (11K lines):
- Scene filtering (`c.sceneId === State.activeSceneId`)
- Color index normalization
- Alpha pre-multiplication
- Offscreen canvas paths
- Markdown clip rendering

If ANY of these throw, the try/catch catches it but the canvas never updates → stream gets empty frames.

### Cause C: Audio graph setup interferes with MediaRecorder
`buildAudioGraph()` and `applyAudioEffects()` create Web Audio nodes. If these connect to `State.masterStreamNode` incorrectly, the audio tracks might confuse the MediaRecorder.

### Cause D: Chrome MP4 MediaRecorder bugs
Chrome's MP4 support in MediaRecorder is relatively new (Chrome 130+). The codec string `"avc1, mp4a.40.2"` might have issues with certain configurations.

## 3. Immediate fix (already applied)

**Redirect Video tab → MediaBunny WebCodecs pipeline.**

This works because MediaBunny:
- Uses `VideoEncoder` (WebCodecs) — no compositor dependency
- Encodes each frame independently — no stream timing issues
- Has been battle-tested across all export scenarios

## 4. Long-term fix plan

### Phase 1: Add diagnostic logging to captureStream path
1. Before `captureStream(0)`, log canvas dimensions
2. After each `drawCanvas`, log whether canvas has content (sample a pixel)
3. After each `requestFrame()`, log track state
4. In `recorder.ondataavailable`, log chunk size
5. In `recorder.onstop`, log total chunks and blob size

### Phase 2: Fix the drawCanvas interference
1. Don't call `stopMedia()` before export — it draws to the canvas at t=0
2. Instead, just pause media elements without the full stop
3. Or: create the export canvas + stream BEFORE calling stopMedia

### Phase 3: Test with diagnostic data
1. Run export with diagnostics enabled
2. Check if drawCanvas throws
3. Check if canvas has content after draw
4. Check if requestFrame delivers
5. Check if recorder receives data

### Phase 4: Fix based on findings
- If drawCanvas throws → fix the specific error
- If canvas is empty → fix the draw path
- If requestFrame doesn't deliver → switch to rAF
- If recorder doesn't receive → fix stream setup

### Phase 5: Remove MediaBunny redirect
Once captureStream works reliably, remove the redirect so Video tab uses its own simpler pipeline.

## 5. Alternative long-term approach

If captureStream proves too unreliable, replace the Video tab's MediaRecorder with a WebCodecs-based encoder (similar to MediaBunny but simpler). This would give the Video tab its own working pipeline without depending on captureStream.

---

## Recommendation

For now, the MediaBunny redirect is the safest fix. The captureStream investigation should continue in the background with diagnostic logging. The archive's simplicity (11K lines) made captureStream work — the current complexity (32K lines) makes it fragile. A proper fix likely requires either:
1. Simplifying the drawCanvas export path, or
2. Replacing MediaRecorder with WebCodecs in the Video tab
