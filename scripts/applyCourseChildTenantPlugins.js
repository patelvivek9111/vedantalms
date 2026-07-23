/**
 * One-shot: apply courseChildTenantPlugin to course-child models missing tenancy.
 * Run: node scripts/applyCourseChildTenantPlugins.js
 */
const fs = require('fs');
const path = require('path');

const TARGETS = [
  { file: 'models/module.model.js', schema: 'moduleSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/Assignment.js', schema: 'assignmentSchema', opts: "{ modulePath: 'module' }" },
  { file: 'models/Submission.js', schema: 'submissionSchema', opts: "{ modulePath: 'assignment' }" },
  { file: 'models/page.model.js', schema: 'pageSchema', opts: "{ modulePath: 'module' }" },
  { file: 'models/thread.model.js', schema: 'threadSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/announcement.model.js', schema: 'announcementSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/poll.model.js', schema: 'pollSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/Group.js', schema: 'groupSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/GroupSet.js', schema: 'groupSetSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/attendance.model.js', schema: 'attendanceSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/courseEnrollmentGrade.model.js', schema: 'courseEnrollmentGradeSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/discussionReply.model.js', schema: 'discussionReplySchema', opts: "{}" },
  { file: 'models/todo.model.js', schema: 'todoSchema', opts: "{ coursePath: 'courseId' }" },
  { file: 'models/event.model.js', schema: 'eventSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/courseGradingPolicy.model.js', schema: 'courseGradingPolicySchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/courseGradingPeriod.model.js', schema: 'courseGradingPeriodSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/studentCourseGradeSnapshot.model.js', schema: 'studentCourseGradeSnapshotSchema', opts: "{ coursePath: 'course' }" },
  { file: 'models/gradeAmendmentRecord.model.js', schema: 'gradeAmendmentRecordSchema', opts: "{ coursePath: 'course' }" },
];

const requireLine =
  "const { courseChildTenantPlugin } = require('./plugins/courseChildTenant.plugin');\n";

for (const t of TARGETS) {
  const p = path.join(__dirname, '..', t.file);
  if (!fs.existsSync(p)) {
    console.warn('missing', t.file);
    continue;
  }
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('courseChildTenantPlugin')) {
    console.log('already', t.file);
    continue;
  }
  // Detect actual schema var
  const schemaMatch = src.match(/const\s+(\w*[Ss]chema)\s*=/);
  const schemaName = schemaMatch ? schemaMatch[1] : t.schema;
  if (!src.includes(`const ${schemaName}`)) {
    console.warn('schema not found', t.file, schemaName);
    continue;
  }
  if (!src.includes("require('mongoose')") && !src.includes('require("mongoose")')) {
    console.warn('no mongoose', t.file);
    continue;
  }
  src = src.replace(
    /const mongoose = require\(['"]mongoose['"]\);?/,
    (m) => `${m}\n${requireLine.trim()}`
  );
  const pluginLine = `${schemaName}.plugin(courseChildTenantPlugin, ${t.opts});\n\n`;
  if (src.includes('module.exports = mongoose.model')) {
    src = src.replace(/module\.exports = mongoose\.model/, `${pluginLine}module.exports = mongoose.model`);
  } else if (src.includes('module.exports =')) {
    src = src.replace(/module\.exports =/, `${pluginLine}module.exports =`);
  } else {
    console.warn('no exports', t.file);
    continue;
  }
  fs.writeFileSync(p, src);
  console.log('patched', t.file, schemaName);
}
