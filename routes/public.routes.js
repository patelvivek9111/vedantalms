const express = require('express');
const transcriptIssuance = require('../services/transcriptIssuance.service');

const router = express.Router();

/**
 * Public transcript verification (no auth).
 * GET /api/public/transcript/verify/:hash
 */
router.get('/transcript/verify/:hash', async (req, res) => {
  try {
    const data = await transcriptIssuance.verifyByHash(req.params.hash);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
});

module.exports = router;
