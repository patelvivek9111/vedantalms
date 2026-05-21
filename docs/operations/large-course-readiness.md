# Large course readiness

## Frontend

- `FileUploadList` paginates display (50 items per “Show more”)
- Upload queue concurrency defaults to 2
- Lazy preview loading in `FilePreviewModal`

## Backend

- Gradebook export remains async (`export.gradebook`)
- Bulk course ops use `course.bulk` job

## Validation

Run `npm run test:scale` (gradebook bench) in staging with 1000+ enrollments.
