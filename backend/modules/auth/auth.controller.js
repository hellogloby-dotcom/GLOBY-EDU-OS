// auth.controller.js
// Express route handlers for authentication endpoints. Delegates logic to auth.service.

const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const config = require('../../config/auth.config');
const firebaseAdmin = require('../../firebase.admin');
const router = express.Router();
const authService = require('./auth.service');
const { sendEmail, resetTemplate, verificationTemplate } = require('./utils/email');
const schoolService = require('../school/school.service');
const { generateSchoolId, validateRegistrationPayload } = require('./registration.service');
const authMiddleware = require('./middleware/auth.middleware');
const {
  getLoginAttemptKey,
  isLoginRateLimited,
  recordLoginFailure,
  clearLoginFailures,
} = require('./utils/login-rate-limiter');
const { recordAuditEvent } = require('../audit/audit.service');

function canManageUserSession(req, userId) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  return req.user?.userId === userId || roles.some((role) => String(role).toLowerCase() === 'super_admin');
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/api/v1/auth',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}

function setRefreshCookie(res, refreshToken) {
  if (refreshToken) res.cookie('globyedu_refresh_token', refreshToken, { ...sessionCookieOptions(), maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function getRefreshCookie(req) {
  const header = String(req.headers.cookie || '');
  const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('globyedu_refresh_token='));
  return match ? decodeURIComponent(match.slice('globyedu_refresh_token='.length)) : null;
}

function loadSchoolData() {
  const filePath = path.join(__dirname, '../../data/schools.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  return json.schools || [];
}

function saveSchoolData(schools) {
  const filePath = path.join(__dirname, '../../data/schools.json');
  fs.writeFileSync(filePath, JSON.stringify({ schools }, null, 2), 'utf-8');
}

// POST /api/v1/auth/register
// Accepts a structured registration payload (multi-step wizard). Creates tenant, school head,
// default roles, permissions, settings and returns auto-login tokens for the new school head.
router.post('/register', async (req, res) => {
  const payload = req.body || {};
  const schoolHead = payload.head || {};
  const agreements = payload.agreements || {};
  const existingSchools = loadSchoolData();
  const validation = validateRegistrationPayload({ ...payload, head: { ...schoolHead, confirmPassword: payload.head?.confirmPassword }, agreements }, existingSchools);

  if (!validation.ok) {
    return res.status(400).json({ status: 'error', message: validation.message || 'Please review the registration details and try again.' });
  }

  try {
    const trialEndsAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const schoolId = payload.schoolId || generateSchoolId(payload.schoolName, existingSchools);
    const schoolPayload = {
      name: payload.schoolName,
      schoolId,
      tenantId: schoolId,
      country: payload.country || payload.schoolCountry || null,
      region: payload.state || payload.region || null,
      city: payload.city || payload.town || null,
      address: payload.address || null,
      phone: payload.phone || null,
      email: payload.email || null,
      timezone: payload.timezone || null,
      logo: payload.logo || null,
      branding: {
        logo: payload.logo || null,
        schoolType: payload.schoolType || null,
      },
      settings: {
        currency: payload.currency || null,
        language: payload.language || null,
        academicCalendar: payload.academicCalendar || null,
      },
      headFullName: schoolHead.fullName,
      headEmail: String(schoolHead.email || payload.email || '').trim().toLowerCase(),
      headPassword: schoolHead.password,
      subscriptionPlan: '5-Day Trial',
      subscriptionStatus: 'trial',
      trialStatus: '5-Day Trial',
      trialEndsAt,
      schoolStatus: 'active',
    };

    const created = await schoolService.createSchool(schoolPayload);

    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    if (firebaseAdmin.isFirebaseConfigured()) {
      try {
        await firebaseAdmin.createUser({
          email: schoolPayload.headEmail,
          password: schoolHead.password,
          displayName: schoolHead.fullName,
        });
        const verificationLink = await firebaseAdmin.generateEmailVerificationLink(schoolPayload.headEmail, {
          url: `${appUrl}/#/login`,
        });
        await sendEmail(schoolPayload.headEmail, 'Verify your email', verificationTemplate(verificationLink, appUrl));
      } catch (createErr) {
        console.warn('Firebase registration hook failed:', createErr);
      }
    }

    const tenantId = created.schoolId || created.id || (created.school && created.school.schoolId) || schoolId;
    const headAccount = created.headAccount || { username: schoolPayload.headEmail, password: schoolHead.password };

    let loginResult = null;
    try {
      loginResult = await authService.login(tenantId, headAccount.username, headAccount.password);
    } catch (err) {
      loginResult = null;
    }

    const response = {
      status: 'ok',
      schoolId: tenantId,
      tenantId,
      trialEndsAt: (created.trialEndsAt || trialEndsAt).toISOString ? (created.trialEndsAt || trialEndsAt).toISOString() : new Date(created.trialEndsAt || trialEndsAt).toISOString(),
      trialStatus: '5-Day Trial',
      accountStatus: 'trial',
      schoolName: payload.schoolName,
      headAccount: { email: headAccount.username },
    };

    if (loginResult) {
      response.accessToken = loginResult.accessToken;
      response.refreshToken = loginResult.refreshToken;
      response.user = { id: loginResult.user.id, email: loginResult.user.email, role: loginResult.user.roles?.[0] || 'school_authority' };
    }

    return res.json(response);
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'We could not create your school account right now. Please try again.' });
  }
});

// Sessions: list and revoke active refresh tokens for a user (Prisma only).
// GET /api/v1/auth/sessions/:userId
router.get('/sessions/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params || {};
  if (!canManageUserSession(req, userId)) return res.status(403).json({ status: 'error', message: 'Access denied.' });
  const prisma = require('../../config/prisma.client');
  if (!prisma || prisma.__stub) return res.status(501).json({ status: 'error', message: 'Session management not available in fallback mode.' });
  try {
    const sessions = await prisma.refreshToken.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
    const sanitized = sessions.map((s) => ({ id: s.id, createdAt: s.createdAt, expiresAt: s.expiresAt, revoked: s.revoked }));
    return res.json({ status: 'ok', sessions: sanitized });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to fetch sessions.' });
  }
});

// POST /api/v1/auth/sessions/revoke
router.post('/sessions/revoke', authMiddleware, async (req, res) => {
  const { userId, sessionId } = req.body || {};
  const prisma = require('../../config/prisma.client');
  if (!prisma || prisma.__stub) return res.status(501).json({ status: 'error', message: 'Session management not available in fallback mode.' });
  if (!userId || !sessionId) return res.status(400).json({ status: 'error', message: 'userId and sessionId are required.' });
  if (!canManageUserSession(req, userId)) return res.status(403).json({ status: 'error', message: 'Access denied.' });
  try {
    await prisma.refreshToken.updateMany({ where: { id: sessionId, userId }, data: { revoked: true } });
    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: 'Unable to revoke session.' });
  }
});

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { schoolId, username, password } = req.body || {};
  const loginAttemptKey = getLoginAttemptKey({ schoolId, username, platformAdminMode: false });
  if (isLoginRateLimited(loginAttemptKey)) {
    await recordAuditEvent({ req, tenantId: schoolId || null, action: 'auth.login_rate_limited', resourceType: 'user', success: false, metadata: { loginType: 'prisma' } });
    return res.status(429).json({ status: 'error', message: 'Too many failed sign-in attempts. Please try again later.' });
  }

  try {
    if (!schoolId || !username || !password) {
      recordLoginFailure(loginAttemptKey);
      await recordAuditEvent({ req, tenantId: schoolId || null, action: 'auth.login_failed', resourceType: 'user', success: false, metadata: { loginType: 'prisma', reason: 'missing_credentials' } });
      return res.status(400).json({ status: 'error', message: 'Missing credentials' });
    }

    const result = await authService.login(schoolId, username, password);
    clearLoginFailures(loginAttemptKey);
    setRefreshCookie(res, result.refreshToken);
    await recordAuditEvent({ req, actorId: result.user.id, actorRole: result.user.roles?.[0], tenantId: result.user.tenantId || schoolId, action: 'auth.login_succeeded', resourceType: 'user', resourceId: result.user.id, metadata: { loginType: 'prisma' } });
    return res.json({ status: 'ok', accessToken: result.accessToken, refreshToken: result.refreshToken, user: { id: result.user.id, email: result.user.email, roles: result.user.roles } });
  } catch (err) {
    recordLoginFailure(loginAttemptKey);
    await recordAuditEvent({ req, tenantId: schoolId || null, action: 'auth.login_failed', resourceType: 'user', success: false, metadata: { loginType: 'prisma' } });
    return res.status(401).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/firebase-login
router.post('/firebase-login', async (req, res) => {
  try {
    const { idToken, schoolId, platformAdmin, identifier, loginType } = req.body || {};
    if (!idToken || !schoolId) return res.status(400).json({ status: 'error', message: 'Missing Firebase token or school ID' });

    const result = await authService.loginWithFirebaseIdToken(idToken, schoolId, { platformAdminMode: platformAdmin === true, identifier, loginType });
    setRefreshCookie(res, result.refreshToken);
    return res.json({
      status: 'ok',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tenantId: result.tenantId,
      schoolId: result.schoolId,
      user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName, roles: result.user.roles },
    });
  } catch (err) {
    return res.status(401).json({ status: 'error', message: err.message });
  }
});

router.post('/firebase-link', authMiddleware, async (req, res) => {
  try {
    const { idToken } = req.body || {};
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    if (!idToken || !userId || !tenantId) return res.status(400).json({ status: 'error', message: 'Missing Firebase token or authenticated user.' });
    const user = await authService.linkFirebaseIdentity(idToken, userId, tenantId);
    return res.json({ status: 'ok', linked: true, user: { id: user.id, googleEmail: user.googleEmail } });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = getRefreshCookie(req) || req.body?.refreshToken;
    if (!refreshToken) return res.status(400).json({ status: 'error', message: 'Missing refresh token' });
    const tokens = await authService.refresh(refreshToken);
    setRefreshCookie(res, tokens.refreshToken);
    return res.json({ status: 'ok', accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    return res.status(401).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const refreshToken = getRefreshCookie(req) || req.body?.refreshToken;
    if (!userId || !refreshToken) return res.status(400).json({ status: 'error', message: 'Authenticated session is required' });
    await authService.logout(userId, refreshToken);
    res.clearCookie('globyedu_refresh_token', sessionCookieOptions());
    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const token = await authService.forgotPassword(email);
    if (token) {
      // send email (stub)
      const appUrl = process.env.APP_URL || 'http://localhost:4000';
      await sendEmail(email, 'Password reset', resetTemplate(token, appUrl));
    }
    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    await authService.resetPassword(token, password);
    await recordAuditEvent({ req, action: 'auth.password_reset', resourceType: 'user', metadata: { initiatedBy: 'recovery_token' } });
    return res.json({ status: 'ok' });
  } catch (err) {
    await recordAuditEvent({ req, action: 'auth.password_reset_failed', resourceType: 'user', success: false });
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/change-password (requires auth) - left as a protected route to be wired
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { userId: requestedUserId, oldPassword, newPassword } = req.body || {};
    const userId = req.user?.userId;
    if (!userId || (requestedUserId && requestedUserId !== userId) || !canManageUserSession(req, userId)) {
      return res.status(403).json({ status: 'error', message: 'Access denied.' });
    }
    const session = await authService.changePassword(userId, oldPassword, newPassword);
    setRefreshCookie(res, session.refreshToken);
    await recordAuditEvent({ req, actorId: userId, actorRole: req.user?.roles?.[0], tenantId: req.user?.tenantId, action: 'auth.password_changed', resourceType: 'user', resourceId: userId });
    return res.json({ status: 'ok', accessToken: session.accessToken, refreshToken: session.refreshToken, passwordNeedsReset: false });
  } catch (err) {
    await recordAuditEvent({ req, actorId: req.user?.userId, actorRole: req.user?.roles?.[0], tenantId: req.user?.tenantId, action: 'auth.password_change_failed', resourceType: 'user', resourceId: req.user?.userId, success: false });
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
