const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const jobsController = require('../controllers/jobs.controller');

router.get('/:jobId', protect, jobsController.getJobStatus);
router.get('/:jobId/download', protect, jobsController.downloadJobExport);

module.exports = router;
