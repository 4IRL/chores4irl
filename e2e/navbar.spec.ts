import { test, expect } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';

test('NavBar room-tab strip hides its scrollbar, still scrolls, and shows an edge fade', async ({ page }) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });

  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();

  // The strip is the scroll container of the "All" tab.
  const strip = page.locator('#NavBar .overflow-x-auto').first();
  await expect(strip).toBeVisible();

  const style = await strip.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      scrollbarWidth: cs.scrollbarWidth,
      overflowX: cs.overflowX,
      maskImage: cs.maskImage || cs.getPropertyValue('-webkit-mask-image'),
    };
  });

  expect(style.scrollbarWidth).toBe('none');
  expect(style.overflowX).toBe('auto');
  expect(style.maskImage).not.toBe('none');
  expect(style.maskImage).not.toBe('');
});
