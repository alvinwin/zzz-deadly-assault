import fs from 'node:fs';
import path from 'node:path';
import { isCanonicalReviewedBuff } from './reviewed-buff-briefs.mjs';
import { strictIsoTimestamp } from '../cycle-status.mjs';

const isIso = value => strictIsoTimestamp(value) !== null;
const isPlaceholder = value => value == null || (typeof value === 'string' && /pending|tbd|placeholder|example\.invalid/i.test(value));
const textAnnotationKinds = new Set(['quantity', 'attribute', 'specialty', 'mechanic', 'effect-term']);
const specialties = new Set(['Attack', 'Stun', 'Anomaly', 'Support', 'Defense', 'Rupture']);
const elements = new Set(['ice', 'fire', 'electric', 'ether', 'physical', 'wind']);

export function validateData(data, { allowFixture = false, now = Date.now() } = {}) {
  const errors = [];
  const { cycle, sources, encounters, buffs } = data || {};
  if (!cycle || !isIso(cycle.startsAt) || !isIso(cycle.endsAt) || !isIso(cycle.checkedAt)) errors.push('cycle timestamps must be valid ISO dates');
  if (isIso(cycle?.endsAt) && Date.parse(cycle.endsAt) <= now) errors.push('cycle is expired');
  if (isIso(cycle?.checkedAt) && now - Date.parse(cycle.checkedAt) > 14 * 86400000) errors.push('cycle checkedAt is stale');
  if (!Array.isArray(sources)) errors.push('sources must be an array');
  const sourceIds = new Set((sources || []).map(source => source?.id));
  const sourceListValid = value => Array.isArray(value) && value.length > 0 && value.every(id => sourceIds.has(id));
  if (!Array.isArray(encounters)) errors.push('encounters must be an array');
  const standard = (encounters || []).filter(e => e?.category === 'standard');
  const adversity = (encounters || []).filter(e => e?.category === 'adversity');
  if (standard.length !== 3) errors.push(`expected exactly 3 standard encounters, found ${standard.length}`);
  if (cycle?.hasAdversity === true && adversity.length !== 1) errors.push(`cycle hasAdversity=true requires exactly 1 adversity encounter, found ${adversity.length}`);
  if (cycle?.hasAdversity === false && adversity.length !== 0) errors.push(`cycle hasAdversity=false requires 0 adversity encounters, found ${adversity.length}`);
  if (![true, false].includes(cycle?.hasAdversity)) errors.push('cycle.hasAdversity must be boolean');
  if (!Array.isArray(buffs) || buffs.length !== 3 || buffs.some(buff => !buff?.id || !buff?.name || !buff?.description || isPlaceholder(buff.name) || isPlaceholder(buff.description))) errors.push('cycle must contain exactly 3 valid buffs');
  for (const buff of buffs || []) {
    const segments = buff?.segments;
    const description = typeof buff?.description === 'string' ? buff.description : '';
    let cursor = 0;
    const invalidSegments = !Array.isArray(segments) || segments.some(segment => {
      if (!Array.isArray(segment) || segment.length !== 3) return true;
      const [start, end, kind] = segment;
      const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= description.length && start >= cursor && textAnnotationKinds.has(kind);
      cursor = valid ? end : cursor;
      return !valid;
    });
    if (invalidSegments) errors.push(String(buff?.id || 'buff') + ' has invalid text annotations');
    const brief = buff?.brief;
    const validBrief = brief && typeof brief === 'object' && !Array.isArray(brief) && Object.keys(brief).sort().join(',') === 'payoff,trigger,who' && Object.values(brief).every(value => typeof value === 'string' && value.trim() && !isPlaceholder(value) && !/<\/?[a-z][^>]*>/i.test(value));
    if (cycle?.publishable === true && (!validBrief || !isCanonicalReviewedBuff(buff))) errors.push(String(buff?.id || 'buff') + ' is missing reviewed buff brief coverage');
  }
  if (!cycle?.provenance || !sourceListValid(cycle.provenance.rotation) || !sourceListValid(cycle.provenance.formula) || !sourceListValid(cycle.provenance.buffs)) errors.push('cycle has invalid field provenance');
  const ids = (encounters || []).map(e => e?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('encounter IDs must be unique');
  for (const encounter of encounters || []) {
    const id = encounter.id || 'encounter';
    if (!encounter.id || !encounter.name) errors.push(`${id} is missing id or name`);
    if (!['standard', 'adversity'].includes(encounter.category)) errors.push(`${id} has invalid category`);
    if (!Number.isFinite(encounter.hp) || encounter.hp <= 0) errors.push(`${id} has invalid/nonpositive HP`);
    if (!Number.isInteger(encounter.type) || encounter.type < 0) errors.push(id + ' has invalid enemy type');
    if (!Array.isArray(encounter.history) || encounter.history.length === 0 || encounter.history.length > 8 || encounter.history.some(point => !Array.isArray(point) || point.length !== 2 || typeof point[0] !== 'string' || !Number.isFinite(point[1]) || point[1] <= 0)) errors.push(id + ' has invalid HP history');
    const specialtyFit = encounter.specialtyFit;
    const invalidSpecialtyFit = specialtyFit !== null && (!specialtyFit || typeof specialtyFit !== 'object' || Array.isArray(specialtyFit) || Object.keys(specialtyFit).sort().join(',') !== 'reason,specialty' || !specialties.has(specialtyFit.specialty) || typeof specialtyFit.reason !== 'string' || !specialtyFit.reason.trim() || isPlaceholder(specialtyFit.reason));
    if (invalidSpecialtyFit) errors.push(id + ' has invalid specialty fit');
    if (typeof encounter.mechanic !== 'string' || !encounter.mechanic || /<\/?[a-z][^>]*>/i.test(encounter.mechanic)) errors.push(id + ' is missing or unsafe mechanic');
    if (!['reviewed', 'fallback'].includes(encounter.mechanicReview)) errors.push(id + ' has invalid mechanic review flag');
    if (!Array.isArray(encounter.mechanicSegments)) errors.push(id + ' is missing mechanic emphasis segments');
    let mechanicCursor = 0;
    if (Array.isArray(encounter.mechanicSegments) && encounter.mechanicSegments.some(segment => {
      if (!Array.isArray(segment) || segment.length !== 3) return true;
      const [start, end, kind] = segment;
      const valid = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= encounter.mechanic.length && start >= mechanicCursor && textAnnotationKinds.has(kind);
      mechanicCursor = valid ? end : mechanicCursor;
      return !valid;
    })) errors.push(id + ' has invalid mechanic text annotations');
    if (!Array.isArray(encounter.weaknesses) || encounter.weaknesses.some(value => isPlaceholder(value) || !elements.has(value))) errors.push(`${id} is missing weaknesses`);
    if (!Array.isArray(encounter.resistances) || encounter.resistances.some(value => isPlaceholder(value) || !elements.has(value))) errors.push(`${id} is missing resistances`);
    if (!Array.isArray(encounter.sourceRefs) || encounter.sourceRefs.length === 0 || encounter.sourceRefs.some(ref => !sourceIds.has(ref))) errors.push(`${id} has broken source references`);
    const provenance = encounter.provenance || {};
    for (const field of ['rotation', 'enemy', 'formula']) if (!sourceListValid(provenance[field])) errors.push(`${id} has invalid ${field} provenance source IDs`);
  }
  for (const source of sources || []) if (!source.id || !isIso(source.retrievedAt) || !source.url || !/^https?:\/\//.test(source.url) || /example\.invalid|pending|placeholder|tbd/i.test(source.url)) errors.push(`source ${source.id || '(unnamed)'} is incomplete or placeholder URL`);
  if (cycle?.publishable === false && !allowFixture) errors.push('fixture data is not publishable; verify current HP and provenance first');
  return allowFixture ? errors.filter(error => !/invalid\/nonpositive HP|missing weaknesses|missing resistances|missing valid buffs|placeholder URL|invalid .* provenance|fixture data is not publishable/.test(error)) : errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const allowFixture = process.argv.includes('--allow-fixture');
  let data;
  try { data = JSON.parse(fs.readFileSync(path.resolve('data/current.json'), 'utf8')); } catch (error) { console.error(`invalid JSON: ${error.message}`); process.exit(1); }
  const errors = validateData(data, { allowFixture });
  if (errors.length) { console.error(errors.map(error => `✗ ${error}`).join('\n')); process.exit(1); }
  console.log('✓ current cycle data passed validation');
}
