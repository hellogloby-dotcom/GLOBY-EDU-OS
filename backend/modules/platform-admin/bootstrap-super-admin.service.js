const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../../config/auth.config');
const firebaseAdmin = require('../../firebase.admin');
const firebaseData = require('../../firebase.data');

const BOOTSTRAP_LOCK_PATH = 'system/initial-super-admin';
const SUPER_ADMIN_ROLE = 'super_admin';

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(String(password || ''));
}

function missingConfiguration(env) {
  if (String(env.DATA_STORE_MODE || '').trim().toLowerCase() !== 'firebase') return 'DATA_STORE_MODE must be firebase.';
  if (String(env.INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET || '').trim().length < 32) return 'INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET must contain at least 32 characters.';
  if (!String(env.INITIAL_SUPER_ADMIN_EMAIL || '').trim()) return 'INITIAL_SUPER_ADMIN_EMAIL is required.';
  if (!String(env.INITIAL_SUPER_ADMIN_PASSWORD || '')) return 'INITIAL_SUPER_ADMIN_PASSWORD is required.';
  if (!isStrongPassword(env.INITIAL_SUPER_ADMIN_PASSWORD)) return 'INITIAL_SUPER_ADMIN_PASSWORD does not meet the minimum password policy.';
  if (String(env.INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET) === String(env.INITIAL_SUPER_ADMIN_PASSWORD)) {
    return 'The bootstrap secret must be different from the administrator password.';
  }
  return null;
}

async function hasSuperAdminDocument(firestore) {
  const [roleSnapshot, rolesSnapshot] = await Promise.all([
    firestore.collection('users').where('role', '==', SUPER_ADMIN_ROLE).limit(1).get(),
    firestore.collection('users').where('roles', 'array-contains', SUPER_ADMIN_ROLE).limit(1).get(),
  ]);
  return !roleSnapshot.empty || !rolesSnapshot.empty;
}

async function hasSuperAdminAuthUser(auth) {
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    if (page.users.some((user) => {
      const claims = user.customClaims || {};
      const roles = Array.isArray(claims.roles) ? claims.roles : [];
      return claims.role === SUPER_ADMIN_ROLE || roles.includes(SUPER_ADMIN_ROLE) || claims.platformAdmin === true;
    })) return true;
    pageToken = page.pageToken;
  } while (pageToken);
  return false;
}

async function removeReservation(firestore, lockRef, operationId) {
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    if (snapshot.exists && snapshot.data()?.operationId === operationId) transaction.delete(lockRef);
  });
}

async function markRecoveryRequired(firestore, lockRef, operationId) {
  await firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    if (snapshot.exists && snapshot.data()?.operationId === operationId) {
      transaction.set(lockRef, { state: 'recovery-required', updatedAt: new Date().toISOString() }, { merge: true });
    }
  });
}

async function bootstrapFirstSuperAdmin(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const admin = options.firebaseAdmin || firebaseAdmin;
  const data = options.firebaseData || firebaseData;
  const hashPassword = options.hashPassword || ((password) => bcrypt.hash(password, config.bcrypt.saltRounds));
  const configError = missingConfiguration(env);
  if (configError) throw new Error(configError);
  if (!admin.isFirebaseConfigured() || !data.isFirebaseDataConfigured()) {
    throw new Error('Firebase Admin and Firestore data mode must both be configured.');
  }

  const email = String(env.INITIAL_SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(env.INITIAL_SUPER_ADMIN_PASSWORD);
  const fullName = String(env.INITIAL_SUPER_ADMIN_NAME || email).trim();
  const operationId = crypto.randomUUID();
  let authUser = null;
  let lockReserved = false;
  let authCreationOutcomeUnknown = false;
  let firestoreOutcomeUnknown = false;
  const firebaseServices = admin.getFirebaseAdmin();
  const auth = firebaseServices.auth();
  const firestore = firebaseServices.firestore();

  logger.info('Bootstrap started.');
  try {
    await auth.listUsers(1);
    await firestore.collection('tenants').limit(1).get();
    logger.info('Firebase connection: PASS.');

    const existingAdmin = await hasSuperAdminDocument(firestore) || await hasSuperAdminAuthUser(auth);
    logger.info(`Existing Super Admin: ${existingAdmin ? 'YES' : 'NO'}.`);
    if (existingAdmin) throw new Error('A Super Admin already exists; bootstrap is one-time only.');

    const emailSnapshot = await firestore.collection('users').where('email', '==', email).limit(1).get();
    if (!emailSnapshot.empty) throw new Error('A Firestore user already exists for the configured email.');
    try {
      await auth.getUserByEmail(email);
      throw new Error('A Firebase Authentication user already exists for the configured email.');
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // No conflicting account exists.
      } else if (error.message === 'A Firebase Authentication user already exists for the configured email.') {
        throw error;
      } else {
        throw new Error('Unable to verify the configured email in Firebase Authentication.');
      }
    }

    const lockRef = firestore.doc(BOOTSTRAP_LOCK_PATH);
    await firestore.runTransaction(async (transaction) => {
      const lock = await transaction.get(lockRef);
      if (lock.exists) throw new Error('Bootstrap has already been run or requires recovery.');
      transaction.create(lockRef, { state: 'initializing', operationId, startedAt: new Date().toISOString() });
    });
    lockReserved = true;

    try {
      authUser = await auth.createUser({ email, password, displayName: fullName, emailVerified: true, disabled: false });
    } catch (error) {
      try {
        const possiblyCreatedUser = await auth.getUserByEmail(email);
        if (possiblyCreatedUser) authCreationOutcomeUnknown = true;
      } catch (lookupError) {
        if (lookupError.code !== 'auth/user-not-found') authCreationOutcomeUnknown = true;
      }
      if (authCreationOutcomeUnknown) {
        await markRecoveryRequired(firestore, firestore.doc(BOOTSTRAP_LOCK_PATH), operationId);
        throw new Error('Firebase Authentication creation outcome is uncertain; inspect the account and recovery lock before retrying.');
      }
      throw error;
    }
    await auth.setCustomUserClaims(authUser.uid, {
      role: SUPER_ADMIN_ROLE,
      roles: [SUPER_ADMIN_ROLE],
      platformAdmin: true,
    });

    const passwordHash = await hashPassword(password);
    const userRef = firestore.collection('users').doc(`platform:${email}`);
    const auditRef = firestore.collection('auditLogs').doc(crypto.randomUUID());
    const now = new Date().toISOString();
    const userRecord = {
      username: email,
      email,
      fullName,
      role: SUPER_ADMIN_ROLE,
      roles: [SUPER_ADMIN_ROLE],
      platformAdmin: true,
      permissions: ['platform.manage', 'schools.manage'],
      status: 'active',
      isVerified: true,
      emailVerified: true,
      passwordHash,
      passwordNeedsReset: false,
      firebaseUid: authUser.uid,
      authProvider: 'password',
      createdAt: now,
    };

    try {
      await firestore.runTransaction(async (transaction) => {
        const [lock, existingUser] = await Promise.all([
          transaction.get(lockRef),
          transaction.get(userRef),
        ]);
        if (!lock.exists || lock.data()?.operationId !== operationId || lock.data()?.state !== 'initializing') {
          throw new Error('Bootstrap reservation changed; refusing to write the administrator.');
        }
        if (existingUser.exists) throw new Error('The Firestore user document already exists.');
        transaction.create(userRef, userRecord);
        transaction.create(auditRef, {
          id: auditRef.id,
          actorId: 'system:initial-super-admin-bootstrap',
          actorRole: 'bootstrap',
          tenantId: null,
          action: 'platform_admin.bootstrap_completed',
          resourceType: 'platform_admin',
          resourceId: authUser.uid,
          success: true,
          metadata: { authProvider: 'firebase', bootstrap: true },
          createdAt: now,
        });
        transaction.set(lockRef, { state: 'completed', completedAt: now, authUid: authUser.uid }, { merge: true });
      });
    } catch (transactionError) {
      let committedUser;
      let committedLock;
      try {
        [committedUser, committedLock] = await Promise.all([userRef.get(), lockRef.get()]);
      } catch {
        firestoreOutcomeUnknown = true;
        throw new Error('Firestore commit outcome is uncertain; inspect the user document and bootstrap lock before retrying.');
      }
      if (committedUser.exists && committedUser.data()?.firebaseUid === authUser.uid &&
          committedLock.exists && committedLock.data()?.operationId === operationId && committedLock.data()?.state === 'completed') {
        logger.info('Initial Super Admin created successfully.');
        return { uid: authUser.uid, email, role: SUPER_ADMIN_ROLE };
      }
      throw transactionError;
    }

    logger.info('Initial Super Admin created successfully.');
    return { uid: authUser.uid, email, role: SUPER_ADMIN_ROLE };
  } catch (error) {
    if (authCreationOutcomeUnknown || firestoreOutcomeUnknown) {
      try {
        await markRecoveryRequired(firestore, firestore.doc(BOOTSTRAP_LOCK_PATH), operationId);
      } catch {
        // Keep the original recovery instruction even if the marker cannot be updated.
      }
      throw error;
    }
    if (authUser && lockReserved) {
      try {
        await auth.deleteUser(authUser.uid);
        await removeReservation(firestore, firestore.doc(BOOTSTRAP_LOCK_PATH), operationId);
        lockReserved = false;
      } catch (rollbackError) {
        try {
          await markRecoveryRequired(firestore, firestore.doc(BOOTSTRAP_LOCK_PATH), operationId);
        } catch {
          // Preserve the original failure; the operator receives a generic recovery instruction.
        }
        throw new Error('Bootstrap failed and rollback was incomplete; inspect Firebase Auth and the initialization lock before retrying.');
      }
    } else if (lockReserved) {
      try {
        await removeReservation(firestore, firestore.doc(BOOTSTRAP_LOCK_PATH), operationId);
      } catch {
        throw new Error('Bootstrap failed and its initialization lock could not be released; inspect it before retrying.');
      }
    }
    throw error;
  }
}

module.exports = { bootstrapFirstSuperAdmin, isStrongPassword };