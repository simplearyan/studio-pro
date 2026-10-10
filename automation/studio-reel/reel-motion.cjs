/**
 * reel-motion.cjs — the motion gate: does anything MOVE, and does it move the
 * same way every time?
 *
 * The other gates know where things are (extent), what colour they are
 * (contrast), and that they survive compilation (fidelity) — none of them
 * knows whether the film actually ANIMATES. A storyboard can validate, compile
 * and measure while every entrance is a no-op, because a static frame is a
 * passing frame for every gate that exists. This one drives the runtime's own
 * onFrame(t) in a real browser and asks three questions per film:
 *
 *   1. DETERMINISM — render fixed frames at t from two FRESH page loads and
 *      compare whole-frame hashes. onFrame is contracted to be a pure
 *      function of t (no wall clock, no random, no leftover state), and this
 *      is that contract as one check: it catches a performance.now() creeping
 *      into the interpolator before contrast ever samples a colour. The hash
 *      covers each element's subtree (opacity, transform, stroke-dashoffset,
 *      inline width), every scene's display/opacity, and the stage's mode.
 *
 *   2. MOTION OCCURS — for every element with an entrance, the subtree hash
 *      at t_enter−1ms must differ from t_enter+1ms: something the author
 *      asked to move must actually move at the moment it starts. And after
 *      the element (plus its stagger, meter and chart phases) settles, two
 *      later frames must hash EQUAL — it stopped. An entrance that never
 *      moves and a settle that never rests are both silent defects: the first
 *      ships a static element with a green gate, the second ships a film that
 *      is still twitching when the scene cuts.
 *
 *   3. COVERAGE — which entrance types, easing curves, staggers, overshoots
 *      and phases each film actually exercises, printed per film and pooled,
 *      with the vocabulary values NO film uses listed beside the ones in use.
 *      A feature that compiles but is never authored is invisible until
 *      someone prints it — that is how `series` wrapping shipped unused.
 *      Coverage is INFORMATIONAL; only probes 1 and 2 fail the build.
 *
 * WHY THE TIMES ARE DERIVED FROM THE SB LITERAL. The probes must sample the
 * schedule the RUNTIME reads (scene start + at + in.s, in milliseconds after
 * the emitter's conversion), not the IR's seconds — a second model of the
 * timeline here would be exactly the drift this repo's gates exist to catch.
 * Child counts for stagger come from the live DOM (the emitter is the only
 * thing that knows how many wraps a group rendered).
 *
 * IT CANNOT PASS BY NOT RUNNING. No browser, or a protocol failure, exits
 * NON-ZERO — same contract as reel-contrast: the day the gate skips itself is
 * the day a frozen film ships while everyone believes motion was checked.
 *
 * Usage:
 *   node automation/studio-reel/reel-motion.cjs
 *   node automation/studio-reel/reel-motion.cjs --only two-queens --mode dark
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { DEFAULT_W, DEFAULT_H, findBrowser, launchBrowser } = require('./cdp.cjs');

const ROOT = path.resolve(__dirname, '../..');
const EMITTER = path.join(ROOT, 'html-in-canvas/hic-storyboard.js');

function loadEmitter() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const shim = { exports: {} };
  vm.runInNewContext(src, { module: shim, console, require, window: {}, document: {} }, { filename: 'hic-storyboard.js' });
  return shim.exports;
}

/* ── the schedule, from the literal the runtime actually reads ─────────────
 * `var SB = {...}` inside the compiled clip js is what onFrame iterates, in
 * milliseconds, after the emitter converted the IR. Parsing it here (with a
 * string-aware brace scan — authored copy can contain braces) means the probe
 * times cannot disagree with the runtime: they ARE the runtime's numbers.
 *
 *   t_enter = scene.s + at + in.s     (onFrame's tL = t − sc.s − at, _ph
 *                                       returns null before in.s)
 *   t_end   = t_enter + in.d          (_ph clamps to 1 after the window)
 *   group children run (n−1)·st later (each child's phase is t − i·st)
 *   meter/chart ride their OWN phase: base + mt + min.s + min.d, and a chart
 *   adds idx_max·st for its per-bar stagger. */
function parseSB(clipJs) {
  const key = 'var SB = ';
  const at = clipJs.indexOf(key);
  if (at === -1) throw new Error('compiled clip has no SB literal');
  let i = at + key.length;
  if (clipJs[i] !== '{') throw new Error('SB literal is not an object');
  let depth = 0, inStr = false, esc = false;
  for (; i < clipJs.length; i++) {
    const c = clipJs[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return JSON.parse(clipJs.slice(at + key.length, i + 1)); }
  }
  throw new Error('unterminated SB literal');
}

const GROUP_TYPES = { cards: 1, tiles: 1, pills: 1, card: 1 };

function buildSchedule(SB) {
  const out = [];
  for (const sc of SB.scenes) {
    for (const e of sc.els) {
      if (!e.in) { out.push({ id: e.id, type: e.type, noEntrance: true }); continue; }
      const base = sc.s + (e.at || 0);
      const tEnter = base + (e.in.s || 0);
      const tEnd = tEnter + (e.in.d || 600);
      const entry = {
        id: e.id, type: e.type, tEnter, tEnd, sceneEnd: sc.e, st: e.st || 0,
        group: !!GROUP_TYPES[e.type],
        meterEnd: null, chartBase: null,
      };
      if (e.min) {
        const ph = base + (e.mt || 0) + (e.min.s || 0) + (e.min.d || (e.type === 'chart' ? 1400 : 900));
        if (e.type === 'chart') entry.chartBase = ph;
        else entry.meterEnd = ph;
      }
      out.push(entry);
    }
  }
  return out;
}

/* ── the measurement, executed IN the page ────────────────────────────────
 * Built by join() rather than a template literal, for the same reason
 * reel-contrast builds its expression that way: the body is long, quote-heavy
 * code and a template literal would be parsing itself.
 *
 * The frame hash deliberately mixes COMPUTED style (opacity/transform read
 * through the cascade, so a class-set opacity like the credit's .75 counts as
 * frame state) with the INLINE width the meter and highlight writers set
 * (width as a computed property is layout, and layout depends on webfont
 * timing — inline width is exactly what the runtime wrote, nothing more).
 * Nodes inside a KaTeX subtree hash as one leaf: the renderer's span soup is
 * static after typeset and walking it would dwarf the motion it surrounds. */
const HASH_FNS = [
  'function djb2(s){var h=5381;for(var i=0;i<s.length;i++)h=((h*33)^s.charCodeAt(i))>>>0;return ("00000000"+h.toString(16)).slice(-8);}',
  'function nodeLine(n){var cs=getComputedStyle(n);return n.nodeName+":"+cs.opacity+"|"+cs.transform+"|"+cs.strokeDashoffset+"|"+(n.style.width||"");}',
  'function hashEl(id){var el=document.getElementById(id);if(!el)return "MISSING";var s="";(function walk(n){s+=nodeLine(n)+";";var ks=n.children;for(var i=0;i<ks.length;i++){var k=ks[i];if(k.classList&&k.classList.contains("katex")){s+=nodeLine(k)+";";continue;}walk(k);}})(el);return djb2(s);}',
  'function subtreeOf(id){var el=document.getElementById(id);if(!el)return "MISSING";var s="";(function walk(n){s+=nodeLine(n)+";";var ks=n.children;for(var i=0;i<ks.length;i++){var k=ks[i];if(k.classList&&k.classList.contains("katex")){s+=nodeLine(k)+";";continue;}walk(k);}})(el);return s;}',
  'function diffSeg(x,y){var a=String(x).split(";");var b=String(y).split(";");var out=[];for(var i=0;i<Math.max(a.length,b.length);i++){if(a[i]!==b[i])out.push((a[i]||"∅")+" ⇒ "+(b[i]||"∅"));}return out.slice(0,4);}',
  /* A display:none scene paints NOTHING, so stale styles inside it are not
     part of the frame a viewer sees — they are leftovers on an invisible
     subtree (onFrame hides a scene by display alone, deliberately, and the
     hidden branches of the element loop write what they write). Hashing them
     would compare page HISTORY rather than the frame: two runs that render
     pixel-identically would differ because one ran a different wall-clock
     second during load. The contract under test is that the VISIBLE frame is
     a pure function of t, so hidden scenes and their elements hash as the
     constant "hidden". */
  'function frameParts(){var p={};var st=document.getElementById("hss");p.stage=st?st.getAttribute("data-mode"):"?";var sc=document.querySelectorAll("#hss .hss-scene");for(var i=0;i<sc.length;i++){var c=getComputedStyle(sc[i]);p["sc"+i]=c.display==="none"?"hidden":djb2(c.display+"|"+c.opacity+"|"+c.transform);}var els=document.querySelectorAll("#hss .hss-el[id]");for(var j=0;j<els.length;j++){var sN=els[j].closest(".hss-scene");var sC=sN?getComputedStyle(sN):null;p[els[j].id]=(sC&&sC.display==="none")?"hidden":hashEl(els[j].id);}return p;}',
  'function frameHash(){var p=frameParts();var s="";var ks=Object.keys(p);for(var i=0;i<ks.length;i++)s+=ks[i]+"="+p[ks[i]]+";";return djb2(s);}',
  'async function prep(){try{if(document.fonts&&document.fonts.ready)await document.fonts.ready;}catch(e){}',
  'for(var i=0;i<40&&!window.renderMathInElement;i++)await new Promise(function(r){setTimeout(r,50);});',
  'try{if(typeof _hssSetup==="function")_hssSetup();}catch(e){}',
  'await new Promise(function(r){setTimeout(r,150);});}',
].join('\n');

function probe1Expression(times, schedule) {
  return [
    '(async () => {',
    'try{',
    HASH_FNS,
    'const TS = ' + JSON.stringify(times) + ';',
    'const SCHED = ' + JSON.stringify(schedule.map((s) => ({ id: s.id, type: s.type, noEntrance: !!s.noEntrance }))) + ';',
    'await prep();',
    /* Child counts: the emitter alone knows how many wraps a group rendered
       and how many data-anim nodes a chart has — both decide when the LAST
       staggered child stops moving, which is when "rested" becomes testable. */
    'const counts = {}; const missing = [];',
    'for (const e of SCHED) {',
    '  const host = document.getElementById(e.id);',
    '  if (!host) { missing.push(e.id); counts[e.id] = { wraps: 0, animMax: 0 }; continue; }',
    '  if (e.noEntrance) { counts[e.id] = { wraps: 0, animMax: 0 }; continue; }',
    '  let wraps = 0;',
    '  if (e.type === "cards") wraps = host.querySelectorAll(".hss-cardwrap").length;',
    '  else if (e.type === "tiles" || e.type === "pills" || e.type === "card") wraps = host.querySelectorAll(".hss-slot,.hss-cardwrap").length;',
    '  let animMax = 0;',
    '  if (e.type === "chart") {',
    '    const ns = host.querySelectorAll("[data-anim][data-i]");',
    '    for (const n of ns) animMax = Math.max(animMax, Number(n.getAttribute("data-i")) || 0);',
    '  }',
    /* An overlay mark is MOVED INTO its target at setup, so it lives inside
       the target's subtree and its draw phase is part of the target's frame
       hash. The target cannot rest until every mark inside it has finished
       drawing — its ids come back here so the schedule can take the max. */
    '  const foreign = [];',
    '  const fl = host.querySelectorAll(".hss-el[id]");',
    '  for (const n of fl) foreign.push(n.id);',
    '  counts[e.id] = { wraps: wraps, animMax: animMax, foreign: foreign };',
    '}',
    /* Determinism: seek, then hash, synchronously — the page's own RAF loop
       cannot interleave inside one task, so the hash IS the frame at T. */
    'const det = {};',
    'const detParts = {};',
    'for (const T of TS) { onFrame(T); det[String(T)] = frameHash(); detParts[String(T)] = frameParts(); }',
    'return { det, detParts, counts, missing };',
    '} catch (e) { return { error: String(e && e.message || e) }; }',
    '})()',
  ].join('\n');
}

function probe2Expression(times, schedule) {
  return [
    '(async () => {',
    'try{',
    HASH_FNS,
    'const TS = ' + JSON.stringify(times) + ';',
    'const SCHED = ' + JSON.stringify(schedule) + ';',
    'await prep();',
    'const missing = [];',
    /* DETERMINISM FIRST, before this run seeks anywhere else: both rounds
       must hash the same page history (load → prep → seek → hash), or the
       probe itself would be the difference it reports. */
    'const det = {};',
    'const detParts = {};',
    'for (const T of TS) { onFrame(T); det[String(T)] = frameHash(); detParts[String(T)] = frameParts(); }',
    'const motion = [];',
    'for (const e of SCHED) {',
    '  if (e.noEntrance) continue;',
    '  if (!document.getElementById(e.id)) { missing.push(e.id); continue; }',
    '  onFrame(e.tEnter - 1); const pre = hashEl(e.id);',
    '  onFrame(e.tEnter + 1); const post = hashEl(e.id);',
    /* Raw subtrees ride along ONLY when the hashes agree — that failure has
       to name the node that did not move, not just the element. */
    '  motion.push(pre === post ? { id: e.id, pre, post, raw: subtreeOf(e.id) } : { id: e.id, pre, post });',
    '}',
    /* REST: two frames after the last staggered child / meter / chart phase
       has ended must be identical. The window is refused (not guessed) when
       it would run past the scene edge — the scene hides its elements there,
       so a comparison across the edge would be meaningless. */
    'const settle = [];',
    'for (const e of SCHED) {',
    '  if (e.noEntrance || !e.restAt) continue;',
    '  if (!document.getElementById(e.id)) continue;',
    '  if (e.restAt + 95 > e.sceneEnd) { settle.push({ id: e.id, noRest: true, settleEnd: e.restAt, sceneEnd: e.sceneEnd }); continue; }',
    '  const tA = e.restAt + 30; const tB = tA + 60;',
    '  onFrame(tA); const a = hashEl(e.id); const sA = subtreeOf(e.id);',
    '  onFrame(tB); const b = hashEl(e.id);',
    '  settle.push(a !== b ? { id: e.id, a, b, tA, tB, diff: diffSeg(sA, subtreeOf(e.id)) } : { id: e.id, a, b, tA, tB });',
    '}',
    'return { det, detParts, motion, settle, missing };',
    '} catch (e) { return { error: String(e && e.message || e) }; }',
    '})()',
  ].join('\n');
}

/* ── coverage: what the films actually exercise ────────────────────────────
 * Entrance types from the SCHEMA's enum (the authored vocabulary), easing
 * names parsed out of the emitter's own EASE_EXPR table (the one table both
 * the runtime and reel-compile ask — reading it here keeps this report a
 * view of the source, not a fourth list). */
function easeNamesFromSource() {
  const src = fs.readFileSync(EMITTER, 'utf8');
  const m = src.match(/var EASE_EXPR = \{([\s\S]*?)\n  \};/);
  if (!m) return [];
  const names = [];
  /* KEYS only: every candidate must be followed by `:`, or the quoted
     VALUES (the curve expressions) would be read as names and the dead-
     feature list would compare against things that were never vocab. */
  for (const k of m[1].matchAll(/'(?:[^'\\]|\\.)*'(?=\s*:)|(?:^|[\s,])[A-Za-z][A-Za-z0-9-]*(?=\s*:)/g)) {
    const raw = k[0].trim();
    names.push(raw[0] === "'" ? raw.slice(1, -1) : raw);
  }
  return names;
}

function coverageOf(SB, schema) {
  const c = {
    n: 0, noEntrance: 0, types: {}, eases: {}, minEases: {},
    stagger: 0, overshoot: 0, fromScale: 0, fromXY: 0,
    meter: 0, chart: 0, draw: 0, bezier: 0,
  };
  for (const sc of SB.scenes) {
    for (const e of sc.els) {
      c.n++;
      if (!e.in) { c.noEntrance++; continue; }
      c.types[e.in.t || 'fade'] = (c.types[e.in.t || 'fade'] || 0) + 1;
      const ez = e.in.e || '(unauthored)';
      if (ez === '(unauthored)') c.eases[ez] = (c.eases[ez] || 0) + 1;
      else {
        if (ez.indexOf('cubic-bezier') === 0) c.bezier++;
        c.eases[ez] = (c.eases[ez] || 0) + 1;
      }
      if (e.in.o !== undefined) c.overshoot++;
      if (e.in.fs !== undefined) c.fromScale++;
      if (e.in.fx !== undefined || e.in.fy !== undefined) c.fromXY++;
      if (e.st) c.stagger++;
      if (e.min) {
        const mz = e.min.e || '(unauthored)';
        c.minEases[mz] = (c.minEases[mz] || 0) + 1;
        if (e.type === 'chart') c.chart++; else c.meter++;
      }
      if (e.in.t === 'draw') c.draw++;
    }
  }
  const decl = schema && schema.$defs && schema.$defs.entrance &&
    schema.$defs.entrance.properties && schema.$defs.entrance.properties.type;
  c.typeVocab = (decl && decl.enum) || ['fade', 'slide', 'pop', 'slot', 'draw'];
  return c;
}

function tallyLine(map) {
  return Object.keys(map).sort().map((k) => `${k === '(unauthored)' ? 'none' : k} ×${map[k]}`).join('  ');
}

async function runJobs(bin, jobs, width, height) {
  let browser;
  try {
    browser = await launchBrowser(bin, width, height);
  } catch (e) {
    console.error('reel-motion: FAILED — could not start the browser: ' + e.message);
    return 1;
  }

  let failures = 0;
  const pool = { types: {}, eases: {}, stagger: 0, overshoot: 0, fromScale: 0, fromXY: 0, meter: 0, chart: 0, draw: 0, bezier: 0, elements: 0, probed: 0, noEntrance: 0 };

  try {
    for (const job of jobs) {
      const { film, file, clip, mode, SB, schedule, coverage } = job;
      const times = [0.25, 0.5, 0.75].map((f) => Math.floor(clip.dur * 1000 * f));

      /* Two FRESH loads per film: determinism is only proven across runtimes
         that share nothing but the page — memoised nodes, a latched setup
         hook or a captured t0 would all pass a within-page repeat. */
      const runs = [];
      for (let round = 0; round < 2; round++) {
        const target = await browser.cdp.send('Target.createTarget', { url: 'about:blank' });
        const sess = await browser.cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
        const sid = sess.sessionId;
        await browser.cdp.send('Page.enable', {}, sid);
        await browser.cdp.send('Runtime.enable', {}, sid);
        /* Kill the page's own wall-clock loop before the first script runs.
           The standalone page boots `onFrame(performance.now())` on RAF, and
           frames firing during load leave HISTORY-dependent residue on nodes
           a later seek does not rewrite (a shape's stroke before its
           entrance, for one) — history that differs run to run and would be
           measured as impurity that is not the runtime's. With the loop
           frozen the page sits at its markup-initial state until the probe
           seeks, which is exactly "fresh runtime renders frame t". The boot
           call still fires once (loop() is invoked synchronously); only the
           rescheduling is removed. */
        await browser.cdp.send('Page.addScriptToEvaluateOnNewDocument', {
          source: 'window.requestAnimationFrame=function(){return 0;};',
        }, sid);
        await browser.cdp.send('Emulation.setDeviceMetricsOverride', {
          width, height, deviceScaleFactor: 1, mobile: false,
        }, sid);

        const loaded = new Promise((resolve) => {
          const prev = browser.cdp.ws.onmessage;
          browser.cdp.ws.onmessage = (m) => {
            prev(m);
            try {
              const d = JSON.parse(m.data);
              if (d.method === 'Page.loadEventFired' && d.sessionId === sid) resolve();
            } catch (e) { /* not ours */ }
          };
          setTimeout(resolve, 20000);
        });
        await browser.cdp.send('Page.navigate', { url: 'file:///' + file.replace(/\\/g, '/') }, sid);
        await loaded;

        /* Rest is a SUBTREE property: an element cannot be called rested
           while a mark overlaid inside it is still drawing, so restAt is the
           max of its own settle end and every foreign element's — computed
           in two passes over the same schedule, no second browser round. */
        const ownEnds = new Map(schedule.filter((e) => !e.noEntrance).map((e) => [e.id, ownSettleEnd(e)]));
        const expr = round === 0
          ? probe1Expression(times, schedule)
          : probe2Expression(times, schedule.map((e) => withRestTimes(e, ownEnds)));
        const res = await browser.cdp.send('Runtime.evaluate', {
          expression: expr, awaitPromise: true, returnByValue: true,
        }, sid);
        await browser.cdp.send('Target.closeTarget', { targetId: target.targetId });

        const value = res.result && res.result.value;
        if (!value) {
          const d = res.exceptionDetails || {};
          console.log(`\n=== ${film} (${mode}) ===`);
          console.log('  FAIL  the page did not answer: ' + String(((d.exception && d.exception.description) || d.text || 'no value')).split('\n')[0]);
          failures++;
          runs.length = 0;
          break;
        }
        if (value.error) {
          console.log(`\n=== ${film} (${mode}) ===`);
          console.log('  FAIL  probe threw in the page: ' + value.error);
          failures++;
          runs.length = 0;
          break;
        }
        runs.push(value);
        /* Probe 1 found the real child counts in the live DOM; the settle
           schedule for probe 2 is computed from them (a group's last staggered
           child and a chart's last bar decide when rest can even be tested). */
        if (round === 0) {
          for (const e of schedule) {
            const c = (value.counts && value.counts[e.id]) || { wraps: 1, animMax: 0 };
            e._wraps = c.wraps || 1;
            e._animMax = c.animMax || 0;
            e._foreign = c.foreign || [];
          }
        }
      }
      if (runs.length !== 2) continue;

      const [r1, r2] = runs;
      console.log(`\n=== ${film} (${mode}) ===`);

      /* 1 — determinism. */
      const detKeys = Object.keys(r1.det);
      const detDiff = detKeys.filter((t) => r1.det[t] !== r2.det[t]);
      if (detDiff.length) {
        console.log(`  FAIL  determinism: frame hash differs across fresh runs at t=${detDiff.join(',')}ms — onFrame is not a pure function of t`);
        for (const t of detDiff) {
          const p1 = r1.detParts[t] || {}, p2 = r2.detParts[t] || {};
          const keys = Array.from(new Set(Object.keys(p1).concat(Object.keys(p2))));
          const diff = keys.filter((k) => p1[k] !== p2[k]);
          console.log(`    t=${t}ms  ${diff.length} component(s) differ: ${diff.slice(0, 8).map((k) => `${k} ${p1[k]}→${p2[k]}`).join('  ')}`);
        }
        failures++;
      } else {
        console.log(`  determinism   ${detKeys.length} frame hash(es) identical across two fresh runs (${detKeys.map((t) => r1.det[t]).join(' ')})`);
      }

      /* Probe 1 also proves every scheduled element rendered at all. */
      const allMissing = r1.missing.concat(r2.missing);
      if (allMissing.length) {
        console.log(`  FAIL  element(s) in the SB literal have no node on stage: ${Array.from(new Set(allMissing)).join(', ')}`);
        failures++;
      }

      /* 2 — motion occurs. */
      const moved = r2.motion.filter((m) => m.pre !== m.post);
      const frozen = r2.motion.filter((m) => m.pre === m.post);
      const noEntrance = schedule.filter((s) => s.noEntrance);
      if (frozen.length) {
        console.log(`  FAIL  motion: ${frozen.length} entrance(s) hash identical at t_enter−1 and t_enter+1 (nothing moves):`);
        for (const f of frozen.slice(0, 12)) {
          console.log(`    - ${f.id}`);
          /* Frozen means both hashes matched, so there is no diff to show —
             print the subtree that WAS there, which is how a reader sees the
             missing children or the untouched node at a glance. */
          if (f.raw) console.log(`        ${f.raw.split(';').filter(Boolean).slice(0, 6).join('  ')}`);
        }
        if (frozen.length > 12) console.log(`    … and ${frozen.length - 12} more`);
        failures++;
      } else if (r2.motion.length) {
        console.log(`  motion        ${moved.length}/${r2.motion.length} elements with an entrance moved at t_enter±1ms`);
      } else {
        console.log('  FAIL  motion: no element has an entrance — an empty result is not a pass');
        failures++;
      }
      if (noEntrance.length) {
        console.log(`  NOTE          ${noEntrance.length} element(s) author no entrance (they stay at the emitter's hidden pre-state): ${noEntrance.map((s) => s.id).join(', ')}`);
      }

      /* 2b — it stopped. */
      const rested = r2.settle.filter((s) => !s.noRest && s.a === s.b);
      const stillMoving = r2.settle.filter((s) => !s.noRest && s.a !== s.b);
      const noWindow = r2.settle.filter((s) => s.noRest);
      if (stillMoving.length) {
        console.log(`  FAIL  rest: ${stillMoving.length} element(s) still change inside the rest window:`);
        for (const s of stillMoving.slice(0, 12)) {
          console.log(`    - ${s.id}`);
          if (s.diff) for (const d of s.diff) console.log(`        ${d}`);
        }
        failures++;
      }
      if (noWindow.length) {
        console.log(`  FAIL  rest: ${noWindow.length} element(s) would only settle at/after their scene edge (no rest window on screen):`);
        for (const s of noWindow.slice(0, 8)) console.log(`    - ${s.id}  settles ${s.settleEnd}ms, scene ends ${s.sceneEnd}ms`);
        failures++;
      }
      if (!stillMoving.length && !noWindow.length && r2.settle.length) {
        console.log(`  rest          ${r2.settle.length}/${r2.settle.length} elements settled and stayed settled`);
      }

      /* 3 — coverage (informational). */
      console.log(`  coverage      ${coverage.n} elements · entrances: ${tallyLine(coverage.types)}`);
      console.log(`                eases: ${tallyLine(coverage.eases)}` +
        (coverage.bezier ? ` (${coverage.bezier} cubic-bezier)` : '') +
        (coverage.minEases && Object.keys(coverage.minEases).length ? ` · meter/chart curves: ${tallyLine(coverage.minEases)}` : ''));
      console.log(`                stagger ×${coverage.stagger} · overshoot ×${coverage.overshoot} · from_scale ×${coverage.fromScale} · from_x/y ×${coverage.fromXY}` +
        ` · meter ×${coverage.meter} · chart ×${coverage.chart} · draw ×${coverage.draw}`);

      pool.elements += coverage.n;
      pool.probed += r2.motion.length;
      pool.noEntrance += coverage.noEntrance;
      for (const [k, v] of Object.entries(coverage.types)) pool.types[k] = (pool.types[k] || 0) + v;
      for (const [k, v] of Object.entries(coverage.eases)) pool.eases[k] = (pool.eases[k] || 0) + v;
      pool.stagger += coverage.stagger;
      pool.overshoot += coverage.overshoot;
      pool.fromScale += coverage.fromScale;
      pool.fromXY += coverage.fromXY;
      pool.meter += coverage.meter;
      pool.chart += coverage.chart;
      pool.draw += coverage.draw;
      pool.bezier += coverage.bezier;
    }
  } finally {
    browser.close();
  }

  /* The pooled report: what the vocabulary offers, what ships, what is
     authored by nobody. Dead features are listed, never failed — a curve no
     film uses yet is a choice, a curve nobody CAN use would be caught by the
     regression's emitterSupportsEase probes. */
  if (jobs.length) {
    const typeVocab = jobs[0].coverage.typeVocab;
    const deadTypes = typeVocab.filter((t) => !pool.types[t]);
    const easeVocab = easeNamesFromSource();
    const deadEases = easeVocab.filter((n) => !pool.eases[n]);
    console.log('\n=== vocabulary coverage (all films) ===');
    console.log(`  entrances     in use: ${Object.keys(pool.types).sort().join(', ') || 'none'}` +
      (deadTypes.length ? ` · NEVER AUTHORED: ${deadTypes.join(', ')}` : ' · every schema entrance type is exercised'));
    console.log(`  eases         in use: ${Object.keys(pool.eases).filter((k) => k !== '(unauthored)').sort().join(', ') || 'none'}` +
      ` · unauthored ×${pool.eases['(unauthored)'] || 0}`);
    console.log(`                NEVER AUTHORED (${deadEases.length}/${easeVocab.length}): ${deadEases.join(', ')}`);
    console.log(`  phases        meter ×${pool.meter} · chart ×${pool.chart} · draw ×${pool.draw} · stagger ×${pool.stagger} · overshoot ×${pool.overshoot} · from_scale ×${pool.fromScale}`);
    console.log(`  exits / ambient / keyframes: no vocabulary shipped yet (P1/P4/P5) — this report grows with them`);
    console.log(`  elements      ${pool.probed}/${pool.elements} with an entrance probed` +
      (pool.noEntrance ? `, ${pool.noEntrance} authoring none` : ''));
  }

  console.log('');
  if (failures) {
    console.error(`reel-motion: FAILED (${failures}) — the films compile, but they do not move as contracted.`);
    return 1;
  }
  console.log('reel-motion: OK — onFrame is pure across fresh runs, every entrance moves, every element rests.');
  return 0;
}

function ownSettleEnd(e) {
  const groupEnd = e.tEnd + (e.group ? Math.max(0, (e._wraps || 1) - 1) * e.st : 0);
  const chartEnd = e.chartBase != null ? e.chartBase + (e._animMax || 0) * e.st : null;
  return Math.max(groupEnd, e.meterEnd || 0, chartEnd || 0);
}

function withRestTimes(e, ownEnds) {
  if (e.noEntrance) return e;
  const settleEnd = ownEnds.get(e.id) || e.tEnd;
  let restAt = settleEnd;
  for (const f of e._foreign || []) restAt = Math.max(restAt, ownEnds.get(f) || 0);
  return Object.assign({}, e, { settleEnd, restAt });
}

async function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'light';
  const width = argv.includes('--width') ? parseInt(argv[argv.indexOf('--width') + 1], 10) : DEFAULT_W;
  const height = argv.includes('--height') ? parseInt(argv[argv.indexOf('--height') + 1], 10) : DEFAULT_H;

  const bin = findBrowser();
  if (!bin) {
    console.error('reel-motion: FAILED — no Chrome/Chromium/Edge found.');
    console.error('  Set CHROME_PATH, or install one of:');
    console.error('    C:/Program Files/Google/Chrome/Application/chrome.exe');
    console.error('    /Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    console.error('    /usr/bin/google-chrome');
    return 1;
  }

  const emitter = loadEmitter();
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'storyboard.schema.json'), 'utf8'));
  const filmsDir = path.join(__dirname, 'films');
  const films = fs.readdirSync(filmsDir)
    .filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));
  if (!films.length) {
    console.error('reel-motion: no film with a storyboard.json found');
    return 2;
  }

  /* Resolve the timeline through reel-compile's own reconciler — a second
     timeline model here would drift, and a motion gate probing times the
     build never uses proves nothing. */
  const { resolveMode, reconcile, attachUtilities } = require('./reel-compile.cjs').__test;

  const jobs = [];
  for (const film of films) {
    const dir = path.join(filmsDir, film);
    const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
    const resolved = resolveMode(sb, mode);
    if (resolved.error) { console.error(`\n=== ${film} ===\n  ${resolved.error}`); return 1; }
    const { top } = reconcile(sb, resolved.design, mode);
    /* Build-time utilities are attached BEFORE the page is cloned, so the
       page this gate probes carries the same stylesheet the file will
       always ship (plan §2). No candidates → no block → nothing moves. */
    await attachUtilities(top);
    const page = emitter.buildStandalonePage(JSON.parse(JSON.stringify(top)));
    const clip = emitter.compileStoryboard(JSON.parse(JSON.stringify(top)));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reel-motion-')), 'reel.html');
    fs.writeFileSync(file, page);
    const SB = parseSB(clip.js);
    jobs.push({
      film, file, clip, mode: resolved.modes && resolved.modes.length ? mode : null,
      SB, schedule: buildSchedule(SB), coverage: coverageOf(SB, schema),
    });
  }

  return runJobs(bin, jobs, width, height);
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code || 0),
    (err) => { console.error('reel-motion: FAILED — ' + (err && err.message)); process.exit(1); }
  );
}

module.exports = { parseSB, buildSchedule, coverageOf, withRestTimes };
