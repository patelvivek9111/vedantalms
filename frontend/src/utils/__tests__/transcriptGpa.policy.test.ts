/**
 * Case 10 — Transcript GPA / semester totals (credit-weighted).
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSGPA,
  calculateCGPA,
  calculateSemesterGPA,
  calculateOverallGPA,
  getIndianGradePoints,
  getUSGradePoints,
} from '../transcriptGpa';
import { case10TranscriptCourses } from '../../test/grading/fixtures';
import {
  calculateFinalGradeWithWeightedGroups,
  getLetterGrade,
} from '../gradeUtils';
import { case1StandardWeighted } from '../../test/grading/fixtures';

describe('Transcript GPA policy (Case 10)', () => {
  const courses = case10TranscriptCourses();

  it('maps letter grades to Indian grade points', () => {
    expect(getIndianGradePoints('A')).toBe(9);
    expect(getIndianGradePoints('B')).toBe(6);
    expect(getIndianGradePoints('F')).toBe(0);
  });

  it('maps letter grades to US 4.0 points', () => {
    expect(getUSGradePoints('A')).toBe(4);
    expect(getUSGradePoints('B')).toBe(3);
    expect(getUSGradePoints('F')).toBe(0);
  });

  it('calculates credit-weighted SGPA/CGPA (Indian 10-point)', () => {
    // (9*3 + 6*4 + 4.5*3) / 10 = 6.15
    const expected = (9 * 3 + 6 * 4 + 4.5 * 3) / 10;
    expect(calculateSGPA(courses)).toBeCloseTo(expected, 5);
    expect(calculateCGPA(courses)).toBeCloseTo(expected, 5);
  });

  it('calculates credit-weighted semester/overall GPA (US 4.0)', () => {
    // (4*3 + 3*4 + 2*3) / 10 = 3.0
    expect(calculateSemesterGPA(courses)).toBeCloseTo(3.0, 5);
    expect(calculateOverallGPA(courses)).toBeCloseTo(3.0, 5);
  });

  it('transcript course letter matches gradebook calculation for standard scenario', () => {
    const s = case1StandardWeighted();
    const submissionByAssignment: Record<string, unknown> = {};
    for (const a of s.assignments) {
      const key = `${s.studentId}_${a._id}`;
      if (s.submissionMap[key]) submissionByAssignment[a._id] = {};
    }
    const percent = calculateFinalGradeWithWeightedGroups(
      s.studentId,
      s.course,
      s.assignments,
      s.grades,
      submissionByAssignment
    );
    const letter = getLetterGrade(percent, s.course.gradeScale);
    expect(percent).toBeCloseTo(83, 5);
    expect(letter).toBe('B');
  });
});
