import { test, expect } from '@playwright/test';
const feedbackUrl = 'https://github.com/alvinwin/zzz-deadly-assault/issues/new?template=feedback.yml';

const overlaps = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;

const expectFeedbackLink = async page => {
  const feedback = page.getByRole('link', { name: 'Send feedback' });
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveAttribute('href', feedbackUrl);
  await expect(feedback).toHaveAttribute('target', '_blank');
  await expect(feedback).toHaveAttribute('rel', 'noopener noreferrer');
  await feedback.focus();
  await expect(feedback).toBeFocused();
  expect(await feedback.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  const geometry = await feedback.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, position: getComputedStyle(element).position };
  });
  const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }));
  expect(geometry.position).toBe('fixed');
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(viewport.width);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(viewport.height);
  return geometry;
};

const expectNoActionOverlap = async (page, feedbackRect) => {
  const contentRects = await page.locator('#buff-list a, .provenance a, footer > a:not(.feedback-link), footer > p, footer > span').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(contentRects.some(rect => overlaps(feedbackRect, rect))).toBe(false);
};

test('desktop shows current cards, status, labels, escaped content, sources, and floating feedback link', async ({ page }) => { await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); await expect(page.locator('#status')).toContainText('verified brief'); await expect(page.locator('#freshness')).toContainText('checked'); await expect(page.locator('dt').filter({hasText:'Weaknesses'}).first()).toBeVisible(); await expect(page.locator('.card').first()).toContainText('none'); await expect(page.locator('#global-buffs')).toContainText('GLOBAL BUFFS'); await expect(page.locator('#buff-list article')).toHaveCount(3); await expect(page.locator('#buff-list a')).toHaveCount(3); await expect(page.locator('.provenance').first().locator('a')).toHaveCount(3); await expect(page.locator('.provenance a').first()).toHaveAttribute('href', /620a7546b4d2934c58d55cdf7a435056576bb1fc/); await expect(page.locator('body')).not.toContainText('<script>'); let rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); await page.screenshot({path:'test-results/desktop.png', fullPage:true}); });
test('mobile cards keep their width and floating feedback link fits without horizontal overflow', async ({ page }) => { await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.card')).toHaveCount(4); const cards = await page.locator('.card').evaluateAll(elements => elements.map(card => ({ x: card.getBoundingClientRect().x, width: card.getBoundingClientRect().width }))); expect(new Set(cards.map(card => Math.round(card.x))).size).toBe(1); expect(cards[0].width).toBeGreaterThan(350); expect(cards[0].width).toBeLessThan(360); let rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); rect = await expectFeedbackLink(page); await expectNoActionOverlap(page, rect); expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true); await page.screenshot({path:'test-results/mobile.png', fullPage:true}); });
