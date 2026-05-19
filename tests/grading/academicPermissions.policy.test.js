const {
  canGradeDraft,
  canPostGrades,
  canFinalizeGrades,
  canAmendGrades,
  hasCapability,
  CAPABILITIES,
} = require('../../middleware/academicPermissions');

describe('academicPermissions', () => {
  const course = {
    _id: 'course1',
    instructor: 'teacher1',
    teachingAssistants: ['ta1'],
  };

  it('teacher can post but not finalize', () => {
    const teacher = { _id: 'teacher1', role: 'teacher' };
    expect(canPostGrades(teacher, course)).toBe(true);
    expect(canFinalizeGrades(teacher)).toBe(false);
    expect(canAmendGrades(teacher)).toBe(false);
  });

  it('teaching_assistant can draft but not post', () => {
    const ta = { _id: 'ta1', role: 'teaching_assistant' };
    expect(canGradeDraft(ta, course)).toBe(true);
    expect(canPostGrades(ta, course)).toBe(false);
  });

  it('registrar can finalize and amend', () => {
    const registrar = { _id: 'r1', role: 'registrar' };
    expect(canFinalizeGrades(registrar)).toBe(true);
    expect(canAmendGrades(registrar)).toBe(true);
    expect(hasCapability(registrar, CAPABILITIES.MANAGE_INSTITUTION_POLICY)).toBe(true);
  });

  it('admin retains full capabilities', () => {
    const admin = { _id: 'a1', role: 'admin' };
    expect(canFinalizeGrades(admin)).toBe(true);
    expect(canAmendGrades(admin)).toBe(true);
  });
});
