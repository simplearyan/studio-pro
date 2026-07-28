# MediaBunny Export: FPS & Fast Mode Explained

> **Date:** July 2026
> **Purpose:** Explain how MediaBunny's frame rate options and Fast Mode work — when to use each, how they affect quality and speed, and the technical details behind them.

---

## Table of Contents

1. [Export Overview](#1-export-overview)
2. [Frame Rate (FPS) Options](#2-frame-rate-fps-options)
3. [Fast Mode](#3-fast-mode)
4. [Normal Mode vs Fast Mode Comparison](#4-normal-mode-vs-fast-mode-comparison)
5. [Technical Deep Dive](#5-technical-deep-dive)
6. [Recommendations by Use Case](#6-recommendations-by-use-case)
7. [Quality & File Size Trade-offs](#7-quality--file-size-trade-offs)
8. [Future Improvements](#8-future-improvements)

---

## 1. Export Overview

### Three Export Pipelines

StudioPro has three fundamentally different export paths:

| Export Method | Engine | Speed | FPS Control | Audio |
|---|---|---|---|---|
| **Standard Video** | `MediaRecorder` (browser built-in) | Real-time (1x) | ❌ No (follows display refresh) | ✅ From audio graph |
| **MediaBunny** | WebCodecs via Web Worker | Real-time (1x) | ✅ Exact FPS targeting | ✅ Pre-rendered PCM |
| **Audio Only** | `MediaRecorder` | Real-time (1x) | ❌ N/A (audio only) | ✅ Full quality |

### Why MediaBunny Exists

The browser's built-in `MediaRecorder` API:

- Captures whatever the compositor renders — **no FPS control**
- Produces **variable frame rate** output (60fps display → 60fps export, regardless of content)
- No way to set a specific target frame rate
- No codec selection beyond what the browser decides

MediaBunny gives us **frame-level control** — we capture each frame manually at precise intervals, encode with explicit codec settings, and mux the final container with exact timing.

---

## 2. Frame Rate (FPS) Options

### Available Options

MediaBunny export offers these FPS presets plus a custom option:

| Option | Frames/sec | Frame interval | Best For |
|---|---|---|---|
| **12 fps** | 12 | 83.3 ms | Stop-motion, slideshow, GIF-like, archival |
| **24 fps** | 24 | 41.7 ms | Film look, cinematic content (standard film rate) |
| **30 fps** | 30 | 33.3 ms | Standard video, YouTube, social media (NTSC standard) |
| **60 fps** | 60 | 16.7 ms | Sports, gaming, smooth motion |
| **90 fps** | 90 | 11.1 ms | High-refresh content, slow-motion (playback at 30fps = 3x slow) |
| **Custom** | 1–240 | Variable | Any other rate the user specifies |

### How FPS Affects the Export

The FPS setting determines **how often we capture a frame** during the export loop:

```javascript
const timeStep = 1 / fps;        // e.g., 1/30 = 33.3ms
const totalFrames = duration / timeStep;  // e.g., 60s / 33.3ms = 1800 frames

// In the rAF loop:
const currentFrame = Math.floor(elapsed / timeStep);
if (currentFrame > lastCapturedFrame) {
    captureAndSendFrame(currentFrame);
}
```

### FPS vs Everything Else

| Aspect | 12 fps | 24 fps | 30 fps | 60 fps | 90 fps |
|---|---|---|---|---|---|
| **Export duration** | Same (real-time) | Same | Same | Same | Same |
| **File size** | Smallest | Small | Medium | Large | Largest |
| **Motion smoothness** | Choppy | Smooth | Standard | Very smooth | Extremely smooth |
| **Per-frame quality** | Highest (more bits/frame) | High | Standard | Lower (bits spread thin) | Lowest |
| **CPU/GPU load** | Lowest | Low | Medium | High | Very high |

> **Key insight:** The FPS setting does NOT affect how fast the export runs. Export speed is determined by the video playback speed (currently 1x real-time) and the GPU/encoder throughput. A 60-second video always takes at least 60 seconds regardless of FPS — you just capture more or fewer frames during those 60 seconds.

---

## 3. Fast Mode

### What Fast Mode Does

When **Fast Mode is OFF** (default, recommended for slow GPUs):

1. **GPU yield** — 33ms delay between captures gives the GPU time to finish decoding and rendering
2. **Frame acknowledgment** — Waits for the worker to confirm each frame is encoded before capturing the next one (`MAX_IN_FLIGHT = 1`)
3. **Precision timing** — Strict frame scheduling at exact intervals

When **Fast Mode is ON**:

1. **No GPU yield** — Frames are captured as fast as possible
2. **Multiple frames in flight** — Up to 3 frames can be queued in the worker simultaneously (backpressure via `MAX_IN_FLIGHT = 3`)
3. **Relaxed timing** — Frames are captured when the GPU is ready, potentially faster than the nominal frame interval
4. **Fewer consistency checks** — Skipped safety delays

### What Fast Mode Does NOT Do

Fast Mode does NOT:
- Change the target FPS (30fps export still targets 30 frames per second)
- Reduce video quality (same encoder settings)
- Change the codec or bitrate
- Skip frames (all frames are still captured and encoded)
- Produce a shorter/longer video (same duration)

### Actual Effect on Frame Rate

The actual frame rate of the exported video varies depending on Fast Mode:

| Setting | Target FPS | Typical Actual FPS | Notes |
|---|---|---|---|
| **Fast Mode OFF** | 30 | 29.7–30.0 | Precise — every frame captured on schedule |
| **Fast Mode ON** | 30 | 27–30 | Variable — some frames may be slightly late/early |
| **Fast Mode OFF** | 12 | 11.9–12.0 | Very precise |
| **Fast Mode ON** | 12 | 11–12 | Slightly variable |

The variability in Fast Mode comes from the relaxed timing — the loop runs as fast as the GPU allows, so frames land at slightly irregular intervals. Most video players handle this gracefully (VFR — Variable Frame Rate).

### Performance Impact

| GPU Tier | Fast Mode OFF | Fast Mode ON |
|---|---|---|
| **Low-end** (GT 740, Intel HD) | Safe, no crashes, ~5 fps actual throughput | Risky, may cause GPU timeout if GPU can't keep up |
| **Mid-range** (GTX 1060, RX 580) | Comfortable, ~15 fps actual throughput | ~27–30 fps actual throughput — **recommended** |
| **High-end** (RTX 30+, RX 6000+) | Overkill, ~20 fps actual throughput | ~28–30 fps — full speed |

> **Actual throughput** refers to how many frames per second the GPU can capture and encode, NOT the target FPS. A GT 740 may only produce 5 fps of capture throughput even at 30fps target — meaning the export runs slower than real-time in terms of capture, but the output is still 30fps (frames are just captured close to their target timestamps thanks to the precision scheduler).

---

## 4. Normal Mode vs Fast Mode Comparison

### Side-by-Side

| Aspect | Normal Mode (Fast OFF) | Fast Mode (Fast ON) |
|---|---|---|
| **GPU safety** | ✅ Maximum safety — yields between frames | ⚠️ Minimal safety — GPU may saturate on low-end |
| **Frame accuracy** | ✅ Precise — each frame at exact timestamp | 🔄 Variable — frames slightly early/late |
| **Export throughput** | Lower (more waiting) | Higher (less waiting) |
| **File compatibility** | ✅ CFR (Constant Frame Rate) | 🔄 VFR (Variable Frame Rate) — most players handle fine |
| **PC usability during export** | ✅ Good — yields free up CPU/GPU | ⚠️ Can lag — GPU is fully utilized |
| **Best for** | Low-end GPUs, precise frame accuracy | Mid/high-end GPUs, faster throughput |

### When to Use Each

```
┌─────────────────────────────────────────────────────────┐
│               Which Mode Should I Use?                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Is your GPU low-end (GT 740, Intel HD)?                  │
│  ├── YES → Use Normal Mode (Fast OFF)                     │
│  │        You'll get exact FPS with safe GPU operation    │
│  │                                                        │
│  └── NO  → Ask: Do I need perfectly precise timestamps?   │
│           ├── YES → Use Normal Mode (Fast OFF)            │
│           │        Frame-accurate output                  │
│           │                                                │
│           └── NO  → Use Fast Mode (Fast ON)               │
│                    Faster, good enough for most uses      │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Technical Deep Dive

### The Precision Frame Scheduler

The export loop uses a **next-capture-time** approach rather than simple `Math.floor()`:

```javascript
let nextCaptureTime = 0;  // ms since export start

function realtimeExportLoop(now) {
    if (!exportStartWallTime) exportStartWallTime = now;
    const elapsed = now - exportStartWallTime;  // ms
    
    // Check if it's time to capture the next frame
    if (elapsed >= nextCaptureTime) {
        const frameIndex = Math.floor(nextCaptureTime * fps / 1000);
        
        // ... capture and send frame ...
        
        // Schedule next capture at exact frame boundary
        nextCaptureTime = (frameIndex + 1) * (1000 / fps);
    }
    
    if (elapsed < exportDuration * 1000) {
        requestAnimationFrame(realtimeExportLoop);
    }
}
```

This ensures that frame N is ALWAYS targeted at exactly `N * (1000/fps)` milliseconds from the start, regardless of how long the actual capture or encoding took. If the GPU is slow and misses the target, the next frame is still scheduled at the correct boundary — preventing frame drift.

### Normal Mode Flow

```
Time (ms)   0     33     66     100    133    166    200
Target      ├F1────┼F2────┼F3────┼F4────┼F5────┼F6────┼F7──
            │      │      │      │      │      │      │
GPU work    ├draw1>├yield>├draw2>├yield>├draw3>├yield>├draw4>
            │      │33ms  │      │33ms  │      │33ms  │
Worker      │enc1  │      │enc2  │      │enc3  │      │enc4
Ack         │◄─────┤      │◄─────┤      │◄─────┤      │◄────
            │      │      │      │      │      │      │
Actual      F1    F1     F2    F2     F3    F3     F4
capture           ▲wait           ▲wait           ▲wait
```

- Each frame capture is followed by a 33ms yield
- The worker must acknowledge each frame before the next capture
- Target timestamps align perfectly with frame boundaries

### Fast Mode Flow

```
Time (ms)   0     33     66     100    133    166    200
Target      ├F1────┼F2────┼F3────┼F4────┼F5────┼F6────┼F7──
            │      │      │      │      │      │      │
GPU work    ├draw1>├draw2>├draw3>├draw4>├draw5>├draw6>├draw7>
Worker      │enc1  │enc2  │enc1> │enc2> │enc3  │enc4  │
In-flight   │[1]   │[2]   │[1]   │[2]   │[3]   │[2]   │[3]
            │      │      │      │      │      │      │
Actual      F1    F2    F1done F2done F3    F4    F5
capture                 ▲ack   ▲ack
```

- No yield between captures — GPU works continuously
- Up to 3 frames in the worker pipeline
- Frames may cluster near boundaries but always target the correct timestamp

### Frame Rate vs Actual Throughput

It's important to distinguish between:

- **Target FPS**: What you set in the export dialog (e.g., 30 fps)
- **Capture throughput**: How fast the GPU can produce frames (varies by GPU and effects)
- **Output FPS**: What the final video file reports (should match target FPS)

If target FPS is 30 but the GPU can only produce 15 frames per second of capture throughput, the export loop still schedules 30 frame slots per second. But some slots may be missed because the GPU is still working on the previous frame. The result is a variable-frame-rate output that averages close to the target.

**Fast Mode** reduces the timing overhead, allowing higher capture throughput at the cost of some frame timing jitter.

---

## 6. Recommendations by Use Case

### YouTube / Social Media Upload

| Setting | Recommendation | Why |
|---|---|---|
| Format | **MediaBunny MP4** | H.264 is the most compatible codec for upload platforms |
| Resolution | **1080p** | Best quality-to-file-size ratio |
| FPS | **30 fps** | Standard for most content; 60fps if gaming/sports |
| Fast Mode | **ON** | High-quality output, no need for frame-perfect accuracy |

### Cinematic / Film Look

| Setting | Recommendation | Why |
|---|---|---|
| Format | **MediaBunny MP4** or **WebM** | MP4 for sharing, WebM for smaller files |
| Resolution | **1080p** or **1440p** | Higher resolution for cinema-grade |
| FPS | **24 fps** | The standard film frame rate |
| Fast Mode | **OFF** | Frame accuracy matters for film |

### Archive / Storage

| Setting | Recommendation | Why |
|---|---|---|
| Format | **MediaBunny WebM** | VP9 gives smaller files at same quality |
| Resolution | **1080p** | Standard archival resolution |
| FPS | **12 fps** or **24 fps** | Low FPS saves space; 12fps for slideshow-like content |
| Fast Mode | **OFF** | Precision matters less; save power |

### Slow Motion

| Setting | Recommendation | Why |
|---|---|---|
| Format | **MediaBunny MP4** | H.264 is most compatible |
| Resolution | **1080p** | Balance quality and file size |
| FPS | **60 fps** or **90 fps** | High frame rate = smooth slow-mo when played back at 30fps/24fps |
| Fast Mode | **ON** | High FPS already stresses the GPU; Fast Mode helps throughput |

### Low-End PC (GT 740, Intel HD)

| Setting | Recommendation | Why |
|---|---|---|
| Format | **MediaBunny MP4** | H.264 requires less GPU than VP9 |
| Resolution | **1080p** or **720p** | Lower resolution = less GPU work |
| FPS | **24 fps** or **30 fps** | Lower FPS = fewer frames to encode |
| Fast Mode | **OFF** | Critical for GPU stability — prevents BSOD |

---

## 7. Quality & File Size Trade-offs

### FPS vs File Size (estimate for 60-second 1080p video)

| FPS | MP4 Size (H.264) | WebM Size (VP9) | Notes |
|---|---|---|---|
| 12 fps | ~15 MB | ~10 MB | Low motion, slideshow |
| 24 fps | ~25 MB | ~18 MB | Film look, moderate motion |
| 30 fps | ~30 MB | ~22 MB | Standard video |
| 60 fps | ~55 MB | ~40 MB | Smooth motion, gaming |
| 90 fps | ~75 MB | ~55 MB | High-refresh, slow-motion capable |

> **File size** depends more on content complexity, bitrate, and motion than on FPS alone. These are rough estimates for 5 Mbps H.264 / 3.5 Mbps VP9 with moderate motion.

### Why Higher FPS Doesn't Always Mean Better Quality

At a fixed bitrate, higher FPS means **fewer bits per frame**. A 30fps video at 5 Mbps allocates ~167 Kb per frame. A 60fps video at the same bitrate allocates only ~83 Kb per frame — half the data. This can introduce visible compression artifacts in fast-moving scenes.

**Rule of thumb:** If you need high FPS (60+), increase the bitrate proportionally to maintain per-frame quality.

---

## 8. Future Improvements

### 1. Frame Blending for Low FPS

When exporting at 12fps or 24fps, blend consecutive frames rather than dropping them:
```
Input:  60fps ─┬─ F1 F2 F3 F4 F5 ... ─┐
                │                       │
Output: 12fps ─┴── F1   F5   F9   ... ─┘  (blend F1-F5 into one frame)
```

This produces smoother motion at low FPS but requires more GPU work.

### 2. Adaptive Bitrate Per Frame

Allocate more bits to frames with high motion (scene changes, action) and fewer bits to static frames:
```javascript
const motionLevel = detectMotion(currentFrame, previousFrame);
const frameBitrate = baseBitrate * (1 + motionLevel * 0.5);
```

### 3. Fast Mode for Low-End GPUs

A "Safe Fast Mode" that dynamically adjusts the yield between frames based on GPU temperature/delay:
```javascript
if (lastCaptureTime > 50) {  // GPU taking too long → add yield
    await sleep(50);
}
```

### 4. Variable FPS Export

Export at variable frame rate (like Fast Mode produces) but metadata-mark it as CFR for compatibility. Useful for content with mixed motion (talking head + action scenes).

---

## Appendix: Key Code Sections

```javascript
// Precision frame scheduling (in realtimeExportLoop)
const timeStep = 1 / fps;
const nextCaptureTime = (targetFrame) => targetFrame * timeStep * 1000;

// Normal Mode: GPU yield + frame acknowledgment
if (!fastMode) {
    await new Promise(r => setTimeout(r, 33));  // GPU yield
    await waitForFrameAck(frameIndex);           // Backpressure
}

// Fast Mode: minimal delays
if (fastMode) {
    // Check in-flight limit only
    if (framesInFlight < MAX_IN_FLIGHT) {
        framesInFlight++;
        worker.postMessage({ type: 'frame', ... });
    }
}
```

---

*For more details on the overall export architecture, see [MediaBunny-Export-Architecture.md](./MediaBunny-Export-Architecture.md) and [MediaBunny-Export-Journey.md](./MediaBunny-Export-Journey.md).*
