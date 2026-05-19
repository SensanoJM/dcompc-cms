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
| Mediation page (`/mediation`) | ❌ Static shell — no real data |
| "Schedule Session" on client show page | ❌ Button has no `onClick` |
| "Times Scheduled" on client show page | ❌ Hardcoded `2` |
| "View Logs" on client show page | ❌ Button has no action |
| Remarks system | ❌ `MOCK_REMARKS` only, no DB |
| Mediator assignment edit (show page) | ❌ UI-only, no API call |
| `SessionController` | ❌ Broken imports, no routes wired |

---

## Tickets

---

### TICKET-01 — Wire the Mediation Page to real data
**Priority:** HIGH  
**Blocks:** Seeing any scheduled session after batch schedule  
**Effort:** M (backend query + Inertia render + frontend table)

**Problem:** `/mediation` is a static skeleton with hardcoded column headers and an empty table. Sessions created via batch schedule have no visible home.

**What to do:**
1. Add `GET /mediation` → `SessionController@index` in `routes/web.php` (currently the route returns `Inertia::render('mediation')` with no props).
2. Rewrite `SessionController::index()` to return `Inertia::render('mediation', [...])` with props:
   - `sessions` — paginated `MediationSession::with(['clients'])->orderBy('session_date', 'desc')`
   - `filters` — `{ status, date_from, date_to, period }`
3. Rewrite `resources/js/pages/mediation.tsx` to consume the props and render a real table with columns: Session Number, Date, Period, Clients (count), Status (Upcoming / Past / Today), Actions.
4. Status badge: derive from `session_date` relative to today (no DB column needed).

**Acceptance criteria:** After a batch schedule, the mediator can navigate to `/mediation` and see the new session row with its clients count and date.

---

### TICKET-02 — Fix `SessionController` imports and route wiring
**Priority:** HIGH  
**Blocks:** TICKET-01  
**Effort:** XS

**Problem:** `SessionController.php` references `MediationSession`, `Client`, and `SessionService` without `use` statements. No routes in `web.php` point to it. The controller will fatal-error if any route hits it.

**What to do:**
1. Add missing `use` statements to `SessionController.php`:
   ```php
   use App\Models\MediationSession;
   use App\Models\Client;
   ```
2. Remove or stub out the `SessionService` dependency — `SessionService` is not yet implemented. Replace `$this->sessionService->scheduleSession(...)` in `store()` with inline logic (or just delete the `store()` method since batch schedule already lives in `ClientController`).
3. Register only the routes needed for TICKET-01 in `web.php`:
   ```php
   Route::get('/mediation', [SessionController::class, 'index'])->name('mediation');
   ```
   Remove the existing closure route for `/mediation`.

**Acceptance criteria:** `php artisan route:list` shows `/mediation` hitting `SessionController@index` with no fatal import errors.

---

### TICKET-03 — Wire "Schedule Session" button on client show page
**Priority:** HIGH  
**Blocks:** Single-client scheduling from the detail page  
**Effort:** S

**Problem:** The "Schedule Session" `<Button>` in `resources/js/pages/clients/show.tsx` (line 328) has no `onClick` handler. A mediator viewing a specific client cannot schedule them directly from their detail page — they must go back to the client list and use batch select.

**What to do:**
1. Import `BatchScheduleModal` into `show.tsx`.
2. Add `const [scheduleModalOpen, setScheduleModalOpen] = useState(false)` state.
3. Wire the button: `onClick={() => setScheduleModalOpen(true)}`.
4. Render `<BatchScheduleModal isOpen={scheduleModalOpen} selectedClientIds={[client.client_id]} periods={periods} onClose={() => setScheduleModalOpen(false)} />`.
5. Pass `periods` — already available from `client.financial_records` via the existing `periods` useMemo.

**Acceptance criteria:** Clicking "Schedule Session" on a client's detail page opens the modal pre-loaded with that client's ID, submits to `POST /clients/batch-schedule`, and redirects back with a flash confirmation.

---

### TICKET-04 — Wire "Times Scheduled" to real session count
**Priority:** MEDIUM  
**Blocks:** Accurate mediation stats on client detail  
**Effort:** S

**Problem:** `show.tsx` line 386 hardcodes `<span className="text-xl font-bold">2</span>`. Every client shows "2" regardless of actual history.

**What to do:**
1. In `ClientController::show()`, add a `times_scheduled` count to the props:
   ```php
   'times_scheduled' => DB::table('session_clients')
       ->where('client_id', $client->client_id)
       ->count(),
   ```
2. Add `times_scheduled: number` to the `Client` interface in `show.tsx`.
3. Replace the hardcoded `2` with `{client.times_scheduled}`.

**Acceptance criteria:** A client who has never been scheduled shows `0`; after a batch schedule they show `1`.

---

### TICKET-05 — Wire "View Logs" to client session history
**Priority:** MEDIUM  
**Blocks:** Audit trail on client detail  
**Effort:** M

**Problem:** The "View Logs" `<Button>` in `show.tsx` (line 333) has no action. Mediators cannot see the history of sessions a client has been part of.

**What to do:**
Two options — pick one:

**Option A (Inline panel, simpler):** Add a collapsible "Session History" section below the Mediation Stats card. Populate it from a new `session_history` prop passed by `ClientController::show()`:
```php
'session_history' => DB::table('session_clients')
    ->join('mediation_sessions', 'session_clients.session_id', '=', 'mediation_sessions.session_id')
    ->where('session_clients.client_id', $client->client_id)
    ->select('mediation_sessions.session_number', 'mediation_sessions.session_date', 'mediation_sessions.period')
    ->orderBy('mediation_sessions.session_date', 'desc')
    ->get(),
```
Wire the button to toggle visibility of the panel.

**Option B (Navigate):** Route to `/mediation?client={id}` which pre-filters the mediation page for that client. Simpler frontend, requires TICKET-01 first.

**Recommendation:** Option A (inline panel) because it doesn't depend on TICKET-01 and keeps context on the page.

**Acceptance criteria:** Clicking "View Logs" shows a list of all sessions the client has been part of, with session number, date, and period.

---

### TICKET-06 — Remarks system — DB table + API
**Priority:** MEDIUM  
**Blocks:** Persisting mediator notes per client  
**Effort:** L

**Problem:** `show.tsx` uses `MOCK_REMARKS` (hardcoded array, lines 66-69). The `handleAddRemark` function (line 187) only appends to local React state — nothing persists on reload.

**What to do:**
1. **Migration:** Create `client_remarks` table:
   ```
   id (PK), client_id (FK → clients.client_id), author (string), body (text), created_at
   ```
2. **Model:** `ClientRemark` with `belongsTo(Client)`.
3. **Controller:** Add to `ClientController`:
   - `GET /clients/{id}` — already loads; add `remarks` relation to the `show()` props.
   - `POST /api/clients/{id}/remarks` → store a new remark, return JSON.
   - `DELETE /api/clients/{id}/remarks/{remarkId}` → delete (optional for now).
4. **Frontend:** Replace `MOCK_REMARKS` state with the server-passed `client.remarks` prop. Wire the add-remark input to `router.post('/api/clients/{id}/remarks', { body: newRemark })` with `preserveScroll: true`.

**Acceptance criteria:** A remark added on the detail page persists across page reloads and is attributed to `auth.user.name`.

---

### TICKET-07 — Mediator assignment `PATCH` endpoint
**Priority:** LOW  
**Blocks:** Reassigning a mediator from the client detail page  
**Effort:** S

**Problem:** The mediator edit UI in `show.tsx` (lines 351-377) lets the mediator pick a new name and click the checkmark, but the confirm action (`onClick={() => setIsEditingMediator(false)}`) does nothing — no API call is made. The change disappears on reload.

**What to do:**
1. Add `PATCH /api/clients/{id}/mediator` route → new `ClientController::updateMediator()`.
2. Controller: validate `mediator_name` (string, max 100), find the latest `ClientFinancialRecord` for the client (or the one matching the currently selected period), update `assigned_mediator`.
3. In `show.tsx`, on checkmark click: `router.patch('/api/clients/{id}/mediator', { mediator_name: mediator, period: selectedPeriod }, { preserveScroll: true })` instead of just closing the edit mode.

**Note:** This updates the `assigned_mediator` string on the financial record, not a proper FK. Proper mediator linking is deferred (see TICKET-10).

**Acceptance criteria:** Saving a mediator change persists across page reloads.

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
TICKET-02 → TICKET-01   (fix controller, then wire mediation page)
TICKET-03               (parallel — show page schedule button, no deps)
TICKET-04               (parallel — times scheduled, no deps)
TICKET-05               (after TICKET-04, shares the session query)
TICKET-06               (independent, can be done any time)
TICKET-07               (low priority, independent)
TICKET-08               (low priority, needs TICKET-01 sessions list)
TICKET-09               (low priority, data migration — plan carefully)
TICKET-10               (low priority, after TICKET-04 is stable)
```

**Minimum to call scheduling "functional":** TICKET-02, TICKET-01, TICKET-03, TICKET-04
