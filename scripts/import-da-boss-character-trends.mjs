import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertDABossCharacterTrends, isRevisionAndFileBoundUrl } from './validate-da-boss-character-trends.mjs';

export const CSV_HEADER = 'uid,floor,star,score,boss,buff,ch1,ch1_rank,ch2,ch2_rank,ch3,ch3_rank,bangboo,rank_percent';
const CSV_COLUMNS = CSV_HEADER.split(',');
const ISO_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const REVISION_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function fail(message) { throw new Error(message); }
function nonEmptyText(value) { return typeof value === 'string' && value.trim().length > 0; }

function isHttpUrl(value) {
  if (!nonEmptyText(value)) return false;
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function parsePositiveInteger(value, field, rowNumber) {
  if (!/^\d+$/.test(value)) fail(`row ${rowNumber}: ${field} must be a positive integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) fail(`row ${rowNumber}: ${field} must be a positive integer`);
  return number;
}

function parseNumber(value, field, rowNumber) {
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) fail(`row ${rowNumber}: ${field} must be numeric`);
  return Number(value);
}

function parseNonNegativeNumber(value, field, rowNumber) {
  const number = parseNumber(value, field, rowNumber);
  if (number < 0) fail(`row ${rowNumber}: ${field} must be nonnegative`);
  return number;
}

function parsePercent(value, field, rowNumber) {
  const number = parseNonNegativeNumber(value.replace(/%$/, ''), field, rowNumber);
  if (number > 100) fail(`row ${rowNumber}: ${field} must be between 0 and 100 percent`);
  return number;
}

export function parseCsv(text) {
  if (typeof text !== 'string') fail('CSV input must be text');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) fail('CSV contains an unterminated quoted field');
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function parseRows(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) fail('CSV must contain an exact header and at least one data row');
  if (rows[0].join(',') !== CSV_HEADER || rows[0].length !== CSV_COLUMNS.length) fail(`CSV header must exactly equal ${CSV_HEADER}`);
  return rows.slice(1).map((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== CSV_COLUMNS.length) fail(`row ${rowNumber}: expected ${CSV_COLUMNS.length} columns`);
    const row = Object.fromEntries(CSV_COLUMNS.map((column, columnIndex) => [column, values[columnIndex].trim()]));
    if (!nonEmptyText(row.boss)) fail(`row ${rowNumber}: boss is required`);
    if (nonEmptyText(row.floor)) parsePositiveInteger(row.floor, 'floor', rowNumber);
    if (nonEmptyText(row.star)) parsePositiveInteger(row.star, 'star', rowNumber);
    if (nonEmptyText(row.score)) parseNumber(row.score, 'score', rowNumber);
    for (const field of ['ch1_rank', 'ch2_rank', 'ch3_rank']) if (nonEmptyText(row[field])) parseNonNegativeNumber(row[field], field, rowNumber);
    if (nonEmptyText(row.rank_percent)) parsePercent(row.rank_percent, 'rank_percent', rowNumber);
    return row;
  });
}

function sourceBytes(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input === 'string') return Buffer.from(input, 'utf8');
  fail('input must be CSV text or bytes');
}

function normalizeMapping(mapping, label) {
  if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object') fail(`${label} must be one object, not an array`);
  const canonicalId = mapping.canonicalId ?? mapping.id;
  const displayName = mapping.displayName ?? mapping.name;
  const sourceName = mapping.sourceName ?? mapping.source ?? mapping.currentSourceName;
  if (!nonEmptyText(canonicalId) || !nonEmptyText(displayName) || !nonEmptyText(sourceName)) fail(`${label} must include canonicalId, displayName, and sourceName`);
  return { canonicalId: canonicalId.trim(), displayName: displayName.trim(), sourceName: sourceName.trim() };
}

function normalizeDescriptor(value, label) {
  const descriptor = value?.descriptor ?? value;
  if (!descriptor || typeof descriptor !== 'object') fail(`${label} descriptor is required`);
  const bytes = sourceBytes(descriptor.input ?? descriptor.inputBytes ?? descriptor.bytes ?? descriptor.csv);
  const sourceRevision = descriptor.sourceRevision ?? descriptor.revision;
  const sourceSha256 = descriptor.sourceSha256 ?? descriptor.sha256 ?? descriptor.sourceSha;
  if (!REVISION_RE.test(sourceRevision ?? '')) fail(`${label}.sourceRevision must be an exact 40-hex revision`);
  if (!SHA256_RE.test(sourceSha256 ?? '')) fail(`${label}.sourceSha256 must be an exact 64-hex SHA256`);
  const actualSha = createHash('sha256').update(bytes).digest('hex');
  if (actualSha !== sourceSha256.toLowerCase()) fail(`${label}.sourceSha256 does not match input bytes (expected ${sourceSha256}, got ${actualSha})`);
  if (!nonEmptyText(descriptor.sourceFile)) fail(`${label}.sourceFile is required`);
  if (!isHttpUrl(descriptor.sourceUrl)) fail(`${label}.sourceUrl must be a valid HTTP(S) URL`);
  if (!isRevisionAndFileBoundUrl(descriptor.sourceUrl, sourceRevision, descriptor.sourceFile)) fail(`${label}.sourceUrl must bind the exact sourceRevision and sourceFile`);
  if (!ISO_TIME_RE.test(descriptor.retrievedAt ?? '') || Number.isNaN(Date.parse(descriptor.retrievedAt))) fail(`${label}.retrievedAt must be a valid ISO timestamp`);
  if (!nonEmptyText(descriptor.phase) || !nonEmptyText(descriptor.version)) fail(`${label}.phase and version are required`);
  return { ...descriptor, bytes, sourceRevision: sourceRevision.toLowerCase(), sourceSha256: actualSha, sourceFile: descriptor.sourceFile.trim(), sourceUrl: descriptor.sourceUrl.trim() };
}

function aggregate(rows, sourceName, threshold, phase, prior) {
  const bossRows = rows.filter(row => row.boss === sourceName);
  if (bossRows.length === 0) fail(`boss not found in CSV: ${sourceName}`);
  bossRows.forEach((row, index) => {
    if (!nonEmptyText(row.score)) fail(`matching boss row ${index + 1}: score is required`);
  });
  const seenRecords = new Set();
  const uniqueRows = bossRows.filter(row => {
    const record = CSV_COLUMNS.map(column => row[column]).join('\u001f');
    if (seenRecords.has(record)) return false;
    seenRecords.add(record);
    return true;
  });
  const matchingRows = uniqueRows.filter(row => [row.ch1, row.ch2, row.ch3].every(nonEmptyText));
  const counts = new Map();
  for (const row of matchingRows) {
    for (const name of new Set([row.ch1, row.ch2, row.ch3])) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const sampleSize = matchingRows.length;
  const suppressed = sampleSize < threshold;
  const characters = suppressed ? [] : Array.from(counts, ([name, clearCount]) => ({
    name,
    clearCount,
    appearanceRate: clearCount / sampleSize,
    priorAppearanceChange: prior ? (clearCount / sampleSize) - (prior.get(name) ?? 0) : null,
  })).sort((left, right) => right.clearCount - left.clearCount || left.name.localeCompare(right.name));
  return {
    version: phase.version,
    phase: phase.phase,
    provenance: {
      sourceRevision: phase.sourceRevision,
      sourceSha256: phase.sourceSha256,
      sourceFile: phase.sourceFile,
      sourceUrl: phase.sourceUrl,
      retrievedAt: phase.retrievedAt,
    },
    inputRows: bossRows.length,
    excludedRows: bossRows.length - matchingRows.length,
    sampleSize,
    characters,
  };
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('import options must be an object');
  const current = normalizeDescriptor(options.current ?? options.currentDescriptor, 'current');
  const specs = options.bosses ?? options.mappings;
  if (!Array.isArray(specs) || specs.length === 0) fail('bosses must be a nonempty array');
  const mappings = specs.map((spec, index) => {
    const currentMapping = spec.currentMapping ?? spec.current ?? spec;
    const mapping = normalizeMapping({ ...currentMapping, sourceName: currentMapping.currentSourceName ?? currentMapping.sourceName ?? currentMapping.source }, `bosses[${index}] current mapping`);
    const priorSpec = spec.prior ?? spec.priorDescriptor;
    if (!priorSpec) fail(`bosses[${index}] prior descriptor and mapping are required`);
    const prior = normalizeDescriptor(priorSpec.descriptor ?? priorSpec, `bosses[${index}] prior`);
    const priorMappingOptions = priorSpec.mapping ?? {};
    for (const key of ['canonicalId', 'id', 'displayName', 'name']) {
      const expected = key === 'id' ? mapping.canonicalId : key === 'name' ? mapping.displayName : mapping[key];
      if (priorMappingOptions[key] !== undefined && priorMappingOptions[key] !== expected) fail(`bosses[${index}] prior mapping ${key} must match current mapping`);
    }
    const priorMapping = normalizeMapping({
      canonicalId: mapping.canonicalId,
      displayName: mapping.displayName,
      sourceName: spec.priorSourceName ?? priorMappingOptions.sourceName ?? priorMappingOptions.source ?? priorSpec.sourceName ?? priorSpec.source ?? priorSpec.bossSourceName,
    }, `bosses[${index}] prior mapping`);
    return { mapping, prior, priorMapping };
  });
  const seen = new Map();
  const priorNames = new Set();
  for (const [index, item] of mappings.entries()) {
    for (const [kind, value] of [['canonicalId', item.mapping.canonicalId], ['displayName', item.mapping.displayName], ['currentSourceName', item.mapping.sourceName]]) {
      if (seen.has(`${kind}:${value}`)) fail(`duplicate ${kind}: ${value}`);
      seen.set(`${kind}:${value}`, index);
    }
    if (priorNames.has(item.priorMapping.sourceName)) fail(`duplicate prior sourceName: ${item.priorMapping.sourceName}`);
    priorNames.add(item.priorMapping.sourceName);
  }
  const currentRows = parseRows(current.bytes.toString('utf8'));
  const currentNames = new Set(currentRows.map(row => row.boss).filter(nonEmptyText));
  const mappedNames = new Set(mappings.map(item => item.mapping.sourceName));
  for (const name of currentNames) if (!mappedNames.has(name)) fail(`unmapped current boss: ${name}`);
  for (const item of mappings) if (!currentNames.has(item.mapping.sourceName)) fail(`boss not found in current CSV: ${item.mapping.sourceName}`);
  return { current, currentRows, mappings, cohortLabel: options.cohortLabel ?? 'Observed submitted/public-profile clears', threshold: options.suppressionThreshold ?? options.methodology?.suppressionThreshold ?? 10 };
}

export function importDABossCharacterTrends(options) {
  const normalized = normalizeOptions(options);
  const { current, currentRows, mappings, cohortLabel, threshold } = normalized;
  if (!Number.isInteger(threshold) || threshold < 1) fail('suppressionThreshold must be a positive integer');
  const priorCache = new Map();
  const bosses = mappings.map(({ mapping, prior, priorMapping }) => {
    const priorKey = prior.sourceSha256;
    const priorRows = priorCache.has(priorKey) ? priorCache.get(priorKey) : parseRows(prior.bytes.toString('utf8'));
    priorCache.set(priorKey, priorRows);
    const priorPhase = aggregate(priorRows, priorMapping.sourceName, threshold, prior, null);
    const priorRates = new Map(priorPhase.characters.map(character => [character.name, character.appearanceRate]));
    const currentPhase = aggregate(currentRows, mapping.sourceName, threshold, current, priorRates);
    const suppressed = priorPhase.sampleSize < threshold || currentPhase.sampleSize < threshold;
    if (suppressed) { priorPhase.characters = []; currentPhase.characters = []; }
    return {
      canonicalId: mapping.canonicalId,
      displayName: mapping.displayName,
      currentSourceName: mapping.sourceName,
      status: suppressed ? 'suppressed' : 'live',
      comparison: {
        kind: 'previous-observed-appearance',
        priorVersion: prior.version,
        priorPhase: prior.phase,
        currentVersion: current.version,
        currentPhase: current.phase,
      },
      phases: [priorPhase, currentPhase],
    };
  });
  return assertDABossCharacterTrends({
    schemaVersion: '1.0',
    cohortLabel,
    methodology: {
      inclusion: 'Observed submitted/public-profile clears only; descriptive aggregate, no recommendations.',
      exclusions: ['Exact duplicate source records and incomplete three-character teams (rows without all three character fields) are excluded.'],
      suppressionThreshold: threshold,
    },
    bosses,
  });
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function runCli(args = process.argv.slice(2)) {
  const configPath = argValue(args, '--config');
  const outputPath = argValue(args, '--output');
  const check = args.includes('--check');
  if (!configPath || !outputPath) fail('usage: --config <json> --output <json> [--check]');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const loadInput = async (descriptor, label) => {
    if (descriptor?.inputPath) return readFile(resolve(configPath, '..', descriptor.inputPath));
    if (!isRevisionAndFileBoundUrl(descriptor?.sourceUrl, descriptor?.sourceRevision, descriptor?.sourceFile)) {
      fail(`${label} requires inputPath or a sourceUrl bound to its exact revision and file`);
    }
    const response = await fetch(descriptor.sourceUrl.replace('/blob/', '/resolve/'));
    if (!response.ok) fail(`${label} source fetch failed: ${response.status} ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const current = config.current ?? config.currentDescriptor;
  const currentDescriptor = current?.descriptor ?? current;
  currentDescriptor.input = await loadInput(currentDescriptor, 'config.current');
  for (const spec of config.bosses ?? []) {
    const prior = spec.prior ?? spec.priorDescriptor;
    const priorDescriptor = prior?.descriptor ?? prior;
    priorDescriptor.input = await loadInput(priorDescriptor, 'boss prior');
  }
  const output = importDABossCharacterTrends({ ...config, current });
  const outputBytes = Buffer.from(`${JSON.stringify(output, null, 2)}\n`);
  if (check) {
    const committedBytes = await readFile(outputPath);
    if (!outputBytes.equals(committedBytes)) fail(`generated output differs from ${outputPath}; rerun the importer and commit the refreshed aggregate`);
  } else {
    await writeFile(outputPath, outputBytes);
  }
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runCli(); }
  catch (error) { console.error(`Import failed: ${error.message}`); process.exitCode = 1; }
}
