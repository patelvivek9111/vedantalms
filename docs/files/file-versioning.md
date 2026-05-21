# File versioning (frontend)

## Backend (U7)

`FileAsset` fields: `versionGroupId`, `versionNumber`, `supersedes`, `supersededBy`, `isCurrentVersion`.

Submissions supersede prior assets on resubmit; blobs and audit rows are append-only.

## UI

- `FileVersionHistory` loads `GET /api/files/:id/versions`.
- Current version badge; prior versions collapsed.
- Download historical versions; restore is not offered when `lifecycleLocked` / finalized.

Metadata compare only — no document diff.
