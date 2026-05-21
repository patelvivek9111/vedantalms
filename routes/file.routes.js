const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const fileController = require('../controllers/file.controller');

router.use(protect);

router.get('/list', fileController.listCourseFiles);
router.post('/batch-metadata', fileController.batchFileMetadata);
router.get('/zip/:zipId/download', fileController.downloadZipArchive);

router.get('/:id/metadata', fileController.getFileMetadata);
router.get('/:id/preview', fileController.getPreviewInfo);
router.post('/:id/preview/regenerate', fileController.regeneratePreview);
router.get('/:id/preview/thumbnail', fileController.streamPreviewThumbnail);
router.get('/:id/preview/content', fileController.streamPreviewContent);
router.get('/:id/versions', fileController.getFileVersions);
router.get('/:id/download', fileController.downloadFile);
router.get('/:id/stream', fileController.streamFile);
router.post('/:id/download-token', fileController.createDownloadToken);

module.exports = router;
