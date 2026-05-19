import { useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { usePersistedState } from '../../hooks/usePersistedState';
import {
  countNeedsGrading,
  filterGradebookStudents,
  type GradebookFilterMode,
} from './gradebookStatusUtils';

export function useGradebookFilters(
  courseId: string,
  students: any[],
  assignments: any[],
  grades: { [studentId: string]: { [assignmentId: string]: number | string } },
  submissionMap: Record<string, string>,
  weightedByStudent: Record<string, number>
) {
  const [search, setSearch] = usePersistedState(`gradebook-search-${courseId}`, '');
  const [filterMode, setFilterMode] = usePersistedState<GradebookFilterMode>(
    `gradebook-filter-${courseId}`,
    'all'
  );
  const debouncedSearch = useDebounce(search, 250);

  const filteredStudents = useMemo(
    () =>
      filterGradebookStudents(students, filterMode, debouncedSearch, {
        assignments,
        grades,
        submissionMap,
        weightedByStudent,
      }),
    [students, filterMode, debouncedSearch, assignments, grades, submissionMap, weightedByStudent]
  );

  const needsGradingCount = useMemo(
    () => countNeedsGrading(students, assignments, grades, submissionMap),
    [students, assignments, grades, submissionMap]
  );

  return {
    search,
    setSearch,
    filterMode,
    setFilterMode,
    filteredStudents,
    needsGradingCount,
  };
}
