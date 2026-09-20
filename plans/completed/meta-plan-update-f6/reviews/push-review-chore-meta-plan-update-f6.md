# Push Review: chore/meta-plan-update-f6

## Review 1
Generated: 2026-09-20 12:55
Comparison: origin/main (1c63e0a)...HEAD (8913b09)
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
No secrets; the LAN IP/hostname already appear in `deploy/pi/README.md` and prior META-PLAN text.

#### 2. Correctness — PASS
Every claim checked against the merged tree and the decision record (PR/SHA, `[1/4]`→`[3/4]` order, paths, mode, caveats, deployment fact).

#### 3. Simplicity & Conciseness — PASS
- minor — Standing invariant 13 restates much of the Baseline *Deployment / LAN name* paragraph (the same shape as invariants 11/12 vs their Baseline paragraphs — accepted).
- minor — the Baseline paragraph's client caveats duplicate `deploy/pi/README.md` § LAN name; kept as the one-paragraph summary a future session reads without leaving the file.
- minor — the closing "data.db migrated to 7 columns" deployment fact is F4-related; left beside the F6 redeploy fact that established it.

#### 4. Test Coverage — PASS

#### 5. Completeness & Cleanup — PASS
- minor — cleanup-note lead sentence still said "two merged features … as of the F5 fold-back" — **fixed before push** ("three … as of the 2026-09-20 F6 fold-back").
- minor — Vitest counts anchored "as of #39" — **fixed** ("as of #43 — #43 added no tests").

#### 6. Consistency & Style — PASS
- minor — Baseline paragraph label form — **fixed** to `**Label** (…):` like its siblings.
- minor — hard-wrapped vs the section's single-line paragraphs — left as-is (the section mixes both; a future re-wrap pass can normalise).
- minor — F15 heading lacked the ★FOCUS marker its predecessor carried — **fixed** (`· ★ FOCUS — gated ·`).
- minor — `c4i / c4i.local` vs `c4i.local / c4i` ordering — **fixed** to `c4i.local / c4i` throughout the new text.

#### 7. Integration Risk — PASS
`/run-feature`'s ledger grep, `★FOCUS` marker and `/compact-plans`'s cleanup note all still parse.
- minor — cleanup-note count/date (as Completeness) — **fixed**.
- minor — F15's *Assumed starting state* bullets check only Phase 1, not the Phase 2 parity gate; the gate is stated in Dependencies / Open risks / the focus-path text. Optional follow-up: add an explicit gate bullet.

#### 8. Error Handling & Silent Failures — PASS

### To-Do: Required Changes

- [x] **Update the cleanup-note lead sentence** — `plans/META-PLAN.md` — three features, dated 2026-09-20.
- [x] **Re-anchor the Vitest counts** — `plans/META-PLAN.md` Tests bullet.
- [x] **Add the ★FOCUS marker to F15's heading** — `plans/META-PLAN.md`.
- [x] **Canonicalise `c4i.local / c4i` ordering and the Baseline paragraph label form** — `plans/META-PLAN.md`.
- [ ] **(Optional) Add an explicit Phase-2-parity gate bullet to F15's Assumed starting state** — `plans/META-PLAN.md` F15 section.
- [ ] **(Optional) Trim Standing invariant 13's redeploy sentence to a cross-reference** — `plans/META-PLAN.md`.
