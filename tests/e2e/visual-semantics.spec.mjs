import { test, expect } from '@playwright/test';

const luminance = color => {
  const channels = color.match(/\d+/g).slice(0, 3).map(value => Number(value) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};

const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('visible combat terms keep distinct, readable presentation colors', async ({ page }) => {
  await page.goto('/');
  const terms = await page.locator('#buff-list .text-annotation').evaluateAll(elements => Object.fromEntries(elements.map(element => [element.textContent, {
    color: getComputedStyle(element).color,
    background: getComputedStyle(element.closest('article')).backgroundColor,
  }])));

  expect(new Set(['Basic Attack', 'EX Special Attack', 'Chain Attack'].map(term => terms[term].color)).size).toBe(3);
  expect(terms['Ice RES'].color).not.toBe(terms['Ether RES'].color);
  expect(terms['Sheer DMG'].color).not.toBe(terms['Ether DMG'].color);
  expect(new Set(['Anomaly Proficiency', 'ATK', 'Stun DMG Multiplier'].map(term => terms[term].color)).size).toBe(3);
  await expect(page.locator('#buff-list .text-annotation-specialty').filter({ hasText: 'Anomaly specialty' })).toHaveClass(/annotation-specialty-anomaly/);
  await expect(page.locator('.card.adversity .text-annotation-attribute').filter({ hasText: 'Ice' })).toHaveClass(/attribute-ice/);

  for (const term of ['Basic Attack', 'EX Special Attack', 'Chain Attack', 'Ice RES', 'Ether RES', 'Sheer DMG', 'Ether DMG', 'Anomaly Proficiency', 'ATK', 'Stun DMG Multiplier']) {
    expect(contrast(terms[term].color, terms[term].background), `${term} contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

test('the source panel is explicitly a terminology key, not placeholder metadata', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sources')).toContainText('Reading the sources');
  await expect(page.locator('#sources-title')).toHaveText('What the status labels mean.');
  await expect(page.locator('#sources')).not.toContainText('Source label');
});
