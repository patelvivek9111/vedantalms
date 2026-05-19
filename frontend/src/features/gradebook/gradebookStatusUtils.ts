/**
 * Display-only helpers for instructor gradebook filters (no grading math changes).
 */

export type GradebookFilterMode = 'all' | 'needsGrading' | 'atRisk';

export function studentNeedsGrading(
  studentId: string,
  assignments: any[],
  grades: { [studentId: string]: { [assignmentId: string]: number | string } },
  submissionMap: Record<string, string>
): boolean {
  for (const assignment of assignments) {
    if (!assignment.published && !assignment.isDiscussion) continue;
    const key = `${studentId}_${assignment._id}`;
    const hasSubmission = assignment.isDiscussion
      ? Array.isArray(assignment.replies) &&
        assignment.replies.some(
          (r: any) => r.author && (r.author._id === studentId || r.author === studentId)
        )
      : Boolean(submissionMap[key]);
    const grade = grades[studentId]?.[assignment._id];
    if (hasSubmission && typeof grade !== 'number') return true;
  }
  return false;
}

export function filterGradebookStudents(
  students: any[],
  mode: GradebookFilterMode,
  search: string,
  ctx: {
    assignments: any[];
    grades: { [studentId: string]: { [assignmentId: string]: number | string } };
    submissionMap: Record<string, string>;
    weightedByStudent: Record<string, number>;
  }
): any[] {
  const q = search.trim().toLowerCase();
  return students.filter((student) => {
    const name = `${student.firstName} ${student.lastName}`.toLowerCase();
    const email = String(student.email || '').toLowerCase();
    if (q && !name.includes(q) && !email.includes(q)) return false;

    if (mode === 'needsGrading') {
      return studentNeedsGrading(student._id, ctx.assignments, ctx.grades, ctx.submissionMap);
    }
    if (mode === 'atRisk') {
      const pct = ctx.weightedByStudent[student._id] ?? 0;
      return pct < 70;
    }
    return true;
  });
}

export function countNeedsGrading(
  students: any[],
  assignments: any[],
  grades: { [studentId: string]: { [assignmentId: string]: number | string } },
  submissionMap: Record<string, string>
): number {
  return students.filter((s) => studentNeedsGrading(s._id, assignments, grades, submissionMap)).length;
}
