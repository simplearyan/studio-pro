# public/vendor/katex — Vendored KaTeX, inlined into maths clips

KaTeX `0.16.11`, from `https://registry.npmjs.org/katex/-/katex-0.16.11.tgz`, with all
20 @font-face rules rewritten to carry their **woff2 face as a
base64 data URI** and their woff/ttf fallbacks dropped.

| file | size | sha256 |
| --- | --- | --- |
| `katex.min.css` | 359KB | `409fc79f79b6d325…` |
| `katex.min.js` | 269KB | `e6bfe5deebd4c7cc…` |
| `auto-render.min.js` | 3KB | `7b57d427ac627067…` |

## Why the CSS is not the published one

The published `katex.min.css` points at 20 faces × 3 formats sitting in a
`fonts/` directory beside it. A reel clip is a self-contained HTML fragment
that may be exported to a bare file and opened with no server, so a sibling
directory is exactly what it cannot have. woff2 is supported by every browser
this app runs in, so the two older formats are pure weight. Inlining the faces
costs ~350KB of text and removes the directory from the problem entirely.

## How a clip uses it

`reel-compile.cjs` reads these three files and hands them to the emitter as
`sb.math`, which splices them into the clip's html as one inline `<style>` and
two `<script src="data:text/javascript;base64,…">` tags. The scripts are data:
URLs rather than inline scripts on purpose: `hic-frame.js` mounts clip html with
`innerHTML`, and **scripts inserted that way never execute** — only external
`<script src>` tags are hoisted and run. A data: URL is external, so the same
markup works through the renderer *and* from `file://` (verified in headless
Chrome).

`design.math.src` selects the renderer per film:

- *(unauthored)* → `vendor/katex`, i.e. this folder: inlined, offline, the default.
- `cdn:jsdelivr katex@…` → the old three CDN tags; reported as informational, not failed.
- empty → a hard failure for a film with `latex` elements, because an empty
  `src` is exactly what an offline export renders as raw `$$…$$`.

## Regenerate / update

```bash
node automation/studio-reel/vendor-katex.cjs            # fetch the pinned tarball from npm
node automation/studio-reel/vendor-katex.cjs --check    # has anything here drifted?
```

Bump `KATEX_VERSION` in `automation/studio-reel/vendor-katex.cjs` to move
versions — the pin is deliberate, so two checkouts compile a film to the same
clip. `--from DIR` takes an already-extracted `dist/` for an offline machine.
