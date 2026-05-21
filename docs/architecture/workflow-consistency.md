# Workflow consistency (U13–U16)

## Upload UX

All surfaces use `FileAttachmentPanel` → `useFileUploadQueue` → `POST /api/upload` → domain APIs with `fileAssetIds`.

Surfaces: assignments (editor + student), pages, syllabus, announcements, discussions, inbox.

## Course operations

- Copy: `courseCopy.service.js`
- Archive/restore: `operationalStatus` on `Course`
- Bulk: `POST /api/courses/bulk` → `course.bulk` job

## Maintenance

`courseMaintenance.service.js` + `workers/fileMaintenanceWorker.js`

## Notifications

`institutionalNotification.service.js` templates for upload, export, lifecycle, and safety events.
