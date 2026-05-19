/** Letter-grade → GPA point maps used by Transcript (US 4.0 and Indian 10.0). */

export interface TranscriptCourseGrade {
  letterGrade: string;
  creditHours?: number;
}

export function getIndianGradePoints(letterGrade: string): number {
  const gradeMap: Record<string, number> = {
    'A+': 10.0,
    A: 9.0,
    'A-': 8.0,
    'B+': 7.0,
    B: 6.0,
    'B-': 5.5,
    'C+': 5.0,
    C: 4.5,
    'C-': 4.0,
    'D+': 3.5,
    D: 3.0,
    'D-': 2.0,
    F: 0.0,
  };
  return gradeMap[letterGrade] ?? 0;
}

export function getUSGradePoints(letterGrade: string): number {
  const gradeMap: Record<string, number> = {
    'A+': 4.0,
    A: 4.0,
    'A-': 3.7,
    'B+': 3.3,
    B: 3.0,
    'B-': 2.7,
    'C+': 2.3,
    C: 2.0,
    'C-': 1.7,
    'D+': 1.3,
    D: 1.0,
    'D-': 0.7,
    F: 0.0,
  };
  return gradeMap[letterGrade] ?? 0;
}

export function calculateCreditWeightedGPA(
  courses: TranscriptCourseGrade[],
  getPoints: (letter: string) => number
): number {
  if (courses.length === 0) return 0;
  let totalPoints = 0;
  let totalCredits = 0;
  for (const course of courses) {
    const credits = course.creditHours || 0;
    totalPoints += getPoints(course.letterGrade) * credits;
    totalCredits += credits;
  }
  return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

export const calculateSGPA = (courses: TranscriptCourseGrade[]) =>
  calculateCreditWeightedGPA(courses, getIndianGradePoints);

export const calculateCGPA = (courses: TranscriptCourseGrade[]) =>
  calculateCreditWeightedGPA(courses, getIndianGradePoints);

export const calculateSemesterGPA = (courses: TranscriptCourseGrade[]) =>
  calculateCreditWeightedGPA(courses, getUSGradePoints);

export const calculateOverallGPA = (courses: TranscriptCourseGrade[]) =>
  calculateCreditWeightedGPA(courses, getUSGradePoints);
