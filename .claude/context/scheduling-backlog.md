# Mediation Scheduling — Backlog & Prioritization

**Created:** 2026-05-13  
**Branch:** develop  
**Goal:** Ship a fully functional mediation scheduling flow for clients.

---

## Current State Snapshot

| Area | Status |
|---|---|
| Batch schedule from ClientTable | ✅ Fully wired — creates `MediationSession` + `session_clients` rows |
| `BatchScheduleModal.tsx` | ✅ Complete |
| `POST /clients/batch-schedule` + controller | ✅ Complete |
| `MediationSession` model + migrations | ✅ Complete |
| `SessionController` | ✅ Fixed — use statements added, `SessionService` removed, `index()` returns Inertia |
| Mediation page (`/mediation`) | ✅ Wired — renders real session table with status badges |
| "Schedule Session" in `ClientDetailSheet` | ✅ Wired — `onSchedule` prop in `clients/index.tsx` opens `BatchScheduleModal` |
| "Times Scheduled" in `ClientDetailSheet` | ✅ Wired — API returns count from `session_clients`; displayed in sheet |
| Session history ("View Logs") | ❌ Not yet in sheet — no API or UI |
| Remarks system | ❌ No DB table, no API, deferred to mediation module |
| Mediator assignment edit | ❌ No UI in sheet, no PATCH endpoint |

---

## Tickets

---

### TICKET-01 — Wire the Mediation Page to real data
**Priority:** HIGH  
**Status:** ✅ Completed 2026-05-27  
**Effort:** M (backend query + Inertia render + frontend table)

**What was done:**
- `SessionController::index()` returns `Inertia::render('mediation', ['sessions' => paginated, 'filters' => ...])`.
- `GET /mediation` route in `web.php` replaced with `SessionController::index`.
- `resources/js/pages/mediation.tsx` rewritten — table columns: Session #, Date, Period, Clients (count), Status badge (Upcoming/Today/Past derived client-side from `session_date` vs today, UTC-safe).

---

### TICKET-02 — Fix `SessionController` imports and route wiring
**Priority:** HIGH  
**Status:** ✅ Completed 2026-05-27  
**Effort:** XS

**What was done:**
- Added `use App\Models\{Client, MediationSession}` and `use Inertia\Inertia` to `SessionController.php`.
- Removed the `SessionService` constructor dependency and the `store()` method entirely (batch schedule lives in `ClientController`).
- `clientHistory()` fixed to look up by `client_id` column rather than the UUID primary key.
- `GET /mediation` closure in `web.php` replaced with `[SessionController::class, 'index']`.

---

### TICKET-03 — Wire "Schedule Session" button on ClientDetailSheet
**Priority:** HIGH  
**Status:** ✅ Completed (was already wired before this session)  
**Effort:** S

**What was done:**
- `clients/index.tsx` already passes `onSchedule={(ids) => { openBatchModal(ids); }}` to `<ClientDetailSheet>`, which reuses the existing `scheduledIds`/`modalOpen` state and the already-rendered `<BatchScheduleModal>`. No code changes were needed — confirmed during the 2026-05-27 session.

---

### TICKET-04 — Wire "Times Scheduled" to real session count
**Priority:** MEDIUM  
**Status:** ✅ Completed 2026-05-27  
**Effort:** S

**What was done:**
- `Api\ClientController::show()` now appends `$client->times_scheduled = DB::table('session_clients')->where('client_id', $client->client_id)->count()`.
- `ClientDetail` interface in `ClientDetailSheet.tsx` has `times_scheduled?: number`.
- Sheet renders a "Times Scheduled" stat row between the Schedule Session button and the Financial Overview section.

---

### TICKET-05 — Session history on ClientDetailSheet
**Priority:** MEDIUM  
**Blocks:** Audit trail on client detail  
**Effort:** M

> **Updated 2026-05-23:** `show.tsx` deleted. No "View Logs" button currently exists in `ClientDetailSheet.tsx`. This ticket now covers adding session history to the sheet from scratch.

**Problem:** `ClientDetailSheet` has no session history view. Mediators cannot see what sessions a client has been part of without navigating away.

**What to do (Option A — inline, recommended):**
1. In `Api\ClientController::show()`, add `session_history` to the response:
   ```php
   'session_history' => DB::table('session_clients')
       ->join('mediation_sessions', 'session_clients.session_id', '=', 'mediation_sessions.session_id')
       ->where('session_clients.client_id', $client->client_id)
       ->select('mediation_sessions.session_number', 'mediation_sessions.session_date', 'mediation_sessions.period')
       ->orderBy('mediation_sessions.session_date', 'desc')
       ->get(),
   ```
2. Add a collapsible "Session History" section at the bottom of the sheet (above Danger Zone), populated from the API response.
3. Add a "View Logs" toggle button to expand/collapse it.

**Option B (Navigate):** Route to `/mediation?client={id}` which pre-filters the mediation page. Requires TICKET-01 first.

**Recommendation:** Option A — keeps context in the sheet, no dependency on TICKET-01.

**Acceptance criteria:** Session history is visible in the sheet with session number, date, and period for each entry.

---

### TICKET-06 — Remarks system — DB table + API
**Priority:** MEDIUM  
**Blocks:** Persisting mediator notes per client  
**Effort:** L

> **Updated 2026-05-23:** `show.tsx` deleted and `MOCK_REMARKS` is gone with it. Per the Iteration 2 refactor decision, Remarks History was explicitly deferred to the mediation module and removed from the client detail sheet. This ticket now targets a remarks section within the mediation module (e.g., on the mediation session detail view) rather than the client sheet.

**Problem:** There is no remarks system anywhere in the app. Mediators have no way to persist notes about a client's mediation context.

**What to do:**
1. **Migration:** Create `client_remarks` table:
   ```
   id (PK), client_id (FK → clients.client_id), author (string), body (text), created_at
   ```
2. **Model:** `ClientRemark` with `belongsTo(Client)`.
3. **Controller:**
   - `GET /api/clients/{id}/remarks` → return remarks for a client (JSON).
   - `POST /api/clients/{id}/remarks` → store a new remark, return JSON.
   - `DELETE /api/clients/{id}/remarks/{remarkId}` → delete (optional).
4. **Frontend:** Decide placement — either a Remarks tab on the mediation page session detail, or a remarks panel added back to `ClientDetailSheet`. Coordinate with TICKET-01 progress before building UI.

**Acceptance criteria:** A remark added persists across page reloads and is attributed to `auth.user.name`.

---

### TICKET-07 — Mediator assignment `PATCH` endpoint
**Priority:** LOW  
**Blocks:** Reassigning a mediator from the client detail sheet  
**Effort:** M (UI needs to be added to sheet first)

> **Updated 2026-05-23:** `show.tsx` deleted. The mediator assignment edit UI that was in `show.tsx` (lines 351-377) no longer exists. This ticket now requires: (a) adding mediator assignment display + edit UI to `ClientDetailSheet.tsx`, then (b) wiring the PATCH endpoint.

**Problem:** `ClientDetailSheet` does not display or allow editing of `assigned_mediator`. Mediators have no way to reassign a client's mediator from the detail view.

**What to do:**
1. Add `assigned_mediator` to the `Api\ClientController::show()` response (from the active/selected financial record).
2. Add mediator display + inline edit UI to `ClientDetailSheet.tsx` (show name, edit icon, input on click, checkmark to save).
3. Add `PATCH /api/clients/{id}/mediator` route → `ClientController::updateMediator()`.
4. Controller: validate `mediator_name` (string, max 100), find the `ClientFinancialRecord` for the selected period, update `assigned_mediator`.
5. On checkmark click in sheet: call the PATCH endpoint, refresh sheet data.

**Note:** Updates the `assigned_mediator` string on the financial record, not a proper FK. See TICKET-09 for the FK migration.

**Acceptance criteria:** Saving a mediator change in the sheet persists across reloads.

---

### TICKET-08 — "Add to existing session" in BatchScheduleModal
**Priority:** LOW  
**Blocks:** Appending clients to a session that was already created  
**Effort:** M

**Problem:** The current batch schedule flow always creates a new `MediationSession`. If a mediator wants to add more clients to a session created 5 minutes ago, they cannot — they get a duplicate session.

**What to do:**
1. Add a toggle in `BatchScheduleModal`: "New Session" vs "Existing Session".
2. If "Existing Session": fetch recent sessions via `GET /api/sessions?limit=20` (needs a new lightweight API endpoint), show a select, and submit `session_id` instead of `session_date + session_number`.
3. In `ClientController::batchSchedule()`, handle the case where `session_id` is provided (skip `MediationSession::create`, use the existing session ID).

**Acceptance criteria:** Mediator can pick an existing session from a dropdown and add clients to it without creating a duplicate session.

---

### TICKET-09 — `assigned_mediator` ↔ `users` FK migration
**Priority:** LOW  
**Blocks:** "My Clients" filter accuracy, mediator assignment edit  
**Effort:** L (data migration risk)

**Problem:** `client_financial_records.assigned_mediator` is a free-text string. The "My Clients" filter does a string match against `auth.user.name`. This breaks if the imported name doesn't match the login name.

**What to do:**
1. Add `assigned_mediator_user_id` (nullable FK → `users.user_id`) to `client_financial_records`.
2. Write a one-time seeder/migration that attempts to match existing `assigned_mediator` strings to `users.name` and back-fills the FK column.
3. Update filters in `ClientController::index()` to use the FK when `assigned_mediator_user_id` is set.
4. Keep `assigned_mediator` (string) as a fallback display value for imported records that don't match any user.

**Acceptance criteria:** "My Clients" filter correctly shows only clients whose `assigned_mediator_user_id` matches the authenticated user.

---

### TICKET-10 — "Times Scheduled" column in ClientTable
**Priority:** LOW  
**Depends on:** TICKET-04 (session_clients COUNT) being proven in production  
**Effort:** M (requires subquery in the existing paginator)

**Problem:** The `ClientTable` columns deliberately exclude "Times Scheduled" because it requires a `COUNT` join on `session_clients` per client row — a per-row subquery on a paginated list. Noted in `client-table-refactor.md` as deferred.

**What to do:**
1. Extend `ClientController::index()` to LEFT JOIN a subquery counting `session_clients` per `client_id`.
2. Add `times_scheduled` to the `Client` type in `clients/index.tsx` and `ClientTable.tsx`.
3. Add a "Sessions" column to the table header and rows.

**Note:** Benchmark at 3,000+ client × multiple periods load. If it causes noticeable slowdown, add an index on `session_clients.client_id`.

**Acceptance criteria:** The client list shows a "Sessions" count column with the correct number.

---

## Recommended Execution Order

```
TICKET-02 → TICKET-01   ✅ Done 2026-05-27
TICKET-03               ✅ Done (was already wired)
TICKET-04               ✅ Done 2026-05-27
TICKET-05               next — session history in sheet (shares session query from TICKET-04)
TICKET-06               independent — remarks DB + API (deferred to mediation module UI)
TICKET-07               low priority — mediator assignment PATCH endpoint
TICKET-08               low priority — "add to existing session" in BatchScheduleModal
TICKET-09               low priority — assigned_mediator ↔ users FK migration
TICKET-10               low priority — "Times Scheduled" column in ClientTable
```

**Minimum to call scheduling "functional":** ✅ All met — TICKET-01, 02, 03, 04 are complete.
