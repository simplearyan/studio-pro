#!/usr/bin/env node
/*
 * Generates the installable-app icons from the play mark.
 *
 * Why this exists instead of a build step or a dependency: Chrome will not offer
 * "Install app" without a 192x192 AND a 512x512 PNG in the manifest, and the
 * mark so far only existed as an SVG data URI in a favicon link — which a
 * manifest cannot use. The repo has no image toolchain (no sharp, no
 * ImageMagick), and pulling one in for four flat-colour PNGs is a poor trade.
 * So: a PNG encoder and a rasteriser, both small enough to read.
 *
 * The mark is the same triangle the favicon draws, `M9 4v24l19-12z` in a 32x32
 * box, re-centred and scaled. Full-bleed background, no rounded corners: the
 * platform applies its own mask (Android adaptive, iOS squircle), and a rounded
 * icon inside a rounded mask gets double-rounded.
 *
 * Run: node tools/make-app-icons.cjs
 */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ── PNG container ─────────────────────────────────────────────────────────
// Signature + IHDR + IDAT + IEND, each chunk length-prefixed and CRC-suffixed.
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour with alpha
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace
  // One filter byte (0 = None) per scanline, then the row's RGBA bytes.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const at = y * (size * 4 + 1);
    raw[at] = 0;
    rgba.copy(raw, at + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── geometry ──────────────────────────────────────────────────────────────
const hex = h => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

// Sign-of-cross-product test. The mark is one triangle, so this stays trivial.
function inTriangle(px, py, t) {
  const d = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]);
  const p = [px, py];
  const d1 = d(p, t[0], t[1]);
  const d2 = d(p, t[1], t[2]);
  const d3 = d(p, t[2], t[0]);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/*
 * fit is the fraction of the canvas the mark's bounding box may occupy.
 * 0.62 for maskable: Android crops a maskable icon to a circle of 80% diameter,
 * and a triangle's corners are the first thing to clip, so the mark has to sit
 * well inside that. 0.74 for "any", where the only constraint is legibility.
 */
function render(size, { bg, fg, fit }) {
  const out = Buffer.alloc(size * size * 4);
  const bgc = hex(bg);
  const fgc = hex(fg);
  const SS = 4; // supersampling factor, per axis
  const cx = size / 2;
  const cy = size / 2;

  /* Mark bounds in the favicon's 32-unit box: x 9..28, y 4..28. Map those
     units onto the canvas by SUBTRACTING the bounds origin — ox is already the
     left edge of the mark, so adding (9/32)*scale to it as well double-counts
     the offset and shoves the triangle off the right edge. */
  const minX = 9, minY = 4, boxW = 19, boxH = 24;
  const span = size * fit;
  const s = span / boxH;               // 24 source units -> `span` canvas px
  const ox = cx - (boxW * s) / 2;
  const oy = cy - (boxH * s) / 2;
  const P = (x, y) => [ox + (x - minX) * s, oy + (y - minY) * s];
  const tri = [P(9, 4), P(9, 28), P(28, 16)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (inTriangle(px, py, tri)) hits++;
        }
      }
      const i = (y * size + x) * 4;
      const a = hits / (SS * SS);
      // Composite the mark over the background; full-bleed means alpha is 255
      // everywhere, but keep the channel honest in case fit is ever raised.
      out[i] = Math.round(bgc[0] * (1 - a) + fgc[0] * a);
      out[i + 1] = Math.round(bgc[1] * (1 - a) + fgc[1] * a);
      out[i + 2] = Math.round(bgc[2] * (1 - a) + fgc[2] * a);
      out[i + 3] = 255;
    }
  }
  return out;
}

// ── emit ───────────────────────────────────────────────────────────────────
const BG = process.env.ICON_BG || '#171717'; // the manifest's theme_color
const FG = process.env.ICON_FG || '#ffffff';
const OUT = path.join(__dirname, '..', 'public', 'icons');

const FILES = [
  // Chrome's install bar: 192 and 512 are both required, or no prompt.
  { name: 'icon-192.png', size: 192, purpose: 'any', fit: 0.74 },
  { name: 'icon-512.png', size: 512, purpose: 'any', fit: 0.74 },
  // Android adaptive: the platform crops to a circle of 80% diameter.
  { name: 'icon-maskable-512.png', size: 512, purpose: 'maskable', fit: 0.62 },
  // iOS ignores the manifest entirely and reads this link instead.
  { name: 'apple-touch-icon.png', size: 180, purpose: 'apple', fit: 0.74 },
];

fs.mkdirSync(OUT, { recursive: true });
const written = [];
for (const f of FILES) {
  const png = encodePng(f.size, render(f.size, { bg: BG, fg: FG, fit: f.fit }));
  fs.writeFileSync(path.join(OUT, f.name), png);
  written.push(`${f.name} (${f.size}x${f.size}, ${(png.length / 1024).toFixed(1)} KB)`);
}
console.log(`background ${BG} · mark ${FG}`);
for (const w of written) console.log('  ' + w);
console.log(`\n${written.length} icons -> ${path.relative(process.cwd(), OUT)}`);