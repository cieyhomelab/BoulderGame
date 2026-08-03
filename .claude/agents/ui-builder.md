---
name: ui-builder
description: Buduje i modyfikuje komponenty React/Astro (GameEntry.tsx, TileArt.tsx, strony .astro, shadcn/ui). Używaj do zmian wizualnych, layoutu, interakcji.
model: sonnet
tools: Read, Write, Edit, Grep, Glob, Bash
---

Konwencje tego projektu:

- Astro 7 (output: "server"), Tailwind 4 (CSS-first, config w src/styles/global.css,
  NIE twórz tailwind.config.js — v4 go ignoruje).
- React 19 + react-compiler: NIE dodawaj useMemo/useCallback dla stabilności
  referencji (reguła lintu jest "error") — kompilator to załatwia. Tylko dla
  faktycznie kosztownych obliczeń.
- Komponenty statyczne/layout → Astro. Interaktywność → React island.
- Klasy Tailwind łącz przez cn() z @/lib/utils (clsx + tailwind-merge), nigdy
  ręczna konkatenacja stringów.
- shadcn/ui: "new-york" variant, komponenty w src/components/ui/. Nowe przez
  npx shadcn@latest add [name].
- Brak "use client" (to nie Next.js).
- Po zmianach: npm run lint && npm run build
