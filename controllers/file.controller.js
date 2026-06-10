const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const fileAccessService = require('../services/fileAccess.service');
const { createReadStreamForAsset, readStoredContent } = require('../services/fileStorage.service');
const academicAuditService = require('../services/academicAudit.service');
const ferpaAudit = require('../services/ferpaAudit.service');
const { assertSafeForDownload } = require('../services/fileScan.service');
const { listVersionsForAsset } = require('../services/fileVersioning.service');
const { buildDownloadPathForUser } = require('../services/fileAsset.service');
const { ZIP_DIR } = require('../services/bulkDownload.service');
const { isPathInside } = require('../config/paths');
const { getSignedCloudinaryUrl } = require('../utils/cloudinary');

exports.getFileMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const { asset } = await fileAccessService.assertCanAccessFileAsset(req.user, id, {
      ip: req.ip,
      requestId: req.requestId,
    });

    res.json({
      success: true,
      data: {
        id: asset._id,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        category: asset.category,
        visibility: asset.visibility,
        courseId: asset.courseId,
        assignmentId: asset.assignmentId,
        submissionId: asset.submissionId,
        createdAt: asset.createdAt,
        lifecycleLocked: asset.lifecycleLocked,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

function applyFileResponseHeaders(res, asset, { download = true, contentType } = {}) {
  res.setHeader('Content-Type', contentType || asset.mimeType || 'application/octet-stream');
  if (download) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(asset.originalName || 'download')}"`
    );
  }
}

async function streamAssetToResponse(req, res, asset, { download = true } = {}) {
  await academicAuditService.recordAuditEvent({
    actorId: req.user?._id,
    entityType: 'file_asset',
    entityId: asset._id,
    action: download ? 'file_download' : 'file_stream',
    ip: req.ip,
    requestId: req.requestId,
    metadata: { category: asset.category },
  }).catch(() => {});

  if (asset.provider === 'cloudinary' && asset.metadata?.providerUrl) {
    const signedUrl = getSignedCloudinaryUrl(asset.metadata.providerUrl, {
      download,
      resourceType: asset.metadata?.resourceType || 'auto',
    });
    if (signedUrl) {
      return res.redirect(302, signedUrl);
    }
  }

  const localStream = createReadStreamForAsset(asset);
  if (localStream) {
    applyFileResponseHeaders(res, asset, { download });
    localStream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'File not found on disk' });
      } else {
        res.destroy();
      }
    });
    localStream.pipe(res);
    return;
  }

  try {
    const buf = await readStoredContent(asset);
    applyFileResponseHeaders(res, asset, { download });
    res.send(buf);
  } catch (err) {
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: err.message || 'File not found on disk',
      });
    }
  }
}

exports.downloadFile = async (req, res) => {
  const fileDownloadGovernance = require('../services/fileDownloadGovernance.service');
  try {
    const { id } = req.params;
    const { token } = req.query;

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (token) {
      if (!fileAccessService.verifyFileDownloadToken(id, user._id, token)) {
        await ferpaAudit.recordFerpaEvent({
          actorId: user._id,
          action: 'ferpa_suspicious_access',
          entityType: 'file_asset',
          entityId: id,
          ip: req.ip,
          requestId: req.requestId,
          metadata: { reason: 'invalid_file_download_token' },
        }).catch(() => {});
        return res.status(403).json({ success: false, message: 'Invalid or expired download token' });
      }
    }

    const { asset } = await fileAccessService.assertCanAccessFileAsset(user, id, {
      ip: req.ip,
      requestId: req.requestId,
    });
    assertSafeForDownload(asset);
    await fileDownloadGovernance.assertDownloadRateLimit(user, id, { ip: req.ip });
    await fileDownloadGovernance.recordGeographicAccess(user, id, req);

    await streamAssetToResponse(req, res, asset, { download: true });
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } else {
      res.destroy();
    }
  }
};

exports.streamFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (token && !fileAccessService.verifyFileDownloadToken(id, user._id, token)) {
      return res.status(403).json({ success: false, message: 'Invalid or expired download token' });
    }
    const { asset } = await fileAccessService.assertCanAccessFileAsset(req.user, id, {
      ip: req.ip,
      requestId: req.requestId,
    });
    assertSafeForDownload(asset);
    await streamAssetToResponse(req, res, asset, { download: false });
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    } else {
      res.destroy();
    }
  }
};

exports.getFileVersions = async (req, res) => {
  try {
    const { id } = req.params;
    await fileAccessService.assertCanAccessFileAsset(req.user, id, {
      ip: req.ip,
      requestId: req.requestId,
    });
    const { current, versions } = await listVersionsForAsset(id);
    const mapVersion = (v) =>
      v
        ? {
            id: v._id,
            originalName: v.originalName,
            mimeType: v.mimeType,
            size: v.size,
            versionNumber: v.versionNumber,
            isCurrentVersion: v.isCurrentVersion,
            lifecycleLocked: v.lifecycleLocked,
            scanStatus: v.scanStatus,
            createdAt: v.createdAt,
            uploadedBy: v.uploadedBy
              ? {
                  id: v.uploadedBy._id,
                  name: `${v.uploadedBy.firstName || ''} ${v.uploadedBy.lastName || ''}`.trim(),
                }
              : null,
            downloadUrl: buildDownloadPathForUser(String(v._id), req.user._id),
          }
        : null;

    res.json({
      success: true,
      data: {
        current: mapVersion(current),
        versions: versions.map(mapVersion),
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.listCourseFiles = async (req, res) => {
  try {
    const fileList = require('../services/fileList.service');
    const data = await fileList.listFileAssetsCursor({
      courseId: req.query.courseId,
      category: req.query.category,
      assignmentId: req.query.assignmentId,
      cursor: req.query.cursor,
      limit: Math.min(parseInt(req.query.limit || '50', 10), 100),
      userId: req.user._id,
    });
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.batchFileMetadata = async (req, res) => {
  try {
    const fileList = require('../services/fileList.service');
    const ids = Array.isArray(req.body.fileAssetIds) ? req.body.fileAssetIds : [];
    const data = await fileList.batchMetadata(ids, req.user._id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.getPreviewInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { asset } = await fileAccessService.assertCanAccessFileAsset(req.user, id, { ip: req.ip });
    const previewJob = require('../services/filePreviewJob.service');
    const manifest = await previewJob.getPreviewManifest(id);
    const clientDocx = previewJob.isClientRenderedDocx(asset.mimeType, asset.originalName);
    const hasTextPreview = Boolean(manifest?.previewPath) && !clientDocx;
    res.json({
      success: true,
      data: {
        manifest,
        clientRendered: clientDocx,
        thumbnailUrl:
          !clientDocx && manifest?.status === 'ready'
            ? `/api/files/${id}/preview/thumbnail`
            : null,
        streamUrl: hasTextPreview ? `/api/files/${id}/preview/content` : null,
        previewCorrupted: clientDocx ? false : manifest?.previewCorrupted,
        previewLastGeneratedAt: manifest?.previewLastGeneratedAt,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.regeneratePreview = async (req, res) => {
  try {
    const { id } = req.params;
    await fileAccessService.assertCanAccessFileAsset(req.user, id, { ip: req.ip });
    const previewJob = require('../services/filePreviewJob.service');
    const result = await previewJob.processPreviewJob(id, {
      actorId: req.user._id,
      regenerate: true,
    });
    res.json({ success: true, data: { result } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.streamPreviewThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    const { asset } = await fileAccessService.assertCanAccessFileAsset(req.user, id, { ip: req.ip });
    const previewJob = require('../services/filePreviewJob.service');
    const manifest = await previewJob.getPreviewManifest(id);
    const filePath = previewJob.resolveSecurePreviewPath(manifest, 'thumbnail');
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'Preview not available' });
    }
    res.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: 'Preview unavailable' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.streamPreviewContent = async (req, res) => {
  try {
    const { id } = req.params;
    await fileAccessService.assertCanAccessFileAsset(req.user, id, { ip: req.ip });
    const previewJob = require('../services/filePreviewJob.service');
    const manifest = await previewJob.getPreviewManifest(id);
    const filePath = previewJob.resolveSecurePreviewPath(manifest, 'pdf');
    if (!filePath) {
      return res.status(404).json({ success: false, message: 'Preview content not available' });
    }
    const ext = require('path').extname(filePath).toLowerCase();
    const type = ext === '.pdf' ? 'application/pdf' : 'text/plain; charset=utf-8';
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: 'Preview content unavailable' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.createDownloadToken = async (req, res) => {
  try {
    const { id } = req.params;
    await fileAccessService.assertCanAccessFileAsset(req.user, id, {
      ip: req.ip,
      requestId: req.requestId,
    });
    const { token, expiresAt } = fileAccessService.createFileDownloadToken(id, req.user._id);
    res.json({
      success: true,
      data: {
        token,
        expiresAt,
        downloadUrl: `/api/files/${id}/download?token=${encodeURIComponent(token)}`,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

exports.downloadZipArchive = async (req, res) => {
  try {
    const { zipId } = req.params;
    const { token } = req.query;
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!zipId || !/^zip-\d+-[a-f0-9]+$/.test(zipId)) {
      return res.status(400).json({ success: false, message: 'Invalid zip id' });
    }
    if (!token || !fileAccessService.verifyFileDownloadToken(zipId, user._id, token)) {
      await ferpaAudit.recordFerpaEvent({
        actorId: user._id,
        action: 'ferpa_suspicious_access',
        entityType: 'file_asset',
        entityId: zipId,
        ip: req.ip,
        requestId: req.requestId,
        metadata: { reason: 'invalid_zip_download_token' },
      }).catch(() => {});
      return res.status(403).json({ success: false, message: 'Invalid or expired download token' });
    }

    const zipPath = path.join(ZIP_DIR, `${zipId}.zip`);
    if (!isPathInside(zipPath, ZIP_DIR) || !fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: 'ZIP archive not found or expired' });
    }

    await academicAuditService.recordAuditEvent({
      actorId: user._id,
      entityType: 'file_asset',
      entityId: 'bulk_zip',
      action: 'file_bulk_zip_download',
      ip: req.ip,
      requestId: req.requestId,
      metadata: { zipId },
    }).catch(() => {});

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(`${zipId}.zip`)}"`);
    const stream = fs.createReadStream(zipPath);
    stream.on('error', () => {
      if (!res.headersSent) res.status(404).json({ success: false, message: 'ZIP archive unavailable' });
    });
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  }
};
