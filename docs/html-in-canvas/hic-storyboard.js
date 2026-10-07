/* ═══════════════════════════════════════════════════════════════════════
 * hic-storyboard.js — storyboard → clip compiler (IITM ⇄ HIC bridge)
 *
 * Compiles a storyboard.json (templates/storyboard.schema.json) into a
 * SELF-CONTAINED HIC clip { name, dur, html, css, js, ds } whose onFrame(t)
 * IS the storyboard interpolator. Feed the clip to hic-modal's open(),
 * HicRenderer.setClip(), or download it as a standalone HTML — the
 * wall-clock WebM export, Save Frame, scrubbing, and deep links all work
 * UNCHANGED because the choreography lives in onFrame, deterministically.
 *
 * Where the pieces run:
 *   - compileStoryboard(sb) → clip            — runs in browser or Node
 *   - embedRuntime()                          — injects the runtime into js
 *   - clipRuntimeCss                          — the runtime's CSS as a string
 *
 * Determinism note: the emitted onFrame NEVER reads the wall clock or
 * random state; it renders purely from (t) — the same contract hic-frame's
 * HicRenderer and hic-modal's wall-clock WebM loop already require.
 * ═══════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  /* CJS (Node require, bundlers) — skipped under ESM where `module` is undefined */
  if (typeof module === 'object' && typeof module.exports === 'object') module.exports = api;
  /* classic browser script + ESM-under-"type":"module" fallback */
  if (root) root.hicStoryboard = api;
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : undefined, function () {
  'use strict';

  /* ── runtime css (kept in sync with runtime/hic-scenes.css essentials;
      stage-relative so it works at ANY design-space size) ────────────── */
  var RUNTIME_CSS =
    '.hss{position:relative;width:100%;height:100%;overflow:hidden;font-family:Inter,-apple-system,sans-serif}' +
    '.hss *{box-sizing:border-box}' +
    /* The stage inherits whatever colour the host page happens to have, and
       .hss-tile-head / .hss-tile-body / .hss-panel-label set none of their
       own. On a dark-themed film embedded in a page that is fine by luck; the
       moment the stage goes light the same labels render black-on-black, and
       nothing reports it because every colour is syntactically valid. Set the
       ink ONCE at the stage, from the theme, so an inherited host colour can
       never decide how the film reads. Deliberately a SEPARATE rule rather
       than an edit to .hss{} above, so the legacy rule stays byte-identical
       (reel-regression compares CSS rule-by-rule). */
    '.hss{color:var(--hss-ink,#f8fafc)}' +
    '.hss-scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;padding:0 8%;opacity:0;will-change:opacity}' +
    '.hss-el{position:relative;opacity:0;will-change:opacity,transform}' +
    '.hss-text{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);font-weight:600;text-align:center}' +
    '.hss-title{font-family:var(--hss-font-display,inherit);font-size:22px;letter-spacing:3px;margin-bottom:10px}' +
    '.hss-sub{font-family:var(--hss-font-body,inherit);font-size:13px;font-weight:500}' +
    '.hss-body{font-family:var(--hss-font-body,inherit);font-size:18px}' +
    '.hss-latex{text-align:center}.hss-latex .katex-display{margin:.35em 0}' +
    '.hss-answer{font-family:var(--hss-font-display,Literata,Georgia,serif);font-weight:700;font-size:34px;text-align:center}' +
    '.hss-cards{display:flex;gap:14px}' +
    '.hss-card{width:56px;height:78px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;box-shadow:0 10px 25px rgba(0,0,0,.5)}' +
    '.hss-cardwrap{position:relative;opacity:0;will-change:opacity,transform}' +
    /* ── the five R1 element types ──────────────────────────────────────────
       These exist because buildElHtml() had no case for them, so an authored
       stat / card / tiles / pills / credit silently rendered as an empty
       <div class="hss-el"> with a green exit code. Added 2026-10 with the
       emitter-side work R1's defer inventory asked for.

       Sizes are STAGE-RELATIVE (vw/vh/cqw-free) so they survive any
       design-space, matching how the rest of this stylesheet works. The type
       ramp is still the runtime's own; an authored `ramp` in storyboard.frame
       is not resolved here. */
    '.hss-stat{display:flex;flex-direction:column;align-items:center;gap:4px}' +
    '.hss-stat-num{font-size:5.2vw;font-weight:800;letter-spacing:-0.02em;line-height:1;' +
      'background:linear-gradient(180deg,var(--hss-num-a,#f8fafc),var(--hss-num-b,#a78bfa));' +
      '-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '.hss-stat-label{font-size:1.25vw;font-weight:400;opacity:.78;max-width:22ch;text-align:center;line-height:1.35}' +
    '.hss-panels{display:flex;gap:1.4vw;align-items:stretch}' +
    '.hss-panel{position:relative;display:flex;flex-direction:column;gap:.5vh;min-width:15vw;' +
      'padding:1.6vh 1.4vw;border-radius:var(--hss-radius,1.1vw);background:var(--hss-panel,#121a26);' +
      'border:var(--hss-border,1px solid rgba(255,255,255,.09));' +
      'box-shadow:var(--hss-shadow,0 1.4vh 3vh rgba(0,0,0,.45))}' +
    '.hss-panel-num{font-size:3.1vw;font-weight:800;letter-spacing:-.02em;line-height:1}' +
    '.hss-panel-label{font-size:1.05vw;font-weight:400;opacity:.75;line-height:1.35}' +
    /* the meter fill is driven from onFrame via width, never a CSS animation —
       a CSS transition here would read the wall clock and break determinism */
    /* the meter's TRACK was rgba(255,255,255,.10) - a hardcoded assumption that
       the stage is dark. On a light theme it is white on white and the track
       disappears entirely, which reads as "no meter authored" rather than
       "meter with an empty track". Theme-driven, same default. */
    '.hss-meter{margin-top:.6vh;height:.55vh;border-radius:1vh;background:var(--hss-meter-track,rgba(255,255,255,.10));overflow:hidden}' +
    '.hss-meter-fill{height:100%;width:0;border-radius:var(--hss-radius,1vh);background:var(--hss-meter,#38bdf8)}' +
    '.hss-tiles{display:grid;gap:1.1vw 1.4vw}' +
    '.hss-tile{display:flex;flex-direction:column;gap:.5vh;padding:1.4vh 1.2vw;border-radius:var(--hss-radius,1vw);' +
      'background:var(--hss-panel,#121a26);border:var(--hss-border,1px solid rgba(255,255,255,.07));' +
      'box-shadow:var(--hss-shadow,0 1.4vh 3vh rgba(0,0,0,.45))}' +
    '.hss-tile-icon{font-size:2.1vw;line-height:1}' +
    '.hss-tile-head{font-size:1.3vw;font-weight:700;letter-spacing:.01em}' +
    '.hss-tile-body{font-size:.98vw;font-weight:400;opacity:.74;line-height:1.4}' +
    '.hss-pills{display:flex;gap:.9vw;flex-wrap:wrap;justify-content:center}' +
    '.hss-pill{font-size:1.25vw;font-weight:600;padding:.7vh 1.5vw;border-radius:var(--hss-radius,6vw);' +
      'border:var(--hss-border,1px solid var(--hss-pill,#38bdf8));color:var(--hss-pill,#38bdf8);white-space:nowrap}' +
    '.hss-credit{position:absolute;left:0;right:0;bottom:3.2vh;text-align:center;' +
      'font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);' +
      'font-size:.95vw;font-weight:700;opacity:.75;letter-spacing:.12em;text-transform:uppercase;' +
      'color:var(--hss-ink,#f8fafc)}' +
    /* per-item wrappers, same contract as .hss-cardwrap: the HOST stays
       statically opaque and the items animate individually, or the wrapper
       rule below would hide the whole group */
    '.hss-slot{position:relative;opacity:0;will-change:opacity,transform}' +
    '.hss-shape{position:absolute;inset:0;pointer-events:none;border:3px solid currentColor;border-radius:8px}' +
    '.hss-shape-underline{border:none;height:4px;border-radius:2px;top:auto;bottom:-4px;left:0;right:0;width:auto}' +
    '.hss-overlay{position:absolute!important;left:-6px!important;top:-6px!important;width:calc(100% + 12px)!important;height:calc(100% + 12px)!important}' +
    /* ── annotation marks: the circle / arrow / highlight shape kinds ────
       The vocabulary is the annotation film's, but the rules live here
       because the EMITTER draws them. Everything below is appended after the
       legacy shape rules (same specificity, later in the sheet → wins
       wherever a new kind is authored, changes nothing for box/underline).

       .hss-overlay-ring is a SECOND overlay geometry: a ring six pixels from
       the glyph box hugs the text like a bracket, so `circle` gets its own
       padding class, added by buildElHtml beside .hss-overlay.

       The arrow is a FIXED-pixel svg, not a stretched viewBox. A host-relative
       box would squeeze the arrowhead by whatever ratio the target's aspect
       happens to be — an annotation arrow whose head collapses into a sliver
       stopped reading as an arrow — and a fixed size also means the mark's
       geometry never scales with anything, so it cannot drift from what was
       designed. reel-extent skips absolutely-positioned children when it
       measures a host, so the stem reaching outside the overlay box is not a
       hidden overflow either; it is measured on the mark's own row instead. */
    '.hss-overlay-ring{left:-18px!important;top:-14px!important;width:calc(100% + 36px)!important;height:calc(100% + 28px)!important}' +
    '.hss-shape-circle,.hss-shape-highlight,.hss-shape-arrow,.hss-shape-dbl-underline{border:none}' +
    '.hss-draw{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
    /* non-scaling-stroke is load-bearing: the circle's viewBox stretches to
       the target's box, and without it the ring's stroke would be scaled by
       sx on the sides and sy on the top — 38px on a 1280px-wide title. */
    '.hss-shape-circle ellipse{fill:none;stroke:currentColor;stroke-width:3;vector-effect:non-scaling-stroke}' +
    '.hss-arrow-svg{position:absolute;top:50%;margin-top:-28px;width:160px;height:56px}' +
    '.hss-shape-arrow svg.hss-arrow-left{right:calc(100% - 16px)}' +
    '.hss-shape-arrow svg.hss-arrow-right{left:calc(100% - 16px);transform:scaleX(-1)}' +
    '.hss-shape-arrow svg.hss-arrow-top{left:50%;top:auto;bottom:calc(100% - 18px);width:56px;height:160px;margin:0 0 0 -28px}' +
    '.hss-shape-arrow svg.hss-arrow-bottom{left:50%;top:calc(100% - 18px);width:56px;height:160px;margin:0 0 0 -28px;transform:scaleY(-1)}' +
    '.hss-arrow-path{fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}' +
    /* alpha, not mix-blend-mode: the mark sits inside an overlay that carries
       will-change:opacity, which makes it a stacking context, and a stacking
       context ISOLATES blending — a multiply child would blend against an
       empty group and paint an opaque block over the words. Plain alpha
       composites against the text the old-fashioned way, at an opacity low
       enough that ink underneath still clears AA large-text on the tint. */
    '.hss-hl{position:absolute;inset:0;background:currentColor;border-radius:4px;opacity:.4}' +
    '.hss-dbl{position:absolute;left:0;right:0;bottom:-9px;height:12px;width:100%;overflow:visible}' +
    '.hss-dbl line{stroke:currentColor;stroke-width:3;stroke-linecap:round;vector-effect:non-scaling-stroke}' +
    /* ── component variants, per-type radius, alignment ───────────────────
       `design.style` named a component language and was reported "not
       implemented" on every film, because there was no way to say which of
       the four visual treatments an element wanted. Material puts 8 / 14 /
       20 / 24 / 999 on ONE screen while the theme carried a single
       --hss-radius, so a film had to pick one number and live with it on the
       pill, the panel, the tile and the answer simultaneously.

       Both halves are APPENDED rather than folded into the originals above.
       Same specificity, later in the sheet: they win wherever a variant is
       authored and change nothing where it is not, and every legacy
       declaration stays byte-for-byte present — which is exactly what
       reel-regression asserts, so "additive" is checkable rather than
       claimed.

       The tonal default is a color-mix, so a theme that names no
       --hss-fill-tone still gets a surface derived from its OWN ink. Where
       color-mix is unavailable the declaration is dropped at parse time and
       the component keeps its filled background, which is a graceful miss
       rather than an invisible one. */
    '.hss-groups{display:grid;gap:1.4vw 1.4vw;align-items:stretch}' +
    '.hss-fill-filled{background:var(--hss-fill,var(--hss-panel,#121a26));color:var(--hss-fill-ink,var(--hss-slab-ink,#151217));border-color:transparent}' +
    '.hss-fill-tonal{background:var(--hss-fill-tone,color-mix(in srgb,var(--hss-ink,#f8fafc) 14%,transparent));border-color:transparent}' +
    /* outlined drops the fill and leaves the component’s own border rule — a
       panel already outlines, but .hss-answer never had one, so it is given
       one here or "outlined" would be indistinguishable from "text". */
    '.hss-fill-outlined{background:none}' +
    '.hss-fill-text{background:none;border:none;box-shadow:none}' +
    '.hss-pill.hss-fill-filled{--hss-fill:var(--hss-pill,#38bdf8);--hss-fill-ink:var(--hss-slab-ink,#151217)}' +
    '.hss-answer.hss-fill-outlined{border:var(--hss-border,1px solid var(--hss-outline,var(--hss-ink,#f8fafc)));padding:.08em .3em}' +
    /* per-type radius. Each falls back to the shared --hss-radius, so a film
       that sets only the global keeps the exact radii it had before. */
    '.hss-pill{border-radius:var(--hss-radius-pill,var(--hss-radius,6vw))}' +
    '.hss-panel{border-radius:var(--hss-radius-card,var(--hss-radius,1.1vw))}' +
    '.hss-tile{border-radius:var(--hss-radius-tile,var(--hss-radius,1vw))}' +
    '.hss-answer{border-radius:var(--hss-radius-answer,var(--hss-radius,0))}' +
    /* alignment. The descendant selector is deliberate: .hss-text and
       .hss-stat-label both set text-align themselves, so setting it on the
       host alone would align the block and not the words inside it. These
       also carry align-self so `start` moves the element to the cross-axis
       start of the scene, not just the text inside it. */
    '.hss .hss-align-start,.hss .hss-align-start *{text-align:left}' +
    '.hss .hss-align-center,.hss .hss-align-center *{text-align:center}' +
    '.hss .hss-align-end,.hss .hss-align-end *{text-align:right}' +
    '.hss .hss-align-start{align-self:flex-start}' +
    '.hss .hss-align-end{align-self:flex-end}' +
    /* ── charts ──────────────────────────────────────────────────────────
       SVG, not canvas. A canvas chart is a black box to every gate this
       pipeline has: reel-extent measures element boxes and reel-contrast
       measures text nodes, and a rasterised chart is neither. Inline SVG is
       DOM, it scales to any stage, and a `<text>` label is a text node in
       both senses.

       Every moving part is driven from onFrame and carries its geometry as a
       data attribute that the emitter wrote once at compile time. The runtime
       never re-derives a scale — a second geometry model is a second source of
       truth, and the two disagree the first time one is edited. Same reason
       the meter reads `data-pct` rather than a percentage of a computed
       width. */
    '.hss-chart{width:100%;display:flex;flex-direction:column;gap:1vh}' +
    '.hss-chart-head{display:flex;flex-direction:column;gap:.35vh}' +
    '.hss-chart-kicker{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);' +
      'font-size:.9vw;font-weight:700;letter-spacing:.18em;text-transform:uppercase;' +
      'color:var(--hss-accent,#ffeb00)}' +
    '.hss-chart-title{font-size:2vw;font-weight:800;letter-spacing:-.015em;line-height:1.14;' +
      'color:var(--hss-ink,#f1f3f2)}' +
    '.hss-chart-sub{font-size:1vw;font-weight:400;line-height:1.4;opacity:.72}' +
    '.hss-chart-svg{width:100%;height:auto;overflow:visible;display:block}' +
    /* labels are drawn in SVG user units, so they scale with the chart rather
       than fighting it. fill/stroke are themed: a grid line hardcoded to
       rgba(255,255,255,.12) is the meter-track bug again — invisible on a
       light stage, and it reads as "no grid authored". */
    '.hss-chart-svg text{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);' +
      'fill:var(--hss-on-variant,var(--hss-ink,#a8aba6))}' +
    '.hss-chart-grid line{stroke:var(--hss-chart-grid,rgba(255,255,255,.13));stroke-width:1}' +
    '.hss-chart-axis line{stroke:var(--hss-outline,rgba(255,255,255,.28));stroke-width:2}.hss-chart-ref{stroke:var(--hss-accent,var(--hss-ink,#f1f3f2));stroke-width:4;stroke-dasharray:18 12;stroke-linecap:round}.hss-chart-svg .hss-chart-ref-label{font-size:23px;font-weight:700;fill:var(--hss-accent,var(--hss-ink,#f1f3f2))}' +
    '.hss-chart-cat{font-size:21px;font-weight:500}' +
    '.hss-chart-tick{font-size:19px;font-weight:400;opacity:.8}' +
    /* the descendant selector is load-bearing: `.hss-chart-svg text` is (0,1,1)
       and would otherwise beat `.hss-chart-value` at (0,1,0), so every value
       label would silently take the muted axis ink. reel-contrast asserts the
       tie-break rather than trusting it. */
    '.hss-chart-svg .hss-chart-value{font-size:22px;font-weight:700;fill:var(--hss-ink,#f1f3f2)}' +
    '.hss-chart-legend{display:flex;gap:1.1vw;flex-wrap:wrap;' +
      'font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);font-size:.88vw}' +
    '.hss-chart-legend span{display:inline-flex;align-items:center;gap:.55em;' +
      'color:var(--hss-on-variant,var(--hss-ink,#a8aba6))}' +
    '.hss-chart-legend i{width:.8em;height:.8em;border-radius:.18em;display:inline-block;flex:none}' +
    '.hss-chart-foot{display:flex;justify-content:space-between;gap:1vw;align-items:baseline}' +
    '.hss-chart-source{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);font-size:.75vw;' +
      'letter-spacing:.08em;text-transform:uppercase;opacity:.5}' +
    '.hss-chart-unit{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);font-size:.75vw;' +
      'letter-spacing:.08em;text-transform:uppercase;opacity:.5}' +
    '.hss-chart-empty{height:12vh;border:1px dashed var(--hss-outline,#444745);border-radius:1vw;' +
      'display:flex;align-items:center;justify-content:center;font-size:1vw;opacity:.6}';

  /* ── stage color: storyboard.background; injected on the root node ──── */

  /* ── theme keys ─────────────────────────────────────────────────────
     Module scope, not local to compileStoryboard: buildDesignPage emits the
     SAME keys onto its own board, and a second hand-kept list would drift
     from the first — which is precisely the class of bug this pipeline exists
     to remove. One list, two consumers.

     Keys are whitelisted and coerced — these strings are CSS, and an authored
     value is not trusted. Unknown keys are ignored rather than passed through,
     because `--x: red;}` would end the declaration early. */
  var THEME_KEYS = ['font-display', 'font-body', 'font-mono', 'radius', 'shadow',
    'border', 'panel', 'meter', 'meter-track', 'num-a', 'num-b', 'ink', 'accent',
    /* slab-ink is a DIFFERENT role from ink, not a synonym. A slab is a
       bright block carrying dark type; the stage is a dark field carrying
       light type. Giving both one --hss-ink is how a reversed-out name slab
       ends up paper-on-yellow at 1.43:1. Material calls the second one
       "on-container"; so does this. */
    'slab-ink',
    /* One --hss-radius cannot carry a system that uses 8/14/20/24/999 on a
       single screen, so each component gets its own key and falls back to
       the global. `fill-tone` is the tonal surface: a theme that names one
       gets its own container colour instead of the derived color-mix. */
    'radius-pill', 'radius-card', 'radius-tile', 'radius-answer',
    /* fill / fill-ink are the filled component's SURFACE and the type drawn
       on it — Material's container / on-container. Sharing one --hss-ink
       between the stage and a filled block is the slab-ink bug again: the
       stage is a dark field carrying light type, the block is a bright field
       carrying dark type, and they are different roles. */
    'fill', 'fill-ink', 'fill-tone', 'outline',
    /* chart series + grid. A data story's categorical palette is part of the
       design language, not of any one chart: five charts that each picked
       their own blue is five charts that do not look like one publication.
       The keys live here so `design.tokens` can name them per mode the same
       way it names everything else. */
    's1', 's2', 's3', 's4', 's5', 's6', 'chart-grid',
    /* `on-variant` is the muted secondary ink — axis labels, legends, ticks.
       It is a key rather than a literal because the chart CSS READS it: a
       variable the stylesheet consumes and the theme cannot set is a hardcoded
       colour wearing a var() costume. */
    'on-variant'];

  /* ── the FINISHED state, in one place ────────────────────────────────
     Applied with no timeline at all. Two callers: the clip embeds it as
     `settle()` for the scenes preview, and the design board embeds it as its
     own closing script, because a board whose sample chart is left at "no bars
     drawn" is a board advertising a chart the film never shows.

     ONE copy, because it is `_chart`'s own inverse: only `_chart` knows how a
     bar halfway looks, so only it knows how one that is finished looks, and a
     second implementation would disagree the first time a chart kind was added
     — silently, in the direction of a mark that never appears. */
  var SETTLE_JS = [
    'root=root||document;',
    'var i,ns=root.querySelectorAll(".hss-scene");',
    'for(i=0;i<ns.length;i++){ns[i].style.display="";ns[i].style.opacity="1";}',
    'ns=root.querySelectorAll(".hss-el,.hss-slot,.hss-cardwrap");',
    'for(i=0;i<ns.length;i++){ns[i].style.opacity="1";ns[i].style.transform="none";}',
    'ns=root.querySelectorAll(".hss-meter-fill");',
    'for(i=0;i<ns.length;i++){ns[i].style.width=(Number(ns[i].getAttribute("data-pct"))||0)+"%";}',
    'ns=root.querySelectorAll("[data-anim]");',
    'for(i=0;i<ns.length;i++){var el=ns[i],m=el.getAttribute("data-k");',
    '  if(m==="col"){el.setAttribute("y",el.getAttribute("data-ty"));',
    '    el.setAttribute("height",(Number(el.getAttribute("data-by"))-Number(el.getAttribute("data-ty"))).toFixed(2));}',
    '  else if(m==="row"){el.setAttribute("width",(Number(el.getAttribute("data-tx"))-Number(el.getAttribute("data-bx"))).toFixed(2));}',
    '  else if(m==="line"){el.setAttribute("stroke-dashoffset","0");}',
    '  else if(m==="area"){el.setAttribute("width",el.getAttribute("data-w"));}',
    '  else if(m==="arc"){el.setAttribute("stroke-dasharray",el.getAttribute("data-frac")+" 1");}',
    '  else if(m==="value"){el.setAttribute("opacity","1");}',
    /* annotation marks (shape circle/arrow): the finished state is fully       * drawn, so the dashoffset goes to 0 — same line shape as `line`, kept
       * as its own branch because `line` lives in _chart's key table and this
       * loop must keep answering for marks _chart never sees. */
    '  else if(m==="draw"){el.setAttribute("stroke-dashoffset","0");}',
    /* the highlight wipe is a WIDTH function of t, like the meter */
    '  else if(m==="hl"){el.style.width="100%";}',
    '}',
  ].join('\n');

  /* ── escape helper: js goes inside <script> in emitted html previews ── */
  function escapeScript(s) { return String(s).replace(/<\/script/gi, '<\\/script'); }

  /* ── escape helper: authored COPY goes into an HTML string literal ──
     buildElHtml splices authored text straight into markup, so without this
     a quote or an angle bracket in a headline becomes markup. The five R1
     types made this reachable with far more copy than text/latex ever did. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ── numeric guard: these land in a style or a data attribute ──
     grid-template-columns and width are attacker-adjacent only in the sense
     that an authored non-number would inject a declaration. Coerce, clamp. */
  function num(v, lo, hi) {
    var n = Number(v);
    if (!isFinite(n)) n = 0;
    if (lo != null) n = Math.max(lo, n);
    if (hi != null) n = Math.min(hi, n);
    return n;
  }

  /* The four visual treatments a component can take, and the class each one
     lands on. Whitelisted because this string is spliced into a class
     attribute: `fill: "x}html{"` would otherwise become markup. */
  var FILLS = ['filled', 'tonal', 'outlined', 'text'];
  function fillCls(v) { return (v && FILLS.indexOf(v) !== -1) ? ' hss-fill-' + v : ''; }

  /* Alignment is a class too, for the same reason: three authored values, one
     rule set. Anything else is dropped rather than coerced — a silently
     ignored `align` is the same defect P3 exists to make impossible. */
  var ALIGNS = ['start', 'center', 'end'];
  function alignCls(v) { return (v && ALIGNS.indexOf(v) !== -1) ? ' hss-align-' + v : ''; }

  /* Group types whose HOST must stay statically opaque because their items
     animate individually. Same reason as `cards`: the base .hss-el rule is
     opacity:0, so an opaque wrapper is what lets the items be seen at all. */
  var GROUP_TYPES = { cards: 1, tiles: 1, pills: 1, card: 1 };
  /* Types hidden wholesale when the scene is out of range — i.e. everything
     except the group types, which hide their items instead. */
  function isGroup(t) { return !!GROUP_TYPES[t]; }

  /* ── the emitted clip JS: a tiny deterministic interpolator ────────────
   * This is emitted as a STRING (it must live inside the clip so the clip
   * is portable — it runs inside HicRenderer's `new Function('time', js)`
   * and in the standalone page, with no access to the outer page's code).
   * Everything it needs is carried in the STORYBOARD literal below. */
  var CLIP_JS_TEMPLATE = [
    '/* generated by hic-storyboard.js — deterministic from t */',
    'var SB = __SB__;',
    // KaTeX is loaded by the clip html via CDN; this hook renders math once
    'var _hssInit=false;',
    'function _hssSetup(){',
    '  if(_hssInit) return;',
    /* The film's stage is #hss. A BOARD renders eight stages and has no such
       id — so this used to return early there, and the scenes preview showed
       raw `$$…$$` for every formula while the film beside it set it. Falling
       back to document.body typesets every stage in one call; the clip still
       finds #hss, so its behaviour is unchanged. */
    '  var root=document.getElementById("hss")||document.body;',
    /* Do NOT latch _hssInit before KaTeX is actually present. The first
       onFrame can beat a hoisted <script src> — in HicRenderer's
       external-script path it always does — and latching unconditionally
       means the maths renders as literal `$$\binom{52}{4}…$$` for the whole
       clip, with no error and no warning. Retry until renderMathInElement
       exists, then latch. _hssSetup runs every frame, so the retry is free. */
    '  if(!(root&&window.renderMathInElement)) return;',
    '  _hssInit=true;',
    '  try{renderMathInElement(root,{delimiters:[{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],throwOnError:false});}catch(e){}',
    '}',
    // eases
    'function _eo(x){return 1-Math.pow(1-x,3);}',
    'function _eb(x,s){s=(s===undefined)?1.7:s;var p=x-1;return (s+1)*p*p*p+s*p*p+1;}',
    'function _c1(x){return Math.max(0,Math.min(1,x));}',
    // anim phase: null before start, 0..1 during, 1 after
    'function _ph(a,t){if(!a)return null;var s=a.s||0;if(t<s)return null;return _c1((t-s)/((a.d||600)));}',
    // apply one phase to a node
    'function _ap(n,type,p,a){',
    '  if(type==="pop"){var s=(a&&a.o!==undefined)?a.o:1.7;var v=_eb(p,s);',
    '    n.style.opacity=String(_c1(p*2));n.style.transform="scale("+(0.8+0.2*v).toFixed(4)+")";}',
    '  else if(type==="slide"){var fx=(a&&a.fx!==undefined)?a.fx:0,fy=(a&&a.fy!==undefined)?a.fy:0;var k=_eo(p);',
    '    n.style.opacity=String(k);n.style.transform="translate("+((1-k)*fx).toFixed(2)+"px,"+((1-k)*fy).toFixed(2)+"px)";}',
    '  else if(type==="draw"){n.style.opacity="1";n.style.transform="none";}',
    '  else {n.style.opacity=String(_eo(p));n.style.transform="none";}',
    '}',
    'function _hidden(n){n.style.opacity="0";n.style.transform="none";}',
    // cards: per-item stagger
    'function _cards(e,t){',
    '  var a=e.in||{t:"slide",fy:50,d:600};var ws=e._ws||(e._ws=Array.prototype.slice.call(e._n.querySelectorAll(".hss-cardwrap")));',
    '  for(var i=0;i<ws.length;i++){var ti=t-i*((e.st||0));var p=_ph(a,ti);',
    '    if(p===null){ws[i].style.opacity="0";ws[i].style.transform="translateY("+((a.fy!==undefined)?a.fy:50)+"px)";continue;}',
    '    var k=_eo(p);var fy=(a.fy!==undefined)?a.fy:50;ws[i].style.opacity=String(k);ws[i].style.transform="translateY("+((1-k)*fy).toFixed(2)+"px)";}',
    '  return ws;',
    '}',
    // R1 group types: same per-item stagger contract as cards, generalised so
// tiles and pills do not each need their own copy. Hosts stay opaque; the
// .hss-slot wrappers animate individually.
'function _group(e,t){',
'  var a=e.in||{t:"slide",fy:50,d:600};',
'  var ws=e._ws||(e._ws=Array.prototype.slice.call(e._n.querySelectorAll(".hss-slot,.hss-cardwrap")));',
'  var fy=(a.fy!==undefined)?a.fy:50;',
'  for(var i=0;i<ws.length;i++){var ti=t-i*((e.st||0));var p=_ph(a,ti);',
'    if(p===null){ws[i].style.opacity="0";ws[i].style.transform="translateY("+fy+"px)";continue;}',
'    var k=_eo(p);ws[i].style.opacity=String(k);ws[i].style.transform="translateY("+((1-k)*fy).toFixed(2)+"px)";}',
'  return ws;}',
// R1 card meter: width is a FUNCTION OF t, never a CSS transition. A
// transition reads the wall clock, which would make scrub, deep links and
// the frame-diff gate disagree with each other.
'function _meter(e,t){',
'  var f=e._mf||(e._mf=e._n.querySelector(".hss-meter-fill"));if(!f)return;',
'  var pct=Number(f.getAttribute("data-pct"))||0;',
'  var a=e.min||{t:"slide",d:900};var p=_ph(a,t);',
'  if(p===null){f.style.width="0%";return;}',
'  f.style.width=(_eo(p)*pct).toFixed(3)+"%";}',
// R1 charts: the meter contract, generalised. Every animated node carries the
// geometry the emitter computed at compile time and this applies progress to
// it, so the runtime never owns a scale. Same reason as _meter: a CSS
// transition reads the wall clock, and scrub / deep links / the frame-diff
// gate would then disagree with each other.
'var _CK={col:1,row:1,line:1,area:1,arc:1,value:1};',
'function _chart(e,t){',
'  var ns=e._cn||(e._cn=e._n.querySelectorAll("[data-anim]"));',
'  var a=e.min||{t:"slide",d:1400};var st=e.st||0;',
'  for(var i=0;i<ns.length;i++){var el=ns[i];var m=el.getAttribute("data-k");if(!_CK[m])continue;',
'    var ii=Number(el.getAttribute("data-i"))||0;',
'    var p=_ph(a,t-ii*st);var k=p===null?0:_eo(p);',
'    if(m==="col"){var by=Number(el.getAttribute("data-by")),ty=Number(el.getAttribute("data-ty"));',
'      el.setAttribute("y",(by-(by-ty)*k).toFixed(2));el.setAttribute("height",((by-ty)*k).toFixed(2));}',
'    else if(m==="row"){var bx=Number(el.getAttribute("data-bx")),tx=Number(el.getAttribute("data-tx"));',
'      el.setAttribute("width",((tx-bx)*k).toFixed(2));}',
'    else if(m==="line"){el.setAttribute("stroke-dashoffset",(1-k).toFixed(4));}',
'    else if(m==="area"){el.setAttribute("width",(Number(el.getAttribute("data-w"))*k).toFixed(2));}',
'    else if(m==="arc"){var f=Number(el.getAttribute("data-frac"));el.setAttribute("stroke-dasharray",(f*k).toFixed(5)+" 1");}',
'    else if(m==="value"){el.setAttribute("opacity",String(_c1((k-0.55)/0.45)));}',
'  }}',
// annotation marks: the SAME contract as _chart, for shape elements. Every
// animated node inside the mark carries its own kind, and progress is the
// only runtime state — a stroke drawn by dashoffset and a highlight wiped by
// width are both functions of t, never CSS animations (a transition reads the
// wall clock, and scrub / deep links / the frame-diff gate would disagree).
// The phase is the shape's OWN entrance: the mark draws itself while it
// appears, so a film delays a ring with at_ms and gives it duration with
// in.dur_ms — no second phase field, because the mark has nothing to
// coordinate with but its own arrival.
'function _draw(e,t){',
'  var ns=e._dn||(e._dn=e._n.querySelectorAll("[data-anim]"));',
'  var p=_ph(e.in,t);var k=p===null?0:_eo(p);',
'  for(var i=0;i<ns.length;i++){var el=ns[i];var m=el.getAttribute("data-k");',
'    if(m==="draw"){el.setAttribute("stroke-dashoffset",(1-k).toFixed(4));}',
'    else if(m==="hl"){el.style.width=(k*100).toFixed(2)+"%";}',
'  }}',
// The finished state, from the single copy above. See SETTLE_JS.
'function settle(root){',,
SETTLE_JS,
'}',
// main onFrame
    'function isGroupT(t){return t==="cards"||t==="tiles"||t==="pills"||t==="card";}',
    'function onFrame(t){',
    '  _hssSetup();',
    '  var total=SB.total;',
    '  var fScene=(t>=total)?total-1:t;',           // end-of-video clamp (last frame = completed state)
    '  for(var si=0;si<SB.scenes.length;si++){',
    '    var sc=SB.scenes[si];var scN=sc._n||(sc._n=document.querySelectorAll("#hss .hss-scene")[si]);',
    '    var vis;',
    '    if(fScene<sc.s||fScene>=sc.e)vis=0;',
    '    else if(sc.fo&&fScene>=sc.e-sc.fo)vis=_c1((sc.e-fScene)/sc.fo);',
    '    else vis=1;',
    '    /* display:none for fully-hidden scenes keeps their DOM out of the SVG',
    '       raster entirely — per-frame cost scales with VISIBLE content only */',
    '    if(vis<=0){scN.style.display="none";}',
    '    else{scN.style.display="";scN.style.opacity=String(vis);}',
    '  }',
    '  for(var si=0;si<SB.scenes.length;si++){var sc=SB.scenes[si];',
    '    for(var ei=0;ei<sc.els.length;ei++){var e=sc.els[ei];var eN=e._n||(e._n=sc._n.querySelector("#"+e.id));',
    '      var tL=fScene-sc.s-(e.at||0);',
    'if(fScene<sc.s||fScene>=sc.e){if(!isGroupT(e.type))_hidden(eN);else{var ws2=(e.type==="cards"?_cards(e,-1):_group(e,-1));for(var q=0;q<ws2.length;q++){ws2[q].style.opacity="0";}}continue;}',
      '      if(e.type==="cards"){_cards(e,tL);}',
      '      else if(isGroupT(e.type)){_group(e,tL);}',
      '      else{var pin0=_ph(e.in,tL);if(pin0===null){_hidden(eN);continue;}var ty0=(e.in&&e.in.t)||"fade";_ap(eN,ty0,pin0,e.in);}',
      '      /* the meter runs on its OWN phase, off the at_ms of the element, */',
    '      /* so a card can settle while its bar is still filling */',
      '      if(e.type==="card"){_meter(e,e.mt===undefined?tL:tL-e.mt);}',
      '      /* the chart has its OWN phase too, so the head can settle while the\n         bars are still growing - and a per-node stagger rides on the phase */',
      '      if(e.type==="chart"){_chart(e,e.mt===undefined?tL:tL-e.mt);}',
      '      /* the mark draws on its OWN phase: the entrance of the shape,',
      '         so a ring can land after the words it circles have settled */',
      '      if(e.type==="shape"){_draw(e,tL);}',
      '      continue;',
    '      var pin=_ph(e.in,tL);if(pin===null){_hidden(eN);continue;}var ty=(e.in&&e.in.t)||"fade";_ap(eN,ty,pin,e.in);',
    '    }',
    '  }',
    '}',
  ].join('\n');

  /* ── chart geometry ─────────────────────────────────────────────────────
     Computed ONCE, here, at compile time. Every number the runtime needs to
     move a bar rides on the bar as a data attribute; the runtime knows only
     how far through the animation it is, never what the scale is. The
     alternative — shipping a second geometry model inside the SB literal —
     is two answers to the same question, and they diverge the first time one
     of them is edited. (The meter reads `data-pct` for exactly this reason.)

     Numbers are in SVG user units on a 1000×520 canvas that CSS scales to
     the stage, so a chart is resolution-independent the same way the rest of
     the sheet is. */
  var CHART_KINDS = { columns: 1, bars: 1, line: 1, donut: 1 };
  var CHART_W = 1000, CHART_H = 520;
  var CHART_PADT = 30, CHART_PADB = 62;
  var SERIES_FALLBACK = ['#ffeb00', '#6fb1ff', '#ff7a59', '#7bdcb5', '#c9a6ff', '#f1f3f2'];

  /* A series colour is either a resolved hex (the compiler resolves tokens
     against the mode in force, so a series named as a token swaps with the
     theme) or a --hss-sN lookup. Whitelisted, because this string is spliced
     into an attribute: an authored `" onload="` is not a colour. */
  function seriesPaint(i, c) {
    if (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
    return 'var(--hss-s' + ((i % 6) + 1) + ',' + SERIES_FALLBACK[i % 6] + ')';
  }
  function chartVals(v) {
    return (Array.isArray(v) ? v : []).map(function (x) {
      var n = Number(x); return isFinite(n) ? n : 0;
    });
  }
  function chartText(cls, x, y, anchor, s) {
    return '<text class="' + cls + '" x="' + x + '" y="' + y + '" text-anchor="' + anchor + '">' + esc(s) + '</text>';
  }

  function buildChart(e) {
    var id = e.id || 'chart';
    var kind = CHART_KINDS[e.chart] ? e.chart : 'columns';
    var series = (Array.isArray(e.series) ? e.series : []).map(function (s, i) {
      return {
        name: s && s.name != null ? String(s.name) : '',
        values: chartVals(s && s.values),
        paint: seriesPaint(i, s && s.color),
      };
    }).filter(function (s) { return s.values.length > 0; });
    var cats = (Array.isArray(e.categories) ? e.categories : []).map(function (c) {
      return String(c == null ? '' : c);
    });
    var n = cats.length;
    series.forEach(function (s) { n = Math.max(n, s.values.length); });
    if (!n || !series.length) {
      return '<div class="hss-chart"><div class="hss-chart-empty">chart "' +
        esc(id) + '" has no series</div></div>';
    }
    while (cats.length < n) cats.push('');

    var stacked = !!e.stacked && kind !== 'line' && kind !== 'donut';
    var wantsArea = !!e.area && kind === 'line';
    var showValues = e.values !== false && kind !== 'line' && kind !== 'donut' && !stacked;
    var showDots = e.dots !== false && kind === 'line';
    var showGrid = e.grid !== false && kind !== 'donut';
    var showLegend = e.legend !== false && series.length > 1;
    var unit = e.unit != null ? String(e.unit) : '';
    var dec = e.decimals != null ? num(e.decimals, 0, 4) : 0;
    function fmt(v) {
      var s = Number(v).toFixed(dec);
      return dec === 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
    }

    /* the scale. An authored `max` wins so two charts on one screen share an
       axis; otherwise the data sets it — and a STACKED chart has to sum its
       column first, because reading one series would clip the stack. */
    var dataMax = 0;
    for (var ci = 0; ci < n; ci++) {
      if (stacked) {
        var tot = 0;
        for (var si = 0; si < series.length; si++) tot += series[si].values[ci] || 0;
        dataMax = Math.max(dataMax, tot);
      } else {
        for (var sj = 0; sj < series.length; sj++) dataMax = Math.max(dataMax, series[sj].values[ci] || 0);
      }
    }
    var max = (typeof e.max === 'number' && e.max > 0) ? e.max : dataMax;
    if (!(max > 0)) max = 1;

    /* ── the axis FLOOR ────────────────────────────────────────────────
       Until now the floor was always 0, and that was a deliberate editorial
       rule: a truncated axis is a lie the reader cannot see. It is also,
       for one specific and very common chart, what makes the chart useless —
       a threshold film. Times that fall from 4:01.4 to 3:43.13 move 18
       seconds in a 241-second space; drawn from 0 the record is a flat line
       hugging the top, and the barrier the whole film is about sits so close
       to it that neither can be told apart.

       So the floor is AUTHORABLE, and the ban on silence is kept instead of
       the ban on floors: reel-compile reports a non-zero floor as a declared
       choice rather than letting it appear by accident. `0` — or no `min` at
       all — is still the default, so an unauthored chart cannot be truncated
       and nobody can truncate one by forgetting to type `min: 0`.

       A STACKED chart keeps the 0 floor regardless: every layer would be
       shrunk by the same offset and the stack would stop summing to its own
       column. A floor and a stack are two different answers to "what is this
       axis of", so the floor loses and the compiler says so. */
    var lo = (typeof e.min === 'number' && isFinite(e.min) && e.min > 0 && !stacked) ? e.min : 0;
    if (!(max > lo)) max = lo + 1;
    var span = max - lo;

    /* `bars` needs room for its CATEGORY LABELS, which hang to the LEFT of the
       axis at text-anchor:end. Sized from the longest label the emitter is
       about to draw rather than a constant: at 176 an 18-character region name
       ran off the viewBox and the first thing on the graphic was a chopped
       word. 21px mono is ~10.6 design units per character and the labels are
       21px, so the measure is derived, not guessed. */
    var labelChars = 0;
    if (kind === 'bars') for (var lc = 0; lc < n; lc++) labelChars = Math.max(labelChars, cats[lc].length);
    var padL = kind === 'bars' ? Math.min(330, 44 + labelChars * 11 + 18) : 84;
    var plotW = CHART_W - padL - 30;
    var plotH = CHART_H - CHART_PADT - CHART_PADB;
    var yBase = CHART_PADT + plotH;
    var body = '', grid = '', axis = '', marks = '', defs = '';

    function bar(x, y, w, h, paint, i) {
      return '<rect class="hss-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" width="' + w.toFixed(1) + '" height="' + Math.max(0, h).toFixed(1) +
        '" rx="3" fill="' + paint + '" data-anim="1" data-k="col" data-i="' + i +
        '" data-by="' + yBase.toFixed(2) + '" data-ty="' + y.toFixed(2) + '"></rect>';
    }
    function hbar(x, y, w, h, paint, i) {
      return '<rect class="hss-bar" x="' + padL + '" y="' + y.toFixed(1) +
        '" width="0" height="' + h.toFixed(1) + '" rx="3" fill="' + paint +
        '" data-anim="1" data-k="row" data-i="' + i + '" data-bx="' + padL.toFixed(2) +
        '" data-tx="' + (padL + Math.max(0, w)).toFixed(2) + '"></rect>';
    }

    if (kind === 'columns') {
      var slot = plotW / n;
      var groupW = Math.min(slot * 0.74, 190);
      var barW = stacked ? Math.min(slot * 0.5, 120) : groupW / series.length;
      for (var c = 0; c < n; c++) {
        var cx = padL + slot * (c + 0.5);
        var left = cx - (stacked ? barW / 2 : groupW / 2);
        var acc = 0;
        for (var s = 0; s < series.length; s++) {
          var v = series[s].values[c] || 0;
          /* clamped at the floor: a value below it has no bar to draw, and a
             negative height would paint one on the wrong side of the axis */
          var h = Math.max(0, ((v - lo) / span) * plotH);
          var top = yBase - acc - h;
          var x = stacked ? left : left + s * barW;
          body += bar(x, top, barW, h, series[s].paint, stacked ? c : c * series.length + s);
          if (showValues && v > 0) {
            marks += '<text class="hss-chart-value" x="' + (x + barW / 2).toFixed(1) +
              /* clamped: a bar that reaches the top of the plot puts its label at
                 a negative y, and the label is the number the chart exists to
                 show */
              '" y="' + Math.max(top - 12, 26).toFixed(1) + '" text-anchor="middle" opacity="0"' +
              ' data-anim="1" data-k="value" data-i="' + (c * series.length + s) + '">' +
              esc(fmt(v)) + '</text>';
          }
          acc += h;
        }
      }
      for (var c2 = 0; c2 < n; c2++) {
        marks += chartText('hss-chart-cat', (padL + slot * (c2 + 0.5)).toFixed(1),
          (yBase + 38).toFixed(1), 'middle', cats[c2]);
      }
      axis += '<line x1="' + padL + '" y1="' + yBase + '" x2="' + (padL + plotW) + '" y2="' + yBase + '"></line>';
    } else if (kind === 'bars') {
      var slotH = plotH / n;
      var groupH = Math.min(slotH * 0.7, 62);
      var barH = stacked ? Math.min(slotH * 0.46, 44) : groupH / series.length;
      for (var c3 = 0; c3 < n; c3++) {
        var cy = CHART_PADT + slotH * (c3 + 0.5);
        var top3 = cy - (stacked ? barH / 2 : groupH / 2);
        var run = padL;
        for (var s3 = 0; s3 < series.length; s3++) {
          var v3 = series[s3].values[c3] || 0;
          var w3 = Math.max(0, ((v3 - lo) / span) * plotW);
          var y3 = stacked ? cy - barH / 2 : top3 + s3 * barH;
          body += hbar(padL, y3, w3, barH, series[s3].paint, c3 * series.length + s3);
          if (showValues && v3 > 0) {
            marks += '<text class="hss-chart-value" x="' + (padL + w3 + 14).toFixed(1) +
              '" y="' + (y3 + barH * 0.72).toFixed(1) + '" text-anchor="start" opacity="0"' +
              ' data-anim="1" data-k="value" data-i="' + (c3 * series.length + s3) + '">' +
              esc(fmt(v3)) + '</text>';
          }
          run += w3;
        }
        marks += chartText('hss-chart-cat', (padL - 18).toFixed(1), (cy + 7).toFixed(1), 'end', cats[c3]);
      }
      axis += '<line x1="' + padL + '" y1="' + CHART_PADT + '" x2="' + padL + '" y2="' + yBase + '"></line>';
    } else if (kind === 'line') {
      var pts = [];
      var slotL = plotW / n;
      for (var s4 = 0; s4 < series.length; s4++) {
        var p = [];
        for (var c4 = 0; c4 < n; c4++) {
          var x4 = padL + slotL * (c4 + 0.5);
          /* clamped to the plot, the same rule four labels learned: a point
             below the floor would leave the viewBox */
          var y4 = Math.max(CHART_PADT, Math.min(yBase,
            yBase - ((series[s4].values[c4] || 0) - lo) / span * plotH));
          p.push([x4, y4]);
        }
        pts.push({ p: p, paint: series[s4].paint, i: s4 });
      }
      if (wantsArea) {
        var clipId = 'hss-clip-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
        defs += '<defs><clipPath id="' + clipId + '"><rect x="' + padL + '" y="' +
          CHART_PADT + '" width="0" height="' + plotH + '" data-anim="1" data-k="area"' +
          ' data-w="' + plotW + '" data-i="0"></rect></clipPath></defs>';
        for (var a = 0; a < pts.length; a++) {
          var pp = pts[a].p;
          body += '<polygon class="hss-chart-area" clip-path="url(#' + clipId + ')" fill="' +
            pts[a].paint + '" opacity="0.22" points="' +
            pp.concat([[pp[pp.length - 1][0], yBase], [pp[0][0], yBase]])
              .map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"></polygon>';
        }
      }
      for (var l = 0; l < pts.length; l++) {
        var pl = pts[l].p;
        /* `hss-chart-stroke`, NOT `hss-chart-line`. The container above is
           `hss-chart-<kind>`, so for a line chart the wrapper and the polyline
           were the same class — two different things sharing one name, which
           is harmless only until the first rule targets it and silently hits
           both. The area fill next to it is already `-area`, so this is the
           stroke that pairs with it. */
        body += '<polyline class="hss-chart-stroke" points="' +
          pl.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') +
          '" fill="none" stroke="' + pts[l].paint + '" stroke-width="5" stroke-linejoin="round"' +
          ' stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"' +
          ' data-anim="1" data-k="line" data-i="' + pts[l].i + '"></polyline>';
        if (showDots) {
          for (var d = 0; d < pl.length; d++) {
            body += '<circle class="hss-chart-dot" cx="' + pl[d][0].toFixed(1) + '" cy="' +
              pl[d][1].toFixed(1) + '" r="6.5" fill="' + pts[l].paint + '"' +
              ' stroke="var(--hss-chart-dot-ring,transparent)" stroke-width="3"></circle>';
          }
        }
      }
      for (var c5 = 0; c5 < n; c5++) {
        marks += chartText('hss-chart-cat', (padL + slotL * (c5 + 0.5)).toFixed(1),
          (yBase + 38).toFixed(1), 'middle', cats[c5]);
      }
      axis += '<line x1="' + padL + '" y1="' + yBase + '" x2="' + (padL + plotW) + '" y2="' + yBase + '"></line>';
    } else {
      /* donut. `pathLength="1"` normalises every arc to a fraction of the
         ring, so a segment's share IS its dash length and the runtime never
         needs to know the circumference. */
      var segs = series[0].values.slice(0, n);
      var total = 0;
      segs.forEach(function (v) { total += Math.max(0, v); });
      if (!(total > 0)) total = 1;
      /* the ring is pushed LEFT of centre: the segment list needs the right
         half and it is text, so it needs more room than the ring does */
      /* a thinner ring, not a smaller one: the label in the hole is sized by
         the CHORD it has to fit across, and at r=146 / sw=64 the inner radius
         was 114 — so a 94px-half-width region name at the label's baseline put
         its corner through the arc. Inner radius is now 129. */
      var rcx = 330, rcy = 236, rr = 158, sw = 58;
      var listX = rcx + rr + sw * 0.8 + 34;
      var off = 0;
      for (var g = 0; g < segs.length; g++) {
        var frac = Math.max(0, segs[g]) / total;
        var paint = seriesPaint(g, (e.segments && e.segments[g] && e.segments[g].color) || undefined);
        body += '<circle class="hss-chart-arc" cx="' + rcx + '" cy="' + rcy + '" r="' + rr +
          '" fill="none" stroke="' + paint + '" stroke-width="' + sw +
          '" pathLength="1" stroke-dasharray="0 1" stroke-dashoffset="' + (-off).toFixed(4) +
          '" data-anim="1" data-k="arc" data-frac="' + frac.toFixed(5) + '" data-i="' + g + '"></circle>';
        off += frac;
      }
      /* the hole in a ring is the one piece of white space a donut always has
         and never uses. It carries the LARGEST share rather than the total:
         "35%" is the finding, "100%" is arithmetic. */
      var bigIx = 0;
      for (var bi = 1; bi < segs.length; bi++) if (segs[bi] > segs[bigIx]) bigIx = bi;
      marks += chartText('hss-chart-value', rcx.toFixed(1), (rcy + 2).toFixed(1), 'middle',
        fmt((Math.max(0, segs[bigIx]) / total) * 100) + '%');
      marks += chartText('hss-chart-tick', rcx.toFixed(1), (rcy + 34).toFixed(1), 'middle',
        cats[bigIx] || '');
      for (var g2 = 0; g2 < segs.length; g2++) {
        var ly = (rcy - ((segs.length - 1) * 34) / 2) + g2 * 34;
        var lf = (Math.max(0, segs[g2]) / total) * 100;
        body += '<rect x="' + listX.toFixed(1) + '" y="' + (ly - 15) +
          '" width="16" height="16" rx="4" fill="' +
          seriesPaint(g2, (e.segments && e.segments[g2] && e.segments[g2].color) || undefined) + '"></rect>';
        marks += chartText('hss-chart-tick', (listX + 26).toFixed(1), ly.toFixed(1), 'start',
          (cats[g2] || series[0].name || '') + '   ' + fmt(segs[g2]) + '  ·  ' + lf.toFixed(1) + '%');
      }
    }

    /* gridlines + value ticks. A grid is data, not decoration, so it is on by
       default and off with one flag. */
    if (showGrid) {
      /* The grid follows the VALUE axis, which is vertical on columns/line and
         HORIZONTAL on bars. Drawing the y-grid unconditionally put a ladder of
         horizontal rules behind a chart whose scale runs left to right, and
         parked its tick labels on top of the category names in the gutter —
         two numbers fighting for the same pixel, on the one chart whose whole
         job is to be read at a glance. */
      for (var k = 0; k <= 4; k++) {
        /* ticks are ABSOLUTE values counted up from the floor, so the bottom
           one prints the floor — a chart truncated to 223 that ticked 0 would
           be a chart lying about where its axis starts */
        var gv = lo + (span / 4) * k;
        if (kind === 'bars') {
          var gx = padL + ((gv - lo) / span) * plotW;
          grid += '<line x1="' + gx.toFixed(1) + '" y1="' + CHART_PADT + '" x2="' + gx.toFixed(1) +
            '" y2="' + yBase + '"></line>';
          marks += chartText('hss-chart-tick', gx.toFixed(1), (yBase + 30).toFixed(1), 'middle', fmt(gv));
        } else {
          var gy = yBase - ((gv - lo) / span) * plotH;
          grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1) + '" x2="' + (padL + plotW) +
            '" y2="' + gy.toFixed(1) + '"></line>';
          /* the unit rides in the FOOT, not on the top tick. Appending it there
             made the top label four times wider than the gutter and it started
             at padL-14 with text-anchor:end, so the first thing on the graphic
             was a number sliced in half by the left edge. */
          marks += chartText('hss-chart-tick', (padL - 14).toFixed(1), (gy + 7).toFixed(1), 'end', fmt(gv));
        }
      }
    }

    /* ── REFERENCE LINE ──────────────────────────────────────────────────
       A threshold the chart is ABOUT: a record that stood, a limit, a target.
       Without one the reader has to hold the number in their head and judge
       every mark against a line the graphic never draws — which is exactly
       what a barrier is, so a film about a barrier needs it and had no way to
       ask for it.

       Drawn on the VALUE axis like the grid — horizontal on columns/line,
       vertical on bars — for the reason the grid had to be: the scale runs
       left to right on `bars`, and a horizontal rule across it would sit
       behind the bars reading as a fourth series.

       Drawn even when `grid` is off: a threshold is data, not decoration.
       It never sets the scale either. The axis still comes from the data (or
       an authored `max`), so a threshold above every value draws outside the
       plot — clamped in — rather than stretching the axis until the gap that
       the chart exists to show disappears. */
    var refLine = '';
    if (typeof e.ref === 'number' && isFinite(e.ref) && kind !== 'donut') {
      var refLabel = e.ref_label != null ? String(e.ref_label)
        : fmt(e.ref) + (unit ? ' ' + unit : '');
      var refPx = Math.max(0, Math.min(1, (e.ref - lo) / span)) * (kind === 'bars' ? plotW : plotH);
      if (kind === 'bars') {
        var rx0 = padL + refPx;
        refLine = '<line class="hss-chart-ref" x1="' + rx0.toFixed(1) + '" y1="' + CHART_PADT +
          '" x2="' + rx0.toFixed(1) + '" y2="' + yBase + '"></line>';
        /* the label sits beside the line and flips to the other side rather
           than running off the right edge — the bars gutter taught this: a
           chopped word is the first thing anyone sees. */
        var refW = refLabel.length * 11;
        var flip = rx0 + 10 + refW > CHART_W - 6;
        marks += chartText('hss-chart-ref-label', (flip ? rx0 - 10 : rx0 + 10).toFixed(1),
          (CHART_PADT - 8).toFixed(1), flip ? 'end' : 'start', refLabel);
      } else {
        var ry0 = yBase - refPx;
        refLine = '<line class="hss-chart-ref" x1="' + padL + '" y1="' + ry0.toFixed(1) +
          '" x2="' + (padL + plotW) + '" y2="' + ry0.toFixed(1) + '"></line>';
        /* above the line when there is room for the label, below it when the
           line is near the top — and clamped into the viewBox either way,
           which is the same mistake four other labels made. */
        var refY = (ry0 - 10 >= CHART_PADT + 12) ? ry0 - 10 : ry0 + 22;
        refY = Math.max(26, Math.min(CHART_H - 6, refY));
        marks += chartText('hss-chart-ref-label', (padL + plotW).toFixed(1), refY.toFixed(1),
          'end', refLabel);
      }
    }

    var legend = '';
    if (showLegend) {
      /* the name gets its OWN element. Interleaved with the swatch it was not a
         leaf text node, and leaf text is exactly what reel-contrast measures —
         a legend is a hundred words of the film that would have shipped
         unmeasured for the same reason the chips once did. */
      legend = '<div class="hss-chart-legend">' + series.map(function (s) {
        return '<span><i style="background:' + s.paint + '"></i>' +
          '<span class="hss-chart-leg-name">' + esc(s.name) + '</span></span>';
      }).join('') + '</div>';
    }

    var head = (e.title || e.subtitle || e.kicker)
      ? '<div class="hss-chart-head">' +
        (e.kicker ? '<div class="hss-chart-kicker">' + esc(e.kicker) + '</div>' : '') +
        (e.title ? '<div class="hss-chart-title">' + esc(e.title) + '</div>' : '') +
        (e.subtitle ? '<div class="hss-chart-sub">' + esc(e.subtitle) + '</div>' : '') +
        '</div>'
      : '';
    /* the right-hand note is a SCALE note — "millions per year = 132" tells the
       reader where the axis tops out. A donut has no axis, so on a donut it is
       three words and a number that mean nothing. */
    var foot = (e.source || unit)
      ? '<div class="hss-chart-foot">' + (e.source ? '<span class="hss-chart-source">' +
        esc(e.source) + '</span>' : '<span></span>') + (unit ? '<span class="hss-chart-unit">' +
        esc(unit) + (kind === 'donut' ? '' : ' = ' + esc(fmt(max))) + '</span>' : '') + '</div>'
      : '';

    return '<div class="hss-chart hss-chart-' + kind + '">' + head +
      legend +
      '<svg class="hss-chart-svg" viewBox="0 0 ' + CHART_W + ' ' + CHART_H + '"' +
      ' role="img" aria-label="' + esc(e.title || id) + '">' +
      defs +
      '<g class="hss-chart-grid">' + grid + '</g>' +
      '<g class="hss-chart-axis">' + axis + '</g>' +
      body +
      /* above `body`, so an area fill and a stroke never wash the threshold
         out — the one thing it must not do is disappear behind its own data */
      refLine +
      '<g class="hss-chart-marks">' + marks + '</g>' +
      '</svg>' + foot + '</div>';
  }

  /* ── element builders: return the clip HTML for one element ─────────── */
  /* The one error an unsupported element type produces, and the one place
     that decides what "unsupported" means. Two consumers share it:
     buildElHtml throws it, and reel-compile prints its message as the reason
     an element was deferred — so the reason a film reports cannot disagree
     with the reason the emitter refuses. `unknownType` is a flag rather than
     a message match, because emitterSupportsType has to tell "this type has
     no case" apart from "this case has a bug": a genuine throw from inside a
     case must propagate, not be re-read as an unsupported type. */
  function unknownTypeError(t) {
    var err = new Error('hic-storyboard: unknown element type ' +
      JSON.stringify(String(t == null ? '' : t)) +
      ' — buildElHtml has no case for it');
    err.unknownType = true;
    return err;
  }

  /* Does the switch have a `case` for this type? Answered by running the
     switch, never by a list beside it. The probe is a bare element with no
     data: every case tolerates that by construction (`esc` coerces null to
     '', `num` clamps a non-number to 0, and the group types guard their item
     arrays), so a throw here means "no case", which is the only question. */
  function emitterSupportsType(t) {
    try { buildElHtml({ id: '__probe__', type: t }); return true; }
    catch (err) { if (err && err.unknownType) return false; throw err; }
  }

  /* ── the shape vocabulary, asked the same way the type list is ──────────
     box and underline are the two CSS-border kinds that predate this; circle
     rings its target, arrow points at it from one edge, highlight is a marker
     swipe. The list lives HERE because the emitter is the thing that can draw
     them — reel-compile asks emitterSupportsShape() for the same reason it
     asks emitterSupportsType(): two lists describing one implementation
     drift, and they drift in the direction of a mark that renders as a bare
     border nobody drew. */
  var SHAPE_KINDS = { box: 1, underline: 1, 'dbl-underline': 1, circle: 1, arrow: 1, highlight: 1 };
  /* Which edge an arrow comes from. Four, because the stage is a centred
     column: left and right are the two side margins, top and bottom are the
     gap above and below. */
  var ARROW_SIDES = { left: 1, right: 1, top: 1, bottom: 1 };

  function unknownShapeError(s) {
    var err = new Error('hic-storyboard: unknown shape kind ' +
      JSON.stringify(String(s == null ? '' : s)) +
      ' — buildElHtml has no case for it (known: ' + Object.keys(SHAPE_KINDS).join(', ') + ')');
    err.unknownShape = true;
    return err;
  }

  function unknownArrowSideError(s) {
    var err = new Error('hic-storyboard: unknown arrow side ' +
      JSON.stringify(String(s == null ? '' : s)) +
      ' — an arrow comes from ' + Object.keys(ARROW_SIDES).join(', '));
    err.unknownSide = true;
    return err;
  }

  /* Does the shape vocabulary contain this kind? Asked by running the same
     code that builds one, never by a list beside it — see emitterSupportsType. */
  function emitterSupportsShape(s) {
    try { buildElHtml({ id: '__probe__', type: 'shape', shape: s }); return true; }
    catch (err) { if (err && err.unknownShape) return false; throw err; }
  }

  /* What one shape kind renders INSIDE its wrapper. Empty for the legacy CSS
     kinds so their markup stays byte-identical (reel-regression asserts it).
     Every animated node carries data-anim/data-k — the contract _chart,
     _draw and settle() already share — so a mark cannot become invisible to
     the settle pass by having its own animation vocabulary. */
  function shapeInner(kind, e) {
    if (kind === 'circle') {
      /* A stretched viewBox on purpose: an ellipse that hugs the target's
         box at any aspect. pathLength=1 normalises the dash to the whole
         ring, so the runtime never needs the length of a scaled ellipse —
         the compile-time-geometry rule from the charts, for a shape whose
         geometry is the host's own box. */
      return '<svg class="hss-draw" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<ellipse cx="50" cy="50" rx="48" ry="48" pathLength="1" stroke-dasharray="1"' +
        ' stroke-dashoffset="1" data-anim="1" data-k="draw"></ellipse></svg>';
    }
    if (kind === 'arrow') {
      if (e.side !== undefined && e.side !== null && e.side !== '' && !ARROW_SIDES[e.side]) throw unknownArrowSideError(e.side);
      var side = (e.side && ARROW_SIDES[e.side]) ? e.side : 'left';
      var vert = side === 'top' || side === 'bottom';
      var vb = vert ? '0 0 56 160' : '0 0 160 56';
      /* A curved stem, not a straight one: the mock draws every tool stroke
         with Rough.js, and a slight bow is what says "drawn" without needing
         a hand-drawn filter. Tip first, then the two barbs — ONE path, so one
         dash draws stem and head in a single stroke. */
      var d = vert
        ? 'M6 8 C 14 52 10 106 28 152 M28 152 L 21 128 M28 152 L 46 137'
        : 'M8 46 C 52 54 106 46 152 22 M152 22 L 128 16 M152 22 L 134 46';
      return '<svg class="hss-arrow-svg hss-arrow-' + side + '" viewBox="' + vb + '" aria-hidden="true">' +
        '<path class="hss-arrow-path" d="' + d + '" pathLength="1" stroke-dasharray="1"' +
        ' stroke-dashoffset="1" data-anim="1" data-k="draw"></path></svg>';
    }
    if (kind === 'highlight') {
      /* a WIDTH wipe, not a transform: the runtime owns transform on hosts,
         and a width function of t is exactly what the meter already does. */
      return '<i class="hss-hl" data-anim="1" data-k="hl"></i>';
    }
    if (kind === 'dbl-underline') {
      /* Two rules under the target, drawn by ONE dash each — the Emphasis
         Animator's "double pen". Horizontal lines only, so a stretched
         viewBox is harmless the way it is for the circle: x stretches with
         the words, y is a fixed 12px strip, and non-scaling-stroke keeps both
         rules 3px. It sits as a bottom strip (left/right/bottom, height 12)
         rather than filling the box: a double underline that scaled with the
         text's height would drift away from the baseline it is under. */
      return '<svg class="hss-dbl" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">' +
        '<line x1="1" y1="3" x2="99" y2="3" pathLength="1" stroke-dasharray="1"' +
        ' stroke-dashoffset="1" data-anim="1" data-k="draw"></line>' +
        '<line x1="1" y1="9" x2="99" y2="9" pathLength="1" stroke-dasharray="1"' +
        ' stroke-dashoffset="1" data-anim="1" data-k="draw"></line></svg>';
    }
    return '';
  }

  function buildElHtml(e) {
    var inner = '';
    var cls = 'hss-el';
    switch (e.type) {
      case 'text':
        /* e.font is a per-element family override. A theme sets the defaults,
           but a bilingual brand needs the Devanagari DISPLAY face on its
           headings while the body face handles paragraphs, and those are two
           different roles that no single --hss-font-* var can express.

           e.slab_bg is the brutalist "name slab": display type REVERSED OUT OF
           a solid brand block. It is the signature move of the synthwave
           portfolio AND the neo-brutalist political brand, and it was the one
           thing both designs had and this emitter could not draw. The text
           colour is dropped and the slab carries the ink, because that is what
           makes it read as a block rather than as coloured text. */
        var slabStyle = '';
        if (e.slab_bg) {
          slabStyle = 'display:inline-block;background:' + esc(e.slab_bg) + ';color:' +
            (e.slab_ink ? esc(e.slab_ink) : 'var(--hss-slab-ink,#151217)') +
            ';padding:.18em .34em;box-shadow:var(--hss-shadow,0 8px 24px rgba(0,0,0,.45));';
        }
        inner = '<div class="hss-text hss-' + (e.size || 'body') + '" style="' +
          (slabStyle || '') +
          (e.color && !e.slab_bg ? 'color:' + esc(e.color) + ';' : '') +
          (e.font ? 'font-family:' + esc(e.font) + ';' : '') +
          /* e.font_size carries an authored ramp step. The runtime only has
             three fixed sizes (title/sub/body), so a brand whose display type
             is 140px got 18px — correct colour, wrong voice. Sizes arrive as
             vw so they stay stage-relative like the rest of this stylesheet. */
          (e.font_size ? 'font-size:' + esc(e.font_size) + ';' : '') +
          (e.font_weight ? 'font-weight:' + esc(e.font_weight) + ';' : '') +
          (e.letter_spacing ? 'letter-spacing:' + esc(e.letter_spacing) + ';' : '') +
          (e.upper ? 'text-transform:uppercase;' : '') +
          '">' + esc(e.text) + '</div>';
        break;
      case 'latex':
        /* e.font_size: the runtime sets no size on .hss-latex, so display
           maths rendered at the page default — 16px of maths on a 1920px
           stage. A maths clip is unusable at that size, so the authored ramp
           step has to reach the element the same way it does for `text`.
           Omitted entirely when unauthored, which keeps the pre-existing
           latex output byte-identical (reel-regression asserts that). */
        inner = '<div class="hss-latex" style="color:' + (e.color || '#ffffff') +
          (e.font_size ? ';font-size:' + esc(e.font_size) : '') + '">$$' + e.text + '$$</div>';
        break;
      case 'answer':
        /* same as latex: the runtime hardcodes 34px, which is not a climax */
        inner = '<div class="hss-answer' + fillCls(e.fill) + '" style="color:' + (e.color || '#6ed9b1') +
          (e.font_size ? ';font-size:' + esc(e.font_size) : '') +
          (e.font_weight ? ';font-weight:' + esc(e.font_weight) : '') +
          (e.letter_spacing ? ';letter-spacing:' + esc(e.letter_spacing) : '') +
          '">' + esc(e.text) + '</div>';
        break;
      case 'cards':
        cls += ' hss-cards-host';
        /* host row must be statically opaque — items animate individually;
         * leaving the wrap at CSS .hss-el{opacity:0} hides the whole row
         * (matches hic-scenes.js's buildElement behavior for cards) */
        var hostStyle = ' style="opacity:1"';
        inner = '<div class="hss-cards">' + (e.items || []).map(function (c) {
          var st = c.muted ? 'background:#dfe4df;color:#5c665f;' : 'background:#fdfcf9;color:#14181a;';
          if (c.accent) st += 'color:' + c.accent + ';';
          return '<span class="hss-cardwrap"><span class="hss-card" style="' + st + '">' + c.label + '</span></span>';
        }).join('') + '</div>';
        break;
      case 'image':
        inner = '<img class="hss-image" src="' + (e.src || '') + '" alt="' + (e.id || '') + '" style="max-width:80%;max-height:80%;object-fit:contain;">';
        break;
      case 'shape':
        cls += ' hss-shape-host';
        var kind = e.shape || 'box';
        /* An unknown KIND used to reach the stylesheet as a class nobody
           wrote (hss-shape-sparkle) and render the default border — the same
           silent loss as the missing default case, one level down. Now a
           throw, from the one place that knows, flagged so
           emitterSupportsShape can answer from the code, not a list. */
        if (!SHAPE_KINDS[kind]) throw unknownShapeError(kind);
        /* `of` is what makes the mark ANNOTATION instead of decoration: the
           wrapper is moved into the target's own box at setup and positioned
           around it by .hss-overlay (or .hss-overlay-ring). Without it the
           legacy border kinds keep their in-flow behaviour, unchanged. */
        if (e.of) cls += ' hss-overlay' + (kind === 'circle' ? ' hss-overlay-ring' : '');
        inner = '<div class="hss-shape hss-shape-' + kind + '" style="color:' + (e.color || '#6ed9b1') + '">' + shapeInner(kind, e) + '</div>';
        break;
      case 'chart':
        /* A chart is a first-class element, not a decoration: it carries
           title / subtitle / source the way an editorial graphic does, because
           a number without its provenance is the thing a data story is
           supposed to fix. */
        inner = buildChart(e);
        break;
      /* ── the five R1 types. See the RUNTIME_CSS block for why each is
         shaped this way. Every value is HTML-escaped because authored copy
         reaches here verbatim and this string is spliced into a page. ── */
      case 'stat':
        cls += ' hss-stat';
        inner =
          '<div class="hss-stat-num"' + (e.num_color ? ' style="--hss-num-a:' + esc(e.num_color) + '"' : '') + '>' + esc(e.value) + '</div>' +
          '<div class="hss-stat-label"' + (e.color ? ' style="color:' + esc(e.color) + '"' : '') + '>' + esc(e.label) + '</div>';
        break;
      case 'card':
        cls += ' hss-panel-host';
        inner =
          '<div class="hss-panel' + fillCls(e.fill) + '"' + (e.panel ? ' style="--hss-panel:' + esc(e.panel) + '"' : '') + '>' +
            '<div class="hss-panel-num"' + (e.color ? ' style="color:' + esc(e.color) + '"' : '') + '>' + esc(e.big) + '</div>' +
            '<div class="hss-panel-label"' + (e.label_color ? ' style="color:' + esc(e.label_color) + '"' : '') + '>' + esc(e.small) + '</div>' +
            /* pct is authored as a NUMBER and carried to the runtime in the SB
               literal, which drives width from t. A CSS animation here would
               be wall-clock and would break scrub/deep-link determinism. */
            '<div class="hss-meter"><div class="hss-meter-fill" data-pct="' + num(e.meter_pct) + '"' +
              (e.meter_color ? ' style="--hss-meter:' + esc(e.meter_color) + '"' : (e.meter ? ' style="--hss-meter:' + esc(e.meter) + '"' : '')) + '></div></div>' +
          '</div>';
        break;
      case 'tiles':
        cls += ' hss-tiles-host';
        inner = '<div class="hss-tiles"' + (e.columns > 1 ? ' style="grid-template-columns:repeat(' + num(e.columns) + ',1fr)"' : '') + '>' +
          (e.items || []).map(function (it) {
            return '<div class="hss-slot"><div class="hss-tile' + fillCls(e.fill) + '"' + (e.panel ? ' style="--hss-panel:' + esc(e.panel) + '"' : '') + '>' +
              '<div class="hss-tile-icon">' + esc(it.icon) + '</div>' +
              '<div class="hss-tile-head">' + esc(it.head) + '</div>' +
              '<div class="hss-tile-body">' + esc(it.body) + '</div>' +
              '</div></div>';
          }).join('') + '</div>';
        break;
      case 'pills':
        cls += ' hss-pills-host';
        inner = '<div class="hss-pills"' + (e.color ? ' style="--hss-pill:' + esc(e.color) + '"' : '') + '>' +
          (e.items || []).map(function (p) { return '<span class="hss-slot"><span class="hss-pill' + fillCls(e.fill) + '">' + esc(p) + '</span></span>'; }).join('') +
          '</div>';
        break;
      case 'credit':
        /* absolutely positioned footer — the one type that must NOT sit in the
           scene's centred flex column, so it escapes it with position:absolute */
        cls += ' hss-credit';
        inner = esc(e.text);
        break;
      /* ── the switch is the ONLY list of supported types ──────────────────
         There used to be no `default`: an unknown `type` fell out of the
         switch with `inner` still '', and buildElHtml returned
         `<div class="hss-el" id="x"></div>` — a reel rendered correctly
         minus one element, with no error, no warning and a green gate. That
         is precisely the silent loss this pipeline exists to make
         impossible, so it is now a hard failure at the only place that
         actually knows: the switch.

         reel-compile used to hold a hand-kept copy of these case labels
         (`BUILDABLE`) and ask that instead. Two lists describing one switch
         drift — the emitter grew `chart` and nothing forced the copy to
         follow it. It now calls emitterSupportsType(), which asks the switch
         itself, so there is one list and it cannot go stale. */
      default:
        throw unknownTypeError(e.type);
    }
    /* group host rows are statically opaque — items animate individually;
     * leaving the wrap at CSS .hss-el{opacity:0} hides the whole row
     * (matches hic-scenes.js buildElement behavior for cards) */
    /* Per-element box overrides. A design system's spacing and size scale has
     * to be able to reach the film, and one --hss-radius plus a hardcoded 26px
     * column gap cannot carry a scale like Material's 8/14/20/24/999. Applied
     * on the HOST so they compose with whatever the type renders; omitted
     * entirely when unauthored so existing markup is unchanged. `gap` lands on
     * the host too, which is what the row/group wrappers inherit into. */
    var box = '';
    if (e.radius !== undefined && e.radius !== null) box += 'border-radius:' + esc(e.radius) + ';';
    if (e.max_width !== undefined && e.max_width !== null) box += 'max-width:' + num(e.max_width, 0, 20000) + 'px;';
    if (e.gap !== undefined && e.gap !== null) box += 'gap:' + num(e.gap, 0, 400) + 'px;';
    cls += alignCls(e.align);
    var hostStyle = (isGroup(e.type) ? 'opacity:1;' : '') + box;
    return '<div class="' + cls + '" id="' + e.id + '"' + (hostStyle ? ' style="' + hostStyle + '"' : '') + '>' + inner + '</div>';
  }

  /* compileStoryboard(sb) → { name, dur, html, css, js, ds } */
  function compileStoryboard(sb) {
    if (!sb || !Array.isArray(sb.scenes)) throw new Error('compileStoryboard: storyboard.scenes missing');
    var ds = sb.aspect === '9:16' ? '9:16' : '16:9';
    var durMs = sb.total_duration_ms || sb.scenes[sb.scenes.length - 1].end_ms;

    /* shape overlays: move wrap into host wrap (geometry via .hss-overlay) */
    var overlays = [];
    sb.scenes.forEach(function (sc) {
      sc.elements.forEach(function (e) {
        if (e.type === 'shape' && e.of) overlays.push({ id: e.id, of: e.of });
      });
    });

    /* scene markup */
    var sceneList = sb.scenes.map(function (sc) {
      // A scene lays its elements out as ONE centred flex COLUMN. That is
      // right for kicker/title/lead, but three `card` elements authored as
      // siblings then stack vertically - there is no wrapper to make them a
      // row, and the .hss-panels rule had nothing to select. Authored `group`
      // is the fix: consecutive elements sharing a name go inside one row
      // wrapper. The group is a layout instruction, not a new element type, so
      // it costs nothing at runtime - each element keeps its own id and phase.
      var GROUP_WRAPPER = { panels: 'hss-panels', row: 'hss-panels' };
      /* A group can also choose its own LAYOUT rather than naming one. The
         centre-column-plus-group model cannot express Material's two-column
         "given | solving" solve grid, because .hss-panels is always one row of
         equal stretch — a row that wraps is not a grid, and `columns` on a row
         is silently nothing. `layout` names the arrangement; `columns` is only
         meaningful for a grid, and the compiler rejects it on a row rather
         than letting it look applied. `panels`/`row` keep their old class so
         every existing group is byte-identical. */
      var GROUP_LAYOUT = { row: 'hss-panels', grid: 'hss-groups' };
      var out = '', buf = [], bufGroup = null, bufLayout = null, bufCols = 0;
      function flush() {
        if (!buf.length) return;
        var wrap = (bufLayout && GROUP_LAYOUT[bufLayout]) || (bufGroup && GROUP_WRAPPER[bufGroup]);
        if (!wrap) { out += buf.join(''); buf = []; return; }
        var wrapStyle = (wrap === 'hss-groups' && bufCols > 1)
          ? ' style="grid-template-columns:repeat(' + num(bufCols, 1, 12) + ',1fr)"' : '';
        out += '<div class="' + wrap + '"' + wrapStyle + '>' + buf.join('') + '</div>';
        buf = [];
      }
      sc.elements.forEach(function (e) {
        var g = e.group || null;
        if (g !== bufGroup) { flush(); bufGroup = g; bufLayout = e.layout || null; bufCols = e.columns || 0; }
        buf.push(buildElHtml(e));
      });
      flush();
      /* Per-scene surface and layout. Previously a scene could only be a
       * transparent layer over one flat reel-wide background, so 30 authored
       * scene backgrounds across four films were discarded and reported. The
       * scene node is already position:absolute inset:0, so a background on it
       * composes over the stage exactly as authored. Both blocks are emitted
       * ONLY when authored — an unauthored scene gets byte-identical markup. */
      var scStyle = '';
      /* sc.bg is a COMPLETE declaration list (`background:#123;` or
       * `background-image:radial-gradient(…);background-repeat:no-repeat`),
       * not a colour. Prepending `background:` to it produced
       * `background:background-image:…`, which CSS ignores silently — the
       * scene rendered nothing and nothing reported it. */
      if (sc.bg) scStyle += esc(sc.bg) + ';';
      if (sc.gap !== undefined && sc.gap !== null) scStyle += 'gap:' + num(sc.gap, 0, 400) + 'px;';
      return '<div class="hss-scene"' + (scStyle ? ' style="' + scStyle + '"' : '') + '>' + out + '</div>';
    });
    /* kept as an ARRAY as well as joined: the scenes preview needs one scene's
       markup at a time, and re-splitting the joined string on a tag boundary
       is a parser written by hand that breaks the first time a scene contains
       the tag it splits on. */
    var scenesHtml = sceneList.join('');

    var bg = sb.background || '#0e1512';
    /* A pattern layer on top of the stage colour. One flat colour was the whole
     * vocabulary until now, which meant a design that authored a dot grid got a
     * flat fill instead — and, worse, could never express a light variant,
     * because its surface was the emitter's #0e1512 default rather than
     * anything the film chose. background_image + background_size carry a
     * repeating pattern; both are omitted when unauthored, so every existing
     * clip is byte-identical. */
    var bgStyle = 'background:' + bg;
    if (sb.background_image) {
      bgStyle += ';background-image:' + esc(sb.background_image);
      if (sb.background_size) bgStyle += ';background-size:' + esc(sb.background_size);
      /* a pattern layer must not scroll or tile visibly as a wipe happens */
      bgStyle += ';background-repeat:repeat';
    }

    /* compact storyboard literal for the emitted clip (single-letter keys
       keep the emitted js small; scene.s/e/fo, el.at/in{t,s,d,fx,fy,o,st}) */
    var sbLit = {
      total: durMs,
      scenes: sb.scenes.map(function (sc) {
        return {
          s: sc.start_ms, e: sc.end_ms, fo: sc.fade_out_ms || 0,
          els: sc.elements.map(function (e) {
            function anim(a) {
              if (!a) return undefined;
              return { t: a.type, s: a.start_ms || 0, d: a.dur_ms || 600, fx: a.from_x, fy: a.from_y, o: a.overshoot, st: a.stagger_ms };
            }
            var el = {
              id: e.id, type: e.type, at: e.at_ms || 0,
              in: anim(e.in), st: (e.in && e.in.stagger_ms) || 0,
            };
            /* the meter's own phase travels with the element: it is a SECOND
               animation on the same node, and without `min` in the literal the
               handler has nothing to interpolate against. */
            if (e.type === 'card') { el.min = anim(e.meter_in || { type: 'slide', dur_ms: 900 }); el.mt = e.meter_at_ms || 0; el.grp = e.group; el.mc = e.meter_color; }
            /* a chart's growth is a SECOND animation on the same node, exactly
               like the card's meter: without `min` in the literal the runtime
               has nothing to interpolate against, and without `st` every bar
               of a 40-bar series would move as one slab. */
            if (e.type === 'chart') {
              el.min = anim(e.chart_in || { type: 'slide', dur_ms: 1400 });
              el.mt = e.chart_at_ms || 0;
              el.st = ((e.chart_in && e.chart_in.stagger_ms) || 0);
            }
            return el;
          }),
        };
      }),
    };

    /* Move overlay wraps into their host wraps — a one-time DOM patch inside
       _hssSetup itself, NOT spliced beside its call in onFrame. The first
       version lived in onFrame, and the scenes preview — which settles
       WITHOUT ever calling onFrame — drew every ring at full stage size and
       every highlight across the whole scene: the mark was real, but aimed at
       nothing, because the container never moved. _hssSetup is the one hook
       every consumer already runs (clip, scenes page, board), so the patch
       lands wherever a mark can be seen.

       parentNode makes it genuinely once-only: appendChild reinserts even
       when the node is already there, and a reinsert per overlay per frame
       would invalidate layout sixty times a second for a move that only ever
       needs to happen once. */
    var overlayJs = overlays.map(function (o) {
      return 'try{var _o=document.getElementById(' + JSON.stringify(o.id) + ');var _h=document.getElementById(' + JSON.stringify(o.of) + ');if(_o&&_h&&_o.parentNode!==_h)_h.appendChild(_o);}catch(e){}';
    }).join('\n');

    var js = CLIP_JS_TEMPLATE
      .replace('__SB__', JSON.stringify(sbLit))
      .replace('  if(_hssInit) return;', '  if(_hssInit) return;\n' + overlayJs);

    /* KaTeX loader goes FIRST in the html so HicRenderer's external-script
       hoisting runs before anything renders */
    /* NOTE: plain </script> closers — this file is loaded as an external
     * script, so the escape hack is unnecessary, and a literal <\/script
     * here would break DOM parsing of the emitted clip (the unterminated
     * <script src> would swallow the scene markup when hic-frame hoists it). */
    /* The historical default: three CDN tags. Kept, because a storyboard that
       carries no sb.math still has to render, and because the CDN is the only
       source this emitter can name without the compiler having decided.
       Every path that ACTUALLY consumes a reel clip prefers sb.math below. */
    var KATEX_CDN =
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>';

    /* `latex` and only `latex`. It is tempting to include `answer` — reel-compile
       uses to — but `answer` renders esc(e.text) with no delimiters, so it is a
       plain takeaway, not maths, and counting it made a film with zero formulae
       carry a renderer it could not use.

       Two tests, not one: the string test catches a storyboard literal whose
       scenes were normalised away before it reached here, and the scene scan is
       the one that means something. Either is enough to load the renderer. */
    var needsKatex = /"type":"latex"/.test(JSON.stringify(sbLit)) ||
      sb.scenes.some(function (sc) { return (sc.elements || []).some(function (e) { return e.type === 'latex'; }); });

    /* ── THE MATHS RENDERER, AND WHY IT IS A BLOB ─────────────────────────
       A clip is a portable HTML fragment. It gets exported to a bare file,
       opened with no server, and mounted by hic-frame.js with innerHTML. The
       CDN tags above satisfied exactly one of those: online, in the app. On a
       plane, `renderMathInElement` never appears, `_hssSetup` retries forever,
       and the formula stays literal `$$\binom{52}{4}$$` — with no error and a
       green gate.

       So when the compiler hands us `sb.math`, this is a SELF-CONTAINED
       renderer and it goes in verbatim:

         sb.math.css      one <style> carrying every @font-face as a woff2
                          data URI — no fonts directory to fetch, and the SVG
                          rasterizer cannot load external resources anyway.
         sb.math.scripts  <script src="data:text/javascript;base64,…"> per file

       DATA: URLS, not inline <script> tags, and that is load-bearing rather
       than fastidious. hic-frame.js mounts clip html with `innerHTML`, and a
       <script> inserted that way NEVER EXECUTES — it is the reason the CDN
       <script src> tags are hoisted into <head> at all. A data: URL is an
       EXTERNAL script, so it is hoisted and run by the renderer *and* executed
       normally by a plain document. One markup, both environments, no network.
       (Verified in headless Chrome: a data: src script sets its global.)

       The blob is ~700KB of base64 for a maths clip and it is only emitted for
       a clip that has a `latex` element, which is the price of the clip being
       able to render on its own. See public/vendor/katex/README.md. */
    var mathHtml = '';
    if (needsKatex) {
      var m = sb.math;
      mathHtml = (m && (m.css || m.scripts)) ?
        String(m.css || '') + (Array.isArray(m.scripts) ? m.scripts.join('') : '') : KATEX_CDN;
    }

    /* ── THEME ──────────────────────────────────────────────────────────
       Until now the design language lived in RUNTIME_CSS as literals, so a
       film could only ever look like the one the emitter was written against.
       `sb.theme` is the seam: authored values become CSS custom properties on
       .hss, and the element rules already read --hss-* with the current
       values as their fallback. So a theme that sets only colour changes
       colour and nothing else; the DEFAULTS are what were hardcoded.

       THEME_KEYS is declared at MODULE scope, not here, because
       buildDesignPage emits the same keys onto its own board. Two
       hand-kept lists would drift from each other, which is the same bug
       class this pipeline exists to remove. One list, two consumers. */
    var themeVars = '';
    function themeDecls(t) {
      if (!t || typeof t !== 'object') return '';
      var s = '';
      for (var ti = 0; ti < THEME_KEYS.length; ti++) {
        var tv = t[THEME_KEYS[ti]];
        if (tv === undefined || tv === null || tv === '') continue;
        /* a length, a colour, a family list or a shadow - but never a ; or a }
           that would terminate the declaration or the block */
        if (/[;{}<>]/.test(String(tv))) continue;
        s += '--hss-' + THEME_KEYS[ti] + ':' + String(tv) + ';';
      }
      return s;
    }
    themeVars = themeDecls(sb.theme);

    /* Brand webfonts. The clip has no way to reach loadGoogleBatch, and a
       brand whose script the runtime cannot name is unrenderable - a
       Devanagari film in a Latin-only runtime is the case that forced this.
       `fonts` is [{family, href}] or a single href string. */
    var fontLinks = '';
    var families = [];
    if (typeof sb.fonts === 'string' && sb.fonts) {
      fontLinks = '<link rel="stylesheet" href="' + esc(sb.fonts) + '">';
    } else if (Array.isArray(sb.fonts)) {
      fontLinks = sb.fonts.map(function (f) {
        if (!f || !f.href) return '';
        if (f.family) families.push(f.family);
        return '<link rel="stylesheet" href="' + esc(f.href) + '">';
      }).join('');
    }

    var cssOut = RUNTIME_CSS + (themeVars ? '.hss{' + themeVars + '}' : '');

    /* ── RUNTIME MODES ─────────────────────────────────────────────────
       * `sb.modes` compiles BOTH themes into ONE clip: every mode's custom
       * properties plus its own --hss-stage land as [data-mode] rules, so the
       * stage repaints without a recompile. That is what a Material film needs
       * — one artefact that answers the viewer's OS, not two files that have
       * to be kept in step by hand.
       *
       * The flip is an INTERACTION, and an interaction is not a function of t.
       * So: the toggle is opt-in (`sb.ui.theme_toggle`), the mode is resolved
       * ONCE at setup from prefers-color-scheme, and the exporter bakes the
       * mode it was handed. Switching mid-render would break the property the
       * whole pipeline is built on — a frame is a pure function of its
       * timestamp — so nothing here reads the clock or the DOM per frame. */
    var modeNames = (sb.modes && typeof sb.modes === 'object') ? Object.keys(sb.modes) : [];
    var modes = modeNames.filter(function (n) { return n !== sb.mode; });
    var toggleUi = !!(sb.ui && sb.ui.theme_toggle) && modes.length > 0;
    var modeCss = '';
    var initialMode = sb.mode || modes[0] || 'light';

    if (modes.length) {
      /* the default mode is whichever the emitter was handed, else the first
         declared one; its declarations go on .hss so an unstyled context
         still gets the right look */
      var baseDecls = themeDecls(sb.modes[initialMode] && sb.modes[initialMode].theme) || themeVars;
      var baseBg = (sb.modes[initialMode] && sb.modes[initialMode].bg) || bg;
      var baseImg = sb.modes[initialMode] && sb.modes[initialMode].bg_image;
      modeCss += '.hss{' + baseDecls + '--hss-stage:' + baseBg + ';';
      if (baseImg) modeCss += '--hss-stage-image:' + baseImg + ';';
      modeCss += 'background:var(--hss-stage);';
      if (baseImg) modeCss += 'background-image:var(--hss-stage-image);';
      modeCss += '}';
      modes.forEach(function (n) {
        var m = sb.modes[n];
        if (!m) return;
        modeCss += '.hss[data-mode="' + n + '"]{' + themeDecls(m.theme) + '--hss-stage:' + m.bg + ';';
        if (m.bg_image) modeCss += '--hss-stage-image:' + m.bg_image + ';';
        modeCss += 'background:var(--hss-stage);';
        if (m.bg_image) modeCss += 'background-image:var(--hss-stage-image);';
        modeCss += '}';
      });
      /* the switch itself, plus a toggle that respects the OS until touched */
      modeCss += '.hss-toggle{position:absolute;top:1.2vh;right:1.2vw;z-index:9;width:2.4vw;height:2.4vw;'
        + 'border-radius:50%;border:var(--hss-border,1px solid rgba(255,255,255,.2));'
        + 'background:var(--hss-panel,transparent);color:var(--hss-ink,#fff);font:600 1vw var(--hss-font-mono,monospace);'
        + 'cursor:pointer;display:grid;place-items:center;line-height:1}';
      cssOut += modeCss;
    }

    var toggleHtml = '';
    var toggleJs = '';
    if (toggleUi) {
      toggleHtml = '<button class="hss-toggle" id="hss-toggle" type="button"'
        + ' aria-label="Toggle light and dark">◐</button>';
      /* Runs ONCE in _hssSetup, never per frame. */
      toggleJs = 'try{var _t=document.getElementById("hss-toggle"),_r=document.getElementById("hss");'
        + 'if(_t&&_r){if(!_r.getAttribute("data-mode")){'
        + 'var _p=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"' + modes[0] + '":"' + initialMode + '";'
        + '_r.setAttribute("data-mode",_p);}'
        + '_t.addEventListener("click",function(){var _c=_r.getAttribute("data-mode")==="' + modes[0] + '"?"' + initialMode + '":"' + modes[0] + '";'
        + '_r.setAttribute("data-mode",_c);});}}catch(e){}';
    }

    var html =
      '<div class="hss" id="hss"' + (modes.length ? ' data-mode="' + initialMode + '"' : '')
      + (modes.length ? '' : ' style="' + bgStyle + '"') + '>' + scenesHtml + toggleHtml + '</div>';

    /* Spliced HERE, not where `js` is built: the modes block that produces
     * toggleJs sits below it, and splicing an undefined string silently ships
     * a clip whose toggle does nothing. It goes INSIDE _hssSetup, immediately
     * after the latch — splicing it into onFrame instead would call
     * addEventListener sixty times a second, and every binding would try to
     * read the same attribute. */
    if (toggleJs) js = js.replace('  _hssInit=true;', '  _hssInit=true;\n  ' + toggleJs);

    return {
      name: sb.title || sb.id || 'Storyboard',
      dur: Math.round(durMs / 100) / 10,           // seconds, 0.1s precision
      ds: ds,
      html: (fontLinks || '') + mathHtml + html,
      css: cssOut,
      js: js,
      /* one entry per scene, in order. Additive: `html` is unchanged, so every
         existing consumer is byte-identical. */
      sceneHtml: sceneList,
      /* the editor path passes this to loadGoogleBatch; the standalone path
         uses the <link> above. Both are needed - neither covers the other. */
      fonts: families,
      theme: themeVars,
      /* the exporter needs to know which look actually shipped */
      mode: modes.length ? initialMode : null,
      modes: modes,
    };
  }

  /* ── standalone page emitter (matches hic-modal's buildStandalone shape,
     but self-booting: renders itself and loops the animation) ─────────── */
  function buildStandalonePage(sb) {
    var clip = compileStoryboard(sb);
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>' + clip.name + '</title>\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,600;0,7..72,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">\n' +
      '<style>html,body{margin:0;height:100%;overflow:hidden}\n' + clip.css + '</style>\n</head>\n<body>\n' + clip.html +
      '\n<script>\n' + clip.js + '\n;(function(){var t0=performance.now();function loop(){var t=performance.now()-t0;try{onFrame(t%__DUR__)}catch(e){}requestAnimationFrame(loop)}loop();})();\n<\/script>\n</body>\n</html>'
      .replace('__DUR__', String(clip.dur * 1000));
  }

  /* ── design board (style page) ───────────────────────────────────────
   * The animation preview answers "does the film play"; this answers "what is
   * the design system", with no timeline and no timing — swatches, the theme
   * roles they feed, the type ramp at its real sizes, every component in
   * every fill, and each scene's surface.
   *
   * It renders `sb.boards`, which reel-compile fills from the SAME resolved
   * values the clip compiles from. That is the whole design constraint: the
   * board is not a second opinion about the design, it is a view of the one
   * that ships. A board assembled independently would drift, and on the day it
   * did nobody could tell which page was lying.
   *
   * Every board carries its own theme, so a Material film shows light and dark
   * side by side rather than as two files to keep in step. */
  var DESIGN_CSS =
    ':root{--dsp-ink:#16181a;--dsp-muted:#5f666d;--dsp-line:#dfe3e7;--dsp-paper:#ffffff}' +
    'body.dsp{margin:0;background:#eef0f2;color:var(--dsp-ink);' +
      'font:14px/1.5 Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.dsp-wrap{max-width:1500px;margin:0 auto;padding:40px 32px 96px}' +
    '.dsp-head{display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;margin:0 0 6px}' +
    '.dsp-head h1{font-size:26px;font-weight:700;letter-spacing:-.01em;margin:0}' +
    '.dsp-sub{color:var(--dsp-muted);font-size:13px}' +
    '.dsp-sub b{color:var(--dsp-ink);font-weight:600}' +
    '.dsp-head a{margin-left:auto;color:#0b6bcb;text-decoration:none;font-size:13px;font-weight:600}' +
    '.dsp-head a:hover{text-decoration:underline}' +
    '.dsp-note{background:#fff8e6;border:1px solid #f0dca8;border-radius:10px;' +
      'padding:10px 14px;margin:18px 0 0;font-size:12.5px;color:#6b5310}' +
    '.dsp-modes{display:flex;gap:24px;align-items:flex-start;margin-top:26px;flex-wrap:wrap}' +
    '.dsp-board{flex:1 1 640px;min-width:560px;background:var(--dsp-paper);border-radius:14px;' +
      'overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 28px rgba(0,0,0,.07)}' +
    /* the tag is BOARD chrome sitting on the stage swatch, so its ink is the
       board's, not the stage's. It inherited `color:var(--hss-ink)` from
       .dsp-stage, which is near-white on a near-white pill: the label was
       present, correct, and invisible. A screenshot found it; the
       accessibility tree did not, because the text was there. */
    '.dsp-tag{display:inline-block;font:600 10.5px/1 var(--hss-font-mono,ui-monospace,monospace);' +
      'letter-spacing:.14em;text-transform:uppercase;padding:7px 10px;border-radius:999px;' +
      'color:var(--dsp-ink);background:var(--dsp-paper);border:1px solid var(--dsp-line)}' +
    '.dsp-stage{padding:22px 24px;background:var(--hss-stage,transparent);color:var(--hss-ink,#16181a);' +
      'border-bottom:1px solid var(--dsp-line)}' +
    '.dsp-sec{padding:20px 24px;border-bottom:1px solid var(--dsp-line)}' +
    '.dsp-sec:last-child{border-bottom:0}' +
    '.dsp-h{font:600 10.5px/1 var(--hss-font-mono,ui-monospace,monospace);letter-spacing:.14em;' +
      'text-transform:uppercase;color:var(--dsp-muted);margin:0 0 14px}' +
    /* the stage sample: the film surface, with its own ink, so a light board
       is never read against a light page */
    '.dsp-swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}' +
    '.dsp-sw{border:1px solid var(--dsp-line);border-radius:10px;overflow:hidden;background:#fff}' +
    '.dsp-sw-chip{height:52px}' +
    '.dsp-sw-b{padding:7px 9px;font-size:11.5px;line-height:1.45}' +
    '.dsp-sw-b code{font:600 11.5px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;display:block}' +
    '.dsp-sw-b em{font-style:normal;color:var(--dsp-muted);font-size:10.5px}' +
    /* a ratio below 3:1 is a real finding, so it is marked rather than left
       for the reader to compute — and it is INFORMATIONAL here, because this
       page is a preview. reel-contrast is what fails the build. */
    '.dsp-cr{font:600 10px/1 ui-monospace,monospace;padding:2px 5px;border-radius:4px;' +
      'background:#e7f6ec;color:#14663a;display:inline-block;margin-top:4px}' +
    '.dsp-cr.low{background:#fdeaea;color:#9b1c1c}' +
    '.dsp-role{display:inline-block;font:500 9.5px/1 ui-monospace,monospace;letter-spacing:.06em;' +
      'padding:3px 5px;border-radius:4px;background:#eef1f4;color:#48525b;margin:4px 4px 0 0}' +
    '.dsp-ramp-row{display:flex;align-items:baseline;gap:16px;padding:9px 0;' +
      'border-bottom:1px dashed #eceef1}' +
    '.dsp-ramp-row:last-child{border-bottom:0}' +
    '.dsp-ramp-role{font:600 11px/1 ui-monospace,monospace;color:var(--dsp-muted);width:92px;' +
      'flex:none;letter-spacing:.04em}' +
    '.dsp-ramp-sample{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      'color:var(--hss-ink,#16181a)}' +
    '.dsp-ramp-meta{font:500 10.5px/1 ui-monospace,monospace;color:var(--dsp-muted);flex:none}' +
    /* components are rendered with the REAL runtime classes inside the real
       runtime stylesheet, so what the board shows is what the film draws —
       same reason it reads --hss-* rather than a second set of look-alikes */
    '.dsp-comps{display:flex;gap:14px;flex-wrap:wrap}' +
    '.dsp-comp{flex:1 1 190px;min-width:170px;padding:12px;border:1px solid var(--dsp-line);' +
      'border-radius:10px;display:flex;flex-direction:column;gap:8px}' +
    '.dsp-comp-h{font:600 10px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;' +
      'color:var(--dsp-muted)}' +
    '.dsp-comp-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
    '.dsp-comp-l{font:500 9.5px/1 ui-monospace,monospace;color:var(--dsp-muted);width:58px;flex:none}' +
    '.dsp-surfaces{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}' +
    '.dsp-sur{border:1px solid var(--dsp-line);border-radius:8px;overflow:hidden}' +
    '.dsp-sur-chip{height:46px}' +
    '.dsp-sur-b{padding:5px 7px;font:600 10px/1.3 ui-monospace,monospace}' +
    '.dsp-sur-b span{display:block;color:var(--dsp-muted);font-weight:500;white-space:nowrap;' +
      'overflow:hidden;text-overflow:ellipsis}' +
    /* a chart sample is drawn on the film's stage, because that is the surface
       it was designed against — the type in a chart takes its colour from the
       theme, not from this page */
    '.dsp-onstage{padding:20px 22px;border-radius:8px;color:var(--hss-ink,#f8fafc)}';


  function swatchHtml(name, hex, inkHex, ratio, roles, muted) {
    var r = ratio === null || ratio === undefined ? '' :
      '<span class="dsp-cr' + (ratio < 3 ? ' low' : '') + '">' + ratio.toFixed(2) + ':1 vs stage' + '</span>';
    var roleTags = (roles || []).map(function (x) {
      return '<span class="dsp-role">' + esc(x) + '</span>';
    }).join('');
    return '<div class="dsp-sw"><div class="dsp-sw-chip" style="' +
      (hex ? 'background:' + esc(hex) + ';' : '') + 'color:' + esc(inkHex || '#000') + '"></div>' +
      '<div class="dsp-sw-b"><code>' + esc(name) + '</code><em>' + esc(hex || '—') + '</em>' +
      (muted ? '' : r) + roleTags + '</div></div>';
  }

  function rampRowHtml(step) {
    /* The sample is clamped so a 140px display step cannot push the row off
       the page — but the NUMBER shown beside it is the real design-space
       size, because the clamped preview is not the size that ships. */
    var px = step.px || 16;
    var shown = Math.min(px, 54);
    var style = 'font-size:' + shown + 'px;';
    if (step.weight) style += 'font-weight:' + num(step.weight, 100, 900) + ';';
    if (step.tracking) style += 'letter-spacing:' + esc(step.tracking) + ';';
    if (step.case === 'upper') style += 'text-transform:uppercase;';
    if (step.family) style += 'font-family:\'' + esc(step.family) + '\',sans-serif;';
    var meta = px + 'px' + (step.weight ? ' / ' + step.weight : '') +
      (step.case === 'upper' ? ' / upper' : '') +
      (step.family ? ' / ' + step.family : '');
    if (shown !== px) meta += '  (shown ' + shown + 'px)';
    if (step.min_px) meta += '  floor ' + step.min_px + 'px';
    return '<div class="dsp-ramp-row"><div class="dsp-ramp-role">' + esc(step.role) +
      (step.used ? '' : ' *') + '</div>' +
      '<div class="dsp-ramp-sample" style="' + style + '">' +
      esc(step.role === 'math' || step.role === 'math_sm' ? 'x² + y = z' : step.role.replace(/_/g, ' ')) +
      '</div><div class="dsp-ramp-meta">' + esc(meta) + '</div></div>';
  }

  function compHtml(c) {
    var rows = ['filled', 'tonal', 'outlined', 'text'].map(function (fill) {
      var node;
      if (c === 'pill') {
        node = '<span class="hss-pill hss-fill-' + fill + '">chip</span>';
      } else if (c === 'answer') {
        node = '<div class="hss-answer hss-fill-' + fill + '" style="font-size:20px">0.0039</div>';
      } else if (c === 'tile') {
        node = '<div class="hss-tile hss-fill-' + fill + '" style="min-width:0;flex:1">' +
          '<div class="hss-tile-icon">52</div><div class="hss-tile-head">Deck</div>' +
          '<div class="hss-tile-body">Standard, 52 cards</div></div>';
      } else {
        /* `data-pct` is 60, not 0: the board runs the same settle pass the
           scenes preview does, and settle sets each meter's width FROM this
           attribute. Left at 0 the sample meter is drawn and then erased, which
           is a chart the board would be advertising and not showing. */
        node = '<div class="hss-panel hss-fill-' + fill + '" style="min-width:0;flex:1">' +
          '<div class="hss-panel-num">400+</div><div class="hss-panel-label">AQI</div>' +
          '<div class="hss-meter"><div class="hss-meter-fill" data-pct="60" style="width:60%"></div></div></div>';
      }
      return '<div class="dsp-comp-row"><div class="dsp-comp-l">' + fill + '</div>' + node + '</div>';
    }).join('');
    return '<div class="dsp-comp"><div class="dsp-comp-h">' + esc(c) + '</div>' + rows + '</div>';
  }

  function boardHtml(b) {
    var stageInk = b.theme.ink || '#f8fafc';
    var stageFill = b.theme['fill-ink'] || b.theme['slab-ink'] || '#151217';

    /* every token, with the roles it was assigned to and its measured contrast
       against THIS board's stage. Unused tokens render muted rather than being
       hidden: a palette entry nothing points at is worth seeing. */
    var pr = b.paletteRatio || {};
    var rr = b.themeRatio || {};
    var sw = Object.keys(b.palette).sort().map(function (name) {
      var roles = b.roleUse[name];
      return swatchHtml(name, b.palette[name], stageInk,
        pr[name] === undefined ? null : pr[name], roles, pr[name] === undefined);
    }).join('');

    var roleSw = Object.keys(b.theme).filter(function (k) {
      return k !== 'font-display' && k !== 'font-body' && k !== 'font-mono' &&
        k !== 'shadow' && k !== 'border' && k.indexOf('radius') !== 0;
    }).map(function (role) {
      return swatchHtml('--hss-' + role, b.theme[role], stageInk,
        rr[role] === undefined ? null : rr[role], [], rr[role] === undefined);
    }).join('');

    var ramp = b.ramp.length ? b.ramp.map(rampRowHtml).join('') :
      '<div class="dsp-sub">no type ramp authored — the film uses the runtime default</div>';

    var radii = Object.keys(b.radii).length
      ? Object.keys(b.radii).map(function (k) {
        return '<div class="dsp-ramp-row"><div class="dsp-ramp-role">' + esc(k) + '</div>' +
          '<div class="dsp-ramp-sample"><div style="width:74px;height:38px;border:1px solid var(--dsp-line);' +
          'background:var(--hss-panel);border-radius:' + esc(b.radii[k]) + '"></div></div>' +
          '<div class="dsp-ramp-meta">' + esc(b.radii[k]) + '</div></div>';
      }).join('')
      : '<div class="dsp-sub">no per-component radii — everything uses <code>--hss-radius:' +
        esc(b.radius || 'runtime default') + '</code></div>';

    /* The categorics, drawn by the REAL chart renderer inside the REAL runtime
       stylesheet. A strip of six swatches proves six hexes exist; it does not
       prove that a donut draws them, that the legend names them, or that the
       grid and the muted ink take their own roles. This does — and it is the
       same `buildChart` the film calls, reading the same `--hss-sN` the theme
       sets on this board, so a chart that renders here renders in the film. */
    var paletteChart = '';
    try {
      paletteChart = buildChart({
        id: 'palette-sample', chart: 'donut', legend: false,
        categories: ['series 1', 'series 2', 'series 3', 'series 4', 'series 5', 'series 6'],
        series: [{ name: 'categorical', values: [6, 5, 4, 3, 2, 1] }],
        title: 'The categorical palette, drawn',
        subtitle: 'Read straight off --hss-s1 … --hss-s6. Unset, these are the runtime defaults.',
        source: 'design.theme_map \u2192 s1…s6',
      });
    } catch (err) {
      paletteChart = '<div class="dsp-sub">chart renderer unavailable in this emitter</div>';
    }

    var comps = ['card', 'tile', 'pill', 'answer'].map(compHtml).join('');
    var fillsNote = Object.keys(b.fills).length
      ? 'defaults: ' + Object.keys(b.fills).sort().map(function (k) { return k + '=' + b.fills[k]; }).join(', ')
      : 'no design.fills — every component renders its authored default';

    var surfaces = b.surfaces.map(function (s) {
      var css = s.css || '';
      return '<div class="dsp-sur"><div class="dsp-sur-chip"' +
        (css ? ' style="' + esc(css) + ';background-repeat:repeat"' : '') + '></div>' +
        '<div class="dsp-sur-b">' + esc(s.id) +
        '<span>' + esc(s.decl ? (s.decl.type || 'flat') : 'follows stage') + '</span></div></div>';
    }).join('');

    return '<div class="dsp-board" style="' + designThemeVars(b) + '">' +
      '<div class="dsp-stage" style="--hss-stage:' + esc(b.bg) + ';background:' + esc(b.bg) + '">' +
        '<span class="dsp-tag">' + esc(b.mode) + '</span>' +
        (b.declared === false
          ? '<span class="dsp-tag" style="opacity:.7;margin-left:6px">' +
            'no design block · runtime defaults</span>'
          : '') +
        '<div style="margin-top:14px;font-size:34px;font-weight:700;letter-spacing:-.02em">The stage</div>' +
        '<div style="font-size:13px;opacity:.8;margin-top:4px">' +
        esc(b.counts.scenes) + ' scenes · ' + esc(b.counts.elements) + ' elements · ' +
        esc(b.counts.duration) + 's · ' + esc(b.counts.types.join(' ')) + '</div>' +
      '</div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Surfaces · one per scene</h3>' +
        '<div class="dsp-surfaces">' + surfaces + '</div></div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Palette · every token</h3>' +
        '<div class="dsp-swatches">' + (sw || '<div class="dsp-sub">no design.tokens</div>') + '</div></div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Theme roles · what the emitter paints</h3>' +
        '<div class="dsp-swatches">' + roleSw + '</div>' +
        '<div class="dsp-sub" style="margin-top:12px">A role left unfilled falls back to a default, which is ' +
        'how a film ends up green and wrong — the compiler reports it.</div></div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Type ramp · at the sizes that ship</h3>' + ramp +
        '<div class="dsp-sub" style="margin-top:10px">* not referenced by any element. ' +
        'Samples are clamped to fit; the px shown is the real design-space size.</div></div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Radii</h3>' + radii + '</div>' +

      '<div class="dsp-sec"><h3 class="dsp-h">Components · every fill</h3>' +
        '<div class="dsp-comps">' + comps + '</div>' +
        '<div class="dsp-sub" style="margin-top:12px">' + esc(fillsNote) + '</div></div>' +

      /* the chart is drawn on the FILM's stage, not on the board's white paper.
         A graphic authored for a near-black field is dark type on a dark field
         and goes invisible the moment it is placed on paper — the same mistake
         the mode tag made one level down. */
      '<div class="dsp-sec"><h3 class="dsp-h">Charts · the categorical palette in use</h3>' +
        '<div class="dsp-onstage" style="background:' + esc(b.bg) + '">' + paletteChart + '</div>' +
      '</div>' +
      '</div>';
  }

  /* the board's own --hss-* custom properties, so RUNTIME_CSS styles the
     component samples with the film's real theme rather than a look-alike */
  function designThemeVars(b) {
    var s = '';
    for (var i = 0; i < THEME_KEYS.length; i++) {
      var v = b.theme[THEME_KEYS[i]];
      if (v === undefined || v === null || v === '') continue;
      if (/[;{}<>]/.test(String(v))) continue;
      s += '--hss-' + THEME_KEYS[i] + ':' + String(v) + ';';
    }
    return s;
  }

  function buildDesignPage(sb) {
    var boards = (sb && sb.boards) || [];
    var fontLinks = '';
    if (Array.isArray(sb.fonts)) {
      fontLinks = sb.fonts.map(function (f) {
        if (!f || !f.href) return '';
        return '<link rel="stylesheet" href="' + esc(f.href) + '">';
      }).join('');
    }
    var multi = boards.length > 1;
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(sb.title || 'Design') + ' — design</title>\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">\n' +
      fontLinks + '<style>' + RUNTIME_CSS + DESIGN_CSS + '</style>\n</head>\n<body class="dsp">\n' +
      '<div class="dsp-wrap">\n' +
      '<div class="dsp-head"><h1>' + esc(sb.title || 'Design') + '</h1>' +
      '<span class="dsp-sub">design system · ' + esc(boards.length) + ' mode' + (multi ? 's' : '') + '</span>' +
      (sb.preview ? '<a href="' + esc(sb.preview) + '">play the film →</a>' : '') +
      '</div>\n' +
      '<div class="dsp-note">Generated by <code>reel-compile.cjs --write-design</code> from the same ' +
      'resolved values the clip compiles from, so every colour here is the one the film ships. ' +
      'The film\'s animation, timing and per-scene layout are in the preview, not here.</div>\n' +
      '<div class="dsp-modes">' + boards.map(boardHtml).join('') + '</div>\n' +
      '</div>\n' +
      /* the sample charts are left in their pre-animation state by the emitter
         (a bar with no height, a dash array that hides the line). Settling them
         here uses the SAME statements the clip's own settle() runs, so the
         board cannot show a chart shape the film never draws. */
      '<script>(function(){var root=document;' + SETTLE_JS + '\n})();</' + 'script>\n</body>\n</html>';
  }

  /* ── scenes page (the film as a contact sheet) ─────────────────────────
   * reel-preview answers "how does it move"; the design board answers "what is
   * the design system"; this answers *"what does each scene look like?"* —
   * every scene, settled, in order, with nothing playing.
   *
   * It is not a smaller version of the preview and not a screenshot. Each
   * stage is a real `.hss` root carrying the SAME compiled clip CSS and the
   * SAME scene markup the film ships, and `settle()` is the emitter's own
   * finished-state renderer, so a scene here is that scene — not a
   * re-implementation of it that will disagree the next time a component
   * changes.
   *
   * One stage per row at full page width, which is the only layout where the
   * runtime's vw-based type resolves the way it does in the film. Two stages
   * side by side would each be half a viewport wide and the type inside them
   * would be twice the size it should be — a contact sheet that quietly
   * misrepresents every slide on it. */
  var SCENES_CSS =
    'body.scn{margin:0;background:#0b0c0d;color:#e8eae9;' +
      'font:14px/1.5 Inter,-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.scn-wrap{margin:0 auto;padding:26px 0 90px}' +
    '.scn-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;padding:0 22px 16px}' +
    '.scn-head h1{font-size:22px;font-weight:700;letter-spacing:-.01em;margin:0}' +
    '.scn-head .scn-sub{color:#8d9499;font-size:13px}' +
    '.scn-head a{margin-left:auto;color:#ffeb00;text-decoration:none;font-size:13px;font-weight:600}' +
    '.scn-head a:hover{text-decoration:underline}' +
    '.scn-nav{display:flex;gap:7px;flex-wrap:wrap;padding:0 22px 20px}' +
    '.scn-nav a{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;' +
      'text-decoration:none;color:#afb6ba;background:#171a1c;border:1px solid #24282b;' +
      'padding:7px 10px;border-radius:999px}' +
    '.scn-nav a:hover{color:#0b0c0d;background:#ffeb00;border-color:#ffeb00}' +
    '.scn-list{display:flex;flex-direction:column;gap:30px}' +
    '.scn-card{margin:0}' +
    /* the frame is the STAGE, exactly 16:9 (or the film's own aspect), and the
       .hss root fills it. Nothing is scaled with transform, so a chart, a
       panel radius and a line-height all land where the film puts them. */
    '.scn-frame{position:relative;width:100%;overflow:hidden;background:#000}' +
    '.scn-frame>.hss{position:absolute;inset:0}' +
    '.scn-bar{display:flex;gap:16px;align-items:baseline;flex-wrap:wrap;padding:11px 22px;' +
      'font:500 12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8d9499;background:#131517;' +
      'border-top:1px solid #1e2225}' +
    '.scn-bar b{color:#e8eae9;font-weight:700;letter-spacing:.06em}' +
    '.scn-bar .scn-n{color:#ffeb00;font-weight:700}' +
    '.scn-bar span{margin-left:auto}';

  function scenesPageSceneHtml(s) {
    var frameStyle = ' style="aspect-ratio:' + (s.ratio || '16 / 9') + ';background:' + esc(s.bg || '#000') + '"';
    /* A film with modes gets its stage colour from the `[data-mode]` rule, so an
       inline background here would override the very rule that makes the mode
       visible. A film without modes has no such rule and needs the inline paint
       the clip itself carries. */
    var stageBg = (!s.mode && s.bg) ? ' style="background:' + esc(s.bg) + '"' : '';
    return '<section class="scn-card" id="scene-' + esc(s.id) + '">' +
      '<div class="scn-frame"' + frameStyle + '>' +
        '<div class="hss"' + (s.mode ? ' data-mode="' + esc(s.mode) + '"' : '') + stageBg + '>' +
          s.html +
        '</div>' +
      '</div>' +
      '<div class="scn-bar"><b>' + esc(String(s.index)) + ' · ' + esc(s.id) + '</b>' +
        '<span style="margin-left:0">' + esc(s.start) + 's – ' + esc(s.end) + 's · ' +
        esc(s.dur) + 's</span>' +
        '<span style="margin-left:0">' + esc(s.elements) + ' element' + (s.elements === 1 ? '' : 's') +
        (s.kinds ? ' · ' + esc(s.kinds) : '') + '</span>' +
        '<span>' + esc(s.note || 'settled · not animated') + '</span>' +
      '</div>' +
      '</section>';
  }

  function buildScenesPage(sb) {
    var scenes = (sb && sb.scenes) || [];
    var fontLinks = '';
    if (Array.isArray(sb.fonts)) {
      fontLinks = sb.fonts.map(function (f) {
        return (f && f.href) ? '<link rel="stylesheet" href="' + esc(f.href) + '">' : '';
      }).join('');
    }
    var nav = scenes.map(function (s) {
      return '<a href="#scene-' + esc(s.id) + '">' + esc(String(s.index)) + ' ' + esc(s.id) + '</a>';
    }).join('');
    var links = (sb.preview ? '<a href="' + esc(sb.preview) + '">play the film →</a>' : '') +
      (sb.board ? '<a href="' + esc(sb.board) + '" style="margin-left:14px">design →</a>' : '');
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + esc(sb.title || 'Scenes') + ' — scenes</title>\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">\n' +
      fontLinks +
      /* the FILM's own stylesheet, unmodified: the same runtime the clip uses,
         so a component cannot look right here and wrong in the film */
      '<style>' + (sb.css || (RUNTIME_CSS + (sb.theme ? '.hss{' + sb.theme + '}' : ''))) + SCENES_CSS + '</style>\n' +
      /* Math. `sb.math` is the clip's OWN inlined renderer (see the note at
         mathHtml in compileStoryboard), spliced here verbatim for the same
         reason as the stylesheet: this page shows the film's markup, and a
         `$$…$$` left raw on a board while the clip sets it is a board lying
         about the film. In <head>, before the closing script calls
         _hssSetup(), because a non-async external script (a data: URL is
         EXTERNAL — see above) blocks parsing and therefore runs first. */
      (sb.math ? (sb.math.css || '') + (Array.isArray(sb.math.scripts) ? sb.math.scripts.join('') : '') : '') +
      '</head>\n<body class="scn">\n' +
      '<div class="scn-wrap">\n' +
      '<div class="scn-head"><h1>' + esc(sb.title || 'Scenes') + '</h1>' +
      '<span class="scn-sub">' + esc(scenes.length) + ' scene' + (scenes.length === 1 ? '' : 's') +
      ' · settled, not animated</span>' + links + '</div>\n' +
      '<div class="scn-nav">' + nav + '</div>\n' +
      '<div class="scn-list">' + scenes.map(scenesPageSceneHtml).join('') + '</div>\n' +
      '</div>\n' +
      /* the clip runtime, then settle(). No animation loop is started, so the
         only thing that ever runs is the finished-state pass — and it is the
         emitter's own, so it cannot drift from `_chart`. */
      '<script>' + escapeScript(sb.js || '') + '\n' +
        'try{_hssSetup();settle(document);}catch(e){}\n' +
      '</' + 'script>\n</body>\n</html>';
  }

  return {
    compileStoryboard: compileStoryboard,
    buildStandalonePage: buildStandalonePage,
    buildDesignPage: buildDesignPage,
    buildScenesPage: buildScenesPage,
    /* Let a caller ask "does this emitter know this type?" without keeping
       its own copy of the switch. See emitterSupportsType above. */
    emitterSupportsType: emitterSupportsType,
    unknownTypeError: unknownTypeError,
    /* the shape vocabulary under the same contract: asked, not copied. */
    emitterSupportsShape: emitterSupportsShape,
    unknownShapeError: unknownShapeError,
    unknownArrowSideError: unknownArrowSideError,
    ARROW_SIDES: ARROW_SIDES,
    SCENES_CSS: SCENES_CSS,
    RUNTIME_CSS: RUNTIME_CSS,
    DESIGN_CSS: DESIGN_CSS,
  };
});
