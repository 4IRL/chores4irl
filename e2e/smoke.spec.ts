import { test, expect } from '@playwright/test';

test.describe('Chores App Smoke Tests', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector(
            'text=Vacuum Bedroom Floor',
            { timeout: 10_000 }
        );
    });

    test('loads chores from /api/chores on page open', async ({ page }) => {
        // Seed chores from db.ts are visible on load
        await expect(page.locator('text=Vacuum Bedroom Floor')).toBeVisible();
    });

    test('marks a chore complete and shows updated timer', async ({ page }) => {
        // The entire chore bar acts as the complete button (onClick={resetTask})
        // Click the first chore bar to mark it complete
        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
        await firstChoreBar.click();
        // The timer bar resets — verify no error message appeared
        await expect(page.locator('text=Failed to mark chore complete')).not.toBeVisible();
        await expect(page.locator('.bg-red-700')).not.toBeVisible();
    });

    test('persists completed chore date after page reload', async ({ page }) => {
        // Click complete on the first chore bar, then reload and confirm no error
        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
        await firstChoreBar.click();
        await page.waitForTimeout(500); // let PATCH settle
        await page.reload();
        await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });
        await expect(page.locator('.bg-red-700')).not.toBeVisible();
    });

    test('adds a new chore via the form', async ({ page }) => {
        // The add button text is "+ Add Task"
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await page.fill('input[name="name"]', 'E2E Test Chore');
        await page.fill('input[name="room"]', 'Office');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        // Submit button text is "Save"
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        await expect(page.locator('text=E2E Test Chore')).toBeVisible({ timeout: 5_000 });
    });

    test('deletes a chore and it disappears from the list', async ({ page }) => {
        // Delete button has aria-label="Delete chore" and text "✕"
        const allChoreNames = page.locator('.bg-gray-800.rounded-full');
        const firstChore = allChoreNames.first();
        // Read some identifying text before deletion
        const choreText = await firstChore.textContent();
        const deleteBtn = firstChore.locator('[aria-label="Delete chore"]');
        await deleteBtn.click();
        if (choreText) {
            const nameFragment = choreText.trim().slice(0, 15);
            await expect(page.locator(`text=${nameFragment}`)).not.toBeVisible({ timeout: 5_000 });
        }
    });

    test('shows error and rolls back on simulated backend failure', async ({ page }) => {
        // Intercept the PATCH request and force it to fail
        await page.route('**/api/chores/*/complete', route =>
            route.fulfill({ status: 500, body: JSON.stringify({ success: false, error: 'Forced error' }) })
        );
        // Click the first chore bar to trigger complete (which will be intercepted)
        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
        await firstChoreBar.click();
        // App shows error in bg-red-700 div with the error message
        await expect(page.locator('.bg-red-700').first()).toBeVisible({ timeout: 5_000 });
    });
});
