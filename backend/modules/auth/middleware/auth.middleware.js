// auth.middleware.js
// Express middleware to protect routes using JWT access tokens.

const fs = require('fs');
const path = require('path');
const { verifyAccessToken } = require('../utils/token');
const firebaseAdmin = require('../../../firebase.admin');
const firebaseData = require('../../../firebase.data');
const prisma = require('../../../config/prisma.client');

function loadSchoolData() {
  const filePath = path.join(__dirname, '../../../data/schools.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw);
    return json.schools || [];
  } catch (err) {
    return [];
  }
}

function parseMockToken(token) {
  if (!token || !token.startsWith('mock-jwt-')) return null;
  try {
    const payload = Buffer.from(token.slice('mock-jwt-'.length), 'base64').toString('utf8');
    const [schoolId, username] = payload.split(':');
    if (!schoolId || !username) return null;
    return { schoolId, username };
  } catch (err) {
    return null;
  }
}

function isFallbackLocalToken(payload) {
  if (!payload || typeof payload.userId !== 'string') return false;
  if (!payload.tenantId) return false;
  return payload.userId.includes(':') && payload.roles && Array.isArray(payload.roles);
}

function findFallbackUser(schoolId, username) {
  const schools = loadSchoolData();
  const school = schools.find((entry) => entry.schoolId === schoolId);
  if (!school || !Array.isArray(school.users)) return null;
  const normalizedUsername = username.toLowerCase();
  const user = school.users.find((entry) => [entry.username, entry.email, entry.teacherId, entry.studentId]
    .some((identifier) => String(identifier || '').toLowerCase() === normalizedUsername));
  if (!user) return null;
  return {
    userId: `${schoolId}:${user.username}`,
    tenantId: schoolId,
    roles: [user.role],
    platformAdmin: user.platformAdmin === true,
    passwordNeedsReset: user.passwordNeedsReset === true,
    status: user.status || 'active',
  };
}

function findFallbackUserByPayload(payload) {
  if (!payload || typeof payload.userId !== 'string' || !payload.userId.includes(':')) return null;
  const separator = payload.userId.indexOf(':');
  const schoolId = payload.userId.slice(0, separator);
  const username = payload.userId.slice(separator + 1);
  return findFallbackUser(schoolId, username);
}

function enforceAccountStatus(req, res, user) {
  const status = String(user?.status || 'active').trim().toLowerCase();
  const isSuspended = status === 'suspended' || status === 'inactive' || status === 'blocked' || status === 'disabled';
  if (isSuspended) {
    return res.status(403).json({
      status: 'error',
      code: 'ACCOUNT_SUSPENDED',
      message: 'Your account has been suspended. Please contact your school administrator.',
    });
  }
  return false;
}

function enforcePasswordChange(req, res, user) {
  if (user?.passwordNeedsReset !== true) return false;
  const allowedPaths = ['/change-password', '/logout'];
  if (allowedPaths.includes(req.path)) return false;
  res.status(403).json({
    status: 'error',
    code: 'PASSWORD_CHANGE_REQUIRED',
    message: 'You must change your temporary password before continuing.',
  });
  return true;
}

async function resolveFirebaseUser(decodedToken) {
  const email = String(decodedToken.email || '').trim().toLowerCase();
  if (!email) return null;

  if (firebaseData.isFirebaseDataConfigured()) {
    const snapshot = await firebaseData.getFirestore().collection('users').where('email', '==', email).limit(1).get();
    if (snapshot.empty) return null;
    const user = snapshot.docs[0].data();
    if (user.status !== 'active') return null;
    const userId = snapshot.docs[0].id;
    const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean);
    return {
      userId: userId,
      tenantId: user.tenantId || user.schoolId,
      roles,
      platformAdmin: roles.includes('super_admin'),
      passwordNeedsReset: user.passwordNeedsReset === true,
    };
  }

  if (prisma && !prisma.__stub) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') return null;
    const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
    return {
      userId: user.id,
      tenantId: user.tenantId,
      roles: roles.map((entry) => entry.role.name),
      platformAdmin: roles.some((entry) => entry.role.name === 'super_admin'),
    };
  }

  const schools = loadSchoolData();
  for (const school of schools) {
    const user = (school.users || []).find((entry) => {
      return String(entry.username || entry.email || '').trim().toLowerCase() === email;
    });
    if (user && user.status === 'active' && user.emailVerified === true) {
      return {
        userId: `${school.schoolId}:${user.username}`,
        tenantId: school.schoolId,
        roles: [user.role],
        platformAdmin: user.platformAdmin === true,
      };
    }
  }

  return null;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Authorization required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const fallbackLocalToken = isFallbackLocalToken(payload);

    if (prisma && !prisma.__stub && payload.userId && !fallbackLocalToken) {
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || user.status !== 'active') {
        return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
      }
      payload.passwordNeedsReset = user.passwordNeedsReset === true;
    }

    if (fallbackLocalToken) {
      payload.passwordNeedsReset = payload.passwordNeedsReset === true;
    }

    req.user = payload; // minimal payload: { userId, roles, tenantId, passwordNeedsReset }
    const fallbackUser = findFallbackUserByPayload(payload);
    if (fallbackUser && enforceAccountStatus(req, res, fallbackUser)) return;
    if (payload.status && String(payload.status).toLowerCase() === 'suspended') {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact your school administrator.',
      });
    }
    if (enforcePasswordChange(req, res, req.user)) return;
    return next();
  } catch (err) {
    const mockPayload = parseMockToken(token);
    if (mockPayload) {
      const fallbackUser = findFallbackUser(mockPayload.schoolId, mockPayload.username);
      if (!fallbackUser) {
        return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
      }

      req.user = fallbackUser;
      if (enforceAccountStatus(req, res, req.user)) return;
      if (enforcePasswordChange(req, res, req.user)) return;
      return next();
    }

    if (!firebaseAdmin.isFirebaseConfigured()) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
    }

    try {
      const decodedToken = await firebaseAdmin.verifyIdToken(token);
      const firebaseUser = await resolveFirebaseUser(decodedToken);
      if (!firebaseUser) {
        return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
      }
      req.user = firebaseUser;
      if (enforceAccountStatus(req, res, req.user)) return;
      if (enforcePasswordChange(req, res, req.user)) return;
      return next();
    } catch (firebaseError) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired token.' });
    }
  }
}

module.exports = authMiddleware;
