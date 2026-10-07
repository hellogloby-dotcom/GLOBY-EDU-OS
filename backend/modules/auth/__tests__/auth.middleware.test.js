jest.mock('../../../config/prisma.client', () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: jest.fn(() => false),
  verifyIdToken: jest.fn(),
  getUser: jest.fn(),
}));

jest.mock('../../../firebase.data', () => ({
  isFirebaseDataConfigured: jest.fn(() => false),
  getFirestore: jest.fn(),
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

  test('accepts a valid Firestore school account when Firebase claims are absent or stale', async () => {
    const firebaseAdmin = require('../../../firebase.admin');
    const firebaseData = require('../../../firebase.data');
    jest.spyOn(firebaseData, 'isFirebaseDataConfigured').mockReturnValue(true);
    jest.spyOn(firebaseData, 'getFirestore').mockReturnValue({
      collection: (name) => {
        if (name === 'users') {
          return {
            doc: (id) => ({
              get: async () => ({
                exists: true,
                data: () => ({
                  id,
                  email: 'authority@globyedu.test',
                  schoolId: 'globy-school',
                  tenantId: 'globy-school',
                  roles: ['school_authority'],
                  status: 'active',
                  firebaseUid: 'firebase-user-1',
                  platformAdmin: false,
                  passwordNeedsReset: false,
                }),
              }),
            }),
            where: () => ({ get: async () => ({ empty: false, docs: [{ id: 'user-1', data: () => ({
              id: 'user-1',
              email: 'authority@globyedu.test',
              schoolId: 'globy-school',
              tenantId: 'globy-school',
              roles: ['school_authority'],
              status: 'active',
              firebaseUid: 'firebase-user-1',
              platformAdmin: false,
              passwordNeedsReset: false,
            }) }] }) }),
          };
        }
        return {
          doc: (id) => ({
            get: async () => ({
              exists: true,
              data: () => ({ userId: 'user-1', revoked: false, expiresAt: Date.now() + 3600000 }),
            }),
          }),
        };
      },
    });
    firebaseAdmin.getUser.mockResolvedValue({ disabled: false, customClaims: {} });

    const token = signAccessToken({
      userId: 'user-1',
      tenantId: 'globy-school',
      roles: ['school_authority'],
      platformAdmin: false,
      passwordNeedsReset: false,
      sessionId: 'session-1',
    });
    const req = {
      headers: { authorization: `Bearer ${token}` },
      path: '/api/v1/schools/globy-school/summary',
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({
      userId: 'user-1',
      tenantId: 'globy-school',
      roles: ['school_authority'],
    });
    expect(res.status).not.toHaveBeenCalled();
  });
});
