import axios from 'axios';
import { API_URL } from '../config';

const DEFAULT_BATCH_MAX = 25;

export type CourseAverageResult = {
  average?: number | null;
  studentCount?: number;
  gradedCount?: number;
  error?: string;
};

function parseAverage(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  return undefined;
}

/**
 * Fetch class averages for many courses in batched requests (P2-5).
 */
export async function fetchCourseAveragesBatch(
  courseIds: string[],
  headers: Record<string, string> = {},
  batchMax = DEFAULT_BATCH_MAX
): Promise<Record<string, CourseAverageResult>> {
  const uniqueIds = [...new Set(courseIds.map(String).filter(Boolean))];
  const results: Record<string, CourseAverageResult> = {};

  if (!uniqueIds.length) return results;

  for (let i = 0; i < uniqueIds.length; i += batchMax) {
    const chunk = uniqueIds.slice(i, i + batchMax);
    try {
      const response = await axios.get(
        `${API_URL}/api/grades/courses/averages?courseIds=${chunk.join(',')}`,
        { headers, timeout: 120000 }
      );
      const averages = response.data?.averages || {};
      chunk.forEach((courseId) => {
        results[courseId] = averages[courseId] || { average: null };
      });
    } catch {
      chunk.forEach((courseId) => {
        results[courseId] = { average: null, error: 'fetch_failed' };
      });
    }
  }

  return results;
}

export async function attachClassAveragesToCourses<T extends { _id: string }>(
  courses: T[],
  headers: Record<string, string> = {}
): Promise<Array<T & { classAverage?: number }>> {
  if (!courses.length) return [];

  const averages = await fetchCourseAveragesBatch(
    courses.map((course) => course._id),
    headers
  );

  return courses.map((course) => ({
    ...course,
    classAverage: parseAverage(averages[course._id]?.average),
  }));
}
