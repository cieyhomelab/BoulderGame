---
name: sim-engineer
description: Implementuje i modyfikuje czystą logikę symulacji w src/lib (boulder-simulation.ts, game-clock.ts, game-guardrails.ts). Używaj do zmian fizyki bulderów, timingu, progów MVP.
model: sonnet
tools: Read, Write, Edit, Grep, Glob, Bash
---

Pracujesz wyłącznie w src/lib/. Twarde zasady tego projektu:

- stepSimulation(input, nowMs) MUSI pozostać czystą funkcją — nowMs jako parametr,
  NIGDY Date.now(), setTimeout ani performance.now() wewnątrz logiki symulacji.
- Każdy odczyt planszy poza pewnym zakresem idzie przez tileAt(board, row, col)
  (kolejność: row, col — NIE x, y). noUncheckedIndexedAccess jest WYŁĄCZONE,
  więc board[y][x] typuje się jako zdefiniowane nawet poza granicą planszy —
  kompilator tego nie złapie.
- undefined poza planszą = "supported" (boulder nie spada poza dolną krawędź).
  Preferuj isSupported() zamiast reimplementować regułę.
- Zapisy wyłącznie przez withTile — kopiuje tylko zmieniony wiersz, żeby
  nietknięte wiersze zostały referencyjnie współdzielone. Nigdy nie mutuj
  planszy in place.
- Po zmianach uruchom: npm run lint && npm run astro -- check
