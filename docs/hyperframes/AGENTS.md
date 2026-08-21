# AGENTS.md — Agent Authoring Guide for Studio Pro

> This file tells AI agents how to create and edit Studio Pro videos.
> Place this file in your project root.

---

## Quick Start

1. Write a **Markdown script** following the grammar below
2. Use `markdownToSpcomp(markdownText)` to generate a `.spcomp` file
3. The `.spcomp` file can be rendered by Studio Pro or any headless renderer

---

## Markdown Script Grammar

### Slides

Separate slides with `---`:

```markdown
## First Slide

Text content here

---

## Second Slide

More content
```

### Headings

Use `##` for main headings (large text):

```markdown
## Amazing Animals
```

### Images

```markdown
![alt text](https://example.com/image.jpg)
![alt text](mock)
![alt text](mock:video)
```

### Positioning

Add position tags at the end of any line:

```markdown
## Title [top]
Text content [bottom]
![image](url) [right]
```

Available positions: `top`, `bottom`, `left`, `right`, `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center-left`, `center-right`, `center`

### Front Matter

Add configuration at the top of the script:

```markdown
---
aspect: 16:9
slideDuration: 4
bg: #000000
headingAnimIn: fadeIn
textAnimIn: slideUp
template: minimal
---

## Your Script Here
```

### Per-Element Style Tags

```markdown
## Heading [anim:zoomIn] [size:80] [color:#fde047]
Text [font:Anton] [size:24] [dur:6]
![image](url) [sat:150] [hue:20]
```

### Audio

```markdown
## Slide with Sound [audio:whoosh]
```

---

## Example Scripts

### Simple Explainer

```markdown
---
slideDuration: 3
bg: #1a1a2e
headingAnimIn: fadeIn
textAnimIn: slideUp
---

## Welcome to Our App

A modern tool for creators

---

## Key Features

Fast · Simple · Powerful

---

## Get Started Today

Try it free at our website
```

### Product Launch

```markdown
---
aspect: 9:16
slideDuration: 2
bg: #000000
headingAnimIn: zoomIn
template: product-launch
---

## Introducing ProductX

The future of productivity

---

## Feature 1

AI-powered automation

---

## Feature 2

Real-time collaboration

---

## Available Now

Download today
```

---

## File Formats

| Format | Extension | Use Case |
|---|---|---|
| Markdown | `.md` | Authoring (write this) |
| .spcomp | `.spcomp` | Portable composition (generated) |
| .sptpl | `.sptpl` | Design template |
| .json | `.json` | Native project (Studio Pro) |

---

## Agent Workflow

```
1. Write markdown script
2. markdownToSpcomp(script) → .spcomp file
3. Studio Pro loads .spcomp → renders video
4. Or: headless renderer loads .spcomp → produces MP4
```

---

## Tips

- Keep slides short (2-5 seconds each)
- Use `---` to separate ideas
- Add images with `![alt](url)` for visual interest
- Use position tags to avoid overlap
- Front matter sets defaults; per-element tags override
- The `template` key applies a whole design style
