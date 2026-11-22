# Asystent giełdy 0.1.0 — zakres weryfikacji

## Sprawdzone

- `node test-exchange-assistant.mjs`: własna flota i podzlecenie, koszt wszystkich dojazdów,
  kolizje terminów, wymagania wysokości/narodowości/marki, brak nieznanych współrzędnych,
  identyfikatory klientów, parser bez zgadywania godzin, kontrola nadawców i wygasłej sesji,
  czytelny błąd przy braku migracji.
- `node tests/exchange-db/test.mjs`: rzeczywisty silnik PostgreSQL/PGlite w pamięci,
  wykonanie migracji 035, dwa konta spedytorów, odrzucenie zajęcia cudzej oferty,
  konflikt wersji, zwalnianie, rola administratora i rozliczeń, RLS oddziałów,
  nieaktywny/anonimowy użytkownik, zakaz bezpośredniego UPDATE oraz zapis audytu.
- Przeglądarka, lokalny podgląd panelu: sekwencja `=1` daje `TEST`, zachowuje tekst przed i po,
  działa w input/textarea/contenteditable (również z elementem `<b>`), pomija pole hasła i
  nie przekracza maxlength. Kalkulator: 300+50+50 km, przychód 1000 EUR, koszt/km 1,50 EUR,
  opłaty 50 EUR i dodatkowe koszty 20 EUR = wynik 330 EUR. Zapis lokalnej oferty i oznaczenia klienta.
- Testy istniejącego startu panelu (`test-dashboard-overlap.cjs`, `test-first-view-ready.cjs`).
- Build Vite i odpakowanie ZIP przez PowerShell `Expand-Archive` (manifest V3 i plik SQL obecne).

## Wymagające weryfikacji po instalacji

- Instalacja rozpakowanego rozszerzenia w Chrome/Edge, panel sidePanel, chrome.storage,
  nadawanie uprawnienia do pojedynczej domeny i łącznik pomiędzy kartami.
- Edytor wiadomości aktualnej wersji Trans.eu. Złożony edytor może wymagać osobnego adaptera.
- Połączenie z rzeczywistym kontem TOP DRAGON w zainstalowanym dodatku.
- Produkcyjne Supabase po wykonaniu migracji 035 oraz jednoczesna praca dwóch kont.
  Test PGlite sprawdza wersjonowanie kolejnych zapisów; nie jest pomiarem współbieżności serwera produkcyjnego.
- Kilometry są szacunkami ze współrzędnych; brak integracji tachografu i wyznaczania tras drogowych.

Powtarzalny test przeglądarkowy: uruchom Vite i otwórz `/browser-extension/sidepanel.html`
oraz `/tests/exchange-editors.html`. Dane w tych widokach są wyłącznie testowe.
