# Aspect ratio, Canvas, and Export

Three sheets, one of which used to be two questions wearing one label.

## Why the split

The rail had a single **Format** button, and it opened one panel carrying two
unrelated controls: a row of aspect-ratio chips and a row of background colour
chips. Neither is the other. A ratio is the *shape of the frame*; a background is
the colour behind the picture when the frame is bigger than the clip. Sharing a
sheet meant sharing a vague word — "Format" — because no precise word covers both,
and it meant the middle Reset button had to clear both, so reverting the ratio
also threw away a backdrop you had picked.

They are now two panels, each named for the one thing it changes:

| Panel | Rail label | Changes | Reset clears |
|---|---|---|---|
| **Aspect ratio** | `Aspect` | `proj.ar` — the frame's shape | the ratio, back to the first clip's own |
| **Canvas** | `Canvas` | `proj.bg` — the backdrop colour | the backdrop, back to black |

Both are project-level and always applicable, so both ride the rail whether or
not a clip is selected. A format you cannot reach while a clip is selected is a
format most people never find — the old `Format` button was only in the
no-selection rail, which is exactly that trap.

## Aspect ratio: the control is the shape

The old row was four text chips, `16:9`, `9:16`, `1:1`, `4:5`, and the glyph had
to be imagined from the label. A ratio is a shape, so it is now chosen from
shapes: each tile draws the format at its own proportions inside a square, and
the label sits under it.

Two details are load-bearing.

- **The glyph is sized from `AR` itself, in percentages.** `AR` already holds the
  pixel dimensions of every ratio, so the glyph is `aw/max·50%` by `ah/max·50%`
  of its tile — a fifth ratio would come out right without a hand-tuned width per
  tile. Percentages and not pixels because the tile is fluid: a fixed 44px mark
  would hang out of a 66px tile on a 360px screen.
- **The tiles divide the row rather than each claiming a width.** A fixed 88px
  tile wrapped **3 + 1** at both 393 and 360, which reads as a layout that ran out
  of room. `flex:1 1 0` with a cap lets four of them meet the row at any width;
  measured at 393 they are `4 × 77px` on one line, and the page has no horizontal
  scroll (`scrollWidth 393`).

## Canvas: a colour, chosen from colours

The backdrop is a colour, so the control is a colour: a row of round swatches with
the selected one ringed. Four presets — Black, Charcoal, Grey, White — plus one
control that is not a preset: a rainbow disc over a real `<input type="color">`,
because four named greys cannot express every backdrop a clip might want. The
custom chip carries `.on` whenever the current colour is *not* one of the presets,
which is what stops a custom pick and a preset from both claiming the selection.

Dragging the native picker fires `input`, and that handler repaints only the
selection marks rather than the sheet: rebuilding the panel mid-pick would tear
the colour dialog out from under the pointer still holding it.

### Two name collisions that the split surfaced

Both were found by looking at the rendered box, not the source.

- **`.sw` was already the snap switch.** The settings sheet's toggle is a
  `.sw` (`button.sw > i`), defined *later* in the stylesheet, so the new swatch
  inherited the switch's `46×28` pill and its track. The swatch is `.swt` now. A
  class name is not private just because the file is long.
- **`#panel label` carries `min-width:84px`** for the old slider rows. The custom
  swatch is a `<label>` too, so it became the widest chip in the row and pushed
  the presets onto a second line; `#panel label.swt{min-width:0}` undoes it for
  the one label that is a swatch. Measured after: five `40×40` swatches on one row.

## Export: three rows from one descriptor

The header's export action (the ⤒ mark, where the reference keeps it) no longer
exports on the first tap — it opens a sheet, because the settings *are* the point
and a button that commits immediately is a button you cannot configure.

The sheet is three settings rows — **Frame rate**, **File format**, **Resolution**
— and each row's options appear under it only while it is the row you opened, so
the sheet stays three lines tall however many settings it grows to. The rows are
built from one array:

```js
const EXP_ROWS=[
  {k:'fps', n:'Frame rate',  val:()=>EXP.fps+' FPS', opts:[[24,'24 FPS'],[30,'30 FPS'],[60,'60 FPS']]},
  {k:'fmt', n:'File format', val:()=>…,             opts:EXPFMT},
  {k:'res', n:'Resolution',  val:()=>…,             opts:EXPRES},
];
```

so a fourth setting is one array entry, not another branch in `panel()`.

The settings themselves live in `EXP`, **beside** the project rather than inside
it. That is deliberate: a clip's grade is part of the document and Cancel undoes
it, but "I want 60fps this time" is not an edit and should not be undone into a
previous value.

### The settings do something

A settings sheet that draws three controls and changes nothing is the same class
of lie as a knob whose readout moves and whose picture does not. So:

- **Frame rate** is passed to `captureStream(fps)`.
- **File format** picks the MIME first, then falls back through what the browser
  can actually encode. `EXPFMT` only lists MP4 when
  `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` is true, so the sheet
  can never offer a format the recorder will silently refuse.
- **Resolution** is a second canvas, `capCv`, sized from the project's own aspect
  at the chosen *height* (`resDims()`), which the frame is mirrored into every
  tick while a recording is up. The recorder watches that canvas, not the
  editor's — so 480p and 1080p are different pictures rather than one picture
  with a different label on it.

## The rail, as scopes

`strip()` used to be one flat array per selection with a divider threaded in at a
single hard-coded key. It is now an array of *groups*, joined with a hairline:

```js
[['speed','volume','filter','adjust','rotate', …],
 ['reverse','replace','rearrange','dup','del','ts','te'],
 ['aspect','canvas']]
```

Adding a tool is dropping a key into a group. The property sheets keep the front,
where muscle memory lives; the actions that change the clip sit together next; and
the two project panels close the row.

## Verified

| | |
|---|---|
| Two panels, not one | `Aspect ratio` renders **4 tiles and no swatches**; `Canvas` renders **5 swatches and no tiles**; the old combined panel rendered both. Driven by tapping the real rail buttons |
| Tiles fit | four tiles are `4 × 77px` on one line at 393 (`.eb` 336px), one row; the page's `scrollWidth` is 393 — no horizontal scroll |
| Swatches fit | custom + 4 presets are five `40×40` circles on one row after `#panel label.swt{min-width:0}`; before it the custom chip was 84px and the presets wrapped |
| Reset is scoped | `Reset` on Aspect ratio restores the ratio and leaves the backdrop; `Reset` on Canvas restores black and leaves the ratio |
| Custom colour | the native picker's `input` sets `proj.bg` (`#3355ff`), marks only the custom chip `.on`, and does not rebuild the sheet under the pointer |
| Export sheet | title `Export`, rows `fps / fmt / res`, no middle action, primary `#exr`; tapping the Resolution row opens its **3** options and picking one updates the row's value |
| Export honours the settings | stubbed `MediaRecorder`: at 60fps + 720p the capture canvas is **1280×720** and `captureStream(60)`; `EXP.fmt='webm'` produces `mimeType video/webm;codecs=vp9,opus`; MP4 is offered only when the browser can encode it |
| Export closes the sheet | tapping `Export` hides the panel, clears `tool`, and shows the recording overlay |
| Self-check | a seventh probe: `aspect` = 4 tiles / 0 swatches, `canvas` = 5 swatches / 0 tiles, `export` = rows `fps,fmt,res` expanding to 3 options with primary `#exr`. All **7 of 7** panel checks, **26 of 26** controls, **4 of 4** shelf rows and **4 of 4** layout checks hold; `npm run build` clean |

The capture-canvas mirror means a recording needs the editor's animation loop to
keep ticking, which it does; the known webview limitation (no composited frames)
is a test-environment note, not a behaviour change.
