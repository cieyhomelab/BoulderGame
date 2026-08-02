<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Diggable Dirt Corridors

- **Plan**: `context/changes/diggable-dirt-corridors/plan.md`
- **Scope**: Phases 1–3 of 3 (full plan)
- **Date**: 2026-08-02
- **Verdict**: APPROVED (after triage)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | WARNING → PASS (one criterion was invalid as written; corrected in plan) |

Automated criteria re-run at review time: `npx tsc --noEmit` clean, `npm run lint` clean,
`npx playwright test` 16/16 passing, `npm run build` succeeds. All nine pre-existing guardrail
tests passed with zero edits, confirming Dirt is walkable exactly where empty floor was.

## Findings

### F1 — Plan's stated deliberate-break check could not fail

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `context/changes/diggable-dirt-corridors/plan.md` → Critical Implementation Details
- **Detail**: The plan asserted that a shallow `LEVEL_TEMPLATE.slice()` would leak a dug corridor
  into the next attempt and break the replay guardrail. Running that break left all four digging
  tests green. The claim is wrong: `withTile` is purely immutable — it clones the row it writes
  rather than mutating in place — so the template's rows are never mutated and copy depth does not
  affect attempt isolation. A success criterion that cannot fail verifies nothing.
- **Fix**: Recorded a Correction blockquote in the plan and re-ran the check against the guarantee
  the replay test actually protects: making `handleReplayClick` carry the dug board forward. That
  break *does* fail "Play again restores dug Dirt", confirming the test has teeth.
- **Decision**: FIXED

### F2 — Board `aria-label` describes a level model that no longer exists

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Pattern Consistency
- **Location**: `src/components/game/GameEntry.tsx:268`
- **Detail**: The board's `role="img"` label reads "level board with player start, gems, rocks,
  and an open exit" — written when the board was static scenery. The board is now diggable dirt
  the player reshapes, and the label is the only description a screen-reader user gets of what
  the grid *is*. FR-014 names the accessibility surface as must-preserve.
- **Fix**: Update the label to name dirt and digging.
- **Decision**: FIXED

### F3 — Digging is not announced on the live status region

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Architecture
- **Location**: `src/components/game/GameEntry.tsx` → `aria-live` region
- **Detail**: The live region reports position, gems, score, quota and status, but not that a tile
  was dug. A screen-reader user cannot tell a dig from a walk over already-open space.
- **Decision**: ACCEPTED — out of scope for `S-01`. This is the same accessibility surface PRD
  Open Question 1 covers for the boulder instability telegraph; both should be answered together
  rather than patched piecemeal here. Carried forward to `S-02`.
