import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const feedbackUrl = 'https://github.com/alvinwin/zzz-deadly-assault/issues/new?template=feedback.yml';
const shiyuUrl = 'https://sd.sixthstreet.wiki/';
const contentHash = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const compactPayload = data => ({ cycle: (({ id, startsAt, endsAt, checkedAt, publishable }) => ({ id, startsAt, endsAt, checkedAt, publishable }))(data.cycle), sources: data.sources.map(({ id, label, url }) => ({ id, label, url })), buffs: data.buffs, encounters: data.encounters.map(encounter => ({ i: encounter.id ?? encounter.i, t: encounter.type ?? encounter.t, n: encounter.name ?? encounter.n, c: encounter.category ?? encounter.c, p: encounter.hp ?? encounter.p, h: encounter.history ?? encounter.h, sf: encounter.specialtyFit ?? encounter.sf, m: encounter.mechanic ?? encounter.m, mr: encounter.mechanicReview ?? encounter.mr, ms: encounter.mechanicSegments ?? encounter.ms, w: encounter.weaknesses ?? encounter.w, x: encounter.resistances ?? encounter.x, q: encounter.sourceRefs ?? encounter.q })) });
const formatCycleDate = value => { const date = new Date(value); return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`; };
const formatCheckedDate = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(new Date(value));

const expectFreshnessStatus = async page => {
  const { cycle } = await (await page.request.get('/data/current.json')).json();
  await expect(page.locator('#status')).toContainText(`${formatCycleDate(cycle.startsAt)}–${formatCycleDate(cycle.endsAt)}Verified ${formatCheckedDate(cycle.checkedAt)}`);
  await expect(page.locator('#status .remaining')).toHaveText(/(?:\d+d \d+h|\d+h(?: \d+m)?|\d+m) remaining|Refresh pending/);
  await expect(page.locator('.status-note')).toHaveText('This page checks for a new phase when the current one ends.');
  await expect(page.locator('#status .verified')).toBeVisible();
};

const expectActionLinks = async page => {
  const shiyu = page.getByRole('link', { name: 'View Shiyu Defense', exact: true });
  await expect(shiyu).toHaveAttribute('href', shiyuUrl);
  await shiyu.focus();
  await expect(shiyu).toBeFocused();
  expect(await shiyu.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  const feedback = page.getByRole('link', { name: 'Send feedback' });
  await expect(feedback).toHaveAttribute('href', feedbackUrl);
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
};

test('built deployment has deterministic cache-coherent asset references', async ({ page }) => {
  const index = fs.readFileSync('dist/index.html', 'utf8');
  const stylesMatch = index.match(/href="styles\.css\?v=([0-9a-f]{12})"/g);
  const appMatch = index.match(/src="app\.js\?v=([0-9a-f]{12})"/g);
  expect(stylesMatch).toHaveLength(1);
  expect(appMatch).toHaveLength(1);
  const css = fs.readFileSync('dist/styles.css', 'utf8');
  const app = fs.readFileSync('dist/app.js', 'utf8');
  const data = fs.readFileSync('dist/data/current.json', 'utf8');
  const cycleStatus = JSON.parse(fs.readFileSync('dist/data/cycle-status.json', 'utf8'));
  expect(stylesMatch[0]).toContain(contentHash(css));
  expect(appMatch[0]).toContain(contentHash(app));
  const dataMatch = app.match(/fetch\('data\/current\.json\?v=([0-9a-f]{12})'\)/g);
  expect(dataMatch).toHaveLength(1);
  expect(dataMatch[0]).toContain(contentHash(data));
  const cycleModuleMatch = app.match(/\.\/cycle-status\.([0-9a-f]{12})\.mjs/);
  expect(cycleModuleMatch).not.toBeNull();
  expect(cycleModuleMatch[1]).toBe(contentHash(fs.readFileSync(`dist/cycle-status.${cycleModuleMatch[1]}.mjs`, 'utf8')));
  expect(JSON.parse(data).cycle.checkedAt).toBe(JSON.parse(fs.readFileSync('data/current.json', 'utf8')).cycle.checkedAt);
  const { startsAt, endsAt, checkedAt } = JSON.parse(data).cycle;
  expect(cycleStatus).toEqual({ schemaVersion: 1, mode: 'deadly-assault', status: 'current', startsAt, endsAt, checkedAt });
  await page.goto('/');
  await expectFreshnessStatus(page);
});

test('desktop presents player-first matchup, mechanics, selectable buffs, and provenance', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Threat intelligence' })).toBeVisible();
  await expect(page.locator('.masthead')).toHaveCSS('min-height', '70px');
  await expect(page.locator('.hero')).toHaveCSS('min-height', '430px');
  await expect(page.locator('.hero .eyebrow')).toHaveCSS('font-size', '12px');
  await expect(page.locator('.hero .eyebrow')).toHaveCSS('font-weight', '800');
  await expect(page.locator('.ticker-inner')).toHaveCSS('min-height', '55px');
  await expect(page.locator('.ticker-heading strong')).toHaveCSS('font-size', '11px');
  await expect(page.locator('.ticker-heading strong')).toHaveCSS('font-weight', '800');
  await expect(page.locator('#status')).toHaveCSS('font-size', '11px');
  await expect(page.locator('#status')).toHaveCSS('justify-content', 'flex-end');
  await expect(page.locator('.card')).toHaveCount(4);
  await expect(page.locator('.matchup')).toHaveCount(4);
  await expect(page.locator('.fit strong')).toHaveText(['Anomaly', 'Stun', 'Rupture']);
  await expect(page.locator('.card.adversity .fit')).toHaveCount(0);
  await expect(page.locator('.card.adversity')).not.toContainText('Not specified');
  await expect(page.locator('#cards')).not.toContainText('Recommended');
  await expect(page.locator('.mechanic-callout p')).toHaveCount(4);
  await expect(page.locator('.mechanic-callout').first()).toContainText('Apply an Attribute Anomaly to add 1 Blight Mark for 30 seconds.');
  await expect(page.locator('.mechanic-callout').first().getByRole('link', { name: 'Attribute Anomaly', exact: true })).toHaveAttribute('href', 'https://sixthstreet.wiki/terms/attribute-anomaly/');
  await expect(page.locator('#buff-list').getByRole('link', { name: 'Attribute Anomaly', exact: true }).first()).toHaveAttribute('href', 'https://sixthstreet.wiki/terms/attribute-anomaly/');
  await expect(page.locator('.encounter-record')).toHaveCount(4);
  await expect(page.locator('.card').first()).toContainText('HP unchanged since 3.1.1');
  await expect(page.locator('.card').nth(3)).toContainText('No earlier HP value in this record');
  await expect(page.locator('.hp-sparkline')).toHaveCount(3);
  await expect(page.locator('.hp-sparkline').first()).toHaveAttribute('aria-label', /HP history for Girtablullu.*3\.1\.1 HP.*3\.1\.2 HP/);
  expect(await page.locator('.hp-sparkline polyline').evaluateAll(lines => lines.every(line => line.getAttribute('points')?.split(' ').length >= 2))).toBe(true);
  await expect(page.locator('.card').nth(1).locator('.element-chip')).toHaveText(['Ice', 'Physical', 'Wind', 'Electric']);
  await expect(page.locator('.element-chip .element-icon')).toHaveCount(8);
  expect(await page.locator('.element-chip').evaluateAll(chips => chips.every(chip => {
    const icon = chip.querySelector('.element-icon');
    return icon?.getAttribute('aria-hidden') === 'true' && icon.getAttribute('alt') === '';
  }))).toBe(true);
  await expect(page.locator('.provenance').first().locator('a')).toHaveCount(3);
  await expect(page.locator('.provenance a').first()).toHaveAttribute('href', /620a7546b4d2934c58d55cdf7a435056576bb1fc/);
  await expect(page.locator('.buff-card')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Selectable buffs' })).toHaveAttribute('href', '#selectable-buffs');
  await expect(page.locator('.hero-copy')).toContainText('selectable buffs');
  await expect(page.getByRole('link', { name: 'sixthstreet.wiki home' })).toHaveAttribute('href', 'https://sixthstreet.wiki/');
  await expect(page.locator('#selectable-buffs .eyebrow')).toHaveText('Selectable buffs');
  await expect(page.locator('#selectable-buffs .section-copy')).toContainText('Choose one of these buff options for each squad or challenge.');
  await expect(page.locator('.buff-card header > span')).toHaveText(['Buff option', 'Buff option', 'Buff option']);
  await expect(page.locator('.buff-brief dt')).toHaveCount(9);
  await expect(page.locator('#buff-list')).not.toContainText('See source wording');
  await expect(page.locator('#buff-list')).not.toContainText('Recommended');
  await expect(page.getByText('Take the useful note with you.')).toHaveCount(0);
  expect(await page.locator('#buff-list').evaluate(element => element.innerHTML)).not.toMatch(/<script/i);
  await expectFreshnessStatus(page);
  await expectActionLinks(page);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});

test('mechanic emphasis stays inline with adjacent source prose', async ({ page }) => {
  await page.goto('/');
  const mechanics = await page.locator('.mechanic-callout p').evaluateAll(paragraphs => paragraphs.map(paragraph => ({ text: paragraph.textContent, blockDescendants: [...paragraph.querySelectorAll('*')].filter(element => getComputedStyle(element).display === 'block').length })));
  expect(mechanics.some(({ text }) => text.includes('30 seconds. Each mark'))).toBe(true);
  expect(mechanics.every(({ blockDescendants }) => blockDescendants === 0)).toBe(true);
});

test('adversity mechanic keeps compound combat terms intact', async ({ page }) => {
  await page.goto('/');
  const effectTerms = page.locator('.card.adversity .text-annotation-effect-term');
  await expect(effectTerms.filter({ hasText: /^PEN Ratio$/ })).toHaveCount(1);
  await expect(effectTerms.filter({ hasText: /^CRIT DMG$/ })).toHaveCount(1);
  await expect(effectTerms.filter({ hasText: /^DMG$/ })).toHaveCount(0);
});

test('mobile uses a full vertical card flow with no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const mastheadHeight = await page.locator('.masthead').evaluate(element => element.getBoundingClientRect().height);
  expect(mastheadHeight).toBeGreaterThanOrEqual(106);
  expect(mastheadHeight).toBeLessThanOrEqual(108);
  await expect(page.locator('.hero')).toHaveCSS('min-height', '420px');
  const tickerHeight = await page.locator('.ticker-inner').evaluate(element => element.getBoundingClientRect().height);
  expect(tickerHeight).toBeGreaterThanOrEqual(54);
  expect(tickerHeight).toBeLessThanOrEqual(56);
  const tickerAlignment = await page.locator('.ticker-inner').evaluate(element => {
    const heading = element.querySelector('.ticker-heading').getBoundingClientRect();
    const status = element.querySelector('.status').getBoundingClientRect();
    return { headingTop: heading.top, statusTop: status.top };
  });
  expect(Math.abs(tickerAlignment.headingTop - tickerAlignment.statusTop)).toBeLessThan(16);
  await expect(page.locator('.card')).toHaveCount(4);
  const geometry = await page.locator('.trial-cards').evaluate(grid => ({ scrollWidth: grid.scrollWidth, clientWidth: grid.clientWidth, widths: [...grid.children].map(card => card.getBoundingClientRect().width), tops: [...grid.children].map(card => card.getBoundingClientRect().top) }));
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  expect(geometry.widths.every(width => width === geometry.clientWidth)).toBe(true);
  expect(geometry.tops[1]).toBeGreaterThan(geometry.tops[0]);
  expect(geometry.tops[2]).toBeGreaterThan(geometry.tops[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expectActionLinks(page);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('specialty language remains neutral and source-faithful', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.fit > span')).toHaveText(['Suitable specialty', 'Suitable specialty', 'Suitable specialty']);
  await expect(page.locator('.specialty-chip')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Recommended:');
  await expect(page.locator('body')).not.toContainText('Not specified');
});

test('lower fixture HP renders a plain-language comparison', async ({ page }) => {
  const fixture = compactPayload(await (await page.request.get('/data/current.json')).json());
  fixture.encounters[0].h[1][1] = 177480196;
  await page.route('**/data/current.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
  await page.goto('/');
  await expect(page.locator('.card').first().locator('.encounter-record')).toContainText('HP down 10.0% since 3.1.1');
});

test('fallback mechanics are marked while preserving full source wording', async ({ page }) => {
  const fixture = compactPayload(await (await page.request.get('/data/current.json')).json());
  fixture.encounters[0].mr = 'fallback';
  await page.route('**/data/current.json*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) }));
  await page.goto('/');
  await expect(page.locator('.mechanic-source').first()).toHaveText('· source wording');
  await expect(page.locator('.mechanic-callout').first()).toContainText('Each mark increases Attribute Anomaly DMG taken by 8%.');
});
