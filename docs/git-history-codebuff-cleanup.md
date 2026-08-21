# Plan: Strip the `Co-Authored-By: Codebuff` Trailer From Git History

**Status:** plan only — nothing below has been executed.
**Repo:** `simplearyan/studio-pro` (local checkout: `studio-pro-editor`)
**Goal:** remove every `Co-Authored-By: Codebuff <noreply@codebuff.com>` trailer from the commit history so `codebuff-team` no longer appears as a repo contributor.

---

## 1. Current state (measured 2026-08-17)

| Fact | Value |
|---|---|
| Total commits (all refs) | 240 |
| Commits with the Codebuff trailer | **149** |
| First trailer commit | `9cc5321` (2026-07-30) — the earliest commit, so the trailer is woven through most of history |
| Last trailer commit | `3390f92` (2026-08-14) |
| Clean commits (since convention) | `a88ff0d` (Projects keyboard nav), `e4b93ae` (Markdown props) |
| Git author on every commit | `simplearyan <aryanphone00620@gmail.com>` (no author/email cleanup needed) |
| Other co-author trailers | none — Codebuff is the only co-author ever credited |
| Branches | `main` only (local == origin, no unpushed commits) |
| Tags | `v0.1-alpha` (clean), `v0.5-alpha` (4 trailer commits), `v0.6-alpha` (9), `v1.0-alpha` (20) — **three tags must be force-pushed too** |
| Remote | `https://github.com/simplearyan/studio-pro.git` |
| CI | `.github/workflows/deploy.yml` (Pages deploy) — re-runs harmlessly on the force-push |
| `git filter-repo` | **not installed** (must be installed first) |
| Local working tree | dirty (uncommitted Sync work + docs) → **use a fresh clone**, never rewrite in place |

---

## 2. What changes and what does not

**Changes (inevitable):**
- Every commit SHA from `9cc5321` onward changes (the message is part of the commit hash). The three affected tags re-point to rewritten commits.
- Anyone who has cloned the repo must re-clone or fetch+reset; old SHAs stop resolving.

**Stays identical:**
- File trees/blobs — a message-only rewrite leaves every tree and file byte-identical (`git rev-parse main^{tree}` is unchanged).
- Authors, committers, dates, parents, commit order.
- GitHub Releases (if any) attach to tag *names*, which survive.

---

## 3. Prerequisites

1. **Install `git-filter-repo`** (GitHub's recommended tool):
   ```bash
   pip install git-filter-repo
   # or standalone script: https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo
   ```
   `git filter-branch` is built-in but is slow, fragile, and officially discouraged — use it only as a last resort.

2. **Make a full backup** (in a folder outside the repo):
   ```bash
   cd D:/Code/Antigravity/design_concepts/studios
   git clone --mirror https://github.com/simplearyan/studio-pro.git studio-pro-backup.git
   ```
   Keep this until the sidebar confirms the cleanup. It is the rollback source.

3. **Do NOT touch the dirty local checkout.** Because local `main` has no unpushed commits, the whole rewrite can run in a fresh clone of the remote — the working tree with the uncommitted Sync/docs work stays untouched. (Rewriting in place would require committing/stashing everything first and still carries the risk of wiping uncommitted files, since `filter-repo` hard-resets.)

4. **Optional but recommended:** confirm nobody else has outstanding branches/PRs pointing at old SHAs (single-owner repo, so likely fine). Any open PR would need to be re-based after the rewrite.

---

## 4. Execution

### Step 4.1 — Fresh clone + rewrite
```bash
cd D:/Code/Antigravity/design_concepts/studios
git clone https://github.com/simplearyan/studio-pro.git studio-pro-clean
cd studio-pro-clean

git filter-repo --force \
  --message-callback '
import re
lines = [l for l in message.splitlines()
         if l.strip().lower() != "co-authored-by: codebuff <noreply@codebuff.com>"]
return "\n".join(lines).rstrip() + "\n"
'
```
- The callback removes the trailer **wherever it appears** and trims the leftover blank line — handles both `subject\n\nCo-Authored-By: ...` and `subject\nbody\n\nCo-Authored-By: ...` shapes.
- `--force` is required because the clone is not "fresh" from filter-repo's point of view (it has an origin).
- `filter-repo` removes the `origin` remote automatically; re-add it:
  ```bash
  git remote add origin https://github.com/simplearyan/studio-pro.git
  ```

### Step 4.2 — Verify locally before touching the remote (see §6)
Run the full local verification checklist. If anything fails, stop and roll back from the backup.

### Step 4.3 — Force-push main and the affected tags
```bash
git push --force origin main
git push --force origin v0.5-alpha v0.6-alpha v1.0-alpha
# v0.1-alpha is already clean — re-push only if you want the refs consistent:
# git push --force origin v0.1-alpha
```
- A normal force-push is fine here (single owner, no collaborators). `--force-with-lease` is not useful after a rewrite — the local refs intentionally no longer match the remote.
- The Pages `deploy.yml` will re-run and redeploy the same content — expected, harmless.
- Note: GitHub may briefly show a "force push detected" banner on the repo — that is expected.

### Step 4.4 — Update the local working checkout
The local `studio-pro-editor` checkout still points at the *old* history. After the remote is rewritten:
```bash
cd D:/Code/Antigravity/design_concepts/studios/studio-pro-editor
git fetch origin
git reset --hard origin/main        # safe ONLY after committing/stashing the uncommitted work
git tag -f v0.5-alpha origin/v0.5-alpha   # re-point local tags (repeat for v0.6, v1.0)
```
⚠️ The uncommitted Sync button work and the docs changes must be committed or stashed **before** the `reset --hard`. Alternative: keep the dirty checkout as-is and do all future work in the clean clone.

---

## 5. The stale-sidebar caveat (important)

The repo homepage's **Contributors sidebar is cached and does not reliably recompute**. GitHub community threads (#189812, #202538, #204830) document exactly this symptom:

- After the history rewrite + force-push, **`codebuff-team` may keep showing in the sidebar for a long time**, even though no commit, tag, REST endpoint, or the Insights → Contributors graph mentions it.
- The **Insights → Contributors graph** and **`GET /repos/simplearyan/studio-pro/contributors`** recompute correctly and will show only `simplearyan` — use these as the source of truth for verification.
- There is **no self-service way to force the sidebar to refresh**. If it stays stale, the only recourse is a GitHub support ticket / community discussion referencing the clean data above.

**Expectation setting:** the cleanup makes the *data* correct immediately; the *sidebar widget* may lag behind by days, weeks, or indefinitely.

---

## 6. Verification checklist

### Local (before push)
- [ ] `git log --all --format=%B | grep -i "co-authored-by"` → **0 matches**
- [ ] `git log --all --format="%an <%ae>" | sort -u` → only `simplearyan <aryanphone00620@gmail.com>`
- [ ] Commit count still 240: `git rev-list --all --count`
- [ ] Tree identity preserved: `git rev-parse main^{tree}` matches the pre-rewrite value (record it before rewriting)
- [ ] Spot-check a former trailer commit: message now ends at the subject/body, no blank-line residue
- [ ] `git status` clean in the fresh clone

### Remote (after push)
- [ ] `curl -s https://api.github.com/repos/simplearyan/studio-pro/contributors` → **only simplearyan**
- [ ] `curl -s "https://api.github.com/repos/simplearyan/studio-pro/commits?author=codebuff-team"` → empty list
- [ ] `git ls-remote --tags origin` shows v0.5/v0.6/v1.0 pointing at the new SHAs
- [ ] Pages deploy workflow finishes green; `https://simplearyan.github.io/studio-pro/` still loads
- [ ] **Expect:** sidebar may still show 2 contributors — do not treat that as failure (see §5)

---

## 7. Rollback

If anything breaks on the remote:
```bash
# Restore main to the pre-rewrite SHA (record it in Step 2)
git push --force origin <old-main-sha>:main
# Re-point tags to their original commits (recorded in §1 tag table)
git push --force origin <old-tag-sha>:refs/tags/v0.5-alpha   # repeat for v0.6, v1.0
```
The `--mirror` backup clone (Step 2) is the ultimate source for the original refs.

---

## 8. Risks & notes

- **Irreversible without backup** — commit SHAs change for 149 commits; everyone with a clone must re-sync. Keep the mirror backup until the sidebar check is done.
- **CI churn** — the Pages workflow re-runs on push; the deployed site content is unchanged.
- **GitHub Releases (if any)** survive (they key on tag names), but any release notes linking to old commit SHAs will point at dead hashes.
- **Author is unaffected** — only the `Co-Authored-By` trailer is stripped; commit authorship stays `simplearyan`, so the contributor count going forward is exactly what the user expects.
- **If `pip install` is unavailable:** download the single-file `git-filter-repo` script and place it on `PATH` (or run `python git-filter-repo ...`). Do not fall back to `filter-branch` unless unavoidable.
