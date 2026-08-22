# Versioning Guide — How Studio Pro Uses Version Numbers

> **Date:** August 2026
> **Purpose:** Explain semantic versioning, pre-release tags, and Studio Pro's versioning strategy

---

## 1. Semantic Versioning (SemVer)

Every version number follows this format:

```
vMAJOR.MINOR.PATCH-prerelease
```

| Part | What It Means | When to Increment |
|---|---|---|
| **MAJOR** | Breaking changes (things might not work) | Major redesign, incompatible with old projects |
| **MINOR** | New features (backwards compatible) | New functionality added |
| **PATCH** | Bug fixes (backwards compatible) | Fixing something broken |
| **prerelease** | Not ready for production | alpha, beta, rc |

---

## 2. Pre-Release Labels

### Alpha (α) — Early Development

**What it means:** "This is experimental. Features may be broken."

| Use Case | Example |
|---|---|
| Internal testing | `v0.1.0-alpha` |
| Missing features | AI panel might crash |
| Not for production | Don't use for real projects |

**Who uses it:** Developers only

---

### Beta (β) — Feature Complete, Testing

**What it means:** "All features are here. We're fixing bugs."

| Use Case | Example |
|---|---|
| Public testing | `v0.2.0-beta` |
| All features present | Everything works (mostly) |
| Bug fixes only | No new features until release |

**Who uses it:** Early adopters, testers

---

### Release Candidate (RC) — Almost Ready

**What it means:** "This could be the final version. Only critical bugs get fixed."

| Use Case | Example |
|---|---|
| Final testing | `v0.3.0-rc1` |
| No known major bugs | Ready for production |
| Only critical fixes | Security, data loss |

**Who uses it:** Beta testers, power users

---

### Stable Release (no label) — Production Ready

**What it means:** "This is the official version. Use it."

| Use Case | Example |
|---|---|
| Official release | `v1.0.0` |
| Fully tested | All features work |
| Long-term support | Bug fixes for 6+ months |

**Who uses it:** Everyone

---

## 3. Version Number Examples

### Studio Pro Version History

| Version | Label | What It Means |
|---|---|---|
| `v0.0.1-alpha` | alpha | First experimental release |
| `v0.0.5-alpha` | alpha | Early features added |
| `v0.0.6-alpha` | alpha | More features |
| `v0.1.0-alpha` | alpha | M0-M5 complete (determinism, FTRT, templates, .spcomp, agent loop, AI panel) |
| `v0.2.0-alpha` | alpha | + Automation layer + docs |
| `v0.3.0-alpha` | alpha | + HTML/CSS/JS clips (planned) |
| `v1.0.0-beta` | beta | Feature complete, testing |
| `v1.0.0-rc1` | rc | Almost ready |
| `v1.0.0` | stable | Official release |

---

## 4. How to Read Version Numbers

### Example: `v0.2.0-beta`

```
v  = version (standard prefix)
0  = MAJOR (no breaking changes yet)
2  = MINOR (second feature set)
0  = PATCH (no bug fixes in this release)
-  = separator
beta = pre-release label (testing phase)
```

### Example: `v1.0.0`

```
v  = version
1  = MAJOR (first stable release)
0  = MINOR (no new features since rc)
0  = PATCH (no bug fixes)
   = no label (stable release)
```

---

## 5. Version Progression

```
v0.0.1-alpha  →  v0.0.2-alpha  →  v0.0.3-alpha  →  ...
     ↓
v0.1.0-alpha  →  v0.1.1-alpha  →  v0.1.2-alpha  →  ...
     ↓
v0.2.0-alpha  →  v0.2.1-alpha  →  ...
     ↓
v1.0.0-beta   →  v1.0.1-beta   →  ...
     ↓
v1.0.0-rc1    →  v1.0.0-rc2    →  ...
     ↓
v1.0.0        (stable release)
     ↓
v1.0.1        (bug fix)
v1.1.0        (new feature)
v2.0.0        (breaking change)
```

---

## 6. Studio Pro's Versioning Strategy

### Current Phase: Alpha (v0.x.x-alpha)

**What we're doing:**
- Adding features rapidly
- Breaking changes are okay
- Not for production use

**Version pattern:**
```
v0.0.x-alpha  = Early development
v0.1.0-alpha  = M0-M5 complete
v0.2.0-alpha  = + Automation
v0.3.0-alpha  = + HTML/CSS/JS
```

---

### Next Phase: Beta (v1.0.0-beta)

**What we'll do:**
- All features complete
- Focus on bug fixes
- Community testing

**When to switch:**
- All planned features done
- No known major bugs
- Ready for public testing

---

### Final Phase: Stable (v1.0.0)

**What we'll do:**
- Official release
- Long-term support
- Backward compatibility guaranteed

**When to release:**
- 3+ months of beta testing
- No critical bugs
- Documentation complete

---

## 7. How Tags Work in Git

### Creating a Tag

```bash
# Lightweight tag (just a pointer)
git tag v0.2.0-alpha

# Annotated tag (with message)
git tag -a v0.2.0-alpha -m "M0-M5 complete + automation"
```

### Pushing Tags

```bash
# Push specific tag
git push origin v0.2.0-alpha

# Push all tags
git push origin --tags
```

### Deleting a Tag

```bash
# Delete locally
git tag -d v0.2.0-alpha

# Delete remotely
git push origin --delete v0.2.0-alpha
```

---

## 8. When to Increment Which Part

### Increment MAJOR When:

- Breaking changes to project format (.spcomp)
- API changes that break existing integrations
- Complete UI redesign
- New rendering engine

**Example:** `v0.3.0-alpha` → `v1.0.0-beta`

---

### Increment MINOR When:

- New features added
- New clip types (HTML/CSS/JS)
- New export modes
- New templates

**Example:** `v0.2.0-alpha` → `v0.3.0-alpha`

---

### Increment PATCH When:

- Bug fixes
- Performance improvements
- Documentation updates
- Security patches

**Example:** `v0.2.0-alpha` → `v0.2.1-alpha`

---

## 9. Pre-Release vs Stable

| Aspect | Pre-Release (alpha/beta/rc) | Stable (no label) |
|---|---|---|
| **Audience** | Developers, testers | Everyone |
| **Stability** | May have bugs | Fully tested |
| **Support** | Limited | Full support |
| **Breaking changes** | Possible | Not allowed |
| **Documentation** | May be incomplete | Complete |
| **Recommended for** | Testing, development | Production use |

---

## 10. Studio Pro's Current Tags

| Tag | Commit | What It Represents |
|---|---|---|
| `v0.0.1-alpha` | 10932fb | Initial release |
| `v0.0.5-alpha` | 78c3fb6 | Early features |
| `v0.0.6-alpha` | b7e7769 | More features |
| `v0.1.0-alpha` | 5fbd8f0 | M0-M5 complete |

### Suggested Next Tags

| Tag | When | What It Represents |
|---|---|---|
| `v0.2.0-alpha` | Now | + Automation layer + docs |
| `v0.3.0-alpha` | +HTML/CSS/JS | + HTML/CSS/JS clips |
| `v1.0.0-beta` | Feature complete | All features, testing phase |
| `v1.0.0` | Official release | Production ready |

---

## 11. Best Practices

### Do This:

1. **Tag every significant release** — Makes it easy to find old versions
2. **Use annotated tags** — Include release notes in the tag
3. **Follow SemVer** — Don't skip version numbers
4. **Document changes** — Update CHANGELOG.md with each release

### Don't Do This:

1. **Don't reuse tag names** — Once deleted, don't create the same tag again
2. **Don't skip versions** — Go from v0.1.0 to v0.2.0, not v0.3.0
3. **Don't force-push tags** — Other users may have pulled them
4. **Don't tag every commit** — Only tag significant releases

---

## 12. CHANGELOG.md Template

```markdown
# Changelog

## v0.2.0-alpha (2026-08-22)

### Added
- Puppeteer automation layer
- Headless Chrome rendering
- Batch video export
- Detailed output filenames

### Changed
- Reorganized docs folder
- Updated README with speed benchmarks

### Fixed
- File extension issue (.ftrt-mp4 → .mp4)

## v0.1.0-alpha (2026-08-20)

### Added
- M0: Deterministic rendering (seeded shake, quantized time)
- M1: FTRT export (4× faster)
- M2: Design templates (one-click restyling)
- M3: .spcomp composition file
- M4: Agent loop (Markdown ↔ .spcomp)
- M5: In-app AI panel (BYO-key)
```

---

## 13. Quick Reference

| Label | Meaning | Stability | Audience |
|---|---|---|---|
| **alpha** | Experimental | Low | Developers |
| **beta** | Feature complete | Medium | Testers |
| **rc** | Release candidate | High | Early adopters |
| **(none)** | Stable | Full | Everyone |

### Version Number Pattern

```
v0.0.x-alpha  = Early development
v0.x.0-alpha  = Feature milestones
v1.0.0-beta   = Testing phase
v1.0.0        = Official release
v1.x.0        = New features
v2.0.0        = Breaking changes
```
