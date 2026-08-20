# Commit Conventions

## Author credit — no Codebuff co-author

The owner of this repo is **aryan** (`simplearyan <aryanphone00620@gmail.com>`).

Do **NOT** add a `Co-Authored-By: Codebuff` trailer or a "🤖 Generated with
Codebuff" footer to commit messages. Commits should be authored by the user
only — GitHub shows any `Co-Authored-By` line as an extra co-author, and the
owner does not want Codebuff credited.

Commit messages: keep the existing style — a concise subject line, then a
short body describing the *why* and *what* of the change. No tool credit
footers of any kind.

## UI style preferences

- CapCut-inspired, clean and minimal: tile/gallery layouts, dashed
  "New Project" cards, ⋯ overflow menus instead of stacked icon buttons.
- All dialogs should be in-app modals (name / confirm / notice), never
  browser `prompt()` / `alert()` / `confirm()`. Keyboard: Enter = confirm,
  Escape = cancel; focus the primary action on open.
- The Projects modal supports full keyboard nav (arrows, Enter, F2, Ctrl+D,
  Delete, Esc).
- Match the text-Properties panel's clean card organization in captions.
