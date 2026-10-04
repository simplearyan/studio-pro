# Project persistence

A note on [`clip-lite-mock.html`](clip-lite-mock.html): how the project survives a
reload, and why each piece is where it is.

Until now everything lived in module memory. Close the tab and the imported video,
the cut, the grade and the captions were all gone — which is not a bug so much as
an unfinished feature, because the alternative to losing everything is losing it
sometimes.

---

## 1. The one split that makes this work

**The edit is kilobytes. The media is gigabytes.** Every rule below follows from
not letting those two share a store or a write path.

| store | holds | size | written |
|---|---|---|---|
| `kv` | the schema version | bytes | on upgrade |
| `media` | the imported `File`, keyed by a hash of its bytes | 10s–100s of MB | once, on import |
| `derived` | thumbnails and audio peaks, keyed by the same hash | 100s of KB | once, on import |
| `proj` | the edit: clips, captions, project settings, and the src→hash map | a few KB | often, throttled |

So a refresh costs one small read, and the timeline can be drawn from `derived`
with **no video decode at all**. The expensive work — a hundred seeks for the
filmstrip, `decodeAudioData` for the waveform — happens once per file and is then
never repeated.

## 2. Why a streaming hash instead of SHA-256

`crypto.subtle.digest` needs the whole file in memory at once. A 300MB clip would
therefore cost 600MB of heap at the moment the user drops it in, which is the kind
of spike that takes the tab with it.

`contentId()` instead runs four interleaved 32-bit passes over 4MB chunks:
constant memory, every byte touched. It is a content hash for this purpose —
two files collide only if they are the same bytes *and* the same length, because
the length is part of the key. Cryptographic strength buys nothing here: the
attacker would have to make you import a file you did not choose.

Measured on a 4.7MB clip: the hash, the 11 seeks and the audio decode together
came in under 6s, and the restore of the same project is a single read.

## 3. Dedupe is what makes the hash worth having

The second import of a file you already have does not create a second copy. It
creates a second *clip* on the first media:

> two imports of one 4.7MB file → **2 clips, 1 src slot, 1 media record, 1 cache**

`addFile` hashes first, looks for a source with that hash, and if it finds one
reuses the slot. This is the case a filename-based cache gets wrong, and the one
that shows up constantly: two takes both called `take-01.mp4`.

## 4. Refcounts are derived, never stored

`liveMedia()` walks `clips → src slot → media hash` and drops anything nothing
points at. There is no counter in any record, on purpose: a stored counter drifts
the moment an undo, a reload or a crash lands between the edit and the write, and
then it deletes media that is still in the timeline, or keeps media no clip can
reach.

The chain is three lines. There is nothing to keep in sync.

The case that decides it is **Duplicate**. Duplicating a clip leaves two clips on
one source, and a counter incremented on duplicate then decremented on delete gets
it wrong on the second delete. Measured:

| step | media | caches | src slots |
|---|---|---|---|
| two clips share source 1, a third uses source 2 | 2 | 2 | 2 |
| delete one of the two sharing source 1 | **2** | **2** | 2 |
| delete the last clip on source 1 | 1 | 1 | 1 |

Nothing is freed until the last reference goes, and the *other* media is never
touched at all.

## 5. Versioning, and the migration that actually matters

`DBV` is the IndexedDB version; `DOCV` is stamped inside every document. The
second is the one that earns its keep, because the database version only tells you
the *store* changed — it cannot tell you that a clip stored last month has no
`opacity` key, because the build that wrote it predates the knob.

`migrateDoc()` applies every default in one place, with stored values last so a
present value always wins:

> a document with no `opacity`, `rev`, `blue`, `blur`, `rot` or `tr` →
> `opacity: 1, rev: false, blue: 0, blur: 0, rot: 0, tr: {}`

This is not tidiness. `undefined` is not a default, and a clip whose `opacity` is
`undefined` is the difference between a restored project and a black canvas — the
guards scattered through the file would each have to remember.

**And the version is checked in both directions.** A version number that only
protects old readers is not a versioned schema. `migrateDoc()` stamps whatever it
reads with *its own* `DOCV`, so a document written by a **newer** build would be
silently downgraded — and then the autosave, which resumes the moment `restore()`
returns, would write that downgrade over the original. Every field the newer build
added would be gone, with nothing to show for it.

So a newer document is refused: not opened, not downgraded, not overwritten, and
this build sets `docLocked` and stops saving entirely. Measured:

> a `v8` document with a `futureField` → after restore, still `v8:keep me`, saves locked, nothing written
> with the guard removed → **`v1:`, the field gone**

The lock lifts only on an explicit, two-tap-confirmed **Clear** — leaving the app
permanently unable to save would be worse than either outcome.

## 6. Hydration is lazy in the way that costs nothing to be wrong about

Restored `<video>` elements are created with `preload='metadata'`, so eight
two-minute clips fetch eight headers rather than eight hundred megabytes. Every
existing call site keeps working unchanged, which is the point: the alternative
was threading a hydration check through `seekVid`, `activate`, `frameStage` and
the export path for a saving that `max-width/max-height` and the derived cache
already provide.

## 7. Failure is always a working app

- **No IndexedDB** (private mode, blocked, `onblocked`): `db` stays null, every
  write is skipped, the app is the app it was before. Nothing throws.
- **Quota exceeded on import**: unreferenced media is swept — the only thing we may
  delete without asking — and the write is retried **once**. If it still fails the
  caller is told, because "saved" would be a lie.
- **A clip whose bytes are gone**: dropped rather than left pointing at an empty
  slot, and the count is stated in a toast. A clip that cannot play is not a clip.
- **Unloading**: `visibilitychange` is the one that matters. It fires when a tab is
  backgrounded or closed on a phone, minutes before the document is actually gone,
  and the save throttle is 700ms. An IndexedDB write started *during* unload is
  not reliably finished, so that is a best effort and this comment is the honest
  version of it.

## 8. The one row in Settings

`Saved project · 12 MB of 137764 MB used · Clear`. The `Clear` button arms on the
first tap and only acts on the second, because it is the one destructive control
in the app and a single tap that erases an afternoon is not a feature.

## 9. Verified

Six rows in [`selfcheck.html`](selfcheck.html), driven against a real database
with real bytes, in a store of its own:

| | claim |
|---|---|
| content hash | same bytes → same id; one byte different → different id |
| media round trip | a 4096-byte file stored and read back whole, with its name and length |
| the edit round trip | the cut, the look, the trim window and the schema version come back exactly |
| an old document | no `opacity` key in → `1` out, every later field defaulted |
| refcounted collection | the table in §4 |
| a newer document | a `v8` document survives a restore untouched, and no save is queued |
| its own store | the check runs on `sc-persist`, never on the reader's project |

**That last row is load-bearing.** `selfcheck.html` drives this file inside
iframes on the same origin, so without a `?db=` override every check would open
the reader's real project — and `forgetAll()` would delete an afternoon's work.
The override is also the seam a second project would hang off.

Each row was proven able to fail:

| injected | what the row reported |
|---|---|
| `contentId` returning a constant | the two 8-byte files `COLLIDED` |
| `liveMedia` reporting nothing in use | GC freed what the refcount row protects |
| `opacity:1` removed from `migrateDoc` | `no opacity key in → undefined` |
| the forward-version guard removed | `v8` downgraded to `v1`, field gone |

## 10. Not done, deliberately

- **No project switcher.** One document, keyed `current`. The store is shaped for
  several; the UI for it is not built.
- **No export or import of a project file.** Nothing leaves the browser, which is
  also why there is no "your project is on this device only" warning yet.
- **Peaks are still skipped over 200MB** (`f.size>2e8`), so a very long file
  restores without a waveform until it is re-imported. The thumbnail pass has no
  such cap.
- **Quota is surfaced, not managed.** There is no eviction policy beyond sweeping
  what nothing references, so a user who imports fifty long clips and keeps them
  all will hit the quota and be told.
- **A newer document blocks saving entirely** until it is cleared. That is the
  safe direction to fail in — refusing to write beats deleting fields — but it
  means downgrading the app to an older build leaves it read-only.