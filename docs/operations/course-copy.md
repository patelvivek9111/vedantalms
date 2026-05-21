# Course copy

`POST /api/courses/:id/copy` duplicates instructional content into a new draft course.

## Included

- Modules, pages, assignments, discussions, announcements
- File attachments (new `FileAsset` rows referencing the same blobs)

## Excluded

- Submissions, grades, transcript snapshots, lifecycle records

## Async

Pass `{ "async": true }` to enqueue `course.copy` job; poll via `/api/jobs/:id`.
