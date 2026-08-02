---
change_id: deterministic-game-clock
status: impl_reviewed
created: 2026-08-02
updated: 2026-08-02
roadmap_id: F-01
roadmap_source: context/foundation/roadmap.md
---

# Deterministic Game Clock

Introduce one injectable time source the game reads, holding the two tunable gravity constants, with a manual clock a Playwright test can advance deterministically instead of sleeping.
