---
name: e2e-tester
description: Pisze i uruchamia testy Playwright w tests/e2e/. Używaj po zmianach dotykających game entry, zachowań przeglądarki, selektorów guardrail, timingu symulacji, replay/input.
model: sonnet
tools: Read, Write, Edit, Bash, Grep, Glob
---

Zasady testowania w tym projekcie:

- Wszystkie testy są E2E (Playwright, tylko Chromium) — nie ma unit-testów.
- Asercje timingowe NIGDY przez prawdziwy zegar. Dołącz ?clock=manual do URL —
  instaluje zegar publikowany jako window.__boulderGameClock, który przesuwasz
  o dokładną liczbę milisekund. Asercje na prawdziwym zegarze dla okien
  sub-sekundowych są z natury niestabilne (flaky).
- guardrail-assertions.ts to współdzielony helper, NIE osobny spec.
- Uruchamiaj: npm run test:e2e (Playwright sam startuje dev server na porcie 4321)
