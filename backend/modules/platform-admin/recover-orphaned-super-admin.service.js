const crypto = require('crypto');
const bcrypt = require('bcrypt');
const firebaseAdmin = require('../../firebase.admin');
const firebaseData = require('../../firebase.data');
const { isStrongPassword } = require('./bootstrap-super-admin.service');

const RECOVERY_LOCK_PATH = 'system/orphaned-super-admin-recovery';
const SUPER_ADMIN_ROLE = 'super_admin';

function validateConfiguration(env) {
  const recoverySecret = String(env.ORPHANED_SUPER_ADMIN_RECOVERY_SECRET || '').trim();
  const bootstrapSecret = String(env.INITIAL_SUPER_ADMIN_BOOTSTRAP_SECRET || '').trim();
  const password = String(env.INITIAL_SUPER_ADMIN_PASSWORD || '');
  if (String(env.NODE_ENV || '').trim() !== 'production') throw new Error('Recovery is only allowed in production.');
  if (String(env.DATA_STORE_MODE || '').trim().toLowerCase() !== 'firebase') throw new Error('DATA_STORE_MODE must be firebase.');
  if (recoverySecret.length < 32) throw new Error('ORPHANED_SUPER_ADMIN_RECOVERY_SECRET must contain at least 32 characters.');
  if (bootstrapSecret.length < 32 || bootstrapSecret === recoverySecret) throw new Error('A separate Super Admin bootstrap secret is required.');
  if (!String(env.INITIAL_SUPER_ADMIN_EMAIL || '').trim()) throw new Error('INITIAL_SUPER_ADMIN_EMAIL is required.');
  if (!isStrongPassword(password)) throw new Error('INITIAL_SUPER_ADMIN_PASSWORD does not meet the minimum password policy.');
  if (password === recoverySecret || password === bootstrapSecret) throw new Error('Recovery secrets must be different from the administrator password.');
}

async function readSuperAdminRecords(firestore) {
  const [byRole, byRoles] = await Promise.all([
    firestore.collection('users').where('role', '==', SUPER_ADMIN_ROLE).get(),
    firestore.collection('users').where('roles', 'array-contains', SUPER_ADMIN_ROLE).get(),
  ]);
  return [...new Map([...byRole.docs, ...byRoles.docs].map((doc) => [doc.id, doc])).values()];
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function isSuperAdminAuthUser(user) {
  const claims = user.customClaims || {};
  const roles = Array.isArray(claims.roles) ? claims.roles : [];
  return claims.role === SUPER_ADMIN_ROLE || roles.includes(SUPER_ADMIN_ROLE) || claims.platformAdmin === true;
}

function existingRecordUnchanged(current, original, uid) {
  return current && current.firebaseUid === uid &&
    current.role === original.role && current.platformAdmin === original.platformAdmin &&
    current.status === original.status && current.email === original.email &&
    current.username === original.username && current.passwordHash === original.passwordHash &&
    JSON.stringify(current.roles || []) === JSON.stringify(original.roles || []) &&
    !current.tenantId && !current.schoolId;
}

async function recoverOrphanedSuperAdmin(options = {}) {
  const env = options.env || process.env;
  const logger = options.logger || console;
  const admin = options.firebaseAdmin || firebaseAdmin;
  const data = options.firebaseData || firebaseData;
  const comparePassword = options.comparePassword || bcrypt.compare;
  validateConfiguration(env);
  if (!admin.isFirebaseConfigured() || !data.isFirebaseDataConfigured()) {
    throw new Error('Firebase Admin and Firestore data mode must both be configured.');
  }

  const email = String(env.INITIAL_SUPER_ADMIN_EMAIL).trim().toLowerCase();
  const password = String(env.INITIAL_SUPER_ADMIN_PASSWORD);
  const operationId = crypto.randomUUID();
  const services = admin.getFirebaseAdmin();
  const auth = services.auth();
  const firestore = services.firestore();
  const admins = await readSuperAdminRecords(firestore);
  if (admins.length !== 1) throw new Error('Recovery requires exactly one existing Firestore Super Admin record.');

  const adminDoc = admins[0];
  const adminRef = firestore.collection('users').doc(adminDoc.id);
  const record = adminDoc.data() || {};
  const roles = Array.isArray(record.roles) ? record.roles.map((role) => String(role).toLowerCase()) : [];
  const identifiers = [record.email, record.username].filter(Boolean).map((value) => String(value).trim().toLowerCase());
  if (record.role !== SUPER_ADMIN_ROLE || !roles.includes(SUPER_ADMIN_ROLE) || record.platformAdmin !== true ||
      record.status !== 'active' || record.tenantId || record.schoolId || !identifiers.includes(email)) {
    throw new Error('The existing Firestore record is not an eligible platform-level Super Admin.');
  }
  if (!record.passwordHash || !(await comparePassword(password, record.passwordHash))) {
    throw new Error('Configured password does not match the existing Firestore administrator credential.');
  }

  const [authUsers, byEmail] = await Promise.all([
    listAllAuthUsers(auth),
    auth.getUserByEmail(email).catch((error) => {
      if (error.code === 'auth/user-not-found') return null;
      throw new Error('Unable to verify the configured Firebase Authentication identity.');
    }),
  ]);
  let oldUidUser = null;
  const oldUid = String(record.firebaseUid || '').trim();
  if (oldUid) {
    try {
      oldUidUser = await auth.getUser(oldUid);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw new Error('Unable to verify the stored Firebase UID.');
    }
  }
  if (oldUidUser && String(oldUidUser.email || '').trim().toLowerCase() !== email) {
    throw new Error('The stored Firebase UID belongs to a different identity; recovery stopped.');
  }
  if (byEmail && oldUidUser && byEmail.uid !== oldUidUser.uid) {
    throw new Error('More than one Firebase Authentication identity matches the existing record.');
  }
  const authUser = byEmail || oldUidUser;
  const otherAdmins = authUsers.filter((user) => isSuperAdminAuthUser(user) && user.uid !== authUser?.uid);
  if (otherAdmins.length) throw new Error('Another Firebase Authentication Super Admin exists; recovery stopped.');
  if (authUser && authUser.disabled) throw new Error('The matching Firebase Authentication account is disabled.');
  if (authUser && isSuperAdminAuthUser(authUser) && authUser.customClaims?.role !== SUPER_ADMIN_ROLE) {
    throw new Error('The matching Firebase Authentication claims are inconsistent.');
  }

  const lockRef = firestore.doc(RECOVERY_LOCK_PATH);
  const auditRef = firestore.collection('auditLogs').doc(crypto.randomUUID());
  await firestore.runTransaction(async (transaction) => {
    const lock = await transaction.get(lockRef);
    const currentAdmin = await transaction.get(adminRef);
    if (lock.exists) throw new Error('Super Admin recovery has already been used or requires operator review.');
    if (!currentAdmin.exists || !existingRecordUnchanged(currentAdmin.data(), record, oldUid)) {
      throw new Error('The existing Super Admin record changed during recovery; no changes were made.');
    }
    transaction.create(lockRef, { state: 'initializing', operationId, startedAt: new Date().toISOString() });
  });

  let linkedAuthUser = authUser;
  let createdAuthUser = false;
  let previousClaims = authUser?.customClaims || {};
  let claimsChangeAttempted = false;
  let authCreationOutcomeUnknown = false;
  let firestoreOutcomeUnknown = false;
  try {
    if (!linkedAuthUser) {
      try {
        linkedAuthUser = await auth.createUser({ email, password, displayName: String(record.fullName || env.INITIAL_SUPER_ADMIN_NAME || email), emailVerified: true, disabled: false });
        createdAuthUser = true;
      } catch (error) {
        try {
          const possibleUser = await auth.getUserByEmail(email);
          if (possibleUser) authCreationOutcomeUnknown = true;
        } catch (lookupError) {
          if (lookupError.code !== 'auth/user-not-found') authCreationOutcomeUnknown = true;
        }
        throw authCreationOutcomeUnknown
          ? new Error('Firebase Authentication creation outcome is uncertain; inspect the recovery lock before retrying.')
          : error;
      }
    }

    const claims = { ...previousClaims };
    delete claims.tenantId;
    delete claims.schoolId;
    Object.assign(claims, { role: SUPER_ADMIN_ROLE, roles: [SUPER_ADMIN_ROLE], platformAdmin: true });
    claimsChangeAttempted = true;
    await auth.setCustomUserClaims(linkedAuthUser.uid, claims);

    const now = new Date().toISOString();
    await firestore.runTransaction(async (transaction) => {
      const [lock, currentAdmin] = await Promise.all([transaction.get(lockRef), transaction.get(adminRef)]);
      if (!lock.exists || lock.data()?.operationId !== operationId || lock.data()?.state !== 'initializing') {
        throw new Error('Recovery reservation changed; refusing to update the Super Admin record.');
      }
      if (!currentAdmin.exists || !existingRecordUnchanged(currentAdmin.data(), record, oldUid)) {
        throw new Error('The existing Super Admin record changed during recovery.');
      }
      transaction.set(adminRef, {
        ...record,
        role: SUPER_ADMIN_ROLE,
        roles: [SUPER_ADMIN_ROLE],
        platformAdmin: true,
        firebaseUid: linkedAuthUser.uid,
        authProvider: record.authProvider || 'password',
        tenantId: null,
        schoolId: null,
        updatedAt: now,
      });
      transaction.create(auditRef, {
        id: auditRef.id,
        actorId: 'system:orphaned-super-admin-recovery',
        actorRole: 'recovery',
        tenantId: null,
        action: 'platform_admin.orphan_recovered',
        resourceType: 'platform_admin',
        resourceId: linkedAuthUser.uid,
        success: true,
        metadata: { authProvider: record.authProvider || 'password', recoveredExistingRecord: true },
        createdAt: now,
      });
      transaction.set(lockRef, { state: 'completed', completedAt: now, authUid: linkedAuthUser.uid }, { merge: true });
    });
    logger.info('Existing platform administrator identity recovery completed.');
    return { status: 'recovered', uid: linkedAuthUser.uid };
  } catch (error) {
    if (authCreationOutcomeUnknown) {
      await markRecoveryRequired(firestore, lockRef, operationId);
      throw error;
    }
    try {
      const [currentAdmin, lock] = await Promise.all([adminRef.get(), lockRef.get()]);
      if (currentAdmin.exists && currentAdmin.data()?.firebaseUid === linkedAuthUser?.uid &&
          lock.exists && lock.data()?.operationId === operationId && lock.data()?.state === 'completed') {
        logger.info('Existing platform administrator identity recovery completed.');
        return { status: 'recovered', uid: linkedAuthUser.uid };
      }
    } catch {
      firestoreOutcomeUnknown = true;
    }
    if (firestoreOutcomeUnknown) {
      await markRecoveryRequired(firestore, lockRef, operationId);
      throw new Error('Firestore recovery outcome is uncertain; inspect the administrator record and recovery lock before retrying.');
    }
    try {
      if (createdAuthUser && linkedAuthUser) await auth.deleteUser(linkedAuthUser.uid);
      else if (claimsChangeAttempted && linkedAuthUser) await auth.setCustomUserClaims(linkedAuthUser.uid, previousClaims);
      await removeReservation(firestore, lockRef, operationId);
    } catch {
      await markRecoveryRequired(firestore, lockRef, operationId).catch(() => {});
      throw new Error('Recovery failed and rollback was incomplete; operator review is required before retrying.');
    }
    throw error;
  }
}

async function removeReservation(firestore, lockRef, operationId) {
  await firestore.runTransaction(async (transaction) => {
    const lock = await transaction.get(lockRef);
    if (lock.exists && lock.data()?.operationId === operationId) transaction.delete(lockRef);
  });
}

async function markRecoveryRequired(firestore, lockRef, operationId) {
  await firestore.runTransaction(async (transaction) => {
    const lock = await transaction.get(lockRef);
    if (lock.exists && lock.data()?.operationId === operationId) {
      transaction.set(lockRef, { state: 'recovery-required', updatedAt: new Date().toISOString() }, { merge: true });
    }
  });
}

module.exports = { recoverOrphanedSuperAdmin, validateConfiguration, RECOVERY_LOCK_PATH };