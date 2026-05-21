# Secure file delivery

## Routes

- `GET /api/files/:id/download` — attachment download (HMAC token optional)
- `GET /api/files/:id/stream` — inline preview stream
- `GET /api/files/:id/metadata` — governance metadata
- `POST /api/files/:id/download-token` — refresh expired links
- `GET /api/files/:id/versions` — version group history

## Frontend

- `useFileDownload` refreshes tokens and maps 401/403/410 to user-safe messages.
- Previews never use raw `/uploads/` academic paths.
- `resolveSecureFileUrl` prefixes API host for `/api/files/…` paths.

## FERPA

Invalid tokens record `ferpa_suspicious_access`. The UI shows session/permission/expiry messaging without exposing storage keys.
