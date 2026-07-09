# Full Canvas-Class Registrar — Implementation Roadmap

**Status:** Planning document (not yet implemented)  
**Owner:** Vedanta LMS platform team  
**Last updated:** 2026-07-09  
**Related:** [CANVAS_PARITY_AUDIT.md](../grading/CANVAS_PARITY_AUDIT.md), [POLICY_CHANGE_UX.md](../grading/POLICY_CHANGE_UX.md), [security.md](../security.md)

---

## Purpose

This document is the **source of truth for a future full Canvas-class registrar capability** in Vedanta LMS. Use it when prioritising features, writing PRDs, or scoping work for schools and colleges in the Indian market.

It records:

1. What “Canvas-like registrar” actually means (and what it does **not** mean)
2. What Vedanta already ships today
3. Every subsystem, data model, API, UI screen, workflow, and migration step needed to close the gap
4. A phased rollout plan with realistic estimates

---

## 0. Scope — what “Canvas-like registrar” actually means

Canvas does **not** ship a complete university ERP registrar. In production, “registrar” usually means:

| Layer | Typical owner | Vedanta goal |
|-------|---------------|--------------|
| Teaching & learning | LMS | **Strong today** |
| Grade governance & official records | LMS + Registrar role | **Partial today** |
| Enrollment of record | SIS or LMS | **Mostly missing** |
| Fees, admissions, timetables | ERP | **Integrate, do not rebuild** |
| Official transcripts & compliance exports | Registrar office | **Partial (API + student view)** |

**Target definition for Vedanta:** everything Canvas Admin + SIS Import/Export provides for academic records, plus a dedicated **Registrar Office UI**, plus India-specific reporting hooks — **not** a replacement for Fedena, MasterSoft, Banner, or full college ERP.

---

## 1. Current state inventory

### 1.1 Built today

| Area | Status | Location |
|------|--------|----------|
| `registrar` role + capabilities | Done | `middleware/academicPermissions.js` |
| Grade lifecycle (DRAFT → POSTED → FINALIZED → AMENDED) | Done | `models/courseGradeLifecycle.model.js`, `CourseGradeLifecyclePanel` |
| Frozen grade snapshots | Done | `models/studentCourseGradeSnapshot.model.js` |
| Institution + course grading policy | Done | `institutionGradingPolicy`, `courseGradingPolicy` |
| Policy audit + impact preview | Done | `gradingPolicyAudit`, `docs/grading/POLICY_CHANGE_UX.md` |
| Course grading periods | Done | `models/courseGradingPeriod.model.js`, `GradingPeriodsModal` |
| Transcript view (student) | Done | `frontend/src/pages/Transcript.tsx`, `/api/reports/transcript` |
| Official transcript issuance (API) | Done | `services/transcriptIssuance.service.js`, `transcriptIssueLog.model.js` |
| Registrar reports (API only) | Done | `/api/registrar/reports/*` |
| SIS enrollment staging stubs | Stub | `services/sis/`, `sisStagingEnrollment.model.js` |
| India calendar / institution mode | Done | `services/academicCalendar.service.js`, `systemSettings` |
| Enrollment (teacher-led) | Partial | Catalog, QR, join codes, waitlist, instructor approval on `Course` |

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

**Important separation (Canvas-aligned):** registrars **cannot** edit raw student submissions — they govern official records, not day-to-day grading (`canEditRawSubmission` returns false for `registrar`).

### 1.3 Missing for “full registrar”

- No **Registrar Office** frontend (reports are API-only)
- No **institutional term** entity (only per-course `semester`)
- No **course sections** or cross-listing
- No **enrollment of record** separate from `Course.students[]`
- No **SIS import/export jobs** with reconciliation UI
- No **grade passback** to external SIS
- No **holds** blocking enrollment or transcript
- No **student program/degree** tracking
- No **bulk registrar-led enrollment** workflows

### 1.4 Canvas parity checklist (honest)

| Canvas / industry capability | Vedanta today | After full build |
|------------------------------|---------------|------------------|
| Account terms | Per-course semester | Institution terms |
| SIS CSV import | Staging stub | Full pipeline |
| Grade export to SIS | No | Yes |
| Grading period close | Per-course | Institution + course |
| Finalize grades | Per-course | Per-course + bulk term |
| Registrar role | API + course UI | Full office UI |
| Cross-listed sections | No | Yes |
| Enrollment of record | `Course.students[]` | `Enrollment` collection |
| Official transcript | API | UI + PDF + bulk |
| Holds | No | Yes |
| SubAccount-scoped admin | Partial (`department_admin`) | Full tree |

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

## 16. Data migration from current Vedanta

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

- “Registrar-grade academic workflows — grade finalization, transcript issuance, amendment audit trails, institutional grading policy”
- “Dedicated registrar role with finalize/amend permissions”
- “Compliance-oriented grade snapshots and policy provenance”

### Do not imply today

- “Full registrar office like Canvas + Banner”
- “Complete university ERP”
- “SIS sync live in production”
- “Bulk registrar enrollment UI”

### Roadmap line (optional in sales)

- “Registrar Office UI, SIS import/export, and enrollment-of-record on the roadmap — see `docs/registrar/FULL_REGISTRAR_ROADMAP.md`”

---

## 22. Immediate next step

Start **Phase 1** only:

1. Registrar dashboard (existing APIs)  
2. Academic term registry  
3. Transcript issuance UI  
4. Term-wide grade status view  
5. Student search + enrollment history (read-only from current data)

This is honest for school/college demos and matches current product reality.
