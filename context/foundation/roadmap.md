---
project: BoulderGame
version: 1
status: draft
created: 2026-08-01
updated: 2026-08-01
prd_version: 1
main_goal: market-feedback
top_blocker: capacity
---

# Roadmap: BoulderGame

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

BoulderGame ma byc webowa gra zrecznosciowa w duchu Boulder Dash dla fanow retro, ktorzy szukaja klimatu lat 90. Produkt ma udowodnic "miodnosc" przez to, ze gracz chce wrocic do kolejnej proby. Kluczowa regula gry to ryzyko-nagroda: gracz moze zebrac wiecej elementow, ale zwieksza szanse utraty poziomu.

## North star

**S-04: Gracz moze zakonczyc probe i natychmiast zagrac ponownie** — North star oznacza tutaj najmniejszy pelny przeplyw, ktory pokazuje, ze produkt dziala: gracz startuje bez logowania, gra petle arcade, wygrywa albo przegrywa i od razu zaczyna kolejna probe.

## At a glance

| ID   | Change ID                          | Outcome (user can ...)                                                                                          | Prerequisites | PRD refs                                            | Status        |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------- | ------------- |
| F-01 | performance-play-signal-guardrails | (foundation) minimalne guardraile startu sesji, responsywnosci inputu i powrotu do gry sa gotowe do weryfikacji | -             | NFR guardrails, Success Criteria Primary            | impl_reviewed |
| F-02 | public-playtest-deploy-path        | (foundation) sciezka publicznego playtestu ma poprawna tozsamosc deployu i podstawowy odczyt logow              | -             | NFR first session, tech-stack.md, infrastructure.md | impl_reviewed |
| S-01 | immediate-browser-game-entry       | gracz moze otworzyc gre w browserze i zaczac poziom bez konta                                                   | F-01          | US-01, FR-001, FR-002                               | impl_reviewed |
| S-02 | controllable-board-collection      | gracz moze poruszac postacia po planszy i zbierac elementy                                                      | S-01          | US-01, FR-003, FR-004                               | impl_reviewed |
| S-03 | level-end-states                   | gracz moze przegrac na zagrozeniu albo ukonczyc poziom                                                          | S-02          | US-01, FR-005, FR-006                               | impl_reviewed |
| S-04 | replayable-arcade-loop             | gracz moze zakonczyc probe i natychmiast zagrac ponownie                                                        | S-03, F-02    | US-01, FR-007, Success Criteria Primary             | impl_reviewed |
| S-05 | risk-reward-level-tuning           | gracz moze wybrac bezpieczniejsza albo bardziej ryzykowna droge po lepszy wynik                                 | S-04          | US-01, FR-004, FR-005, FR-006, Business Logic       | ready         |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme              | Chain                                                    | Note                                                                                                     |
| ------ | ------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A      | Petla gry          | `F-01` -> `S-01` -> `S-02` -> `S-03` -> `S-04` -> `S-05` | Glowna sciezka pod sygnal od gracza: najpierw dzialajaca petla, potem mocniejsza decyzja ryzyko-nagroda. |
| B      | Publiczny playtest | `F-02`                                                   | Dolacza do Stream A przy `S-04`, bo replay loop powinien byc gotowy do pokazania realnemu graczowi.      |

## Baseline

What's already in place in the codebase as of `2026-08-01` (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present - web-app scaffold, routing, component system and build scripts exist; game surface is not implemented yet (`package.json`, `astro.config.mjs`, `src/pages/index.astro`).
- **Backend / API:** present - server-side route handling and middleware exist in the starter; current endpoints serve auth scaffold, not game logic (`src/pages/api/auth/*.ts`, `src/middleware.ts`).
- **Data:** partial - Supabase client and CLI scaffold exist, but the PRD does not require a database for MVP and no game schema/seed is present (`src/lib/supabase.ts`, `supabase/config.toml`).
- **Auth:** present - Supabase auth routes and a protected dashboard exist, but PRD explicitly says no auth for MVP (`src/pages/api/auth/*.ts`, `src/middleware.ts`).
- **Deploy / infra:** partial - Cloudflare runtime config and CI build exist; production deploy workflow still needs the MVP-specific path (`wrangler.jsonc`, `.github/workflows/ci.yml`).
- **Observability:** partial - Cloudflare platform observability is enabled, but app-level gameplay/start/input checks are absent (`wrangler.jsonc`).

## Foundations

### F-01: Performance and play-signal guardrails

- **Outcome:** (foundation) minimalne guardraile startu sesji, responsywnosci inputu i powrotu do gry sa gotowe do weryfikacji.
- **Change ID:** performance-play-signal-guardrails
- **PRD refs:** NFR guardrails, Success Criteria Primary
- **Unlocks:** S-01, S-02, S-04; named verification paths for first session start, input response, and repeated attempts
- **Prerequisites:** -
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:** -
- **Risk:** Bez tej minimalnej weryfikacji latwo zbudowac gre, ktora dziala, ale nie spelnia warunkow szybkiego startu i responsywnego sterowania.
- **Status:** impl_reviewed

### F-02: Public playtest deploy path

- **Outcome:** (foundation) sciezka publicznego playtestu ma poprawna tozsamosc deployu i podstawowy odczyt logow.
- **Change ID:** public-playtest-deploy-path
- **PRD refs:** NFR first session, tech-stack.md, infrastructure.md
- **Unlocks:** S-04; verification path for a real browser playtest outside local development
- **Prerequisites:** -
- **Parallel with:** F-01, S-01, S-02, S-03
- **Blockers:** Cloudflare account access for first real deployment
- **Unknowns:** -
- **Risk:** Jesli deploy zostanie odlozony do samego konca, problem z nazwa projektu, konfiguracja hostingu albo logami moze opoznic zebranie sygnalu od gracza.
- **Status:** impl_reviewed

## Slices

### S-01: Immediate browser game entry

- **Outcome:** gracz moze otworzyc gre w browserze i zaczac poziom bez konta.
- **Change ID:** immediate-browser-game-entry
- **PRD refs:** US-01, FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:**
  - Czy starter auth/dashboard ma zostac usuniety od razu czy tylko wyjety ze sciezki gry? - Owner: user. Block: no.
- **Risk:** Ten slice musi przeciac scaffold auth tak, zeby MVP zaczynalo sie od gry, a nie od ekranu produktowego albo logowania.
- **Status:** impl_reviewed

### S-02: Controllable board and collection

- **Outcome:** gracz moze poruszac postacia po planszy i zbierac elementy.
- **Change ID:** controllable-board-collection
- **PRD refs:** US-01, FR-003, FR-004
- **Prerequisites:** S-01
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:**
  - Jaki minimalny zestaw kafelkow wystarczy do pierwszej grywalnej planszy? - Owner: team. Block: no.
- **Risk:** Jesli sterowanie i zbieranie nie beda przyjemne, dalsze end-state'y nie naprawia podstawowego odczucia gry.
- **Status:** impl_reviewed

### S-03: Level end states

- **Outcome:** gracz moze przegrac na zagrozeniu albo ukonczyc poziom.
- **Change ID:** level-end-states
- **PRD refs:** US-01, FR-005, FR-006
- **Prerequisites:** S-02
- **Parallel with:** F-02
- **Blockers:** -
- **Unknowns:**
  - Jak prosty warunek ukonczenia poziomu najlepiej wspiera zasade ryzyko-nagroda? - Owner: team. Block: no.
- **Risk:** Bez obu zakonczen gra nie ma pelnej stawki: gracz musi widziec zarowno nagrode, jak i koszt ryzyka.
- **Status:** impl_reviewed

### S-04: Replayable arcade loop

- **Outcome:** gracz moze zakonczyc probe i natychmiast zagrac ponownie.
- **Change ID:** replayable-arcade-loop
- **PRD refs:** US-01, FR-007, Success Criteria Primary
- **Prerequisites:** S-03, F-02
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:**
  - Czy gra ma jawnie pokazywac liczbe prob, czy wystarczy obserwowalny replay w sesji? - Owner: user. Block: no.
- **Risk:** To pierwszy pelny test powrotu do gry; jesli replay wymaga myslenia albo instrukcji, MVP nie trafia w glowny sygnal sukcesu.
- **Status:** impl_reviewed

### S-05: Risk-reward level tuning

- **Outcome:** gracz moze wybrac bezpieczniejsza albo bardziej ryzykowna droge po lepszy wynik.
- **Change ID:** risk-reward-level-tuning
- **PRD refs:** US-01, FR-004, FR-005, FR-006, Business Logic
- **Prerequisites:** S-04
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:**
  - Jaki uklad planszy daje widoczna decyzje ryzyko-nagroda bez potrzeby instrukcji? - Owner: team. Block: no.
- **Risk:** Ten slice jest po pelnej petli, bo tuning ma sens dopiero wtedy, gdy mozna zagrac, przegrac, wygrac i sprobowac ponownie.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                | Ready for `/10x-plan` | Notes                                              |
| ---------- | ---------------------------------- | ---------------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | performance-play-signal-guardrails | Add MVP performance and play-signal guardrails       | yes                   | Run `/10x-plan performance-play-signal-guardrails` |
| F-02       | public-playtest-deploy-path        | Prepare public playtest deployment path              | yes                   | Can run in parallel after F-01 starts              |
| S-01       | immediate-browser-game-entry       | Let the player start the game immediately in browser | yes                   | Requires F-01                                      |
| S-02       | controllable-board-collection      | Let the player move on the board and collect items   | yes                   | Requires S-01                                      |
| S-03       | level-end-states                   | Let the player lose or complete the level            | yes                   | Requires S-02                                      |
| S-04       | replayable-arcade-loop             | Let the player immediately replay after a level ends | yes                   | Requires S-03 and F-02                             |
| S-05       | risk-reward-level-tuning           | Tune one level around visible risk-reward choices    | yes                   | Requires S-04                                      |

## Open Roadmap Questions

None currently identified.

## Parked

- **Accounts, login, and player profiles** - Why parked: PRD Non-Goals says the player starts immediately; existing auth scaffold must not enter the MVP game path.
- **Online leaderboards** - Why parked: PRD Non-Goals says replayability is proven by repeat play, not ranking.
- **Level editor** - Why parked: PRD Non-Goals says the first version focuses on a playable arcade loop.
- **Separate mobile version** - Why parked: PRD Non-Goals targets current major desktop browsers first.
- **Multi-level campaign** - Why parked: PRD Non-Goals says one polished level is enough for the first useful version.
- **Game database and saved profiles** - Why parked: PRD Access Control says single user session with no account; Supabase scaffold is not a product requirement for MVP.

## Done
