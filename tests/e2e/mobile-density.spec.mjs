import { test, expect } from '@playwright/test';

test('mobile keeps all core content in a readable vertical flow', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  await expect(page.locator('.card')).toHaveCount(4);
  expect(await page.locator('.card').evaluateAll(cards => cards.every(card => card.getClientRects().length > 0))).toBe(true);
  await expect(page.locator('.mechanic-callout')).toHaveCount(4);
  await expect(page.locator('.mechanic-callout p')).toHaveCount(4);
  await expect(page.locator('.hp-sparkline')).toHaveCount(3);
  await expect(page.locator('.buff-card')).toHaveCount(3);
  await expect(page.locator('.buff-brief dt')).toHaveText([
    'Who benefits', 'Trigger or requirement', 'Payoff',
    'Who benefits', 'Trigger or requirement', 'Payoff',
    'Who benefits', 'Trigger or requirement', 'Payoff',
  ]);
  await expect(page.locator('.buff-disclosure:not([open])')).toHaveCount(3);
  await expect(page.locator('.primary-nav a').first()).toHaveText('Encounters');
  await expect(page.locator('.primary-nav .compact-label')).toHaveText(['Buffs', 'Observed']);
  await expect(page.locator('.boss-trend')).toHaveCount(4);
  expect(await page.locator('.boss-trend > header').evaluateAll(headers => headers.every(header => header.getClientRects().length > 0))).toBe(true);

  const targets = await page.locator('.mobile-disclosure > summary').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height),
  );
  expect(targets.every(height => height >= 44)).toBe(true);

  const firstBuffSummary = page.locator('.buff-disclosure summary').first();
  await firstBuffSummary.focus();
  expect(await firstBuffSummary.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  expect(await page.locator('.primary-nav a, .footer-inner a').evaluateAll(elements =>
    elements.every(element => element.getBoundingClientRect().height >= 44),
  )).toBe(true);
  const navCenters = await page.locator('.primary-nav a').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const text = range.getBoundingClientRect();
    return { boxCenter: box.top + box.height / 2, textCenter: text.top + text.height / 2 };
  }));
  expect(navCenters.every(({ boxCenter, textCenter }) => Math.abs(boxCenter - textCenter) < 1.5)).toBe(true);
  expect(await page.locator('.site-header').evaluate(element => getComputedStyle(element).position)).toBe('sticky');

  for (const selector of ['.trial-cards', '.trial-trends .boss-trend-grid']) {
    const dimensions = await page.locator(selector).evaluate(element => ({
      overflowX: getComputedStyle(element).overflowX,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.overflowX).not.toBe('auto');
    expect(dimensions.overflowX).not.toBe('scroll');
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('desktop keeps mechanics and exact buff source wording visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.locator('.mechanic-callout')).toHaveCount(4);
  expect(await page.locator('.mechanic-callout p').evaluateAll(paragraphs => paragraphs.every(paragraph => paragraph.getClientRects().length > 0))).toBe(true);
  await expect(page.locator('.buff-disclosure[open]')).toHaveCount(3);
  await expect(page.locator('.buff-disclosure summary')).toHaveText(['Exact source wording', 'Exact source wording', 'Exact source wording']);
});

test('disclosures follow the breakpoint on a loaded page', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(0);
  await page.setViewportSize({ width: 761, height: 800 });
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(8);
  await page.setViewportSize({ width: 760, height: 800 });
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(0);
});
