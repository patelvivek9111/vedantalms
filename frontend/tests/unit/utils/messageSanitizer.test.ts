import { describe, expect, it } from 'vitest';
import { messageHtmlForRender, sanitizeMessageHtml } from '@/utils/messageSanitizer';

describe('messageSanitizer', () => {
  it('strips script and event handlers', () => {
    const out = sanitizeMessageHtml('<p onclick="x()">a</p><script>b</script>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out.toLowerCase()).not.toContain('onclick');
  });

  it('messageHtmlForRender prefers bodyHtml', () => {
    expect(messageHtmlForRender({ bodyHtml: '<p>ok</p>', body: '<script>x</script>' })).toBe('<p>ok</p>');
  });
});
