/**
 * WAAPI → HTML-in-Canvas adapter  (classic script, no bundler required)
 * ────────────────────────────────────────────────────────────────────────
 * Bridges CSS `@keyframes` animations onto HIC's deterministic `onFrame(t)`.
 *
 * Why this is a *compiler*, not a seeker
 * -------------------------------------
 * HIC does not render the sandbox DOM directly. Every frame it clones the
 * sandbox, serialises it into an SVG `foreignObject`, rasterises that through
 * an `<img>`, and draws the result to a canvas. Three consequences:
 *
 *   1. The clip's CSS is never applied to the live sandbox — it is injected as
 *      a `<style>` *inside the SVG string only*. So `document.getAnimations()`
 *      on the sandbox is always empty and the Web Animations API cannot be used
 *      to position an animation (the old adapter's approach).
 *   2. Inside the SVG raster the stylesheet runs on its own throwaway timeline,
 *      so a CSS animation there is not seekable either.
 *   3. Inline styles DO serialise. An inline value written by `onFrame` is
 *      exactly what the raster sees, at every frame, in preview and in export.
 *
 * So this adapter parses `@keyframes` + `animation:` out of the clip CSS and
 * emits a small `onFrame(timeMs)` that computes the interpolated values itself
 * and writes them as inline styles. The `animation:` shorthand and the
 * `@keyframes` blocks are stripped from the CSS that ships to the raster, so the
 * frozen/relaunched CSS animation can never override the inline values.
 *
 * Public surface
 * --------------
 *   WAAPIAdapter.hasKeyframes(css)                 -> boolean
 *   WAAPIAdapter.hasOnFrame(js)                    -> boolean
 *   WAAPIAdapter.compileKeyframes(css, fps)        -> { css, js, animations }
 *   WAAPIAdapter.generateWAAPIAdapter(fps, css)    -> string (the onFrame only)
 *   WAAPIAdapter.wrapWithWAAPI(js, fps, css)       -> string (adapter, or the
 *                                                     clip's own onFrame if it
 *                                                     already defines one)
 *
 * Supported animation features (the subset the presets use, plus the common
 * easing/rgba cases): `from`/`to`/`n%` keyframes; opacity/transform/width/height
 * and any numeric-with-unit property; `translateX/Y`, `scale`, `rotate`;
 * `var(--x[, fallback])` in values and delays; `calc(a + b)` delays; keywords
 * and `cubic-bezier()`/`steps()` easing; `both` fill; infinite iteration.
 */
(function (root) {
    'use strict';

    // ── CSS text helpers ────────────────────────────────────────────────────

    var ANIM_PROPS = [
        'animation', 'animation-name', 'animation-duration', 'animation-delay',
        'animation-timing-function', 'animation-iteration-count',
        'animation-direction', 'animation-fill-mode', 'animation-play-state'
    ];

    var EASE_KEYWORDS = {
        'linear': 'linear',
        'ease': 'cubic-bezier(.25,.1,.25,1)',
        'ease-in': 'cubic-bezier(.42,0,1,1)',
        'ease-out': 'cubic-bezier(0,0,.58,1)',
        'ease-in-out': 'cubic-bezier(.42,0,.58,1)'
    };

    var FILL_KEYWORDS = { none: 1, forwards: 1, backwards: 1, both: 1 };
    var DIR_KEYWORDS = { normal: 1, reverse: 1, alternate: 1, 'alternate-reverse': 1 };

    function stripComments(css) {
        return String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
    }

    /** Split a stylesheet into top-level rules, brace-aware. */
    function splitRules(css) {
        var out = [], i = 0, n = css.length;
        while (i < n) {
            var at = css.indexOf('{', i);
            if (at < 0) { break; }
            var depth = 1, j = at + 1;
            while (j < n && depth > 0) {
                var ch = css[j];
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
                if (depth === 0) break;
                j++;
            }
            out.push({ prelude: css.slice(i, at).trim(), body: css.slice(at + 1, j) });
            i = j + 1;
        }
        return out;
    }

    function parseDecls(text) {
        var out = {};
        String(text || '').split(';').forEach(function (d) {
            var k = d.indexOf(':');
            if (k < 0) return;
            var name = d.slice(0, k).trim().toLowerCase();
            var val = d.slice(k + 1).trim();
            if (name && val) out[name] = val;
        });
        return out;
    }

    function declsToString(decls) {
        return Object.keys(decls).map(function (k) { return k + ':' + decls[k]; }).join(';');
    }

    /** Split a value on top-level commas (ignores commas inside functions). */
    function splitTopLevel(value, sep) {
        var out = [], cur = '', depth = 0;
        for (var i = 0; i < value.length; i++) {
            var ch = value[i];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (ch === sep && depth === 0) { out.push(cur); cur = ''; }
            else cur += ch;
        }
        if (cur !== '') out.push(cur);
        return out;
    }

    function splitTokens(value) {
        var out = [], cur = '', depth = 0;
        for (var i = 0; i < value.length; i++) {
            var ch = value[i];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (/\s/.test(ch) && depth === 0) { if (cur) { out.push(cur); cur = ''; } }
            else cur += ch;
        }
        if (cur) out.push(cur);
        return out;
    }

    function offsetOf(sel) {
        sel = sel.trim();
        if (sel === 'from') return 0;
        if (sel === 'to') return 100;
        var m = sel.match(/^([\d.]+)%$/);
        return m ? parseFloat(m[1]) : null;
    }

    function parseTimeToken(tok) {
        var m = String(tok || '').match(/^(-?[\d.]+)(m?s)$/);
        if (!m) return null;
        return parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1);
    }

    function isTimeExpr(tok) {
        return /^(var|calc|env|min|max|clamp)\(/.test(tok);
    }

    // ── @keyframes ──────────────────────────────────────────────────────────

    function parseKeyframes(body) {
        var steps = [], i = 0, n = body.length;
        while (i < n) {
            var at = body.indexOf('{', i);
            if (at < 0) break;
            var sel = body.slice(i, at).trim();
            var depth = 1, j = at + 1;
            while (j < n && depth > 0) {
                var ch = body[j];
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
                if (depth === 0) break;
                j++;
            }
            var decls = parseDecls(body.slice(at + 1, j));
            var offsets = splitTopLevel(sel, ',').map(offsetOf).filter(function (o) { return o !== null; });
            if (offsets.length && Object.keys(decls).length) {
                steps.push({ offsets: offsets.map(function (o) { return o / 100; }), decls: decls });
            }
            i = j + 1;
        }
        steps.sort(function (a, b) { return a.offsets[0] - b.offsets[0]; });
        return steps;
    }

    /** Flatten [{offsets:[...], decls}] into [{o, d}] sorted by offset. */
    function flattenSteps(steps) {
        var flat = [];
        steps.forEach(function (s) {
            s.offsets.forEach(function (o) { flat.push({ o: o, d: s.decls }); });
        });
        flat.sort(function (a, b) { return a.o - b.o; });
        return flat;
    }

    // ── `animation:` shorthand ──────────────────────────────────────────────

    function parseAnimationLayer(value) {
        var spec = {
            name: null, duration: null, delay: null,
            ease: null, iterations: 1, fill: null, direction: 'normal'
        };
        splitTokens(value).forEach(function (tok) {
            var t = tok.trim();
            if (!t) return;
            var time = parseTimeToken(t);
            if (time !== null) {
                if (spec.duration === null) spec.duration = time;
                else if (spec.delay === null) spec.delay = time;
                return;
            }
            if (t === 'infinite') { spec.iterations = -1; return; }
            if (/^[\d.]+$/.test(t) && spec.iterations !== -1) { spec.iterations = parseFloat(t); return; }
            if (FILL_KEYWORDS[t]) { spec.fill = t; return; }
            if (DIR_KEYWORDS[t]) { spec.direction = t; return; }
            if (EASE_KEYWORDS[t] || /^(cubic-bezier|steps|linear)\(/.test(t)) { spec.ease = t; return; }
            if (isTimeExpr(t)) {
                if (spec.duration === null) spec.duration = t;
                else if (spec.delay === null) spec.delay = t;
                return;
            }
            if (spec.name === null && t !== 'none') spec.name = t;
        });
        return spec;
    }

    // ── Compile ─────────────────────────────────────────────────────────────

    function compileKeyframes(css, fps) {
        css = stripComments(css);
        var rules = splitRules(css);
        var frames = {};          // name -> flat steps
        var usedNames = {};
        var animations = [];

        rules.forEach(function (rule) {
            var m = rule.prelude.match(/^@(-webkit-)?keyframes\s+([\w-]+)$/i);
            if (m) {
                var steps = parseKeyframes(rule.body);
                if (steps.length) frames[m[2]] = flattenSteps(steps);
                return;
            }
            if (rule.prelude.charAt(0) === '@') return;      // @media/@font-face pass through
            var decls = parseDecls(rule.body);
            if (!decls.animation && !decls['animation-name']) return;

            splitTopLevel(decls.animation || '', ',').forEach(function (layer) {
                var spec = parseAnimationLayer(layer);
                if (!spec.name || !frames[spec.name]) return;
                usedNames[spec.name] = 1;
                animations.push({
                    sel: rule.prelude,
                    dur: typeof spec.duration === 'number' ? spec.duration : 0,
                    delay: spec.delay,
                    ease: spec.ease || 'ease',
                    iter: spec.iterations,
                    fill: spec.fill || 'none',
                    direction: spec.direction,
                    steps: frames[spec.name]
                });
            });
        });

        if (!animations.length) return { css: css, js: '', animations: [] };

        // Rebuild the stylesheet without the keyframes we compiled and without
        // the `animation:` declarations that drove them (the inline values the
        // onFrame writes would otherwise lose the cascade to a running animation).
        var out = [];
        rules.forEach(function (rule) {
            var m = rule.prelude.match(/^@(-webkit-)?keyframes\s+([\w-]+)$/i);
            if (m && usedNames[m[2]]) return;
            if (rule.prelude.charAt(0) === '@') { out.push(rule.prelude + '{' + rule.body + '}'); return; }
            var decls = parseDecls(rule.body);
            var touched = false;
            ANIM_PROPS.forEach(function (p) { if (decls[p] !== undefined) { delete decls[p]; touched = true; } });
            if (rule.prelude && Object.keys(decls).length) out.push(rule.prelude + '{' + declsToString(decls) + '}');
            else if (rule.prelude && !touched) out.push(rule.prelude + '{' + rule.body + '}');
        });

        return { css: out.join('\n'), js: generateWAAPIAdapter(fps, animations), animations: animations };
    }

    // ── Emitted runtime ─────────────────────────────────────────────────────

    var RUNTIME = [
        '(function(){',
        "  'use strict';",
        '  var SPECS = __SPECS__;',
        '  function cubic(x1,y1,x2,y2){',
        '    function A(a,b){return 1-3*b+3*a} function B(a,b){return 3*b-6*a} function C(a){return 3*a}',
        '    function calc(t,a,b){return ((A(a,b)*t+B(a,b))*t+C(a))*t}',
        '    function slope(t,a,b){return 3*A(a,b)*t*t+2*B(a,b)*t+C(a)}',
        '    return function(x){',
        '      if(x<=0)return 0; if(x>=1)return 1;',
        '      var lo=0,hi=1,t=x;',
        '      for(var i=0;i<24;i++){ var cx=calc(t,x1,x2); if(Math.abs(cx-x)<1e-5)break; if(cx<x)lo=t; else hi=t; t=(lo+hi)/2; }',
        '      return calc(t,y1,y2);',
        '    };',
        '  }',
        '  function easeFn(e){',
        '    e=String(e||"ease").trim();',
        '    var cb=e.match(/^cubic-bezier\\(([^)]*)\\)$/);',
        '    if(cb){ var p=cb[1].split(",").map(Number); return cubic(p[0]||0,p[1]||0,p[2]||0,p[3]||0); }',
        '    var st=e.match(/^steps\\(\\s*(\\d+)\\s*(?:,\\s*([\\w-]+)\\s*)?\\)$/);',
        '    if(st){ var n=parseInt(st[1],10)||1, jump=st[2]||"end";',
        '      return function(t){ t=Math.min(1,Math.max(0,t));',
        '        if(jump==="start")return Math.min(1,Math.ceil(t*n)/n);',
        '        if(jump==="both")return (Math.min(n-1,Math.floor(t*n))+1)/n;',
        '        return Math.min(1,Math.ceil(t*n)/n); }; }',
        '    if(e==="linear")return function(t){return Math.min(1,Math.max(0,t))};',
        '    var kw={"ease":[.25,.1,.25,1],"ease-in":[.42,0,1,1],"ease-out":[0,0,.58,1],"ease-in-out":[.42,0,.58,1]}[e]||[.25,.1,.25,1];',
        '    return cubic(kw[0],kw[1],kw[2],kw[3]);',
        '  }',
        '  function resolveVars(v,el){',
        '    return String(v).replace(/var\\(\\s*(--[\\w-]+)\\s*(?:,\\s*([^)]*))?\\)/g,function(m,name,fb){',
        '      var cv=""; try{ cv=getComputedStyle(el).getPropertyValue(name); }catch(e){}',
        '      cv=(cv||"").trim(); return cv || (fb!=null?String(fb).trim():"");',
        '    });',
        '  }',
        '  function toMs(s){ var m=String(s).match(/^(-?[\\d.]+)(m?s)$/); return m?parseFloat(m[1])*(m[2]==="s"?1000:1):null; }',
        '  function resolveDelay(expr,el){',
        '    if(expr==null)return 0;',
        '    if(typeof expr==="number")return expr;',
        '    var s=resolveVars(expr,el).trim(); if(!s)return 0;',
        '    var c=s.match(/^calc\\((.*)\\)$/is);',
        '    if(c){ var sum=0; c[1].split("+").forEach(function(p){ var v=toMs(p.trim()); if(v!=null)sum+=v; }); return sum; }',
        '    var v=toMs(s); return v==null?0:v;',
        '  }',
        '  function num(v){ var m=String(v).trim().match(/^(-?[\\d.]+)([a-z%]*)$/i); return m?{n:parseFloat(m[1]),u:m[2]}:null; }',
        '  function fmt(n){ return (Math.round(n*1000)/1000)+""; }',
        '  function transformMap(v){',
        '    var re=/([a-zA-Z]+)\\(([^)]*)\\)/g, out=[], m;',
        '    while((m=re.exec(String(v)))) out.push({fn:m[1],args:m[2].split(",").map(function(a){return a.trim();})});',
        '    return out.length?out:null;',
        '  }',
        '  var IDENT={translateX:"0",translateY:"0",translate:"0",scale:"1",rotate:"0deg",skewX:"0deg",skewY:"0deg"};',
        '  function interpTransform(a,b,e){',
        '    var ma=transformMap(a), mb=transformMap(b);',
        '    if(!ma||!mb)return e<1?a:b;',
        '    var order=[], seen={};',
        '    ma.concat(mb).forEach(function(t){ if(!seen[t.fn]){seen[t.fn]=1; order.push(t.fn);} });',
        '    var pick=function(list,fn){ for(var i=0;i<list.length;i++) if(list[i].fn===fn) return list[i].args; return null; };',
        '    return order.map(function(fn){',
        '      var aa=pick(ma,fn), ab=pick(mb,fn);',
        '      var n=Math.max(aa?aa.length:0, ab?ab.length:0); var args=[];',
        '      for(var i=0;i<n;i++){',
        '        var va=(aa&&aa[i]!=null)?aa[i]:(IDENT[fn]||"0"), vb=(ab&&ab[i]!=null)?ab[i]:(IDENT[fn]||"0");',
        '        var na=num(va), nb=num(vb);',
        '        if(na&&nb) args.push(fmt(na.n+(nb.n-na.n)*e)+(nb.u||na.u));',
        '        else args.push(e<1?va:vb);',
        '      }',
        '      return fn+"("+args.join(",")+")";',
        '    }).join(" ");',
        '  }',
        '  function interpVal(a,b,e){',
        '    a=String(a); b=String(b);',
        '    if(a===b)return a;',
        '    var na=num(a), nb=num(b);',
        '    if(na&&nb)return fmt(na.n+(nb.n-na.n)*e)+(nb.u||na.u);',
        '    var ta=transformMap(a), tb=transformMap(b);',
        '    if(ta&&tb&&ta[0]&&tb[0]&&/[a-zA-Z]+\\(/.test(a)&&/[a-zA-Z]+\\(/.test(b)&&!/^[a-z-]+:[^)]*$/.test(a))return interpTransform(a,b,e);',
        '    return e<1?a:b;',
        '  }',
        '  function applyDecls(el,a,b,e){',
        '    var keys={}, k;',
        '    for(k in a)keys[k]=1; for(k in b)keys[k]=1;',
        '    for(k in keys){',
        '      var va=resolveVars((a&&a[k]!=null)?a[k]:b[k],el);',
        '      var vb=resolveVars((b&&b[k]!=null)?b[k]:a[k],el);',
        '      try{ el.style.setProperty(k, interpVal(va,vb,e)); }catch(err){}',
        '    }',
        '  }',
        '  function progressAt(sp,delay,t){',
        '    var dur=sp.dur; if(!(dur>0))return 0;',
        '    var lt=t-delay;',
        '    if(sp.iter<0){',
        '      if(lt<0&&!(sp.fill==="backwards"||sp.fill==="both"))return -1;',
        '      return (((lt%dur)+dur)%dur)/dur;',
        '    }',
        '    var total=dur*sp.iter;',
        '    if(lt<0){ return (sp.fill==="backwards"||sp.fill==="both")?0:-1; }',
        '    if(lt>=total){ return (sp.fill==="forwards"||sp.fill==="both")?1:-1; }',
        '    return (lt%dur)/dur;',
        '  }',
        '  function sample(steps,p){',
        '    if(p<=steps[0].o)return {d:steps[0].d};',
        '    var last=steps[steps.length-1];',
        '    if(p>=last.o)return {d:last.d};',
        '    for(var i=0;i<steps.length-1;i++){',
        '      var a=steps[i], b=steps[i+1];',
        '      if(p>=a.o&&p<=b.o){ var span=b.o-a.o; return {a:a.d,b:b.d,local:span>0?(p-a.o)/span:0}; }',
        '    }',
        '    return {d:last.d};',
        '  }',
        '  function run(sp,t,idx){',
        '    var els;',
        '    try{ els=document.querySelectorAll(sp.sel); }catch(e){ return; }',
        '    for(var n=0;n<els.length;n++){',
        '      var el=els[n];',
        '      if(!el.__waDelay)el.__waDelay=[];',
        '      if(el.__waDelay[idx]==null)el.__waDelay[idx]=resolveDelay(sp.delay,el);',
        '      var p=progressAt(sp,el.__waDelay[idx],t);',
        '      if(p<0)continue;',
        '      var s=sample(sp.steps,p);',
        '      if(s.a!==undefined){',
        '        var e=sp._ease||(sp._ease=easeFn(sp.ease));',
        '        applyDecls(el,s.a,s.b,e(s.local));',
        '      } else applyDecls(el,s.d,s.d,0);',
        '    }',
        '  }',
        '  window.__hicWaapiApply=function(timeMs){',
        '    for(var i=0;i<SPECS.length;i++){',
        '      try{ run(SPECS[i],timeMs,i); }catch(e){}',
        '    }',
        '  };',
        '  window.onFrame=window.__hicWaapiApply;',
        '})();'
    ].join('\n');

    function generateWAAPIAdapter(fps, animations) {
        if (Array.isArray(animations)) {
            if (!animations.length) return '';
            // `_ease` is a runtime cache slot; JSON drops it on load, which is fine.
            return RUNTIME.replace('__SPECS__', JSON.stringify(animations.map(function (a) {
                return {
                    sel: a.sel, dur: a.dur, delay: a.delay, ease: a.ease,
                    iter: a.iter, fill: a.fill, direction: a.direction, steps: a.steps
                };
            })));
        }
        return '';
    }

    // ── Compatibility surface ───────────────────────────────────────────────

    function hasKeyframes(css) {
        return /@(-webkit-)?keyframes\s+[\w-]/.test(String(css || ''));
    }

    function hasOnFrame(js) {
        return /function\s+onFrame\s*\(|onFrame\s*=\s*function/.test(String(js || ''));
    }

    /**
     * Return a clip JS string that drives the CSS animations deterministically.
     * A clip that already defines its own `onFrame` is left alone — the author's
     * function is already deterministic and wins.
     */
    function wrapWithWAAPI(existingJs, fps, css) {
        if (hasOnFrame(existingJs)) return existingJs || '';
        var compiled = compileKeyframes(css, fps || 30);
        return compiled.js || (existingJs || '');
    }

    root.WAAPIAdapter = {
        hasKeyframes: hasKeyframes,
        hasOnFrame: hasOnFrame,
        compileKeyframes: compileKeyframes,
        generateWAAPIAdapter: generateWAAPIAdapter,
        wrapWithWAAPI: wrapWithWAAPI
    };
})(typeof window !== 'undefined' ? window : globalThis);
