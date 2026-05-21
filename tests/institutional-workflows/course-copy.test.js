const courseCopyService = require('../../services/courseCopy.service');

describe('courseCopy.service', () => {
  it('exports copy, archive, and restore helpers', () => {
    expect(typeof courseCopyService.copyCourseContent).toBe('function');
    expect(typeof courseCopyService.archiveCourse).toBe('function');
    expect(typeof courseCopyService.restoreCourse).toBe('function');
  });
});
