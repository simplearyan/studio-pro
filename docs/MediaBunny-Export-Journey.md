# MediaBunny Export: Issues, Fixes & Web Worker Architecture

> **Date:** July 2026
> **Purpose:** Document the complete journey of building and debugging MediaBunny-based video export in StudioPro Editor — what broke, why it broke, and how each issue was fixed.

---

## Table of Contents

1. [What is MediaBunny Export?](#1-what-is-mediabunny-export)
2. [Issue Timeline](#2-issue-timeline)
3. [Issue 1: Empty / Blank Frames](#3-issue-1-empty--blank-frames)
4. [Issue 2: No Audio in Exported Video](#4-issue-2-no-audio-in-exported-video)
5. [Issue 3: PC Freeze / BSOD (GT 740 GPU)](#5-issue-3-pc-freeze--bsod-gt-740-gpu)
6. [Issue 4: Double Download](#6-issue-4-double-download)
7. [Issue 5: Progress Stuck at 100%](#7-issue-5-progress-stuck-at-100)
8. [Issue 6: Incorrect FPS (Requested 12fps → Got 27fps)](#8-issue-6-incorrect-fps-requested-12fps--got-27fps)
9. [Issue 7: Infinite-Length Blank Video (7+ hours)](#9-issue-7-infinite-length-blank-video-7-hours)
10. [Web Worker Export Architecture](#10-web-worker-export-architecture)
11. [Audio Merging: Two Approaches](#11-audio-merging-two-approaches)
12. [Future Improvements](#12-future-improvements)

---

## 1. What is MediaBunny Export?

MediaBunny is a JavaScript library that wraps the **WebCodecs API** to enable frame-accurate video encoding inside a **Web Worker**. Unlike the browser's built-in `MediaRecorder` API (which captures a real-time stream at whatever rate the compositor renders), MediaBunny gives us:

- **Explicit frame-level control** — we decide exactly which pixels go into each frame
- **Codec selection** — AVC/H.264 for MP4, VP9 for WebM (not available via MediaRecorder in all browsers)
- **Audio codec control** — AAC for MP4, Opus for WebM
- **Bitrate control** — explicit bitrate parameter
- **Off-main-thread encoding** — the worker handles encoding without blocking the UI
- **Container muxing** — MediaBunny muxes video + audio into the final .mp4 or .webm container

**The trade-off**: We must manually capture each frame, send it to the worker, encode audio, and handle synchronization ourselves — MediaRecorder handles all of this automatically.

---

## 2. Issue Timeline

```
Commit                                                    Issue
───────                                                    ─────
537ba96  "web worker"              ───  Initial Web Worker setup
de6b126  "mediabunny export"       ───  Basic export working (empty frames)
c6e7bdc  "mp4 options added"       ───  MP4 format added (h264 codec error)
68a536e  "Audio Support"           ───  Audio added, WebM only
563ced7  "Audio for mp4"           ───  MP4 audio working, empty frames persist
fc136a7  "No Empty Frames"         ───  Real-time playback approach ✅
cf611d1  "ruler update bug fixed"  ───  Timeline ruler fixed
cb8c901  "Recover Video"           ───  Video recovery after export
4a2b83c  "fixed staggered clip"    ───  Overlap clip export fix
7e6849b  "better recovery"        ───  Faster recovery + bug fixes
e24c7f3  "Export Are doing fine"  ───  Export stable
ac6edf4  "export modal UI style"  ───  UI improvements
08a5a5b  "Correct FPS"            ───  Precise FPS targeting ✅
c3b0480  "export modal UI - style" ───  Final UI polish
```

---

## 3. Issue 1: Empty / Blank Frames

### Symptoms
- Exported video had 3-5 blank (black/empty) frames at the start
- Some frames throughout the video were blank
- Console: `"Some seeks failed at t=2.633, frame may be blank"`
- Console: `"Video seek error during performSeek"` followed by `"Seeking failed or timed out. Recreating video element and retrying..."`

### Root Cause

The original approach was to **seek video elements to each frame position** using `video.currentTime = t`, then wait for the `seeked` event, then draw the frame:

```javascript
// BROKEN APPROACH — per-frame seeking
for (let t = startTime; t < endTime; t += timeStep) {
    video.currentTime = t;
    await waitForSeeked(video);  // ← Most seeks FAILED
    drawCanvas(ctx, w, h);
    const bitmap = canvas.transferToImageBitmap();
    worker.postMessage({ bitmap, timestamp: t });
}
```

The problem: After calling `stopMedia()` (which pauses and resets all timeline video elements), the `<video>` elements enter an **error state** where seeking to any position triggers a `Video seek error` event. The error recovery logic recreates video elements, but by the time they're ready, the frame capture loop has moved on — resulting in blank frames.

Even with fresh video elements, **consecutive seeks** at high frequency (every 33ms for 30fps) would eventually overwhelm the browser's video decoder, causing seeks to fail silently.

### The Fix: Real-time Playback

Instead of seeking to each frame position, we now:

1. **Create fresh video elements** (not affected by `stopMedia()`)
2. **Seek once** to the clip's starting position
3. **Play at 1x speed** naturally
4. **Capture frames at the desired FPS** using a `requestAnimationFrame` loop
5. **Track elapsed wall time** to determine which frame to capture

```javascript
// WORKING APPROACH — real-time playback
const el = document.createElement('video');
el.src = clip.fileUrl;
el.muted = true;
hiddenContainer.appendChild(el);  // MUST be in DOM for drawImage()

// Seek to start position once
el.currentTime = clipStartTime;
await el.play();  // Start playing

// In the rAF loop, capture based on wall time:
const elapsed = (now - exportStartWallTime) / 1000;
const targetFrame = Math.floor(elapsed / timeStep);
if (targetFrame > lastCapturedFrame) {
    drawCanvas(exportCtx, exportW, exportH);
    const bitmap = await createImageBitmap(exportCanvas);
    worker.postMessage({ type: 'frame', bitmap, timestamp: elapsed, duration: timeStep, index: targetFrame });
}
```

**Why real-time works**: The video plays naturally, the decoder processes frames in-order at a sustainable pace, and `drawImage()` always has a valid frame to read. The cost is that export speed equals video duration.

### Key Detail: DOM Attachment

The `<video>` element **must be attached to the DOM** for `canvas.drawImage(videoEl)` to return pixel data reliably. This is a browser optimization — off-screen video elements may not be fully decoded.

```javascript
const hiddenContainer = document.getElementById('_mb_export_videos');
hiddenContainer.appendChild(el);
```

---

## 4. Issue 2: No Audio in Exported Video

### Symptoms
- MediaBunny WebM export: video has no audio
- MediaBunny MP4 export: video has no audio
- Non-MediaBunny exports (standard): audio works fine
- Console (WebM): `"Codec 'pcm-f32' cannot be contained within WebM. Supported audio codecs are: 'opus', 'vorbis'."`
- Console (MP4): `"config.bitrate must be provided for compressed audio codecs"`

### Root Causes

Three separate issues:

#### Issue 2a: Wrong Audio Codec for Container

The initial implementation sent raw PCM (`pcm-f32`) audio data. PCM is valid for WAV files but **not** for WebM or MP4 containers. Each container type requires specific audio codecs:

| Container | Acceptable Audio Codecs |
|---|---|
| WebM | Opus, Vorbis |
| MP4 | AAC, MP3 |
| WAV | PCM (uncompressed) |

#### Issue 2b: Missing Bitrate for Compressed Audio

When switching to `opus` and `aac` codecs, the `AudioSampleSource` config was missing the required `bitrate` parameter:

```javascript
// BROKEN — no bitrate for compressed codec
audioSampleSource = new AudioSampleSource({
    codec: audioCodec,    // 'opus' or 'aac'
    numberOfChannels: 2,
    sampleRate: 48000
    // ← missing bitrate: 128000
});
```

Compressed audio codecs **require** a bitrate parameter because they need to know the target data rate.

#### Issue 2c: Audio Capture Not Active

Initially, MediaBunny exports did not capture audio at all — the `hasAudio` flag was not set, so the worker never created an `AudioSampleSource`.

### The Fix

```javascript
// FIXED worker configuration
audioSampleSource = new AudioSampleSource({
    codec: audioCodec,        // 'aac' for MP4, 'opus' for WebM
    numberOfChannels: 2,
    sampleRate: 48000,
    bitrate: 128000           // ← Required for compressed codecs
});
output.addAudioTrack(audioSampleSource);
```

And for audio data capture:

```javascript
// Pre-render audio using OfflineAudioContext
const offlineCtx = new OfflineAudioContext(2, totalSamples, 48000);
// ... schedule all audio clips ...
const renderedBuffer = await offlineCtx.startRendering();

// During export, send 100ms chunks as AudioData
const chunkSize = 4800; // 100ms at 48kHz
for (let offset = 0; offset < totalSamples; offset += chunkSize) {
    const audioData = new AudioData({
        format: 'f32',
        sampleRate: 48000,
        numberOfChannels: 2,
        numberOfFrames: Math.min(chunkSize, totalSamples - offset),
        timestamp: (offset / 48000) * 1e6,  // microseconds
        data: interleavedBuffer
    });
    worker.postMessage({ type: 'audio-data', audioData, timestamp, index }, [audioData]);
}
```

**Container-codec mapping:**
```
WebM → VP9 (video) + Opus (audio)
MP4  → AVC/H.264 (video) + AAC (audio)
```

The `export-worker.js` selects the codec pair based on the format flag:
```javascript
const audioCodec = format === 'mp4' ? 'aac' : 'opus';
```

---

## 5. Issue 3: PC Freeze / BSOD (GT 740 GPU)

### Symptoms
- Export progress reaches ~12% then PC freezes
- Windows Blue Screen of Death (BSOD) / TDR (Timeout Detection and Recovery)
- Only happens on low-end GPUs (GT 740, Intel HD Graphics)
- Only happens with effects applied (border-radius, drop-shadow, stroke)
- Console: No errors — complete system hang

### Root Cause

The original code used `canvas.transferToImageBitmap()` to capture each frame:

```javascript
// BSOD CAUSE — synchronous GPU pipeline flush
const bitmap = exportCanvas.transferToImageBitmap();
```

`transferToImageBitmap()` requires a **full GPU pipeline flush** — it waits for all pending GPU commands to complete, reads the framebuffer back to the CPU, then transfers ownership. On a **GT 740** (Kepler architecture, 2012):

- Each call stalls the GPU for **30-50ms**
- With effects applied, each `drawCanvas()` call adds **15-25ms** of GPU work
- Total per-frame GPU time: **45-75ms**
- After ~200 frames (~7 seconds at 30fps), the accumulated stall triggers Windows' **TDR** (Timeout Detection and Recovery)
- Windows kills the GPU driver → **BSOD / system freeze**

Without effects (plain video), `drawCanvas()` is fast (~5ms) and the GPU has idle time between frames to recover. With effects, the GPU is saturated.

### The Fix: `await createImageBitmap()`

```javascript
// SAFE — async, non-blocking GPU read
const bitmap = await createImageBitmap(exportCanvas);
```

`createImageBitmap()` is **asynchronous** — it schedules the readback and returns immediately. The browser performs the GPU→CPU copy during idle cycles without flushing the pipeline. Key differences:

| | `transferToImageBitmap()` | `createImageBitmap()` |
|---|---|---|
| **GPU pipeline** | Flushed synchronously | Read asynchronously |
| **Main thread** | Blocked for 30-50ms | Not blocked |
| **Memory** | Transfers ownership (canvas becomes detached) | Copies pixels (canvas remains usable) |
| **TDR risk** | **High** on slow GPUs | **None** |
| **Speed** | Faster per call (~0.5ms JS overhead) | Slower per call (~2ms JS overhead) |

### Supporting Fixes

**1. GPU yield between seek and render:**
```javascript
// Give GPU time to decode and upload video frame texture
await new Promise(r => setTimeout(r, 33));
```

**2. Frame acknowledgment (backpressure):**
```javascript
// Wait for worker to confirm frame before sending next
await new Promise(resolve => {
    const handler = (e) => {
        if (e.data.type === 'frame-processed' && e.data.index === targetFrame) {
            worker.removeEventListener('message', handler);
            resolve();
        }
    };
    worker.addEventListener('message', handler);
});
```

This creates natural backpressure — the main thread waits for the worker to finish encoding before sending the next frame. No frames pile up, no memory growth, no GPU saturation.

**3. In-flight frame limit:**
```javascript
let framesInFlight = 0;
const MAX_IN_FLIGHT = 3;

if (framesInFlight < MAX_IN_FLIGHT) {
    framesInFlight++;
    worker.postMessage({ type: 'frame', ... });
}
```

---

## 6. Issue 4: Double Download

### Symptoms
- Browser downloads the exported file **twice**
- Two identical files appear in the downloads bar

### Root Cause

The `worker.onmessage` handler for the `'done'` event was registered **inside** `submitExport()`, which is called when clicking "Start Export". But the handler was also defined globally elsewhere in the code. When the export completed, **both** handlers fired — each creating a separate download.

```javascript
// BROKEN — handler registered twice
function submitExport() {
    worker.onmessage = (e) => {  // ← One handler here
        if (e.data.type === 'done') {
            downloadBlob(blob);
        }
    };
}

// And also globally:
worker.onmessage = (e) => {  // ← Another handler here
    // ...
};
```

### The Fix

Centralize the `'done'` handler inside `startMediaBunnyExport()` only, and remove any duplicate global registration. Use `worker.addEventListener()` instead of `worker.onmessage =` to avoid accidental overwrites and ensure only one handler fires.

```javascript
// FIXED — single handler, registered once
window.startMediaBunnyExport = async function(...) {
    const worker = new Worker('export-worker.js');
    
    worker.addEventListener('message', function handler(e) {
        const data = e.data;
        if (data.type === 'done') {
            // Create blob and download ONCE
            const blob = new Blob([data.buffer], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `StudioPro_Export_MediaBunny.${ext}`;
            a.click();
            URL.revokeObjectURL(url);
            
            worker.removeEventListener('message', handler);
            cleanupExport();
        }
    });
};
```

---

## 7. Issue 5: Progress Stuck at 100%

### Symptoms
- Progress bar reaches 100%
- "Stop Export" button remains visible
- No download triggers
- Console: Export completes but finalize never fires

### Root Cause

The `output.finalize()` call was inside the rAF loop conditionally:

```javascript
// BROKEN — finalize in wrong place
if (elapsed >= exportDuration && !exportFinished) {
    exportFinished = true;
    await worker.postMessage({ type: 'finalize' });  // ← Called once, but race condition with remaining frames
}
```

The race: The rAF loop sends frame `N` to the worker, then checks `elapsed >= exportDuration` and posts `finalize`. But the worker might still be processing frame `N` when `finalize` arrives. The worker's `finalize` handler calls `output.finalize()` which flushes **all** tracks — including the one currently being written to by frame `N`. This causes `videoSampleSource.finalize is not a function`.

### The Fix

Move the finalize trigger to a **separate completion check** that runs after all frames are acknowledge by the worker:

```javascript
// FIXED — finalize after all frames acknowledged
function checkExportComplete() {
    if (exportFinished && framesAcknowledged >= totalFrames) {
        worker.postMessage({ type: 'finalize' });
    }
}

// In frame-processed handler:
framesAcknowledged++;
if (lastCapturedFrame >= totalFrames - 1) {
    exportFinished = true;
    checkExportComplete();
}
```

---

## 8. Issue 6: Incorrect FPS (Requested 12fps → Got 27fps)

### Symptoms
- User selects 12fps or 24fps with "Fast Mode" off
- Exported video is ~27fps regardless of selection
- Only affects non-fast-mode exports
- Custom FPS values also produce ~27fps

### Root Cause

The frame capture timing was using `Math.floor(elapsed / timeStep)` which rounds **down** to the nearest integer. With Fast Mode off, an adaptive delay was added between captures:

```javascript
// BROKEN — adaptive delay + floor() caused frame doubling
const delay = Math.max(0, frameDurationMs - captureOverhead - 16);
// With frameDurationMs = 83.33ms (12fps), captureOverhead = 38ms:
// delay = 83.33 - 38 - 16 = 29.33ms
// Actual frame time = 38 + 29.33 + 16 ≈ 83.33ms → correct for 12fps
```

But the `captureOverhead` estimate was wrong. Actual overhead was closer to 10-15ms, not 38ms. So the delay became too large, causing frames to be spaced further apart. Then `Math.floor(elapsed / timeStep)` would sometimes skip frames (because elapsed advanced past two frame boundaries during the delay), and the next frame would land at 27fps timing.

### The Fix: Precision Timing

Replace `Math.floor()` with precise frame tracking using a **next capture time** approach:

```javascript
// FIXED — precise frame scheduling
let nextCaptureTime = 0;
const frameDurationMs = 1000 / fps;

function realtimeExportLoop(now) {
    if (!exportStartWallTime) exportStartWallTime = now;
    const elapsed = (now - exportStartWallTime);
    
    if (elapsed >= nextCaptureTime) {
        // Capture this frame
        captureAndSendFrame(frameIndex);
        
        // Schedule next capture at exact frame boundary
        nextCaptureTime = (frameIndex + 1) * frameDurationMs;
        frameIndex++;
    }
    
    if (elapsed < exportDuration * 1000) {
        requestAnimationFrame(realtimeExportLoop);
    } else {
        finishExport();
    }
}
```

This ensures that frame N is always captured at exactly `N * frameDurationMs` milliseconds from the start, regardless of how long the actual capture took.

**Fast Mode**: Skips the GPU yield and frame acknowledgment, allowing frames to be captured as fast as the GPU can produce them (resulting in variable/actual fps).

---

## 9. Issue 7: Infinite-Length Blank Video (7+ Hours)

### Symptoms
- Exported video is 7+ hours long
- Entire video is blank/empty (single frame stretched)
- File size is very large

### Root Cause

The export duration calculation was not properly scoped to the timeline's actual content duration. If the export range was misconfigured (e.g., `endTime` defaulting to a large value), the frame loop would continue capturing frames for hours, sending them to the worker, which would encode them all into an enormous file.

This happened when the **export custom range** inputs had incorrect default values, and the user clicked "Start Export" without setting a proper end time.

### The Fix

Default to **"Full Timeline"** scope, and calculate the actual duration based on the max clip end time:

```javascript
// Calculate actual timeline duration
const timelineDuration = Math.max(...State.clips.map(c => c.endTime));
document.getElementById('exportEndTime').value = timelineDuration;

// Or use full timeline:
if (scope === 'full') {
    endTime = timelineDuration;
}
```

Also add a **safety cap** in the frame loop:
```javascript
const MAX_EXPORT_DURATION = 3600; // 1 hour safety cap
if (endTime - startTime > MAX_EXPORT_DURATION) {
    alert('Export duration exceeds maximum (1 hour). Please trim your timeline.');
    return;
}
```

---

## 10. Web Worker Export Architecture

### 10.1 Overview

```
┌────────────────────────────────────────────────────────────┐
│                   Main Thread (UI)                         │
│                                                            │
│  Audio Clips ──► OfflineAudioContext ──► PCM Buffer        │
│                                                            │
│  Video Clips ──► Fresh <video> elements (hidden DOM)       │
│                     │                                      │
│                     ▼                                      │
│           requestAnimationFrame Loop                       │
│                     │                                      │
│                     ├── drawCanvas(exportCtx, w, h)        │
│                     ├── await createImageBitmap(canvas)    │
│                     ├── AudioData chunks (100ms)           │
│                     └── worker.postMessage(bitmap/audio)   │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                Web Worker (export-worker.js)                │
│                                                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │  Output (muxer)                                  │      │
│  │  ├── VideoSampleSource (VP9 / AVC encoder)       │      │
│  │  │   └── VideoSample(ImageBitmap, timestamp)     │      │
│  │  └── AudioSampleSource (Opus / AAC encoder)      │      │
│  │       └── AudioSample(AudioData, timestamp)      │      │
│  │                                                   │      │
│  │  target: BufferTarget (collects encoded bytes)    │      │
│  └──────────────────────────────────────────────────┘      │
│                                                            │
│  Messages:                                                 │
│  ◄ 'start'     { config: { width, height, fps, format } }  │
│  ◄ 'frame'     { bitmap, timestamp, duration, index }      │
│  ◄ 'audio-data'{ audioData, timestamp, index }             │
│  ◄ 'finalize'  (triggers output.finalize())                │
│  ◄ 'cancel'    (cleanup)                                   │
│                                                            │
│  ► 'ready'     (worker initialized)                        │
│  ► 'frame-processed' { index }                             │
│  ► 'audio-processed' { index }                             │
│  ► 'done'       { buffer: ArrayBuffer }                    │
│  ► 'error'      { error: string }                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│                 Browser Download                            │
│  Blob URL → <a download> click → Download Manager          │
└────────────────────────────────────────────────────────────┘
```

### 10.2 Worker Code Structure

```javascript
// export-worker.js
import { Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget,
         VideoSampleSource, VideoSample, AudioSampleSource, AudioSample }
  from 'mediabunny';

let output = null;
let videoSampleSource = null;
let audioSampleSource = null;

self.onmessage = async (e) => {
    const data = e.data;

    if (data.type === 'start') {
        // 1. Create Output with chosen format
        const outputFormat = format === 'mp4'
            ? new Mp4OutputFormat()
            : new WebMOutputFormat();
        output = new Output({
            format: outputFormat,
            target: new BufferTarget()
        });

        // 2. Add video track
        videoSampleSource = new VideoSampleSource({
            codec: format === 'mp4' ? 'avc' : 'vp9',
            width, height, bitrate: bitrate || 5e6
        });
        output.addVideoTrack(videoSampleSource);

        // 3. Add audio track (if audio present)
        if (hasAudio) {
            audioSampleSource = new AudioSampleSource({
                codec: format === 'mp4' ? 'aac' : 'opus',
                numberOfChannels: 2,
                sampleRate: 48000,
                bitrate: 128000          // ← Required for compressed codecs
            });
            output.addAudioTrack(audioSampleSource);
        }

        await output.start();
        self.postMessage({ type: 'ready' });

    } else if (data.type === 'frame') {
        const { bitmap, timestamp, duration, index } = data;
        const sample = new VideoSample(bitmap, { timestamp, duration });
        await videoSampleSource.add(sample);
        sample.close();
        bitmap.close();
        self.postMessage({ type: 'frame-processed', index });

    } else if (data.type === 'audio-data') {
        const { audioData, timestamp, index } = data;
        const sample = new AudioSample(audioData, {
            timestamp,
            duration: audioData.numberOfFrames / audioData.sampleRate
        });
        await audioSampleSource.add(sample);
        sample.close();
        audioData.close();
        self.postMessage({ type: 'audio-processed', index });

    } else if (data.type === 'finalize') {
        await output.finalize();
        const buffer = output.target.buffer;
        self.postMessage({ type: 'done', buffer }, [buffer]);

    } else if (data.type === 'cancel') {
        try { if (output) output.cancel(); } catch (_) {}
        output = null;
        videoSampleSource = null;
        audioSampleSource = null;
    }
};
```

### 10.3 Key Design Decisions

| Decision | Rationale |
|---|---|
| **DOM-attached video elements** | `drawImage()` requires DOM attachment for reliable pixel data |
| **Fresh video elements per export** | Existing elements may be in error state from timeline playback |
| **Real-time playback (not per-frame seek)** | Per-frame seeking causes decoder errors and blank frames |
| **`createImageBitmap()` not `transferToImageBitmap()`** | Async readback prevents GPU pipeline stall → BSOD |
| **Frame acknowledgment for backpressure** | Prevents worker queue from growing unbounded |
| **OfflineAudioContext for audio pre-render** | Single PCM buffer simplifies sync vs per-frame audio tracking |
| **100ms audio chunks** | Balances worker message overhead with memory usage |

### 10.4 Container-Codec Table

| Export Option | Container | Video Codec | Audio Codec | Audio Bitrate |
|---|---|---|---|---|
| MediaBunny MP4 | `.mp4` | AVC/H.264 (`avc`) | AAC (`aac`) | 128 kbps |
| MediaBunny WebM | `.webm` | VP9 | Opus (`opus`) | 128 kbps |

---

## 11. Audio Merging: Two Approaches

### 11.1 MediaRecorder Approach (Standard Export)

```
Audio Graph (real-time):
  Clip A → GainNode → ┐
  Clip B → GainNode → ├─→ MasterGain → MediaStream → MediaRecorder
  Clip C → GainNode → ┘
```

- Audio is captured **live** from the Web Audio graph
- Naturally synchronized with video (same timeline clock)
- No pre-rendering needed
- Captures ALL audio including video-internal tracks
- **Limitation:** No codec control, bitrate control, or individual track access

### 11.2 MediaBunny Approach (OfflineAudioContext)

```
OfflineAudioContext (pre-render):
  Clip A → GainNode → ┐
  Clip B → GainNode → ├─→ MasterGain → Destination → PCM Buffer
  Clip C → GainNode → ┘

During export:
  PCM Buffer → AudioData chunks (100ms) → Worker → AudioSampleSource
```

1. **Collect all audio clips** that overlap the export range
2. **Calculate total samples** based on export duration (48kHz × 2 channels)
3. **Schedule each clip** into `OfflineAudioContext` at its timeline position
4. **Render once** — `startRendering()` produces a complete PCM buffer
5. **Read in chunks** during the frame loop (100ms = 4800 samples)
6. **Send as AudioData** objects with microsecond timestamps
7. **Worker encodes** each chunk via `AudioSampleSource`

**Why pre-render?**
- Seeking audio clips to each frame position is expensive and error-prone
- A single `OfflineAudioContext.render()` handles all mixing, gain, and timing
- The resulting PCM buffer is perfectly synchronized (no drift)
- Reduces per-frame work: no audio graph manipulation during the frame loop

**Current limitation:** Only clips with decoded `clip.buffer` (imported audio files) are included. Video clips with embedded audio tracks are not extracted. This is a future enhancement.

---

## 12. Future Improvements

### 12.1 Faster-Than-Real-Time Export

Currently, both export pipelines run at real-time speed because video plays at 1x. Potential acceleration approaches:

| Approach | Speed Gain | Complexity | Status |
|---|---|---|---|
| **Playback rate** (2x-4x) | 2-4× | Low | Feasible |
| **Keyframe-only seeking** | 10-30× | Medium | Limited quality |
| **Parallel video decode** | 5-10× | High | Multiple workers |
| **MSE accelerated feeding** | 10-100× | Very High | Experimental |

**Recommended first step:** Add a "Speed" option (1x/2x/4x) that sets `video.playbackRate`. Audio pre-render is unaffected since it's pre-computed.

### 12.2 Audio from Video Clips

Extract and include audio tracks embedded in video clips. Approach:
1. Use `OfflineAudioContext.createMediaElementSource(videoEl)` during pre-render
2. Or decode video audio separately using Web Audio API

### 12.3 Hardware Encoding Detection

Detect the user's GPU capabilities and recommend optimal export settings:
- Low-end (Intel HD, GT 740): Use `createImageBitmap`, limit resolution to 1080p, add GPU yield
- Mid-range (GTX 1060+): Allow higher resolutions, reduced yields
- High-end (RTX 30+): Enable `transferToImageBitmap` for speed

### 12.4 Resume from Crash

If the export is interrupted (tab switch, device sleep, etc.), save the last successfully encoded frame index and resume from there rather than restarting from frame 0.

### 12.5 Progress Estimation

Improve the ETA calculation by tracking per-frame encoding time and using a moving average to predict remaining time more accurately.

---

## Appendix: Key Files

| File | Role | Key Functions |
|---|---|---|
| `index.html` (inline `<script>`) | Export orchestrator | `startMediaBunnyExport()`, `realtimeExportLoop()`, `cleanupExport()` |
| `export-worker.js` | Web Worker | `self.onmessage` — start, frame, audio-data, finalize, cancel |
| `index.html` (inline `<style>`) | Export modal UI | Tab-based accent colors, GPU recommendation, progress bar |

## Appendix: Common Errors & Diagnostics

| Console Error | Likely Cause | Fix |
|---|---|---|
| `Video seek error during performSeek` | Video element in error state from `stopMedia()` | Create fresh elements, use real-time playback |
| `Invalid video codec 'h264'` | Using 'h264' instead of 'avc' | MediaBunny uses `'avc'` for H.264 |
| `config.bitrate must be provided` | Missing bitrate in AudioSampleSource config | Add `bitrate: 128000` |
| `Codec 'pcm-f32' cannot be contained within WebM` | Sending raw PCM to WebM container | Use Opus for WebM, AAC for MP4 |
| `videoSampleSource.finalize is not a function` | `finalize` called on wrong object | Only call `output.finalize()` |
| `An AudioSample was garbage collected without being closed` | Audio samples not properly closed | Call `sample.close()` after `audioSampleSource.add()` |
| `Some seeks failed at t=..., frame may be blank` | Video seek failed during per-frame seeking | Fixed by real-time playback approach |

---

*Document generated July 2026 — covers the complete MediaBunny export development cycle from initial Web Worker commit through final FPS precision fix.*
