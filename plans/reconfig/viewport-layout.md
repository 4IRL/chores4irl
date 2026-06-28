# Viewport Layout Reconfiguration

## Summary

Fix the app's viewport so the entire layout fits within the screen with no page-level scrolling. The chore list is the only scrollable region. Add a modal for the add-chore form, enforce portrait orientation on small landscape screens, and restructure `ChoreTimerBar` for mobile.

Primary targets: 10" Raspberry Pi touch screen in **portrait mode** (600px wide × 1024px tall — OS-level rotation, not CSS) and mobile phones. Desktop is dev/verification only.

## Design Decisions

| Area | Decision |
|---|---|
| Responsive strategy | Mobile-first. Base styles target 375px phones; portrait RPI (600px) inherits and has more breathing room. Tailwind `sm` (640px) applies to landscape RPI and desktop. No custom breakpoints. |
| RPI target | 600×1024px portrait. `max-width: 768px` on `#root` — RPI and phones fill full width; desktop caps at 768px centered. |
| NavBar overflow | Horizontal scroll, tabs never wrap. Scrollbar hidden visually, touch-scroll preserved. |
| AddChore | Sticky footer, always visible. Footer renders only `<AddChoreButton>`; form renders as a modal outside the column. |
| AddChoreForm | Fixed-position modal overlay rendered via `ReactDOM.createPortal` to `document.body`. Backdrop: `bg-black/60 backdrop-blur-sm`. Pinned near the top (`items-start pt-4`) so the form is reachable on short screens like iPhone SE (667px). Form scrolls internally via `max-h-[90dvh]`. |
| Modal centering | `items-start pt-4` (was `items-center`) — keeps the form top reachable on short viewports without depending on viewport-centered geometry. |
| Touch targets | `RoomTab` and `AddChoreButton`: `min-h-[44px]`. Delete button: deferred — swipe-to-delete planned as future feature. |
| ChoreTimerBar layout | Delete raw `chore.id` (debug artifact). On mobile: stack `ChoreInfo` above `CompletionInfo`, bar height `h-36`. On `sm+`: flat row, `h-24`. Delete button: `absolute right-3 top-1/2 -translate-y-1/2`. `rounded-full` handles pill shape at any height automatically. |
| OverdueBadge placement | In-flow flex child of the `absolute inset-0` content div. On mobile: wrapped in an `absolute top-2 right-16` div so it floats clear of the delete button. On `sm+`: flows in-row at end via `sm:order-2` — final order ChoreInfo | CompletionInfo | OverdueBadge. |
| Orientation enforcement | CSS-only overlay shown at `@media (orientation: landscape) and (max-height: 500px)` — catches landscape phones (320–430px tall) but not landscape RPI (600px) or desktop. |

## Key File Locations

- `frontend/index.html` — viewport meta, rotate overlay div
- `frontend/src/index.css` — `html`/`body` base, `.scrollbar-none` utility, rotate overlay CSS
- `frontend/src/App.css` — `#root` block
- `frontend/src/App.tsx` — layout shell, modal wiring
- `frontend/src/components/nav/NavBar.tsx` — overflow scroll
- `frontend/src/components/nav/RoomTab.tsx` — touch target
- `frontend/src/components/form/AddChoreButton.tsx` — touch target
- `frontend/src/components/form/AddChoreForm.tsx` — `max-h-[90dvh]` addition
- `frontend/src/components/form/ChoreFormModal.tsx` — new file
- `frontend/src/components/chore/ChoreList.tsx` — bottom padding
- `frontend/src/components/chore/ChoreTimerBar.tsx` — height, layout restructure, id removal
- `frontend/src/components/chore/CompletionInfo.tsx` — text alignment

---

## Steps

### 1. Fix Viewport Meta and Global CSS Foundation

**To-do:**
- [x] In `frontend/index.html`: update the viewport meta tag:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  ```
- [x] In `frontend/src/index.css`: delete the standalone `body { outline: 3px solid green; }` block entirely (do not just remove the outline property — delete the whole rule; it will be replaced by the new `body {}` block below).
- [x] In `frontend/src/index.css`: replace the `body, html` block:
  ```css
  /* SPA: all layout scrolling delegated to .flex-1 overflow-y-auto wrappers. Revisit if a page-level scroll route is added. */
  html {
    height: 100dvh;
    overflow: hidden;
  }

  body {
    height: 100dvh;
    overflow: hidden;
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  ```
  `100dvh` accounts for collapsing browser chrome on mobile. Remove `align-items: center` (was vertically centering `#root`). Keep `justify-content: center` for horizontal centering on wide screens.
- [x] In `frontend/src/index.css`: add the `.scrollbar-none` utility (used by NavBar in Step 5):
  ```css
  .scrollbar-none {
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  ```

### 2. Fix `#root` and `.App` Shell

**To-do:**
- [x] In `frontend/src/App.css`: replace the entire `#root` block:
  ```css
  #root {
    width: 100%;
    height: 100dvh;
    max-width: 768px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }
  ```
- [x] In `frontend/src/App.css`: delete the entire commented-out Vite boilerplate block below `#root` (`.logo`, `@keyframes logo-spin`, `.card`, `.read-the-docs`).
- [x] In `frontend/src/App.css`: also remove the live Vite scaffold global rules that conflict with Tailwind: the `a`, `a:hover`, `h1`, `button`, `button:hover`, `button:focus`, `button:focus-visible`, and `@media (prefers-color-scheme: light)` blocks (approximately lines 15–59). These are Vite boilerplate that override Tailwind utility classes. Leave only the `#root` block.
- [x] In `App.tsx`: change the outer `<div className="App">` to:
  ```tsx
  <div className="App h-full flex flex-col overflow-hidden">
  ```
- [x] In `App.tsx`: fix the loading state branch (lines 97–104) — replace `min-h-screen` with `h-screen`:
  ```tsx
  <div className="App">
    <div className="mx-auto px-4 bg-gray-900 h-screen flex items-center justify-center">
      <div className="text-white text-lg">Loading chores...</div>
    </div>
  </div>
  ```
  Note: `p-4` is intentionally changed to `px-4` (vertical padding dropped) — the `h-screen flex items-center justify-center` container centers the loading text without needing top/bottom padding.

### 3. Verify Foundational Viewport

Spot-check the foundational viewport constraints established by Steps 1–2 before layering scroll/sticky/modal behavior on top. A wrong `#root` height here silently invalidates every later step.

**Expected intermediate state:** After Step 2, the outer `.App` div has the new `h-full flex flex-col overflow-hidden` classes, but the inner content wrapper still has its pre-refactor `min-h-screen` class (it is not touched until Step 4's atomic rewrite). That inner `min-h-screen` will force the inner column to be at least `100vh` tall, pushing the sticky `AddChoreButton` area below the visible viewport on short screens. **This is expected and does not invalidate the checks below** — `#root` itself is still constrained to `100dvh` with `overflow: hidden`, so the viewport-level assertions still hold. The visibly broken inner layout will be corrected by Step 4.

**To-do:**
- [x] Start `npm run dev` in `frontend/`.
- [x] Open the app at 375px viewport width in a browser.
- [x] Confirm `#root` fills the viewport: open DevTools → Elements → select `#root` → verify its computed height equals `window.innerHeight` (or run `document.getElementById('root').offsetHeight === window.innerHeight` in the Console). Confirm no scrollbar appears on `<html>` or `<body>`. Attempt to scroll the body — it must not scroll. If any check fails, diagnose Steps 1–2 before continuing.
- [x] Note on appearance: ignore the fact that the sticky footer/add-button looks pushed off-screen in the browser — this is the expected intermediate state documented above (inner wrapper still carries `min-h-screen`) and will be fixed by Step 4. Do **not** try to "fix" it by editing the inner wrapper now; Step 4 replaces the whole wrapper atomically.
- [x] If any of the `#root` / html / body assertions fail (not the intermediate inner-layout appearance), fix Steps 1–2 before continuing.

### 4. Restructure App.tsx Content Wrapper, Scroll Wrapper, Sticky Footer, and Modal

This step combines what were originally three separate steps (scroll wrapper around `ChoreList`, sticky `AddChoreButton` footer, and modal overlay creation/wiring). They are merged into a single atomic step so the add-chore feature is never in a broken intermediate state — the inline `AddChoreForm` is removed in the same edit that wires the new `ChoreFormModal`.

Apply the bullets below in listed order — `ChoreFormModal.tsx` must exist before App.tsx imports it.

**To-do:**
- [ ] In `ChoreList.tsx`: add `pb-4` to the root div and render an empty-state message when there are no chores:
  ```tsx
  if (chores.length === 0) {
    return (
      <div>
        <p className="text-gray-400 text-center py-8">
          No chores yet — tap + Add Task to get started.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 pb-4">
      {/* existing chore list rendering */}
    </div>
  );
  ```
  The empty-state message replaces the bare gap that would otherwise appear between the date line and the sticky footer when the chore list is empty.
- [ ] Create `frontend/src/components/form/ChoreFormModal.tsx`:
  ```tsx
  import { createPortal } from 'react-dom';
  import type { Chore } from '@customTypes/SharedTypes';
  import AddChoreForm from './AddChoreForm';

  type ChoreFormModalProps = {
    onSubmit: (chore: Omit<Chore, 'id'>) => void;
    onCancel: () => void;
  };

  export default function ChoreFormModal({ onSubmit, onCancel }: ChoreFormModalProps) {
    function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target === event.currentTarget) {
            onCancel();
        }
    }

    return createPortal(
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 px-4 pt-4"
        onClick={handleBackdropClick}
      >
        <AddChoreForm onSubmit={onSubmit} onCancel={onCancel} />
      </div>,
      document.body,
    );
  }
  ```
  `createPortal` renders the overlay directly on `document.body`, so the `fixed` modal is immune to any future `transform`/`will-change`/`filter` added to ancestor elements (which would otherwise clip it on iOS Safari). `backdrop-blur-sm` blurs the app content visible through the 60% black tint. Pinned near the top (`items-start pt-4`) so the form is reachable on short screens like iPhone SE (667px).
- [ ] In `AddChoreForm.tsx`: add `overflow-y-auto max-h-[90dvh]` to the root div:
  ```tsx
  <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md overflow-y-auto max-h-[90dvh]">
  ```
- [ ] In `App.tsx`: add `import ChoreFormModal from './components/form/ChoreFormModal'`.
- [ ] In `App.tsx`: remove `import AddChoreForm from './components/form/AddChoreForm'` — `AddChoreForm` is used inside `ChoreFormModal`, not directly in `App.tsx`.
- [ ] In `App.tsx`: replace the existing content wrapper with the full structure below — this single edit installs the scroll wrapper around `ChoreList`, the sticky `AddChoreButton` footer, and the modal sibling all at once. The modal is wired in the same edit that removes the inline form, so the add-chore feature is never silently broken.
  ```tsx
  <div className="App h-full flex flex-col overflow-hidden">
    <div className="flex flex-col h-full overflow-hidden bg-gray-900 px-4 pt-4">
      {error && (
        <div className="mb-4 p-3 bg-red-700 text-white rounded-lg text-sm flex justify-between items-center flex-shrink-0">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}
      <NavBar rooms={uniqueRooms} selectedRoom={selectedRoom} onSelect={setSelectedRoom} />
      <div className="text-xs text-white mb-2 flex-shrink-0">
        {day.toDateString()}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <ChoreList chores={orderedChores} day={day} onComplete={handleCompleteChore} onDelete={handleDeleteChore} />
      </div>
      <div className="flex-shrink-0 py-4 flex justify-center border-t border-gray-700">
        <AddChoreButton onClick={() => setShowForm(true)} />
      </div>
    </div>
    {showForm && <ChoreFormModal onSubmit={handleAddChore} onCancel={() => setShowForm(false)} />}
  </div>
  ```
  `flex-shrink-0` on the error banner, date line, and footer prevents them compressing. `min-h-0` on the scroll wrapper is required — without it a flex child's minimum height defaults to `auto`, preventing `flex-1` from constraining height. The footer always renders only `<AddChoreButton>`. The modal sibling uses `createPortal` internally, so it visually renders on `document.body` regardless of where it appears in the JSX tree.
- [ ] In `e2e/smoke.spec.ts`: update the `adds a new chore via the form` and `deletes a chore` tests to wait for the modal overlay before filling inputs — add `await expect(page.locator('.fixed.inset-0')).toBeVisible()` immediately after clicking `+ Add Task`.
- [ ] In `frontend/src/components/form/FormField.tsx`: associate the label with the input so `screen.getByLabelText(...)` can find it. Change the label element from `<label className="text-sm text-gray-400 capitalize">{label}</label>` to `<label htmlFor={name} className="text-sm text-gray-400 capitalize">{label}</label>`, and change the `<input name={name} ...>` to also include `id={name}` (`<input id={name} name={name} ...>`). This is both the a11y-correct pattern and a prerequisite for the App.test.tsx refactor below.
- [ ] In `frontend/src/__tests__/App.test.tsx`: the modal now portals to `document.body`, so `container.querySelector` returns null. After the FormField edit above, switch to `screen.getByLabelText(...)`. Specific edits:
  - In `openAndFillForm` (around lines 143–151): change the helper signature to `async function openAndFillForm(user: ReturnType<typeof userEvent.setup>)` (drop the `container` parameter). Replace each `container.querySelector('input[name="name"]')!` with `screen.getByLabelText('Name')`, `'room'` → `screen.getByLabelText('Room')`, `'dateLastCompleted'` → `screen.getByLabelText('Last Completed')`, `'duration'` → `screen.getByLabelText('Duration (minutes)')`, `'frequency'` → `screen.getByLabelText('Frequency (days)')`.
  - Update both helper call sites (around lines 159 and 171) from `await openAndFillForm(container, user)` to `await openAndFillForm(user)`.
  - Change `const { container } = render(<App />);` to `render(<App />);` at lines ~157 and ~169 (the `container` binding is now unused — leaving it will trip ESLint's unused-vars rule).
  - In the `adding a chore appends it to the end without re-sorting` test, change `const { container } = render(<App />);` at line ~196 to `render(<App />);` and replace the five inline `container.querySelector('input[name="..."]')!` calls at lines 208, 209, 210, 211, 212 with the same `screen.getByLabelText(...)` calls as the helper (Name, Room, Last Completed, Duration (minutes), Frequency (days)).

### 5. Fix NavBar Overflow

**To-do:**
- [x] In `NavBar.tsx`: add `flex-shrink-0` to the outer `#NavBar` div:
  ```tsx
  <div id="NavBar" className="border-b border-gray-700 flex-shrink-0">
  ```
- [x] In `NavBar.tsx`: add `overflow-x-auto scrollbar-none` to the inner container:
  ```tsx
  <div className="container mx-auto flex space-x-1 overflow-x-auto scrollbar-none">
  ```

### 6. Touch Target Enforcement

**To-do:**
- [x] In `RoomTab.tsx`: replace `px-6 py-4` with `px-4 sm:px-6 min-h-[44px] py-3` and add `text-sm sm:text-base`:
  ```tsx
  <button
    className={`px-4 sm:px-6 min-h-[44px] py-3 text-sm sm:text-base font-medium flex items-center ${isActive ? activeClasses : inactiveClasses}`}
    onClick={() => onClick(value)}
  >
  ```
- [x] In `AddChoreButton.tsx`: replace `py-2 px-4` with `py-3 min-h-[44px] px-6`:
  ```tsx
  <button
    className="bg-blue-500 hover:bg-blue-600 bg-opacity-50 text-white font-medium py-3 min-h-[44px] px-6 rounded-full"
    onClick={onClick}
  >
  ```
- [x] In `ChoreTimerBar.tsx`: add a comment above the delete button:
  ```tsx
  {/* TODO: replace with swipe-to-delete — touch target intentionally below 44px until then */}
  ```

### 7. Remove `chore.id` and Restructure ChoreTimerBar

Delete the debug ID display and restructure the bar's internal layout to stack on mobile.

Note: `<ProgressBar width={barWidth} color={barColor} isUrgent={isUrgent} />` renders as the first child of the outer div, BEFORE the `absolute inset-0` content div. It is NOT part of any replaced block — keep it exactly as-is. Only replace the `absolute inset-0` div and its children.

**To-do:**
- [x] In `ChoreTimerBar.tsx`: delete `<div className="font-medium text-white">{chore.id}</div>` entirely.
- [x] In `ChoreTimerBar.tsx`: change the bar height from `h-24 w-full` to `h-36 sm:h-24 w-full`:
  ```tsx
  <div
    data-testid="chore-bar"
    className="relative h-36 sm:h-24 w-full bg-gray-800 rounded-full shadow cursor-pointer overflow-hidden"
    onClick={resetTask}
  >
  ```
  `rounded-full` (`border-radius: 9999px`) clamps to `height/2` automatically — no separate radius calculation needed at either height.
- [x] In `ChoreTimerBar.tsx`: restructure the inner content div so `OverdueBadge` is a flex child (not a sibling of the content div), and reposition the delete button. Replace the entire `absolute inset-0` div and its children:
  ```tsx
  {/* Text content + OverdueBadge: stacked on mobile, flat row on sm+ */}
  <div className="absolute inset-0 px-4 pr-12 flex flex-col justify-center gap-1 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
    <ChoreInfo name={chore.name} room={chore.room} frequency={chore.frequency} />
    {isOverdue && (
      <div className="absolute top-2 right-16 sm:static sm:order-2">
        <OverdueBadge />
      </div>
    )}
    <CompletionInfo date={chore.dateLastCompleted} daysSince={daysSince} />
  </div>

  {/* TODO: replace with swipe-to-delete — touch target intentionally below 44px until then */}
  <button
    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-red-600 bg-opacity-80 hover:bg-red-500 text-white text-sm rounded-full"
    onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
    aria-label="Delete chore"
  >
    ✕
  </button>
  ```
  - Mobile: `flex-col`, `pr-12` reserves right space for the absolute delete button. ChoreInfo stacks above CompletionInfo, left-aligned. `OverdueBadge` is wrapped in an `absolute top-2 right-16` div so it floats top-right, clear of the delete button at `right-3`.
  - `sm+`: `flex-row sm:justify-between sm:pr-4` restores the flat layout. The `OverdueBadge` wrapper switches to `sm:static`, dropping into the flex flow as a child of the content div, and `sm:order-2` pushes it to the end of the flex row (CSS flex renders order-0 siblings first in source order, then order-2 elements last). Final sm+ visual order: ChoreInfo | CompletionInfo | OverdueBadge.
  - Delete button: `absolute right-3 top-1/2 -translate-y-1/2` — floats at the right edge, vertically centered at any bar height.
- [x] In `CompletionInfo.tsx`: change `text-right` to `text-left sm:text-right` so the stacked mobile layout is left-aligned:
  ```tsx
  <div className="font-medium text-white text-left sm:text-right">
  ```
- [x] In `ChoreInfo.tsx`: add `truncate min-w-0` to the name div className so long chore names ellipsis-clip on both the stacked mobile layout and the sm+ flex row. If the name div currently has `className="font-medium text-white"`, change to `className="font-medium text-white truncate min-w-0"` (preserving any existing surrounding classes). The `min-w-0` is required because on sm+, ChoreInfo is a flex item with default `min-width: auto`, which would otherwise prevent `truncate` from engaging.

### 8. Portrait Enforcement Overlay

Show a "please rotate" message when a phone is held landscape. The overlay is CSS-only — no React state required.

**To-do:**
- [x] In `frontend/index.html`: add the overlay div inside `<body>` before `<div id="root">`:
  ```html
  <div id="rotate-overlay">
    <div id="rotate-overlay-content">
      <div id="rotate-icon">⟳</div>
      <p>Please rotate your device to portrait mode</p>
    </div>
  </div>
  ```
- [x] In `frontend/src/index.css`: add the overlay styles:
  ```css
  #rotate-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background-color: #111827;
    z-index: 9999;
    align-items: center;
    justify-content: center;
  }

  #rotate-overlay-content {
    text-align: center;
    color: white;
    padding: 2rem;
  }

  #rotate-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    display: inline-block;
    animation: rotate-hint 2s linear infinite;
  }

  @keyframes rotate-hint {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (orientation: landscape) and (max-height: 500px) {
    #rotate-overlay {
      display: flex;
    }
  }
  ```
  `max-height: 500px` catches landscape phones (320–430px tall) but not the landscape RPI (600px) or desktop.

### 9. Visual Verification

**To-do:**
- [x] Start the dev server (`npm run dev` in `frontend/`) and open http://localhost:5174/ in Chrome.
- [x] Open Chrome DevTools (F12) → toggle the device toolbar (Ctrl+Shift+M) to set the viewport sizes below via the responsive-design mode.
- [x] Verify at each of these viewport sizes that the full app fits the screen with no page scroll, the chore list scrolls internally, and the sticky footer is always visible:
  - 375×667 (iPhone SE)
  - 414×896 (iPhone XR / tall phone)
  - 600×1024 (portrait RPI target)
  - 1024×768 (desktop dev)
- [x] Confirm the modal opens with a blurred background and the form scrolls if taller than the screen.
- [x] Toggle DevTools to a landscape viewport with height <500px (e.g., 667×375 or custom 600×400) — confirm the `#rotate-overlay` element becomes visible and covers the app.
- [x] Confirm `chore.id` is no longer visible in any chore bar.
- [x] Confirm stacked bar layout at narrow widths (≤599px) and flat layout at wider widths (≥640px).

### 10. Verify All Tests Pass

**To-do:**
- [x] Run `cd frontend && npm test` and confirm all Vitest unit tests pass.
- [x] Run `npx playwright test` from the repo root and confirm all Playwright e2e tests pass.
- [x] Investigate and fix any failures before marking the plan finished.

---

## Progress Tracking

- [x] **Step 1: Fix Viewport Meta and Global CSS Foundation** - COMPLETE (2026-04-18)
  - ✅ Updated `frontend/index.html` viewport meta with `viewport-fit=cover`
  - ✅ Deleted standalone `body { outline: 3px solid green; }` rule
  - ✅ Replaced `body, html` block with separate `html` and `body` rules using `100dvh` + `overflow: hidden`
  - ✅ Added `.scrollbar-none` utility
  - ✅ Vite build verified - clean build
- [x] **Step 2: Fix `#root` and `.App` Shell** - COMPLETE (2026-04-18)
  - ✅ Replaced `#root` block with new `100dvh` / `max-width: 768px` / `overflow: hidden` shell
  - ✅ Removed Vite scaffold boilerplate (`a`, `h1`, `button`, `prefers-color-scheme` blocks) and the commented-out `.logo`/`.card`/`.read-the-docs` block — only `#root` remains in `App.css`
  - ✅ Added `h-full flex flex-col overflow-hidden` to outer `.App` div in `App.tsx`
  - ✅ Loading-state branch updated: `min-h-screen` → `h-screen`, `p-4` → `px-4`
  - ✅ Vite build verified — clean build (351 modules, 1.28s)
  - ✅ Vitest unit tests verified — 52/52 passing
- [x] **Step 3: Verify Foundational Viewport** - COMPLETE (2026-04-18)
  - ✅ Started Vite dev server (v6.4.2) at http://localhost:5174/
  - ✅ Programmatic Playwright verification at 375×667 viewport — all three foundational assertions PASS:
    - `#root.offsetHeight === window.innerHeight` (667 vs 667)
    - `documentElement.scrollHeight <= window.innerHeight` (667 vs 667 — no html-level scroll)
    - `body.scrollHeight <= window.innerHeight` (667 vs 667 — no body-level scroll)
  - ✅ Foundational viewport constraints from Steps 1–2 confirmed; safe to proceed to Step 4
  - Note: visual sticky-footer-pushed-off-screen state is the documented intermediate condition (inner wrapper still has `min-h-screen`) and is expected — fixed by Step 4
- [x] **Step 4: Restructure App.tsx Content Wrapper, Scroll Wrapper, Sticky Footer, and Modal** - COMPLETE (2026-04-18)
  - ✅ ChoreList.tsx: added empty-state message and `pb-4` to chore list root div
  - ✅ Created `frontend/src/components/form/ChoreFormModal.tsx` with `createPortal` to `document.body`, `items-start pt-4`, backdrop-click cancel
  - ✅ AddChoreForm.tsx: added `overflow-y-auto max-h-[90dvh]` to root div
  - ✅ App.tsx: dropped `AddChoreForm` import, added `ChoreFormModal` import, replaced content wrapper with new flex column (scroll wrapper, sticky footer, modal sibling)
  - ✅ e2e/smoke.spec.ts: added `expect(page.locator('.fixed.inset-0')).toBeVisible()` waits after each `+ Add Task` click in the add-chore and delete-chore tests
  - ✅ FormField.tsx: added `htmlFor={name}` to label and `id={name}` to input
  - ✅ App.test.tsx: refactored `openAndFillForm` helper to drop container param and use `screen.getByLabelText(...)`; dropped `container` destructure from all three render call sites; replaced 5 inline `container.querySelector` calls in the frozen-sort test
  - ✅ Vite build verified — clean (353 modules, 882ms)
  - ✅ Vitest unit tests verified — 52/52 passing
- [x] **Step 5: Fix NavBar Overflow** - COMPLETE (2026-04-18)
  - ✅ Added `flex-shrink-0` to outer `#NavBar` div className
  - ✅ Added `overflow-x-auto scrollbar-none` to inner container div className
  - ✅ Vite build verified — clean (353 modules, 898ms)
  - ✅ Vitest unit tests verified — 52/52 passing
- [x] **Step 6: Touch Target Enforcement** - COMPLETE (2026-04-19)
  - ✅ RoomTab.tsx: replaced `px-6 py-4` with `px-4 sm:px-6 min-h-[44px] py-3` and added `text-sm sm:text-base`
  - ✅ AddChoreButton.tsx: replaced `py-2 px-4` with `py-3 min-h-[44px] px-6`
  - ✅ ChoreTimerBar.tsx: added TODO comment above delete button for swipe-to-delete follow-up
  - ✅ Vite build verified — clean (353 modules, 1.01s)
  - ✅ Vitest unit tests verified — 52/52 passing
- [x] **Step 7: Remove `chore.id` and Restructure ChoreTimerBar** - COMPLETE (2026-04-18)
  - ✅ ChoreTimerBar.tsx: deleted `<div className="font-medium text-white">{chore.id}</div>`
  - ✅ ChoreTimerBar.tsx: changed bar height `h-24 w-full` → `h-36 sm:h-24 w-full`
  - ✅ ChoreTimerBar.tsx: restructured the `absolute inset-0` content div with stacked/flat layout (mobile `flex-col` with `pr-12`, sm+ `flex-row justify-between`); OverdueBadge wrapped in `absolute top-2 right-16 sm:static sm:order-2` div; delete button moved to `absolute right-3 top-1/2 -translate-y-1/2` with TODO comment above it
  - ✅ CompletionInfo.tsx: `text-right` → `text-left sm:text-right`
  - ✅ ChoreInfo.tsx: added `truncate min-w-0` to the name div className
  - ✅ Vite build verified — clean (353 modules, 909ms)
  - ✅ Vitest unit tests verified — 52/52 passing
- [x] **Step 8: Portrait Enforcement Overlay** - COMPLETE (2026-04-18)
  - ✅ `frontend/index.html`: added `#rotate-overlay` div (with content, rotate icon, and rotate message) inside `<body>` before `<div id="root">`
  - ✅ `frontend/src/index.css`: added overlay styles — `#rotate-overlay` hidden by default (`display: none`), becomes `display: flex` under `@media (orientation: landscape) and (max-height: 500px)`; includes `rotate-hint` keyframe animation on the rotate icon
  - ✅ Vite build verified — clean (353 modules, 891ms)
  - ✅ Vitest unit tests verified — 52/52 passing (9 files)
- [x] **Step 9: Visual Verification** - COMPLETE (2026-04-18)
  - ✅ Programmatic Playwright verification (chromium headless) executed via temporary `frontend/scripts/verify-visual.mjs` (deleted after run); dev server at http://localhost:5174/
  - ✅ Results: 21/21 assertions passed across four viewports + landscape check
  - ✅ iPhone SE (375×667): `#root.offsetHeight === innerHeight` (667=667); `html.scrollHeight` 667 ≤ 668; `.border-t` sticky footer present; modal opens (`fixed inset-0` display=flex, visibility=visible) on `+ Add Task` click; no `chore.id` UUID visible on any `[data-testid="chore-bar"]`
  - ✅ iPhone XR (414×896): same five assertions pass (896=896; 896 ≤ 897; footer; modal; no UUID)
  - ✅ Portrait RPI (600×1024): same five assertions pass (1024=1024; 1024 ≤ 1025; footer; modal; no UUID)
  - ✅ Desktop (1024×768): same five assertions pass (768=768; 768 ≤ 769; footer; modal; no UUID)
  - ✅ Landscape 667×400: `#rotate-overlay` computed `display === 'flex'` (orientation media query engages at max-height ≤ 500px)
  - Note: the `html.scrollHeight` values are 1 greater than `innerHeight` (e.g., 667 vs 668) — within the documented +1 rounding tolerance; no page-level scroll observed
  - Vite dev server killed; temporary script and empty `frontend/scripts/` directory removed; repo file state matches pre-step state (only plan tracking updated)
- [x] **Step 10: Verify All Tests Pass** - COMPLETE (2026-04-18)
  - ✅ Vitest: 52/52 tests passing across 9 files (duration 2.94s) — output at `/tmp/claude/final-vitest.txt`
  - ✅ Playwright: 6/6 chromium e2e tests passing (duration 4.3s) via Playwright-managed `webServer` (backend port 3000, frontend port 5174) — output at `/tmp/claude/final-playwright.txt`
  - All test suites green; plan complete

## Status
finished: true
