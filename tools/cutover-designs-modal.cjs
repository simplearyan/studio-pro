#!/usr/bin/env node
/* Cutover designs.html onto the shared hic-modal component.
 * - Replaces the inline modal markup (lines 327..533 region) with a mount div.
 * - Replaces the modal JS block (lines 1002..1930) with createHicModal wiring
 *   that preserves: submit-to-gallery view, draft autosave, copy header
 *   buttons, prettify, CDN-aware standalone builder, deep links, new design.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'docs', 'html-in-canvas', 'designs.html');
let lines = fs.readFileSync(file, 'utf8').split('\n');

/* ── locate boundaries ── */
const markupStart = lines.findIndex(l => l.includes('<div class="modal-overlay" id="modalOverlay">'));
const markupEnd = lines.findIndex(l => l.includes('<div id="toast">')); // exclusive
if (markupStart < 0 || markupEnd < 0) { console.error('markup anchors not found', { markupStart, markupEnd }); process.exit(1); }

const jsStart = lines.findIndex(l => l.includes('* MODAL — ported from test-renderer, design-aware')) - 1; // the /* line above
const jsEndMarker = '</script>\n</body>'; // not line-based; find last </script> before </body>
let jsEnd = -1;
for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim() === '</body>' ) { jsEnd = i; break; } }
if (jsStart < 0 || jsEnd < 0) { console.error('js anchors not found', { jsStart, jsEnd }); process.exit(1); }

const modMarkup = [
'<div id="hicModalMount"></div>',
'',
'<div id="toast"></div>',
];

/* The replacement JS: everything from the "MODAL — ported" comment to </script> */
const modJs = `/* ═══════════════════════════════════════════════════════════════
 * MODAL — shared component (hic-modal.js), design-aware wiring
 * ═══════════════════════════════════════════════════════════════ */
let currentDesignId = null;
let _lastAppliedCode = { html: '', css: '', js: '' };
let _clipTitle = '';

function designDur(d) { return Math.round((d && d.duration) || 5000); }
function clipTitleFrom(html) {
    const m = String(html || '').match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
    const t = m ? m[1].replace(/\\s+/g, ' ').trim() : '';
    return t ? t.slice(0, 80) : '';
}
function exportFileStem() {
    const base = _clipTitle || (byId[currentDesignId] || {}).title || 'design';
    return base.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'design';
}
function effectiveExportCode() {
    if (_lastAppliedCode.html || _lastAppliedCode.css || _lastAppliedCode.js) return _lastAppliedCode;
    const d = byId[currentDesignId];
    return { html: (d && d.html) || '', css: (d && d.css) || '', js: (d && d.js) || '' };
}
function refreshClipTitle() {
    _clipTitle = clipTitleFrom(modalApi.getEditors().html);
    if (currentDesignId) {
        const d = byId[currentDesignId];
        modalApi.setTitle(_clipTitle || (d && d.title) || currentDesignId);
    }
}

const modalApi = createHicModal({
    /* clip adapter — page owns the stage/state */
    getClip: function() { return null; },
    getStageCode: function() { return (_lastAppliedCode.html || _lastAppliedCode.css || _lastAppliedCode.js) ? _lastAppliedCode : null; },
    applyCode: function(code, src) {
        _lastAppliedCode = code;
        refreshClipTitle();
    },
    prettify: function(code) {
        return { html: prettifyHtml(code.html || ''), css: prettifyCss(code.css || ''), js: prettifyJs(code.js || '') };
    },
    onEditorsChange: function(code) { if (currentDesignId) saveDraft(); },

    /* prompt / AI */
    buildPrompt: function(brief) {
        const d = byId[currentDesignId];
        return aiBuildPrompt(brief || '(no extra description — propose something tasteful)', designDur(d));
    },
    aiNote: 'The prompt enforces the render contract: deterministic onFrame(time in ms), 800×450 design space, no CSS keyframes. LaTeX, markdown, Google fonts and Tailwind are supported — replies drop straight into the preview and both export paths.',
    parseReply: aiParseReply,
    onAiCode: function(code, parsed) {
        if (parsed && parsed.dur) {
            const d = byId[currentDesignId];
            if (d) d.duration = parsed.dur;
        }
    },

    /* header buttons — copy prompt / copy code / submit (submit injected below) */
    headerButtons: [
        { id: 'copyPromptHdr', title: 'Copy the full AI prompt (brief + render contract)', svg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
          onClick: function(api) { if (currentDesignId) copyPrompt(currentDesignId); } },
        { id: 'copyCodeHdr', title: 'Copy the code as fenced html/css/js blocks', svg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
          onClick: function(api) { if (currentDesignId) copyFenced(currentDesignId); } },
        { id: 'submitHdrBtn', title: 'Submit this design to the public gallery', svg: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
          onClick: function(api) { api.showTab('ai'); openSubmitView(); } }
    ],

    codeFeatures: { gallery: false, import: true },

    /* extra AI sub-view: Submit to Gallery (form preserved from the old page) */
    aiViews: [{
        id: 'submit', label: 'Submit to Gallery',
        build: function(body, api) {
            body.innerHTML = SUBMIT_VIEW_HTML;
            wireSubmitView(body, api);
        }
    }],

    /* CDN-aware standalone (ported verbatim from the old page) */
    buildStandalone: exportStandaloneHtml,

    placeholder: function(ctx, w, h) {
        ctx.fillStyle = '#0d1420';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#64748b';
        ctx.font = '600 16px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No code yet — use the AI tab to generate it', w / 2, h / 2);
        ctx.textAlign = 'left';
    },
    hasStageCode: function() {
        const d = byId[currentDesignId];
        return !!(d && (d.html || d.css || d.js));
    }
});

/* ── open / close (page API kept for card grid) ─────────────────── */
function openDesign(id) {
    const d = byId[id];
    if (!d) return;
    currentDesignId = id;
    _lastAppliedCode = { html: '', css: '', js: '' };
    _clipTitle = clipTitleFrom(d.html || '');
    document.getElementById('aiWant').value = ''; /* filled via openHook below */
    modalApi.open({
        name: d.title || id,
        dur: designDur(d) / 1000,
        html: d.html || '', css: d.css || '', js: d.js || '',
        startTab: d.hasCode ? 'preview' : 'ai'
    });
    const aiWantEl = modalApi.root.querySelector('.aiwant');
    if (aiWantEl) aiWantEl.value = d.prompt || '';
    if (typeof _pendingOpenHook === 'function') { const h = _pendingOpenHook; _pendingOpenHook = null; h(); }
}
function closeModal() { modalApi.close(); }

/* ── SUBMIT TO GALLERY view (form preserved; wires into the component) ── */
const FORM = {
    id: '1FAIpQLSf31WIC2A2ioBgolMM7OSKeqb9vnT3njNs4U41pofPClAWsng',
    entries: {
        title: 'entry.2036550004', creator: 'entry.673665515', tags: 'entry.2080048560',
        prompt: 'entry.1575482696', duration: 'entry.1415136671',
        html: 'entry.907794936', css: 'entry.1692215303', js: 'entry.1301616407'
    }
};
const DRAFT_KEY = 'hicDesignDraft';
const SUBMIT_VIEW_HTML = \`
    <p class="hicm-chint" style="border:none;padding:0">Review the submission, fill in the credits, then publish. It appears in the gallery after the next sync (~every 6 h).</p>
    <div class="submit-summary" id="submitSummary"></div>
    <div class="submit-grid">
        <div class="submit-field" id="sfTitle"><label>Title <span class="req">*</span></label><input type="text" id="subTitle" maxlength="60" placeholder="e.g. Neon City Rush"><div class="ferr">Title is required (2–60 chars).</div></div>
        <div class="submit-field" id="sfCreator"><label>Creator <span class="req">*</span></label><input type="text" id="subCreator" maxlength="40" placeholder="your display name"><div class="ferr">Creator name is required.</div></div>
        <div class="submit-field full" id="sfTags"><label>Tags</label><input type="text" id="subTags" maxlength="80" placeholder="comma separated, e.g. fonts, latex, tailwind"></div>
        <div class="submit-field full" id="sfPrompt"><label>Prompt brief <span class="req">*</span></label><textarea id="subPrompt" rows="4" placeholder="The creative brief only — the render contract is attached automatically when someone copies it."></textarea><div class="ferr">A brief is required so others can regenerate this design.</div></div>
        <div class="submit-field" id="sfDuration"><label>Duration (ms)</label><input type="text" id="subDuration" inputmode="numeric" placeholder="5000"><div class="ferr">Duration must be a number between 500 and 60000.</div></div>
        <div class="submit-field full" id="sfHtml"><label>HTML <span class="req">*</span></label><textarea id="subHtml" class="mono" rows="6" placeholder="&lt;title&gt;Name&lt;/title&gt; then the stage markup"></textarea><div class="ferr">HTML must start with a &lt;title&gt; tag (max 30k chars).</div></div>
        <div class="submit-field full" id="sfCss"><label>CSS</label><textarea id="subCss" class="mono" rows="5"></textarea></div>
        <div class="submit-field full" id="sfJs"><label>JS</label><textarea id="subJs" class="mono" rows="5"></textarea></div>
    </div>
    <div class="submit-actions">
        <button type="button" class="btn-ai-quiet" id="subBackBtn">Back</button>
        <button type="button" class="btn-ai-apply" id="subPostBtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publish to Gallery</button>
    </div>\`;

function wireSubmitView(body, api) {
    const subBackBtn = body.querySelector('#subBackBtn');
    const subPostBtn = body.querySelector('#subPostBtn');
    subBackBtn.addEventListener('click', function() { api.showAiView('paste'); });
    subPostBtn.addEventListener('click', function() {
        const s = {
            title: body.querySelector('#subTitle').value.trim(),
            creator: body.querySelector('#subCreator').value.trim(),
            tags: body.querySelector('#subTags').value.trim(),
            prompt: body.querySelector('#subPrompt').value.trim(),
            duration: body.querySelector('#subDuration').value.trim(),
            html: body.querySelector('#subHtml').value,
            css: body.querySelector('#subCss').value,
            js: body.querySelector('#subJs').value
        };
        const errs = validateSubmission(s);
        markFields(body, errs);
        if (Object.keys(errs).length) { toast('Fix the highlighted fields first'); return; }
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ prompt: s.prompt, html: s.html, css: s.css, js: s.js, savedAt: Date.now() })); } catch (e) {}
        const f = new FormData();
        f.append(FORM.entries.title, s.title);
        f.append(FORM.entries.creator, s.creator);
        f.append(FORM.entries.tags, s.tags);
        f.append(FORM.entries.prompt, s.prompt);
        f.append(FORM.entries.duration, s.duration);
        f.append(FORM.entries.html, s.html);
        f.append(FORM.entries.css, s.css);
        f.append(FORM.entries.js, s.js);
        subPostBtn.disabled = true;
        subPostBtn.textContent = 'Publishing…';
        fetch('https://docs.google.com/forms/d/e/' + FORM.id + '/formResponse', { method: 'POST', mode: 'no-cors', body: f })
            .then(function() { toast('Submitted! It lands in the gallery after the next sync (≤ 6 h).'); api.setStatus('Queued for the gallery — check back after the next sync.'); api.showAiView('get'); })
            .catch(function() { toast('Submit may have failed — a local backup was saved. Try again later.'); })
            .finally(function() { subPostBtn.disabled = false; subPostBtn.innerHTML = SUBMIT_ICON_SVG + ' Publish to Gallery'; });
    });
}
const SUBMIT_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

function submitCandidateCode() {
    if (_lastAppliedCode.html || _lastAppliedCode.css || _lastAppliedCode.js) return _lastAppliedCode;
    const d = byId[currentDesignId];
    if (d && (d.html || d.css || d.js)) return { html: d.html, css: d.css, js: d.js };
    return modalApi.getEditors();
}
function validJs(js) {
    if (!/\\bonFrame\\s*\\(/.test(js)) return false;
    if (/\\brequestAnimationFrame\\b|\\bsetTimeout\\b|\\bsetInterval\\b/.test(js)) return false;
    try { new Function(js); return true; } catch (e) { return false; }
}
function validateSubmission(s) {
    const errs = {};
    if (!s.title || s.title.length < 2 || s.title.length > 60) errs.title = 1;
    if (!s.creator || !s.creator.trim()) errs.creator = 1;
    if (!s.prompt || !s.prompt.trim()) errs.prompt = 1;
    const dur = parseInt(s.duration, 10);
    if (!dur || dur < 500 || dur > 60000) errs.duration = 1;
    if (!/^\\s*<title[^>]*>/i.test(s.html) || !s.html || s.html.length > 30000) errs.html = 1;
    if ((s.css || '').length > 30000) errs.css = 1;
    if (!validJs(s.js || '') || (s.js || '').length > 30000) errs.js = 1;
    return errs;
}
function markFields(body, errs) {
    [['sfTitle', 'title'], ['sfCreator', 'creator'], ['sfPrompt', 'prompt'], ['sfDuration', 'duration'], ['sfHtml', 'html'], ['sfCss', 'css'], ['sfJs', 'js']]
        .forEach(function(pair) { const el = body.querySelector('#' + pair[0]); if (el) el.classList.toggle('bad', !!errs[pair[1]]); });
}
function openSubmitView() {
    if (!currentDesignId) return;
    const d = byId[currentDesignId];
    const code = submitCandidateCode();
    const parsed = clipTitleFrom(code.html);
    const body = modalApi.root.querySelector('[data-ai="submit"]');
    if (!body) return;
    body.querySelector('#subTitle').value = parsed || (d._draft ? '' : (d.title || ''));
    body.querySelector('#subCreator').value = d._draft ? '' : (d.creator === 'studio' ? '' : (d.creator || ''));
    body.querySelector('#subTags').value = (d.tags || []).filter(t => t !== 'draft' && t !== 'prompt').join(', ');
    body.querySelector('#subPrompt').value = (d.prompt && d.prompt !== '(rendered design — code included)') ? d.prompt : (modalApi.root.querySelector('.aiwant').value || '');
    body.querySelector('#subDuration').value = String(designDur(d));
    body.querySelector('#subHtml').value = code.html || '';
    body.querySelector('#subCss').value = code.css || '';
    body.querySelector('#subJs').value = code.js || '';
    const kb = n => (n / 1024).toFixed(1) + ' KB';
    body.querySelector('#submitSummary').innerHTML =
        'Submitting: <b>' + esc(parsed || d.title || 'Untitled') + '</b> — ' +
        'HTML ' + kb((code.html || '').length) + ' · CSS ' + kb((code.css || '').length) + ' · JS ' + kb((code.js || '').length);
    markFields(body, {});
    modalApi.showAiView('submit');
}

/* ── Draft autosave ─────────────────────────────────────────────── */
function saveDraft() {
    if (!currentDesignId) return;
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            prompt: modalApi.root.querySelector('.aiwant').value || '',
            html: modalApi.getEditors().html, css: modalApi.getEditors().css, js: modalApi.getEditors().js,
            savedAt: Date.now()
        }));
    } catch (e) { /* storage unavailable */ }
}
function loadDraft() {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch (e) { return null; }
}

/* ── Deep links: designs.html#design=<id> · #new=1 ─────────────── */
function handleHash() {
    if (/#new=1/.test(location.hash)) {
        history.replaceState(null, '', location.pathname);
        openNewDesign();
        return;
    }
    const m = (location.hash || '').match(/#design=([A-Za-z0-9_-]+)/);
    if (m && byId[m[1]]) openDesign(m[1]);
}
window.addEventListener('hashchange', handleHash);

/* ── New design (+ button): empty draft workspace ──────────────── */
const NEW_DESIGN_ID = '__draft__';
const newDesignBtn = document.getElementById('newDesignBtn');
newDesignBtn.addEventListener('click', openNewDesign);
function openNewDesign() {
    const saved = loadDraft();
    let handoff = null;
    try {
        handoff = JSON.parse(localStorage.getItem('pe_handoff') || 'null');
        if (handoff) localStorage.removeItem('pe_handoff');
    } catch (e) { handoff = null; }
    byId[NEW_DESIGN_ID] = {
        id: NEW_DESIGN_ID,
        title: 'Untitled Design',
        creator: 'draft',
        tags: ['draft'],
        prompt: (handoff && handoff.brief) || (saved && saved.prompt) || '',
        duration: (handoff && handoff.dur) || 5000,
        html: (saved && saved.html) || '',
        css: (saved && saved.css) || '',
        js: (saved && saved.js) || '',
        hasCode: !!(saved && (saved.html || saved.css || saved.js)),
        _draft: true
    };
    openDesign(NEW_DESIGN_ID);
}
`;

/* ── perform surgery ── */
/* 1) markup: replace [markupStart .. markupEnd) */
lines.splice(markupStart, markupEnd - markupStart, ...modMarkup);
/* 2) JS: find boundaries again after splice shift */
const jsStart2 = lines.findIndex(l => l.includes('* MODAL — ported from test-renderer, design-aware')) - 1;
let jsEnd2 = -1;
for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].trim() === '</body>') { jsEnd2 = i; break; } }
/* the old block ends right before </script> + blank + </body>; find the last </script> before </body> */
let scriptClose = -1;
for (let i = jsEnd2; i > jsStart2; i--) { if (lines[i].includes('</script>')) { scriptClose = i; break; } }
if (jsStart2 < 0 || scriptClose < 0) { console.error('post-splice anchors not found', { jsStart2, scriptClose }); process.exit(1); }
/* keep the closing </script> line, replace everything between jsStart2 and scriptClose */
const newJsLines = modJs.split('\n');
lines.splice(jsStart2, scriptClose - jsStart2, ...newJsLines);

fs.writeFileSync(file, lines.join('\n'));
console.log('Cutover complete:', {
    markupReplaced: [markupStart + 1, markupEnd],
    jsReplaced: [jsStart2 + 1, scriptClose + 1],
    newTotalLines: lines.length
});
