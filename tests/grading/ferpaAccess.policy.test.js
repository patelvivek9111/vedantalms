const {
  canAccessStudentRecord,
  canViewCourseGrades,
  canEditRawSubmission,
  canFinalizeGrades,
  isCourseGradingStaff,
} = require('../../middleware/academicPermissions');

describe('FERPA access controls (Phase G)', () => {
  const course = {
    _id: 'course1',
    instructor: 'teacher1',
    students: ['student1', 'student2'],
    teachingAssistants: ['ta1'],
  };

  const student = { _id: 'student1', role: 'student' };
  const otherStudent = { _id: 'student2', role: 'student' };
  const teacher = { _id: 'teacher1', role: 'teacher' };
  const ta = { _id: 'ta1', role: 'teaching_assistant' };
  const registrar = { _id: 'reg1', role: 'registrar' };
  const admin = { _id: 'admin1', role: 'admin' };

  test('student can only access own record', () => {
    expect(canAccessStudentRecord(student, 'student1')).toBe(true);
    expect(canAccessStudentRecord(student, 'student2')).toBe(false);
    expect(canAccessStudentRecord(admin, 'student2')).toBe(true);
  });

  test('student can view grades only when enrolled', () => {
    expect(canViewCourseGrades(student, course)).toBe(true);
    expect(canViewCourseGrades(otherStudent, { ...course, students: ['student1'] })).toBe(false);
  });

  test('TA is scoped to assigned course', () => {
    expect(isCourseGradingStaff(ta, course)).toBe(true);
    expect(isCourseGradingStaff(ta, { ...course, teachingAssistants: [] })).toBe(false);
  });

  test('registrar cannot edit raw submissions', () => {
    expect(canEditRawSubmission(registrar, course)).toBe(false);
    expect(canEditRawSubmission(teacher, course)).toBe(true);
    expect(canEditRawSubmission(admin, course)).toBe(true);
  });

  test('registrar can finalize; teacher cannot', () => {
    expect(canFinalizeGrades(registrar)).toBe(true);
    expect(canFinalizeGrades(teacher)).toBe(false);
    expect(canFinalizeGrades(admin)).toBe(true);
  });
});
