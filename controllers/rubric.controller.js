const rubricService = require('../services/rubric.service');

exports.listRubrics = async (req, res) => {
  try {
    const rows = await rubricService.listRubrics({
      courseId: req.query.courseId,
      scope: req.query.scope,
      q: req.query.q,
      includeArchived:
        req.query.includeArchived === true || req.query.includeArchived === 'true',
      user: req.user,
      req,
    });
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.getRubric = async (req, res) => {
  try {
    const doc = await rubricService.getRubric(req.params.id, { user: req.user, req });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.createRubric = async (req, res) => {
  try {
    const doc = await rubricService.createRubric({
      title: req.body?.title,
      criteria: req.body?.criteria,
      courseId: req.body?.courseId,
      freeFormCriterionComments: req.body?.freeFormCriterionComments,
      user: req.user,
      req,
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.updateRubric = async (req, res) => {
  try {
    const doc = await rubricService.updateRubric(req.params.id, req.body || {}, {
      user: req.user,
      req,
    });
    return res.json({ success: true, data: doc });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
      associationCount: err.associationCount,
    });
  }
};

exports.deleteRubric = async (req, res) => {
  try {
    const result = await rubricService.deleteRubric(req.params.id, {
      user: req.user,
      req,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

exports.getRubricAssociations = async (req, res) => {
  try {
    const data = await rubricService.listRubricAssociations(req.params.id, {
      user: req.user,
      req,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

exports.copyRubric = async (req, res) => {
  try {
    const doc = await rubricService.copyRubric(req.params.id, {
      courseId: req.body?.courseId,
      title: req.body?.title,
      user: req.user,
      req,
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message });
  }
};
