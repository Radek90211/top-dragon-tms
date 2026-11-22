# TOP DRAGON — Asystent spedytora 0.1.0

Rozszerzenie Manifest V3 dla Chrome/Edge na komputerze. Bez API Trans.eu,
bez pobierania listy ofert, bez przechwytywania ruchu/logowania i bez automatycznego wysyłania wiadomości.
Nie gwarantuje niewykrywalności. Edycja tekstu i wyróżnianie nazw mogą być zauważalne przez stronę.

## Instalacja

1. Rozpakuj `top-dragon-assistant.zip`.
2. W Chrome otwórz `chrome://extensions` (Edge: `edge://extensions`).
3. Włącz tryb dewelopera, wybierz **Załaduj rozpakowane** i wskaż folder zawierający `manifest.json`.
4. Otwórz TOP DRAGON i Trans.eu. Odśwież obie karty po instalacji.
5. Kliknij ikonę rozszerzenia, aby otworzyć panel boczny.
6. Zaloguj się w TOP DRAGON zwykłym sposobem, następnie kliknij w dodatku **Połącz z TOP DRAGON**.
   Przy wielu kartach wybierz konkretną kartę, a jako administrator także oddział.

Login, hasło i token Supabase nie są przekazywane do rozszerzenia. Polecenia wykonuje otwarta karta TOP DRAGON
w ramach uprawnień aktualnie zalogowanej osoby. Dane pobierane są dopiero na żądanie.

## Pierwsze użycie

- Wklej dane wybranej oferty lub wypełnij pola. Numer oferty powinien być taki sam u wszystkich spedytorów.
- Rozpoznanie tekstu obsługuje `Warszawa → Łódź`, cenę EUR/PLN oraz daty `24.11.2026 10:00`.
  Nie ustala brakujących godzin, dat ani ceny.
- Dopasowanie uwzględnia poprzednią i kolejną relację kierowcy, kolizje terminów, wysokość i wskazane wymagania.
  Połączenie z TOP DRAGON próbuje rozpoznać współrzędne miast. Można podać je ręcznie.
- Kilometry i czas dojazdu są szacowane. Tachograf, czas pracy kierowcy, ADR, tonaż, wyposażenie
  i ograniczenia drogowe nie są automatycznie potwierdzane. Dopasowanie jest propozycją do sprawdzenia.
- Kalkulator pokazuje wynik dla wskazanego ładunku oraz dojazdów (kwoty netto w jednej walucie).
  Zmiana pustych kilometrów całego planu jest osobną wartością. Koszt/km powinien obejmować wszystkie koszty
  jazdy poza opłatami wpisanymi osobno; oczekiwanie dodaj w pozostałych kosztach.
- Zapis lokalny jest oznaczony jako **Tylko lokalnie**. Nie oznacza zajęcia oferty w zespole.
- Zapis centralny, zajęcie/zwolnienie, proponowana stawka, status, notatka i termin kontaktu są odświeżane co 15 s
  przy otwartym panelu. Zmiany wersji powodują konflikt zamiast nadpisania cudzej pracy.
- Oznaczenia klientów rozpoznają NIP (z krajem), Trans ID albo pełną nazwę. Dopasowanie po nazwie jest przybliżone.
- Wyróżnianie nazw na Trans.eu uruchamia się przyciskiem. Nie pobiera ofert ani nie śledzi ich zmian.
  Po zmianie widoku użyj przycisku ponownie. Nie jest to sprawdzenie tożsamości firmy.

## Sekwencje klawiszy

W polu tekstowym, textarea lub prostym edytorze contenteditable wpisz kolejno `=` i `1` w ciągu 3 s.
Sekwencja zostanie zastąpiona przez `TEST`. Tekst nie zostanie wysłany.
W zakładce **Skróty** możesz zmieniać tekst i dodawać własne jednoznaczne sekwencje.
Hasła, pola e-mail/liczbowe, pasek adresu, złożone edytory i ramki z innych domen nie są objęte obsługą.
Skróty działają domyślnie na Trans.eu i TOP DRAGON. Na innej stronie kliknij ikonę dodatku i użyj
**Włącz skróty na obecnej stronie** — przeglądarka zapyta o dostęp wyłącznie do tej domeny.

## Zapis zespołowy — wymagany etap wdrożenia

W bazie Supabase projektu należy wykonać plik repozytorium:
`supabase/migrations/035_exchange_assistant.sql` (po istniejącej migracji 012).
Paczka nie wykonuje migracji automatycznie. Bez niej działa plan, historia i kalkulacje oraz zapis lokalny,
ale negocjacje i zajęcie oferty nie są współdzielone. Panel wyświetla o tym komunikat.
RLS ogranicza odczyt do oddziału (administrator widzi wszystkie), a RPC wymaga aktywnego profilu.
Zajęcie oferty jest atomowe; cudzej aktywnej rezerwacji nie można przejąć.
Wpisy zmieniane przez zespół mają numer wersji i ślad w audycie administratora.

## Testowanie

`node test-exchange-assistant.mjs` — kalkulacje, plan, uprawnienia komunikacji i błędy.
`pnpm install --dir tests/exchange-db --ignore-workspace --ignore-scripts`
oraz `node tests/exchange-db/test.mjs` — izolowany PostgreSQL/PGlite: migracja, dwa konta, RLS, wersje i audyt.
`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`
Podgląd: `http://127.0.0.1:5173/browser-extension/sidepanel.html`.
Podgląd nie jest zainstalowaną wtyczką i nie testuje API rozszerzeń Chrome ani rzeczywistego zapisu w Supabase.

Przed udostępnieniem zespołowi wymagany jest test Chrome/Edge z załadowanym rozszerzeniem oraz
test dwóch kont równocześnie po migracji. Nie publikuj kluczy serwerowych w paczce.

Przygotowanie paczki z repozytorium: `node scripts/package-exchange-assistant.mjs`.
ZIP zawiera również `setup/035_exchange_assistant.sql` do wdrożenia centralnego zapisu.
