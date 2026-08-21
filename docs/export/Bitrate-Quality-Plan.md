# Bitrate Quality Plan — Clean Image Transitions & Animations

> **Date:** August 2026
> **Status:** Plan
> **Scope:** `index.html` export modal + MediaBunny worker + captureStream MediaRecorder
> **Goal:** Let users control bitrate for both export backends to get clean image transitions, smooth animations, and small file sizes

---

## 1. Problem

### Current bitrate settings

| Export Path | Current Bitrate | Issue |
|---|---|---|
| **MediaBunny (WebCodecs)** | 5 Mbps fixed | Image transitions look blurry at 1080p — especially fade-in/slideUp animations with Pexels images |
| **Std captureStream (MediaRecorder)** | Chrome default (~2.5 Mbps) | Even worse — animations look pixelated, especially fade/slideUp on imported images |
| **GIF** | Chrome default | Low quality GIF output |

### Why bitrate matters for image animations

- **Fade-in:** canvas alpha goes 0→1 over ~10 frames. Low bitrate means the encoder allocates fewer bits to these semi-transparent frames → visible banding/pixelation
- **SlideUp:** image moves across the canvas. Low bitrate means the encoder can't capture the motion cleanly → ghosting/artifacts
- **Image-heavy clips:** Pexels images are 1920×1080 but the encoder compresses them aggressively at low bitrate → blurry during transitions

### Reference: Sequence Animator Pro

| Setting | Value |
|---|---|
| Format | WebM (VP9) |
| Bitrate | ~27.5 MB for 28s = **~7.8 Mbps** |
| Quality | Clean animations, no pixelation |

StudioPro at 5 Mbps produces 16.3 MB for 30s (~4.3 Mbps effective) — **45% lower bitrate** than Sequence Animator Pro.

---

## 2. Proposed Bitrate Presets

### 2.1 Preset definitions

| Preset | Label | Bitrate | Use Case | File Size (30s 1080p) |
|---|---|---|---|---|
| **draft** | Draft (Fast) | 2 Mbps | Quick preview, social drafts | ~7.5 MB |
| **standard** | Standard | 5 Mbps | Default, balanced quality/size | ~18.75 MB |
| **high** | High Quality | 10 Mbps | Clean animations, image transitions | ~37.5 MB |
| **ultra** | Ultra (Max) | 20 Mbps | Broadcast quality, no compromise | ~75 MB |

### 2.2 Per-format recommendations

| Format | Recommended Preset | Reason |
|---|---|---|
| MP4 (H.264) | **high** (10 Mbps) | H.264 needs more bitrate for same quality as VP9 |
| WebM (VP9) | **standard** (5 Mbps) | VP9 is more efficient — 5 Mbps ≈ H.264 10 Mbps |
| GIF | N/A | GIF is palette-based, bitrate doesn't apply |
| MediaBunny MP4 | **high** (10 Mbps) | WebCodecs can handle high bitrate without freezing |
| MediaBunny WebM | **standard** (5 Mbps) | VP9 efficiency |

### 2.3 Image animation boost

When the project contains **imported images** (non-markdown, user-uploaded), auto-recommend **high** or **ultra** preset because:

- Image fade-in/slideUp needs more bits for smooth alpha transitions
- Pexels images are high-res — low bitrate makes them look blurry during animation
- The encoder allocates bits per-frame — more bits = cleaner motion

---

## 3. UI Design

### 3.1 Export modal — bitrate row

Add a **Quality** row inside each export tab's options box:

```
┌─────────────────────────────────────┐
│  Resolution   [1080p ▼]            │
│  Frame Rate   [30 fps ▼]           │
│  Quality      [Standard ▼]  ← NEW  │
│  Duration     [Custom ▼]           │
└─────────────────────────────────────┘
```

- Dropdown: Draft | Standard | High Quality | Ultra
- Default: **Standard** (5 Mbps)
- When user has imported images → show badge "Recommended: High Quality"
- Show estimated file size next to dropdown: "~18 MB"

### 3.2 Estimated file size preview

As user changes quality preset, update a live estimate:

```
Quality: [High Quality ▼]  ≈ 37 MB
```

Formula: `bitrate × duration_seconds / 8 / 1024 / 1024` (MB)

### 3.3 Preset badge on Settings gear

When user has set a non-default quality, show a small badge on the quality selector.

---

## 4. Implementation

### 4.1 MediaBunny (WebCodecs) path

**File:** `index.html` — MediaBunny export functions

Current code:
```javascript
worker.postMessage({
    type: 'start',
    config: {
        width: exportW, height: exportH, fps,
        bitrate: format === 'mp4' ? 15e6 : 8e6,
        format, hasAudio: audioBuffer !== null
    }
});
```

Change to:
```javascript
const bitrateMap = { draft: 2e6, standard: 5e6, high: 10e6, ultra: 20e6 };
const bitrate = bitrateMap[State.exportQuality || 'standard'] || 5e6;

worker.postMessage({
    type: 'start',
    config: {
        width: exportW, height: exportH, fps,
        bitrate: format === 'mp4' ? bitrate * 1.5 : bitrate,
        format, hasAudio: audioBuffer !== null
    }
});
```

Note: MP4 gets 1.5× bitrate because H.264 is less efficient than VP9.

### 4.2 captureStream (MediaRecorder) path

**File:** `index.html` — `new MediaRecorder` options

Current code:
```javascript
const recorder = new MediaRecorder(finalStream, { mimeType: mimeType });
```

Change to:
```javascript
const bitrateMap = { draft: 2e6, standard: 5e6, high: 10e6, ultra: 20e6 };
const bitrate = bitrateMap[State.exportQuality || 'standard'] || 5e6;
const recorder = new MediaRecorder(finalStream, {
    mimeType: mimeType,
    videoBitsPerSecond: bitrate
});
```

### 4.3 State + localStorage

```javascript
State.exportQuality = localStorage.getItem('studiopro_exportQuality') || 'standard';
```

Persist on change:
```javascript
function setExportQuality(preset) {
    State.exportQuality = preset;
    localStorage.setItem('studiopro_exportQuality', preset);
    updateExportEstimate();
}
```

### 4.4 Auto-recommend for image-heavy projects

```javascript
function hasImportedImages() {
    return clips.some(c => c.type === 'image' && !c.src?.startsWith('http'));
}

// In export modal open:
if (hasImportedImages() && State.exportQuality === 'standard') {
    showQualityBadge('Recommended: High Quality for smooth image animations');
}
```

---

## 5. Testing Matrix

| Test | Expected |
|---|---|
| 30s markdown clip at Draft (2 Mbps) | ~7 MB, fast export, acceptable quality |
| 30s markdown clip at Standard (5 Mbps) | ~19 MB, balanced |
| 30s markdown clip at High (10 Mbps) | ~37 MB, clean fade/slideUp animations |
| 30s imported image clip at High (10 Mbps) | ~37 MB, no pixelation during fade-in |
| 30s video clip with color grade at Ultra (20 Mbps) | ~75 MB, clean color transitions |
| GIF export | Bitrate dropdown disabled, GIF quality = palette size |
| File size estimate matches actual | Within 15% |

---

## 6. GT 740 Considerations

- **MediaBunny at 20 Mbps:** WebCodecs encoding is GPU-agnostic (runs on CPU). The GT 740 handles 20 Mbps fine — the bottleneck is decode, not encode
- **captureStream at 20 Mbps:** MediaRecorder encoding is also CPU-based. No GPU impact
- **Auto-recommend:** For projects with imported images + color grade, recommend **High** (10 Mbps) — enough for clean animations without bloat
- **Ultra (20 Mbps):** Only for final delivery. Warn user about file size (~75 MB for 30s)

---

## 7. File Size Reference

| Source | Duration | Size | Effective Bitrate |
|---|---|---|---|
| Sequence Animator Pro (WebM VP9) | 28s | 27.5 MB | ~7.8 Mbps |
| StudioPro current (MP4 H.264) | 30s | 16.3 MB | ~4.3 Mbps |
| StudioPro proposed High (MP4) | 30s | ~37 MB | ~10 Mbps |
| StudioPro proposed Standard (WebM VP9) | 30s | ~19 MB | ~5 Mbps |

---

## 8. Acceptance Criteria

- [ ] Quality dropdown in both Std and MediaBunny export tabs
- [ ] Bitrate applied to MediaRecorder (videoBitsPerSecond) and WebCodecs (worker config)
- [ ] Estimated file size shown next to dropdown
- [ ] Quality preference persisted in localStorage
- [ ] Auto-recommend "High Quality" when project has imported images
- [ ] GIF export disables bitrate dropdown (palette-based, not bitrate-based)
- [ ] 30s image animation export at High quality shows clean fade-in/slideUp (no pixelation)
- [ ] File size estimate within 15% of actual output
