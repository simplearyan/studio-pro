/**
 * reel-schema.cjs — the IR schema gate.
 *
 * P3, and the case that justifies it. `IGNORED_BY_EMITTER` in reel-compile.cjs
 * is a hand-maintained LIST, so it can only ever say "these fields I know I
 * drop". It cannot say "that field does not exist". The two are different
 * mistakes and the difference is invisible from the outside:
 *
 *   hover       a field the design deliberately does not express
 *   label_bg    a field the author INVENTED, which the emitter has never heard of
 *
 * jan-suraaj's final call to action authored `label_bg`; the emitter's field is
 * `slab_bg`. The name was dropped, the slab never rendered, and for the last
 * five seconds of a seventy-second film the CTA was near-black on near-black at
 * 1.05:1 — with a green build, because everything written was valid JSON.
 *
 * So: `storyboard.schema.json` is checked in, `additionalProperties:false` on
 * every object, and this file enforces it. The failure names a JSON POINTER
 * (`/scenes/6/elements/2/label_bg`) rather than a CSS class, because a pointer
 * is something an editor can jump to and a class name is not.
 *
 * WHY NOT AJV. ajv 8 is in node_modules — transitively, via vite's dependency
 * tree, which is not a promise. A gate that breaks when a transitive
 * dependency changes version is a gate people disable. This file is ~180 lines
 * and depends on nothing, and `assertSupportedKeywords()` makes the one real
 * risk of hand-rolling a validator impossible: if the schema grows a keyword
 * this interpreter does not implement, the gate FAILS rather than silently
 * passing everything under that keyword.
 *
 * That check is the whole point. A validator that quietly ignores half a
 * schema is worse than no validator, because it reports a green result.
 *
 * Usage:
 *   node automation/studio-reel/reel-schema.cjs
 *   node automation/studio-reel/reel-schema.cjs --only two-queens
 *   node automation/studio-reel/reel-schema.cjs --schema <path>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const SCHEMA = path.join(HERE, 'storyboard.schema.json');

/* The keywords this interpreter implements. Anything else in the schema is a
 * hard failure below — see assertSupportedKeywords(). */
const SUPPORTED = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description', 'examples', 'default',
  'type', 'properties', 'patternProperties', 'additionalProperties', 'required',
  'items', 'minItems', 'maxItems', 'enum', 'const',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern',
]);

/* Walk every subschema in the document, `$defs` included — a bad keyword hiding
 * in an unreferenced branch is still a landmine the day someone $refs it. */
function collectSchemas(node, out) {
  if (Array.isArray(node)) { node.forEach((n) => collectSchemas(n, out)); return out; }
  if (!node || typeof node !== 'object') return out;
  out.push(node);
  for (const [k, v] of Object.entries(node)) {
    if (k === 'properties' || k === '$defs' || k === 'patternProperties') {
      if (v && typeof v === 'object') for (const sub of Object.values(v)) collectSchemas(sub, out);
    } else if (k === 'items') collectSchemas(v, out);
    else if (k === 'additionalProperties' && v && typeof v === 'object') collectSchemas(v, out);
    /* description/title at the value level are data, not schemas, so the plain
       branch deliberately does not recurse */
  }
  return out;
}

function assertSupportedKeywords(schema) {
  const unknown = new Map();
  for (const sub of collectSchemas(schema, [])) {
    for (const k of Object.keys(sub)) {
      if (SUPPORTED.has(k)) continue;
      unknown.set(k, (unknown.get(k) || 0) + 1);
    }
  }
  if (!unknown.size) return [];
  return [...unknown].map(([k, n]) => `schema uses "${k}" in ${n} place(s) and this validator does not implement it — a keyword that is silently ignored reports a green result for a document that does not conform`);
}

/* RFC 6901 pointer escaping. `~` and `/` are legal in a JSON key, so a naive
   join would produce a pointer that addresses a different node. */
const ptr = (base, key) => base + '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
/* Compare a TYPE NAME against a VALUE, so every branch names the type the
 * value actually has. The final branch used to be `expected === actual`,
 * which compares the string "object" to the object itself — always false, so
   every document was rejected at the root with "expected object, got object".
     A gate that rejects everything looks exactly like a strict one until you
     read the message. */
const typeMatches = (value, expected) => {
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeOf(value) === expected;
};

/* Concatenate a parent pointer with a CHILD pointer (which already begins with
 * `/`). Stripping the child's leading slash and re-escaping it — the obvious
 * way — mangles it on the second level of nesting: `/duration` stripped to
 * `duration` rejoins as `/meta/duration`, but the next level re-escapes the
 * separator into a `/meta/duration~1` that addresses a key literally named
 * `duration/`. A pointer an editor cannot jump to is a pointer nobody uses. */
const joinPtr = (base, child) => {
  const c = child && child !== '/' ? child : '';
  if (!base) return c || '/';
  /* A child of `/` means the error is ON this node (a wrong scalar type, a
     missing required key) rather than inside it, so the parent pointer is
     already the answer. Appending a separator here would address a child of
     the node instead. */
  return c ? base + c : base;
};

function resolveRef(ref, root) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) {
    throw new Error(`only local $ref is supported, got ${JSON.stringify(ref)}`);
  }
  let node = root;
  for (const raw of ref.slice(2).split('/')) {
    const key = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    node = node && node[key];
    if (node === undefined) throw new Error(`$ref ${ref} does not resolve`);
  }
  return node;
}

/**
 * Validate one document. Returns [{ pointer, message }] — empty means valid.
 * Errors are collected rather than thrown so one run reports every mistake,
 * not just the first.
 */
function validate(doc, schema, root) {
  const errors = [];
  root = root || schema;

  if (schema.$ref) return validate(doc, resolveRef(schema.$ref, root), root);

  const push = (p, message) => errors.push({ pointer: p || '/', message });

  /* ── type ───────────────────────────────────────────────────────────── */
  if (schema.type !== undefined) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!want.some((t) => typeMatches(doc, t))) {
      push('', `expected ${want.join(' or ')}, got ${typeOf(doc)}`);
      return errors;   /* nothing below is meaningful on the wrong type */
    }
  }

  if (schema.enum && !schema.enum.some((v) => JSON.stringify(v) === JSON.stringify(doc))) {
    push('', `expected one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}, got ${JSON.stringify(doc)}`);
  }
  if (schema.const !== undefined && JSON.stringify(doc) !== JSON.stringify(schema.const)) {
    push('', `expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(doc)}`);
  }

  if (typeof doc === 'number') {
    if (schema.minimum !== undefined && doc < schema.minimum) push('', `${doc} is below the minimum ${schema.minimum}`);
    if (schema.exclusiveMinimum !== undefined && doc <= schema.exclusiveMinimum) push('', `${doc} must be greater than ${schema.exclusiveMinimum}`);
    if (schema.maximum !== undefined && doc > schema.maximum) push('', `${doc} is above the maximum ${schema.maximum}`);
    if (schema.exclusiveMaximum !== undefined && doc >= schema.exclusiveMaximum) push('', `${doc} must be less than ${schema.exclusiveMaximum}`);
  }
  if (typeof doc === 'string') {
    if (schema.minLength !== undefined && doc.length < schema.minLength) push('', `string is shorter than ${schema.minLength} character(s)`);
    if (schema.maxLength !== undefined && doc.length > schema.maxLength) push('', `string is longer than ${schema.maxLength} character(s)`);
    if (schema.pattern && !new RegExp(schema.pattern).test(doc)) push('', `"${doc}" does not match ${schema.pattern}`);
  }

  /* ── arrays ─────────────────────────────────────────────────────────── */
  if (Array.isArray(doc)) {
    if (schema.minItems !== undefined && doc.length < schema.minItems) push('', `expected at least ${schema.minItems} item(s), got ${doc.length}`);
    if (schema.maxItems !== undefined && doc.length > schema.maxItems) push('', `expected at most ${schema.maxItems} item(s), got ${doc.length}`);
    if (schema.items) {
      for (let i = 0; i < doc.length; i++) {
        for (const e of validate(doc[i], schema.items, root)) {
          errors.push({ pointer: joinPtr(ptr('', i), e.pointer), message: e.message });
        }
      }
    }
    return errors;
  }

  /* ── objects ────────────────────────────────────────────────────────── */
  if (doc && typeof doc === 'object') {
    const props = schema.properties || {};
    const patterns = schema.patternProperties || {};
    const reCache = new Map();

    for (const key of Object.keys(doc)) {
      const where = ptr('', key);
      let matched = false;

      if (Object.prototype.hasOwnProperty.call(props, key)) {
        matched = true;
        for (const e of validate(doc[key], props[key], root)) {
          errors.push({ pointer: joinPtr(where, e.pointer), message: e.message });
        }
      }
      for (const [pat, sub] of Object.entries(patterns)) {
        if (!reCache.has(pat)) reCache.set(pat, new RegExp(pat));
        if (reCache.get(pat).test(key)) {
          matched = true;
          for (const e of validate(doc[key], sub, root)) {
            errors.push({ pointer: joinPtr(where, e.pointer), message: e.message });
          }
        }
      }

      /* The whole reason this file exists. `false` is the schema saying "I
         know every field I accept"; anything left over is either a typo or a
         field the emitter has never heard of, and from the outside those are
         indistinguishable. */
      if (!matched && schema.additionalProperties === false) {
        const known = [...Object.keys(props), ...Object.keys(patterns)];
        errors.push({
          pointer: where,
          message: `unknown field "${key}" — the schema accepts ${known.length ? known.map((k) => (props[k] ? k : `/${k}/`)).slice(0, 24).join(', ') : '(none)'}${known.length > 24 ? ', …' : ''}. If this field is real, add it to storyboard.schema.json with a note saying whether it is APPLIED or DISCARDED; if it is a typo, fix it. A field the emitter has never heard of is dropped in silence and renders nothing.`,
        });
      } else if (!matched && schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        for (const e of validate(doc[key], schema.additionalProperties, root)) {
          errors.push({ pointer: joinPtr(where, e.pointer), message: e.message });
        }
      }
    }

    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(doc, key)) {
        push('', `missing required field "${key}"`);
      }
    }
  }

  return errors;
}

function main() {
  const argv = process.argv.slice(2);
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
  const schemaPath = argv.includes('--schema') ? argv[argv.indexOf('--schema') + 1] : SCHEMA;

  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  console.log('=== schema interpreter contract ===');
  const unsupported = assertSupportedKeywords(schema);
  if (unsupported.length) {
    for (const u of unsupported) console.log(`  FAIL  ${u}`);
    console.error("\nreel-schema: FAILED — the schema uses keywords this validator does not implement, so a green result would be meaningless.");
    return 1;
  }
  const subCount = collectSchemas(schema, []).length;
  console.log(`  ok    every keyword in ${subCount} subschemas is implemented here (${SUPPORTED.size} supported)`);

  /* Prove the interpreter can actually fail. A validator that has never
     rejected anything has not been tested, and "0 errors" from a broken one
     looks exactly like a clean film. The fixture is the REAL defect this
     whole file exists to catch, with the pointer the fix would be made at. */
  const selfTest = validate({
    meta: { id: 'self', title: 'Self', aspect: '16:9', duration: 'four' },
    scenes: [{
      id: 's1', start: 0, dur: 4,
      elements: [{ id: 'e1', type: 'text', text: 'x', labl_bg: '#FDCB0B' }],
    }, { id: 's2', start: 4, elements: [] }],
    labl: true,
  }, schema);
  const want = [
    ['/scenes/0/elements/0/labl_bg', /unknown field "labl_bg"/, 'an invented field name'],
    ['/meta/duration', /expected number, got string/, 'a wrong type'],
    ['/scenes/1', /missing required field "dur"/, 'a missing required field'],
    ['/scenes/1/elements', /expected at least 1 item/, 'an empty element list'],
    ['/labl', /unknown field "labl"/, 'an invented top-level field'],
  ];
  const missed = want.filter(([p, re]) => !selfTest.some((e) => e.pointer === p && re.test(e.message)));
  if (missed.length) {
    console.log('  FAIL  the interpreter did not reject a deliberately malformed document:');
    for (const [p, , what] of missed) console.log(`        ${what} was not caught at ${p}`);
    console.error('\nreel-schema: FAILED — self-test did not fail, so the gate cannot be trusted to.');
    return 1;
  }
  console.log(`  ok    self-test: ${want.length}/${want.length} malformed cases rejected at a pointer, including the real \`label_bg\` defect`);

  const filmsDir = path.join(HERE, 'films');
  const films = fs.readdirSync(filmsDir)
    .filter((d) => fs.existsSync(path.join(filmsDir, d, 'storyboard.json')) && (!only || d === only));

  let failed = 0;
  let totalErrors = 0;
  for (const film of films) {
    const file = path.join(filmsDir, film, 'storyboard.json');
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.log(`\n=== ${film} ===\n  FAIL  not valid JSON: ${e.message}`);
      failed++;
      continue;
    }
    const errors = validate(doc, schema);
    totalErrors += errors.length;
    console.log(`\n=== ${film} ===`);
    if (!errors.length) {
      const els = (doc.scenes || []).reduce((a, s) => a + s.elements.length, 0);
      console.log(`  ok    ${doc.scenes.length} scenes / ${els} elements — every field is one the schema knows`);
    } else {
      console.log(`  ${errors.length} schema error(s):`);
      for (const e of errors.slice(0, 40)) console.log(`    - ${e.pointer}: ${e.message}`);
      if (errors.length > 40) console.log(`    … and ${errors.length - 40} more`);
      failed++;
    }
  }

  console.log('');
  if (failed) {
    console.error(`reel-schema: FAILED (${failed}) — ${totalErrors} error(s). An unknown field name is dropped in silence: the element still renders, the field does not.`);
    return 1;
  }
  console.log('reel-schema: OK — no invented field names. Every authored field is one the schema declares.');
  return 0;
}

/* Exported for reel-regression.cjs, which proves the gate rejects the exact
   `label_bg` defect that motivated it. A gate with no test of its own failing
   behaviour is a gate nobody trusts. */
module.exports = { validate, assertSupportedKeywords, SCHEMA };
if (require.main === module) process.exit(main());
