const ISO_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const REVISION_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const DOCUMENT_KEYS = new Set(['schemaVersion', 'cohortLabel', 'methodology', 'bosses']);
const METHODOLOGY_KEYS = new Set(['inclusion', 'exclusions', 'suppressionThreshold']);
const BOSS_KEYS = new Set(['canonicalId', 'displayName', 'currentSourceName', 'status', 'comparison', 'phases']);
const COMPARISON_KEYS = new Set(['kind', 'priorVersion', 'priorPhase', 'currentVersion', 'currentPhase']);
const PROVENANCE_KEYS = new Set(['sourceRevision', 'sourceSha256', 'sourceFile', 'sourceUrl', 'retrievedAt']);
const PHASE_KEYS = new Set(['version', 'phase', 'provenance', 'inputRows', 'excludedRows', 'sampleSize', 'characters']);
const CHARACTER_KEYS = new Set(['name', 'clearCount', 'appearanceRate', 'priorAppearanceChange']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isoTime(value) {
  return typeof value === 'string' && ISO_TIME_RE.test(value) && !Number.isNaN(Date.parse(value));
}

function httpUrl(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function unknownKeys(value, allowed, path, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path} has unknown key ${key}`);
  }
}

function hasUidKey(value) {
  if (Array.isArray(value)) return value.some(item => hasUidKey(item));
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) => key === 'uid' || hasUidKey(child));
}

function validateProvenance(provenance, path, errors) {
  if (!isObject(provenance)) {
    errors.push(`${path} must be an object`);
    return;
  }
  unknownKeys(provenance, PROVENANCE_KEYS, path, errors);
  if (!REVISION_RE.test(provenance.sourceRevision ?? '')) errors.push(`${path}.sourceRevision must be a 40-hex revision`);
  if (!SHA256_RE.test(provenance.sourceSha256 ?? '')) errors.push(`${path}.sourceSha256 must be a 64-hex SHA256`);
  if (!nonEmptyText(provenance.sourceFile)) errors.push(`${path}.sourceFile must be nonempty`);
  if (!httpUrl(provenance.sourceUrl)) errors.push(`${path}.sourceUrl must be a valid HTTP(S) URL`);
  if (!isoTime(provenance.retrievedAt)) errors.push(`${path}.retrievedAt must be a valid ISO timestamp`);
}

function validatePhase(phase, phaseIndex, threshold, errors) {
  const path = `boss.phases[${phaseIndex}]`;
  if (!isObject(phase)) {
    errors.push(`${path} must be an object`);
    return;
  }
  unknownKeys(phase, PHASE_KEYS, path, errors);
  if (!nonEmptyText(phase.version)) errors.push(`${path}.version must be nonempty`);
  if (!nonEmptyText(phase.phase)) errors.push(`${path}.phase must be nonempty`);
  validateProvenance(phase.provenance, `${path}.provenance`, errors);
  if (!Number.isInteger(phase.inputRows) || phase.inputRows < 0) errors.push(`${path}.inputRows must be a nonnegative integer`);
  if (!Number.isInteger(phase.excludedRows) || phase.excludedRows < 0) errors.push(`${path}.excludedRows must be a nonnegative integer`);
  if (!Number.isInteger(phase.sampleSize) || phase.sampleSize < 0) errors.push(`${path}.sampleSize must be a nonnegative integer`);
  if (Number.isInteger(phase.inputRows) && Number.isInteger(phase.excludedRows)
    && Number.isInteger(phase.sampleSize) && phase.inputRows !== phase.excludedRows + phase.sampleSize) {
    errors.push(`${path}.inputRows must equal excludedRows + sampleSize`);
  }
  if (!Array.isArray(phase.characters)) {
    errors.push(`${path}.characters must be an array`);
    return;
  }
  if (phase.sampleSize < threshold && phase.characters.length > 0) {
    errors.push(`${path}.characters must be empty below the suppression threshold`);
  }
  const names = new Set();
  let previous = null;
  for (const [characterIndex, character] of phase.characters.entries()) {
    const characterPath = `${path}.characters[${characterIndex}]`;
    if (!isObject(character)) {
      errors.push(`${characterPath} must be an object`);
      continue;
    }
    unknownKeys(character, CHARACTER_KEYS, characterPath, errors);
    if (!nonEmptyText(character.name)) errors.push(`${characterPath}.name must be nonempty`);
    if (names.has(character.name)) errors.push(`${characterPath}.name must be unique within its phase`);
    names.add(character.name);
    if (!Number.isInteger(character.clearCount) || character.clearCount < 1 || character.clearCount > phase.sampleSize) {
      errors.push(`${characterPath}.clearCount must be between 1 and sampleSize`);
    }
    const expectedRate = phase.sampleSize > 0 ? character.clearCount / phase.sampleSize : NaN;
    if (typeof character.appearanceRate !== 'number' || !Number.isFinite(character.appearanceRate) || character.appearanceRate !== expectedRate) {
      errors.push(`${characterPath}.appearanceRate must equal clearCount / sampleSize`);
    }
    if (typeof character.priorAppearanceChange !== 'number' && character.priorAppearanceChange !== null) {
      errors.push(`${characterPath}.priorAppearanceChange must be null or a number`);
    }
    if (previous) {
      const outOfOrder = character.clearCount > previous.clearCount
        || (character.clearCount === previous.clearCount && character.name.localeCompare(previous.name) < 0);
      if (outOfOrder) errors.push(`${path}.characters must be sorted by clearCount descending then name ascending`);
    }
    previous = character;
  }
  if (phaseIndex === 0) {
    for (const character of phase.characters) {
      if (character && character.priorAppearanceChange !== null) errors.push(`${path}.characters priorAppearanceChange must be null`);
    }
  }
}

export function validateDABossCharacterTrends(data) {
  const errors = [];
  if (!isObject(data)) return ['data must be an object'];
  if (hasUidKey(data)) errors.push('output must not contain a uid key');
  unknownKeys(data, DOCUMENT_KEYS, 'data', errors);
  if (!nonEmptyText(data.schemaVersion)) errors.push('schemaVersion must be nonempty');
  if (!nonEmptyText(data.cohortLabel)) errors.push('cohortLabel must be nonempty');
  if (!isObject(data.methodology)) {
    errors.push('methodology must be an object');
  } else {
    unknownKeys(data.methodology, METHODOLOGY_KEYS, 'methodology', errors);
    if (!nonEmptyText(data.methodology.inclusion)) errors.push('methodology.inclusion must be nonempty');
    if (!Array.isArray(data.methodology.exclusions) || data.methodology.exclusions.some(item => !nonEmptyText(item))) {
      errors.push('methodology.exclusions must be an array of strings');
    } else if (!data.methodology.exclusions.some(item => /incomplete.*(team|three.?character)|three.?character.*incomplete/i.test(item))) {
      errors.push('methodology.exclusions must explicitly describe incomplete three-character teams');
    }
    if (!Number.isInteger(data.methodology.suppressionThreshold) || data.methodology.suppressionThreshold < 1) {
      errors.push('methodology.suppressionThreshold must be a positive integer');
    }
  }
  if (!Array.isArray(data.bosses) || data.bosses.length === 0) {
    errors.push('bosses must be a nonempty array');
    return errors;
  }
  const threshold = data.methodology?.suppressionThreshold;
  const ids = new Set();
  const displayNames = new Set();
  const sourceNames = new Set();
  for (const [bossIndex, boss] of data.bosses.entries()) {
    const path = `bosses[${bossIndex}]`;
    if (!isObject(boss)) {
      errors.push(`${path} must be an object`);
      continue;
    }
    unknownKeys(boss, BOSS_KEYS, path, errors);
    for (const key of ['canonicalId', 'displayName', 'currentSourceName']) {
      if (!nonEmptyText(boss[key])) errors.push(`${path}.${key} must be nonempty`);
    }
    if (ids.has(boss.canonicalId)) errors.push(`${path}.canonicalId must be unique`);
    if (displayNames.has(boss.displayName)) errors.push(`${path}.displayName must be unique`);
    if (sourceNames.has(boss.currentSourceName)) errors.push(`${path}.currentSourceName must be unique`);
    ids.add(boss.canonicalId);
    displayNames.add(boss.displayName);
    sourceNames.add(boss.currentSourceName);
    if (boss.status !== 'live' && boss.status !== 'suppressed') errors.push(`${path}.status must be live or suppressed`);
    if (!isObject(boss.comparison)) {
      errors.push(`${path}.comparison must be an object`);
    } else {
      unknownKeys(boss.comparison, COMPARISON_KEYS, `${path}.comparison`, errors);
      if (boss.comparison.kind !== 'previous-observed-appearance') errors.push(`${path}.comparison.kind must be previous-observed-appearance`);
      for (const key of ['priorVersion', 'priorPhase', 'currentVersion', 'currentPhase']) {
        if (!nonEmptyText(boss.comparison[key])) errors.push(`${path}.comparison.${key} must be nonempty`);
      }
    }
    if (!Array.isArray(boss.phases) || boss.phases.length !== 2) {
      errors.push(`${path}.phases must contain exactly [prior, current]`);
      continue;
    }
    validatePhase(boss.phases[0], 0, threshold, errors);
    validatePhase(boss.phases[1], 1, threshold, errors);
    if (isObject(boss.comparison) && isObject(boss.phases[0]) && isObject(boss.phases[1])) {
      if (boss.phases[0].version !== boss.comparison.priorVersion || boss.phases[0].phase !== boss.comparison.priorPhase) {
        errors.push(`${path}.phases[0] must match comparison priorVersion/priorPhase`);
      }
      if (boss.phases[1].version !== boss.comparison.currentVersion || boss.phases[1].phase !== boss.comparison.currentPhase) {
        errors.push(`${path}.phases[1] must match comparison currentVersion/currentPhase`);
      }
      const priorRates = new Map(Array.isArray(boss.phases[0].characters) ? boss.phases[0].characters.map(character => [character.name, character.appearanceRate]) : []);
      if (Array.isArray(boss.phases[1].characters)) {
        for (const character of boss.phases[1].characters) {
          const expected = character.appearanceRate - (priorRates.get(character.name) ?? 0);
          if (character.priorAppearanceChange !== expected) errors.push(`${path}.phases[1].characters priorAppearanceChange must equal current appearanceRate minus prior appearanceRate`);
        }
      }
    }
    const requiresSuppression = boss.phases.some(phase => Number.isInteger(phase.sampleSize) && Number.isInteger(threshold) && phase.sampleSize < threshold);
    if (requiresSuppression && boss.status !== 'suppressed') errors.push(`${path}.status must be suppressed below the threshold`);
    if (!requiresSuppression && boss.status !== 'live') errors.push(`${path}.status must be live when both samples meet the threshold`);
    if (boss.status === 'suppressed' && boss.phases.some(phase => Array.isArray(phase.characters) && phase.characters.length > 0)) {
      errors.push(`${path}.characters must be withheld when the boss is suppressed`);
    }
  }
  return errors;
}

export function assertDABossCharacterTrends(data) {
  const errors = validateDABossCharacterTrends(data);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return data;
}

async function main() {
  const { readFile } = await import('node:fs/promises');
  const path = process.argv[2];
  if (!path) {
    console.error('usage: node scripts/validate-da-boss-character-trends.mjs <json-file>');
    process.exitCode = 2;
    return;
  }
  try {
    const data = JSON.parse(await readFile(path, 'utf8'));
    const errors = validateDABossCharacterTrends(data);
    if (errors.length > 0) {
      errors.forEach(error => console.error(`- ${error}`));
      process.exitCode = 1;
    } else {
      console.log(`Deadly Assault boss character trends are valid: ${path}`);
    }
  } catch (error) {
    console.error(`Unable to validate Deadly Assault boss character trends: ${error.message}`);
    process.exitCode = 1;
  }
}

if (typeof process !== 'undefined' && process.argv[1]) {
  const [{ resolve }, { pathToFileURL }] = await Promise.all([
    import('node:path'),
    import('node:url'),
  ]);
  if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
}
