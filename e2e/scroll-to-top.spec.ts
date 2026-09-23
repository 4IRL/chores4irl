import { test, expect } from '@playwright/test';

// F18: real-browser checks jsdom can't make (vitest runs with css: false, no layout, and jsdom
// ignores `inert`). Read-only: never taps a chore bar or the deck, so seed data is unchanged and
// nothing depends on smoke.spec.ts's mutations, run order, or running concurrently with it (CI
// runs both files in parallel workers).
test.describe('Scroll-to-top button (F18)', () => {
    test.beforeEach(async ({ page }) => {
        // Desktop Chrome width, shorter height: the 10-row seed overflows the scroller by ~450 px
        // (measured; ~330 px at the default 720 px height), comfortably past the 80 px threshold.
        await page.setViewportSize({ width: 1280, height: 600 });
        // Same noon pin as smoke.spec.ts — keeps useScreenBlank out of its 21:00–06:00 window.
        await page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0));
        await page.goto('/');
        await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });
    });

    test('hidden at the top, fades in past 80 px, stays anchored clear of the deck, and scrolls back to the top', async ({ page }) => {
        const region = page.locator('.overflow-y-auto');
        const button = page.getByTestId('scroll-to-top');

        const overflowPx = await region.evaluate(el => el.scrollHeight - el.clientHeight);
        expect(overflowPx).toBeGreaterThan(200);

        // toBeVisible() treats opacity:0 as visible, so assert the computed opacity instead.
        await expect(button).toHaveCSS('opacity', '0');
        await expect(button).toHaveAttribute('inert', '');

        await region.evaluate(el => { el.scrollTop = 150; });
        await expect(button).toHaveCSS('opacity', '1');
        await expect(button).not.toHaveAttribute('inert');
        const anchoredBox = await button.boundingBox();
        if (!anchoredBox) throw new Error('Could not get bounding box for scroll-to-top button');

        // Scrolling further must not move it (anchored to the frame, not inside the scroller).
        await region.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBeGreaterThan(150);
        expect(await button.boundingBox()).toEqual(anchoredBox);

        // Clear of the deck plus its 4 rem (64 px) frosted -top-16 overhang.
        const deckBox = await page.getByTestId('add-task-deck').boundingBox();
        if (!deckBox) throw new Error('Could not get bounding box for add-task deck');
        expect(anchoredBox.y + anchoredBox.height).toBeLessThanOrEqual(deckBox.y - 64);

        await button.click();
        // Stays tappable while it fades: sample every frame in the page until the opacity first
        // drops below 1; at that frame `inert` (applied FADE_MS = 500 ms after the fade starts) must
        // still be absent and the button's centre must hit-test to the button, not a chore bar.
        // A 3 s in-page deadline turns "never started fading" into a readable assertion failure.
        const firstFadeFrame = await button.evaluate(el => new Promise<{ timedOut: boolean; inert: boolean; hitsButton: boolean }>(resolve => {
            const deadline = performance.now() + 3_000;
            const sample = () => {
                if (Number(getComputedStyle(el).opacity) < 1) {
                    const rect = el.getBoundingClientRect();
                    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    resolve({ timedOut: false, inert: el.hasAttribute('inert'), hitsButton: el.contains(hit) });
                } else if (performance.now() > deadline) {
                    resolve({ timedOut: true, inert: el.hasAttribute('inert'), hitsButton: false });
                } else {
                    requestAnimationFrame(sample);
                }
            };
            sample();
        }));
        expect(firstFadeFrame).toEqual({ timedOut: false, inert: false, hitsButton: true });

        await expect.poll(() => region.evaluate(el => el.scrollTop)).toBe(0);
        await expect(button).toHaveCSS('opacity', '0');
        await expect(button).toHaveAttribute('inert', '');
    });
});
