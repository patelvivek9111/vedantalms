const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const eventController = require('../controllers/event.controller');

router.get('/', protect, eventController.getEvents);
router.post('/', protect, eventController.createEvent);
router.get('/:id', protect, eventController.getEventById);
router.put('/:id', protect, authorize('teacher', 'admin'), eventController.updateEvent);
router.delete('/:id', protect, eventController.deleteEvent);

module.exports = router; 