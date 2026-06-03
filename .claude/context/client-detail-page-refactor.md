# Client Detail Refactor History

---

## Iteration 2 — Sidebar Sheet (current)

**Status:** Completed  
**Date:** 2026-05-19  
**Branch:** develop  
**Backlog impact:** Scheduling backlog TICKET-03 through TICKET-07 referenced `show.tsx` — all re-targeted to `ClientDetailSheet.tsx` / `Api\ClientController` on 2026-05-23.

### What Changed

The full Inertia page at `/clients/{id}` was replaced with a slide-in `Sheet` component (`ClientDetailSheet`) mounted directly on the `clients/index.tsx` table page. The goal was to keep mediators in the table context while viewing client financials.

Remarks History and Client Info were removed from the sidebar entirely — they are deferred to the mediation module.

### Files Added
- `resources/js/components/ClientDetailSheet.tsx` — Self-contained sheet component. Fetches `/api/clients/{id}` on open, shows loading skeleton, renders Financial Overview with period/comparison selectors, Net Position summary, and isolated action buttons.

### Files Modified
- `resources/js/pages/clients/index.tsx` — Added `selectedClient` state; `openSheet`/`closeSheet` helpers; passes `onRowClick={openSheet}` to `ClientTable`; mounts `ClientDetailSheet`; fixed `DeleteClientsModal` mode to be dynamic (`'single' | 'batch'`).
- `resources/js/components/ClientTable.tsx` — Added `onRowClick` prop; row click calls `onRowClick(id, name)` instead of navigating; removed the "View" link column; fixed empty-state `colSpan` (9 → 8).
- `resources/js/components/BatchScheduleModal.tsx` — Added `preserveState: true` to `router.post` so React state (including open sheet) is preserved after the schedule redirect.
- `app/Http/Controllers/ClientController.php` — Removed `show()` method (was rendering Inertia page).
- `routes/web.php` — Removed `GET /clients/{id}` Inertia route. The API route `GET /api/clients/{id}` (`Api\ClientController@show`) is kept — that is what `ClientDetailSheet` fetches from.

### Files Deleted
- `resources/js/pages/clients/show.tsx` — Full client detail page no longer needed.

### Sheet Layout

```
┌──────────────────────────────┐
│  Client Name                 │  ← SheetHeader (sticky)
│  #1234                       │
├──────────────────────────────┤
│  [ Schedule Session ▶ ]      │  ← Full-width primary CTA
├──────────────────────────────┤  scrollable ↓
│  Financial Overview          │
│  Period [▼]  Compare [▼]     │  ← 2-col grid, outside the data rows
│                              │
│  ASSETS                      │
│  Savings          ₱12,345    │
│  Fixed Deposit     ₱5,000    │
│                              │
│  LIABILITIES                 │
│  Loan Balance      ₱8,000    │
│  Arrears           ₱1,200    │
│  Fines               ₱150    │
│  Mortuary            ₱500    │
│                              │
│  NET POSITION                │
│  Total Assets     ₱17,345    │
│  Total Liabilities ₱9,850    │
│  ─────────────────────────   │
│  Net Worth         ₱7,495    │
├──────────────────────────────┤
│  DANGER ZONE                 │  ← sticky at bottom, never scrolls
│  [ 🗑 Delete Client ]        │
└──────────────────────────────┘
```

### Completed items (this iteration)

| Feature | Status | Ticket |
|---|---|---|
| **Schedule Session** | ✅ Done 2026-05-27 — `onSchedule` in `clients/index.tsx` already wired to `openBatchModal`; confirmed working | TICKET-03 |
| **Times Scheduled** | ✅ Done 2026-05-27 — `Api\ClientController@show` returns count from `session_clients`; displayed in sheet between schedule button and financial overview | TICKET-04 |

### Remaining items in this iteration

| Feature | What needs doing | Ticket |
|---|---|---|
| **Session History** | Add `session_history` to API response; collapsible "View Logs" section above Danger Zone | TICKET-05 |
| **Mediator assignment edit** | Add display + inline edit UI to sheet; add `PATCH /api/clients/{id}/mediator` endpoint | TICKET-07 |
| **Remarks History** | Deferred to mediation module | TICKET-06 |

### Design Decisions
- **Schedule and Delete are never adjacent.** Schedule is a primary button near the top; Delete is pinned to the bottom in a labelled Danger Zone, separated by the full financial section.
- **Sticky Danger Zone.** The delete button is always visible without scrolling so mediators can act quickly, but its physical distance from Schedule prevents accidental clicks.
- **Net Position summary.** Computed client-side from `displayData`; gives mediators an instant financial health read without needing to mentally sum the rows.
- **Period selectors outside the card.** Moved from a cramped card header to a labelled 2-column grid above the data — cleaner hierarchy, easier to use on a narrow panel.
- **`defaultPeriod` is applied on open.** When the table is filtered to a specific period, the sheet defaults to that same period instead of always starting on "All Time".
- **`preserveState: true` on schedule.** Prevents Inertia from resetting React component state after the POST redirect, keeping the sheet open post-scheduling.

### Data Flow

```
Row click → openSheet(id, name)
  → ClientDetailSheet mounts with clientId
    → GET /api/clients/{id}  (Api\ClientController@show)
      → { data: { client_id, name, financial_records[], total_financials } }
    → period/comparison filtering via useMemo (client-side, no round-trips)
    → Net Position computed from displayData
```

---

## Iteration 1 — Full Inertia Page (superseded)

**Status:** Superseded by Iteration 2  
**Date:** 2026-05-02  
**Branch:** develop

The `ClientSidebar` (a 400px slide-over drawer) was replaced with a full Inertia page at `/clients/{id}`.

### Files Added
- `resources/js/pages/clients/show.tsx` — Two-column client detail page.

### Files Modified
- `routes/web.php` — Added `GET /clients/{id}` → `ClientController@show` (named `clients.show`).
- `app/Http/Controllers/ClientController.php` — `show()` returned `Inertia::render('clients/show', [...])`.
- `resources/js/components/ClientTable.tsx` — Row click used `router.visit('/clients/${id}')`.

### Files Deleted
- `resources/js/components/ClientSidebar.tsx`

### Deferred items from this iteration (still pending)

| Feature | What needs doing |
|---|---|
| **Remarks History** | To be built in the mediation module |
| **Client Info panel** | To be built in the mediation module |
| **Mediation Stats** | Wire to `COUNT` of `session_clients` for the client |
