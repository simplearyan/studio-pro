/* ═══════════════════════════════════════════════════════════════════════
 * hic-modal.js — shared preview modal for the HIC pages
 *
 * createHicModal(opts) renders the full preview modal (player shell with
 * overlay transport, export toolbar, Code tab with CodeMirror, AI tab)
 * and returns an API the host page drives. One implementation replaces
 * the per-page copies that had already drifted apart (designs.html was
 * running the pre-player-shell transport and native slider).
 *
 * Requires hic-frame.js (HicRenderer, curFrame, frameDims, dsDims,
 * mountFrameControls, readExpPrefs/writeExpPrefs) and CodeMirror loaded
 * by the page.
 *
 * opts:
 *   getClip()            → { name, dur, html, css, js, ds } current clip
 *   getStageCode()       → { html, css, js } | null  code actually applied
 *   applyCode(code, src) → page records applied code ('edit'|'ai'|'reset')
 *   buildPrompt(brief)   → full prompt string for Copy AI Prompt
 *   prompts              → [{t, d, brief}] brief chips (omit to hide grid)
 *   aiNote               → contract note line under the AI Get view
 *   headerButtons        → [{ id, title, svg, onClick(api) }] extra header icons
 *   codeFeatures         → { gallery:bool, import:bool }  (default both on)
 *   gallery              → { list(), save(name,code), remove(id) }
 *   aiViews              → [{ id, label, build(body, api) }] extra AI sub-views
 *   parseReply(text)     → { html, css, js, dur?, ds? } | null (default provided)
 *   onAiCode(code, meta) → called after Parse & Apply (meta may carry ds/name)
 *   onOpen / onClose     → lifecycle hooks
 *   onEditorsChange(code)→ fired (throttled) on any editor edit (draft autosave)
 *   prettify(code)       → { html, css, js } formatter applied before editors fill
 *   buildStandalone(code,title,dur) → page-specific standalone HTML (overrides core)
 *   placeholder(ctx,w,h) → paint instead of the renderer when the clip has no code
 *   hasStageCode()       → false = clip is prompt-only (AI tab opens first)
 * ═══════════════════════════════════════════════════════════════════════ */

(function() {
'use strict';

/* ── Styles, injected once, namespaced with hicm- ─────────────────────── */
var CSS =
'.hicm-overlay{position:fixed;inset:0;background:rgba(4,7,14,.78);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:1000;display:none;align-items:center;justify-content:center;padding:24px}' +
'.hicm-overlay.open{display:flex}' +
'.hicm-modal{background:#111827;border-radius:16px;border:1px solid #232b3b;max-width:960px;width:100%;overflow:hidden;box-shadow:0 25px 60px -12px rgba(0,0,0,.7);max-height:calc(100vh - 48px);height:calc(100vh - 48px);display:flex;flex-direction:column;transition:max-width .25s;font-family:Rubik,system-ui,sans-serif;color:#e2e8f0}' +
'.hicm-modal.portrait{max-width:480px}' +
'.hicm-header{padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #1e2533;flex-shrink:0}' +
'.hicm-titleblock{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 0}' +
'.hicm-title{font-size:14.5px;font-weight:700;color:#f1f5f9;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.hicm-meta{font-size:10.5px;font-weight:500;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.hicm-hbtns{display:flex;gap:5px;align-items:center}' +
'.hicm-hbtn{background:#1e2533;color:#cbd5e1;border:1px solid #2d3748;border-radius:7px;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}' +
'.hicm-hbtn:hover{background:#2d3748;color:#f1f5f9;border-color:#3b4a63}' +
'.hicm-seg{display:flex;background:#161d2b;border:1px solid #2d3748;border-radius:8px;padding:2px;gap:2px}' +
'.hicm-tab{padding:5px 14px;border-radius:6px;border:none;font-size:11px;font-weight:600;cursor:pointer;background:transparent;color:#7c8798;transition:all .15s;letter-spacing:.2px;font-family:Rubik,sans-serif;line-height:1.4}' +
'.hicm-tab:hover{color:#cbd5e1}' +
'.hicm-tab.active{color:#f1f5f9;background:#334155}' +
'.hicm-close{background:none;border:none;color:#7c8798;cursor:pointer;padding:5px 8px;border-radius:6px;transition:all .15s;line-height:1;display:flex;align-items:center}' +
'.hicm-close:hover{background:#232b3b;color:#f1f5f9}' +
'.hicm-body{overflow:auto;min-height:0;display:flex;flex-direction:column;flex:1 1 auto}' +
/* preview / player */
'.hicm-panel{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}' +
'.hicm-zone{position:relative;flex:1 1 auto;min-height:0;background:#080b10;overflow:hidden}' +
'.hicm-zone canvas{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;display:block}' +
'.hicm-zone:fullscreen{border-radius:0}.hicm-zone:fullscreen canvas{max-height:100vh;max-width:100vw}' +
'.hicm-cplay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;border:none;background:rgba(8,11,16,.55);backdrop-filter:blur(3px);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:6;transition:opacity .25s,transform .25s;box-shadow:0 4px 24px rgba(0,0,0,.4)}' +
'.hicm-cplay:hover{background:rgba(8,11,16,.72);transform:translate(-50%,-50%) scale(1.06)}' +
'.hicm-zone.playing .hicm-cplay{opacity:0;transform:translate(-50%,-50%) scale(1.25);pointer-events:none}' +
'.hicm-transport{position:absolute;left:0;right:0;bottom:0;padding:26px 12px 6px;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.35) 55%,transparent 100%);opacity:1;transition:opacity .3s ease;z-index:7;pointer-events:none}' +
'.hicm-transport>*{pointer-events:auto}' +
'.hicm-zone.playing .hicm-transport{opacity:0}' +
'.hicm-zone.playing:hover .hicm-transport,.hicm-zone.playing.seeking .hicm-transport{opacity:1}' +
'.hicm-progress{position:relative;height:16px;display:flex;align-items:center;cursor:pointer;margin-bottom:2px;touch-action:none}' +
'.hicm-track{width:100%;height:3px;background:rgba(255,255,255,.28);border-radius:2px;overflow:hidden;transition:height .12s ease}' +
'.hicm-progress:hover .hicm-track{height:5px}' +
'.hicm-fill{height:100%;width:0%;background:#3b82f6;border-radius:2px}' +
'.hicm-dot{position:absolute;top:50%;left:0;width:13px;height:13px;background:#3b82f6;border-radius:50%;transform:translate(-50%,-50%) scale(0);transition:transform .12s ease;box-shadow:0 1px 4px rgba(0,0,0,.5);pointer-events:none}' +
'.hicm-progress:hover .hicm-dot,.hicm-progress.dragging .hicm-dot{transform:translate(-50%,-50%) scale(1)}' +
'.hicm-row{display:flex;justify-content:space-between;align-items:center;height:38px;padding:0 2px}' +
'.hicm-rowl,.hicm-rowr{display:flex;align-items:center;gap:2px}' +
'.hicm-obtn{background:none;border:none;color:#fff;padding:7px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.92;transition:opacity .15s,background .15s}' +
'.hicm-obtn:hover{opacity:1;background:rgba(255,255,255,.12)}' +
'.hicm-obtn svg{display:block}' +
'.hicm-time{color:#fff;font-size:12px;font-weight:500;margin-left:6px;letter-spacing:.3px;user-select:none;font-variant-numeric:tabular-nums;white-space:nowrap}' +
'.hicm-time .sep{opacity:.65;margin:0 4px}.hicm-total{opacity:.75}' +
'.hicm-sr{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}' +
/* toolbar */
'.hicm-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 16px;border-top:1px solid #1e2533;background:#131a26}' +
'.hicm-tcluster{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}' +
'.hicm-tcluster.right{justify-content:flex-end}' +
'.hicm-btn{padding:8px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;font-family:Rubik,sans-serif;display:inline-flex;align-items:center;justify-content:center;gap:7px;line-height:1}' +
'.hicm-btn svg{display:block;flex-shrink:0}' +
'.hicm-split{position:relative;display:flex;align-items:stretch}' +
'.hicm-resbtn{background:#1e2533;color:#e2e8f0;border:1px solid #2d3748;border-radius:7px;padding:5px 9px;font-size:11px;font-weight:600;cursor:pointer;outline:none;display:inline-flex;align-items:center;gap:6px;font-family:Rubik,sans-serif;transition:border-color .15s}' +
'.hicm-resbtn:hover{border-color:#3b4a63}.hicm-resbtn:disabled{opacity:.65;cursor:default}' +
'.hicm-resbtn svg{color:#64748b}' +
'.hicm-resbtn .caret{transition:transform .15s}.hicm-resbtn.open .caret{transform:rotate(180deg)}' +
'.hicm-fmain{background:#1e2533;color:#cbd5e1;border:1px solid #2d3748;border-radius:8px 0 0 8px}' +
'.hicm-fmain:hover{background:#2d3748;color:#f1f5f9;border-color:#3b82f6}' +
'.hicm-fmain:disabled{opacity:.65;cursor:default}' +
'.hicm-caret{background:#1e2533;border:none;border-left:1px solid #2d3748;color:#cbd5e1;padding:0 8px;border-radius:0 8px 8px 0;cursor:pointer;display:flex;align-items:center;transition:all .15s}' +
'.hicm-caret:hover{background:#2d3748;color:#f1f5f9;border-color:#3b82f6}' +
'.hicm-caret:disabled{opacity:.65;cursor:default}' +
'.hicm-caret svg{transition:transform .15s}.hicm-caret.open svg{transform:rotate(180deg)}' +
'.hicm-vmain{background:#059669;color:#fff;border-radius:8px 0 0 8px;box-shadow:0 1px 3px rgba(5,150,105,.35)}' +
'.hicm-vmain:hover{background:#047857}' +
'.hicm-vmain:disabled{opacity:.65;cursor:default}' +
'.hicm-vcaret{background:#047857;border:none;border-left:1px solid rgba(255,255,255,.25);color:#fff;padding:0 8px;border-radius:0 8px 8px 0;cursor:pointer;display:flex;align-items:center;transition:background .15s}' +
'.hicm-vcaret:hover{background:#036852}.hicm-vcaret:disabled{opacity:.65;cursor:default}' +
'.hicm-vcaret svg{transition:transform .15s}.hicm-vcaret.open svg{transform:rotate(180deg)}' +
'.hicm-split.rec .hicm-vmain{background:#dc2626;animation:hicmpulse 1s infinite}' +
'.hicm-split.rec .hicm-vcaret{background:#b91c1c}' +
'@keyframes hicmpulse{0%,100%{opacity:1}50%{opacity:.7}}' +
'.hicm-menu{position:absolute;right:0;bottom:calc(100% + 10px);background:#161d2b;border:1px solid #2d3748;border-radius:10px;min-width:210px;max-width:min(260px,calc(100vw - 64px));padding:6px;box-shadow:0 12px 32px rgba(0,0,0,.55);display:none;z-index:50}' +
'.hicm-menu.open{display:block}' +
'.hicm-mlabel{font-size:9.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;padding:6px 10px 4px;font-family:Rubik,sans-serif}' +
'.hicm-item{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:#e2e8f0;font-size:12px;font-weight:600;padding:8px 10px;border-radius:7px;cursor:pointer;text-align:left;transition:background .12s;font-family:Rubik,sans-serif}' +
'.hicm-item:hover{background:#1f2937}' +
'.hicm-item em{margin-left:auto;font-style:normal;font-size:10px;font-weight:500;color:#64748b}' +
'.hicm-item .chk{visibility:hidden;color:#34d399;flex-shrink:0}' +
'.hicm-item.selected{color:#f1f5f9}' +
'.hicm-item.selected .chk{visibility:visible}' +
/* code tab */
'.hicm-ctabs{padding:8px 14px;flex-shrink:0;display:flex;gap:4px;align-items:center;border-bottom:1px solid #1e2533;flex-wrap:wrap;row-gap:6px}' +
'.hicm-ctab{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border:none;border-bottom:2px solid transparent;background:none;font-size:11px;font-weight:600;cursor:pointer;color:#7c8798;transition:all .15s;letter-spacing:.2px;font-family:Rubik,sans-serif;margin-bottom:-1px}' +
'.hicm-ctab .dot{width:6px;height:6px;border-radius:50%;background:#475569;transition:background .15s}' +
'.hicm-ctab:hover{color:#cbd5e1}' +
'.hicm-ctab.active{color:#f1f5f9;border-bottom-color:#64748b}' +
'.hicm-ctab.active .dot{background:#94a3b8}' +
'.hicm-ctab.active[data-lang=html]{border-bottom-color:#34d399}.hicm-ctab.active[data-lang=html] .dot{background:#34d399}' +
'.hicm-ctab.active[data-lang=css]{border-bottom-color:#60a5fa}.hicm-ctab.active[data-lang=css] .dot{background:#60a5fa}' +
'.hicm-ctab.active[data-lang=js]{border-bottom-color:#fbbf24}.hicm-ctab.active[data-lang=js] .dot{background:#fbbf24}' +
'.hicm-cright{margin-left:auto;display:flex;align-items:center;gap:5px;flex-wrap:wrap;row-gap:6px}' +
'.hicm-chip{background:#1e2533;color:#cbd5e1;border:1px solid #2d3748;padding:0 10px;height:30px;font-size:11px;border-radius:8px;font-weight:600;cursor:pointer;transition:all .15s;font-family:Rubik,sans-serif;display:inline-flex;align-items:center;gap:6px}' +
'.hicm-chip:hover{background:#2d3748;color:#f1f5f9;border-color:#3b4a63}' +
'.hicm-chip:disabled{opacity:.65;cursor:default}' +
'.hicm-chip.quiet{background:none;border-color:transparent;color:#64748b}' +
'.hicm-chip.quiet:hover:not(:disabled){background:#1e2533;color:#cbd5e1;border-color:transparent}' +
'.hicm-chip.danger-confirm{background:#7f1d1d;color:#fee2e2;border-color:#dc2626}' +
'.hicm-chip.green{background:#059669;color:#fff;border-color:transparent;box-shadow:0 1px 3px rgba(5,150,105,.35)}' +
'.hicm-chip.green:hover{background:#047857}' +
'.hicm-galcount{background:#2563eb;color:#fff;font-size:9px;font-weight:700;border-radius:9px;padding:1px 5px;min-width:14px;text-align:center}' +
'.hicm-gmenu{position:absolute;right:0;top:calc(100% + 8px);width:330px;max-width:min(360px,calc(100vw - 80px));background:#161d2b;border:1px solid #2d3748;border-radius:10px;padding:8px;box-shadow:0 12px 32px rgba(0,0,0,.55);display:none;z-index:60}' +
'.hicm-gmenu.open{display:block}' +
'.hicm-gsaverow{display:flex;gap:6px;margin-bottom:8px}' +
'.hicm-ginput{flex:1;min-width:0;background:#0d1420;border:1px solid #2d3748;border-radius:7px;padding:7px 10px;font-size:11.5px;color:#e2e8f0;outline:none;font-family:Rubik,sans-serif}' +
'.hicm-ginput:focus{border-color:#3b82f6}' +
'.hicm-gsave{background:#2563eb;color:#fff;padding:0 13px;border-radius:7px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Rubik,sans-serif;white-space:nowrap}' +
'.hicm-gsave:hover{background:#1d4ed8}' +
'.hicm-glist{max-height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:3px}' +
'.hicm-gitem{display:flex;align-items:center;gap:7px;padding:7px 9px;border-radius:8px;cursor:pointer;border:1px solid transparent;transition:background .12s}' +
'.hicm-gitem:hover{background:#1f2937;border-color:#2d3748}' +
'.hicm-ginfo{flex:1;min-width:0}' +
'.hicm-gname{font-size:11.5px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
'.hicm-gmeta{font-size:9.5px;color:#64748b;font-weight:500;margin-top:1px}' +
'.hicm-gact{background:none;border:none;color:#64748b;cursor:pointer;padding:3px;border-radius:5px;display:flex;align-items:center;flex-shrink:0;transition:all .12s}' +
'.hicm-gact:hover{color:#e2e8f0;background:#2d3748}' +
'.hicm-gact.danger:hover{color:#f87171}' +
'.hicm-gempty{font-size:11px;color:#64748b;text-align:center;padding:14px 8px;line-height:1.5}' +
'.hicm-badge{display:none;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fbbf24;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.3);padding:4px 10px;border-radius:20px}' +
'.hicm-badge.on{display:inline-flex}' +
'.hicm-badge .dot{width:6px;height:6px;border-radius:50%;background:#fbbf24}' +
'.hicm-chint{padding:6px 16px 8px;font-size:10.5px;color:#64748b;font-weight:500;letter-spacing:.2px;border-bottom:1px solid #1e2533}' +
'.hicm-chint strong{color:#94a3b8;font-weight:600}' +
'#CODEPANEL,#AIPANEL{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}' +
'.hicm-cwrap{display:none;flex:1;min-height:0;overflow:hidden}' +
'.hicm-cwrap.active{display:block}' +
'.hicm-cwrap .CodeMirror{height:100%;border-radius:0 0 10px 10px}' +
/* editor: VS Code Dark+ */
'.CodeMirror{background:#1e1e1e !important;color:#d4d4d4 !important;font-family:Consolas,Cascadia Code,ui-monospace,Menlo,monospace !important;font-size:13px;line-height:1.6}' +
'.CodeMirror-gutters{background:#1e1e1e !important;border-right:1px solid #282828 !important}' +
'.CodeMirror-linenumber{color:#858585 !important;font-size:12px}' +
'.CodeMirror-cursor{border-left:2px solid #aeafad !important}' +
'.CodeMirror-selected{background:#264f78 !important}' +
'.CodeMirror-activeline-background{background:#282828 !important}' +
'.cm-s-hic-dark.CodeMirror{background:#1e1e1e;color:#d4d4d4}' +
'.cm-s-hic-dark .CodeMirror-gutters{background:#1e1e1e;border-right:1px solid #282828}' +
'.cm-s-hic-dark .CodeMirror-linenumber{color:#858585}' +
'.cm-s-hic-dark .CodeMirror-selected{background:#264f78}' +
'.cm-s-hic-dark .cm-tag{color:#569cd6}.cm-s-hic-dark .cm-attribute{color:#9cdcfe}' +
'.cm-s-hic-dark .cm-string,.cm-s-hic-dark .cm-string-2{color:#ce9178}' +
'.cm-s-hic-dark .cm-keyword{color:#569cd6}.cm-s-hic-dark .cm-def{color:#dcdcaa}' +
'.cm-s-hic-dark .cm-variable,.cm-s-hic-dark .cm-variable-2{color:#9cdcfe}' +
'.cm-s-hic-dark .cm-number{color:#b5cea8}.cm-s-hic-dark .cm-comment{color:#6a9955;font-style:normal}' +
'.cm-s-hic-dark .cm-property{color:#9cdcfe}.cm-s-hic-dark .cm-atom{color:#569cd6}' +
'.cm-s-hic-dark .cm-operator{color:#d4d4d4}.cm-s-hic-dark .cm-qualifier{color:#d7ba7d}' +
'.cm-s-hic-dark .cm-builtin{color:#dcdcaa}' +
/* ai tab */
'.hicm-aiwrap{padding:12px 20px 16px;flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;max-width:780px;margin:0 auto;width:100%}' +
'.hicm-aisub{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid #1e2533;margin-bottom:10px;flex-shrink:0;flex-wrap:wrap}' +
'.hicm-aisub-btn{padding:6px 16px;border-radius:20px;border:none;background:#161d2b;font-size:11px;font-weight:600;cursor:pointer;color:#7c8798;transition:all .15s;font-family:Rubik,sans-serif;letter-spacing:.2px;white-space:nowrap}' +
'.hicm-aisub-btn:hover{color:#cbd5e1}' +
'.hicm-aisub-btn.active{color:#f1f5f9;background:#334155}' +
'.hicm-aistatus{margin-left:auto;font-size:10.5px;font-weight:500;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
'.hicm-aiview{display:none;flex:1;min-height:0;flex-direction:column;gap:10px;overflow-y:auto}' +
'.hicm-aiview.active{display:flex}' +
'.hicm-step{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;font-family:Rubik,sans-serif;flex-shrink:0}' +
'.hicm-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:7px}' +
'.hicm-chipcard{display:flex;align-items:stretch;background:#161d2b;border:1px solid #2d3748;border-radius:9px;overflow:hidden;transition:border-color .15s}' +
'.hicm-chipcard:hover{border-color:#7c3aed}' +
'.hicm-chipmain{flex:1;background:none;border:none;text-align:left;padding:7px 10px;cursor:pointer;font-family:Rubik,sans-serif;min-width:0}' +
'.hicm-chipmain .t{display:block;font-size:11.5px;font-weight:600;color:#e2e8f0;line-height:1.35}' +
'.hicm-chipmain .d{display:block;font-size:9.5px;color:#64748b;line-height:1.35;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
'.hicm-chipmain:hover .t{color:#fff}' +
'.hicm-chipcopy{background:none;border:none;border-left:1px solid #2d3748;color:#64748b;padding:0 8px;cursor:pointer;display:flex;align-items:center;transition:all .15s;flex-shrink:0}' +
'.hicm-chipcopy:hover{color:#a78bfa;background:#1f2937}' +
'.hicm-ta{width:100%;box-sizing:border-box;background:#0d1420;border:1px solid #2d3748;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#e2e8f0;outline:none;resize:vertical;font-family:Rubik,sans-serif;line-height:1.5}' +
'.hicm-ta:focus{border-color:#7c3aed}' +
'.hicm-ta.mono{font-family:ui-monospace,Cascadia Code,JetBrains Mono,Consolas,monospace;font-size:11px;color:#cbd5e1}' +
'.hicm-aactions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex-shrink:0;margin-top:auto;padding-top:10px}' +
'.hicm-bcopy{background:#7c3aed;color:#fff}.hicm-bcopy:hover{background:#6d28d9}' +
'.hicm-bapply{background:#059669;color:#fff}.hicm-bapply:hover{background:#047857}' +
'.hicm-bquiet{background:none;color:#64748b;border:1px solid transparent}.hicm-bquiet:hover{background:#1e2533;color:#cbd5e1}' +
'.hicm-link{font-size:11px;font-weight:600;color:#94a3b8;text-decoration:none;border:1px solid #2d3748;border-radius:20px;padding:6px 12px;transition:all .15s;font-family:Rubik,sans-serif}' +
'.hicm-link:hover{color:#e2e8f0;border-color:#3b4a63}' +
'.hicm-note{font-size:10px;line-height:1.5;color:#56637a;margin:0}' +
/* responsive */
'@media(max-width:768px){.hicm-overlay{padding:12px}.hicm-modal{max-height:calc(100vh - 24px)}.hicm-toolbar{gap:8px;padding:9px 12px}.hicm-zone{min-height:220px}.hicm-btn .lbl{display:none}.hicm-btn{padding-left:11px;padding-right:11px}}' +
'@media(max-width:560px){.hicm-overlay{padding:0}.hicm-modal{margin:0;max-width:100vw;border-radius:0;border-left:none;border-right:none;max-height:100vh;height:100vh}.hicm-header{padding:12px 14px;flex-wrap:wrap;gap:6px 8px}.hicm-title{font-size:13px}.hicm-titleblock{order:1;flex:1 1 auto}.hicm-close{order:2;margin-left:auto}.hicm-seg{order:3;width:100%;display:flex;justify-content:center}.hicm-toolbar{flex-direction:column;row-gap:6px}.hicm-cplay{width:60px;height:60px}.hicm-transport{padding:22px 8px 4px}.hicm-btn .lbl{display:none}.hicm-ctabs{padding:8px 12px}.hicm-cright{width:100%}.hicm-aiwrap{padding:12px 14px 16px}.hicm-chips{grid-template-columns:1fr 1fr}.hicm-aistatus{width:100%;margin-left:0}.hicm-aactions .hicm-btn{flex:1 1 auto;justify-content:center}}' +
'@media(min-width:561px){.hicm-modal.portrait .hicm-toolbar{flex-direction:column-reverse;row-gap:6px}.hicm-modal.portrait .hicm-chips{grid-template-columns:1fr 1fr}}';

var CHECK = '<svg class="chk" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
var CARET_UP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>';
var RES_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="color:#64748b" aria-hidden="true"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg>';
var CAM_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z"/><path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z"/></svg>';
var VID_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
var FS_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
var PLAY_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
var PAUSE_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="display:none"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
var CLOSE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
var RESOLUTIONS = { '480': { w: 854, h: 480, n: 480 }, '720': { w: 1280, h: 720, n: 720 }, '1080': { w: 1920, h: 1080, n: 1080 }, '1440': { w: 2560, h: 1440, n: 1440 } };
var FMT_META = { png: { ext: 'png', mime: 'image/png', label: 'PNG' }, jpeg: { ext: 'jpg', mime: 'image/jpeg', label: 'JPG' }, webp: { ext: 'webp', mime: 'image/webp', label: 'WebP' } };

function createHicModal(opts) {
    opts = opts || {};
    var feats = opts.codeFeatures || {};
    feats.gallery = feats.gallery !== false;
    feats.import = feats.import !== false;

    if (!document.getElementById('hicm-css')) {
        var st = document.createElement('style'); st.id = 'hicm-css'; st.textContent = CSS; document.head.appendChild(st);
    }

    /* ── markup ── */
    var root = document.createElement('div');
    root.className = 'hicm-overlay';
    root.innerHTML =
    '<div class="hicm-modal">' +
      '<div class="hicm-header">' +
        '<div class="hicm-titleblock"><span class="hicm-title"></span><span class="hicm-meta"></span></div>' +
        '<div class="hicm-hbtns">' +
          '<div class="hicm-seg"><button class="hicm-tab active" data-tab="preview">Preview</button><button class="hicm-tab" data-tab="code">Code</button><button class="hicm-tab" data-tab="ai">AI</button></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px"><span class="hicm-hextra" style="display:flex;gap:5px"></span>' +
        '<button class="hicm-close" title="Close (Esc)">' + CLOSE_SVG + '</button></div>' +
      '</div>' +
      '<div class="hicm-body">' +
        '<div class="hicm-panel" data-panel="preview">' +
          '<div class="hicm-zone">' +
            '<canvas width="800" height="450"></canvas>' +
            '<button class="hicm-cplay" title="Play" aria-label="Play"><svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></button>' +
            '<div class="hicm-transport">' +
              '<div class="hicm-progress"><div class="hicm-track"><div class="hicm-fill"></div></div><div class="hicm-dot"></div></div>' +
              '<div class="hicm-row"><div class="hicm-rowl">' +
                '<button class="hicm-obtn play">' + PLAY_SVG + PAUSE_SVG + '</button>' +
                '<input type="range" class="hicm-sr" min="0" max="5000" value="0" aria-label="Seek">' +
                '<span class="hicm-time"><span class="cur">0:00</span><span class="sep">/</span><span class="hicm-total">0:05</span></span>' +
              '</div><div class="hicm-rowr"><button class="hicm-obtn fs" title="Fullscreen (F)">' + FS_SVG + '</button></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="hicm-toolbar">' +
            '<div class="hicm-tcluster">' +
              '<div class="hicm-split" data-split="res">' +
                '<button type="button" class="hicm-resbtn">' + RES_SVG + '<span class="rescur">1080p</span><svg class="caret" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="color:#64748b" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg></button>' +
                '<div class="hicm-menu resmenu" role="listbox" aria-label="Export resolution">' +
                  '<div class="hicm-mlabel">Export resolution</div>' +
                  '<button class="hicm-item resopt" data-res="480">' + CHECK + '480p<em>fast</em></button>' +
                  '<button class="hicm-item resopt" data-res="720">' + CHECK + '720p<em>HD</em></button>' +
                  '<button class="hicm-item resopt selected" data-res="1080">' + CHECK + '1080p<em>Full HD</em></button>' +
                  '<button class="hicm-item resopt" data-res="1440">' + CHECK + '1440p<em>2K</em></button>' +
                '</div>' +
              '</div>' +
              '<span class="hicm-framehost"></span>' +
            '</div>' +
            '<div class="hicm-tcluster right">' +
              '<div class="hicm-split" data-split="frame">' +
                '<button class="hicm-btn hicm-fmain framebtn">' + CAM_SVG + '<span class="lbl">Save Frame</span></button>' +
                '<button class="hicm-caret framecaret" title="Frame format">' + CARET_UP + '</button>' +
                '<div class="hicm-menu framemenu"><div class="hicm-mlabel">Save current frame as</div>' +
                  '<button class="hicm-item fmtopt selected" data-fmt="png">' + CHECK + 'PNG<em>lossless</em></button>' +
                  '<button class="hicm-item fmtopt" data-fmt="jpeg">' + CHECK + 'JPG<em>small</em></button>' +
                  '<button class="hicm-item fmtopt" data-fmt="webp">' + CHECK + 'WebP<em>smallest</em></button>' +
                '</div>' +
              '</div>' +
              '<div class="hicm-split" data-split="video">' +
                '<button class="hicm-btn hicm-vmain vbtn">' + VID_SVG + '<span class="lbl">Export WebM</span></button>' +
                '<button class="hicm-vcaret vcaret" title="Video options">' + CARET_UP + '</button>' +
                '<div class="hicm-menu vmenu"><div class="hicm-mlabel">Video settings</div>' +
                  '<button class="hicm-item fpsopt selected" data-fps="30">' + CHECK + '30 fps<em>standard</em></button>' +
                  '<button class="hicm-item fpsopt" data-fps="60">' + CHECK + '60 fps<em>smoother</em></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="hicm-panel" data-panel="code" style="display:none">' +
          '<div class="hicm-ctabs">' +
            '<button class="hicm-ctab active" data-lang="html"><span class="dot"></span>HTML</button>' +
            '<button class="hicm-ctab" data-lang="css"><span class="dot"></span>CSS</button>' +
            '<button class="hicm-ctab" data-lang="js"><span class="dot"></span>JS</button>' +
            '<span class="hicm-badge"><span class="dot"></span>Unsaved</span>' +
            '<div class="hicm-cright">' +
              (feats.gallery ? '<div style="position:relative"><button class="hicm-chip galbtn" title="Saved code snippets"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>Gallery<span class="hicm-galcount galcount">0</span></button>' +
                '<div class="hicm-gmenu galmenu"><div class="hicm-gsaverow"><input type="text" class="hicm-ginput galname" placeholder="Name this code variant…" maxlength="60"><button type="button" class="hicm-gsave galsave">Save</button></div><div class="hicm-glist glist"></div></div></div>' : '') +
              (feats.import ? '<button class="hicm-chip impbtn" title="Import code from a .json file (or any code file) into the panes"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Import</button><input type="file" class="impfile" accept=".json,.txt,.html,.htm" style="display:none">' : '') +
              '<div class="hicm-split cesplit">' +
                '<button class="hicm-chip cebtn" title="Download the three panes as a reusable .json code file"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export</button>' +
                '<button class="hicm-caret cecaret" title="Export options" style="border-radius:0 8px 8px 0;border-left:none">' + CARET_UP + '</button>' +
                '<div class="hicm-menu cemenu"><div class="hicm-mlabel">Export current code as</div>' +
                  '<button class="hicm-item" data-cexp="json">' + CHECK + 'Code file (.json)<em>re-importable</em></button>' +
                  '<button class="hicm-item" data-cexp="html">' + CHECK + 'Standalone page (.html)<em>open in browser</em></button>' +
                '</div>' +
              '</div>' +
              '<button class="hicm-chip quiet resetbtn" title="Discard applied edits and restore the original code" disabled><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Reset</button>' +
              '<button class="hicm-chip green applybtn" title="Render the panes on the stage and play"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Apply</button>' +
            '</div>' +
          '</div>' +
          '<p class="hicm-chint">Edits are sandboxed — <strong>Apply</strong> renders them on the stage.</p>' +
          '<div class="hicm-cwrap active" data-wrap="html"><textarea></textarea></div>' +
          '<div class="hicm-cwrap" data-wrap="css"><textarea></textarea></div>' +
          '<div class="hicm-cwrap" data-wrap="js"><textarea></textarea></div>' +
        '</div>' +
        '<div class="hicm-panel" data-panel="ai" style="display:none">' +
          '<div class="hicm-aiwrap">' +
            '<div class="hicm-aisub">' +
              '<button type="button" class="hicm-aisub-btn active" data-aiview="get">Get AI Code</button>' +
              '<button type="button" class="hicm-aisub-btn" data-aiview="paste">Paste Reply</button>' +
              '<span class="hicm-aistatus"></span>' +
            '</div>' +
            '<div class="hicm-aiview active" data-ai="get">' +
              (opts.prompts && opts.prompts.length ? '<div class="hicm-step">1 · Pick a ready-made brief (or write your own)</div><div class="hicm-chips"></div>' : '') +
              '<textarea class="hicm-ta aiwant" rows="3" placeholder="Describe what you want — e.g. A kinetic-typography intro: the word STUDIO slams in letter by letter."></textarea>' +
              '<div class="hicm-aactions">' +
                '<button type="button" class="hicm-btn hicm-bcopy copybtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy AI Prompt</button>' +
                '<a class="hicm-link" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini ↗</a>' +
                '<a class="hicm-link" href="https://chatgpt.com" target="_blank" rel="noopener">ChatGPT ↗</a>' +
                '<a class="hicm-link" href="https://claude.ai/new" target="_blank" rel="noopener">Claude ↗</a>' +
              '</div>' +
              (opts.aiNote ? '<p class="hicm-note">' + opts.aiNote + '</p>' : '') +
            '</div>' +
            '<div class="hicm-aiview" data-ai="paste">' +
              '<textarea class="hicm-ta mono aireply" style="flex:1;min-height:160px" placeholder="Paste the AI\'s whole reply — ```html / ```css / ```js blocks, a full HTML document, or plain markup all parse and apply automatically…"></textarea>' +
              '<div class="hicm-aactions">' +
                '<button type="button" class="hicm-btn hicm-bapply aireplybtn"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.1 6.4 6.4 1.6-6.4 1.6L12 18l-2.1-6.4-6.4-1.6 6.4-1.6z"/></svg>Parse &amp; Apply</button>' +
                '<button type="button" class="hicm-btn hicm-bquiet aireplyclear">Clear</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
    document.body.appendChild(root);

    /* extra header buttons + extra AI views from the host */
    var hextra = root.querySelector('.hicm-hextra');
    (opts.headerButtons || []).forEach(function(b) {
        var btn = document.createElement('button');
        btn.className = 'hicm-hbtn'; btn.title = b.title || ''; btn.innerHTML = b.svg || '';
        btn.addEventListener('click', function() { b.onClick(api); });
        hextra.appendChild(btn);
    });
    var aiSubRow = root.querySelector('.hicm-aisub');
    var aiWrap = root.querySelector('.hicm-aiwrap');
    (opts.aiViews || []).forEach(function(v) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'hicm-aisub-btn'; b.setAttribute('data-aiview', v.id); b.textContent = v.label;
        aiSubRow.insertBefore(b, aiSubRow.querySelector('.hicm-aistatus'));
        var body = document.createElement('div');
        body.className = 'hicm-aiview'; body.setAttribute('data-ai', v.id);
        aiWrap.appendChild(body);
        v.build(body, api);
    });

    /* ── refs ── */
    var $ = function(s) { return root.querySelector(s); };
    var $$ = function(s) { return [].slice.call(root.querySelectorAll(s)); };
    var el = {
        overlay: root, modal: $('.hicm-modal'), title: $('.hicm-title'), meta: $('.hicm-meta'),
        canvas: $('canvas'), ctx: $('canvas').getContext('2d'), zone: $('.hicm-zone'),
        cplay: $('.hicm-cplay'), playBtn: $('.hicm-obtn.play'), playIcon: $('.hicm-obtn.play svg:first-child'),
        pauseIcon: $('.hicm-obtn.play svg:last-child'), slider: $('.hicm-sr'), time: $('.hicm-time .cur'),
        total: $('.hicm-total'), progress: $('.hicm-progress'), fill: $('.hicm-fill'), dot: $('.hicm-dot'), fsBtn: $('.hicm-obtn.fs'),
        resBtn: $('.hicm-resbtn'), resMenu: $('.resmenu'), resCur: $('.rescur'),
        frameHost: $('.hicm-framehost'), frameBtn: $('.framebtn'), frameCaret: $('.framecaret'), frameMenu: $('.framemenu'),
        vBtn: $('.vbtn'), vCaret: $('.vcaret'), vMenu: $('.vmenu'), vSplit: $('[data-split=video]'),
        panels: {}, tabs: $$('.hicm-tab'),
        badges: $('.hicm-badge'), galBtn: $('.galbtn'), galMenu: $('.galmenu'), galName: $('.galname'),
        galSave: $('.galsave'), galList: $('.glist'), galCount: $('.galcount'),
        impBtn: $('.impbtn'), impFile: $('.impfile'),
        ceBtn: $('.cebtn'), ceCaret: $('.cecaret'), ceMenu: $('.cemenu'),
        resetBtn: $('.resetbtn'), applyBtn: $('.applybtn'),
        aiWant: $('.aiwant'), aiReply: $('.aireply'), aiCopy: $('.copybtn'), aiParse: $('.aireplybtn'), aiClear: $('.aireplyclear'),
        aiStatus: $('.hicm-aistatus'), chips: $('.hicm-chips')
    };
    $$('[data-panel]').forEach(function(p) { el.panels[p.getAttribute('data-panel')] = p; });

    /* ── state ── */
    var clip = null, renderer = null, playing = false, start = 0, open = false;
    var resState = { value: '1080' };
    var frameFmt = 'png', fps = 30, exporting = false;
    var curLang = 'html', applied = null, cm = {};
    var frameCtl = null, statusTimer = null;
    try { var saved = readExpPrefs(); if (saved.fmt && FMT_META[saved.fmt]) frameFmt = saved.fmt; if (saved.fps === 30 || saved.fps === 60) fps = saved.fps; if (RESOLUTIONS[saved.res]) resState.value = saved.res; } catch(e) {}
    function savePrefs() { writeExpPrefs({ fmt: frameFmt, fps: fps, res: resState.value }); }
    el.resCur.textContent = RESOLUTIONS[resState.value].n + 'p';
    $$('.resopt').forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-res') === resState.value); });
    $$('.fmtopt').forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-fmt') === frameFmt); });
    $$('.fpsopt').forEach(function(o) { o.classList.toggle('selected', +o.getAttribute('data-fps') === fps); });

    /* ── helpers ── */
    function fmtTime(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function setStatus(msg, sticky) {
        el.aiStatus.textContent = msg || '';
        if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
        if (msg && !sticky) statusTimer = setTimeout(function() { el.aiStatus.textContent = ''; }, 4000);
    }
    function syncProgress(ms) {
        var dur = parseFloat(el.slider.max) || 1;
        var pct = Math.max(0, Math.min(100, (ms / dur) * 100));
        el.fill.style.width = pct + '%'; el.dot.style.left = pct + '%';
    }
    function anyMenuOpen() { return $$('.hicm-menu.open').length > 0 || (el.galMenu && el.galMenu.classList.contains('open')); }
    function closeMenus() { $$('.hicm-menu.open').forEach(function(m) { m.classList.remove('open'); }); $$('.hicm-caret.open, .hicm-vcaret.open, .hicm-resbtn.open, .cecaret.open').forEach(function(c) { c.classList.remove('open'); }); if (el.galMenu) el.galMenu.classList.remove('open'); }

    /* ── render loop ── */
    async function tick() {
        var dur = (clip && clip.dur ? clip.dur : 5) * 1000;
        while (playing && open) {
            var t = (performance.now() - start) % dur;
            el.slider.value = Math.floor(t);
            el.time.textContent = fmtTime(t);
            syncProgress(t);
            try {
                if (renderer && renderer._ready) {
                    var ok = await renderer.renderFrame(t);
                    if (ok) renderer.drawFrame(el.ctx, el.canvas.width, el.canvas.height);
                }
            } catch(e) {}
            await new Promise(function(r) { requestAnimationFrame(r); });
        }
    }
    function setPlayState(p) {
        playing = p;
        el.zone.classList.toggle('playing', p);
        el.playIcon.style.display = p ? 'none' : '';
        el.pauseIcon.style.display = p ? '' : 'none';
        el.playBtn.title = p ? 'Pause' : 'Play';
    }
    function seekTo(t) {
        t = Math.max(0, Math.min(parseFloat(el.slider.max) || 0, t));
        el.slider.value = String(t);
        el.time.textContent = fmtTime(t);
        syncProgress(t);
        if (renderer && renderer._ready) {
            renderer.renderFrame(t).then(function(ok) { if (ok) renderer.drawFrame(el.ctx, el.canvas.width, el.canvas.height); });
        }
    }
    el.playBtn.addEventListener('click', function() {
        if (playing) { setPlayState(false); }
        else { setPlayState(true); start = performance.now() - parseInt(el.slider.value); tick(); }
    });
    el.cplay.addEventListener('click', function() { el.playBtn.click(); });
    el.slider.addEventListener('input', function() { if (!playing) seekTo(parseInt(this.value)); });
    (function() {
        var dragging = false;
        function seek(e) {
            var r = el.progress.getBoundingClientRect();
            var frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            seekTo(Math.round(frac * (parseFloat(el.slider.max) || 0)));
        }
        el.progress.addEventListener('pointerdown', function(e) { dragging = true; el.progress.classList.add('dragging'); el.progress.setPointerCapture(e.pointerId); seek(e); });
        el.progress.addEventListener('pointermove', function(e) { if (dragging) seek(e); });
        var end = function() { dragging = false; el.progress.classList.remove('dragging'); };
        el.progress.addEventListener('pointerup', end); el.progress.addEventListener('pointercancel', end);
    })();
    el.fsBtn.addEventListener('click', function() {
        if (document.fullscreenElement) document.exitFullscreen();
        else el.zone.requestFullscreen().catch(function() {});
    });
    document.addEventListener('keydown', function(e) {
        if (!open) return;
        var tag = (e.target && e.target.tagName || '').toLowerCase();
        var typing = tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable);
        if (e.key === 'Escape') { if (anyMenuOpen()) { closeMenus(); return; } if (!document.fullscreenElement) api.close(); return; }
        if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === ' ') { e.preventDefault(); el.playBtn.click(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seekTo((parseInt(el.slider.value) || 0) + (e.key === 'ArrowRight' ? 1000 : -1000)); }
        else if (e.key === 'f' || e.key === 'F') { el.fsBtn.click(); }
    });

    /* ── resolution menu ── */
    function setRes(v) {
        if (!RESOLUTIONS[v] || resState.value === v) return;
        resState.value = v;
        el.resCur.textContent = RESOLUTIONS[v].n + 'p';
        $$('.resopt').forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-res') === v); });
    }
    el.resBtn.addEventListener('click', function(e) { e.stopPropagation(); closeMenus(); el.resMenu.classList.toggle('open'); el.resBtn.classList.toggle('open'); });
    el.resMenu.addEventListener('click', function(e) {
        var item = e.target.closest('.resopt'); if (!item) return;
        e.stopPropagation(); closeMenus(); setRes(item.getAttribute('data-res')); applyFrame(); savePrefs();
    });

    /* ── frame controls (shared hic-frame.js) ── */
    function applyFrame() {
        var fd = frameDims(parseInt(resState.value) || 1080);
        el.canvas.width = fd.w; el.canvas.height = fd.h;
        el.modal.classList.toggle('portrait', fd.h > fd.w);
        if (frameCtl) frameCtl.sync();
        rebuildIfDsChanged();
    }
    function rebuildIfDsChanged() {
        if (renderer && renderer._ready && clip) {
            var ds = dsDims(curFrame.clipDS);
            if (renderer.sw !== ds.w || renderer.sh !== ds.h) {
                renderer.sandbox.remove(); renderer = null;
                makeRenderer().then(function() { seekTo(parseInt(el.slider.value) || 0); });
            } else seekTo(parseInt(el.slider.value) || 0);
        }
    }
    function makeRenderer() {
        var ds = dsDims(curFrame.clipDS);
        renderer = makeHicRenderer(ds.w, ds.h, ds.w, ds.h);
        var code = applied || { html: clip.html, css: clip.css, js: clip.js };
        return renderer.setClip(code.html, code.css, code.js);
    }

    /* ── export menus ── */
    el.frameCaret.addEventListener('click', function(e) { e.stopPropagation(); closeMenus(); el.frameMenu.classList.toggle('open'); el.frameCaret.classList.toggle('open'); });
    el.frameMenu.addEventListener('click', function(e) {
        var item = e.target.closest('.fmtopt'); if (!item) return;
        e.stopPropagation(); closeMenus(); frameFmt = item.getAttribute('data-fmt');
        $$('.fmtopt').forEach(function(o) { o.classList.toggle('selected', o.getAttribute('data-fmt') === frameFmt); });
        savePrefs();
    });
    el.vCaret.addEventListener('click', function(e) { e.stopPropagation(); closeMenus(); el.vMenu.classList.toggle('open'); el.vCaret.classList.toggle('open'); });
    el.vMenu.addEventListener('click', function(e) {
        var item = e.target.closest('.fpsopt'); if (!item) return;
        e.stopPropagation(); closeMenus(); fps = +item.getAttribute('data-fps');
        $$('.fpsopt').forEach(function(o) { o.classList.toggle('selected', +o.getAttribute('data-fps') === fps); });
        el.vBtn.title = 'Record video (WebM ' + fps + 'fps)'; savePrefs();
    });
    document.addEventListener('click', function(e) { if (open && !e.target.closest('.hicm-split') && !e.target.closest('.hicm-gmenu') && !e.target.closest('.galbtn')) closeMenus(); });

    /* ── Save Frame (detached renderer, live state untouched) ── */
    el.frameBtn.addEventListener('click', function() {
        if (exporting || !clip) return;
        exporting = true; lock(true);
        try {
            var fd = frameDims(parseInt(resState.value) || 1080);
            var ds = dsDims(curFrame.clipDS);
            /* Raster native frame size when aspects match (SVG-native upscale
             * keeps text sharp); design size otherwise, composited by
             * drawFrame's contain-fit (ported from the test-renderer). */
            var sameAspect = Math.abs((fd.w / fd.h) - (ds.w / ds.h)) < 0.004;
            var r = makeHicRenderer(sameAspect ? fd.w : ds.w, sameAspect ? fd.h : ds.h, ds.w, ds.h);
            var code = applied || { html: clip.html, css: clip.css, js: clip.js };
            r.setClip(code.html, code.css, code.js).then(function() {
                return r.renderFrame(parseInt(el.slider.value) || 0);
            }).then(function(ok) {
                if (!ok) throw new Error('render failed');
                /* Transparent + matched frame ships the raster as-is to keep real alpha */
                var out;
                if (sameAspect && curFrame.bg === 'transparent') { out = r.canvas; }
                else {
                    out = document.createElement('canvas');
                    out.width = fd.w; out.height = fd.h;
                    r.drawFrame(out.getContext('2d'), fd.w, fd.h);
                }
                var mime = FMT_META[frameFmt].mime;
                out.toBlob(function(blob) {
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = exportStem() + '_frame_' + Math.round(parseInt(el.slider.value) || 0) + 'ms_' + fd.w + 'x' + fd.h + '.' + FMT_META[frameFmt].ext;
                    a.click(); setTimeout(function() { URL.revokeObjectURL(a.href); }, 4000);
                    r.sandbox.remove();
                }, mime, frameFmt === 'jpeg' ? 0.92 : undefined);
            }).catch(function(err) { console.error('[hic-modal] frame export:', err); r.sandbox.remove(); })
              .finally(function() { exporting = false; lock(false); });
        } catch(e) { exporting = false; lock(false); }
    });
    function exportStem() {
        var t = (el.title.textContent || 'clip');
        return t.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().replace(/\s+/g, '_') || 'clip';
    }
    function lock(on) { [el.frameBtn, el.frameCaret, el.vBtn, el.vCaret, el.resBtn].forEach(function(b) { if (b) b.disabled = on; }); }

    /* ── Export WebM — wall-clock-paced recording (ported from the
     * test-renderer). MediaRecorder timestamps frames by when the canvas
     * actually changes, so frame N must be drawn ~N/fps seconds after start;
     * rendering flat-out compresses the timeline (a 3s choreography lands as
     * a ~1.5s double-speed video). Codec falls back VP9 -> webm; the raster
     * is native frame size on aspect match, design size + contain-fit else. */
    el.vBtn.addEventListener('click', function() {
        if (exporting || !clip) return;
        exporting = true; lock(true); el.vSplit.classList.add('rec');
        setPlayState(false); closeMenus();
        var fd = frameDims(parseInt(resState.value) || 1080);
        var ds = dsDims(curFrame.clipDS);
        var sameAspect = Math.abs((fd.w / fd.h) - (ds.w / ds.h)) < 0.004;
        var r = makeHicRenderer(sameAspect ? fd.w : ds.w, sameAspect ? fd.h : ds.h, ds.w, ds.h);
        var code = applied || { html: clip.html, css: clip.css, js: clip.js };
        var dur = (clip.dur || 5) * 1000;
        var out = document.createElement('canvas'); out.width = fd.w; out.height = fd.h;
        var octx = out.getContext('2d');
        var stream = out.captureStream(fps);
        var mimeType = 'video/webm;codecs=vp9';
        if (window.MediaRecorder && !MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
        var rec = new MediaRecorder(stream, { mimeType: mimeType, videoBitsPerSecond: 8000000 });
        var chunks = [];
        rec.ondataavailable = function(e) { if (e.data && e.data.size) chunks.push(e.data); };
        var stopped = new Promise(function(resolve) {
            rec.onstop = function() {
                var raw = new Blob(chunks, { type: 'video/webm' });
                if (raw.size > 100) {
                    /* MediaRecorder never writes the WebM Duration element, so
                     * players can't seek/scale progress (scrubber stuck at 0).
                     * Patch it in with the known clip length before download. */
                    var finish = function(blob) {
                        var a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = exportStem() + '_' + fd.w + 'x' + fd.h + '_' + String(curFrame.aspect || '').replace(':', '') + '.webm';
                        a.click(); setTimeout(function() { URL.revokeObjectURL(a.href); }, 6000);
                    };
                    if (window.ysFixWebmDuration) {
                        /* dur + the 1s end-state hold below = the stream's real span */
                        ysFixWebmDuration(raw, Math.round(dur) + 1000).then(finish).catch(function(e) {
                            console.warn('[hic-modal] duration patch failed, saving raw:', e); finish(raw);
                        });
                    } else finish(raw);
                } else setStatus('Export failed \u2014 try again');
                r.sandbox.remove(); exporting = false; el.vSplit.classList.remove('rec'); lock(false);
                resolve();
            };
        });
        var run = r.setClip(code.html, code.css, code.js).then(function() {
            rec.start();
            /* Drive onFrame with ACTUAL elapsed wall time: MediaRecorder
               stamps frames when the canvas changes, so whatever frame lands
               whenever must carry the phase for its own timestamp. (An
               idealized 1/fps grid desyncs as soon as a raster overruns its
               slot; the stream then stretches while the patched Duration
               stays nominal — players quit early or scrub wrong.) */
            var wallStart = performance.now();
            var tick = function() {
                var t = performance.now() - wallStart;
                if (t >= dur) {
                    return r.renderFrame(dur - 1).then(function(ok) { if (ok) r.drawFrame(octx, fd.w, fd.h); });
                }
                return r.renderFrame(Math.min(t, dur - 1)).then(function(ok) {
                    if (ok) r.drawFrame(octx, fd.w, fd.h);
                    return new Promise(function(rs) { requestAnimationFrame(rs); });
                }).then(tick);
            };
            return tick().then(function() {
                /* Hold the completed end-state ~1s (included in the patched
                   Duration) so the video never ends mid-motion. */
                return new Promise(function(rs) { setTimeout(rs, 1000); });
            }).then(function() { rec.stop(); return stopped; });
        });
        run.catch(function(err) {
            console.error('[hic-modal] webm export:', err);
            try { rec.stop(); } catch (e2) {}
            setStatus('Export failed');
            r.sandbox.remove(); exporting = false; el.vSplit.classList.remove('rec'); lock(false);
        });
    });

    /* ── tabs ── */
    el.tabs.forEach(function(t) { t.addEventListener('click', function() { showTab(t.getAttribute('data-tab')); }); });
    function showTab(name) {
        el.tabs.forEach(function(t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
        Object.keys(el.panels).forEach(function(k) { el.panels[k].style.display = k === name ? '' : 'none'; });
        if (name === 'code') fillEditors();
        if (name === 'code') setTimeout(function() { Object.keys(cm).forEach(function(k) { cm[k].refresh(); }); }, 30);
    }

    /* ── CodeMirror editors ── */
    var draftTimer = 0;
    ['html', 'css', 'js'].forEach(function(lang) {
        var wrap = root.querySelector('[data-wrap="' + lang + '"] textarea');
        cm[lang] = CodeMirror.fromTextArea(wrap, { theme: 'hic-dark', height: '100%', lineNumbers: true, lineWrapping: true, tabSize: 2, mode: lang === 'html' ? 'htmlmixed' : (lang === 'js' ? 'javascript' : lang) });
        cm[lang].on('change', function() {
            updateBadge();
            if (opts.onEditorsChange) {
                clearTimeout(draftTimer);
                draftTimer = setTimeout(function() { opts.onEditorsChange(api.getEditors()); }, 1200);
            }
        });
    });
    function updateBadge() {
        if (!clip) return;
        var code = { html: cm.html.getValue(), css: cm.css.getValue(), js: cm.js.getValue() };
        /* Baseline is what fillEditors actually put in the editors — the
         * PRETTIFIED clip — not the raw clip. Comparing against raw made the
         * Unsaved badge light up immediately on open whenever a prettify
         * hook was configured. */
        var base = prettified(applied || { html: clip.html, css: clip.css, js: clip.js });
        var dirty = code.html !== base.html || code.css !== base.css || code.js !== base.js;
        el.badges.classList.toggle('on', dirty);
        el.resetBtn.disabled = !dirty;
    }
    function prettified(code) {
        if (!opts.prettify) return code;
        try { return opts.prettify(code); } catch (e) { return code; }
    }
    function fillEditors() {
        var code = prettified(applied || { html: clip.html, css: clip.css, js: clip.js });
        if (cm.html.getValue() !== code.html) cm.html.setValue(code.html);
        if (cm.css.getValue() !== code.css) cm.css.setValue(code.css);
        if (cm.js.getValue() !== code.js) cm.js.setValue(code.js);
        updateBadge();
    }
    $$('.hicm-ctab').forEach(function(b) { b.addEventListener('click', function() {
        curLang = b.getAttribute('data-lang');
        $$('.hicm-ctab').forEach(function(x) { x.classList.toggle('active', x === b); });
        $$('.hicm-cwrap').forEach(function(w) { w.classList.toggle('active', w.getAttribute('data-wrap') === curLang); });
        setTimeout(function() { cm[curLang].refresh(); }, 10);
    }); });
    /* Apply engine (ported from the test-renderer): edited/AI code renders at
     * the CURRENT frame aspect — a 9:16 frame gets a native 450x800 stage —
     * and a <title> in the code refreshes the display name. */
    function applyCodeToStage(code, after) {
        setPlayState(false);
        curFrame.clipDS = DESIGN_SPACES[curFrame.aspect] ? curFrame.aspect : '16:9';
        if (renderer) { renderer.sandbox.remove(); renderer = null; }
        var ds = dsDims(curFrame.clipDS);
        var tm = (code.html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (tm && tm[1].trim()) el.title.textContent = tm[1].replace(/\s+/g, ' ').trim().slice(0, 80);
        renderer = makeHicRenderer(ds.w, ds.h, ds.w, ds.h);
        return renderer.setClip(code.html, code.css, code.js).then(function() {
            seekTo(0);
            if (after) after();
        });
    }
    el.applyBtn.addEventListener('click', function() {
        var code = { html: cm.html.getValue(), css: cm.css.getValue(), js: cm.js.getValue() };
        applied = code;
        if (opts.applyCode) opts.applyCode(code, 'edit');
        updateBadge();
        applyCodeToStage(code, function() { showTab('preview'); setPlayState(true); start = performance.now(); tick(); });
        setStatus('Applied to stage');
    });
    el.resetBtn.addEventListener('click', function() {
        if (!clip) return;
        if (!el.resetBtn.classList.contains('danger-confirm') && applied) {
            el.resetBtn.classList.add('danger-confirm'); el.resetBtn.lastChild.textContent = ' Sure?';
            setTimeout(function() { el.resetBtn.classList.remove('danger-confirm'); el.resetBtn.lastChild.textContent = 'Reset'; }, 2200);
            return;
        }
        applied = null;
        if (opts.applyCode) opts.applyCode({ html: clip.html, css: clip.css, js: clip.js }, 'reset');
        fillEditors();
        rebuildStage(null);
        setStatus('Restored original code');
    });

    /* code export (json / standalone) */
    el.ceCaret.addEventListener('click', function(e) { e.stopPropagation(); closeMenus(); el.ceMenu.classList.toggle('open'); el.ceCaret.classList.toggle('open'); });
    el.ceMenu.addEventListener('click', function(e) {
        var item = e.target.closest('[data-cexp]'); if (!item) return;
        e.stopPropagation(); closeMenus();
        var code = applied || { html: clip.html, css: clip.css, js: clip.js };
        if (item.getAttribute('data-cexp') === 'json') {
            var payload = { hicCode: true, name: el.title.textContent, dur: clip.dur, html: code.html, css: code.css, js: code.js };
            download(JSON.stringify(payload, null, 2), exportStem() + '_code.json', 'application/json');
        } else {
            var html = buildStandalone(code);
            download(html, exportStem() + '_standalone.html', 'text/html');
        }
    });
    function download(content, name, mime) {
        var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 4000);
    }
    function buildStandalone(code) {
        if (opts.buildStandalone) return opts.buildStandalone(code, el.title.textContent, (clip && clip.dur || 5) * 1000);
        var emoji = ['🎨','🎹','⭐','👉','🤯','👀','🤟','🤌','👌','👍','🤘','☝️','✌️'][Math.floor(Math.random() * 13)];
        return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>' + el.title.textContent + '</title>\n<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><text y=\'.9em\' font-size=\'90\'>' + emoji + '</text></svg>">\n<style>html,body{margin:0;height:100%;overflow:hidden}' + code.css + '</style>\n</head>\n<body>\n' + code.html + '\n<script>\n' + code.js + '\n;(function(){var t0=performance.now();function loop(){var t=performance.now()-t0;try{onFrame(t)}catch(e){}requestAnimationFrame(loop)}loop();})();\n<\/script>\n</body>\n</html>';
    }

    /* Adopt a new clip length (imported film / JSON payload) — slider, clock
       and meta follow, and tick() reads clip.dur live so playback loops the
       whole imported timeline instead of the host clip's old length. */
    function setClipDur(sec) {
        if (!clip || !sec || !(sec > 0)) return;
        sec = Math.max(1, Math.min(600, Math.round(sec)));
        clip.dur = sec;
        var maxMs = sec * 1000;
        el.slider.max = String(maxMs);
        if (parseInt(el.slider.value, 10) > maxMs) el.slider.value = '0';
        el.total.textContent = fmtTime(maxMs);
        var d = dsDims(curFrame.clipDS);
        el.meta.textContent = sec + 's · ' + d.w + '×' + d.h;
    }

    /* import */
    if (feats.import) {
        el.impBtn.addEventListener('click', function() { el.impFile.click(); });
        el.impFile.addEventListener('change', function() {
            var f = el.impFile.files[0]; if (!f) return;
            var rd = new FileReader();
            rd.onload = function() {
                try {
                    var code = null, title = '', dur = 0;
                    try { var j = JSON.parse(rd.result); if (j && j.hicCode && j.html) { code = { html: j.html, css: j.css || '', js: j.js || '' }; title = j.name || ''; dur = j.dur > 0 ? j.dur : 0; } } catch(e) {}
                    if (!code) {
                        /* Anything else — a whole standalone document (a studio-reel
                           reel-preview.html film, an exported page), a fenced AI reply,
                           bare markup — goes through the tolerant parser so <style> and
                           inline <script> land in their own panes. The old fallback
                           dumped the ENTIRE document (doctype, head, runtime script)
                           into the HTML pane, which nothing could render. */
                        var txt = String(rd.result);
                        var parsed = opts.parseReply ? opts.parseReply(txt) : defaultParseReply(txt);
                        if (!parsed || (!parsed.html && !parsed.css && !parsed.js)) throw new Error('no code found in ' + f.name);
                        code = { html: parsed.html || '', css: parsed.css || '', js: parsed.js || '' };
                        title = parsed.title || '';
                        dur = parsed.dur || 0;
                        /* Put <title> back into the HTML pane — hosts read the title
                           from there (clipTitle / refreshClipTitle) for the modal title
                           and the export filename after Apply. */
                        if (title && !/<title/i.test(code.html)) code.html = '<title>' + title.replace(/[<>]/g, '') + '</title>' + (code.html ? '\n' + code.html : '');
                        /* Films carry their own length — var SB = {"total":ms…} — so a
                           74s reel doesn't inherit the host clip's 5s timeline. */
                        if (!dur) {
                            var _sb = txt.match(/var SB\s*=\s*\{[^{}]*?"total":\s*(\d+)/);
                            if (_sb) dur = Math.max(1, Math.min(600, parseInt(_sb[1], 10) / 1000));
                        }
                    }
                    cm.html.setValue(code.html); cm.css.setValue(code.css); cm.js.setValue(code.js);
                    if (title) el.title.textContent = title;
                    if (dur) setClipDur(dur);
                    if (opts.onImport) opts.onImport(code, { title: title, dur: dur });
                    /* Land the import on the stage immediately, exactly like a parsed
                       AI reply. Two reasons: importing a film is pointless until it
                       plays, and the Code tab's fillEditors() restores panes from
                           `applied` — imported-but-not-applied code would be silently
                           overwritten (with stale clip code) by the next tab switch. */
                    applied = code;
                    if (opts.applyCode) opts.applyCode(code, 'import');
                    updateBadge();
                    applyCodeToStage(code, function() { showTab('preview'); setPlayState(true); start = performance.now(); tick(); });
                    setStatus('Imported' + (title ? ' "' + title + '"' : '') + ' — applied to stage');
                } catch(e) { setStatus('Import failed: ' + e.message); }
            };
            rd.readAsText(f); el.impFile.value = '';
        });
    }

    /* gallery */
    function galByteSize(s) {
        var n = 0, i;
        for (i = 0; i < s.length; i++) n += s.charCodeAt(i) > 127 ? 2 : 1;
        return n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB';
    }
    function galRender() {
        if (!feats.gallery || !opts.gallery) return;
        var items = opts.gallery.list();
        el.galCount.textContent = items.length;
        el.galList.innerHTML = items.length ? '' : '<div class="hicm-gempty">No saved variants yet.<br>Edit the code and save it here.</div>';
        items.forEach(function(s, i) {
            var d = document.createElement('div'); d.className = 'hicm-gitem'; d.title = 'Click to load into the panes';
            var meta = (s.src || 'custom') + ' · ' + galByteSize((s.html || '') + (s.css || '') + (s.js || ''));
            d.innerHTML = '<div class="hicm-ginfo"><div class="hicm-gname"></div><div class="hicm-gmeta"></div></div>' +
                '<button class="hicm-gact" data-gdl title="Download as .json"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>' +
                '<button class="hicm-gact" data-gren title="Rename"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>' +
                '<button class="hicm-gact danger" data-gdel title="Delete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
            d.querySelector('.hicm-gname').textContent = s.name;
            d.querySelector('.hicm-gmeta').textContent = meta;
            d.addEventListener('click', function(ev) {
                ev.stopPropagation();
                if (ev.target.closest('[data-gdl]')) {
                    download(JSON.stringify({ hicCode: true, name: s.name, dur: clip && clip.dur, html: s.html, css: s.css, js: s.js }, null, 2), s.name.replace(/[^a-z0-9_-]+/gi, '_') + '_code.json', 'application/json');
                } else if (ev.target.closest('[data-gren]')) {
                    var info = d.querySelector('.hicm-ginfo');
                    if (info.querySelector('.hicm-gren')) return;
                    var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'hicm-gren'; inp.value = s.name; inp.maxLength = 60;
                    info.replaceWith(inp); inp.focus(); inp.select();
                    var done = function(commit) {
                        if (commit) { var nn = (inp.value || '').trim(); if (nn && nn !== s.name && opts.gallery.rename) opts.gallery.rename(s.id || i, nn); }
                        galRender();
                    };
                    inp.addEventListener('keydown', function(e2) { if (e2.key === 'Enter') done(true); else if (e2.key === 'Escape') done(false); e2.stopPropagation(); });
                    inp.addEventListener('blur', function() { done(true); });
                } else if (ev.target.closest('[data-gdel]')) {
                    var del = ev.target.closest('[data-gdel]');
                    if (del.classList.contains('confirm')) { opts.gallery.remove(s.id || i); galRender(); }
                    else { del.classList.add('confirm'); del.textContent = 'Sure?'; setTimeout(function() { galRender(); }, 2200); }
                } else {
                    cm.html.setValue(s.html || ''); cm.css.setValue(s.css || ''); cm.js.setValue(s.js || '');
                    closeMenus(); setStatus('Loaded "' + s.name + '" — Apply to preview');
                }
            });
            el.galList.appendChild(d);
        });
    }
    if (feats.gallery && opts.gallery) {
        el.galBtn.addEventListener('click', function(e) { e.stopPropagation(); closeMenus(); el.galMenu.classList.toggle('open'); galRender(); });
        el.galMenu.addEventListener('click', function(e) { e.stopPropagation(); });
        el.galSave.addEventListener('click', function() {
            var name = (el.galName.value || '').trim() || ('Variant ' + new Date().toLocaleTimeString());
            opts.gallery.save(name, { html: cm.html.getValue(), css: cm.css.getValue(), js: cm.js.getValue() });
            el.galName.value = ''; galRender(); setStatus('Saved "' + name + '"');
        });
        el.galName.addEventListener('keydown', function(e) { if (e.key === 'Enter') el.galSave.click(); });
    }

    /* ── AI tab ── */
    var aiSubBtns = $$('.hicm-aisub-btn');
    aiSubBtns.forEach(function(b) { b.addEventListener('click', function() {
        aiSubBtns.forEach(function(x) { x.classList.toggle('active', x === b); });
        $$('.hicm-aiview').forEach(function(v) { v.classList.toggle('active', v.getAttribute('data-ai') === b.getAttribute('data-aiview')); });
    }); });
    if (el.chips && opts.prompts) {
        opts.prompts.forEach(function(p) {
            var c = document.createElement('div'); c.className = 'hicm-chipcard';
            c.innerHTML = '<button type="button" class="hicm-chipmain"><span class="t"></span><span class="d"></span></button>' +
                '<button type="button" class="hicm-chipcopy" title="Copy this prompt"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>';
            c.querySelector('.t').textContent = p.t; c.querySelector('.d').textContent = p.d || '';
            c.querySelector('.hicm-chipmain').addEventListener('click', function() { el.aiWant.value = p.brief; setStatus('Brief loaded — copy the prompt'); });
            c.querySelector('.hicm-chipcopy').addEventListener('click', function() { copyText(opts.buildPrompt ? opts.buildPrompt(p.brief) : p.brief); setStatus('Prompt copied'); });
            el.chips.appendChild(c);
        });
    }
    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch(e) {} ta.remove();
        return Promise.resolve();
    }
    el.aiCopy.addEventListener('click', function() { copyText(opts.buildPrompt ? opts.buildPrompt(el.aiWant.value.trim()) : el.aiWant.value.trim()); setStatus('Full prompt copied — paste it into your AI'); });
    el.aiClear.addEventListener('click', function() { el.aiReply.value = ''; setStatus(''); });
    el.aiReply.addEventListener('paste', function() {
        setTimeout(function() { if ((el.aiReply.value || '').trim()) el.aiParse.click(); }, 60);
    });
    el.aiParse.addEventListener('click', function() {
        var text = el.aiReply.value;
        if (!text.trim()) { setStatus('Paste the AI reply first'); return; }
        var parsed = opts.parseReply ? opts.parseReply(text) : defaultParseReply(text);
        if (!parsed || (!parsed.html && !parsed.css && !parsed.js)) { setStatus('Could not find any code in the pasted text.'); return; }
        if (parsed.title) el.title.textContent = parsed.title;
        if (parsed.ds && DESIGN_SPACES[parsed.ds]) { curFrame.aspect = parsed.ds; curFrame.clipDS = parsed.ds; applyFrame(); }
        applied = { html: parsed.html || '', css: parsed.css || '', js: parsed.js || '' };
        el.aiReply.value = '';
        if (opts.applyCode) opts.applyCode(applied, 'ai');
        if (opts.onAiCode) opts.onAiCode(applied, parsed);
        applyCodeToStage(applied, function() { showTab('preview'); setPlayState(true); start = performance.now(); tick(); });
        var parts = [];
        if (parsed.html) parts.push('HTML');
        if (parsed.css) parts.push('CSS');
        if (parsed.js) parts.push('JS');
        if (parsed.title) parts.push('"' + parsed.title + '"');
        if (parsed.ds) parts.push(parsed.ds + ' native');
        setStatus('Inserted ' + parts.join(' · ') + ' — applied to stage');
    });
    /* Tolerant reply parser — ported from the test-renderer: fenced blocks,
     * whole HTML docs (keeping <head> CDN refs), bare markup, title + ds marker. */
    function defaultParseReply(text) {
        var res = { html: '', css: '', js: '', title: '', ds: '' };
        text = (text || '').replace(/\r\n?/g, '\n').trim();
        if (!text) return res;
        var _tm = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (_tm && _tm[1].trim()) res.title = _tm[1].replace(/\s+/g, ' ').trim().slice(0, 80);
        var _ds = text.match(/<!--\s*ds:(16:9|9:16|1:1|4:5)\s*-->/i);
        if (_ds && DESIGN_SPACES[_ds[1]]) res.ds = _ds[1];
        var fenceRe = /```([a-zA-Z0-9]*)[ \t]*\n([\s\S]*?)```/g;
        var blocks = [], m;
        while ((m = fenceRe.exec(text)) !== null) blocks.push({ lang: (m[1] || '').toLowerCase(), code: m[2].trim() });
        var looksCss = function(s) { return /(^|\n)\s*[.#@a-zA-Z\[][^{};]*\{[^}]*:/.test(s) && !/</.test(s); };
        var looksJs = function(s) { return /\b(function|onFrame|=>|var |let |const |document\.)/.test(s) && !/^\s*</.test(s); };
        var looksHtml = function(s) { return /^\s*<\/?[a-zA-Z!]/.test(s); };
        if (blocks.length) {
            blocks.forEach(function(b) {
                if (b.lang === 'css' || (!b.lang && looksCss(b.code))) res.css += (res.css ? '\n\n' : '') + b.code;
                else if (b.lang === 'js' || b.lang === 'javascript' || (!b.lang && looksJs(b.code) && !looksHtml(b.code))) res.js += (res.js ? '\n\n' : '') + b.code;
                else res.html += (res.html ? '\n' : '') + b.code;
            });
        } else {
            var s = text;
            s = s.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function(_, css) { res.css += (res.css ? '\n\n' : '') + css.trim(); return ''; });
            s = s.replace(/<script(?![^>]*(?:\bsrc=|type="application\/json"))[^>]*>([\s\S]*?)<\/script>/gi, function(_, js) { res.js += (res.js ? '\n\n' : '') + js.trim(); return ''; });
            s = s.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<\/?html[^>]*>/gi, '').replace(/<head[^>]*>([\s\S]*?)<\/head>/gi, function(_, head) {
                var keep = Array.from(head.matchAll(/<(script\b[^>]*\bsrc=[^>]*>[\s\S]*?<\/script>|link\b[^>]*\brel=[^>]*stylesheet[^>]*>)/gi)).map(function(x) { return x[0]; }).join('\n');
                return keep ? '\n' + keep + '\n' : '';
            }).replace(/<\/?body[^>]*>/gi, '').replace(/<meta[^>]*>/gi, '').replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
            res.html = s.trim();
        }
        if (res.html && /<style|<script/i.test(res.html)) {
            res.html = res.html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, function(_, css) { res.css += (res.css ? '\n\n' : '') + css.trim(); return ''; });
            res.html = res.html.replace(/<script(?![^>]*(?:\bsrc=|type="application\/json"))[^>]*>([\s\S]*?)<\/script>/gi, function(_, js) { res.js += (res.js ? '\n\n' : '') + js.trim(); return ''; });
            res.html = res.html.trim();
        }
        return res;
    }

    /* ── stage rebuild ── */
    function rebuildStage(after) {
        if (renderer) { renderer.sandbox.remove(); renderer = null; }
        if (!clip) return;
        makeRenderer().then(function() {
            if (after) after();
            else seekTo(0);
        });
    }

    /* ── frame controls mount ── */
    frameCtl = mountFrameControls(el.frameHost, {
        isLocked: function() { return exporting; },
        onFrame: function() { applyFrame(); }
    });

    /* ── open / close ── */
    var api = {
        root: root,
        open: function(c) {
            clip = c;
            curFrame.clipDS = (c.ds && DESIGN_SPACES[c.ds]) ? c.ds : '16:9';
            if (c.ds && DESIGN_SPACES[c.ds]) curFrame.aspect = c.ds;
            applied = (opts.getStageCode && opts.getStageCode()) || null;
            el.title.textContent = clipTitle(c.html) || c.name;
            var ds = dsDims(curFrame.clipDS);
            el.meta.textContent = (c.dur || 5) + 's · ' + ds.w + '×' + ds.h;
            el.total.textContent = fmtTime((c.dur || 5) * 1000);
            el.slider.max = (c.dur || 5) * 1000;
            el.slider.value = 0; el.time.textContent = '0:00'; syncProgress(0);
            open = true;
            root.classList.add('open');
            var startTab = c.startTab || (opts.hasStageCode && !opts.hasStageCode() ? 'ai' : 'preview');
            showTab(startTab);
            if (startTab === 'ai') setTimeout(function() { el.aiWant.focus(); }, 60);
            cm.html.setValue(''); cm.css.setValue(''); cm.js.setValue('');
            if (renderer) { renderer.sandbox.remove(); renderer = null; }
            applyFrame();
            var hasCode = c.html || c.css || c.js;
            if (hasCode) {
                makeRenderer().then(function() { seekTo(0); });
            } else if (opts.placeholder) {
                opts.placeholder(el.ctx, el.canvas.width, el.canvas.height);
            }
            galRender();
            if (opts.onOpen) opts.onOpen(clip);
        },
        close: function() {
            setPlayState(false); open = false;
            root.classList.remove('open');
            if (document.fullscreenElement) document.exitFullscreen().catch(function() {});
            if (opts.onClose) opts.onClose();
        },
        isOpen: function() { return open; },
        setTitle: function(t) { el.title.textContent = t; },
        setMeta: function(m) { el.meta.textContent = m; },
        setStageCode: function(code) { applied = code; updateBadge(); },
        getEditors: function() { return { html: cm.html.getValue(), css: cm.css.getValue(), js: cm.js.getValue() }; },
        setEditors: function(code) { cm.html.setValue(code.html); cm.css.setValue(code.css); cm.js.setValue(code.js); },
        showTab: showTab,
        showAiView: function(name) {
            aiSubBtns.forEach(function(x) { x.classList.toggle('active', x.getAttribute('data-aiview') === name); });
            $$('.hicm-aiview').forEach(function(v) { v.classList.toggle('active', v.getAttribute('data-ai') === name); });
        },
        aiWant: function(v) { if (v === undefined) return el.aiWant.value; el.aiWant.value = v; },
        setStatus: setStatus,
        copyText: copyText,
        download: download,
        exportStem: exportStem,
        seekTo: seekTo,
        el: el
    };
    root.addEventListener('click', function(e) { if (e.target === root) api.close(); });
    $('.hicm-close').addEventListener('click', function() { api.close(); });

    function clipTitle(html) {
        var m = (html || '').match(/<title>([^<]*)<\/title>/i);
        return m ? m[1].trim() : '';
    }
    return api;
}
window.createHicModal = createHicModal;
})();
