# Canvas Grading Parity Audit — MySl8te

**Status:** Phase 8 complete (performance dedup)  
**Engine version:** `1.2.0` (unchanged — infrastructure only)  
**Canonical calculators:** `calculateCurrentGradeWithWeightedGroups`, `calculateProjectedFinalGradeWithWeightedGroups`  
**Backwards-compatible alias:** `calculateFinalGradeWithWeightedGroups` → current mode  
**Audit date:** 2026-07-05  
**Owner:** Grading platform team

---

## Purpose

This document records every known difference between MySl8te grading behavior and
Instructure Canvas grading semantics, classifies each gap, and defines the incremental
migration plan. It is the source of truth before any calculator logic changes.

**Canvas references (Instructure documentation):**

- [How do assignment groups affect the Gradebook?](https://community.canvaslms.com/t5/Instructor-Guide/How-do-assignment-groups-and-group-weights-affect-the/ta-p/764)
- [What are the different types of grades?](https://community.canvaslms.com/t5/Student-Guide/What-are-the-different-types-of-grades-in-Canvas/ta-p/467)
- [How do I treat ungraded assignments as zero?](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-treat-ungraded-assignments-as-zero-in-the-Gradebook/ta-p/1029)

---

## Architecture preserved (do not change)

These capabilities are **superior to or equal to Canvas** and must remain intact:

| Capability | Location | Notes |
|------------|----------|-------|
| Policy snapshots | `shared/grading/policySnapshot.cjs` | SHA-256 hash, stable JSON |
| Engine versioning | `shared/grading/gradingEngineVersion.cjs` | Semver tracking |
| Submission policy stamps | `services/gradingPolicySnapshot.service.js` | Provenance at grade-save time |
| Frozen transcript snapshots | `models/studentCourseGradeSnapshot.model.js` | Immutable official grade |
| Backend/frontend parity | `tests/grading/backendFrontend.parity.test.js` | Shared `@lms-shared/grading` |
| Shared grading package | `shared/grading/` | Single canonical engine (CJS + ESM) |
| Course lifecycle | `models/courseGradeLifecycle.model.js` | FINALIZED/AMENDED guards |

---

## Grade mode definitions

| Mode | Canvas name | MySl8te today | Target |
|------|-------------|---------------|--------|
| **Current** | Current Grade | `calculateCurrentGradeWithWeightedGroups` (alias: `calculateFinalGradeWithWeightedGroups`) | `gradeMode: 'current'` |
| **Final / Projected** | Final Grade | `calculateProjectedFinalGradeWithWeightedGroups` | `gradeMode: 'final'` |

### Current grade (Canvas-aligned — mostly implemented)

1. Only **active** assignment groups contribute.
2. A group is active when it has at least one assignment that contributes to the grade.
3. Inactive group weights are **redistributed proportionally** among active groups.
4. Future-due ungraded assignments do **not** penalize the student.
5. Submitted-but-ungraded assignments are **excluded** from the denominator.
6. A graded score of **0** is valid and activates the group.

### Final / projected grade (Canvas-aligned — Phase 3 complete)

1. All **published** assignments included in denominator.
2. Uses **full nominal group weights** (no redistribution).
3. Missing assignment policy applied (`count_as_zero` → 0 earned).
4. Ungraded submitted past-due items treated as 0 when policy requires.

---

## Gap matrix

| ID | Area | LMS today | Canvas | Classification | Phase | Risk |
|----|------|-----------|--------|----------------|-------|------|
| G-01 | Course grade modes | `calculateCurrentGradeWithWeightedGroups` + `calculateProjectedFinalGradeWithWeightedGroups` | Current + Final | **Done (Phase 3)** | 3 | High |
| G-02 | Group activation API | `isAssignmentGroupActive()` in `shared/grading/groupActivation.cjs` | Explicit active group | **Done (Phase 2)** | 2 | Low |
| G-03 | Weight redistribution | Proportional among active groups | Same (Current Grade) | **Keep** | — | None |
| G-04 | Future assignments | Excluded from current | Same | **Keep** | — | None |
| G-05 | Submitted ungraded | Excluded from current; 0 in final | Excluded current; 0 in final | **Done (Phase 3)** | 3 | Medium |
| G-06 | Missing (default) | `count_as_zero` in current + final | Same for current; all missing in final | **Done (Phase 3)** | 3 | Medium |
| G-07 | Missing (`exclude_until_graded`) | Excludes from denominator | Similar | **Keep** | — | Low |
| G-08 | Graded zero | Activates group, 0% earned | Same | **Keep** | — | None |
| G-09 | Excused | Excluded entirely | Same | **Keep** | — | None |
| G-10 | Unpublished | Ignored | Same | **Keep** | — | None |
| G-11 | Drop lowest | Lowest **graded** scores by percent | Similar | **Keep** | — | Low |
| G-12 | Late penalty | `applyLatePenaltyToEarned` | Similar | **Keep** | — | Low |
| G-13 | Category caps | `getCappedWeight` | Similar | **Keep** | — | Low |
| G-14 | Ungrouped assignments | "Other" weight bucket | Similar | **Keep** | — | Low |
| G-15 | Extra credit | EC assignments/groups | EC assignments/groups | **Done (Phase 5)** | 5 | High |
| G-16 | Grade status model | `shared/grading/gradeStatus.cjs` — `resolveSubmissionGradeStatus()` | Centralized states | **Done (Phase 4)** | 4 | Medium |
| G-17 | Student hidden grades | Excluded from student totals | Configurable in Canvas | **Document (Phase 6)** | 6 | Low |
| G-18 | Transcript "final" | Frozen immutable snapshot | Official ≠ projected final | **Keep** | — | None |
| G-19 | Auto-grade in totals | Via `submission.grade` after release filter | Similar | **Keep** | — | Low |
| G-20 | Dual API totals | `currentPercent` + `finalPercent` + `totalPercent` alias | Current + Final displayed | **Done (Phase 6)** | 6 | Medium |

---

## Detailed gap analysis

### G-01 — No separate Final / Projected Grade mode

**Today:** `calculateFinalGradeWithWeightedGroups` behaves like Canvas **Current Grade**.
There is no mode that includes all published assignments at full nominal weights.

**Example (fixture `cp23`):**

- Homework 50%: 100/100 graded
- Exam 50%: future due, not submitted
- **Current LMS:** 100% (exam group inactive, weight redistributed)
- **Canvas Final Grade:** 50% (exam counts as 0 at full weight)

**Decision:** Implemented in Phase 3 as `calculateProjectedFinalGradeWithWeightedGroups`.  
Default mode remains `current` via `calculateFinalGradeWithWeightedGroups` alias so existing `totalPercent` values are unchanged.

---

### G-02 — Group activation not centralized

**Today:** `applyAssignmentToGroupTotals` sets `hasGradedAssignments`.  
`calculateFinalGradeWithWeightedGroups` splits `groupsWithGrades` / `groupsWithoutGrades`.

**Canvas:** Assignment group is active when it has contributing graded work.

**Decision:** Extract `isAssignmentGroupActive()` in Phase 2. Pure refactor; no behavior change.

**Activation triggers (current engine):**

| Condition | Activates group? |
|-----------|------------------|
| Finite numeric grade (including 0) | Yes |
| Past-due missing + `count_as_zero` | Yes |
| Future-due ungraded | No |
| Submitted but ungraded | No |
| Excused only | No |
| Unpublished only | No |
| Hidden from student (student API path) | No — filtered before grade map |

---

### G-03 — Weight redistribution (already Canvas Current Grade)

**Verified by:** `case6WeightRedistribution` in `tests/grading/fixtures.js` (Case 6).

Course weights: Assignments 40%, Quizzes 30%, Discussions 20%, Attendance 10%.  
Only Assignments has a grade (80%). Result: **80% overall**, not 32% (80 × 0.40).

**Decision:** Keep. Document as intentional Canvas Current Grade parity.

---

### G-05 / G-06 — Missing and ungraded in Final mode

**Today (current mode):**

- Past-due missing with `count_as_zero`: 0 earned, adds to possible, activates group.
- Submitted ungraded: excluded from earned and possible.

**Canvas Final Grade gap:**

- All published assignments in denominator at full weight.
- Ungraded submitted past-due → 0 when treating ungraded as zero.

**Decision:** Phase 3 adds final mode. Current mode unchanged.

---

### G-15 — Extra credit not implemented

**Status:** Implemented in Phase 5.

**Canvas behavior:**

- Extra credit assignments add to earned points without increasing possible.
- Course total can exceed 100%.
- Extra credit groups typically have 0% weight; points add as bonus.

**Implementation:** `shared/grading/extraCredit.cjs` — `isExtraCreditAssignment()`, `applyExtraCreditToCourseTotal()`. Assignment model fields `isExtraCredit`, `bonusPoints`; optional `isExtraCreditGroup` on course groups. Policy: `extraCredit: { enabled, capPercent }`. Engine **1.2.0**.

**CP-24:** 100/100 regular + 10 EC bonus → **110%**.

---

### G-16 — Grade status scattered

**Today:**

- Submission booleans: `teacherApproved`, `autoGraded`, `gradeHidden`, `excused`, etc.
- `services/gradeRelease.service.js`: `isReleased()`, `hasScore()`
- `services/assignmentWorkflow.service.js`: 11 workflow strings
- `frontend/src/utils/assignmentWorkflowStatus.ts`: duplicate visibility logic

**Decision:** Implemented in Phase 4 as `shared/grading/gradeStatus.cjs` with `resolveSubmissionGradeStatus()`, consumed by gradebook cells, release visibility, and workflow services.

---

### G-17 — Hidden grades on student path

**Today:** `gradeRelease.service.js` redacts unreleased scores. Student grade API excludes
hidden grades from totals via `submissionVisibleForStudent` in context builders.

**Canvas:** Institution may configure whether muted assignments affect grade.

**Decision:** Document current behavior. Optional alignment in Phase 6.

---

### G-18 — Transcript final vs Canvas final grade

**Today:** `StudentCourseGradeSnapshot.finalPercent` is the **official immutable** grade
after course FINALIZED lifecycle. This is **not** the same as Canvas "Final Grade" preview.

**Decision:** Keep frozen snapshots. Live "projected final" is a separate API field in Phase 6.

---

## Existing contract cases (Cases 1–9)

These **must not change** when `gradeMode = 'current'` (default):

| Case | Scenario | Expected % | Canvas current equivalent |
|------|----------|------------|---------------------------|
| 1 | Standard weighted (4 groups) | 83% | Yes |
| 2 | Missing past due | 50% | Yes (with count_as_zero) |
| 3 | Submitted not graded | 80% | Yes |
| 4 | Unpublished ignored | 90% | Yes |
| 5 | Excused excluded | 80% | Yes |
| 6 | Weight redistribution | 80% | Yes |
| 7 | Late submission graded | 85% | Yes |
| 8 | Manual grade | 92% | Yes |
| 9 | Group assignment | 88% | Yes |

Source: `tests/grading/fixtures.js`, verified by `backendFrontend.parity.test.js`.

---

## Canvas parity fixtures (Cases CP-11 – CP-25)

New fixtures in `tests/grading/canvasParity.fixtures.js`:

| ID | Scenario | Status | Current % | Canvas Final % (target) |
|----|----------|--------|-----------|-------------------------|
| CP-11 | Partially graded course (one active group) | Baseline | 80 | 50 (Phase 3) |
| CP-12 | Graded zero activates group | Baseline | 0 | 0 |
| CP-13 | Empty group (all future due) | Baseline | 90 | 45 (Phase 3) |
| CP-14 | Future assignment in active group | Baseline | 90 | 45 (Phase 3) |
| CP-15 | `exclude_until_graded` missing | Baseline | 80 | 80 |
| CP-16 | Excused-only group inactive | Baseline | 85 | 85 |
| CP-17 | Graded zero + missing in group | Baseline | 16.67 | 16.67 |
| CP-18 | Drop lowest removes graded zero | Baseline | 80 | 80 |
| CP-19 | Late penalty per day | Baseline | < 70 | < 70 |
| CP-20 | Category cap limits contribution | Baseline | capped | capped |
| CP-21 | Ungrouped weight bucket | Baseline | ~86.67 | Phase 3 review |
| CP-22 | Two groups, one partially graded | Baseline | 75 | 37.5 (Phase 3) |
| CP-23 | Canvas final gap (future exam) | Baseline | 100 | 50 |
| CP-24 | Extra credit exceeds 100% | Baseline | 110 | 110 |
| CP-25 | Submitted ungraded final gap | Baseline | 80 | 40 |

Tests: `tests/grading/canvasParity.audit.test.js` and `canvasParityComprehensive.policy.test.js` cover all baseline scenarios. `PENDING_SCENARIOS` is empty (all promoted).

---

## Migration plan summary

| Phase | Deliverable | Engine change? |
|-------|-------------|----------------|
| **1** (this doc) | Audit + fixtures + baseline tests | No |
| **2** (complete) | `isAssignmentGroupActive()` in `groupActivation.cjs` | Refactor only |
| **3** (complete) | Current + Final grade modes | Yes — MINOR bump to 1.1.0 |
| **4** | Grade status enum | No (display/API layer) |
| **5** (complete) | Extra credit | Yes — MINOR bump to 1.2.0 |
| **6** (complete) | Dual API/UI totals | API only |
| **7** (complete) | Expanded parity tests | No |
| **8** (complete) | Performance dedup | No math change |

---

## Backwards compatibility guarantees

1. **Default `gradeMode = 'current'`** — all Cases 1–9 and CP baseline fixtures unchanged.
2. **Frozen transcripts** — `calculateCourseGradeForStudent` returns snapshot for FINALIZED terms; never recomputes on engine bump.
3. **Policy snapshots** — hash algorithm and snapshot schema unchanged.
4. **API alias** — `totalPercent` remains as alias for `currentPercent` for one release cycle.
5. **CJS/ESM** — every engine change updates both `.cjs` and `.mjs`.

---

## Files touched in Phase 1

| Action | Path |
|--------|------|
| Created | `docs/grading/CANVAS_PARITY_AUDIT.md` |
| Created | `tests/grading/canvasParity.fixtures.js` |
| Created | `tests/grading/canvasParity.audit.test.js` |
| Created | `frontend/tests/fixtures/grading/canvasParity.fixtures.ts` |
| Created | `frontend/tests/unit/utils/canvasParity.audit.test.ts` |
| Unchanged | `shared/grading/gradeCalculation.cjs` |
| Unchanged | All Cases 1–9 in `tests/grading/fixtures.js` |

---

## Sign-off checklist (Phase 1)

- [x] Phase 2: `isAssignmentGroupActive()` extracted to `shared/grading/groupActivation.cjs`
- [x] Gap matrix documented with classification (keep / change / add)
- [x] Canvas Current Grade parity confirmed for Cases 1–9 and Case 6 redistribution
- [x] Canvas Final Grade gaps identified with fixture examples
- [x] Extra credit gap confirmed (not implemented) → **resolved Phase 5**
- [x] Frozen transcript semantics distinguished from Canvas final grade
- [x] Baseline fixtures + tests added (no engine modifications)
- [x] Migration phases 2–8 mapped to specific files (see migration plan canvas)

**Migration complete.** All phases 1–8 delivered. Engine at `1.2.0` with full Canvas parity coverage.

---

## Phase 8 deliverables

| Action | Path |
|--------|------|
| Refactored | `services/studentCourseGradeData.service.js` — batched group + discussion queries, exported `loadGroupSubmissionsForStudent` |
| Refactored | `controllers/grades.controller.js` — `getStudentCourseGrade` delegates to shared context builder |
| Created | `tests/grading/studentCourseGradeContext.policy.test.js` — batch query assertions |
| Created | `tests/grading/gradeContextDedup.policy.test.js` — no duplicated fetch logic in controller |
| Extended | `tests/unit/controllers/submission-grades.controller.test.js` — delegation test |

**Sign-off (Phase 8):**

- [x] Group assignment resolution: O(1) `Group.find` + `Submission.find` (was N+1 `Group.findOne` per assignment)
- [x] Discussion reply checks: single `batchThreadIdsRepliedByUser` call (was per-thread `hasReplyByUser`)
- [x] `GET /api/grades/student/course/:courseId` routes through `buildStudentCourseGradeContext`
- [x] Transcript, lifecycle, and export paths already used shared builder — now benefit from batching
- [x] No grading math changes; engine version unchanged

---

## Phase 7 deliverables

| Action | Path |
|--------|------|
| Created | `tests/grading/parityRunner.js` — shared scenario runners |
| Created | `tests/grading/canvasParityComprehensive.policy.test.js` — Cases 1–9 + CP-11…CP-25, CJS/ESM, dual totals |
| Extended | `tests/grading/backendFrontend.parity.test.js` — CP current-mode contract rows |
| Extended | `tests/grading/gradesPipeline.integration.test.js` — dual totals + CP-25 gap |
| Extended | `tests/grading/policyMatrix.policy.test.js` — current vs final mode matrix |
| Extended | `scripts/verifySharedGrading.js` — export guard + CJS/ESM twin parity |
| Created | `frontend/tests/unit/utils/canvasParityComprehensive.policy.test.ts` |
| Created | `frontend/tests/utils/canvasParityTestSetup.ts` — `useCanvasParityPolicyClock()` |
| Extended | `frontend/tests/fixtures/grading/canvasParity.fixtures.ts` — fixed dates aligned with backend |
| Extended | `canvasParity.audit.test.ts`, `gradeMode.policy.test.ts`, `dualGradeTotals.policy.test.ts`, `groupActivation.policy.test.ts` — policy clock + resolved policy for CP scenarios |

**Sign-off (Phase 7):**

- [x] Backend comprehensive suite: Cases 1–9 + CP-11…CP-25 + dual totals + CJS/ESM
- [x] Frontend comprehensive suite mirrors contract + CP baseline
- [x] `npm run test:grading` — backend (321 tests) + frontend (188 tests)
- [x] `npm run verify:grading` — shared module export + twin parity

**Coverage matrix (Phase 7):**

| Layer | Cases 1–9 | CP-11…CP-25 current | CP final targets | CJS/ESM | Service dual |
|-------|-----------|---------------------|------------------|---------|--------------|
| Backend comprehensive | Yes | Yes | Yes | Yes | Yes |
| Backend contract | Yes | Partial (current) | Via gradeMode tests | verify script | Via dualGradeTotals |
| Frontend comprehensive | Yes | Yes | Yes | N/A (ESM native) | N/A |

---

## Phase 6 deliverables

| Action | Path |
|--------|------|
| Extended | `services/gradeCalculation.service.js` — `computeDualGradeTotals()`, `toStudentGradeApiResponse()` |
| Extended | `GET /api/grades/student/course/:courseId` — `currentPercent`, `finalPercent`, `finalLetterGrade`; `totalPercent` alias |
| Extended | `controllers/grades.controller.js` — cache key v4, EC fields on assignment payloads |
| Extended | `services/studentCourseGradeData.service.js` — EC fields for grade context |
| Created | `utils/assignmentGradeCalcFields.js` |
| Extended | `frontend/src/hooks/useStudentGradeData.ts` — fetch dual totals |
| Extended | `frontend/src/components/common/StudentGradeSidebar.tsx` — Current + Final Grade labels |
| Extended | `frontend/src/components/course/CourseDetail.tsx`, `StudentGradesView.tsx` |
| Tests | `tests/grading/dualGradeTotals.policy.test.js` |
| Tests | `frontend/tests/unit/utils/dualGradeTotals.policy.test.ts` |
| Tests | `tests/grading/gradingContract.e2e.test.js` — dual field assertions |

**API response shape:**

```json
{
  "currentPercent": 80,
  "finalPercent": 40,
  "totalPercent": 80,
  "letterGrade": "B",
  "finalLetterGrade": "F",
  "fromFrozenSnapshot": false
}
```

`totalPercent` remains an alias for `currentPercent`. When a course term is finalized, both percentages reflect the frozen official snapshot.

---

## Phase 5 deliverables

| Action | Path |
|--------|------|
| Created | `shared/grading/extraCredit.cjs` + `.mjs` — EC detection + bonus application |
| Extended | `shared/grading/groupActivation.cjs` + `.mjs` — EC earned/possible split |
| Refactored | `shared/grading/gradeCalculation.cjs` + `.mjs` — EC bonus after weighted base |
| Extended | `models/Assignment.js` — `isExtraCredit`, `bonusPoints` |
| Extended | `shared/grading/policyDefaults.cjs` + `.mjs` — `extraCredit` policy |
| Bumped | `shared/grading/gradingEngineVersion.cjs` + `.mjs` → `1.2.0` |
| Exported | `index.cjs`, `index.mjs`, `index.browser.mjs`, `index.d.ts`, `gradeUtils.ts` |
| Tests | `tests/grading/extraCredit.policy.test.js` |
| Tests | `frontend/tests/unit/utils/extraCredit.policy.test.ts` |
| Fixtures | CP-24 promoted to baseline (110% target) |

---

## Phase 4 deliverables

| Action | Path |
|--------|------|
| Created | `shared/grading/gradeStatus.cjs` + `.mjs` — `GRADE_STATUS`, `resolveSubmissionGradeStatus()` |
| Refactored | `shared/grading/gradebookCell.cjs` + `.mjs` — status-driven cell labels |
| Refactored | `services/gradeRelease.service.js` — delegates to `isScoreReleased()` |
| Refactored | `services/assignmentWorkflow.service.js` — maps via `mapGradeStatusToWorkflowState()` |
| Refactored | `frontend/src/utils/assignmentWorkflowStatus.ts` — imports shared enum |
| Refactored | `frontend/src/components/grades/StudentGradesView.tsx` — `GradeStatusBadge` component |
| Created | `frontend/src/components/grades/GradeStatusBadge.tsx` |
| Exported | `index.cjs`, `index.mjs`, `index.browser.mjs`, `index.d.ts`, `gradeUtils.ts` |
| Tests | `tests/grading/gradeStatus.policy.test.js` |
| Tests | `frontend/tests/unit/utils/gradeStatus.policy.test.ts` |

---

## Phase 3 deliverables

| Action | Path |
|--------|------|
| Extended | `shared/grading/groupActivation.cjs` + `.mjs` — `gradeMode: 'current' \| 'final'` |
| Refactored | `shared/grading/gradeCalculation.cjs` + `.mjs` — dual calculators |
| Bumped | `shared/grading/gradingEngineVersion.cjs` + `.mjs` → `1.1.0` |
| Exported | `calculateCurrentGradeWithWeightedGroups`, `calculateProjectedFinalGradeWithWeightedGroups` |
| Re-exported | `frontend/src/utils/gradeUtils.ts`, `index.d.ts` |
| Tests | `tests/grading/gradeMode.policy.test.js` |
| Tests | `frontend/tests/unit/utils/gradeMode.policy.test.ts` |
| Fixtures | CP-23, CP-25 promoted to baseline; final-mode targets validated |

---

## Phase 2 deliverables

| Action | Path |
|--------|------|
| Created | `shared/grading/groupActivation.cjs` + `.mjs` |
| Refactored | `shared/grading/gradeCalculation.cjs` + `.mjs` |
| Exported | `index.cjs`, `index.mjs`, `index.browser.mjs`, `index.d.ts` |
| Re-exported | `frontend/src/utils/gradeUtils.ts` |
| Tests | `tests/grading/groupActivation.policy.test.js` |
| Tests | `frontend/tests/unit/utils/groupActivation.policy.test.ts` |
