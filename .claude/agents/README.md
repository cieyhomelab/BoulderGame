# Subagenci dla BoulderGame

## Instalacja

Skopiuj folder `.claude/agents/` do korzenia repo BoulderGame:

```bash
cp -r .claude/agents /ścieżka/do/BoulderGame/.claude/
```

Albo, jeśli chcesz mieć te agenty dostępne globalnie (we wszystkich swoich projektach),
skopiuj pliki do `~/.claude/agents/` zamiast do repo.

## Uruchomienie orkiestratora

```bash
cd BoulderGame
claude --model opus
```

Orkiestrator (Opus) będzie mógł delegować zadania do:

| Agent            | Model  | Zakres                                              |
|------------------|--------|------------------------------------------------------|
| sim-engineer     | sonnet | src/lib — logika symulacji, fizyka bulderów           |
| ui-builder       | sonnet | komponenty React/Astro, Tailwind, shadcn/ui           |
| e2e-tester       | sonnet | testy Playwright w tests/e2e/                         |
| repo-explorer    | haiku  | szybkie, tylko-do-odczytu przeszukiwanie repo         |
| lint-formatter   | haiku  | mechaniczny eslint --fix / prettier                   |

## Uwaga

`npm run deploy` / `deploy:rollback` celowo NIE ma dedykowanego subagenta —
zgodnie z CLAUDE.md tego projektu, pierwszy deploy produkcyjny, zmiany domeny
i rollback wymagają ludzkiej zgody. Zostaw te komendy do ręcznego uruchomienia
przez Ciebie lub jawnego polecenia orkiestratorowi w głównej sesji.

## Weryfikacja modelu subagenta

Były zgłaszane przypadki, w których pole `model` we frontmatterze bywało
ignorowane (subagent dziedziczył model sesji głównej). Po instalacji warto
sprawdzić, czy faktycznie działa — np. zapytać dany subagent, jakiego modelu
używa, albo obserwować zużycie tokenów/koszt.
