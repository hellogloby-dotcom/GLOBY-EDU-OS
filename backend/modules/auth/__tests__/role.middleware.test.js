const { roleGuard } = require('../middleware/role.middleware');

describe('roleGuard', () => {
  test('accepts a string role payload from a JWT session', () => {
    const req = { user: { roles: 'super_admin', platformAdmin: true, tenantId: null, schoolId: null } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    roleGuard(['super_admin'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects users that do not have a permitted role', () => {
    const req = { user: { roles: ['teacher'] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    roleGuard(['super_admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a super_admin role without a tenantless platform-admin identity', () => {
    const req = { user: { roles: ['super_admin'], platformAdmin: false, tenantId: 'school-a' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    roleGuard(['super_admin'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows a tenantless platform administrator', () => {
    const req = { user: { roles: ['super_admin'], platformAdmin: true, tenantId: null, schoolId: null } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    roleGuard(['super_admin'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
