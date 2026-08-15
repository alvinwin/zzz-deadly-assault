import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { validateData } from '../scripts/validate-data.mjs';
import { buildHistory, calculateHP, normalizeSourceDescription, parseRange, parseSpecialty, segmentDescription, stripHtml, transform } from '../scripts/update-data.mjs';
const fixture = JSON.parse(fs.readFileSync('data/current.json', 'utf8'));
test('live data is publishable and has four encounters plus three global buffs', () => { assert.equal(fixture.cycle.publishable, true); assert.equal(fixture.cycle.hasAdversity, true); assert.equal(fixture.encounters.filter(e => e.category === 'standard').length, 3); assert.equal(fixture.encounters.filter(e => e.category === 'adversity').length, 1); assert.equal(fixture.buffs.length, 3); });
test('strict CLI validation passes live data', () => { assert.match(execFileSync('node', ['scripts/validate-data.mjs'], { encoding: 'utf8' }), /passed validation/); });
test('current-cycle parsing and HP formula match verified values', () => { const range = parseRange('14/08/2026 - 28/08/2026'); assert.equal(range.startsAt.toISOString(), '2026-08-14T00:00:00.000Z'); assert.equal(range.endsAt.toISOString(), '2026-08-28T00:00:00.000Z'); assert.equal(parseRange('31/02/2026 - 28/03/2026'), null); assert.equal(calculateHP(1, 200, [45499], 0), 197200218); assert.equal(calculateHP(2, 235, [0, 41404], 1), 210855875); assert.equal(calculateHP(3, 200, [42163], 0), 182741441); assert.equal(calculateHP(4, 290, [64248], 0), 729925961); });
test('HTML buff descriptions become safe plain text', () => assert.equal(stripHtml("<li>Gain <b>30%</b> &amp; power</li>"), 'Gain 30% & power'));
test('buff emphasis segmentation is deterministic, bounded, and plain text only', () => {
  const description = 'Gain 30% ATK for 10s. Ice DMG and Stunned targets matter.';
  const expected = [
    [5, 8, 'v'], [9, 12, 'd'], [17, 20, 'v'], [22, 29, 'd'], [34, 41, 'm']
  ];
  assert.deepEqual(segmentDescription(description), expected);
  assert.deepEqual(segmentDescription('<b>30%</b>'), [[3, 6, 'v']]);
  assert.equal(segmentDescription(description).map(([start, end]) => description.slice(start, end)).join(' '), '30% ATK 10s Ice DMG Stunned');
  assert.ok(segmentDescription(description).every(([, , kind]) => ['v', 'e', 'd', 'm', 'a', 't', 'r'].includes(kind)));
});
test('compound combat terms receive one complete damage segment', () => {
  const description = 'CRIT DMG, PEN Ratio, and All-Attribute RES are complete combat terms.';
  assert.deepEqual(segmentDescription(description).map(([start, end, kind]) => [description.slice(start, end), kind]), [
    ['CRIT DMG', 'd'], ['PEN Ratio', 'd'], ['All-Attribute RES', 'd']
  ]);
});
test('specialty phrases receive separate semantic kind codes', () => {
  const description = 'Anomaly specialty, Attack specialty, Rupture specialty.';
  assert.deepEqual(segmentDescription(description).map(([start, end, kind]) => [description.slice(start, end), kind]), [
    ['Anomaly specialty', 'a'], ['Attack specialty', 't'], ['Rupture specialty', 'r']
  ]);
});
test('current buff descriptions carry only safe, in-range highlight ranges', () => {
  for (const buff of fixture.buffs) {
    assert.ok(buff.segments.length > 0);
    for (const [start, end, kind] of buff.segments) {
      assert.equal(buff.description.slice(start, end).includes('<'), false);
      assert.ok(end <= buff.description.length);
      assert.ok(['v', 'e', 'd', 'm', 'a', 't', 'r'].includes(kind));
    }
  }
});
test('United Strength highlights complete RES terms, never standalone RES fragments', () => {
  const description = fixture.buffs.find(buff => buff.name === 'United Strength').description;
  const highlighted = segmentDescription(description).map(([start, end]) => description.slice(start, end));
  assert.ok(highlighted.includes('All-Attribute RES'));
  assert.equal(highlighted.some(term => term.toLowerCase() === 'res'), false);
  assert.equal(highlighted.some(term => /reduces/i.test(term)), false);
});
test('current history excludes future/placeholders and keeps the last eight comparable cycles', () => {
  const priest = fixture.encounters.find(encounter => encounter.id === '20300');
  assert.equal(priest.history.length, 8);
  assert.equal(priest.history[0][0], '2.2.1');
  assert.equal(priest.history.at(-1)[0], fixture.cycle.id);
  assert.equal(priest.history.some(([cycle]) => cycle === '3.1.3' || cycle.startsWith('3.2')), false);
});
test('history matches id, type, and category and applies historical formula', () => {
  const enemy = { name: 'Boss', baseHP: [10, 20], elementMult: [1, 1, 1, 1, 1, 1] };
  const versions = {
    old: { versionTime: '01/01/2026 - 02/01/2026', versionEnemies: [{ id: 'e', type: 0 }, { id: 'x', type: 0 }, { id: 'x', type: 0 }, { id: 'e', type: 0 }], versionHPMult: [100, 1, 1, 200] },
    match: { versionTime: '02/01/2026 - 03/01/2026', versionEnemies: [{ id: 'e', type: 1 }, { id: 'x', type: 0 }, { id: 'x', type: 0 }], versionHPMult: [150, 1, 1] },
    future: { versionTime: '04/01/2027 - 05/01/2027', versionEnemies: [{ id: 'e', type: 1 }], versionHPMult: [999] },
    placeholder: { versionTime: 'xx/xx/20xx - xx/xx/20xx', versionEnemies: [{ id: 'e', type: 1 }], versionHPMult: [999] }
  };
  const history = buildHistory({ versions, enemies: { e: enemy }, now: new Date('2026-02-15T00:00:00Z'), id: 'e', type: 1, category: 'standard' });
  assert.deepEqual(history, [['match', calculateHP(1, 150, enemy.baseHP, 1)]]);
});
test('history skips duplicate comparable appearances while current ambiguity fails', () => {
  const enemy = { name: 'Boss', baseHP: [10], elementMult: [1, 1, 1, 1, 1, 1], desc: ['<li>Source sentence.</li>'], misc: '' };
  const versions = { old: { versionTime: '01/01/2026 - 02/01/2026', versionEnemies: [{ id: 'e', type: 0 }, { id: 'e', type: 0 }, { id: 'x', type: 0 }], versionHPMult: [100, 200, 1] } };
  assert.deepEqual(buildHistory({ versions, enemies: { e: enemy }, now: new Date('2026-02-15T00:00:00Z'), id: 'e', type: 0, category: 'standard' }), []);
  const current = { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['b'], versionHPMult: [100, 100, 100, 100], versionEnemies: [{ id: 'e', type: 0 }, { id: 'e', type: 0 }, { id: 'x', type: 0 }, { id: 'y', type: 0 }] };
  assert.throws(() => transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: current }, enemies: { e: enemy, x: enemy, y: enemy }, buffs: { b: ['Buff', '', '<li>Text</li>'] } }), /ambiguous current encounter/);
});
test('specialty parsing accepts six supported values and rejects unknown misc', () => {
  for (const specialty of ['Attack', 'Stun', 'Anomaly', 'Support', 'Defense', 'Rupture']) assert.equal(parseSpecialty('<li>Suitable for Agents with <b>' + specialty + '</b> specialty.</li>'), specialty);
  assert.equal(parseSpecialty(''), null);
  assert.throws(() => parseSpecialty('<li>Suitable for Agents with Hybrid specialty.</li>'), /unknown enemy misc specialty/);
});
function validPayload() { const source = { id: 's1', label: 'Verified', url: 'https://example.com/cycle', retrievedAt: '2026-08-14T12:00:00Z' }; const encounter = (id, category = 'standard') => ({ id, name: id, category, type: 0, hp: 100, history: [['fixture', 100]], specialty: null, mechanic: 'Description', mechanicReview: 'fallback', mechanicSegments: [], weaknesses: [], resistances: [], sourceRefs: ['s1'], provenance: { rotation: ['s1'], enemy: ['s1'], formula: ['s1'] } }); const buff = id => ({ id, name: 'Buff', description: 'Description', segments: [] }); return { cycle: { startsAt: '2026-08-14T00:00:00Z', endsAt: '2026-08-28T00:00:00Z', checkedAt: '2026-08-14T12:00:00Z', hasAdversity: true, publishable: true, provenance: { rotation: ['s1'], formula: ['s1'], buffs: ['s1'] } }, sources: [source], buffs: [buff('b'), buff('c'), buff('d')], encounters: [encounter('one'), encounter('two'), encounter('three'), encounter('adv', 'adversity')] }; }
const errorsFor = mutate => { const payload = validPayload(); mutate(payload); return validateData(payload, { now: Date.parse('2026-08-14T13:00:00Z') }); };
test('valid publishable payload passes', () => assert.deepEqual(validateData(validPayload(), { now: Date.parse('2026-08-14T13:00:00Z') }), []));
test('rejects expired cycle', () => assert.ok(errorsFor(payload => { payload.cycle.endsAt = '2026-08-13T00:00:00Z'; }).some(error => error.includes('expired'))));
test('rejects missing encounter field and HP', () => { const errors = errorsFor(payload => { delete payload.encounters[0].name; payload.encounters[0].hp = 0; }); assert.ok(errors.some(error => error.includes('missing id or name'))); assert.ok(errors.some(error => error.includes('invalid/nonpositive HP'))); });
test('rejects broken source reference and provenance', () => { const errors = errorsFor(payload => { payload.encounters[0].sourceRefs = ['missing']; payload.encounters[0].provenance.enemy = ['missing']; }); assert.ok(errors.some(error => error.includes('broken source references'))); assert.ok(errors.some(error => error.includes('invalid enemy provenance'))); });
test('rejects malformed emphasis ranges', () => { const errors = errorsFor(payload => { payload.buffs[0].segments = [[0, 99, 'v']]; }); assert.ok(errors.some(error => error.includes('invalid emphasis segments'))); });
test('rejects invalid mechanic review flags', () => { const errors = errorsFor(payload => { payload.encounters[0].mechanicReview = 'unreviewed'; }); assert.ok(errors.some(error => error.includes('invalid mechanic review flag'))); });
test('rejects unsafe mechanic markup and unknown elements', () => { const errors = errorsFor(payload => { payload.encounters[0].mechanic = '<b>unsafe</b>'; payload.encounters[0].weaknesses = ['plasma']; }); assert.ok(errors.some(error => error.includes('unsafe mechanic'))); assert.ok(errors.some(error => error.includes('missing weaknesses'))); });
test('rejects duplicate IDs', () => assert.ok(errorsFor(payload => { payload.encounters[1].id = payload.encounters[0].id; }).some(error => error.includes('unique'))));
test('rejects adversity cardinality mismatch', () => assert.ok(errorsFor(payload => { payload.encounters = payload.encounters.slice(0, 3); }).some(error => error.includes('exactly 1 adversity'))));
test('transformation resolves cycle, affinities, buffs and schema', () => { const source = { name: 'Boss', baseHP: [10], elementMult: [0.8, 1.2, 1, 1, 1, 1], desc: ['<li>Source sentence.</li>'], misc: '' }; const versionEnemies = ['e', 'x', 'y', 'z'].map(id => ({ id, type: 0 })); const result = transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['b'], versionHPMult: [200, 200, 200, 200], versionEnemies } }, enemies: { e: source, x: source, y: source, z: source }, buffs: { b: ['Buff', '', '<li>Hello <b>30%</b> Ice</li>'] } }); assert.deepEqual(result.encounters[0].weaknesses, ['ice']); assert.deepEqual(result.encounters[0].resistances, ['fire']); assert.equal(result.buffs[0].description, 'Hello 30% Ice'); assert.deepEqual(result.buffs[0].segments, [[6, 9, 'v'], [10, 13, 'e']]); });
test('transformation fails on missing upstream IDs or schema', () => { const base = { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['missing'], versionHPMult: [1, 1, 1, 1], versionEnemies: [{ id: 'missing', type: 0 }, { id: 'missing', type: 0 }, { id: 'missing', type: 0 }, { id: 'missing', type: 0 }] }; assert.throws(() => transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: base }, enemies: {}, buffs: {} }), /missing enemy ID/); assert.throws(() => transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: { ...base, versionEnemies: [] } }, enemies: {}, buffs: {} }), /four encounters/); });
test('mechanic fingerprint drift and missing mapping fall back to exact sanitized source wording', () => {
  const enemy = { name: 'Boss', baseHP: [10], elementMult: [1, 1, 1, 1, 1, 1], desc: ['<li>Changed source sentence. More source detail.</li>'], misc: '' };
  const version = { versionName: 'x', versionTime: '14/08/2026 - 28/08/2026', versionBuffIDs: ['b'], versionHPMult: [100, 100, 100, 100], versionEnemies: [{ id: 'e', type: 0 }, { id: 'x', type: 0 }, { id: 'y', type: 0 }, { id: 'z', type: 0 }] };
  const result = transform({ now: new Date('2026-08-14T12:00:00Z'), versions: { x: version }, enemies: { e: enemy, x: enemy, y: enemy, z: enemy }, buffs: { b: ['Buff', '', '<li>Text</li>'] } });
  assert.equal(result.encounters[0].mechanic, 'Changed source sentence.');
  assert.equal(result.encounters[0].mechanicReview, 'fallback');
  assert.equal(normalizeSourceDescription(enemy.desc[0]), 'Changed source sentence. More source detail.');
});
