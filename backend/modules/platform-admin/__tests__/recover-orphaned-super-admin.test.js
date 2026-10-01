const { recoverOrphanedSuperAdmin, RECOVERY_LOCK_PATH } = require('../recover-orphaned-super-admin.service');

const recoveryEnv = () => ({
  NODE_ENV: 'production',
  DATA_STORE_MODE: 'firebase',
  INITIAL_SUPER_ADMIN_EMAIL: 'root@example.test',
  INITIAL_SUPER_ADMIN_PASSWORD: 'ExistingPassword!123',
  INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET: 'bootstrap-secret-value-with-at-least-32-chars',
  ORPHANED_SUPER_ADMIN_RECOVERY_SECRET: 'orphan-recovery-secret-value-with-at-least-32-chars',
});

function createFakes(options = {}) {
  const docs = new Map();
  const authUsers = new Map();
  let uidIndex = 1;
  let transactionCount = 0;
  const ref = (path) => ({
    id: path.split('/').pop(),
    path,
    async get() {
      const data = docs.get(path);
      return { exists: Boolean(data), id: this.id, data: () => data };
    },
  });
  const firestore = {
    doc: ref,
    collection(name) {
      return {
        doc(id) { return ref(`${name}/${id}`); },
        where(field, operator, value) {
          return {
            async get() {
              const rows = [...docs.entries()]
                .filter(([path]) => path.startsWith(`${name}/`))
                .filter(([, valueRecord]) => operator === '=='
                  ? valueRecord[field] === value
                  : Array.isArray(valueRecord[field]) && valueRecord[field].includes(value));
              return { empty: rows.length === 0, docs: rows.map(([path, data]) => ({ id: path.split('/').pop(), ref: ref(path), data: () => data })) };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      transactionCount += 1;
      const operations = [];
      const result = await callback({
        async get(reference) {
          const data = docs.get(reference.path);
          return { exists: Boolean(data), data: () => data };
        },
        create(reference, data) { operations.push({ type: 'create', path: reference.path, data }); },
        set(reference, data, settings = {}) { operations.push({ type: 'set', path: reference.path, data, settings }); },
        delete(reference) { operations.push({ type: 'delete', path: reference.path }); },
      });
      if (options.failAdminCommit && transactionCount === 2) throw new Error('simulated commit failure');
      for (const operation of operations) {
        if (operation.type === 'delete') docs.delete(operation.path);
        else if (operation.type === 'create') {
          if (docs.has(operation.path)) throw new Error('document exists');
          docs.set(operation.path, operation.data);
        } else if (operation.settings.merge) {
          docs.set(operation.path, { ...(docs.get(operation.path) || {}), ...operation.data });
        } else docs.set(operation.path, operation.data);
      }
      return result;
    },
  };
  const auth = {
    async listUsers() { return { users: [...authUsers.values()] }; },
    async getUser(uid) {
      const user = authUsers.get(uid);
      if (user) return user;
      const error = new Error('not found');
      error.code = 'auth/user-not-found';
      throw error;
    },
    async getUserByEmail(email) {
      const user = [...authUsers.values()].find((entry) => entry.email.toLowerCase() === email.toLowerCase());
      if (user) return user;
      const error = new Error('not found');
      error.code = 'auth/user-not-found';
      throw error;
    },
    async createUser(payload) {
      const user = { uid: `new-uid-${uidIndex++}`, customClaims: {}, ...payload };
      authUsers.set(user.uid, user);
      return user;
    },
    async setCustomUserClaims(uid, customClaims) {
      authUsers.set(uid, { ...authUsers.get(uid), customClaims });
    },
    async deleteUser(uid) { authUsers.delete(uid); },
  };
  const existingAdmin = {
    username: 'root@example.test',
    email: 'root@example.test',
    fullName: 'Platform Administrator',
    role: 'super_admin',
    roles: ['super_admin'],
    platformAdmin: true,
    status: 'active',
    isVerified: true,
    passwordHash: 'existing-password-hash',
    firebaseUid: 'orphaned-uid',
  };
  docs.set('users/platform:root', existingAdmin);
  if (options.secondAdmin) docs.set('users/platform:second', { ...existingAdmin, email: 'second@example.test' });
  const logger = { info: jest.fn() };
  return {
    docs,
    authUsers,
    logger,
    admin: { isFirebaseConfigured: () => true, getFirebaseAdmin: () => ({ auth: () => auth, firestore: () => firestore }) },
    data: { isFirebaseDataConfigured: () => true },
    firestore,
    comparePassword: async (password, hash) => password === recoveryEnv().INITIAL_SUPER_ADMIN_PASSWORD && hash === existingAdmin.passwordHash,
  };
}

describe('orphaned Super Admin recovery', () => {
  test('links exactly the existing Firestore record and records platform claims and audit', async () => {
    const fake = createFakes();
    const result = await recoverOrphanedSuperAdmin({
      env: recoveryEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data,
      logger: fake.logger, comparePassword: fake.comparePassword,
    });
    const stored = fake.docs.get('users/platform:root');
    const authUser = fake.authUsers.get(stored.firebaseUid);

    expect(result.status).toBe('recovered');
    expect(fake.docs.has('users/platform:second')).toBe(false);
    expect(stored).toMatchObject({ role: 'super_admin', roles: ['super_admin'], platformAdmin: true, tenantId: null, schoolId: null });
    expect(stored.passwordHash).toBe('existing-password-hash');
    expect(authUser).toMatchObject({ email: recoveryEnv().INITIAL_SUPER_ADMIN_EMAIL, password: recoveryEnv().INITIAL_SUPER_ADMIN_PASSWORD });
    expect(authUser.customClaims).toEqual({ role: 'super_admin', roles: ['super_admin'], platformAdmin: true });
    expect(fake.docs.get(RECOVERY_LOCK_PATH).state).toBe('completed');
    expect([...fake.docs.values()].some((record) => record.action === 'platform_admin.orphan_recovered')).toBe(true);
    expect(fake.logger.info.mock.calls.flat().join(' ')).not.toContain(recoveryEnv().INITIAL_SUPER_ADMIN_PASSWORD);
    expect(fake.logger.info.mock.calls.flat().join(' ')).not.toContain(recoveryEnv().ORPHANED_SUPER_ADMIN_RECOVERY_SECRET);
  });

  test('refuses ambiguous Firestore admins without creating Auth accounts', async () => {
    const fake = createFakes({ secondAdmin: true });
    await expect(recoverOrphanedSuperAdmin({ env: recoveryEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, comparePassword: fake.comparePassword }))
      .rejects.toThrow(/exactly one existing Firestore Super Admin/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when configured password does not match the existing admin hash', async () => {
    const fake = createFakes();
    await expect(recoverOrphanedSuperAdmin({
      env: { ...recoveryEnv(), INITIAL_SUPER_ADMIN_PASSWORD: 'DifferentPassword!123' },
      firebaseAdmin: fake.admin, firebaseData: fake.data, comparePassword: fake.comparePassword,
    })).rejects.toThrow(/does not match the existing/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('rolls back the created Auth identity and reservation when the Firestore update fails', async () => {
    const fake = createFakes({ failAdminCommit: true });
    await expect(recoverOrphanedSuperAdmin({
      env: recoveryEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data,
      comparePassword: fake.comparePassword,
    })).rejects.toThrow(/simulated commit failure/);
    expect(fake.authUsers.size).toBe(0);
    expect(fake.docs.get('users/platform:root').firebaseUid).toBe('orphaned-uid');
    expect(fake.docs.has(RECOVERY_LOCK_PATH)).toBe(false);
  });

  test('refuses a replay after successful recovery', async () => {
    const fake = createFakes();
    const args = { env: recoveryEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: fake.logger, comparePassword: fake.comparePassword };
    await recoverOrphanedSuperAdmin(args);
    await expect(recoverOrphanedSuperAdmin(args)).rejects.toThrow(/already been used or requires operator review/);
    expect(fake.authUsers.size).toBe(1);
  });
});
