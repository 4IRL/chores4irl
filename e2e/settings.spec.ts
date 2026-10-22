import { test, expect } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';

test('Settings modal renders the Notifications section', async ({ page }) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });

  await page.goto('/');
  // Wait for the chores view to be ready before opening Settings.
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();

  await page.getByRole('button', { name: 'Settings' }).click();

  // Scope assertions to the modal, per the admin.spec.ts modal-scoping convention.
  const modal = page.getByTestId('settings-modal-backdrop');
  await expect(modal).toBeVisible();
  // Exact match targets the plain-<p> section label, not the "Enable push
  // notifications" toggle label that also contains the word.
  await expect(modal.getByText('Notifications', { exact: true })).toBeVisible();
});

test('Settings notifications: one-time password, set-up state and generate a new password (stubbed backend)', async ({
  page,
}) => {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });

  const username = 'u_e2eperson';
  const setupUrl = `https://notifs-setup.4irl.app/?app=chores4irl&user=${username}&name=Chores4irl`;
  const provisioned = {
    provisioned: true,
    enabled: true,
    server: 'https://notifs.4irl.app',
    topic: 'chores4irl-e2eperson-all',
    subscriberToken: 'tk_e2e_token',
    username,
    setupUrl,
  };
  let enabled = false;
  const unexpected: string[] = [];

  // Fail-safe registered FIRST (Playwright runs the most recently registered matching
  // route first), so any /api/notifications/* path without an explicit stub below is
  // recorded and aborted instead of reaching the real outbound backend path.
  await page.route('**/api/notifications/**', (route) => {
    unexpected.push(route.request().url());
    return route.abort();
  });
  await page.route('**/api/notifications', (route) =>
    route.fulfill({
      json: { success: true, data: enabled ? provisioned : { provisioned: false, enabled: false } },
    }),
  );
  await page.route('**/api/notifications/enable', (route) => {
    enabled = true;
    return route.fulfill({
      json: { success: true, data: { ...provisioned, password: 'k7mq-2xfp-9wnr-h3tc' } },
    });
  });
  await page.route('**/api/notifications/reset-password', (route) =>
    route.fulfill({ json: { success: true, data: { password: 'm4tz-8kqe-v2pa-5hyw' } } }),
  );

  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();

  const modal = page.getByTestId('settings-modal-backdrop');
  await expect(modal).toBeVisible();

  // Enable: the password is shown once, with its copy button focused.
  await modal.getByRole('checkbox').click();
  await expect(modal.getByText('k7mq-2xfp-9wnr-h3tc')).toBeVisible();
  await expect(modal.getByText('Shown once. Copy it now.')).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Copy password' })).toBeFocused();

  // Username and Password are grouped in one "Sign in to ntfy" block; the QR/meta card
  // keeps Server, Topic and Access token only.
  const signIn = modal.getByRole('group', { name: 'Sign in to ntfy' });
  await expect(signIn.getByText(username, { exact: true })).toBeVisible();
  await expect(signIn.getByRole('button', { name: 'Copy username' })).toBeVisible();
  await expect(signIn.getByText('k7mq-2xfp-9wnr-h3tc')).toBeVisible();
  await expect(modal.getByTestId('ntfy-meta-card').getByText(username, { exact: true })).toHaveCount(0);

  // Topic and the setup link come from the response.
  await expect(modal.getByText('chores4irl-e2eperson-all', { exact: true })).toBeVisible();
  const setupLink = modal.getByRole('link', { name: 'Set up the ntfy app →' });
  await expect(setupLink).toHaveAttribute('href', setupUrl);
  await expect(setupLink).toHaveAttribute('target', '_blank');

  // Reopen Settings: the set-up state shows and the password is gone.
  await modal.getByRole('button', { name: 'Close' }).click();
  await expect(modal).toBeHidden();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(modal.getByText(/Your ntfy sign-in is set up/)).toBeVisible();
  await expect(signIn.getByText(username, { exact: true })).toBeVisible();
  await expect(modal.getByText('k7mq-2xfp-9wnr-h3tc')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Copy password' })).toHaveCount(0);

  // Generate a new password: confirm first, then the new one is shown once.
  await modal.getByRole('button', { name: 'Generate a new password' }).click();
  await expect(
    modal.getByText(/Phones using the current password will stop getting notifications/),
  ).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await modal.getByRole('button', { name: 'Generate new password' }).click();
  await expect(modal.getByText('m4tz-8kqe-v2pa-5hyw')).toBeVisible();
  await expect(modal.getByText('Sign in again on each phone with this new password.')).toBeVisible();

  expect(unexpected).toEqual([]);
});
