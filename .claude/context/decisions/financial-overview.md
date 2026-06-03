# Financial Overview Redesign — Client Detail Sheet

**Status:** Ready to implement
**Date:** 2026-06-03
**Branch:** develop
**Parent context:** [client-detail-iterations.md](../history/client-detail-iterations.md) (Iteration 2 — current sheet)

---

## Problem Statement

The current `ClientDetailSheet` Financial Overview section has two dropdowns — "Period" and "Compare with" — which mediators find confusing to navigate. The root cause is that the original design treated periods as arbitrary selections rather than a chronological sequence, and included an "All Time" aggregate mode that was financially incorrect (it `SUM()`-ed snapshot balances, double-counting them).

**Domain rule now canonical:** Each `client_financial_records` row is a **point-in-time balance sheet snapshot**. Savings of ₱12,000 in Period 2 already includes Period 1's ₱10,000 — it is not additive. Summing across periods is wrong.

---

## Domain Rules Locked

| Rule | Decision |
|---|---|
| Period format | `YYYY-P01` through `YYYY-P13` (zero-padded, e.g. `2025-P01`) |
| Periods per year | 13 |
| Record model | Snapshot — each record is the client's balance at that point in time |
| "All Time" aggregate | **Removed everywhere** — was financially incorrect |
| Sort order | Lexicographic on period string = chronological (zero-padding makes this safe) |
| Existing data | Reset — user will re-upload with correct format |

---

## Design Decisions (Q1–Q9)

### Q1 — Period Format
**Decision:** `YYYY-P01` through `YYYY-P13`. Lexicographic sort = chronological. No schema change needed — still a `string` column. Enforced at import time via `ExcelService`.

### Q2 — "All Time" Aggregate
**Decision:** Dropped from **both** the sheet and the table filter. The `SUM()` aggregate was a silent data integrity bug (summing snapshots double-counts every balance). Mediators get the correct data by selecting any specific period.

### Q3 — Record Model
**Decision:** Confirmed snapshot. If savings goes from ₱10,000 (P1) to ₱8,000 (P2), the client withdrew ₱2,000. The delta between consecutive snapshots is the meaningful signal, not the sum.

### Q4 — "Previous Period" for Trend Arrows
**Decision:** **Data-previous** — the most recent period this client actually has a record for, before the currently selected period. Not the calendar-previous period number.

**Algorithm (frontend):**
```ts
const sortedPeriods = [...availablePeriods].sort(); // lex sort = chronological
const idx = sortedPeriods.indexOf(selectedPeriod);
const dataPreviousPeriod = idx > 0 ? sortedPeriods[idx - 1] : null;
```

Cross-year boundary is handled automatically: `2024-P13` sorts before `2025-P01` lexicographically because `"2024" < "2025"`.

### Q5 — Default Period on Sheet Open
**Decision:** **Inherit from table filter.** The `defaultPeriod` prop (table's active period) is used as the initial selected period.

**Fallback chain:**
1. Use `defaultPeriod` if the client has a record for it.
2. Otherwise use the client's most recent available period.
3. If no records exist at all, show empty state.

```ts
const sortedPeriods = [...availablePeriods].sort();
const latestPeriod = sortedPeriods[sortedPeriods.length - 1] ?? null;
const initialPeriod = availablePeriods.includes(defaultPeriod ?? '')
    ? defaultPeriod!
    : latestPeriod;
```

Since the table now always has a specific period selected (Q6), `defaultPeriod` will almost always be valid. The fallback is a safety net.

### Q6 — Table Default Without "All Time"
**Decision:** Table defaults to the **latest period** in the DB when the page loads (most recent `period` value from `client_financial_records`). The `all` / `leftJoinSub` aggregate path is removed from `Api\ClientController@index` entirely.

### Q7 — Trend Indicator Display
**Decision:** **Icon + percentage** (`↑ 12.3%` / `↓ 8.0%` / `— 0%`).

The "Financial Overview" section heading gets a subtitle showing the comparison context:
- When two periods: `Showing 2025-P03 · vs 2025-P01`
- When no previous period (first record): `2025-P01 · No prior period`
- When only one period exists (Q8 plain-text path): `2025-P01`

### Q8 — Period Selector When Client Has One Period
**Decision:** Show a **plain text label** instead of a `<Select>` dropdown. A single-option dropdown implies choice where there is none.

- Two or more periods → `<Select>` dropdown with all available periods
- Exactly one period → plain text `2025-P01` beneath the section heading

### Q9 — Existing Data Migration
**Decision:** No migration. Dev/test data is reset; user will re-upload all records using the `YYYY-P01` string format in the Excel file. `ExcelService` stores the period string as-is from the import.

---

## What Changes

### Backend — `app/Http/Controllers/Api/ClientController.php`

**`show($id)` method:**
- Remove the `$totals` DB query (`SUM` across all periods — no longer needed).
- Remove `$client->total_financials = $totals` assignment.
- Change `financialRecords` sort from `uploaded_date DESC` to `period DESC` (lexicographic = most recent first with `YYYY-P01` format).
- Response shape simplifies to: `client_id`, `name`, `times_scheduled`, `financial_records[]`.

**`index(Request $request)` method:**
- Remove the `if ($selectedPeriod === 'all')` branch and its `leftJoinSub` aggregate entirely.
- Change default `$selectedPeriod`: when no `period` param, query for the latest period (`ClientFinancialRecord::max('period')`) and use that.
- The `else if ($selectedPeriod)` INNER JOIN branch becomes the only path.
- Remove `'All Time' as period` and `NULL as assigned_mediator` from the SQL select.

### Frontend — `resources/js/components/ClientDetailSheet.tsx`

**Remove:**
- `comparisonPeriod` state and its `setComparisonPeriod`.
- The second `<Select>` ("Compare with") and its containing grid column.
- The `'all_time'` mode in `displayData` useMemo (the `total_financials` branch).
- The `sum()` helper (was only used for the erroneous comparison-period addition).
- The `periods` prop from the `Props` interface (was passed in but never actually consumed — `availablePeriods` was always derived from `clientDetail.financial_records`).

**Add:**
- `dataPreviousPeriod` computed value (derived from `availablePeriods` + `selectedPeriod` using the Q4 algorithm).
- Plain-text period label path when `availablePeriods.length === 1` (Q8).
- Updated `periodSubtitle` logic covering three states (Q7).

**Change:**
- `displayData` useMemo: remove `'all_time'` branch; selected period is always a specific period string.
- `comparisonData` useMemo: replace `comparisonPeriod` state with `dataPreviousPeriod` (always auto-computed, never manually selected).
- `useEffect` on `clientId`: remove `setComparisonPeriod('')` reset; update `setSelectedPeriod` to use the Q5 fallback chain instead of defaulting to `'all_time'`.
- `periodSubtitle`: three-state string (Q7).

### Frontend — `resources/js/pages/clients/index.tsx`

- Remove "All Time" / `all_time` option from the period filter `<Select>`.
- `defaultPeriod` passed to `<ClientDetailSheet>` is always `filters.period` (a specific period string; never `''` or `'all'`).
- On mount, if `filters.period` is absent, default to the first (latest) period from the `periods` prop.

### Frontend — `resources/js/components/ClientTable.tsx`

- Remove the "All Time" `<SelectItem>` from the period filter dropdown.

---

## Updated Sheet Layout

```
┌──────────────────────────────┐
│  Client Name                 │  ← SheetHeader (sticky)
│  #1234                       │
├──────────────────────────────┤
│  [ Schedule Session ▶ ]      │
├──────────────────────────────┤
│  Times Scheduled     3       │
├──────────────────────────────┤  scrollable ↓
│  Financial Overview          │
│  Showing 2025-P03 · vs P02   │  ← subtitle (auto, not user-chosen)
│                              │
│  [2025-P03 ▼]                │  ← single period selector
│  (plain "2025-P01" if only   │    one period exists — no dropdown)
│                              │
│  ASSETS                      │
│  Savings      ₱12,345  ↑ 8% │  ← trend always vs data-previous
│  Fixed Dep.    ₱5,000  — 0% │
│                              │
│  LIABILITIES                 │
│  Loan Balance  ₱8,000  ↓ 5% │  ← down = good for liabilities (invertTrend)
│  Arrears       ₱1,200  ↑ 2% │
│  Fines           ₱150  — 0% │
│  Mortuary        ₱500  ↓ 3% │
│                              │
│  NET POSITION                │
│  Total Assets  ₱17,345       │
│  Total Liab.    ₱9,850       │
│  ──────────────────────────  │
│  Net Worth      ₱7,495       │
├──────────────────────────────┤
│  DANGER ZONE                 │  ← sticky bottom
│  [ 🗑 Delete Client ]        │
└──────────────────────────────┘
```

---

## Key Invariants

- `availablePeriods` is always sourced from `clientDetail.financial_records` — never from the parent page's global `periods` list.
- `dataPreviousPeriod` is `null` when the client has only one record or when the selected period is the oldest on record. In this case all trend indicators show `—`.
- Lexicographic sort on `YYYY-P01` strings is safe because the year is always 4 digits and the period number is always zero-padded to 2 digits.
- The `periods` prop on `ClientDetailSheet` can be **removed** entirely — it was never consumed by the component.

---

## Out of Scope

| Item | Reason |
|---|---|
| `ExcelService` period format validation | Internal tool; user controls the upload format |
| Cross-year period navigation UI | Handled implicitly by the dropdown listing all available periods |
| Net Position trend (total assets vs total liabilities delta) | Net Position card has no trend row — kept as-is |
| TICKET-05 Session History | Separate ticket, unaffected by this change |
| TICKET-07 Mediator assignment edit | Separate ticket, unaffected by this change |
