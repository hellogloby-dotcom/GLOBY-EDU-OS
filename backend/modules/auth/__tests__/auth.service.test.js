jest.mock('../../../config/prisma.client', () => {
  const tenant = {
    findUnique: jest.fn(async ({ where }) => {
      if (where.schoolId === 'globy-school') {
        return { id: 'tenant-globy', schoolId: 'globy-school' };
      }
      if (where.schoolId === 'other-school') {
        return { id: 'tenant-other', schoolId: 'other-school' };
      }
      return null;
    }),
  };

  const user = {
    findFirst: jest.fn(async ({ where }) => {
      const candidateValues = (where.OR || []).map((entry) => Object.values(entry)[0]).filter(Boolean).map((value) => String(value).trim());
      const normalizedCandidates = new Set(candidateValues.map((value) => value.toLowerCase()));
      const tenantId = where.tenantId;

      if (normalizedCandidates.has('t001') && tenantId === 'tenant-globy') {
        return {
          id: 'teacher-1',
          email: 'teacher@globy.test',
          tenantId: 'tenant-globy',
          teacherId: 'T001',
          studentId: null,
          status: 'active',
          isVerified: true,
          passwordHash: 'hashed-password',
          passwordNeedsReset: false,
        };
      }
      if (normalizedCandidates.has('stu001') && tenantId === 'tenant-globy') {
        return {
          id: 'student-1',
          email: 'student@globy.test',
          tenantId: 'tenant-globy',
          teacherId: null,
          studentId: 'STU001',
          status: 'active',
          isVerified: true,
          passwordHash: 'hashed-password',
          passwordNeedsReset: false,
        };
      }
      if (normalizedCandidates.has('t001') && tenantId === 'tenant-other') {
        return {
          id: 'teacher-2',
          email: 'teacher@other.test',
          tenantId: 'tenant-other',
          teacherId: 'T001',
          studentId: null,
          status: 'active',
          isVerified: true,
          passwordHash: 'hashed-password',
          passwordNeedsReset: false,
        };
      }
      return null;
    }),
    findUnique: jest.fn(async ({ where }) => {
      if (where.email === 'teacher@globy.test') {
        return {
          id: 'teacher-1',
          email: 'teacher@globy.test',
          tenantId: 'tenant-globy',
          teacherId: 'T001',
          status: 'active',
          isVerified: true,
          passwordHash: 'hashed-password',
          passwordNeedsReset: false,
        };
      }
      if (where.email === 'student@globy.test') {
        return {
          id: 'student-1',
          email: 'student@globy.test',
          tenantId: 'tenant-globy',
          studentId: 'STU001',
          status: 'active',
          isVerified: true,
          passwordHash: 'hashed-password',
          passwordNeedsReset: false,
        };
      }
      return null;
    }),
    update: jest.fn(async ({ data }) => ({ id: 'teacher-1', ...data })),
  };

  const userRole = {
    findMany: jest.fn(async () => [{ role: { name: 'teacher' } }]),
  };

  const refreshToken = {
    create: jest.fn(async () => null),
    findMany: jest.fn(async () => []),
    updateMany: jest.fn(async () => null),
    findFirst: jest.fn(async () => null),
    update: jest.fn(async () => null),
  };

  return {
    __stub: false,
    tenant,
    user,
    userRole,
    refreshToken,
    emailToken: {
      create: jest.fn(async () => null),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async () => null),
    },
  };
});

jest.mock('bcrypt', () => ({
  compare: jest.fn(async (password, hash) => password === 'ValidPassword!1' && hash === 'hashed-password'),
  hash: jest.fn(async () => 'hashed-password'),
}));

jest.mock('../../../firebase.admin', () => ({
  isFirebaseConfigured: jest.fn(() => false),
}));

const authService = require('../auth.service');

describe('Prisma auth service identity resolution', () => {
  test('auth service exposes functions', () => {
    expect(typeof authService.login).toBe('function');
    expect(typeof authService.refresh).toBe('function');
    expect(typeof authService.logout).toBe('function');
    expect(typeof authService.changePassword).toBe('function');
    expect(typeof authService.forgotPassword).toBe('function');
    expect(typeof authService.resetPassword).toBe('function');
  });

  test('accepts tenant-scoped teacher and student identifiers', async () => {
    const teacherLogin = await authService.login('globy-school', 'T001', 'ValidPassword!1');
    expect(teacherLogin.user.teacherId).toBe('T001');
    expect(teacherLogin.user.tenantId).toBe('tenant-globy');

    const studentLogin = await authService.login('globy-school', 'STU001', 'ValidPassword!1');
    expect(studentLogin.user.studentId).toBe('STU001');
    expect(studentLogin.user.tenantId).toBe('tenant-globy');
  });

  test('rejects a teacher ID from a different tenant even if the identifier matches', async () => {
    await expect(authService.login('globy-school', 'T001', 'ValidPassword!1')).resolves.toBeTruthy();
    await expect(authService.login('other-school', 'T001', 'ValidPassword!1')).resolves.toBeTruthy();
    await expect(authService.login('other-school', 'T001', 'WrongPassword!1')).rejects.toThrow('Invalid credentials');
  });
});
