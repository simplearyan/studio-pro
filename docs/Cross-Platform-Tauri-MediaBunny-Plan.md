# Cross-Platform App Plan — Webview vs Chrome decode, Tauri, and MediaBunny

> Status: **PLANNING** — no code changes; answers to the "will Tauri fix it?" question.
> Scope: documents the measured webview-vs-Chrome discrepancy, what a future Tauri desktop + mobile
> rebuild (HTML/CSS/Tailwind + MediaBunny canvas + JS) means for it, and whether MediaBunny exports work on each platform.
> Date: 2026-08-08

---

## 1. The observation (measured)

During the corrupt-video investigation (see `docs/Video-Stream-Stability-Plan.md` §3.3), we instrumented the recovery
branch and ran **380 scrub events** (including a real ruler mouse-drag session, `mousedown → mousemove → mouseup`)
on the two damaged H.264 files:

| Environment | Result |
|---|---|
| **Freebuff preview webview** (Chromium-based, **software** H.264 decode) | **0 decode errors** — scrubbing the exact corrupt GOPs (0.2–7.5 s) never breaks; frame always paints |
| **Chrome** (user's machine, **hardware-accelerated** H.264 decode) | **`MEDIA_ERR_DECODE` (code 3)** — after enough scrubbing the `<video>` enters error state and the canvas shows the **gradient mock placeholder** until recovery recreates the element |

Same bytes, same app code, different decoder behavior. This is not an editor bug — it is a **decoder strictness**
difference:

- **Software decode** (ffmpeg libavcodec, or Chromium without HW accel) *tolerates and recovers*: the bad frame is
  skipped / concealed, decode continues.
- **Hardware decode** (Chrome/Edge GPU pipeline via DXVA/D3D11; also WebCodecs) treats the same corrupt reference
  chain as **fatal** and surfaces `MEDIA_ERR_DECODE`.

The files themselves are the problem: `We are making a feature film!_1080p.mp4` and `4 easy cuts…1080P.mp4` (both
vidssave-downloaded) have structurally damaged H.264 streams — ffprobe reports
`illegal short term buffer state detected` at ~4.6–6.5 s.

---

## 2. The future app (what we want to build)

A rebuild of this project:

- **Stack:** plain HTML + CSS + Tailwind + **MediaBunny canvas** + vanilla JS (same as today — the editor is a single
  `index.html` + `src/workers/export-worker.js`).
- **Shell:** **Tauri** desktop app.
- **Targets (aspirational):** Windows, macOS, Linux desktop — plus **iOS and Android** mobile.
- **Export:** MediaBunny WebCodecs pipeline (already in `src/workers/export-worker.js`, gated by `checkChromium()` today).

---

## 3. Will Tauri solve the corrupt-video issue? (Short answer: not by itself)

**Tauri does not change the decoder.** Tauri only wraps your web app in the **OS's native webview**. Which decoder you
get depends entirely on that webview, and it differs per platform:

| Platform | Tauri v2 webview (via WRY) | H.264 decoder | Does the corrupt-file error recur? |
|---|---|---|---|
| **Windows** | Edge **WebView2** (Chromium) | Same Chromium media stack + hardware accel as Chrome/Edge (DXVA/D3D11) | ❌ **YES — same `MEDIA_ERR_DECODE`**, same mock fallback. WebView2 ≈ Chrome. |
| **macOS** | **WKWebView** (WebKit) | Apple **VideoToolbox** HW decoder | ✅ Probably **no** — WebKit/VideoToolbox is more lenient, conceals corrupt macroblocks instead of failing fatally |
| **Linux** | **WebKitGTK** (webkit2gtk-4.1) | Software/VA-API depending on distro build | ⚠️ Unpredictable — decoder leniency varies; software decode is likely tolerant |
| **Android** | Android **System WebView** (Chromium) | Chromium + HW accel on supported devices | ❌ **YES — same fatal decode error** on many devices |
| **iOS** | **WKWebView** (WebKit) | Apple **VideoToolbox** HW decoder | ✅ Probably **no** — same leniency as macOS |

**Conclusion:** moving to Tauri is *not* a fix for Windows/Android — there the exact bug would ship with the app.
The fix must live at the **app level**, independent of the shell:

1. **Repair the source** (the real fix): re-mux / re-encode the damaged file into a clean stream (fresh IDRs every
   2 s) on import. In a Tauri app this is trivial and fast — ship a small **native ffmpeg sidecar** (Tauri can invoke
   a bundled binary; no 30 MB wasm, no browser sandbox). One command: `ffmpeg -i bad.mp4 -c:v libx264 -x264-params
   keyint=48 -c:a aac clean.mp4`. Replace the clip source with the repaired file. **This solves it on every platform,
   including Windows.**
2. **Keyframe-aware seeking** (already planned in `Video-Stream-Stability-Plan.md` Phase 2): snap scrubs to the
   previous IDR so decode always restarts from a clean reference. Cheap, browser-only, works everywhere.
3. **Smarter recovery** (Phase 1): classify error codes, keep the last good frame so the mock never flashes, retry
   with backoff. Mitigates UX, doesn't fix the bytes.

> Nuance worth knowing: the **MediaBunny preview canvas** is not affected by this at all — the corruption only hits
> the `<video>` decode path. But MediaBunny's *export* decode uses WebCodecs, which on Windows/Android decodes with
> the **same strict HW decoder**, so a broken file can also stall/abort a MediaBunny export. Repairing on import fixes
> preview **and** export together.

---

## 4. Will MediaBunny still work inside Tauri (desktop + mobile)?

MediaBunny (`@mediabunny/*`, the library already imported in `src/workers/export-worker.js`) requires:
**WebCodecs** (`VideoEncoder`/`VideoDecoder`), **Canvas API**, **Streams API**, ES2021+. Per-platform availability:

| Platform | WebCodecs in the webview | MediaBunny export works? | Hardware-accelerated encode? |
|---|---|---|---|
| **Windows (WebView2)** | ✅ Full support | ✅ Yes | ✅ Yes (NVENC / Intel QuickSync / AMF via Chromium) |
| **macOS (WKWebView)** | ✅ Safari 16.4+ / Ventura+ | ✅ Yes | ✅ Yes (VideoToolbox / Apple Silicon encoders) |
| **Linux (WebKitGTK)** | ⚠️ Lagging / often disabled or partial | ⚠️ Unreliable — needs a WASM coder or ffmpeg sidecar fallback | ⚠️ Depends on build |
| **Android (System WebView)** | ✅ Chromium supports it (recent versions) | ✅ Yes on modern WebViews | ✅ Yes on capable devices (vendor HW encoders) |
| **iOS (WKWebView)** | ✅ Safari/iOS 16.4+ (H.264 encode nuances refined in later releases) | ✅ Yes on modern iOS | ✅ Yes (VideoToolbox) |

So: **yes, MediaBunny works in Tauri on Windows, macOS, and modern Android/iOS** — giving fast, hardware-accelerated
MP4 export everywhere except older Apple OSes and (flaky) Linux WebKitGTK.

### Recommended export strategy for the future app

1. **Primary:** MediaBunny WebCodecs export (today's `export-worker.js`, already format-capable — MP4/WebM/Fast Start).
   Fast, hardware-accelerated, zero extra dependencies. Keep the existing `checkChromium()`-style gate but broaden it
   to a WebCodecs capability check.
2. **Fallback where WebCodecs is missing (Linux WebKitGTK, old iOS):**
   - **In Tauri:** shell out to the bundled **ffmpeg sidecar** — usually *faster* and more codec-complete than
     browser encoders, and the natural choice for a desktop app.
   - **In plain browser:** the existing `MediaRecorder` fallback (still in `index.html` ~21286).
3. **Capability sniff at startup** and switch export backends automatically (WebCodecs → ffmpeg sidecar → MediaRecorder).

---

## 5. Why Tauri is still a good idea despite not fixing the decoder

- **Repair tooling:** native ffmpeg sidecar makes "Repair video" (plan Phase 4) a one-liner instead of a huge
  in-browser WebCodecs re-encode project.
- **File access:** direct filesystem reads/writes via Tauri commands — no `<input type="file">` / blob round-trips,
  faster import of large videos, no browser storage limits.
- **Performance:** your own WebView window, no tab overhead; optional multi-process worker tuning.
- **Distribution:** one codebase → Windows/macOS/Linux + iOS/Android, sharing the entire editor UI + MediaBunny
  pipeline.

---

## 6. What this means for the current project (actionable)

Nothing here changes the current browser editor — the webview/Chrome discrepancy is already documented in
`Video-Stream-Stability-Plan.md`. The ordering for the future app:

1. **Keep** the editor as-is (HTML/Tailwind/JS + MediaBunny canvas + `export-worker.js`).
2. **When building the Tauri shell:** add the ffmpeg sidecar + "Repair on import" — this is what actually kills the
   corrupt-video bug on Windows/Android.
3. **Don't assume WebView2 ≠ Chrome** — validate decode behavior on the *target* webview, not the dev browser.
4. **Export:** MediaBunny everywhere WebCodecs exists; ffmpeg sidecar on Linux/old-Apple; MediaRecorder as last resort.

---

## 7. Open questions to validate during the Tauri prototype

- [ ] WebView2 H.264 HW decode actually reproduces `MEDIA_ERR_DECODE` on the two demo files (expected: yes).
- [ ] WKWebView (macOS/iOS) actually plays the two demo files cleanly (expected: yes, per WebKit leniency).
- [ ] ffmpeg sidecar repair time for a ~16 MB / 70 s demo file (expected: well under a second; measure it).
- [ ] WebCodecs availability in WebKitGTK on the target distro (Ubuntu/Fedora) — if absent, confirm ffmpeg fallback path.
- [ ] MediaBunny H.264 encode on iOS WKWebView — verify actual encode support on the minimum supported iOS target.
