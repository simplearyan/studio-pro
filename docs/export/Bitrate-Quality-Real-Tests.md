# Bitrate Quality — Real-World Test Results

> **Date:** August 2026
> **Test project:** Animal markdown script with Pexels images, text overlays, fade/slideUp animations
> **Duration:** 30 seconds, 1920×1080, 30 fps
> **Export path:** MediaBunny (WebCodecs H.264)

---

## Test Results

### Standard (5 Mbps target)

| Metric | Value |
|---|---|
| Target bitrate | 5 Mbps (MP4: 7.5 Mbps with 1.5× multiplier) |
| Actual bitrate | **1.7 Mbps** |
| File size | 6.2 MB |
| Image quality | **Not clean** — pixelated during fade/slideUp animations |
| Text quality | Acceptable |

### Ultra (20 Mbps target)

| Metric | Value |
|---|---|
| Target bitrate | 20 Mbps (MP4: 30 Mbps with 1.5× multiplier) |
| Actual bitrate | **3.0 Mbps** |
| File size | 10.9 MB |
| Image quality | **Clean** — smooth fade/slideUp animations |
| Text quality | Clean |

---

## Analysis

### Why the huge gap between target and actual?

`videoBitsPerSecond` is a **maximum cap**, not a target. H.264's rate control allocates bits based on frame complexity:

- **Text on black background** → ~0.5-1 Mbps (very simple, highly compressible)
- **Static image** → ~2-4 Mbps (moderate complexity)
- **Image during fade animation** → ~3-6 Mbps (temporal changes need more bits)
- **Video with motion** → ~10-30 Mbps (high complexity)

For the animal markdown project:
- ~70% of frames are text on dark background (~1 Mbps each)
- ~20% are Pexels images with fade animations (~3-5 Mbps each)
- ~10% are transitions (~2-3 Mbps each)

Weighted average: **~1.7 Mbps at Standard, ~3.0 Mbps at Ultra**

### Why Ultra looks better despite "only" 3 Mbps

At Ultra (30 Mbps cap), the encoder has **headroom** to allocate more bits to complex frames:
- Image fade-in frames get ~5-6 Mbps instead of ~2-3 Mbps
- Transition frames get more bits for smooth alpha blending
- The encoder doesn't need to "rob" bits from simple frames to pay for complex ones

At Standard (7.5 Mbps cap), the encoder is **budget-constrained**:
- It must keep the average under 7.5 Mbps
- Complex image frames get fewer bits → pixelation during animation
- Simple text frames get fewer bits than they need → slight degradation

### The key insight

**For image-heavy content, the cap matters more than the average.** A 20 Mbps cap with 3 Mbps average looks better than a 7.5 Mbps cap with 1.7 Mbps average, even though both are "low bitrate" content.

---

## Preset Recommendations (Updated)

| Preset | Target (MP4) | Best For | Image Animation Quality |
|---|---|---|---|
| **Draft** | 3 Mbps | Quick preview, no images | Poor |
| **Standard** | 7.5 Mbps | Text-heavy, social media | Marginal |
| **High** | 15 Mbps | Mixed content, some images | Good |
| **Ultra** | 30 Mbps | Image-heavy, animations | Clean |
| **Custom** | User-defined | User expertise required | Varies |

### Content-based auto-recommendation

| Content Type | Recommended Preset | Reason |
|---|---|---|
| Text only | Standard (7.5 Mbps) | Text compresses well, no images |
| Text + few images | High (15 Mbps) | Images need headroom for fade animations |
| Image-heavy with animations | Ultra (30 Mbps) | Fade/slideUp need high cap for clean output |
| Video with color grade | Ultra (30 Mbps) | Video frames are complex |

---

## UI Changes Needed

1. **Show target bitrate only** — don't show "effective" or "approx size" in the bitrate label
2. **Add content guidance** — "Good for text" / "Good for images" / "Best for animations"
3. **Auto-recommend** — when project has images, highlight High or Ultra
4. **Remove approx size/duration** from bitrate label — keep it in the estimate line only

---

## Comparison with Sequence Animator Pro

| Setting | Sequence Animator Pro | StudioPro Standard | StudioPro Ultra |
|---|---|---|---|
| Codec | VP9 | H.264 | H.264 |
| Target bitrate | ~7.8 Mbps | 7.5 Mbps | 30 Mbps |
| Actual bitrate | ~7.8 Mbps | 1.7 Mbps | 3.0 Mbps |
| Image quality | Clean | Pixelated animations | Clean animations |
| File size (28s) | 27.5 MB | 6.2 MB | 10.9 MB |

Sequence Animator Pro uses VP9 which allocates bits more efficiently for this type of content. H.264 needs a higher cap to achieve the same quality.
