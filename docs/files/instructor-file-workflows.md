# Instructor file workflows

## Assignments

Use `FileAttachmentPanel` when editing assignment attachments (category `assignment`). Supports reorder via list order sent to API, replace confirmation, preview, and remove.

## Pages & syllabus

Syllabus upload mode uses the shared panel with course context. Pages attachment panel should pass `category: 'page'` and `courseId`.

## Announcements

`AnnouncementForm` continues multipart create/update; list/detail views should render `fileAssets` / legacy `attachments` with secure download + preview.

## Governance

When course grades are `FINALIZED`, uploads are disabled and messaging explains lifecycle lock.
