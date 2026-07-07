import {
  GRADE_STATUS,
  getGradeStatusLabel,
  shouldShowStudentStatusBadge,
} from '@lms-shared/grading';
import type { StudentGradeRowDisplay } from '../components/grades/GradeStatusBadge';

export function formatWhatIfCurrentFromRow(
  row: StudentGradeRowDisplay,
  missingMode: 'count_as_zero' | 'exclude_until_graded' = 'count_as_zero'
): string {
  if (typeof row.grade === 'number') {
    return Number.isInteger(row.grade) ? String(row.grade) : row.grade.toFixed(2);
  }
  if (row.status === GRADE_STATUS.LATE) {
    return getGradeStatusLabel(GRADE_STATUS.LATE);
  }
  if (row.status === GRADE_STATUS.MISSING) {
    return missingMode === 'count_as_zero' ? '0 (missing)' : '-';
  }
  if (shouldShowStudentStatusBadge(row.status)) {
    return getGradeStatusLabel(row.status);
  }
  return row.scoreCell;
}
