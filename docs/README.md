# Studio Pro Documentation

> Complete documentation for Studio Pro editor and automation

## Quick Navigation

### 🎬 Automation
**[automation/](./automation/)** — Terminal video rendering with Puppeteer

| Document | Description |
|---|---|
| [automation/README.md](./automation/README.md) | CLI reference, usage, benchmarks |
| [Puppeteer-Automation-Plan.md](./automation/Puppeteer-Automation-Plan.md) | Architecture and implementation |
| [Test-Report.md](./automation/Test-Report.md) | Full test results |
| [FTRT-Test-Results.md](./automation/FTRT-Test-Results.md) | FTRT mode benchmarks |
| [Headless-Test-Results.md](./automation/Headless-Test-Results.md) | Headless mode analysis |
| [CanvasLabs-Analysis.md](./automation/CanvasLabs-Analysis.md) | canvas-labs-portal comparison |

### 📦 Export
**[export/](./export/)** — Video export modes and quality

| Document | Description |
|---|---|
| [MediaBunny-vs-FFmpeg.md](./export/MediaBunny-vs-FFmpeg.md) | Encoder comparison |
| [Encoding-Comparison.md](./export/Encoding-Comparison.md) | Sharp vs MediaBunny vs FFmpeg |
| [FTRT-Probe-Comparison.md](./export/FTRT-Probe-Comparison.md) | FTRT probe results |
| [Bitrate-Quality-Plan.md](./export/Bitrate-Quality-Plan.md) | Bitrate presets |
| [Bitrate-Quality-Real-Tests.md](./export/Bitrate-Quality-Real-Tests.md) | Real-world bitrate tests |

### 🧩 Features
**[features/](./features/)** — Feature implementation plans

| Document | Description |
|---|---|
| [Export-Modal-Clean-Redesign-Plan.md](./features/Export-Modal-Clean-Redesign-Plan.md) | Export modal redesign |
| [URL-Media-Auto-Load-Plan.md](./features/URL-Media-Auto-Load-Plan.md) | URL media auto-loading |
| [Multi-Project-Save-Load-Plan.md](./features/Multi-Project-Save-Load-Plan.md) | Multi-project support |
| [Scene-Composition-Feature.md](./features/Scene-Composition-Feature.md) | Scene composition |

### 📝 Captions
**[captions/](./captions/)** — Subtitle and caption system

| Document | Description |
|---|---|
| [Captions-Subtitles-Feature.md](./captions/Captions-Subtitles-Feature.md) | Captions feature overview |
| [Caption-Style-Unification.md](./captions/Caption-Style-Unification.md) | Style unification plan |

### 🎥 Video
**[video/](./video/)** — Video playback and seeking

| Document | Description |
|---|---|
| [Video-Seek-Accuracy-Plan.md](./video/Video-Seek-Accuracy-Plan.md) | Seek accuracy improvements |
| [Video-Scrub-Recovery-Fix.md](./video/Video-Scrub-Recovery-Fix.md) | Scrub recovery fix |
| [Video-Stream-Stability-Plan.md](./video/Video-Stream-Stability-Plan.md) | Stream stability |

### 🤖 Agent Authoring
**[hyperframes/](./hyperframes/)** — AI/agent video generation

| Document | Description |
|---|---|
| [Agent-Authoring-and-Automation-Plan.md](./hyperframes/Agent-Authoring-and-Automation-Plan.md) | Full automation plan |
| [AGENTS.md](./hyperframes/AGENTS.md) | Agent contract |
| [M0-Determinism-Spec.md](./hyperframes/M0-Determinism-Spec.md) | Deterministic core |
| [M1-FTRT-Export-Plan.md](./hyperframes/M1-FTRT-Export-Plan.md) | FTRT export plan |
| [M3-Spcomp-Spec.md](./hyperframes/M3-Spcomp-Spec.md) | .spcomp format |
| [M5-AI-Panel-Spec.md](./hyperframes/M5-AI-Panel-Spec.md) | AI panel |

### 📊 Analysis
**[hyperframes/](./hyperframes/)** — Comparison and analysis

| Document | Description |
|---|---|
| [StudioPro-vs-Hyperframes-vs-Remotion.md](./hyperframes/StudioPro-vs-Hyperframes-vs-Remotion.md) | Tool comparison |
| [HyperFrames-Deep-Dive.md](./hyperframes/HyperFrames-Deep-Dive.md) | HyperFrames analysis |
| [GPU-Crash-Analysis-and-Plan.md](./hyperframes/GPU-Crash-Analysis-and-Plan.md) | GPU crash fixes |

### 💰 Funding & Legal
**[funding/](./funding/)** — Business and licensing

| Document | Description |
|---|---|
| [OpenSource-Funding-Strategy.md](./funding/OpenSource-Funding-Strategy.md) | Funding strategies |
| [LICENSE_STRATEGY_COMMERCIAL.md](./funding/LICENSE_STRATEGY_COMMERCIAL.md) | Commercial licensing |
| [LICENSE_RECOMMENDATION.md](./funding/LICENSE_RECOMMENDATION.md) | License recommendations |

## Folder Structure

```
docs/
├── README.md                 # This file (index)
├── automation/               # Puppeteer automation
│   ├── README.md
│   ├── Puppeteer-Automation-Plan.md
│   ├── Test-Report.md
│   ├── FTRT-Test-Results.md
│   ├── Headless-Test-Results.md
│   └── CanvasLabs-Analysis.md
├── export/                   # Export modes and quality
│   ├── MediaBunny-vs-FFmpeg.md
│   ├── Encoding-Comparison.md
│   └── ... (10+ docs)
├── features/                 # Feature implementation
│   ├── Export-Modal-Clean-Redesign-Plan.md
│   └── ... (20+ docs)
├── captions/                 # Subtitle system
│   ├── Captions-Subtitles-Feature.md
│   └── ... (4 docs)
├── video/                    # Video playback
│   ├── Video-Seek-Accuracy-Plan.md
│   └── ... (8 docs)
├── hyperframes/              # Agent authoring
│   ├── Agent-Authoring-and-Automation-Plan.md
│   ├── AGENTS.md
│   └── ... (15+ docs)
└── funding/                  # Business
    ├── OpenSource-Funding-Strategy.md
    └── ... (4 docs)
```

## Related Files

- `README.md` — Project root README
- `automation/README.md` — Full CLI reference
- `CONTRIBUTING.md` — Contribution guidelines
