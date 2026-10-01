const { bootstrapFirstSuperAdmin } = require('../bootstrap-super-admin.service');

const validEnv = () => ({
  NODE_ENV: 'production',
  DATA_STORE_MODE: 'firebase',
  INITIAL_SUPER_ADMIN_EMAIL: 'root@example.test',
  INITIAL_SUPER_ADMIN_PASSWORD: 'ValidBootstrapPass!123',
  INITIAL_SUPER_ADMIN_NAME: 'Initial Admin',
  INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET: 'bootstrap-secret-value-with-at-least-32-chars',
});

function createFirebaseFakes(options = {}) {
  const documents = new Map();
  const authUsers = new Map();
  const claims = new Map();
  let transactionCount = 0;
  let nextUid = 1;

  const docRef = (path) => ({
    id: path.split('/').pop(),
    path,
    async get() {
      const data = documents.get(path);
      return { exists: Boolean(data), data: () => data };
    },
  });

  const firestore = {
    doc: docRef,
    collection(name) {
      return {
        doc(id) {
          return docRef(`${name}/${id}`);
        },
        limit() { return this; },
        async get() {
          const rows = [...documents.entries()].filter(([path]) => path.startsWith(`${name}/`));
          return { empty: rows.length === 0, docs: rows.map(([path, data]) => ({ id: path.split('/').pop(), data: () => data })) };
        },
        where(field, operator, value) {
          return {
            limit() { return this; },
            async get() {
              const rows = [...documents.entries()]
                .filter(([path]) => path.startsWith(`${name}/`))
                .filter(([, record]) => operator === '==' ? record[field] === value : Array.isArray(record[field]) && record[field].includes(value));
              return { empty: rows.length === 0, docs: rows.map(([path, data]) => ({ id: path.split('/').pop(), data: () => data })) };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      transactionCount += 1;
      const transaction = {
        operations: [],
        async get(ref) {
          const data = documents.get(ref.path);
          return { exists: Boolean(data), data: () => data };
        },
        create(ref, data) { this.operations.push({ type: 'create', path: ref.path, data }); },
        set(ref, data, settings = {}) { this.operations.push({ type: 'set', path: ref.path, data, settings }); },
        delete(ref) { this.operations.push({ type: 'delete', path: ref.path }); },
      };
      const result = await callback(transaction);
      if (options.failFinalTransaction && transactionCount === 2) throw new Error('simulated Firestore commit failure');
      transaction.operations.forEach((operation) => {
        if (operation.type === 'delete') documents.delete(operation.path);
        else if (operation.type === 'create' && documents.has(operation.path)) throw new Error('document already exists');
        else if (operation.type === 'set' && operation.settings.merge) {
          documents.set(operation.path, { ...(documents.get(operation.path) || {}), ...operation.data });
        } else documents.set(operation.path, operation.data);
      });
      return result;
    },
  };

  const auth = {
    async listUsers() {
      return { users: [...authUsers.values()] };
    },
    async getUserByEmail(email) {
      const user = [...authUsers.values()].find((entry) => entry.email === email);
      if (user) return user;
      const error = new Error('not found');
      error.code = 'auth/user-not-found';
      throw error;
    },
    async createUser(payload) {
      const user = { uid: `uid-${nextUid++}`, ...payload };
      authUsers.set(user.uid, user);
      return user;
    },
    async setCustomUserClaims(uid, value) {
      if (options.failClaims) throw new Error('simulated claims failure');
      claims.set(uid, value);
      authUsers.set(uid, { ...authUsers.get(uid), customClaims: value });
    },
    async deleteUser(uid) {
      authUsers.delete(uid);
      claims.delete(uid);
    },
  };

  return {
    documents,
    authUsers,
    claims,
    auth,
    firestore,
    admin: {
      isFirebaseConfigured: () => true,
      getFirebaseAdmin: () => ({ auth: () => auth, firestore: () => firestore }),
    },
    data: { isFirebaseDataConfigured: () => true },
  };
}

function createLogger() {
  const messages = [];
  return { messages, info: (message) => messages.push(String(message)) };
}

describe('one-time Firebase Super Admin bootstrap', () => {
  test('creates Firebase Auth user, claims, Firestore document, audit, and completion lock', async () => {
    const fake = createFirebaseFakes();
    const logger = createLogger();
    const result = await bootstrapFirstSuperAdmin({
      env: validEnv(),
      logger,
      firebaseAdmin: fake.admin,
      firebaseData: fake.data,
      hashPassword: async () => 'bcrypt-hash',
    });

    expect(result).toMatchObject({ email: 'root@example.test', role: 'super_admin' });
    expect(fake.claims.get(result.uid)).toEqual({ role: 'super_admin', roles: ['super_admin'], platformAdmin: true });
    expect(fake.authUsers.get(result.uid)).toMatchObject({ emailVerified: true, disabled: false });
    const storedUser = fake.documents.get('users/platform:root@example.test');
    expect(storedUser).toMatchObject({
      role: 'super_admin',
      roles: ['super_admin'],
      platformAdmin: true,
      status: 'active',
      isVerified: true,
      emailVerified: true,
      passwordHash: 'bcrypt-hash',
      firebaseUid: result.uid,
    });
    expect(storedUser.password).toBeUndefined();
    const auditRecord = [...fake.documents.values()].find((record) => record.action === 'platform_admin.bootstrap_completed');
    expect(auditRecord).toMatchObject({ actorRole: 'bootstrap', resourceType: 'platform_admin', success: true });
    expect(fake.documents.get('system/initial-super-admin').state).toBe('completed');
    expect(logger.messages.join(' ')).not.toContain(validEnv().INITIAL_SUPER_ADMIN_PASSWORD);
    expect(logger.messages.join(' ')).not.toContain(validEnv().INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET);
  });

  test('refuses when a Super Admin Firestore record already exists', async () => {
    const fake = createFirebaseFakes();
    fake.documents.set('users/existing-root', { role: 'super_admin', status: 'active' });

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/Super Admin already exists/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when a claimed Super Admin already exists in Firebase Auth', async () => {
    const fake = createFirebaseFakes();
    fake.authUsers.set('existing-root', { uid: 'existing-root', customClaims: { role: 'super_admin', roles: ['super_admin'] } });

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/Super Admin already exists/);
    expect(fake.authUsers.size).toBe(1);
  });

  test('refuses when a prior initialization lock exists', async () => {
    const fake = createFirebaseFakes();
    fake.documents.set('system/initial-super-admin', { state: 'recovery-required' });

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/already been run or requires recovery/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when the configured email already belongs to a non-admin Firestore user', async () => {
    const fake = createFirebaseFakes();
    fake.documents.set('users/existing-user', { email: 'root@example.test', role: 'teacher', status: 'active' });

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/Firestore user already exists/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when the configured email already exists in Firebase Authentication', async () => {
    const fake = createFirebaseFakes();
    fake.authUsers.set('existing-account', { uid: 'existing-account', email: 'root@example.test', customClaims: {} });

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/Authentication user already exists/);
    expect(fake.authUsers.size).toBe(1);
  });

  test('refuses without bootstrap secret and required credentials', async () => {
    const fake = createFirebaseFakes();
    const missingSecret = validEnv();
    delete missingSecret.INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET;
    await expect(bootstrapFirstSuperAdmin({ env: missingSecret, firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/BOOTSTRAP_SECRET/);

    const missingEmail = validEnv();
    delete missingEmail.INITIAL_SUPER_ADMIN_EMAIL;
    await expect(bootstrapFirstSuperAdmin({ env: missingEmail, firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/INITIAL_SUPER_ADMIN_EMAIL/);

    const missingPassword = validEnv();
    delete missingPassword.INITIAL_SUPER_ADMIN_PASSWORD;
    await expect(bootstrapFirstSuperAdmin({ env: missingPassword, firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/INITIAL_SUPER_ADMIN_PASSWORD/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when Firebase mode is unavailable', async () => {
    const fake = createFirebaseFakes();
    await expect(bootstrapFirstSuperAdmin({
      env: validEnv(),
      firebaseAdmin: fake.admin,
      firebaseData: { isFirebaseDataConfigured: () => false },
      logger: createLogger(),
    })).rejects.toThrow(/must both be configured/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('refuses when Firebase Admin is unavailable', async () => {
    const fake = createFirebaseFakes();
    await expect(bootstrapFirstSuperAdmin({
      env: validEnv(),
      firebaseAdmin: { isFirebaseConfigured: () => false },
      firebaseData: fake.data,
      logger: createLogger(),
    })).rejects.toThrow(/must both be configured/);
    expect(fake.authUsers.size).toBe(0);
  });

  test('rolls back Firebase Auth user if claims cannot be set', async () => {
    const fake = createFirebaseFakes({ failClaims: true });
    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/simulated claims failure/);
    expect(fake.authUsers.size).toBe(0);
    expect(fake.documents.has('system/initial-super-admin')).toBe(false);
  });

  test('releases reservation when Firebase Auth user creation fails without creating an account', async () => {
    const fake = createFirebaseFakes();
    fake.auth.createUser = async () => { throw new Error('simulated Auth creation failure'); };

    await expect(bootstrapFirstSuperAdmin({ env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger() }))
      .rejects.toThrow(/simulated Auth creation failure/);
    expect(fake.authUsers.size).toBe(0);
    expect(fake.documents.has('system/initial-super-admin')).toBe(false);
  });

  test('rolls back Firebase Auth user and lock if Firestore commit fails', async () => {
    const fake = createFirebaseFakes({ failFinalTransaction: true });
    await expect(bootstrapFirstSuperAdmin({
      env: validEnv(),
      firebaseAdmin: fake.admin,
      firebaseData: fake.data,
      logger: createLogger(),
      hashPassword: async () => 'bcrypt-hash',
    })).rejects.toThrow(/simulated Firestore commit failure/);
    expect(fake.authUsers.size).toBe(0);
    expect(fake.documents.has('users/platform:root@example.test')).toBe(false);
    expect(fake.documents.has('system/initial-super-admin')).toBe(false);
  });

  test('prevents duplicate execution after completion', async () => {
    const fake = createFirebaseFakes();
    const options = { env: validEnv(), firebaseAdmin: fake.admin, firebaseData: fake.data, logger: createLogger(), hashPassword: async () => 'bcrypt-hash' };
    await bootstrapFirstSuperAdmin(options);
    await expect(bootstrapFirstSuperAdmin(options)).rejects.toThrow(/Super Admin already exists/);
    expect(fake.authUsers.size).toBe(1);
  });
});