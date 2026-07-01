const Todo = require('../models/todo.model');
const Course = require('../models/course.model');

/** Remove all to-dos tied to a course (enrollment, waitlist, etc.). */
async function deleteTodosForCourse(courseId) {
  const result = await Todo.deleteMany({ courseId });
  return result.deletedCount;
}

/** Drop to-dos whose courseId no longer exists (e.g. after manual DB cleanup). */
async function pruneOrphanCourseTodosForUser(userId) {
  const todos = await Todo.find({ user: userId, courseId: { $ne: null } })
    .select('_id courseId')
    .lean();
  if (!todos.length) return 0;

  const courseIds = [...new Set(todos.map((t) => String(t.courseId)))];
  const existing = await Course.find({ _id: { $in: courseIds } }).select('_id').lean();
  const existSet = new Set(existing.map((c) => String(c._id)));
  const orphanIds = todos
    .filter((t) => !existSet.has(String(t.courseId)))
    .map((t) => t._id);

  if (!orphanIds.length) return 0;
  const result = await Todo.deleteMany({ _id: { $in: orphanIds } });
  return result.deletedCount;
}

module.exports = {
  deleteTodosForCourse,
  pruneOrphanCourseTodosForUser,
};
