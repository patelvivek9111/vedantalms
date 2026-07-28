const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const rubricController = require('../controllers/rubric.controller');

router.get('/', protect, authorize('teacher', 'admin'), rubricController.listRubrics);
router.post('/', protect, authorize('teacher', 'admin'), rubricController.createRubric);
router.post('/:id/copy', protect, authorize('teacher', 'admin'), rubricController.copyRubric);
router.get(
  '/:id/associations',
  protect,
  authorize('teacher', 'admin'),
  rubricController.getRubricAssociations
);
router.get('/:id', protect, rubricController.getRubric);
router.put('/:id', protect, authorize('teacher', 'admin'), rubricController.updateRubric);
router.delete('/:id', protect, authorize('teacher', 'admin'), rubricController.deleteRubric);

module.exports = router;
