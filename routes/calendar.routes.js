const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const calendarController = require('../controllers/calendar.controller');

router.get('/feed', protect, calendarController.getCalendarFeed);

module.exports = router;
