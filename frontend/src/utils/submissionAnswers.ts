export type ParsedAnswers = Record<number, string | Record<number, string>>;

function parseStoredAnswer(
  answer: unknown,
  questionType?: string
): string | Record<number, string> {
  if (typeof answer === 'object' && answer !== null && !Array.isArray(answer)) {
    return answer as Record<number, string>;
  }
  if (typeof answer === 'number') return String(answer);
  if (typeof answer !== 'string') return answer != null ? String(answer) : '';
  if (questionType === 'matching' || answer.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(answer);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<number, string>;
      }
    } catch {
      // plain text
    }
  }
  return answer;
}

/** Normalize submission.answers from API (Map, object, or string keys) into numeric-indexed answers. */
export function parseSubmissionAnswers(
  raw: unknown,
  questions?: Array<{ type?: string }>
): ParsedAnswers {
  const parsed: ParsedAnswers = {};
  if (!raw) return parsed;

  const entries: [string, unknown][] = [];
  if (raw instanceof Map) {
    raw.forEach((value, key) => entries.push([String(key), value]));
  } else if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => entries.push([key, value]));
  }

  entries.forEach(([questionIndex, answer]) => {
    const idx = Number(questionIndex);
    if (Number.isNaN(idx)) return;
    parsed[idx] = parseStoredAnswer(answer, questions?.[idx]?.type);
  });

  return parsed;
}

export function getAnswerForQuestion(
  answers: ParsedAnswers,
  questionIndex: number
): string | Record<number, string> | undefined {
  const key = questionIndex.toString();
  if (answers[questionIndex] !== undefined) return answers[questionIndex];
  const asStringKeyed = answers as Record<string, string | Record<number, string>>;
  if (asStringKeyed[key] !== undefined) return asStringKeyed[key];
  return undefined;
}

export function formatTextAnswer(value: string | Record<number, string> | undefined): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}
