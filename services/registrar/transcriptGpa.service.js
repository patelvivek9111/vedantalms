/**
 * GPA point maps + repeated-course resolution for official transcripts.
 */

const US_4 = {
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

const INDIA_10 = {
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

/** CBSE-style letter → grade point (same 10-point table; legend differs in PDF). */
const CBSE_CGPA = { ...INDIA_10 };

const SCALE_MAPS = {
  us_4: US_4,
  india_10: INDIA_10,
  cbse_cgpa: CBSE_CGPA,
};

const SCALE_LABELS = {
  us_4: '4.0 GPA scale',
  india_10: '10-point GPA scale',
  cbse_cgpa: 'CBSE CGPA (10-point)',
};

function getGradePoints(letterGrade, gpaScale = 'india_10') {
  const map = SCALE_MAPS[gpaScale] || INDIA_10;
  return map[letterGrade] ?? 0;
}

/**
 * @param {Array<{ courseId: string, letterGrade: string, creditHours?: number, courseCode?: string }>} rows
 * @param {{ gpaScale?: string, repeatedCoursePolicy?: 'highest'|'latest'|'average' }} options
 */
function resolveRepeatedCourses(rows, { repeatedCoursePolicy = 'highest' } = {}) {
  const byKey = new Map();
  for (const row of rows) {
    const key = String(row.courseCode || row.courseId);
    const list = byKey.get(key) || [];
    list.push(row);
    byKey.set(key, list);
  }

  const resolved = [];
  for (const [, list] of byKey) {
    if (list.length === 1) {
      resolved.push(list[0]);
      continue;
    }
    if (repeatedCoursePolicy === 'latest') {
      resolved.push(list[list.length - 1]);
      continue;
    }
    if (repeatedCoursePolicy === 'average') {
      const credits = list.map((r) => Number(r.creditHours) || 0);
      const totalCredits = credits.reduce((a, b) => a + b, 0) || list.length;
      const points = list.map((r, i) => {
        const c = credits[i] || 1;
        return getGradePoints(r.letterGrade) * c;
      });
      const avgPoints = points.reduce((a, b) => a + b, 0) / totalCredits;
      resolved.push({
        ...list[list.length - 1],
        creditHours: totalCredits / list.length,
        _averagedPoints: avgPoints,
        _repeatCount: list.length,
      });
      continue;
    }
    // highest
    let best = list[0];
    let bestPts = getGradePoints(best.letterGrade);
    for (const row of list.slice(1)) {
      const pts = getGradePoints(row.letterGrade);
      if (pts > bestPts) {
        best = row;
        bestPts = pts;
      }
    }
    resolved.push({ ...best, _repeatCount: list.length });
  }
  return resolved;
}

function calculateGpa(rows, { gpaScale = 'india_10', repeatedCoursePolicy = 'highest' } = {}) {
  const resolved = resolveRepeatedCourses(rows, { repeatedCoursePolicy });
  let totalPoints = 0;
  let totalCredits = 0;
  for (const row of resolved) {
    const credits = Number(row.creditHours) || 0;
    if (row._averagedPoints != null) {
      totalPoints += row._averagedPoints * (credits || 1);
      totalCredits += credits || 1;
      continue;
    }
    const pts = getGradePoints(row.letterGrade, gpaScale);
    totalPoints += pts * (credits || 1);
    totalCredits += credits || 1;
  }
  return {
    gpa: totalCredits > 0 ? Math.round((totalPoints / totalCredits) * 100) / 100 : 0,
    totalCredits,
    courseCount: resolved.length,
    gpaScale,
    scaleLabel: SCALE_LABELS[gpaScale] || gpaScale,
    repeatedCoursePolicy,
    legend: Object.entries(SCALE_MAPS[gpaScale] || INDIA_10).map(([letter, points]) => ({
      letter,
      points,
    })),
  };
}

module.exports = {
  SCALE_MAPS,
  SCALE_LABELS,
  getGradePoints,
  resolveRepeatedCourses,
  calculateGpa,
};
