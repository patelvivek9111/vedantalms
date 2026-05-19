'use strict';

/**
 * Split a total assignment grade across questions (max per question = question.points).
 * Integer parts sum exactly to min(totalGrade, sum of max question points).
 */
function allocateQuestionGrades(totalGrade, questions) {
  const maxes = (questions || []).map((q) => Number(q.points) || 0);
  const maxSum = maxes.reduce((a, b) => a + b, 0);
  if (!maxes.length || !maxSum) return new Map();
  const cap = Math.round(Math.min(Math.max(0, Number(totalGrade) || 0), maxSum));
  const parts = maxes.map((m) => Math.floor((cap * m) / maxSum));
  let rem = cap - parts.reduce((a, b) => a + b, 0);
  const frac = maxes.map((m, i) => ({ i, r: (cap * m) / maxSum - parts[i] }));
  frac.sort((a, b) => b.r - a.r);
  let k = 0;
  while (rem > 0 && k < 10000) {
    const { i } = frac[k % frac.length];
    if (parts[i] < maxes[i]) {
      parts[i]++;
      rem--;
    }
    k++;
  }
  const map = new Map();
  parts.forEach((v, idx) => map.set(String(idx), v));
  return map;
}

function addHours(d, h) {
  const x = new Date(d);
  x.setTime(x.getTime() + h * 3600000);
  return x;
}

function addMinutes(d, m) {
  const x = new Date(d);
  x.setTime(x.getTime() + m * 60000);
  return x;
}

/** Two missing indices, three late indices among the rest (deterministic by module). */
function pickMissingAndLate(moduleIndex, studentCount) {
  const m1 = moduleIndex % studentCount;
  const m2 = (moduleIndex + 3) % studentCount;
  const missing = new Set([m1, m2]);
  const rest = [];
  for (let si = 0; si < studentCount; si++) {
    if (!missing.has(si)) rest.push(si);
  }
  const late = new Set(rest.slice(0, Math.min(3, rest.length)));
  return { missing, late };
}

function buildMcAutoQuestionGrades(assignmentQuestions, answersObj) {
  const map = new Map();
  if (!assignmentQuestions || !answersObj) return map;
  const getAns = (i) => {
    const k = String(i);
    if (answersObj instanceof Map) return answersObj.get(k);
    return answersObj[k];
  };
  assignmentQuestions.forEach((q, i) => {
    if (q.type !== 'multiple-choice') return;
    const studentAns = getAns(i);
    const correct = (q.options || []).find((o) => o.isCorrect);
    const ok = correct && String(studentAns) === String(correct.text);
    map.set(String(i), ok ? Number(q.points) || 0 : 0);
  });
  return map;
}

/**
 * Auto-style points for multiple-choice and matching (mirrors submission.controller matching logic).
 * Text questions get 0 here — merge with allocateQuestionGrades for seeded teacher marks.
 */
function computeMcMatchingQuestionGrades(assignmentQuestions, answersObj) {
  const map = new Map();
  if (!assignmentQuestions || !answersObj) return map;
  const getAns = (i) => {
    const k = String(i);
    if (answersObj instanceof Map) return answersObj.get(k);
    return answersObj[k];
  };
  assignmentQuestions.forEach((q, i) => {
    const k = String(i);
    const studentAns = getAns(i);
    if (q.type === 'multiple-choice') {
      const correct = (q.options || []).find((o) => o.isCorrect);
      const ok = correct && String(studentAns) === String(correct.text);
      map.set(k, ok ? Number(q.points) || 0 : 0);
      return;
    }
    if (q.type === 'matching') {
      let parsed = studentAns;
      if (typeof studentAns === 'string') {
        try {
          parsed = JSON.parse(studentAns);
        } catch {
          parsed = {};
        }
      }
      const leftItems = q.leftItems || [];
      const totalMatches = leftItems.length;
      let correctMatches = 0;
      for (let j = 0; j < totalMatches; j++) {
        const leftItem = leftItems[j];
        const studentMatch = parsed != null ? parsed[j] ?? parsed[String(j)] : undefined;
        const correctRightItem = (q.rightItems || []).find((r) => r.id === leftItem.id);
        if (correctRightItem && studentMatch === correctRightItem.text) correctMatches++;
      }
      let questionPoints = 0;
      if (totalMatches > 0) {
        const pct = correctMatches / totalMatches;
        questionPoints = Math.floor((Number(q.points) || 0) * pct * 100) / 100;
      }
      map.set(k, questionPoints);
    }
  });
  return map;
}

module.exports = {
  allocateQuestionGrades,
  addHours,
  addMinutes,
  pickMissingAndLate,
  buildMcAutoQuestionGrades,
  computeMcMatchingQuestionGrades,
};
