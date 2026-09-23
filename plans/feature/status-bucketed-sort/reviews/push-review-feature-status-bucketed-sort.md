# Push Review: feature/status-bucketed-sort

## Review 1
Generated: 2026-09-22
Comparison: origin/main...HEAD
Verdict: **PUSHED WITH MINOR FINDINGS**

### Results by Reviewer

#### 1. Safety & Security — PASS
Pure frontend sort/classification logic; no DOM, network, SQL, shell or secrets surface.

#### 2. Correctness — PASS
Bucket → rank → quota-fill → escalation traced against the F16 spec and the test suite's worked examples; no off-by-one or division-by-zero.

#### 3. Simplicity & Conciseness — PASS
- minor: `computeBar` recomputes `remainingRatio`, which `classifyStatus` already computes (`frontend/src/utils/choreBarMath.ts` ≈L18–23).

#### 4. Test Coverage — PASS
- minor (optional): no e2e assertion on fold order; unit coverage is deep, not blocking.

#### 5. Completeness & Cleanup — PASS
No debug code, TODOs or stubs; comments verified accurate against App.tsx.

#### 6. Consistency & Style — PASS
- minor: `.gitignore` `graphify-out/*` sits under the unrelated "Claude Code files" comment block.
- minor: single-letter callback `s` in `classifyStatus`'s `statusColors.find(s => …)`.

#### 7. Integration Risk — PASS
`orderChores` / `computeBar` signatures and return shapes unchanged; `StatusColor` is module-local (no action needed).

#### 8. Error Handling & Silent Failures — PASS
No catches, async or new fallbacks; the relocated `??` fallback is invariant-guarded.

#### 9. Type Design — PASS
- minor: `statusColors`' "last threshold is -Infinity / descending" invariant is comment-only.

### To-Do: Required Changes

- [ ] **Compute `remainingRatio` once** — `frontend/src/utils/choreBarMath.ts` — extract a small `remainingRatioOf(daysSince, frequency)` helper used by both `classifyStatus` and `computeBar` (or have `classifyStatus` return it) so the formula can't drift.
- [ ] **Rename single-letter callback** — `frontend/src/utils/choreBarMath.ts` `classifyStatus` — `statusColors.find(s => …)` → `statusColors.find(entry => remainingRatio > entry.threshold)`.
- [ ] **Pin the `statusColors` invariant in a test** — `frontend/src/__tests__/components/ChoreTimerBar.barMath.test.ts` — assert `statusColors.at(-1)?.threshold === -Infinity` and thresholds strictly descending.
- [ ] **Give `graphify-out/*` its own comment** — `.gitignore` — add `# graphify — generated knowledge-graph output` above the entry (or move it to a fitting section).
- [ ] **(Optional) e2e fold-order assertion** — `e2e/smoke.spec.ts` — only if unit/browser behaviour is later seen to drift.
