import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const sourceTrends = JSON.parse(await readFile(new URL('../../data/da-boss-character-trends.json', import.meta.url)));

test('desktop renders four mode-grouped observed-clear summaries and sources', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Observed character use by boss', exact: true })).toBeVisible();
  await expect(page.getByText('Characters recorded in submitted and public-profile clears.', { exact: true })).toBeVisible();

  await expect(page.locator('.boss-trend')).toHaveCount(4);
  await expect(page.locator('.boss-trend h3')).toHaveText([
    'Girtablullu: Stagnant Aberrant',
    'Ye Shiyuan the Thrall',
    'Miasma Priest',
    'Rewritten: Sanguine Sweeper',
  ]);
  await expect(page.locator('.trial-trends .boss-trend')).toHaveCount(3);
  await expect(page.locator('.adversity-trends .boss-trend')).toHaveCount(1);
  await expect(page.locator('.boss-trend-lead')).toHaveCount(4);
  const leads = await page.locator('.boss-trend-lead').allTextContents();
  expect(leads.every(text => /\d+\.\d% of [\d,]+ observed clears\./.test(text))).toBe(true);
  expect(leads.every(text => text.includes('last appearance') && text.includes('percentage points'))).toBe(true);
  await expect(page.locator('#boss-trends')).not.toContainText('Recommended');

  const disclosure = page.locator('.boss-trend').first().locator('details').first();
  await disclosure.locator(':scope > summary').click();
  await expect(disclosure).toHaveAttribute('open', '');
  await expect(disclosure.locator('.trend-rows').first().locator('li')).toHaveCount(5);
  await disclosure.locator('.trend-more summary').click();
  expect(await disclosure.locator('.trend-rows li').count()).toBeGreaterThan(5);
  await disclosure.locator('.trend-source summary').click();
  await expect(disclosure.locator('.trend-source a')).toHaveCount(2);
  await expect(disclosure.locator('.trend-source code')).toHaveCount(2);
  const method = page.locator('.trend-method');
  await method.locator('summary').click();
  await expect(method).toContainText('Included:');
  await expect(method).toContainText('Left out:');
  await expect(method).toContainText('Up to 10 current-phase characters');
  expect(errors).toEqual([]);
});

test('360px trend summaries stay readable in a vertical flow without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  await expect(page.locator('.boss-trend')).toHaveCount(4);
  expect(await page.locator('.boss-trend > header').evaluateAll(headers => headers.every(header => header.getClientRects().length > 0))).toBe(true);
  await expect(page.locator('.boss-trend-lead')).toHaveCount(4);
  const summaries = page.locator('.boss-trend > details > summary');
  await expect(summaries).toHaveCount(4);
  const heights = await summaries.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(heights.every(height => height >= 44)).toBe(true);

  for (const grid of await page.locator('.boss-trend-grid').all()) {
    const dimensions = await grid.evaluate(element => ({
      overflowX: getComputedStyle(element).overflowX,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      tops: [...element.querySelectorAll('.boss-trend')].map(card => card.getBoundingClientRect().top),
    }));
    expect(dimensions.overflowX).not.toBe('auto');
    expect(dimensions.overflowX).not.toBe('scroll');
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    expect(dimensions.tops.every((top, index) => index === 0 || top > dimensions.tops[index - 1])).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await summaries.first().click();
  await expect(page.locator('.boss-trend').first().locator('.trend-rows').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('built trend data matches the disclosed current top-10 and prior comparison-only limits', async ({ page }) => {
  await page.goto('/');
  const builtTrends = await page.evaluate(() => fetch('data/da-boss-character-trends.json').then(response => response.json()));
  expect(sourceTrends.bosses.every(boss => boss.phases.at(-1).characters.length > 10)).toBe(true);
  expect(builtTrends.b.every(boss => boss[4].at(-1)[4].length === 10)).toBe(true);
  expect(builtTrends.b.every(boss => boss[4][0][4].length === 0)).toBe(true);
});

test('trend failure is isolated from the current encounter brief', async ({ page }) => {
  await page.route('**/data/da-boss-character-trends.json*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(4);
  await expect(page.locator('.trends-error')).toContainText('Observed-clear record unavailable.');
  await expect(page.locator('.trends-error')).toContainText('current encounter information remains available');
});
