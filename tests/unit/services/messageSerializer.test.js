const {
  serializeMessageForClient,
  serializeMessagesPage,
} = require('../../../services/messageSerializer.service');

describe('messageSerializer.service', () => {
  it('serializes legacy body-only messages with sanitized HTML', () => {
    const out = serializeMessageForClient({
      _id: 'm1',
      body: '<p>safe</p><script>x</script>',
    });
    expect(out.body).not.toContain('<script');
    expect(out.bodyHtml).toBe(out.body);
    expect(out.bodyText).toBe('safe');
  });

  it('includes fileAssetIds and legacy attachments', () => {
    const out = serializeMessageForClient({
      _id: 'm1',
      body: '<p>hi</p>',
      fileAssetIds: ['507f1f77bcf86cd799439012'],
      attachments: ['/uploads/old.pdf'],
    });
    expect(out.fileAssetIds).toEqual(['507f1f77bcf86cd799439012']);
    expect(out.attachments).toEqual(['/uploads/old.pdf']);
  });

  it('serializes message list pages', () => {
    const page = serializeMessagesPage({
      data: [{ _id: 'm1', body: '<p>hi</p>' }],
      hasMore: false,
      nextCursor: null,
    });
    expect(page.data[0].bodyText).toBe('hi');
  });
});
