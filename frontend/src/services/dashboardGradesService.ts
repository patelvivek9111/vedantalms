import api from './api';

const DEFAULT_BATCH_MAX = 25;
const STORAGE_PREFIX = 'mysl8te:dashboard-grades:';

export type DashboardGradeEntry = {
  grade: number | null;
  letter?: string;
};

export type StudentCourseGradeSummary = {
  totalPercent: number | null;
  letterGrade?: string;
};

export type CourseAverageResult = {
  average?: number | null;
  studentCount?: number;
  gradedCount?: number;
  error?: string;
};

export function readDashboardGradesCache(userId: string): Record<string, DashboardGradeEntry> {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { grades?: Record<string, DashboardGradeEntry> };
    return parsed?.grades && typeof parsed.grades === 'object' ? parsed.grades : {};
  } catch {
    return {};
  }
}

export function writeDashboardGradesCache(
  userId: string,
  grades: Record<string, DashboardGradeEntry>
): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${userId}`,
      JSON.stringify({ grades, at: Date.now() })
    );
  } catch {
    // ignore quota / private mode
  }
}

function summaryToDashboardEntry(
  summary: StudentCourseGradeSummary
): DashboardGradeEntry {
  const totalPercent = summary.totalPercent;
  const hasGrade =
    totalPercent !== null &&
    totalPercent !== undefined &&
    typeof totalPercent === 'number' &&
    !Number.isNaN(totalPercent);
  return {
    grade: hasGrade ? totalPercent : null,
    letter: summary.letterGrade || '',
  };
}

function averageToDashboardEntry(average: CourseAverageResult): DashboardGradeEntry {
  const value = average.average;
  const hasAverage =
    value !== null && value !== undefined && typeof value === 'number' && !Number.isNaN(value);
  return { grade: hasAverage ? value : null };
}

/** Batch fetch student course totals for dashboard cards (one request). */
export async function fetchStudentCourseGradesBatch(
  courseIds: string[],
  batchMax = DEFAULT_BATCH_MAX
): Promise<Record<string, DashboardGradeEntry>> {
  const uniqueIds = [...new Set(courseIds.map(String).filter(Boolean))];
  const results: Record<string, DashboardGradeEntry> = {};
  if (!uniqueIds.length) return results;

  for (let i = 0; i < uniqueIds.length; i += batchMax) {
    const chunk = uniqueIds.slice(i, i + batchMax);
    try {
      const response = await api.get(`/grades/student/summary?courseIds=${chunk.join(',')}`, {
        timeout: 120000,
      });
      const grades = response.data?.grades || {};
      chunk.forEach((courseId) => {
        results[courseId] = summaryToDashboardEntry(
          grades[courseId] || { totalPercent: null, letterGrade: '' }
        );
      });
    } catch {
      chunk.forEach((courseId) => {
        results[courseId] = { grade: null, letter: '' };
      });
    }
  }

  return results;
}

/** Batch fetch class averages for teacher/admin dashboard cards. */
export async function fetchCourseAveragesBatch(
  courseIds: string[],
  batchMax = DEFAULT_BATCH_MAX
): Promise<Record<string, DashboardGradeEntry>> {
  const uniqueIds = [...new Set(courseIds.map(String).filter(Boolean))];
  const results: Record<string, DashboardGradeEntry> = {};
  if (!uniqueIds.length) return results;

  for (let i = 0; i < uniqueIds.length; i += batchMax) {
    const chunk = uniqueIds.slice(i, i + batchMax);
    try {
      const response = await api.get(`/grades/courses/averages?courseIds=${chunk.join(',')}`, {
        timeout: 120000,
      });
      const averages = response.data?.averages || {};
      chunk.forEach((courseId) => {
        results[courseId] = averageToDashboardEntry(averages[courseId] || { average: null });
      });
    } catch {
      chunk.forEach((courseId) => {
        results[courseId] = { grade: null };
      });
    }
  }

  return results;
}
