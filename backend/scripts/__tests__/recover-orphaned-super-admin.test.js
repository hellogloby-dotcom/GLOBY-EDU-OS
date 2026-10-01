const { parseArguments } = require('../recover-orphaned-super-admin');

describe('orphaned Super Admin recovery command arguments', () => {
  test('parses the documented email and explicit confirmation flags', () => {
    expect(parseArguments(['--email=ataetaben@gmail.com', '--confirm-orphan-recovery']))
      .toEqual({ confirmed: true, email: 'ataetaben@gmail.com' });
  });

  test('accepts the split email argument form', () => {
    expect(parseArguments(['--email', 'ataetaben@gmail.com', '--confirm-orphan-recovery']))
      .toEqual({ confirmed: true, email: 'ataetaben@gmail.com' });
  });

  test('rejects malformed email values', () => {
    expect(() => parseArguments(['--email=invalid', '--confirm-orphan-recovery']))
      .toThrow(/valid --email/);
  });

  test('does not treat the email as confirmation', () => {
    expect(parseArguments(['--email=ataetaben@gmail.com']))
      .toEqual({ confirmed: false, email: 'ataetaben@gmail.com' });
  });
});
