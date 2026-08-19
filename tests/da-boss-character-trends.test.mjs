import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CSV_HEADER, importDABossCharacterTrends } from '../scripts/import-da-boss-character-trends.mjs';

const row = (uid, boss, ch1, ch2, ch3) => `${uid},1,3,100,${boss},none,${ch1},1,${ch2},2,${ch3},3,Butler,10%`;
const currentCsv = `${CSV_HEADER}\n${row('c1', 'Current Alpha', 'Anby', 'Billy', 'Corin')}\n${row('c2', 'Current Alpha', 'Anby', 'Billy', 'Corin')}\n${row('c3', 'Current Beta', 'Anby', 'Billy', 'Nekomata')}\n${row('c4', 'Current Beta', 'Anby', 'Billy', 'Nekomata')}\n`;
const priorAlphaCsv = `${CSV_HEADER}\n${row('a1', 'Prior Alpha', 'Anby', 'Billy', 'Anby')}\n${row('a2', 'Prior Alpha', 'Anby', 'Billy', 'Billy')}\n`;
const priorBetaCsv = `${CSV_HEADER}\n${row('b1', 'Prior Beta', 'Anby', 'Billy', 'Nekomata')}\n${row('b2', 'Prior Beta', 'Anby', 'Billy', 'Nekomata')}\n`;

function descriptor(input, sourceFile, version, phase, revision, sourceUrl = `https://example.test/blob/${revision}/${sourceFile}`) {
  const sourceSha256 = createHash('sha256').update(input).digest('hex');
  return { input, sourceFile, sourceUrl, sourceRevision: revision, sourceSha256, retrievedAt: '2026-08-19T12:00:00Z', version, phase };
}

const current = descriptor(currentCsv, 'current.csv', '3.2', 'Phase 2', 'a'.repeat(40));
const priorAlpha = descriptor(priorAlphaCsv, 'prior-alpha.csv', '3.1', 'Phase 1', 'b'.repeat(40));
const priorBeta = descriptor(priorBetaCsv, 'prior-beta.csv', '3.1', 'Phase 1', 'c'.repeat(40));
const options = {
  current,
  suppressionThreshold: 1,
  bosses: [
    { canonicalId: 'alpha', displayName: 'Alpha', currentSourceName: 'Current Alpha', prior: { ...priorAlpha, sourceName: 'Prior Alpha' } },
    { canonicalId: 'beta', displayName: 'Beta', currentSourceName: 'Current Beta', prior: { ...priorBeta, sourceName: 'Prior Beta' } },
  ],
};

test('imports two bosses with phase-local provenance, prior name changes, and exact deltas', () => {
  const data = importDABossCharacterTrends(options);
  assert.equal(data.bosses.length, 2);
  assert.deepEqual(data.bosses[0].phases.map(phase => phase.provenance.sourceSha256), [priorAlpha.sourceSha256, current.sourceSha256]);
  assert.equal(data.bosses[0].phases[0].provenance.sourceFile, 'prior-alpha.csv');
  assert.equal(data.bosses[0].phases[0].provenance.sourceUrl, priorAlpha.sourceUrl);
  assert.equal(data.bosses[0].currentSourceName, 'Current Alpha');
  assert.equal(data.bosses[0].comparison.kind, 'previous-observed-appearance');
  const alphaCurrent = data.bosses[0].phases[1].characters;
  assert.equal(alphaCurrent.find(character => character.name === 'Corin').priorAppearanceChange, 1);
  assert.equal(alphaCurrent.find(character => character.name === 'Anby').priorAppearanceChange, 0);
  assert.equal(JSON.stringify(data).includes('uid'), false);
});

test('rejects duplicate mappings, unmapped current bosses, absent prior bosses, and bad pins', () => {
  assert.throws(() => importDABossCharacterTrends({ ...options, bosses: [options.bosses[0], { ...options.bosses[1], canonicalId: 'alpha' }] }), /duplicate canonicalId/);
  assert.throws(() => importDABossCharacterTrends({ ...options, bosses: [options.bosses[0]] }), /unmapped current boss/);
  assert.throws(() => importDABossCharacterTrends({ ...options, bosses: [{ ...options.bosses[0], prior: { ...priorAlpha, sourceName: 'Missing' } }, options.bosses[1]] }), /boss not found/);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: { ...current, sourceSha256: 'd'.repeat(64) } }), /does not match/);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: { ...current, sourceRevision: 'bad' } }), /40-hex/);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: { ...current, sourceUrl: undefined } }), /sourceUrl.*HTTP\(S\)/);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: { ...current, sourceUrl: 'ftp://example.test/current.csv' } }), /sourceUrl.*HTTP\(S\)/);
  const drifted = currentCsv.replace(CSV_HEADER, `${CSV_HEADER},extra`);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: descriptor(drifted, 'current.csv', '3.2', 'Phase 2', 'a'.repeat(40)) }), /header must exactly/);
});

test('counts incomplete teams as exclusions and suppresses all output below threshold', () => {
  const incomplete = currentCsv.replace(`${row('c2', 'Current Alpha', 'Anby', 'Billy', 'Corin')}\n`, `${row('c2', 'Current Alpha', 'Anby', 'Billy', '')}\n`);
  const changedCurrent = descriptor(incomplete, 'current.csv', '3.2', 'Phase 2', 'a'.repeat(40));
  const data = importDABossCharacterTrends({ ...options, current: changedCurrent, suppressionThreshold: 3 });
  const alpha = data.bosses[0];
  assert.equal(alpha.status, 'suppressed');
  assert.equal(alpha.phases[1].inputRows, 2);
  assert.equal(alpha.phases[1].excludedRows, 1);
  assert.equal(alpha.phases[1].sampleSize, 1);
  assert.deepEqual(alpha.phases.flatMap(phase => phase.characters), []);
});

test('rejects malformed included rows', () => {
  const malformed = currentCsv.replace(`${row('c1', 'Current Alpha', 'Anby', 'Billy', 'Corin')}`, `${row('c1', 'Current Alpha', 'Anby', 'Billy', 'Corin').replace(',100,', ',bad,')}`);
  assert.throws(() => importDABossCharacterTrends({ ...options, current: descriptor(malformed, 'current.csv', '3.2', 'Phase 2', 'a'.repeat(40)) }), /score must be numeric/);
});
import { validateDABossCharacterTrends } from '../scripts/validate-da-boss-character-trends.mjs';

const provenance = name => ({ sourceRevision: 'a'.repeat(40), sourceSha256: 'b'.repeat(64), sourceFile: name, sourceUrl: `https://example.test/blob/a/${name}`, retrievedAt: '2026-08-19T12:00:00Z' });

function validData() {
  return {
    schemaVersion: '1.0',
    cohortLabel: 'Observed submitted/public-profile clears',
    methodology: { inclusion: 'Descriptive aggregate only; no recommendations.', exclusions: ['Incomplete three-character teams are excluded.'], suppressionThreshold: 10 },
    bosses: [{
      canonicalId: 'boss-1', displayName: 'Boss One', currentSourceName: 'Boss Current', status: 'live',
      comparison: { kind: 'previous-observed-appearance', priorVersion: '3.1', priorPhase: 'Phase 1', currentVersion: '3.2', currentPhase: 'Phase 2' },
      phases: [
        { version: '3.1', phase: 'Phase 1', provenance: provenance('prior.csv'), inputRows: 10, excludedRows: 0, sampleSize: 10, characters: [{ name: 'Anby', clearCount: 8, appearanceRate: 0.8, priorAppearanceChange: null }] },
        { version: '3.2', phase: 'Phase 2', provenance: provenance('current.csv'), inputRows: 10, excludedRows: 0, sampleSize: 10, characters: [{ name: 'Anby', clearCount: 9, appearanceRate: 0.9, priorAppearanceChange: 0.09999999999999998 }, { name: 'Billy', clearCount: 4, appearanceRate: 0.4, priorAppearanceChange: 0.4 }] },
      ],
    }],
  };
}

const hasError = (data, text) => validateDABossCharacterTrends(data).some(error => error.includes(text));

test('accepts exact two-phase collection with provenance and arithmetic', () => {
  assert.deepEqual(validateDABossCharacterTrends(validData()), []);
});

test('rejects duplicate bosses, wrong phase order, malformed provenance, and recommendation fields', () => {
  const data = validData();
  data.bosses.push(structuredClone(data.bosses[0]));
  assert.equal(hasError(data, 'canonicalId must be unique'), true);
  const single = validData();
  single.bosses[0].phases.reverse();
  assert.equal(hasError(single, 'must match comparison priorVersion'), true);
  const provenanceBad = validData();
  provenanceBad.bosses[0].phases[0].provenance.sourceSha256 = 'bad';
  assert.equal(hasError(provenanceBad, '64-hex SHA256'), true);
  const missingSourceUrl = validData();
  delete missingSourceUrl.bosses[0].phases[0].provenance.sourceUrl;
  assert.equal(hasError(missingSourceUrl, 'sourceUrl must be a valid HTTP(S) URL'), true);
  const invalidSourceUrl = validData();
  invalidSourceUrl.bosses[0].phases[0].provenance.sourceUrl = 'ftp://example.test/prior.csv';
  assert.equal(hasError(invalidSourceUrl, 'sourceUrl must be a valid HTTP(S) URL'), true);
  const recommendation = validData();
  recommendation.methodology.recommendations = ['use Anby'];
  assert.equal(hasError(recommendation, 'unknown key recommendations'), true);
});

test('rejects UID leakage, arithmetic drift, unsorted characters, and missing incomplete-team wording', () => {
  const data = validData();
  data.bosses[0].phases[1].provenance.uid = 'must-not-leak';
  data.bosses[0].phases[1].characters[0].priorAppearanceChange = 0;
  data.bosses[0].phases[1].characters.reverse();
  data.methodology.exclusions = ['Rows omitted.'];
  assert.equal(hasError(data, 'must not contain a uid key'), true);
  assert.equal(hasError(data, 'priorAppearanceChange must equal'), true);
  assert.equal(hasError(data, 'sorted by clearCount'), true);
  assert.equal(hasError(data, 'incomplete three-character teams'), true);
});

test('requires suppression when either phase is below threshold and allows zero samples', () => {
  const data = validData();
  data.bosses[0].status = 'live';
  data.bosses[0].phases[0].sampleSize = 0;
  data.bosses[0].phases[0].inputRows = 2;
  data.bosses[0].phases[0].excludedRows = 2;
  data.bosses[0].phases[0].characters = [];
  assert.equal(hasError(data, 'status must be suppressed'), true);
});
