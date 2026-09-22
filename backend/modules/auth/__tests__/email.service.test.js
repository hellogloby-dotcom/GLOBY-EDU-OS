describe('Brevo email service', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env.BREVO_API_KEY = 'test_api_key';
    process.env.BREVO_SENDER_EMAIL = 'hello@globyedu.com';
    process.env.BREVO_SENDER_NAME = 'GlobyEdu';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messageId: 'msg_123' }),
    });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends an email via the Brevo API when configured', async () => {
    const { sendEmail } = require('../utils/email');

    const result = await sendEmail('student@example.com', 'Password reset', '<p>Reset</p>');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'api-key': 'test_api_key',
        }),
      })
    );
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg_123');
  });

  it('skips delivery cleanly when Brevo is not configured', async () => {
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;

    const { sendEmail } = require('../utils/email');
    const result = await sendEmail('student@example.com', 'Password reset', '<p>Reset</p>');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('BREVO_NOT_CONFIGURED');
    expect(console.warn.mock.calls.join(' ')).not.toContain('test_api_key');
  });

  it('handles provider failures without throwing', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ code: 'unauthorized' }),
    });

    const { sendEmail } = require('../utils/email');
    await expect(sendEmail('student@example.com', 'Password reset', '<p>Reset</p>')).resolves.toMatchObject({
      ok: false,
      reason: 'BREVO_API_ERROR',
    });
    expect(console.error).toHaveBeenCalled();
  });
});
