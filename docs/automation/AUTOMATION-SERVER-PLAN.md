# Automation Server Plan — Dedicated Ports

> Automation should NEVER touch the user's personal dev server or Chrome tabs.

---

## The Problem

| What Happens | Why It's Bad |
|---|---|
| Automation uses port 3000 | Conflicts with user's personal Vite server |
| `taskkill //IM chrome.exe //F` | Kills ALL Chrome windows, including user's work |
| Automation reuses user's localStorage | Stale project data, broken state |
| Export modal requires interaction | Headless Chrome can't click buttons reliably |

---

## The Solution: Dedicated Automation Stack

```
User's Personal Stack          Automation Stack (isolated)
─────────────────────          ──────────────────────────
Port 3000 (Vite)               Port 7000 (Vite automation)
Chrome (normal)                 Chrome (puppeteer, separate)
localStorage (personal)        localStorage (automation only)
```

### Port Allocation

| Port | Purpose | Who Uses It |
|---|---|---|
| **3000** | User's personal Vite dev server | Human (never automation) |
| **7000** | Automation Vite dev server | Puppeteer scripts only |
| **3001** | Backup / second personal server | Human (if needed) |

---

## Changes Required

### 1. Automation Dev Server on Port 7000

**New script:** `automation/start-server.js`
```javascript
// Starts a Vite dev server on port 7000 for automation
// Separate from user's personal server on 3000
import { createServer } from 'vite';

const server = await createServer({
    server: { port: 7000, strictPort: true },
    root: '../'  // StudioPro root
});
await server.printUrls();
```

Or simpler — use a dedicated npm script:

**In `studio-pro-editor/package.json`:**
```json
{
  "scripts": {
    "dev": "vite --port 3000",
    "dev:automation": "vite --port 7000"
  }
}
```

### 2. Update Config Files

**`automation/md-render/config.json`:**
```json
{
  "devServerPort": 7000,    // Was: 3000
  "chromePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}
```

**`automation/html-static/api.js`:**
```javascript
// Change default URL from localhost:3000 to localhost:7000
const DEFAULT_URL = 'http://localhost:7000';
```

### 3. Stop Killing ALL Chrome

**Before (bad):**
```bash
taskkill //IM chrome.exe //F  # Kills everything
```

**After (good):**
```javascript
// Only close Puppeteer-managed browser instances
await browser.close();  // Closes only the automation browser

// Or kill by PID, not by name
const pid = browser.process().pid;
process.kill(pid);
```

### 4. Isolate localStorage

Automation should use a separate Chrome user data directory:

```javascript
const browser = await puppeteer.launch({
    headless: true,
    userDataDir: './automation-chrome-profile',  // Isolated profile
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

This way:
- User's Chrome on port 3000 keeps their projects
- Automation Chrome on port 7000 has its own clean state
- No cross-contamination

### 5. Pre-warm Server for Speed

Instead of starting a new server for every render:

```bash
# Start automation server once (in background)
npm run dev:automation &

# Then run renders (reuse existing server)
node md-render/render.js scripts/social-short.md
node html-static/render.js examples/simple-test.js
```

Or auto-start in render.js:

```javascript
async function ensureServer(port) {
    if (await checkPort(port)) return; // Already running
    // Start server in background
    spawn('npm', ['run', 'dev:automation'], { detached: true, stdio: 'ignore' });
    // Wait for it to be ready
    await waitForPort(port, 10000);
}
```

---

## Updated Render Commands

```bash
# Personal use (user's server on 3000)
# — Just use the editor GUI, no automation needed

# Automation (dedicated server on 7000)
cd automation

# 1. Start automation server (once, keep running)
cd .. && npm run dev:automation &
cd automation

# 2. Render MD → Video
node md-render/render.js scripts/social-short.md

# 3. Render HTML → Video
node html-static/render.js html-static/examples/simple-test.js

# 4. Render HTML Animated → Video (future)
node html-waapi/render.js html-waapi/examples/animated-slide.js
```

---

## Safety Rules

| Rule | Implementation |
|---|---|
| **Never kill user's Chrome** | Use `browser.close()` not `taskkill` |
| **Never use port 3000** | Config hardcoded to 7000 |
| **Never touch user's localStorage** | Separate `userDataDir` |
| **Never modify user's project** | Automation server is read-only for user files |
| **Always clean up** | `finally { await browser.close(); }` |

---

## Speed Improvements

| Before | After | Speedup |
|---|---|---|
| Start new Chrome per render | Reuse existing Chrome | ~2s faster |
| Start new Vite server per render | Pre-warmed server on 7000 | ~3s faster |
| Wait for page load every time | Cache page, navigate between renders | ~1s faster |
| Kill + restart Chrome on error | Retry with same browser | ~2s faster |

**Estimated improvement: 8-10 seconds per render** (from ~15s to ~5-7s)

---

## Implementation Order

| Phase | What | Effort |
|---|---|---|
| 1 | Add `dev:automation` script to package.json | 5 min |
| 2 | Update config.json to port 7000 | 5 min |
| 3 | Update api.js default URL to 7000 | 5 min |
| 4 | Add `userDataDir` to Puppeteer launch | 15 min |
| 5 | Replace `taskkill` with `browser.close()` | 30 min |
| 6 | Add server auto-start in render.js | 30 min |
| 7 | Test both servers running simultaneously | 15 min |

**Total: ~1.5 hours**

---

## Future: Unified CLI

```bash
# One command to rule them all
automation/render md scripts/social-short.md
automation/render html examples/simple-test.js
automation/render waapi examples/animated-slide.js

# With options
automation/render md scripts/social-short.md --quality ultra --mode ftrt
automation/render html examples/simple-test.js --debug  # Show Chrome
```

This single CLI would:
1. Auto-detect if automation server is running on 7000
2. Start it if not
3. Route to the correct pipeline (md-render, html-static, html-waapi)
4. Clean up after itself
