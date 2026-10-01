jest.mock('../../../firebase.data', () => ({
  isFirebaseDataConfigured: () => true,
  getFirestore: () => ({
    collection: () => ({
      doc: (id) => ({ id, path: `mock/${id}` }),
      where: () => ({
        limit: () => ({
          get: async () => ({
            empty: false,
            docs: [{
              id: 'platform:root@example.test',
              data: () => ({
                email: 'root@example.test',
                username: 'root@example.test',
                fullName: 'Initial Admin',
                role: 'super_admin',
                roles: ['super_admin'],
                platformAdmin: true,
                status: 'active',
                isVerified: true,
                passwordHash: 'bcrypt-hash',
                passwordNeedsReset: false,
                firebaseUid: 'firebase-root-uid',
              }),
            }],
          }),
        }),
      }),
    }),
    runTransaction: async (callback) => callback({
      get: async () => ({ exists: true, data: () => ({ status: 'active', activeSessionIds: [] }) }),
      create: jest.fn(),
      update: jest.fn(),
    }),
  }),
}));

jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: () => true,
  getUser: jest.fn(async (uid) => ({
    uid,
    disabled: false,
    customClaims: { role: 'super_admin', roles: ['super_admin'], platformAdmin: true },
  })),
  getUserByEmail: jest.fn(async () => ({
    uid: 'firebase-root-uid',
    disabled: false,
    customClaims: { role: 'super_admin', roles: ['super_admin'], platformAdmin: true },
  })),
  setCustomUserClaims: jest.fn(async () => undefined),
}));

jest.mock('../../../config/prisma.client', () => null);
jest.mock('bcrypt', () => ({ compare: jest.fn(async () => true) }));

const authService = require('../auth.service');
const { verifyAccessToken } = require('../utils/token');

describe('Firebase platform Super Admin login', () => {
  test('uses the existing platform login service and mints protected Super Admin claims', async () => {
    const session = await authService.loginPlatformAdmin('ROOT@example.test', 'test-password');
    const token = verifyAccessToken(session.accessToken);

    expect(session.user.roles).toEqual(['super_admin']);
    expect(token.roles).toEqual(['super_admin']);
    expect(token.platformAdmin).toBe(true);
    expect(token.tenantId).toBeNull();
  });

  test('accepts a valid existing Firestore Firebase UID even when the auth claims are stale', async () => {
    const firebaseAdmin = require('../../../firebase.admin');
    firebaseAdmin.getUserByEmail.mockResolvedValueOnce({
      uid: 'firebase-root-uid',
      disabled: false,
      customClaims: { role: 'teacher', roles: ['teacher'], platformAdmin: false },
    });

    const session = await authService.loginPlatformAdmin('root@example.test', 'test-password');
    const token = verifyAccessToken(session.accessToken);

    expect(session.user.roles).toEqual(['super_admin']);
    expect(token.roles).toEqual(['super_admin']);
    expect(token.platformAdmin).toBe(true);
  });

  test('rejects when Firebase Auth claims do not identify an active platform administrator and no valid Firestore UID matches', async () => {
    const firebaseAdmin = require('../../../firebase.admin');
    firebaseAdmin.getUserByEmail.mockResolvedValueOnce({
      uid: 'different-firebase-uid',
      disabled: false,
      customClaims: { role: 'teacher', roles: ['teacher'], platformAdmin: false },
    });

    await expect(authService.loginPlatformAdmin('root@example.test', 'test-password'))
      .rejects.toThrow(/identity does not match|claims are not valid/);
  });
});