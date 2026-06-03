# Period Normalization & Data Reset — TICKET-11

**Priority:** HIGH  
**Status:** Done — implemented 2026-06-03  
**Date:** 2026-06-03  
**Branch:** develop  
**Effort:** S  
**Prerequisite:** Financial overview redesign changes (working tree) must be committed first.

---

## Problem Statement

Three issues surfaced during the financial-overview redesign QA session (2026-06-03):

**1. Mixed period formats in the DB**  
Existing data uses the old `Pd12-2025` format. The canonical format locked in [financial-overview.md](../decisions/financial-overview.md) Q1 is `YYYY-P01` (e.g. `2025-P12`). `ExcelService` stores the period string as-is from the Excel file, so old imports polluted the DB with non-canonical strings. The entire correctness of lexicographic sort and trend calculations depends on every stored period being in `YYYY-P01` form — mixed formats silently break both.

**2. `<Select>` shows blank when `filters.period` is empty**  
In `ClientTable.tsx`, `value={filters.period}` passes an empty string to the Radix `<Select>` component when no period is available (e.g. empty DB after reset). Radix treats `""` as a valid value rather than uncontrolled, so the placeholder "Period" never appears — the dropdown renders visually blank.

**3. DB must be reset**  
The existing records with `Pd12-2025`-style periods cannot be reliably migrated in place (Q9 decision). The database must be cleared and re-imported from Excel files that use the canonical format. Fix 1 (normalization) ensures future imports are safe even if the Excel file still uses old-style period strings.

---

## What To Do

### Fix 1 — Period normalization in `ExcelService`
**File:** `app/Services/ExcelService.php`

Add a private `normalizePeriod()` method and call it on the raw period cell value before the upsert. Return `null` for unrecognizable formats so the caller can surface a clear row-level error.

**Variants to normalize:**

| Input example | Output | Pattern matched |
|---|---|---|
| `2025-P01` | `2025-P01` | Already canonical — pass through |
| `2025-P1` | `2025-P01` | Missing zero-pad on period number |
| `Pd12-2025` | `2025-P12` | Old `Pd{N}-{YYYY}` format |
| `P01-2025` | `2025-P01` | Period-first variant (zero-padded) |
| `P1-2025` | `2025-P01` | Period-first, no zero-pad |

**Implementation:**
```php
private function normalizePeriod(string $raw): ?string
{
    $raw = trim($raw);

    // Canonical: 2025-P01
    if (preg_match('/^\d{4}-P\d{2}$/', $raw)) {
        return $raw;
    }
    // Missing zero-pad: 2025-P1
    if (preg_match('/^(\d{4})-P(\d)$/', $raw, $m)) {
        return $m[1] . '-P0' . $m[2];
    }
    // Old Pd format: Pd12-2025
    if (preg_match('/^Pd(\d{1,2})-(\d{4})$/', $raw, $m)) {
        return $m[2] . '-P' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
    }
    // Period-first: P01-2025 or P1-2025
    if (preg_match('/^P(\d{1,2})-(\d{4})$/', $raw, $m)) {
        return $m[2] . '-P' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
    }

    return null;
}
```

**Call site (inside the import row loop, before upsert):**
```php
$period = $this->normalizePeriod((string) ($row['period'] ?? ''));
if ($period === null) {
    $errors[] = "Row {$rowNum}: unrecognizable period format '{$row['period']}' — expected YYYY-P01 (e.g. 2025-P01).";
    $failed++;
    continue;
}
// use $period in the upsert instead of $row['period']
```

---

### Fix 2 — `<Select>` empty-value fix
**File:** `resources/js/components/ClientTable.tsx`  
**Location:** Period filter `<Select>` (search for `value={filters.period}`)

```tsx
// Before
value={filters.period}

// After
value={filters.period || undefined}
```

Passing `undefined` instead of `""` puts Radix `<Select>` into uncontrolled mode for the empty case, which correctly renders the "Period" placeholder.

---

### Fix 3 — Database reset
Run once after Fix 1 is implemented and committed. **Destructive — clears all client data.**

**Full reset (drops and recreates all tables — recommended):**
```bash
./vendor/bin/sail artisan migrate:fresh
```

**Data-only reset (schema stays, data wiped):**
```bash
./vendor/bin/sail artisan tinker --execute="DB::statement('TRUNCATE clients, client_financial_records, mediation_sessions, session_clients, session_mediators RESTART IDENTITY CASCADE');"
```

After reset:
1. Re-import from Excel files. Period strings in `Pd12-2025` format will be auto-normalized to `2025-P12` by Fix 1.
2. Verify the period filter dropdown populates correctly and the sheet's trend arrows compute against the right previous period.

---

## Acceptance Criteria

- [x] Importing an Excel file with `Pd12-2025` period strings stores them as `2025-P12` in the DB.
- [x] Importing `2025-P1` (no zero-pad) stores as `2025-P01`.
- [x] An unrecognizable period format (e.g. `Q1-2025`, `January`) causes that row to fail with a descriptive message in the import result — other rows still import.
- [x] `ClientTable` period `<Select>` shows the "Period" placeholder when `filters.period` is an empty string (empty DB after reset).
- [x] All stored `period` strings match `/^\d{4}-P\d{2}$/` after a fresh import.
- [x] DB is reset and re-imported before declaring the financial overview redesign stable.

---

## Out of Scope

| Item | Reason |
|---|---|
| In-place migration of `Pd12-2025` records | Q9 decision — reset + re-import is the path |
| Period range validation (P01–P13 only) | Cooperative won't exceed 13 periods/year; not worth guarding |
| Excel template download with pre-formatted period column | User controls the template |
| Normalization of year-only or quarter formats (`2025`, `Q1`) | Too ambiguous to normalize safely — treat as errors |
