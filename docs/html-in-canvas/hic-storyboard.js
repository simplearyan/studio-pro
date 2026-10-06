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
    '.hss .hss-align-end{align-self:flex-end}';

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
    'fill', 'fill-ink', 'fill-tone', 'outline'];

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
    '  var root=document.getElementById("hss");',
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
      '      continue;',
    '      var pin=_ph(e.in,tL);if(pin===null){_hidden(eN);continue;}var ty=(e.in&&e.in.t)||"fade";_ap(eN,ty,pin,e.in);',
    '    }',
    '  }',
    '}',
  ].join('\n');

  /* ── element builders: return the clip HTML for one element ─────────── */
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
        inner = '<div class="hss-shape hss-shape-' + kind + '" style="color:' + (e.color || '#6ed9b1') + '"></div>';
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
    var scenesHtml = sb.scenes.map(function (sc) {
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
    }).join('');

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
            return el;
          }),
        };
      }),
    };

    /* Move overlay wraps into their host wraps at setup time — done in the
       clip's first onFrame via a one-time DOM patch (see _hssSetup). */
    var overlayJs = overlays.map(function (o) {
      return 'try{var _o=document.getElementById(' + JSON.stringify(o.id) + ');var _h=document.getElementById(' + JSON.stringify(o.of) + ');if(_o&&_h)_h.appendChild(_o);}catch(e){}';
    }).join('\n');

    var js = CLIP_JS_TEMPLATE
      .replace('__SB__', JSON.stringify(sbLit))
      .replace('  _hssSetup();', '  _hssSetup();\n' + overlayJs); // run once per frame; _hssInit guard makes it cheap

    /* KaTeX loader goes FIRST in the html so HicRenderer's external-script
       hoisting runs before anything renders */
    /* NOTE: plain </script> closers — this file is loaded as an external
     * script, so the escape hack is unnecessary, and a literal <\/script
     * here would break DOM parsing of the emitted clip (the unterminated
     * <script src> would swallow the scene markup when hic-frame hoists it). */
    var katex =
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" crossorigin="anonymous">' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" crossorigin="anonymous"></script>' +
      '<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js" crossorigin="anonymous"></script>';

    var needsKatex = /type":"latex"/.test(JSON.stringify(sbLit)) || sb.scenes.some(function (sc) { return sc.elements.some(function (e) { return e.type === 'latex'; }); });

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
      html: (fontLinks || '') + (needsKatex ? katex : '') + html,
      css: cssOut,
      js: js,
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
    '.dsp-tag{display:inline-block;font:600 10.5px/1 var(--hss-font-mono,ui-monospace,monospace);' +
      'letter-spacing:.14em;text-transform:uppercase;padding:7px 10px;border-radius:999px;' +
      'background:var(--dsp-paper);border:1px solid var(--dsp-line)}' +
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
      'overflow:hidden;text-overflow:ellipsis}';

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
        node = '<div class="hss-panel hss-fill-' + fill + '" style="min-width:0;flex:1">' +
          '<div class="hss-panel-num">400+</div><div class="hss-panel-label">AQI</div>' +
          '<div class="hss-meter"><div class="hss-meter-fill" data-pct="0" style="width:60%"></div></div></div>';
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
    var sw = Object.keys(b.palette).sort().map(function (name) {
      var roles = b.roleUse[name];
      return swatchHtml(name, b.palette[name], stageInk, null, roles, false);
    }).join('');

    var roleSw = Object.keys(b.theme).filter(function (k) {
      return k !== 'font-display' && k !== 'font-body' && k !== 'font-mono' &&
        k !== 'shadow' && k !== 'border' && k.indexOf('radius') !== 0;
    }).map(function (role) {
      return swatchHtml('--hss-' + role, b.theme[role], stageInk, null, [], false);
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
        '<span class="dsp-tag" style="color:' + esc(stageInk) + '">' + esc(b.mode) + '</span>' +
        (b.declared === false
          ? '<span class="dsp-tag" style="color:' + esc(stageInk) + ';opacity:.7;margin-left:6px">' +
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
      '</div>\n</body>\n</html>';
  }

  return {
    compileStoryboard: compileStoryboard,
    buildStandalonePage: buildStandalonePage,
    buildDesignPage: buildDesignPage,
    RUNTIME_CSS: RUNTIME_CSS,
    DESIGN_CSS: DESIGN_CSS,
  };
});
