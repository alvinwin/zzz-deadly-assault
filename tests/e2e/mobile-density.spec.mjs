import { test, expect } from '@playwright/test';

test('mobile keeps essential encounter facts visible and layers long explanations', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');

  await expect(page.locator('.mechanic-callout:not([open])')).toHaveCount(4);
  await expect(page.locator('.buff-disclosure:not([open])')).toHaveCount(3);
  await expect(page.locator('.card .hp-main')).toHaveCount(4);

  const targets = await page.locator('.mobile-disclosure > summary').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height),
  );
  expect(targets.every(height => height >= 44)).toBe(true);

  const firstMechanic = page.locator('.mechanic-callout').first();
  expect(await firstMechanic.locator('summary').evaluate(element => getComputedStyle(element, '::after').content)).toBe('"+"');
  await firstMechanic.locator('summary').focus();
  expect(await firstMechanic.locator('summary').evaluate(element => getComputedStyle(element).outlineWidth)).toBe('3px');
  expect(await firstMechanic.locator('summary').evaluate(element => getComputedStyle(element).outlineColor)).toBe('rgb(255, 224, 139)');
  await firstMechanic.locator('summary').click();
  await expect(firstMechanic).toHaveAttribute('open', '');
  await expect(firstMechanic.locator('p')).toBeVisible();
  expect(await firstMechanic.locator('summary').evaluate(element => getComputedStyle(element, '::after').content)).toBe('"−"');

  const smallTargets = await page.locator('.primary-nav a, .footer-inner > a').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().height),
  );
  expect(smallTargets.every(height => height >= 44)).toBe(true);

  const buffLinkColor = await page.locator('#buff-list a').first().evaluate(element => getComputedStyle(element).color);
  expect(buffLinkColor).toBe('rgb(17, 83, 83)');
  const firstBuffSummary = page.locator('.buff-disclosure summary').first();
  await firstBuffSummary.focus();
  expect(await firstBuffSummary.evaluate(element => getComputedStyle(element).outlineColor)).toBe('rgb(17, 83, 83)');

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('desktop keeps mechanic and buff explanations open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.locator('.mechanic-callout[open]')).toHaveCount(4);
  await expect(page.locator('.buff-disclosure[open]')).toHaveCount(3);
});

test('disclosures follow the breakpoint on a loaded page', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(0);
  await page.setViewportSize({ width: 761, height: 800 });
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(7);
  await page.setViewportSize({ width: 760, height: 800 });
  await expect(page.locator('.mobile-disclosure[open]')).toHaveCount(0);
});

test('the observed-clear comparison is two plainly spaced phrases', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const comparison = page.locator('.trend-comparison').first();
  await expect(comparison.locator('span')).toHaveCount(2);
  await expect(comparison.locator('span').first()).toContainText('% of observed clears');
  await expect(comparison.locator('span').last()).toContainText('% last phase');
  const phrases = await comparison.locator('span').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
  expect(phrases[1]).toBeGreaterThan(phrases[0]);
  expect(await comparison.locator('span').last().evaluate(element => getComputedStyle(element, '::before').content)).toBe('none');
});
