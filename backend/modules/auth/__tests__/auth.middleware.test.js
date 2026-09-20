jest.mock('../../../config/prisma.client', () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: jest.fn(() => false),
  verifyIdToken: jest.fn(),
}));

const authMiddleware = require('../middleware/auth.middleware');
const { signAccessToken } = require('../utils/token');

describe('authMiddleware', () => {
  test('accepts fallback development users for local school tokens even when no Prisma row exists', async () => {
    const token = signAccessToken({
      userId: 'globy-school:ataetaben@gmail.com',
      tenantId: 'globy-school',
      roles: ['super_admin'],
      platformAdmin: true,
      passwordNeedsReset: false,
    });

    const req = {
      headers: { authorization: `Bearer ${token}` },
      path: '/api/v1/schools/summary',
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      userId: 'globy-school:ataetaben@gmail.com',
      tenantId: 'globy-school',
      roles: ['super_admin'],
      platformAdmin: true,
    });
    expect(res.status).not.toHaveBeenCalled();
  });
});
