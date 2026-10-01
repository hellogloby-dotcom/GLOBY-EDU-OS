const { main, redact } = require('../bootstrap-super-admin');

describe('bootstrap CLI safety', () => {
  test('redacts configured bootstrap credentials from errors', () => {
    const password = 'ValidBootstrapPass!123';
    const secret = 'bootstrap-secret-value-with-at-least-32-chars';
    const output = redact(`password=${password} secret=${secret}`, [password, secret]);

    expect(output).not.toContain(password);
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  test('refuses to run without the explicit confirmation flag', async () => {
    const originalArgv = process.argv;
    const originalExitCode = process.exitCode;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.argv = ['node', 'bootstrap-super-admin.js'];
    process.exitCode = 0;

    try {
      await main();
      expect(process.exitCode).toBe(2);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('--confirm'));
    } finally {
      process.argv = originalArgv;
      process.exitCode = originalExitCode;
      error.mockRestore();
    }
  });
});