/**
 * Grading domain boundary (organizational — not microservices).
 */
module.exports = {
  services: [
    'services/gradeCalculation.service.js',
    'services/gradeLifecycle.service.js',
    'services/gradingPolicy.service.js',
    'services/gradingPolicySnapshot.service.js',
    'services/gradebookData.service.js',
    'services/gradebookExport.service.js',
    'services/policyRedisCache.service.js',
  ],
  models: [
    'models/courseGradingPolicy.model.js',
    'models/institutionGradingPolicy.model.js',
    'models/studentCourseGradeSnapshot.model.js',
    'models/courseGradeLifecycle.model.js',
  ],
  exports: ['services/export/institutionalExport.service.js — gradeSnapshots section'],
};
