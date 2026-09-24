import { test, expect } from '@playwright/test';

// F22: real-browser checks jsdom can't make (vitest runs with css: false and no layout): the
// native-scrollbar rule applies, the full-bleed frame/frost, the thumb's real geometry (including
// its end-of-travel alignment with the last chore bar) and fade, the form thumb, the card-sized modal wrapper's
// hit-testing, and reduced motion. Read-only: never taps a chore bar or submits the form, so it
// can run in a parallel worker alongside smoke.spec.ts's mutations.

// App.tsx's unexported LIST_THUMB_BOTTOM_INSET_PX: the list thumb's track stops this far above the
// frame's bottom (the deck's 80 px + ChoreList's 16 px pb-4), so at full scroll the thumb's bottom
// meets the last chore bar's bottom.
const LIST_THUMB_BOTTOM_INSET_PX = 96;

test.describe('Overlay scrollbar + full-bleed region (F22)', () => {
    test.beforeEach(async ({ page }) => {
        // Same viewport as scroll-to-top.spec.ts: the 10-row seed overflows the scroller by ~480 px.
        await page.setViewportSize({ width: 1280, height: 600 });
        // Same noon pin as smoke.spec.ts — keeps useScreenBlank out of its 21:00–06:00 window.
        await page.clock.setFixedTime(new Date(2025, 0, 15, 12, 0, 0));
        await page.goto('/');
        await page.waitForSelector('text=Vacuum Bedroom Floor', { timeout: 10_000 });
    });

    test('the scroll region and deck frost run edge to edge while header rows and bars stay inset', async ({ page }) => {
        const root = page.locator('#root');
        const frame = page.getByTestId('scroll-region-frame');
        const region = page.locator('.overflow-y-auto');

        const rootBox = await root.boundingBox();
        const frameBox = await frame.boundingBox();
        if (!rootBox || !frameBox) throw new Error('Could not get bounding boxes for #root / scroll frame');
        expect(Math.abs(frameBox.x - rootBox.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(frameBox.width - rootBox.width)).toBeLessThanOrEqual(0.5);

        // Headless Chromium runs with --hide-scrollbars, so offsetWidth - clientWidth is 0 even
        // without F22; the computed scrollbar-width (auto without .scrollbar-none) discriminates.
        await expect(region).toHaveCSS('scrollbar-width', 'none');

        const backingBox = await page.getByTestId('add-task-deck-backing').boundingBox();
        if (!backingBox) throw new Error('Could not get bounding box for add-task deck backing');
        expect(Math.abs(backingBox.x - frameBox.x)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(backingBox.width - frameBox.width)).toBeLessThanOrEqual(0.5);

        const firstBarBox = await page.locator('.bg-gray-800.rounded-full').first().boundingBox();
        if (!firstBarBox) throw new Error('Could not get bounding box for the first chore bar');
        expect(Math.abs(firstBarBox.x - (rootBox.x + 16))).toBeLessThanOrEqual(0.5);

        const stripBox = await page.getByTestId('status-count-strip').boundingBox();
        if (!stripBox) throw new Error('Could not get bounding box for the status count strip');
        expect(Math.abs(stripBox.x - (rootBox.x + 16))).toBeLessThanOrEqual(0.5);
    });

    test('the list thumb fades in on scroll, sits at the right edge, ends level with the last bar, is click-through, and fades out', async ({ page }) => {
        const region = page.locator('.overflow-y-auto');
        const frame = page.getByTestId('scroll-region-frame');
        const thumb = page.getByTestId('overlay-scrollbar');

        const overflowPx = await region.evaluate(el => el.scrollHeight - el.clientHeight);
        expect(overflowPx).toBeGreaterThan(200);

        // toBeVisible() treats opacity:0 as visible, so assert the computed opacity instead.
        await expect(thumb).toHaveCSS('opacity', '0');

        await region.evaluate(el => { el.scrollTop = 150; });
        await expect(thumb).toHaveCSS('opacity', '1');

        const frameBox = await frame.boundingBox();
        const thumbBox = await thumb.boundingBox();
        if (!frameBox || !thumbBox) throw new Error('Could not get bounding boxes for scroll frame / thumb');
        expect(thumbBox.width).toBe(4);
        expect(Math.abs(thumbBox.x + thumbBox.width - (frameBox.x + frameBox.width - 2))).toBeLessThanOrEqual(0.5);

        // Every geometry value comes from one in-page call, so a parallel smoke.spec.ts worker's
        // list change cannot land between reads. The thumb's parent is the frame, whose first
        // child is the scroller.
        const readThumb = (pinEnd: boolean) => thumb.evaluate((el, pin) => {
            const frameEl = el.parentElement!;
            const scroller = frameEl.querySelector('.overflow-y-auto')!;
            if (pin) scroller.scrollTop = scroller.scrollHeight;
            const thumbRect = el.getBoundingClientRect();
            return {
                thumbH: thumbRect.height,
                thumbBottom: thumbRect.bottom,
                frameBottom: frameEl.getBoundingClientRect().bottom,
                lastBarBottom: Array.from(scroller.querySelectorAll('.bg-gray-800.rounded-full')).at(-1)!.getBoundingClientRect().bottom,
                ch: scroller.clientHeight,
                sh: scroller.scrollHeight,
            };
        }, pinEnd);

        // Polled: a parallel re-pull can land between React's list commit and the
        // ResizeObserver-driven re-measure, so a single read may pair a new sh with the old thumb.
        await expect.poll(async () => {
            const metrics = await readThumb(false);
            const track = metrics.ch - LIST_THUMB_BOTTOM_INSET_PX;
            return Math.abs(metrics.thumbH - Math.min(Math.max(track * metrics.ch / metrics.sh, 24), track));
        }).toBeLessThanOrEqual(1);

        // The track never exceeds ch - LIST_THUMB_BOTTOM_INSET_PX, so this holds whatever the list length.
        const mid = await readThumb(false);
        expect(mid.thumbBottom).toBeLessThanOrEqual(mid.frameBottom - LIST_THUMB_BOTTOM_INSET_PX + 0.5);

        // Each iteration re-pins scrollTop to the end, so a row added by a parallel worker cannot
        // leave the scroller short of the end. At full scroll the thumb reaches its track end, and
        // that end is level with the bottom of the last chore bar (the user's alignment choice).
        await expect.poll(async () => {
            const atEnd = await readThumb(true);
            return Math.max(
                Math.abs(atEnd.thumbBottom - (atEnd.frameBottom - LIST_THUMB_BOTTOM_INSET_PX)),
                Math.abs(atEnd.thumbBottom - atEnd.lastBarBottom),
            );
        }).toBeLessThanOrEqual(1);

        const hitsThumb = await thumb.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return el === hit || el.contains(hit);
        });
        expect(hitsThumb).toBe(false);

        // Idles ≈ 1 s, then a 400 ms fade.
        await expect(thumb).toHaveCSS('opacity', '0', { timeout: 3_000 });
    });

    test('the form thumb stays inside the card, and tapping beside the card still closes the modal', async ({ page }) => {
        // Portrait, so the landscape ≤ 500 px rotate overlay stays out of the way.
        await page.setViewportSize({ width: 400, height: 400 });
        await page.locator('button', { hasText: /\+ Add Task/i }).click();

        // Measured: card clientHeight 360, scrollHeight 573. The list thumb behind the modal is
        // not asserted here.
        const card = page.locator('.fixed.inset-0 .overflow-y-auto');
        const cardOverflowPx = await card.evaluate(el => el.scrollHeight - el.clientHeight);
        expect(cardOverflowPx).toBeGreaterThan(0);

        await expect(card).toHaveCSS('scrollbar-width', 'none');

        const formThumb = page.locator('.fixed.inset-0').getByTestId('overlay-scrollbar');
        await card.evaluate(el => { el.scrollTop = 40; });
        await expect(formThumb).toHaveCSS('opacity', '1');

        const cardBox = await card.boundingBox();
        const formThumbBox = await formThumb.boundingBox();
        if (!cardBox || !formThumbBox) throw new Error('Could not get bounding boxes for form card / thumb');
        expect(formThumbBox.y).toBeGreaterThanOrEqual(cardBox.y + 12);
        expect(formThumbBox.y + formThumbBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height - 12);

        // The backdrop is `fixed inset-0 … px-4 pt-4`; at 400 px wide the card spans x 16–384,
        // so x 6 at the card's vertical centre lands in the backdrop's gutter. If the new wrapper
        // were full-width, the click would hit it instead and the modal would stay open.
        // Never submit; the app has no Escape handler.
        await page.mouse.click(6, cardBox.y + cardBox.height / 2);
        await expect(page.getByTestId('chore-modal-backdrop')).toHaveCount(0);
    });

    test('under reduced motion the thumb shows without a transition', async ({ page }) => {
        const region = page.locator('.overflow-y-auto');
        const thumb = page.getByTestId('overlay-scrollbar');

        // beforeEach has already navigated; Chromium re-evaluates the media query live.
        await page.emulateMedia({ reducedMotion: 'reduce' });

        await region.evaluate(el => { el.scrollTop = 150; });
        await expect(thumb).toHaveCSS('transition-property', 'none');
        await expect(thumb).toHaveCSS('opacity', '1');
    });
});
