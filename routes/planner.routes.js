const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const plannerController = require('../controllers/planner.controller');

router.get('/feed', protect, plannerController.getPlannerFeed);
router.get('/states', protect, plannerController.getPlannerStates);
router.post('/items/:itemKey/dismiss', protect, plannerController.dismissPlannerItem);
router.post('/items/:itemKey/snooze', protect, plannerController.snoozePlannerItem);
router.delete('/items/:itemKey', protect, plannerController.clearPlannerItem);

module.exports = { router };
