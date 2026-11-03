import { test, expect } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';

// Runs only in the `webkit` Playwright project (see playwright.config.ts): the
// ::-webkit-search-cancel-button pseudo-element exists only in WebKit, and WebKit does
// not expose it through getComputedStyle, so the rule is checked by negative control.
test('WebKit native search-cancel button is hidden by the global CSS rule', async ({ page }) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();

  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'webkit-search-probe';
    input.type = 'search';
    input.value = 'probe';
    document.body.appendChild(input);
    input.focus();
  });
  const probe = page.locator('#webkit-search-probe');

  // Rule under test: frontend/src/index.css `input[type='search']::-webkit-search-cancel-button`.
  const withRule = await probe.screenshot();

  // Negative control: delete that rule, so the native ✕ must now render and change the pixels.
  const removed = await page.evaluate(() => {
    let count = 0;
    for (const sheet of Array.from(document.styleSheets)) {
      for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
        if (sheet.cssRules[index].cssText.includes('::-webkit-search-cancel-button')) {
          sheet.deleteRule(index);
          count++;
        }
      }
    }
    return count;
  });
  expect(removed).toBeGreaterThan(0);

  const withoutRule = await probe.screenshot();
  expect(withRule.equals(withoutRule)).toBe(false);
});
