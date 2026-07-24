# Full Canvas-Class Registrar — Implementation Roadmap

**Status:** Complete — R1–R8 done; see **§23 Eight-phase execution tracker**  
**Owner:** MySl8te platform team  
**Last updated:** 2026-07-23  
**Related:** [CANVAS_PARITY_AUDIT.md](./CANVAS_PARITY_AUDIT.md), [POLICY_CHANGE_UX.md](./POLICY_CHANGE_UX.md), [security.md](../security.md), [CANVAS_MULTI_TENANT.md](../platform/CANVAS_MULTI_TENANT.md)

---

## Purpose

This document is the **source of truth for a future full Canvas-class registrar capability** in MySl8te. Use it when prioritising features, writing PRDs, or scoping work for schools and colleges in the Indian market.

It records:

1. What “Canvas-like registrar” actually means (and what it does **not** mean)
2. What MySl8te already ships today
3. Every subsystem, data model, API, UI screen, workflow, and migration step needed to close the gap
4. A phased rollout plan with realistic estimates

---

## 0. Scope — what “Canvas-like registrar” actually means

Canvas does **not** ship a complete university ERP registrar. In production, “registrar” usually means:

| Layer | Typical owner | MySl8te goal |
|-------|---------------|--------------|
| Teaching & learning | LMS | **Strong today** |
| Grade governance & official records | LMS + Registrar role | **Partial today** |
| Enrollment of record | SIS or LMS | **Mostly missing** |
| Fees, admissions, timetables | ERP | **Integrate, do not rebuild** |
| Official transcripts & compliance exports | Registrar office | **Partial (API + student view)** |

**Target definition for MySl8te:** everything Canvas Admin + SIS Import/Export provides for academic records, plus a dedicated **Registrar Office UI**, plus India-specific reporting hooks — **not** a replacement for Fedena, MasterSoft, Banner, or full college ERP.

---

## 1. Current state inventory

### 1.1 Built today

| Area | Status | Location |
|------|--------|----------|
| `registrar` role + capabilities | Done | `middleware/academicPermissions.js` (+ `manage_enrollments`, `manage_holds`, `manage_sis`) |
| Grade lifecycle (DRAFT → POSTED → FINALIZED → AMENDED) | Done | `models/courseGradeLifecycle.model.js`, `CourseGradeLifecyclePanel` |
| Frozen grade snapshots | Done | `models/studentCourseGradeSnapshot.model.js` |
| Institution + course grading policy | Done | `institutionGradingPolicy`, `courseGradingPolicy` |
| Policy audit + impact preview | Done | `gradingPolicyAudit`, `docs/archive/POLICY_CHANGE_UX.md` |
| Course grading periods | Done | `models/courseGradingPeriod.model.js`, `GradingPeriodsModal` |
| Transcript view (student) | Done | `frontend/src/pages/Transcript.tsx`, `/api/reports/transcript` |
| Official transcript issuance (API) | Done | `services/transcriptIssuance.service.js`, `transcriptIssueLog.model.js` |
| Registrar reports (API) | Done | `/api/registrar/reports/*` (tenant-scoped) |
| Academic terms | Done | `models/academicTerm.model.js`, `/api/academic-structure/terms` |
| Course offerings + sections | Done | `courseOffering`, `courseSection`, dual-write on course create |
| Cross-list groups | Done (API) | `crossListGroup.model.js`, `POST /api/academic-structure/cross-lists` |
| Enrollment of record | Done (dual-write) | `enrollment.model.js`, `enrollmentWrite.service.js`, roster dual-write |
| Holds | Done (API + thin UI) | `studentHold.model.js`, `/api/registrar/holds` |
| SIS stage → apply | Done (MVP) | `sisStagingEnrollment`, `sisJob`, `/api/registrar/sis/*` |
| Registrar Office UI | Partial | `frontend/src/pages/RegistrarOffice.tsx` — summary / enrollments / holds / SIS tabs |
| India calendar / institution mode | Done | `services/academicCalendar.service.js`, `systemSettings` |
| Account / sub-account tree | Done | Multi-tenant `Account` model (see `CANVAS_MULTI_TENANT.md`) |
| Enrollment (teacher-led) | Partial | Catalog, QR, join codes, waitlist, instructor approval — still dual with `Course.students[]` |

### 1.2 Registrar role capabilities today

From `middleware/academicPermissions.js`:

| Capability | Meaning |
|------------|---------|
| `finalize_grades` | Lock end-of-term grades |
| `amend_grades` | Correct finalized records (with reason) |
| `recompute_grades` | Re-run grade calculation / transcript logic |
| `manage_institution_policy` | Set institution-wide grading policy |
| `view_lifecycle` | See grade lifecycle and audit data |
| `post_grades` | Post grades (not limited to one course like teachers) |
| `manage_enrollments` | Bulk enroll / drop / roster / term conclude |
| `manage_holds` | Place / list / release student holds |
| `manage_sis` | Stage / apply SIS enrollment batches |

**Important separation (Canvas-aligned):** registrars **cannot** edit raw student submissions — they govern official records, not day-to-day grading (`canEditRawSubmission` returns false for `registrar`).

### 1.3 Still missing for “full registrar”

- Rich **Registrar Office** (dashboard KPIs, term UX, section browser, student 360 — only thin tabs today)
- **Enrollment rules engine** (prereqs, capacity, windows, preview before apply)
- **Enrollment transfer**, waitlist promote APIs, full lifecycle UI
- **Program / degree** + `studentProfile` + student 360° UI
- **Institution grading periods** + **term-wide finalize** + grade-status matrix
- **Transcript office** (templates, request queue, PDF + QR verify, bulk issue)
- **Production SIS** (users/sections CSV, staging diff UI, grade passback, sync history)
- **Cross-list wizard UI** (API exists)
- **India compliance pack** (CBSE / university forms, bilingual, bonafide / TC)
- **ERP hold webhooks** + **LTI 1.3 AGS** grade passback
- Dedicated registrar **async jobs** + notification / audit event catalogue

### 1.4 Canvas parity checklist (honest)

| Canvas / industry capability | MySl8te today | After full build |
|------------------------------|---------------|------------------|
| Account terms | `AcademicTerm` + legacy course semester | Institution terms (office UX) |
| SIS CSV import | Enrollment stage/apply MVP | Full pipeline + diff UI |
| Grade export to SIS | No | Yes |
| Grading period close | Per-course | Institution + course |
| Finalize grades | Per-course | Per-course + bulk term |
| Registrar role | APIs + thin `/registrar` | Full office UI |
| Cross-listed sections | API only | API + wizard UI |
| Enrollment of record | `Enrollment` + dual-write | Enrollment primary + rules engine |
| Official transcript | API + student view | Office UI + PDF + bulk |
| Holds | API + thin UI | Full enforcement UX + ERP webhook |
| SubAccount-scoped admin | Account tree + filters | Dept-scoped office screens |

---

## 2. Target architecture

Six subsystems:

1. **Institutional hierarchy** — institution, sub-accounts, academic terms
2. **Course catalog & sections** — offerings, sections, cross-listing
3. **Enrollment of record** — authoritative enrollments, holds, bulk ops
4. **Grade governance** — extend existing lifecycle to term-wide ops
5. **Transcripts & credentials** — UI, templates, bulk issuance, verification
6. **SIS integration** — import/export pipeline with staging and reconciliation

```
Registrar Office UI
        ↓
Registrar API Layer (terms, enrollments, grades, transcripts, sis, reports)
        ↓
Domain Services (Term, Section, Enrollment, GradeGovernance, Transcript, Hold, SisSync)
        ↓
MongoDB collections + BullMQ async jobs
        ↓
External SIS / ERP (CSV, REST, webhooks)
```

---

## 3. Institutional hierarchy (Canvas “Account” model)

### 3.1 `Institution` (extend `systemSettings` or new collection)

```js
{
  name, code,                    // "ABC Degree College", "ABC001"
  affiliationBody,               // "SPPU", "CBSE", "GTU"
  udiseCode,                     // schools
  naacCycle,
  timezone: "Asia/Kolkata",
  institutionMode: "school|college|mixed",
  calendarStyle: "india|us",
  academicYearStart: 2025,
  defaultGradingScaleId,
  registrarContactEmail,
  logoUrl,
  address: { line1, city, state, pincode, country }
}
```

### 3.2 `SubAccount` (departments / faculties)

```js
{
  institutionId,
  parentSubAccountId,
  name, code,
  adminUserIds[],
  isActive
}
```

### 3.3 `AcademicTerm` (institution-wide)

```js
{
  institutionId,
  name,                          // "2025–26 Semester I"
  code,                          // "2025-26-S1"
  termType: "semester|trimester|quarter|annual|summer",
  startDate, endDate,
  enrollmentOpenDate, enrollmentCloseDate,
  gradingPeriodCloseDate,
  finalizeDeadline,
  status: "upcoming|active|grading|closed|archived",
  sisTermCode,
  academicYearLabel: "2025–26"
}
```

**Why:** Today each course has `semester.term/year`. Canvas uses account-level terms that courses attach to. One canonical term registry is required.

---

## 4. Course catalog & sections

### 4.1 Split catalog record from term instance

#### `CourseOffering` (catalog)

```js
{
  subAccountId,
  courseCode,
  title, description, credits,
  level: "ug|pg|school_grade_10",
  subjectCode,
  prerequisites: [{ courseCode, minGrade }],
  isActive,
  defaultGradingPolicyId,
  blueprintCourseId
}
```

#### `CourseSection` (term instance)

```js
{
  offeringId,
  academicTermId,
  sectionNumber,
  instructorId,
  teachingAssistantIds[],
  meetingPattern,
  maxEnrollment, minEnrollment,
  enrollmentMethod: "open|approval|registrar_only|sis_only",
  status: "planned|published|concluded|cancelled",
  concludeDate,
  sisSectionId,
  crossListGroupId,
  primarySectionId,
  lmsCourseId                   // link to existing Course document
}
```

### 4.2 Cross-listing

- Multiple sections share one content course
- Config: shared gradebook vs per-section gradebooks
- Registrar UI: cross-list wizard

### 4.3 Migration

- Existing `Course` documents become sections gradually
- Add `sectionId` foreign key; keep `Course` as content container during transition

---

## 5. Enrollment of record

### 5.1 `Enrollment` collection

Replace direct `Course.students[]` mutations over time.

```js
{
  sectionId,
  studentId,
  academicTermId,
  role: "student|ta|teacher|observer",
  status: "invited|active|completed|dropped|withdrawn|inactive",
  enrollmentType: "regular|audit|pass_fail|honors|credit|no_credit",
  enrolledAt, droppedAt, completedAt,
  enrolledBy: { userId, source },
  sisEnrollmentId,
  gradeBasis: "letter|pass_fail|gpa|percentage",
  isOfficial: true,
  holdBlocked: false,
  lastSyncAt,
  syncStatus: "synced|pending|conflict"
}
```

**Indexes:** `(sectionId, studentId)` unique; `(studentId, academicTermId)`; `(sisEnrollmentId)` sparse unique.

### 5.2 Enrollment workflows

| Workflow | Actor | Steps |
|----------|-------|-------|
| Registrar bulk enroll | Registrar | Term → sections → CSV or picker → rule check → preview → apply → audit |
| Student self-enroll | Student | Catalog → holds/prereqs → enroll or waitlist |
| Instructor approve | Teacher | Pending queue → approve/deny → notify |
| SIS import | System | Ingest → stage → diff → registrar review → apply |
| Drop/withdraw | Registrar/Student | Reason → effective date → grade policy (W vs F) |
| Late add | Registrar | Override capacity/holds/deadline with logged reason |
| Section transfer | Registrar | Move A→B, preserve history |
| Waitlist promote | System | On drop, promote by position, notify, accept deadline |

### 5.3 Enrollment rules engine

```js
enrollmentRules.check({
  student, section, term,
  checks: [
    'account_active',
    'no_financial_hold',
    'no_registrar_hold',
    'within_add_drop_window',
    'prerequisites_met',
    'capacity_available',
    'not_already_enrolled',
    'sis_authoritative'
  ]
})
// → { allowed, violations[], warnings[], overrideableBy: ['registrar','admin'] }
```

### 5.4 API endpoints

```
POST   /api/registrar/terms/:termId/enrollments/bulk
POST   /api/registrar/terms/:termId/enrollments/preview
GET    /api/registrar/terms/:termId/enrollments
PATCH  /api/registrar/enrollments/:id
POST   /api/registrar/enrollments/:id/drop
POST   /api/registrar/enrollments/:id/transfer
GET    /api/registrar/students/:id/enrollments
GET    /api/registrar/sections/:id/roster
POST   /api/registrar/sections/:id/waitlist/promote
```

---

## 6. Student record (registrar 360° view)

### 6.1 Extend `User` with `studentProfile`

```js
studentProfile: {
  studentId,
  admissionNumber,
  programId,
  batch,
  currentYear,
  division,
  dateOfBirth,
  guardianName, guardianPhone,
  address,
  documents: [{ type, fileAssetId, verifiedAt }],
  externalIds: { sis }
}
```

### 6.2 `Program`

```js
{
  code, name,
  level, durationTerms,
  requiredCredits,
  gradingScaleId,
  subAccountId
}
```

### 6.3 Student 360° UI tabs

1. Profile  
2. Enrollments (current + history)  
3. Grades (finalized snapshots, amendments)  
4. Transcripts (issued copies)  
5. Holds  
6. Audit trail  
7. Documents (bonafide, TC requests — phase 2)

---

## 7. Holds & blocks

### 7.1 `StudentHold`

```js
{
  studentId,
  holdType: "financial|disciplinary|document_pending|manual|sis",
  scope: "enrollment|transcript|grades_view|login",
  reason, notes,
  placedBy, placedAt,
  releasedBy, releasedAt,
  expiresAt,
  externalRef
}
```

### 7.2 Enforcement

- Block self-enrollment
- Block transcript download/issue
- Student dashboard banner
- Registrar override with logged reason

### 7.3 ERP integration

`POST /api/integrations/erp/holds` webhook from external ERP.

---

## 8. Grading governance (extend existing)

### 8.1 Institution grading periods

```js
// InstitutionGradingPeriod
{
  academicTermId,
  name, position,
  startDate, endDate, closeDate,
  weight,
  status: "open|closed"
}
```

Course periods inherit from institution template on section creation.

### 8.2 Grade posting policy

```js
{
  postingPolicy: "manual|automatic_on_submit|automatic_on_grading_period_close",
  allowStudentGradeViewBeforePost: false,
  treatUngradedAsZeroAtFinalize: true
}
```

### 8.3 Registrar grade actions

| Action | Who | System behavior |
|--------|-----|-----------------|
| Post grades | Teacher/Registrar | Students see posted grades |
| Close grading period | System/Registrar | Lock instructor edits |
| Finalize term | Registrar | Freeze snapshots per section |
| Amend | Registrar | Amendment record + selective recompute |
| Recompute | Registrar | Dry-run → job → apply with audit |
| Bulk finalize | Registrar | All sections in term → async job |
| Export to SIS | Registrar | CSV/API passback post-finalize |

### 8.4 New APIs

```
POST /api/registrar/terms/:termId/finalize/preview
POST /api/registrar/terms/:termId/finalize
POST /api/registrar/terms/:termId/grading-periods/:id/close
GET  /api/registrar/terms/:termId/grade-status
POST /api/registrar/sections/:id/grades/export-sis
```

### 8.5 Registrar grades dashboard widgets

- Sections not finalized
- Amendments this term
- Policy changes since finalize
- Missing snapshots
- Grade dispute queue (optional)

---

## 9. Transcripts & credentials

### 9.1 Today

- Student unofficial transcript view
- `POST /api/reports/transcript/issue` + `transcriptIssueLog`
- Report card Excel export

### 9.2 Add

#### `TranscriptTemplate`

```js
{
  institutionId,
  name,
  format: "pdf|xlsx",
  layoutConfig,
  locale: "en|hi",
  includes: ["gpa", "credits", "grading_scale_legend", "affiliation"]
}
```

#### `TranscriptRequest`

```js
{
  studentId, term, year,
  type: "unofficial|official|bonafide|migration_tc",
  status: "pending|approved|issued|rejected",
  requestedAt, processedBy, issuedAt,
  copies, deliveryMethod,
  feeRef
}
```

### 9.3 Rules

- Official = only FINALIZED/AMENDED snapshots
- In-progress terms marked “In Progress”
- Repeated course policy: highest / latest / average (configurable)
- Indian GPA: 10-point, 4-point, CBSE CGPA (configurable)
- PDF QR verification: `GET /api/public/transcript/verify/:hash`

### 9.4 Bulk issuance

Term → graduating students → preview → PDF job queue → ZIP or email.

---

## 10. SIS integration

### 10.1 Pipeline

```
Import → Validate → Stage → Diff → Review → Apply → Reconcile → Export
```

### 10.2 Models

**`SisIntegrationConfig`**

```js
{
  provider: "banner|peoplesoft|csv|fedena|mastersoft|custom_rest",
  isSourceOfTruth: true,
  syncDirection: "import|export|bidirectional",
  schedule: "cron|manual",
  fieldMappings: {},
  credentialsRef
}
```

**`SisSyncBatch`** — batch metadata, stats, status  
**`SisSyncRow`** — per-row staging with diff and approve/reject

Expand existing `sisStagingEnrollment.model.js` into this structure.

### 10.3 Standard CSV formats (ship first)

| File | Key columns |
|------|-------------|
| `users.csv` | sis_id, email, first_name, last_name, role, student_id, program |
| `sections.csv` | sis_section_id, course_code, term_code, section, instructor_email, max_enrollment |
| `enrollments.csv` | sis_enrollment_id, sis_section_id, sis_student_id, role, status |
| `grades.csv` (export) | sis_student_id, sis_section_id, final_grade, grade_points, status, snapshot_hash |

### 10.4 Grade passback

After finalize: build from `studentCourseGradeSnapshot` → registrar review → CSV download or REST → `GradePassbackRecord` log.

### 10.5 LTI 1.3 AGS (longer term)

Grade passback via Assignment and Grade Services (scaffold exists in README).

### 10.6 SIS UI screens

1. Integrations config  
2. Import wizard  
3. Staging inbox (diff viewer)  
4. Sync history  
5. Export grades

---

## 11. Registrar Office UI

**Currently missing entirely.** Wire existing APIs first.

### 11.1 Route structure

```
/registrar
  /dashboard
  /terms/:termId/{overview,sections,enrollments,grade-status,finalize}
  /students/:studentId
  /enrollments/bulk
  /transcripts/{issue,requests,templates}
  /grades/{amendments,policy-changes,finalized}
  /sis/{import,export,batches/:id}
  /reports
  /settings/{grading-policy,holds,programs}
```

### 11.2 Key screens

| Screen | Purpose |
|--------|---------|
| Dashboard | KPIs, unfinalized sections, SIS errors, quick actions |
| Term management | CRUD academic terms, deadlines, templates |
| Section browser | Filter, publish, conclude, cross-list, roster export |
| Bulk enrollment | CSV upload, rule check, async apply |
| Grade status | Term matrix: posted %, finalized?, amendments |
| Transcript center | Issue official, request queue, templates |
| SIS center | Import diff, approve rows, export grades |
| Reports | Wire `/api/registrar/reports/*` with filters + CSV |

### 11.3 Role scoping

- `registrar` — full office minus system settings  
- `department_admin` — scoped to `subAccount`  
- `admin` — all

---

## 12. Permissions matrix (target)

| Capability | Student | Teacher | TA | Dept Admin | Registrar | Admin |
|------------|---------|---------|-----|------------|-----------|-------|
| View own enrollments | ✓ | | | | | |
| Self-enroll | ✓ | | | | | |
| Approve enrollment | | ✓* | | ✓ | ✓ | ✓ |
| Bulk enroll | | | | ✓** | ✓ | ✓ |
| View any student | | | | ✓** | ✓ | ✓ |
| Place/release holds | | | | | ✓ | ✓ |
| Manage terms/sections | | | | ✓** | ✓ | ✓ |
| Post grades (own) | | ✓ | draft | ✓ | ✓ | ✓ |
| Edit raw submissions | | ✓ | ✓ | ✓ | **✗** | ✓ |
| Finalize/amend | | | | ✓ | ✓ | ✓ |
| Issue official transcript | | | | | ✓ | ✓ |
| SIS import apply | | | | | ✓ | ✓ |

\* Own courses · \*\* SubAccount scope

### New capabilities to add

```js
MANAGE_TERMS
MANAGE_SECTIONS
MANAGE_ENROLLMENTS
MANAGE_HOLDS
ISSUE_TRANSCRIPT
SIS_IMPORT_APPLY
SIS_EXPORT_GRADES
VIEW_REGISTRAR_DASHBOARD
```

---

## 13. India-specific extensions

### 13.1 Calendar

- Default April–March; Term I/II or Sem I/II  
- School: full-year courses + quarterly grading periods  
- College: semester credits, backlog/ATKT rules (optional program rules)

### 13.2 School reports

| Report | Purpose |
|--------|---------|
| CBSE-style mark sheet | FA/SA, grades, totals |
| Class summary | Pass %, averages |
| UDISE-ready extract | Configurable columns |

### 13.3 College reports

| Report | Purpose |
|--------|---------|
| University exam form | PRN, subjects, credits |
| SGPA/CGPA statement | Semester-wise |
| NAAC evidence pack | Finalize logs, policy audit, issuance history |

### 13.4 Document generation (phase 2)

- Bonafide certificate  
- Transfer certificate request workflow  
- Bilingual transcripts (Hindi + English)

### 13.5 Localization

Use existing `i18next` scaffolding for Registrar Office UI.

---

## 14. Notifications & audit

### 14.1 Notify on

- Enrollment approved/denied/dropped  
- Hold placed/released  
- Grades posted / term finalized  
- Transcript ready  
- SIS import completed with errors  
- Amendment to finalized grades

### 14.2 Audit events

```
registrar.term.created
registrar.enrollment.bulk_applied
registrar.enrollment.dropped
registrar.hold.placed
registrar.section.concluded
registrar.grades.finalized
registrar.grades.amended
registrar.transcript.issued
registrar.sis.batch_applied
registrar.sis.conflict_overridden
```

Shape: `{ actorId, targetType, targetId, before, after, reason, ip, termId }`.

---

## 15. Async jobs (extend BullMQ)

| Job | Trigger | Output |
|-----|---------|--------|
| `bulk_enroll` | CSV | Results CSV |
| `term_finalize` | Registrar | Per-section snapshots |
| `transcript_bulk_issue` | Graduation list | ZIP of PDFs |
| `sis_import_apply` | Approved batch | Sync report |
| `grade_export_sis` | Post-finalize | CSV + passback log |
| `roster_export` | Registrar | Excel |

Reuse `asyncJob.model.js` and `AsyncJobBanner` patterns.

---

## 16. Data migration from current MySl8te

### M1 — Non-breaking additions

1. Create `AcademicTerm`, `Enrollment`  
2. Backfill from `Course.students[]`  
3. Dual-read enrollments  
4. Dual-write on new enrollments

### M2 — Cutover

1. Registrar Office uses `Enrollment` only  
2. Deprecate direct `Course.students` mutations (sync via hook)

### M3 — Section model

1. `CourseOffering` + `CourseSection`  
2. Link existing `Course` as content root

---

## 17. Phased implementation roadmap

> **Superseded for execution tracking by §23 (eight phases).** The original six-phase plan below is kept for historical estimates; many Phase 1–4 foundations already landed via multi-tenant work (`CANVAS_MULTI_TENANT.md`).

### Phase 1 — Registrar Office MVP (8–10 weeks)

| Deliverable | Detail |
|-------------|--------|
| Registrar layout + routing | `/registrar/*` |
| Dashboard | Wire existing `/api/registrar/reports/*` |
| Term registry | `AcademicTerm` CRUD |
| Student search | Name, email, studentId |
| Transcript issue UI | Wire `POST /api/reports/transcript/issue` |
| Term-wide grade status | Expose finalize/amend across courses |
| Permissions | New capabilities + route guards |

**Outcome:** Demo-ready for principals/registrars without overclaiming ERP features.

### Phase 2 — Enrollment of record (10–12 weeks)

- `Enrollment` model + full lifecycle APIs  
- Bulk enroll CSV with preview  
- Manual holds  
- Registrar roster management  
- Backfill migration

### Phase 3 — SIS-grade sync (8–10 weeks)

- CSV import/export (users, sections, enrollments, grades)  
- Staging UI with diff + approve  
- Grade passback post-finalize  
- Scheduled sync + notifications

### Phase 4 — Sections & cross-listing (6–8 weeks)

- `CourseOffering` / `CourseSection`  
- Cross-list shared content  
- Department scoping via `SubAccount`

### Phase 5 — India compliance pack (6–8 weeks)

- CBSE / university report templates  
- Official transcript PDF + QR verify  
- Hindi registrar UI (key screens)  
- Bonafide / TC requests (optional)

### Phase 6 — ERP & LTI (ongoing)

- ERP hold webhooks  
- LTI 1.3 AGS grade passback  
- Custom REST SIS adapters

**Rough total:** 38–48 weeks (team of 2–3 engineers). Phase 1 alone is the highest ROI.

---

## 18. What NOT to build in LMS

Integrate or partner for:

- Fee collection & receipts  
- Admission application processing  
- Hostel / transport  
- Payroll  
- Full timetable optimization  
- Direct government portal submission (export files only)

---

## 19. Recommended file structure

```
models/
  academicTerm.model.js
  courseOffering.model.js
  courseSection.model.js
  enrollment.model.js
  studentHold.model.js
  program.model.js
  sisSyncBatch.model.js
  sisSyncRow.model.js
  transcriptRequest.model.js

services/registrar/
  term.service.js
  enrollment.service.js
  hold.service.js
  transcriptOffice.service.js

services/sis/
  importPipeline.service.js
  exportGrades.service.js
  adapters/{csv,banner,fedena}.js

routes/registrar/
  terms.routes.js
  enrollments.routes.js
  holds.routes.js
  transcripts.routes.js
  sis.routes.js

frontend/src/
  pages/registrar/
  components/registrar/
  services/registrarApi.ts
```

---

## 20. Testing strategy

| Layer | Focus |
|-------|-------|
| Unit | Enrollment rules, holds, term dates |
| Integration | SIS CSV round-trip, finalize → snapshot → transcript |
| E2E | Bulk enroll → grade → finalize → issue transcript |
| Policy | `ferpaAccess`, registrar cannot edit submissions |
| Load | 5k enrollment import, term-wide finalize |
| India fixtures | April–March, 10-point GPA, zero-credit school courses |

Reuse: `tests/grading/transcriptRecompute.e2e.test.js`, `ferpaAccess.policy.test.js`.

---

## 21. Brochure-safe messaging

### Say today

- “Registrar Office for terms, enrollments, grade finalization, transcripts, and CSV SIS import/export”
- “Dedicated registrar role with finalize/amend permissions and amendment audit trails”
- “Compliance-oriented grade snapshots, policy provenance, and public transcript verification”
- “India demo pack: CBSE-style / UDISE / SGPA–CGPA exports, bonafide & TC certificates, ERP hold webhook and LTI AGS scaffolds”

### Do not imply today

- “Full registrar office like Canvas + Banner + complete university ERP”
- “Live Banner / PeopleSoft / Fedena connectors in production”
- “Board-certified CBSE forms or direct UDISE portal submission”
- “Certified LTI 1.3 AGS partner grade sync”

### Roadmap line (optional in sales)

- “R1–R8 registrar phases are documented in `docs/archive/FULL_REGISTRAR_ROADMAP.md` — ask for the current checklist, not a brochure claim.”


---

## 22. Immediate next step

**All eight registrar phases (R1–R8) are complete.** Use §23 checklists for demo claims; keep brochure messaging honest (§21).

---

## 23. Eight-phase execution tracker

**How to use:** Complete one phase at a time. Mark `[x]` when done. Do not skip ahead for demo claims. Progress from multi-tenant work is pre-checked.

| Phase | Name | Status |
|-------|------|--------|
| **R1** | Registrar Office shell, terms & reports | **Done** (2026-07-23) |
| **R2** | Enrollment of record (complete) | **Done** (2026-07-23) |
| **R3** | Student 360° & programs | **Done** (2026-07-23) |
| **R4** | Term-wide grade governance | **Done** (2026-07-23) |
| **R5** | Transcript & credentials office | **Done** (2026-07-23) |
| **R6** | Production SIS pipeline | **Done** (2026-07-23) |
| **R7** | Sections, cross-list UI & dept scope | **Done** (2026-07-23) |
| **R8** | India compliance + ERP / LTI | **Done** (2026-07-23) |

---

### Phase R1 — Registrar Office shell, terms & reports

**Goal:** Demo-ready office for principals/registrars using what already exists, without overclaiming ERP/SIS.

**Depends on:** Multi-tenant Account + AcademicTerm APIs (done).

**Implemented:** 2026-07-23

#### Checklist
- [x] `/registrar` route + role gate (admin/registrar)
- [x] Thin tabs: enrollment summary, term enrollments, holds, SIS (now under `/registrar/operations`)
- [x] `AcademicTerm` model + `/api/academic-structure/terms` CRUD
- [x] Capabilities: `manage_enrollments`, `manage_holds`, `manage_sis`
- [x] Tenant-scoped `/api/registrar/reports/*`
- [x] Registrar layout with nav (`/registrar/dashboard`, terms, students, grades, transcripts, reports, operations, settings)
- [x] Dashboard KPIs (`GET /api/registrar/dashboard` — enrollments, holds, SIS errors, unfinalized courses)
- [x] Term management UI (list/create/edit deadlines + status) wired to academic-structure APIs
- [x] Wire all existing registrar report endpoints with filters + CSV download
- [x] Student search (name, email, ObjectId) → stub student page (`/api/registrar/students/search`, `/students/:id`)
- [x] Transcript issue UI (wire `POST /api/reports/transcript/issue`)
- [x] Term-wide grade status read view (`GET /api/registrar/terms/:termId/grade-status`; full finalize = R4)
- [x] Route guards: `view_registrar_dashboard`; dept_admin allowed into Office (holds/SIS nav limited)
- [x] Tests: `tests/unit/api/registrar.phaseR1.test.js` (+ phase3/4 regression green)
- [x] Fix: `/api/registrar/reports/enrollment-summary` now mounted on reports router (was shadowed)

**Exit:** Principals can open Registrar Office, manage terms, run reports, issue a transcript, see grade status — honestly scoped. ✅

**Missing links noted for later:** Admission/`studentId` profile fields (R3). Term-wide finalize actions (R4). Full 360 tabs (R3).

---

### Phase R2 — Enrollment of record (complete)

**Goal:** Enrollment is the system of record for registrar workflows; rules + bulk UX are trustworthy.

**Depends on:** R1 shell; `Enrollment` dual-write (done).

**Implemented:** 2026-07-23

#### Checklist
- [x] `Enrollment` model + indexes
- [x] Dual-write from teacher enroll / self-enroll / approve / registrar bulk / SIS apply
- [x] APIs: list term enrollments, section roster, bulk enroll, drop, conclude term, sync roster
- [x] Backfill script `backfillEnrollmentsFromCourses.js`
- [x] `rosterRead.service` for teaching UX reads
- [x] Registration holds block self-enroll
- [x] Enrollment rules engine (`services/registrar/enrollmentRules.service.js`)
- [x] `POST /api/registrar/enrollments/preview` before bulk apply
- [x] Transfer section/course A→B + preserve history (`POST .../enrollments/:id/transfer`)
- [x] Waitlist promote API + Operations UI (`POST .../courses/:courseId/waitlist/promote`)
- [x] Bulk enroll CSV upload with preview/results (`csv` / `rows` on bulk + preview)
- [x] Enrollment history UI (term + status filter, transfer/patch forms) in Operations
- [x] `PATCH /api/registrar/enrollments/:id` status/type with audit reason
- [x] Dual-write cutover checklist: registrar writes only via `enrollmentWrite`; teaching UX still dual-writes intentionally (full cutover later)
- [x] Tests: `tests/unit/api/registrar.phaseR2.test.js` (+ phase4 regression green)

**Exit:** Registrar can preview → bulk enroll → drop/transfer with rule violations explained; teaching UX still works. ✅

**Missing links noted for later:** Richer prerequisite grade checks (R3/R5 transcripts). Async BullMQ for huge CSV batches (optional; sync path handles typical loads).

---

### Phase R3 — Student 360° & programs

**Goal:** One registrar view of a student; program/batch context for Indian colleges/schools.

**Depends on:** R1 student search; R2 enrollment history APIs.

**Implemented:** 2026-07-23

#### Checklist
- [x] User model + FERPA-style access helpers for registrar/admin
- [x] Enrollment + hold records queryable per student
- [x] R1 stub evolved into full 360° (`GET /api/registrar/students/:id`)
- [x] Extend `User.studentProfile` (admissionNumber, batch, year, division, guardian, external SIS ids, documents)
- [x] `Program` model + CRUD (`/api/registrar/programs`)
- [x] Student 360° page tabs: Profile, Enrollments, Grades, Transcripts, Holds, Audit, Documents
- [x] Documents tab stub (bonafide/TC via Transcripts Office — R8)
- [x] Expand student APIs: grades snapshots, issued transcripts, audit trail, profile PATCH
- [x] Dept_admin scoped to subtree students only (`studentScope.service`)
- [x] Tests: `tests/unit/api/registrar.phaseR3.test.js` (student 403, admission search, dept scope)

**Exit:** Registrar opens any student and sees enrollments, holds, finalized grades, issued transcripts. ✅

**Missing links noted for later:** Richer document request workflows (R8). Deeper audit event catalogue as R4/R5 emit more registrar.* events.

---

### Phase R4 — Term-wide grade governance

**Goal:** Registrar closes a term, not one course at a time.

**Depends on:** R1 grade-status view; existing per-course lifecycle (done).

**Implemented:** 2026-07-23

#### Checklist
- [x] Per-course grade lifecycle + snapshots + amend/recompute
- [x] Institution + course grading policy + policy audit
- [x] Per-course grading periods
- [x] R1 read-only term grade-status matrix (`GET /api/registrar/terms/:termId/grade-status`)
- [x] `InstitutionGradingPeriod` tied to `AcademicTerm`; inherit to sections (`POST .../grading-periods/inherit`)
- [x] APIs: term finalize preview/apply, close grading period (`termGradeGovernance.service`)
- [x] Bulk finalize async job (`grades.term_finalize`) via BullMQ + `asyncJob` (sync path when `async: false`)
- [x] Grades dashboard widgets (`GET .../grades-dashboard`: unfinalized, amendments, missing snapshots, policy changes)
- [x] Amendment queue + term finalize + periods UI (`RegistrarGradeStatus` tabs)
- [x] Notifications: grades finalized / amended (existing academic notification producers)
- [x] Audit events: `registrar.grades.finalized`, `registrar.grades.amended`
- [x] Tests: `tests/unit/api/registrar.phaseR4.test.js` (+ R1 regression green)
- [x] Fix: distributed lock falls back to memory when Redis client is not writeable (tests/local)

**Exit:** Registrar finalizes all sections in a term with preview + job progress; amendments audited. ✅

**Missing links noted for later:** Sections without `lmsCourseId` cannot finalize. Policy impact preview in Office (existing grading-policy docs).

---

### Phase R5 — Transcript & credentials office

**Goal:** Official transcript operations live in Registrar Office, not only student self-serve + raw API.

**Depends on:** R3 student 360; R4 finalized snapshots for “official”.

**Implemented:** 2026-07-23

#### Checklist
- [x] Student unofficial transcript view
- [x] `POST /api/reports/transcript/issue` + `transcriptIssueLog`
- [x] Transcript hold blocks official issue
- [x] Report card Excel export (existing reports)
- [x] R1 Office UI: issue + history (`/registrar/transcripts`)
- [x] `TranscriptTemplate` (PDF layout, locale, GPA scale legend, repeated-course policy)
- [x] `TranscriptRequest` queue (unofficial/official/bonafide/migration_tc — all fulfillable)
- [x] Official PDF generation + QR verification (`GET /api/public/transcript/verify/:hash`)
- [x] Bulk issuance job (`transcript.bulk_issue`) + preview/apply APIs
- [x] Office screens: Issue / Requests / Templates / Bulk tabs
- [x] Configurable repeated-course + India GPA scales (10-point / 4-point / CBSE CGPA) on templates
- [x] Notifications: `transcript_ready` via institutional notification
- [x] Official issue requires FINALIZED/AMENDED only (`NOT_FINALIZED`)
- [x] Tests: `tests/unit/api/registrar.phaseR5.test.js` (hold, not-finalized, verify hash, bulk)

**Exit:** Registrar issues official PDFs singly or in bulk; public verify link works. ✅

**Missing links noted for later:** ZIP download of bulk PDFs (job returns hashes; per-student PDF on single issue).

---

### Phase R6 — Production SIS pipeline

**Goal:** CSV import/export schools can run without engineering help; grade passback after finalize.

**Depends on:** R2 enrollments; R4 finalize for grade export.

**Implemented:** 2026-07-23

#### Checklist
- [x] `SisStagingEnrollment` + `SisJob` (tenant-scoped)
- [x] Stage → apply for enrollments
- [x] Thin SIS tab (paste CSV / apply batch) + `/registrar/sis` office
- [x] Capability `manage_sis`
- [x] Standard CSVs: `users.csv`, `sections.csv`, `enrollments.csv`, `grades.csv` (export)
- [x] `SisIntegrationConfig` + `SisSyncBatch` / `SisSyncRow` (diff + approve/reject)
- [x] Staging inbox UI with per-row diff + approve/reject (+ conflict override audit)
- [x] Sync history (`GET /sis/jobs`, `/sis/batches`) + `sis_sync_errors` notification
- [x] Grade passback post-finalize (`GradePassbackRecord` + CSV export)
- [x] Scheduled sync field on config (`schedule: manual`; cron deferred)
- [x] Async jobs: `sis.import_apply`, `sis.grade_export`
- [x] Resolve by `studentProfile.externalIds.sis` + `CourseSection.sisSectionId`
- [x] Tests: `tests/unit/api/registrar.phaseR6.test.js` (round-trip, isolation, conflict audit)

**Exit:** Registrar imports users/sections/enrollments with review; exports grades after finalize. ✅

**Missing links noted for later:** Live Banner/PeopleSoft connectors (stubs remain). Cron worker for `schedule` (manual first). Full LTI AGS line-item sync remains scaffold-only (R8).

---

### Phase R7 — Sections, cross-list UI & department scope

**Goal:** Catalog/sections are operable from Registrar Office; departments see only their subtree.

**Depends on:** Academic structure models (done); R1 nav.

**Implemented:** 2026-07-23

**Product decision — cross-list gradebook:** Default **shared gradebook / shared content** (`sharedGradebook: true`). Member sections remount `lmsCourseId` to the primary section’s content course; enrollments remain per `sectionId`. Split gradebooks remain an opt-out in the wizard.

#### Checklist
- [x] `CourseOffering`, `CourseSection`, `CrossListGroup`
- [x] Dual-write on course create; backfill academic structure
- [x] APIs for offerings/sections/cross-lists + catalog `?termId=` / `?accountId=`
- [x] Sub-account catalog filter helpers
- [x] Account admin tree UI (`/admin/accounts`)
- [x] Section browser UI (`/registrar/sections` — filter, publish, conclude, roster CSV)
- [x] Cross-list wizard UI (shared vs per-section gradebook)
- [x] Offering catalog management screens (same page tabs)
- [x] Enforce `enrollmentMethod` end-to-end (self-enroll + rules: open / approval / registrar_only / sis_only)
- [x] Department_admin Office scoping on sections/offerings/term enrollments/grade-status
- [x] Migration M3 polish: structure gap report + backfill API (`/api/registrar/structure/*`)
- [x] Tests: `tests/unit/api/registrar.phaseR7.test.js` (enrollmentMethod, shared cross-list, dept isolation, roster CSV)

**Exit:** Registrar manages sections and cross-lists in UI; dept admins cannot see other faculties. ✅

**Missing links noted for later:** Deeper split-gradebook teaching UX when sections keep distinct courses. Content remount does not merge historical gradebooks.

---

### Phase R8 — India compliance + ERP / LTI integrations

**Goal:** India-ready reports and partner integrations — without building full ERP inside the LMS.

**Depends on:** R4–R5 for grades/transcripts; R6 for export files.

**Implemented:** 2026-07-23

#### Done already
- [x] India calendar / institution mode settings
- [x] i18next scaffolding (app-wide)
- [x] Explicit non-goals: fees, admissions, hostel, payroll (§18)

#### Checklist
- [x] School reports: CBSE-style mark sheet, class summary, UDISE-ready extract (`GET /api/registrar/reports/india/:kind`)
- [x] College reports: university exam form, SGPA/CGPA statement, NAAC evidence pack
- [x] Bonafide + transfer certificate request workflows (queue + fulfill PDF)
- [x] Bilingual transcript templates (Hindi + English) on Transcripts Office + PDF labels
- [x] ERP hold webhook `POST /api/integrations/erp/holds`
- [x] LTI 1.3 AGS grade passback scaffold (readiness + submit-stub; wired from grade export when enabled)
- [x] Custom REST SIS adapter hook (beyond CSV) — dry-run until `CUSTOM_REST_SIS_URL`
- [x] Brochure messaging update (§21) to match shipped phases
- [x] E2E: bulk enroll → grade → finalize → issue transcript → export grades (`tests/unit/api/registrar.phaseR8.test.js`)

**Exit:** India demo pack + integration hooks; sales messaging stays honest.

**Missing links noted for later:** Live Banner/PeopleSoft/Fedena connectors remain stubs. Full LTI 1.3 AGS line-item sync and board-certified CBSE / UDISE portal submit are out of scope. Partner field mappings stay pluggable.

---

### Tracker conventions

1. **One phase at a time** — merge/demo claims only for checked items in the current + prior phases.
2. **Update this §23** when a PR lands (checkbox + one-line note under the item if behavior differs from the doc).
3. **If blocked**, add a bullet under that phase’s “Missing links” rather than silently skipping.
4. **Do not rebuild** multi-tenant Account / Host tenancy here — see `CANVAS_MULTI_TENANT.md`.
5. **Historical §17** (original 6-phase plan) remains for context; **§23 is the active plan**.
