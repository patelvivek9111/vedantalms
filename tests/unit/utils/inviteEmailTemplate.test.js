const {
  escapeHtml,
  formatExpiry,
  buildStudentActivationInviteEmail,
  buildAccountInviteEmail,
} = require('../../../utils/inviteEmailTemplate');

describe('inviteEmailTemplate', () => {
  it('builds a branded activation email with CTA and readable expiry', () => {
    const expiresAt = new Date('2026-08-02T17:11:24.787Z');
    const mail = buildStudentActivationInviteEmail({
      accountName: 'MySL8TE',
      schoolEmail: 'vrp1234@lincolnhigh.edu',
      inviteUrl: 'https://www.mysl8te.com/accept-invite?token=abc',
      expiresAt,
    });

    expect(mail.subject).toBe('Finish setting up your MySL8TE account');
    expect(mail.html).toContain('Activate your account');
    expect(mail.html).toContain('Set your password');
    expect(mail.html).toContain('vrp1234@lincolnhigh.edu');
    expect(mail.html).toContain('https://www.mysl8te.com/accept-invite?token=abc');
    expect(mail.html).not.toContain('2026-08-02T17:11:24.787Z');
    expect(mail.html).toContain(formatExpiry(expiresAt));
    expect(mail.text).toContain('vrp1234@lincolnhigh.edu');
    expect(mail.text).toContain('/accept-invite?token=abc');
  });

  it('escapes HTML in account names', () => {
    const mail = buildStudentActivationInviteEmail({
      accountName: 'Foo <script>alert(1)</script>',
      schoolEmail: 'a@b.com',
      inviteUrl: 'https://example.com/x',
      expiresAt: new Date(),
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain(escapeHtml('Foo <script>alert(1)</script>'));
  });

  it('builds admin invite email', () => {
    const mail = buildAccountInviteEmail({
      accountName: 'MySL8TE',
      role: 'teacher',
      inviteUrl: 'https://www.mysl8te.com/accept-invite?token=xyz',
      expiresAt: new Date('2026-08-02T17:11:24.787Z'),
    });
    expect(mail.subject).toContain('MySL8TE');
    expect(mail.html).toContain('Accept invitation');
    expect(mail.html).toContain('teacher');
  });
});
