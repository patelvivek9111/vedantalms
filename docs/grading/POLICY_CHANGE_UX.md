# Policy Change UX — Design Spec

**Status:** Phase 3 complete (from_assignment cutoff, institution banner, CSV export, lifecycle dry-run)  
**Date:** 2026-07-06  
**Related:** `CANVAS_PARITY_AUDIT.md`, `gradingPolicy.service.js`, `gradeLifecycle.service.js`, `transcriptRecompute.service.js`  
**Audience:** Product, grading platform, frontend

---

## Problem

Today, when an instructor changes course grading policy mid-semester (before finalize):

1. **Raw scores are unchanged** — submission points, excused flags, and comments stay as entered.
2. **All live totals are fully recalculated** using the **current** effective policy — retroactively across every assignment and every student.
3. The UI copy in `GradingPolicyModal` says *"New policy applies to future calculations"* — which is **misleading**; it applies to **all** live calculations immediately on save.
4. **Preview** (`previewCourseGradingPolicy`) runs against a **hard-coded 2-assignment sample**, not real enrolled students — so instructors cannot see who moves and by how much.
5. **Submission policy stamps** record policy-at-grade-time for audit but are **not** used in live math — there is no “apply from assignment X” or “apply from date Y” mode.

After **FINALIZE**, course policy edits are blocked and transcript rows use frozen snapshots — that path is correct. The gap is **DRAFT / POSTED** courses where policy changes silently reshuffle everyone’s Current Grade.

### Example impact (from parity scenario)

| Student | Policy: `exclude_until_graded` | If switched to `count_as_zero` (retroactive) |
|---------|-------------------------------|-----------------------------------------------|
| A | 92.22% | Drops if past-due ungraded items become zeros |
| B | 95.00% | Likely drops sharply (missing HW2 counts as 0) |
| C | 66.92% | May change little (zeros already graded) |

Instructors need to **see this before saving**, and registrars need a deliberate path when retroactive change is intentional.

---

## Goals

| # | Goal |
|---|------|
| G1 | **Impact preview** — show per-student Δ% and Δ letter before confirming a policy save |
| G2 | **Explicit apply mode** — instructor chooses how the change takes effect (see modes below) |
| G3 | **Lifecycle-aware** — behavior differs by `DRAFT` / `POSTED` / `FINALIZED` / `AMENDED` |
| G4 | **Audit trail** — every save records apply mode, reason, actor, old/new hash, and optional impact summary |
| G5 | **Canvas-aligned defaults** — default apply mode matches Canvas-like “recalculate everything” for in-progress courses, with guardrails |
| G6 | **No regression** — frozen transcript snapshots and finalize guards remain immutable |

## Non-goals (this phase)

- Per-student policy exceptions
- Institution-wide policy change impact preview across all courses (separate admin tool)
- Rewriting the canonical grading engine
- Changing how Canvas computes Current vs Final grades

---

## Recommended apply modes

### Mode A — `retroactive_all` (default for DRAFT / POSTED)

**Behavior:** Same as today. On save, resolved policy updates; all live grade totals recompute against all raw scores.

**When to use:** Instructor fixes a misconfiguration (wrong missing policy, wrong weights) and intends the course grade to reflect the corrected rules for the whole term.

**Canvas analogy:** Changing gradebook settings recalculates displayed grades for the whole course.

### Mode B — `prospective_only` (recommended default when lifecycle = POSTED)

**Behavior:** Policy change applies only to assignments **graded after** the policy effective timestamp. Assignments graded **before** `effectiveAt` use the **submission’s stored `gradingPolicySnapshot`** for course-total contribution.

**When to use:** Mid-term policy tweak after students have already seen posted grades; reduces surprise while still allowing rule changes going forward.

**Requires:** Engine change — `assignmentContributesToGrade` must accept per-assignment resolved policy from submission snapshot when mode is active.

### Mode C — `from_assignment` (optional v2)

**Behavior:** Like Mode B but cutoff is a specific assignment (or assignment group): everything before cutoff uses old policy snapshot aggregate; everything on/after uses new policy.

**When to use:** “New missing policy applies starting with Quiz 3.”

### Mode D — `registrar_amendment` (FINALIZED / AMENDED only)

**Behavior:** No live course policy edit. Use existing `transcriptRecompute` + amendment workflow with mandatory dry-run, reason, and optional `forceAmend`.

**When to use:** Official transcript correction after term close.

---

## Lifecycle matrix

| Lifecycle | Edit course policy? | Default apply mode | Student sees | Official transcript |
|-----------|--------------------|--------------------|--------------|---------------------|
| **DRAFT** | Yes | `retroactive_all` | Live recalc | N/A |
| **POSTED** | Yes (with warning) | `prospective_only` suggested | Live or split by snapshot | N/A until finalize |
| **FINALIZED** | **Blocked** | `registrar_amendment` | Frozen snapshot | Frozen |
| **AMENDED** | **Blocked** | `registrar_amendment` | Frozen / amended row | Frozen + amendment chain |

### POSTED-specific rule (Canvas-like stability)

When lifecycle is **POSTED**, show an extra confirmation:

> “Students may have already seen these grades. Retroactive recalculation will change their Current Grade immediately.”

Recommend **prospective_only** as the pre-selected option; require typed confirmation for `retroactive_all`.

---

## UX flows

### Flow 1 — Save course policy (enhanced modal)

```
[Settings tab] → edit policy fields
      ↓
[Review impact] (replaces weak "Preview" button)
      ↓
Impact panel:
  - Summary: N students affected, M unchanged
  - Table: Student | Current % | Proposed % | Δ | Letter change
  - Highlight rows where |Δ| ≥ 1.0% or letter changes
  - Changed policy fields (diff chips)
      ↓
Apply mode selector (radio):
  ○ Recalculate all grades with new policy (retroactive)
  ○ Apply to newly graded work only (prospective)  ← default if POSTED
      ↓
Reason (required if any student |Δ| ≥ 0.01% or letter changes)
      ↓
[Confirm save] → API → invalidate caches → toast with summary
```

**Wire into:** `GradingPolicyModal.tsx` — new tab `impact` between `settings` and `effective`, or a stepped wizard on save.

**Fix copy** (settings header):

- ~~"New policy applies to future calculations"~~
- **"Saving recalculates live grades for all students unless you choose prospective-only mode."**

### Flow 2 — Institution policy change (admin)

Institution changes affect **all non-finalized courses** on next calculation (no per-course apply mode today).

**Minimum v1:** Banner on institution save:

> “This updates the default for all courses that do not override this setting. Courses in DRAFT/POSTED will recalculate on next grade view. Finalized terms are unaffected.”

**v2:** Admin impact report: course count + link to per-course impact dry-run job.

### Flow 3 — Finalized correction (existing + surfaced)

Surface in `CourseGradeLifecyclePanel` when status = FINALIZED:

```
[Preview policy impact on transcript] → dryRun recompute
[Request amendment] → reason + registrar approval → amend flow
```

Reuse `POST /api/grading-policy/recompute` with `dryRun: true` (already exists).

---

## API design

### `POST /api/grading-policy/course/:courseId/impact-preview`

**Purpose:** Dry-run proposed policy against **real** enrolled students and assignments.

**Request:**

```json
{
  "policy": { "missingAssignment": { "mode": "count_as_zero" } },
  "groups": null,
  "gradeScale": null,
  "applyMode": "retroactive_all",
  "effectiveAt": null,
  "studentIds": null
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "applyMode": "retroactive_all",
    "currentPolicyHash": "abc…",
    "proposedPolicyHash": "def…",
    "lifecycleStatus": "POSTED",
    "summary": {
      "studentCount": 28,
      "affectedCount": 12,
      "unchangedCount": 16,
      "maxDeltaPercent": 18.5,
      "letterChanges": 4
    },
    "students": [
      {
        "studentId": "…",
        "displayName": "Student B",
        "currentPercent": 95.0,
        "proposedPercent": 72.4,
        "deltaPercent": -22.6,
        "currentLetter": "A",
        "proposedLetter": "C",
        "changed": true
      }
    ],
    "policyDiff": {
      "missingAssignment.mode": { "from": "exclude_until_graded", "to": "count_as_zero" }
    }
  }
}
```

**Implementation sketch:**

```js
// services/gradingPolicyImpact.service.js
async function previewCoursePolicyImpact(courseId, payload) {
  const course = await Course.findById(courseId).populate('students');
  const lifecycle = await getLifecycle(courseId, term, year);
  const currentCtx = await buildGradeContexts(course); // existing inputs service

  for (const student of course.students) {
    const current = await computeStudentCourseGrade(course, student, { audience: 'instructor' });
    const proposed = await computeStudentCourseGrade(course, student, {
      audience: 'instructor',
      policyOverride: mergeProposed(current.resolved, payload.policy),
      applyMode: payload.applyMode, // prospective_only uses snapshot-aware path
    });
    rows.push(diffRow(current, proposed));
  }
  return { summary, students: rows };
}
```

**Performance:** For courses with >50 students, return `202` + async job (reuse `jobQueue.service` pattern from recompute). Paginate student table in UI.

### `PUT /api/grading-policy/course/:courseId` (extended)

**New fields:**

```json
{
  "policy": { … },
  "applyMode": "retroactive_all",
  "effectiveAt": "2026-03-15T00:00:00.000Z",
  "reason": "Correcting missing assignment policy per dept policy"
}
```

**Server actions on save:**

1. `assertCanMutateCoursePolicy(courseId)` (unchanged)
2. Validate `applyMode` vs lifecycle (reject `prospective_only` if engine flag off)
3. `upsertCoursePolicy` + store `applyMode` and `effectiveAt` on `CourseGradingPolicy`
4. `recordPolicyChange` with impact summary attachment
5. `invalidateAllStudentCourseGrades(courseId)`

---

## Data model changes

### `CourseGradingPolicy` (extend)

```js
{
  // existing: policy, groups, gradeScale, version, updatedBy
  applyMode: {
    type: String,
    enum: ['retroactive_all', 'prospective_only', 'from_assignment'],
    default: 'retroactive_all',
  },
  effectiveAt: { type: Date, default: null },
  effectiveAssignmentId: { type: ObjectId, ref: 'Assignment', default: null },
}
```

### `GradingPolicyAudit` (extend)

```js
{
  // existing: oldPolicy, newPolicy, oldHash, newHash, reason, actorId
  applyMode: String,
  effectiveAt: Date,
  impactSummary: {
    affectedCount: Number,
    maxDeltaPercent: Number,
    letterChanges: Number,
  },
}
```

### Engine — `prospective_only` (Mode B)

In `groupActivation.mjs` → `assignmentContributesToGradeCurrent`:

```
if (course.applyMode === 'prospective_only' && submission.gradedAt < coursePolicy.effectiveAt) {
  policy = resolvedPolicyFromSnapshot(submission.gradingPolicySnapshot) ?? policy;
}
```

Fallback: if submission has no snapshot (legacy rows), use policy at `effectiveAt` from nearest audit entry or treat as `retroactive_all` for that row (configurable).

---

## UI components (new / changed)

| Component | Change |
|-----------|--------|
| `GradingPolicyModal.tsx` | Fix header copy; impact step; apply mode + reason ✅ |
| `PolicyImpactPreview.tsx` | Student delta table, summary chips, apply mode label ✅ |
| `PolicyApplyModeSelector.tsx` | Radio group with lifecycle-aware defaults ✅ |
| `useGradingPolicy.ts` | `runImpactPreview()` + `applyMode` on save ✅ |
| `gradingApi.ts` | `previewCoursePolicyImpact()`, extended save payload ✅ |
| `PolicyAuditHistory.tsx` | Show `applyMode` + `impactSummary` ✅ |
| `EffectivePolicyPreview.tsx` | Apply mode + retroactive/prospective explanation ✅ |
| `CourseGradeLifecyclePanel.tsx` | Link to transcript dry-run when FINALIZED ✅ |

### Impact table columns

| Column | Notes |
|--------|-------|
| Student | Name + optional avatar |
| Current % | Under saved policy |
| Proposed % | Under edited policy |
| Δ | Color: green ≤0, red >0 for drops (instructor perspective) |
| Letter | `B → A` badge if changed |
| Flag | “Large change” if \|Δ\| ≥ 5% |

Sort default: largest \|Δ\| first.

---

## Phased implementation

### Phase 0 — Quick fixes (1–2 days) ✅

- [x] Fix misleading modal copy in `GradingPolicyModal.tsx`
- [x] Require `reason` on save when lifecycle is POSTED (backend validation)
- [x] Document current retroactive behavior in Effective Policy tab

**No engine changes.**

### Phase 1 — Real impact preview (1 week) ✅

- [x] `gradingPolicyImpact.service.js` + `POST …/impact-preview`
- [x] `PolicyImpactPreview.tsx` + wire into modal save flow
- [x] Async job for large courses (`grades.policyImpactPreview`)
- [x] Tests: impact preview + missing-policy flip (`gradingPolicyImpact.policy.test.js`)

**Impact preview supports both apply modes; save used retroactive until Phase 2.**

### Phase 2 — Apply modes (2 weeks) ✅

- [x] Extend `CourseGradingPolicy` + `GradingPolicyAudit` models
- [x] Engine: `prospective_only` via `policyApplication.cjs` + submission snapshots (`groupActivation`)
- [x] Apply mode selector in UI (`PolicyApplyModeSelector.tsx`); POSTED defaults to prospective
- [x] Schema default `retroactive_all` for existing courses (no migration script required)
- [x] Policy tests for mixed snapshot / new policy rows (`prospectivePolicy.policy.test.js`)

### Phase 3 — Polish (1 week) ✅

- [x] `from_assignment` cutoff mode
- [x] Institution admin impact banner + course count
- [x] Export impact CSV for registrar
- [x] E2E: POSTED course, prospective save, grade new assignment, verify old unchanged (`prospectivePosted.policy.test.js`)

---

## Test plan (acceptance)

| # | Scenario | Expected |
|---|----------|----------|
| T1 | DRAFT course, flip missing policy, impact preview | B shows large negative Δ; A smaller Δ | ✅ `gradingPolicyImpact.policy.test.js` |
| T2 | Save retroactive after preview | Gradebook matches preview within 0.01% | Manual / follow-up |
| T3 | POSTED + prospective_only | Pre-cutoff graded work keeps stamped policy | ✅ `prospectivePolicy.policy.test.js` |
| T4 | FINALIZED, attempt policy save | 403; frozen snapshot unchanged | ✅ existing `gradeLifecycle.e2e.test.js` |
| T5 | Institution policy change | Finalized transcript unchanged | ✅ existing tests |
| T6 | Audit history | Entry shows applyMode, reason, impactSummary | ✅ model + UI |
| T7 | 100+ students | Impact preview returns 202 async job | ✅ `grades.policyImpactPreview` job |

---

## Canvas comparison

| Behavior | Canvas | Vedanta (Phase 2) | Target |
|----------|--------|-------------------|--------|
| Policy change recalculates grades | Yes (gradebook settings) | Yes, with preview + apply mode choice | ✅ |
| Posted grade stability | Informal; students may see changes | **prospective_only** option (default suggested on POSTED) | ✅ |
| Official final grade lock | Grading period / SIS | FINALIZED snapshot | ✅ |
| Per-submission policy history | Limited | Submission stamps used in prospective mode | ✅ |
| Impact preview before save | No native bulk preview | Real per-student impact table | ✅ |

Vedanta can exceed Canvas on **impact preview** and **explicit apply modes** while staying parity-compatible on math.

---

## Open questions

1. **POSTED default:** Should `prospective_only` be the default for POSTED, or only suggested? Recommendation: suggested, not forced — some instructors want retroactive fix.
2. **Group weight changes:** Always retroactive even in prospective mode? Recommendation: weight changes force `retroactive_all` (prospective is for behavioral flags like missing/late).
3. **Letter scale changes:** Always retroactive — letter is derived from %, not per-assignment.
4. **Notifications:** Email students when their Current Grade changes by ≥1% due to policy save? Recommendation: Phase 3, opt-in per institution.

---

## Summary

| Question | Answer (after Phase 2) |
|----------|------------------------|
| Does mid-course policy change affect old raw grades? | **No** — stored scores unchanged |
| Does it affect displayed totals? | **Retroactive:** all students immediately. **Prospective:** pre-cutoff graded work uses submission snapshot; ungraded/future uses new policy |
| Can instructors see impact first? | **Yes** — per-student table with apply mode toggle |
| When is it locked? | **FINALIZED** — frozen snapshot + policy edit blocked |

**Next implementation ticket:** Optional student notifications on ≥1% grade change; institution policy impact preview table.
