# Captions Panel Keyboard Shortcuts — Plan

**Status:** plan (not implemented)
**Scope:** `index.html` keydown handler + caption/markdown panel renderers

The Properties tab already has a complete keyboard vocabulary. This plan extends the
*same* vocabulary to the Captions (`subtitles`) and Markdown (`markdown`) sidebar tabs,
so the panels feel identical under the keyboard.

---

## 1. What the Properties tab already does (reference)

All of this lives in the global `keydown` listener (~line 23525 in `index.html`),
gated behind `if (State.sidebarTab === 'properties')`:

| Key | Action |
|---|---|
| `1` / `2` / `3` / `4` | Jump to a **sub-tab group**: `setPropGroup('basic' \| 'adjust' \| 'effects' \| 'media')` |
| `t` / `y` / `g` / `o` / `x` / `b` / `f` | `scrollToPropertyCard('cardTransform' / 'cardTypography' / 'cardSpacing' / 'cardStroke' / 'cardExtrude' / 'cardOpacity' / fonts)` — opens the card, centers it in the container, flashes a ring, focuses the first control |
| `←` / `→` | Scroll the card container horizontally by 200px (horizontal docks) |
| `↑` / `↓` | Scroll vertically by 200px (vertical docks only) |
| `PageUp` / `PageDown` / `Home` / `End` | Page / jump to start / end, dock-aware (horizontal vs vertical) |
| `W` / `A` / `S` / `D` | Free-scroll the panel (existing global behavior, `currentHoveredArea === 'properties'`) |

Key behaviors to mirror:
- Keys are **ignored while typing** (`e.target` is `INPUT`/`TEXTAREA`/contenteditable).
- `1..4` and letter keys call `e.preventDefault()` so they never type or scroll the page.
- `scrollToPropertyCard` is **group-aware**: if the target card lives in another
  sub-tab group it switches groups first, then scrolls.
- The arrow/Page/Home/End block is gated on `!alt && !ctrl && !shift` so it never
  fights the global shortcuts (Alt+1/2/3 tab switch, Ctrl+Z undo, J/L seeks, etc.).

---

## 2. Captions panel (`subtitles` tab)

### 2a. Sub-tab jumps — `1` / `2` / `3`

Mirror Properties: `1`/`2`/`3` call the existing `setSubtitleSubTab(tab)`:

| Key | Action |
|---|---|
| `1` | `setSubtitleSubTab('captions')` — caption list / generation |
| `2` | `setSubtitleSubTab('style')` — global caption style cards |
| `3` | `setSubtitleSubTab('animation')` — caption animation presets |

Notes:
- The Properties `1..4` branch only runs when `State.sidebarTab === 'properties'`, so
  there is **no key conflict** — the captions branch runs in its own `else if`.
- Switching a sub-tab must preserve the current scroll (the panel re-render already
  does this via `snapshotScrollPositions` / `restoreScrollPositions`).
- Optional nice-to-have: remember the last `style`-tab scroll per sub-tab and restore
  it when jumping back (small `State.subtitleScrollMemo[subTab]` map).

### 2b. Card jumps — letter keys (style sub-tab)

The global Style cards carry stable `data-sub-acc` keys. Map a letter to each, mirroring
the Properties `t/y/g/o/x/b/f` pattern with a new `scrollToSubtitleCard(key)` helper:

| Key | Card | `data-sub-acc` |
|---|---|---|
| `t` | Typography | `sty_typo` |
| `g` | Sizing & Spacing | `sty_sizing` |
| `c` | Color | `sty_color` |
| `b` | Background | `sty_bg` |
| `k` | Stroke & Outline | `sty_stroke` |
| `d` | Drop Shadow | `sty_shadow` |
| `x` | Texture | `sty_texture` |

`scrollToSubtitleCard(key)` mirrors `scrollToPropertyCard`:
1. If the current sub-tab is not `style`, switch to it first (`setSubtitleSubTab('style')`).
2. Find the card by `[data-sub-acc="${key}"]` inside `#subtitleStyle` / the `sty-strip`
   scroll container; force `details.open = true`.
3. Center it in the strip: `scrollLeft` math in horizontal docks, `scrollTop` in
   vertical docks (same formula as `scrollToPropertyCard`).
4. Flash a `ring-2 ring-brand-500` highlight for ~1s and focus the first control.

Edge case: the whole-caption **per-caption card** in the Properties tab is a different
panel (already reachable via the Properties shortcuts) — no changes needed there.

### 2c. Arrow / Page / Home / End scrolling

Extend the Properties arrow block to also cover the captions panel. The scrollable
container depends on the active sub-tab:

| Sub-tab | Container (horizontal dock) | Vertical dock |
|---|---|---|
| `captions` | `caps-list` (the caption rows column) + `caps-outer` grid | the panel column |
| `style` | `sty-strip` (horizontal card strip) | the panel column |
| `animation` | `anim-strip` (horizontal preset strip) | the panel column |

Behaviour (identical to Properties):
- `←`/`→` always scroll horizontally by 200px; `↑`/`↓` only in vertical docks.
- `PageUp`/`PageDown`/`Home`/`End` page and jump, dock-aware.
- Gated on `!alt && !ctrl && !shift`.

---

## 3. Markdown panel (`markdown` tab)

Same treatment for free (the panel already shares the `subTabBar()` rail design):

| Key | Action |
|---|---|
| `1` | `setMarkdownSubTab('content')` |
| `2` | `setMarkdownSubTab('style')` |
| `3` | `setMarkdownSubTab('media')` |
| `←`/`→`/`↑`/`↓`/`PageUp`/`PageDown`/`Home`/`End` | Scroll `md-content-col` / `md-style-strip` / `md-media` |

Markdown Style cards also carry `data-sub-acc` keys (same `styleCard` token) — the
letter-card map above works there too if desired (nice-to-have; the markdown style
cards are fewer and mostly 1:1 with captions).

---

## 4. Conflicts & edge cases to respect

1. **Typing guard already exists** — the global listener bails on `INPUT`/`TEXTAREA`
   /contenteditable before any of this runs. The captions panel has a text-editing
   input in the `captions` sub-tab (caption text editor); `1/2/3` and letters must
   never fire while the user is editing caption text.
2. **`Alt+1/2/3`** switches inspector tabs globally — the new plain `1/2/3` must only
   run when `!altKey` (the Properties branch already handles `alt` first and `return`s).
3. **Letter keys in other contexts** — `g` toggles gap-select and `b` toggles blade
   *globally* (outside the properties branch, they already `return` before the letter
   branch). The new captions letter branch must sit *before* those global handlers
   **and** be gated on `State.sidebarTab === 'subtitles'` (and markdown) so `g`/`b`
   keep their timeline meanings elsewhere.
4. **Delete/Backspace** deletes the selected clip globally — untouched.
5. **WASD free-scroll** (`currentHoveredArea === 'properties'`) — extend the same
   hover detection to the subtitles panel (`currentHoveredArea === 'subtitles'`), or
   leave WASD to Properties and let the arrows cover captions (recommended: keep
   arrows as the captions scroll mechanism to avoid overloading WASD).
6. **Scroll preservation** — all re-renders in `renderSubtitlesPanel` /
   `renderMarkdownPanel` already snapshot/restore scroll; the new jumps set their own
   scroll explicitly, so no conflict.

---

## 5. Implementation outline (when approved)

1. Add `window.scrollToSubtitleCard = (key) => {...}` next to `scrollToPropertyCard`
   (~line 2651): switch sub-tab to `style` if needed, open + center + ring + focus.
2. In the global `keydown` listener (~line 23525), after the Properties block, add:
   ```js
   if (State.sidebarTab === 'subtitles') {
       if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
           if (k === '1') { e.preventDefault(); setSubtitleSubTab('captions'); return; }
           else if (k === '2') { e.preventDefault(); setSubtitleSubTab('style'); return; }
           else if (k === '3') { e.preventDefault(); setSubtitleSubTab('animation'); return; }
       }
       // letter card jumps (style sub-tab only)
       const subCardKeys = { t: 'sty_typo', g: 'sty_sizing', c: 'sty_color', b: 'sty_bg', k: 'sty_stroke', d: 'sty_shadow', x: 'sty_texture' };
       if (subCardKeys[k]) { e.preventDefault(); scrollToSubtitleCard(subCardKeys[k]); return; }
       // arrows / page / home / end — pick container by active sub-tab
       const subContainer = document.querySelector(
           subTab === 'captions' ? '[data-scrollkey="caps-list"]'
           : subTab === 'animation' ? '[data-scrollkey="anim-strip"]'
           : '[data-scrollkey="sty-strip"]');
       if (subContainer && !e.altKey && !e.ctrlKey && !e.shiftKey) { ...same scroll block as Properties... }
   }
   ```
   (Place it *before* the global `g` gap-toggle / `b` blade-toggle handlers, mirroring
   how the Properties letter branch already sits ahead of them.)
3. Add an analogous `markdown` branch with `1/2/3` → `setMarkdownSubTab`.
4. Wire `currentHoveredArea === 'subtitles'` (and `'markdown'`) into the WASD scroll
   block if WASD support is wanted (optional).

---

## 6. Verification checklist

- [ ] On the Captions tab: `1`/`2`/`3` switch Captions → Style → Animation and back.
- [ ] On the Style sub-tab: `t`, `g`, `c`, `b`, `k`, `d`, `x` open + center + highlight
      the matching card; jumping from another sub-tab lands on Style first.
- [ ] Horizontal dock (top/bottom): `←`/`→` scroll the active strip; `PageUp/Down`,
      `Home`, `End` page/jump; `↑`/`↓` do nothing (like Properties).
- [ ] Vertical dock: `↑`/`↓` scroll the column; `←`/`→` do nothing.
- [ ] Typing inside the caption text editor or any input does **not** trigger any of
      the new shortcuts.
- [ ] `Alt+1/2/3` still switches inspector tabs; `g`/`b` still toggle gap-select /
      blade on the timeline; Delete still deletes the selected clip.
- [ ] Scroll position is preserved after a sub-tab switch and after card jumps.
- [ ] Markdown tab: `1`/`2`/`3` switch Content / Style / Media; arrows scroll.
- [ ] `node --check` on the inline script + `npm run build` pass; no console errors.
