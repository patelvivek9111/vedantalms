const express = require('express');
const { claim, claimValidators } = require('../controllers/studentActivation.controller');

const router = express.Router();

router.post('/claim', claimValidators, claim);

module.exports = router;
