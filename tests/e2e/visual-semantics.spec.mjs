import { test, expect } from '@playwright/test';

const luminance = color => {
  const channels = color.match(/\d+/g).slice(0, 3).map(value => Number(value) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};
test('semantic annotations use one neutral prose color and stable distinct element colors', async ({ page }) => {
  await page.goto('/');
  const palette = await page.evaluate(() => {
    const annotations = [...document.querySelectorAll('#buff-list .text-annotation:not(.text-annotation-attribute)')];
    const elements = [...document.querySelectorAll('.element-chip, .text-annotation-attribute')];
    return {
      neutral: [...new Set(annotations.map(element => getComputedStyle(element).color))],
      elementColors: Object.fromEntries(elements.map(element => [
        [...element.classList].find(name => /^(?:element|attribute)-(?:ice|fire|electric|ether|physical|wind)$/.test(name)),
        getComputedStyle(element).color,
      ])),
      backgrounds: annotations.map(element => getComputedStyle(element.closest('article') || element.parentElement).backgroundColor),
    };
  });
  expect(palette.neutral).toHaveLength(1);
  const elementEntries = Object.entries(palette.elementColors).filter(([name]) => name);
  expect(new Set(elementEntries.map(([, color]) => color)).size).toBeGreaterThanOrEqual(4);
  expect(palette.elementColors['element-ice']).toBe(palette.elementColors['attribute-ice']);
  expect(palette.elementColors['element-ether']).not.toBe(palette.elementColors['element-ice']);
  for (const background of palette.backgrounds) expect(contrast(palette.neutral[0], background)).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('.card.adversity .text-annotation-attribute').filter({ hasText: 'Ice' })).toHaveClass(/attribute-ice/);
});
test('source panel gives compact methodology and exact source disclosures', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sources summary strong')).toHaveText('Sources and methodology');
  await expect(page.locator('#sources')).toContainText('Observed clears');
  await expect(page.locator('#sources')).toContainText('Submitted and public-profile clears');
  await expect(page.locator('#sources')).not.toContainText('Source label');
  await expect(page.locator('.buff-disclosure')).toHaveCount(3);
  await expect(page.locator('.buff-disclosure summary')).toHaveText(['Exact source wording', 'Exact source wording', 'Exact source wording']);
  await expect(page.locator('.buff-disclosure small a')).toHaveCount(3);
});
