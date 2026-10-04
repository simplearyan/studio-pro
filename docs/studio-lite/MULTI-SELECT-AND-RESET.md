# One gesture, several clips — and one gesture to undo it

A note on [`clip-lite-mock.html`](clip-lite-mock.html): selecting more than one
clip, dragging one slider across all of them, and putting a single control back
with a double tap.

---

## 1. A selection is an anchor plus a set

`sel` has always been one clip, and thirty call sites read it that way. Rather than
change that, a selection is now the **anchor** plus a set of extras, and

> **`selMore` never contains the anchor.**

That invariant is the whole trick. `selClips()` is `[anchor]` whenever the set is
empty, which is every interaction that has not opted in — so single-clip behaviour
is unchanged *by construction* rather than by a branch somebody has to remember.

`selMore` and not `multi`, because `tl` already carries a class called `multi`
meaning "this timeline has more than one clip". Two meanings for one word is how a
later reader breaks a timeline.

Verified, tracing the toggle through every case:

| gesture | anchor | extras | selected |
|---|---|---|---|
| tap clip 2 | 2 | — | 1 |
| shift-tap clip 4 | 4 | 2 | 2 |
| shift-tap clip 1 | 1 | 2, 4 | 3 |
| shift-tap clip 4 again | 1 | 2 | 2 |

The first version of `toggleSelAt` added the newcomer to the set *and* made it the
anchor, so the anchor was in the set. `selClips()` filtered it, so the counts were
right — but the comment above claimed an invariant that was false, and the comment
is what a later reader trusts. The code now matches the claim.

## 2. Shift-click, and only shift-click

**Shift, Cmd or Ctrl** extends the selection and returns *before* the reorder
arming below. A modifier is never going to turn into a drag, and making the user
wait 380ms to find that out is the gesture feeling broken.

**There is no marquee.** Rubber-band selection is a second full pointer
interaction on a timeline that already has trim, reorder, transition and scrub
handlers on the same coordinates. It is the right feature and it is not this
commit; adding it here would have meant re-testing every existing gesture on the
same pixels.

## 3. One drag, every selected clip

The input handler's per-tool branches are extracted into `writeSlider(c, v)` —
one clip's worth of the write and nothing else, no readout and no repaint — and
the handler loops:

```js
const many=selClips();
let redraw=false;
for(const k of many)redraw=writeSlider(k,+el.value)||redraw;
```

`writeSlider` returns true when the change is something the timeline has to redraw
(a speed, a trim window, a duration, a look) and false when it is not (a volume, a
rotation), so dragging across a five-clip selection costs the same as dragging
across one.

Verified live: Brightness dragged to `+50` with two clips selected wrote `0.5` to
both and `0` to the rest; the readout and the repaint happened once.

The sheet says **"2 clips · one gesture edits all"** above the control. It is
prepended where the sheet is finally rendered, not inside a tool branch, because
each branch rebuilds `h` from scratch and in the branch it would have been the
sixth place to forget.

## 4. Delete and Duplicate follow the selection

Not asked for, and not optional either: a sheet that graded five clips in one
gesture beside a trash button that removed one of them is a trap. **Replace
refuses** a multi-selection with a toast — it swaps the media under *the* clip and
keeps *its* cut, and with five selected there is no such thing as *the* clip. It
says so rather than silently acting on whichever happened to be the anchor.

Duplicate inserts each copy immediately after its own original, because resolving
the insertion point per copy against a fixed index reverses them.

## 5. Double tap to reset

**By hand, not with `dblclick`.** A `dblclick` listener is synthesised by the
browser: it does not fire for a touch double-tap on every engine, and it does not
fire at all when the two taps land a few pixels apart on a thumb. The detector is
two `pointerup`s inside **320ms and 24px**, which runs on both paths.

It is deliberately **narrower than the footer's Reset**, which clears a whole
sheet's worth of a tool. Someone who pushed Grain to −40 wants that one number
back, not their look as well — verified: the look (`fs`) is untouched by the
reset.

The counterpart is the **non-default marker**: a 2px accent bar under the readout,
on any slider whose value is not where it started. Not the accent on the number
itself — that colour already means "your thumb is down", and a control that means
two things at once means neither.

## 6. The bump, and making it re-arm

The pulse is a 220ms scale on `.sl` plus a halo on the thumb, fired from
`slState()` when the value **crosses into or out of** changed. It is a crossing
cue, not a per-change cue — a number moving while it is already off-default is
not news.

A class-driven animation only plays on the transition *into* it, so the class has
to come off for the pulse to fire twice, and that removal is an `animationend`
listener. Leaving it on is the failure mode where the gesture that tells you a
number moved moves exactly once — which is why the comment claiming that listener
existed was written before it did, and had to be checked.

`prefers-reduced-motion: reduce` skips the animation entirely.

## 7. Verified, including the parts that should not be trusted

Six rows in [`selfcheck.html`](selfcheck.html), driven by real pointer events in
a frame of their own:

| | measured |
|---|---|
| what a pointer is here | `isTrusted false`, 4 events dispatched in order |
| a trim handle, dragged | `10.00s / 240px → 14.00s / 336px`, click suppressed |
| the thumb, held | down → held `true`, pointerup elsewhere → `false` |
| double-tap to reset | Brightness `0.70 → [0]`, marker off, look still `1` |
| one gesture, several clips | clips 1 and 2 → `[0.6, 0.6]` |
| two slow taps | 420ms apart → still `0.5` |

Each proven able to fail: dropping the loop from the input handler gives
`[0.6, 0]` and fails the multi row; widening the window to 9s swallows the slow
pair and fails that one.

**Two honest limits, stated in the probe itself.** `isTrusted` is false and no
script can make it true — it is the browser saying "this came from a user agent".
Every listener runs on a dispatched event identically, because dispatching *is*
running the handler; what it cannot do is the browser's own default action, and
for a range input that is what moves `.value`. So the probe sets the value and
fires `input`, which is exactly what the browser does after a drag, in the same
order. Separately, the rAF loop does not run in this webview, so the edge
auto-scroll inside `drag()` is not exercised; the move handler, which is the part
that trims, is.

The **trusted** path is covered separately, outside the self-check, because it can
only be reached from a real input device: with a range focused, a real `ArrowRight`
takes **both** selected clips `0.30 → 0.32`, the readout to `+32`, and leaves the
playhead where it was.

## 8. Not done

- **No marquee selection**, as above.
- **The selection does not survive a reload** — a saved project opens with its
  first clip selected. Persisting it is a change to the document schema, and the
  migration in [PROJECT-PERSISTENCE.md](PROJECT-PERSISTENCE.md) is the place that
  has to grow first.
- **Adjust and Filters are the only shelves** that show the count; a multi-selection
  opens `Speed` or `Volume` with no indication at all until the first drag.
- **Rearrange and Replace ignore the extras** — the first is about order, the
  second is deliberately single-clip.