#!/usr/bin/env node
/* Seeds docs/html-in-canvas/designs-gallery.json from the test-renderer's
 * PRESETS (code designs) and AI_PROMPTS (brief-only designs). Run once;
 * the GitHub Action (Phase D) owns the file afterwards. */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'docs', 'html-in-canvas', 'test-renderer.html'), 'utf8');

function extractObject(name) {
    const start = src.indexOf('const ' + name + ' = {');
    if (start === -1) throw new Error(name + ' not found');
    let i = start + ('const ' + name + ' = ').length, depth = 0, inStr = null, esc = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start + ('const ' + name + ' = ').length, i);
}

function extractArray(name) {
    const start = src.indexOf('const ' + name + ' = [');
    if (start === -1) throw new Error(name + ' not found');
    let i = start + ('const ' + name + ' = ').length, depth = 0, inStr = null, esc = false;
    for (; i < src.length; i++) {
        const c = src[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === "'" || c === '"' || c === '`') { inStr = c; continue; }
        if (c === '[') depth++;
        else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
    }
    return src.slice(start + ('const ' + name + ' = ').length, i);
}

/* Evaluate the extracted literals in a sandbox scope */
const PRESETS = new Function('return (' + extractObject('PRESETS') + ')')();
const AI_PROMPTS = new Function('return (' + extractArray('AI_PROMPTS') + ')')();

function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function titleFrom(html, fallback) {
    const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return (m && m[1].replace(/\s+/g, ' ').trim()) || fallback;
}

const designs = [];

/* 1. Code designs from PRESETS — html normalized to carry <title> exactly like
 * the test-renderer's runtime backfill, so title-driven naming behaves the same */
for (const [key, p] of Object.entries(PRESETS)) {
    let html = p.html || '';
    const t = '<title>' + String(p.name || key).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</title>';
    if (/<title[^>]*>/i.test(html)) html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, t);
    else html = t + html;
    designs.push({
        id: 'd_' + key,
        title: titleFrom(html, p.name),
        creator: 'studio',
        tags: [p.cat || 'motion'],
        prompt: '(rendered design — code included)',
        duration: Math.round((p.dur || 5) * 1000),
        html: html,
        css: p.css || '',
        js: p.js || '',
        createdAt: '2026-09-18T00:00:00Z'
    });
}

/* 2. Brief-only designs from AI_PROMPTS (prompt ready to copy, no code yet) */
for (const pr of AI_PROMPTS) {
    designs.push({
        id: 'd_prompt-' + slug(pr.t),
        title: pr.t,
        creator: 'studio',
        tags: ['prompt'],
        prompt: pr.p,
        duration: 5000,
        html: '', css: '', js: '',
        createdAt: '2026-09-18T00:00:00Z'
    });
}

const out = { updatedAt: new Date().toISOString(), designs };
const outPath = path.join(__dirname, '..', 'docs', 'html-in-canvas', 'designs-gallery.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Seeded ' + designs.length + ' designs (' + Object.keys(PRESETS).length + ' code + ' + AI_PROMPTS.length + ' prompt-only) -> ' + outPath);
