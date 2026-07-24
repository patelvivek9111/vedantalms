# Registrar — Remaining Work (5 Phases)

**Status:** All 5 phases complete  
**Last updated:** 2026-07-23  
**Related:** [FULL_REGISTRAR_ROADMAP.md](../archive/FULL_REGISTRAR_ROADMAP.md) (archived), [PARTNER_FIELD_MAPPING_PRESETS.md](./PARTNER_FIELD_MAPPING_PRESETS.md), [CANVAS_MULTI_TENANT.md](../platform/CANVAS_MULTI_TENANT.md), [CBCS_ABC_ROADMAP.md](../nep/CBCS_ABC_ROADMAP.md)

---

## Honest baseline

The Registrar Office UI (Dashboard → Settings) is **live and usable** for day-to-day work: terms, enrollments, students, programs, sections, grade status, transcripts, reports, operations, CSV + scheduled SIS connectors, LTI AGS passback (when configured), and ERP hold webhooks.

This document tracked leftover phases after R1–R8. **All five phases are complete.** Remaining product work (if any) lives in NEP / multi-tenant docs, not these checklists.

**Out of scope forever (ERP):** fees, admissions CRM, hostel, payroll, full Banner/PeopleSoft replacement.

**Separate track:** NEP CBCS / ABC / multidisciplinary — see `docs/nep/CBCS_ABC_ROADMAP.md` (not folded into these five phases).

---

## Phase 1 — Office polish & settings hub ✅

**Goal:** Remove “stub” surfaces and finish credential/ops UX registrars expect inside `/registrar`.

**Implemented:** 2026-07-23

### Checklist

- [x] Replace `RegistrarSettings` stub with a real Settings hub:
  - [x] Links + inline panels for institution grading defaults, hold defaults, transcript template defaults
  - [x] Tenant-safe toggles (India calendar mode, enrollment method defaults, SIS schedule display)
  - [x] Deep-links to Programs, Sub-accounts, Admin system settings
- [x] Transcript bulk ZIP download (`transcript.bulk_issue` writes ZIP + `GET /api/registrar/jobs/:jobId/download`)
- [x] Student 360 **Documents** tab: request / fulfill bonafide + TC from the student page
- [x] Policy impact preview surfaced in Grade status / Office (Policy impact tab + per-course preview)
- [x] Expand registrar audit event catalogue in Student 360 (`registrar.hold.*`, `registrar.transcript.request_created`, `registrar.document.issued` + Registrar events section)

### Exit

Registrar Settings is no longer labeled stub; bulk transcripts download as a ZIP; documents and policy preview are reachable without leaving Office. ✅

---

## Phase 2 — Grade & enrollment completeness ✅

**Goal:** Close governance edge cases so every section and large batch behaves predictably.

**Implemented:** 2026-07-23

### Checklist

- [x] Term finalize for sections **without** `lmsCourseId` — either:
  - [x] Force-link / create content course before finalize (`POST /sections/:id/link-course`)
  - [x] Explicit block with repair workflow in Grade status UI (Repair queue + force override)
- [x] Richer prerequisite / grade-based enrollment rule checks (offering `minGrade` via snapshots + GPA points)
- [x] Dual-write cutover: teaching UX reads/writes enrollment primarily via registrar `enrollmentWrite` (teaching dual-write becomes intentional fallback only)
- [x] Optional async BullMQ path for **very large** enrollment CSV batches (`enrollment.bulk_csv`, threshold env `ENROLLMENT_BULK_ASYNC_THRESHOLD`, default 100)
- [x] Amendment + missing-snapshot repair queues polished for dept_admin scope (`buildAccountScopeFilter` on dashboard + `POST /courses/:id/repair-snapshots`)

### Exit

No silent “can’t finalize” dead-ends; large CSV enrollments and prereq rules are trustworthy under load. ✅

---

## Phase 3 — Sections & split-gradebook depth ✅

**Goal:** Cross-list and multi-section teaching match how colleges actually run shared vs separate gradebooks.

**Implemented:** 2026-07-23  
**Guide:** [CROSS_LIST_GRADEBOOKS.md](./CROSS_LIST_GRADEBOOKS.md)

### Checklist

- [x] Deeper **split-gradebook** teaching UX when sections keep distinct `lmsCourseId`s (Open course / Gradebook links + teacher sibling chips)
- [x] Content remount / cross-list: document + tooling for historical gradebooks (preview API, confirm/export gate, `previousLmsCourseId` archive pointer — no silent merge)
- [x] Section browser: clearer publish / conclude / roster states when offering has mixed linked/unlinked sections
- [x] Waitlist + enrollment-method edge cases in Sections UI (`open` / `approval` / `registrar_only` / `sis_only` + waitlist promote)

### Exit

Registrar and teachers can explain and operate shared vs split cross-lists without engineering help. ✅

---

## Phase 4 — Production SIS automation ✅

**Goal:** Move from manual CSV / dry-run REST to scheduled, partner-ready sync — still without rebuilding ERP.

**Depends on:** Stable R6 staging inbox (already shipped).

### Checklist

- [x] Cron / worker for `SisIntegrationConfig.schedule` (`npm run worker:sis-sync -- --apply`)
- [x] Live **custom REST** SIS adapter (beyond dry-run when `CUSTOM_REST_SIS_DRY_RUN=false`) — field mapping UI
- [x] Banner connector: replace stub with real import/export adapter (pluggable mapping)
- [x] PeopleSoft connector: replace stub with real import/export adapter
- [x] Fedena / common India SIS adapter (optional; same pluggable interface)
- [x] Sync health on Dashboard (last run, error rate, retry) beyond raw `SIS ERRORS` count
- [x] Safer conflict override UX + runbooks in Operations

### Exit

A school can schedule nightly sync for at least one live connector; CSV remains available as fallback.

---

## Phase 5 — LTI AGS & board / portal integrations ✅

**Goal:** Real grade passback and India compliance *submission* hooks — sales-honest, not brochure-only extracts.

**Depends on:** Phase 4 grade export stability; R4 finalize + R5 transcripts.

### Checklist

- [x] Full LTI 1.3 **AGS** line-item sync (replace readiness + submit-stub in `ltiAgs.service`)
- [x] AGS enabled path covered by automated tests + Office “integration status” indicator
- [x] UDISE / CBSE **portal submit** adapters (or certified partner webhook) — extract-only reports already exist
- [x] ERP hold webhook hardening (retries, signature verify, dead-letter) beyond current `POST /api/integrations/erp/holds`
- [x] Partner field-mapping presets documented for sales/implementations

### Exit

LTI AGS can pass grades to a real consumer; India board path is either certified submit or an explicit “export-only + partner” packaging — no stub labels in SIS/LTI UI for claimed connectors.

---

## Suggested order & sizing

| Phase | Focus | Rough effort | Ships value when… |
|-------|--------|--------------|-------------------|
| **1** ✅ | Settings, ZIP, documents, policy preview | S–M | Office feels “finished” |
| **2** ✅ | Finalize edges, prereqs, dual-write, big CSV | M | Term close is reliable |
| **3** ✅ | Split gradebook / cross-list depth | M | Multi-section colleges |
| **4** ✅ | Cron + live SIS connectors | L | Partner integrations |
| **5** ✅ | LTI AGS + board portals | L | Enterprise / board demos |

Do **one phase at a time** for merge/demo claims. Update checkboxes here when a PR lands.

---

## Explicitly not in these five phases

| Item | Where it lives |
|------|----------------|
| Fees, admissions, hostel, payroll | Never in LMS — integrate ERP |
| NEP CBCS / ABC / multidisciplinary pathways | `docs/nep/CBCS_ABC_ROADMAP.md` |
| Multi-tenant Account / Host platform | `docs/platform/CANVAS_MULTI_TENANT.md` (done) |
| Re-opening R1–R8 checklists | Archived in `docs/archive/FULL_REGISTRAR_ROADMAP.md` |
