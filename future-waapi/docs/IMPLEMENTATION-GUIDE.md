# WAAPI Integration Guide

## When to Integrate

Integrate when:
1. The WAAPI examples work correctly in browser testing
2. SVG foreignObject capture produces acceptable quality
3. You've verified no regression in existing html2canvas exports

## Step-by-Step Integration

### Step 1: Add WAAPI bridge to iframe (index.html)

In the `drawCanvas` function, around line 6340, add the WAAPI bridge to the iframe content:

```javascript
// BEFORE:
doc.write(`<!DOCTYPE html><html>...<body>${clip.html || ''}...</body></html>`);

// AFTER:
const waapiBridge = `<script src="future-waapi/lib/waapi-seek.js"><\/script>`;
const adapterScript = `<script src="future-waapi/lib/data-animate-adapter.js"><\/script>`;
doc.write(`<!DOCTYPE html><html>...<body>${waapiBridge}${adapterScript}${clip.html || ''}...</body></html>`);
```

### Step 2: Replace html2canvas with SVG foreignObject (optional, experimental)

In the html2canvas capture section (line ~6379):

```javascript
// BEFORE:
const capturePromise = html2canvas(clip._htmlIframe.contentDocument.body, {
    width: w, height: h, backgroundColor: null, scale: 1
}).then(canvas => { clip._htmlCanvas = canvas; });

// AFTER (try SVG first, fallback to html2canvas):
const capturePromise = captureHtmlToCanvas(clip._htmlIframe, w, h)
    .then(canvas => { clip._htmlCanvas = canvas; })
    .catch(err => {
        console.warn('[HTMLClip] SVG capture failed, falling back to html2canvas:', err.message);
        return html2canvas(clip._htmlIframe.contentDocument.body, {
            width: w, height: h, backgroundColor: null, scale: 1
        }).then(canvas => { clip._htmlCanvas = canvas; });
    });
```

### Step 3: Add seekToFrame to the export loop

In the export loop, before `drawCanvas()`:

```javascript
// For each active HTML clip, seek its animations to the current frame
for (const clip of activeHtmlClips) {
    if (clip._htmlIframe && clip._htmlIframe.contentWindow) {
        const frame = Math.round((State.currentTime - clip.start) * fps);
        clip._htmlIframe.contentWindow.seekToFrame(frame, fps);
    }
}
drawCanvas(exportCtx, exportW, exportH);
```

### Step 4: Update agent documentation

Update `automation/code-to-video/skills/AGENTS.md` to tell agents they can now use:

```html
<!-- Option A: CSS keyframes (auto-seekable via WAAPI) -->
<style>
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.title { animation: fadeIn 0.5s ease forwards; }
</style>
<h1 class="title">Title</h1>

<!-- Option B: Data-animate attributes (adapter converts to WAAPI) -->
<h1 data-animate="fade-in" data-delay="0.2s">Title</h1>

<!-- Option C: Custom animate(t) (still works, backward compat) -->
<script>
function animate(t) {
    document.getElementById('title').style.opacity = Math.min(1, t / 0.5);
}
</script>
```

## Testing Checklist

- [ ] Open `examples/animated-slide.html` in browser
- [ ] Verify `seekToFrame(0, 30)` shows start state
- [ ] Verify `seekToFrame(30, 30)` shows 1-second state
- [ ] Verify `seekToFrame(60, 30)` shows 2-second state
- [ ] Load india-pollution-v2.js in editor
- [ ] Verify canvas preview shows animations (not white)
- [ ] Export with MediaBunny — verify no blank frames
- [ ] Export with FTRT — verify no blank frames
- [ ] Compare file sizes: old (html2canvas) vs new (SVG foreignObject)
