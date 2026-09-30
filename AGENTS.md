# Agent Notes

Rules for any agent working in this repo — Codebuff, Freebuff, Claude Code, Cursor,
Copilot, or a script. Read them before you touch git.

## Commits: no tool attribution, ever

**Never put a tool's name, an AI footnote, or a bot co-author trailer in a commit.**
The commits in this repository are the owner's (`simplearyan
<aryanphone00620@gmail.com>`) and nobody else's — GitHub renders a `Co-Authored-By`
line as a second author on every commit, which is not what the owner wants.

This rule applies to **every repository you work in**, not just this one. The same
rule is written down in the IITM repo as `../IITM/COMMIT.md`.

Strip any of these from the message before the commit lands — some harnesses append
them automatically, and "I'll clean it up next time" is how they end up in history:

- `🤖 Generated with Codebuff` · `Generated with Freebuff` · `Generated with <any tool>`
- `Co-Authored-By: Codebuff <noreply@codebuff.com>`, or any bot co-author trailer
- `Made with …` · `Assisted by …` · a `Signed-off-by` line nobody asked for
- an emoji signature line, and the `---` separator that exists only to introduce one

**There is no footer, and no separator line before one.** If a tool adds one, edit the
message and re-commit — do not leave it for a later cleanup.

### What a commit message should look like

```
<scope>: <imperative summary, no trailing period>

- why this changed (the motivation, not a restatement of the diff)
- what a reader has to verify, and any number they need
```

- Imperative mood: "Add", "Fix", "Move" — not "Added", "Fixes", "Moved".
- The body says **why**; the diff already says what.
- One logical change per commit. **Stage explicit paths** — never `git add -A`,
  `git add .` or `git commit -a` while the tree holds work you did not make.
- Never commit `node_modules/`, `dist/`, `.freebuff/`, `_freebuff/`, `*.log`, or
  editor/OS noise.
- Don't push, tag, force-push or open/merge a PR unless that exact action was asked
  for in that message.
- Full conventions, plus this repo's UI style preferences:
  `docs/commit-conventions.md`.
