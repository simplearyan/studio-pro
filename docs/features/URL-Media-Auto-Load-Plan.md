# Plan: Auto-Load URL-Based Media on Project Open (Markdown URLs + Pasted/Clipboard Images)

**Status:** plan only — nothing implemented yet.
**Goal:** when a project is opened (or the app is refreshed), image/video clips whose source is a **URL** — markdown `![alt](https://...)` images, pasted clipboard images, and URL-imported images — load automatically instead of appearing as "missing media" and forcing a markdown re-generate or manual re-import.

---

## 1. Problem statement (two paths, one root cause)

### Path A — Markdown URL images
Generate markdown with `![alt](https://example.com/pic.jpg)`:

- `mdImageClip` (index.html:20439) sets `fileUrl: img.url` and a live `imageEl` (`new Image()` with `src = url`).
- **Save:** `clipToJSON` (26892) skips `fileUrl` because it's in `PROJECT_RUNTIME_FIELDS` (26795) — the URL is dropped from the project JSON. `imageEl`/`videoEl` are runtime fields too, also dropped.
- **Open:** `restoreClip` (26947) sees a file-backed image/video with no stored file → `isPlaceholder = true`, `_missingMedia = true`, `delete clip.fileUrl`.
- Result: the URL image shows as **missing media** ("RE-IMPORT MEDIA" placeholder + re-import modal count) even though it's a perfectly fetchable URL. The only recovery today is re-generating the markdown.

### Path B — Pasted / clipboard images
Paste a copied image (or import via URL):

- The global `paste` handler (2190) takes `item.getAsFile()` → `URL.createObjectURL(imageBlob)` → `addRawImageToTimeline(objectUrl, 'Pasted Image')` (2075).
- `submitImageUrl` (2134) fetches through the CORS proxies → `URL.createObjectURL(blob)` → same function.
- `addRawImageToTimeline` stores `fileUrl: objectUrl` — a **`blob:` URL**.
- **Save:** blob URL is runtime-stripped (same as Path A).
- **Open + refresh:** `restoreClip` marks the clip missing. Worse, even if the blob URL were kept, it dies on page refresh — so the clip can *never* recover without re-pasting.

### Root cause (shared)
`fileUrl` is treated as a runtime-only field (correct for `blob:` URLs), but **URL sources are not persisted at all**, and `restoreClip` has no branch to rebuild media from a persisted URL. The fix is a **persistent source-URL field** plus a **URL-aware restore path**.

---

## 2. Design

### 2.1 New persistent field: `clip._srcUrl`
A plain string on the clip, **not** in `PROJECT_RUNTIME_FIELDS`, so it survives the save/load round-trip (like `_mdMedia`, `_mdMock` already do).

- `http(s)://…` → re-fetchable remote URL (markdown images, URL imports).
- `data:image/…;base64,…` → embedded bytes that survive refresh (clipboard pastes, when under the size cap).
- `null` / absent → current behavior unchanged (local-file clips still become missing media).

### 2.2 Wire-in points

| Step | Where | Change |
|---|---|---|
| Markdown image | `mdImageClip` (20439) | stamp `_srcUrl: isMock ? null : img.url` |
| Markdown video | `mdVideoClip` (20505) | stamp `_srcUrl: isMock ? null : (v.url || null)` |
| Paste / URL import | `paste` handler (2190), `submitImageUrl` (2134), `addRawImageToTimeline` (2075) | capture the *original* source: clipboard blob → **data URL** (FileReader `readAsDataURL`), URL imports → keep the raw URL; pass it down so the clip gets `_srcUrl` |
| Restore | `restoreClip` (26947) | **new branch before** the missing-media branch: if `_srcUrl` is `http(s):` or `data:image`, rebuild `imageEl`/`videoEl` from it, set `fileUrl = _srcUrl`, keep `isPlaceholder=false`, skip `_missingMedia` |
| Redraw | restored `imageEl`/`videoEl` | `onload` / `armVideoFrameLatch` (25930) already call `drawCanvas()` — verify the rebuild wires the same latch so the canvas paints when the URL resolves |

### 2.3 Restore branch (sketch)
```js
// URL-based media needs no re-import: rebuild the element from the persisted
// source URL and keep the clip live. data: URLs (pasted images) survive refresh;
// http(s) URLs re-fetch (may need the same CORS-proxy chain as imports).
const srcUrl = clip._srcUrl;
const isUrlSrc = typeof srcUrl === 'string' && (
    srcUrl.startsWith('http://') || srcUrl.startsWith('https://') || srcUrl.startsWith('data:image/')
);
if (isUrlSrc && !clip.isPlaceholder && !clip._mdMock) {
    clip.fileUrl = srcUrl;
    if (clip.type === 'image') {
        const img = new Image();
        if (!srcUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onerror = function () { /* keep placeholder if the URL is dead */ };
        img.src = srcUrl;
        clip.imageEl = img;
    } else if (clip.type === 'video') {
        const v = document.createElement('video');
        v.preload = 'auto'; v.playsInline = true; v.muted = true;
        if (!srcUrl.startsWith('data:')) v.crossOrigin = 'anonymous';
        v.src = srcUrl;
        armVideoFrameLatch(v);
        clip.videoEl = v;
    }
    // do NOT set isPlaceholder/_missingMedia here
} else if ((clip.type === 'video' || clip.type === 'audio' || clip.type === 'image') && !clip.isPlaceholder && !clip._mdMock) {
    // existing missing-media branch (unchanged)
}
```

### 2.4 Pasted images → data URL (so they survive refresh)
In the paste handler, replace the blob-object-URL shortcut for pasted images:

```js
if (imageBlob) {
    e.preventDefault();
    const dataUrl = await blobToDataUrl(imageBlob);   // FileReader.readAsDataURL
    await addRawImageToTimeline(dataUrl, 'Pasted Image');
}
```
`addRawImageToTimeline` then receives a `data:` URL and stamps `_srcUrl` from it (it already handles non-`blob:`/`data:` sources by setting `crossOrigin` — keep that).

**Size cap (important):** localStorage project slots are small. Embed `data:` URLs only up to a cap (proposal: `MD_URL_EMBED_MAX = ~2 MB` of base64); larger pastes fall back to current behavior (missing after refresh) or, in a later phase, IndexedDB storage. The SFX embed already proves this pattern (`SFX_EMBED_MAX`).

### 2.5 URL imports → keep the raw URL
`submitImageUrl`/paste-URL path: pass the *original* `rawUrl` (not the proxy or blob URL) as `_srcUrl`. On restore, re-run the same proxy chain (`'' → weserv → allorigins`) that the import used, so CORS-blocked hosts still resolve. Extract the proxy loop into a shared helper (`fetchImageViaProxies(url)`) used by both import and restore.

---

## 3. Edge cases & decisions

- **Dead / CORS-blocked URL at open time:** the rebuilt `imageEl` fires `onerror` → clip stays a placeholder but is *not* counted as missing media. Acceptable; the user can still re-import or re-generate. (Alternative: on error, set `_missingMedia = true` so the re-import modal catches it — decide during implementation; lean **yes** for http(s), no for data:.)
- **Mock markdown images** (`![alt](mock)` / `mock:video`): `_mdMock = true` → excluded by the `!clip._mdMock` guard; unchanged.
- **Blob-URL clips saved by older versions:** no `_srcUrl` → they still restore as missing (can't do better — blob URLs were never recoverable). No migration needed.
- **`data:` URLs and canvas export:** `drawImage` with a data-URL `Image` works (same-origin-safe). No taint concern.
- **Thumbnails (project cards):** 23155 uses `clip.imageEl.src` then falls back to `clip.fileUrl` — restored URL clips will have both set, so card thumbnails work after the element loads.
- **Linked audio companions:** unaffected (audio clips stay file-based).
- **`clipToJSON` round-trip:** `_srcUrl` is a plain string → serializes/restores with no extra work; `applyProject`/`applyTimelineSnapshot` (12390) both go through `restoreClip`, so undo/redo and project switch get the same behavior.

---

## 4. Verification checklist (manual)

1. Markdown script with `![alt](https://…jpg)` → Generate → **Save project** → **Open project** → image clip is **live** (paints on canvas), not in the re-import modal, count badge excludes it.
2. Copy an image in the browser → **Paste** into Studio Pro → **refresh the page** → the pasted image still loads (data URL survived).
3. Import a URL image via the import box → refresh → loads (re-fetched through proxies).
4. `![alt](mock)` still shows the mock placeholder; a local-file image clip still becomes missing media after open.
5. A dead URL (404) → placeholder, no crash, no false "missing media" count.
6. Export a frame from a URL-image project → image renders in the export.
7. localStorage quota: pasted image under the cap saves; oversized paste logs a warn and falls back to current behavior.

---

## 5. Phasing

- **P1 (core):** `_srcUrl` field + `restoreClip` URL branch + md builders stamp `_srcUrl` (fixes Path A fully).
- **P2 (pastes):** paste → data URL with size cap + `addRawImageToTimeline` stamping (fixes Path B).
- **P3 (URL imports):** shared `fetchImageViaProxies` helper so restored http(s) sources re-resolve through CORS proxies.
- **Later (optional):** IndexedDB backing for large pasted images instead of the cap.
