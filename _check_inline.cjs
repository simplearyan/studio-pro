const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let plain = '';
let mod = '';
for (const s of scripts) {
  const tag = (s.match(/^<script[^>]*>/) || [''])[0];
  const body = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '').trim();
  if (!body) continue;
  if (body.startsWith('window.MathJax') || body.includes('MathJax =')) continue;
  if (tag.includes('type="module"') || tag.includes("type='module'")) mod += body + '\n;\n';
  else plain += body + '\n;\n';
}
fs.writeFileSync('_inline_check.js', plain);
fs.writeFileSync('_inline_check.mjs', mod);
console.log('extracted', plain.length, 'plain chars,', mod.length, 'module chars');
