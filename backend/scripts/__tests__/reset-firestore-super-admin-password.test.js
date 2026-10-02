const bcrypt = require('bcrypt');
const {
  CONFIRMATION_FLAG,
  TARGET_DOCUMENT_PATH,
  executeReset,
  parseArguments,
} = require('../reset-firestore-super-admin-password');

const env = {
  NODE_ENV: 'production',
  DATA_STORE_MODE: 'firebase',
  INITIAL_SUPER_ADMIN_PASSWORD: 'ValidPassword!123',
};

function createFakeFirebase(initialRecord) {
  let currentRecord = { ...initialRecord };
  const updates = [];
  const ref = { path: TARGET_DOCUMENT_PATH };
  const snapshot = () => ({ exists: Boolean(currentRecord), data: () => currentRecord });
  const firestore = {
    doc: jest.fn(() => ({
      ...ref,
      get: async () => snapshot(),
    })),
    runTransaction: jest.fn(async (callback) => callback({
      get: async () => snapshot(),
      update: (document, fields) => {
        updates.push({ path: document.path, fields });
        currentRecord = { ...currentRecord, ...fields };
      },
    })),
  };
  return {
    updates,
    getRecord: () => currentRecord,
    admin: {
      isFirebaseConfigured: () => true,
      getFirebaseAdmin: () => ({ app: { options: { projectId: 'globyedu-os' } }, firestore: () => firestore }),
    },
    data: { isFirebaseDataConfigured: () => true },
    firestore,
  };
}

async function createRecord() {
  return {
    email: 'ataetaben@gmail.com',
    username: 'ataetaben@gmail.com',
    role: 'super_admin',
    roles: ['super_admin'],
    platformAdmin: true,
    firebaseUid: 'existing-auth-uid',
    status: 'active',
    passwordHash: await bcrypt.hash('OldPassword!123', 4),
  };
}

describe('Firestore Super Admin password reset CLI', () => {
  test('defaults to a read-only dry run on the fixed target', async () => {
    const fake = createFakeFirebase(await createRecord());
    const result = await executeReset({ env, args: [], firebaseAdmin: fake.admin, firebaseData: fake.data });

    expect(result).toMatchObject({ status: 'dry-run', documentPath: TARGET_DOCUMENT_PATH, fieldToUpdate: 'passwordHash' });
    expect(fake.firestore.runTransaction).not.toHaveBeenCalled();
    expect(fake.updates).toHaveLength(0);
  });

  test('confirmed reset transaction updates only passwordHash on the fixed document', async () => {
    const fake = createFakeFirebase(await createRecord());
    const original = fake.getRecord();
    const result = await executeReset({
      env,
      args: [CONFIRMATION_FLAG],
      firebaseAdmin: fake.admin,
      firebaseData: fake.data,
    });

    expect(result).toMatchObject({ status: 'updated', documentPath: TARGET_DOCUMENT_PATH, fieldUpdated: 'passwordHash' });
    expect(fake.updates).toHaveLength(1);
    expect(fake.updates[0].path).toBe(TARGET_DOCUMENT_PATH);
    expect(Object.keys(fake.updates[0].fields)).toEqual(['passwordHash']);
    expect(fake.getRecord()).toMatchObject({
      email: original.email,
      role: original.role,
      platformAdmin: original.platformAdmin,
      firebaseUid: original.firebaseUid,
    });
    expect(await bcrypt.compare(env.INITIAL_SUPER_ADMIN_PASSWORD, fake.getRecord().passwordHash)).toBe(true);
  });

  test('refuses a mismatched record and wrong Firebase project', async () => {
    const wrongRecord = createFakeFirebase({ ...(await createRecord()), email: 'different@example.test' });
    await expect(executeReset({ env, firebaseAdmin: wrongRecord.admin, firebaseData: wrongRecord.data }))
      .rejects.toThrow(/not the expected Super Admin/);
    expect(wrongRecord.updates).toHaveLength(0);

    const wrongProject = createFakeFirebase(await createRecord());
    wrongProject.admin.getFirebaseAdmin = () => ({ app: { options: { projectId: 'other-project' } }, firestore: () => wrongProject.firestore });
    await expect(executeReset({ env, firebaseAdmin: wrongProject.admin, firebaseData: wrongProject.data }))
      .rejects.toThrow(/project does not match/);
    expect(wrongProject.updates).toHaveLength(0);
  });

  test('requires production mode, existing password policy, and exact confirmation', async () => {
    expect(() => parseArguments(['--confirm-reset=users/other/passwordHash'])).toThrow(/Unrecognized/);
    const fake = createFakeFirebase(await createRecord());
    await expect(executeReset({ env: { ...env, NODE_ENV: 'development' }, firebaseAdmin: fake.admin, firebaseData: fake.data }))
      .rejects.toThrow(/production mode/);
    await expect(executeReset({ env: { ...env, INITIAL_SUPER_ADMIN_PASSWORD: 'weak' }, firebaseAdmin: fake.admin, firebaseData: fake.data }))
      .rejects.toThrow(/existing password policy/);
    expect(fake.updates).toHaveLength(0);
  });

  test('refuses if protected linkage or the old hash changes after preflight', async () => {
    const fake = createFakeFirebase(await createRecord());
    const originalRunTransaction = fake.firestore.runTransaction;
    fake.firestore.runTransaction = jest.fn(async (callback) => {
      fake.getRecord().firebaseUid = 'changed-auth-uid';
      return originalRunTransaction(callback);
    });
    await expect(executeReset({ env, args: [CONFIRMATION_FLAG], firebaseAdmin: fake.admin, firebaseData: fake.data }))
      .rejects.toThrow(/changed during preflight/);
    expect(fake.updates).toHaveLength(0);
  });
});