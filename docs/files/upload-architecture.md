# Upload architecture (U8)

## Overview

Canvas-style uploads use a shared frontend stack on top of the institutional `FileAsset` backend from U1–U7.

## Client flow

1. `FileUploadDropzone` selects files (drag-drop, keyboard, mobile-safe).
2. `useFileUploadQueue` uploads with concurrency (default 2), progress, retry, and `AbortController` cancel.
3. `fileUploadApi.uploadFiles` posts to `POST /api/upload` (unchanged semantics).
4. Completed assets are attached to domain APIs via secure URLs (`/api/files/:id/download?token=…`).
5. `FileAttachmentPanel` composes dropzone, list, preview, replace dialog, governance badges, and optional version history.

## Components

| Component | Role |
|-----------|------|
| `FileUploadDropzone` | Input surface |
| `FileUploadList` / `FileUploadItem` | Queue + stable list |
| `FilePreviewModal` | Authenticated preview |
| `FileAttachmentPanel` | Reusable attachment manager |

## Submission versioning

Resubmits call backend `supersedeFileAssets` (append-only). The UI shows replace confirmation and collapsed prior versions via `GET /api/files/:id/versions`.
