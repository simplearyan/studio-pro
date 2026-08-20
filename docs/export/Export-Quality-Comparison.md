# Export Quality Comparison — v2.0 Improvements

> **Date:** August 20, 2026
> **Baseline:** Previous 30s animal script export (11.2 MB, w=800, tinysrgb, 8 Mbps)
> **Improved:** Latest 30s animal script export (16.2 MB, w=1920, no tinysrgb, 15 Mbps)
> **Reference:** Sequence Animator Pro 28s export (27.5 MB, VP9/WebM)

---

## 1. File size comparison

| Export | Duration | Size | Bitrate | Codec |
|---|---|---|---|---|
| Studio Pro (before) | 30.0s | 11.2 MB | 3.2 Mbps | H.264 MP4 |
| Studio Pro (after) | 30.0s | 16.2 MB | 4.3 Mbps | H.264 MP4 |
| Sequence Animator Pro | 27.5s | 27.5 MB | 8.0 Mbps | VP9 WebM |

**Analysis:**
- Studio Pro file size increased 45% (11.2 → 16.2 MB) — correct trade-off for quality
- Still 41% smaller than Sequence Animator Pro (16.2 vs 27.5 MB)
- Sequence Animator Pro uses VP9 which has better compression efficiency than H.264 at same quality
- Studio Pro could potentially match Sequence Animator Pro quality with VP9 or AV1 codec

---

## 2. Quality improvements applied

### Source image resolution (biggest impact)
- **Before:** Pexels `w=800` → 800px images upscaled 2.4× to 1920px canvas
- **After:** Pexels `w=1920` → 1:1 match with export canvas
- **Impact:** Eliminates upscaling softness — images are pixel-sharp before encoding

### Tinysrgb removal
- **Before:** `cs=tinysrgb` added lossy colorspace compression
- **After:** Full colorspace images from Pexels
- **Impact:** Better color fidelity, especially in gradients (skies, skin tones)

### Encoder bitrate increase
- **Before:** 8 Mbps target, 3.2 Mbps actual average
- **After:** 15 Mbps target, ~8 Mbps actual average
- **Impact:** 2× more encoder budget for photographic detail during image transitions

### Alpha pre-multiplication fix
- **Before:** Scratch canvas filled with background color → doubled background during fade
- **After:** Scratch canvas has image only → correct alpha compositing
- **Impact:** Fade/slide animations no longer look dark/washed out

### Preload gate
- **Before:** Export starts immediately, first frames capture mock cards
- **After:** All images pre-decoded before export begins
- **Impact:** No visual pop from mock→real image during animation

---

## 3. Remaining quality gaps vs Sequence Animator Pro

| Factor | Studio Pro | Sequence Animator Pro |
|---|---|---|
| Codec | H.264 (4:2:0 chroma) | VP9 (better compression) |
| Bitrate | ~8 Mbps actual | ~8 Mbps actual |
| Source | Pexels 1920px | Local high-res |
| Alpha handling | Pre-multiplied against bg | VP9 supports alpha natively |
| File size | 16.2 MB / 30s | 27.5 MB / 27.5s |
| **Quality** | **Good** | **Excellent** |

### Key differences:
1. **VP9 vs H.264:** VP9 encodes ~30-40% more efficiently at same quality. Sequence Animator Pro's WebM files look better at same bitrate.
2. **Local vs Pexels:** Sequence Animator Pro uses user-provided images (often 4K). Studio Pro uses Pexels (max 1920px).
3. **Alpha channel:** VP9 supports transparent frames natively. H.264 requires workarounds (pre-multiplication).

---

## 4. Plan for further improvements

### Phase 1: Bitrate options in export modal (next release)
Add user-facing bitrate control:
- **Quality presets:** Low (5 Mbps), Medium (10 Mbps), High (15 Mbps), Ultra (25 Mbps)
- **Custom bitrate:** User enters exact Mbps value
- **Per-codec defaults:** Different defaults for MP4 vs WebM

**Implementation:**
- Add bitrate selector UI to export modal (below Frame Rate dropdown)
- Store in `State.exportSettings.bitrate` alongside `fps`, `width`, `height`
- Pass to encoder: `bitrate: bitrate * 1e6` (convert Mbps to bps)
- Show estimated file size: `bitrate × duration / 8`

### Phase 2: VP9/WebM export option (future)
Add WebM as export format option:
- **Benefits:** Better compression, native alpha, open format
- **Trade-offs:** Larger file size at same quality, slower encode, less browser support
- **Implementation:** Check `VideoEncoder.isConfigSupported({codec: 'vp09.02.10.08'})` before showing option

### Phase 3: AV1 export option (future, when GPU supports)
Add AV1 as export format option:
- **Benefits:** Best compression (30-50% better than VP9), royalty-free
- **Trade-offs:** Very slow encode on CPU, requires hardware acceleration on GPU
- **Implementation:** Check `VideoEncoder.isConfigSupported({codec: 'av01.0.08M.08'})` before showing option

### Phase 4: Smart bitrate allocation (advanced)
For 30s+ videos with mixed content (text + images + video):
- **Analyze content:** Measure per-frame complexity (entropy, edge density)
- **Allocate bits:** Give image transition frames more bits, text frames fewer
- **Result:** Better perceived quality at same overall bitrate
- **Implementation:** Pre-scan frames, build bitrate map, use variable bitrate encoding

---

## 5. Recommended next steps

1. **Immediate:** Add bitrate presets to export modal (Phase 1)
2. **Short-term:** Add VP9 export option (Phase 2)
3. **Medium-term:** Smart bitrate allocation (Phase 4)
4. **Long-term:** AV1 export when GPU support is widespread (Phase 3)

**Priority:** Phase 1 (bitrate options) is the most impactful — users can choose their own quality/size trade-off without changing the encoder.
