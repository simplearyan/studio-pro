'use strict';
/* ── T1.9 — compile-time markdown ──────────────────────────────────────────
 * The MDX pattern (marked.parse at runtime) is script-banned in elements by
 * design: a preview whose copy depends on a parser fetching a CDN is the
 * runtime-JIT defect class this pipeline exists to keep out. So markdown is
 * preprocessed HERE, inside reel-compile, before the emitter runs — what
 * ships is static markup with no runtime dependency, through the same gates
 * every other element takes.
 *
 * Escape FIRST, then parse: the source is HTML-escaped before a single
 * block rule sees it, so authored `<script>` / raw markup can never become
 * markup — it lands as visible text. That makes the script ban moot on this
 * path by construction rather than by check.
 *
 * Deliberately a small, deterministic subset — no nested same-character
 * emphasis, no reference links, no tables — chosen for FILM copy (bold,
 * italic, code, links, lists, headings, rules). A prose renderer with a
 * thousand edge cases would be a second source of truth for how a line
 * breaks; this one is short enough to read.
 *
 * Every render is wrapped in <div class="hss-md"> and styled by MD_CSS,
 * which reel-compile appends to the clip's _tw slot ONLY when an md element
 * exists — films without markdown stay byte-identical (zero bytes). */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Only a URL that cannot execute is a URL. javascript:/data:/vbscript: (and
 * anything scheme-less that isn't a plain relative path) drop out of the
 * link form and stay visible text — a film is a public artefact. */
function safeHref(raw) {
  const u = String(raw).trim();
  if (/^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i.test(u)) return u.replace(/"/g, '%22');
  if (/^[^\s:]+$/.test(u)) return u.replace(/"/g, '%22'); // bare path / anchor text
  return null;
}

/* Inline rules, applied to already-escaped text. Code spans and links are
 * lifted to placeholders FIRST so later rules cannot reformat their
 * insides; placeholders are restored at the end. */
function inline(md) {
  const stash = [];
  const keep = (html) => {
    stash.push(html);
    return '\u0000' + (stash.length - 1) + '\u0000';
  };

  let s = md;
  s = s.replace(/`([^`]+)`/g, (_, c) => keep('<code>' + c + '</code>'));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const h = safeHref(href);
    return h ? keep('<a href="' + h + '">' + label + '</a>') : m;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)] || '');
}

/* Markdown source → static markup. Returns '' for empty/whitespace source
 * so the caller can report it as unapplied rather than shipping an empty
 * wrapper — the exact silent loss the pipeline's throwing defaults exist
 * to prevent. */
function renderMarkdown(src) {
  const text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  if (!text.trim()) return '';

  const escaped = escapeHtml(text);
  const blocks = escaped.split(/\n{2,}/);
  const out = [];

  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, '');
    if (!block) continue;

    let m;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      out.push('<hr>');
      continue;
    }
    if ((m = block.match(/^(#{1,6})\s+(.*)$/))) {
      const level = Math.min(m[1].length, 4); // h5/h6 would be no size at all on a film
      out.push('<h' + level + '>' + inline(m[2].trim()) + '</h' + level + '>');
      continue;
    }

    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-+*]\s+/.test(l))) {
      out.push('<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-+*]\s+/, '')) + '</li>').join('') + '</ul>');
      continue;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      out.push('<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*\d+[.)]\s+/, '')) + '</li>').join('') + '</ol>');
      continue;
    }
    if (lines.every((l) => /^\s*>\s?/.test(l))) {
      out.push('<blockquote>' + lines.map((l) => inline(l.replace(/^\s*>\s?/, ''))).join('<br>') + '</blockquote>');
      continue;
    }
    /* Paragraph: a single newline is a line break — film copy is authored
     * as lines, and CommonMark's "soft break renders as a space" would
     * silently reflow every storyboard line into one. */
    out.push('<p>' + lines.map(inline).join('<br>') + '</p>');
  }

  if (!out.length) return '';
  return '<div class="hss-md">' + out.join('') + '</div>';
}

/* The scoped reset, appended to the clip's _tw slot when md is used.
 * `all:unset` on the wrapper hands the document the ELEMENT's typography
 * (size, weight, colour, alignment all inherit), so a markdown paragraph
 * inside a title is title-sized and a body md block is body copy — the
 * element keeps its voice and the markdown only adds structure. */
const MD_CSS =
  '/*! reel: compile-time markdown (T1.9) — scoped to .hss-md, only when an md element exists */' +
  '.hss-md{all:unset;display:block;text-align:inherit}' +
  '.hss-md p{display:block;margin:.4em 0}' +
  '.hss-md h1,.hss-md h2,.hss-md h3,.hss-md h4{display:block;font-weight:700;line-height:1.2;margin:.5em 0 .3em}' +
  '.hss-md h1{font-size:1.7em}.hss-md h2{font-size:1.4em}.hss-md h3{font-size:1.15em}' +
  '.hss-md h4{font-size:.85em;letter-spacing:.12em;text-transform:uppercase;opacity:.85}' +
  '.hss-md ul,.hss-md ol{display:block;margin:.4em 0;padding-left:1.6em;text-align:left}' +
  '.hss-md ul{list-style:disc}.hss-md ol{list-style:decimal}' +
  '.hss-md li{display:list-item;margin:.18em 0}' +
  '.hss-md strong{font-weight:700}.hss-md em{font-style:italic}.hss-md del{opacity:.55;text-decoration:line-through}' +
  '.hss-md code{font-family:var(--hss-font-mono,\'JetBrains Mono\',monospace);font-size:.88em;padding:.1em .4em;border-radius:4px;background:rgba(127,127,127,.18)}' +
  '.hss-md a{color:inherit;text-decoration:underline;text-underline-offset:3px}' +
  '.hss-md hr{display:block;border:0;border-top:1px solid currentColor;opacity:.45;margin:.8em 0}' +
  '.hss-md blockquote{display:block;margin:.4em 0;padding-left:.9em;border-left:3px solid currentColor;opacity:.85}';

module.exports = { renderMarkdown, MD_CSS, escapeHtml };
