const { parseCalendarIds } = require('../../../services/calendarFeed.service');

describe('calendarFeed.service', () => {
  it('parseCalendarIds splits comma-separated ids', () => {
    const validA = '507f1f77bcf86cd799439011';
    const validB = '507f1f77bcf86cd799439012';
    const ids = parseCalendarIds(`${validA}, ${validB} ,invalid`);
    expect(ids).toEqual([validA, validB]);
  });

  it('parseCalendarIds returns empty for blank input', () => {
    expect(parseCalendarIds('')).toEqual([]);
    expect(parseCalendarIds(undefined)).toEqual([]);
  });
});
