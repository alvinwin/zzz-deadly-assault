import fs from 'node:fs/promises';
import path from 'node:path';
const owner = 'spiritfxxxx'; const repo = 'buhflipexplode'; const pinned = '620a7546b4d2934c58d55cdf7a435056576bb1fc';
const base = `https://raw.githubusercontent.com/${owner}/${repo}`;
export const parseRange = value => { const matches = [...String(value).matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)]; if (matches.length !== 2) return null; const toDate = match => new Date(Date.UTC(+match[3], +match[2] - 1, +match[1])); return { startsAt: toDate(matches[0]), endsAt: toDate(matches[1]) }; };
export const stripHtml = html => String(html ?? '').replace(/<li>/gi, '').replace(/<\/li>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+\n/g, '\n').trim();
const emphasisTerms = [
  ['damage', 'Stun DMG Multiplier'], ['damage', 'Attribute Anomaly DMG'], ['damage', 'All-Attribute RES'],
  ['damage', 'Anomaly Proficiency'], ['damage', 'Miasma Shield'], ['damage', 'Ether DMG'], ['damage', 'Ice DMG'], ['damage', 'Ice RES'],
  ['damage', 'Ether RES'], ['damage', 'Sheer DMG'], ['damage', 'DMG'], ['damage', 'RES'], ['damage', 'ATK'],
  ['mechanic', 'Anomaly specialty'], ['mechanic', 'Attack specialty'], ['mechanic', 'Rupture specialty'],
  ['mechanic', 'Basic Attack'], ['mechanic', 'EX Special Attack'], ['mechanic', 'Chain Attack'],
  ['mechanic', 'Attribute Anomaly'], ['mechanic', 'Repeated triggers'], ['mechanic', 'Stunned'],
  ['mechanic', 'Ether Veil'], ['mechanic', 'hits an enemy'],
  ['element', 'physical'], ['element', 'electric'], ['element', 'ether'], ['element', 'ice'], ['element', 'fire'], ['element', 'wind']
];
const escapeRegExp = value => value.replace(/[.*+?^()|[\]\\]/g, '\\$&');
const emphasisPattern = new RegExp('(\\b\\d+(?:\\/\\d+)?(?:\\.\\d+)?(?:%|s)?(?![%s\\w])|' + emphasisTerms.map(([, term]) => escapeRegExp(term)).join('|') + ')', 'gi');
const emphasisKind = value => {
  if (/^\d/.test(value)) return 'v';
  return ({ damage: 'd', element: 'e', mechanic: 'm' })[emphasisTerms.find(([, term]) => term.toLowerCase() === value.toLowerCase())?.[0] || 'mechanic'];
};
export const segmentDescription = description => {
  const text = String(description ?? '');
  return [...text.matchAll(emphasisPattern)].map(match => [match.index, match.index + match[0].length, emphasisKind(match[0])]);
};
export const calculateHP = (stage, multiplier, baseHP, type) => Math.floor((stage === 4 ? 15.8 : 8.74) * multiplier * baseHP[type] * 24795 / 10000);
export function transform({ versions, enemies, buffs, now = new Date(), commit = pinned }) {
  const entry = Object.entries(versions).map(([id, value]) => { const range = parseRange(value.versionTime); return ({ id, value, ...range }); }).filter(item => item.startsAt && item.endsAt && item.startsAt <= now && now < item.endsAt).sort((a, b) => b.startsAt - a.startsAt)[0];
  if (!entry) throw new Error('no date-current cycle found');
  const version = entry.value; if (!Array.isArray(version.versionEnemies) || version.versionEnemies.length !== 4) throw new Error('cycle must contain four encounters');
  const source = id => `${base}/${commit}/${id}`;
  const sourceDefs = [{ id: 'rotation', label: 'Rotation data', url: source('zzz/da/da-versions.json') }, { id: 'enemy', label: 'Enemy data', url: source('assets/zzz/enemies.json') }, { id: 'buff', label: 'Buff data', url: source('assets/zzz/buffs.json') }, { id: 'formula', label: 'HP formula', url: `https://github.com/${owner}/${repo}/blob/${commit}/zzz/da/da.js` }];
  const elements = ['ice', 'fire', 'electric', 'ether', 'physical', 'wind'];
  const encounters = version.versionEnemies.map((ref, index) => { const enemy = enemies[ref.id]; if (!enemy) throw new Error(`missing enemy ID ${ref.id}`); const hp = calculateHP(index + 1, version.versionHPMult[index], enemy.baseHP, ref.type); const multipliers = enemy.elementMult; return { id: ref.id, name: enemy.name, category: index === 3 ? 'adversity' : 'standard', hp, weaknesses: elements.filter((_, i) => multipliers[i] < 1), resistances: elements.filter((_, i) => multipliers[i] > 1), sourceRefs: ['rotation', 'enemy', 'formula'], provenance: { rotation: ['rotation'], enemy: ['enemy'], formula: ['formula'] } }; });
  const cycleBuffs = version.versionBuffIDs.map(id => { const buff = buffs[id]; if (!buff) throw new Error(`missing buff ID ${id}`); const description = stripHtml(buff[2] || buff[1]); return { id, name: buff[0], description, segments: segmentDescription(description) }; });
  return { cycle: { id: entry.id, label: version.versionName, startsAt: entry.startsAt.toISOString(), endsAt: entry.endsAt.toISOString(), checkedAt: now.toISOString(), hasAdversity: true, publishable: true, formula: 'floor((stage===4?15.8:8.74)*versionHPMult[i]*enemy.baseHP[type]*24795/10000)', provenance: { rotation: ['rotation'], formula: ['formula'], buffs: ['buff'] } }, sources: sourceDefs.map(source => ({ ...source, retrievedAt: now.toISOString(), commit })), buffs: cycleBuffs, encounters };
}
async function fetchJson(url, headers = {}) { const response = await fetch(url, { headers: { 'User-Agent': 'zzz-deadly-assault-updater', 'Accept': 'application/vnd.github+json', ...headers } }); if (!response.ok) throw new Error(`${response.status} ${url}`); return response.json(); }
export async function update({ now = new Date() } = {}) { const auth = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}; const commitResponse = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/commits/main`, auth); const commit = commitResponse?.sha; if (!/^[0-9a-f]{40}$/i.test(commit) || !commitResponse.commit?.tree?.sha) throw new Error('GitHub API returned an invalid commit response'); const [versions, enemies, buffs] = await Promise.all(['zzz/da/da-versions.json', 'assets/zzz/enemies.json', 'assets/zzz/buffs.json'].map(file => fetchJson(`${base}/${commit}/${file}`, auth))); const result = transform({ versions, enemies, buffs, now, commit }); const target = path.resolve('data/current.json'); const temporary = `${target}.tmp-${process.pid}`; await fs.writeFile(temporary, `${JSON.stringify(result, null, 2)}\n`); await fs.rename(temporary, target); return result; }
if (import.meta.url === `file://${process.argv[1]}`) update().then(result => console.log(`✓ updated ${result.cycle.id} from ${result.sources[0].commit}`)).catch(error => { console.error(`update:data failed: ${error.message}`); process.exit(1); });
