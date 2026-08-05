# 💰 Commercial Licensing Strategy — Studio Pro

**The goal:** make money from Studio Pro via (1) ads during export, (2) a community marketplace where users share/sell presets, and (3) a subscription for an agentic automation mode (markdown generation + GitHub Actions).

This replaces the plain-MIT recommendation in [LICENSE_RECOMMENDATION.md](LICENSE_RECOMMENDATION.md). It answers: **which license lets us run this business while keeping the project attractive to contributors?**

---

## 🏢 Your Business Model (the "moat" question)

| Revenue stream | Where it lives | Can a competitor copy it? |
|---|---|---|
| **Ads during export** | Client-side, in-app | ⚠️ Yes — if the whole editor is permissively licensed, anyone can fork and ship their own ads |
| **Preset marketplace** | **Server-side** (accounts, payments, ratings, search) | ❌ No — it's a service, not code in the repo |
| **Subscription automation** (agentic markdown + GitHub Actions) | **Server-side** + proprietary client glue | ❌ Mostly no — the automation engine and GH Actions runner are cloud services |
| **Brand, community, presets, tutorials** | Ecosystem | ❌ No — community lock-in is the strongest moat |

**Key insight:** everything that *requires a server* (marketplace, subscriptions, accounts, cloud rendering, GH Actions) is **automatically protected** — no license can hand that away, because it isn't in the repo. The license only decides who can take the **editor code itself**.

So the real question narrows to: *"Do we want competitors to be able to fork the editor and sell their own competing version/SaaS with it?"*

- If the answer is **"no"** → use a **copyleft or source-available** license for the editor.
- If the answer is **"yes, as long as our SaaS is better"** → MIT is fine (open-core strategy, like VS Code / WordPress).

Given you plan to run ads *inside the editor* and sell subscriptions, the honest answer is **no** → **don't use MIT.**

---

## 🎯 Recommendation: **MPL-2.0 for the editor + proprietary SaaS layer**

### The split (this is the whole strategy)

```
┌─────────────────────────────────────────────────────────────┐
│  STUDIO PRO EDITOR (open source, MPL-2.0)                    │
│  · Timeline, canvas, markdown generator, animations, math    │
│  · Export engine (client-side MediaBunny)                    │
│  · Ad SDK integration (client-side hooks)                    │
├─────────────────────────────────────────────────────────────┤
│  STUDIO PRO CLOUD (proprietary — separate repo/service)      │
│  · Accounts, auth, billing, subscriptions                    │
│  · Preset marketplace (store, payments, ratings, reviews)    │
│  · Agentic automation engine + GitHub Actions integration    │
│  · Cloud export/render queue, sync, sharing                  │
└─────────────────────────────────────────────────────────────┘
```

### Why MPL-2.0 wins for this exact case

1. **File-level copyleft = fork protection.** Anyone who modifies and distributes the editor **must open-source their changes** (MPL-2.0). A competitor can't silently take our editor, add their own ads, and close-source it. Our own copyright on the files still lets *us* do closed commercial things with our own code — MPL binds *distributors*, not the copyright owner.
2. **SaaS loophole closed at the file level.** If a competitor wants to host a competing *editor SaaS*, every editor file they serve is "distributed," so they owe us source + their changes. That kills the "free-ride SaaS" attack for the editor itself.
3. **Perfect fit with MediaBunny (already MPL-2.0).** One consistent license story; no conflict, no dual-license bookkeeping.
4. **Still community-friendly.** Contributors keep their file contributions under MPL; users can fork and modify freely for their own use. This is exactly what **Mozilla, Thunderbird, and (historically) parts of the Firefox ecosystem** do.
5. **Ads are legal & easy.** MPL-2.0 places zero restrictions on running ads inside the app. Ad-blocking is a *business* risk, not a license risk.

### What the marketplace needs (and how MPL handles it)

- Preset files themselves are **user-generated content, not our code** → put a **separate license/terms on user uploads** (e.g., "you grant buyers a non-exclusive license to use your preset; you retain ownership"). The MPL only governs the editor's source files.
- The **marketplace service** (API, payments, auth) lives in the proprietary cloud repo → fully protected regardless of the editor's license.
- Use a **"Paid preset" content license** (e.g., standard marketplace terms) + a **free-presets section** under CC-BY or MIT for the community ones.

### What the subscription needs

- The subscription **entitles users to cloud features** — nothing about MPL prevents selling access to servers.
- The agentic automation "mode" in the editor can be a **thin proprietary extension** (separate file/module) that calls our proprietary API. MPL-2.0 only applies to *our* files in the open repo; the extension is a separate proprietary artifact (much like how VS Code ships proprietary bits alongside MIT parts).

---

## 📊 License options compared (for this business)

| License | Ads in app? | Sell SaaS/subscription? | Competitor fork protection | Contributor friendliness | Notes |
|---|---|---|---|---|---|
| **MIT/Apache** | ✅ | ✅ | ❌ none | ⭐⭐⭐⭐⭐ | Only if you accept fork competition (open-core bet) |
| **MPL-2.0** ✅ recommended | ✅ | ✅ | ✅ file-level | ⭐⭐⭐⭐ | Best balance for this exact plan |
| **GPL-3.0** | ✅ | ✅ | ✅ strong | ⭐⭐ | Heavy; scares contributors; overkill for a browser app |
| **AGPL-3.0** | ✅ | ✅ (network copyleft) | ✅✅ strongest | ⭐ | Kills the "SaaS loophole" entirely but reads as hostile to contributors & integrations |
| **BUSL 1.1** (source-available) | ✅ | ✅ | ✅✅ | ⭐⭐ | "Source-available" not "open source" — no OSI badge; converts to a real license after X years; needs an **Additional Use Grant** |
| **PolyForm Noncommercial** | ⚠️ | ⚠️ | ✅✅ | ⭐ | Can't sell or show ads under it — **wrong choice** for us |
| **Elastic License 2.0** | ✅ | ✅ | ✅ (except SaaS/embed) | ⭐⭐ | Can't offer it as a managed SaaS — too restrictive for our own plans |
| **Dual-license (open core)** | ✅ | ✅ | ⚠️ depends | ⭐⭐⭐ | Core MIT + premium code proprietary — viable if you want mass adoption |

### Why NOT BUSL / Elastic / PolyForm for now

- **BUSL 1.1** is the *"I want it open but I want to control commercial use"* option — you'd add an **Additional Use Grant** (e.g., "free for non-commercial and personal use; commercial use requires a license"). It's used by Sentry, MariaDB, and CockroachDB. But: it's **not OSI-approved** ("source-available," not "open source"), which shrinks your contributor base and gets you removed from most FOSS directories. Save it for the **cloud-specific modules** later if you want.
- **PolyForm Noncommercial** outright **forbids** commercial use — you can't even run ads. It's the opposite of what you want.
- **Elastic License** forbids offering the software as a managed service — it would block *your own* future plans.

---

## 🗺 Recommended plan (phased)

### Phase 1 — Launch open (now)
- License the editor **MPL-2.0** (one file, `LICENSE`).
- Keep the **marketplace + accounts + subscriptions** in a **separate private repo** from day one — never mix cloud code into the public repo.
- Add a **`NOTICE`** crediting MediaBunny (MPL-2.0), MathJax (Apache-2.0), Lucide (ISC).
- Set **Terms of Service + Marketplace Terms** for user content (presets): users retain ownership of presets, grant buyers a license, and grant **you** a license to host/distribute them.

### Phase 2 — Add monetization
- **Ads in export:** fine under MPL. Ship an in-app "support us" + ad placeholder; swap in a real ad SDK when you're ready. (Ad SDKs ship as **proprietary third-party JS** — that's normal and doesn't touch MPL files.)
- **Marketplace:** the editor talks to `api.studiopro.app`; all value is server-side.

### Phase 3 — Subscription automation (agentic + GitHub Actions)
- Agentic automation = **server-side engine** (proprietary) + a **thin client extension** (separate proprietary file, or a stub in the MPL repo that calls our API).
- GitHub Actions integration is inherently a cloud service (Actions *runs* on GitHub's infra) — fully protected.
- If you later want the *automation engine itself* to be downloadable code, move it to **BUSL 1.1 with an Additional Use Grant** in its own repo — the editor stays MPL.

### What to do in every phase
- **Trademark the name** ("Studio Pro" as a brand, logo) — licenses don't protect names; **trademark law does.** Register/claim it so forks must rename.
- Keep **copyright assignment/CLA** out unless a contributor asks for it (MPL makes CLAs unnecessary).

---

## 🧾 The one-paragraph answer

> License the **editor under MPL-2.0**, keep **all cloud/marketplace/subscription code in a separate proprietary repo**, and rely on **server-side value + trademarks** for the moat. MPL gives you fork protection (file-level copyleft), stays fully compatible with MediaBunny's MPL, lets you show ads and sell subscriptions with zero restrictions, and keeps contributors happy. Only reach for BUSL 1.1 later if you need to distribute *downloadable* premium code.

---

## ✅ Action Items

1. Create `LICENSE` with **MPL-2.0** text (`Copyright (c) 2026 Simple Aryan`).
2. `package.json`: `"license": "MPL-2.0"`.
3. Create a **private** `studio-pro-cloud` repo skeleton (auth, billing, marketplace API) — never published.
4. Write **Marketplace Terms** (user-owned presets, buyer license, host license for you) + a **Terms of Service** + **Privacy Policy**.
5. Trademark "Studio Pro" name/logo.
6. Update README + CONTRIBUTING to say "editor is MPL-2.0; cloud features are proprietary services."
7. (Later) If distributing premium automation code: **BUSL 1.1 + Additional Use Grant** in its own repo.

---

## ⚠️ Risks to know

- **Ad-blockers** will cut ad revenue — design the export "watch an ad to export free / skip with subscription" flow to be robust (graceful fallback, opt-in).
- **MPL ≠ AGPL:** a competitor could still host our *exact unmodified* editor as a service (MPL's distribution trigger for SaaS is debated). Their *modified* files must be shared, but unmodified hosting is gray. If that specific attack materializes, flip the editor (or a premium tier) to **AGPL-3.0** — the nuclear option that closes the SaaS loophole completely.
- **Community backlash** — some devs dislike non-permissive licenses. MPL is the least-bad middle ground; clearly explain *why* (funding the product) in your README.

---

## 📚 References

- MediaBunny (MPL-2.0): https://github.com/Vanilagy/mediabunny · https://mediabunny.dev/
- MPL-2.0: https://www.mozilla.org/en-US/MPL/2.0/
- BUSL 1.1: https://busl.io/ · https://github.com/safarijv/busl-1.1
- PolyForm licenses: https://polyformproject.org/
- Elastic License 2.0: https://www.elastic.co/licensing/elastic-license
- Real-world examples: Sentry (BUSL→MIT after 5 years), MariaDB (BUSL), CockroachDB (BUSL), GitLab (MIT core + EE proprietary), VS Code (MIT core + proprietary bits)
