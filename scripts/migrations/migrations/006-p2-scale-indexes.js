/**
 * P2 scale indexes — student catalog sort, catalog dates, admin role queries.
 */
module.exports = {
  id: '006-p2-scale-indexes',
  description: 'Sync P2 scale foundation indexes (Course catalog/student, User role)',
  async up({ mongoose }) {
    const Course = require('../../../models/course.model');
    const User = require('../../../models/user.model');

    await Course.syncIndexes();
    await User.syncIndexes();

    return {
      collections: ['courses', 'users'],
    };
  },
};
