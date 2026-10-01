jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: () => true,
  verifyIdToken: jest.fn(async () => ({ email: 'linked@globy.test', email_verified: true })),
}));

jest.mock('../../../config/prisma.client', () => ({
  __stub: false,
  tenant: {
    findUnique: jest.fn(async () => ({ id: 'tenant-db-id', schoolId: 'globy-school' })),
  },
  user: {
    findUnique: jest.fn(async ({ where }) => (where.email === 'linked@globy.test' ? {
      id: 'user-1',
      email: 'linked@globy.test',
      tenantId: 'tenant-db-id',
      status: 'active',
      isVerified: true,
      passwordNeedsReset: false,
    } : null)),
    update: jest.fn(async ({ data }) => ({
      id: 'user-1',
      email: 'linked@globy.test',
      tenantId: 'tenant-db-id',
      status: 'active',
      isVerified: true,
      passwordNeedsReset: false,
      ...data,
    })),
  },
  userRole: {
    findMany: jest.fn(async () => [{ role: { name: 'school_authority' } }]),
  },
  refreshToken: {
    create: jest.fn(async () => null),
    findMany: jest.fn(async () => []),
  },
}));

jest.mock('bcrypt', () => ({ compare: jest.fn(async () => true), hash: jest.fn(async () => 'hash') }));

const authService = require('../auth.service');

describe('Firebase login account-linking policy', () => {
  test('rejects an unlinked Firebase account without creating a user', async () => {
    const firebaseAdmin = require('../../../firebase.admin');
    firebaseAdmin.verifyIdToken.mockResolvedValueOnce({ email: 'unknown@globy.test', email_verified: true });

    await expect(authService.loginWithFirebaseIdToken('firebase-token', 'globy-school'))
      .rejects.toThrow(/account not recognized/i);
  });

  test('rejects a linked non-super-admin account for platform login', async () => {
    await expect(authService.loginWithFirebaseIdToken('firebase-token', 'globy-school', { platformAdminMode: true }))
      .rejects.toThrow(/dedicated platform administrator login/i);
  });

  test('returns explicit tenant and school identifiers for linked accounts', async () => {
    const result = await authService.loginWithFirebaseIdToken('firebase-token', 'globy-school');

    expect(result.tenantId).toBe('tenant-db-id');
    expect(result.schoolId).toBe('globy-school');
    expect(result.user.roles).toEqual(['school_authority']);
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });
});
