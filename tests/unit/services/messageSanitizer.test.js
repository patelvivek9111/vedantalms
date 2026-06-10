const {
  prepareMessageBody,
  sanitizeMessageHtml,
  htmlToPlainText,
} = require('../../../services/messageSanitizer.service');

describe('messageSanitizer.service', () => {
  it('strips script tags and inline handlers from message HTML', () => {
    const input =
      '<p onclick="alert(1)">hi</p><script>alert(2)</script><a href="javascript:alert(3)">link</a>';
    const out = sanitizeMessageHtml(input);
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('prepareMessageBody dual-writes body, bodyHtml, and bodyText', () => {
    const prepared = prepareMessageBody('<p><strong>Hello</strong></p>');
    expect(prepared.body).toBe(prepared.bodyHtml);
    expect(prepared.bodyHtml).toContain('<strong>');
    expect(prepared.bodyText).toBe('Hello');
  });

  it('htmlToPlainText removes tags', () => {
    expect(htmlToPlainText('<p>One <em>two</em></p>')).toBe('One two');
  });
});
