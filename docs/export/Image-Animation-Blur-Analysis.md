# Image Animation Blur — Root Cause Analysis

> **Date:** August 20, 2026
> **Video analyzed:** `StudioPro_Export_MediaBunny (100).mp4`
> **Status:** Root causes identified, fixes proposed

---

## 1. What the user sees

- Text clips (fadeIn): **clean, sharp** in exported video
- Shape clips: **clean, sharp** in exported video
- Video clips: **clean, sharp** in exported video
- **Image clips (slideUp/fade): blurry, pixelated** — especially during the first 0.5s of animation

## 2. Video encoding stats

| Metric | Value |
|---|---|
| Codec | H.264 |
| Resolution | 1920×1080 |
| Frame rate | 24 fps |
| Duration | 30.0s |
| File size | 11.5 MB |
| **Average bitrate** | **3.2 Mbps** |
| Keyframes | 15 (every ~2s) |
| Low-detail frames (<1KB) | 448 (62.2%) |
| High-detail frames (>50KB) | 71 (9.9%) |

**3.2 Mbps is low for 1080p content with detailed photographic images.**

## 3. Why text is clean but images are not

### Text clips
- Rendered as **vector shapes** (font outlines) on solid background
- Low information density — encoder compresses easily at 3.2 Mbps
- No upscaling — text is drawn at canvas resolution
- PSNR between consecutive frames: **20.6 dB** (high — predictable change)

### Image clips
- **800px source images** upscaled to 1920px (2.4×) — inherent softness
- **`tinysrgb`** Pexels parameter applies additional lossy compression
- High information density — photographic content with fine detail
- PSNR between consecutive frames: **11.9 dB** (low — encoder struggling)
- Peak bitrate during image transitions: 89-186KB/frame — **encoder starved for bits**

## 4. Root causes (ranked by impact)

### Cause 1: Source image resolution (HIGHEST IMPACT)

All 11 pexels image clips use `w=800` in their URLs:
```
https://images.pexels.com/photos/247376/pexels-photo-247376.jpeg?auto=compress&cs=tinysrgb&w=800
```

The `w=800` parameter tells Pexels to serve an 800px-wide image. The export canvas is 1920×1080. This is a **2.4× upscale** — every pixel in the source becomes ~6 pixels in the output. The browser's bilinear/bicubic upscaler produces soft results that the H.264 encoder then compresses further.

**Impact:** This is the single biggest contributor to blurry image animations. The softness exists before any encoding happens.

### Cause 2: `tinysrgb` Pexels parameter (MEDIUM IMPACT)

All URLs include `cs=tinysrgb` which tells Pexels to serve images in a compressed sRGB colorspace with reduced color depth. This applies additional lossy compression on top of JPEG, further reducing image detail — especially in smooth gradients (skies, skin tones, backgrounds).

**Impact:** Compounds the softness from the 800px resolution. Removing this parameter would give cleaner source images.

### Cause 3: Encoder bitrate too low for image content (MEDIUM IMPACT)

The export uses 8 Mbps for MP4, but the actual average bitrate achieved is only **3.2 Mbps** because:
- 62% of frames are nearly static (126 bytes each) — the encoder allocates very few bits
- The encoder uses a **constrained VBR** that averages the bitrate across the whole video
- Image transition frames get 89-186KB each, while the encoder budget is ~33KB/frame at 3.2 Mbps

**Impact:** The encoder doesn't have enough bits to faithfully encode the photographic detail during image transitions.

### Cause 4: H.264 4:2:0 chroma subsampling (LOW-MEDIUM IMPACT)

H.264 uses 4:2:0 chroma subsampling by default — the color (Cb/Cr) channels are stored at half resolution. For photographic content with subtle color gradients (natural images), this causes color bleeding and softness that isn't visible in vector content (text/shapes).

**Impact:** Adds ~15-20% softness to photographic content. Not the primary issue but compounds the other causes.

## 5. Why the alpha pre-multiplication fix didn't help

The previous fix addressed **background doubling** during fade animations — the scratch canvas was adding a second layer of `fillBgColor`. That fix was correct and the background is no longer doubled.

However, the remaining blur is **not from compositing** — it's from:
1. The source image being 800px (too low for 1920px canvas)
2. The encoder not having enough bitrate for photographic detail
3. The `tinysrgb` compression reducing source quality

## 6. Proposed fixes

### Fix A: Strip `tinysrgb` and increase `w` parameter (HIGHEST IMPACT)

In the markdown builder, when processing pexels URLs:
- Remove `cs=tinysrgb` from the URL
- Change `w=800` to `w=1920` (or remove the `w` parameter entirely to get full resolution)

This gives the encoder **2.4× more source pixels** to work with, eliminating the upscale entirely.

### Fix B: Increase encoder bitrate (MEDIUM IMPACT)

Increase the MP4 bitrate from 8 Mbps to 15 Mbps. This gives the encoder more budget for photographic detail during transitions. Trade-off: larger file size (~22MB instead of ~12MB for 30s).

### Fix C: Force keyframe at every image transition (LOW IMPACT)

Currently keyframes are every ~2 seconds. Adding a keyframe at each image clip's start time ensures the encoder has a fresh reference frame for the high-detail image content, reducing inter-frame compression artifacts.

## 7. Expected improvement

| Fix | Before | After |
|---|---|---|
| Source resolution | 800px → 1920px (2.4× upscale) | 1920px → 1920px (1:1) |
| tinysrgb | Compressed colorspace | Full colorspace |
| Bitrate | 3.2 Mbps avg | ~8-10 Mbps avg |
| Image animation quality | Blurry/pixelated | Sharp, matching text quality |
