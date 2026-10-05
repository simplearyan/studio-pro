/**
 * R0 authoring aid — emits Storyboard.html for the reference film.
 *
 * This is NOT the compiler. R1 replaces it. It performs, by hand-equivalent
 * mechanical steps, exactly what the compiler will have to do:
 *   1. scope each scene's authored CSS under its scene class
 *   2. namespace that scene's @keyframes so four `fadeUp`s cannot collide
 *   3. compile each scene's @keyframes to deterministic specs (via the repo's
 *      own WAAPI adapter, so the time model matches the pipeline exactly)
 *   4. wrap them in one reel whose onFrame(t) offsets by scene start
 *
 * Written after the four Markdown artifacts, not before — that is R0's order.
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../../../..');
const OUT = __dirname;

const adapterSrc = fs.readFileSync(path.join(ROOT, 'src/engines/hic/adapters/waapi.js'), 'utf8');
vm.runInThisContext(adapterSrc, { filename: 'waapi.js' });
const WAAPI = globalThis.WAAPIAdapter;

// ── the reference film, straight from the shipped composition ──────────────
const clips = [];
const StudioPro = {
  fonts: { loadGoogleBatch() {} },
  createComposition(o) { composition = o; },
  html(html, css, js, opts) { const c = { html, css, js, ...opts }; clips.push(c); return c; },
};
let composition = {};
const exSrc = fs.readFileSync(path.join(ROOT, 'automation/html-in-canvas/examples/pollution-story.js'), 'utf8');
const shim = { exports: {} };
vm.runInNewContext(exSrc, { module: shim, console, require, window: {}, document: {} }, { filename: 'pollution-story.js' });
shim.exports(StudioPro, {});

// ── 1 + 2: scope the selectors, namespace the keyframes ───────────────────
function splitTop(css) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { out.push(css.slice(start, i + 1)); start = i + 1; } }
  }
  if (start < css.length) out.push(css.slice(start));
  return out.filter(s => s.trim());
}

/** `.scene` IS the scene root, so it takes `.scene.sN`; everything else is a
 *  descendant of the root and takes `.sN <sel>`. Getting this backwards
 *  silently drops the scene's own background and centering. */
function scopeSelector(sel, ns) {
  const s = sel.trim();
  const cut = Math.max(s.lastIndexOf(' '), s.lastIndexOf('>'), s.lastIndexOf('+'), s.lastIndexOf('~'));
  const head = cut >= 0 ? s.slice(0, cut + 1) : '';
  const subject = cut >= 0 ? s.slice(cut + 1) : s;
  // `.scene` IS the scene root, so it takes `.scene.sN`; everything else is a
  // descendant of the root and takes `.sN <sel>` — note the dot, or the prefix
  // becomes a type selector for a tag named `sN` and silently matches nothing.
  if (subject.indexOf('.scene') >= 0) return head + subject.replace('.scene', '.scene.' + ns);
  return '.' + ns + ' ' + s;
}

function scopeCss(css, ns) {
  const rules = splitTop(css);
  const names = [];
  rules.forEach(r => { const m = r.slice(0, r.indexOf('{')).trim().match(/^@keyframes\s+([\w-]+)/); if (m) names.push(m[1]); });
  return rules.map(rule => {
    const brace = rule.indexOf('{');
    const p = rule.slice(0, brace).trim();
    const body = rule.slice(brace);
    if (/^@keyframes/.test(p)) return '@keyframes ' + ns + '_' + p.replace(/^@keyframes\s+/, '') + body;
    let b = body;
    names.forEach(n => {
      const re = new RegExp('(^|[\\s,(])' + n + '(\\s|,|\\))', 'g');
      b = b.replace(re, (mm, pre, post) => pre + ns + '_' + n + post);
    });
    const scoped = p.split(',').map(s => scopeSelector(s, ns)).join(', ');
    return scoped + ' ' + b;
  }).join('\n');
}

// ── 3: compile each scene to specs ────────────────────────────────────────
const bounds = [];
const SPECS = [];
const cssParts = [];
const bodyParts = [];

clips.forEach((c, i) => {
  const ns = 's' + (i + 1);
  bounds.push([c.start * 1000, (c.start + c.duration) * 1000]);
  const scoped = scopeCss(c.css, ns);
  // Take the STRIPPED half, exactly as htmlToHicCode does for an editor clip:
  // a still-running `@keyframes` would beat the inline styles onFrame writes.
  const compiled = WAAPI.compileKeyframes(scoped, 30);
  cssParts.push('/* ── scene ' + (i + 1) + ' · ' + c.start + 's +' + c.duration + 's ── */\n' + compiled.css);
  compiled.animations.forEach(a => SPECS.push({
    sel: a.sel, dur: a.dur, delay: a.delay, ease: a.ease, iter: a.iter,
    fill: a.fill, steps: a.steps, _sc: i, _st: c.start * 1000,
  }));
  // Put the id on the scene's OWN root element rather than wrapping it in
  // another .scene: a wrapper would match `.scene.sN` twice, doubling the
  // centering and background rules, and R1 would have to know about it.
  const rooted = c.html.replace(/<div class="scene\b/, '<div id="r-' + ns + '" class="scene');
  if (rooted === c.html) throw new Error('scene ' + (i + 1) + ': expected a .scene root to attach the id to');
  bodyParts.push(rooted);
});

// ── 4: the reel runtime — the adapter's own sampler, scene-aware ──────────
// Take the adapter's runtime for ONE scene, then DELETE its `var SPECS = ...`
// declaration. It is function-scoped inside the IIFE, so leaving it in shadows
// the 23-spec table emitted below and every spec is skipped — the reel renders
// its backgrounds and never animates anything.
const raw = WAAPI.compileKeyframes(scopeCss(clips[0].css, 's1'), 30).js;
const base = raw.replace(/^([\s\S]*?)var SPECS = [\s\S]*?;\n/, '$1');
if (base === raw) throw new Error('failed to strip the adapter SPECS declaration');
const TAIL = '  window.__hicWaapiApply=function(timeMs){';
const runtime = base.slice(0, base.indexOf(TAIL)) + [
  '  /* Reel driver: the four scenes share one onFrame(t). Each scene runs the',
  '   * adapter sampler at its LOCAL time (t - start), because the reference',
  '   * film captures four clips 0..duration independently and places them on a',
  '   * timeline — so scene 2 frame 0 is onFrame(0) there, onFrame(6000) here.',
  '   * Only the active scene is sampled: the others are display:none. */',
  '  var BOUNDS = __BOUNDS__;',
  '  var TOTAL = BOUNDS[BOUNDS.length-1][1];',
  '  function __hicWaapiApply(timeMs){',
  '    var a=0; for(var i=0;i<BOUNDS.length;i++){ if(timeMs>=BOUNDS[i][0]&&timeMs<BOUNDS[i][1]){a=i;break;} }',
  '    for(var j=0;j<SPECS.length;j++){',
  '      var sp=SPECS[j]; if(sp._sc!==a) continue;',
  '      try{ run(sp,timeMs-sp._st,j); }catch(e){}',
  '    }',
  '  }',
  '  window.onFrame=function(timeMs){',
  '    if(!(timeMs>=0)) timeMs=0;',
  '    if(timeMs>=TOTAL) timeMs=TOTAL-0.001;',
  '    for(var k=0;k<BOUNDS.length;k++){',
  '      var el=document.getElementById("r-s"+(k+1)); if(!el) continue;',
  '      var on=(timeMs>=BOUNDS[k][0]&&timeMs<BOUNDS[k][1]);',
  '      el.style.display=on?"":"none";',
  '    }',
  '    __hicWaapiApply(timeMs);',
  '  };',
  '})();',
].join('\n');

const specsJs = 'var SPECS = ' + JSON.stringify(SPECS).replace(/},/g, '},\n') + ';';

const fontLinks = ['Inter', 'Space Grotesk'].map(fn =>
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=' + fn.replace(/\s+/g, '+') + ':wght@400;600;700;900&display=swap">'
).join('\n');

const html = [
  '<!DOCTYPE html>',
  '<html>',
  '<head>',
  '<meta charset="UTF-8">',
  '<title>A Breath of Air</title>',
  '<!--',
  '  A Breath of Air — the R0 reference reel (hand-compiled; see NOTES.md).',
  '  Contract: window.onFrame(t) is the ONLY time input. No Date, no Math.random,',
  '  no requestAnimationFrame, no setTimeout. Pure function of t, in ms.',
  '-->',
  fontLinks,
  '<style>',
  '  * { margin: 0; padding: 0; box-sizing: border-box; }',
  '  html, body { width: 1920px; height: 1080px; overflow: hidden; background: ' + composition.backgroundColor + '; }',
  '  /* stage: the four scenes stack; onFrame shows exactly one */',
  '  .reel { position: relative; width: 100%; height: 100%; overflow: hidden; }',
  '  .reel .scene { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }',
  '',
  cssParts.join('\n\n'),
  '</style>',
  '</head>',
  '<body>',
  '<div class="reel">',
  bodyParts.join('\n'),
  '</div>',
  '<script>',
  '/* generated by the R0 authoring aid — deterministic from t */',
  specsJs,
  runtime.replace('__BOUNDS__', JSON.stringify(bounds)),
  '</script>',
  '</body>',
  '</html>',
  '',
].join('\n');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'Storyboard.html'), html);
console.log('wrote Storyboard.html  bytes=' + html.length + '  specs=' + SPECS.length + '  bounds=' + JSON.stringify(bounds));
