const express = require('express');
const { body } = require('express-validator');
const contactController = require('../controllers/contact.controller');

const router = express.Router();

router.post(
  '/inquiry',
  [
    body('name').trim().isLength({ min: 1, max: 120 }).withMessage('Name is required'),
    body('organization').trim().isLength({ min: 1, max: 200 }).withMessage('Organization is required'),
    body('jobTitle').trim().isLength({ min: 1, max: 120 }).withMessage('Your job title is required'),
    body('userCount').trim().isLength({ min: 1, max: 80 }).withMessage('Describe the number of users or scale'),
    body('extra').optional().trim().isLength({ max: 5000 }).withMessage('Additional details are too long'),
  ],
  contactController.postInquiry
);

module.exports = router;
