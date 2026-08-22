# Studio Pro Automation — Quick Reference

> Simple guide to the automation roadmap, inspired by Remotion and HyperFrames

---

## The Three Tools at a Glance

| Tool | How You Write Video | How It Renders | Best For |
|---|---|---|---|
| **Remotion** | React code | Chrome screenshots | Developers |
| **HyperFrames** | HTML files | Chrome screenshots | AI agents |
| **Studio Pro** | GUI + Markdown | Canvas 2D | Everyone |

---

## What Studio Pro Takes from Each

### From Remotion: "Code is Simple"
- Markdown is our "React component"
- `parseMarkdownToClips()` is our compiler
- Pure frame math = deterministic output

### From HyperFrames: "Agents Write HTML"
- Design templates = our `frame.md`
- Skills = our workflow documentation
- Agent-editable format = `.spcomp`

### From Studio Pro: "GUI + Canvas"
- WYSIWYG timeline (neither competitor has this)
- Canvas renderer (no headless Chrome fight)
- Deterministic audio (already done)

---

## The 6 Phases in Simple Terms

### Phase 1: Make It Deterministic (Week 1-2)
**What:** Same input → same output, every time
**Why:** So exports are repeatable and CI works
**Borrowed from:** Remotion's pure frame math

### Phase 2: Design Templates (Week 3-4)
**What:** One-click restyling (like HyperFrames' `frame.md`)
**Why:** "Make it look like a product launch" in one click
**Borrowed from:** HyperFrames' design system

### Phase 3: Agent Format (Week 5-6)
**What:** `.spcomp` file that agents can read/write
**Why:** So Claude Code can create videos
**Borrowed from:** Both (Remotion's code + HyperFrames' HTML)

### Phase 4: Agent Skills (Week 7-8)
**What:** Documentation for agents (like HyperFrames' 19 skills)
**Why:** So agents know how to make different video types
**Borrowed from:** HyperFrames' skill system

### Phase 5: HTML Clips (Week 9-12)
**What:** New clip type for complex CSS (gradients, glassmorphism)
**Why:** Agents can write beautiful HTML, not just Canvas code
**Borrowed from:** HyperFrames' HTML authoring

### Phase 6: AI Panel (Week 13-16)
**What:** In-app "Create with AI" (BYO-key, prompt → video)
**Why:** The "paste a prompt, get a video" UX
**Borrowed from:** Remotion's Claude Code workflow

---

## The Killer Features

### 1. Markdown is Our React
```markdown
# Product Launch
[fade:1]
Welcome to the future
```
Simple, agents love it, `parseMarkdownToClips()` handles the rest.

### 2. Templates are Our frame.md
```json
{
  "name": "Product Launch",
  "presets": { "text": {...}, "shape": {...} },
  "markdownStyle": {...}
}
```
One click = whole project restyled.

### 3. .spcomp is Our React Component
```json
{
  "duration": 30,
  "clips": [...],
  "tracks": [...]
}
```
Portable, agent-editable, round-trips perfectly.

### 4. GUI is Our Secret Weapon
Neither Remotion nor HyperFrames has a real timeline editor.
Humans polish what agents generate — best of both worlds.

---

## The Comparison: Before vs After

| Aspect | Today | After Automation |
|---|---|---|
| **Who can make video** | Human in GUI | Human + AI agents |
| **Authoring format** | GUI clicks only | GUI + Markdown + HTML |
| **Export speed** | 1× realtime | 4× realtime (FTRT) |
| **Determinism** | Broken (Math.random) | Perfect (seeded PRNG) |
| **Templates** | Per-element presets | Project-wide design system |
| **Agent support** | None | 7 skills + .spcomp format |
| **AI panel** | None | BYO-key, prompt → video |

---

## The Timeline

```
Week 1-2:   Determinism (foundation)
Week 3-4:   Templates (one-click restyling)
Week 5-6:   .spcomp format (agent-editable)
Week 7-8:   Skills documentation (agent workflows)
Week 9-12:  HTML/CSS/JS clips (complex visuals)
Week 13-16: AI panel (prompt → video)
```

**The "wow" moments:**
- Week 4: "Apply Product Launch template" → instant restyling
- Week 8: "Claude, make a 30s explainer video" → timeline appears
- Week 16: "Create a video about AI" → full draft in GUI

---

## The Bottom Line

**Remotion proved:** Code-first video works for agents
**HyperFrames proved:** HTML-first video works for agents
**Studio Pro will prove:** GUI + Agent hybrid works best

**The moat:** No other tool has:
- Visual timeline editor (like Premiere)
- AI code generation (like Remotion)
- Canvas renderer (no Chrome fight)
- Browser-only (no install)
- Free & open source
