# Top Dragon TMS — wersja z prototypem po logowaniu

Projekt zawiera:

- logowanie Supabase,
- profile, role i oddziały,
- oczyszczony prototyp TMS uruchamiany po poprawnym logowaniu,
- brak startowych danych demonstracyjnych kierowców, pojazdów i klientów.

## Ważne

Interfejs TMS jest na tym etapie osadzony jako `public/tms.html` i nadal przechowuje ręcznie dodawane dane w `localStorage` przeglądarki. Jest to etap przejściowy. Kolejnym etapem jest przeniesienie danych i operacji do tabel Supabase.

## Uruchomienie

```bash
cp .env.example .env.local
npm install
npm run dev
```

Wymagane zmienne:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Wdrożenie Vercel

Repozytorium powinno zachować istniejące zmienne środowiskowe projektu Vercel. Po wysłaniu zmian do gałęzi `main` Vercel utworzy nowe wdrożenie automatycznie.
