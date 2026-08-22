# Automation Documentation

> Puppeteer-based video automation for Studio Pro

## Overview

Studio Pro can render videos from the terminal using markdown/JSON scripts with system Chrome headless. Based on the canvas-labs-portal preview-automator approach.

## Quick Links

| Document | Description |
|---|---|
| [Puppeteer-Automation-Plan.md](./Puppeteer-Automation-Plan.md) | Original architecture and implementation plan |
| [Test-Report.md](./Test-Report.md) | Full test results with speed benchmarks |
| [FTRT-Test-Results.md](./FTRT-Test-Results.md) | FTRT (Fast) mode detailed benchmarks |
| [Headless-Test-Results.md](./Headless-Test-Results.md) | Headless vs visible Chrome comparison |
| [CanvasLabs-Analysis.md](./CanvasLabs-Analysis.md) | Analysis of canvas-labs-portal approach |

## Speed Summary

| Mode | Speed | Best For |
|---|---|---|
| **FTRT** | **4× realtime** | Long videos (>30s), batch |
| **MediaBunny** | 1× realtime | Short videos (<30s) |
| **Standard** | 1× realtime | Fallback |

## Key Findings

1. **FTRT is 4× faster** than MediaBunny for text/markdown content
2. **Both modes work in headless: true** — no GPU needed for CI/CD
3. **Dev server required** — automation connects to running Vite server
4. **canvas-labs-portal approach** — same pattern, proven in production

## Usage

```bash
# 1. Start dev server
cd studio-pro-editor && npm run dev

# 2. Run automation
cd automation
node render.js scripts/product-launch.md
```

## Related Documentation

- `automation/README.md` — Full CLI reference and usage guide
- `docs/export/` — Export modes and quality comparison
- `docs/features/` — Feature implementation plans
