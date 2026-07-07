const { serializeSubmissionForApi } = require('../../../utils/submissionResponse');

describe('serializeSubmissionForApi', () => {
  test('flattens Mongoose Map fields via flattenMaps', () => {
    const doc = {
      toObject: (opts) => {
        expect(opts).toEqual({ flattenMaps: true });
        return {
          _id: 'sub1',
          answers: { 0: 'hello', 1: '12' },
          autoQuestionGrades: { 0: 1, 1: 0 },
        };
      },
    };

    const out = serializeSubmissionForApi(doc);
    expect(out.answers).toEqual({ 0: 'hello', 1: '12' });
    expect(out.autoQuestionGrades).toEqual({ 0: 1, 1: 0 });
  });

  test('converts remaining Map instances on plain objects', () => {
    const out = serializeSubmissionForApi({
      answers: new Map([['0', 'A'], ['1', 'B']]),
      questionGrades: new Map([['0', 1]]),
    });
    expect(out.answers).toEqual({ 0: 'A', 1: 'B' });
    expect(out.questionGrades).toEqual({ 0: 1 });
  });
});
