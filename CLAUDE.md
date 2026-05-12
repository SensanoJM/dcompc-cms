# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start Docker containers (run this first)
./vendor/bin/sail up -d

# Full-stack development (Laravel + queue + Vite via concurrently)
./vendor/bin/sail composer run dev

# Individual services
./vendor/bin/sail artisan serve
./vendor/bin/sail npm run dev

# Production build
./vendor/bin/sail npm run build
./vendor/bin/sail npm run build:ssr    # with SSR

# One-time setup
./vendor/bin/sail composer run setup   # install deps, migrate, build

# Tests
./vendor/bin/sail composer run test           # full Pest suite
./vendor/bin/sail artisan test --filter=Name  # single test/class

# Frontend checks
./vendor/bin/sail npm run types        # TypeScript type check
./vendor/bin/sail npm run lint         # ESLint with auto-fix
./vendor/bin/sail npm run format       # Prettier format
./vendor/bin/sail npm run format:check # Prettier validation

# Database / shell
./vendor/bin/sail artisan migrate
./vendor/bin/sail artisan tinker
./vendor/bin/sail shell                # shell inside app container

# Stop containers
./vendor/bin/sail down
```

## Architecture

**Stack:** Laravel 12 + React 19 + Inertia.js (SSR-capable) + Tailwind CSS v4 + TypeScript

**Purpose:** Desktop-oriented internal tool for financial cooperative mediators — LAN-only, fully offline. Tracks client financial records across periods, schedules mediation sessions, and captures mediator remarks. Excel import/export via Spatie Simple Excel is a core feature.

**User roles:** `Mediator` (primary — imports data, schedules sessions, writes remarks, exports) and `Admin` (manages mediator accounts, overrides records). Keep them separated; do not introduce a permissions framework.

### Request Flow

Browser → Inertia.js → Laravel Router (Sail container) → Controller → Eloquent → **PostgreSQL** (Docker service)  
Controllers return `Inertia::render()` for page loads or JSON for API endpoints under `/api/*`.

### Backend Structure

- **Controllers:** `app/Http/Controllers/ClientController.php` (web: list, show, batchSchedule), `Api/ClientController.php` (JSON: paginated + financial aggregations), `ExcelController.php` (XLSX/CSV import ≤10 MB via both web and API), `SessionController.php` (mediation session ops). Settings controllers under `Controllers/Settings/`.
- **Services:** `app/Services/ExcelService.php` (import: upserts Client + ClientFinancialRecord, returns `{imported, failed, errors}`), `app/Services/SessionService.php` (scheduleSession transactional, rescheduleSession).
- **Models:** `Client` (UUID PK `client_uuid`, external `client_id`), `ClientFinancialRecord` (unique on `client_id + period`; computed `total_assets`, `total_liabilities`, `net_worth`; `compareWith()` returns deltas), `MediationSession` (auto-generates `session_number` as `MED-YYYYMMDD-0001`; pivot tables `session_clients` and `session_mediators`), `User` (roles: admin/mediator via `isAdmin()`/`isMediator()`).
- **Routes:** `routes/web.php` — public dashboard, client list/show/import/batchSchedule, mediation page, API endpoints. `routes/settings.php` — auth-guarded profile/password/2FA routes.
- **Database:** PostgreSQL only (`DB_CONNECTION=pgsql`). Docker service `pgsql`; host access via pgAdmin4 at `localhost:5432` (user: `sail`, password: `password`, db: `dcompc_cms`). Financial columns always `decimal(15,2)`, never `float`. When modifying a migration column, re-declare all previously defined attributes.

### Frontend Structure

- **Pages** in `resources/js/pages/` — rendered by Inertia. App pages: `dashboard.tsx`, `clients/index.tsx` (table + import), `clients/show.tsx` (client detail, period filtering done client-side via `useMemo`), `mediation.tsx`.
- **Components** in `resources/js/components/` — notably `ClientTable.tsx` (paginated data grid with period filter and sorting) and `BatchScheduleModal.tsx` (bulk session scheduling).
- **Routing** uses Wayfinder (`resources/js/actions/`) for type-safe auto-generated route helpers — always prefer these over hardcoded URLs. Do **not** manually edit Wayfinder-generated files; they are overwritten on save.
- **Layouts:** `AppLayout` (authenticated shell) and `AuthLayout` (login/register shell).

### Key Patterns

- **Period filtering:** The UI passes `period` query params to the API. "All Time" is a special aggregate mode that sums across all periods. On `clients/show.tsx`, period filtering is done client-side with `useMemo` over server-passed `financial_records` props.
- **UUID primary keys:** `clients.client_uuid` is the internal PK; `clients.client_id` is the external string identifier used for display and Excel import matching — never confuse them.
- **Inertia shared data:** `HandleInertiaRequests` middleware shares `auth.user` (authenticated user or a guest object with id 0, name "Mediator", email "mediator@system"), `flash`, `sidebarOpen` (from cookie `sidebar_state`), and a daily `quote`.
- **Authentication:** Laravel Fortify with optional 2FA. Settings pages in `pages/settings/`.
- **Offline-first:** No external API or CDN calls. All assets must be served locally.

### Domain Rules (canonical references)

The `.claude/rules/` directory holds always-applied MDC rule files:
- `app-domain.mdc` — app purpose, user roles, page-by-page UI patterns, financial fields, mutable state fields.
- `database-rules.mdc` — PostgreSQL requirements, decimal types, required indexes, model conventions, migration rules.
- `deployment-context.mdc` — Docker/Sail runtime, LAN constraints, running commands.
- `laravel-boost.mdc` — Comprehensive Laravel 12, Inertia v2, React 19, Tailwind v4, Wayfinder, Pest, and Pint conventions.
