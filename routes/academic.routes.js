const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const academicController = require('../controllers/academic.controller');

router.get('/settings', protect, academicController.getAcademicSettings);
router.patch('/settings', protect, academicController.updateAcademicSettings);
router.post('/apply-calendar', protect, academicController.applyInstitutionCalendar);

module.exports = router;
