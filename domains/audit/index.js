module.exports = {
  services: [
    'services/academicAudit.service.js',
    'services/academicAuditTimeline.service.js',
    'services/ferpaAudit.service.js',
  ],
  models: ['models/systemAuditEvent.model.js', 'models/gradingPolicyAudit.model.js'],
};
