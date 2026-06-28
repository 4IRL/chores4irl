> **STATUS: Merged** `06e0b00` (#15). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned. `ChoreForm` (default export, `frontend/src/components/form/
> ChoreForm.tsx`) is shared between add/edit via `mode` + `initialChore` props; edit persists
> through `PUT /api/chores/:id` and the `updateChore(id, chore)` client. **This contract is a
> dependency for F1/F3** — preserve the prop + endpoint shape. See git for the actual diff.

# F2 — Edit Task functionality

## Summary

Let a user edit an existing chore: a `lucide-react` pencil button on each `ChoreTimerBar`
opens a pre-populated modal styled like the Add Task form; on **Save** the changes persist
via a new `PUT /api/chores/:id` endpoint and reflect in the list. This introduces the
general update endpoint, the `updateChore` API client, and a **shared add/edit form**
(`ChoreForm`) that later features (F5 swipe-right-to-edit, F3 room typeahead, F1 field
removal) build on. Per the META-PLAN shortest-path strategy, the *Details* and *Long-term
task* fields are **kept** here (F1 removes them later).

## Research Findings

- **Mirror, don't invent.** Every layer has an exact precedent: `updateChore` (data) mirrors `createChore`'s param binding + `completeChore`'s `result.changes === 0 → null` sentinel; the `PUT` route mirrors POST validation + the PATCH `:id` route's id-parse/404; `choreApi.updateChore` mirrors `addChore` + the `/api/chores/${id}` URL; `handleEditChore` mirrors `handleCompleteChore`'s optimistic-update-in-place + rollback.
- **Shared form mechanics.** `AddChoreForm.tsx` keeps a string-based local `FormState` (all strings + `longTermTask: boolean`), maps it to `Omit<Chore,'id'>` in `handleSubmit`, hard-codes heading `'Add New Chore'` and button `'Save'`, and resets to `initialFormState` after submit. Edit mode needs: derive `FormState` **from** an existing `Chore` (inverse transforms: `details ?? ''`, `dateLastCompleted.toISOString().slice(0,10)`, `String(duration)`, `urgency ?? ''`, `longTermTask ?? false`), dynamic heading/button copy, and skip the post-submit reset in edit mode. Its **only importer is `ChoreFormModal`**, so it is safe to rename to `ChoreForm`.
- **The form never needs the id.** App already knows which chore is being edited (via editing-id state), so the modal/form can keep emitting `Omit<Chore,'id'>`; App's `handleEditChore` closure supplies the id. No id threading into the form.
- **Prop-drilling for the pencil:** `App → ChoreList → ChoreTimerBar`. A new `onEdit` callback threads the same three layers as `onDelete`. Make `onEdit` **optional** on `ChoreTimerBar`/`ChoreList` props so the 11 existing `ChoreTimerBar.test.tsx` renders + `ChoreList.test.tsx` renders still compile without edits.
- **Two gotchas that silently break things:** (1) `App.test.tsx`'s `vi.mock('../services/choreApi', ...)` factory must add `updateChore: vi.fn()` or `App` receives `undefined`. (2) `app.ts`'s CORS `Access-Control-Allow-Methods` must add `PUT`.
- **Conventions:** backend ESM relative imports carry a `.js` extension; backend returns `ChoreWire` (ISO-string date), frontend `parseChore` converts to `Date`; success is driven by the JSON `{success}` envelope, not HTTP status; `PUT` returns **200** (an update, not a creation — POST's 201 is create-only); sort order (`sortedIds`) is intentionally **not** re-run on a field change (mirror `handleCompleteChore`); e2e runs against **real seed data**, so edit-e2e must add a throwaway chore and clean it up in `finally`.

## Decisions (locked from the META-PLAN F2 contract + research)

1. **Route: `PUT /api/chores/:id`** (full replace of editable fields), returning **200** with the updated chore; **404** `'Chore not found'` when missing, **400** `'Invalid id'` / `'Missing required fields'`, **500** `'Failed to update chore'`.
2. **`dateLastCompleted` stays editable** in edit mode (parity with Add).
3. **Shared form = single component** `ChoreForm` (renamed from `AddChoreForm`) with props `{ mode?: 'add' | 'edit'; initialChore?: Chore; onSubmit: (chore: Omit<Chore,'id'>) => void; onCancel: () => void }`. Default `mode='add'`. **Exported name `ChoreForm` (default export) is the F3/F1 target — recorded here and in code.**
4. **Heading/submit copy:** add → `'Add New Chore'` / button `'Save'`; edit → `'Edit Chore'` / button `'Save Changes'`. (Add-mode button stays exactly `'Save'` so existing add tests/selectors are unaffected; `/save/i` e2e matches both.)
5. **Keep `details` + `longTermTask`** fields and their full data path (F1 removes them later — do **not** pre-emptively drop).
6. **Edit is allowed during date-simulation** (mirrors the delete button, which stays clickable via `pointer-events-auto`); `handleEditChore` carries **no** `isSimulating` guard.
7. **`sortedIds` is not re-sorted on edit** (mirror `handleCompleteChore`); position updates on next re-sort/reload. Only `choreData` is touched.
8. **Interim pencil button + `✕` delete button are both removed in F6** once swipe (F5) supplies these actions.

## Steps

> TDD throughout: write the failing test (Red), implement the minimum to pass (Green),
> refactor (stay Green). Backend commands: `npm run test --workspace backend`. Frontend:
> `npm run test --workspace frontend`. E2E: `npm run test:e2e` (Playwright auto-boots the
> dev servers). Backend ESM imports use the `.js` extension.

### 1. Backend data layer — `updateChore` in `chores.ts`

Add the full-row UPDATE function mirroring `createChore`'s binding + `completeChore`'s null sentinel.

**To-do:**
- [x] **Red:** In `backend/src/__tests__/chores.test.ts`, add `describe('updateChore')` (mirror `completeChore` block, ~L63-78). Tests:
  - "updates all editable fields and returns the updated row": raw-`db.exec` INSERT a row (`name 'Sweep', room 'Kitchen', date_last_completed '2025-01-01T00:00:00.000Z', duration 10, frequency 7, long_term_task 0`), `SELECT id`, call `updateChore(id, { name: 'Mop', details: 'edited', room: 'Bathroom', dateLastCompleted: new Date('2025-02-02T00:00:00.000Z'), duration: 20, frequency: 14, urgency: 'high', longTermTask: true })`; assert returned `ChoreWire` has `name 'Mop'`, `details 'edited'`, `room 'Bathroom'`, `dateLastCompleted '2025-02-02T00:00:00.000Z'` (ISO **string**), `duration 20`, `frequency 14`, `urgency 'high'`, `longTermTask true`, and `id === id`.
  - "clears optional fields when omitted": seed a row with `details`/`urgency`/`long_term_task` set, call `updateChore(id, {name, room, dateLastCompleted: new Date(...), duration, frequency})` (no optionals); assert returned `details` is `null`, `urgency` is `undefined`, `longTermTask` is `undefined` (full-replace semantics; mirrors `rowToChore` mapping).
  - "a no-op save (identical values) still returns the row, not null": seed a row, call `updateChore(id, {<the exact same field values>})`; assert the result is **non-null** and `id === id`. (Regression guard: better-sqlite3's `changes` counts rows *matched* by the `WHERE`, not rows whose values differ, so an identical-value UPDATE returns `changes === 1` — confirmed empirically. This locks the "open Edit → Save unchanged → no false 404" UX behavior against a future driver/version change.)
  - "returns null when the id does not exist": `expect(updateChore(9999, {<valid input>})).toBeNull()`.
  - Import `updateChore` from `'../chores.js'` in the test's import line.
- [x] Run `npm run test --workspace backend` → confirm the new tests **fail** (`updateChore` is not exported).
- [x] **Green:** In `backend/src/chores.ts`, add (after `completeChore`, before/after `deleteChore`):
  ```ts
  export function updateChore(id: number, input: Omit<Chore, 'id'>): ChoreWire | null {
      const result = db.prepare(`
          UPDATE chores
          SET name = @name, details = @details, room = @room,
              date_last_completed = @date_last_completed, duration = @duration,
              frequency = @frequency, urgency = @urgency, long_term_task = @long_term_task
          WHERE id = @id
      `).run({
          id,
          name: input.name,
          details: input.details ?? null,
          room: input.room,
          date_last_completed: input.dateLastCompleted instanceof Date
              ? input.dateLastCompleted.toISOString()
              : String(input.dateLastCompleted),
          duration: input.duration,
          frequency: input.frequency,
          urgency: input.urgency ?? null,
          long_term_task: input.longTermTask ? 1 : 0,
      });
      if (result.changes === 0) return null;
      return rowToChore(db.prepare('SELECT * FROM chores WHERE id = ?').get(id) as ChoreRow);
  }
  ```
  (Reuses `createChore`'s camel→snake value mapping verbatim and `completeChore`'s `changes === 0 → null` + re-SELECT pattern. `ChoreRow`, `ChoreWire`, `rowToChore`, `db` already exist in this file.)
- [x] Run `npm run test --workspace backend` → confirm the `updateChore` tests **pass**.

### 2. Backend route — `PUT /api/chores/:id` in `app.ts`

Add the route mirroring POST validation + the PATCH `:id` route's id-parse/404, plus the CORS `PUT` method.

**To-do:**
- [x] **Red:** In `backend/src/__tests__/routes.test.ts`, add `describe('PUT /api/chores/:id')` (mirror the PATCH `.../complete` block, ~L52-82). Tests (use the existing `BASE_CHORE` const + `request(app)`):
  - "returns 200 with the updated chore": POST `BASE_CHORE` → capture `id`; `await request(app).put(\`/api/chores/${id}\`).send({ ...BASE_CHORE, name: 'Mop', room: 'Bathroom' })`; assert `res.status === 200`, `res.body.success === true`, `res.body.data.name === 'Mop'`, `res.body.data.room === 'Bathroom'`, `res.body.data.id === id`.
  - "returns 404 when chore does not exist": `put('/api/chores/9999').send(BASE_CHORE)` → `res.status === 404`.
  - "returns 400 when required fields are missing": `put('/api/chores/1').send({ name: 'Only name' })` → `res.status === 400`, `res.body.success === false`.
  - "returns 400 when id is not a number": `put('/api/chores/abc').send(BASE_CHORE)` → `res.status === 400`.
- [x] Run `npm run test --workspace backend` → confirm the new route tests **fail** (no PUT route → 404 from Express for the success/400-validation cases).
- [x] **Green — `backend/src/app.ts`:**
  - Add `updateChore` to the service import on line 2: `import { getAllChores, createChore, completeChore, deleteChore, updateChore } from './chores.js';`
  - Add `PUT` to the CORS allow-methods header (line 8): `res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');`
  - Register the route (place after the POST handler, e.g. before/after the PATCH route — method+path is distinct from `/:id/complete`, no ordering conflict):
    ```ts
    app.put('/api/chores/:id', (req, res) => {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ success: false, error: 'Invalid id' } satisfies ApiResponse<never>);
        }
        const body = req.body as Omit<Chore, 'id'>;
        if (!body.name || !body.room || !body.dateLastCompleted || body.duration == null || body.frequency == null) {
            return res.status(400).json({ success: false, error: 'Missing required fields' } satisfies ApiResponse<never>);
        }
        try {
            const data = updateChore(id, body);
            if (!data) {
                return res.status(404).json({ success: false, error: 'Chore not found' } satisfies ApiResponse<never>);
            }
            return res.json({ success: true, data } satisfies ApiResponse<typeof data>);
        } catch {
            return res.status(500).json({ success: false, error: 'Failed to update chore' } satisfies ApiResponse<never>);
        }
    });
    ```
- [x] Run `npm run test --workspace backend` → confirm all backend tests (including the new PUT block) **pass**.

### 3. Frontend API client — `updateChore` in `choreApi.ts`

Add the `PUT` client mirroring `addChore`'s serialization and the `/api/chores/${id}` URL.

**To-do:**
- [x] **Red:** In `frontend/src/__tests__/services/choreApi.test.ts`, import `updateChore` (add to line 2 import) and add `describe('updateChore')` (mirror the `addChore` block ~L46-69 + `completeChore` URL/method assertions):
  - "sends PUT with ISO date string and returns parsed Chore": `mockFetch.mockReturnValue(mockResponse(WIRE_CHORE))`; call `updateChore(1, { name:'Sweep', room:'Kitchen', dateLastCompleted: new Date('2025-01-01T00:00:00.000Z'), duration:10, frequency:7 })`; assert `result.dateLastCompleted` is `instanceof Date`; inspect `mockFetch.mock.calls[0]`: `call[0] === '/api/chores/1'`, `call[1].method === 'PUT'`, `JSON.parse(call[1].body).dateLastCompleted === '2025-01-01T00:00:00.000Z'`.
  - "throws when API returns success: false": `mockFetch.mockReturnValue(mockErrorResponse('Validation error'))`; `await expect(updateChore(1, {<valid input>})).rejects.toThrow('Validation error')`.
- [x] Run `npm run test --workspace frontend` → confirm the new service tests **fail**.
- [x] **Green — `frontend/src/services/choreApi.ts`**, add (mirror `addChore`):
  ```ts
  export async function updateChore(id: number, chore: Omit<Chore, 'id'>): Promise<Chore> {
      const res = await fetch(`/api/chores/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              ...chore,
              dateLastCompleted: chore.dateLastCompleted instanceof Date
                  ? chore.dateLastCompleted.toISOString()
                  : chore.dateLastCompleted,
          }),
      });
      return parseChore(await handleResponse<ChoreWire>(res));
  }
  ```
  (`parseChore`, `handleResponse`, `ChoreWire` already defined in this file.)
- [x] Run `npm run test --workspace frontend` → confirm the `updateChore` service tests **pass**.

### 4. Shared add/edit form — rename `AddChoreForm` → `ChoreForm`, add edit mode

Generalize the single-purpose form into the shared `ChoreForm` with pre-population and dynamic copy, keeping the add flow identical for the user.

**To-do:**
- [x] **Red:** Create `frontend/src/__tests__/components/ChoreForm.test.tsx` (render via `@testing-library/react` `render`/`screen` + `userEvent`, import `ChoreForm` from `'../../components/form/ChoreForm'`, `makeChore` from `'../fixtures/chore'`). Tests:
  - "add mode renders the Add heading and empty Name": `render(<ChoreForm onSubmit={vi.fn()} onCancel={vi.fn()} />)`; assert `screen.getByText('Add New Chore')` present and `screen.getByLabelText('Name')` has value `''`.
  - "edit mode pre-populates all fields from initialChore": `render(<ChoreForm mode="edit" initialChore={makeChore({ id: 7, name: 'Mop', details: 'wet', room: 'Kitchen', dateLastCompleted: new Date('2025-03-31T00:00:00.000Z'), duration: 45, frequency: 7, urgency: 'low', longTermTask: true })} onSubmit={vi.fn()} onCancel={vi.fn()} />)`; assert `getByLabelText('Name')` → `toHaveValue('Mop')`, `getByLabelText('Details')` → `toHaveValue('wet')`, `getByLabelText('Room')` → `toHaveValue('Kitchen')`, `getByLabelText('Last Completed')` → `toHaveValue('2025-03-31')`, `getByLabelText('Duration (minutes)')` → `toHaveValue(45)`, `getByLabelText('Frequency (days)')` → `toHaveValue(7)`; assert the Long-term checkbox (`screen.getByLabelText('Long-term task')`) `toBeChecked()`; assert heading `screen.getByText('Edit Chore')` and submit button `screen.getByRole('button', { name: 'Save Changes' })`.
  - "edit submit emits the edited Omit<Chore,'id'> payload, preserving unchanged optional fields": render edit mode with `initialChore = makeChore({ id: 7, name: 'Mop', details: 'wet', room: 'Kitchen', dateLastCompleted: new Date('2025-03-31T00:00:00.000Z'), duration: 45, frequency: 7, urgency: 'low', longTermTask: true })` and `onSubmit = vi.fn()`; `await user.clear(getByLabelText('Name'))` then `await user.type(getByLabelText('Name'), 'Mopped')`; click `getByRole('button', { name: 'Save Changes' })`; assert `onSubmit` called once with an object where `name === 'Mopped'`, `room === 'Kitchen'`, `dateLastCompleted instanceof Date`, `duration === 45`, `frequency === 7`, **and the unchanged optionals round-trip**: `details === 'wet'`, `urgency === 'low'`, `longTermTask === true` (catches a regression in `choreToFormState`'s inverse mapping / the urgency `''` sentinel), and NO `id` key.
  - (Optional, in test 2) assert urgency pre-populates: the urgency `<select>` has no `htmlFor`/`id` association so `getByLabelText` can't reach it — read it via `screen.getByRole('combobox')` and assert `toHaveValue('low')`.
- [x] Run `npm run test --workspace frontend` → confirm these **fail** (the failing file surfaces as a `Cannot find module './ChoreForm'` resolution error — expected; vitest isolates this to `ChoreForm.test.tsx` and still runs all other suites).
- [x] **Green — rename + generalize:**
  - `git mv frontend/src/components/form/AddChoreForm.tsx frontend/src/components/form/ChoreForm.tsx` (preserve history).
  - Rename the component + default export to `ChoreForm`. Update props type to:
    ```ts
    type ChoreFormProps = {
        mode?: 'add' | 'edit';
        initialChore?: Chore;
        onSubmit: (chore: Omit<Chore, 'id'>) => void;
        onCancel: () => void;
    };
    ```
    Destructure with `{ mode = 'add', initialChore, onSubmit, onCancel }`.
  - Add a pure helper that maps a `Chore` → `FormState` (inverse of `handleSubmit`):
    ```ts
    function choreToFormState(chore: Chore): FormState {
        return {
            name: chore.name,
            details: chore.details ?? '',
            room: chore.room,
            dateLastCompleted: chore.dateLastCompleted.toISOString().slice(0, 10),
            duration: String(chore.duration),
            frequency: String(chore.frequency),
            urgency: chore.urgency ?? '',
            longTermTask: chore.longTermTask ?? false,
        };
    }
    ```
  - Initialize state lazily from `initialChore`: `const [formData, setFormData] = useState<FormState>(() => initialChore ? choreToFormState(initialChore) : initialFormState);` (The edit modal mounts a fresh `ChoreForm` per edit — see Step 6 — so the lazy initializer runs once per open and is correct; no resync `useEffect` needed.)
  - Heading (currently hard-coded `'Add New Chore'`): `{mode === 'edit' ? 'Edit Chore' : 'Add New Chore'}`.
  - Submit button label (currently `'Save'`): `{mode === 'edit' ? 'Save Changes' : 'Save'}`.
  - In `handleSubmit`, gate the post-submit reset to add mode only: replace `setFormData(initialFormState);` with `if (mode === 'add') setFormData(initialFormState);`.
  - **Keep** the `details` `FormField` and the `longTermTask` checkbox and all other fields exactly as-is (F1 removes them later).
- [x] **Green — update the only importer:** in `frontend/src/components/form/ChoreFormModal.tsx`, change the import from `./AddChoreForm` to `./ChoreForm` and the JSX tag from `<AddChoreForm .../>` to `<ChoreForm .../>` (props extended in Step 5).
- [x] Run `npm run test --workspace frontend` → confirm the `ChoreForm` tests **pass** and the existing `ChoreFormModal.test.tsx` (which reaches fields by label via the modal) still **passes**.

### 5. Modal edit support — `ChoreFormModal` forwards mode + initialChore

Let the modal carry edit mode through to `ChoreForm`, reusing the same portal/backdrop; add mode is unchanged.

**To-do:**
- [x] **Red:** Extend `frontend/src/__tests__/components/ChoreFormModal.test.tsx` with: "edit mode pre-populates the form" — `render(<ChoreFormModal mode="edit" initialChore={makeChore({ name: 'Mop' })} onSubmit={vi.fn()} onCancel={vi.fn()} />)` (import `makeChore`); assert `screen.getByLabelText('Name')` `toHaveValue('Mop')` and `screen.getByText('Edit Chore')` present. (Existing add-mode backdrop tests must still pass — keep new props optional.)
- [x] Run `npm run test --workspace frontend` → confirm the new modal test **fails**.
- [x] **Green — `frontend/src/components/form/ChoreFormModal.tsx`:** extend props to:
  ```ts
  type ChoreFormModalProps = {
      mode?: 'add' | 'edit';
      initialChore?: Chore;
      onSubmit: (chore: Omit<Chore, 'id'>) => void;
      onCancel: () => void;
  };
  ```
  Destructure `{ mode, initialChore, onSubmit, onCancel }` and forward to the form: `<ChoreForm mode={mode} initialChore={initialChore} onSubmit={onSubmit} onCancel={onCancel} />`. (`Chore` is **already** imported in this file — no new import needed.) Keep the backdrop/portal markup and `data-testid="chore-modal-backdrop"` unchanged.
- [x] Run `npm run test --workspace frontend` → confirm modal tests (add + edit) **pass**.

### 6. Bar affordance + threading — pencil button on `ChoreTimerBar`, `onEdit` through `ChoreList`

Add the interim `lucide-react` pencil edit button and thread an optional `onEdit` callback `App → ChoreList → ChoreTimerBar`.

**To-do:**
- [x] **Red — `frontend/src/__tests__/components/ChoreTimerBar.test.tsx`** (mirror the delete-button tests ~L9-56): add
  - "renders the edit button with correct aria-label": render with `onEdit={vi.fn()}` (plus existing required props); assert `screen.getByRole('button', { name: 'Edit chore' })` present.
  - "calls onEdit with the chore id when the edit button is clicked": `makeChore({ id: 42 })`, `onEdit = vi.fn()`; `await user.click(screen.getByRole('button', { name: 'Edit chore' }))`; assert `onEdit` called once with `42`.
  - "edit button does not trigger onComplete (stopPropagation)": render with `onComplete` + `onEdit` spies; click the edit button; assert `onComplete` not called.
- [x] **Red — `frontend/src/__tests__/components/ChoreList.test.tsx`**: add "passes onEdit to each ChoreTimerBar" — render `ChoreList` with two chores + `onEdit` spy; `screen.getAllByRole('button', { name: 'Edit chore' })` has length 2; click the first; assert `onEdit` called with the first chore's id.
- [x] Run `npm run test --workspace frontend` → confirm these **fail**.
- [x] **Green — `frontend/src/components/chore/ChoreTimerBar.tsx`:**
  - Import the icon: `import { Pencil } from 'lucide-react';` (named-import pattern matches `DateNavigationBanner.tsx` / `ReturnToTodayButton.tsx`; `Pencil` is a valid named export in the installed `lucide-react` ^1.8.0, verified present).
  - Add `onEdit?: (id: number) => void;` to `ChoreTimerBarProps` (optional, so existing test renders compile) and accept it in the destructure.
  - Replace the single absolutely-positioned delete `<button>` with a right-side flex group holding the pencil (left) then the `✕` (right), so they don't overlap; keep `pointer-events-auto` so both stay clickable during simulation, and keep both `e.stopPropagation()` + aria-labels:
    ```tsx
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-auto">
        {onEdit && (
            <button
                className="p-1.5 bg-indigo-600 bg-opacity-80 hover:bg-indigo-500 text-white rounded-full"
                onClick={e => { e.stopPropagation(); onEdit(chore.id); }}
                aria-label="Edit chore"
            >
                <Pencil className="w-4 h-4" aria-hidden="true" />
            </button>
        )}
        {/* TODO(#10): replace edit + delete buttons with swipe gestures (F5) — removed in F6 */}
        <button
            className="px-3 py-1 bg-red-600 bg-opacity-80 hover:bg-red-500 text-white text-sm rounded-full"
            onClick={e => { e.stopPropagation(); onDelete(chore.id); }}
            aria-label="Delete chore"
        >
            ✕
        </button>
    </div>
    ```
  - Widen the content container's mobile right padding so text clears the two-button group: change `pr-12` → `pr-20` on the content `<div>` (line ~38), keeping `sm:pr-4` for now.
  - **Concrete overlap remedy (deterministic, not open-ended):** on `npm run dev`, check two interim collisions — (a) the `sm:` row layout (`sm:flex-row justify-between`) where `CompletionInfo` is right-justified: if the two-button group overlaps it, also bump the content container to **`sm:pr-20`** (currently `sm:pr-4`); (b) the mobile `OverdueBadge`, positioned `absolute top-2 right-20 sm:static` (ChoreTimerBar line ~41) — if the widened button group reaches it, nudge the badge's `right-*` (e.g. `right-28`) until clear. These are interim affordances F6 fully reflows, so a clean-enough layout is sufficient.
- [x] **Green — `frontend/src/components/chore/ChoreList.tsx`:** add `onEdit?: (id: number) => void;` to `ChoreListProps`, accept it, and forward `onEdit={onEdit}` to each `<ChoreTimerBar>`.
- [x] Run `npm run test --workspace frontend` → confirm the new bar + list tests **pass** and all prior `ChoreTimerBar`/`ChoreList` tests still **pass**.

### 7. App wiring — edit state + `handleEditChore` (optimistic + rollback)

Add editing-id state, the optimistic edit handler (mirror `handleCompleteChore`), and an edit-mode modal render; wire `onEdit` to `ChoreList`.

**To-do:**
- [x] **Red — `frontend/src/__tests__/App.test.tsx`:**
  - Add `updateChore: vi.fn()` to the `vi.mock('../services/choreApi', () => ({ ... }))` factory object, and add `updateChore` to the `import { ... } from '../services/choreApi'` line.
  - Add `describe('handleEditChore')` with a `beforeEach` mirroring `handleCompleteChore`'s/`handleDeleteChore`'s (so `App` loads before each test): `vi.mocked(fetchAllChores).mockResolvedValue([makeChore({ id: 1, name: 'Sweep', room: 'Kitchen' })])`, `vi.mocked(addChore).mockResolvedValue(makeChore())`, `vi.mocked(completeChore).mockResolvedValue(makeChore())`, `vi.mocked(removeChore).mockResolvedValue(undefined)`. (Mirror the `handleCompleteChore` optimistic/reconcile/rollback tests ~L137-194 and the `openAndFillForm` pattern ~L196-236.) Tests:
    - "opens a pre-populated edit modal from the pencil button": render `<App/>`; `await waitFor` the bar; click `screen.getByRole('button', { name: 'Edit chore' })`; assert `screen.getByText('Edit Chore')` and `screen.getByLabelText('Name')` `toHaveValue('Sweep')`.
    - "optimistically updates the chore and reconciles on success": `vi.mocked(updateChore).mockResolvedValue(makeChore({ id: 1, name: 'Sweep Edited', room: 'Kitchen' }))`; open edit modal, `clear` + `type` Name → 'Sweep Edited', click `getByRole('button', { name: 'Save Changes' })`; `await waitFor` → `screen.getByText('Sweep Edited')` present, and modal closed (`queryByText('Edit Chore')` null).
    - "rolls back and sets error when updateChore rejects": deferred-promise pattern — `let rejectEdit; vi.mocked(updateChore).mockReturnValue(new Promise((_, rej) => { rejectEdit = rej; }))`; open modal, edit Name, Save; assert optimistic text appears; `rejectEdit(new Error('Edit failed'))`; `await waitFor` → original `'Sweep'` text restored and `screen.getByText('Edit failed')` present.
    - "Cancel closes the edit modal without saving": open the edit modal from the pencil; click the form's `getByRole('button', { name: 'Cancel' })`; assert `queryByText('Edit Chore')` is null, `updateChore` was **not** called (`expect(vi.mocked(updateChore)).not.toHaveBeenCalled()`), and the original `'Sweep'` text is unchanged. (Mirrors the delete-Cancel test ~L120-134.)
    - "editing does NOT change list position (frozen sort, Decision 7)": mirror the "completing a chore does not change its list position" test (~L364-382). Seed `fetchAllChores` with two chores whose render order is deterministic (e.g. `[makeChore({ id: 1, name: 'Chore A', duration: 60 }), makeChore({ id: 2, name: 'Chore B', duration: 5 })]` — duration drives `orderChores` score); capture the rendered bar order via `getAllByTestId('chore-bar')` + `textContent` regex; `vi.mocked(updateChore).mockResolvedValue(...)` the edited chore; open the edit modal on the **second** bar and edit a sort-affecting field (e.g. set its `duration` very high so it *would* sort first); Save; `await waitFor` the optimistic text; assert the rendered order **equals the captured order** (position frozen — `sortedIds` not re-run, matching `handleCompleteChore`).
- [x] Run `npm run test --workspace frontend` → confirm the new App tests **fail**.
- [x] **Green — `frontend/src/App.tsx`:**
  - Add `updateChore` to the `import { fetchAllChores, addChore, completeChore, removeChore } from './services/choreApi';` line.
  - Add edit state near `pendingDeleteId`: `const [editingId, setEditingId] = useState<number | null>(null);`
  - Add a derived editing chore near `pendingChore`: `const editingChore = editingId !== null ? choreData.find(c => c.id === editingId) : undefined;`
  - Add handlers (mirror `handleCompleteChore` for the optimistic op; mirror the request/cancel pattern of delete). `handleRequestEdit` also clears `showForm` so the add and edit modals are mutually exclusive (cheap defensive guard — the two are gated on independent state):
    ```ts
    function handleRequestEdit(id: number) {
        setShowForm(false);
        setEditingId(id);
    }
    function handleCancelEdit() {
        setEditingId(null);
    }
    async function handleEditChore(id: number, edited: Omit<Chore, 'id'>): Promise<void> {
        const originalChore = choreData.find(chore => chore.id === id);
        if (!originalChore) return;
        setChoreData(curr => curr.map(chore => chore.id === id ? { ...originalChore, ...edited } : chore));
        setEditingId(null);
        try {
            const updated = await updateChore(id, edited);
            setChoreData(curr => curr.map(chore => chore.id === id ? updated : chore));
        } catch (err) {
            setChoreData(curr => curr.map(chore => chore.id === id ? originalChore : chore));
            setError(err instanceof Error ? err.message : 'Failed to update chore');
        }
    }
    ```
    (No `isSimulating` guard — edit is allowed during simulation, per Decision 6. `sortedIds` intentionally untouched, per Decision 7. `{ ...originalChore, ...edited }` preserves `id` while applying edits; the server `updated` reconciles afterward.)
  - Pass `onEdit={handleRequestEdit}` to the `<ChoreList ... />` render (alongside the existing `onComplete`/`onDelete`/`onRequestDelete` wiring).
  - Render the edit modal alongside the add-modal render (after `{showForm && <ChoreFormModal .../>}`); gate it on `!showForm` so the two modals never stack:
    ```tsx
    {!showForm && editingChore && (
        <ChoreFormModal
            mode="edit"
            initialChore={editingChore}
            onSubmit={edited => handleEditChore(editingChore.id, edited)}
            onCancel={handleCancelEdit}
        />
    )}
    ```
  - In the `AddChoreButton` `onClick` (`() => setShowForm(true)`), also clear any pending edit: `() => { setEditingId(null); setShowForm(true); }` — keeps the two modals mutually exclusive from both trigger directions.
- [x] Run `npm run test --workspace frontend` → confirm all App tests (new + existing) **pass**.

### 8. E2E — edit-a-chore happy path via the pencil button

Add a Playwright test mirroring the delete test, against a throwaway chore that is cleaned up.

**To-do:**
- [x] **Add to `e2e/smoke.spec.ts`** a test "edits a chore via the pencil button" (mirror the delete test ~L68-86 + the add test's cleanup loop ~L57-64):
  - Add a dedicated chore `'E2E Edit Target'` via the Add form (fill `input[name="name"|"room"|"dateLastCompleted"|"duration"|"frequency"]`, submit `button[type="submit"]` text `/save/i`), `waitForSelector('text=E2E Edit Target')`.
  - Scope to its bar: `const bar = page.locator('.bg-gray-800.rounded-full', { hasText: 'E2E Edit Target' });`
  - `await bar.locator('[aria-label="Edit chore"]').click();`
  - Assert the modal is open + pre-filled: `await expect(page.locator('input[name="name"]')).toHaveValue('E2E Edit Target');`
  - Edit and save, verifying the **real** server round-trip (not just the optimistic render): set up the response wait *before* clicking Save — `const putResponse = page.waitForResponse(r => r.url().includes('/api/chores/') && r.request().method() === 'PUT');` then `await page.fill('input[name="name"]', 'E2E Edited');` then click `button[type="submit"]` text `/save/i` (the edit button reads "Save Changes", still matches `/save/i`); `await putResponse;`.
  - `await expect(page.locator('text=E2E Edited')).toBeVisible({ timeout: 5_000 });`
  - Assert the modal closed: `await expect(page.getByTestId('chore-modal-backdrop')).not.toBeVisible();`
  - **Cleanup in `finally`:** delete every `'E2E Edited'` (and any `'E2E Edit Target'` leftover from a failed run) bar via `[aria-label="Delete chore"]` + `page.getByTestId('confirm-dialog-confirm')`, looping until count 0 (mirror the add test's cleanup) so seed data and reruns stay clean.
- [x] Run `npm run test:e2e` → confirm the new edit test **passes** and the existing smoke tests still pass.

### 9. Record the shared-form contract in the META-PLAN

Persist the cross-cutting decision so F3/F1/F5 sessions can target the shared form.

**To-do:**
- [x] In `plans/META-PLAN.md`, in the F2 section (and/or the "Cumulative invariants" list under "Chain integrity"), note the concrete exported names so later sessions don't have to rediscover them: shared form component = **`ChoreForm`** (default export, `frontend/src/components/form/ChoreForm.tsx`) with props `{ mode?: 'add'|'edit'; initialChore?: Chore; onSubmit; onCancel }`; API client = `updateChore(id, chore)`; route = `PUT /api/chores/:id`; bar callback = `onEdit?(id)`; interim button `aria-label="Edit chore"`. (The Status-ledger row was set to `in-progress` at session start and is flipped to `in-review` with the PR link after git-push.)

### 10. Verify All Tests Pass

Run the full suites to confirm nothing is broken.

**To-do:**
- [x] Run `npm run test --workspace backend` and confirm all backend (unit + route) tests pass.
- [x] Run `npm run test --workspace frontend` and confirm all frontend (component + service + App) tests pass.
- [x] Run `npm run test:e2e` and confirm all Playwright smoke tests (incl. the new edit flow) pass.
- [x] Run `npm run build` (root) to confirm the frontend + backend TypeScript both compile (catches type regressions from the form rename / prop changes).
- [x] Run `npm run lint` and fix any lint errors (e.g. unused imports left from the `AddChoreForm`→`ChoreForm` rename).
- [x] Investigate and fix any failures before marking the plan finished.

## Status
finished: true
