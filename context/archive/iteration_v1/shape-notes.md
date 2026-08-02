---
project: BoulderGame
context_type: greenfield
created: 2026-08-01
updated: 2026-08-01
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: primary persona scope
      decision: fani retro
    - topic: miodnosc signal
      decision: gracz wraca do gry
    - topic: access model
      decision: no auth; game starts immediately in browser
    - topic: mvp primary success
      decision: player plays at least three times
    - topic: mvp secondary success
      decision: no separate secondary success criterion for MVP
    - topic: mvp guardrails
      decision: responsive controls, fast session start, no instruction reading required
    - topic: mvp timeline
      decision: shippable within 3 weeks of after-hours work
    - topic: non-functional requirements
      decision: input response under 100 ms, first session under 3 seconds, current major desktop browsers
    - topic: product framing
      decision: web app for small initial audience; no deadline; after-hours work
    - topic: non-goals
      decision: no accounts, no online leaderboards, no level editor, no separate mobile target, no multi-level campaign
  frs_drafted: 7
  quality_check_status: accepted
---

# Shape Notes

Seed idea: Budujemy gre w stylu Boulder Dash. Gra ma byc webowa. Interfejs gry zrobimy za pomoca pen.dev

## Vision & Problem Statement

Obecne gry zrecznosciowe sa malo "miodne" dla fanow retro szukajacych webowej gry w duchu lat 90. Gracz probuje alternatyw, ale nie dostaje z nich satysfakcji, ktora sprawia, ze chce sie do gry wracac.

"Miodnosc" gry mozna oceniac przez to, czy gracz wraca do gry; styl graficzny lat 90. jest czescia tej frajdy.

Scale note: przy 100x wiekszej liczbie graczy regula ryzyko-nagroda zostaje taka sama.

## User & Persona

Primary persona: fan retro gier komputerowych, ktory szuka webowej gry zrecznosciowej w stylu lat 90. Siega po produkt, gdy chce krotkiej, satysfakcjonujacej sesji w duchu Boulder Dash i oczekuje, ze gra bedzie miala klimat oraz "miodnosc" znana z dawnych gier.

## Success Criteria

### Primary

- A fan of retro games opens the web game, starts a level immediately without logging in, plays a Boulder Dash-style arcade loop, finishes or loses the level, and chooses to play again.
- MVP success is proven when the player plays at least three times.

### Secondary

- No separate secondary success criterion for MVP.

### Guardrails

- Controls must feel responsive during play.
- A play session must start quickly after opening the web game.
- The player must be able to start playing without reading instructions first.

## User Stories

### US-01: Player replays the arcade loop

- **Given** a fan of retro games opens the web game
- **When** they start a level, play the Boulder Dash-style loop, and finish or lose the level
- **Then** they can immediately play again without logging in or reading instructions

#### Acceptance Criteria

- The player can start the game from the browser without an account.
- The player can complete or lose a level through the core arcade loop.
- The player can start another attempt after the level ends.
- MVP success is proven when the player plays at least three times.

## Functional Requirements

- FR-001: Player can launch the game in the browser without logging in. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-002: Player can start a level immediately after entering the game. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-003: Player can control a character on a Boulder Dash-style board. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-004: Player can collect items on the board. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-005: Player can encounter hazards and lose a level. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-006: Player can complete a level. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.
- FR-007: Player can play again after completing or losing a level. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; it stands as written. Resolution: kept.

## Non-Functional Requirements

- Player input receives an in-game response in less than 100 ms.
- The player can start the first play session in less than 3 seconds after opening the web page.
- The game remains playable in the current major versions of mainstream desktop browsers.

## Business Logic

Gra wymusza decyzje ryzyko-nagroda: gracz moze zbierac wiecej elementow dla lepszego wyniku, ale kazde dodatkowe ryzyko zwieksza szanse utraty poziomu.

Regula korzysta z widocznego ukladu planszy, elementow do zebrania, zagrozen oraz warunku ukonczenia poziomu. Gracz spotyka ja w podstawowej petli: porusza sie po planszy, wybiera bezpieczniejsza droge albo probuje zdobyc wiecej, a gra rozstrzyga konsekwencje tej decyzji.

## Access Control

Single user session; no auth. The player can open the web game and start playing immediately in the browser. No account, roles, or gated routes are part of the MVP.

## Non-Goals

- No accounts, login, or player profiles in the MVP; the player starts immediately.
- No online leaderboards in the MVP; replayability is proven by repeat play, not ranking.
- No level editor in the MVP; the first version focuses on a playable arcade loop.
- No separate mobile version as an MVP goal; the first target is a web game for desktop browsers.
- No multi-level campaign in the MVP; one polished level is enough for the first useful version.

## Open Questions

None currently identified.

## Quality cross-check

- Access Control: present.
- Business Logic: present.
- Project artifacts: present.
- Timeline-cost ack: present; MVP is scoped to 3 weeks.
- Non-Goals: present.
- Preserved behavior: n/a (greenfield).

## Forward: tech-stack

- User preference captured for downstream stack/design tooling: interface/design work should use `pen.dev`.
