# Context Index

**Last updated:** 2026-06-03  
**Branch:** develop

Load this file first. Each entry is one line — follow the link when the topic is relevant. Do not load files speculatively.

---

## decisions/ — Locked design choices (read when implementing the related feature)

- [financial-overview.md](decisions/financial-overview.md) — Period model (`YYYY-P01`), snapshot record rule, Q1–Q9, single period selector, trend arrows. **Status: In progress (working tree has matching changes)**
- [client-table.md](decisions/client-table.md) — Table refactor: Inertia props, 4 filters, batch schedule, pagination, URL shape, import UX. **Status: Implemented**

---

## history/ — Completed feature logs (read for context on why things are the way they are)

- [client-detail-iterations.md](history/client-detail-iterations.md) — Iteration 1 (Inertia page) → Iteration 2 (sidebar sheet). Records what was removed and why. TICKET-03 and TICKET-04 resolved here.
- [period-normalization.md](history/period-normalization.md) — TICKET-11: `normalizePeriod()` in `ExcelService`, `<Select>` empty-value fix, DB reset. Done 2026-06-03.

---

## backlog/ — Active and upcoming tickets

- [scheduling-tickets.md](backlog/scheduling-tickets.md) — TICKET-01 through TICKET-10. **TICKET-01–04 done. TICKET-05 (session history) is next.**

---

## Quick status

| What | Status |
|---|---|
| Financial overview redesign | Working tree ready — not yet committed |
| Period normalization (`ExcelService`) | Done — TICKET-11 closed 2026-06-03 |
| DB reset | Done — `migrate:fresh` run 2026-06-03 |
| TICKET-05 (session history in sheet) | Next |
