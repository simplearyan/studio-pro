# MediaBunny Export Architecture

## Overview

StudioPro has two independent video export pipelines:

| Export Option | Engine | Video Codec | Audio Codec | Container |
|---|---|---|---|---|
| **MP4 Video** | `MediaRecorder` (browser API) | H.264 (avc1) | AAC (mp4a.40.2) | `.mp4` |
| **WebM Video** | `MediaRecorder` (browser API) | VP9 | Opus | `.webm` |
| **GIF Animation** | `MediaRecorder` | VP9 | None | `.webm` |
| **Audio (.webm)** | `MediaRecorder` | None | Opus | `.webm` |
| **WAV Audio** | `MediaRecorder` | None | PCM (wrapped) | `.wav` |
| **MB MP4 Video** | **MediaBunny** (Web Worker, WebCodecs API) | H.264 (avc) | AAC | `.mp4` |
| **MB WebM Video** | **MediaBunny** (Web Worker, WebCodecs API) | VP9 | Opus | `.webm` |

---

## How MediaBunny Export Works

### High-Level Overview

The MediaBunny pipeline looks like this:

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread (UI)                      │
│                                                          │
│  Audio Clips ──► OfflineAudioContext ──► PCM Buffer      │
│                         (pre-render)                     │
│                                                          │
│  Video Clips ──► Fresh <video> elements (hidden DOM)     │
│                      │                                   │
│                      ▼                                   │
│            requestAnimationFrame Loop                    │
│                      │                                   │
│                      ├── drawCanvas()                    │
│                      ├── transferToImageBitmap()         │
│                      ├── AudioData chunks                │
│                      └── postMessage() ──► Worker        │
│                                                          │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Web Worker (export-worker.js)                │
│                                                          │
│  VideoSampleSource ◄── VideoSample(bitmap)               │
│  AudioSampleSource ◄── AudioSample(AudioData)            │
│       │                                                  │
│       ▼                                                  │
│  Output.finalize() ──► BufferTarget.buffer               │
│       │                                                  │
│       ▼                                                  │
│  postMessage({ type: 'done', buffer }) ──► Main Thread   │
└──────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│              Browser Download (Blob URL)                  │
└──────────────────────────────────────────────────────────┘
```

### Step-by-Step Flow

#### 1. Audio Pre-render (OfflineAudioContext)

Before the frame loop starts, audio is pre-rendered using the Web Audio API's `OfflineAudioContext`:

1. All audio clips with decoded `clip.buffer` that overlap the export range are collected
2. Each clip's `AudioBuffer` is scheduled into an `OfflineAudioContext` at the correct timeline position
3. The result is a single contiguous PCM buffer (Float32, 2 channels, 48kHz) spanning the full export duration
4. This buffer is sent to the worker in 100ms chunks during the frame loop

**Why pre-render?** Seeking audio clips to each frame position is expensive and error-prone. Pre-rendering produces a clean, correctly-timed PCM buffer in a single operation.

**Known limitation:** Only clips with decoded `clip.buffer` (imported audio files) are captured. Video clips with embedded audio tracks are not included. Extracting audio from video clips is a future enhancement.

#### 2. Video Playback (Fresh DOM-attached Elements)

After `stopMedia()` is called, the timeline's original `<video>` elements are in an invalid state. Attempting to seek them frame-by-frame causes persistent `Video seek error` events.

Instead, **fresh video elements** are created for each video clip:

```javascript
const el = document.createElement('video');
el.src = clip.fileUrl;  // Use persistent blob URL
el.muted = true;        // Don't play audio through speakers
el.preload = 'auto';
el.playsInline = true;

// ATTACH TO DOM — critical for ctx.drawImage() to read pixel data
hiddenContainer.appendChild(el);
```

Key design decisions:

- **Fresh elements** — Not affected by `stopMedia()` or timeline playback state
- **DOM-attached** — `canvas.drawImage(videoEl)` only returns pixel data reliably when the `<video>` element is in the DOM (browser optimization)
- **Single seek + play** — Each element is seeked **once** to its starting position, then played naturally. No per-frame seeking.
- **Real-time playback** — Videos play at 1x speed. The rAF loop captures frames at the export FPS (e.g., 30fps) while the video plays.

#### 3. Real-Time Frame Capture (requestAnimationFrame)

Instead of iterating through frames with `for (t = startTime; t < endTime; t += timeStep)`, the export uses a real-time loop:

```javascript
const realtimeExportLoop = (now) => {
    const elapsed = (now - exportStartWallTime) / 1000;
    State.currentTime = startTime + elapsed;
    
    // Capture at desired FPS
    const targetFrame = Math.floor(elapsed / timeStep);
    if (targetFrame > lastCapturedFrame && targetFrame < totalFrames
        && framesInFlight < MAX_IN_FLIGHT) {
        
        drawCanvas(exportCtx, exportW, exportH);
        const bitmap = exportCanvas.transferToImageBitmap();
        worker.postMessage({ type: 'frame', bitmap, timestamp, duration, index }, [bitmap]);
    }
    
    // Send audio chunks up to current position
    sendAudioChunksUpTo(elapsed);
    
    if (elapsed >= exportDuration) {
        exportFinished = true;  // Success path handles finalize
    } else {
        requestAnimationFrame(realtimeExportLoop);
    }
};
```

**Why real-time?** The seek-per-frame approach was fundamentally broken — every single seek failed because the video elements entered an error state after each seek. Real-time playback avoids seeking entirely.

**Trade-off:** Export speed equals video duration (47s video = 47s export). This is the same speed as the non-MediaBunny export.

#### 4. Worker Encoding (MediaBunny Library)

The worker (`export-worker.js`) uses the [MediaBunny](https://mediabunny.dev/) library which wraps the WebCodecs API:

1. **`Output`** — Muxes video and audio tracks into the final container
2. **`VideoSampleSource`** — Encodes `VideoSample(ImageBitmap)` frames using VP9 or AVC/H.264
3. **`AudioSampleSource`** — Encodes `AudioSample(AudioData)` chunks using Opus or AAC
4. **`BufferTarget`** — Collects the final encoded bytes into an `ArrayBuffer`

On `finalize`, the worker calls `output.finalize()` which internally flushes all tracks and muxes the container. The resulting buffer is transferred back to the main thread via `postMessage`.

#### 5. Backpressure (In-Flight Frame Counter)

Without backpressure, frames sent at 30fps could queue up faster than the encoder can process them (typically 3-10fps for VP9), causing memory exhaustion.

A counter-based throttle is used:

```javascript
let framesInFlight = 0;
const MAX_IN_FLIGHT = 5;

// Worker sends 'frame-processed' after encoding each frame
// framesInFlight is decremented in the message handler

// Only capture if under the limit
if (targetFrame > lastCapturedFrame && framesInFlight < MAX_IN_FLIGHT) {
    framesInFlight++;
    // ... send frame to worker
}
```

This ensures at most 5 frames are pending encoding at any time, preventing unbounded memory growth.

#### 6. Cleanup

When the export completes (or is cancelled/errors), `cleanupExport()`:

1. Restores original `clip.videoEl` references for each video clip
2. Removes the hidden `#_mb_export_videos` container from the DOM
3. Removes all worker event listeners
4. Restores speaker gain to its pre-export value
5. Posts `{ type: 'cancel' }` to the worker (error/cancel paths only)
6. Closes the export modal and resets state

---

## Key Differences: MediaBunny vs MediaRecorder Export

| Aspect | MediaRecorder Export | MediaBunny Export |
|---|---|---|
| **Engine** | Browser's built-in `MediaRecorder` API | WebCodecs API via MediaBunny Web Worker |
| **Video encoding** | Done by browser (opaque) | Explicit control via `VideoSampleSource` |
| **Audio encoding** | Captured from `MediaStream` with audio graph | Pre-rendered via `OfflineAudioContext` |
| **Frame capture** | `requestAnimationFrame` real-time loop + `canvas.captureStream()` | `requestAnimationFrame` real-time loop + `OffscreenCanvas.transferToImageBitmap()` |
| **Output container** | Muxed by browser MediaRecorder | Muxed by MediaBunny's `Output.finalize()` |
| **Resolution support** | Any (browser scales) | Any (explicit width/height config) |
| **Bitrate control** | Limited (quality-dependent) | Explicit `bitrate` parameter |
| **Background tab** | Continues (captures at reduced rate) | Continues (Worker is independent) |
| **Browser support** | All modern browsers | Requires WebCodecs API (Chrome 94+, Edge 94+) |
| **Export speed** | Real-time | Real-time |

### When to Use Each

**Use MediaRecorder (non-MB) when:**
- You need maximum browser compatibility
- You want the simplest setup
- Audio from video clips' embedded tracks is needed (MediaRecorder captures from the audio graph)

**Use MediaBunny (MB) when:**
- You need explicit encoder control (bitrate, codec selection)
- You want to avoid main-thread encoding overhead
- You're targeting Chrome/Edge users
- You need WebCodecs-specific features

---

## Audio Merging Architecture

### The Challenge

Export audio needs to combine multiple audio clips (and potentially video audio tracks) at different timeline positions with different volumes, panning, and effects — then synchronize them with the video output.

### The MediaRecorder Approach

MediaRecorder captures audio directly from the Web Audio graph (`State.masterStreamNode.stream`):
1. Each clip's audio is routed through the audio graph with its gain/pan nodes
2. The `MediaRecorder` captures the mixed stream
3. Audio and video are naturally synchronized (they share the same timeline clock)

### The MediaBunny Approach

MediaBunny sends discrete video frames and audio chunks to the worker, which muxes them together:

1. **Audio pre-render**: All audio clips are mixed into a single PCM buffer using `OfflineAudioContext`:
   ```javascript
   const offlineCtx = new OfflineAudioContext(2, totalSamples, 48000);
   audioClips.forEach(clip => {
       const source = offlineCtx.createBufferSource();
       source.buffer = clip.buffer;
       source.start(clipTimeInExport, sourceOffset, duration);
       source.connect(gainNode).connect(masterGain).connect(destination);
   });
   const renderedBuffer = await offlineCtx.startRendering();
   ```

2. **Chunked sending**: During the frame loop, the PCM buffer is read in 100ms chunks and sent as `AudioData` objects:
   ```javascript
   new AudioData({
       format: 'f32',       // 32-bit float PCM
       sampleRate: 48000,
       numberOfChannels: 2,
       numberOfFrames: 4800, // 100ms at 48kHz
       timestamp: position * 1e6,  // microseconds
       data: interleavedFloat32Array
   });
   ```

3. **Worker encoding**: The worker wraps each `AudioData` in an `AudioSample` and feeds it to the `AudioSampleSource`. The encoder compresses it using the selected codec (Opus for WebM, AAC for MP4).

### Synchronization

Audio and video are synchronized by timestamps:
- Video frames have `timestamp` (seconds since export start)
- Audio chunks have `timestamp` (microseconds since export start)
- The worker's muxer assigns presentation timestamps based on these values
- The final container has properly interleaved audio/video tracks

### Container-Codec Mapping

| Container | Video Codec | Audio Codec | Reason |
|---|---|---|---|
| WebM | VP9 | Opus | Standard for WebM; Opus is natively supported |
| MP4 | AVC/H.264 | AAC | MP4 containers don't support Opus; AAC is the standard |

---

## Future Plans: Faster-Than-Real-Time Export

### Why Real-Time?

Currently, both MediaRecorder and MediaBunny exports run at real-time speed because:
- **MediaRecorder**: Captures from a live `MediaStream` that plays at 1x speed
- **MediaBunny**: Video elements play at 1x speed (natural playback)

### Path to Faster Export

Several approaches could enable faster-than-real-time (FTRT) export:

#### Approach 1: Playback Rate (Easiest, ~2x-4x)

Increase the `<video>` element's `playbackRate`:

```javascript
el.playbackRate = 2;  // 2x speed
el.play();
```

Then adjust the frame capture interval:
```javascript
// Capture at the export FPS, but elapsed time advances at 2x
const elapsed = (now - exportStartWallTime) / 1000 * playbackRate;
```

**Limitations:** Video elements at high playback rates skip frames and may not decode every frame cleanly. Audio pitch correction adds CPU overhead. Maximum usable rate is ~4x for most content.

#### Approach 2: Keyframe-Only Seeking (Moderate, ~10x-30x)

Instead of playing the video, seek to keyframe positions and use the nearest keyframe as a proxy:

```javascript
// Seek to every Nth frame (every keyframe interval)
for (let t = startTime; t < endTime; t += keyframeInterval) {
    video.currentTime = t;
    await seeked;
    drawCanvas(ctx, w, h);
    captureFrame();
}
```

**Limitations:** Only works for static scenes with infrequent cuts. Frame-level seek accuracy is lost. Most reliable for slideshow-style content.

#### Approach 3: OffscreenCanvas + ImageBitmap Decoding (Advanced, ~5x-10x)

Separate video decode from rendering:
1. Create multiple hidden `<video>` elements (one per clip)
2. Seek them in parallel to different time positions
3. Use `createImageBitmap(videoEl, ...)` to request frame decoding without rendering
4. Read decoded frames from a pool

This approach leverages the browser's video decoder hardware acceleration while avoiding the rendering bottleneck.

#### Approach 4: Offline Rendering via MSE (Experimental, ~10x-100x)

Use MediaSource Extensions to feed video data directly to the decoder at accelerated speed, bypassing the playback clock entirely. This is similar to how video transcoding tools work.

**Requires:** Deep integration with the demuxer and decoder, likely using WebCodecs API directly (which MediaBunny already does on the worker side).

### Recommendation

For a practical implementation, **Approach 1 (playback rate)** is the most achievable short-term goal. It would:

1. Add a "Speed" option to the export dialog (e.g., "Normal (1x)", "Fast (2x)", "Turbo (4x)")
2. Set `el.playbackRate = speed` on all export video elements
3. Adjust the frame capture interval and audio sending timing proportionally
4. Audio pre-render is unaffected (it's pre-computed, not real-time)

The main challenge is verifying that video frames are correctly decoded at higher playback rates — some browsers drop frames aggressively when `playbackRate > 1`.

---

## Appendix: Key Files

| File | Role |
|---|---|
| `index.html` (inline `<script>`) | `startMediaBunnyExport()` — main export orchestrator |
| `export-worker.js` | Web Worker — MediaBunny encoding pipeline |
| `index.html` (`<script type="module">`) | Worker creation, `worker.onmessage` global handler |
| `node_modules/mediabunny/` | Third-party library for WebCodecs-based encoding |

## Appendix: Common Export Errors

| Error | Cause | Fix |
|---|---|---|
| `Invalid video codec 'h264'` | MediaBunny uses `'avc'` not `'h264'` | Use `'avc'` in config |
| `videoSampleSource.finalize is not a function` | `VideoSampleSource` has no public `finalize()` | Only call `output.finalize()` |
| `Finalize timed out after 120 seconds` | Race condition: Promise listeners not ready when 'done' arrives | Don't post finalize from rAF loop; let success path handle it |
| `Export failed: Config.bitrate must be provided` | Compressed audio codecs need explicit bitrate | Add `bitrate: 128000` to AudioSampleSource config |
| Blank/black first frames | Video seek + draw race; video decoder not ready | Use real-time playback with DOM-attached video elements |
