# captureStream Fix — Resolution

> **Date:** August 2026
> **Status:** ✅ FIXED (commit 9ba721f)
> **Root cause found and resolved**

---

## Root Cause

Mixing `captureStream(30)` video track with real `MediaStreamAudioDestinationNode` audio tracks from `State.masterStreamNode.stream` produces **0-byte blobs**.

### Why

When no audio clips are actively playing through the audio graph, the `MediaStreamAudioDestinationNode` produces no encoded data. The MediaRecorder silently hangs when mixing a live-but-silent audio track with the canvas video track — resulting in 0-byte output.

### Evidence

| Test | Result |
|---|---|
| captureStream(30) + video-only | ✅ 5.4 KB blob |
| captureStream(30) + fresh silent audio | ✅ 37 KB blob |
| captureStream(30) + real masterStreamNode audio | ❌ 0 bytes |
| captureStream(30) + video-only (isolated) | ✅ 181 frames |

---

## The Fix (commit 9ba721f)

1. **Offscreen canvas** (`document.createElement('canvas')`) — matches the proven archive approach
2. **`captureStream(30)`** — auto-samples at 30fps without needing compositor paint or `requestFrame()`
3. **`requestAnimationFrame`** — triggers compositor paint so `captureStream` detects canvas changes
4. **Video-only canvas stream** — no mixing with broken `MediaStreamAudioDestinationNode` audio tracks

### Code change

```javascript
// BEFORE (broken)
const finalStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...State.masterStreamNode.stream.getAudioTracks()  // ← silent tracks = 0 bytes
]);

// AFTER (fixed)
const finalStream = canvasStream;  // video-only, no broken audio tracks
```

---

## Trade-off

The Std tab export (captureStream) is now **video-only** (no audio). For exports with audio, use the **MediaBunny** or **Fast** tabs which use WebCodecs and handle audio properly.

---

## Why the archive "worked"

The archive also used `captureStream(30)` + `requestAnimationFrame`, but it didn't mix in the broken audio tracks. The archive's audio was handled separately (if at all).

---

## Future: captureStream with audio

To add audio back to captureStream exports:
1. Start audio elements before the export loop
2. Create a fresh `MediaStreamAudioDestinationNode`
3. Route audio through it
4. Mix only when audio is actually playing

This is complex and fragile — WebCodecs (MediaBunny) handles audio properly already.
