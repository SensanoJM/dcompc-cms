# ClientTable Refactor — Decision Log & Implementation Plan

**Status:** Ready to implement  
**Date:** 2026-05-04  
**Branch:** develop  
**Session:** grill-me design review (all 7 questions resolved)

---

## Decisions Locked

### Q1 — Data Loading Strategy
**Decision:** Migrate from `axios` polling to **Inertia server-side props**.

- `GET /clients` (web route) passes `clients`, `periods`, `mediators`, `filters` as Inertia props.
- All filter/sort/page changes use `router.get('/clients', params)` — state lives in the URL.
- The existing `/api/clients` endpoint stays untouched (reserved for future external/mobile use).

**Live updates (concurrent mediators):**
```ts
useEffect(() => {
    const reload = () => router.reload({ only: ['clients', 'totalCount', 'periods'] });
    const onFocus = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onFocus);
    const interval = setInterval(reload, 60_000);
    return () => {
        document.removeEventListener('visibilitychange', onFocus);
        clearInterval(interval);
    };
}, []);
```

**Batch schedule concurrency (Layer 2):**
- DB transaction wraps batch insert into `session_clients`.
- PostgreSQL unique constraint on `(session_id, client_id)` is the hard guard.
- Backend returns `{ scheduled: number[], already_scheduled: number[] }` via flash.
- Frontend surfaces conflict notice via `<Alert>`.

### Q2 — Filters
**Decision:** Four filters in the primary toolbar.

| Filter | Type | Notes |
|---|---|---|
| Search | Text input | Name search, `LIKE '%q%'` |
| Period | Select dropdown | "All Time" = `all`; omit param when `all` |
| Has Arrears | Toggle button | `with_arrears=1` when active, omit when off |
| Assigned Mediator | Select dropdown | Distinct mediator names from DB + **"My Clients"** chip that pre-fills `auth.user.name` |

**Out of scope (Q2):** `assigned_mediator` is a free-text string with no FK to `users`. The "My Clients" shortcut is a best-effort string match. A proper mediator-linking migration is a separate ticket.

### Q3 — Batch Schedule Interface
**Decision:** New session only (modal).

**Flow:**
1. Mediator checks one or more rows (current-page checkboxes only).
2. Sticky action bar appears: *"N clients selected — Schedule Session"*.
3. Click opens `<BatchScheduleModal>` with fields: **Session Date**, **Session Number**, **Period** (select from existing periods).
4. Submit → `POST /clients/batch-schedule` → DB transaction → redirect back with flash.
5. Flash shows: *"5 clients scheduled. 2 already had a session."*

**Out of scope (Q3):** "Add to existing session" feature — mediator picks an already-created session and appends clients to it.

### Q4 — Pagination & Performance
**Decision:** Offset-based pagination, per-page selector, new index migration.

| Decision | Choice |
|---|---|
| Pagination type | Offset-based (keeps batch-select coherent) |
| Page sizes | 20 / 50 / 100 — selector in toolbar |
| New migration | `idx_records_arrears` on `arrears`; `idx_records_mediator` on `assigned_mediator` |
| `LIKE '%search%'` full-scan | Acceptable at cooperative scale for now |

**Expected volume:** 3,000+ clients × multiple periods per import cycle.

**Out of scope (Q4):**
- `pg_trgm` trigram index for name search.
- Materialized view / totals cache for the "All Time" aggregate — the `leftJoinSub` GROUP BY scan is the known bottleneck at 3k+ clients × N periods; flag for when mediators report sluggishness on the "All Time" view.

### Q5 — Column Structure
**Decision:** Columns in this order:

```
☐ | Name | Mediator | Period | Savings | Loan Balance | Arrears | Fines | (View)
```

- **Checkbox** — left-anchored, current-page-only batch select.
- **Assigned Mediator** — blank in "All Time" view (no per-record mediator in aggregate).
- **Arrears** — red `<Badge variant="destructive">Overdue</Badge>` when `> 0`, replacing the old `text-red-500` font trick.
- **Select all** in header — selects all rows on the current page only.

**Dropped from list view:** Fixed Deposit, Mortuary, Times Scheduled — detail-page fields.

**Out of scope (Q5):** Times Scheduled column requires a `COUNT` join on `session_clients` per client row in the paginator — see TICKET-10. The count itself is now live in `ClientDetailSheet` (TICKET-04, done 2026-05-27).

### Q6 — URL State Shape
**Decision:**

```
/clients?search=john&period=2024-Q1&page=2&per_page=50&sort_by=arrears&sort_order=desc&with_arrears=1&mediator=Maria
```

| Param | Default | Omit when default? |
|---|---|---|
| `search` | `""` | Yes |
| `period` | `all` | Yes |
| `page` | `1` | Yes |
| `per_page` | `20` | Yes |
| `sort_by` | `name` | Yes |
| `sort_order` | `desc` | Yes |
| `with_arrears` | off | Yes (omit, not `0`) |
| `mediator` | `""` | Yes |

**`preserveState` split:**
- Filter/sort changes → `preserveState: true` (keeps scroll, doesn't clear other filters).
- Page changes → `preserveState: false` (clears checkbox selection).

### Q7 — Import UX
**Decision:** Option B — Inertia form POST with flash redirect.

- Import button triggers hidden `<input type="file">` → `router.post('/clients/import', formData)`.
- `ExcelController::importWeb()` (new method) redirects back with `session()->flash('flash', [...])`.
- Page reads `usePage().props.flash` and renders result via the existing `<Alert>` component.
- `<Alert>` persists until user dismisses or navigates away.

**Out of scope (Q7):** Dedicated import page with row-level validation errors and progress bar.

---

## Out of Scope Master List

| Feature | Reason deferred | Where to tackle |
|---|---|---|
| **Financial record edit collisions (Layer 3)** | Needs ETag / `updated_at` optimistic locking on `PATCH` | When mediator assignment + remarks endpoints are built |
| **WebSocket / Reverb real-time push** | Overkill for current import frequency | Infrastructure decision — revisit if imports become frequent |
| **`assigned_mediator` ↔ `users` FK link** | String mismatch between imported name and login name | Separate migration + mediator management feature |
| **"Add to existing session" in batch schedule** | Scope — new session only for now | Follow-up after batch schedule is live |
| **Materialized view for "All Time" aggregate** | Known bottleneck at 3k+ clients — not felt yet | Tackle when mediators report sluggishness |
| **`pg_trgm` trigram index for name search** | Acceptable full-scan at cooperative scale | Revisit if search latency becomes a complaint |
| **Times Scheduled column** | Needs `COUNT` join on `session_clients` per row in the paginator | After TICKET-04 is stable — count query is proven; see TICKET-10 |
| **Dedicated import page** | Row-level error reporting not needed yet | When import validation requirements grow |
| **Remarks DB table + API** | Mock data in `show.tsx` | Separate ticket |
| **Mediator assignment `PATCH` endpoint** | UI-only stub in `show.tsx` | Separate ticket |
| **Mediation stats wiring** | Hardcoded `2` in `show.tsx` | After `session_clients` COUNT query is ready |

---

## Implementation Plan

### Step 1 — New migration (indexes)
**File:** `database/migrations/[timestamp]_add_filter_indexes_to_client_financial_records.php`

```php
$table->index('arrears', 'idx_records_arrears');
$table->index('assigned_mediator', 'idx_records_mediator');
```

---

### Step 2 — Rewrite `ClientController::index()`
**File:** `app/Http/Controllers/ClientController.php`

Full Inertia-aware rewrite. Mirrors the logic in `Api/ClientController@index` but:
- Returns `Inertia::render('clients/index', [...])` instead of JSON.
- Supports `period=all` via `leftJoinSub` aggregate.
- Adds `mediator` filter (new).
- Adds per-page (20/50/100).
- Passes `mediators` prop: `ClientFinancialRecord::select('assigned_mediator')->distinct()->whereNotNull('assigned_mediator')->pluck('assigned_mediator')`.

**Props shape:**
```php
Inertia::render('clients/index', [
    'clients'   => $paginator,   // LengthAwarePaginator — Inertia auto-serializes
    'periods'   => $periods,     // string[]
    'mediators' => $mediators,   // string[]
    'filters'   => [
        'search'      => $request->input('search', ''),
        'period'      => $selectedPeriod,
        'with_arrears'=> $request->boolean('with_arrears'),
        'mediator'    => $request->input('mediator', ''),
        'sort_by'     => $sortBy,
        'sort_order'  => $sortOrder,
        'per_page'    => $perPage,
    ],
]);
```

---

### Step 3 — Add `ExcelController::importWeb()`
**File:** `app/Http/Controllers/ExcelController.php`

New method alongside the existing `import()`:
```php
public function importWeb(Request $request)
{
    $request->validate(['file' => 'required|file|mimes:xlsx,xls,csv|max:10240']);
    try {
        $result = $this->excelService->importClients($request->file('file'));
        return redirect()->back()->with('flash', ['import' => $result]);
    } catch (\Exception $e) {
        return redirect()->back()->with('flash', ['import_error' => $e->getMessage()]);
    }
}
```

---

### Step 4 — Add `ClientController::batchSchedule()`
**File:** `app/Http/Controllers/ClientController.php`

```php
public function batchSchedule(Request $request)
{
    $validated = $request->validate([
        'client_ids'     => 'required|array|min:1',
        'client_ids.*'   => 'integer|exists:clients,client_id',
        'session_date'   => 'required|date',
        'session_number' => 'required|string|max:100',
        'period'         => 'required|string|max:100',
    ]);

    $scheduled = [];
    $alreadyScheduled = [];

    DB::transaction(function () use ($validated, &$scheduled, &$alreadyScheduled) {
        $session = MediationSession::create([
            'session_number' => $validated['session_number'],
            'session_date'   => $validated['session_date'],
            'period'         => $validated['period'],
        ]);

        foreach ($validated['client_ids'] as $clientId) {
            try {
                DB::table('session_clients')->insert([
                    'session_id' => $session->session_id,
                    'client_id'  => $clientId,
                    'assigned_at'=> now(),
                ]);
                $scheduled[] = $clientId;
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                $alreadyScheduled[] = $clientId;
            }
        }
    });

    return redirect()->back()->with('flash', [
        'batch_schedule' => [
            'scheduled'        => $scheduled,
            'already_scheduled'=> $alreadyScheduled,
        ],
    ]);
}
```

---

### Step 5 — Update `routes/web.php`

```php
// Replace the closure for GET /clients:
Route::get('/clients', [\App\Http\Controllers\ClientController::class, 'index'])->name('clients');

// Add:
Route::post('/clients/import', [\App\Http\Controllers\ExcelController::class, 'importWeb'])->name('clients.import');
Route::post('/clients/batch-schedule', [\App\Http\Controllers\ClientController::class, 'batchSchedule'])->name('clients.batch-schedule');
```

---

### Step 6 — New `resources/js/pages/clients/index.tsx`

Replaces `resources/js/pages/clients.tsx`.

**TypeScript types:**
```ts
type Client = {
    client_id: number;
    name: string;
    period: string;
    savings: number;
    loan_balance: number;
    arrears: number;
    fines: number;
    assigned_mediator: string | null;
};

type Paginator = {
    data: Client[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
};

type Filters = {
    search: string;
    period: string;
    with_arrears: boolean;
    mediator: string;
    sort_by: string;
    sort_order: 'asc' | 'desc';
    per_page: number;
};

type Flash = {
    import?: { imported: number; failed: number };
    import_error?: string;
    batch_schedule?: { scheduled: number[]; already_scheduled: number[] };
};

type PageProps = {
    clients: Paginator;
    periods: string[];
    mediators: string[];
    filters: Filters;
    flash?: Flash;
    auth: { user: { name: string } };
};
```

**Responsibilities of this page:**
- Reads Inertia props.
- Owns tab-focus + 60s polling via `router.reload`.
- Renders `<Alert>` for flash messages.
- Passes everything down to `<ClientTable>`.
- Owns `<BatchScheduleModal>` open/close state.

---

### Step 7 — Refactor `resources/js/components/ClientTable.tsx`

Strip all self-fetching. Becomes a pure props-driven component.

**Props interface:**
```ts
type ClientTableProps = {
    clients: Client[];
    pagination: { total: number; currentPage: number; lastPage: number; perPage: number };
    periods: string[];
    mediators: string[];
    filters: Filters;
    currentUserName: string;           // for "My Clients" shortcut
    onBatchSchedule: (ids: number[]) => void;  // opens modal in parent
};
```

**Local state (only these — no data fetching state):**
```ts
const [selectedIds, setSelectedIds] = useState<number[]>([]);
```

**Filter/sort changes:**
```ts
const applyFilter = (params: Partial<Filters>) =>
    router.get('/clients', { ...filters, ...params, page: 1 }, { preserveState: true });
```

**Page changes:**
```ts
const goToPage = (page: number) =>
    router.get('/clients', { ...filters, page }, { preserveState: false });
```

**Import (replaces axios POST):**
```ts
const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    router.post('/clients/import', fd);
};
```

---

### Step 8 — New `resources/js/components/BatchScheduleModal.tsx`

```ts
type BatchScheduleModalProps = {
    isOpen: boolean;
    selectedClientIds: number[];
    periods: string[];
    onClose: () => void;
};
```

**Form fields:** Session Date (date input), Session Number (text), Period (select from `periods`).

**Submit:**
```ts
router.post('/clients/batch-schedule', {
    client_ids: selectedClientIds,
    session_date: form.sessionDate,
    session_number: form.sessionNumber,
    period: form.period,
}, { onSuccess: onClose });
```

**After close:** Parent reads `usePage().props.flash.batch_schedule` and renders the conflict `<Alert>`.

---

### Step 9 — Delete `resources/js/pages/clients.tsx`

Replaced by `resources/js/pages/clients/index.tsx`.

---

## File Change Summary

| File | Action |
|---|---|
| `database/migrations/[ts]_add_filter_indexes...php` | **Create** |
| `app/Http/Controllers/ClientController.php` | **Modify** — rewrite `index()`, add `batchSchedule()` |
| `app/Http/Controllers/ExcelController.php` | **Modify** — add `importWeb()` |
| `routes/web.php` | **Modify** — 3 route changes |
| `resources/js/pages/clients/index.tsx` | **Create** |
| `resources/js/components/ClientTable.tsx` | **Modify** — full refactor |
| `resources/js/components/BatchScheduleModal.tsx` | **Create** |
| `resources/js/pages/clients.tsx` | **Delete** |
