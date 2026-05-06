# Client Detail Page Refactor

**Status:** Completed  
**Date:** 2026-05-02  
**Branch:** develop

## What Changed

The `ClientSidebar` (a 400px slide-over drawer) was replaced with a full Inertia page at `/clients/{id}`.

### Files Added
- `resources/js/pages/clients/show.tsx` — New two-column client detail page (Inertia page component)

### Files Modified
- `routes/web.php` — Added `GET /clients/{id}` → `ClientController@show` (named `clients.show`)
- `app/Http/Controllers/ClientController.php` — `show()` now returns `Inertia::render('clients/show', ['client' => ...])` instead of JSON. Passes `financial_records` + `total_financials` as props.
- `resources/js/components/ClientTable.tsx` — Row click uses `router.visit(clientShow.url(id))`; View button is an Inertia `<Link>`. All sidebar state removed.
- `resources/js/routes/index.ts` — No change needed. `routes/index.ts` is Wayfinder auto-generated; manual additions are stripped by the formatter on save. `ClientTable.tsx` uses `` `/clients/${c.client_id}` `` directly instead.

### Files Deleted
- `resources/js/components/ClientSidebar.tsx` — Fully replaced by the new page.

## Page Layout

Two-column layout (`lg:grid-cols-2`):

| Left column | Right column |
|---|---|
| Period filter (Select) | Quick actions (Schedule / View Logs) |
| Compare-with filter (Select) | Assigned Mediator (mock edit) |
| 6 financial cards (2-col grid) | Mediation Stats (mock: 2) |
| | Remarks History (mock data) |

Breadcrumb: `Clients > {client.name}`

## Data Flow

```
GET /clients/{id}
  → ClientController@show
    → Eloquent: Client + financialRecords (ordered by uploaded_date desc)
    → DB::table totals (SUM per financial field)
    → Inertia::render('clients/show', { client: { ..., financial_records, total_financials } })
      → resources/js/pages/clients/show.tsx
        → period filtering + comparison logic via useMemo (client-side, no round-trips)
```

## Deferred / Mock Items (to tackle next)

The following features carry forward as mock/placeholder from the old sidebar — they are **not wired to real data** yet:

| Feature | Current state | What needs doing |
|---|---|---|
| **Remarks** | `MOCK_REMARKS` hardcoded array | Create `remarks` DB table + API endpoints |
| **Mediation Stats** (Times Scheduled) | Hardcoded `2` | Wire to `COUNT` of `session_clients` for this client |
| **Mediator editing** | UI-only (closes edit mode, no API call) | `PATCH /api/clients/{id}/mediator` endpoint |

## Next Planned Refactor

`ClientTable.tsx` is also scheduled for a refactor. It currently fetches data via `axios` on mount — the plan is to migrate it to Inertia server-side props following the same pattern used for `clients/show.tsx`.