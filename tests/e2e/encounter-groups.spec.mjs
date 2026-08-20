import { test, expect } from '@playwright/test';

test('official Trial and Adversity modes are visually and structurally separated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.trial-group .card')).toHaveCount(3);
  await expect(page.locator('.adversity-group .card')).toHaveCount(1);
  await expect(page.locator('#trial-group-title')).toHaveText('Trial Mode');
  await expect(page.locator('#adversity-group-title')).toHaveText('Adversity Mode');
  await expect(page.locator('#cards')).not.toContainText('First three fights');
  await expect(page.locator('#cards')).not.toContainText('Separate challenge');

  const separation = await page.evaluate(() => {
    const trials = document.querySelector('.trial-group').getBoundingClientRect();
    const adversity = document.querySelector('.adversity-group').getBoundingClientRect();
    return {
      gap: adversity.top - trials.bottom,
      border: getComputedStyle(document.querySelector('.adversity-group')).borderTopWidth,
    };
  });
  expect(separation.gap).toBeGreaterThanOrEqual(30);
  expect(separation.border).toBe('2px');
});

test('the encounter groups remain distinct without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('.trial-group .card')).toHaveCount(3);
  await expect(page.locator('.adversity-group .card')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
