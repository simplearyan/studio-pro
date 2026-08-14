# public/fonts — Vendored Google Fonts (offline-safe)

This folder holds **local copies of the Google-hosted font families** the editor
uses, plus the `@font-face` stylesheet (`fonts.css`) that loads them. `index.html`
points at `fonts/fonts.css` instead of `https://fonts.googleapis.com/css2?…`, so
the editor renders the exact same typography with **zero network requests** — the
dev server, the built `dist/`, and the GitHub Pages deploy all work offline.

Served by Vite as static assets (files in `public/` are copied verbatim into
`dist/`), so no build config changes are needed.

---

## What is vendored here

The same families/weights the old Google Fonts `<link>` requested:

| Family | Weights (incl. italics) |
|---|---|
| JetBrains Mono | 400, 500, 600 |
| Plus Jakarta Sans | 400, 500, 600, 700, 800 |
| Bangers | 400 |
| Bebas Neue | 400 |
| Fredoka | 600, 700 |
| Inter | 400, 500, 600, 700, 900 |
| Lora | 400, 700, italic 400, italic 700 |
| Montserrat | 800, italic 800 |
| Oswald | 700 |
| Rubik | 300–900 variable, italic 300–900 |

Every **unicode subset** Google returns (latin, latin-ext, cyrillic, cyrillic-ext,
greek, vietnamese, …) is kept — text clips containing non-Latin script still
render correctly offline.

## Do PC / system fonts get affected?

**No.** The editor has two separate font sources:

1. **Google-hosted families** (the table above) — these *were* downloaded from
   `fonts.gstatic.com` at runtime. This folder replaces that download. ✅ vendored
2. **PC / system fonts** (the "System" group in the font picker — Arial, Segoe UI,
   Calibri, Times New Roman, …) — these are **never fetched from any server**.
   They are resolved by the operating system from the user's own machine via the
   CSS `font-family` stack. Vendoring Google Fonts has **zero impact** on them:
   they keep working online and offline, before and after this change.

The only remaining network font path is the **user-imported Google Fonts**
(`studiopro_google_fonts`, added via `importGoogleFontFromInput`) — those are still
loaded at runtime from Google. See the offline plan
(`docs/features/Offline-Dev-Server-Plan.md`, Phase 4) for making those offline-safe.

---

## How to regenerate (when you add a family or weight)

### 1. Fetch the Google Fonts CSS (Chrome UA → woff2 files)

```bash
curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Bangers&family=Bebas+Neue&family=Fredoka:wght@600;700&family=Inter:wght@400;500;600;700;900&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Montserrat:ital,wght@0,800;1,800&family=Oswald:wght@700&family=Rubik:ital,wght@0,300..900;1,300..900&display=swap" \
  -o /tmp/gfonts.css
```

The `User-Agent` matters: with a Chrome UA, Google returns `woff2` URLs; with the
default curl UA it returns `.ttf`, which we don't want.

### 2. Download every woff2 and rewrite the CSS to local paths

```bash
python - <<'EOF'
import re, os, urllib.request

css = open('/tmp/gfonts.css', encoding='utf-8').read()
os.makedirs('public/fonts', exist_ok=True)
seen = {}

def fetch(url, name):
    if name in seen: return name
    seen[name] = True
    if not os.path.exists(f'public/fonts/{name}'):
        urllib.request.urlretrieve(url, f'public/fonts/{name}')
    return name

def repl(m):
    url = m.group(1)
    # https://fonts.gstatic.com/s/<family>/<version>/<file>.woff2
    fam, ver, fn = re.search(r'/s/([^/]+)/([^/]+)/([^/]+)$', url).groups()
    name = f'{fam}-{ver}-{fn}'
    return f'url(./{fetch(url, name)})'

out = re.sub(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', repl, css)
open('public/fonts/fonts.css', 'w', encoding='utf-8').write(out)
print('blocks:', css.count('@font-face'), '| files:', len(seen))
EOF
```

This keeps every `@font-face` declaration identical (family, style, weight,
`unicode-range`, `font-display: swap`) and only rewrites the `src` URL to a
relative `./<file>.woff2` so the browser resolves it against `fonts.css`.

### 3. Point `index.html` at the local sheet

Replace the Google Fonts `<link>` with:

```html
<link href="fonts/fonts.css" rel="stylesheet">
```

The relative path works in dev (`/fonts/fonts.css`) and under the `/studio-pro/`
GitHub Pages base. The `fonts.googleapis.com` / `fonts.gstatic.com` preconnects can
stay — they still help the runtime-imported user fonts.

### 4. Verify

- `curl -s localhost:3000/fonts/fonts.css` returns the local sheet (200).
- DevTools → Network: no `fonts.gstatic.com` requests for the editor's static fonts.
- A Rubik text clip renders in Rubik offline; a Cyrillic/Greek string renders too.
- `npm run build` → `dist/fonts/fonts.css` + the `.woff2` files are present.
