import { test, expect, type Page } from '@playwright/test';
import { signE2eJwt } from './sign-jwt.js';

// The `webkit-` prefix makes playwright.config.ts also run this in the webkit project.

async function signIn(page: Page) {
  const token = await signE2eJwt('member-e2e@example.com');
  await page.setExtraHTTPHeaders({ 'Cf-Access-Jwt-Assertion': token });
  await page.goto('/');
  await expect(page.getByTestId('chore-bar').first()).toBeVisible();
}

async function deckBottomGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const deck = document.querySelector('[data-testid="add-chore-deck"]') as HTMLElement;
    return Math.abs(window.innerHeight - deck.getBoundingClientRect().bottom);
  });
}

// DOM-only: clone the chore bars until the page scrolls (no DB writes).
async function lengthenList(page: Page) {
  await page.evaluate(() => {
    // Clone whole list items (children of the vertical list), not the bar inside its own row.
    // Coupled to ChoreList's `.space-y-3` root element; update here if that class changes.
    const list = document
      .querySelector('[data-testid="chore-bar"]')
      ?.closest('.space-y-3') as HTMLElement | null;
    if (!list) throw new Error('chore list not found');
    const first = list.firstElementChild as HTMLElement;
    const parent = list;
    const scroller = document.scrollingElement ?? document.documentElement;
    // Bounded so a layout that never grows fails the assertions below instead of hanging.
    for (let i = 0; i < 200 && scroller.scrollHeight <= window.innerHeight * 2; i++) {
      parent.appendChild(first.cloneNode(true));
    }
  });
}

async function assertDeckBehaviour(page: Page) {
  expect(await deckBottomGap(page)).toBeLessThanOrEqual(1);

  await lengthenList(page);
  expect(
    await page.evaluate(() => (document.scrollingElement ?? document.documentElement).scrollHeight),
  ).toBeGreaterThan(await page.evaluate(() => window.innerHeight));
  await page.evaluate(() =>
    window.scrollTo({
      top: (document.scrollingElement ?? document.documentElement).scrollHeight,
      behavior: 'instant',
    }),
  );
  expect(await deckBottomGap(page)).toBeLessThanOrEqual(1);

  const clears = await page.evaluate(() => {
    const bars = document.querySelectorAll('[data-testid="chore-bar"]');
    const last = bars[bars.length - 1] as HTMLElement;
    const deck = document.querySelector('[data-testid="add-chore-deck"]') as HTMLElement;
    const lastRect = last.getBoundingClientRect();
    const hit = document.elementFromPoint(
      lastRect.left + lastRect.width / 2,
      lastRect.top + lastRect.height / 2,
    );
    return {
      aboveDeck: lastRect.bottom <= deck.getBoundingClientRect().top,
      hitInsideBar: hit !== null && last.contains(hit),
      hitInsideDeck: hit !== null && deck.contains(hit),
    };
  });
  expect(clears.aboveDeck).toBe(true);
  expect(clears.hitInsideBar).toBe(true);
  expect(clears.hitInsideDeck).toBe(false);
}

test('Add Chore deck is pinned to the viewport bottom and clears the last bar at 1280x720', async ({
  page,
}) => {
  await signIn(page);
  await assertDeckBehaviour(page);
  await expect(page.getByRole('button', { name: '+ Add Chore' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add Chore' })).toBeEnabled();
  await page.getByRole('button', { name: '+ Add Chore' }).click();
  await expect(page.getByLabel('Name')).toBeVisible();
  await page.keyboard.press('Escape');
});

async function scrollInstant(page: Page, top: number) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
}

async function showScrollToTop(page: Page) {
  await lengthenList(page);
  await scrollInstant(page, 400);
  const button = page.getByLabel('Scroll to top');
  // Wait out the 500ms fade: the button is inert/aria-hidden until fully shown.
  await expect(button).not.toHaveAttribute('inert', /.*/);
  await expect(button).not.toHaveAttribute('aria-hidden', /.*/);
  await expect(button).toBeVisible();
  return button;
}

test('Scroll to top appears past 80px, sits above the deck and returns scrollY to 0', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page);
  const button = await showScrollToTop(page);
  const above = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Scroll to top"]') as HTMLElement;
    const deck = document.querySelector('[data-testid="add-chore-deck"]') as HTMLElement;
    return btn.getBoundingClientRect().bottom <= deck.getBoundingClientRect().top;
  });
  expect(above).toBe(true);
  await button.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('focus moves to the focus-target sentinel (not body) when the focused button goes non-interactive', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await signIn(page);
  await showScrollToTop(page);
  await page.evaluate(() => (document.querySelector('[aria-label="Scroll to top"]') as HTMLElement).focus());
  await expect(page.getByLabel('Scroll to top')).toBeFocused();
  await scrollInstant(page, 0);
  await expect(page.getByLabel('Scroll to top')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('focus-target')).toBeFocused();
});

test('Add Chore deck is pinned to the viewport bottom and clears the last bar at 390x844', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await assertDeckBehaviour(page);
});
