# Archive & restore

Courses use `operationalStatus`: `active`, `draft`, `archived`.

## Archive

`PATCH /api/courses/:id/archive` sets read-only archival state, unpublishes, records audit.

## Restore

`PATCH /api/courses/:id/restore` returns course to `active`.

## Effects

- Archived courses block new uploads/submissions via `assertCourseOperational`
- Historical files remain downloadable under existing FERPA rules
