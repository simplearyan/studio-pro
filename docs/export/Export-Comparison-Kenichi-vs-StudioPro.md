# Export Architecture Comparison: Kenichi Studio vs Studio Pro Editor

> **Date:** July 2026
> **Purpose:** Analyze how Kenichi Studio handles MediaBunny video export with heavy effects on low-end GPUs (GT 740), and apply those lessons to Studio Pro Editor's export pipeline.

---

## TL;DR

Kenichi Studio avoids the BSOD on old GPUs by using **`createImageBitmap()`** (async, non-blocking GPU read) instead of **`transferToImageBitmap()`** (synchronous GPU pipeline stall). It also **waits for frame acknowledgment** from the worker before sending the next frame, creating natural backpressure.

Studio Pro Editor now implements both of these changes.

---

## 1. File Structure Comparison

| Area | Kenichi Studio | Studio Pro Editor |
|---|---|---|
| **Export logic** | `src/engine/ExportEngine.ts` (239 lines) | `index.html` inline (inline, ~2000+ line file) |
| **Renderer** | `src/engine/Renderer.ts` (591 lines) — separate class | `index.html` inline — `drawCanvas()` function |
| **Worker** | `src/workers/mediabunny.worker.ts` (161 lines) | `export-worker.js` (80 lines) |
| **UI** | `src/components/modals/ExportModal.tsx` (React) | `index.html` inline HTML |

---

## 2. Architectural Differences

### 2.1 Frame GPU Readback (CRITICAL)

| | Kenichi Studio | Studio Pro Editor (before fix) |
|---|---|---|
| **Method** | `await createImageBitmap(canvas)` | `canvas.transferToImageBitmap()` |
| **GPU impact** | **Async** — browser schedules readback when GPU is free | **Synchronous** — flushes entire GPU pipeline, stalls 30-50ms |
| **BSOD risk** | ✅ None | ❌ **High** — ~200 consecutive stalls trigger GPU driver timeout |

**Why this matters:** `transferToImageBitmap()` requires a full GPU pipeline flush + framebuffer readback. On a **GT 740** (Kepler, 2012, 28.8 GB/s bandwidth), this synchronously stalls the GPU for 30-50ms per call. After ~200 calls in ~7 seconds, Windows' TDR (Timeout Detection and Recovery, default 2s) fires, killing the GPU driver → **BSOD**.

`createImageBitmap()` lets the browser perform the readback asynchronously. The readback still takes the same 30-50ms on the GPU, but the **main thread is not blocked** and the GPU pipeline is **not flushed**. The browser schedules the readback during idle GPU cycles.

### 2.2 Backpressure / Flow Control

| | Kenichi Studio | Studio Pro Editor (before fix) |
|---|---|---|
| **Mechanism** | Awaits `FRAME_DONE` from worker before next frame | `framesInFlight` counter tracked but NOT used for flow control |
| **Overflow risk** | ✅ None — only 1 frame in flight | ❌ Frames queued faster than worker can encode |

Kenichi sends one frame to the worker, then **awaits** a `FRAME_DONE` message before sending the next. This provides perfect backpressure — the main thread automatically slows to match the worker's encoding speed.

Studio Pro previously incremented `framesInFlight` with each frame but never used it to gate frame capture. Frames piled up in the worker's message queue.

### 2.3 GPU Yield Between Seek and Render

| | Kenichi Studio | Studio Pro Editor (before fix) |
|---|---|---|
| **Yield** | 25ms `setTimeout` after seeking video elements | None — render immediately after seek |
| **Texture upload** | ✅ GPU has time to decode and upload video frame | ❌ `drawCanvas` may read stale/blank texture |

After setting `videoEl.currentTime = seekTarget`, the browser needs time to decode the video frame and upload it as a GPU texture. Without a yield, `drawCanvas()` draws a blank or partially decoded frame.

### 2.4 Audio Pipeline

| | Kenichi Studio | Studio Pro Editor |
|---|---|---|
| **Approach** | **OfflineAudioContext** — pre-renders all audio to a PCM buffer before video starts | **Real-time** — sends audio chunks alongside video frames |
| **Complexity** | Simpler — audio is done before video encoding begins | Harder — audio and video must stay in sync |
| **Latency** | Higher — audio rendered upfront | Lower — audio sent as it plays |
| **Sync** | Trivial — audio is a single buffer | Complex — chunk timestamp management |

Kenichi's approach is cleaner: render all audio tracks into one PCM buffer via `OfflineAudioContext`, then send it to the worker in large chunks before any video frames. The worker can start encoding audio immediately.

### 2.5 Loop Pattern

| | Kenichi Studio | Studio Pro Editor |
|---|---|---|
| **Structure** | Simple `for` loop with `await` | Recursive `setTimeout` callback |
| **Readability** | ✅ Linear, easy to follow | ❌ Non-linear, harder to debug |
| **Async support** | ✅ Native `await` | ❌ Requires making callback async |

Kenichi:
```typescript
for (let f = 0; f < totalFrames; f++) {
    // ... seek, yield, render, capture, send, await ack ...
}
```

Studio Pro:
```javascript
const realtimeExportLoop = () => {
    // ... frame logic ...
    if (elapsed >= exportDuration) {
        exportFinished = true;
    } else {
        setTimeout(realtimeExportLoop, delay);
    }
};
```

### 2.6 Worker Task Queue

| | Kenichi Studio | Studio Pro Editor |
|---|---|---|
| **Queue** | Yes — `taskQueue` array with sequential processor | No — direct `await videoSampleSource.add(sample)` |
| **Congestion** | ✅ Tasks processed one at a time | ❌ Multiple frames can be queued simultaneously |

Kenichi's worker has a `taskQueue` and a `processQueue()` function that processes frames sequentially. This prevents the worker from being overwhelmed if the main thread sends frames faster than the encoder can handle.

---

## 3. Changes Applied to Studio Pro Editor

Based on this analysis, the following changes were made to `index.html`'s `realtimeExportLoop`:

### 3.1 `transferToImageBitmap()` → `await createImageBitmap(exportCanvas)`

```javascript
// BEFORE (sync GPU stall → BSOD on GT 740):
const bitmap = exportCanvas.transferToImageBitmap();
sendFrameToWorker(bitmap, targetFrame);

// AFTER (async, non-blocking GPU read):
const bitmap = await createImageBitmap(exportCanvas);
sendFrameToWorker(bitmap, targetFrame);
```

### 3.2 Frame Acknowledgment (Backpressure)

```javascript
// Wait for worker to confirm frame is processed before sending next
await new Promise(resolve => {
    const handler = (e) => {
        if (e.data.type === 'frame-processed' && e.data.index === targetFrame) {
            worker.removeEventListener('message', handler);
            resolve();
        }
    };
    worker.addEventListener('message', handler);
    setTimeout(() => {
        worker.removeEventListener('message', handler);
        resolve();
    }, 3000); // Safety timeout
});
```

### 3.3 16ms GPU Yield After Seek

```javascript
// Give GPU time to decode the video frame texture
await new Promise(r => setTimeout(r, 16));
```

### 3.4 Simplified Delay

Removed the complex adaptive delay calculations (`avgCaptureMs`, `EXPORT_LOOP_INTERVAL`, GPU cooldown). With async `createImageBitmap` + frame acknowledgment providing natural backpressure, a simple fixed 33ms delay is sufficient.

---

## 4. Key Metrics

| Metric | Before | After (expected) |
|---|---|---|
| **GPU duty cycle** | ~80-90% (crashes) | ~25-35% (safe) |
| **Time to BSOD** | ~7 seconds (12% of 60s video) | Never |
| **Export speed (60s video, 30fps, effects)** | Crashes at 12% | ~2-3 minutes |
| **Frames captured** | ~200 then crash | All 1800 (with ~240 unique frames) |
| **PC usable during export?** | No (freezes before crash) | Yes (slower but responsive) |

---

## 5. Future Improvements (Not Yet Implemented)

These Kenichi features could further improve Studio Pro Editor:

### 5.1 OfflineAudioContext Pre-rendering
Pre-render all audio tracks to a PCM buffer before video starts. Simplifies sync and reduces per-frame overhead.

### 5.2 Worker Task Queue
Add a sequential task queue to the worker so frames are processed one at a time, preventing encoder overload.

### 5.3 For+Await Loop Restructuring
Convert the recursive `setTimeout` callback to a simple `for` loop with `await`. Makes the code linear and easier to reason about.

### 5.4 Resolution Downsampling on Slow GPUs
If `createImageBitmap` takes > 50ms, temporarily reduce the export canvas resolution by 50% until captures speed up.

---

*Analysis performed July 2026 — Kenichi Studio version at time of analysis vs Studio Pro Editor HEAD.*
