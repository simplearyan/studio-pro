# Settings — a category shelf, and the two sheets worth copying

A plan for [`clip-lite-mock.html`](clip-lite-mock.html), about **one sheet**: the ⋮
Settings panel. It is the last of the three property sheets still drawn as a plain
list, and it is the one that no longer fits — measured, it needs **357px** of a
sheet that the split layout bounds to **323px**, so today it opens already
scrolling, with "Timeline zoom" clipped at the top edge.

The brief is to redesign it using the two sheets that *do* work: **Adjust** for its
horizontal category row and **Export** for its clean, quiet rows. This is the plan
for that, and it is narrower than
[`SHEET-REDESIGN-PLAN.md`](SHEET-REDESIGN-PLAN.md), which covers the row grammar and
icons across all three sheets. This one decides what Settings *is*.

**This is a plan.** Nothing here is built.

> Every number below was measured on the real page, with a clip loaded, at the
> width stated. Where a number is arithmetic it says so.

---

## 1. What the two reference sheets actually do

Not "they look nice" — the mechanism, because the mechanism is what transfers.

### 1.1 Adjust — a shelf of categories, and it is honest about overflow

Measured: **13 items**, each **64×66px** (a 46px circle over an 11px label), needing
**1004px** of row against **466px** available in the sheet at 1194×834. So it
scrolls, 2.2× over — but two things make that acceptable rather than broken:

- **The item is small and uniform.** 64px wide means five and a half items are
  visible at 466, so the cut-off itself is the affordance: a half-item at the edge
  says "there is more".
- **The label is under the glyph, not beside it.** At 11px the name costs no
  horizontal budget, so a knob is as narrow as its icon and the row stays dense.

At the light-theme width in the screenshots (~1035px of sheet) all thirteen fit and
the row reads as one glanceable shelf. That is the payoff, and it is the model worth
copying: **a horizontal row whose items are icon + short label, where fitting more
items is the goal and scrolling is the fallback.**

### 1.2 Export — few rows, wide targets, values right-aligned

Measured: **3 rows at 52px**, label 15px left, value 15px in `--on2` right, a 16px
chevron after it. No borders, no icons, no fill — the separation is the 15px of
vertical padding and the right-aligned value column.

It is clean for a structural reason, not a stylistic one: **three rows in a 466px
body leaves 340px of slack, so nothing is compressed and nothing scrolls.** Export
can afford to be airy because it has almost nothing to say. Copying its spacing onto
a five-row sheet would not make Settings clean; it would make it taller.

That is the tension this plan has to resolve, and it is the reason a plain
"make Settings look like Export" pass would fail: Settings has *more* to say.

---

## 2. What Settings is today, measured

Five rows, **45 / 45 / 44 / 44 / 44 = 222px** of content, and four different kinds
of control inside them:

| row | control | measured | kind |
|---|---|---|---|
| Timeline zoom | value `11 s across` + `#zo` `#zi` + `Fit` | 70×19, 44×44, 44×44, 49×36 | a readout, two icon buttons, a chip |
| Step one frame | `#fb` `#ff` | 44×44, 44×44 | two icon buttons |
| Ruler interval | `≣5s` chip | 62×36 | a cycling chip |
| Snap to edges | `.sw` | 46×28 | a switch |
| Saved project | `12 MB of 10252 MB used` + `Clear` | text, 66×36 | a readout and a **destructive** chip |

Four problems, all measured:

1. **It does not fit.** Title 23 + body 222 + footer 44 + two 16px gaps + 36px
   padding = **357px needed**, against the **323px** the split layout's bound gives
   at 1194×834. So the body scrolls **70px** and the first row is clipped. This is
   the bug in the screenshot, and it is a *size* problem: no amount of styling
   fixes a list that is 34px too tall.
2. **Five control idioms in five rows** — two icon buttons, a chip, a switch, and a
   destructive chip — with four different heights (44 / 44 / 36 / 28 / 36) and two
   different label treatments. There is no rhythm to learn.
3. **The one destructive control sits in the same list as the safe ones.** `Clear`
   is styled exactly like `Fit` and `≣5s`: same chip, same size, same weight. The
   only thing distinguishing "zoom to fit" from "delete my project" is the word.
4. **Every row is a full-width band** for what is often a single small control —
   `Snap to edges` is a 46×28 switch at the far right of a 466px row.

---

## 3. The redesign — three categories, one shelf

The insight is that Settings' five rows are **not five peers**. They are three
groups, and each group is a different *subject*:

| category | rows | what it is about |
|---|---|---|
| **Timeline** | zoom, ruler interval | how the timeline is drawn |
| **Editing** | step one frame, snap to edges | how your gestures behave |
| **Storage** | saved project, Clear | what is on the device |

So the sheet becomes a **shelf of three category tiles** with the selected
category's controls below it — Adjust's grammar, applied to categories instead of
knobs. That is the user's "horizontal category like adjust", and it is not a
reskin: it is what makes the sheet fit.

### 3.1 The arithmetic — why this fixes the height, not just the look

| | today | proposed |
|---|---|---|
| shelf (3 tiles × 66px) | — | **66** |
| controls | 5 rows, 222px | **1–2 rows, 44–96px** |
| total body | **222** | **126–178** |
| sheet needed | **357** | **261–313** |

Against the bound of 323, the proposed sheet fits **without scrolling for every
category** — and the worst case (Timeline, with its readout + two buttons + chip) is
313, still inside. **The redesign is what removes the overflow**, because showing
one category at a time is a quarter of the content of showing all three.

Three tiles at 64px is **192px** in a 466px sheet — no scrolling, no cut-off, and
room to spare. If a fourth category ever arrives it still fits.

### 3.2 The tiles

```html
<button class="rt" data-cat="timeline" aria-label="Timeline">
  <i>${ic('ruler')}</i><span>Timeline</span>
</button>
```

They are the **same `.rt` tiles** Aspect ratio and Layout already use — the
square-with-a-glyph-and-a-label-under-it, 16px radius, ring when selected. Three
sheets now share one tile component, and the vocabulary is: *a tile picks what the
row below is about.*

| category | glyph | source |
|---|---|---|
| Timeline | `ruler` | new (§3.5) |
| Editing | `cut` | already drawn — the timeline's own split mark |
| Storage | `store` | new (§3.5) |

### 3.3 The rows under the shelf

Each category renders one or two rows, reusing **Export's row** (`.xr`: 52px, label
left, control right) — not a new idiom:

**Timeline**
| row | control |
|---|---|
| Timeline zoom | `11 s across` · `#zo` `#zi` · `Fit` |
| Ruler interval | `≣5s` chip |

**Editing**
| row | control |
|---|---|
| Step one frame | `#fb` `#ff` |
| Snap to edges | the switch |

**Storage**
| row | control |
|---|---|
| Saved project | `12 MB of 10252 MB used` |
| — | **`Clear project`** — its own row, its own weight (§3.4) |

### 3.4 Clear stops being a chip

`Clear` is the only destructive control in the app and it is currently a 66×36 chip
that looks exactly like `Fit`. It gets:

- **Its own row**, so it is never adjacent to a safe control of the same shape.
- **The `warn` treatment**, which `.chip.warn` already defines and the two-tap
  arming already uses.
- **A wider label**: `Clear project`, because `Clear` beside a size readout reads as
  "clear the readout".
- **Its two-tap arming stays.** It is a good pattern and the plan keeps it.

### 3.5 Two new glyphs, and the map hole behind them

`ruler` (five ticks and a head) and `store` (a stacked disc) are the only new marks.
Everything else is a reuse: `cut`, `zo`, `zi`, `snap`, `prev`, `next`.

And the contract that matters more than either glyph: **`ic(n)` interpolates
`ICON[n]` into an `<svg>`, so a name the map does not have renders `undefined`** —
not an error, not a warning, a blank square with a label under it. That is what the
rail's Delete had been doing until it was aliased onto `trash`. Every glyph this
plan adds is covered by the blank-glyph check
[`SHEET-REDESIGN-PLAN.md`](SHEET-REDESIGN-PLAN.md) §5 specifies.

### 3.6 The title row, and one footer button

- The title becomes `[cog] Settings` with a `×` at the right. The `×` and `Done` do
  the same thing, which is what a close affordance is for.
- The footer stays **`Done` alone** — Settings has nothing to cancel and nothing to
  reset, and that is already the sheet's one honest difference from its siblings.

---

## 4. What this deliberately does *not* do

- **It does not copy Export's 15px row padding.** Export is airy because it has three
  rows in a 466px body. Settings' rows stay at the app's 52px, because the sheet's
  problem is that it is too tall, and copying the airier spacing would make it
  taller.
- **It does not make the rows icon-led.** A category tile carries the glyph; the
  rows under it are two or three items of the same subject, so a glyph on each is
  decoration. Export's rows have none and read better for it.
- **It does not add a fourth category** for "Export settings", which live in the
  Export sheet where the export is. Moving them here would put a setting two taps
  from the button that uses it.
- **It does not change what any control does.** Every function behind these rows —
  `syncZoom`, `fitZoom`, `nudge`, `rulercyc`, `snapOn`, `storageLine`, `forgetAll`
  and the two-tap arm — is called exactly as it is today.

---

## 5. Risks

| | risk | mitigation |
|---|---|---|
| 1 | **Hiding two categories behind a tap is a real cost** — five settings become visible one category at a time. | The default category is **Timeline**, the one the ⋮ menu is most often opened for, and the last-used category is remembered for the session like `adjKey` is. The shelf shows all three names at once, so nothing is *hidden*, only *not expanded*. |
| 2 | **A category tile row is a second shelf idiom** next to Adjust's knobs. | It is the same `.rt` tile as Aspect ratio and Layout, at the same size and radius. The rule is one sentence: a tile picks a subject, a knob picks a value. |
| 3 | **`#sstor`'s value arrives asynchronously** (`storageLine().then(...)`), so a Storage row built on open can render an empty readout. | The read-back is already written for exactly this — it reads the element *after* the row is on screen and writes into it. The plan keeps that ordering and adds no new promise. |
| 4 | **Category state has to survive a rebuild**, since `panel()` throws the markup away. | `settingsCat` is module state beside `adjKey`, for the same reason: it is a property of the sheet in front of you, not of the project. |
| 5 | **The ⋮ entry point is the header's ⋮, not a rail tool**, so there is no `data-t` to hang the sheet off. | `tool='settings'` already routes to `settingsSheet()`; the shelf is internal to that function and needs no new tool key. |

---

## 6. Build order

| | step | done when |
|---|---|---|
| **G1** | Three category tiles in `.rt`, `settingsCat` module state, default `timeline` | tapping a tile switches the rows below it; the sheet's height changes with the category |
| **G2** | The five rows move onto Export's `.xr` row shape | Timeline/Editing/Storage render 2 / 2 / 2 rows at 52px; `Clear` is its own row with `.warn` |
| **G3** | The two glyphs, `ruler` and `store`, plus the reuses | every tile and every row control resolves to a real glyph; the blank-glyph check passes and is shown to fail when one is deleted |
| **G4** | The title row `[cog] Settings` + `×` | the `×` closes the sheet and returns focus to the ⋮ button |
| **G5** | Verify the fit at the bound | at 1194×834 with `tool='settings'`: the sheet's body **does not scroll** for any of the three categories, and no row is clipped |

---

## 7. Verification

| | check |
|---|---|
| the fit | at 1194×834, all three categories: `#panel.scrollHeight ≤ clientHeight` and `.eb.scrollHeight ≤ clientHeight`, with no row clipped at the top. Today the body overflows by 70px, so this is a diff against a measured failure rather than a claim |
| the categories | three tiles, exactly one lit; the lit one's `data-cat` equals `settingsCat`; the rows rendered are that category's, and switching rebuilds without losing the sheet's open state |
| the memory | opening Settings, picking Storage, closing and reopening lands on Storage, not Timeline |
| the controls | every control in every category is still wired to its original function: `Fit` calls `fitZoom`, `#fb`/`#ff` call `nudge(∓1/30)`, the ruler chip cycles `RULER_MODES` and writes `lite:ruler`, the switch writes `lite:snap`, `Clear` still needs two taps inside 2500ms |
| the destructive one | `Clear`'s row is not adjacent to a same-shaped chip, it wears `.warn` when armed, and its label is `Clear project` |
| the glyphs | `ruler` and `store` resolve; the blank-glyph row is green |
| the phone | 393×844: the sheet still fits, the categories still switch, and the phone's own 388px sheet is unchanged |
| the siblings | Adjust, Export, Aspect ratio and Layout are untouched — the tile and row classes they share are extended, not edited |
| build | `npm run build` clean; no new console errors beyond the known dev-only `sw.js` 404 |

---

## 8. Out of scope

- **The other two sheets.** [`SHEET-REDESIGN-PLAN.md`](SHEET-REDESIGN-PLAN.md) owns
  Export's summary line, Adjust's sections and the Fade merge. This plan only borrows
  their *shapes*.
- **Persisting the selected category to disk.** `adjKey` is session state and this
  should match it; the Settings sheet is not the place to introduce a third
  persistence rule.
- **Re-drawing the rail's icons.** The rail is a separate vocabulary with its own
  study.