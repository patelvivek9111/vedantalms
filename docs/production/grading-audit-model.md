# Grading Audit Model

## Lifecycle states

```text
DRAFT → POSTED → FINALIZED
                    ↓ (registrar amend)
              new snapshots (append-only)
                    ↓
              FINALIZED (updated policy metadata)
```

| State | Student sees | Instructor edits | Policy edits affect term |
|-------|--------------|------------------|---------------------------|
| DRAFT | Provisional | Yes | Yes |
| POSTED | Yes | Yes (audited) | Yes |
| FINALIZED | Locked | No | No (use amend) |

## Immutable artifacts

### StudentCourseGradeSnapshot

One **current** row per `(student, course, term, year)` with `isCurrent: true`. Amendments supersede prior rows (`isCurrent: false`, `supersededAt`).

Stores: `finalPercent`, `letterGrade`, `gradingPolicyHash`, `gradingPolicySnapshot`, `gradingEngineVersion`.

### CourseGradeLifecycle

One row per `(course, term, year)`: status, finalize metadata, batch policy hash at finalize.

## Audit streams

| Source | Model / API | Events |
|--------|-------------|--------|
| System | `SystemAuditEvent` | `lifecycle_posted`, `lifecycle_finalized`, `grades_amended`, `transcript_recompute_applied`, `grade_edit_while_posted` |
| Policy | `GradingPolicyAudit` | Institution/course policy saves with diff |
| Amendments | `GradeAmendmentRecord` | Registrar amend with before/after hashes |
| Jobs | `AsyncJob` | finalize, recompute, export, regenerate |
| Unified UI | `GET .../audit-timeline` | Merged chronological feed |
| Provenance UI | `GET .../provenance` | Policy chain + engine version + snapshot counts |

## Calculation provenance

All grades flow through `calculateCourseGradeForStudent` → shared `calculateFinalGradeWithWeightedGroups`.

- **Engine version**: `shared/grading/gradingEngineVersion.cjs` (semver, bump only on calculator behavior change)
- **Policy version/hash**: `policySnapshot.cjs` at calculation time
- **Frozen reads**: finalized terms use stored snapshot, not live institution policy

## Registrar capabilities

| Capability | Roles |
|------------|-------|
| `post_grades` | teacher (own course), registrar, admin |
| `finalize_grades` | registrar, department_admin, admin |
| `amend_grades` | registrar, department_admin, admin |
| `recompute_grades` | registrar, department_admin, admin |

## Migrations

Logged in `MigrationRun`. Run `npm run migrate:dry-run` before apply. Migration `001` backfills FINALIZED lifecycle from existing frozen snapshots without changing grades.
