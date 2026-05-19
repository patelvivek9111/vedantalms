import { describe, expect, it } from 'vitest';
import {
  countNeedsGrading,
  filterGradebookStudents,
  studentNeedsGrading,
} from '../gradebookStatusUtils';

describe('gradebookStatusUtils', () => {
  const assignments = [
    { _id: 'a1', published: true, isDiscussion: false },
  ];
  const students = [
    { _id: 's1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.com' },
    { _id: 's2', firstName: 'Alan', lastName: 'Turing', email: 'alan@test.com' },
  ];

  it('detects submissions awaiting a grade', () => {
    const submissionMap = { s1_a1: 'sub1' };
    const grades = { s1: {} };
    expect(studentNeedsGrading('s1', assignments, grades, submissionMap)).toBe(true);
  });

  it('filters by search and needs grading mode', () => {
    const submissionMap = { s1_a1: 'sub1' };
    const grades = { s1: {}, s2: { a1: 90 } };
    const weighted = { s1: 65, s2: 92 };
    const filtered = filterGradebookStudents(students, 'needsGrading', '', {
      assignments,
      grades,
      submissionMap,
      weightedByStudent: weighted,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]._id).toBe('s1');
    expect(countNeedsGrading(students, assignments, grades, submissionMap)).toBe(1);
  });

  it('filters at-risk students below 70%', () => {
    const filtered = filterGradebookStudents(students, 'atRisk', '', {
      assignments,
      grades: {},
      submissionMap: {},
      weightedByStudent: { s1: 65, s2: 92 },
    });
    expect(filtered.map((s) => s._id)).toEqual(['s1']);
  });
});
