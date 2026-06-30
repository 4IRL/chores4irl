# Parallelization validation — F9 · F3 · F10

> **Session role.** This session validates feature independence and provisions worktrees only.
> **No feature is implemented here.** It is the gate described in META-PLAN §"Running several
> features at once" / `plans/WORKTREE-PARALLELIZE-PROMPT.md`.
>
> **Basis:** `origin/main` @ `7f0edb2` (the Baseline — F4/F2/F5/F6 + SSE #21 + Pi-config #19).
> **Date:** 2026-06-30.

## Features under test

| F-ID | Feature | Branch | Worktree |
|---|---|---|---|
| F9  | Persistent chore-name search filter | `feature/chore-search-filter`  | `/home/user/chores4irl-worktrees/F9-chore-search-filter` |
| F3  | Type-as-you-search Room dropdown    | `feature/room-typeahead`       | `/home/user/chores4irl-worktrees/F3-room-typeahead` |
| F10 | Swap swipe dirs + 25% reveal        | `feature/swipe-direction-swap` | `/home/user/chores4irl-worktrees/F10-swipe-direction-swap` |

## File touch-sets (from each feature's Expected-end-state + code verified against the tree)

**F9 — `feature/chore-search-filter`** (META-PLAN §F9)
- `frontend/src/App.tsx` — (a) new search-query state near the other `useState`s (`App.tsx:22–29`);
  (b) derive `searchFilteredChores` from `filteredChores` feeding the `orderedChores` map
  (`App.tsx:128–134`); (c) render a search `<input>` **above** the scroll region, i.e. inserted
  between `ReturnToTodayButton` (`App.tsx:257`) and `<div className="flex-1 overflow-y-auto min-h-0">`
  (`App.tsx:258`).
- **NEW** search-input component under `frontend/src/components/**` (net-new file).
- **NEW** unit tests under `frontend/src/__tests__/**` (net-new files).
- `e2e/smoke.spec.ts` — *optional only* (test-delta says "**optionally** type in the search box");
  not part of F9's binding Expected end state.

**F3 — `feature/room-typeahead`** (META-PLAN §F3)
- `frontend/src/components/form/ChoreForm.tsx` — Room `FormField` (`ChoreForm.tsx:77`) → native
  `<input list=…>` + `<datalist>`; accept a `rooms` prop.
- `frontend/src/components/form/ChoreFormModal.tsx` — thread the `rooms` prop through to `ChoreForm`
  (`ChoreFormModal.tsx:5–12, 25`).
- `frontend/src/App.tsx` — pass `rooms={uniqueRooms}` to the two `<ChoreFormModal>` render sites
  (`App.tsx:265` add-modal, `App.tsx:267–272` edit-modal). `uniqueRooms` **already exists**
  (`App.tsx:120`); no new state/derivation is added.
- Possibly `frontend/src/components/form/FormField.tsx` (datalist support) — or a sibling component.
- **NEW/updated** form unit tests under `frontend/src/__tests__/**`.
- `e2e/smoke.spec.ts` — **no change required**: the existing `page.fill('input[name="room"]', …)`
  selectors (`smoke.spec.ts:55,81,100,172,193`) keep working against a `<datalist>`-backed
  `<input name="room">`. (Test-delta lists an *optional* add-flow extension only.)

**F10 — `feature/swipe-direction-swap`** (META-PLAN §F10)
- `frontend/src/components/chore/ChoreTimerBar.tsx` — flip `onSwipedLeft→onEdit` /
  `onSwipedRight→onDelete`, add controlled offset, behind-bar reveal layer, 25%-width threshold +
  spring-back; preserve F5 infra (`ChoreTimerBar.tsx:27–49`).
- `e2e/smoke.spec.ts` — **required**: flip the `swipeBar(page, bar, 'left'|'right')` direction
  expectations and the helper (`smoke.spec.ts:90,110,143,180,202`).
- **NEW/updated** `ChoreTimerBar` unit tests under `frontend/src/__tests__/**`.

## Pairwise independence matrix

| Pair | Shared files | Verdict |
|---|---|---|
| **F9 ∩ F10** | none | ✅ disjoint file sets → **cannot** textually conflict |
| **F3 ∩ F10** | none (F3 needs no e2e; F10's e2e ≠ F3's source files) | ✅ disjoint file sets → **cannot** textually conflict |
| **F9 ∩ F3**  | `frontend/src/App.tsx` | ✅ clean — **non-adjacent regions** (see below) |

### The one shared source file: `App.tsx` (F9 ∩ F3)

- **F9 regions:** `~22–29` (state), `~128–134` (derived list), `~257–258` (insert search input above
  the scroll `<div>`).
- **F3 regions:** `265` and `267–272` (add `rooms={uniqueRooms}` to the two `<ChoreFormModal>` calls).
  F3 adds **no** top-of-component state and **reuses** the existing `uniqueRooms` (`:120`).
- **Closest approach:** F9's search-input insertion (`257–258`) vs F3's add-modal edit (`265`) — a gap
  of ~7 unchanged lines (`258–264`: scroll div / `ChoreList` / footer deck / `AddChoreButton`). A
  three-way merge (git `ort`/diff3) needs only one unchanged line between hunks to merge cleanly; here
  there are several, and none of F9's three regions overlaps F3's single region. → **Clean merge.**

### Shared-file boundaries to honor during implementation (so the proof stays true)

These features are independent **as specified**; two boundaries must be respected by the
implementing sessions, both already implied by the contracts:

1. **`App.tsx` (F9 & F3):** keep each within its documented region — F9 in the
   state/derived-list/scroll-header areas; F3 only on the two `<ChoreFormModal>` prop lists. Neither
   should re-architect the render tree near the other's region. (Both must also preserve the SSE
   re-pull gate / `reconcileChores`.)
2. **`e2e/smoke.spec.ts` (F10 owns it):** F10 **requires** edits here; F9/F3's e2e touches are
   **optional** per their test-deltas. To keep the merge textually clean, **F10 is the sole owner**
   of this file — F9/F3 should skip the optional e2e edits, or (if added) append a **new isolated
   `test(...)` block** rather than touching the `swipeBar` helper or the swipe direction assertions.

**Conclusion:** F9, F3, and F10 are **mutually independent** and their branches **will merge cleanly**
in any order, given the two boundaries above (which the contracts already imply). No required
Expected-end-state surface collides.

## Worktrees provisioned

Each is a clean, isolated checkout on its own branch off `origin/main` @ `7f0edb2`:

```
/home/user/chores4irl-worktrees/F9-chore-search-filter    feature/chore-search-filter
/home/user/chores4irl-worktrees/F3-room-typeahead         feature/room-typeahead
/home/user/chores4irl-worktrees/F10-swipe-direction-swap  feature/swipe-direction-swap
```

- Created with `git worktree add -b <branch> <path> origin/main`.
- Branches track `origin/main`; each session's first publish uses `git push -u origin <branch>`
  (creates the remote feature branch — the durable PR checkpoint).
- `node_modules` is git-ignored and **not** installed anywhere (it is absent from `main` too); each
  feature session runs `npm install` as the first step of its own Per-Feature Session Contract.
- The merge gate stays **serial**: each worktree runs its own contract (create-plan → review-plan →
  run-plan → git-commit → verify → git-push), and a human merges each PR.
