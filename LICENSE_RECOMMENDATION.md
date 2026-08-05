# 📜 License Recommendation — Studio Pro

> ⚠️ **UPDATE:** This document analyzes the *pure open-source* case. We now plan to monetize the product (ads in export, a preset marketplace, and a subscription automation tier) — read the updated **[Commercial Licensing Strategy](LICENSE_STRATEGY_COMMERCIAL.md)** first; it supersedes the MIT recommendation below.

This document analyzes what license Studio Pro should use, with a focus on how the **MediaBunny** dependency (MPL-2.0) affects the choice.

---

## 🔍 MediaBunny's License (MPL-2.0)

| | |
|---|---|
| **Project** | MediaBunny — pure-TypeScript media toolkit (WebCodecs video/audio encode + MP4/WebM/MOV/MKV reading & writing) |
| **License** | **Mozilla Public License 2.0 (MPL-2.0)** |
| **Website** | https://mediabunny.dev/ |
| **GitHub** | https://github.com/Vanilagy/mediabunny |

### What MPL-2.0 actually requires

MPL-2.0 is a **weak copyleft / file-level copyleft** license. The key rules:

1. **Using MediaBunny unmodified (our situation)** — we bundle the library as a dependency and do not modify its source files. In this case MPL-2.0 requires only:
   - Preserve copyright notices and the license text for the MediaBunny files.
   - Make the library source available to recipients (a link to the GitHub repo is enough).
   - **No obligation to open-source Studio Pro's own code.**

2. **Modifying MediaBunny's files** — only *if* we edited the actual MediaBunny source files would those modified files need to be released under MPL-2.0 (and even then, only those files — not our whole project).

3. **Trademark** — we can't use the "MediaBunny" name/branding for our own product without permission (linking to it as a library is fine).

### ⚖️ What this means for us

- Studio Pro is **free to choose its own license** — MPL-2.0 does **not** infect the project.
- We can be **closed-source, commercial, MIT, Apache-2.0, GPL, or anything** — MediaBunny only cares about its own files.
- The only *practical* obligations: keep the `mediabunny` package unmodified (or wrap it), and mention the MPL-2.0 notice in our NOTICE/README.

---

## 🏆 Recommendation: **MIT License** (with an optional Apache-2.0 alternative)

| Criterion | MIT | Apache-2.0 | GPL-3.0 | MPL-2.0 |
|---|---|---|---|---|
| Permissive for users & contributors | ✅ | ✅ | ❌ (copyleft) | ⚠️ (file-level) |
| Allows closed-source/commercial use | ✅ | ✅ | ❌ | ✅ |
| Patent protection for contributors | ❌ | ✅ | ✅ | ⚠️ |
| Simple to understand | ✅ Best | ✅ | ❌ | ⚠️ |
| Compatible with MPL-2.0 dependency | ✅ | ✅ | ✅ | ✅ |
| Community adoption | 🔥 Most popular | 🔥 | ❄️ | ⚠️ |

### Why MIT is the right fit

1. **It's a creative tool.** Creators, YouTubers, agencies, and other devs should be able to embed, fork, extend, or even commercialize the editor without legal anxiety. MIT maximizes adoption and contributions — which is exactly what a solo/indie project needs most.
2. **MPL-2.0 dependency is a non-issue.** MIT + a bundled MPL-2.0 library coexist perfectly (this is the same combination used by countless popular projects). We just keep MediaBunny unmodified and credit it.
3. **Zero maintenance.** No per-file headers, no copyleft tracking, no dual-licensing decisions. One short file.
4. **Consistent with the ecosystem.** The project already ships with a bare `ISC` license in `package.json` — MIT is the modern, widely-recognized default and a trivial one-line change.

### When you might prefer Apache-2.0 instead

If the project grows a **patent portfolio** or you want an explicit patent grant for contributors, Apache-2.0 gives you that with nearly the same permissiveness. The rest of this document assumes **MIT**, but the MediaBunny analysis is identical for Apache-2.0.

### What to do if you go closed-source later

Even then, MPL-2.0 is not a blocker — just keep crediting MediaBunny per its license. No changes to our code are required.

---

## ✅ Action Items

1. **Create `LICENSE`** — MIT text with `Copyright (c) 2026 Simple Aryan (simplearyan)`.
2. **Update `package.json`** — change `"license": "ISC"` → `"license": "MIT"`.
3. **Add a `NOTICE` or README section** crediting dependencies:
   - **MediaBunny** (https://github.com/Vanilagy/mediabunny) — MPL-2.0, used unmodified.
   - **MathJax** (https://www.mathjax.org/) — Apache-2.0.
   - **Lucide** (https://lucide.dev/) — ISC.
4. **Add a `SECURITY.md`** pointing to GitHub issues/private reports (optional but nice).
5. Reference **CONTRIBUTING.md** from the README so new contributors see the workflow.

---

## 📚 References

- MediaBunny GitHub (with MPL-2.0): https://github.com/Vanilagy/mediabunny
- MediaBunny website: https://mediabunny.dev/
- MPL-2.0 full text: https://www.mozilla.org/en-US/MPL/2.0/
- MPL-2.0 FAQ: https://www.mozilla.org/en-US/MPL/2.0/FAQ/
