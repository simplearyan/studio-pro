# html2canvas Gotchas & Workarounds

> **CRITICAL:** html2canvas does NOT render HTML/CSS exactly like a browser.
> AI agents MUST follow these rules to avoid rendering bugs.

---

## 🔴 Known Issues

### 1. Emoji Rendering Broken
- **Problem:** Emojis (📊, 🔴, ⚠️, 💰, etc.) render as colored squares or wrong icons
- **Cause:** html2canvas uses a canvas-based renderer that doesn't support system emoji fonts
- **Workaround:** Use CSS-styled badges instead of emojis
  ```css
  /* ❌ BAD — emoji won't render correctly */
  <div class="icon">📊</div>
  
  /* ✅ GOOD — CSS-styled icon */
  <div class="icon" style="background: #1A73E8; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px;">1</div>
  ```

### 2. Border-Radius on Buttons
- **Problem:** Buttons lose their rounded corners
- **Cause:** html2canvas doesn't render `border-radius` on certain elements
- **Workaround:** Use `overflow: hidden` on parent container
  ```css
  /* ❌ BAD — border-radius may not render */
  .btn { border-radius: 100px; }
  
  /* ✅ GOOD — wrap in overflow hidden */
  .btn-wrapper { overflow: hidden; border-radius: 100px; }
  .btn { border-radius: 100px; }
  ```

### 3. Flexbox Centering Issues
- **Problem:** Elements that are centered in browser appear left-aligned in export
- **Cause:** html2canvas has partial flexbox support
- **Workaround:** Use explicit widths and margins instead of flexbox centering
  ```css
  /* ❌ BAD — flexbox centering may fail */
  .container { display: flex; justify-content: center; }
  
  /* ✅ GOOD — explicit centering */
  .container { text-align: center; }
  .item { width: 200px; margin: 0 auto; }
  ```

### 4. Google Fonts Not Loaded
- **Problem:** Text renders in fallback font (sans-serif) instead of Google Sans
- **Cause:** html2canvas captures before fonts finish loading
- **Workaround:** Always wait for fonts before rendering
  ```javascript
  // Wait for fonts to load
  await document.fonts.ready;
  
  // Then render
  html2canvas(element, { useCORS: true });
  ```

### 5. Gradient Backgrounds
- **Problem:** Complex gradients may not render or look different
- **Cause:** html2canvas has limited gradient support
- **Workaround:** Use simple linear gradients, avoid radial gradients
  ```css
  /* ❌ BAD — radial gradient may fail */
  background: radial-gradient(circle, #fff 0%, #000 100%);
  
  /* ✅ GOOD — simple linear gradient */
  background: linear-gradient(135deg, #E8F0FE 0%, #FFFFFF 100%);
  ```

### 6. Box Shadow
- **Problem:** Box shadows may not render or appear in wrong position
- **Cause:** html2canvas has limited shadow support
- **Workaround:** Use borders instead of shadows for visual separation
  ```css
  /* ❌ BAD — shadow may not render */
  .card { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  
  /* ✅ GOOD — use border instead */
  .card { border: 1px solid #DADCE0; }
  ```

### 7. CSS Variables
- **Problem:** CSS custom properties (variables) may not work
- **Cause:** html2canvas doesn't fully support CSS variables
- **Workaround:** Use hardcoded values
  ```css
  /* ❌ BAD — variables may fail */
  :root { --primary: #1A73E8; }
  .btn { background: var(--primary); }
  
  /* ✅ GOOD — hardcoded values */
  .btn { background: #1A73E8; }
  ```

### 8. Transform & Animation
- **Problem:** CSS transforms and animations don't render correctly
- **Cause:** html2canvas captures static state, not animated state
- **Workaround:** Use the StudioPro animation system instead
  ```css
  /* ❌ BAD — animation won't render */
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .element { animation: fadeIn 1s; }
  
  /* ✅ GOOD — use StudioPro keyframes */
  StudioPro.keyframes(clip, {
    opacity: [{ frame: 0, value: 0 }, { frame: 30, value: 100 }]
  });
  ```

### 9. Overflow & Clipping
- **Problem:** Elements with `overflow: hidden` may clip incorrectly
- **Cause:** html2canvas calculates overflow differently
- **Workaround:** Avoid `overflow: hidden` on container elements

### 10. Nested Flex/Grid
- **Problem:** Complex nested flexbox or grid layouts may break
- **Cause:** html2canvas has limited support for complex layouts
- **Workaround:** Keep layouts simple, use single-level flex/grid

---

## ✅ Safe CSS Patterns

### Colors
```css
/* Safe: hardcoded hex colors */
color: #202124;
background: #1A73E8;

/* Safe: rgba with hardcoded values */
color: rgba(255, 255, 255, 0.8);
background: rgba(0, 0, 0, 0.5);
```

### Typography
```css
/* Safe: system fonts */
font-family: 'Arial', 'Helvetica', sans-serif;

/* Safe: Google Fonts (wait for load) */
font-family: 'Google Sans', 'Inter', sans-serif;
```

### Layout
```css
/* Safe: simple flexbox */
display: flex;
justify-content: center;
align-items: center;

/* Safe: text alignment */
text-align: center;

/* Safe: margins for centering */
margin: 0 auto;
width: 80%;
```

### Borders
```css
/* Safe: solid borders */
border: 1px solid #DADCE0;
border-radius: 16px;

/* Safe: border-left for indicators */
border-left: 4px solid #EA4335;
```

---

## 🎨 HTML Clip Template (Safe)

Use this template for reliable html2canvas rendering:

```html
<div class="slide">
  <div class="content">
    <h1>Title</h1>
    <p>Subtitle</p>
  </div>
</div>

<style>
.slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-family: 'Arial', sans-serif;
  background: #FFFFFF;
  padding: 80px;
}

.content {
  text-align: center;
  max-width: 80%;
}

h1 {
  font-size: 72px;
  font-weight: 700;
  color: #202124;
  margin: 0 0 24px 0;
}

p {
  font-size: 28px;
  color: #5F6368;
  margin: 0;
}
</style>
```

---

## 📋 AI Agent Checklist

Before writing HTML for StudioPro clips:

- [ ] **No emojis** — Use CSS-styled badges instead
- [ ] **No CSS variables** — Use hardcoded values
- [ ] **No complex gradients** — Use simple linear gradients
- [ ] **No box shadows** — Use borders instead
- [ ] **No transforms/animations** — Use StudioPro animation system
- [ ] **Simple flexbox** — Single-level only, avoid nested flex/grid
- [ ] **Wait for fonts** — Always load fonts before rendering
- [ ] **Test in canvas** — Verify rendering matches HTML editor preview

---

## 🔧 Testing

To test if HTML renders correctly in canvas:

1. Open HTML Code Editor
2. Write HTML/CSS
3. Check Live Preview (right side)
4. Click "Apply"
5. Check Canvas (main area)
6. If different → follow gotchas above

**If canvas preview differs from HTML editor preview, it's an html2canvas limitation.**
