# Keyboard Seek Shortcuts — Ladder Plan

> **Status:** J/L time-seek ladder **implemented & live-verified**. The `,`/`<`/`.`/`>`
> frame-step ladder is **planned** (design below, awaiting approval to implement).

## 1. J/L — time seek (IMPLEMENTED)

`J` = back, `L` = forward. The step size follows a modifier ladder:

| Modifier | Step | Notes |
|---|---|---|
| `J` / `L` | **5 s** | default |
| `Alt + J/L` | **2.5 s** | fine jog |
| `Shift + J/L` | **7.5 s** | medium jump |
| `Ctrl + J/L` | **10 s** | long jump (unchanged from before) |
| `Ctrl + Shift` | 10 s | Ctrl wins over the others |

Precedence when several modifiers are held: **Ctrl > Shift > Alt** (checked in that
order, so the largest sensible step wins).

**Behavior change:** clip-nudging (`nudgeSelectedClips`) previously triggered on
`Shift`/`Alt` with a selection. Alt/Shift are now reserved for seek amounts, so
**clip-nudging happens only via the "Keyboard Seeks Clip" toggle** (View menu —
`btnKeyboardSeekClipMenu`). The toggle already exists and is unaffected; users who
wanted Shift/Alt to nudge clips now flip the toggle instead. This keeps the two
features from fighting over the same keys.

Verified live (flower.mp4, `State.currentTime` delta after one keydown):

```
J:  plain -5.00 | Alt -2.50 | Shift -7.50 | Ctrl -10.00
L:  plain +5.00 | Alt +2.50 | Shift +7.50 | Ctrl +10.00
```

## 2. `,` / `<` / `.` / `>` — frame step (IMPLEMENTED, 2026-08-07)

These keys currently all step **1 frame** (1/30 s), with `<`/`>` being the same
keys as `,`/`.` when Shift is held. The plan mirrors the J/L ladder so muscle
memory transfers:

| Key | Step | Notes |
|---|---|---|
| `,` / `.` | **1 frame** (≈0.033 s) | default, unchanged |
| `Shift + ,` / `.` (i.e. `<` / `>`) | **5 frames** (≈0.167 s) | matches the "5 frames" mental model; `<`/`>` become meaningful |
| `Alt + ,` / `.` | **0.5 s** (15 frames) | |
| `Ctrl + ,` / `.` | **2 s** (60 frames) | |

- `,` and `<` step backward; `.` and `>` step forward.
- Same precedence rule as J/L: **Ctrl > Shift > Alt**.
- **Behavior change required (same as J/L):** today these keys *do* nudge clips on
  `Alt` or `Ctrl+Shift` with a selection
  (`seekClip = hasSelection && (State.keyboardSeekClip || e.altKey || (e.ctrlKey && e.shiftKey))`,
  ~18793). Implementing the ladder means Alt/Ctrl must become seek amounts, so
  that nudge condition must be simplified to `State.keyboardSeekClip` only —
  exactly like the J/L branch just did — or the planned Alt=0.5 s / Ctrl=2 s
  amounts will silently fight the existing Alt-nudge. This is the one place the
  J/L change and the `,`/`.` change are **not** already symmetric.
- Implementation is a ~2-line change inside the existing
  `e.key === ',' || '<' || '.' || '>'` branch (~18788): compute the delta from the
  same modifier ladder, e.g.
  `const baseFrames = e.ctrlKey ? 60 : (e.shiftKey ? 5 : (e.altKey ? 15 : 1));`
  then `delta = (isForward ? 1 : -1) * baseFrames / 30;`, and simplify the
  `seekClip` condition to `State.keyboardSeekClip` (drop `e.altKey` and the
  `e.ctrlKey && e.shiftKey` clause).

**Why 5 frames for Shift:** the user's mental model for J/L was "5 frames" (J/L is
actually 5 s). Giving `<`/`>` a real 5-frame meaning satisfies that expectation on
the keys that are genuinely frame-granular.

## 3. Menu / discoverability

- The "Keyboard Seeks Clip" toggle label could gain the ladder hint, e.g.
  "Keyboard Seeks Clip (J/L nudges clip when ON)". Optional.
- A future Keyboard Shortcuts help modal (there isn't one yet — only the inline
  comment at ~2511) should list both ladders. Out of scope for this change.
