import { test, expect } from '@playwright/test';

test.describe('Chores App Smoke Tests', () => {

    // e2e strategy (F6): F6 removed the visible ✕/pencil buttons from the chore bar.
    // Delete/edit are exercised via swipe (the primary UX). F10 REVERSED the
    // directions: swipe-left = edit, swipe-right = delete (action only fires past
    // 25% of the bar's own width). Cleanup loops invoke the sr-only
    // [aria-label="Delete chore"] button via dispatchEvent('click') — the button
    // is sr-only (clipped) so a real/forced click lands on overlaying siblings
    // instead, whereas dispatchEvent fires its onClick directly — then confirm
    // the delete dialog.

    test.beforeEach(async ({ page }) => {
        // F1: App.tsx now calls useScreenBlank() unconditionally, which reads the
        // real wall clock. Pin the clock to a fixed daytime instant (noon), outside
        // the 21:00-06:00 blank window, before navigating, so this suite isn't
        // subject to real-clock nondeterminism. setFixedTime only freezes Date/
        // Date.now() for the page — it does not pause setTimeout/setInterval, so
        // the existing timer-bar/countdown behavior exercised elsewhere is unaffected.
        await page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0));
        await page.goto('/');
        await page.waitForSelector(
            'text=Vacuum Bedroom Floor',
            { timeout: 10_000 }
        );
    });

    // DD-7: real-browser `inert` behavioral guarantee. jsdom (used by the Vitest
    // suite, see App.screenBlank.test.tsx) does not implement `inert`, so this test
    // proves in a real browser that once the screen is blanked, Tab never lands
    // focus on anything but the portaled overlay itself. Overrides the shared
    // beforeEach's noon pin with a fixed time inside the 21:00-06:00 blank window,
    // then reloads so the app re-mounts and the real useScreenBlank re-evaluates
    // isWithinBlankWindow against the new fixed time.
    test('screen-blank overlay makes the rest of the app unreachable via Tab (DD-7)', async ({ page }) => {
        await page.clock.setFixedTime(new Date(2025, 0, 15, 23, 0, 0));
        await page.reload();

        await expect(page.getByTestId('screen-blank-overlay')).toBeVisible();

        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            const activeTestId = await page.evaluate(
                () => document.activeElement?.getAttribute('data-testid')
            );
            expect(activeTestId === null || activeTestId === 'screen-blank-overlay').toBe(true);
        }
    });

    // Companion to DD-7: proves the overlay blocks real pointer input, not just
    // keyboard focus. jsdom (used by the Vitest "swallows the tap" unit test)
    // only clicks the overlay's own DOM element directly, so it can't catch a
    // regression in real-browser stacking/hit-testing (wrong z-index, missing
    // `fixed inset-0`, a CSS build issue). Same clock-pin + reload technique as
    // DD-7, then a real `page.mouse.click` at the on-screen coordinates of the
    // first chore bar underneath the overlay.
    test('screen-blank overlay blocks a real pointer click on an underlying chore bar', async ({ page }) => {
        await page.clock.setFixedTime(new Date(2025, 0, 15, 23, 0, 0));
        await page.reload();

        await expect(page.getByTestId('screen-blank-overlay')).toBeVisible();

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

        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();
        const box = await firstChoreBar.boundingBox();
        if (!box) throw new Error('Could not get bounding box for chore bar');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        // Give the click a chance to propagate; confirm no completion request fired.
        await page.waitForTimeout(250);
        expect(completePatchFired).toBe(false);
        page.off('request', completeListener);

        await expect(page.locator('.bg-red-700')).not.toBeVisible();
        // The overlay's own tap-to-wake handler fires because the click landed on
        // the overlay, not the chore bar underneath — this is the positive signal
        // that real-browser stacking/hit-testing routed the click to the overlay.
        // If a regression let the click fall through instead (broken z-index or
        // missing `fixed inset-0`), the overlay would stay untouched here while
        // the chore-completion PATCH above would have fired.
        await expect(page.getByTestId('screen-blank-overlay')).not.toBeVisible();
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

        // F10: visible delete button removed — delete via swipe-right -> confirm dialog.
        const targetChore = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Delete Target' });
        await swipeBar(page, targetChore, 'right');
        await page.getByTestId('confirm-dialog-confirm').click();
        await expect(page.locator('text=E2E Delete Target')).not.toBeVisible({ timeout: 5_000 });
    });

    test('edits a chore via swipe-left', async ({ page }) => {
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
            // F10: visible pencil button removed — open the edit modal via swipe-left.
            const bar = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Edit Target' });
            await swipeBar(page, bar, 'left');

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

    // --- Swipe gestures (F10): swipe-left = edit, swipe-right = delete ---
    // Drives react-swipeable's trackMouse path with a real mouse drag. Multiple
    // move steps are required for the gesture (onSwiping) to register. F10 only
    // fires the action once the drag passes 25% of the bar's own width, so this
    // helper drags ~80% of the bar width to comfortably clear that threshold.
    async function swipeBar(
        page: import('@playwright/test').Page,
        bar: import('@playwright/test').Locator,
        direction: 'left' | 'right'
    ) {
        await bar.scrollIntoViewIfNeeded();
        const box = await bar.boundingBox();
        if (!box) throw new Error('Could not get bounding box for chore bar');
        const sign = direction === 'left' ? -1 : 1;
        // Drag ~80% of the bar width (well past the 25% confirm threshold). Start
        // offset from the appropriate edge so the full drag stays inside the bar:
        // left swipe starts near the right edge, right swipe starts near the left.
        const distance = box.width * 0.8;
        const startX = direction === 'left'
            ? box.x + box.width * 0.9
            : box.x + box.width * 0.1;
        const y = box.y + box.height / 2;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        // react-swipeable's trackMouse path needs a sequence of discrete pointer
        // moves over time (not one large jump) for onSwiping to fire repeatedly
        // and register a directional swipe past the 50px delta.
        const steps = 12;
        for (let i = 1; i <= steps; i++) {
            await page.mouse.move(startX + sign * (distance * i / steps), y);
            await page.waitForTimeout(15);
        }
        await page.mouse.up();
    }

    test('swipe-right opens delete confirmation and removes the chore', async ({ page }) => {
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
        await swipeBar(page, bar, 'right');

        // Swipe-right routes through onDelete -> the F4 confirmation dialog.
        await expect(page.getByTestId('confirm-dialog-confirm')).toBeVisible({ timeout: 5_000 });
        await page.getByTestId('confirm-dialog-confirm').click();
        await expect(page.locator(`text=${name}`)).not.toBeVisible({ timeout: 5_000 });
    });

    test('swipe-left opens the pre-filled edit modal', async ({ page }) => {
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
            await swipeBar(page, bar, 'left');

            // Swipe-left routes through onEdit -> the F2 pre-populated edit modal.
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

    // --- F2: touch lock (5-minute inactivity lock + close-enough double-tap unlock) ---
    // Clock-sequencing note: useTouchLock's 5-minute inactivity setTimeout is
    // registered at mount time, during the shared beforeEach's page.goto('/'), so
    // it is already tracked by whatever clock is installed at that point (the
    // beforeEach's own setFixedTime call). Mirroring this file's own DD-7
    // technique, re-install the clock at the same noon instant (so the
    // beforeEach's pin isn't silently discarded — an argument-less install()
    // would instead seed to the real current wall-clock time) and reload so
    // useTouchLock's timer is (re-)registered under a clean, known tick
    // baseline before fast-forwarding.
    test('F2: locks after 5 minutes of inactivity, blocks a real pointer tap, and unlocks via a qualifying double-tap', async ({ page }) => {
        await page.clock.install({ time: new Date(2025, 0, 15, 12, 0, 0) });
        await page.reload();
        await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });

        await page.clock.fastForward('05:01');

        await expect(page.getByTestId('touch-lock-overlay')).toBeVisible();
        await expect(
            page.locator('[data-testid="touch-lock-indicator"] [data-testid="touch-lock-icon-closed"]')
        ).toBeVisible();

        const firstChoreBar = page.locator('.bg-gray-800.rounded-full').first();

        // Companion assertions: prove the lock blocks more than just
        // tap-to-complete (asserted below). Same raw-coordinate technique as
        // the tap-to-complete check below (reusing the existing swipeBar
        // helper, which already drives react-swipeable via
        // page.mouse.move/down/up rather than locator.click()) plus a raw
        // page.mouse.click on the "+ Add Task" button's own bounding-box
        // coordinates — never bar.click()/button.click(), since Playwright's
        // actionability check would detect the overlay intercepting the
        // gesture and either time out or tempt a `{ force: true }`
        // workaround that would prove nothing about real hit-testing. As
        // with the tap-to-complete case below, the blocking mechanism being
        // exercised here is real-browser hit-testing/z-index (the overlay is
        // a full-viewport `fixed inset-0 z-[90]` div sitting on top of
        // everything, so the click/gesture lands on IT, not on the
        // react-swipeable/button handlers underneath) — `inert` on the
        // `.App` subtree is defense-in-depth, not what's actually caught
        // here.
        //
        // This must run *before* the tap-to-complete click immediately below:
        // the touch-lock overlay is a full-viewport `fixed inset-0` div, so
        // every click anywhere on the page while locked lands on the overlay
        // itself and feeds its own tap-tracking (registerTap), regardless of
        // what's rendered underneath. The tap-to-complete click's coordinates
        // deliberately become the "first tap" of the qualifying double-tap
        // pair at the end of this test — inserting extra taps at different
        // (far-apart) screen coordinates *after* it would desynchronize that
        // pairing. Running them first instead just means each of these taps
        // gets superseded as a non-qualifying "first tap" of its own, leaving
        // the pairing below untouched.
        let deleteRequestFired = false;
        const deleteListener = (request: import('@playwright/test').Request) => {
            if (request.method() === 'DELETE' && request.url().includes('/api/chores')) {
                deleteRequestFired = true;
            }
        };
        page.on('request', deleteListener);

        // Swipe-right on the chore bar would normally open the delete
        // confirmation dialog (see 'swipe-right opens delete confirmation...'
        // below); while locked, the overlay sitting on top should suppress
        // the mouse sequence entirely before react-swipeable ever sees it.
        await swipeBar(page, firstChoreBar, 'right');
        await page.waitForTimeout(250);
        expect(deleteRequestFired).toBe(false);
        page.off('request', deleteListener);
        await expect(page.getByTestId('confirm-dialog-confirm')).not.toBeVisible();
        // Assert the lock is still fully engaged (closed-icon phase), not
        // merely that the overlay element is present — the overlay also
        // stays mounted (just pointer-events-none) for CLOSING_SETTLE_MS
        // after a genuine unlock, so "visible" alone wouldn't catch the
        // overlay's own click handler having accidentally paired this
        // swipe's terminal click with a later tap as a qualifying
        // double-tap (see registerTap in TouchLockOverlay.tsx).
        await expect(
            page.locator('[data-testid="touch-lock-indicator"] [data-testid="touch-lock-icon-closed"]')
        ).toBeVisible();

        let createRequestFired = false;
        const createListener = (request: import('@playwright/test').Request) => {
            if (request.method() === 'POST' && request.url().includes('/api/chores')) {
                createRequestFired = true;
            }
        };
        page.on('request', createListener);

        // "+ Add Task" would normally open the create-chore form modal (see
        // 'adds a new chore via the form' above); while locked, a real click
        // at its own bounding-box coordinates should be swallowed the same
        // way the chore-bar tap is below.
        const addTaskBtn = page.locator('button', { hasText: /\+ Add Task/i });
        const addTaskBox = await addTaskBtn.boundingBox();
        if (!addTaskBox) throw new Error('Could not get bounding box for + Add Task button');
        await page.mouse.click(addTaskBox.x + addTaskBox.width / 2, addTaskBox.y + addTaskBox.height / 2);
        await page.waitForTimeout(250);
        expect(createRequestFired).toBe(false);
        page.off('request', createListener);
        // Note: the touch-lock overlay itself is also a `.fixed.inset-0` div
        // (see its `data-testid="touch-lock-overlay"` element above), so the
        // form modal must be identified by its own unambiguous test id here.
        await expect(page.getByTestId('chore-modal-backdrop')).not.toBeVisible();
        // Same still-fully-locked check as after the swipe above — guards
        // against this click having accidentally paired with the swipe's
        // click (or a later one) as a qualifying double-tap.
        await expect(
            page.locator('[data-testid="touch-lock-indicator"] [data-testid="touch-lock-icon-closed"]')
        ).toBeVisible();

        // Companion to DD-7's own technique: prove the overlay blocks a real
        // pointer tap on the chore bar underneath it, not just that it's
        // present. Use page.mouse.click at the bar's own bounding-box center
        // rather than locator.click() — Playwright's actionability check
        // would detect the overlay intercepting the click and time out (or
        // tempt a `{ force: true }` workaround that would prove nothing
        // about real hit-testing/z-index).
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

        const box = await firstChoreBar.boundingBox();
        if (!box) throw new Error('Could not get bounding box for chore bar');
        const tapX = box.x + box.width / 2;
        const tapY = box.y + box.height / 2;
        await page.mouse.click(tapX, tapY);

        // Give the click a chance to propagate; confirm no completion request fired.
        await page.waitForTimeout(250);
        expect(completePatchFired).toBe(false);
        page.off('request', completeListener);
        await expect(page.locator('.bg-red-700')).not.toBeVisible();
        await expect(page.getByTestId('touch-lock-overlay')).toBeVisible();

        // Qualifying double-tap: same coordinates, fired in quick succession —
        // well within SECOND_TAP_WINDOW_MS/SECOND_TAP_MAX_DISTANCE_PX regardless
        // of the small amount of genuine wall-clock time two back-to-back
        // page.mouse.click() calls take to execute (install() leaves real-time
        // syncing active between explicit fastForward/tick calls, it does not
        // freeze Date.now()).
        await page.mouse.click(tapX, tapY);

        // handleArm() has now fired: the real useTouchLock's arm() flips
        // isLocked to false immediately (a state update, not a timer), but
        // App.tsx's isClosing hand-off keeps TouchLockOverlay mounted (now
        // pointer-events-none, per its 'opening' phase) for CLOSING_SETTLE_MS
        // so its own shrink/open animation can finish. Advance the fake clock
        // past that window so the overlay actually unmounts.
        await page.clock.fastForward(500);
        await expect(page.getByTestId('touch-lock-overlay')).not.toBeVisible();
        await expect(
            page.locator('[data-testid="touch-lock-indicator"] [data-testid="touch-lock-icon-open"]')
        ).toBeVisible();

        // A subsequent tap-to-complete action now succeeds for real — the
        // overlay is gone and the app root is no longer inert.
        const patchDone = page.waitForResponse(
            resp => resp.url().includes('/api/chores') && resp.url().includes('/complete') && resp.request().method() === 'PATCH',
            { timeout: 10_000 }
        );
        await firstChoreBar.click();
        await patchDone;
        await expect(page.locator('.bg-red-700')).not.toBeVisible();
    });
});
