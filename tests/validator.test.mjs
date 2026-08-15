import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { validateData } from '../scripts/validate-data.mjs';
import { calculateHP, parseRange, segmentDescription, stripHtml, transform } from '../scripts/update-data.mjs';
const fixture = JSON.parse(fs.readFileSync('data/current.json', 'utf8'));
test('live data is publishable and has four encounters plus three global buffs', () => { assert.equal(fixture.cycle.publishable, true); assert.equal(fixture.cycle.hasAdversity, true); assert.equal(fixture.encounters.filter(e => e.category === 'standard').length, 3); assert.equal(fixture.encounters.filter(e => e.category === 'adversity').length, 1); assert.equal(fixture.buffs.length, 3); });
test('strict CLI validation passes live data', () => { assert.match(execFileSync('node', ['scripts/validate-data.mjs'], { encoding: 'utf8' }), /passed validation/); });
test('current-cycle parsing and HP formula match verified values', () => { const range = parseRange('14/08/2026 - 28/08/2026'); assert.equal(range.startsAt.toISOString(), '2026-08-14T00:00:00.000Z'); assert.equal(range.endsAt.toISOString(), '2026-08-28T00:00:00.000Z'); assert.equal(calculateHP(1, 200, [45499], 0), 197200218); assert.equal(calculateHP(2, 235, [0, 41404], 1), 210855875); assert.equal(calculateHP(3, 200, [42163], 0), 182741441); assert.equal(calculateHP(4, 290, [64248], 0), 729925961); });
test('HTML buff descriptions become safe plain text', () => assert.equal(stripHtml("<li>Gain <b>30%</b> &amp; power</li>"), 'Gain 30% & power'));
test('buff emphasis segmentation is deterministic, bounded, and plain text only', () => {
  const description = 'Gain 30% ATK for 10s. Ice DMG and Stunned targets matter.';
  const expected = [
    [5, 8, 'v'], [9, 12, 'd'], [17, 20, 'v'], [22, 29, 'd'], [34, 41, 'm']
  ];
  assert.deepEqual(segmentDescription(description), expected);
  assert.deepEqual(segmentDescription('<b>30%</b>'), [[3, 6, 'v']]);
  assert.equal(segmentDescription(description).map(([start, end]) => description.slice(start, end)).join(' '), '30% ATK 10s Ice DMG Stunned');
  assert.ok(segmentDescription(description).every(([, , kind]) => ['v', 'e', 'd', 'm'].includes(kind)));
});
test('current buff descriptions carry only safe, in-range highlight ranges', () => {
  for (const buff of fixture.buffs) {
    assert.ok(buff.segments.length > 0);
    for (const [start, end, kind] of buff.segments) {
      assert.equal(buff.description.slice(start, end).includes('<'), false);
      assert.ok(end <= buff.description.length);
      assert.ok(['v', 'e', 'd', 'm'].includes(kind));
    }
  }
});
function validPayload() { const source = { id: 's1', label: 'Verified', url: 'https://example.com/cycle', retrievedAt: '2026-08-14T12:00:00Z' }; const encounter = (id, category = 'standard') => ({ id, name: id, category, hp: 100, weaknesses: [], resistances: [], sourceRefs: ['s1'], provenance: { rotation: ['s1'], enemy: ['s1'], formula: ['s1'] } }); const buff = id => ({ id, name: 'Buff', description: 'Description', segments: [] }); return { cycle: { startsAt: '2026-08-14T00:00:00Z', endsAt: '2026-08-28T00:00:00Z', checkedAt: '2026-08-14T12:00:00Z', hasAdversity: true, publishable: true, provenance: { rotation: ['s1'], formula: ['s1'], buffs: ['s1'] } }, sources: [source], buffs: [buff('b'), buff('c'), buff('d')], encounters: [encounter('one'), encounter('two'), encounter('three'), encounter('adv', 'adversity')] }; }
const errorsFor = mutate => { const payload = validPayload(); mutate(payload); return validateData(payload, { now: Date.parse('2026-08-14T13:00:00Z') }); };
test('valid publishable payload passes', () => assert.deepEqual(validateData(validPayload(), { now: Date.parse('2026-08-14T13:00:00Z') }), []));
test('rejects expired cycle', () => assert.ok(errorsFor(payload => { payload.cycle.endsAt = '2026-08-13T00:00:00Z'; }).some(error => error.includes('expired'))));
test('rejects missing encounter field and HP', () => { const errors = errorsFor(payload => { delete payload.encounters[0].name; payload.encounters[0].hp = 0; }); assert.ok(errors.some(error => error.includes('missing id or name'))); assert.ok(errors.some(error => error.includes('invalid/nonpositive HP'))); });
test('rejects broken source reference and provenance', () => { const errors = errorsFor(payload => { payload.encounters[0].sourceRefs = ['missing']; payload.encounters[0].provenance.enemy = ['missing']; }); assert.ok(errors.some(error => error.includes('broken source references'))); assert.ok(errors.some(error => error.includes('invalid enemy provenance'))); });
test('rejects malformed emphasis ranges', () => { const errors = errorsFor(payload => { payload.buffs[0].segments = [[0, 99, 'v']]; }); assert.ok(errors.some(error => error.includes('invalid emphasis segments'))); });
test('rejects duplicate IDs', () => assert.ok(errorsFor(payload => { payload.encounters[1].id = payload.encounters[0].id; }).some(error => error.includes('unique'))));
test('rejects adversity cardinality mismatch', () => assert.ok(errorsFor(payload => { payload.encounters = payload.encounters.slice(0, 3); }).some(error => error.includes('exactly 1 adversity'))));
test('transformation resolves cycle, affinities, buffs and schema', () => { const source = { name: 'Boss', baseHP: [10], elementMult: [0.8, 1.2, 1, 1, 1, 1] }; const result = transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['b'], versionHPMult: [200, 200, 200, 200], versionEnemies: [{ id: 'e', type: 0 }, { id: 'e', type: 0 }, { id: 'e', type: 0 }, { id: 'e', type: 0 }] } }, enemies: { e: source }, buffs: { b: ['Buff', '', '<li>Hello <b>30%</b> Ice</li>'] } }); assert.deepEqual(result.encounters[0].weaknesses, ['ice']); assert.deepEqual(result.encounters[0].resistances, ['fire']); assert.equal(result.buffs[0].description, 'Hello 30% Ice'); assert.deepEqual(result.buffs[0].segments, [[6, 9, 'v'], [10, 13, 'e']]); });
test('transformation fails on missing upstream IDs or schema', () => { const base = { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['missing'], versionHPMult: [1, 1, 1, 1], versionEnemies: [{ id: 'missing', type: 0 }, { id: 'missing', type: 0 }, { id: 'missing', type: 0 }, { id: 'missing', type: 0 }] }; assert.throws(() => transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: base }, enemies: {}, buffs: {} }), /missing enemy ID/); assert.throws(() => transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: { ...base, versionEnemies: [] } }, enemies: {}, buffs: {} }), /four encounters/); });
