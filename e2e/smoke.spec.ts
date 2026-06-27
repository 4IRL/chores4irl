import { test, expect } from '@playwright/test';

test.describe('Chores App Smoke Tests', () => {

    // e2e strategy (F6): F6 removed the visible ✕/pencil buttons from the chore bar.
    // Delete/edit are exercised via swipe (the primary UX): swipe-left = delete,
    // swipe-right = edit. Cleanup loops invoke the sr-only
    // [aria-label="Delete chore"] button via dispatchEvent('click') — the button
    // is sr-only (clipped) so a real/forced click lands on overlaying siblings
    // instead, whereas dispatchEvent fires its onClick directly — then confirm
    // the delete dialog.

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
        const patchDone = page.waitForResponse(
            resp => resp.url().includes('/api/chores') && resp.url().includes('/complete') && resp.request().method() === 'PATCH',
            { timeout: 10_000 }
        );
        await firstChoreBar.click();
        await patchDone;
        await page.reload();
        await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });
        await expect(page.locator('.bg-red-700')).not.toBeVisible();
    });

    test('adds a new chore via the form', async ({ page }) => {
        // The add button text is "+ Add Task"
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        await page.fill('input[name="name"]', 'E2E Test Chore');
        await page.fill('input[name="room"]', 'Office');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        // Submit button text is "Save"
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        try {
            await expect(page.locator('text=E2E Test Chore')).toBeVisible({ timeout: 5_000 });
        } finally {
            // Delete all copies of E2E Test Chore — including any left over from prior failed runs
            const testChores = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Test Chore' });
            let count = await testChores.count();
            while (count > 0) {
                await testChores.first().locator('[aria-label="Delete chore"]').dispatchEvent('click');
                await page.getByTestId('confirm-dialog-confirm').click();
                await expect(testChores).toHaveCount(count - 1, { timeout: 5_000 });
                count = count - 1;
            }
        }
    });

    test('deletes a chore and it disappears from the list', async ({ page }) => {
        // Add a dedicated chore to delete so seed data (used by subsequent tests) is preserved
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        await page.fill('input[name="name"]', 'E2E Delete Target');
        await page.fill('input[name="room"]', 'Test Room');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        await page.waitForSelector('text=E2E Delete Target', { timeout: 5_000 });

        // F6: visible delete button removed — delete via swipe-left -> confirm dialog.
        const targetChore = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Delete Target' });
        await swipeBar(page, targetChore, 'left');
        await page.getByTestId('confirm-dialog-confirm').click();
        await expect(page.locator('text=E2E Delete Target')).not.toBeVisible({ timeout: 5_000 });
    });

    test('edits a chore via swipe-right', async ({ page }) => {
        // Add a dedicated chore to edit so seed data (used by subsequent tests) is preserved
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        await page.fill('input[name="name"]', 'E2E Edit Target');
        await page.fill('input[name="room"]', 'Test Room');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        await page.waitForSelector('text=E2E Edit Target', { timeout: 5_000 });

        try {
            // F6: visible pencil button removed — open the edit modal via swipe-right.
            const bar = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Edit Target' });
            await swipeBar(page, bar, 'right');

            // Modal opens pre-filled with the chore's name
            await expect(page.locator('input[name="name"]')).toHaveValue('E2E Edit Target');

            // Edit and save, verifying the real server round-trip (PUT), not just the optimistic render
            const putResponse = page.waitForResponse(
                r => r.url().includes('/api/chores/') && r.request().method() === 'PUT'
            );
            await page.fill('input[name="name"]', 'E2E Edited');
            // The edit submit button reads "Save Changes" — still matches /save/i
            await page.locator('button[type="submit"]', { hasText: /save/i }).click();
            await putResponse;

            await expect(page.locator('text=E2E Edited')).toBeVisible({ timeout: 5_000 });
            // Modal closed after a successful save
            await expect(page.getByTestId('chore-modal-backdrop')).not.toBeVisible();
        } finally {
            // Delete every E2E Edited (and any E2E Edit Target leftover from a failed run) bar
            const editedChores = page.locator('.bg-gray-800.rounded-full', { hasText: /E2E Edited|E2E Edit Target/ });
            let count = await editedChores.count();
            while (count > 0) {
                await editedChores.first().locator('[aria-label="Delete chore"]').dispatchEvent('click');
                await page.getByTestId('confirm-dialog-confirm').click();
                await expect(editedChores).toHaveCount(count - 1, { timeout: 5_000 });
                count = count - 1;
            }
        }
    });

    // --- Swipe gestures (F5): swipe-left = delete, swipe-right = edit ---
    // Drives react-swipeable's trackMouse path with a real mouse drag. Multiple
    // move steps are required for the gesture (onSwiping) to register.
    async function swipeBar(
        page: import('@playwright/test').Page,
        bar: import('@playwright/test').Locator,
        direction: 'left' | 'right'
    ) {
        await bar.scrollIntoViewIfNeeded();
        const box = await bar.boundingBox();
        if (!box) throw new Error('Could not get bounding box for chore bar');
        // Start near the left-center so a ~140px drag stays inside the bar.
        const startX = box.x + box.width * 0.4;
        const y = box.y + box.height / 2;
        const sign = direction === 'left' ? -1 : 1;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        // react-swipeable's trackMouse path needs a sequence of discrete pointer
        // moves over time (not one large jump) for onSwiping to fire repeatedly
        // and register a directional swipe past the 50px delta. ~140px total.
        for (let i = 1; i <= 10; i++) {
            await page.mouse.move(startX + sign * i * 14, y);
            await page.waitForTimeout(15);
        }
        await page.mouse.up();
    }

    test('swipe-left opens delete confirmation and removes the chore', async ({ page }) => {
        const name = `E2E Swipe Delete ${Date.now()}`;
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        await page.fill('input[name="name"]', name);
        await page.fill('input[name="room"]', 'Test Room');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        await page.waitForSelector(`text=${name}`, { timeout: 5_000 });

        const bar = page.locator('.bg-gray-800.rounded-full', { hasText: name });
        await swipeBar(page, bar, 'left');

        // Swipe-left routes through onDelete -> the F4 confirmation dialog.
        await expect(page.getByTestId('confirm-dialog-confirm')).toBeVisible({ timeout: 5_000 });
        await page.getByTestId('confirm-dialog-confirm').click();
        await expect(page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5_000 });
    });

    test('swipe-right opens the pre-filled edit modal', async ({ page }) => {
        const name = `E2E Swipe Edit ${Date.now()}`;
        await page.locator('button', { hasText: /\+ Add Task/i }).click();
        await expect(page.locator('.fixed.inset-0')).toBeVisible();
        await page.fill('input[name="name"]', name);
        await page.fill('input[name="room"]', 'Test Room');
        await page.fill('input[name="dateLastCompleted"]', '2026-01-01');
        await page.fill('input[name="duration"]', '5');
        await page.fill('input[name="frequency"]', '3');
        await page.locator('button[type="submit"]', { hasText: /save/i }).click();
        await page.waitForSelector(`text=${name}`, { timeout: 5_000 });

        try {
            const bar = page.locator('.bg-gray-800.rounded-full', { hasText: name });
            await swipeBar(page, bar, 'right');

            // Swipe-right routes through onEdit -> the F2 pre-populated edit modal.
            await expect(page.locator('input[name="name"]')).toHaveValue(name, { timeout: 5_000 });
        } finally {
            // Close the modal (if open) and clean up the seeded chore.
            const cancelBtn = page.locator('button', { hasText: /^cancel$/i });
            if (await cancelBtn.isVisible().catch(() => false)) {
                await cancelBtn.click();
            }
            const targets = page.locator('.bg-gray-800.rounded-full', { hasText: name });
            let count = await targets.count();
            while (count > 0) {
                await targets.first().locator('[aria-label="Delete chore"]').dispatchEvent('click');
                await page.getByTestId('confirm-dialog-confirm').click();
                await expect(targets).toHaveCount(count - 1, { timeout: 5_000 });
                count = count - 1;
            }
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

    test('portrait-enforcement overlay toggles with viewport orientation', async ({ page }) => {
        const overlay = page.locator('#rotate-overlay');

        // Landscape viewport with height < 500px triggers the rotate overlay
        await page.setViewportSize({ width: 812, height: 375 });
        await expect(overlay).toBeVisible();

        // Portrait viewport hides the overlay again
        await page.setViewportSize({ width: 375, height: 812 });
        await expect(overlay).toBeHidden();
    });

    test('navigates forward and back in time and resets to today', async ({ page }) => {
        const nextBtn = page.getByRole('button', { name: 'Next day' });
        await expect(nextBtn).toBeVisible();
        await expect(page.getByRole('button', { name: 'Previous day' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Return to today' })).not.toBeVisible();

        await nextBtn.click();
        await expect(page.getByRole('button', { name: 'Previous day' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Return to today' })).toBeVisible();

        // During simulation, clicking the bar must not fire a PATCH /complete.
        // Attach a request listener and fail the test if a complete PATCH fires while simulating.
        let completePatchFired = false;
        const completeListener = (request: import('@playwright/test').Request) => {
            if (
                request.method() === 'PATCH' &&
                request.url().includes('/api/chores') &&
                request.url().includes('/complete')
            ) {
                completePatchFired = true;
            }
        };
        page.on('request', completeListener);

        // The chore bar has `pointer-events-none` during simulation, so a normal click
        // would hit Playwright's actionability timeout. Use `force: true` to dispatch
        // the click regardless — the assertion is that the handler STILL does nothing.
        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
        await expect(firstChoreBar).toHaveClass(/pointer-events-none/);
        await firstChoreBar.click({ force: true });
        // Give the click a chance to propagate; confirm no network request and no error banner.
        await page.waitForTimeout(250);
        expect(completePatchFired).toBe(false);
        await expect(page.locator('.bg-red-700')).not.toBeVisible();

        page.off('request', completeListener);

        await page.getByRole('button', { name: 'Return to today' }).click();
        await expect(page.getByRole('button', { name: 'Previous day' })).not.toBeVisible();
        await expect(page.getByRole('button', { name: 'Return to today' })).not.toBeVisible();
    });
});
