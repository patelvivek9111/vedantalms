const { hashTranscriptPayload } = require('../../shared/grading/transcriptHash.cjs');

describe('transcriptHash', () => {
  it('produces stable hash regardless of course row order', () => {
    const base = {
      studentId: 's1',
      term: 'Spring',
      year: 2025,
      courses: [
        {
          courseId: 'a',
          finalPercent: 90,
          letterGrade: 'A',
          gradingPolicyHash: 'hash-a',
        },
        {
          courseId: 'b',
          finalPercent: 80,
          letterGrade: 'B',
          gradingPolicyHash: 'hash-b',
        },
      ],
    };
    const reversed = {
      ...base,
      courses: [...base.courses].reverse(),
    };
    expect(hashTranscriptPayload(base)).toBe(hashTranscriptPayload(reversed));
  });

  it('changes hash when grade values change', () => {
    const a = {
      studentId: 's1',
      term: 'Spring',
      year: 2025,
      courses: [{ courseId: 'c1', finalPercent: 90, letterGrade: 'A' }],
    };
    const b = {
      ...a,
      courses: [{ courseId: 'c1', finalPercent: 89, letterGrade: 'B' }],
    };
    expect(hashTranscriptPayload(a)).not.toBe(hashTranscriptPayload(b));
  });
});
