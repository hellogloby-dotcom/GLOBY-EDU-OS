// auth.service.js
// Business logic for authentication flows: login, refresh, logout, password reset.

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../../config/prisma.client');
const config = require('../../config/auth.config');
const firebaseAdmin = require('../../firebase.admin');
const { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } = require('./utils/token');

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(String(password || ''));
}

async function validateUserByEmail(tenantId, email, password) {
  // Resolve tenant by schoolId for the current login route.
  const tenant = await prisma.tenant.findUnique({ where: { schoolId: tenantId } });
  if (!tenant) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.tenantId !== tenant.id) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

async function createFirebaseUserIfConfigured(email, password, displayName) {
  if (!firebaseAdmin || !firebaseAdmin.isFirebaseConfigured()) return null;
  try {
    const createPayload = { email, displayName };
    if (password) {
      createPayload.password = password;
    }
    return await firebaseAdmin.createUser(createPayload);
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      return firebaseAdmin.getUserByEmail(email);
    }
    throw err;
  }
}

async function createSessionForUser(user) {
  if (!user) throw new Error('Invalid user');
  if (user.status !== 'active') throw new Error('User account is not active');

  const payload = { userId: user.id, tenantId: user.tenantId, roles: [], passwordNeedsReset: user.passwordNeedsReset === true };
  const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } }).catch(() => []);
  payload.roles = roles.map((r) => r.role.name);

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ userId: user.id });
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  }).catch((err) => {
    console.warn('Failed to persist refresh token:', err);
  });

  try {
    const activeTokens = await prisma.refreshToken.findMany({
      where: { userId: user.id, revoked: false },
      orderBy: { createdAt: 'asc' },
    });
    const MAX_SESSIONS = 2;
    if (activeTokens.length > MAX_SESSIONS) {
      const numToRevoke = activeTokens.length - MAX_SESSIONS;
      const revokeIds = activeTokens.slice(0, numToRevoke).map((t) => t.id);
      await prisma.refreshToken.updateMany({ where: { id: { in: revokeIds } }, data: { revoked: true } }).catch((err) => {
        console.warn('Failed to revoke old refresh tokens:', err);
      });
    }
  } catch (err) {
    // If Prisma is not configured or an error occurs, continue without enforcing sessions.
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch((err) => {
    console.warn('Failed to update last login:', err);
  });

  user.roles = payload.roles;
  return { accessToken, refreshToken, user };
}

async function findUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function findTenantBySchoolId(tenantId) {
  return prisma.tenant.findUnique({ where: { schoolId: tenantId } });
}

async function login(tenantId, email, password) {
  const user = await validateUserByEmail(tenantId, email, password);
  if (!user) throw new Error('Invalid credentials');
  if (!user.isVerified) throw new Error('Email must be verified before signing in.');

  return createSessionForUser(user);
}

async function loginWithFirebaseIdToken(idToken, tenantId, options = {}) {
  if (!firebaseAdmin || !firebaseAdmin.isFirebaseConfigured()) {
    throw new Error('Firebase authentication is not configured.');
  }

  const decoded = await firebaseAdmin.verifyIdToken(idToken);
  if (!decoded || !decoded.email) {
    throw new Error('Invalid Firebase ID token.');
  }

  const tenant = await findTenantBySchoolId(tenantId);
  if (!tenant) throw new Error('Tenant not found.');

  let user = await findUserByEmail(decoded.email);
  if (!user) {
    throw new Error('Google account not recognized. Contact your administrator.');
  }

  if (tenant.id !== user.tenantId) {
    throw new Error('User does not belong to the requested tenant.');
  }

  const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } }).catch(() => []);
  const hasSuperAdminRole = roles.some((entry) => String(entry.role?.name || '').toLowerCase() === 'super_admin');
  if (options.platformAdminMode === true && !hasSuperAdminRole) {
    throw new Error('Google account is not authorized for platform administration.');
  }

  if (!user.isVerified && decoded.email_verified) {
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } }).catch(() => null);
    user.isVerified = true;
  }

  const session = await createSessionForUser(user);
  return {
    ...session,
    tenantId: user.tenantId,
    schoolId: tenant.schoolId,
  };
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  try {
    verifyRefreshToken(refreshToken);
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false } });
  if (!stored) throw new Error('Invalid refresh token');

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw new Error('Invalid refresh token');

  const payload = { userId: user.id, tenantId: user.tenantId, roles: [], passwordNeedsReset: user.passwordNeedsReset === true };
  const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } }).catch(() => []);
  payload.roles = roles.map((r) => r.role.name);

  const accessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken({ userId: user.id });

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } }).catch((err) => {
    console.warn('Failed to revoke old refresh token:', err);
  });

  const newTokenHash = hashToken(newRefreshToken);
  await prisma.refreshToken.create({
    data: {
      tokenHash: newTokenHash,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  }).catch((err) => {
    console.warn('Failed to persist new refresh token:', err);
  });

  return { accessToken, refreshToken: newRefreshToken };
}

async function logout(userId, refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({ where: { userId, tokenHash }, data: { revoked: true } }).catch((err) => {
    console.warn('Failed to revoke refresh token on logout:', err);
  });
  return true;
}

async function changePassword(userId, oldPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) throw new Error('Invalid current password');
  if (!isStrongPassword(newPassword)) throw new Error('New password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
  const hash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash, passwordNeedsReset: false, passwordChangedAt: new Date() } });
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } }).catch((err) => {
    console.warn('Failed to revoke refresh tokens after password change:', err);
  });
  const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
  return createSessionForUser(updatedUser);
}

async function forgotPassword(email) {
  // Find user then create email token
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return true; // do not reveal whether user exists

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + config.tokens.emailTokenMinutes * 60 * 1000);
  await prisma.emailToken.create({ data: { tokenHash, type: 'RESET', userId: user.id, expiresAt } }).catch((err) => {
    console.warn('Unable to persist email reset token:', err);
  });
  return token; // caller should send email
}

async function verifyFirebaseIdToken(idToken) {
  if (!firebaseAdmin || !firebaseAdmin.isFirebaseConfigured()) {
    throw new Error('Firebase authentication is not configured.');
  }
  return firebaseAdmin.verifyIdToken(idToken);
}

async function resetPassword(token, newPassword) {
  const tokenHash = hashToken(token);
  const record = await prisma.emailToken.findFirst({ where: { tokenHash, type: 'RESET', used: false, expiresAt: { gt: new Date() } } });
  if (!record) throw new Error('Invalid or expired token');
  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new Error('Invalid token');
  const hash = await bcrypt.hash(newPassword, config.bcrypt.saltRounds);
  if (!isStrongPassword(newPassword)) throw new Error('New password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, passwordNeedsReset: false, passwordChangedAt: new Date() } });
  await prisma.emailToken.update({ where: { id: record.id }, data: { used: true } }).catch((err) => {
    console.warn('Unable to mark reset token as used:', err);
  });
  return true;
}

module.exports = { validateUserByEmail, login, refresh, logout, changePassword, forgotPassword, resetPassword, loginWithFirebaseIdToken, verifyFirebaseIdToken };
