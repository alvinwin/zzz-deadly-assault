import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const feedbackUrl = 'https://github.com/alvinwin/zzz-deadly-assault/issues/new?template=feedback.yml';
const shiyuUrl = 'https://alvinwin.github.io/zzz-shiyu-defense/';
const contentHash = content => createHash('sha256').update(content).digest('hex').slice(0, 12);

const overlaps = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
const compactPayload = data => ({ cycle: (({ id, startsAt, endsAt, checkedAt, publishable }) => ({ id, startsAt, endsAt, checkedAt, publishable }))(data.cycle), sources: data.sources.map(({ id, label, url }) => ({ id, label, url })), buffs: data.buffs, encounters: data.encounters.map(({ id, type, name, category, hp, history, specialty, mechanic, mechanicReview, mechanicSegments, weaknesses, resistances, sourceRefs }) => ({ i: id, t: type, n: name, c: category, p: hp, h: history, s: specialty, m: mechanic, mr: mechanicReview, ms: mechanicSegments, w: weaknesses, x: resistances, q: sourceRefs })) });
const formatCycleDate = value => { const date = new Date(value); return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`; };
const formatCheckedDate = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit' }).format(new Date(value));
const statusNoteText = 'The site checks for new data when the cycle ends. It retries until the next cycle is available.';

const expectFreshnessStatus = async page => {
  const response = await page.request.get('/data/current.json');
  const { cycle } = await response.json();
  const expectedStatus = `cycle data for ${formatCycleDate(cycle.startsAt)} - ${formatCycleDate(cycle.endsAt)} // verified ${formatCheckedDate(cycle.checkedAt)}`;
  await expect(page.locator('#status')).toHaveText(expectedStatus);
  await expect(page.locator('body')).not.toContainText('verified brief');
  await expect(page.locator('.status-note')).toBeVisible();
  await expect(page.locator('.status-note')).toHaveText(statusNoteText);
  await expect(page.locator('#freshness')).toHaveCount(0);
  const geometry = await page.evaluate(() => {
    const status = document.querySelector('#status').getBoundingClientRect();
    const note = document.querySelector('.status-note').getBoundingClientRect();
    const heading = document.querySelector('.section-head h2').getBoundingClientRect();
    return {
      status: { left: status.left, right: status.right, top: status.top, bottom: status.bottom },
      note: { left: note.left, right: note.right, top: note.top, bottom: note.bottom },
      heading: { left: heading.left, right: heading.right, top: heading.top, bottom: heading.bottom },
      bannerToNoteGap: note.top - status.bottom,
      noteToHeadingGap: heading.top - note.bottom
    };
  });
  expect(overlaps(geometry.status, geometry.note)).toBe(false);
  expect(overlaps(geometry.note, geometry.heading)).toBe(false);
  expect(geometry.bannerToNoteGap).toBeGreaterThan(0);
  expect(geometry.noteToHeadingGap).toBeGreaterThan(0);
};

const expectFeedbackLink = async page => {
  const feedback = page.getByRole('link', { name: 'Send feedback' });
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveAttribute('href', feedbackUrl);
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
  const restingStyles = await feedback.evaluate(element => {
    const styles = getComputedStyle(element);
    return { backgroundColor: styles.backgroundColor, borderColor: styles.borderTopColor, color: styles.color };
  });
  expect(restingStyles).toEqual({ backgroundColor: 'rgb(67, 35, 28)', borderColor: 'rgb(236, 108, 77)', color: 'rgb(255, 255, 255)' });
  await feedback.focus();
  await expect(feedback).toBeFocused();
  expect(await feedback.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  const geometry = await feedback.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, position: getComputedStyle(element).position };
  });
  const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
  expect(geometry.position).toBe('fixed');
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
  return geometry;
};

const expectShiyuLink = async page => {
  const shiyu = page.getByRole('link', { name: 'View Shiyu Defense brief', exact: true });
  await expect(shiyu).toBeVisible();
  await expect(shiyu).toHaveAttribute('href', shiyuUrl);
  await expect(shiyu).not.toHaveAttribute('target');
  await page.keyboard.press('Tab');
  await expect(shiyu).toBeFocused();
  expect(await shiyu.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
};

const expectNoActionOverlap = async (page, feedbackRect) => {
  const contentRects = await page.locator('#buff-list a, .provenance a, footer > a:not(.feedback-link), footer > p, footer > span').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(contentRects.some(rect => overlaps(feedbackRect, rect))).toBe(false);
};

const expectCardsToBuffGap = async page => {
  const geometry = await page.evaluate(() => {
    const cards = document.querySelector('#cards');
    const buffs = document.querySelector('#global-buffs');
    const cardRects = [...cards.children].map(card => card.getBoundingClientRect());
    const cardsBottom = Math.max(cards.getBoundingClientRect().bottom, ...cardRects.map(rect => rect.bottom));
    const buffsTop = buffs.getBoundingClientRect().top;
    return { gap: buffsTop - cardsBottom, overlap: buffsTop < cardsBottom };
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(16);
  expect(geometry.overlap).toBe(false);
};

test('built deployment has deterministic cache-coherent asset references', async ({ page }) => {
  const index = fs.readFileSync('dist/index.html', 'utf8');
  const stylesMatch = index.match(/href="styles\.css\?v=([0-9a-f]{12})"/g);
  const appMatch = index.match(/src="app\.js\?v=([0-9a-f]{12})"/g);
  expect(stylesMatch).toHaveLength(1);
  expect(appMatch).toHaveLength(1);
  const cssHash = stylesMatch[0].match(/v=([0-9a-f]{12})/)[1];
  const appHash = appMatch[0].match(/v=([0-9a-f]{12})/)[1];
  const css = fs.readFileSync('dist/styles.css', 'utf8');
  const app = fs.readFileSync('dist/app.js', 'utf8');
  const data = fs.readFileSync('dist/data/current.json', 'utf8');
  const sourceData = JSON.parse(fs.readFileSync('data/current.json', 'utf8'));
  const emittedData = JSON.parse(data);
  expect(cssHash).toBe(contentHash(css));
  expect(appHash).toBe(contentHash(app));
  const dataMatch = app.match(/fetch\('data\/current\.json\?v=([0-9a-f]{12})'\)/g);
  expect(dataMatch).toHaveLength(1);
  const dataHash = dataMatch[0].match(/v=([0-9a-f]{12})/)[1];
  expect(emittedData.cycle.checkedAt).toBe(sourceData.cycle.checkedAt);
  expect(dataHash).toBe(contentHash(data));
  expect(contentHash(css + '\n')).not.toBe(cssHash);
  expect(contentHash(app + '\n')).not.toBe(appHash);
  expect(contentHash(data + '\n')).not.toBe(dataHash);
  await page.goto('/');
  await expectFreshnessStatus(page);
});

test('desktop shows current cards, semantic chips, escaped content, sources, and floating feedback link', async ({ page }) => { await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); await expectShiyuLink(page); await expectCardsToBuffGap(page); expect(await page.locator('#cards').evaluate(element => element.compareDocumentPosition(document.querySelector('#global-buffs')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy(); await expect(page.locator('.mechanic-callout')).toHaveCount(4); await expect(page.locator('.mechanic-callout').first()).toContainText('Apply an Attribute Anomaly to add 1 Blight Mark for 30 seconds.'); await expect(page.locator('.specialty-chip')).toHaveCount(3); await expect(page.locator('.specialty-anomaly')).toContainText('Recommended: Anomaly'); await expect(page.locator('.specialty-stun')).toContainText('Recommended: Stun'); await expect(page.locator('.specialty-rupture')).toContainText('Recommended: Rupture'); await expect(page.locator('.trend-up').first()).toBeVisible(); await expect(page.locator('.trend-flat').first()).toContainText('→ +0.0%'); await expect(page.locator('.trend-down')).toHaveCount(0); await expect(page.locator('.sparkline').first()).toHaveAttribute('role', 'img'); await expect(page.getByRole('img', {name:/3\.1\.1 HP 197200218.*3\.1\.2 HP 197200218/}).first()).toBeVisible(); await expect(page.locator('.card').nth(3)).toContainText('first appearance'); await expect(page.locator('.card').nth(3).locator('.sparkline')).toHaveCount(0); await expect(page.locator('.card').nth(0).locator('h3')).toHaveText('Girtablullu: Stagnant Aberrant'); await expect(page.locator('.card').nth(0).locator('h3 br')).toHaveCount(1); await expect(page.locator('.card').nth(3).locator('h3')).toHaveText('Rewritten: Sanguine Sweeper'); await expect(page.locator('.card').nth(3).locator('h3 br')).toHaveCount(1); await expect(page.locator('.card').nth(1).locator('h3 br')).toHaveCount(0); await expect(page.locator('.card').nth(2).locator('h3 br')).toHaveCount(0); await expectFreshnessStatus(page); await expect(page.locator('.section-head')).not.toContainText('cycle data for'); await expect(page.locator('dt').filter({hasText:'Weaknesses'}).first()).toBeVisible(); await expect(page.locator('.card').first()).toContainText('none'); await expect(page.locator('.card').nth(1).locator('.element-chip')).toHaveText(['Ice', 'Physical', 'Wind', 'Electric']); await expect(page.locator('.card').nth(1).locator('.element-chip').first()).toHaveClass(/element-ice/); await expect(page.locator('#global-buffs')).toContainText('GLOBAL BUFFS'); await expect(page.locator('#buff-list article')).toHaveCount(3); await expect(page.locator('#buff-list a')).toHaveCount(3); await expect(page.locator('#buff-list .emphasis-value').first()).toBeVisible(); await expect(page.locator('#buff-list .emphasis-damage').first()).toBeVisible(); await expect(page.locator('#buff-list .emphasis-mechanic').first()).toBeVisible(); await expect(page.locator('#buff-list .emphasis-specialty-anomaly')).toContainText('Anomaly specialty'); await expect(page.locator('#buff-list .emphasis-specialty-attack')).toContainText('Attack specialty'); await expect(page.locator('#buff-list .emphasis-specialty-rupture')).toContainText('Rupture specialty'); await expect(page.locator('.provenance').first().locator('a')).toHaveCount(3); await expect(page.locator('.provenance a').first()).toHaveAttribute('href', /620a7546b4d2934c58d55cdf7a435056576bb1fc/); expect(await page.locator('#buff-list').evaluate(element => element.innerHTML)).not.toMatch(/<\/?(?:li|b)>/i); expect(await page.locator('#global-buffs').evaluate(element => getComputedStyle(element).contentVisibility)).toBe('auto'); expect(await page.locator('body')).not.toContainText('<script>'); let rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); await page.screenshot({path:'test-results/desktop.png', fullPage:true}); });
test('mechanic emphasis stays inline with adjacent prose and punctuation', async ({ page }) => { await page.goto('/'); const mechanics = await page.locator('.mechanic-callout p').evaluateAll(paragraphs => paragraphs.map(paragraph => ({ text: paragraph.textContent, emphasis: [...paragraph.querySelectorAll('.emphasis')].map(element => ({ tag: element.tagName, display: getComputedStyle(element).display, parent: element.parentElement === paragraph })), blockDescendants: [...paragraph.querySelectorAll('*')].filter(element => getComputedStyle(element).display === 'block').length }))); expect(mechanics.some(({ text }) => text.includes('30 seconds. Each mark'))).toBe(true); expect(mechanics.flatMap(({ emphasis }) => emphasis)).toEqual(expect.arrayContaining([expect.objectContaining({ tag: 'STRONG', display: 'inline', parent: true }), expect.objectContaining({ tag: 'SPAN', display: 'inline', parent: true })])); expect(mechanics.every(({ blockDescendants }) => blockDescendants === 0)).toBe(true); });
test('adversity mechanic keeps compound combat terms intact', async ({ page }) => { await page.goto('/'); const mechanic = page.locator('.card.adversity .mechanic-callout'); const damageEmphasis = mechanic.locator('.emphasis-damage'); await expect(damageEmphasis.filter({ hasText: /^PEN Ratio$/ })).toHaveCount(1); await expect(damageEmphasis.filter({ hasText: /^CRIT DMG$/ })).toHaveCount(1); await expect(damageEmphasis.filter({ hasText: /^DMG$/ })).toHaveCount(0); });
test('mobile cards keep their width and floating feedback link fits without horizontal overflow', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); await expectShiyuLink(page); await expectCardsToBuffGap(page); await expectFreshnessStatus(page); expect(await page.locator('#buff-list').evaluate(element => getComputedStyle(element).rowGap)).toBe('24px'); const cards = await page.locator('.card').evaluateAll(elements => elements.map(card => ({ x: card.getBoundingClientRect().x, width: card.getBoundingClientRect().width }))); expect(new Set(cards.map(card => Math.round(card.x))).size).toBe(1); expect(cards[0].width).toBeGreaterThan(350); expect(cards[0].width).toBeLessThan(360); let rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.screenshot({path:'test-results/mobile.png', fullPage:true}); });

test('specialty labels map to distinct available classes', async ({ page }) => { await page.goto('/'); const css = await page.evaluate(() => fetch('styles.css').then(response => response.text())); for (const specialty of ['attack', 'stun', 'anomaly', 'support', 'defense', 'rupture']) expect(css).toContain(`.specialty-${specialty}`); const mismatches = await page.locator('.specialty-chip').evaluateAll(chips => chips.filter(chip => !chip.classList.contains('specialty-' + chip.textContent.replace('Recommended: ', '').trim().toLowerCase())).map(chip => chip.textContent)); expect(mismatches).toEqual([]); });

test('lower fixture HP renders an accessible negative trend with its prior cycle', async ({ page }) => { const response = await page.request.get('/data/current.json'); const fixture = compactPayload(await response.json()); fixture.encounters[0].h[1][1] = 177480196; await page.route('**/data/current.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) })); await page.goto('/'); const trend = page.locator('.card').first().locator('.trend-down'); await expect(trend).toHaveCount(1); await expect(trend).toHaveClass(/trend-down/); await expect(trend).toHaveText('↓ -10.0% vs 3.1.1'); await expect(trend).toHaveAttribute('aria-label', 'HP down -10.0 percent compared with cycle 3.1.1'); });
test('fallback mechanics are visibly marked while preserving full source wording', async ({ page }) => { const response = await page.request.get('/data/current.json'); const source = await response.json(); const fixture = compactPayload(source); fixture.encounters[0].mr = 'fallback'; await page.route('**/data/current.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) })); await page.goto('/'); await expect(page.locator('.mechanic-source').first()).toHaveText('source wording'); await expect(page.locator('.mechanic-callout').first()).toContainText('Each mark increases Attribute Anomaly DMG taken by 8%.'); });
