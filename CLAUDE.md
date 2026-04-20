# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Full-stack development (Laravel + queue + Vite via concurrently)
composer run dev

# Individual services
php artisan serve
npm run dev

# Production build
npm run build
npm run build:ssr    # with SSR

# One-time setup
composer run setup   # install deps, migrate, build

# Tests
composer run test    # Pest test suite

# Frontend checks
npm run types        # TypeScript type check
npm run lint         # ESLint with auto-fix
npm run format       # Prettier format
npm run format:check # Prettier validation
```

## Architecture

**Stack:** Laravel 12 + React 19 + Inertia.js (SSR-capable) + Tailwind CSS v4 + TypeScript

This is a **Client & Mediation Session Management System** — it tracks client profiles, their multi-period financial records (fixed deposits, savings, loans, arrears, fines, mortuary funds), and mediation sessions. Excel import/export is a core feature via Spatie Simple Excel.

### Request Flow

Browser → Inertia.js → Laravel Router → Controller → Eloquent → **PostgreSQL**  
Controllers return `Inertia::render()` for page loads or JSON for API endpoints under `/api/*`.

### Backend Structure

- **Controllers:** `app/Http/Controllers/Api/ClientController.php` handles paginated, filtered client listings. `ExcelController.php` handles XLSX/CSV import (max 10MB) and export. Settings controllers live under `Controllers/Settings/`.
- **Models:** `Client` (UUID primary key `client_uuid`, external `client_id`), `ClientFinancialRecord` (unique on `client_id + period`), `MediationSession` with pivot tables `session_clients` and `session_mediators`.
- **Services:** `app/Services/ExcelService.php` (`SpreadsheetFileWriter`) encapsulates spreadsheet logic.
- **Routes:** `routes/web.php` has public dashboard + API endpoints; `routes/settings.php` has auth-guarded profile/settings routes.

### Frontend Structure

- **Pages** live in `resources/js/pages/` — rendered by Inertia, not navigated to directly.
- **Components** in `resources/js/components/` — notably `ClientTable.tsx` (data grid with period filter) and `ClientSidebar.tsx` (filter panel).
- **Routing** uses Wayfinder (`resources/js/actions/`) for type-safe, auto-generated route helpers — always prefer these over hardcoded URLs.
- **Layouts:** `AppLayout` (authenticated shell) and `AuthLayout` (login/register shell).

### Key Patterns

- **Period filtering** is central: the UI passes `period` query params to the API; "All Time" is a special aggregate mode.
- **UUID primary keys** on `clients` (`client_uuid`) — don't confuse with the external `client_id` string used for display/import matching.
- **Inertia shared data** (user, flash messages) is passed via `HandleInertiaRequests` middleware.
- **Authentication** uses Laravel Fortify with optional 2FA; settings pages are in `pages/settings/`.
- **Database** is PostgreSQL (`DB_CONNECTION=pgsql`) — never SQLite or MySQL. Managed via pgAdmin4. See `.claude/rules/database-rules.mdc` for model conventions and migration rules.
