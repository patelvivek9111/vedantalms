const {
  isClientRenderedDocx,
  detectPreviewKind,
} = require('../../services/filePreviewJob.service');

describe('docx client-render preview policy', () => {
  test('isClientRenderedDocx matches modern Word only', () => {
    expect(
      isClientRenderedDocx(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'report.docx'
      )
    ).toBe(true);
    expect(isClientRenderedDocx('application/msword', 'legacy.doc')).toBe(false);
    expect(isClientRenderedDocx(undefined, 'slides.pptx')).toBe(false);
  });

  test('detectPreviewKind still classifies docx as office', () => {
    expect(
      detectPreviewKind(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'report.docx'
      )
    ).toBe('office');
  });
});
