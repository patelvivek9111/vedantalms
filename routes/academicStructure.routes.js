const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/academicStructure.controller');

const router = express.Router();

const termRoles = ['admin', 'registrar', 'department_admin', 'platform_admin'];
const offeringRoles = ['admin', 'registrar', 'department_admin', 'teacher', 'platform_admin'];

router.get('/terms', protect, ctrl.listTerms);
router.get('/terms/:id', protect, ctrl.getTerm);
router.post('/terms', protect, authorize(...termRoles), ctrl.createTerm);
router.patch('/terms/:id', protect, authorize(...termRoles), ctrl.updateTerm);

router.get('/offerings', protect, ctrl.listOfferings);
router.post('/offerings', protect, authorize(...offeringRoles), ctrl.createOffering);
router.patch('/offerings/:id', protect, authorize(...offeringRoles), ctrl.updateOffering);

router.get('/sections', protect, ctrl.listSections);
router.post('/sections', protect, authorize(...offeringRoles), ctrl.createSection);
router.patch('/sections/:id', protect, authorize(...offeringRoles), ctrl.patchSection);
router.post(
  '/courses/:courseId/link-structure',
  protect,
  authorize(...offeringRoles),
  ctrl.linkCourseToStructure
);

router.get('/cross-lists', protect, ctrl.listCrossLists);
router.post('/cross-lists/preview', protect, authorize(...termRoles), ctrl.previewCrossListRemount);
router.get('/cross-lists/:id', protect, ctrl.getCrossList);
router.post('/cross-lists', protect, authorize(...termRoles), ctrl.createCrossList);
router.patch('/cross-lists/:id', protect, authorize(...termRoles), ctrl.updateCrossList);
router.get('/courses/:courseId/cross-list-siblings', protect, ctrl.listCrossListSiblings);

module.exports = router;
