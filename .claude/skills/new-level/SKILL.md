---
name: new-level
description: Zaprojektuj i dodaj kolejną jaskinię do BoulderGame. Zaczyna od pytań o zamysł planszy (trasa, rola głazów, zagadka bonusu, trudność), potem pisze wiersze, iteruje na `npm run level:check` aż do zielonego i domyka pełnym zestawem e2e. Używaj gdy padnie "nowy poziom", "kolejna plansza", "dodaj level", "new level", "zaprojektuj jaskinię".
---

# Nowa jaskinia do BoulderGame

Prowadzisz autora przez zaprojektowanie planszy, a potem sam ją weryfikujesz. Bramka
(`npm run level:check`) sprawdza **poprawność**; zamysł jest decyzją człowieka i po to są pytania.

## Krok 1 — zapytaj o zamysł

Użyj `AskUserQuestion`. Zadaj **wszystkie cztery naraz** (jedno wywołanie), bo odpowiedzi nie
zależą od siebie:

1. **Trasa** — `Krótka i zwarta` (wyjście blisko startu, ~12 ruchów) / `Podróż w obie strony`
   (wyjście po przeciwnej stronie, ~20-25 ruchów, jak cave-02) / `Labirynt`
   (ciasne korytarze, dużo ścian).
2. **Rola głazów** — `Tło` (stoją, nie przeszkadzają) / `Przeszkoda` (blokują skrót, obejście
   bezpieczne) / `Zagrożenie` (trasa prowadzi pod nimi) / `Reakcja łańcuchowa` (stos, jeden
   pociąga drugi).
3. **Zagadka bonusu** — `Bez zagadki` (bonus po prostu na uboczu) / `Zamurowany` (dostęp zatkany
   głazem, trzeba podkopać — jak cave-01) / `Gem jest podporą` (zabranie zrzuca głaz na gracza —
   jak cave-02) / `Bez bonusu` (dokładnie tyle gemów, ile wynosi kwota).
4. **Trudność względem `cave-02`** — `Łatwiejsza` / `Podobna` / `Trudniejsza`.

Jeśli autor od razu podał własny opis słowami — pomiń pytania i pracuj na nim.

Powtórz zamysł jednym zdaniem, zanim zaczniesz rysować.

## Krok 2 — poznaj stan rejestru

Przeczytaj `src/lib/levels.ts`. Weź kolejne wolne `id` (`cave-03`, `cave-04`, …) i `name`
(`Level 03`, …). Zobacz obie istniejące jaskinie — nowa ma być inna, nie wariantem.

## Krok 3 — narysuj planszę

Alfabet jest zamknięty (`Tile` w `src/components/game/TileArt.tsx`): `#` ściana, `.` ziemia,
spacja pustka, `p` start, `e` wyjście, `g` gem, `r` głaz, `h` kolce. **Nowa mechanika wymaga zmian
w kodzie — nie obiecuj wrogów, kluczy ani limitu czasu.**

Twarde ograniczenia:

- **Dokładnie 8 wierszy po 12 znaków.** Szerokość jest zaszyta w klasie `grid-cols-12`, a Tailwind 4
  nie generuje klas z danych runtime.
- **Cała krawędź to `#`.**
- **Dokładnie jeden `p` i jeden `e`.** Co najmniej jeden `h`.
- **Każdy `r` musi mieć pod sobą coś innego niż pustkę w t=0.** Ziemia, gem, kolce, wyjście i inny
  głaz podpierają — podpiera wszystko poza spacją.
- **Żaden `r` w kolumnie wyjścia.** Głazy spadają wyłącznie w swojej kolumnie i nigdy jej nie
  zmieniają, więc to gwarancja trwała.
- **`p` zamienia się w pustkę przy parsowaniu** — głaz bezpośrednio nad startem spadnie od razu.

Zasady projektowe, które działają:

- Kopanie **nie otwiera drogi** — ziemia jest przechodnia. Kopanie zmienia wyłącznie podparcie
  głazów. Nie buduj zagadek opartych na „przekop się tędy".
- Bonus zamurowany: otocz gem ścianami ze wszystkich stron poza jedną, a w tej jednej postaw głaz.
- Bonus jako podpora: postaw `g` bezpośrednio pod `r`. Zabranie gema zrzuca głaz na kafelek gracza —
  ucieczka tylko w bok, bo w dół głaz podąża tą samą kolumną.
- Kwota musi być osiągalna **bez dotykania głazu** — inaczej plansza jest nieprzechodnia dla
  ostrożnego gracza i bramka to zgłosi.

## Krok 4 — dopisz do rejestru

Dodaj `LevelDefinition` w `src/lib/levels.ts` i **dopisz do tablicy `LEVELS`** (kolejność w tablicy
jest kolejnością rozgrywki). Nad definicją zostaw komentarz w stylu istniejących: wypisz
niezmienniki tej konkretnej jaskini ze współrzędnymi, żeby następna osoba wiedziała, co wolno ruszyć.

## Krok 5 — iteruj na bramce

```
npm run level:check
```

Porażka nazywa problem i **współrzędne**, np. `every boulder rests at t=0 — falling: (1,9)`.
Popraw wskazany wiersz i uruchom ponownie. Powtarzaj aż do `PASS`.

Raport podaje też `winnable — N moves, M states`. Użyj `N` jako miary trudności:
`cave-01` to 13 ruchów, `cave-02` to 23. Jeśli autor prosił o trudniejszą planszę, a wyszło 9 —
przeprojektuj, bramka tego nie wyłapie.

Jeżeli bramka zgłosi `no route found within ... (budget)` zamiast `no winning route exists`, plansza
jest zbyt otwarta dla solvera — dołóż ścian, nie zwiększaj budżetu.

## Krok 6 — domknij zestawem

```
npm run test:e2e
```

**Nie edytuj testów.** `level-invariants` i `level-solver` iterują po rejestrze, a
`level-progression` wylicza sekwencję klawiszy z solvera i sam przechodzi przez wszystkie jaskinie.
Jeśli jakiś test wymaga zmiany, to sygnał, że coś jest nie tak z planszą albo z testem — zbadaj,
nie naginaj.

Na koniec uruchom `npm run lint`.

## Krok 7 — zdaj sprawę

Podaj: `id` i nazwę, siatkę, na czym polega zamysł, długość rozwiązania z solvera, wynik bramki
i zestawu. **Nie commituj bez wyraźnego polecenia.**

Uprzedź autora, że nowa jaskinia nie jest widoczna od razu po `npm run dev` — nie ma selektora
poziomów, więc trzeba przejść wszystkie wcześniejsze i klikać `NEXT CAVE`.
