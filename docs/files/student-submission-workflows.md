# Student submission workflows

## View assignment

`AssignmentFileUploadSection` wraps `FileAttachmentPanel` with:

- Drag-drop + progress + retry/cancel
- Replace dialog on resubmit
- Version history when prior `fileAssetId` exists
- Lock when course lifecycle is `FINALIZED`

## Submit payload

Submission APIs accept `uploadedFiles` as secure FileAsset URLs/IDs only (legacy `/uploads/` paths rejected).

## Drafts

Local draft storage keeps normalized file metadata between sessions.
