# FERPA-oriented access controls (Phase G)

## Role matrix (academic records)

| Role | Own grades/transcript | Course gradebook | Edit submissions | Finalize/amend |
|------|----------------------|------------------|------------------|----------------|
| student | Yes (own only) | No | No | No |
| teaching_assistant | No | Assigned courses | Yes (draft) | No |
| teacher | No | Instructor courses | Yes | Post only |
| registrar | No | Yes | **No** | Yes |
| department_admin | No | Yes | Staff rules | Yes |
| admin | Yes (override logged) | Yes | Yes (logged) | Yes |

## Audit events

- `ferpa_access_denied` — blocked access
- `ferpa_cross_student_attempt` / `ferpa_cross_course_attempt`
- `transcript_view` / `transcript_download`
- `gradebook_export_requested` / `gradebook_export_download`
- `admin_override` — admin mutation on submissions

## Verification

```bash
npm run verify:audit-integrity
npm run test:grading -- --testPathPattern=ferpaAccess
```
