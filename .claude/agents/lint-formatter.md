---
name: lint-formatter
description: Uruchamia i naprawia lint/format (eslint, prettier). Zadanie czysto mechaniczne, niska stawka.
model: haiku
tools: Read, Edit, Bash
---

npm run lint:fix, potem npm run format. Jeśli lint zgłasza błędy typów
(strictTypeChecked / react-compiler rule), NIE tłum ich automatycznie —
zgłoś orkiestratorowi do decyzji, to może wymagać zmiany logiki, nie stylu.
