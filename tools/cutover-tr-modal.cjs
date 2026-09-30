#!/usr/bin/env node
/* Cutover test-renderer.html onto the shared hic-modal component.
 *
 * Deletions:
 *  - modal CSS: lines 48..357 region (.modal-overlay .. end of AI-panel CSS),
 *    kept: page/base CSS before 48 and the .hic-dark theme block (190..208)
 *  - modal markup: <div class="modal-overlay" ..> .. </div> before presetGrid
 *  - modal JS: from the "CARD GRID" consts that reference modal elements
 *    through the end of the WebM export block, EXCEPT:
 *      * prettifiers (kept verbatim)
 *      * AI_PROMPTS + aiBuildPrompt + aiParseReply (kept verbatim)
 *      * deep-link handlers (repointed at modalApi)
 * Replacements at script end: createHicModal wiring + openModal/closeModal/
 * openCustomModal/handleAiWantHash adapters.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'docs', 'html-in-canvas', 'test-renderer.html');
let src = fs.readFileSync(file, 'utf8');
const LF = src.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const lines = src.split(LF);
const N = lines.length;
console.log('lines:', N, 'EOL:', JSON.stringify(LF));

function find(pred, from) {
    for (let i = from || 0; i < N; i++) if (pred(lines[i])) return i;
    return -1;
}
function fail(what) { console.error('ANCHOR NOT FOUND: ' + what); process.exit(1); }

/* ── 1. CSS surgery ─────────────────────────────────────────────── */
/* 1a. delete .modal-overlay .. line before .cm-s-hic-dark.CodeMirror */
const cssA0 = find(l => l.trim().startsWith('.modal-overlay{'));
if (cssA0 < 0) fail('.modal-overlay CSS');
const cssA1 = find(l => l.includes('.cm-s-hic-dark.CodeMirror'));
if (cssA1 < 0 || cssA1 <= cssA0) fail('.cm-s-hic-dark CSS');

/* 1b. delete modal CSS part 2: after the theme block .. (before body/scrollbar rules) */
const cssB0 = find(l => l.trim().startsWith('.modal{'), cssA1);
if (cssB0 < 0) fail('.modal{ CSS part 2');
/* end at .card-grid / #presetGrid or any later non-modal rule; anchor: `.grid{` or `/* ═` section end */
const cssB1 = find(l => l.includes('#presetGrid') && l.includes('{'), cssB0);
const cssEnd = cssB1 >= 0 ? cssB1 : cssB0 + 1; // exclusive: keep #presetGrid rule if present

/* ── 2. markup surgery ──────────────────────────────────────────── */
const mu0 = find(l => l.includes('<div class="modal-overlay" id="modalOverlay">'));
if (mu0 < 0) fail('modal markup start');
const mu1 = find(l => l.trim().startsWith('<script'), mu0); // first script tag after the modal
if (mu1 < 0) fail('script after modal markup');

/* ── 3. JS surgery (line ranges, inclusive) ─────────────────────── */
const jsStart = find(l => l.includes('const modalOverlay = document.getElementById')); // 733
if (jsStart < 0) fail('JS modal consts start');
const jsTransportEnd = find(l => l.trim().startsWith('async function tickModal')); // 981
if (jsTransportEnd < 0) fail('tickModal');
const pretStart = find(l => l.includes('* Code Prettifiers'), jsTransportEnd); // 1014 comment line
if (pretStart < 0) fail('prettifiers');
const pretStartAdj = pretStart - 1; // include the ══ comment opener
const aiPromptsStart = find(l => l.includes('const AI_PROMPTS')); // 1655
if (aiPromptsStart < 0) fail('AI_PROMPTS');
const aiParseEnd = find(l => l.trim() === '}' && lines[l_prevIdx(aiPromptsStart)] !== undefined && false); // placeholder, computed below
function l_prevIdx(i) { return i - 1; }
/* end of aiParseReply: find the "const aiWant = document" line, aiParseReply ends just before */
const aiWantLine = find(l => l.includes("const aiWant = document.getElementById('aiWant')"));
if (aiWantLine < 0) fail('aiWant const');
const aiParseReplyEnd = aiWantLine - 2; // skip the blank line before it
/* exports block ends at the WebM block end (before </script>) */
const webmStart = find(l => l.includes('WEBM EXPORT — MediaRecorder API'));
if (webmStart < 0) fail('webm block');
let scriptEnd = -1;
for (let i = N - 1; i >= 0; i--) if (lines[i].trim() === '</script>') { scriptEnd = i; break; }
if (scriptEnd < 0) fail('</script>');
const webmEnd = scriptEnd - 1; // last JS line before </script>
/* gallery block: delete fully */
const galStart = find(l => l.includes('* SNIPPET GALLERY'));
if (galStart < 0) fail('gallery');
const galStartAdj = galStart - 1; // ══ opener
const galEnd = aiPromptsStart - 2; // gallery ends right before the AI section comment (one blank line between)

/* sanity log */
console.log({
    cssA: [cssA0, cssA1], cssB: [cssB0, cssEnd], markup: [mu0, mu1],
    jsA: [jsStart, jsTransportEnd], pret: [pretStartAdj, aiPromptsStart - 2],
    aiKeep: [aiPromptsStart, aiParseReplyEnd], gallery: [galStartAdj, galEnd],
    exports: [find(l => l.includes('* EXPORT CONTROLS')), webmEnd], scriptEnd
});

/* ── 4. build replacement JS ────────────────────────────────────── */
const modJs = read('tr-modal-wiring.js').replace(/\n/g, LF).split(LF);

/* ── 5. splice ──────────────────────────────────────────────────── */
/* Process from the bottom up so indices stay valid. */
const edits = [
    /* [startInclusive, endExclusive, replacementLines] */
    [webmStart - 1, webmEnd + 1, ['/* WebM/frame exports now live in hic-modal.js (wall-clock engine). */']],
    [find(l => l.includes('* EXPORT CONTROLS')) - 1, aiPromptsStart, []], /* res selector + export controls + gallery: fully deleted */
    [galStartAdj, aiPromptsStart - 1, []],
    [aiParseReplyEnd + 1, aiWantLine, ['const aiWant = document.getElementById(\'aiWant\');']],
    [jsTransportEnd, pretStartAdj, []],
    [jsStart, pretStartAdj, []],
    [mu0, mu1, ['<div id="hicModalMount"></div>', '']],
    [cssB0, cssEnd, []],
    [cssA0, cssA1, []],
];
function read(p) { return fs.readFileSync(path.join(__dirname, p), 'utf8').replace(/\r\n/g, '\n'); }
/* add hic-modal.js script tag after hic-frame.js */
const frameScriptLine = find(l => l.includes('<script src="hic-frame.js">'));
if (frameScriptLine < 0) fail('hic-frame script tag');
edits.push([frameScriptLine + 1, frameScriptLine + 1, ['<script src="hic-modal.js"></script>']]);

edits.sort((a, b) => b[0] - a[0]);
let out = lines.slice();
for (const [s, e, rep] of edits) {
    if (e < s) { console.error('bad range', { s, e }); process.exit(1); }
    out.splice(s, e - s, ...rep);
}
/* wiring goes at the very end of the script (before </script>) */
const endIdx = out.findIndex(l => l.trim() === '</script>' && out.indexOf(l) > 0);
/* find LAST </script> */
let lastScript = -1;
for (let i = out.length - 1; i >= 0; i--) if (out[i].trim() === '</script>') { lastScript = i; break; }
out.splice(lastScript, 0, ...modJs);

fs.writeFileSync(file, out.join(LF));
console.log('written. new line count:', out.length);
