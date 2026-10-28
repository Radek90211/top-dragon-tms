AKTUALIZACJA v273 - kompletna paczka wdrożeniowa
Build/cache: v273-complete-package

- Paczka zawiera aktualną aplikację v272 oraz wymagane pliki wspólne: moduły formularza, planowania, importu, endpointy serwerowe, bibliotekę HTTP i zasoby graficzne.
- Można ją wdrożyć jako pełny katalog projektu Vite/Vercel. Ustaw przed wdrożeniem VITE_SUPABASE_URL oraz VITE_SUPABASE_PUBLISHABLE_KEY (lub VITE_SUPABASE_ANON_KEY); dla analizatora zachowaj OPENAI_API_KEY.
- Usunięto zależność od nieistniejących plików JPG/PNG logo. Logo i favicon są dołączone jako SVG.

WERYFIKACJA v273
- Kontrola kompletności importów modułów i wszystkich lokalnych zasobów HTML.
- Kontrola składni JavaScript aplikacji, endpointów i skryptów inline.

----------------------------------------------------------------

AKTUALIZACJA v272 - dodawanie relacji z planu kierowców
Build/cache: v272-board-add

- Dwuklik pustego dnia przy własnym kierowcy ponownie otwiera formularz dodawania relacji także bez indywidualnego Trybu Excelowego.
- Użytkownik z włączonym Trybem Excelowym zachowuje szybkie dodawanie kafelka; pozostałe osoby otrzymują pełny formularz relacji.

WERYFIKACJA v272
- Kontrola składni aplikacji, uprawnień własnego kierowcy i obu sposobów dodawania relacji.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v271 - edycja koloru administratora
Build/cache: v271-admin-color-edit

- W wierszu administratora dostępny jest aktywny wybór koloru i osobny przycisk „Zapisz kolor”.
- Zapis odświeża kolor konta oraz przekazuje go od razu do uruchomionego planu i historii operacji.

WERYFIKACJA v271
- Kontrola składni aplikacji, walidacji koloru i zapisu koloru administratora.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v270 - kolor administratora w historii operacji
Build/cache: v270-admin-audit-color

- Historia operacji pokazuje administratora z jego ustawionym kolorem użytkownika.
- Usunięto wymuszanie czerwonego koloru administratora z katalogu użytkowników, danych sesji i listy zespołu.

WERYFIKACJA v270
- Kontrola składni aplikacji oraz przekazywania indywidualnego koloru administratora do historii operacji.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v269 - Asystent spedytora i indywidualny tryb planu
Build/cache: v269-assistant-access

- Asystent spedytora pozostaje dostępny niezależnie od włączonych modułów opcjonalnych, dzięki czemu można zawsze przejść do „+ Kierowca / pojazd”.
- Usunięto globalną sekcję „Sposób pracy na planie kierowców”. Tryb Excelowy jest od teraz określany wyłącznie indywidualnym uprawnieniem użytkownika.

WERYFIKACJA v269
- Kontrola składni aplikacji, dostępu do Asystenta oraz usunięcia globalnego przełącznika trybu planu.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v268 - płynne przewijanie planu
Build/cache: v268-smooth-board-scroll

- Podczas przewijania planu przez kółko, palec lub uchwyt paska synchronizacja nie wymienia już tablicy w trakcie ruchu.
- Aktualizacje zebrane podczas przewijania są wykonywane tylko raz, 160 ms po zatrzymaniu.

WERYFIKACJA v268
- Kontrola składni aplikacji oraz ochrony przewijania przed przebudową tablicy.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v267 - obraz w wiadomości SMS/MMS
Build/cache: v267-sms-image

- W szczegółach zlecenia dodano „Wyślij obraz / MMS”. Przycisk pozwala wskazać uprzednio wycięty zrzut ekranu w PNG, JPG lub WEBP.
- Na telefonie obraz i gotowa treść SMS otwierają systemowy panel udostępniania, z którego można wybrać aplikację Wiadomości.
- Na urządzeniach bez systemowego udostępniania obraz jest kopiowany do schowka, a następnie otwierana jest wiadomość SMS do kierowcy.

WERYFIKACJA v267
- Kontrola składni aplikacji oraz obsługi wyboru obrazu, udostępniania MMS i bezpiecznego zapasowego kopiowania obrazu.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v266 - nawigacja i minimalny rozmiar relacji
Build/cache: v266-navigation-resize

- Ręczne zmniejszanie kafelka zachowuje minimalny czas trwania 3 godziny.
- Skróty Google Maps i Impargo są ikonami w nagłówku „Szczegóły zlecenia”; zachowują opisy dla czytników ekranu i po najechaniu kursorem.
- Linki przekazują pełne adresy punktów. Gdy kierowca rozładował dzień wcześniej, jego ostatni rozładunek jest pierwszym punktem trasy. Google Maps otwiera trasę w trybie samochodowym.

WERYFIKACJA v266
- Kontrola składni aplikacji, ograniczenia 3 godzin, budowania punktów trasy i skrótów nawigacji.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v265 - dane floty i transport wojskowy
Build/cache: v265-fleet-military

- Formularz dodawania kierowcy wymaga 10-cyfrowego NIP-u przewoźnika oraz udostępnia: model ciągnika, kolor ciągnika i markę naczepy.
- Dane dodatkowe floty są zapisywane centralnie i widoczne po odświeżeniu oraz dla pozostałych pracowników.
- Przy transporcie wojskowym sprawdzana jest polska narodowość kierowcy oraz wykluczenie każdej marki ciągnika zawierającej „Volvo”. Niezgodny kierowca nie może zostać dopasowany ani przypisany do relacji.
- Dodano migrację `supabase/034_fleet_extended_details.sql`.

WERYFIKACJA v265
- Kontrola składni aplikacji, walidacji NIP-u, zapisu danych dodatkowych floty oraz reguł zgodności transportu wojskowego.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v264 - wymuszenie aktualnych uprawnień
Build/cache: v264-feature-enforcement

- Przy starcie plan pobiera uprawnienia bezpośrednio z centralnego zapisu, zamiast polegać na kopii danych z poprzedniego logowania.
- Otwarte sesje użytkowników sprawdzają zmianę co 30 sekund oraz od razu po powrocie do karty lub okna.
- Dodano samowystarczalną migrację `supabase/033_feature_permissions_enforcement.sql`, która tworzy pełny mechanizm uprawnień, jeśli wcześniejsze migracje nie zostały wykonane.
- Profile bez ustawień otrzymują komplet wyłączonych funkcji. Po wdrożeniu administrator powinien zapisać ustawienia użytkownika ponownie, aby ustawić wybrane moduły.

WERYFIKACJA v264
- Kontrola składni aplikacji, odczytu centralnych uprawnień, odświeżania aktywnej sesji i kompletności migracji SQL.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v263 - domyślne blokowanie funkcji
Build/cache: v263-feature-access

- Suwak znajduje się bezpośrednio przy nazwie funkcji, także w szerokich kolumnach panelu administratora.
- Zablokowane funkcje są usuwane z dostępnych zakładek i paneli, a ich bezpośrednie wywołanie pokazuje komunikat o braku dostępu.
- Nowe konta otrzymują wszystkie funkcje wyłączone. Administrator włącza tylko potrzebne moduły dla danego użytkownika.
- Dodano migrację `supabase/032_default_feature_permissions_off.sql` ustawiającą bezpieczny zestaw domyślnych uprawnień dla nowych profili. Istniejące konta zachowują obecne ustawienia.

WERYFIKACJA v263
- Kontrola składni aplikacji, skryptów inline, domyślnego zestawu uprawnień oraz ograniczeń widoczności paneli.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v262 - przełączniki funkcji i Tryb Excelowy
Build/cache: v262-feature-toggles

- Przełączniki indywidualnych funkcji użytkownika mają formę okrągłych suwaków w stylu Androida, z wyraźnym stanem włączenia i wyłączenia.
- Dodano osobne uprawnienie „Tryb Excelowy”. Użytkownik z wyłączoną opcją pracuje na zwykłym planie kierowców, także wtedy, gdy globalnym ustawieniem jest tryb Excelowy.
- Nowe uprawnienie korzysta z istniejącego centralnego zapisu uprawnień; migracja z v261 pozostaje aktualna.

WERYFIKACJA v262
- Kontrola składni aplikacji i wszystkich skryptów inline oraz sprawdzenie działania uprawnienia w wyborze sposobu pracy planu.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v261 - indywidualne uprawnienia funkcji
Build/cache: v261-feature-permissions

- Administrator ma przy każdym użytkowniku rozwijaną sekcję „Funkcje użytkownika” z niezależnymi przełącznikami: Optymalizacja tras, Historia tras, Projekty wieloautowe, Transporty wojskowe, Statystyki, Zapytania o ładunek, Klienci w rejonie, Planowane relacje, Wolne ładunki, Czat dotyczący relacji i Baza klientów.
- Wyłączona funkcja nie jest dostępna z panelu, zakładki ani bezpośredniego wywołania. Administrator zachowuje pełny dostęp.
- Dodano migrację `supabase/031_user_feature_permissions.sql`, która zapisuje ustawienia centralnie w profilu użytkownika.

WERYFIKACJA v261
- Kontrola składni aplikacji i skryptów inline oraz kontrola mapy funkcji, zabezpieczeń wejść i migracji SQL.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v260 - płynny plan na tablecie
Build/cache: v260-tablet-scroll

- Na ekranach dotykowych kafelki i wiersze planu nie używają już `content-visibility`, które powodowało ich krótkie znikanie podczas szybkiego przewijania na Surface.
- Przesuwanie jednym palcem działa także bezpośrednio po kafelkach, w pionie i poziomie. Ruch palca nie otworzy przypadkowo szczegółów relacji.
- Optymalizacja renderowania pustych pól pozostaje aktywna na komputerach bez ekranu dotykowego.

WERYFIKACJA v260
- Kontrola składni aplikacji i skryptów inline oraz kontrola reguł tabletowego przewijania i blokady przypadkowego kliknięcia po przesunięciu.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v259 - trwały zapis relacji między komputerami
Build/cache: v259-central-relations

- Nowy kafelek relacji jest lokalnie chroniony do chwili potwierdzenia zapisu przez Supabase. Pierwszy snapshot z drugiej sesji nie może już usunąć go przed wysłaniem zapisu.
- Kafelek pozostaje widoczny podczas zapisu i po potwierdzeniu przechodzi na wspólny stan dostępny na wszystkich zalogowanych komputerach.
- Usunięcie przykładowych danych po 18.10 dotyczy tylko relacji demonstracyjnych. Nie usuwa już relacji, Wolnych ładunków ani Planowanych relacji użytkowników z późniejszym terminem.

WERYFIKACJA v259
- Kontrola składni modułu aplikacji oraz statyczna kontrola ochrony lokalnego zapisu, odbioru snapshotu i filtra danych demonstracyjnych.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v254 - statystyki, daty i komentarze
Build/cache: v254-route-dates-comments

- W statystykach opcja „Wszyscy spedytorzy” obejmuje pełną listę spedytorów oraz ich relacje, także gdy zalogowany jest spedytor.
- Szczegóły relacji mają osobne pola daty załadunku i rozładunku. Nowa data załadunku przesuwa rozładunek na następny dzień tylko wtedy, gdy dotychczasowa data byłaby wcześniejsza.
- Oś czasu wykorzystuje datę załadunku i rozładunku, dlatego kafelek obejmuje cały okres relacji i aktualizuje się bezpośrednio po zmianie daty.
- Dodano komentarz do relacji; jest zapisywany w historii klienta oraz do synchronizacji Supabase jako `route_comment`.

WERYFIKACJA v254
- Kontrola składni aplikacji i skryptów inline oraz kontrola filtrowania statystyk, edycji dat i zapisu komentarza do historii.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v253 - linia bieżącej godziny
Build/cache: v253-current-time-line

- Czerwona linia wskazująca bieżącą godzinę ma szerokość 4 px zamiast 2 px. Jej środek pozostaje w tym samym miejscu na osi czasu.

WERYFIKACJA v253
- Kontrola składni aplikacji, skryptów inline oraz szerokości i centrowania linii bieżącej godziny.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v252 - klawiatura i projekty wieloautowe
Build/cache: v252-keyboard-projects

- Dynamiczne elementy uruchamiane kliknięciem otrzymują fokus oraz obsługę Enter i Spacji. Wszystkie natywne przyciski i pola pozostają dostępne klawiszem Tab.
- Fokus klawiatury jest wyraźnie oznaczony. Na kafelku relacji skrót Shift+F10 albo klawisz Menu otwiera menu relacji bez myszy.
- Przykładowe relacje zawierają dwa projekty transportowe: Warszawa → Gdańsk na 3 auta oraz Katowice → Szczecin na 4 auta. Kafelki mają oznaczenie P 1/3, P 2/3 itd.

WERYFIKACJA v252
- Kontrola składni aplikacji i skryptów inline oraz statyczna kontrola obsługi Enter, Spacji, Shift+F10 i danych projektów.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v251 - płynne przewijanie planu
Build/cache: v251-scroll-smoothness

- Pozycjonowanie listy miejscowości podczas szybkiej edycji jest grupowane do jednej operacji na klatkę animacji zamiast wykonywać obliczenia dla każdego zdarzenia scroll.
- W trakcie przewijania tablicy, na komputerze i telefonie, tymczasowo wyłączane są cienie, filtry, przejścia i animacje kafelków. Pełny wygląd wraca po zatrzymaniu ruchu.
- Obsługa scrollowania tablicy nie blokuje już przeglądarki aktywnym nasłuchem zdarzenia.

WERYFIKACJA v251
- Kontrola składni aplikacji i skryptów inline oraz kontrola grupowania pozycji sugestii i trybu przewijania planu.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v250 - mobilny panel i kolumna kierowcy
Build/cache: v250-mobile-panel-identity

- W wysuwanym panelu mobilnym wyświetlana jest nazwa aktualnie zalogowanego spedytora.
- Uchwyt panelu przesuwa się w lewo po jego otwarciu, więc nie nachodzi na panel ani jego przyciski.
- W mobilnej tabeli wymuszono widoczny nagłówek kolumny „Kierowca”.

WERYFIKACJA v250
- Kontrola składni aplikacji i skryptów inline oraz kontrola selektorów panelu, uchwytu i nagłówka kolumny.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v249 - mobilny widok tabeli relacji
Build/cache: v249-mobile-table-focus

- Na telefonie usunięto górny nagłówek oraz wiersz „Plan kierowców”, dzięki czemu tabela wykorzystuje pełną wysokość ekranu.
- Strzałka wysuwająca panel znajduje się na środku prawej krawędzi. Sam panel jest domyślnie ukryty i wysuwa się z tej strony.
- Do panelu dodano działania konta: „Administracja” z ikoną tarczy dla administratora oraz „Wyloguj” z ikoną wyjścia. Nie zajmują już miejsca nad tabelą.

WERYFIKACJA v249
- Kontrola składni aplikacji i skryptów inline oraz kontrola mobilnych selektorów nagłówka, tabeli, panelu i akcji konta.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v248 - promienie tras w Historii
Build/cache: v248-history-route-radius

- W Asystencie spedytora → Historia dodano niezależne filtry: „Załadunek w promieniu” i „Rozładunek w promieniu”.
- Wprowadź np. Warszawę i promień załadunku oraz Kraków i promień rozładunku. Wynik musi spełniać oba warunki jednocześnie.
- W wynikach z aktywnym promieniem wyświetlana jest odległość odpowiednio od punktu załadunku i rozładunku. Lista miejscowości i kodów pozostaje dostępna w polach wyszukiwania.

WERYFIKACJA v248
- Kontrola składni aplikacji i skryptów inline oraz walidacja obu filtrów promienia, ich połączenia i renderowania odległości.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v247 - płynne uruchamianie planu
Build/cache: v247-coalesced-startup

- Po zalogowaniu plan jest nadal widoczny od razu, ale snapshoty użytkowników, floty, relacji i kolejek nie przebudowują już kolejno całej tablicy.
- Pierwszy pełny render danych z Supabase następuje raz po otrzymaniu podstawowych snapshotów, z bezpiecznym limitem 2,2 s na brakującą odpowiedź.
- Dane tygodniowych rozliczeń nie blokują startu, a snapshot kolejki nie wymusza renderu w trakcie grupowania startowego.

WERYFIKACJA v247
- Kontrola składni aplikacji i skryptów inline oraz statyczna kontrola jednego końcowego renderu startowego.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v246 - zwijane dopasowania pojazdów
Build/cache: v246-match-details-toggle

- Lista pojazdów, lokalizacji i kilometrów z dopasowania jest domyślnie ukryta.
- Kliknięcie przycisku „Dopasowane” lub „Dopasowany pojazd” rozwija listę; kolejne kliknięcie ją zwija.
- Przycisk ma czytelny stan rozwinięcia i zachowuje działanie szybkiego pobrania relacji na tablicę.

WERYFIKACJA v246
- Kontrola składni aplikacji i skryptów inline oraz sprawdzenie przycisku i warunkowego renderowania listy dopasowań.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v245 - jawne archiwizowanie kolejek
Build/cache: v245-explicit-queue-archive

- Usunięto automatyczne archiwizowanie wpisów z centralnej kolejki podczas uruchamiania aplikacji. Brak relacji w lokalnym widoku usuwa teraz wyłącznie lokalny punkt synchronizacji.
- Archiwizacja centralnego wpisu jest wysyłana wyłącznie po świadomym działaniu użytkownika: usunięciu, przeniesieniu między kolejkami albo pobraniu planowanej relacji na tablicę.
- Eliminuje to komunikat „Nie możesz usunąć wpisu należącego do innego spedytora.” pojawiający się bez działania użytkownika po uruchomieniu strony.

WERYFIKACJA v245
- Kontrola składni aplikacji i skryptów inline oraz sprawdzenie, że startowa synchronizacja nie wysyła żądania `top-dragon-load-queue-archive`.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v244 - synchronizacja kolejek i uproszczone karty
Build/cache: v244-queue-sync-and-cards

- Synchronizacja w tle nie próbuje archiwizować relacji utworzonej przez innego spedytora; eliminuje to błędny komunikat o braku prawa do usunięcia wpisu.
- Menu „+ Dodaj relację” w Wolnych ładunkach zawiera ręczne dodawanie relacji, tak jak w Planowanych relacjach.
- Karty Wolnych ładunków i Planowanych relacji pokazują na liście tylko miasta. Daty, adresy, punkty pośrednie, statusy i pozostałe dane są dostępne po „Pokaż szczegóły”.

WERYFIKACJA v244
- Kontrola składni aplikacji i skryptów inline oraz kontroli autorstwa przy automatycznej archiwizacji.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v243 - wielopunktowe zlecenia z AI
Build/cache: v243-multistop-ai-mapping

- Formularz buduje kolejność punktów z `stops`: pierwszy załadunek, drugi załadunek, pierwszy rozładunek oraz drugi rozładunek.
- Nie powiela ostatniego rozładunku w polu drugiego rozładunku; dla przykładu z TR/10/268 zapisze Radom, a następnie Płock.
- Jawne polskie daty, dni tygodnia i godziny z wiadomości stanowią bezpieczne uzupełnienie odpowiedzi AI, gdy model pominie te dane.

WERYFIKACJA v243
- Kontrola składni endpointu, aplikacji i skryptów inline oraz danych trasy wielopunktowej.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v242 - normalizacja odpowiedzi analizatora AI
Build/cache: v242-ai-route-normalization

- Analiza tekstu akceptuje relację zapisaną przez model w `routes` oraz poprawną pojedynczą relację zapisaną w polach głównych odpowiedzi.
- Endpoint wymusza umieszczenie każdej rozpoznanej relacji tekstowej w `routes`, również gdy wiadomość opisuje tylko jedną trasę.
- Chroni to przed komunikatem „Nie rozpoznano relacji” dla kompletnego zlecenia z wieloma punktami załadunku i rozładunku.

WERYFIKACJA v242
- Kontrola składni endpointu, aplikacji i skryptów inline oraz dwóch wariantów odpowiedzi AI.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v241 - walidacja adresu Supabase
Build/cache: v241-supabase-url-validation

- Endpoint rozpoznaje błędną wartość adresu Supabase i zwraca jasny błąd konfiguracji 503 zamiast błędu 500.
- Wartość `sb_publishable_…` jest kluczem publikowalnym i nie może znajdować się w `VITE_SUPABASE_URL` ani `SUPABASE_URL`.

WERYFIKACJA v241
- Kontrola składni endpointu, aplikacji i skryptów inline oraz sprawdzenie aktualnego identyfikatora cache.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v240 - diagnostyka analizatora OpenAI
Build/cache: v240-openai-diagnostics

- Endpoint zapisuje w logach Vercel wyłącznie etap oraz komunikat błędu; nie zapisuje tekstu zlecenia, tokenu ani klucza API.
- Walidacja sesji i profilu Supabase nie zakłada już poprawnej tablicy w odpowiedzi API, więc wadliwa odpowiedź nie powoduje błędu 500.
- Gdy działa parser lokalny, komunikat w aplikacji zawiera skrót faktycznej przyczyny błędu AI zamiast ogólnego ostrzeżenia.

WERYFIKACJA v240
- Kontrola składni endpointu, aplikacji i skryptów inline oraz sprawdzenie aktualnego identyfikatora cache.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v239 - OpenAI i wyrównanie wyboru spedytora
Build/cache: v239-openai-picker-align

- Etykieta spedytora i strzałka rozwijania w polu wyboru są wyrównane pionowo przez wspólny układ flex oraz stałą linię elementów.
- Poprawka obejmuje wybór głównego opiekuna klienta i pozostałe pola korzystające z tego samego komponentu.
- Paczka zawiera również pełny endpoint OpenAI oraz zgodność z aktualnymi zmiennymi `VITE_SUPABASE_*`, dlatego może zostać wdrożona samodzielnie.

WERYFIKACJA v239
- Kontrola składni skryptów inline, stylu selektora oraz aktualnego identyfikatora cache.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v238 - wyrównanie wyboru spedytora
Build/cache: v238-dispatcher-picker-align

- Etykieta spedytora i strzałka rozwijania w polu wyboru są wyrównane pionowo przez wspólny układ flex oraz stałą linię elementów.
- Poprawka obejmuje wybór głównego opiekuna klienta i pozostałe pola korzystające z tego samego komponentu.

WERYFIKACJA v238
- Kontrola składni skryptów inline, stylu selektora oraz aktualnego identyfikatora cache.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v237 - konfiguracja Supabase dla OpenAI
Build/cache: v237-openai-supabase-env

- Endpoint OpenAI obsługuje także istniejące zmienne `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`, wykryte w konfiguracji wdrożenia projektu.
- Nie trzeba tworzyć dodatkowych kopii zmiennych Supabase w Vercel. Endpoint nadal używa ich tylko serwerowo do weryfikacji aktywnej sesji i roli.

WERYFIKACJA v237
- Kontrola pobierania adresu i klucza publikowalnego Supabase z obu poprawnych nazw środowiskowych, składni endpointu oraz zawartości paczki.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v236 - analizator zleceń OpenAI
Build/cache: v236-openai-order-analysis

- Analizator AI dla tekstu, PDF, Word, RTF, ODT i TXT korzysta z jednego serwerowego endpointu `api/openai-order-analysis.js` oraz Responses API OpenAI ze Structured Outputs.
- Zlecenia tekstowe zwracają osobne relacje, a dokumenty uzupełniają obecny formularz bez zmiany procesu sprawdzania i zapisu przez spedytora.
- Endpoint sprawdza sesję Supabase, aktywność konta i rolę użytkownika przed wysłaniem danych do AI. Klucz `OPENAI_API_KEY` pozostaje wyłącznie w zmiennych środowiskowych Vercel.
- Dokumenty są ograniczone do 4 MB, a tekst do 180 kB, co zapobiega niekontrolowanemu wykorzystaniu zasobów funkcji. PDF jest analizowany w trybie oszczędnym obrazu; dane można nadal poprawić przed zapisem.

Wdrożenie V236:
1. Wgraj pliki z paczki do katalogu głównego projektu, zachowując foldery `api`, `public` i `src`.
2. W Vercel → Settings → Environment Variables dodaj `OPENAI_API_KEY` dla Production, Preview i Development.
3. Opcjonalnie ustaw `OPENAI_IMPORT_MODEL`; bez tej zmiennej endpoint użyje `gpt-6-astra`.
4. Pozostaw istniejące `SUPABASE_URL` oraz `SUPABASE_ANON_KEY` albo `SUPABASE_PUBLISHABLE_KEY`, ponieważ endpoint używa ich wyłącznie do potwierdzenia sesji i roli.
5. Wdróż ponownie projekt i wykonaj pełne odświeżenie strony.

WERYFIKACJA v236
- Kontrola składni endpointu, obsługi plików i tekstu, limitów wejścia, weryfikacji użytkownika oraz zgodności formatu odpowiedzi z istniejącymi normalizatorami formularza.
- Kontrola składni `src/main.js` i wszystkich skryptów inline `public/tms.html`.
- Bez nowego pliku test-v.

----------------------------------------------------------------

AKTUALIZACJA v235 - menu, terminy i przykładowy plan
Build/cache: v235-menu-expiry-october

- Uchwyt wysuwanego menu komputerowego ma szerokość 5 cm i jest wyśrodkowany u góry ekranu.
- Wolny ładunek jest archiwizowany po przekroczeniu daty i godziny załadunku; reguła działa w widoku lokalnym i podczas synchronizacji z Supabase.
- Przycisk „✦ PDF, Word lub tekst” ma takie same wymiary jak „+ Dodaj relację” w obu kolejkach.
- Przykładowe relacje planu kierowców obejmują okres od 28 września do 31 października.

WERYFIKACJA v235
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola reguły archiwizacji dla terminu załadunku, szerokości uchwytu oraz przycisków kolejki.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v234 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v234 - dokładny wybór lokalizacji
Build/cache: v234-exact-location-choice

- Kliknięta sugestia przekazuje do relacji dokładnie wybraną miejscowość, pełny kod pocztowy oraz współrzędne.
- Zapis nie wykonuje już wtórnego dopasowania po samej nazwie miejscowości, więc wybór konkretnego kodu nie może zostać nadpisany.

WERYFIKACJA v234
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola przekazania danych klikniętej sugestii do relacji, drugiego rozładunku oraz danych mapy.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v233 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v233 - Enter otwiera szczegóły relacji
Build/cache: v233-enter-route-details

- W trybie pracy jak w Excelu Enter na zaznaczonym kafelku otwiera „Szczegóły relacji”.
- Strzałki, kopiowanie, wklejanie i usuwanie kafelków zachowują dotychczasowe działanie.

WERYFIKACJA v233
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola obsługi Enter wyłącznie dla zaznaczonej relacji oraz braku przejęcia klawisza w polach formularzy.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v232 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v232 - pełne sugestie na dolnych wierszach
Build/cache: v232-unload-suggestion-viewport

- Sugestie miejscowości i kodów przy dolnych wierszach planu otwierają się nad kafelkiem, gdy pod nim brakuje miejsca.
- Szerokość listy dopasowuje się do ekranu i zachowuje widoczność pełnego kodu pocztowego.

WERYFIKACJA v232
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola pozycjonowania listy nad oraz pod polem, ograniczenia jej do widocznego obszaru i widoczności kodu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v231 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v231 - Enter w potwierdzeniu usunięcia
Build/cache: v231-enter-delete-confirm

- Po otwarciu potwierdzenia usunięcia relacji fokus przechodzi na przycisk „Usuń relację”.
- Klawisz Enter natychmiast zatwierdza usunięcie, a przycisk „Anuluj” nadal można wybrać myszą lub klawiaturą.

WERYFIKACJA v231
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola fokusu przycisku potwierdzenia po otwarciu dialogu oraz jego wywołania klawiszem Enter.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v230 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v230 - widoczne sugestie rozładunku
Build/cache: v230-quick-unload-suggestions

- Lista miejscowości i kodów pocztowych podczas szybkiej edycji kafelka jest wyświetlana nad całą tablicą, bez przycinania przez siatkę lub kafelek.
- Sugestie korzystają bezpośrednio z bazy PNA i pokazują pełny kod, z wyróżnionymi dwiema pierwszymi cyframi.
- Kliknięcie sugestii nadal zapisuje miejscowość oraz pełny kod pocztowy w relacji.

WERYFIKACJA v230
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola utworzenia listy poza kafelkiem, wyników bazy PNA i czyszczenia listy po zapisie lub anulowaniu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v229 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v229 - przełącznik motywu na komputerze
Build/cache: v229-desktop-theme-menu

- Przywrócono przełącznik „Tryb jasny / Tryb ciemny” w rozwijanym górnym pasku wersji komputerowej.
- Przycisk pozostaje ukryty w nagłówku mobilnym, gdzie przełącznik jest dostępny przez „Więcej”.

WERYFIKACJA v229
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola renderowania przycisku, zmiany etykiety oraz ukrywania go na ekranach mobilnych.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v228 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v228 - nawigacja strzałkami w planie
Build/cache: v228-excel-arrow-navigation

- W trybie pracy jak w Excelu strzałki klawiatury przechodzą do sąsiedniego dnia lub kierowcy.
- Przejście zaznacza kafelek w docelowej komórce, a pusta komórka pozostaje gotowa do wklejenia relacji.
- Widok automatycznie przewija się tylko do wskazywanej komórki; strzałki nie przejmują sterowania podczas wpisywania w formularzu.

WERYFIKACJA v228
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola obsługi czterech strzałek, granic planu oraz wykluczenia pól formularzy.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v227 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v227 - kod pocztowy w szybkiej edycji rozładunku
Build/cache: v227-quick-unload-postal

- Podpowiedzi przy szybkim wpisywaniu rozładunku pokazują miejscowość oraz pełny kod pocztowy.
- Dwie pierwsze cyfry kodu są wyróżnione, aby szybciej odróżniać miejscowości o tej samej nazwie.
- Wybór podpowiedzi jednym kliknięciem nadal zapisuje pełny kod przy relacji.

WERYFIKACJA v227
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola widoczności pełnego kodu i zapisu wybranej podpowiedzi w szybkiej edycji rozładunku.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v226 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v218 - przełączanie mapy, kolejki i wyniku AI
Build/cache: request-workflow-v218-mobile-queue-ai-result

- Otwarcie Wolnych ładunków lub Planowanych relacji zamyka wcześniej otwartą pełnoekranową mapę.
- Dodano widoczny opis kolumny „Kierowca”: „Imię i nazwisko”.
- Po analizie tekstu Analizator AI otwiera formularz pierwszej rozpoznanej relacji natychmiast, bez oczekiwania na dodatkowe potwierdzenia klienta.

WERYFIKACJA v218
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola wykluczania mapy i kolejek, opisu kolumny kierowcy oraz natychmiastowego otwierania wyniku analizy tekstu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v217 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v217 - uproszczone menu i ikona motywu
Build/cache: request-workflow-v217-more-theme-icon

- Usunięto przycisk „Zamknij” z panelu „Więcej”. Panel zamyka się przez ponowne użycie ikony lub dotknięcie tła.
- Usunięto przełącznik trybu jasnego/ciemnego z górnego nagłówka.
- Przełącznik motywu w „Więcej” używa ikony księżyca w trybie jasnym i słońca w trybie ciemnym.

WERYFIKACJA v217
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola braku przycisku zamknięcia w „Więcej”, braku przełącznika motywu w nagłówku i dynamicznej ikony motywu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v216 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v216 - stabilna siatka i wycentrowana mapa
Build/cache: request-workflow-v216-grid-map-center

- Dodano wewnętrzną linię poziomą komórek planu, aby linie siatki nie znikały przy ułamkowym skalowaniu przeglądarki.
- Mobilna Mapa rozładunków po otwarciu odświeża wymiary i ustawia widok na środek Polski.
- Usunięto niedziałającą ikonę Plan z prawego menu mobilnego.
- Strzałka prawego menu ma półprzezroczysty wygląd i staje się pełna podczas dotknięcia.

WERYFIKACJA v216
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola stabilnych linii siatki, centrowania mapy, braku ikony Plan i wyglądu strzałki.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v215 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v215 - zamykanie listy pojazdów i pełna szerokość planu
Build/cache: request-workflow-v215-map-filter-fullwidth

- Lista „Pojazdy” na Mapie rozładunków zamyka się po dotknięciu pustego obszaru poza listą, bez pełnego odświeżania mapy.
- Plan kierowców nie ma już maksymalnej szerokości 1900 px. Przy pomniejszeniu przeglądarki wykorzystuje całą szerokość okna i pokazuje więcej relacji jednocześnie.

WERYFIKACJA v215
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola zamykania listy pojazdów poza jej obszarem oraz braku limitu szerokości głównego planu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v214 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v214 - prawe menu i uporządkowana mapa mobilna
Build/cache: request-workflow-v214-mobile-side-menu-map

- Mobilne zakładki są wysuwanym, pionowym paskiem po prawej stronie; strzałka otwiera i ukrywa go bez ograniczania powierzchni planu.
- Mapa rozładunków ma jednolity nagłówek, równe przyciski w układzie dwóch kolumn oraz pełną szerokość filtrów okresu i daty.
- Ustawienia planu pozostają dostępne wyłącznie w panelu „Więcej”.

WERYFIKACJA v214
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola wysuwanego prawego menu oraz mobilnego układu elementów Mapy rozładunków.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v213 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v213 - mobilny nagłówek i przypięty kierowca
Build/cache: request-workflow-v213-mobile-header-driver-stick

- Dolną strzałkę umieszczono wyżej w prawym dolnym rogu, ponad paskiem przeglądarki Brave.
- Górny nagłówek jest stale widoczny; logo i przyciski konta są w jednym poziomym wierszu.
- Na mobilnym planie kolumna „Kierowca” ma wymuszone przypięcie poziome i nie przesuwa się wraz z kafelkami relacji.
- Mobilny plan używa stałej skali CSS, aby zachować działanie przypiętej kolumny w Chromium na telefonach.

WERYFIKACJA v213
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola górnego nagłówka, pozycji dolnej strzałki oraz przypięcia kolumny kierowcy.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v212 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v212 - Brave, pełnoekranowa mapa i panele mobilne
Build/cache: request-workflow-v212-mobile-brave-map

- Dolna strzałka jest wyśrodkowana, ma kontrastowe obramowanie i stały dolny offset bez zależności od bezpiecznego obszaru Brave.
- Zwinięty górny nagłówek jest przezroczysty: na ekranie widać wyłącznie strzałkę.
- Mapa w telefonie wyświetla się pełnoekranowo, a dolne menu pozostaje nad nią do jej zamknięcia.
- Usunięto przyciski „Zamknij” z Wolnych ładunków i Planowanych relacji. Panele zamykają się przez ponowne wybranie ikony.
- Otwarcie innej ikony zamyka wcześniej otwarte Wolne ładunki, Planowane relacje albo Mapę. Ustawienia planu są dostępne w „Więcej”.

WERYFIKACJA v212
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola stałej dolnej strzałki, przezroczystego zwiniętego nagłówka, pełnoekranowej mapy i wyłącznych paneli mobilnych.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v211 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v211 - stała dolna strzałka mobilna
Build/cache: request-workflow-v211-mobile-visible-toggle

- Dolna strzałka została przeniesiona poza kontener aplikacji i plan kierowców, do niezależnej warstwy ekranu.
- Strzałka ma wymuszoną widoczność, pozycję fixed oraz wysoki priorytet warstw, więc pozostaje widoczna od uruchomienia strony.
- Po zwinięciu górnej i dolnej części widoczne są wyłącznie dwie strzałki oraz Plan kierowców.

WERYFIKACJA v211
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola niezależnego renderowania oraz widoczności dolnej strzałki.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v210 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v210 - otwieranie paneli z dolnego menu
Build/cache: request-workflow-v210-mobile-panel-events

- Kliknięcia ikon Plan, Wolne, Planowane, Mapa i Więcej zatrzymują propagację zdarzenia do powierzchni aplikacji.
- Panele Wolne ładunki i Planowane relacje nie są już zamykane natychmiast po otwarciu na telefonie.
- Zachowano ponowne kliknięcie aktywnej ikony jako zamknięcie wyświetlanego panelu.

WERYFIKACJA v210
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola przekazywania i zatrzymywania zdarzeń dla pięciu mobilnych zakładek.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v209 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v209 - szybkie przełączniki mobilne
Build/cache: request-workflow-v209-mobile-fast-toggle

- Górna strzałka steruje wyłącznie klasą nagłówka zamiast klasy całej aplikacji, dzięki czemu nie wywołuje przeliczenia planu kierowców.
- Ponowne naciśnięcie aktywnej zakładki Wolne, Planowane, Mapa albo Więcej zamyka wyświetlany element i przywraca Plan kierowców.
- Ponowne naciśnięcie Planu nie resetuje zakresu dat ani położenia tablicy.

WERYFIKACJA v209
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola izolowanego przełączania nagłówka oraz aktywacji/dezaktywacji wszystkich dolnych zakładek.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v208 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v208 - usunięcie pustych pól mobilnych
Build/cache: request-workflow-v208-mobile-no-spacers

- Usunięto mobilne puste pola nad i pod planem, w tym rezerwę pozostawioną przez ukryte menu.
- Plan zaczyna się bezpośrednio pod stałym górnym przyciskiem; dolna strzałka pozostaje stale dostępna przy dolnej krawędzi ekranu.
- Pokazanie lub ukrycie nagłówka nie zmienia już położenia planu i nie wymusza przeliczenia dużej tablicy.
- Nagłówek po pokazaniu nakłada się tymczasowo na górę planu, pozostawiając go nieruchomym.

WERYFIKACJA v208
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola usunięcia mobilnych odstępów, stałych przycisków oraz aktualnego build/cache ID.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v207 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v207 - plan kierowców jako widok startowy mobilny
Build/cache: request-workflow-v207-mobile-plan-focus

- Telefon otwiera teraz bezpośrednio Plan kierowców, bez widocznego górnego nagłówka i dolnego menu.
- Górny przycisk pozostaje stale na ekranie i otwiera lub ukrywa cały nagłówek, łącznie z logo.
- Dolny przycisk pozostaje stale na ekranie i otwiera lub ukrywa cały pasek zakładek.
- Kierunek dolnej strzałki odpowiada działaniu: w dół przy widocznym menu, w górę przy ukrytym menu.

WERYFIKACJA v207
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola domyślnie zwiniętego nagłówka i menu, obu strzałek oraz aktualnego build/cache ID.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v206 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v206 - stale widoczne sterowanie mobilne
Build/cache: request-workflow-v206-mobile-fixed-controls

- Górny nagłówek oraz dolne menu są przypięte do ekranu telefonu i nie znikają podczas przewijania.
- Treść planu otrzymała odstęp od przypiętego nagłówka, dlatego przyciski i zawartość nie nakładają się na siebie.
- Przełączniki ukrywania górnego nagłówka i dolnego menu działają bez ponownego renderowania aplikacji, więc ich stan nie jest resetowany.
- Ukryte menu pozostawia widoczny przycisk do jego natychmiastowego ponownego pokazania.

WERYFIKACJA v206
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola przypięcia obu pasków, działania obu przełączników oraz aktualnego build/cache ID.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v205 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v205 - sterowanie układem mobilnym
Build/cache: request-workflow-v205-mobile-layout-controls

- Przywrócono pełny dolny pasek zakładek: Plan, Wolne, Planowane, Mapa i Więcej.
- Dodano osobny przycisk do zwijania oraz ponownego pokazania dolnego paska zakładek.
- Górny nagłówek z logo i przyciskami konta jest domyślnie widoczny.
- Dodano osobny przycisk w prawym górnym rogu do zwijania oraz ponownego pokazania górnej części nagłówka.
- Zmiany dotyczą wyłącznie widoku mobilnego; układ desktopowy pozostaje bez zmian.

WERYFIKACJA v205
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola obu mobilnych przełączników, pełnego paska zakładek oraz domyślnie rozwiniętego nagłówka.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v204 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v204 - nagłówek i pełny plan mobilny
Build/cache: request-workflow-v204-mobile-header-tabs

- Mobilny plan domyślnie używa pełnego desktopowego zakresu 13 dni. Przycisk „Widok 4 dni” pozostaje opcjonalnym trybem kompaktowym.
- Nagłówki kolumn z datami są przyklejone nad kafelkami podczas pionowego przewijania planu.
- Przyciski kontaktu i ustawień kierowcy są pod imieniem i nazwiskiem, zamiast obok niego.
- W prawym górnym obszarze nagłówka dodano przycisk wysuwający ikony: Asystent, Najbliższy pojazd, Wolne ładunki, Planowane relacje, Mapa i Statystyki. Ten sam przycisk rozwija także nagłówek z kontem i akcjami użytkownika.
- Logo i komunikat „Uruchamianie panelu…” są wyśrodkowane na ekranie ładowania.

WERYFIKACJA v204
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola domyślnego zakresu 13 dni, wysuwanego nagłówka, ikon, przyklejonych dat i układu akcji kierowcy.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v203 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v203 - pełny zakres planu na telefonie
Build/cache: request-workflow-v203-mobile-full-range

- Telefon zachowuje domyślne cztery dni, ale przy Planie kierowców ma przycisk „Pełny zakres: 13 dni”. Po włączeniu pokazuje tyle samo dni co desktop: 2 dni wstecz, bieżący i 10 dni do przodu.
- Przycisk po przełączeniu pokazuje „Widok 4 dni” i pozwala wrócić do kompaktowego układu.
- Gest w lewo i prawo działa na kafelkach relacji oraz pustych komórkach, a nie tylko w nagłówku kolumn.

WERYFIKACJA v203
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola zakresu 4/13 dni, handlera przełącznika oraz `touch-action` kafelków.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v202 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v202 - mobilna regulacja widoku i ikony
Build/cache: request-workflow-v202-mobile-controls

- Na telefonie kontroler „- / % / +” jest widoczny przy Planie kierowców. Pozwala pomniejszyć widok i wyświetlić więcej kafelków lub powiększyć go dla czytelności.
- Dolna nawigacja otrzymała wymuszony, kontrastowy rendering SVG ikon oraz stan aktywnej zakładki.
- Menu „Więcej” wyświetla ikony przy wszystkich narzędziach mobilnych.

WERYFIKACJA v202
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola handlerów mobilnej nawigacji, kontroli skali i identyfikatorów cache.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v201 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v201 - naprawa przewijania na telefonie
Build/cache: request-workflow-v201-mobile-scroll-fix

- Kafelki relacji nie blokują już pionowego gestu na telefonie. Przeciąganie pozostaje możliwe poziomo, a ruch góra–dół przewija plan.
- Mobilna tablica nie wykonuje już automatycznego ustawienia pozycji po każdym odświeżeniu. Ustawienie na dzisiejszym dniu działa tylko przy pierwszym uruchomieniu, obrocie telefonu albo świadomym wyborze „Plan”.
- Przywrócono naturalne przekazywanie przewijania pomiędzy planem a stroną i wyłączono mobilne przyciąganie przewijania, które powodowało odczuwalne zacięcia.
- Zamknięte panele mobilne nie przechwytują już dotyku.

WERYFIKACJA v201
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola gestów dotykowych, automatycznego pozycjonowania i zamkniętych paneli.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v200 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v200 - wygodna praca na telefonie
Build/cache: request-workflow-v200-mobile-workspace

- Telefon domyślnie pokazuje dzień wstecz, dzień bieżący i dwa dni do przodu. Plan ustawia się na kolumnie bieżącego dnia, a przejście do wcześniejszego lub późniejszego zakresu zachowuje czterodniowe okno.
- Dodano dolną nawigację: Plan, Wolne ładunki, Planowane relacje, Mapa i Więcej. W „Więcej” dostępne są Baza klientów, Najbliższy pojazd, ustawienia planu, Statystyki, Asystent i zmiana motywu.
- Na telefonie kolumna kierowcy pozostaje widoczna, a drugorzędne kolumny są zwinięte tylko wizualnie. Kafelki, pola i przyciski mają obszar dotykowy co najmniej 44 px.
- Szczegóły zlecenia, kolejki i Statystyki otwierają się od dołu jako panele; czat korzysta z mobilnego układu oraz pola wpisywania przy dolnej krawędzi.
- Mapa jest domyślnie zwinięta na telefonie i jej runtime ładuje się dopiero po otwarciu mapy. Sugestie lokalizacji mają najwyższy priorytet warstwy nad planem.

WERYFIKACJA v200
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola globalnych handlerów nawigacji mobilnej, zakresu dat i identyfikatorów cache.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v199 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v199 - pełny audyt i płynność kluczowych widoków
Build/cache: request-workflow-v199-full-audit-smoothness

- Mapa buduje grupy i statusy pojazdów jeden raz na cykl aktualizacji, zamiast wykonywać te same obliczenia podczas czyszczenia markerów, ich rysowania i dopasowania widoku.
- Usunięto drugi, starszy listener przewijania Statystyk; pozostał aktualny mechanizm obsługujący pionowe i poziome gesty.
- Usunięto potwierdzone pozostałości funkcji wycofanych z interfejsu: niewidoczne oznaczenia świeżości/ratingu/przyszłych relacji, stare puste ostrzeżenia dostępności, pusty panel wspólnej bazy, puste medale Statystyk i martwe pomocnicze funkcje mapy.
- Okresowe porządkowanie Wolnych ładunków po stronie Supabase nie wykonuje pełnego odczytu, gdy karta przeglądarki albo iframe TMS nie jest aktywna. Realtime i natychmiastowe odświeżenia po zmianie nadal działają.

WERYFIKACJA v199
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola handlerów inline oraz odwołań do usuniętych identyfikatorów.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v198 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.


AKTUALIZACJA v198 - płynność działania i czyszczenie nieużywanego kodu
Build/cache: request-workflow-v198-smooth-runtime-cleanup

- Synchronizacja klientów, relacji, kolejek i zapytań po zmianie nadal rozpoczyna się natychmiast, ale kontrolne skany działają co 5 sekund zamiast co 0,8 sekundy. Historia relacji ma kontrolę co 8 sekund zamiast co 1,8 sekundy.
- Dopasowania relacji i stan zakładek są odświeżane od razu po zdarzeniu, a ich kontrola awaryjna nie obciąża już planu co sekundę.
- Tablica liczy kolizje kafelków raz dla każdej pary relacji, buduje znacznik bieżącej godziny raz na render i grupuje dekorowanie nowych przycisków w pojedynczej klatce przeglądarki.
- Usunięto nieaktywne pozostałości po wycofanych funkcjach: automatyczne alerty właściciela klienta, wizualizację pauz, dawną linię czasu w komórce dnia, automatyczne przewijanie do bieżącej godziny, mierzenie tekstu kafelków i nieużywany test dopasowania kolejki.
- Odświeżanie wskaźników kafelków używa indeksu relacji zamiast wyszukiwania całej listy dla każdego kafelka.

WERYFIKACJA
Kontrola składni wszystkich osadzonych skryptów, kontrola braku usuniętych identyfikatorów, walidacja identyfikatorów cache oraz lekka kontrola pakietu. Bez nowego pliku test-v.
Paczka względem V197 zawiera wyłącznie zmienione pliki: public/tms.html i README_WDROZENIE.txt.

AKTUALIZACJA v180 - potwierdzanie adresu klienta jako bazy
Build/cache: request-workflow-v180-confirm-client-address-base

- Usunięto kategorię „Bazy i magazyny klienta” wraz z ręcznym formularzem dodatkowych lokalizacji.
- Administrator po zapisaniu adresu klienta widzi przycisk „Potwierdź adres jako bazę”. Jedno kliknięcie geokoduje i zapisuje aktualny adres klienta jako lokalizację widoczną na mapie.
- Przycisk jest nieaktywny bez zapisanego adresu; ponowne potwierdzenie tego samego adresu nie tworzy duplikatu.

WERYFIKACJA
Kontrola składni osadzonych skryptów i przepływu: uprawnienie administratora, adres klienta jako wejście, dotychczasowa ochrona przed duplikatem oraz aktualizacja mapy po zapisie. Bez nowego pliku test-v.
Paczka względem V179 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v179 - drugi rozładunek jako końcowa pozycja kierowcy
Build/cache: request-workflow-v179-final-second-unload-location

- Gdy relacja ma drugi rozładunek, jest on zawsze traktowany jako ostatnia lokalizacja kierowcy.
- Pozycja pojazdu na mapie, punkt dolotu kolejnej relacji i poprzedni punkt w zewnętrznej nawigacji używają drugiego rozładunku zamiast pierwszego.
- Geokodowanie i opis punktu mapy także odnoszą się do ostatniego rozładunku.

WERYFIKACJA
Kontrola składni osadzonych skryptów oraz użycia końcowego punktu rozładunku w położeniu pojazdu, mapie, dolocie i nawigacji. Bez nowego pliku test-v.
Paczka względem V178 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v178 - poprawione punkty map i pole waluty
Build/cache: request-workflow-v178-map-points-finance-fit

- Punkt dolotu z ostatniej lokalizacji kierowcy jest dodawany tylko wtedy, gdy kierowca ma relację zakończoną dokładnie poprzedniego dnia. Starsza relacja nie jest już używana jako dolot.
- Link Otwórz Google Maps prowadzi przez: poprzedni rozładunek (gdy spełnia powyższą regułę), załadunek, drugi załadunek, rozładunek i drugi rozładunek. Puste punkty są pomijane.
- W Szczegółach zlecenia zmniejszono czcionkę, szerokość i odstępy pola waluty, aby mieściło się w komórce finansowej.

WERYFIKACJA
Kontrola składni osadzonych skryptów oraz kontrola listy punktów przekazywanej do Google Maps, warunku poprzedniego dnia i reguł CSS pola waluty. Bez nowego pliku test-v.
Paczka względem V177 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v177 - niezależny podział relacji, łączenie i kolor czcionki
Build/cache: request-workflow-v177-split-merge-route-colors

- Podziel tworzy dwie niezależne relacje w tej samej dacie. Każda zajmuje połowę kolumny, ma własne menu, własny status spedytora i własny status rozliczeń.
- Druga połowa od razu otwiera szybkie wpisywanie miejscowości. Można ją następnie chwycić i przeciągnąć jak zwykłą relację.
- Przeciągnięcie relacji na dzień, który ma dokładnie jedną relację, łączy je w parę: pierwsza zajmuje lewą połowę dnia, dołączona prawą. Każda pozostaje osobną relacją i zmienia status niezależnie.
- Menu prawego przycisku myszy ma opcje Czerwona czcionka oraz Domyślny kolor czcionki. Kolor zapisuje się z konkretną relacją.

WERYFIKACJA
Kontrola składni osadzonych skryptów oraz weryfikacja logiki tworzenia dwóch identyfikatorów relacji, oddzielnych pól statusu, łączenia tylko z jedną relacją docelową i zapisu koloru. Bez nowego pliku test-v.
Paczka względem V176 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v176 - jedna relacja na dzień w trybie jak w Excelu
Build/cache: request-workflow-v176-one-route-per-day

- Dodanie relacji jest możliwe tylko przez dwuklik w pustej komórce dnia kierowcy. Kafelek od razu zajmuje całą kolumnę wybranej daty.
- Ten sam kierowca nie może otrzymać drugiej osobnej relacji w tym samym dniu. Przy próbie aplikacja wyświetla komunikat, że dzień jest zajęty.
- Przycisk Podziel pozostaje jedynym sposobem na dwa rozładunki tego samego dnia. To nadal jedna relacja i jeden kafelek podzielony wizualnie na dwie części.
- Przeciągnięcie istniejącej relacji, Wolnego ładunku lub Planowanej relacji na plan respektuje tę samą zasadę: wybiera konkretną kolumnę daty, zajmuje cały dzień i odrzuca zajęty dzień.
- Tryb klasyczny administratora zachowuje dotychczasową pracę z godzinami i zmianą rozmiaru.

WERYFIKACJA
Kontrola składni wszystkich 27 osadzonych skryptów HTML oraz lekka kontrola logiki: jednoznaczne sprawdzenie zajętości dnia podczas dodawania i obu rodzajów przeciągania, ustawienie zakresu 00:00–24:00 oraz zachowanie podziału na dwa rozładunki. Brak nowego pliku test-v.
Paczka względem V175 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v175 - precyzyjny wybór miasta według początku kodu pocztowego
Build/cache: request-workflow-v175-postal-prefix-entry

- Szybka edycja relacji ma dwa pola: miejscowość oraz Kod. W polu Kod można wpisać początek kodu, np. 00 lub 00-1.
- Lista podpowiedzi filtruje równocześnie nazwę miasta i wpisany początek kodu. Przy każdej pozycji pokazuje pełny kod jako „kod 00-001”.
- Jedno kliknięcie w pozycję zapisuje miasto i dokładny kod do relacji (unloadPostalCode albo secondUnloadPostalCode). Kod jest też zapisywany do punktu zlecenia, gdy taki punkt istnieje.
- Na kafelku nadal widoczna jest tylko miejscowość; kod nie jest dopisywany do jego opisu.
- Tab przechodzi z pola miejscowości do pola Kod; Enter lub Tab w polu Kod zapisuje, Escape anuluje.

WERYFIKACJA
Test przeglądarkowy: pole Kod, filtrowanie listy przez dwucyfrowy prefiks, widoczne pełne kody, zapis kodu do relacji oraz nazwa miasta bez kodu na kafelku. Brak błędów JavaScript.
Paczka różnicowa względem V174 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v174 - stała szerokość kafelków Excel i kody na liście miast
Build/cache: request-workflow-v174-excel-no-resize-postal-options

- Tryb „jak w Excelu” nie wyświetla uchwytów i nie pozwala zmieniać szerokości kafelków. Przeciąganie relacji pozostaje aktywne.
- Po przełączeniu przez administratora na tryb klasyczny uchwyty zmiany szerokości wracają bez zmiany danych relacji.
- Lista miejscowości podczas szybkiego dodawania i edycji pokazuje nazwę miasta oraz kod pocztowy po prawej stronie. Wybór nadal wymaga jednego kliknięcia.
- Wybrany kod służy rozpoznaniu właściwej miejscowości; do tekstu kafelka zapisywana i wyświetlana jest sama nazwa miasta.

WERYFIKACJA
Test przeglądarkowy: brak uchwytów i data-can-resize=0 w trybie Excel, zachowane drag and drop, widoczny kod pocztowy na liście oraz przywrócenie dwóch uchwytów w trybie klasycznym. Brak błędów JavaScript.
Paczka różnicowa względem V173 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v173 - dwuklik, wybór miejscowości jednym kliknięciem i podział po najechaniu
Build/cache: request-workflow-v173-doubleclick-split-hover

- W szybkim trybie wyłącznie dwuklik pustej komórki lub przycisku + tworzy kafelek. Pojedyncze kliknięcie nie dodaje relacji.
- Przycisk Podziel jest widoczny tylko po najechaniu kursorem na edytowalny kafelek; pozostaje dostępny z klawiatury po uzyskaniu fokusu.
- Podział nie przebudowuje całej tablicy przed rozpoczęciem wpisywania drugiej miejscowości. Druga część natychmiast otrzymuje aktywne pole edycji.
- Szybka edycja ma własną listę maksymalnie sześciu dopasowań. Nie używa systemowej listy z kodami. Jedno kliknięcie w pozycję zapisuje wybór.
- Do kafelka zapisywana jest wyłącznie nazwa miejscowości. Kod pocztowy nie jest dopisywany do nazwy ani wyświetlany w dolnej części kafelka po wyborze.

WERYFIKACJA
Test przeglądarkowy: pojedyncze kliknięcie nie dodaje kafelka, dwuklik dodaje jeden, wybór podpowiedzi jednym kliknięciem, widoczność Podziel po najechaniu oraz wpisanie drugiego rozładunku. Brak błędów JavaScript.
Paczka różnicowa względem V172 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v172 - dodawanie kliknięciem i ograniczenie przeciążenia synchronizacji
Build/cache: request-workflow-v172-click-board-stability

- W szybkim trybie kliknięcie pustej komórki planu lub jej przycisku + od razu tworzy jeden kafelek i otwiera wpisywanie miejscowości rozładunku. Nie otwiera formularza szczegółów.
- Kafelek zajmuje wolny przedział wybranego dnia otaczający miejsce kliknięcia. Nie nachodzi na istniejącą relację i nie przeskakuje na inny dzień. Gdy cały dzień jest pusty, zajmuje ten dzień.
- Enter/Tab albo opuszczenie pola zapisuje miejscowość. Escape lub opuszczenie pustego pola usuwa niezapisany kafelek. Szkic nie jest wysyłany do centralnej bazy ani historii floty.
- Przycisk Podziel na kafelku otwiera drugą miejscowość. Nadal jest to wizualny podział jednej relacji, bez duplikowania kwot czy zlecenia. Dwuklik zmienia miejscowości, prawy przycisk zachowuje szczegóły.
- Klasyczny tryb administratora zachowuje dotychczasowy formularz dodawania.
- Historia użycia floty pomija dane demonstracyjne i szkice. Jednocześnie wysyła maksymalnie 2 zapisy. Po błędzie stosuje rosnący odstęp 15 sekund–5 minut, zamiast ponawiać wszystkie żądania co 1,8 sekundy. Spóźnione odpowiedzi nie powodują ponownych prób.
- Ograniczono kolejkę geokodowania do 256 oczekujących adresów i 32 callbacków na adres. Wynik dla starej nazwy miejscowości nie nadpisze współrzędnych po kolejnej edycji. Szybka edycja zleca geokodowanie tylko zmienionego punktu, bez przebudowy tablicy po każdym wyniku.

WDROŻENIE
Nadpisz public/tms.html, src/main.js i README_WDROZENIE.txt w projekcie V171, następnie wdróż. To paczka wyłącznie zmienionych plików. Migracja przełącznika trybu z V171 pozostaje aktualna; V172 nie wymaga nowego SQL.

WERYFIKACJA
Test przeglądarkowy: dodanie kliknięciem dokładnie jednego kafelka w wybranym dniu, zapis miejscowości, przycisk podziału, anulowanie pustego szkicu, dwuklik, Enter/Tab/Escape, menu kontekstowe i tryb klasyczny. Bez błędów JavaScript.
Symulacja 100 realnych relacji i błędu Failed to fetch: maksymalnie 2 aktywne zapisy historii; 0 danych demonstracyjnych; 100 kolejnych wywołań w okresie oczekiwania nie wysłało nowych żądań.
Nie odtworzono awarii pamięci w produkcyjnej Operze ani nie zmieniano konfiguracji wdrożonej bazy. Failed to fetch może również oznaczać niezależny problem sieciowy; zmiana ogranicza przeciążenie i ponawianie żądań, nie ukrywa błędu zapisu.

AKTUALIZACJA v171 - szybka praca na planie kierowców jak w Excelu
Build/cache: request-workflow-v171-excel-board

WDROŻENIE
1. W Supabase SQL Editor uruchom jednorazowo supabase/board-entry-mode.sql. Tworzy ustawienie trybu tablicy; aktywni użytkownicy mogą je odczytać, zmieniać może tylko aktywny administrator (RLS).
2. Nadpisz public/tms.html oraz src/main.js w istniejącym projekcie i wdróż aplikację.
3. W Administracja > Sposób pracy na planie kierowców wybierz Szybka edycja lub Dotychczasowy widok. Ustawienie dotyczy wszystkich pracowników po ponownym otwarciu aplikacji.

OBSŁUGA
- Nowy tryb jest domyślny. Pojedyncze kliknięcie zaznacza kafelek; dwuklik edytuje miejscowość rozładunku. Enter, Tab lub wyjście z pola zapisuje; Escape anuluje.
- Przycisk „Podziel kafelek na dwa rozładunki” (⇥│) dzieli jego treść na dwie części i od razu otwiera wpisywanie drugiej miejscowości. Dwuklik w każdą część edytuje odpowiedni rozładunek.
- Dwie części to jedna relacja z polami rozładunku i drugiego rozładunku. Podział jest wizualny: zachowuje termin i szerokość relacji, nie tworzy dodatkowego zlecenia ani nie powiela kilometrów, dokumentów i kwot. Godziny i pozostałe dane nadal edytuje się w szczegółach.
- Prawy przycisk myszy zachowuje dotychczasowe menu. Drag and drop i zmiana szerokości działają na całej relacji.
- Anulowanie pustego drugiego rozładunku wycofuje nowy podział. Dla relacji z ponad dwoma punktami rozładunku pozostaje edycja szczegółowa.
- Klasyczny tryb przywraca otwieranie szczegółów kliknięciem i pojedynczy kafelek. Obie miejscowości są zachowane; ponowne włączenie trybu szybkiego odtwarza podział.
- Poprawiono zapis szybkiej edycji do synchronizacji centralnej oraz aktualizację punktów zlecenia i współrzędnych. Po zmianie miejscowości usuwany jest poprzedni dokładny adres, aby nie wskazywał innego miasta.
- Przy braku migracji aplikacja działa w trybie szybkim, a panel administratora wyjaśnia sposób aktywowania przełącznika. Relacje demonstracyjne nadal nie są wysyłane do Supabase.

WERYFIKACJA
Test przeglądarkowy: kliknięcie, dwuklik, oba rozładunki, Enter/Tab/Escape, anulowanie pustego podziału, zachowanie kwoty i jednej relacji, blokada edycji cudzego pojazdu, menu kontekstowe oraz powrót do trybu klasycznego. Brak błędów JavaScript.
Panel administratora sprawdzony w obu kierunkach z testowym klientem Supabase. Migracja i polityki RLS nie były uruchamiane na produkcyjnej bazie.
Paczka zawiera wyłącznie 4 nowe/zmienione pliki względem V170; bez nowego test-v.

AKTUALIZACJA v170 - stabilne etykiety, płynniejsza tablica i brak wizualnych kolizji
Build/cache: request-workflow-v170-stable-dense-board

- Kafelek relacji ma teraz dokładnie szerokość wynikającą z czasu rozpoczęcia i zakończenia. Usunięto wcześniejsze powiększenie wizualne o 30%, które powodowało nachodzenie sąsiednich relacji mimo poprawnych danych czasowych.
- Nazwy relacji otrzymują docelowy rozmiar czcionki od pierwszej klatki. Usunięto późniejszy pomiar i zmianę wielkości każdej etykiety, dlatego tekst nie „skacze” po uruchomieniu strony.
- Gęsta tablica pomija układ i malowanie komórek poza widocznym obszarem. Podczas przewijania wstrzymywane są animacje, cienie i filtry, co zmniejsza obciążenie przy dużej liczbie kafelków.
- Zachowano dane i funkcje V169. Paczka różnicowa zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.
AKTUALIZACJA v169 - pełne odtworzenie relacji demonstracyjnych bez nakładania
Build/cache: request-workflow-v169-reset-relations

- Przy pierwszym uruchomieniu V169 wszystkie relacje demonstracyjne z poprzednich wersji są usuwane i tworzone ponownie.
- Nowy zestaw ma unikalne identyfikatory i dokładnie jeden kafelek dla danego kierowcy oraz dnia roboczego.
- Przed dodaniem każdego kafelka sprawdzana jest kolizja czasowa. Rzeczywiste relacje mają pierwszeństwo, więc kolidujący kafelek demonstracyjny jest pomijany.
- Kolejne relacje demonstracyjne nadal stykają się czasowo, a piątkowe kończą się w poniedziałek między 06:00 a 12:00.
- Reset jest idempotentny: kolejna synchronizacja nie dodaje drugiego zestawu ani nie zmienia poprawnie odtworzonych relacji.
- Relacje zapisane w Supabase nie są usuwane ani modyfikowane.
- Paczka różnicowa względem V168: tylko public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v168 - ciągłe relacje i weekendy
Build/cache: request-workflow-v168-continuous-weekend-routes

- Kolejna przykładowa relacja rozpoczyna się dokładnie w chwili zakończenia poprzedniej.
- Piątkowa relacja obejmuje cały weekend i kończy się w poniedziałek między 06:00 a 12:00. Nie są tworzone oddzielne relacje sobotnie i niedzielne.
- Godziny są zróżnicowane co 15 minut, stabilne po odświeżeniu. W pozostałe dni rozładunek przypada między 06:00 a 18:00; ostatnia relacja kończy się 22.09 wieczorem.
- Dla września 2026: 16 relacji na kierowcę, 960 dla 60 przykładowych kierowców.
- Poprzedni układ przykładowy jest zastępowany podczas synchronizacji. Realne relacje nie są zmieniane.
- Paczka różnicowa względem V167: tylko public/tms.html, src/main.js i README_WDROZENIE.txt. Nadpisz te pliki w istniejącym projekcie, zachowując katalogi.

AKTUALIZACJA v167 - relacje dla wszystkich kierowców od 1 do 22 września
Build/cache: request-workflow-v167-september-relations

- Dla każdego kierowcy generowana jest jedna losowa, stabilna relacja na każdy dzień od 1.09 do 22.09 bieżącego roku.
- Dla 60 przykładowych kierowców daje to 1320 kafelków. Każdy ma różne miejscowości, dokładne adresy, godziny, kilometry, stawkę i klienta.
- Relacje przykładowe są utrzymywane po odebraniu floty i relacji z Supabase, ale nie są wysyłane do bazy jako prawdziwe dane operacyjne.
- Daty i wartości są deterministyczne, więc po odświeżeniu kafelki nie zmieniają losowo swoich danych.
- Zachowano wszystkie funkcje V166 i podbito identyfikator build/cache.

AKTUALIZACJA v166 - stały, ograniczony format SMS dla kierowcy
Build/cache: request-workflow-v166-strict-driver-sms

- SMS zawiera wyłącznie trzy sekcje: łączną liczbę kilometrów, załadunek z datą, godziną i dokładną lokalizacją oraz rozładunek z datą, godziną i dokładną lokalizacją.
- Usunięto z SMS dodatkowy załadunek, dodatkowy rozładunek, informacje dla kierowcy, uwagi, powitania i inne treści.
- Podgląd SMS jest tylko do odczytu, aby wiadomość nie odchodziła od wymaganego wzoru. Przyciski kopiowania i otwierania SMS pozostają aktywne.
- Zachowano wszystkie funkcje V165 i podbito identyfikator build/cache.

AKTUALIZACJA v165 - płynny motyw, 60 pojazdów i krótszy plan
Build/cache: request-workflow-v165-theme-fleet-window

- Przełączanie trybu jasnego i ciemnego płynnie animuje kolory bez ponownego renderowania tablicy. Przycisk po kliknięciu oddaje fokus, dzięki czemu górny pasek ponownie chowa się zgodnie z dotychczasowym zachowaniem.
- Dodano 60 stabilnych, przykładowych zestawów pojazd–kierowca z 60 odrębnymi przewoźnikami, numerami rejestracyjnymi, markami i bazami.
- Domyślny plan pokazuje 2 dni wstecz, dzień bieżący oraz 10 dni do przodu, czyli 13 dni łącznie.
- Dopasowanie relacji z „Wolne ładunki” nie wyświetla już komunikatu w prawym dolnym rogu i nie uruchamia dźwięku. Oznaczenia dopasowania na kafelkach i w zakładce pozostają aktywne.
- Zachowano wszystkie funkcje V164 i podbito identyfikator build/cache.

AKTUALIZACJA v164 - minimalizacja analizy zlecenia, kafelek AI, SMS i prawe zakładki
Build/cache: request-workflow-v164-ai-draft-minimize-sms-tabs

- Formularz „Szczegóły zlecenia” można zminimalizować podczas dodawania relacji na plan kierowców. Kliknięcie poza formularzem także go minimalizuje i nie przerywa analizy.
- Po rozpoczęciu analizy na planie pojawia się tymczasowy kafelek w barwach AI. Kafelek nie jest zapisywany w bazie; po zapisaniu relacji zastępuje go zwykły kafelek planu kierowców.
- Powiadomienie o analizowanym lub przeanalizowanym zleceniu otwiera właściwy formularz wraz z zachowanymi danymi i wynikiem analizy.
- Wiadomość SMS dla kierowcy ma układ: trasa i kilometry, załadunek z datą, godziną i dokładnym adresem oraz rozładunek z datą, godziną i dokładnym adresem.
- Prawe zakładki przylegają do krawędzi ekranu. Ich napisy są schowane w stanie zwiniętym, więc nie wystają częściowe litery; opis pojawia się po wskazaniu zakładki.
- Zachowano wszystkie funkcje V163 i podbito identyfikator build/cache.

AKTUALIZACJA v163 - Najbliższy pojazd zgodny z wybranym dniem
Build/cache: request-workflow-v163-nearest-vehicle-date

- Wyniki Najbliższego pojazdu korzystają wyłącznie z relacji, których rozładunek przypada dokładnie na dzień wskazany w wyszukiwarce.
- Rozładunek sprzed kilku dni nie jest już traktowany jako pozycja pojazdu dla późniejszego dnia.
- Przy kilku relacjach kończących się tego samego dnia wybierany jest ostatni rozładunek tego dnia, a następna relacja jest liczona od jego zakończenia.
- W wyniku wyświetlana jest data rozładunku, z której pochodzi pozycja pojazdu.
- Zachowano wszystkie funkcje V162.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V163 z zachowaniem katalogów.

AKTUALIZACJA v162 - szerszy dokument i dane AI w Szczegółach zlecenia
Build/cache: request-workflow-v162-order-document-width

- Po dodaniu dokumentu panel podglądu wraz z danymi odczytanymi przez AI zajmuje dwukrotnie większą szerokość niż formularz Szczegółów zlecenia.
- Okno rozszerza się do 1200 px na szerokich ekranach. Na ekranach do 900 px sekcje układają się jedna pod drugą bez poziomego przepełnienia.
- Usunięto opis z nazwą wgranego pliku nad podglądem dokumentu. Przycisk otwierania dokumentu i analiza AI pozostają dostępne.
- Zachowano wszystkie funkcje V161.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V162 z zachowaniem katalogów.

AKTUALIZACJA v161 - płynne przesuwanie planu przy skali 50-60%
Build/cache: request-workflow-v161-board-scroll-performance

- Przesuwanie planu środkowym przyciskiem myszy jest teraz synchronizowane z klatkami obrazu. Bardzo częste zdarzenia myszy nie wymuszają już wielu przeliczeń przewijania w tej samej klatce.
- Przy skali 50% i 60% przeglądarka pomija rysowanie pustych komórek znajdujących się poza widocznym obszarem.
- Podczas aktywnego przesuwania w najmniejszej skali są chwilowo zatrzymywane pulsowania, cienie i filtry na planie. Alerty nie znikają; ich animacje wracają po 120 ms od zatrzymania.
- Zwykłe przewijanie, suwaki, autoscroll rolką, drag and drop relacji, przyklejone kolumny oraz wszystkie funkcje V160 pozostają aktywne.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V161 z zachowaniem katalogów.

AKTUALIZACJA v160 - zapis trasy i układ formularza zlecenia
Build/cache: request-workflow-v160-route-form-save

- Po analizie AI przycisk zapisu pokazuje stan „Zapisywanie…”, blokuje podwójne wysłanie i prezentuje rzeczywisty błąd zamiast pozostawiać formularz bez informacji.
- Pomocnicze wyliczenie routingu ma limit 8 sekund i nie blokuje zapisu relacji. Po limicie trasa zapisuje się z terminami podanymi w formularzu.
- Lista żółtych kafelków AI jest przenoszona do zapisanej relacji.
- Drugi załadunek i drugi rozładunek pozostają domyślnie ukryte. Analiza pokazuje je tylko wtedy, gdy dokument zawiera rzeczywisty, odmienny drugi punkt.
- Usunięto podpis i krok „Data relacji”. Data załadunku znajduje się nad miejscowością załadunku, a data rozładunku nad miejscowością rozładunku.
- Okno „Szczegóły zlecenia” ma maksymalnie 780 px szerokości, tak jak okno importu zlecenia; na telefonie nadal wykorzystuje dostępną szerokość.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V160 z zachowaniem katalogów.

AKTUALIZACJA v159 - weryfikacja danych z analizy zlecenia
Build/cache: request-workflow-v159-ai-review-tiles

- Dane rozpoznane przez AI są ponownie prezentowane jako żółte kafelki nad podglądem oryginalnego zlecenia.
- Kliknięcie treści kafelka wyszukuje daną wartość w podglądzie PDF. Przycisk × usuwa pojedynczy kafelek; dostępne jest także „Usuń wszystkie”.
- To spedytor decyduje, które rozpoznane informacje pozostają przy relacji. Pozostawione kafelki są zapisywane w orderAiExtractedFields.
- Pola formularza uzupełnione przez AI nie są już oznaczane żółtym tłem. Nadal pozostają zwykłymi, edytowalnymi polami formularza.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V159 z zachowaniem katalogów.

AKTUALIZACJA v158 - prawe panele przy krawędzi ekranu
Build/cache: request-workflow-v158-flush-right-panels

- Wolne ładunki, Planowane relacje, Statystyki oraz boczne formularze dochodzą do prawej krawędzi ekranu; usunięto sztuczny odstęp 66 px.
- Prawy pasek zakładek jest chwilowo ukrywany, kiedy panel jest otwarty, aby nie zasłaniał formularza, nagłówka ani paska przewijania. Panel zamyka się własnym przyciskiem.
- Szerokości paneli pozostają bez zmian; na małych ekranach obowiązuje maksymalnie 100% szerokości widoku.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki V158 z zachowaniem katalogów.

AKTUALIZACJA v157 - zgodność zapytania profilu z klientem Supabase
Build/cache: request-workflow-v157-supabase-thenable

- Naprawiono błąd startu `maybeSingle(...).catch is not a function` po zalogowaniu lub odświeżeniu strony.
- Wynik PostgrestBuilder jest oczekiwany przez `await`, a wyjątek przechwytuje `try/catch`; nie zakładamy już, że obiekt thenable implementuje pełne API Promise.
- Istniejący test integracji używa teraz celowo obiektu thenable bez metody `.catch()`, zgodnego z zachowaniem powodującym błąd produkcyjny.
- Podbito identyfikator build/cache. Wgraj wszystkie pliki paczki V157 z zachowaniem katalogów.

AKTUALIZACJA v156 - Administracja, integracja modułów, cykl życia i CSS
Build/cache: request-workflow-v156-integration

- Administracja: endpoint /api/admin/users działa bez importu lokalnego modułu HTTP; brak konfiguracji zwraca kod 503, przekroczenie czasu 504. Frontend rozpoznaje odpowiedź bez JSON i pokazuje ścieżkę endpointu oraz dostępny kod błędu hostingu. Kontrola uprawnień pozostaje po stronie serwera. Przyczyna błędu na działającej stronie wymaga jej logów; lokalne testy nie potwierdzają naprawy produkcji.
- Nowy moduł ES src/view-lifecycle.js: ochrona przed spóźnionym renderowaniem widoków i snapshotów oraz zakładaniem subskrypcji po opuszczeniu dashboardu.
- Jeden kanoniczny public/order-stops.js, ładowany przez HTML; prywatny rejestr outboxu, jawna fasada zgodności.
- Czysty public/planning-core.js; adapter planu przekazuje dane bez DOM i zależności serwerowych.
- Osobny public/order-entry.css; kontrola życia formularza, Blob URL i bieżących elementów po asynchronicznej analizie.
- Responsywność formularza sprawdzona przy 1440, 768 i 375 px; siatki nie rozpychają komponentów. Ograniczenie szerokości kontenerów tabel z zachowaniem przewijania.
- 11 plików testowych, bez nowego test-v; testy integracji i próby Edge. Szczegóły i ograniczenia: DIAGNOZA_INTEGRACJI_V156.md.

WAŻNE: Wgraj WSZYSTKIE pliki paczki, w tym nowe src/view-lifecycle.js, public/planning-core.js, public/order-entry.css oraz public/order-stops.js, który nie jest już osadzony w HTML. Zachowaj lib/top-dragon-http-v155.js. To nadal paczka zmian, nie pełny projekt do samodzielnego zbudowania. Nie dodano migracji SQL.

AKTUALIZACJA v155 - 12.09.2026 (na bazie v154)
Identyfikator plików: request-workflow-v155-deep-audit

NAPRAWY I OPTYMALIZACJE
- Pełny odczyt klientów, relacji, obu kolejek i historii czatu także przy limicie odpowiedzi niższym niż 500 rekordów. Odczyt kończy dopiero pusta strona; nieprawidłowa odpowiedź nie zastępuje danych pustą listą.
- Lista klientów stronicowana według trwałych kluczy; deduplikacja wybiera najnowszy rekord klienta po pobraniu wszystkich stron.
- Ochrona przed wysłaniem wyniku rozliczeń tablicy do zmienionej sesji/ramki.
- Backup odrzuca uszkodzony JSON. Krótka strona nie oznacza końca danych; kopia nadal ma jawny maksymalny rozmiar liczby relacji.
- Nowy współdzielony moduł lib/top-dragon-http-v155.js obejmuje limitem czasu całą odpowiedź HTTP. Wszystkie pięć endpointów API korzysta z niego. Analizy AI zachowują własne limity 75/110 sekund; pozostałe żądania mają limit 30 sekund. Bez automatycznego ponawiania zapisów.
- Jednorazowy indeks historii czatu według oddziału i relacji. Liczniki nie skanują całej historii dla każdej karty. Zmiana danych lub użytkownika przebudowuje indeks.
- Podgląd relacji w czacie dostępny dla czytników ekranu; usunięto inert, zachowując wyłączone pola i usuwając operacje interaktywne oraz zdublowane identyfikatory.
- Dopasowanie wolnego miejsca zaokrągla czas w przód, nie wraca na zajęty fragment. Brak miejsca na pełną relację zatrzymuje zapis. Dotyczy przeciągania, tworzenia, pobierania przyciskiem i pobierania grupowego.
- Dojazd po północy uwzględnia następny dzień. Przesunięcie relacji zachowuje czas jej trwania. Pobieranie grupowe uwzględnia relacje dodane wcześniej w tej samej operacji.
- Zmiana daty formularza aktualizuje terminy punktów zlecenia; analiza AI używa wspólnej obsługi daty załadunku.
- Parser tabel rozróżnia cytowane pola i zwykły cudzysłów wewnątrz nazwy. Nieprawidłowa zawartość po zamkniętym polu jest zgłaszana. Przekroczenie limitu importu nie ucina bez ostrzeżenia końcowych rekordów.
- XLSX: podstawowe formaty dat/czasu i czas trwania [h], kalendarz 1900/1904, zachowanie kolumn bez nagłówka, unikalne nazwy powtarzających się nagłówków, kontrola numeru kolumny i rozmiaru pliku.
- Ograniczono aktualizację ikon podczas przeciągania kafelków.

WDROŻENIE
Wgraj wszystkie pliki paczki z zachowaniem katalogów, W TYM NOWY katalog lib i plik lib/top-dragon-http-v155.js. Endpointy API importują ten moduł. Nie pomijaj go podczas kopiowania.
To paczka zmian do istniejącego projektu. Nie dodano migracji SQL. Zmieniono cache ID HTML, formularza i XLSX. Przygotowano jeden ZIP w standardowym formacie Windows, bez ścieżek ./.

WERYFIKACJA
11 istniejących plików testowych, rozszerzonych o scenariusze V155; bez nowego pliku test-v. Kontrola składni 10 plików JS i 25 wykonywalnych bloków HTML. Próby w Edge na danych testowych, przy zablokowanych połączeniach zewnętrznych: ekran startowy i render zalogowanego widoku bez błędów JS, podgląd karty w czacie, licznik unread, zmiana daty oraz rzeczywisty import XLSX z datami i brakującymi nagłówkami.
Szczegóły: RAPORT_WERYFIKACJI_V155.md. Brak pełnego projektu i SQL ogranicza sprawdzenie wdrożenia, atomowości zapisów oraz uprawnień serwera. Nie należy traktować testów lokalnych jako potwierdzenia wszystkich ścieżek produkcyjnych.

AKTUALIZACJA v154 - 12.09.2026 (na bazie v153)
Identyfikator plików: request-workflow-v154-audit-fixes

- Relacje są pobierane stronami w stałej kolejności; błąd jednej strony nie publikuje częściowego stanu.
- Spóźnione odpowiedzi synchronizacji relacji, klientów, floty, użytkowników i tygodniowych rozliczeń nie zastępują nowszego odczytu ani danych innej sesji.
- Poprawiono wybór kluczy konfiguracyjnych kopii e-mail. CSV neutralizuje formuły w polach tekstowych; JSON zachowuje dane. Kolejność eksportu nie zależy już od czasu ostatniej edycji.
- Ręczne przeciąganie Wolnych ładunków nie zależy od automatycznej rekomendacji (poprzednia relacja, data, dystans). Pozostają kontrola właściciela pojazdu, zgodność pojazdu i wyznaczanie wolnego miejsca. Spedytor decyduje o dolocie; próg 150 km dotyczy wyłącznie rekomendacji.
- Planowane relacje sprawdzają zgodność pojazdu także przy ręcznym przeciąganiu.
- Zatwierdzona zmiana rozmiaru lub przesunięcie relacji odnawia alert. Najechanie rozpoczyna 60 sekund pulsowania. Oczekiwanie na routing/geokodowanie nie kasuje stanu odczytania.
- Zielone punkty stosują filtry bieżącego spedytora i próg rekomendacji wspólny z poświatą. Pulsują tylko wraz z aktywnym alertem kafelka.
- Indeks relacji według kierowcy jest współdzielony w przebiegu obliczania dopasowań i zwalniany po nim. Odczyt oczekujących alertów używa indeksu kolejki zamiast powtarzania wyszukiwania po całej liście.
- Czat pobiera całą dostępną historię stronami, bez obcinania do globalnych 2000 wiadomości i odczytów. Subskrybuje zmiany odczytów bieżącego użytkownika i odświeża dane po powrocie do karty. Koperta znika po potwierdzonym odczycie serwera; błędny zapis nie pozostawia fałszywego odczytu.
- Kolory czatu korzystają z kolorów profili, jeśli są dostępne; w pozostałych przypadkach zachowano dotychczasowy kolor zastępczy.
- Zmiana daty załadunku od razu przesuwa widoczną datę rozładunku. Analiza dokumentu nie zastępuje listy punktów zmienionej ręcznie podczas oczekiwania na wynik.
- Import tabel obsługuje cytowane separatory, podwójne cudzysłowy i wielowierszowe pola. Timeout AI obejmuje również pobieranie treści odpowiedzi we wszystkich trzech endpointach.
- Lista administracyjna stronicuje konta i profile. Odczyt XLSX kontroluje rozmiar rozpakowanych danych (64 MB) i zgodność rozmiarów wpisów.
- Zaktualizowano identyfikatory cache dla HTML, formularza i czytnika XLSX. Jedna paczka ZIP; bez nowych plików test-v i bez migracji bazy.

WERYFIKACJA V154
- Wszystkie 11 istniejących plików testowych przechodzi. Historyczne asercje numerów wersji i usuniętego panelu opiekunów dostosowano do bieżących wymagań.
- Rozszerzono istniejące testy o import cytowanych pól, klucze kopii, 1203 rekordy w trzech stronach, przerwane pobieranie, odwróconą kolejność odpowiedzi, zmianę sesji, ponowne pulsowanie po zmianie rozmiaru oraz współdzielenie indeksu.
- Kontrola składni: 9 zewnętrznych plików JavaScript i 25 wykonywalnych skryptów HTML.
- Nie wykonywano połączeń z produkcyjną bazą, wysyłki e-mail ani płatnych analiz AI.

OGRANICZENIA I WDROŻENIE
To nadal paczka zmian do istniejącego projektu, nie samodzielna aplikacja. Wgraj jej pliki z zachowaniem ścieżek i wykonaj standardowe budowanie pełnego projektu.
Paczka nie zawiera package.json, zależności, src/styles.css, src/lib/supabase.js, implementacji /api/truck-routing ani SQL/RPC/RLS. Pełne uruchomienie, pomiary przewijania i potwierdzenie uprawnień akceptacji adresów oraz atomowości przejęć wymagają tych elementów. Nie zadeklarowano procentowego przyspieszenia.
Stronicowanie klienta nie zastępuje transakcyjnego snapshotu serwera podczas jednoczesnego dodawania/usuwania rekordów. Czat nadal pobiera pełną historię zakresu; nie wprowadzono odrębnego serwerowego licznika unread i doczytywania tylko otwartej rozmowy.
Czytnik XLSX nadal zwraca liczby dla dat zapisanych jako liczby Excela; interpretacja styles.xml pozostaje poza tą poprawką. Podgląd karty w czacie nadal używa inert; nie przebudowano go na odrębny widok dla czytników ekranu.

AKTUALIZACJA v153 - 11.09.2026 (na bazie v152)
Identyfikator plików: request-workflow-v153-performance-chat-stability

- Sortowanie obu kolejek wylicza priorytet dopasowania raz na relację, zamiast przy każdym porównaniu par.
- Odświeżenie po obliczeniu dojazdu czeka na zakończenie przeciągania, aby nie usuwać przeciąganego kafelka z DOM.
- Obserwator dopasowania rozmiaru formularzy reaguje tylko na zmiany formularzy i grupuje wywołania w jednej klatce.
- Odświeżenie czatu zachowuje tekst roboczy, pozycję kursora i przewinięcie historii. Podgląd relacji nie powiela identyfikatorów pól kolejki.
- Przeliczanie alertów zatrzymuje się w ukrytej karcie i podczas przeciągania; podczas przewijania nie skanuje kafelków.
- Weryfikacja lokalna: testy zachowania, kontrola liczby obliczeń sortowania i składni. Bez pomiarów na produkcyjnym Supabase.
- Jedna paczka ZIP; bez migracji bazy i nowych plików test-v.

AKTUALIZACJA v152 - 11.09.2026 (na bazie v151)
Identyfikator plików: request-workflow-v152-dnd-distance-performance

- Przywrócono niezawodne przeciąganie kafelków z Wolnych ładunków na plan kierowcy, również gdy przeglądarka nie zwróci tekstowej zawartości przeciągania i trzeba użyć stanu lokalnego.
- Kafelki Wolnych ładunków korzystają z tego samego układu wizualnego co kafelki Planowanych relacji, zachowując własne informacje i operacje.
- Usunięto limit 150 km przy wyborze i przypisywaniu pojazdu z Planowanych relacji. Wolne ładunki nadal pozwalają na przypisanie bez limitu odległości.
- Odległość pozostaje informacją dla spedytora; nadal obowiązują zgodność pojazdu, potwierdzona trasa i reguły planu.
- Kosztowne przeliczanie dopasowań jest wstrzymywane podczas aktywnego przewijania planu i wykonywane rzadziej w tle, co ogranicza przycinanie widoku.
- Zachowano podgląd kafelka w czacie i wszystkie funkcje V151. Bez nowego pliku test-v i bez migracji bazy.
- Dla V152 przygotowywana jest wyłącznie jedna paczka ZIP.

AKTUALIZACJA v151 - 10.09.2026 (na bazie v150)
Identyfikator plików: request-workflow-v151-chat-route-card

- Po otwarciu czatu nad wiadomościami wyświetlany jest pełny, rozwinięty podgląd kafelka relacji.
- Podgląd korzysta z tego samego układu i danych co kafelek w sekcji Wolne ładunki lub Planowane relacje.
- Przyciski operacyjne kafelka są ukryte w podglądzie czatu, aby nie uruchomić przypadkowo edycji, usunięcia lub pobrania relacji.
- Zachowano kolory użytkowników czatu, łagodne pulsowanie i ponowne wykrywanie dopasowania z V150.
- Bez nowego pliku test-v, bez migracji bazy. Dla V151 przygotowywana jest wyłącznie jedna paczka ZIP.

AKTUALIZACJA v150 - 10.09.2026 (na bazie v149)
Identyfikator plików: request-workflow-v150-chat-colors-soft-rematch

- Każdy użytkownik czatu ma stały kolor punktu, nazwy i bocznego oznaczenia wiadomości.
- Zielone pulsowanie dopasowanego kafelka jest łagodniejsze i ograniczone do małego punktu w obrębie kafelka.
- Gdy zmiana rozmiaru kafelka usuwa dopasowanie, zapamiętany stan alertu dla tego dopasowania jest resetowany. Ponowne dopasowanie uruchamia pulsowanie od początku.
- Zachowano minutę pulsowania od pierwszego najechania oraz wszystkie funkcje V149.
- Zaktualizowano istniejące testy; bez nowego pliku test-v i bez migracji bazy.
- Dla V150 przygotowywana jest wyłącznie jedna wersjonowana paczka ZIP.

AKTUALIZACJA v149 - 10.09.2026 (na bazie v148)
Identyfikator plików: request-workflow-v149-green-dots-clickable-mail

- Punkty dopasowania w prawym górnym rogu kafelka są zielone i pulsują dla obu źródeł: Wolne ładunki oraz Planowane relacje.
- Zielona pulsująca koperta znajduje się obok ikony odpowiedniej zakładki i ma ten sam rozmiar co ikony zakładek.
- Kliknięcie koperty otwiera właściwy panel i przechodzi bezpośrednio do czatu relacji z najnowszą nieprzeczytaną wiadomością.
- Zachowano minutowe pulsowanie dopasowanego kafelka z V148 oraz wszystkie wcześniejsze funkcje.
- Zaktualizowano istniejący test zachowania; bez nowego pliku test-v i bez migracji bazy.

AKTUALIZACJA v148 - 10.09.2026 (na bazie v147)
Identyfikator plików: request-workflow-v148-hover-minute

- Dopasowany kafelek pulsuje na zielono do pierwszego najechania i jeszcze przez 60 sekund od tego najechania.
- Kolejne najechania nie przedłużają odliczania. Termin wygaszenia jest zapamiętany per użytkownik i dopasowanie, także po odświeżeniu strony.
- Zachowano alerty koperty i niebieskie sygnały nowych relacji z V147.
- Weryfikacja: istniejące testy zachowania z symulowanym zegarem oraz kontrola składni. Brak nowego pliku test-v i migracji bazy.

AKTUALIZACJA v147 - 10.09.2026 (na bazie v146)
Identyfikator plików: request-workflow-v147-queue-alerts

- Nowa relacja sygnalizowana jest niebieskim pulsowaniem zakładki do otwarcia panelu.
- Nieprzeczytane wiadomości właściciela relacji pokazują zieloną pulsującą kopertę przy odpowiedniej ikonie. Samo otwarcie panelu nie kasuje koperty.
- Istniejące dopasowania są sprawdzane również po pierwszym pobraniu, lokalnym zapisie i późniejszym geokodowaniu. Dopasowany kafelek własnego spedytora pulsuje na zielono do najechania kursorem.
- Odświeżane są także już wyrenderowane ikony. Oddzielono kolor nowego wpisu od koloru dopasowania.
- Odrzucane są spóźnione odpowiedzi czatu z poprzedniej sesji użytkownika.
- Zaktualizowano istniejące testy zachowania; bez nowego pliku test-v. Sprawdzono logikę DOM, izolację użytkowników i składnię. Nie wykonano testu na produkcyjnym Supabase.
- Brak migracji bazy danych.

AKTUALIZACJA v146 - 10.09.2026 (na bazie v145)
Identyfikator plików: request-workflow-v146-next-day-finance-address-roles

Najważniejsze zmiany V146:
- Nowa relacja otrzymuje domyślną datę rozładunku w następnym dniu po dacie załadunku, a kafelek obejmuje oba dni.
- Zmiana daty załadunku przesuwa datę rozładunku z zachowaniem co najmniej jednodniowego odstępu.
- Pusty przycisk $ w kolumnie Rozl. jest umieszczony pod warstwą kafelka relacji; przycisk z wartością pozostaje na wierzchu.
- Adresy i bazy klientów mogą potwierdzać oraz edytować wyłącznie kierownik oddziału i administrator. Usuwanie całej karty klienta nadal pozostaje wyłącznie dla administratora.
- Zachowano wszystkie funkcje V145; brak migracji bazy danych.

Weryfikacja V146:
- kontrola daty 09.09 → 10.09 dla nowej relacji i po zmianie daty załadunku,
- kontrola warstw pustego i aktywnego przycisku $,
- kontrola uprawnień do potwierdzania adresów klientów,
- kontrola składni głównych plików i skryptów osadzonych w tms.html.

AKTUALIZACJA v145 - 10.09.2026 (na bazie v144)
Identyfikator plików: request-workflow-v145-remove-branch-message

Najważniejsze zmiany V145:
- Całkowicie usunięto komunikat wymagający ręcznego wskazania oddziału relacji.
- Zapis Wolnego ładunku i Planowanej relacji nie jest już zatrzymywany przez niewidoczne pole oddziału.
- Zachowano automatyczne przypisywanie oddziału z profilu użytkownika lub danych relacji oraz wszystkie funkcje V144.
- Brak migracji bazy danych.

Weryfikacja V145:
- kontrola braku komunikatu i związanej z nim blokady zapisu,
- kontrola składni głównych plików i skryptów osadzonych w tms.html,
- regresja istniejącego testu zachowania alertów.

AKTUALIZACJA v144 - 10.09.2026 (na bazie v143)
Identyfikator plików: request-workflow-v144-client-address-search

Najważniejsze zmiany V144:
- W wynikach wyszukiwarki „Baza klientów” jest teraz widoczny adres klienta, także dla rekordów pochodzących z importu.
- Wyszukiwanie obejmuje nazwę i adres klienta oraz nazwy i adresy jego potwierdzonych baz.
- Zachowano wszystkie funkcje V143; zmiana nie wymaga migracji bazy danych.

Weryfikacja V144:
- kontrola widocznego adresu klienta na liście wyników,
- kontrola wyszukiwania po adresie głównym oraz po nazwie i adresie bazy,
- kontrola składni głównych plików i skryptów osadzonych w tms.html.

AKTUALIZACJA v143 - 10.09.2026 (na bazie v142)
Identyfikator plików: request-workflow-v143-client-owner-hint-cleanup

Najważniejsze zmiany V143:
- Usunięto z formularza klienta opis „Klient może mieć maksymalnie 3 opiekunów łącznie: 1 głównego i do 2 dodatkowych.”
- Zachowano limit maksymalnie trzech opiekunów oraz wszystkie funkcje V142.
- Brak migracji bazy danych.

Weryfikacja V143:
- kontrola usunięcia komunikatu z interfejsu,
- kontrola zachowania funkcji limitującej wybór opiekunów,
- kontrola składni głównych plików i skryptów osadzonych w tms.html.

AKTUALIZACJA v142 - 10.09.2026 (na bazie v141)
Identyfikator plików: request-workflow-v142-board-match-scope

Najważniejsze zmiany V142:
- Zakres tablicy w przyszłość zwiększono z 7 do 14 dni (o dodatkowe 7 dni); zakres historii pozostaje bez zmian.
- Pusty przycisk $ w kolumnie Rozl. jest renderowany pod kafelkiem relacji, aby nie zasłaniał jej treści. Znacznik z rzeczywistą wartością/transferem pozostaje na wierzchu.
- Zielona pulsująca poświata dopasowanego kafelka uruchamia się również bezpośrednio po lokalnym dodaniu relacji do Wolnych ładunków lub Planowanych relacji, bez oczekiwania na kolejny snapshot Supabase.
- Dopasowania są filtrowane ściśle do zalogowanego spedytora/kierownika; dopasowanie kierowcy spedytora X nie jest sygnalizowane na koncie innego spedytora.
- Najechanie kursorem na dopasowany kafelek nadal wygasza zieloną poświatę tylko dla bieżącego użytkownika.
- Zachowano wcześniejsze alerty zakładek, kopertę czatu i automatyczną archiwizację przeterminowanych Wolnych ładunków.
- Brak migracji bazy danych.

Weryfikacja V142:
- składnia głównych plików i skryptów osadzonych w tms.html,
- test zakresu tablicy 14 dni w przyszłość,
- test lokalnego uruchomienia zielonej poświaty i wygaszenia po najechaniu,
- test izolacji dopasowania między dwoma spedytorami,
- test warstwy pustego przycisku $.

AKTUALIZACJA v141 - 10.09.2026 (na bazie v140)
Identyfikator plików: request-workflow-v141-expired-proposed-archive

Najważniejsze zmiany V141:
- Wolne ładunki po upływie terminu są automatycznie usuwane z aktywnej listy i archiwizowane centralnie.
- Automatyczna archiwizacja dotyczy wyłącznie `proposed` (Wolne ładunki), nie `future` (Planowane relacje).
- Wpis po terminie nie jest ponownie publikowany jako aktywny po odświeżeniu.
- Jeżeli centralna archiwizacja chwilowo się nie powiedzie, wygasły wpis pozostaje ukryty z aktywnej listy, a kolejna synchronizacja ponawia housekeeping.
- Brak migracji bazy danych.

Weryfikacja V141:
- składnia głównych plików JS,
- test daty wygaśnięcia,
- test: proposed po terminie znika, future po terminie pozostaje,
- test regresyjny wcześniejszych alertów.

AKTUALIZACJA v140 - 10.09.2026 (na bazie v139)
Identyfikator plików: request-workflow-v140-pending-client-delete-fix

Najważniejsze zmiany V140:
- Naprawiono Baza klientów → Do akceptacji: lista pokazuje wyłącznie aktywne wnioski ze statusem pending.
- Po usunięciu klienta przez administratora oczekujący wniosek jest lokalnie usuwany, centralnie zamykany jako odrzucony, a po ponownym pobraniu workflow nie wraca do sekcji „Do akceptacji”.
- Nie zmieniono historii wniosków w Supabase; zamknięte/odrzucone rekordy pozostają dostępne technicznie, ale nie są prezentowane jako oczekujące.

Weryfikacja V140:
- Sprawdzenie składni main.js.
- Sprawdzenie składni skryptów osadzonych w tms.html.
- Test regresyjny: pending → usunięcie klienta → odrzucony rekord z synchronizacji → brak na liście Do akceptacji.

AKTUALIZACJA v139 - 10.09.2026 (na bazie v138)
Identyfikator plików: request-workflow-v139-compact-order-form-titles

Najważniejsze zmiany V139:
- Zmniejszono formularz „Szczegóły zlecenia”: maksymalna szerokość 1180 px, wysokość do 88% okna / 820 px oraz bardziej kompaktowe odstępy i kontrolki.
- Formularz otwierany z „Wolne ładunki” ma tytuł „Dodaj wolne ładunki”.
- Formularz otwierany z „Planowane relacje” ma tytuł „Dodaj planowaną relację”.
- Formularz otwierany z przycisku „+” na planie zachowuje tytuł „Szczegóły zlecenia”.
- Usunięto z widocznego UI pole „Oddział relacji”. Identyfikator oddziału nadal jest zachowywany technicznie i używany przy zapisie.
- Zachowano wszystkie funkcje i poprawki V138; zmiana nie wymaga migracji bazy.

Weryfikacja V139:
- kontrola składni public/order-entry.js, public/order-stops.js i src/main.js,
- kontrola trzech tytułów formularza zależnych od kontekstu,
- kontrola niewidocznego pola technicznego oddziału,
- kontrola nowego build/cache id oraz regresja wcześniejszych testów.

AKTUALIZACJA v138 - 10.09.2026 (na bazie v137)
Identyfikator plików: request-workflow-v138-ai-client-owner-column

Najważniejsze zmiany V138:
- Przywrócono wcześniejszy, prosty formularz „Import AI · Klienci” bez dodatkowego panelu ręcznego wyboru opiekunów.
- Import AI analizuje teraz także kolumnę z opiekunem klienta. Obsługiwane są m.in. nagłówki: Opiekun, Nazwa opiekuna, Główny opiekun, Spedytor, Account Manager i Handlowiec.
- Jeżeli źródło zawiera kolumny Opiekun 2 / Opiekun 3, import zachowuje maksymalnie trzech opiekunów klienta.
- Podgląd importu pokazuje rozpoznanego głównego opiekuna oraz dodatkowych opiekunów.
- Puste pola opiekuna nie powodują automatycznego przypisania użytkownika.
- Zachowano wcześniejszą zasadę maksymalnie 3 opiekunów klienta i wszystkie zmiany V137.
- Zmiana nie wymaga migracji bazy danych.

Weryfikacja V138:
- kontrola składni public/tms.html i api/import-ai-data.js,
- test parsera listy klientów z kolumną Opiekun oraz trzema opiekunami,
- kontrola przywrócenia poprzedniego formularza Import AI · Klienci,
- regresja podstawowego importu klientów.

AKTUALIZACJA v137 - 10.09.2026 (na bazie v136)
Identyfikator plików: request-workflow-v137-conditional-order-sections

Najważniejsze zmiany V137:
- W formularzu „Szczegóły zlecenia” sekcja „Oryginalne zlecenie” jest niewidoczna, dopóki nie zostanie wybrany dokument.
- Usunięto pusty komunikat „Podgląd pojawi się po wybraniu dokumentu.” z niewgranego zlecenia.
- Sekcja „Zlecenie transportowe” jest domyślnie zwinięta i można ją ręcznie rozwinąć.
- W formularzach „Wolne ładunki” i „Planowane relacje” ukryto: Dolot km, Kilometry, Kwota za gabaryt, Koszt przewoźnika oraz Kalkulator opłacalności frachtu.
- W tych formularzach pozostawiono widoczne pole „Stawka i waluta”. Ukryte wartości techniczne nadal są zachowywane, aby nie usuwać danych istniejących relacji ani danych AI.
- Formularz z przycisku „+” na planie kierowców zachowuje pełny zestaw pól finansowych.
- Zmiana nie wymaga migracji bazy danych.

Weryfikacja V137:
- kontrola składni public/order-entry.js i src/main.js,
- test renderowania wariantu zwykłego i kolejki,
- kontrola obecności ukrytej sekcji dokumentu i warunkowego podglądu,
- regresja testów V136.

AKTUALIZACJA v136 - 10.09.2026 (na bazie v135)
Identyfikator plików: request-workflow-v136-unified-queue-client-backup

Najważniejsze zmiany V136:
- Nowy wpis w Wolnych ładunkach lub Planowanych relacjach, który pasuje do relacji zalogowanego spedytora/kierownika według istniejącego mechanizmu dopasowania, uruchamia zieloną pulsującą poświatę bezpośrednio na odpowiednim kafelku planu. Poświata pozostaje do pierwszego najechania kursorem na ten kafelek. Stan odczytu jest zapisywany per użytkownik i nie znika przy samym renderowaniu.
- Niebieski alert nowej pozycji kolejki nie jest pokazywany użytkownikowi, który sam tę pozycję dodał. Alerty nowych pozycji dodanych przez innych nadal działają, a nieprzeczytana wiadomość przy własnej pozycji nadal pokazuje ikonę koperty z niebieską poświatą.
- Kierownik oddziału jest traktowany w powiadomieniach jak spedytor, zgodnie z jego zakresem uprawnień.
- Wolne ładunki i Planowane relacje korzystają z tego samego rozszerzonego formularza „Szczegóły zlecenia” co przycisk „+” na planie: ten sam układ zlecenia, dokument, analiza AI, punkty trasy, klient i finanse. Pola właściwe dla kolejki (widoczność, liczba wpisów / grupa planowanych) pozostają dodatkowymi kontrolkami docelowego miejsca zapisu.
- „Uwagi do zlecenia” oraz „Informacje dla kierowcy - dodawane do SMS” są domyślnie zwinięte, gdy są puste. Gdy zawierają dane (również uzupełnione przez AI), pozostają widoczne/rozwinięte.
- Z wyboru składników SMS usunięto przełączniki „Kilometry”, „Powitanie i data”, „Załadunek i godzina” i „Rozładunek i godzina”. Podstawowe dane nadal są generowane w SMS; użytkownik może dodatkowo sterować tylko polami rzeczywiście opcjonalnymi (drugi załadunek, drugi rozładunek, informacje dla kierowcy).
- W Administracji z przycisków „Import AI” usunięto symbol ✨.
- Klient może mieć maksymalnie 3 opiekunów: jednego głównego i maksymalnie dwóch dodatkowych. Limit jest normalizowany również przy zapisie centralnym i imporcie. Import AI klientów ma trzy pola opiekunów. Wyszukiwanie, lista klientów, szczegóły, mapa, klienci w rejonie oraz wspólne zapytania o ładunek pokazują/uwzględniają komplet przypisanych opiekunów.
- Administracja otrzymała przycisk „Wyślij kopię relacji e-mail”. Raport jest generowany z centralnej tabeli tms_relations w Supabase i wysyłany jako CSV oraz pełny JSON, obejmując również rekordy oznaczone jako nieaktywne, aby ułatwić awaryjne odtworzenie danych. Rekordy są pobierane stronami; większe załączniki są automatycznie kompresowane do .gz, a przekroczenie bezpiecznego limitu przerywa wysyłkę zamiast tworzyć niepełną kopię.
- Endpoint api/relations-backup-email.js obsługuje ręczne wysłanie przez zalogowanego Administratora (POST) oraz wywołanie przez zewnętrzny harmonogram (GET z CRON_SECRET). Sama paczka nie narzuca harmonogramu ani adresu odbiorcy.

Konfiguracja kopii e-mail:
- RESEND_API_KEY = klucz usługi wysyłkowej Resend.
- RELATIONS_BACKUP_TO_EMAIL = adres odbiorcy raportu; można podać maksymalnie 3 adresy rozdzielone przecinkiem lub średnikiem.
- RELATIONS_BACKUP_FROM_EMAIL = zweryfikowany adres nadawcy.
- CRON_SECRET = sekret wymagany wyłącznie przy automatycznym wywoływaniu endpointu przez harmonogram.
- Dla automatycznej kopii wymagany jest także SUPABASE_SERVICE_ROLE_KEY albo SUPABASE_SECRET_KEY po stronie serwera.

Zmiany V136 nie wymagają migracji bazy danych. Nie wykonano wdrożenia produkcyjnego ani wysyłki prawdziwego e-maila podczas testów lokalnych.

Wdrożenie: skopiuj pliki z paczki z zachowaniem ścieżek i wykonaj ponowne wdrożenie. Nowy plik serwerowy: api/relations-backup-email.js.

------------------------------------------------------------

AKTUALIZACJA v135 - 10.09.2026 (na bazie v134)
Identyfikator plików: request-workflow-v135-queue-attention-alerts

Najważniejsze zmiany V135:
- Nowy wpis w Wolnych ładunkach lub Planowanych relacjach uruchamia niebieską, pulsującą poświatę odpowiedniej zakładki do chwili jej otwarcia przez zalogowanego spedytora.
- Jeżeli nowy wpis jest dopasowany do planu/pojazdu zalogowanego spedytora według istniejącej logiki dopasowania (dokładny dystans do 150 km, zgodność wymagań i planu), alert otrzymuje zieloną poświatę. Zielony ma priorytet nad niebieskim.
- Stan nieprzeczytanego alertu jest przechowywany osobno dla użytkownika i oddziału w localStorage, więc nie znika przy zwykłym renderowaniu interfejsu.
- Otwarcie właściwego panelu kasuje alert tej kolejki. Jeżeli panel jest już otwarty w momencie nadejścia wpisu, wpis jest traktowany jako zobaczony.
- Dla relacji utworzonej przez zalogowanego spedytora, która ma nieprzeczytaną wiadomość od innej osoby, na właściwej zakładce pojawia się ikona koperty z niebieską poświatą.
- Koperta znika po odczytaniu czatu; wykorzystuje istniejący mechanizm odczytów tms_load_queue_chat_reads.
- Nie dodano agresywnego migania; animacja jest płynnym pulse/glow i respektuje prefers-reduced-motion.
- Bez migracji bazy danych. Czat nadal wymaga wcześniej przewidzianej migracji 030_load_queue_chat.sql.

Wdrożenie: skopiuj pliki z paczki z zachowaniem ścieżek i wykonaj ponowne wdrożenie. Zmiany V135 dotyczą public/tms.html, src/main.js i README_WDROZENIE.txt. Pliki test-v135.cjs i test-v135-behavior.cjs są pomocniczymi testami i nie są wymagane na serwerze.

------------------------------------------------------------

TOP DRAGON TMS - MAŁA PACZKA ZMIAN

AKTUALIZACJA v134 - 10.09.2026 (na bazie v133)
Identyfikator plików: request-workflow-v134-restore-order-form
- Przywrócono poprzedni wygląd formularza „Szczegóły zlecenia” z V130. Usunięto dodatkowy, rozbudowany panel „Punkty zlecenia”, który zmieniał wygląd formularza dodawania i podglądu relacji.
- Formularz ponownie pokazuje standardowe sekcje Załadunek i Rozładunek oraz opcjonalne pola „Drugi załadunek” i „Drugi rozładunek”.
- Dane wielu punktów wykrytych przez AI nadal są zachowywane przy zapisie relacji. Drugi załadunek i drugi rozładunek są odwzorowywane w istniejących polach formularza, bez dokładania nowego panelu do interfejsu.
- Zachowano poprawki V133 dotyczące położenia bocznych zakładek i pełnej szerokości paneli.
- Sprawdzono wygląd formularza dodawania i szczegółów oraz zapis relacji z sześcioma punktami do planu, Wolnych ładunków i Planowanych relacji. Testy regresji uruchamiania strony i formularza przeszły poprawnie.
Wdrożenie: skopiuj pliki z paczki z zachowaniem ścieżek i wykonaj ponowne wdrożenie. Zmiany V134 dotyczą public/order-entry.js, public/tms.html, src/main.js i README_WDROZENIE.txt. Migracja bazy nie jest potrzebna.

AKTUALIZACJA v133 - 09.09.2026 (na bazie v132)
Identyfikator plików: request-workflow-v133-lower-tabs-full-panels
- Prawy pasek zakładek został przesunięty o około 95 px niżej na dużym ekranie. Przy mniejszej wysokości okna jego położenie dopasowuje się tak, aby dolne zakładki pozostały dostępne.
- Usunięto prawe wcięcie 66 px z Asystenta spedytora i Najbliższego pojazdu. Oba panele wykorzystują ponownie całą dostępną szerokość.
- Sprawdzono wygląd paneli oraz dostępność zakładek przy wysokości okna 950 i 600 px. Test zachowania oczekujących kolejek także przeszedł.
Wdrożenie: skopiuj pliki z paczki z zachowaniem ścieżek i wykonaj ponowne wdrożenie. Zmiany V133 dotyczą public/tms.html i src/main.js. Paczka zachowuje wcześniejsze poprawki V132.

AKTUALIZACJA v132 - 09.09.2026 (na bazie v131)
Identyfikator plików: request-workflow-v132-inline-queue-startup
- Naprawiono błąd „restoreQueueOutbox is not defined” podczas powrotu z Administracji do planu. Funkcje obsługi kolejek i punktów zlecenia są teraz częścią głównego skryptu w public/tms.html i są inicjalizowane przed uruchomieniem synchronizacji. Strona nie oczekuje już na pobranie osobnego order-stops.js.
- Zmieniono identyfikator wersji ramki w src/main.js, aby pobrać aktualną stronę po wdrożeniu.
- Zachowano klucz lokalnej kopii oczekujących wpisów z V131, aby aktualizacja mogła odczytać istniejące niezapisane relacje.
- Testy lokalne: trzy cykle otwarcia Administracji i odtworzenia ramki planu; odpowiedzi z danymi kolejek przed zakończeniem ładowania skryptów; brak osobnego pliku pomocniczego; zachowanie oczekujących wpisów. Przeszły także testy odświeżenia obu kolejek, widoczności zakładek oraz zlecenia z sześcioma punktami. Nie wykonywano wdrożenia produkcyjnego.
Wdrożenie: skopiuj pliki z paczki z zachowaniem ścieżek i wykonaj ponowne wdrożenie. Ta poprawka zmienia public/tms.html i src/main.js; paczka zawiera także wcześniejsze zmiany V131. Migracja bazy nie jest potrzebna.

AKTUALIZACJA v131 - 09.09.2026 (na bazie v130)
Identyfikator plików: request-workflow-v131-queue-admin-tabs
- Administracja: adres Supabase jest weryfikowany przed żądaniem. Wartość sb_publishable_… nie jest używana jako URL; kod szuka poprawnego adresu w pozostałych zmiennych konfiguracyjnych. Jeśli go brakuje, pokazuje czytelny błąd. Oddziały są odczytywane przez zalogowaną sesję Supabase. Uprawnienia do nadawania roli Administratora pozostają weryfikowane na serwerze.
- Kolejki: spóźnione odświeżenie nie nadpisuje niepotwierdzonych lokalnych relacji. Kopia oczekujących wpisów jest odczytywana przed zapisem przy uruchamianiu strony i usuwana po potwierdzeniu zgodnych danych z serwera. Brak odpowiedzi na zapis uruchamia ponowienie. Błąd pobierania nie publikuje pustej listy.
- Pobieranie kolejek obejmuje wszystkie strony wyników. Wpisy z wcześniejszą datą pozostają widoczne z oznaczeniem „Termin minął — sprawdź”. Aplikacja nie wywołuje już automatycznego archiwizowania wolnych ładunków podczas odczytu.
- Administrator bez przypisanego oddziału wybiera oddział relacji przed zapisem. Wpis oczekujący ma informację „Oczekuje na potwierdzenie zapisu”.
- Zakładki pozostają widoczne po otwarciu Asystenta spedytora, Najbliższego pojazdu i szuflad. Otwarte panele mają osobny odstęp od paska zakładek.
- Usunięto pętlę odświeżania po odczycie zapisanych współrzędnych, która mogła blokować zdarzenia strony.
- AI: dokumenty i tekst zachowują uporządkowaną listę wszystkich punktów, z osobnymi adresami, datami i godzinami. Lista jest edytowalna w formularzu i szczegółach oraz zachowywana w planie kierowców, Wolnych ładunkach i Planowanych relacjach. Kolejki i kafelki pokazują dodatkowe punkty. Analiza nadal wymaga sprawdzenia przez spedytora.

WDROŻENIE v131
Skopiuj zawartość katalogów api, public i src z paczki do projektu V130, zachowując ścieżki, a następnie wykonaj ponowne wdrożenie. Ważny nowy plik: public/order-stops.js. To paczka zmienionych plików, a nie pełny projekt.
SUPABASE_URL powinien zawierać adres projektu https://…supabase.co. Klucz sb_publishable_… należy do SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_PUBLISHABLE_KEY. Administracja wymaga ponadto serwerowego SUPABASE_SECRET_KEY lub SUPABASE_SERVICE_ROLE_KEY. Nigdy nie umieszczaj tajnego klucza w zmiennej VITE_. Nie wyprowadzaj adresu projektu z klucza publikowalnego.
Zmiany nie wymagają nowej migracji bazy. Nie przywracają automatycznie rekordów już usuniętych lub zarchiwizowanych w Supabase. Ewentualne niezależne zadanie archiwizujące w bazie należy sprawdzić osobno.
Weryfikacja lokalna: test konfiguracji i uprawnień Administracji; odtworzenie obu oczekujących kolejek po przeładowaniu strony; potwierdzenie zapisu; spóźnione i nieudane odczyty; 1101 wpisów w trzech stronach wyników; zapis zlecenia z 6 punktami we wszystkich trzech miejscach; widoczność zakładek; regresja formularza i samouczka. Testy używały danych testowych i symulowanych odpowiedzi serwera. Nie wykonywano wdrożenia ani kontroli produkcyjnej bazy.

AKTUALIZACJA v128 - 06.09.2026
- Konto radek90211@gmail.com może wybrać kategorię Administrator podczas zapraszania użytkownika albo edycji istniejącego konta.
- Pozostali administratorzy nie widzą tej opcji i nie mogą nadać jej przez bezpośrednie wywołanie API.
- Nowe API api/admin/users.js ponownie weryfikuje aktywną rolę administratora oraz adres e-mail osoby nadającej uprawnienie.
- Głównego konta radek90211@gmail.com nie można zdezaktywować ani zdegradować. Konta Administratorów pozostają zablokowane do edycji dla pozostałych administratorów.
- Administrator nie wymaga przypisania do oddziału i otrzymuje stałe czerwone oznaczenie.

AKTUALIZACJA v127 - 06.09.2026
- Opisy kategorii w Administracji są teraz widoczne jako kompaktowy moduł bezpośrednio pod „Podglądem funkcji kategorii”.
- W stanie zwiniętym moduł pokazuje cztery kategorie i zajmuje tylko jeden wiersz. Przycisk „Rozwiń” pokazuje pełne uprawnienia, a „Zwiń” ponownie ogranicza wysokość panelu.
- Pełny opis pozostaje responsywny: cztery, dwie lub jedna kolumna zależnie od szerokości ekranu.

AKTUALIZACJA v126 - 06.09.2026
- Wyrównano panel „Podgląd funkcji kategorii”: pole wyboru i przyciski mają wysokość 36 px, czcionkę 14 px oraz jednakowe zaokrąglenia i odstępy.
- Nagłówek, etykieta kategorii i przyciski są wyśrodkowane w pionie. Na małych ekranach elementy przechodzą do kolejnych wierszy.

AKTUALIZACJA v125 - 06.09.2026
Identyfikator plików: request-workflow-v125-admin-role-guide
- W karcie Administracja, bezpośrednio pod podglądem kategorii, dodano sekcję „Funkcje kategorii użytkowników”.
- Osobne karty opisują funkcje Spedytora, Kierownika oddziału, Rozliczeń i Administratora wraz z zakresem oraz najważniejszymi ograniczeniami.
- Opis uwzględnia akceptację przypisań klientów przez kierownika, zastępstwa urlopowe, AI dla kierownika oraz zakaz dodawania wyrównań przez Rozliczenia.
- Układ dopasowuje się do szerokości ekranu: cztery kolumny na dużym ekranie, dwie na średnim i jedna na telefonie.
- Sprawdzono składnię oraz obecność i kompletność czterech kart. Nie wykonywano wdrożenia produkcyjnego.

AKTUALIZACJA v124 - 06.09.2026
Identyfikator plików: request-workflow-v124-role-permissions
- Każde przypisanie opiekuna klienta wymaga decyzji kierownika oddziału. Administrator może usunąć klienta oczekującego, ale nie zatwierdza przypisania.
- Zapytanie handlowe obsługuje opiekun klienta. Podczas jego urlopu zadanie przejmuje kierownik oddziału albo wskazany zastępca; kierownik może wyznaczyć użytkownika oddziału na czas własnej nieobecności.
- Kierownik oddziału otrzymał analizę dokumentów i tekstu za pomocą AI oraz funkcje spedytora, w tym obsługę własnych transferów wyniku, przy zachowaniu dodatkowych uprawnień do całego oddziału.
- Rozliczenia nie mogą tworzyć wyrównań przewoźników. Nadal mogą je przeglądać, usuwać błędne wpisy i ustawiać status rozliczenia.
- Sprawdzono składnię, bramki uprawnień oraz działanie formularza i samouczka w przeglądarce. Połączenia z produkcyjną bazą i usługą AI nie były wykonywane.

AKTUALIZACJA v123 - 06.09.2026
Identyfikator plików: request-workflow-v123-order-entry-tutorial
- Dodaj relację na planie otwiera Szczegóły zlecenia: formularz po lewej, dokument po prawej, wybór/upuść plik i przycisk Analizuj zlecenie AI.
- Analiza uzupełnia żółte pola roboczego formularza; zapis relacji następuje dopiero po zatwierdzeniu. Ręczne poprawki wykonane podczas analizy są zachowywane.
- Wyłączono automatyczne kotwiczenie przewijania; zakładki boczne zachowują pozycję strony.
- Samouczek relacji aktualizuje wskazówki bez ponownego budowania planu i formularza. Dalej jest blokowane do wykonania akcji lub uzupełnienia wymaganego pola.
- Podświetlenie śledzi bieżący element, także po przewinięciu; przycisk dodawania jest wybierany z widocznej części planu.
- Wymagany nowy plik public/order-entry.js, dołączony do paczki.
- Sprawdzono składnię i działanie w przeglądarce Edge: układ, pola, przejścia i blokady samouczka, przesuwanie podświetlenia oraz uzupełnianie formularza odpowiedzią AI. Odpowiedź AI była symulowana; nie wykonano wywołania produkcyjnego ani wdrożenia.

Wgraj zawartość tej paczki do katalogu głównego projektu, zachowując foldery:
- api
- public
- src

Pliki należy zastąpić ich wersjami z paczki. Nie usuwaj pozostałych plików projektu.

W konfiguracji wdrożenia sprawdź, czy ustawione są oddzielnie:
- SUPABASE_URL = adres zaczynający się od https:// i kończący .supabase.co
- SUPABASE_ANON_KEY albo SUPABASE_PUBLISHABLE_KEY = klucz publikowalny sb_publishable_...
- GEMINI_API_KEY = klucz Google Gemini używany wyłącznie po stronie serwera

Domyślny model analizy to gemini-3.6-flash. Jeżeli w Vercel istnieje zmienna
GEMINI_MODEL albo GEMINI_IMPORT_MODEL, ustaw ją na gemini-3.6-flash lub usuń,
aby aplikacja użyła aktualnej wartości domyślnej.

Analiza dokumentów korzysta z Gemini Interactions API i minimalnego poziomu
rozumowania, aby małe zlecenia PDF nie oczekiwały niepotrzebnie na długą analizę.
Limit funkcji analizy dokumentu wynosi 120 s, a aplikacja oczekuje na jej wynik
do 130 s. Dzięki temu pierwsze uruchomienie Gemini nie jest przerywane po 55–70 s.

Import zlecenia zachowuje dokładne adresy, uwagi i stawki także w EUR. Plik PDF
lub Word można upuścić na stronę albo w Szczegółach zlecenia. W zakładkach
„Planowane relacje” i „Wolne ładunki” jeden przycisk „+ Dodaj relację” pozwala
wybrać ręczne wprowadzanie albo analizę PDF, Word i tekstu. Analizator można
zminimalizować do prawej ikony pokazującej pauzę, analizę, błąd lub gotowy wynik.
Analiza tekstu używa szybkiego trybu Gemini, ponawia odpowiedź po chwilowym
przeciążeniu i ma lokalny tryb awaryjny.
Linki Google Maps i Impargo działają również na adresach bez zapisanych wcześniej
współrzędnych.

W tej aktualizacji pełny adres zakładu ma pierwszeństwo przed zapisanymi wcześniej
współrzędnymi samej miejscowości. Dotyczy to zarówno Google Maps, jak i Impargo;
punkt z poprzedniej relacji pozostaje wyłącznie punktem dolotu. AI nie przenosi
adresu z innej relacji, a do SMS trafiają tylko wydzielone informacje potrzebne
kierowcy — bez stawek, kosztów i wewnętrznych uwag spedytora.

AI odczytuje również nazwę, NIP i adres klienta. Gdy spedytor analizuje dane
nowego klienta, aplikacja prosi o potwierdzenie dodania go do Bazy klientów.
Usunięto globalny przycisk AI oraz przyciski otwierania planu i mapy w osobnym
oknie.

Nowe wolne ładunki są chronione przed nadpisaniem przez starszą odpowiedź
synchronizacji i są od razu wysyłane do wspólnej kolejki. Po ręcznym zapisie lub
ostatnim kroku importu lista pozostaje otwarta, dzięki czemu wpis nie znika z widoku.

Sekcja „Godziny dodawania relacji” pokazuje aktywność w przedziałach 30-minutowych,
dokładną godzinę każdej operacji oraz pozwala wskazać własny okres dat.

Aktualizacja v103 dodaje wybór waluty PLN/EUR przy stawce, skalowanie planu i mapy,
podgląd prostej trasy na mapie rozładunków oraz dokładne przejście z wyszukiwarki
do pojedynczego kafelka. Widok „Zlecenia” oznacza na zielono relacje z zapisanym
dokumentem, a na czerwono relacje bez dokumentu. Plik pozostaje dostępny w
szczegółach po synchronizacji relacji.

Oczekujący transfer wyniku pokazuje pulsującą niebieską poświatę przy ikonie $
u nadawcy i odbiorcy. Odbiorca otrzymuje komunikat z przyciskami akceptacji i
odrzucenia. Przycisk $ ma warstwę nad kafelkiem relacji i pozostaje klikalny.

Kod odpowiedzialny za otwieranie Google Maps nie został zmieniony w v103.

Aktualizacja v104 usuwa procentową skalę z nagłówka Mapy rozładunków i porządkuje
jej przyciski w grupę filtrów oraz osobną grupę okresu i daty. Usunięto też opis
z liczbą rozładunków. Kliknięcie pustego miejsca na mapie czyści linię i strzałki
wybranej relacji.

Skala Planu kierowców działa teraz w zakresie 50-160%. Razem z kafelkami skaluje
się ich tekst. Przycisk $ pozostaje nad kafelkiem relacji, ale chowa się pod
przyklejonymi kolumnami podczas poziomego przewijania.

Aktualizacja v105 naprawia całą „Pomoc krok po kroku”. Samouczki Bazy klientów,
Kierowców i pojazdów, Asystenta spedytora oraz Najbliższego pojazdu zaczynają od
widocznego przycisku „Pokaż”. Pomoc AI prowadzi przez aktualną boczną zakładkę
„Planowane relacje”, przycisk „+ Dodaj relację” i opcję „PDF, Word lub tekst”.
Każdy krok automatycznie przygotowuje wymagany panel, a podświetlenie pomija
elementy ukryte lub nieobecne w bieżącym widoku.

Aktualizacja v106 dodaje pojedyncze kliknięcie kafelka relacji. Otwiera ono
szczegóły oraz rysuje podgląd trasy na mapie z punktem zawierającym klienta,
stawkę i łączną liczbę kilometrów. Te same dane są widoczne w oknie punktu
pojazdu na mapie. Dwuklik szybkiej zmiany rozładunku i przeciąganie kafelka
pozostają rozdzielone od zwykłego kliknięcia.

Przycisk „Usuń podgląd” ukrywa dokument bez jego natychmiastowego ponownego
otwierania. Pole waluty ma osobną, węższą kolumnę i nie nachodzi na wartość
stawki. Automatyczna wiadomość dla kierowcy zawiera tylko punkty i terminy
załadunku oraz rozładunku, dodatkowe postoje i krótkie uwagi operacyjne.

Aktualizacja v107 stabilizuje układ przycisku „Bazy kierowców” i po włączeniu
warstwy nie zmienia już jego tekstu ani szerokości. Formularz dodawania korzysta
z pełnego układu szczegółów i jest nazwany „Dodaj trasę”. Przywrócono wcześniejszy,
pełny układ wiadomości SMS dla kierowcy.

Rozpoznane przez AI informacje nad dokumentem mają pola wyboru. Spedytor może
zaznaczyć pojedyncze pozycje, zaznaczyć wszystkie i usunąć wybrane oznaczenia bez
kasowania poprawionych wartości w formularzu. PDF jest przechowywany razem z
relacją w Supabase. Po użyciu „Usuń podgląd” można go ponownie wyświetlić jednym
kliknięciem, a użytkownicy z dostępem do relacji mogą otworzyć zapisany dokument.
Sam plik jest zapisywany przed analizą, więc pozostaje przy relacji także wtedy,
gdy analiza AI zakończy się błędem lub przekroczy czas oczekiwania.

Kliknięcie pustego miejsca po obejrzeniu trasy usuwa linię i punkt informacyjny,
zamyka okno relacji oraz przywraca podstawowy widok mapy Polski.

Aktualizacja v108 wyłącza automatyczne zbliżanie mapy po wybraniu relacji. Przy
pomniejszaniu Planu kierowców tekst w kafelkach jest kompensowany, dzięki czemu
pozostaje czytelny. Operacja ukrywania i pokazywania kierowcy aktualizuje widok
od razu i nie pobiera ponownie całej floty po własnym zapisie.

W oknie „Transfery spedytora” odbiorca może rozpocząć usuwanie transferu oraz
potwierdzić prośbę drugiej strony. Formularz „Dodaj trasę” ma uspójnioną,
spokojniejszą paletę. Przycisk „+ Dodaj PUSTY kafelek” tworzy edytowalny kafelek,
który spedytor może później uzupełnić w szczegółach.

Usunięto wywołania przekazujące duże zbiory jako tysiące argumentów funkcji. To
eliminuje znaną przyczynę błędu „Maximum call stack size exceeded” przy większej
liczbie danych.

Aktualizacja v111 porządkuje główny obszar roboczy. Nagłówek jest domyślnie
schowany i wysuwa się po najechaniu na cienki pasek u góry. Asystent spedytora,
Najbliższy pojazd, ustawienia Planu kierowców, Mapa, Planowane relacje, Wolne
ładunki i Statystyki są dostępne jako spójne ikony po prawej stronie. Nazwa
narzędzia rozwija się po najechaniu, a zamknięte panele nie zajmują miejsca nad
tablicą. Na urządzeniach dotykowych nagłówek pozostaje stale dostępny.

Przycisk Minimalizuj analizator został zastąpiony znakiem minimalizacji okna.
Wspólna ikona stanu AI w prawym dolnym rogu pokazuje trwanie, błąd i zakończenie
analizy również dla zleceń w szczegółach oraz importów administracyjnych.

Aktualizacja v112 ujednolica dodawanie nowych kafelków w pełnym formularzu
„Dodaj trasę”, odpowiadającym układowi Szczegółów zlecenia. Pola kilometrów,
stawki, waluty, gabarytu i kosztu mają równe wysokości i szerokości kolumn.

Parser dokumentów naprawia typowe uszkodzenia odpowiedzi Gemini, między innymi
brakujący przecinek między polami JSON, i korzysta z większego limitu odpowiedzi.
Nowy klient rozpoznany przez AI jest zapisywany wyłącznie z nazwą i NIP-em,
bez opiekuna oraz bez automatycznego uznawania adresu za bazę. Serwer dodatkowo
wymusza brak opiekuna dla nowych kart tworzonych przez spedytora.

Administrator może w edycji klienta dodawać i usuwać potwierdzone bazy lub
magazyny. Każda baza ma własną nazwę i dokładny adres. Na mapie w warstwie
„Bazy klientów” pojawiają się wyłącznie te potwierdzone lokalizacje.

Aktualizacja v109 usuwa modalne powiadomienie „Transfer wyniku oczekuje na
decyzję”. Oczekujący transfer nadal jest widoczny pod pulsującą ikoną $ i można
go obsłużyć w rozliczeniach. Po dodaniu floty pojawia się krótki komunikat
„Kierowca zapisany”.

Kafelki relacji wykorzystują prawie całą wysokość wiersza, a nazwa rozładunku
może zajmować kilka linii. Przy pomniejszeniu planu czcionka nadal rośnie, ale
pozostawia więcej miejsca na pełną nazwę miejscowości.

Aktualizacja v110 dodatkowo powiększa nazwę miejscowości i wykorzystuje całą
dostępną wysokość kafelka. Identyfikator spedytora, który umieścił relację u
innego spedytora, ponownie znajduje się bezpośrednio po lewej stronie nazwy.

Na skupionym znaczniku kilku pojazdów można wybrać konkretny wiersz lub przycisk
„Trasa”. Mapa narysuje wtedy załadunek i rozładunek właściwego kierowcy oraz
osobny punkt załadunku z nazwą klienta. Wyłączono automatyczne przesuwanie mapy
przez okna informacji i zabezpieczono obsługę przed nakładającymi się kliknięciami.
Zapisane PDF-y są osadzane dopiero po użyciu „Pokaż podgląd”, co ogranicza pamięć
i usuwa kolejną przyczynę błędu „Maximum call stack size exceeded”.

Po wdrożeniu wykonaj pełne odświeżenie strony. Cache-buster pliku tms.html został
podniesiony w src/main.js.

Aktualizacja v113 dopasowuje nazwę miejscowości osobno do każdego kafelka.
Tekst jest wyśrodkowany i otrzymuje największy rozmiar, przy którym cała nazwa
nadal mieści się w dostępnej szerokości i wysokości. Znacznik osoby, która
umieściła relację u innego spedytora, pozostaje po lewej stronie nazwy.
Zakładka i rozwinięty panel „Najbliższy pojazd” mają pełne, nieprzezroczyste tło.

Aktualizacja v114 ujednolica motyw wszystkich prawych zakładek i wysuwanych
paneli. W trybie jasnym mają białe tło i ciemny tekst, a w trybie ciemnym
ciemnogranatowe tło i jasny tekst. Aktywna zakładka jest oznaczona niebieską
krawędzią bez odwracania kolorystyki całego przycisku.

Aktualizacja v115 przesuwa cały prawy pasek zakładek o około 5 cm w dół.
Otwarcie „Planowanych relacji” albo „Wolnych ładunków” nie przesuwa już żadnej
zakładki. Wyszukiwarka „Najbliższy pojazd” pomija kierowców bez pozycji
wynikającej z ostatniego rozładunku i nie pokazuje ich w fikcyjnej bazie domyślnej.

AKTUALIZACJA v116 - 05.09.2026
Identyfikator plików: request-workflow-v116-unified-location-search
- Wspólne wyszukiwanie miejscowości i kodów w formularzach, szybkiej edycji oraz Najbliższym pojeździe.
- Pełna nazwa Ostrowiec Świętokrzyski dla 27-400 i 27-406; pozostałe miejscowości Ostrowiec zachowane.
- Wyszukiwanie bez polskich znaków, z zachowaniem osobnych tożsamości Sad i Sąd.
- Do 80 podpowiedzi i brak automatycznego wskazywania pierwszego kodu przy niejednoznacznej nazwie.
- Wspólna pamięć wyników; aktualne nazwy z relacji są dodatkowym źródłem podpowiedzi.
- Naprawiony połączony rekord Warszawa/Żydy; baza ma 53 266 poprawnych strukturalnie rekordów.
- 19 zestawów testowych oraz kontrola uprawnień i składni: 21/21 poprawnie.
- Reguła kierowców bez ostatniej relacji i położenie prawego paska pozostają jak w v115.
- Podgląd wizualny na monitorze użytkownika pozostaje do sprawdzenia; lokalny HTML został zablokowany przez politykę przeglądarki narzędzia.

ŹRÓDŁA KOREKTY PNA (sprawdzone 05.09.2026)
Warszawa 01-016: przybliżony punkt obszaru kodu 52.2393, 20.9841:
https://kodpocztowy.org/01-016-warszawa
https://xn--kodw-pocztowych-xrb.cybo.com/polska/01-016_warszawa
Żydy, gmina Kowale Oleckie, SIMC 0760640: kod 19-420 i punkt miejscowości 54.125000, 22.350556:
https://www.polskawliczbach.pl/wies_Zydy_warminsko_mazurskie
Potwierdzenie kodu w ogłoszeniu publicznym:
https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/08de82bd-174d-e7ec-056e-e50001ac8fc3
Punkty PNA i miejscowości nie zastępują dokładnego adresu załadunku/rozładunku.

AKTUALIZACJA v117 - 05.09.2026
Identyfikator plików: request-workflow-v117-admin-layout
- Usunięto opis „Archiwum relacji jest przechowywane centralnie i dostępne wyłącznie w eksporcie.”
- Zawartość zakładki Administracja podzielono na wyraźne obszary: organizacja firmy, rozliczenia przewoźników i zespół.
- Nagłówek Administracji pokazuje liczbę aktywnych oddziałów, użytkowników i bieżącą stawkę.
- Karty oddziałów i zapraszania pracowników mają równy, uporządkowany układ.
- Lista użytkowników ma czytelniejszy układ pól i dostosowuje się do węższych ekranów.
- Kontrola objęła 20 zestawów testowych, uprawnienia i składnię: 22/22 poprawnie.

AKTUALIZACJA v118 - 05.09.2026
Identyfikator plików: request-workflow-v118-export-hours-branch-resize
- Wycentrowano pionowe linie we wszystkich chwytakach rozszerzania kafelków relacji.
- Eksport planu przelicza dziesiętne wartości godzin na format HH:MM, np. 5.5 na 05:30 i 22.5 na 22:30.
- Kolumna Oddział w eksporcie pokazuje nazwę oddziału ustaloną z danych kierowcy, spedytora lub katalogu oddziałów.
- Nierozpoznany identyfikator techniczny nie jest wpisywany do kolumny Oddział.
- Kontrola objęła 21 zestawów testowych, uprawnienia i składnię: 23/23 poprawnie.

AKTUALIZACJA v119 - 05.09.2026
Identyfikator plików: request-workflow-v119-compact-admin-current-time
W Administracji usunięto liczniki oddziałów i użytkowników oraz możliwość dodawania kolejnych oddziałów. Podgląd kategorii i wspólna stawka przewoźników zajmują mniej miejsca. Po wejściu do planu widok ustawia czerwoną linię aktualnej godziny po lewej stronie, z odstępem jednej kolumny dziennej.


AKTUALIZACJA v120 - 05.09.2026
Identyfikator plików: request-workflow-v120-plan-order-sms-choice
Nazwy na kafelkach mają maksymalny rozmiar 16 px. Zlecenie PDF, DOC lub DOCX można upuścić bezpośrednio na komórkę albo linię wybranego kierowcy na planie; po analizie AI otwiera się formularz Szczegóły zlecenia. Żółte dane rozpoznane przez AI są pokazane na powierzchni podglądu dokumentu. W szczegółach relacji spedytor wybiera grupy informacji umieszczane w SMS.


AKTUALIZACJA v121 - 05.09.2026
Identyfikator plików: request-workflow-v121-grouped-map-routes
Kliknięcie wspólnego punktu dwóch lub większej liczby pojazdów pokazuje jednocześnie trasy, którymi wszystkie pojazdy przyjechały, z osobnymi kolorami linii i znaczników załadunku. Pierwsze kliknięcie pustego obszaru mapy zamyka dymek informacyjny, pozostawiając trasy. Drugie kliknięcie usuwa podgląd tras i przywraca podstawowy widok mapy.

AKTUALIZACJA v122 - 06.09.2026
Identyfikator plików: request-workflow-v122-admin-client-fleet-controls
- Usunięto opis spod nagłówka „Do akceptacji” w bazie klientów.
- Administrator może usuwać klienta bezpośrednio z listy wniosków o akceptację; oczekujące wnioski tego klienta są przy tym zamykane.
- Administrator może zaznaczyć wielu kierowców i trwale przepisać ich do wybranego spedytora z tego samego oddziału.
- Operacja zbiorcza aktualizuje centralne przypisania floty i jest niedostępna dla pozostałych kategorii użytkowników.

AKTUALIZACJA v181 - bezpośrednie łączenie i rozdzielanie kafelków
Build/cache: request-workflow-v181-tile-join-separate-grid

- Kafelek można przeciągnąć bezpośrednio na inny kafelek. Obie relacje tworzą wtedy dwie połówki jednej kolumny dnia, ale zachowują osobne dane i statusy.
- Na każdej połówce pojawia się przycisk „Rozdziel”. Wybrana relacja przechodzi do najbliższego wolnego dnia po prawej, a druga ponownie zajmuje cały pierwotny dzień.
- „Podziel” nadal tworzy drugą, niezależną relację i od razu otwiera wpisywanie jej miejsca rozładunku.
- Usunięto pionowe linie godzinowe wewnątrz kolumn. Granice oddzielające kolejne dni pozostają widoczne.

WERYFIKACJA
Sprawdzono składnię wszystkich skryptów, obecność obsługi upuszczenia bezpośrednio na kafelek, rozdzielanie pary, zachowanie osobnych identyfikatorów/statusów i reguły CSS siatki. Bez nowego pliku test-v.
Paczka względem V180 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v182 - czyste kafelki i przeciąganie bez linii
Build/cache: request-workflow-v182-clean-tile-drag

- Usunięto przyciski „Podziel” i „Rozdziel” z kafelków relacji.
- Usunięto niebieską pionową linię pomocniczą pokazywaną podczas przeciągania kafelka.
- Przeciąganie relacji i łączenie przez upuszczenie kafelka bezpośrednio na innym kafelku pozostają aktywne.
- Zmieniono podpowiedź nad planem, aby opisywała aktualne sterowanie.

WERYFIKACJA
Sprawdzono składnię skryptów, brak generowania przycisków Podziel/Rozdziel oraz brak tworzenia elementu route-drop-guide. Bez nowego pliku test-v.
Paczka względem V181 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v183 - skróty klawiaturowe i płynna zmiana koloru
Build/cache: request-workflow-v183-tile-keyboard-fast-color

- Zmiana czerwonego lub domyślnego koloru czcionki aktualizuje tylko wybrany kafelek. Tablica nie jest ponownie renderowana, dzięki czemu operacja nie powoduje laga.
- Po pojedynczym zaznaczeniu kafelka Ctrl+C kopiuje czytelne dane relacji do schowka systemowego.
- Ctrl+X kopiuje dane i otwiera dotychczasowe potwierdzenie usunięcia. Klawisz Delete otwiera potwierdzenie usunięcia zaznaczonego kafelka.
- Skróty nie działają podczas wpisywania w polach formularzy, polach tekstowych ani listach wyboru.
- Ręczne odłączenie połówki, przeciągnięcie jej do pustego dnia lub usunięcie jednej części automatycznie rozszerza pozostały kafelek na cały dzień.

WERYFIKACJA
Sprawdzono składnię skryptów, bezpośrednią aktualizację klasy koloru, obsługę Ctrl+C/Ctrl+X/Delete, pomijanie aktywnych pól formularzy oraz rozszerzanie osieroconej połówki. Bez nowego pliku test-v.
Paczka względem V182 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v184 - płynne pary, szybki kolor i wypełniona tablica
Build/cache: request-workflow-v184-smooth-pairs-board-fill

- Łączenie rozpoznaje teraz wyłącznie rzeczywistą parę: wspólny identyfikator, kierowcę i datę. Osierocone oznaczenia są automatycznie czyszczone, dlatego dwa osobne kafelki można ponownie połączyć.
- Łączenie i rozdzielanie natychmiast aktualizuje tylko oba zainteresowane kafelki. Pełne wyrównanie tablicy i zapis wykonują się z krótkim opóźnieniem, co usuwa przycięcia.
- Zmiana koloru czcionki natychmiast zmienia klasę kafelka i zamyka samo menu kontekstowe. Nie przebudowuje tablicy; synchronizacja jest opóźniona o 450 ms.
- Relacje demonstracyjne wypełniają wszystkich kierowców od 28.09 do 05.10, łącznie z weekendem. Dodatkowo 16 kierowców otrzymuje relację 06.10.
- Każda nowa relacja demonstracyjna zajmuje dokładnie cały dzień. Istniejące rzeczywiste relacje nadal mają pierwszeństwo.

WERYFIKACJA
Sprawdzono składnię skryptów, czyszczenie osieroconego stanu pary, aktualizację dwóch kafelków bez pełnego renderu, opóźniony zapis koloru oraz zakres i liczebność relacji demonstracyjnych. Bez nowego pliku test-v.
Paczka względem V183 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v185 - płynna mapa przy zmianie daty
Build/cache: request-workflow-v185-map-date-performance

- Zmiana daty aktualizuje tylko warstwę pojazdów. Markery klientów i baz kierowców nie są już usuwane, tworzone oraz ponownie wiązane przy każdym dniu.
- Usunięto kosztowne budowanie wspólnej sygnatury ze wszystkich relacji, klientów i baz podczas każdej zmiany daty.
- Warstwy klientów i baz mają niezależne wersje oraz odświeżają się dopiero po zmianie ich danych, filtra albo widoczności.
- Cięższa aktualizacja Leaflet jest wykonywana po wyrenderowaniu klatki interfejsu; szybko następujące zmiany daty anulują wcześniejsze oczekujące aktualizacje.
- Dopasowanie widoku mapy używa krótkich numerów wersji warstw zamiast wielokrotnego łączenia list wszystkich markerów.

WERYFIKACJA
Sprawdzono składnię skryptów, niezależne sygnatury pojazdów/klientów/baz, anulowanie nieaktualnej aktualizacji i brak skanowania pełnej bazy klientów w sygnaturze zmiany daty. Bez nowego pliku test-v.
Paczka względem V184 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v186 - kopiowanie relacji i grupy do trzech kafelków
Build/cache: request-workflow-v186-shared-copy-three-routes

- Ctrl+C zapisuje pełną kopię relacji także w schowku systemowym i pamięci aplikacji. Po wskazaniu dnia Ctrl+V tworzy nową, niezależną relację zamiast przenosić oryginał.
- Kopię można umieścić na tablicy innego spedytora. Otrzymuje ona właściciela zgodnego z docelowym pojazdem i status oczekujący, aby spedytor docelowy zachował kontrolę nad swoją tablicą.
- Relacje można łączyć po dwie lub trzy w jednym dniu. Każda zachowuje własne dane oraz status, a czwarta jest blokowana czytelnym komunikatem.
- Rozdzielenie jednej relacji z grupy automatycznie wyrównuje pozostałe dwie albo rozszerza ostatnią na cały dzień.
- Zmiana szerokości przy łączeniu i rozdzielaniu aktualizuje geometrię oraz klasę rozmiaru czcionki tylko dla zmienianych kafelków. Usunięto animowanie właściwości wpływających na układ.

WERYFIKACJA
Sprawdzono składnię skryptów, kopiowanie i wklejanie pełnej relacji, własność kopii na obcej tablicy, limit trzech relacji, niezależność statusów oraz przeliczanie szerokości grupy 1/2/3. Bez nowego pliku test-v.
Paczka względem V185 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v187 - jedno pole lokalizacji, stabilny start i widoczne podpowiedzi
Build/cache: request-workflow-v187-location-suggestions-stable-board

- Szybkie wprowadzanie relacji używa jednego pola „Miejscowość lub kod pocztowy”. Usunięto osobną, wąską komórkę kodu.
- Lista podpowiedzi pokazuje nazwę miejscowości i początek kodu po nazwie, np. „Zgorzelec · 59-”. Pełny kod wybranej pozycji nadal zapisuje się w danych relacji.
- Wybór podpowiedzi nadal wymaga jednego kliknięcia, a Enter lub Tab zatwierdza pierwszą dopasowaną lokalizację.
- Usunięto dwa zbędne pełne renderowania planu wykonywane klatkę po uruchomieniu strony.
- Odpowiedzi rozliczeń tygodniowych są łączone w jedną aktualizację tablicy zamiast wywoływać serię przebudów planu i kafelków.
- Zarezerwowano stałe miejsce na pasek przewijania, aby pojawienie się danych nie przesuwało planu w poziomie.
- Podpowiedzi w „Najbliższym pojeździe” są wyświetlane w najwyższej warstwie strony i automatycznie otwierają się pod albo nad polem, zależnie od dostępnego miejsca.

WERYFIKACJA
Sprawdzono składnię skryptów, brak osobnego pola kodu, prezentację prefiksu kodu, zapis pełnego kodu z wybranej lokalizacji, portal podpowiedzi ponad planem oraz redukcję dodatkowych renderów startowych. Bez nowego pliku test-v.
Paczka względem V186 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v188 - stabilne pierwsze wyświetlenie planu
Build/cache: request-workflow-v188-stable-initial-board

- Plan kierowców nie jest już najpierw wyświetlany z danymi demonstracyjnymi i następnie wielokrotnie podmieniany danymi produkcyjnymi.
- Podczas startu widoczny jest nieruchomy panel „Przygotowywanie planu kierowców” o stałej wysokości.
- Pierwszy właściwy plan pojawia się dopiero po otrzymaniu katalogu użytkowników, floty, relacji i podsumowań tygodniowych.
- Odpowiedzi startowe nie przebudowują ukrytego planu osobno. Po zebraniu danych wykonywany jest jeden pełny render.
- Dodano limit oczekiwania 3,5 sekundy, aby awaria jednej odpowiedzi nie blokowała dostępu do planu.
- Późniejsze aktualizacje Realtime nadal odświeżają plan normalnie i zachowują bieżącą pozycję przewijania.

WERYFIKACJA
Sprawdzono składnię skryptów, wszystkie trzy kolejności odpowiedzi użytkownicy/flota/relacje, oczekiwanie na rozliczenia tygodniowe, pojedynczy render końcowy oraz awaryjne zakończenie bufora po 3,5 sekundy. Bez nowego pliku test-v.
Paczka względem V187 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v189 - archiwalne kolejki i kopiowanie administratora
Build/cache: request-workflow-v189-admin-copy-queue-archive-locations

- Wolne ładunki oraz Planowane relacje mają rozwijane archiwum dostępne dla zalogowanych pracowników.
- Każda karta w obu kolejkach pokazuje status „Tablica: dodano” albo „Tablica: nie dodano”; archiwum jest wyłącznie do odczytu.
- Administrator może kopiować kafelki z każdej tablicy i wkleić je do wskazanego kierowcy; kopia zapisuje się w oddziale docelowego kierowcy.
- Wyszukiwarka lokalizacji uzupełnia miasta z lokalnego indeksu współrzędnych, w tym Żagań (68-100), także gdy brakowało ich w danych kodów pocztowych.

AKTUALIZACJA v190 - usunięty ekran ładowania planu
Build/cache: request-workflow-v190-no-board-loading-screen

- Plan kierowców renderuje się od razu po wejściu do aplikacji.
- Usunięto ekran „Przygotowywanie planu kierowców”; synchronizacja danych nadal odbywa się w tle.

AKTUALIZACJA v191 - stabilna pozycja planu po uruchomieniu
Build/cache: request-workflow-v191-stable-board-entry

- Usunięto opóźnione automatyczne przewijanie planu do aktualnej godziny.
- Plan i kafelki pozostają w tej samej pozycji od pierwszego wyświetlenia.
- Linia aktualnej godziny nadal jest wyświetlana w kolumnie bieżącego dnia.

AKTUALIZACJA v192 - stała kolejność kierowców na planie
Build/cache: request-workflow-v192-stable-driver-order

- Kolejność wierszy planu jest ustalana przy pierwszym wyświetleniu i pozostaje stała w trakcie sesji.
- Aktualizacja danych, nazw lub przypisania spedytora nie przestawia istniejących kierowców ani kafelków.
- Nowy kierowca pojawia się na końcu aktualnej tablicy bez przesuwania pozostałych wierszy.

AKTUALIZACJA v193 - pełny, oficjalny indeks PNA
Build/cache: request-workflow-v193-official-pna-index

- Wyszukiwarka miejscowości i kodów pocztowych korzysta teraz z pełnego indeksu 72 731 unikalnych par kod–miejscowość oraz 20 485 kodów ze „Spisu PNA” Poczty Polskiej z 01.07.2026, przekazanego przez właściciela projektu.
- Jeden wspólny indeks obsługuje formularze relacji, szybką edycję kafelków, wyszukiwarkę „Najbliższy pojazd”, import i sprawdzanie lokalizacji na mapie.
- Zachowano 53 265 istniejących, zweryfikowanych punktów mapy. Pozostałe poprawne pary PNA są dostępne w podpowiedziach, a ich pozycja jest ustalana przez dotychczasowe precyzyjne geokodowanie adresu, bez zgadywania współrzędnych.
- Weryfikacja importu: 119 454 rekordy źródłowe, 0 brakujących nazw miejscowości i 0 błędnych kodów po odczycie kolumnowego układu dokumentu; powtórzenia ulic zostały scalone do unikalnych par kod–miejscowość.

WERYFIKACJA
Kontrola kompletności oficjalnych par PNA w osadzonym indeksie, walidacja składni osadzonych skryptów oraz sprawdzenie wyszukiwania po mieście i kodzie. Bez nowego pliku test-v.
Paczka względem V192 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v194 - oś czasu nad kafelkami i bez przycisków dodawania
Build/cache: request-workflow-v194-timeline-on-top-no-add-plus

- Linia bieżącej godziny oraz jej etykieta są zawsze rysowane ponad kafelkami relacji, także w kolorowanych komórkach i trybie ciemnym. Linia nie blokuje kliknięcia ani przeciągania kafelków.
- Usunięto wszystkie przyciski „+” z komórek planu kierowców wraz z nieużywaną logiką ich przesłaniania.
- Dodawanie relacji w trybie tabeli pozostaje dostępne przez dotychczasowy dwuklik w komórce z datą.

WERYFIKACJA
Kontrola składni osadzonych skryptów, brak elementów `.time-plus` i sprawdzenie warstw osi czasu. Bez nowego pliku test-v.
Paczka względem V193 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v195 - szybkie kolejki i pierwsze otwarcie mapy
Build/cache: request-workflow-v195-fast-queues-map-open

- Otwarcie „Wolnych ładunków” i „Planowanych relacji” nie wylicza już dopasowań każdej relacji ze wszystkimi pojazdami. Zwinięte karty otwierają się od razu; odległości, zgodność i wybór pojazdu są liczone dopiero po rozwinięciu konkretnej pozycji.
- „+ Dodaj relację” oraz „PDF, Word lub tekst” aktualizują wyłącznie własne menu zamiast ponownie tworzyć całą zakładkę.
- Usunięto przycisk „Wprowadź wolny ładunek”. Ręczne wprowadzanie planowanej relacji pozostaje dostępne w swojej zakładce.
- Pierwsze otwarcie Mapy pokazuje od razu lekki widok ładowania, a kosztowny model mapy i Leaflet uruchamiają się po narysowaniu interfejsu. Model mapy jest budowany tylko raz na otwarcie.

WERYFIKACJA
Kontrola składni osadzonych skryptów, brak przycisku ręcznego wolnego ładunku oraz sprawdzenie odroczonego otwarcia mapy i lekkiego renderowania zwiniętych kart. Bez nowego pliku test-v.
Paczka względem V194 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v196 - płynna mapa z dużą liczbą danych i oś czasu nad relacjami
Build/cache: request-workflow-v196-smooth-map-top-timeline

- Mapa grupuje liczne lokalizacje klientów do maksymalnie 240 lekkich markerów zależnych od aktualnej skali. Kliknięcie grupy przybliża mapę; pojedyncze lokalizacje i ich pełne dane pojawiają się po przybliżeniu.
- Przeliczanie granic mapy korzysta z grup widocznych markerów zamiast pełnej, potencjalnie wielotysięcznej listy punktów. Ogranicza to zacięcia podczas otwierania mapy, przełączania baz klientów i zmiany skali.
- Czerwona linia aktualnej godziny jest teraz rysowana w warstwie `.timeline-row` razem z relacjami, z priorytetem wyższym niż każdy kafelek. Nie może zostać przykryta przez relację niezależnie od kontekstu CSS komórki dnia.

WERYFIKACJA
Kontrola składni osadzonych skryptów, ograniczenia liczby markerów klientów, aktualizacji po zmianie skali mapy oraz położenia osi czasu w warstwie timeline. Bez nowego pliku test-v.
Paczka względem V195 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v197 - korekta pozostałości po usuniętych funkcjach
Build/cache: request-workflow-v197-dead-code-cleanup

- Usunięto martwą funkcję otwierania relacji po wycofanym przycisku „+” w kafelkach.
- Usunięto nieużywaną funkcję linii czasu w komórce dnia i starą funkcję automatycznego przewijania planu do bieżącej godziny.
- Usunięto niewykorzystywane, starsze źródło podpowiedzi lokalizacji, nieużywany odczyt bazowych kilometrów oraz puste stuby zapisu lokalnej floty.
- Samouczek tworzenia relacji prowadzi teraz do dwukliku w komórce wybranego kierowcy i daty, zgodnie z aktualnym sposobem pracy.

WERYFIKACJA
Skan wszystkich funkcji, kontrola braku usuniętych identyfikatorów oraz kontrola składni osadzonych skryptów. Bez nowego pliku test-v.
Paczka względem V196 zawiera wyłącznie public/tms.html, src/main.js i README_WDROZENIE.txt.

AKTUALIZACJA v219 - niższe menu i panele do przeciągania
Build/cache: request-workflow-v219-mobile-low-menu-dnd

- Strzałkę wysuwającą prawe menu przeniesiono do prawego dolnego rogu, około 1 cm nad krawędzią ekranu.
- Prawe menu rozwija się ku górze od dolnej części ekranu.
- Mobilne okna Wolne ładunki i Planowane relacje zajmują maksymalnie 44% wysokości ekranu, pozostawiając większość planu widoczną do drag and drop.

WERYFIKACJA v219
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola pozycji strzałki, pionowego menu w dolnej części ekranu oraz wysokości mobilnych paneli kolejek.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v218 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v220 - pozycja strzałki i uproszczenie sterowania mobilnego
Build/cache: request-workflow-v220-mobile-nav-arrow

- Strzałka wysuwająca prawe menu znajduje się stale przy prawej krawędzi, 57 px nad dolną krawędzią ekranu (około 1,5 cm).
- Po rozwinięciu zakładek strzałka nie przeskakuje na lewą stronę ikon.
- Usunięto mobilny przełącznik zakresu dni, który dublował pełny widok planu.

WERYFIKACJA v220
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola stałej pozycji strzałki oraz braku mobilnego przełącznika zakresu.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v219 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v221 - pełne ustawienia kierowców dla administratora
Build/cache: v221-admin-driver-access

- Administrator otrzymał dostęp do zmiany koloru, tymczasowego i stałego przypisania, edycji, ukrywania oraz przywracania każdego kierowcy.
- Działania administracyjne działają również dla pozycji planu, które nie są jeszcze połączone z aktywnym rekordem floty.
- Usunięto komunikat o prywatnym oznaczaniu kierowcy i ograniczeniach prowadzącego spedytora.

WERYFIKACJA v221
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola uprawnień administratora dla wszystkich akcji ustawień kierowcy.
- Kontrola braku usuniętego komunikatu oraz zawartości archiwum ZIP.
- Paczka względem v220 zawiera wyłącznie: public/tms.html oraz README_WDROZENIE.txt.

AKTUALIZACJA v222 - ukrycie technicznego statusu zapisu
Build/cache: v222-hide-save-confirmation

- Usunięto z kart zleceń komunikat „Oczekuje na potwierdzenie zapisu”.
- Mechanizm sprawdzania zapisu w tle pozostaje aktywny, więc błąd synchronizacji nadal będzie zgłaszany.

WERYFIKACJA v222
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola usunięcia statusu z opisu zlecenia.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v221 zawiera wyłącznie: public/tms.html oraz README_WDROZENIE.txt.

AKTUALIZACJA v223 - prawdziwe ulice w przykładowych relacjach
Build/cache: v223-real-sample-streets

- Zastąpiono fikcyjne adresy „ul. Załadunkowa” i „ul. Rozładunkowa” rzeczywistymi nazwami ulic dla każdej miejscowości z danych przykładowych.
- Usunięto losowe numery budynków, aby przykładowy adres nie wskazywał nieistniejącego punktu.
- Podniesiono wersję przykładowego harmonogramu, dzięki czemu istniejące przykładowe relacje odświeżą się automatycznie.

WERYFIKACJA v223
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola kompletności mapy ulic dla wszystkich miejscowości przykładowych relacji.
- Kontrola odświeżenia wersji danych przykładowych oraz zawartości archiwum ZIP.
- Paczka względem v222 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v224 - usunięcie opisów pomocniczych
Build/cache: v224-remove-ui-hints

- Usunięto opis skrótów edycji z planu kierowców.
- Usunięto etykietę „Mapa i lista rozładunków na dzień”.
- Usunięto opis pod nagłówkiem Baza klientów.
- Usunięto opis wymagań przy dodawaniu kierowcy i przewoźnika.

WERYFIKACJA v224
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola braku czterech usuniętych opisów.
- Kontrola wbudowanych testów widoku mapy oraz zawartości archiwum ZIP.
- Paczka względem v223 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v225 - pełna obsługa relacji przez administratora
Build/cache: v225-admin-relations

- Rozpoznawanie administratora obejmuje rolę aplikacji oraz role z konta Supabase.
- Administrator może edytować, przesuwać, usuwać, kopiować, zmieniać status i przetwarzać relacje, które sam dodał lub które należą do innych spedytorów.
- Administrator może również zarządzać relacjami w Wolnych ładunkach i Planowanych relacjach oraz przenosić relację między pojazdami różnych spedytorów.

WERYFIKACJA v225
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola uprawnień administratora dla edycji, usuwania, statusów, kolejek i przeciągania relacji.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v224 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

AKTUALIZACJA v226 - bieżące dopasowania ładunków
Build/cache: v226-live-queue-matches

- Mechanizm dopasowań obejmuje teraz również administratora i oblicza dla niego wszystkie zgodne pojazdy.
- Po przesunięciu relacji, zmianie daty, miejscowości lub adresu dopasowania są przeliczane w najbliższej klatce renderowania.
- Zielone oznaczenie na kafelku oraz dopasowanie w Wolnych ładunkach i Planowanych relacjach nie zależą już od pierwotnego dnia relacji.

WERYFIKACJA v226
- Kontrola składni wszystkich skryptów inline i src/main.js.
- Kontrola ról dopuszczonych do wyliczania dopasowań oraz odświeżenia po zmianie relacji.
- Kontrola zawartości archiwum ZIP.
- Paczka względem v225 zawiera wyłącznie: public/tms.html, src/main.js oraz README_WDROZENIE.txt.

TOP DRAGON TMS — wersja v255
Zmiany: Enter potwierdza usunięcie relacji; widoczne oznaczenia projektów wieloautowych i dwa przykładowe projekty dla różnych klientów każdego dnia; dane marki/modelu/koloru ciągnika i marki naczepy; flaga Wojsko dla wolnych i planowanych relacji oraz dopasowanie wykluczające kierowców spoza PL i ciągniki Volvo.
Cache/build ID: v255-military-projects

TOP DRAGON TMS — wersja v256
Zmiany: lokalny analizator proponuje wymianę tras między spedytorami oraz podmianę kierowcy wyłącznie powyżej 30 km oszczędności dolotu. Pokazuje dyskretną ikonę ↔ i krótkie porównanie „−km · obecnie→po zmianie”. Nie wykonuje wywołań AI ani routingu sieciowego.
Cache/build ID: v256-route-swap-analyzer

TOP DRAGON TMS — wersja v257
Zmiany: kafelki projektów pokazują wyłącznie numer pojazdu i liczbę pojazdów, a kolor projektu wybiera spedytor podczas tworzenia relacji. Optymalizacja tras pokazuje oznaczenia obu spedytorów; kliknięcie propozycji podświetla wskazane kafelki na niebiesko. Wolne ładunki z załadunkiem dzisiaj pozostają aktywne przez cały dzień.
Cache/build ID: v257-projects-swap-flash

TOP DRAGON TMS — wersja v258
Zmiany: usunięto relacje, wolne ładunki i planowane relacje z datą załadunku po 18.10. Przykładowy plan kończy się 18.10.
Cache/build ID: v258-cutoff-oct18

