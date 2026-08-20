import { test, expect } from '@playwright/test';

test('official Trial and Adversity modes are visually and structurally separated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.trial-group .card')).toHaveCount(3);
  await expect(page.locator('.adversity-group .card')).toHaveCount(1);
  await expect(page.locator('#trial-group-title')).toHaveText('Trial Mode');
  await expect(page.locator('#adversity-group-title')).toHaveText('Adversity Mode');
  await expect(page.locator('.trial-group .tag')).toHaveText(['Trial Mode', 'Trial Mode', 'Trial Mode']);
  await expect(page.locator('.adversity-group .tag')).toHaveText('Adversity Mode');
  await expect(page.locator('#cards')).not.toContainText('First three fights');
  await expect(page.locator('#cards')).not.toContainText('Separate challenge');
  await expect(page.locator('.card .mechanic-callout')).toHaveCount(4);
  await expect(page.locator('.card .mechanic-callout p')).toHaveCount(4);

  const separation = await page.evaluate(() => {
    const trials = document.querySelector('.trial-group').getBoundingClientRect();
    const adversity = document.querySelector('.adversity-group').getBoundingClientRect();
    return {
      gap: adversity.top - trials.bottom,
      borderStyle: getComputedStyle(document.querySelector('.adversity-group')).borderTopStyle,
    };
  });
  expect(separation.gap).toBeGreaterThanOrEqual(30);
  expect(separation.borderStyle).toBe('solid');

  const adversityComposition = await page.locator('.adversity-group .card').evaluate(card => {
    const title = card.querySelector('h3').getBoundingClientRect();
    const matchup = card.querySelector('.matchup').getBoundingClientRect();
    const mechanic = card.querySelector('.mechanic-callout').getBoundingClientRect();
    return {
      display: getComputedStyle(card).display,
      titleLeftOfMechanic: title.right <= mechanic.left,
      matchupLeftOfMechanic: matchup.right <= mechanic.left,
      overlap: matchup.right > mechanic.left && matchup.left < mechanic.right && matchup.bottom > mechanic.top && matchup.top < mechanic.bottom,
    };
  });
  expect(adversityComposition).toEqual({ display: 'grid', titleLeftOfMechanic: true, matchupLeftOfMechanic: true, overlap: false });
});

test('360px encounters stay in one vertical flow without carousel overflow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('.card')).toHaveCount(4);
  expect(await page.locator('.card').evaluateAll(cards => cards.every(card => card.getClientRects().length > 0))).toBe(true);
  await expect(page.locator('.mechanic-callout')).toHaveCount(4);
  await expect(page.locator('.adversity-group .card')).toHaveCSS('display', 'block');

  const layout = await page.locator('.trial-cards').evaluate(element => ({
    overflowX: getComputedStyle(element).overflowX,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    tops: [...element.querySelectorAll('.card')].map(card => card.getBoundingClientRect().top),
  }));
  expect(layout.overflowX).not.toBe('auto');
  expect(layout.overflowX).not.toBe('scroll');
  expect(layout.scrollWidth).toBe(layout.clientWidth);
  expect(layout.tops[1]).toBeGreaterThan(layout.tops[0]);
  expect(layout.tops[2]).toBeGreaterThan(layout.tops[1]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
