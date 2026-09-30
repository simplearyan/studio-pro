# Commit Conventions

## Author credit — no tool attribution of any kind

The owner of this repo is **aryan** (`simplearyan <aryanphone00620@gmail.com>`).

Commits are authored by the user only. **Do NOT add any tool or AI credit to a
commit message** — no `Co-Authored-By` trailer, no "Generated with …" footer, no
emoji signature, and no `---` separator line that exists only to sit above one.
GitHub renders a `Co-Authored-By` line as an extra co-author on every commit it
touches, and the owner does not want an assistant credited.

This covers every tool, named or not — Codebuff, Freebuff, Cursor, Copilot,
Claude, or whatever comes next. Concrete strings to strip if a harness inserts
them:

```
🤖 Generated with Codebuff
Generated with Freebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>
Made with … · Assisted by … · Signed-off-by: <a bot>
```

Some harnesses append a footer automatically. Remove it from the message before
the commit lands — there is no "clean it up later", because later never comes.

The rule is not specific to this repo: follow it in every repo you touch. The
IITM repo states the same rule in `../IITM/COMMIT.md`.

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
