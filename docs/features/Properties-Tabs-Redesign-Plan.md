# Properties Sub-Tabs Redesign — Basic / Adjust / Effects / Media (4 tabs)

**Status:** plan (not implemented)
**File affected:** `index.html` only (no new cards, pure regrouping + labels + migration)
**Effort:** ~45–60 min, one file, zero renderer changes

---

## 1. Goal

Restructure the Properties panel's sub-tabs from the current **Transform / Appearance / Media**
into a CapCut-style, frequency-first hierarchy:

- **Basic** — the everyday edits for the selected element
- **Adjust** — color & look (CapCut/DaVinci give color its own tab)
- **Effects** — less-used, applied-on-top effects
- **Media** — source & material

The tabs adapt per clip type (a text clip shows different cards in Basic than a video clip),
and every tab's cards are ordered by usage frequency.

---

## 2. Current state — card inventory

Each card, its clip types, and today's group (from `updatePropertiesPanel`, lines ~8233–10340):

| Card id | Card | image | video | text | shape | scene | caption | today |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| `cardTransform` | Transform | ✓ | ✓ | ✓ | ✓ | ✓ | | transform |
| `cardCrop` | Crop & Zoom | ✓ | ✓ | | | | | transform |
| `cardMask` | Masking | ✓ | ✓ | | | | | transform |
| `cardColor` | Color Correction | ✓ | ✓ | | | | | appearance |
| `cardStroke` | Stroke & Outline | ✓ | ✓ | ✓ | ✓ | | | appearance |
| `cardExtrude` | Extrude 3D | | | ✓ | ✓ | | | appearance |
| `cardOpacity` | Opacity & Blending | ✓ | ✓ | ✓ | ✓ | ✓ | | appearance |
| `cardShadow` | Drop Shadow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | appearance |
| `cardTexture` | Texture | | | ✓ | ✓ | | | appearance |
| `cardLetterStyles` | Letter Styles | | | ✓ (non-math) | | | | appearance |
| `cardTextBg` | Background (text) | | | ✓ | | | | appearance |
| `cardSystemFonts` | PC Fonts | | | ✓ | | | | appearance |
| `cardGoogleFonts` | Google Fonts | | | ✓ | | | | appearance |
| `cardScene` | Scene | | | | | ✓ | | media |
| `cardSource` | Source Management | ✓ | ✓ | | | | | media (+audio) |
| `cardSpeed` | Speed | | ✓ | | | | | media (+audio) |
| `cardContent` | Content (text) / Shape | | | ✓ | ✓ | | | media |
| `cardCaption` | Captions | | | | | | ✓ | media |
| `cardTypography` | Typography | | | ✓ | | | | media |
| `cardSpacing` | Sizing & Spacing | | | ✓ | | | | media |
| `cardSfx` | Sound FX | ✓ | | ✓ | ✓ | | | media |

**Problems today:** "Appearance" mixes everyday cards (Color, Opacity) with niche ones
(Extrude, Letter Styles, Fonts); "Media" buries text editing (Content/Typography/Spacing —
the most-used cards for text) next to Scene and SFX; nothing is frequency-ordered.

---

## 3. Inspiration

**CapCut:** video clip → *Basic* (position/scale/rotation/opacity) → *Adjust* (brightness,
contrast, saturation, temperature, tint) → *Animate* → *Speed* → *Edit*. Text clip → *Text*
(content) → *Style* (font/size/color/stroke/shadow/spacing) → *Animation*. The default tab
holds the most-used controls; **color has its own tab**; effects/animation are separate.

**Premiere/After Effects:** Effect Controls leads with Motion → Opacity → Time Remapping
(the universal transforms), then user effects below.

**DaVinci Resolve:** Inspector splits *Video* / *Color* — color is first-class.

**Pattern:** frequency-first tab order · color in its own space · niche effects quarantined ·
tabs adapt to the selected element.

---

## 4. The 4-tab structure (recommended)

### 4.1 Tab definitions

| Tab | Icon | Shortcut | One-liner | Cards (global render order) |
|---|---|---|---|---|
| **Basic** | `sliders` | **1** | "edit what you see" | Transform · Crop & Zoom · Opacity & Blending · Speed · Content/Shape · Typography · Sizing & Spacing · Captions |
| **Adjust** | `sun` | **2** | "color & look" | Color Correction · Background (text) · Stroke & Outline · Drop Shadow |
| **Effects** | `sparkles` | **3** | "applied on top" | Masking · Letter Styles · Extrude 3D · Texture · Sound FX |
| **Media** | `film` | **4** | "source & material" | Source Management · Scene · PC Fonts · Google Fonts |

### 4.2 Card assignments + rationale

**Basic** — high-frequency, element-defining edits:

| Card | Why it's Basic |
|---|---|
| Transform | The #1 edit for every visual element (position/scale/rotation) |
| Crop & Zoom | Core framing edit for photos/footage |
| Opacity & Blending | Universal compositing control, used constantly |
| Speed | Slow-mo/timelapse is a common, simple edit (video) |
| Content / Shape | Editing the text itself / shape geometry — the point of the clip |
| Typography | Font/size/color of text — second most-used text edit |
| Sizing & Spacing | Text layout tweaks (line height, letter spacing, box) |
| Captions | The whole caption workflow for caption clips |

**Adjust** — the color cluster (CapCut's *Adjust* tab):

| Card | Why it's Adjust |
|---|---|
| Color Correction | The most-used "effect" (saturation/vibrance/temp/tint/brightness/blur) |
| Background (text) | Text-box fill — a color decision |
| Stroke & Outline | Border color/width — color styling |
| Drop Shadow | Shadow color/offset/blur — color styling |

**Effects** — niche, applied-on-top, set-and-forget:

| Card | Why it's Effects |
|---|---|
| Masking | Reveals/cutouts — used occasionally, but an effect |
| Letter Styles | Word/letter color animation — power-user, text only |
| Extrude 3D | 3D depth — niche, text/shape only |
| Texture | Pattern overlay — niche |
| Sound FX | Attached sound — niche |

**Media** — raw material:

| Card | Why it's Media |
|---|---|
| Source Management | Replace/relink the file behind the clip |
| Scene | Background/settings of a scene clip |
| PC Fonts / Google Fonts | Font *libraries* (the material to pick from), not the applied style |

### 4.3 Per-clip-type tab visibility

| Clip type | Basic | Adjust | Effects | Media |
|---|---|---|---|---|
| video | Transform · Crop · Opacity · Speed | Color · Stroke · Shadow | Mask | Source |
| image | Transform · Crop · Opacity | Color · Stroke · Shadow | Mask | Source |
| text | Transform · Opacity · Content · Typography · Spacing | Background · Stroke · Shadow | Letter Styles · Extrude · Texture · SFX | PC Fonts · Google Fonts |
| shape | Transform · Opacity · Shape | Stroke · Shadow | Extrude · Texture · SFX | *(empty → tab hidden)* |
| scene | Transform · Opacity | Shadow | *(empty → hidden)* | Scene |
| caption | Captions | Shadow | *(empty → hidden)* | *(empty → hidden)* |
| audio | *(separate panel — not in the sub-tab system)* | | | |

The empty-tab hiding already works via the `groupKeys` filter (see §6.3) — a shape clip
shows **3 tabs** (Basic / Adjust / Effects), a scene clip **3 tabs** (Basic / Adjust / Media),
a caption clip **2 tabs** (Basic / Adjust).

### 4.4 Per-type ordering inside Basic (what the user actually sees)

**Video/Image →** Transform → Crop & Zoom → Opacity & Blending → Speed
**Text →** Transform → Opacity & Blending → Content → Typography → Sizing & Spacing
**Shape →** Transform → Opacity & Blending → Shape
**Scene →** Transform → Opacity & Blending
**Caption →** Captions

This falls out automatically from one global `groupCardsHtml.basic` array because each
`xxxHTML` variable is `''` for non-applicable types — no per-type branching needed:

```js
basic: [transformHTML, cropHTML, blendingHTML, speedHTML, textHTML,
        typographyHTML, spacingHTML, captionHTML, shapeHTML].filter(Boolean).join('')
```

### 4.5 Alternative: 3-tab Option A (Basic / Effects / Media)

If we prefer to skip the color tab, merge **Adjust into Basic** (Color Correction stays #3 in
Basic) and **Effects keeps Mask/Letter Styles/Extrude/Texture/SFX**:

| Tab | Cards |
|---|---|
| Basic | Transform · Crop · Color Correction · Opacity · Speed · Content · Typography · Spacing · Background · Shape · Captions |
| Effects | Masking · Stroke · Drop Shadow · Letter Styles · Extrude · Texture · SFX |
| Media | Source · Scene · PC Fonts · Google Fonts |

Trade-off: Basic gets long (11 cards for video), and stroke/shadow (color properties) sit
away from color correction. **The 4-tab version is the recommendation** — it matches CapCut
and keeps every tab short. This doc details the 4-tab version; the 3-tab version is the same
work minus the `adjust` tab.

---

## 5. UX details

### 5.1 Tab chips (rendered by the existing `subTabBar` builder — no new UI code)

- Each chip: icon + label, active = white pill (light) / dark pill (dark mode), hairline
  border + shadow, icon inherits the chip text color (no brand-blue — as fixed earlier).
- **Tooltips:** extend `propTabs` to carry a shortcut hint so `title="Basic (1)"` shows on
  hover, matching the other shortcut-titled buttons in the app.
- Horizontal dock: the 4 chips fit comfortably in the left rail (`w-24`); vertical dock: the
  segmented bar scrolls if needed (already `overflow-x-auto`).

### 5.2 Keyboard shortcuts

| Key | Action |
|---|---|
| `1` | Basic |
| `2` | Adjust |
| `3` | Effects |
| `4` | Media |
| `T` | jump to Transform card |
| `Y` / `G` / `O` / `X` / `B` / `F` | existing card jumps (unchanged — they read `PROP_GROUP_OF`) |

### 5.3 Phase 2 (after the split lands): non-default tab badges

A tiny dot on a tab when any card in that group has non-default values — a "what did I
touch" signal (CapCut highlights changed props). Implementation sketch:

- Add a small registry of effect defaults next to `PROP_GROUP_OF`
  (`EFFECT_DEFAULTS = { saturation: 100, vibrance: 0, ..., speed: 1 }`).
- For each group, OR together the per-card "differs from default" checks (same
  `Math.abs(cur - def) > 1e-9` logic `propReset` already uses).
- Pass `badge: true/false` into `subTabBar` (or append a dot span to the chip).
- Effort: ~1–1.5 h, `index.html` only. Not required for the tab split.

### 5.4 Future (optional) — "recently used" ordering

Track last-touched card ids in `State.ui.recentCards` and float them to the top of **Basic**,
so the tab learns the user's workflow. Deliberately out of scope for this pass.

---

## 6. Implementation (exact changes, all in `index.html`)

### 6.1 `groupMeta` (~line 10508)

```js
const groupMeta = {
    basic:   { label: 'Basic',   icon: 'sliders' },
    adjust:  { label: 'Adjust',  icon: 'sun' },
    effects: { label: 'Effects', icon: 'sparkles' },
    media:   { label: 'Media',   icon: 'film' }
};
```

### 6.2 `groupKeys` — the tab ORDER (~line 10502)

```js
const groupKeys = ['basic', 'adjust', 'effects', 'media']
    .filter(k => navItems.some(i => (navGroupOf[i.id] || 'media') === k));
```

### 6.3 Default + migration of saved state (~line 10500)

Stale saved values (`'transform'`, `'appearance'` from old sessions/localStorage) must map to
the new keys or the panel renders an **empty tab**:

```js
State.ui.activePropGroup = State.ui.activePropGroup || 'basic';
const PROP_GROUP_MIGRATE = { transform: 'basic', appearance: 'effects' };
if (PROP_GROUP_MIGRATE[State.ui.activePropGroup]) {
    State.ui.activePropGroup = PROP_GROUP_MIGRATE[State.ui.activePropGroup];
}
// …existing groupKeys filter + "fallback to groupKeys[0]" logic unchanged
```

### 6.4 `groupCardsHtml` (~line 10515)

```js
const groupCardsHtml = {
    basic:   [transformHTML, cropHTML, blendingHTML, speedHTML, textHTML,
              typographyHTML, spacingHTML, captionHTML, shapeHTML].filter(Boolean).join(''),
    adjust:  [colorHTML, textBgHTML, strokeHTML, shadowHTML].filter(Boolean).join(''),
    effects: [maskHTML, letterStylesHTML, extrudeHTML, textureHTML, sfxHTML].filter(Boolean).join(''),
    media:   [sceneHTML, sourceHTML, systemFontsHTML, googleFontsHTML].filter(Boolean).join('')
};
```

### 6.5 `PROP_GROUP_OF` (~line 2542)

```js
const PROP_GROUP_OF = {
    cardTransform: 'basic', cardCrop: 'basic', cardOpacity: 'basic',
    cardSpeed: 'basic', cardContent: 'basic', cardTypography: 'basic',
    cardSpacing: 'basic', cardCaption: 'basic',
    cardColor: 'adjust', cardTextBg: 'adjust', cardStroke: 'adjust', cardShadow: 'adjust',
    cardMask: 'effects', cardLetterStyles: 'effects', cardExtrude: 'effects',
    cardTexture: 'effects', cardSfx: 'effects',
    cardScene: 'media', cardSource: 'media', cardSystemFonts: 'media', cardGoogleFonts: 'media'
};
```

### 6.6 Keyboard shortcuts (~line 20096)

```js
if (k === '1') { e.preventDefault(); setPropGroup('basic'); return; }
else if (k === '2') { e.preventDefault(); setPropGroup('adjust'); return; }
else if (k === '3') { e.preventDefault(); setPropGroup('effects'); return; }
else if (k === '4') { e.preventDefault(); setPropGroup('media'); return; }
```

### 6.7 Tooltip hints (optional, ~line 10512)

Give each tab a shortcut hint: `propTabs = groupKeys.map(k => ({ key: k, ...groupMeta[k],
title: groupMeta[k].label + ' (' + ['1','2','3','4'][idx] + ')' }))` — the `subTabBar`
builder already renders `title="${t.label}"`; extend it to use `t.title`.

### 6.8 Untouched

- `activeAnimMainTab: 'transform'` (line 1033) + `setAnimMainTab('transform')` — the
  **Animations** tab's own state, unrelated to Properties groups.
- The audio-clip panel (`createAudioAccordion` branch, line ~9293) — separate branch, no
  sub-tabs.
- `scrollToPropertyCard` — reads `PROP_GROUP_OF`, so card jumps auto-follow the new groups
  (verify only).
- `subTabBar` builder — already generic; no changes.

---

## 7. Testing / verification

1. **Per-type tabs:** select each clip type and confirm the expected tab set (see §4.3
   matrix): video=4 tabs, image=4, text=4, shape=3, scene=3, caption=2.
2. **Card order within each tab:** matches §4.4 (e.g. video Basic = Transform, Crop,
   Opacity, Speed; text Basic = Transform, Opacity, Content, Typography, Spacing).
3. **Migration:** seed `State.ui.activePropGroup = 'transform'` (old save), re-render →
   Basic shows, not an empty tab; same for `'appearance'` → Effects.
4. **Shortcuts:** 1/2/3/4 switch tabs; T/Y/G/O/X/B/F still jump to their card.
5. **Both docks:** vertical segmented bar and horizontal rail render 4 chips, active pill
   correct, no overflow.
6. **Regression:** card switches/sliders/resets still work (unchanged markup), accordions
   collapse, save-as-preset unaffected.
7. `vite build` ✓; console clean.

---

## 8. Risks / gotchas

- **Stale saved group is the #1 bug risk** — without §6.3's migration map, old sessions
  render an empty tab. The existing "fallback to `groupKeys[0]`" only catches invalid keys,
  **not** valid-but-renamed ones (`'transform'` is no longer a key), so the explicit
  migrate map is required.
- **`cardContent` is dual-purpose** (Content for text, Shape for shapes, same id) — its
  group stays `basic` for both types.
- **Tab order = `groupKeys` array order**, not object insertion order — edit the array.
- **`navGroupOf[i.id] || 'media'`** default (line 10503) — harmless, keep.
- **Audio clips unaffected** — don't accidentally route them into the sub-tab system.
- **Drop Shadow renders for every type** (no condition) — caption clips get Basic + Adjust;
  that's expected, not a bug.
