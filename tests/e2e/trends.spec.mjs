import { test, expect } from '@playwright/test';

test('desktop renders all boss summaries and disclosure details with clean console', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');

  await expect(page.locator('.boss-trend')).toHaveCount(4);
  await expect(page.locator('.boss-trend h3')).toHaveText([
    'Girtablullu: Stagnant Aberrant',
    'Ye Shiyuan the Thrall',
    'Miasma Priest',
    'Rewritten: Sanguine Sweeper',
  ]);
  await expect(page.locator('.boss-trend-summary').first()).toContainText('n = 16,037');
  await expect(page.locator('.boss-trend-summary').first()).toContainText('Remielle');
  await expect(page.locator('.boss-trend-summary').first()).toContainText('87.4%');
  await expect(page.locator('.boss-trend-summary').first()).toContainText('of observed clears');
  await expect(page.locator('.boss-trend-summary').first()).toContainText('71.5% last phase');
  await expect(page.locator('#boss-trends')).not.toContainText('pp vs prior');

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
  await expect(method).toContainText('Every current-phase character is available; the first five are shown initially.');
  await expect(method).toContainText('earlier phase is used for comparison, not shown as a separate ranking');
  expect(errors).toEqual([]);
});

test('360px trends remain readable, touchable, and free of horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('.boss-trend')).toHaveCount(4);

  const summaries = page.locator('.boss-trend > details > summary');
  await expect(summaries).toHaveCount(4);
  const heights = await summaries.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(heights.every(height => height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await summaries.first().click();
  await expect(page.locator('.boss-trend').first().locator('.trend-rows').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('trend failure is isolated from the current encounter brief', async ({ page }) => {
  await page.route('**/data/da-boss-character-trends.json*', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(4);
  await expect(page.locator('.trends-error')).toContainText('Trend record unavailable.');
  await expect(page.locator('.trends-error')).toContainText('current encounter brief remains available');
});
