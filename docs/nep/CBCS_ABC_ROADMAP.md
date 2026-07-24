# NEP 2020 — CBCS, ABC & Multidisciplinary Tracking Roadmap

**Status:** Planning document (foundations partially shipped)  
**Owner:** MySl8te platform team  
**Last updated:** 2026-07-10  
**Related:** [FULL_REGISTRAR_ROADMAP.md](../archive/FULL_REGISTRAR_ROADMAP.md) (archived), [CANVAS_PARITY_AUDIT.md](../archive/CANVAS_PARITY_AUDIT.md) (archived)

---

## Purpose

This document is the **source of truth for NEP 2020–aligned academic features** in MySl8te:

1. **Choice Based Credit System (CBCS)**
2. **Academic Bank of Credits (ABC)** integration
3. **Multidisciplinary degree tracking**

It records what ships today, what does **not**, and the full implementation plan to close the gap — so marketing, sales, and engineering stay aligned.

---

## 0. Honest summary (read this first)

| Pillar | Fully supported today? | Approx. completeness |
|--------|------------------------|----------------------|
| **CBCS** | **Partial** — foundations only | ~30% |
| **ABC integration** | **No** | 0% |
| **Multidisciplinary tracking** | **No** | 0% |
| **NEP-aligned foundations** (credits, India calendar, SGPA/CGPA) | **Yes** — partial | ~30% |

**Do not claim in brochures or sales:** “Full support for CBCS, ABC integration, and multidisciplinary tracking.”

**Safe to claim:** “Aligned with NEP 2020 direction: credit-based courses, Indian academic calendar, semester transcripts with SGPA/CGPA, flexible catalog enrollment, and institutional grading with audit trails.”

---

## 1. What NEP 2020 requires (reference)

### 1.1 Choice Based Credit System (CBCS)

Universities under NEP typically need:

- Programs/degrees with defined credit requirements (e.g. 120 credits for UG)
- Course categories: **major core**, **major elective**, **minor**, **open elective**, **ability enhancement**, **skill enhancement**, **value-added**
- Student **choice** within pools each semester
- Credit caps per semester (e.g. 18–26 credits)
- **Degree audit** — “you need 6 more open-elective credits to graduate”
- Enforced prerequisites at registration
- SGPA per semester, CGPA cumulative
- Grade cards and transcripts in university format
- Backlog / reappear / improvement rules (institution-specific)

### 1.2 Academic Bank of Credits (ABC)

India’s national digital credit bank ([abc.gov.in](https://abc.gov.in)) enables:

- Student **APAAR ID** / ABC ID linkage
- **Deposit** earned credits after course completion at a registered HEI
- **Withdraw** credits for transfer to another institution
- **Credit mobility** across colleges and universities
- DigiLocker integration for academic records
- Standardized credit ledger format for national registry

ABC is **separate from LMS** — MySl8te must integrate via API/export, not replace ABC.

### 1.3 Multidisciplinary education (NEP holistic model)

NEP promotes:

- Credits across **multiple disciplines** (e.g. science + humanities + vocational)
- **Major / minor** or multidisciplinary degree pathways
- “Holistic” credit categories (e.g. min credits outside home faculty)
- Tracking progress toward **multidisciplinary** graduation requirements
- Flexible entry/exit with accumulated credits (linked to ABC)

---

## 2. Current state inventory

### 2.1 Built today (NEP foundations)

| Feature | Status | Location |
|---------|--------|----------|
| Credit hours per course | Done | `models/course.model.js` → `catalog.creditHours` |
| College default 3 credits, school 0 | Done | `services/academicCalendar.service.js`, `systemSettings.academic` |
| India academic calendar (April–March) | Done | `shared/academic/terms.cjs`, `calendarStyle: 'india'` |
| Semester / term on courses | Done | `course.semester`, `academicYearLabel` |
| India term presets | Done | `india_terms` in `CALENDAR_PRESETS` |
| Student transcript with credits | Done | `controllers/reports.controller.js`, `Transcript.tsx` |
| SGPA / CGPA (Indian 10-point scale) | Done | `frontend/src/utils/transcriptGpa.ts` |
| US semester GPA (4.0) | Done | Same file |
| Public course catalog | Done | `Catalog.tsx`, `/api/catalog` |
| Self-enrollment + waitlist | Done | `course.routes.js`, catalog flows |
| Prerequisites (display only) | Done | `catalog.prerequisites[]` — text, not enforced |
| Course subject / tags | Done | `catalog.subject`, `catalog.tags` |
| Official transcript issuance | Done | `transcriptIssuance.service.js` (API) |
| Grade finalization + frozen snapshots | Done | Grade lifecycle (registrar workflows) |
| Institution mode school/college/mixed | Done | `systemSettings.academic.institutionMode` |

### 2.2 Not built (CBCS gaps)

| Feature | Status |
|---------|--------|
| `Program` / degree model | Missing |
| Course category (core/elective/open/skill) | Missing |
| Degree audit engine | Missing |
| Credit rules per program (min/max per category) | Missing |
| Enforced prerequisites at enrollment | Missing |
| Semester credit cap enforcement | Missing |
| Major / minor declaration | Missing |
| Backlog / ATKT / reappear rules | Missing |
| University exam-form export (CBCS format) | Missing |
| Registration windows (add/drop by credit rules) | Missing |

### 2.3 Not built (ABC gaps)

| Feature | Status |
|---------|--------|
| Student APAAR / ABC ID | Missing |
| ABC API client | Missing |
| Credit deposit on course finalize | Missing |
| Credit withdrawal / transfer | Missing |
| ABC-compliant export format | Missing |
| DigiLocker linkage | Missing |
| Institution ABC registration config | Missing |

### 2.4 Not built (multidisciplinary gaps)

| Feature | Status |
|---------|--------|
| Discipline / faculty on courses (structured) | Missing (only free-text subject/tags) |
| Credits-by-discipline dashboard | Missing |
| Multidisciplinary pathway templates | Missing |
| “Credits outside major” rules | Missing |
| Holistic education category buckets (NEP) | Missing |
| Cross-faculty degree progress view | Missing |

### 2.5 Known limitations in current SGPA/CGPA

- `calculateCGPA` and `calculateSGPA` use the same weighted formula (`transcriptGpa.ts`) — CGPA is applied to the **course list passed in**, not automatically across all semesters unless the API returns all terms.
- No separate handling for **non-credit** or **audit** courses in GPA (CBCS often excludes these).
- No grade-point mapping per institution override (hardcoded Indian 10-point map).

---

## 3. Target architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Student / Faculty / Registrar UI                           │
│  Catalog · Degree Audit · ABC Status · Multidisciplinary    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  NEP Services Layer                                         │
│  ProgramService · DegreeAuditService · CreditLedgerService  │
│  AbcIntegrationService · MultidisciplinaryProgressService   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Existing MySl8te Core                                      │
│  Courses · Enrollments · Grades · Transcripts · Lifecycle     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
     ABC Portal (abc.gov.in)    Institution ERP / SIS
```

Depends on [FULL_REGISTRAR_ROADMAP.md](../archive/FULL_REGISTRAR_ROADMAP.md) (archived) for:
- `Enrollment` of record
- `Program` model (shared)
- `AcademicTerm` registry
- Registrar Office UI

---

## 4. Data models

### 4.1 `Program` (degree / stream)

```js
{
  institutionId,
  code,                          // "BSC-CS", "BA-MULTI"
  name,
  level: "ug|pg|diploma|certificate",
  totalCreditsRequired: 120,
  minSemesters: 6,
  maxSemesters: 8,
  multidisciplinary: true,       // NEP holistic pathway flag
  creditBuckets: [
    {
      category: "major_core|major_elective|minor|open_elective|skill|value_added|ability_enhancement",
      minCredits: 60,
      maxCredits: 72,
      disciplineScope: "home|any|listed",  // for multidisciplinary rules
      allowedDisciplineIds: []
    }
  ],
  gradingScaleId,
  abcProgramCode,                // optional ABC registry code
  isActive
}
```

### 4.2 `StudentProgram` (enrollment in a degree)

```js
{
  studentId,
  programId,
  status: "active|completed|withdrawn|exit_with_certificate",
  declaredAt,
  expectedGraduationTerm,
  majorDisciplineId,
  minorDisciplineId,
  multidisciplinaryPathwayId,
  accumulatedCredits: 0,
  cgpa
}
```

### 4.3 `Discipline` (faculty / subject area)

```js
{
  institutionId,
  code,                          // "CS", "ENG", "COMM"
  name,
  facultyName,                   // "Faculty of Science"
  parentDisciplineId
}
```

### 4.4 Extend `Course` / `CourseOffering`

```js
catalog: {
  creditHours,
  subject,
  disciplineId,                  // structured link
  courseCategory: "major_core|major_elective|open_elective|skill|value_added|ability_enhancement|audit",
  abcCourseCode,                 // national course identifier if registered
  isCreditCourse: true,
  maxCreditsRepeatable: 1,
  prerequisiteCourseIds: []       // enforced IDs, not just strings
}
```

### 4.5 `CreditLedgerEntry` (internal + ABC sync)

```js
{
  studentId,
  courseId,
  enrollmentId,
  programId,
  term, year,
  creditsEarned,
  gradePoints,
  letterGrade,
  snapshotHash,                  // from studentCourseGradeSnapshot
  status: "earned|pending|deposited_abc|transferred_out",
  abcTransactionId,
  depositedAt,
  sourceInstitutionId,
  externalAbcRef
}
```

### 4.6 Extend `User.studentProfile`

```js
studentProfile: {
  studentId,                     // roll / PRN
  apaarId,                       // ABC / APAAR
  abcId,
  abcLinkedAt,
  digilockerId
}
```

### 4.7 `MultidisciplinaryPathway`

```js
{
  programId,
  name,                          // "Engineering + Humanities"
  rules: [
    { disciplineId: "ENG", minCredits: 12 },
    { disciplineId: "CS", minCredits: 80 },
    { category: "open_elective", minCredits: 20, outsideHomeDiscipline: true }
  ]
}
```

### 4.8 `DegreeAuditResult` (computed, cacheable)

```js
{
  studentId,
  programId,
  asOfDate,
  totalEarned,
  totalRequired,
  cgpa,
  buckets: [{ category, earned, required, deficit }],
  disciplines: [{ disciplineId, earned, required }],
  eligibleToGraduate: false,
  deficiencies: ["Need 6 open-elective credits", "Minor incomplete"],
  abcCreditsDeposited: 42
}
```

---

## 5. CBCS — implementation detail

### 5.1 Course registration with CBCS rules

**Workflow:**

1. Student opens **Degree Audit** → sees buckets and deficits
2. Opens **Course Catalog** filtered by eligible electives for their program
3. Selects courses → system checks:
   - Prerequisites met (enforced)
   - Semester credit cap not exceeded
   - Bucket still has room (e.g. open elective slot available)
   - No schedule conflict (phase 2 — timetable integration)
4. Registrar or auto-approve → `Enrollment` created

**API:**

```
GET  /api/programs/:id
GET  /api/students/:id/program
GET  /api/students/:id/degree-audit
GET  /api/catalog?programId=&category=&discipline=
POST /api/students/:id/course-request   (CBCS registration)
POST /api/registrar/course-requests/:id/approve
```

### 5.2 Degree audit engine

```js
degreeAuditService.compute(studentId, programId) {
  // 1. Load finalized grade snapshots + active enrollments
  // 2. Map each course to category + discipline + credits
  // 3. Sum credits per bucket and per discipline
  // 4. Compare to program.creditBuckets rules
  // 5. Compute CGPA from ledger (exclude audit/F grades per policy)
  // 6. Return deficiencies + graduation eligibility
}
```

### 5.3 SGPA / CGPA improvements

- **SGPA:** credits in single term only
- **CGPA:** all finalized terms, weighted — fix `transcriptGpa.ts` to accept term grouping
- Institution-configurable grade-point scale (override `getIndianGradePoints`)
- Exclude `audit` and `pass/fail` courses from GPA per CBCS policy flag

### 5.4 CBCS reports (India college formats)

| Report | Fields |
|--------|--------|
| Semester grade card | PRN, courses, credits, grade points, SGPA |
| Cumulative grade card | All semesters, CGPA |
| University exam form | Course codes, credits, category |
| CBCS transcript | Affiliation body, program, buckets summary |

### 5.5 UI screens

```
/programs                    — admin: define degrees + buckets
/programs/:id/audit-rules
/students/:id/degree-audit   — student + advisor view
/catalog?cbcs=true           — filtered elective pools
/registrar/cbcs-registration — approval queue
```

---

## 6. ABC — implementation detail

### 6.1 Integration model

MySl8te is **not** the Academic Bank — it is a **credit source** that deposits to ABC when:

- Course grades are **FINALIZED**
- Institution is registered on ABC portal
- Student has linked APAAR ID

```
Finalize grades → CreditLedgerEntry (earned)
                → AbcIntegrationService.deposit(entry)
                → ABC API → transaction ID stored
```

### 6.2 `AbcIntegrationConfig`

```js
{
  institutionId,
  abcInstitutionCode,
  apiBaseUrl,                    // from ABC developer docs
  clientId, clientSecretRef,
  webhookSecret,
  autoDepositOnFinalize: true,
  sandboxMode: true
}
```

### 6.3 ABC service methods

```js
abcService.linkStudent(apaarId, studentId)
abcService.depositCredits({ studentId, courseId, credits, grade, term, snapshotHash })
abcService.withdrawCredits({ studentId, credits, targetInstitution })
abcService.getStudentBalance(studentId)
abcService.syncStatus(transactionId)
abcService.exportLedgerCsv(studentId)   // manual fallback
```

### 6.4 Student UI

- **Link APAAR ID** (one-time, validated format)
- **ABC Credit Wallet** — earned, deposited, pending, transferred
- **Deposit history** with ABC transaction IDs

### 6.5 Registrar UI

- ABC sync dashboard (failed deposits, retries)
- Bulk deposit after term finalize
- Reconciliation report vs ABC portal

### 6.6 Compliance notes

- ABC API access requires **institution registration** with ABC — MySl8te cannot enable this unilaterally
- Store only APAAR ID — not Aadhaar number
- Audit every deposit/withdrawal
- Use finalized snapshot hash as integrity proof

### 6.7 Phase 0 (before live API)

- Export CSV in ABC-specified format for **manual upload**
- Student APAAR ID field + validation
- Internal `CreditLedgerEntry` as source of truth

---

## 7. Multidisciplinary tracking — implementation detail

### 7.1 Rules engine extension

Extend `degreeAuditService` with:

```js
multidisciplinaryProgressService.compute(studentId, programId) {
  // Credits by disciplineId
  // Credits outside home discipline (major)
  // Holistic buckets: vocational, humanities, science, etc.
  // Pathway template match (multidisciplinaryPathwayId)
}
```

### 7.2 NEP holistic categories (configurable per institution)

| Category | Example rule |
|----------|--------------|
| Home major | ≥ 60 credits in declared major discipline |
| Outside major | ≥ 20 credits in other disciplines |
| Skill / vocational | ≥ 8 credits |
| Value-added | ≥ 4 credits |
| Open elective | ≥ 12 credits, any discipline |

### 7.3 Student dashboard widgets

- **Credit sunburst** or table: credits by faculty/discipline
- **Pathway progress:** “Multidisciplinary BA — 78/120 credits”
- **Recommendations:** “Take 1 more humanities course to meet holistic requirement”

### 7.4 Catalog enhancements

- Filter: “Open electives outside my major”
- Badge: “Counts toward multidisciplinary requirement”
- Discipline color-coding on course cards

### 7.5 Reports

- Multidisciplinary progress report (advisor)
- NAAC evidence: discipline diversity per graduating batch
- ABC + multidisciplinary summary for exit with certificate

---

## 8. API surface (consolidated)

```
# Programs & CBCS
GET    /api/programs
POST   /api/programs
GET    /api/programs/:id
PUT    /api/programs/:id
GET    /api/students/:id/program
POST   /api/students/:id/program/declare
GET    /api/students/:id/degree-audit
GET    /api/students/:id/credit-ledger
GET    /api/students/:id/multidisciplinary-progress

# CBCS registration
POST   /api/course-requests
GET    /api/course-requests?status=pending
PATCH  /api/course-requests/:id

# Disciplines
GET    /api/disciplines
POST   /api/disciplines

# ABC
POST   /api/abc/link
GET    /api/abc/wallet
POST   /api/abc/deposit/:ledgerEntryId
POST   /api/abc/retry-failed
GET    /api/abc/export/:studentId
GET    /api/admin/abc/config
PUT    /api/admin/abc/config

# Reports
GET    /api/reports/cbcs/grade-card/:studentId
GET    /api/reports/cbcs/exam-form/:termId
GET    /api/reports/multidisciplinary/:programId
```

---

## 9. Permissions

| Action | Student | Teacher | Advisor | Registrar | Admin |
|--------|---------|---------|---------|-----------|-------|
| View own degree audit | ✓ | | ✓* | ✓ | ✓ |
| Declare major/minor | ✓ | | ✓* | ✓ | ✓ |
| CBCS course request | ✓ | | | | |
| Approve CBCS request | | | ✓* | ✓ | ✓ |
| Manage programs | | | | ✓ | ✓ |
| ABC link (own) | ✓ | | | | |
| ABC deposit/retry | | | | ✓ | ✓ |
| ABC config | | | | | ✓ |

\* Advisor = `department_admin` scoped to discipline

New capabilities:

```js
VIEW_DEGREE_AUDIT
MANAGE_PROGRAMS
APPROVE_CBCS_REGISTRATION
MANAGE_ABC_INTEGRATION
DEPOSIT_ABC_CREDITS
```

---

## 10. Phased rollout

### Phase 0 — Honest foundations (shipped / polish) — 2–3 weeks

| Task | Detail |
|------|--------|
| Fix CGPA across semesters | Group by term in transcript API |
| Institution grade-point scale config | Override hardcoded map |
| Document current limits | This file + brochure wording |
| Credit course flag | `isCreditCourse` on catalog |

### Phase 1 — CBCS core — 10–12 weeks

| Task | Detail |
|------|--------|
| `Program`, `Discipline`, `StudentProgram` models | CRUD + admin UI |
| `courseCategory` on courses | Filter catalog |
| Degree audit engine | API + student UI |
| Enforced prerequisites | Enrollment rules |
| Semester credit cap | Registration validation |
| CBCS grade card export | PDF/Excel |

**Depends on:** Registrar Phase 2 (`Enrollment` of record) from registrar roadmap

### Phase 2 — Multidisciplinary — 6–8 weeks

| Task | Detail |
|------|--------|
| `MultidisciplinaryPathway` templates | Admin UI |
| Discipline credit tracking | Dashboard |
| Outside-major rules | Audit engine extension |
| Catalog filters | “Eligible for my pathway” |

### Phase 3 — ABC preparation — 6–8 weeks

| Task | Detail |
|------|--------|
| APAAR ID on student profile | Link UI |
| `CreditLedgerEntry` | Internal ledger |
| CSV export (ABC manual format) | Registrar download |
| Deposit on finalize (internal status) | No live API yet |

### Phase 4 — ABC live integration — 8–12 weeks

| Task | Detail |
|------|-------- |
| `AbcIntegrationConfig` | Sandbox + production |
| API client (deposit/withdraw/balance) | Per ABC docs |
| Student ABC wallet UI | |
| Failed sync retry + alerts | |
| DigiLocker (if API available) | Optional |

### Phase 5 — Advanced CBCS — ongoing

| Task | Detail |
|------|--------|
| Backlog / ATKT rules | Institution config |
| Exit with certificate (40/80/120 credits) | ABC + audit linked |
| Timetable conflict check | ERP integration |
| Twinning / credit transfer from other HEIs | ABC withdraw/deposit |

**Rough total:** 32–43 weeks after registrar enrollment foundation.

---

## 11. Dependencies on other roadmaps

| Dependency | Why |
|------------|-----|
| [FULL_REGISTRAR_ROADMAP.md](../archive/FULL_REGISTRAR_ROADMAP.md) Phase 2 (archived) | `Enrollment` of record for CBCS registration |
| Registrar `AcademicTerm` | Semester credit caps |
| Registrar `Program` (shared) | Same model as Section 4.1 |
| Finalized grade snapshots | ABC deposit trigger |
| SIS export | University exam forms |

---

## 12. Testing strategy

| Layer | Tests |
|-------|-------|
| Unit | Degree audit buckets, credit caps, prerequisite enforcement |
| Integration | Finalize → ledger → ABC deposit mock |
| E2E | Student declares program → requests elective → audit updates |
| Policy | ABC ID privacy, no Aadhaar storage |
| Fixtures | B.Sc CS 120-credit program, India 10-point scale, April–March terms |

---

## 13. Brochure-safe messaging

### Say today

- “Aligned with NEP 2020 **direction**”
- “Credit-based courses with configurable credit hours”
- “India academic calendar (April–March) and semester structure”
- “Student transcripts with SGPA/CGPA on Indian 10-point scale”
- “Flexible course catalog and enrollment”
- “Institutional grading with audit-ready finalization”

### Do not say today

- “Full CBCS support”
- “ABC integration”
- “Multidisciplinary tracking”
- “NEP 2020 compliant” (implies complete)

### Roadmap line (optional in sales conversations)

- “CBCS degree audit, ABC credit deposit, and multidisciplinary pathways are on our NEP roadmap — see `docs/nep/CBCS_ABC_ROADMAP.md`.”

---

## 14. File structure (target)

```
models/
  program.model.js
  studentProgram.model.js
  discipline.model.js
  creditLedgerEntry.model.js
  multidisciplinaryPathway.model.js
  abcIntegrationConfig.model.js

services/nep/
  degreeAudit.service.js
  cbcsRegistration.service.js
  creditLedger.service.js
  multidisciplinaryProgress.service.js
  abcIntegration.service.js

services/nep/reports/
  cbcsGradeCard.service.js
  examFormExport.service.js

routes/nep/
  programs.routes.js
  degreeAudit.routes.js
  abc.routes.js

frontend/src/
  pages/degree-audit/
  pages/abc-wallet/
  components/nep/
```

---

## 15. Immediate next step

**Phase 0 polish** (no marketing overclaim):

1. Fix CGPA to aggregate across all finalized semesters in transcript API
2. Add `docs/nep/` (this file) and update brochure canvas
3. Defer CBCS Phase 1 until registrar `Enrollment` model is in progress

---

## 16. Parity checklist

| NEP / UGC expectation | MySl8te today | After full roadmap |
|-----------------------|---------------|-------------------|
| Credit hours on courses | Yes | Yes |
| SGPA / CGPA | Partial | Yes (fixed) |
| CBCS course categories | No | Yes |
| Degree audit | No | Yes |
| Student course choice pools | Partial (catalog) | Yes (rules-based) |
| ABC / APAAR linkage | No | Yes |
| Credit deposit to ABC | No | Yes |
| Multidisciplinary progress | No | Yes |
| Exit with certificate | No | Yes (with ABC) |
| Holistic credit buckets | No | Yes |
