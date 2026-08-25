# Data-Animate Integration Plan — HyperFrames Agent Ergonomics for StudioPro

## Goal

Let AI agents (and humans) write HTML clips using simple attributes instead of JavaScript:

```html
<!-- BEFORE (current — agent writes 50+ lines of JavaScript): -->
<div id="title">Hello</div>
<div id="bar" style="width: 0%"></div>
<script>
function animate(t) {
    document.getElementById('title').style.opacity = Math.min(1, t / 0.5);
    document.getElementById('title').style.transform = `translateY(${40 - t * 80}px)`;
    document.getElementById('bar').style.width = Math.min(80, Math.max(0, (t - 0.5) * 40)) + '%';
    // ... more lines
}
</script>

<!-- AFTER (HyperFrames style — agent writes 3 lines): -->
<h1 data-animate="fade-in" data-delay="0.2s">Hello</h1>
<div class="bar" data-animate="grow-right" data-delay="0.5s" style="width: 80%"></div>
```

**Both formats must work.** Old `animate(t)` clips keep working. New `data-animate` clips are easier to write.

---

## Feasibility Analysis

### Integration Point 1: iframe Creation (Line 6341)

**Current:**
```javascript
doc.write(`<!DOCTYPE html><html><head>...${fontLinks}<style>...${safeCss}</style></head>
<body>${clip.html || ''}${clip.js ? '<script>' + clip.js + '<\\/script>' : ''}</body></html>`);
```

**New (add adapter script):**
```javascript
// Inject data-animate adapter (auto-converts attributes to CSS animations)
const adapterScript = `<script>
${/* inline the adapter code here — ~30 lines */''}
window.initDataAnimate && window.initDataAnimate();
<\\/script>`;

doc.write(`<!DOCTYPE html><html><head>...${fontLinks}<style>...${safeCss}</style></head>
<body>${adapterScript}${clip.html || ''}${clip.js ? '<script>' + clip.js + '<\\/script>' : ''}</body></html>`);
```

**Feasibility:** ✅ **Trivial** — just add one script block to the iframe content.

### Integration Point 2: WAAPI Seek (Before html2canvas)

**Current:**
```javascript
// html2canvas captures whatever state the iframe is in
const capturePromise = html2canvas(clip._htmlIframe.contentDocument.body, {...});
```

**New (seek animations first):**
```javascript
// 1. Seek WAAPI animations to current frame
if (clip._htmlIframe && clip._htmlIframe.contentWindow) {
    const clipTime = State.currentTime - clip.start;
    const frame = Math.round(clipTime * (State.exportFps || 30));
    try {
        clip._htmlIframe.contentWindow.seekToFrame(frame, State.exportFps || 30);
    } catch(e) {}
}

// 2. THEN capture with html2canvas
const capturePromise = html2canvas(clip._htmlIframe.contentDocument.body, {...});
```

**Feasibility:** ✅ **Easy** — add 5 lines before the html2canvas call.

### Integration Point 3: Default Templates (addHtmlClipToTimeline)

**Current:**
```javascript
const defaultHtml = `<div class="gradient-card">
  <h1>Title Here</h1>
  <p>Subtitle text</p>
</div>`;
// No animation — static
```

**New (add data-animate to templates):**
```javascript
const defaultHtml = `<div class="gradient-card">
  <h1 data-animate="fade-in" data-delay="0.2s">Title Here</h1>
  <p data-animate="slide-up" data-delay="0.4s">Subtitle text</p>
</div>`;
// Animated — agent just adds data-animate attributes
```

**Feasibility:** ✅ **Trivial** — just add attributes to existing templates.

### Integration Point 4: Sidebar Templates (_applyHtmlTemplate)

**Current templates** (Gradient, Glass, Minimal, Chart, etc.) are static. Update them to include `data-animate`:

```javascript
// Example: Updated gradient card template
gradientCard: {
    html: `<div class="gradient-card">
  <h1 data-animate="fade-in" data-delay="0.2s">Title Here</h1>
  <p data-animate="slide-up" data-delay="0.4s">Subtitle text</p>
</div>`,
    css: `...`, // same as before
    js: '' // No JavaScript needed!
}
```

**Feasibility:** ✅ **Easy** — update template strings.

### Integration Point 5: Agent Documentation (skills/AGENTS.md)

Tell agents they can now write:

```html
<!-- Option A: data-animate (NEW — easy) -->
<h1 data-animate="fade-in" data-delay="0.2s">Title</h1>
<div class="bar" data-animate="grow-right" data-delay="0.5s"></div>

<!-- Option B: CSS keyframes (intermediate) -->
<style>@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }</style>
<h1 style="animation: fadeIn 0.5s forwards">Title</h1>

<!-- Option C: animate(t) (ADVANCED — still works) -->
<script>function animate(t) { ... }</script>
```

**Feasibility:** ✅ **Documentation only.**

---

## Supported Animations

| Animation | Attribute | Effect |
|---|---|---|
| Fade in | `data-animate="fade-in"` | Opacity 0→1 |
| Fade out | `data-animate="fade-out"` | Opacity 1→0 |
| Slide up | `data-animate="slide-up"` | From below, fade in |
| Slide down | `data-animate="slide-down"` | From above, fade in |
| Slide left | `data-animate="slide-left"` | From right, fade in |
| Slide right | `data-animate="slide-right"` | From left, fade in |
| Scale up | `data-animate="scale-up"` | Grow from small |
| Scale down | `data-animate="scale-down"` | Shrink from large |
| Grow right | `data-animate="grow-right"` | Width 0→target |
| Grow left | `data-animate="grow-left"` | Width 0→target (right-aligned) |
| Rotate in | `data-animate="rotate-in"` | Rotate + fade |
| Bounce in | `data-animate="bounce-in"` | Scale bounce |

**Attributes:**
- `data-animate` — animation type (required)
- `data-delay` — delay before start (default: "0s")
- `data-duration` — animation length (default: "0.5s")
- `data-easing` — CSS easing (default: "ease-out")

---

## Backward Compatibility

| Scenario | Works? | How |
|---|---|---|
| Old clip with `animate(t)` | ✅ Yes | adapter doesn't interfere — `animate(t)` runs via `<script>` tag |
| Old clip with no JS | ✅ Yes | Static — no animation, just HTML/CSS |
| New clip with `data-animate` | ✅ Yes | adapter converts attributes to WAAPI animations |
| New clip with both `data-animate` AND `animate(t)` | ✅ Yes | Both run — WAAPI handles data-animate, animate(t) runs separately |

**The adapter is purely additive.** It reads `data-animate` attributes and creates WAAPI animations. If no `data-animate` attributes exist, it does nothing.

---

## Implementation Phases

### Phase 1: Inline Adapter (1 day)

Add the data-animate adapter script to the iframe content in `drawCanvas()`. ~30 lines of code.

**Files changed:** `index.html` (1 line — add script to iframe write)

### Phase 2: WAAPI Seek Before Capture (1 day)

Add `seekToFrame()` call before html2canvas in the capture section. ~5 lines.

**Files changed:** `index.html` (5 lines — add seek before html2canvas)

### Phase 3: Update Templates (1 day)

Update `addHtmlClipToTimeline` and `_applyHtmlTemplate` to use `data-animate` attributes.

**Files changed:** `index.html` (template strings)

### Phase 4: Agent Documentation (0.5 day)

Update `skills/AGENTS.md` with the three animation options.

**Files changed:** `automation/code-to-video/skills/AGENTS.md`

### Phase 5: Testing (1 day)

- Test old `animate(t)` clips still work
- Test new `data-animate` clips render correctly
- Test export with both types
- Test seeking with both types

**Total: 3.5 days**

---

## What Changes in the Code

### index.html — Only 2 Sections Modified

**Section 1: iframe creation (line ~6341)**
```javascript
// ADD: inline adapter script before clip.html
const dataAnimateAdapter = `(function(){/* adapter code */})();`;
doc.write(`...<body>${dataAnimateAdapter}${clip.html || ''}${clip.js ? '<script>'+clip.js+'<\\/script>' : ''}</body></html>`);
```

**Section 2: html2canvas capture (line ~6358)**
```javascript
// ADD: seek WAAPI before capture
if (clip._htmlIframe && clip._htmlIframe.contentWindow?.seekToFrame) {
    const clipTime = State.currentTime - clip.start;
    clip._htmlIframe.contentWindow.seekToFrame(
        Math.round(clipTime * (State.exportFps || 30)), 
        State.exportFps || 30
    );
}
// EXISTING: html2canvas capture (unchanged)
const capturePromise = html2canvas(clip._htmlIframe.contentDocument.body, {...});
```

### Total lines changed: ~40 lines (30 adapter + 10 integration)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adapter breaks old clips | Very Low | High | Adapter only acts on `data-animate` attributes — ignores everything else |
| WAAPI seek doesn't find animations | Low | Medium | Fallback: `animate(t)` still works via `<script>` tag |
| html2canvas can't capture WAAPI state | Low | Medium | WAAPI updates DOM styles — html2canvas captures those styles |
| Performance regression | Very Low | Low | Adapter runs once on iframe load — no per-frame overhead |

---

## Example: India Pollution with Data-Animate

```html
<!-- Agent writes this — no JavaScript needed! -->
<div class="slide">
  <h1 data-animate="fade-in" data-delay="0.2s">India Pollution Report 2024</h1>
  <p data-animate="slide-up" data-delay="0.5s">Environmental Data Analysis</p>
  
  <div class="stats">
    <div class="stat" data-animate="scale-up" data-delay="0.8s">
      <div class="stat-number">7M</div>
      <div class="stat-label">Deaths Annually</div>
    </div>
    <div class="stat" data-animate="scale-up" data-delay="1.0s">
      <div class="stat-number">30%</div>
      <div class="stat-label">Air Pollution</div>
    </div>
  </div>
  
  <div class="bar-chart">
    <div class="bar-row" data-animate="slide-right" data-delay="1.2s">
      <div class="bar-label">Vehicles</div>
      <div class="bar-track">
        <div class="bar-fill" data-animate="grow-right" data-delay="1.4s" 
             data-duration="0.8s" style="width: 80%; background: #6366f1;"></div>
      </div>
    </div>
  </div>
</div>
```

**Agent output: ~20 lines of HTML. No JavaScript. No animate(t).**
**Current approach: ~80 lines including animate(t) function.**

---

## Summary

| Aspect | Current | With Data-Animate |
|---|---|---|
| Agent writes | `function animate(t) { ... }` (50+ lines) | `data-animate="fade-in"` (1 attribute) |
| Animation engine | Custom `animate(t)` | WAAPI (browser native) |
| Seek accuracy | Depends on agent code | Deterministic (WAAPI) |
| Lines of code to change | — | ~40 lines in index.html |
| Backward compatible | — | ✅ Yes — old clips still work |
| Risk | — | Very low — purely additive |
