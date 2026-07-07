const {
  mapFieldToObject,
  readMapField,
  hasMapFieldValue,
  serializeMongooseDoc,
} = require('../../../utils/mongooseSerialize');

describe('mongooseSerialize', () => {
  test('readMapField reads Mongoose Map and plain objects', () => {
    const map = new Map([
      ['0', 'hello'],
      ['1', '12'],
    ]);
    expect(readMapField(map, 0)).toBe('hello');
    expect(readMapField(map, '1')).toBe('12');
    expect(readMapField({ 0: 'A', 1: 'B' }, 0)).toBe('A');
    expect(readMapField(null, 0)).toBeUndefined();
  });

  test('hasMapFieldValue treats empty strings as absent', () => {
    expect(hasMapFieldValue({ 0: 'x' }, 0)).toBe(true);
    expect(hasMapFieldValue({ 0: '' }, 0)).toBe(false);
    expect(hasMapFieldValue(new Map([['0', 'y']]), 0)).toBe(true);
  });

  test('serializeMongooseDoc uses flattenMaps by default', () => {
    const doc = {
      toObject: (opts) => {
        expect(opts.flattenMaps).toBe(true);
        return { answers: { 0: 'ok' }, metadata: { courseId: 'c1' } };
      },
    };
    expect(serializeMongooseDoc(doc).answers).toEqual({ 0: 'ok' });
  });

  test('mapFieldToObject converts Map instances', () => {
    expect(mapFieldToObject(new Map([['a', 1]]))).toEqual({ a: 1 });
  });
});
