const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const authConfig = require('../config/auth.config');
const firebaseAdmin = require('../firebase.admin');
const firebaseData = require('../firebase.data');
const { isStrongPassword } = require('../modules/platform-admin/bootstrap-super-admin.service');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const TARGET_PROJECT_ID = 'globyedu-os';
const TARGET_DOCUMENT_PATH = 'users/platform:ataeta@gmail.com';
const TARGET_EMAIL = 'ataetaben@gmail.com';
const CONFIRMATION_FLAG = `--confirm-reset=${TARGET_DOCUMENT_PATH}.passwordHash`;

function parseArguments(args = []) {
  const values = args.map((argument) => String(argument));
  const confirmed = values.includes(CONFIRMATION_FLAG);
  const allowed = new Set(['--dry-run', CONFIRMATION_FLAG]);
  if (values.some((argument) => !allowed.has(argument))) {
    throw new Error('Unrecognized reset argument.');
  }
  if (confirmed && values.includes('--dry-run')) {
    throw new Error('Choose either dry-run or confirmed reset, not both.');
  }
  return { confirmed };
}

function validateEnvironment(env) {
  const password = String(env.INITIAL_SUPER_ADMIN_PASSWORD || '');
  if (String(env.NODE_ENV || '').trim() !== 'production') {
    throw new Error('Reset is allowed only in production mode.');
  }
  if (String(env.DATA_STORE_MODE || '').trim().toLowerCase() !== 'firebase') {
    throw new Error('DATA_STORE_MODE must be firebase.');
  }
  if (!isStrongPassword(password)) {
    throw new Error('INITIAL_SUPER_ADMIN_PASSWORD does not meet the existing password policy.');
  }
  return password;
}

function validateRecord(snapshot, record) {
  if (!snapshot.exists) throw new Error('The targeted Firestore document does not exist.');
  if (record.email !== TARGET_EMAIL || record.role !== 'super_admin' || record.platformAdmin !== true) {
    throw new Error('The targeted document is not the expected Super Admin record.');
  }
  if (typeof record.firebaseUid !== 'string' || !record.firebaseUid.trim()) {
    throw new Error('The targeted Super Admin record has no Firebase UID linkage.');
  }
  if (typeof record.passwordHash !== 'string' || record.passwordHash.length !== 60) {
    throw new Error('The existing password hash is not a supported bcrypt hash.');
  }
}

function hasValidBcryptFormat(hash, getRounds) {
  try {
    return typeof hash === 'string' && hash.length === 60 && Number.isInteger(getRounds(hash));
  } catch {
    return false;
  }
}

async function executeReset(options = {}) {
  const env = options.env || process.env;
  const admin = options.firebaseAdmin || firebaseAdmin;
  const data = options.firebaseData || firebaseData;
  const hashPassword = options.hashPassword || bcrypt.hash;
  const getRounds = options.getRounds || bcrypt.getRounds;
  const args = parseArguments(options.args || []);
  const password = validateEnvironment(env);

  if (!admin.isFirebaseConfigured() || !data.isFirebaseDataConfigured()) {
    throw new Error('Firebase Admin and Firestore data mode must both be configured.');
  }

  const services = admin.getFirebaseAdmin();
  const projectId = String(services.app?.options?.projectId || '').trim();
  if (projectId !== TARGET_PROJECT_ID) {
    throw new Error('Firebase project does not match the required project.');
  }

  const firestore = services.firestore();
  const documentRef = firestore.doc(TARGET_DOCUMENT_PATH);
  const initialSnapshot = await documentRef.get();
  const initialRecord = initialSnapshot.exists ? { ...(initialSnapshot.data() || {}) } : {};
  validateRecord(initialSnapshot, initialRecord);
  if (!hasValidBcryptFormat(initialRecord.passwordHash, getRounds)) {
    throw new Error('The existing password hash is not a supported bcrypt hash.');
  }

  if (!args.confirmed) {
    return {
      status: 'dry-run',
      projectId,
      documentPath: TARGET_DOCUMENT_PATH,
      email: initialRecord.email,
      role: initialRecord.role,
      platformAdmin: initialRecord.platformAdmin,
      fieldToUpdate: 'passwordHash',
    };
  }

  const newHash = await hashPassword(password, authConfig.bcrypt.saltRounds);
  if (!hasValidBcryptFormat(newHash, getRounds)) {
    throw new Error('Password hashing did not produce a supported bcrypt hash.');
  }

  await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(documentRef);
    const currentRecord = currentSnapshot.exists ? { ...(currentSnapshot.data() || {}) } : {};
    validateRecord(currentSnapshot, currentRecord);
    if (currentRecord.email !== initialRecord.email ||
        currentRecord.role !== initialRecord.role ||
        currentRecord.platformAdmin !== initialRecord.platformAdmin ||
        currentRecord.firebaseUid !== initialRecord.firebaseUid ||
        currentRecord.passwordHash !== initialRecord.passwordHash) {
      throw new Error('The target record changed during preflight; no password hash was written.');
    }
    transaction.update(documentRef, { passwordHash: newHash });
  });

  return {
    status: 'updated',
    projectId,
    documentPath: TARGET_DOCUMENT_PATH,
    email: TARGET_EMAIL,
    fieldUpdated: 'passwordHash',
  };
}

async function main(args = process.argv.slice(2), dependencies = {}) {
  try {
    const result = await executeReset({ ...dependencies, args });
    console.info(result.status === 'dry-run'
      ? 'Dry-run passed. No Firestore fields were changed.'
      : 'Password hash updated on the targeted Firestore document.');
    console.info(JSON.stringify(result));
  } catch (error) {
    console.error(`Firestore Super Admin password reset refused: ${String(error.message || 'Reset failed.')}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  CONFIRMATION_FLAG,
  TARGET_DOCUMENT_PATH,
  executeReset,
  main,
  parseArguments,
};