const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const opsController = require('../controllers/ops.controller');

router.get(
  '/dashboard',
  protect,
  authorize('admin', 'registrar', 'department_admin'),
  opsController.getOpsDashboard
);

module.exports = router;
