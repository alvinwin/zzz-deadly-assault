import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const dist = path.join(root, 'dist');
const compactJs = source => {
  let output = ''; let quote = null; let escaped = false; let whitespace = false;
  const punctuation = /[{}()[\],;:?=+\-*%<>]/;
  for (const char of source) {
    if (quote) { output += char; if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue; }
    if (char === '"' || char === "'" || char === '`') { if (whitespace && /[\w$]/.test(output.at(-1) || '') && /[\w$]/.test(char)) output += ' '; whitespace = false; quote = char; output += char; continue; }
    if (/\s/.test(char)) { whitespace = true; continue; }
    if (whitespace && !punctuation.test(output.at(-1) || '') && !punctuation.test(char) && /[\w$]/.test(output.at(-1) || '') && /[\w$]/.test(char)) output += ' ';
    whitespace = false; output += char;
  }
  return output;
};
const compactCss = source => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), fs.readFileSync(path.join(root, 'index.html'), 'utf8').trim());
fs.writeFileSync(path.join(dist, 'styles.css'), compactCss(fs.readFileSync(path.join(root, 'styles.css'), 'utf8')));
fs.writeFileSync(path.join(dist, 'app.js'), compactJs(fs.readFileSync(path.join(root, 'app.js'), 'utf8')));
const currentData = JSON.parse(fs.readFileSync(path.join(root, 'data/current.json'), 'utf8'));
const compactData = {
  cycle: (({ id, startsAt, endsAt, publishable }) => ({ id, startsAt, endsAt, publishable }))(currentData.cycle),
  sources: currentData.sources.map(({ id, label, url }) => ({ id, label, url })),
  buffs: currentData.buffs,
  encounters: currentData.encounters.map(({ id, type, name, category, hp, history, specialty, mechanic, mechanicReview, mechanicSegments, weaknesses, resistances, sourceRefs }) => ({ i: id, t: type, n: name, c: category, p: hp, h: history, s: specialty, m: mechanic, mr: mechanicReview, ms: mechanicSegments, w: weaknesses, x: resistances, q: sourceRefs }))
};
fs.writeFileSync(path.join(dist, 'data/current.json'), JSON.stringify(compactData));
console.log('✓ built clean dist/ (index.html, styles.css, app.js, data/current.json)');
