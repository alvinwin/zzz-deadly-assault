import { test, expect } from '@playwright/test';
const feedbackUrl = 'https://github.com/alvinwin/zzz-deadly-assault/issues/new?template=feedback.yml';

const expectFeedbackLink = async page => {
  const feedback = page.getByRole('link', { name: 'Send feedback' });
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveAttribute('href', feedbackUrl);
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
  const geometry = await feedback.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const siblings = [...element.parentElement.children].filter(sibling => sibling !== element);
    const overlaps = siblings.filter(sibling => {
      const other = sibling.getBoundingClientRect();
      return rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top;
    });
    return { left: rect.left, right: rect.right, overlaps: overlaps.length };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
  expect(geometry.overlaps).toBe(0);
};

test('desktop shows current cards, status, labels, escaped content, sources, and feedback link', async ({ page }) => { await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); await expect(page.locator('#status')).toContainText('verified brief'); await expect(page.locator('#freshness')).toContainText('checked'); await expect(page.locator('dt').filter({hasText:'Weaknesses'}).first()).toBeVisible(); await expect(page.locator('.card').first()).toContainText('none'); await expect(page.locator('#global-buffs')).toContainText('GLOBAL BUFFS'); await expect(page.locator('#buff-list article')).toHaveCount(3); await expect(page.locator('#buff-list a')).toHaveCount(3); await expect(page.locator('.provenance').first().locator('a')).toHaveCount(3); await expect(page.locator('.provenance a').first()).toHaveAttribute('href', /620a7546b4d2934c58d55cdf7a435056576bb1fc/); await expect(page.locator('body')).not.toContainText('<script>'); await expectFeedbackLink(page); await page.screenshot({path:'test-results/desktop.png', fullPage:true}); });
test('mobile cards and feedback link fit without overlap or horizontal overflow', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); const xPositions = await page.locator('.card').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().x))); expect(new Set(xPositions).size).toBe(1); await expectFeedbackLink(page); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.screenshot({path:'test-results/mobile.png', fullPage:true}); });
