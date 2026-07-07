> **STATUS: Merged** `4b6028f` (#23). Frozen — historical record, do not edit.
> **Outcome:** Shipped as planned, matching the 260630 ledger's item 6. Reversed F5's swipe
> mapping (swipe-left → edit, swipe-right → delete, was left=delete/right=edit) and added a
> controlled swipe offset that reveals a behind-the-bar action layer as the user swipes:
> yellow background + white-outline pencil for edit-left, red background + white-outline
> trash for delete-right, with the reveal colour fading in progressively toward a
> **25%-of-bar-width** confirm threshold (added in a follow-up commit after the initial
> direction-swap landed). Below threshold, the bar spring-backs to rest on release. F5's
> swipe infrastructure (spread-before-explicit-props order, `touch-pan-y`, `isSimulating`
> guard, `swipingRef` click-suppression, tap-to-complete) was preserved throughout. The e2e
> `swipeBar` helper's direction expectations were flipped to match.
>
> **No original plan body was preserved for this feature** — only its `reviews/` survived
> to this archive pass; the plan-body `.md` this file replaces was never committed. See
> `git log --oneline 8144da4..4b6028f` / PR #23 for the actual diff, and
> `plans/META-PLAN.md`'s `F10-L` completed-features entry for the maintained summary.
>
> Two minor push-review findings were deferred and harvested into
> `plans/PUSH-REVIEW-FINDINGS.md` during the 2026-07-07 `/compact-plans` sweep.

# F10-L — Swap swipe directions + 25% action-reveal (frozen archive record)

This plan's original body was not committed to the repository before the feature branch was
pruned. The authoritative record of what shipped is the freeze header above, the merged diff
at `4b6028f` (PR #23), and `plans/META-PLAN.md`.
