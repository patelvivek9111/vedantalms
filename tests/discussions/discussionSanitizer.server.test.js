const { sanitizeDiscussionHtml } = require('../../services/discussionSanitizer.service');

describe('discussionSanitizer.service (server)', () => {
  it('strips script tags and inline handlers', () => {
    const input =
      '<p onclick="alert(1)">a</p><img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">l</a>';
    const out = sanitizeDiscussionHtml(input);
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('onclick');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('allows benign formatting', () => {
    const out = sanitizeDiscussionHtml('<p><strong>Hello</strong> <em>world</em></p>');
    expect(out).toContain('<strong>');
    expect(out).toContain('Hello');
  });
});
