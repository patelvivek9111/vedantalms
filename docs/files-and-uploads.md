# Files and uploads

Upload architecture, secure delivery, versioning, and role-specific workflows.

---

## Upload architecture

Canvas-style uploads: shared frontend on institutional `FileAsset` backend.

**Client flow:**

1. `FileUploadDropzone` — drag-drop, keyboard, mobile-safe
2. `useFileUploadQueue` — concurrency (default 2), progress, retry, cancel
3. `fileUploadApi.uploadFiles` → `POST /api/upload`
4. Completed assets attached via secure URLs (`/api/files/:id/download?token=…`)
5. `FileAttachmentPanel` — dropzone, list, preview, replace, governance badges, version history

| Component | Role |
|-----------|------|
| `FileUploadDropzone` | Input surface |
| `FileUploadList` / `FileUploadItem` | Queue + stable list |
| `FilePreviewModal` | Authenticated preview |
| `FileAttachmentPanel` | Reusable attachment manager |

**Submission versioning:** resubmits call `supersedeFileAssets` (append-only); UI shows replace confirmation and prior versions via `GET /api/files/:id/versions`.

---

## Secure file delivery

| Route | Purpose |
|-------|---------|
| `GET /api/files/:id/download` | Attachment download (HMAC token optional) |
| `GET /api/files/:id/stream` | Inline preview |
| `GET /api/files/:id/metadata` | Governance metadata |
| `POST /api/files/:id/download-token` | Refresh expired links |
| `GET /api/files/:id/versions` | Version group history |

**Frontend:** `useFileDownload` refreshes tokens; maps 401/403/410 to safe messages. Previews never use raw `/uploads/` paths. `resolveSecureFileUrl` prefixes API host.

**FERPA:** invalid tokens record `ferpa_suspicious_access`; UI shows session/permission/expiry messaging without exposing storage keys.

---

## File versioning

**Backend (U7):** `FileAsset` fields — `versionGroupId`, `versionNumber`, `supersedes`, `supersededBy`, `isCurrentVersion`. Submissions supersede on resubmit; blobs and audit rows append-only.

**UI:** `FileVersionHistory` loads versions API; current version badge; prior versions collapsed; download historical versions; no restore when `lifecycleLocked` / finalized. Metadata compare only — no document diff.

---

## Instructor workflows

**Assignments:** `FileAttachmentPanel` with `category: 'assignment'` — reorder, replace, preview, remove.

**Pages & syllabus:** shared panel with `category: 'page'` and `courseId`.

**Announcements:** multipart create/update; list/detail render `fileAssets` / legacy `attachments` with secure download + preview.

**Governance:** when course grades are `FINALIZED`, uploads disabled with lifecycle lock messaging.

---

## Student submission workflows

`AssignmentFileUploadSection` wraps `FileAttachmentPanel`:

- Drag-drop + progress + retry/cancel
- Replace dialog on resubmit
- Version history when prior `fileAssetId` exists
- Lock when course lifecycle is `FINALIZED`

Submission APIs accept `uploadedFiles` as secure FileAsset URLs/IDs only (legacy `/uploads/` paths rejected). Local draft storage keeps normalized file metadata between sessions.

---

## Operations

Upload platform runbook (purge, recovery center, retention): see [operations.md](./operations.md#upload-platform).

E2E upload seed: see [testing.md](./testing.md).
