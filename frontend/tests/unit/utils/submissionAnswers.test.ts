import { describe, expect, test } from 'vitest';
import {
  parseSubmissionAnswers,
  getAnswerForQuestion,
  formatTextAnswer,
} from '@/utils/submissionAnswers';

describe('submissionAnswers', () => {
  test('parseSubmissionAnswers normalizes string keys and matching JSON', () => {
    const parsed = parseSubmissionAnswers(
      { 0: 'text answer', 1: '12', 2: '{"0":"4"}' },
      [{ type: 'text' }, { type: 'multiple-choice' }, { type: 'matching' }]
    );
    expect(parsed[0]).toBe('text answer');
    expect(parsed[1]).toBe('12');
    expect(parsed[2]).toEqual({ 0: '4' });
  });

  test('getAnswerForQuestion reads numeric and string keys', () => {
    const parsed = parseSubmissionAnswers({ 0: 'A', 1: 'B' });
    expect(getAnswerForQuestion(parsed, 0)).toBe('A');
    expect(getAnswerForQuestion(parsed, 1)).toBe('B');
  });

  test('formatTextAnswer returns strings only', () => {
    expect(formatTextAnswer('hello')).toBe('hello');
    expect(formatTextAnswer(undefined)).toBe('');
    expect(formatTextAnswer({ 0: 'x' })).toBe('');
  });
});
