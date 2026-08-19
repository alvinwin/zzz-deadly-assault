import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertDABossCharacterTrends } from './validate-da-boss-character-trends.mjs';
const root = process.cwd();
const dist = path.join(root, 'dist');
const contentHash = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const replaceAssetReference = (source, reference, replacement, label) => {
  const matches = source.split(reference).length - 1;
  if (matches !== 1) throw new Error(`expected exactly one ${label} reference (${reference}), found ${matches}`);
  return source.replace(reference, replacement);
};
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
const trendsPath = path.join(root, 'data/da-boss-character-trends.json');
const trendsSource = fs.readFileSync(trendsPath, 'utf8');
const trendsData = JSON.parse(trendsSource);
assertDABossCharacterTrends(trendsData);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
const currentData = JSON.parse(fs.readFileSync(path.join(root, 'data/current.json'), 'utf8'));
const compactData = {
  cycle: (({ id, startsAt, endsAt, checkedAt, publishable }) => ({ id, startsAt, endsAt, checkedAt, publishable }))(currentData.cycle),
  sources: currentData.sources.map(({ id, label, url }) => ({ id, label, url })),
  buffs: currentData.buffs,
  encounters: currentData.encounters.map(({ id, type, name, category, hp, history, specialty, mechanic, mechanicReview, mechanicSegments, weaknesses, resistances, sourceRefs }) => ({ i: id, t: type, n: name, c: category, p: hp, h: history, s: specialty, m: mechanic, mr: mechanicReview, ms: mechanicSegments, w: weaknesses, x: resistances, q: sourceRefs }))
};
const emittedData = JSON.stringify(compactData);
const dataHash = contentHash(emittedData);
fs.writeFileSync(path.join(dist, 'data/current.json'), emittedData);
const emittedTrends = JSON.stringify({
  cohortLabel: trendsData.cohortLabel,
  methodology: trendsData.methodology,
  bosses: trendsData.bosses.map(({ canonicalId, displayName, currentSourceName, status, phases }) => ({
    canonicalId,
    displayName,
    currentSourceName,
    status,
    phases: phases.map(({ version, phase, provenance, sampleSize, characters }, phaseIndex) => ({
      version,
      phase,
      provenance,
      sampleSize,
      characters: phaseIndex === phases.length - 1 ? characters.slice(0, 10) : [],
    })),
  })),
});
const trendsHash = contentHash(emittedTrends);
fs.writeFileSync(path.join(dist, 'data/da-boss-character-trends.json'), emittedTrends);
let emittedJs = compactJs(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
emittedJs = replaceAssetReference(emittedJs, "fetch('data/current.json')", `fetch('data/current.json?v=${dataHash}')`, 'data');
emittedJs = replaceAssetReference(emittedJs, "fetch('data/da-boss-character-trends.json')", `fetch('data/da-boss-character-trends.json?v=${trendsHash}')`, 'trend data');
const appHash = contentHash(emittedJs);
fs.writeFileSync(path.join(dist, 'app.js'), emittedJs);
const emittedCss = compactCss(fs.readFileSync(path.join(root, 'styles.css'), 'utf8'));
const cssHash = contentHash(emittedCss);
fs.writeFileSync(path.join(dist, 'styles.css'), emittedCss);
const emittedOverrides = compactCss(fs.readFileSync(path.join(root, 'overrides.css'), 'utf8'));
const overridesHash = contentHash(emittedOverrides);
fs.writeFileSync(path.join(dist, 'overrides.css'), emittedOverrides);
const emittedTrendsCss = compactCss(fs.readFileSync(path.join(root, 'trends.css'), 'utf8'));
const trendsCssHash = contentHash(emittedTrendsCss);
fs.writeFileSync(path.join(dist, 'trends.css'), emittedTrendsCss);
let emittedIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();
emittedIndex = replaceAssetReference(emittedIndex, 'href="styles.css"', `href="styles.css?v=${cssHash}"`, 'stylesheet');
emittedIndex = replaceAssetReference(emittedIndex, 'href="overrides.css"', `href="overrides.css?v=${overridesHash}"`, 'override stylesheet');
emittedIndex = replaceAssetReference(emittedIndex, 'href="trends.css"', `href="trends.css?v=${trendsCssHash}"`, 'trend stylesheet');
emittedIndex = replaceAssetReference(emittedIndex, 'src="app.js"', `src="app.js?v=${appHash}"`, 'script');
fs.writeFileSync(path.join(dist, 'index.html'), emittedIndex);
console.log('✓ built clean dist/ (HTML, CSS, app, and data)');
