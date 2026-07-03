const GroupSet = require('../models/GroupSet');
const Course = require('../models/course.model');
const { isCourseGradingStaff, isEnrolledStudent } = require('../middleware/academicPermissions');

function canAccessCourseGroupData(user, course) {
  if (!user || !course) return false;
  if (user.role === 'admin') return true;
  if (isCourseGradingStaff(user, course)) return true;
  return isEnrolledStudent(user, course);
}

function isGroupMember(user, group) {
  return (group?.members || []).some((memberId) => String(memberId) === String(user._id));
}

async function loadGroupSetWithCourse(setId) {
  const groupSet = await GroupSet.findById(setId);
  if (!groupSet) return null;
  const course = await Course.findById(groupSet.course);
  if (!course) return { groupSet, course: null };
  return { groupSet, course };
}

module.exports = {
  canAccessCourseGroupData,
  isGroupMember,
  loadGroupSetWithCourse,
  isCourseGradingStaff,
};
