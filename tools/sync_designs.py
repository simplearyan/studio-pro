#!/usr/bin/env python3
"""Sync the /designs gallery from Google Sheets.

Fetches the public CSV export of the linked response Sheet, validates each
row against the HIC render contract, and writes docs/html-in-canvas/
designs-gallery.json (newest first). Designed for the sync-designs GitHub
Action but safe to run locally:  python tools/sync_designs.py

Architecture: Google Form -> Sheet -> this script -> static JSON on Pages.
Same "static backend" pattern as thumb-maker's update_community_presets.py.
"""

import csv
import io
import json
import os
import re
import sys
import urllib.request

# =============================================================
# Google Sheet ID (linked to the HIC Designs form responses)
# =============================================================
SHEET_ID = "1bqe4mZ3VAho0tNn53-LvCjqUyn08tJmgVJT0CXa2VC0"
# =============================================================

OUTPUT_REL = os.path.join("docs", "html-in-canvas", "designs-gallery.json")

# Limits mirroring the client-side submit validation
MAX_FIELD = 30000
MAX_PROMPT = 8000
MAX_TITLE = 60
MAX_CREATOR = 40
MIN_DURATION = 500
MAX_DURATION = 60000

# Determinism contract: reject code that cannot be seeked/re-rendered
BANNED_JS = re.compile(r"\brequestAnimationFrame\b|\bsetTimeout\b|\bsetInterval\b|\bfetch\s*\(|\bXMLHttpRequest\b")
BANNED_CSS = re.compile(r"@keyframes\b|animation\s*:")


def fetch_csv() -> str:
    url = f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Sheet fetch HTTP {resp.status} — is it shared 'Anyone with link / Viewer'?")
        return resp.read().decode("utf-8")


def read_rows(csv_text: str):
    reader = csv.reader(io.StringIO(csv_text))
    headers = next(reader, [])
    # Map columns case-insensitively by question title
    idx = {}
    for i, col in enumerate(headers):
        idx[col.strip().lower()] = i
    required = ["timestamp", "title", "creator", "html", "js"]
    missing = [r for r in required if r not in idx]
    if missing:
        raise RuntimeError(f"Sheet is missing expected columns: {missing}. Found: {headers}")

    rows = []
    for row in reader:
        if not row or len(row) <= max(idx.values()):
            continue
        def get(name):
            i = idx.get(name)
            return row[i].strip() if i is not None and len(row) > i else ""
        rows.append({
            "timestamp": get("timestamp"),
            "title": get("title"),
            "creator": get("creator"),
            "tags": get("tags"),
            "prompt": get("prompt"),
            "duration": get("duration"),
            "html": get("html"),
            "css": get("css"),
            "js": get("js"),
        })
    return rows


def title_from_html(html: str) -> str:
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", html or "", re.IGNORECASE)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def js_compiles(js: str) -> bool:
    # Conservative structural check without a JS engine: balanced braces/parens
    # and a bare "function onFrame" (or arrow) definition. The Action has no
    # Node available guarantees beyond `python`, so keep it static.
    if "onFrame" not in js:
        return False
    for a, b in (("(", ")"), ("{", "}"), ("[", "]")):
        if js.count(a) != js.count(b):
            return False
    return True


def validate(row: dict) -> tuple:
    """Return (design_dict_or_None, reject_reason)."""
    title = row["title"][:MAX_TITLE].strip()
    creator = row["creator"][:MAX_CREATOR].strip() or "anonymous"

    if not title:
        return None, "missing title"

    html = row["html"]
    css = row["css"]
    js = row["js"]

    # Rows may be prompt-only submissions (no code) — allow, mark as prompt brief
    has_code = bool(html or css or js)

    if has_code:
        if len(html) > MAX_FIELD or len(css) > MAX_FIELD or len(js) > MAX_FIELD:
            return None, "field over size cap"
        if not re.match(r"^\s*<title[^>]*>", html or ""):
            return None, "html missing <title> as first element"
        if BANNED_JS.search(js):
            return None, "js uses banned APIs (rAF/setTimeout/fetch)"
        if BANNED_CSS.search(css):
            return None, "css uses @keyframes/animation"
        if not js_compiles(js):
            return None, "js does not look like a compilable onFrame (unbalanced braces?)"

    if len(row["prompt"]) > MAX_PROMPT:
        return None, "prompt over size cap"

    try:
        duration = int(float(row["duration"])) if row["duration"] else 5000
    except ValueError:
        duration = 5000
    if not (MIN_DURATION <= duration <= MAX_DURATION):
        duration = 5000

    tags = [t.strip().lower() for t in re.split(r"[,;]", row["tags"]) if t.strip()]
    if not tags:
        tags = ["community"]

    design = {
        # Stable id from title+timestamp so re-runs dedupe cleanly
        "id": "d_sub_" + slug(title) + "_" + slug(re.sub(r"[^0-9a-zA-Z]", "", row["timestamp"])[:16]),
        "title": title,
        "creator": creator,
        "tags": tags,
        "prompt": row["prompt"],
        "duration": duration,
        "html": html,
        "css": css,
        "js": js,
        "createdAt": row["timestamp"],
    }
    return design, None


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


def main() -> int:
    if SHEET_ID == "PASTE_SHEET_ID_HERE":
        print("ERROR: set SHEET_ID at the top of the script")
        return 1

    try:
        csv_text = fetch_csv()
    except Exception as e:
        print(f"FAILED to fetch sheet: {e}")
        return 1

    rows = read_rows(csv_text)
    print(f"Fetched {len(rows)} response rows")

    designs, rejected = [], []
    seen = set()
    for i, row in enumerate(rows):
        design, reason = validate(row)
        if design is None:
            rejected.append((i + 2, reason))  # +2: header row + 1-indexing
            continue
        # Dedupe by title+creator — a resubmission updates the entry
        key = (design["title"].lower(), design["creator"].lower())
        if key in seen:
            # keep the newest: rows arrive oldest-first, so replace
            designs = [d for d in designs if (d["title"].lower(), d["creator"].lower()) != key]
        seen.add(key)
        designs.append(design)

    # Newest first (Sheet appends rows chronologically)
    designs.reverse()

    # Merge: keep existing seed/manual entries that are NOT submissions
    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", OUTPUT_REL)
    existing = {"designs": []}
    if os.path.exists(out_path):
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception as e:
            print(f"WARN could not parse existing gallery ({e}) — starting fresh")

    keep = [d for d in existing.get("designs", []) if not str(d.get("id", "")).startswith("d_sub_")]
    # Submitted designs replace same-id seeds and carry the newest data
    merged = keep + designs
    merged.sort(key=lambda d: d.get("createdAt") or "", reverse=True)
    # Seed entries (no createdAt) sink to the bottom naturally via empty-string key

    out = {"updatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "designs": merged}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Kept {len(keep)} existing non-submission entries + {len(designs)} submissions = {len(merged)} total")
    if rejected:
        print(f"Rejected {len(rejected)} rows:")
        for line, reason in rejected[:20]:
            print(f"  row {line}: {reason}")
    print(f"Wrote {os.path.normpath(out_path)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
