import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const owner = 'spiritfxxxx'; const repo = 'buhflipexplode'; const pinned = '620a7546b4d2934c58d55cdf7a435056576bb1fc';
const base = `https://raw.githubusercontent.com/${owner}/${repo}`;
export const parseRange = value => { const matches = [...String(value).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)]; if (matches.length !== 2) return null; const toDate = match => { const day = +match[1]; const month = +match[2]; const year = +match[3]; const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null; }; const startsAt = toDate(matches[0]); const endsAt = toDate(matches[1]); return startsAt && endsAt && endsAt > startsAt ? { startsAt, endsAt } : null; };
export const stripHtml = html => String(html ?? '').replace(/<li>/gi, '').replace(/<\/li>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+\n/g, '\n').trim();
const annotationTerms = [
  ['effect-term', 'Stun DMG Multiplier'], ['effect-term', 'Attribute Anomaly DMG'], ['effect-term', 'All-Attribute RES'], ['effect-term', 'CRIT DMG'], ['effect-term', 'PEN Ratio'],
  ['effect-term', 'Anomaly Proficiency'], ['effect-term', 'Miasma Shield'], ['effect-term', 'Ether DMG'], ['effect-term', 'Ice DMG'], ['effect-term', 'Ice RES'],
  ['effect-term', 'Ether RES'], ['effect-term', 'Sheer DMG'], ['effect-term', 'DMG'], ['effect-term', 'ATK'],
  ['specialty', 'Anomaly specialty'], ['specialty', 'Attack specialty'], ['specialty', 'Stun specialty'],
  ['specialty', 'Support specialty'], ['specialty', 'Defense specialty'], ['specialty', 'Rupture specialty'],
  ['mechanic', 'Basic Attack'], ['mechanic', 'EX Special Attack'], ['mechanic', 'Chain Attack'],
  ['mechanic', 'Attribute Anomaly'], ['mechanic', 'Repeated triggers'], ['mechanic', 'Stunned'],
  ['mechanic', 'Ether Veil'], ['mechanic', 'hits an enemy'],
  ['attribute', 'physical'], ['attribute', 'electric'], ['attribute', 'ether'], ['attribute', 'ice'], ['attribute', 'fire'], ['attribute', 'wind']
];
const escapeRegExp = value => value.replace(/[.*+?^()|[\]\\]/g, '\\$&');
const annotationPattern = new RegExp('(\\b\\d+(?:\\/\\d+)?(?:\\.\\d+)?(?:%|s)?(?![%s\\w])|' + annotationTerms.map(([, term]) => '\\b' + escapeRegExp(term) + '\\b').join('|') + ')', 'gi');
const textAnnotationKind = value => {
  if (/^\d/.test(value)) return 'quantity';
  return annotationTerms.find(([, term]) => term.toLowerCase() === value.toLowerCase())?.[0] || 'mechanic';
};
export const segmentDescription = description => {
  const text = String(description ?? '');
  return [...text.matchAll(annotationPattern)].map(match => [match.index, match.index + match[0].length, textAnnotationKind(match[0])]);
};
const reviewedMechanics = {
  '31300:0': { text: 'Apply an Attribute Anomaly to add 1 Blight Mark for 30 seconds. Each mark increases Attribute Anomaly DMG taken by 8%.', fingerprint: '3abe437609800d335cb4882c40356ae5131964af42867dde43fcd0271e501df8' },
  '24300:1': { text: 'The Thrall gets Contract and Self-Sacrifice when it changes turns with Sobek. Stun the Thrall to increase CRIT DMG taken by 50%.', fingerprint: 'be1dd328ccea95e379f41ff8736b1d9da89f208a0f19e77de8519dd803374d71' },
  '20300:0': { text: 'Each phase change increases Anomaly Buildup RES by 10% and CRIT DMG taken by 30%. Break Miasmic Shield to remove the stacks.', fingerprint: 'fb74aee5a014df48fbbcaf67ee862f0d4b7179a7c5cec4675ed8148c4838bf51' },
  '28400:0': { text: 'Trigger SHUTDOWN to decrease enemy All-Attribute RES by 10%. Agents with the Attack specialty then get 20% ATK, 25% PEN Ratio, and 60% Ice and Ether CRIT DMG.', fingerprint: 'c37e573f67e93fecee98506f37d7ddb918001bce4bc5b0c60ff263f0401ba95c' }
};
const reviewedBuffBriefs = {
  '69000066': {
    brief: {
      who: 'Squads with 2–3 Anomaly Agents',
      trigger: 'Build the squad; inflict an Attribute Anomaly',
      payoff: 'More Anomaly Proficiency and Attribute Anomaly DMG; the trigger lowers All-Attribute RES',
    },
    fingerprint: 'e45ad38b206496d662681245e64f498087f99997ff384582f82d64ed169024e9',
  },
  '69000068': {
    brief: {
      who: 'Attack Agents',
      trigger: 'Hit with Basic, EX Special, or Chain Attacks; hit a Stunned enemy',
      payoff: 'More ATK, Ice/Ether RES ignore, and Stun DMG Multiplier',
    },
    fingerprint: 'e4dd528a00ae2b96d3c88956802d1f86a3fc980e24f3cb91174410e16eeb6144',
  },
  '69000055': {
    brief: {
      who: 'Rupture Agents',
      trigger: 'Enter Ether Veil; keep hitting the enemy',
      payoff: 'More Sheer and Ether DMG, faster Miasma Shield removal, and more Stun DMG Multiplier',
    },
    fingerprint: '43477834c83536a3e86021944e557162edf10612b2274d535a852442ebfa00fb',
  },
};
export const normalizeSourceDescription = value => stripHtml(value).replace(/\s+/g, ' ').trim();
const reviewedBuffBrief = (id, description) => {
  const review = reviewedBuffBriefs[id];
  if (!review) throw new Error(`missing reviewed buff brief coverage for ${id}`);
  const fingerprint = crypto.createHash('sha256').update(normalizeSourceDescription(description)).digest('hex');
  if (fingerprint !== review.fingerprint) throw new Error(`reviewed buff brief source fingerprint changed for ${id}`);
  return { brief: review.brief, briefReview: 'reviewed', briefSourceSha256: fingerprint };
};
const reviewedMechanic = (id, type, enemy) => {
  const review = reviewedMechanics[id + ':' + type];
  const sourceDescription = normalizeSourceDescription(enemy?.desc?.[type]);
  if (!sourceDescription) throw new Error('missing sanitized mechanic source wording for ' + id + ':' + type);
  const fingerprint = crypto.createHash('sha256').update(sourceDescription).digest('hex');
  if (review && fingerprint === review.fingerprint) return { text: review.text, review: 'reviewed' };
  const fallback = sourceDescription.split(/(?<=\.)\s+/)[0];
  const warning = 'review mechanic wording for ' + (enemy?.name || 'enemy') + ' (' + id + ':' + type + '); using sanitized source wording';
  console.warn('warning: ' + warning);
  if (process.env.GITHUB_ACTIONS) console.log('::warning title=Mechanic review needed::' + warning);
  return { text: fallback, review: 'fallback' };
};
export const parseSpecialtyFit = misc => {
  const text = stripHtml(misc);
  if (!text) return null;
  const match = text.match(/\b(Attack|Stun|Anomaly|Support|Defense|Rupture)\b/i);
  if (!match || !/\bspecialty\b/i.test(text)) throw new Error('unknown enemy misc specialty: ' + text);
  return { specialty: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(), reason: text };
};
export const calculateHP = (stage, multiplier, baseHP, type) => Math.floor((stage === 4 ? 15.8 : 8.74) * multiplier * baseHP[type] * 24795 / 10000);
export const buildHistory = ({ versions, enemies, now, id, type, category }) => {
  const categoryFor = (refs, index) => refs.length === 4 && index === 3 ? 'adversity' : 'standard';
  return Object.entries(versions).map(([cycleId, value]) => { const range = parseRange(value.versionTime); return { cycleId, value, ...range }; }).filter(item => item.startsAt && item.endsAt && item.startsAt <= now).sort((a, b) => a.startsAt - b.startsAt).flatMap(item => {
    const refs = item.value.versionEnemies;
    if (!Array.isArray(refs)) return [];
    const matches = refs.map((ref, i) => ref.id === id && ref.type === type && categoryFor(refs, i) === category ? i : -1).filter(index => index >= 0);
    if (matches.length !== 1) { if (matches.length > 1) console.warn(`warning: skipping ambiguous historical encounter ${id}:${type}:${category} in cycle ${item.cycleId}`); return []; }
    const index = matches[0];
    const enemy = enemies[id];
    const multiplier = item.value.versionHPMult?.[index];
    if (index < 0 || !enemy || !Number.isFinite(multiplier) || !Number.isFinite(enemy.baseHP?.[type])) return [];
    return [[item.cycleId, calculateHP(index + 1, multiplier, enemy.baseHP, type)]];
  }).slice(-8);
};
export function transform({ versions, enemies, buffs, now = new Date(), commit = pinned }) {
  const entry = Object.entries(versions).map(([id, value]) => { const range = parseRange(value.versionTime); return ({ id, value, ...range }); }).filter(item => item.startsAt && item.endsAt && item.startsAt <= now && now < item.endsAt).sort((a, b) => b.startsAt - a.startsAt)[0];
  if (!entry) throw new Error('no date-current cycle found');
  const version = entry.value; if (!Array.isArray(version.versionEnemies) || version.versionEnemies.length !== 4) throw new Error('cycle must contain four encounters');
  const source = id => `${base}/${commit}/${id}`;
  const sourceDefs = [{ id: 'rotation', label: 'Rotation data', url: source('zzz/da/da-versions.json') }, { id: 'enemy', label: 'Enemy data', url: source('assets/zzz/enemies.json') }, { id: 'buff', label: 'Buff data', url: source('assets/zzz/buffs.json') }, { id: 'formula', label: 'HP formula', url: `https://github.com/${owner}/${repo}/blob/${commit}/zzz/da/da.js` }];
  const elements = ['ice', 'fire', 'electric', 'ether', 'physical', 'wind'];
  const categoryFor = (refs, index) => refs.length === 4 && index === 3 ? 'adversity' : 'standard';
  const encounters = version.versionEnemies.map((ref, index) => {
    const enemy = enemies[ref.id]; if (!enemy) throw new Error('missing enemy ID ' + ref.id);
    const category = categoryFor(version.versionEnemies, index);
    const matches = version.versionEnemies.filter((candidate, candidateIndex) => candidate.id === ref.id && candidate.type === ref.type && categoryFor(version.versionEnemies, candidateIndex) === category);
    if (matches.length !== 1) throw new Error(`ambiguous current encounter ${ref.id}:${ref.type}:${category}`);
    const mechanicReview = reviewedMechanic(ref.id, ref.type, enemy);
    const mechanic = mechanicReview?.text || null;
    const hp = calculateHP(index + 1, version.versionHPMult[index], enemy.baseHP, ref.type);
    const multipliers = enemy.elementMult;
    const specialtyFit = parseSpecialtyFit(enemy.misc);
    return { id: ref.id, type: ref.type, name: enemy.name, category, hp, history: buildHistory({ versions, enemies, now, id: ref.id, type: ref.type, category }), specialtyFit, mechanic, mechanicReview: mechanicReview?.review || null, mechanicSegments: segmentDescription(mechanic), weaknesses: elements.filter((_, i) => multipliers[i] < 1), resistances: elements.filter((_, i) => multipliers[i] > 1), sourceRefs: ['rotation', 'enemy', 'formula'], provenance: { rotation: ['rotation'], enemy: ['enemy'], formula: ['formula'] } };
  });
  const cycleBuffs = version.versionBuffIDs.map(id => { const buff = buffs[id]; if (!buff) throw new Error(`missing buff ID ${id}`); const description = stripHtml(buff[2] || buff[1]); return { id, name: buff[0], description, segments: segmentDescription(description), ...reviewedBuffBrief(id, description) }; });
  return { cycle: { id: entry.id, label: version.versionName, startsAt: entry.startsAt.toISOString(), endsAt: entry.endsAt.toISOString(), checkedAt: now.toISOString(), hasAdversity: true, publishable: true, formula: 'floor((stage===4?15.8:8.74)*versionHPMult[i]*enemy.baseHP[type]*24795/10000)', provenance: { rotation: ['rotation'], formula: ['formula'], buffs: ['buff'] } }, sources: sourceDefs.map(source => ({ ...source, retrievedAt: now.toISOString(), commit })), buffs: cycleBuffs, encounters };
}
async function fetchJson(url, headers = {}) { const response = await fetch(url, { headers: { 'User-Agent': 'zzz-deadly-assault-updater', 'Accept': 'application/vnd.github+json', ...headers } }); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
export async function update({ now = new Date() } = {}) { const auth = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}; const commitResponse = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits/main`, auth); const commit = commitResponse?.sha; if (!/^[0-9a-f]{40}$/i.test(commit) || !commitResponse.commit?.tree?.sha) throw new Error('GitHub API returned an invalid commit response'); const [versions, enemies, buffs] = await Promise.all(['zzz/da/da-versions.json', 'assets/zzz/enemies.json', 'assets/zzz/buffs.json'].map(file => fetchJson(`${base}/${commit}/${file}`, auth))); const result = transform({ versions, enemies, buffs, now, commit }); const target = path.resolve('data/current.json'); const temporary = `${target}.tmp-${process.pid}`; await fs.writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`); await fs.rename(temporary, target); return result; }
if (import.meta.url === `file://${process.argv[1]}`) update().then(result => console.log(`✓ updated ${result.cycle.id} from ${result.sources[0].commit}`)).catch(error => { console.error(`update:data failed: ${error.message}`); process.exit(1); });
