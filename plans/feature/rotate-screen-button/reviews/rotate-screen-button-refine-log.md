# Refinement Log: rotate-screen-button

## Run — 2026-06-28

### Summary Table

| Pass | Critical | Major | Minor | Items Applied | Converged? |
|------|----------|-------|-------|---------------|------------|
| 1    | 1        | 8     | 11    | 20            | No |
| 2    | 1        | 3     | 4     | 8             | No |
| 3    | 3        | 3     | 4     | 7 of 10 (curated) | No (max reached) |
| 4    | 0        | 0     | 2     | 2             | **Yes** |
| 5    | 0        | 0     | 2     | 2             | **Yes** |

**Pass 5 (2026-06-28, after DD-5 revision to a settings panel):** DD-5 was revised
from a bare NavBar rotate button to a `SettingsPanel` (gear↔X toggle expanding into
an overlaid single-row banner; rotate functional, five disconnected optimistic
placeholders — brightness/screen-blank/restart/undo/redo — logged in
`plans/ledger/260628_future_feature_list.md`). Re-reviewed the new panel surface.
**Converged: 0 critical, 0 major, 2 minor** — both applied: (1) recorded the
intentional optimistic-placeholder a11y tradeoff with a documented `aria-disabled`
fallback; (2) added an overflow-clip caveat (verify banner un-clipped on the real
1024×600 panel; fall back to a React portal if clipped). lucide-react icons all
verified to exist; e2e/App.test correctly account for rotate being hidden until the
panel opens.

**Pass 4 (2026-06-28, separate run after rebase):** Re-run on the corrected
`deploy/pi-display-configs` branch (rebased onto `main`+#20, so all `deploy/pi/*`
files are present). **Converged: 0 critical, 0 major, 2 minor** — both minors were
mechanical wording fixes (repo-root `.gitkeep` path; anchor the kanshi `sed` to the
`output` line) and were applied. This validates the Pass-3 curation: none of the 3
rejected "criticals" reappeared once the reviewer could see the real files. The plan
is now review-complete and ready for implementation (after its PR-#19 prerequisite).

**Final disposition (applied 2026-06-28 after user review):** Passes 1–2 applied
cleanly (28 items). For Pass 3, the **7 branch-independent items were APPLIED** and
the **3 branch-context-artifact "criticals" were REJECTED/REFRAMED** — see the
"Apply disposition" block and per-item `[APPLIED]`/`[REJECTED]`/`[REFRAMED]` tags in
`reviews/rotate-screen-button-review.md`. A new `## Prerequisites` section in the
plan now records the real dependency (PR #19 must merge first) and the
"confirm-upright-on-Pi / don't hardcode orientation twice" safeguard.

**Outcome**: Hit max iterations (3 passes). Passes 1–2 applied cleanly (28 items).
Pass 3 was initially HELD (not auto-applied) because the working branch had been switched to
`chore/plans-housekeeping`, which does NOT contain the `deploy/pi/display/*` +
`deploy/pi/README.md` + `install-display-config.sh` artifacts (those live on the
unmerged `deploy/pi-display-configs` branch / PR #19). The Pass-3 reviewer read the
working tree and drew 3 "critical" conclusions that are branch-context artifacts,
not real plan defects:
  - "deploy/pi files don't exist" — true on this branch only; they exist on PR #19.
    Real fix: add a prerequisite note that this feature depends on PR #19 merging.
  - "Drop the DZX Z3 description-matching premise" — REJECT; contradicts the
    committed, user-corrected kanshi-config (kanshi matches by description;
    wlr-randr uses connector name — the plan already distinguishes these correctly).
  - "Revert shipped transform 90 → 270 to match AS-BUILT" — REJECT; 270 was
    confirmed upside-down by the user; 90 is the deliberate live fix. Real lesson:
    the plan/agent should READ the orientation from the live kanshi-config rather
    than hardcode it, and the upright value must be confirmed on the Pi.

The remaining ~7 Pass-3 items ARE branch-independent and valid (see review file
Pass 3 To-Do): `pi`→`rmilarachi` user naming, `vi.doUnmock` over `resetModules`,
Failure-test `not.toBeDisabled()`, e2e `route.fulfill` success:false body,
`choreApi.ts` dead `ApiResponse` import, `./chores-rotation` ownership guard,
DD-8 overlay-rationale correction.

### Design Questions Deferred

None persisted (the tmp design-questions file did not survive the mid-run branch
switch); Pass 1–2 decisions were folded directly into the plan and review docs.
