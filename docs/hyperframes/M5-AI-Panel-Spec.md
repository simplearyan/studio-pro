# M5 — In-App AI Panel

> **Date:** August 2026
> **Status:** Spec for implementation
> **Scope:** `index.html` new AI panel modal + LLM API integration
> **Depends on:** M2 (templates), M4 (markdown bridge)

---

## 1. What is the AI Panel?

A **"Create with AI"** panel that takes a prompt + template pick and produces a first-draft timeline *entirely in the browser*:

1. User pastes a brief ("product launch for my SaaS, dark theme, 30s")
2. Panel calls the user's own LLM (BYO-key: provider + key stored in localStorage)
3. LLM returns **Markdown** (Studio Pro already compiles this)
4. Existing Markdown → timeline generator builds the draft
5. Human polishes in the GUI

---

## 2. UI Design

### Panel layout (modal or sidebar tab)

```
┌─────────────────────────────────────────┐
│  ✨ Create with AI                      │
├─────────────────────────────────────────┤
│  Provider: [OpenAI ▼]  Model: [gpt-4o] │
│  API Key: [••••••••••] (stored locally) │
├─────────────────────────────────────────┤
│  Template: [Minimal ▼]                  │
│                                         │
│  Describe your video:                   │
│  ┌─────────────────────────────────┐    │
│  │ A 30-second product launch for  │    │
│  │ a SaaS tool, dark theme, with   │    │
│  │ fade-in text and mock images    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [✨ Generate Script]                    │
├─────────────────────────────────────────┤
│  Generated Markdown:                    │
│  ┌─────────────────────────────────┐    │
│  │ ---                             │    │
│  │ slideDuration: 3                │    │
│  │ bg: #1a1a2e                     │    │
│  │ template: minimal               │    │
│  │ ---                             │    │
│  │ ## Introducing ProductX         │    │
│  │ The future of productivity      │    │
│  │ ---                             │    │
│  │ ## Key Features                 │    │
│  │ AI-powered · Real-time · Fast   │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Apply to Timeline] [Copy] [Download]  │
└─────────────────────────────────────────┘
```

---

## 3. Provider Support

| Provider | Models | API Format |
|---|---|---|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo | REST (chat/completions) |
| **Anthropic** | claude-sonnet-4-20250514, claude-3-haiku | REST (messages) |
| **Custom** | Any OpenAI-compatible API | REST (chat/completions) |

### API key storage

- Stored in `localStorage` under `studiopro_ai_key_{provider}`
- Never sent anywhere except the provider's API
- Optional: in-memory-only mode (key not persisted)

---

## 4. System Prompt

The LLM receives a system prompt that instructs it to generate Studio Pro markdown:

```
You are a video script generator for Studio Pro, a browser-based video editor.

Generate a markdown script following this grammar:
- Separate slides with ---
- Use ## for headings (large text)
- Use ![alt](mock) for placeholder images
- Use ![alt](url) for real images
- Add position tags: [top] [bottom] [left] [right] [center]
- Add front matter at the top: ---\nslideDuration: 3\nbg: #000000\n---

The user will describe what they want. Generate a script that:
1. Has 4-8 slides (2-4 seconds each)
2. Uses the specified template/style
3. Includes placeholder images where visual interest helps
4. Keeps text concise (1-2 lines per slide)
5. Uses position tags to avoid overlap

Output ONLY the markdown script. No explanation.
```

---

## 5. Pipeline

```
User prompt → System prompt + user prompt → LLM API → Markdown response
    → parseMarkdownToClips() → Timeline clips → User edits in GUI
```

---

## 6. Acceptance criteria

- [ ] AI panel opens from toolbar button or keyboard shortcut
- [ ] Provider selector (OpenAI, Anthropic, Custom)
- [ ] API key input with show/hide toggle
- [ ] Key persisted in localStorage (optional)
- [ ] Template selector (uses M2 templates)
- [ ] Prompt textarea with placeholder text
- [ ] Generate button calls LLM API
- [ ] Loading spinner during API call
- [ ] Generated markdown displayed in editable textarea
- [ ] "Apply to Timeline" button runs parseMarkdownToClips()
- [ ] "Copy" button copies markdown to clipboard
- [ ] "Download" button downloads as .md file
- [ ] Error handling (invalid key, API errors, rate limits)
- [ ] Works entirely in browser (no backend needed)

---

## 7. Safety

- **BYO-key only** — no accounts, no server costs, no privacy surprises
- **Key never leaves browser** — sent only to the provider's API
- **User owns the output** — generated clips are ordinary timeline clips
- **No hosted backend** — everything runs in-browser
