const mongoose = require('mongoose');
const { tenantScopePlugin } = require('./tenantScope.plugin');

/**
 * Stamp rootAccountId from a related Course (or Module/Assignment chain) when missing.
 */
function courseChildTenantPlugin(schema, options = {}) {
  schema.plugin(tenantScopePlugin, options);

  const coursePath = options.coursePath || 'course';
  const modulePath = options.modulePath || null;

  schema.pre('validate', async function (next) {
    try {
      if (this.rootAccountId) return next();

      let courseId = coursePath && this[coursePath] ? this[coursePath] : null;

      if (!courseId && modulePath && this[modulePath]) {
        const refId = this[modulePath];
        // Assignment → Module → Course
        if (modulePath === 'assignment' || modulePath === 'assignmentId') {
          try {
            const Assignment = mongoose.model('Assignment');
            const asg = await Assignment.findById(refId).select('module rootAccountId').lean();
            if (asg?.rootAccountId) {
              this.rootAccountId = asg.rootAccountId;
              this.accountId = this.accountId || asg.rootAccountId;
              return next();
            }
            if (asg?.module) {
              const Module = mongoose.model('Module');
              const mod = await Module.findById(asg.module).select('course rootAccountId').lean();
              if (mod?.rootAccountId) {
                this.rootAccountId = mod.rootAccountId;
                this.accountId = this.accountId || mod.rootAccountId;
                return next();
              }
              courseId = mod?.course;
            }
          } catch {
            /* model may not be registered yet */
          }
        } else {
          try {
            const Module = mongoose.model('Module');
            const mod = await Module.findById(refId).select('course rootAccountId').lean();
            if (mod?.rootAccountId) {
              this.rootAccountId = mod.rootAccountId;
              this.accountId = this.accountId || mod.rootAccountId;
              return next();
            }
            courseId = mod?.course;
          } catch {
            /* ignore */
          }
        }
      }

      if (courseId) {
        try {
          const Course = mongoose.model('Course');
          const course = await Course.findById(courseId).select('rootAccountId accountId').lean();
          if (course?.rootAccountId) {
            this.rootAccountId = course.rootAccountId;
            this.accountId = this.accountId || course.accountId || course.rootAccountId;
          }
        } catch {
          /* ignore */
        }
      }
      return next();
    } catch (err) {
      return next(err);
    }
  });
}

module.exports = { courseChildTenantPlugin };
