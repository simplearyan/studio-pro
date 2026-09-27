/* Favicon tile — static ✓ glyph on the IITM stage color, 1:1 design space.
 * Exported at 512×512 by render-meta.mjs and downscaled to 64/32.
 * Mirrors site/public/meta-src/favicon.html (kept as the hand-tuned source
 * of truth; this module exists so the whole set renders in one run). */

export const title = 'IITM — Favicon';
export const ds = '1:1';
export const dur = 1;

export const html = `<div class="tile"><svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="108" fill="#0e1512"/><path d="M150 268 L228 344 L366 190" fill="none" stroke="#7ee2a8" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;

export const css = `*{margin:0;padding:0}
.tile{width:450px;height:450px}
.tile svg{width:100%;height:100%;display:block}`;

export const js = `function onFrame(t){ /* static glyph — nothing to animate */ }`;
