# Next Steps Plan — Studio Pro Automation

> **Date:** August 2026
> **Status:** M0-M5 Complete, planning next phase

---

## Current Status

### Completed Milestones

| Milestone | Status | Commits |
|---|---|---|
| **M0 — Deterministic core** | ✅ Done | Seeded shake, quantizeTimeToFrame, parity harness |
| **M1 — FTRT export** | ✅ Done | Frame-index loop, video frame pool, GPU crash fixes |
| **M2 — Templates** | ✅ Done | Template engine, gallery, editor, share, script skeletons |
| **M3 — .spcomp format** | ✅ Done | Export/import, schema, round-trip safe |
| **M4 — Agent loop** | ✅ Done | Markdown ↔ .spcomp bridge, AGENTS.md |
| **M5 — AI panel** | ✅ Done | BYO-key prompt → Markdown → timeline |

### Recent Work (this session)

| Feature | Status |
|---|---|
| captureStream fix (video-only, offscreen canvas) | ✅ Done |
| Bitrate presets (Draft/Standard/High/Ultra/Custom) | ✅ Done |
| Content-aware size estimate | ✅ Done |
| Export success bitrate display | ✅ Done |
| Quality UI redesign (selected state, synced layout) | ✅ Done |

---

## Next Steps (Priority Order)

### 1. Push + Tag Release (Immediate)

**What:** Push 13 commits and tag v0.3.0-beta

**Why:** All M0-M5 milestones are complete. Users need the new features.

**Actions:**
- `git push origin main`
- `git tag v0.3.0-beta`
- `git push origin v0.3.0-beta`

---

### 2. M6 — Parallel + Headless Render (Optional, 2-4 weeks)

**What:** OffscreenCanvas worker chunks + CLI render

**Why:** Scales with CPU cores; enables CI/server renders

**Actions:**
- OffscreenCanvas render worker
- Chunked timeline processing
- Headless render page (loads .spcomp, renders without GUI)
- CLI wrapper: `studio-pro render file.spcomp`

**Benefit:** Batch processing, CI/CD integration, server-side rendering

---

### 3. Video Tab Consolidation (1-2 days)

**What:** Video tab and MediaBunny tab both route to WebCodecs now

**Why:** Confusing for users — two tabs doing the same thing

**Options:**
- **Option A:** Remove Video tab, keep only MediaBunny + Fast + Audio
- **Option B:** Rename Video tab to "Standard" and keep as fallback
- **Option C:** Merge Video into MediaBunny, add format selector

**Recommendation:** Option A — clean up the UI

---

### 4. Image Animation Quality (1-2 weeks)

**What:** Improve fade/slideUp animation quality for images

**Why:** Images still show pixelation during fade animations at lower bitrates

**Root cause:** Alpha compositing creates complex frames that need more bits

**Solutions:**
- Increase content multiplier for images (0.35 → 0.5)
- Add "Animation Quality" toggle that uses higher bitrate for animated clips
- Pre-render image animations to video frames before encoding

---

### 5. Audio in captureStream Export (1 week)

**What:** Add audio support to the Std tab export

**Why:** Currently video-only; users expect audio in exports

**Challenge:** MediaStreamAudioDestinationNode produces silent tracks when no audio is playing

**Solution:**
- Start audio elements before export loop
- Create fresh MediaStreamAudioDestinationNode
- Route audio through it
- Mix only when audio is actually playing

---

### 6. .spcomp Standalone Player (1 week)

**What:** Load .spcomp in a standalone page and render

**Why:** Enables headless rendering, testing, and sharing

**Actions:**
- Create `player.html` that loads .spcomp
- Implement `seek(composition, t)` contract
- Add render loop (requestAnimationFrame or setTimeout)
- Export to video (WebCodecs or MediaRecorder)

---

### 7. Skills Documentation (2-3 days)

**What:** Document agent workflows for common video types

**Why:** Agents need examples to generate good scripts

**Actions:**
- Product launch skill
- Explainer video skill
- Social media shorts skill
- Tutorial/walkthrough skill
- Each skill = markdown template + system prompt + examples

---

### 8. Export Quality Presets (1 week)

**What:** Pre-configured export settings for common use cases

**Why:** Users don't know what bitrate/resolution/fps to choose

**Presets:**
- **Social Media** — 1080p, 30fps, 5 Mbps, MP4
- **YouTube** — 1080p, 30fps, 10 Mbps, MP4
- **Archive** — 1080p, 30fps, 20 Mbps, MP4
- **Draft** — 720p, 24fps, 2 Mbps, WebM
- **Custom** — User-defined

---

### 9. Project Versioning (2-3 days)

**What:** Semantic versioning for .spcomp files

**Why:** Backward compatibility as schema evolves

**Actions:**
- Add `spcomp: 2` schema version
- Migration path from v1 → v2
- Deprecation warnings for old formats

---

### 10. Testing + Documentation (1-2 weeks)

**What:** Comprehensive tests and user documentation

**Why:** Quality assurance and user adoption

**Actions:**
- Unit tests for exportSpcomp/importSpcomp
- Integration tests for markdown → .spcomp → render
- User guide for AI panel
- Agent guide for programmatic video creation
- API reference for .spcomp schema

---

## Recommended Sequence

```
Immediate:  Push + tag v0.3.0-beta
Week 1:     Video tab consolidation + audio in captureStream
Week 2-3:   Image animation quality fix
Week 4:     .spcomp standalone player
Week 5:     Skills documentation
Week 6:     Export quality presets
Week 7:     M6 (parallel + headless) — if needed
Week 8:     Testing + documentation
```

---

## What NOT to Do

1. **Don't chase DOM capture** — keep owning the rasterizer
2. **Don't make AI backend mandatory** — BYO-key or file-based only
3. **Don't require Node/build step** — single-file browser app
4. **Don't clobber user styling on template apply** — override-aware mirror
5. **Don't let AI produce un-ownable output** — everything is editable clips

---

## Success Metrics

| Metric | Current | Target |
|---|---|---|
| Export speed (30s text) | ~30s (1×) | ~10s (3×) |
| Export speed (30s video) | ~30s (1×) | ~15s (2×) |
| Image animation quality | Pixelated at Standard | Clean at High |
| AI panel generation time | ~5s | ~3s |
| .spcomp round-trip | ✅ Pass | ✅ Pass |
| Agent authoring workflow | Manual | Automated |
