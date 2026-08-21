import { formatCycleRemaining, strictIsoTimestamp as iso } from './cycle-status.mjs';

const q = s => document.querySelector(s);
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const elementNames = { ice: 'Ice', fire: 'Fire', electric: 'Electric', ether: 'Ether', physical: 'Physical', wind: 'Wind' };
const elementIcons = Object.fromEntries(Object.keys(elementNames).map(name => [name, `https://cdn.prydwen.gg/images/zenless-zone-zero/icons/ele_${name}.webp`]));
const list = values => values?.length ? `<span class="element-list">${values.map(value => {
  const icon = elementIcons[value] ? `<img class="element-icon" src="${elementIcons[value]}" alt="" aria-hidden="true" width="17" height="17">` : '';
  return `<span class="element-chip element-${esc(value)}">${icon}<span>${esc(elementNames[value] || value)}</span></span>`;
}).join('')}</span>` : '<span class="none">None</span>';
const annotationTags = { quantity: 'strong', attribute: 'span', specialty: 'span', mechanic: 'span', 'effect-term': 'span' };
const termLinks = [
  { match: value => value === 'Attribute Anomaly' || value.startsWith('Attribute Anomaly '), url: 'https://sixthstreet.wiki/terms/attribute-anomaly/' },
];
const annotationClass = (kind, value) => {
  if (kind === 'attribute') {
    const attribute = Object.keys(elementNames).find(name => value.toLowerCase() === name || value.toLowerCase().startsWith(`${name} `));
    return 'text-annotation text-annotation-attribute' + (attribute ? ' attribute-' + attribute : '');
  }
  return `text-annotation text-annotation-${kind}`;
};
const renderSegments = (description, segments) => {
  let cursor = 0;
  let html = '';
  for (const [start, end, kind] of segments || []) {
    const tag = annotationTags[kind];
    if (!tag || !Number.isInteger(start) || !Number.isInteger(end) || start < cursor || end <= start || end > description.length) continue;
    const value = description.slice(start, end);
    const termLink = termLinks.find(term => term.match(value));
    const annotation = termLink
      ? `<a class="${annotationClass(kind, value)} term-link" href="${esc(termLink.url)}">${esc(value)}</a>`
      : `<${tag} class="${annotationClass(kind, value)}">${esc(value)}</${tag}>`;
    html += esc(description.slice(cursor, start)) + annotation;
    cursor = end;
  }
  return html + esc(description.slice(cursor));
};

const data = await fetch('data/current.json').then(response => response.json());
const { cycle } = data;
const encounters = data.encounters.map(encounter => ({ ...encounter, id: encounter.id ?? encounter.i, type: encounter.type ?? encounter.t, name: encounter.name ?? encounter.n, category: encounter.category ?? encounter.c, hp: encounter.hp ?? encounter.p, history: encounter.history || encounter.h, specialtyFit: encounter.specialtyFit ?? encounter.sf, mechanic: encounter.mechanic || encounter.m, mechanicReview: encounter.mechanicReview || encounter.mr, mechanicSegments: encounter.mechanicSegments || encounter.ms, weaknesses: encounter.weaknesses || encounter.w, resistances: encounter.resistances || encounter.x, sourceRefs: encounter.sourceRefs || encounter.q }));
const sourceById = new Map(data.sources.map(source => [source.id, source]));
const sourceBase = (sourceById.get('rotation')?.url || '').replace(/zzz\/da\/da-versions\.json$/, '');
const sourceLinks = ids => ids.map(id => {
  const source = sourceById.get(id);
  const url = source?.url?.startsWith('http') ? source.url : source?.url ? `${sourceBase}/${source.url}` : '#';
  return `<a href="${esc(url)}">${esc(source?.label || id)}</a>`;
}).join(' · ');
const buffSourceRefs = cycle.provenance?.buffs || ['buff'];
const formatCycleDate = value => { const date = new Date(value); return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`; };
const formatCheckedDate = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(new Date(value));

q('#status').innerHTML = cycle.publishable
  ? `<span>${formatCycleDate(cycle.startsAt)}–${formatCycleDate(cycle.endsAt)}</span><span class="verified">Verified ${formatCheckedDate(cycle.checkedAt)}</span><span class="remaining" aria-label="Time remaining in current phase" aria-live="off"></span>`
  : '<strong>Fixture — do not publish</strong><span>Current values still need verification</span>';
const t = q('.remaining');
const updateRemainingStatus = () => {
  const n = Date.now(), live = iso(cycle.endsAt) > n;
  q('.ticker-heading strong').hidden = q('.status-note').hidden = !live;
  if (t) t.textContent = formatCycleRemaining(cycle.endsAt, n);
};
updateRemainingStatus();
if (t) setInterval(updateRemainingStatus, 6e4);

const renderSparkline = (history, name) => {
  const values = history.map(point => point[1]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => {
    const x = values.length === 1 ? 60 : index / (values.length - 1) * 120;
    const y = max === min ? 14 : 26 - (value - min) / (max - min) * 22;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const historyLabel = history.map(([cycleId, hp]) => `${cycleId} HP ${hp.toLocaleString('en-US')}`).join('; ');
  return `<svg class="hp-sparkline" role="img" aria-label="HP history for ${esc(name)}: ${esc(historyLabel)}" viewBox="0 0 120 28" preserveAspectRatio="none"><title>HP history for ${esc(name)}: ${esc(historyLabel)}</title><polyline points="${points}" fill="none" vector-effect="non-scaling-stroke"></polyline></svg>`;
};
const renderHistory = (history, name) => {
  if (!history?.length || history.length === 1) return '<span class="hp-history-copy">No earlier HP value in this record</span>';
  const previous = history.at(-2);
  const latest = history.at(-1);
  const change = (latest[1] - previous[1]) / previous[1] * 100;
  const copy = Math.abs(change) < .05
    ? `HP unchanged since ${esc(previous[0])}`
    : `HP ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}% since ${esc(previous[0])}`;
  return `<span class="hp-history"><span class="hp-history-copy">${copy}</span>${renderSparkline(history, name)}</span>`;
};
const renderSpecialtyFit = specialtyFit => specialtyFit ? `<div class="fit"><span>Suitable specialty</span><strong>${esc(specialtyFit.specialty)}</strong></div>` : '';
const renderEncounterCard = (encounter, index) => `<article class="card ${encounter.category === 'adversity' ? 'adversity' : ''}">
  <header class="card-top"><span class="index">${String(index + 1).padStart(2, '0')}</span><span class="tag">${encounter.category === 'adversity' ? 'Adversity Mode' : 'Trial Mode'}</span></header>
  <h3>${esc(encounter.name)}</h3>
  <div class="matchup" aria-label="Matchup summary"><div><span>Weak to</span>${list(encounter.weaknesses)}</div><div><span>Resists</span>${list(encounter.resistances)}</div>${renderSpecialtyFit(encounter.specialtyFit)}</div>
  <div class="mechanic-callout"><span>Fight mechanic${encounter.mechanicReview === 'fallback' ? ' <small class="mechanic-source">· source wording</small>' : ''}</span><p>${renderSegments(encounter.mechanic, encounter.mechanicSegments)}</p></div>
  <details class="encounter-record mobile-disclosure" open><summary><span>${encounter.hp == null ? 'HP unavailable' : `${encounter.hp.toLocaleString('en-US')}&nbsp;HP`}</span>${renderHistory(encounter.history, encounter.name)}</summary><p class="provenance">Sources: ${sourceLinks(encounter.sourceRefs)} · ${esc(cycle.id)}</p></details>
</article>`;
const trialEncounters = encounters.filter(encounter => encounter.category !== 'adversity');
const adversityEncounters = encounters.filter(encounter => encounter.category === 'adversity');
q('#cards').innerHTML = `<section class="trial-group" aria-labelledby="trial-group-title"><div class="encounter-group-heading"><strong id="trial-group-title">Trial Mode</strong><span>3 encounters</span></div><div class="trial-cards">${trialEncounters.map((encounter, index) => renderEncounterCard(encounter, index)).join('')}</div></section>${adversityEncounters.length ? `<section class="adversity-group" aria-labelledby="adversity-group-title"><div class="encounter-group-heading"><strong id="adversity-group-title">Adversity Mode</strong><span>1 encounter</span></div>${adversityEncounters.map((encounter, index) => renderEncounterCard(encounter, trialEncounters.length + index)).join('')}</section>` : ''}`;

q('#buff-list').innerHTML = data.buffs.map(buff => {
  const brief = buff.brief;
  return `<article class="buff-card"><header><span>Buff option</span><h3>${esc(buff.name)}</h3></header><dl class="buff-brief"><div><dt>Who benefits</dt><dd>${esc(brief.who)}</dd></div><div><dt>Trigger or requirement</dt><dd>${esc(brief.trigger)}</dd></div><div><dt>Payoff</dt><dd>${esc(brief.payoff)}</dd></div></dl><details class="buff-disclosure mobile-disclosure" open><summary>Exact source wording</summary><div><p>${renderSegments(buff.description, buff.segments)}</p><small>${sourceLinks(buffSourceRefs)}</small></div></details></article>`;
}).join('');

const formatTrendRate = value => Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'Unavailable';
const previousRate = character => Number.isFinite(character.priorAppearanceChange) ? character.appearanceRate - character.priorAppearanceChange : null;
const formatPointChange = value => !Number.isFinite(value) ? 'No comparison' : `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)} percentage points`;
const renderTrendRow = (character, index, sampleSize) => `<li><span class="trend-rank">${index + 1}</span><strong>${esc(character.name)}</strong><span class="trend-current">${formatTrendRate(character.appearanceRate)}&#32;<small>of ${sampleSize.toLocaleString('en-US')} observed clears</small></span><span class="trend-prior">${Number.isFinite(previousRate(character)) ? `${formatTrendRate(previousRate(character))}&#32;last appearance · ${formatPointChange(character.priorAppearanceChange)}` : 'No earlier comparison'}</span><span class="trend-clears">${character.clearCount.toLocaleString('en-US')} clears</span></li>`;
const renderTrendPin = (label, phase) => { const provenance = phase.provenance || {}; return `<p><strong>${label}:</strong> <a href="${esc(provenance.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(provenance.sourceFile)}</a> · ${esc(phase.version)} ${esc(phase.phase)} · retrieved ${esc(provenance.retrievedAt)}<br><code>SHA-256 ${esc(provenance.sourceSha256)}</code></p>`; };
const expandTrends = trends => !trends.b ? trends : ({ methodology: { inclusion: trends.m[0], exclusions: trends.m[1] }, bosses: trends.b.map(([canonicalId, displayName, currentSourceName, status, phases]) => ({ canonicalId, displayName, currentSourceName, status, phases: phases.map(([version, phase, pin, sampleSize, characters]) => { const provenance = trends.p?.[pin] || pin; return { version, phase, provenance: { sourceUrl: provenance[0], sourceFile: provenance[1], sourceSha256: provenance[2], retrievedAt: provenance[3] }, sampleSize, characters: characters.map(([name, clearCount, appearanceRate, priorAppearanceChange]) => ({ name, clearCount, appearanceRate, priorAppearanceChange })) }; }) })) });
const renderBossTrend = (boss, index) => {
  const phases = boss.phases || [];
  const prior = phases[0] || {};
  const current = phases.at(-1) || {};
  const characters = current.characters || [];
  const first = characters[0];
  return `<article class="boss-trend"><header><span class="boss-trend-index">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(boss.displayName)}</h3><p>${current.sampleSize?.toLocaleString('en-US') || 'No'} observed clears · ${esc(current.version)} ${esc(current.phase)}</p></div><span class="boss-trend-status">Current phase</span></header>${first ? `<p class="boss-trend-lead"><strong>${esc(first.name)}</strong>&#32;appeared in&#32;<b>${formatTrendRate(first.appearanceRate)}</b>&#32;of ${current.sampleSize.toLocaleString('en-US')}&#32;observed clears.<span>${formatTrendRate(previousRate(first))}&#32;last appearance<br>${formatPointChange(first.priorAppearanceChange)}</span></p>` : '<p class="boss-trend-lead">Not enough observed clears to show character appearance.</p>'}<details><summary>See all character appearance</summary><div class="boss-trend-detail">${characters.length ? `<ol class="trend-rows">${characters.slice(0, 5).map((character, row) => renderTrendRow(character, row, current.sampleSize)).join('')}</ol>${characters.length > 5 ? `<details class="trend-more"><summary>Show ${characters.length - 5} more characters</summary><ol class="trend-rows">${characters.slice(5).map((character, row) => renderTrendRow(character, row + 5, current.sampleSize)).join('')}</ol></details>` : ''}` : ''}<details class="trend-source"><summary>Sources for this boss</summary><div>${renderTrendPin('Current phase', current)}${renderTrendPin('Last appearance', prior)}<p>Record: ${esc(boss.canonicalId)}</p></div></details></div></details></article>`;
};
const encounterCategoryByName = new Map(encounters.map(encounter => [encounter.name, encounter.category]));
const renderTrendGroup = (title, bosses, className, startIndex = 0) => `<section class="trend-mode-group ${className}" aria-labelledby="${className}-title"><div class="trend-mode-heading"><strong id="${className}-title">${title}</strong><span>${bosses.length} ${bosses.length === 1 ? 'encounter' : 'encounters'}</span></div><div class="boss-trend-grid">${bosses.map((boss, index) => renderBossTrend(boss, startIndex + index)).join('')}</div></section>`;
const trendsContainer = q('#boss-trends-content');
fetch('data/da-boss-character-trends.json').then(response => { if (!response.ok) throw new Error(`trend request failed: ${response.status}`); return response.json(); }).then(expandTrends).then(trends => {
  const bosses = trends.bosses || [];
  if (!bosses.length) throw new Error('no verified boss records');
  const categorized = bosses.map(boss => ({ ...boss, category: encounterCategoryByName.get(boss.displayName) }));
  if (categorized.some(boss => !boss.category)) throw new Error('trend boss does not match a current encounter mode');
  const trialBosses = categorized.filter(boss => boss.category === 'standard');
  const adversityBosses = categorized.filter(boss => boss.category === 'adversity');
  trendsContainer.innerHTML = `${renderTrendGroup('Trial Mode', trialBosses, 'trial-trends')}${adversityBosses.length ? renderTrendGroup('Adversity Mode', adversityBosses, 'adversity-trends', trialBosses.length) : ''}<details class="trend-method"><summary>How this was counted</summary><div><p><strong>Included:</strong> ${esc(trends.methodology?.inclusion || '')}</p><p><strong>Left out:</strong> ${esc((trends.methodology?.exclusions || []).join(' '))}</p><p><strong>Display limit:</strong> Up to 10 current-phase characters are included for each boss; five are shown before you expand the list. The last appearance is comparison-only.</p></div></details>`;
}).catch(error => { console.error(error); trendsContainer.innerHTML = '<p class="trends-error" role="status"><strong>Observed-clear record unavailable.</strong><span>The current encounter information remains available above.</span></p>'; });

const compactDisclosureQuery = matchMedia('(max-width: 760px)');
const syncMobileDisclosures = event => document.querySelectorAll('.mobile-disclosure').forEach(details => { details.open = !event.matches; });
syncMobileDisclosures(compactDisclosureQuery);
compactDisclosureQuery.addEventListener('change', syncMobileDisclosures);
