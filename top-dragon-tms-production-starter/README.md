# Top Dragon TMS — starter produkcyjny

To jest **Etap 1** migracji: bezpieczne logowanie, profile, role, oddziały i szkielet audytu.
Nie zawiera jeszcze funkcjonalnego planu kierowców ani migracji danych z prototypu.

## 1. Wymagania

- Node.js LTS
- prywatne repozytorium GitHub
- projekt testowy Supabase

## 2. Supabase

1. Utwórz projekt testowy.
2. Otwórz SQL Editor.
3. Uruchom `supabase/migrations/001_auth_profiles_audit.sql`.
4. W Authentication > Users utwórz pierwszego użytkownika przez zaproszenie e-mail.
5. Po rejestracji ustaw konto jako administratora:

```sql
update public.profiles
set role = 'admin', active = true, display_name = 'Administrator'
where id = (select id from auth.users where email = 'TWOJ_EMAIL');
```

6. Z Connect skopiuj Project URL i Publishable key.

## 3. Uruchomienie lokalne

```bash
cp .env.example .env.local
# Uzupełnij .env.local
npm install
npm run dev
```

## 4. GitHub

```bash
git init
git add .
git commit -m "Etap 1: Supabase Auth i profile"
git branch -M main
git remote add origin ADRES_PRYWATNEGO_REPOZYTORIUM
git push -u origin main
```

## 5. Vercel — dopiero po teście logowania

Zaimportuj repozytorium i ustaw dwie zmienne środowiskowe:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Najpierw wdrażaj jako Preview. Produkcję uruchomimy po migracji danych i polityk RLS.
