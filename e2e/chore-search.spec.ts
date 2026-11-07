import { test, expect } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';

test('status count strip pins at the top on a short phone viewport and scrolls away on desktop', async ({
  page,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  const strip = page.getByTestId('status-count-strip');
  const topOf = async () => (await strip.boundingBox())!.y;

  await page.setViewportSize({ width: 390, height: 200 });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();
  await expect(strip).toBeVisible();
  const mobileInitialTop = await topOf();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(mobileInitialTop);
  expect(await topOf()).toBe(0);

  await page.setViewportSize({ width: 1024, height: 200 });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();
  await expect(strip).toBeVisible();
  const desktopInitialTop = await topOf();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const { scrollY, top } = await page.evaluate(() => ({
    scrollY: window.scrollY,
    top: document.querySelector('[data-testid="status-count-strip"]')!.getBoundingClientRect().top,
  }));
  expect(top).not.toBe(0);
  expect(Math.abs(top - (desktopInitialTop - scrollY))).toBeLessThan(2);
});

test('chore search filters by name, shows no-match, and keeps input focus on tap of the clear controls', async ({
  page,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });

  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();
  const total = await page.getByTestId('chore-bar').count();
  expect(total).toBeGreaterThan(1);

  const search = page.getByLabel('Search chores');
  await search.fill('vAcUuM');
  await expect(page.getByTestId('chore-bar')).toHaveCount(1);
  await expect(page.getByTestId('chore-bar').first()).toContainText('Vacuum');

  await search.fill('zzz-nothing-matches');
  await expect(page.getByTestId('chores-no-match')).toBeVisible();

  await page.getByRole('button', { name: 'Show all chores' }).click();
  await expect(page.getByTestId('chore-bar')).toHaveCount(total);

  // Clear search keeps the input focused (mousedown default-prevented).
  await search.click();
  await search.fill('vac');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();

  // Show all chores keeps the input focused.
  await search.fill('zzz-nothing-matches');
  await page.getByRole('button', { name: 'Show all chores' }).click();
  await expect(search).toBeFocused();
  await expect(page.getByTestId('chore-bar')).toHaveCount(total);
});
